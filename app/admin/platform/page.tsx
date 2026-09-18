"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import {
  AdminSettingToggle,
  AdminSettingToggleStack,
} from "@/app/components/admin/AdminSettingToggle";
import { GuidedChatChromePicker } from "@/app/components/admin/GuidedChatChromePicker";
import { FreeSessionChromePicker } from "@/app/components/admin/FreeSessionChromePicker";
import type { PlatformSettings } from "@/lib/platform-settings";
import { DEFAULT_GUIDED_CHAT_CHROME_ID } from "@/lib/guided-chat-chrome";
import { DEFAULT_FREE_SESSION_CHROME_ID } from "@/lib/free-session-chrome";
import { fetchJson } from "@/lib/fetch-json";
import {
  fileToAppLogoDataUrl,
  fileToFaviconDataUrl,
} from "@/lib/avatar-client";

const TABS = [
  "brand",
  "guided-chat",
  "free-session",
  "access",
  "features",
  "ads",
  "agent",
] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { id: "brand", label: "Brand" },
  { id: "guided-chat", label: "Guided chat" },
  { id: "free-session", label: "Self-guided" },
  { id: "access", label: "Access" },
  { id: "features", label: "Features" },
  { id: "ads", label: "Ads" },
  { id: "agent", label: "Agent" },
] as const;

function BrandAssetField({
  label,
  hint,
  value,
  previewUrl,
  previewClassName,
  busy,
  onChange,
  onClear,
  onBusy,
  onError,
  encodeFile,
}: {
  label: string;
  hint: string;
  value: string;
  previewUrl: string;
  previewClassName: string;
  busy: boolean;
  onChange: (next: string) => void;
  onClear: () => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  encodeFile: (file: File) => Promise<string>;
}) {
  return (
    <div className="admin-seo-og-field">
      <p className="admin-field-label" style={{ marginBottom: 0 }}>
        {label}
      </p>
      <p className="admin-panel-sub">{hint}</p>
      <div className="admin-seo-og-row">
        <div className={previewClassName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" />
        </div>
        <div className="admin-seo-og-actions">
          <label className="admin-btn-edit admin-seo-upload-label">
            {busy ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (!file) return;
                void (async () => {
                  onBusy(true);
                  onError("");
                  try {
                    onChange(await encodeFile(file));
                  } catch (err) {
                    onError(
                      err instanceof Error ? err.message : "Image upload failed"
                    );
                  } finally {
                    onBusy(false);
                  }
                })();
              }}
            />
          </label>
          <button
            type="button"
            className="admin-btn-edit"
            disabled={busy || !value}
            onClick={onClear}
          >
            Use default
          </button>
        </div>
      </div>
      <label className="admin-field-label">
        Or paste URL
        <input
          className="field"
          value={value.startsWith("data:image/") ? "" : value}
          placeholder={
            value.startsWith("data:image/")
              ? "Uploaded image (saved on Save)"
              : "https://… or /brand/…"
          }
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

function AdminPlatformPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "brand");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchJson<{ settings: PlatformSettings }>(
      "/api/admin/platform"
    );
    setSettings(res.settings);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setMsg("");
    try {
      await fetchJson("/api/admin/platform", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setMsg("Platform settings saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Platform"
        subtitle="Brand, guided chat look, invites, maintenance, feature flags, ads, and agent protocol notes."
      />
      <main className="admin-main">
        <AdminTabs
          tabs={TAB_ITEMS}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        <form className="admin-form-stack admin-panel" onSubmit={(e) => void save(e)}>
          {tab === "brand" && (
            <>
              <h2 className="admin-panel-title">Brand</h2>
              <label className="admin-field-label">
                Site name
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) =>
                    setSettings({ ...settings, siteName: e.target.value })
                  }
                  className="field"
                />
              </label>
              <p className="admin-panel-sub">
                Spoken name shown in the app (Nura). Operator is Receptly LLC.
              </p>

              <BrandAssetField
                label="Favicon"
                hint="Browser tab icon for the whole site. Square PNG works best."
                value={settings.faviconUrl}
                previewUrl={
                  settings.faviconUrl.trim() || "/brand-assets/favicon"
                }
                previewClassName="admin-brand-favicon-preview"
                busy={busy || assetBusy}
                encodeFile={fileToFaviconDataUrl}
                onChange={(next) =>
                  setSettings({ ...settings, faviconUrl: next })
                }
                onClear={() => setSettings({ ...settings, faviconUrl: "" })}
                onBusy={setAssetBusy}
                onError={setMsg}
              />

              <BrandAssetField
                label="App logo"
                hint="Wordmark in the /app sidebar (and admin). Prefer a light/white logo on transparent PNG."
                value={settings.appLogoUrl}
                previewUrl={
                  settings.appLogoUrl.trim() || "/brand-assets/app-logo"
                }
                previewClassName="admin-brand-logo-preview"
                busy={busy || assetBusy}
                encodeFile={fileToAppLogoDataUrl}
                onChange={(next) =>
                  setSettings({ ...settings, appLogoUrl: next })
                }
                onClear={() => setSettings({ ...settings, appLogoUrl: "" })}
                onBusy={setAssetBusy}
                onError={setMsg}
              />

              <label className="admin-field-label">
                Support email
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, supportEmail: e.target.value })
                  }
                  className="field"
                />
              </label>
              <label className="admin-field-label">
                Public app URL
                <input
                  type="url"
                  value={settings.publicAppUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, publicAppUrl: e.target.value })
                  }
                  className="field"
                  placeholder="https://dev.nurahelp.com"
                />
              </label>
              <p className="admin-panel-sub">
                Used in email links when set. Falls back to APP_URL env.
              </p>
            </>
          )}

          {tab === "guided-chat" && (
            <>
              <h2 className="admin-panel-title">Guided chat look</h2>
              <p className="admin-panel-sub">
                Select a look with the radio or title. Click the mockup to view
                it larger. Save platform settings to apply.
              </p>
              <GuidedChatChromePicker
                value={
                  settings.guidedChatChromeId ?? DEFAULT_GUIDED_CHAT_CHROME_ID
                }
                onChange={(id) =>
                  setSettings({ ...settings, guidedChatChromeId: id })
                }
                disabled={busy || assetBusy}
              />
            </>
          )}

          {tab === "free-session" && (
            <>
              <h2 className="admin-panel-title">Self-guided look</h2>
              <p className="admin-panel-sub">
                Select a look with the radio or title. Click the mockup to view
                it larger. Save platform settings to apply.
              </p>
              <FreeSessionChromePicker
                value={
                  settings.freeSessionChromeId ?? DEFAULT_FREE_SESSION_CHROME_ID
                }
                onChange={(id) =>
                  setSettings({ ...settings, freeSessionChromeId: id })
                }
                disabled={busy || assetBusy}
              />
            </>
          )}

          {tab === "access" && (
            <>
              <h2 className="admin-panel-title">Access</h2>
              <AdminSettingToggleStack>
                <AdminSettingToggle
                  id="platform-invites"
                  title="Invites"
                  status={
                    settings.invitesEnabled
                      ? "On — admins can send invite links"
                      : "Off — invite API rejects new invites"
                  }
                  checked={settings.invitesEnabled}
                  tone={settings.invitesEnabled ? "ok" : "neutral"}
                  onChange={(invitesEnabled) =>
                    setSettings({ ...settings, invitesEnabled })
                  }
                />
              </AdminSettingToggleStack>
              <label className="admin-field-label">
                Maintenance message
                <textarea
                  value={settings.maintenanceMessage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maintenanceMessage: e.target.value,
                    })
                  }
                  className="field admin-textarea"
                  placeholder="Leave empty to disable maintenance mode"
                  rows={3}
                />
              </label>
            </>
          )}

          {tab === "features" && (
            <>
              <h2 className="admin-panel-title">Feature flags</h2>
              <AdminSettingToggleStack>
                <AdminSettingToggle
                  id="platform-voice"
                  title="Voice"
                  status={
                    settings.flags.voice
                      ? "On — agent can speak lines aloud"
                      : "Off — text only in sessions"
                  }
                  checked={settings.flags.voice}
                  tone={settings.flags.voice ? "ok" : "neutral"}
                  onChange={(voice) =>
                    setSettings({
                      ...settings,
                      flags: { ...settings.flags, voice },
                    })
                  }
                />
                <AdminSettingToggle
                  id="platform-memory"
                  title="Memory"
                  status={
                    settings.flags.memory
                      ? "On — Memory tab available"
                      : "Off — Memory tab hidden; guided chat gets no notes"
                  }
                  checked={settings.flags.memory}
                  tone={settings.flags.memory ? "ok" : "neutral"}
                  onChange={(memory) =>
                    setSettings({
                      ...settings,
                      flags: { ...settings.flags, memory },
                    })
                  }
                />
                <AdminSettingToggle
                  id="platform-rumble"
                  title="Controller rumble"
                  status={
                    settings.flags.blsVibration
                      ? "On — gamepad vibrates on ball edges"
                      : "Off — no rumble"
                  }
                  checked={settings.flags.blsVibration}
                  tone={settings.flags.blsVibration ? "ok" : "neutral"}
                  onChange={(blsVibration) =>
                    setSettings({
                      ...settings,
                      flags: { ...settings.flags, blsVibration },
                    })
                  }
                />
                <AdminSettingToggle
                  id="platform-interpreter"
                  title="Session interpreter"
                  status={
                    settings.flags.sessionInterpreter !== false
                      ? "On — model returns phase / scale updates"
                      : "Off — guide runs without structured JSON"
                  }
                  checked={settings.flags.sessionInterpreter !== false}
                  tone={
                    settings.flags.sessionInterpreter !== false
                      ? "ok"
                      : "neutral"
                  }
                  onChange={(sessionInterpreter) =>
                    setSettings({
                      ...settings,
                      flags: { ...settings.flags, sessionInterpreter },
                    })
                  }
                />
              </AdminSettingToggleStack>
            </>
          )}

          {tab === "ads" && (
            <>
              <h2 className="admin-panel-title">Ads (free / trial)</h2>
              <p className="admin-panel-sub">
                Interstitial before a Self-guided set, plus in-page display on
                Resources for trial users. Paying users never see ads. Frequency
                applies to the Free-session interstitial only.
              </p>
              <AdminSettingToggleStack>
                <AdminSettingToggle
                  id="platform-ads"
                  title="Enable ads"
                  status={
                    settings.ads?.enabled === true
                      ? "On — trial users may see Free-session and Resources ads"
                      : "Off — no ads for anyone"
                  }
                  checked={settings.ads?.enabled === true}
                  tone={
                    settings.ads?.enabled === true ? "caution" : "neutral"
                  }
                  onChange={(enabled) =>
                    setSettings({
                      ...settings,
                      ads: { ...settings.ads, enabled },
                    })
                  }
                />
              </AdminSettingToggleStack>
              <label className="admin-field-label">
                Provider
                <select
                  className="field"
                  value={settings.ads?.provider ?? "placeholder"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ads: {
                        ...settings.ads,
                        provider: e.target.value as
                          | "placeholder"
                          | "adsense"
                          | "gam",
                      },
                    })
                  }
                >
                  <option value="placeholder">Placeholder (dev)</option>
                  <option value="adsense">Google AdSense</option>
                  <option value="gam">Google Ad Manager (video — soon)</option>
                </select>
              </label>
              {(settings.ads?.provider ?? "placeholder") === "adsense" && (
                <>
                  <label className="admin-field-label">
                    AdSense client ID
                    <input
                      type="text"
                      className="field"
                      value={settings.ads?.adsenseClient ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          ads: {
                            ...settings.ads,
                            adsenseClient: e.target.value,
                          },
                        })
                      }
                      placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                    />
                  </label>
                  <label className="admin-field-label">
                    Interstitial ad slot
                    <input
                      type="text"
                      className="field"
                      value={settings.ads?.adsenseSlot ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          ads: {
                            ...settings.ads,
                            adsenseSlot: e.target.value,
                          },
                        })
                      }
                      placeholder="1234567890"
                    />
                  </label>
                  <label className="admin-field-label">
                    Resources display ad slot
                    <input
                      type="text"
                      className="field"
                      value={settings.ads?.adsenseDisplaySlot ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          ads: {
                            ...settings.ads,
                            adsenseDisplaySlot: e.target.value,
                          },
                        })
                      }
                      placeholder="1234567890"
                    />
                  </label>
                  <p className="admin-panel-sub">
                    Required for Resources in-page ads. Create a separate display
                    unit in AdSense — do not reuse the interstitial slot.
                  </p>
                </>
              )}
              <label className="admin-field-label">
                Frequency
                <select
                  className="field"
                  value={settings.ads?.frequencyMode ?? "per_session"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ads: {
                        ...settings.ads,
                        frequencyMode: e.target.value as
                          | "per_session"
                          | "every_minutes"
                          | "every_n_sets"
                          | "per_set",
                      },
                    })
                  }
                >
                  <option value="per_session">Once per browser session</option>
                  <option value="every_minutes">Every N minutes</option>
                  <option value="every_n_sets">
                    After every N completed sets (first N starts are ad-free)
                  </option>
                  <option value="per_set">Every set</option>
                </select>
              </label>
              {(settings.ads?.frequencyMode ?? "per_session") ===
                "every_n_sets" && (
                <p className="admin-panel-sub">
                  Counts completed Self-guided sets. Example N=3: sets 1–3 free, ad
                  before set 4, then again after 3 more, and so on.
                </p>
              )}
              {(settings.ads?.frequencyMode ?? "per_session") ===
                "every_minutes" && (
                <label className="admin-field-label">
                  Every N minutes
                  <input
                    type="number"
                    className="field"
                    min={1}
                    max={120}
                    value={settings.ads?.everyMinutes ?? 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ads: {
                          ...settings.ads,
                          everyMinutes: Number(e.target.value) || 5,
                        },
                      })
                    }
                  />
                </label>
              )}
              {(settings.ads?.frequencyMode ?? "per_session") ===
                "every_n_sets" && (
                <label className="admin-field-label">
                  Every N sets
                  <input
                    type="number"
                    className="field"
                    min={1}
                    max={50}
                    value={settings.ads?.everyNSets ?? 3}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ads: {
                          ...settings.ads,
                          everyNSets: Number(e.target.value) || 3,
                        },
                      })
                    }
                  />
                </label>
              )}
              <label className="admin-field-label">
                Minimum watch seconds before Continue
                <input
                  type="number"
                  className="field"
                  min={0}
                  max={60}
                  value={settings.ads?.minWatchSeconds ?? 5}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ads: {
                        ...settings.ads,
                        minWatchSeconds: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
            </>
          )}

          {tab === "agent" && (
            <>
              <h2 className="admin-panel-title">Agent protocol notes</h2>
              <p className="admin-panel-sub">
                Extra instructions appended to the EMDR guide system prompt
                (max 4000 chars). Base knowledge lives in code (
                <code>lib/protocol-knowledge.ts</code>).
              </p>
              <label className="admin-field-label">
                Knowledge notes
                <textarea
                  value={settings.agentKnowledgeNotes ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      agentKnowledgeNotes: e.target.value.slice(0, 4000),
                    })
                  }
                  className="field admin-textarea"
                  rows={8}
                  placeholder="e.g. Prefer Serbian greetings only on first message… Prefer shorter sets for new users…"
                />
              </label>
              <p className="admin-panel-sub">
                {(settings.agentKnowledgeNotes ?? "").length}/4000
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={busy || assetBusy}
            className="btn-primary w-fit"
          >
            {busy ? "Saving…" : "Save platform settings"}
          </button>
          {msg && <p className="admin-invite-msg">{msg}</p>}
        </form>
      </main>
    </div>
  );
}

export default function AdminPlatformPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading…</p>
        </div>
      }
    >
      <AdminPlatformPageInner />
    </Suspense>
  );
}
