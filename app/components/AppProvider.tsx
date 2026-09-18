"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppSettings,
  BlsSettings,
  Memory,
  Message,
  ProtocolPhase,
  SessionKind,
  Thread,
} from "@/lib/types";
import { DEFAULT_BLS, DEFAULT_SETTINGS } from "@/lib/types";
import type { SessionMode } from "@/lib/protocol";
import { fetchJson, FetchJsonError } from "@/lib/fetch-json";
import { DEFAULT_GUIDED_CHAT_CHROME_ID } from "@/lib/guided-chat-chrome";
import { DEFAULT_FREE_SESSION_CHROME_ID } from "@/lib/free-session-chrome";
import {
  SESSION_MODE_GUIDED_LABEL,
  SESSION_MODE_SELF_LABEL,
} from "@/lib/brand";
import { shouldBootstrapAgent } from "@/lib/session-mode";
import {
  clearBlsPrefs,
  isDefaultBlsSettings,
  loadBlsPrefs,
  saveBlsPrefs,
} from "@/lib/bls-prefs";
import {
  resolveSessionThreadId,
  storeSessionId,
  withThreadParam,
} from "@/lib/session-restore";
import {
  parsePublicAdsConfig,
  resolveAdDecision,
  type AdDecisionState,
  type AdGateResult,
  type PublicAdsConfig,
} from "@/lib/ads";
import { UpgradeModal } from "./UpgradeModal";
import { AdInterstitial } from "./AdInterstitial";
import { AdSenseLoader } from "./AdSenseLoader";
import { useGuideHost } from "./guide/ProductGuide";

export type EntitlementPublic = {
  accessTier: string;
  canUseApp: boolean;
  needsOnboarding: boolean;
  needsPayment: boolean;
  plan: string;
  status: string;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  guidedUsed: number;
  guidedLimit: number;
  guidedRemaining: number;
  blsSecondsUsed: number;
  blsSecondsLimit: number;
  blsSecondsRemaining: number;
  isTrialLimited: boolean;
};

function adFreqStorageKey(userId: string | null): string {
  return userId ? `emdr_ad_freq_v1:${userId}` : "emdr_ad_freq_v1:anon";
}

function loadAdFreqState(userId: string | null): AdDecisionState {
  if (typeof window === "undefined") {
    return { sessionShownCount: 0, lastShownAt: null, setsSinceLastAd: 0 };
  }
  try {
    const raw = localStorage.getItem(adFreqStorageKey(userId));
    if (!raw) {
      return { sessionShownCount: 0, lastShownAt: null, setsSinceLastAd: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<AdDecisionState>;
    return {
      sessionShownCount: 0, // reset per browser session
      lastShownAt:
        typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : null,
      setsSinceLastAd: 0, // reset per browser session
    };
  } catch {
    return { sessionShownCount: 0, lastShownAt: null, setsSinceLastAd: 0 };
  }
}

function saveAdFreqState(userId: string | null, state: AdDecisionState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(adFreqStorageKey(userId), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

type UpgradeState = {
  open: boolean;
  reason: "trial_limit_reached" | "bls_limit_reached" | "generic";
};

interface AppState {
  threads: Thread[];
  activeThreadId: string | null;
  messages: Message[];
  /** True while the session guide is composing a reply. */
  agentTyping: boolean;
  /**
   * True while a reload is re-opening the session that was open before, so the
   * UI can hold a quiet placeholder instead of flashing the Home screen.
   */
  restoringSession: boolean;
  memoryEnabled: boolean;
  settings: AppSettings;
  bls: BlsSettings;
  sessionMode: SessionMode;
  entitlement: EntitlementPublic | null;
  setSessionMode: (m: SessionMode) => void;
  setBls: (
    patch:
      | Partial<BlsSettings>
      | ((prev: BlsSettings) => Partial<BlsSettings>)
  ) => void;
  refreshThreads: () => Promise<void>;
  refreshEntitlement: () => Promise<EntitlementPublic | null>;
  selectThread: (id: string) => Promise<void>;
  /** Clear selection and show the Home welcome screen (no thread open). */
  clearActiveThread: () => void;
  createThread: () => Promise<void>;
  updateThreadLocal: (id: string, patch: Partial<Thread>) => Promise<void>;
  chooseSessionMode: (kind: Exclude<SessionKind, "pending">) => Promise<boolean>;
  deleteThread: (id: string) => Promise<void>;
  sendUserMessage: (text: string) => Promise<{
    startSet: boolean;
    riskFlag?: boolean;
    outOfWindow?: boolean;
    distress?: "ok" | "elevated" | "overwhelm";
    agentText?: string;
    agentId?: string;
    phase?: ProtocolPhase;
  }>;
  /**
   * Tell the guide a set ended. `completed` is a set that ran out; `stopped`
   * is one the person cut short, which must not count as processed material.
   */
  requestCheckIn: (outcome?: "completed" | "stopped") => Promise<void>;
  bootstrapAgent: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  saveSettings: (s: AppSettings) => Promise<void>;
  memories: Memory[];
  refreshMemories: () => Promise<void>;
  openUpgradeModal: (reason?: UpgradeState["reason"]) => void;
  leaseBlsSeconds: (seconds: number) => Promise<number>;
  /** Show free-session interstitial when frequency rules say so. */
  maybeShowAd: () => Promise<AdGateResult>;
  /** Call after a free BLS set completes (for every_n_sets frequency). */
  noteAdSetCompleted: () => void;
  /** Trial ads config from billing status (in-page Resources display, etc.). */
  adsConfig: PublicAdsConfig;
  /** True after the first billing/ads fetch attempt (success or fail). */
  adsReady: boolean;
  /** Platform flag: voice features (TTS / Voice Mode) allowed. */
  voiceEnabled: boolean;
  /** Platform guided chat chrome theme id (1–20). */
  guidedChatChromeId: number;
  /** Platform free session chrome theme id (1–10). */
  freeSessionChromeId: number;
  /** null = loading; false = must show informed consent gate. */
  consentOk: boolean | null;
  refreshConsent: () => Promise<boolean>;
  /**
   * SessionWorkspace registers a leave guard. Return true if the leave was
   * deferred (modal shown); call proceed() when the user confirms.
   */
  registerLeaveGuard: (
    guard: ((proceed: () => void) => boolean) | null
  ) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  /**
   * True while a hard refresh is re-opening the session that was open before.
   * The UI shows a quiet placeholder instead of the Home screen, which would
   * look like the session was lost.
   */
  const [restoringSession, setRestoringSession] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [guidedChatChromeId, setGuidedChatChromeId] = useState(
    DEFAULT_GUIDED_CHAT_CHROME_ID
  );
  const [freeSessionChromeId, setFreeSessionChromeId] = useState(
    DEFAULT_FREE_SESSION_CHROME_ID
  );
  const [consentOk, setConsentOk] = useState<boolean | null>(null);
  /** True while the session guide is composing a reply (typing indicator). */
  const [agentTyping, setAgentTyping] = useState(false);
  const leaveGuardRef = useRef<((proceed: () => void) => boolean) | null>(
    null
  );
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [bls, setBlsState] = useState<BlsSettings>(DEFAULT_BLS);
  const blsUserIdRef = useRef<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("idle");
  const [entitlement, setEntitlement] = useState<EntitlementPublic | null>(null);
  const [adsConfig, setAdsConfig] = useState<PublicAdsConfig>({
    adsActive: false,
  });
  const [adsReady, setAdsReady] = useState(false);
  const [adUserId, setAdUserId] = useState<string | null>(null);
  const [adFreq, setAdFreq] = useState<AdDecisionState>(() =>
    loadAdFreqState(null)
  );
  const [adOpen, setAdOpen] = useState(false);
  const adResolverRef = useRef<((result: AdGateResult) => void) | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeState>({
    open: false,
    reason: "generic",
  });

  const openUpgradeModal = useCallback(
    (reason: UpgradeState["reason"] = "generic") => {
      setUpgrade({ open: true, reason });
    },
    []
  );

  const refreshEntitlement = useCallback(async () => {
    try {
      const data = await fetchJson<EntitlementPublic & { ads?: unknown }>(
        "/api/billing/status"
      );
      setEntitlement(data);
      setAdsConfig(parsePublicAdsConfig(data.ads));
      setAdsReady(true);
      return data;
    } catch (err) {
      console.error("refreshEntitlement failed:", err);
      setAdsConfig({ adsActive: false });
      setAdsReady(true);
      return null;
    }
  }, []);

  const recordAdShown = useCallback(() => {
    setAdFreq((prev) => {
      const next: AdDecisionState = {
        sessionShownCount: prev.sessionShownCount + 1,
        lastShownAt: Date.now(),
        setsSinceLastAd: 0,
      };
      saveAdFreqState(adUserId, next);
      return next;
    });
  }, [adUserId]);

  const finishAd = useCallback(
    (result: AdGateResult) => {
      setAdOpen(false);
      if (result === "continued") {
        recordAdShown();
      }
      const resolve = adResolverRef.current;
      adResolverRef.current = null;
      resolve?.(result);
    },
    [recordAdShown]
  );

  const maybeShowAd = useCallback((): Promise<AdGateResult> => {
    if (!adsConfig.adsActive) return Promise.resolve("skipped");
    const decision = resolveAdDecision(
      {
        adsActive: true,
        frequencyMode: adsConfig.frequencyMode,
        everyMinutes: adsConfig.everyMinutes,
        everyNSets: adsConfig.everyNSets,
      },
      adFreq
    );
    if (!decision.show) return Promise.resolve("skipped");

    return new Promise((resolve) => {
      adResolverRef.current = resolve;
      setAdOpen(true);
    });
  }, [adsConfig, adFreq]);

  const noteAdSetCompleted = useCallback(() => {
    setAdFreq((prev) => {
      const next = {
        ...prev,
        setsSinceLastAd: prev.setsSinceLastAd + 1,
      };
      saveAdFreqState(adUserId, next);
      return next;
    });
  }, [adUserId]);

  const refreshConsent = useCallback(async () => {
    try {
      const data = await fetchJson<{ requiredOk?: boolean }>("/api/consents");
      const ok = Boolean(data.requiredOk);
      setConsentOk(ok);
      return ok;
    } catch (err) {
      console.error("refreshConsent failed:", err);
      setConsentOk(false);
      return false;
    }
  }, []);

  const registerLeaveGuard = useCallback(
    (guard: ((proceed: () => void) => boolean) | null) => {
      leaveGuardRef.current = guard;
    },
    []
  );

  const runWithLeaveGuard = useCallback((proceed: () => void) => {
    const guard = leaveGuardRef.current;
    if (guard && guard(proceed)) return;
    proceed();
  }, []);

  const refreshThreads = useCallback(async (exceptId?: string | null) => {
    try {
      const keep =
        exceptId === undefined ? activeThreadId : exceptId;
      const q =
        keep != null && keep !== ""
          ? `?except=${encodeURIComponent(keep)}`
          : "";
      const data = await fetchJson<{ threads?: Thread[] }>(
        `/api/threads${q}`
      );
      setThreads(data.threads ?? []);
    } catch (err) {
      console.error("refreshThreads failed:", err);
    }
  }, [activeThreadId]);

  /**
   * Push the open session into the URL so a refresh, a duplicate tab, or a
   * shared link lands in the same session. `replaceState` keeps the history
   * clean (no extra Back steps).
   */
  const syncSessionUrl = useCallback((threadId: string | null) => {
    if (typeof window === "undefined") return;
    const next = withThreadParam({
      pathname: window.location.pathname,
      search: window.location.search,
      threadId,
    });
    const current = `${window.location.pathname}${window.location.search}`;
    if (next === current) return;
    window.history.replaceState(window.history.state, "", next);
  }, []);

  /**
   * Load one thread and remember it as the open session.
   * Returns false when the thread is gone (deleted, or pruned as an empty
   * tab), so the caller can fall back to Home instead of showing a dead shell.
   */
  const selectThreadRaw = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const data = await fetchJson<{
          messages?: Message[];
          thread?: Thread;
        }>(`/api/threads?id=${id}`);
        if (!data.thread) {
          // Pruned or deleted while we were away: forget it.
          storeSessionId(null);
          syncSessionUrl(null);
          return false;
        }
        setActiveThreadId(id);
        setMessages(data.messages ?? []);
        storeSessionId(id);
        syncSessionUrl(id);
        return true;
      } catch (err) {
        // A session that no longer exists (deleted here or in another tab) must
        // not be remembered, or every reload would retry it forever.
        if (err instanceof FetchJsonError && err.status === 404) {
          storeSessionId(null);
          syncSessionUrl(null);
        } else {
          console.error("selectThread failed:", err);
        }
        return false;
      }
    },
    [syncSessionUrl]
  );

  const selectThread = useCallback(
    async (id: string) => {
      if (id === activeThreadId) {
        await selectThreadRaw(id);
        return;
      }
      runWithLeaveGuard(() => {
        void selectThreadRaw(id);
      });
    },
    [activeThreadId, runWithLeaveGuard, selectThreadRaw]
  );

  const clearActiveThread = useCallback(() => {
    runWithLeaveGuard(() => {
      setActiveThreadId(null);
      setMessages([]);
      setSessionMode("idle");
      // Going Home means "do not bring me back here on refresh".
      storeSessionId(null);
      syncSessionUrl(null);
    });
  }, [runWithLeaveGuard, syncSessionUrl]);

  const createThread = useCallback(async () => {
    const go = async () => {
      const ok = consentOk === true ? true : await refreshConsent();
      if (!ok) {
        setConsentOk(false);
        return;
      }
      try {
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", title: "New session" }),
        });
        const data = (await res.json()) as {
          thread?: Thread;
          code?: string;
          entitlement?: EntitlementPublic;
        };
        if (!res.ok) {
          if (data.code === "needs_consent") {
            setConsentOk(false);
            return;
          }
          if (data.entitlement) setEntitlement(data.entitlement);
          if (
            data.code === "trial_limit_reached" ||
            data.code === "needs_payment"
          ) {
            openUpgradeModal(
              data.code === "trial_limit_reached"
                ? "trial_limit_reached"
                : "generic"
            );
          }
          return;
        }
        if (data.thread?.id) {
          await selectThreadRaw(data.thread.id);
          await refreshThreads(data.thread.id);
        } else {
          await refreshThreads();
        }
      } catch (err) {
        console.error("createThread failed:", err);
      }
    };
    runWithLeaveGuard(() => {
      void go();
    });
  }, [
    consentOk,
    refreshConsent,
    refreshThreads,
    openUpgradeModal,
    runWithLeaveGuard,
    selectThreadRaw,
  ]);

  const updateThreadLocal = useCallback(
    async (id: string, patch: Partial<Thread>) => {
      try {
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", id, patch }),
        });
        const data = (await res.json()) as {
          thread?: Thread;
          code?: string;
          entitlement?: EntitlementPublic;
        };
        if (!res.ok) {
          if (data.entitlement) setEntitlement(data.entitlement);
          if (data.code === "trial_limit_reached") {
            openUpgradeModal("trial_limit_reached");
          }
          return;
        }
        if (data.entitlement) setEntitlement(data.entitlement);
        if (data.thread) {
          setThreads((t) => t.map((x) => (x.id === id ? data.thread! : x)));
          if (activeThreadId === id) await selectThreadRaw(id);
        }
      } catch (err) {
        console.error("updateThreadLocal failed:", err);
      }
    },
    [activeThreadId, selectThreadRaw, openUpgradeModal]
  );

  const chooseSessionMode = useCallback(
    async (kind: Exclude<SessionKind, "pending">) => {
      if (!activeThreadId) return false;
      try {
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: activeThreadId,
            patch: {
              mode: kind,
              title: kind === "free" ? SESSION_MODE_SELF_LABEL : SESSION_MODE_GUIDED_LABEL,
            },
          }),
        });
        const data = (await res.json()) as {
          thread?: Thread;
          code?: string;
          entitlement?: EntitlementPublic;
        };
        if (!res.ok) {
          if (data.code === "needs_consent") {
            setConsentOk(false);
            return false;
          }
          if (data.entitlement) setEntitlement(data.entitlement);
          if (
            data.code === "trial_limit_reached" ||
            data.code === "bls_limit_reached"
          ) {
            openUpgradeModal(
              data.code === "bls_limit_reached"
                ? "bls_limit_reached"
                : "trial_limit_reached"
            );
          }
          return false;
        }
        if (data.entitlement) setEntitlement(data.entitlement);
        if (data.thread) {
          setThreads((t) =>
            t.map((x) => (x.id === activeThreadId ? data.thread! : x))
          );
          await selectThreadRaw(activeThreadId);
        }
        return true;
      } catch (err) {
        console.error("chooseSessionMode failed:", err);
        return false;
      }
    },
    [activeThreadId, selectThreadRaw, openUpgradeModal]
  );

  const leaseBlsSeconds = useCallback(
    async (seconds: number) => {
      try {
        const res = await fetch("/api/billing/bls-lease", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seconds }),
        });
        const data = (await res.json()) as {
          granted?: number;
          code?: string;
          entitlement?: EntitlementPublic;
        };
        if (data.entitlement) setEntitlement(data.entitlement);
        if (!res.ok) {
          if (data.code === "bls_limit_reached") {
            openUpgradeModal("bls_limit_reached");
          }
          return 0;
        }
        return data.granted ?? 0;
      } catch (err) {
        console.error("leaseBlsSeconds failed:", err);
        return 0;
      }
    },
    [openUpgradeModal]
  );

  const deleteThread = useCallback(
    async (id: string) => {
      await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const nextActive = activeThreadId === id ? null : activeThreadId;
      if (activeThreadId === id) {
        setActiveThreadId(null);
        setMessages([]);
        storeSessionId(null);
        syncSessionUrl(null);
      }
      await refreshThreads(nextActive);
    },
    [activeThreadId, refreshThreads, syncSessionUrl]
  );

  const sendUserMessage = useCallback(async (text: string) => {
    if (!activeThreadId) {
      return { startSet: false as const };
    }
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      threadId: activeThreadId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    // Writing indicator for the whole round trip. `finally` matters: a failed
    // request must not leave the dots moving forever.
    setAgentTyping(true);
    try {
      const data = await fetchJson<{
        message?: Message;
        thread?: Thread;
        interpretation?: {
          startSet?: boolean;
          riskFlag?: boolean;
          outOfWindow?: boolean;
          distress?: "ok" | "elevated" | "overwhelm";
        } | null;
      }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeThreadId, userMessage: text }),
      });
      if (data.thread) {
        setThreads((list) =>
          list.map((t) => (t.id === data.thread!.id ? data.thread! : t))
        );
      }
      if (data.message) {
        const assistantMsg = data.message;
        setMessages((m) => {
          const withoutTmp = m.filter((x) => x.id !== optimistic.id);
          const hasUser = withoutTmp.some(
            (x) => x.role === "user" && x.content === text
          );
          return hasUser
            ? [...withoutTmp, assistantMsg]
            : [...withoutTmp, optimistic, assistantMsg];
        });
      }
      return {
        startSet: Boolean(data.interpretation?.startSet),
        riskFlag: data.interpretation?.riskFlag,
        outOfWindow: data.interpretation?.outOfWindow,
        distress: data.interpretation?.distress,
        agentText: data.message?.content,
        agentId: data.message?.id,
        phase: data.thread?.phase,
      };
    } finally {
      setAgentTyping(false);
    }
  }, [activeThreadId]);

  const requestCheckIn = useCallback(
    async (outcome: "completed" | "stopped" = "completed") => {
      if (!activeThreadId) return;
      setAgentTyping(true);
      try {
        const data = await fetchJson<{ message?: Message; thread?: Thread }>(
          "/api/chat",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId: activeThreadId,
              afterSet: true,
              setOutcome: outcome,
            }),
          }
        );
        if (data.message) {
          setMessages((m) => [...m, data.message!]);
        }
        if (data.thread) {
          setThreads((list) =>
            list.map((t) => (t.id === data.thread!.id ? data.thread! : t))
          );
        }
      } finally {
        setAgentTyping(false);
      }
    },
    [activeThreadId]
  );

  const bootstrapAgent = useCallback(async () => {
    if (!activeThreadId) return;
    // The opening line is instant, but this avoids a blank stage if the guide
    // is slow to answer on a cold thread.
    setAgentTyping(true);
    try {
      const data = await fetchJson<{ message?: Message }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeThreadId, bootstrap: true }),
      });
      if (data.message) setMessages([data.message]);
    } finally {
      setAgentTyping(false);
    }
  }, [activeThreadId]);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await fetchJson<{
        settings?: AppSettings;
        memories?: Memory[];
        memoryEnabled?: boolean;
        voiceEnabled?: boolean;
        guidedChatChromeId?: number;
        freeSessionChromeId?: number;
      }>("/api/settings");
      setSettings(data.settings ?? DEFAULT_SETTINGS);
      setMemories(data.memories ?? []);
      setMemoryEnabled(data.memoryEnabled !== false);
      setVoiceEnabled(data.voiceEnabled !== false);
      if (data.guidedChatChromeId != null) {
        setGuidedChatChromeId(data.guidedChatChromeId);
      }
      if (data.freeSessionChromeId != null) {
        setFreeSessionChromeId(data.freeSessionChromeId);
      }
    } catch (err) {
      console.error("refreshSettings failed:", err);
    }
  }, []);

  const saveSettings = useCallback(async (s: AppSettings) => {
    const data = await fetchJson<{ settings: AppSettings }>("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", settings: s }),
    });
    setSettings(data.settings);
  }, []);

  const refreshMemories = refreshSettings;

  const setBls = useCallback(
    (
      patch:
        | Partial<BlsSettings>
        | ((prev: BlsSettings) => Partial<BlsSettings>)
    ) => {
      setBlsState((b) => {
        const next: BlsSettings = {
          ...b,
          ...(typeof patch === "function" ? patch(b) : patch),
        };
        const userId = blsUserIdRef.current;
        if (isDefaultBlsSettings(next)) {
          clearBlsPrefs(userId);
        } else {
          saveBlsPrefs(userId, next);
        }
        return next;
      });
    },
    []
  );

  useEffect(() => {
    void refreshSettings();
    void refreshEntitlement();
    void refreshConsent();
    // Threads load in the restore effect below, which knows whether a session
    // must be kept alive instead of being pruned as an empty tab.
  }, [refreshSettings, refreshEntitlement, refreshConsent]);

  useEffect(() => {
    // Hydrate BLS Adjustments before auth resolves (anon key).
    setBlsState(loadBlsPrefs(null));
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as { user?: { id?: string } };
        const id =
          typeof data.user?.id === "string" && data.user.id
            ? data.user.id
            : null;
        setAdUserId(id);
        setAdFreq(loadAdFreqState(id));
        blsUserIdRef.current = id;
        setBlsState(loadBlsPrefs(id));
      } catch {
        setAdUserId(null);
        blsUserIdRef.current = null;
      }
    })();
  }, []);

  /**
   * Restore the session that was open before a reload. Runs once: a hard
   * refresh, a duplicate tab, or a `?thread=<id>` link must land back in the
   * session, not on Home.
   *
   * A bare `/app` visit still shows Home when no session was open (Home nav and
   * delete clear the stored id), so this cannot turn into "open the newest".
   */
  const restoreStartedRef = useRef(false);
  useEffect(() => {
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    void (async () => {
      const id = resolveSessionThreadId({ search: window.location.search });
      if (id) {
        const restored = await selectThreadRaw(id);
        if (restored) {
          // Keep the tab list in sync without pruning the session we just
          // restored (a pending picker counts as empty to `pruneEmptyThreads`).
          await refreshThreads(id);
          setRestoringSession(false);
          return;
        }
      }
      // Nothing to restore (or it was deleted while we were away).
      await refreshThreads();
      setRestoringSession(false);
    })();
    // One-shot on mount: `selectThreadRaw`/`refreshThreads` change identity with
    // the active thread, and re-running would fight the user's navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once a thread is open (however it was opened), it becomes the session to
  // restore on the next load.
  useEffect(() => {
    if (activeThreadId) setRestoringSession(false);
  }, [activeThreadId]);

  // Switching sessions must not carry the previous thread's writing indicator.
  useEffect(() => {
    setAgentTyping(false);
  }, [activeThreadId]);

  useEffect(() => {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (
      activeThreadId &&
      thread &&
      shouldBootstrapAgent(thread.mode, messages.length)
    ) {
      void bootstrapAgent();
    }
  }, [activeThreadId, messages.length, threads, bootstrapAgent]);

  // Actions the product tour can call: open a session, pick a mode, or start
  // a fresh chat once the tour closes. Re-picking the mode the session already
  // has is a no-op, so the tour does not re-write the thread on every step.
  useGuideHost({
    ensurePendingThread: async () => {
      clearActiveThread();
      await createThread();
      return true;
    },
    chooseSelfGuided: () => {
      const current = threads.find((t) => t.id === activeThreadId);
      if (current?.mode === "free") return true;
      return chooseSessionMode("free");
    },
    chooseGuided: () => {
      const current = threads.find((t) => t.id === activeThreadId);
      if (current?.mode === "guided") return true;
      return chooseSessionMode("guided");
    },
    startNewChat: () => {
      void createThread();
    },
    canRunSession: () =>
      consentOk === true &&
      entitlement != null &&
      entitlement.canUseApp &&
      !(
        entitlement.isTrialLimited &&
        (entitlement.guidedRemaining <= 0 ||
          entitlement.blsSecondsRemaining <= 0)
      ),
  });

  const value = useMemo(
    () => ({
      threads,
      activeThreadId,
      messages,
      agentTyping,
      restoringSession,
      memoryEnabled,
      settings,
      bls,
      sessionMode,
      entitlement,
      setSessionMode,
      setBls,
      refreshThreads,
      refreshEntitlement,
      selectThread,
      clearActiveThread,
      createThread,
      updateThreadLocal,
      chooseSessionMode,
      deleteThread,
      sendUserMessage,
      requestCheckIn,
      bootstrapAgent,
      refreshSettings,
      saveSettings,
      memories,
      refreshMemories,
      openUpgradeModal,
      leaseBlsSeconds,
      maybeShowAd,
      noteAdSetCompleted,
      adsConfig,
      adsReady,
      voiceEnabled,
      guidedChatChromeId,
      freeSessionChromeId,
      consentOk,
      refreshConsent,
      registerLeaveGuard,
    }),
    [
      threads,
      activeThreadId,
      messages,
      agentTyping,
      restoringSession,
      memoryEnabled,
      voiceEnabled,
      guidedChatChromeId,
      freeSessionChromeId,
      settings,
      bls,
      sessionMode,
      entitlement,
      setBls,
      refreshThreads,
      refreshEntitlement,
      selectThread,
      clearActiveThread,
      createThread,
      updateThreadLocal,
      chooseSessionMode,
      deleteThread,
      sendUserMessage,
      requestCheckIn,
      bootstrapAgent,
      refreshSettings,
      saveSettings,
      memories,
      refreshMemories,
      openUpgradeModal,
      leaseBlsSeconds,
      maybeShowAd,
      noteAdSetCompleted,
      adsConfig,
      adsReady,
      consentOk,
      refreshConsent,
      registerLeaveGuard,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {adsConfig.adsActive && adsConfig.provider === "adsense" ? (
        <AdSenseLoader clientId={adsConfig.adsenseClient} />
      ) : null}
      <UpgradeModal
        open={upgrade.open}
        reason={upgrade.reason}
        guidedUsed={entitlement?.guidedUsed}
        guidedLimit={entitlement?.guidedLimit}
        blsSecondsUsed={entitlement?.blsSecondsUsed}
        blsSecondsLimit={entitlement?.blsSecondsLimit}
        onClose={() => setUpgrade((u) => ({ ...u, open: false }))}
      />
      <AdInterstitial
        open={adOpen}
        config={adsConfig.adsActive ? adsConfig : null}
        onContinue={() => finishAd("continued")}
        onUpgrade={() => {
          finishAd("upgraded");
          openUpgradeModal("generic");
        }}
      />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
