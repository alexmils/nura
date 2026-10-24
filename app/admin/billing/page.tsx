"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminReactivationPanel } from "@/app/components/admin/AdminReactivationPanel";
import { AdminProblemReportsPanel } from "@/app/components/admin/AdminProblemReportsPanel";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { AdminSettingToggle } from "@/app/components/admin/AdminSettingToggle";
import { formatDateTime, formatMoney } from "@/lib/admin-format";
import { formatTokenCount, formatUsdMicros } from "@/lib/admin-llm-format";
import type { AdminBillingRow } from "@/lib/stripe-admin";
import type {
  StripeAdminView,
  StripeConfigPatch,
  StripeEnvAdminView,
} from "@/lib/stripe-admin-settings";
import type { StripeCredentialSet } from "@/lib/platform-settings";
import type { UserUsageRow } from "@/lib/usage";
import type { LlmUsageTotals } from "@/lib/llm-usage";
import type { RetentionOfferStats } from "@/lib/subscription-retention-shared";
import { fetchJson } from "@/lib/fetch-json";
import { DEFAULT_STRIPE_CREDENTIALS } from "@/lib/stripe-config";
function emptyEnvView(): StripeEnvAdminView {
  return {
    ...DEFAULT_STRIPE_CREDENTIALS,
    hasSecretKey: false,
    hasWebhookSecret: false,
  };
}
const EMPTY_STRIPE: StripeAdminView = {
  demoMode: true,
  activeEnv: "sandbox",
  sandbox: emptyEnvView(),
  live: emptyEnvView(),
};
type EnvKey = "sandbox" | "live";
const TABS = ["overview", "stripe", "subscriptions", "winback", "problems", "usage"] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "stripe", label: "Stripe" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "winback", label: "Win-back" },
  { id: "problems", label: "Problem reports" },
  { id: "usage", label: "Usage" },
] as const;
function AdminBillingPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "overview");
  const [rows, setRows] = useState<AdminBillingRow[]>([]);
  const [usage, setUsage] = useState<UserUsageRow[]>([]);
  const [llmMonth, setLlmMonth] = useState<LlmUsageTotals | null>(null);
  const [llmWeek, setLlmWeek] = useState<LlmUsageTotals | null>(null);
  const [llmAll, setLlmAll] = useState<LlmUsageTotals | null>(null);
  const [voiceMonth, setVoiceMonth] = useState<LlmUsageTotals | null>(null);
  const [voiceWeek, setVoiceWeek] = useState<LlmUsageTotals | null>(null);
  const [voiceAll, setVoiceAll] = useState<LlmUsageTotals | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [webhookReady, setWebhookReady] = useState(false);
  const [stripe, setStripe] = useState<StripeAdminView>(EMPTY_STRIPE);
  const [canEdit, setCanEdit] = useState(false);
  const [retentionStats, setRetentionStats] = useState<RetentionOfferStats>({
    offered: 0,
    accepted: 0,
    declined: 0,
    acceptanceRate: null,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [usageBusy, setUsageBusy] = useState(false);
  const [usageMsg, setUsageMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [editorEnv, setEditorEnv] = useState<EnvKey>("sandbox");
  const applyStripeResponse = (res: {
    stripe?: StripeAdminView;
    stripeConfigured?: boolean;
    catalogReady?: boolean;
    webhookReady?: boolean;
    demoMode?: boolean;
    activeEnv?: EnvKey;
  }) => {
    if (res.stripe) {
      setStripe(res.stripe);
      setEditorEnv(res.stripe.activeEnv);
    }
    if (typeof res.stripeConfigured === "boolean") {
      setStripeConfigured(res.stripeConfigured);
    }
    if (typeof res.catalogReady === "boolean") setCatalogReady(res.catalogReady);
    if (typeof res.webhookReady === "boolean") setWebhookReady(res.webhookReady);
  };
  const load = useCallback(async () => {
    const [billingRes, usageRes] = await Promise.all([
      fetchJson<{
        rows: AdminBillingRow[];
        stripeConfigured: boolean;
        catalogReady?: boolean;
        webhookReady?: boolean;
        stripe?: StripeAdminView;
        canEdit?: boolean;
        retentionStats?: RetentionOfferStats;
      }>("/api/admin/billing"),
      fetchJson<{
        usage: UserUsageRow[];
        llm?: {
          allTime: LlmUsageTotals;
          thisMonth: LlmUsageTotals;
          thisWeek?: LlmUsageTotals;
        };
        voice?: {
          allTime: LlmUsageTotals;
          thisMonth: LlmUsageTotals;
          thisWeek?: LlmUsageTotals;
        };
      }>("/api/admin/usage"),
    ]);
    setRows(billingRes.rows ?? []);
    setCanEdit(billingRes.canEdit ?? false);
    if (billingRes.retentionStats) {
      setRetentionStats(billingRes.retentionStats);
    }
    setUsage(usageRes.usage ?? []);
    setLlmAll(usageRes.llm?.allTime ?? null);
    setLlmMonth(usageRes.llm?.thisMonth ?? null);
    setLlmWeek(usageRes.llm?.thisWeek ?? null);
    setVoiceAll(usageRes.voice?.allTime ?? null);
    setVoiceMonth(usageRes.voice?.thisMonth ?? null);
    setVoiceWeek(usageRes.voice?.thisWeek ?? null);
    applyStripeResponse(billingRes);
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
  const countedUsage = usage.filter((u) => !u.statsExcluded);
  const ignoredUsage = usage.filter((u) => u.statsExcluded);
  const setStatsExcluded = async (userId: string, statsExcluded: boolean) => {
    setUsageBusy(true);
    setUsageMsg("");
    try {
      await fetchJson(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statsExcluded }),
      });
      await load();
    } catch (err) {
      setUsageMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUsageBusy(false);
    }
  };
  const active = stripe[editorEnv];
  const patchEnv = (partial: Partial<StripeCredentialSet>) =>
    setStripe((s) => ({
      ...s,
      [editorEnv]: { ...s[editorEnv], ...partial },
    }));
  const saveStripe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const buildEnvPatch = (env: EnvKey): Partial<StripeCredentialSet> => {
        const src = stripe[env];
        const patch: Partial<StripeCredentialSet> = {
          publishableKey: src.publishableKey,
          priceIdWeekly: src.priceIdWeekly,
          priceIdMonthly: src.priceIdMonthly,
          priceIdYearly: src.priceIdYearly,
          displayPriceWeekly: src.displayPriceWeekly,
          displayPriceMonthly: src.displayPriceMonthly,
          displayPriceYearly: src.displayPriceYearly,
        };
        // Only send secrets when the admin typed a new value; empty = keep stored.
        if (src.secretKey.trim()) patch.secretKey = src.secretKey.trim();
        if (src.webhookSecret.trim()) {
          patch.webhookSecret = src.webhookSecret.trim();
        }
        return patch;
      };
      const patch: StripeConfigPatch = {
        demoMode: stripe.demoMode,
        sandbox: buildEnvPatch("sandbox"),
        live: buildEnvPatch("live"),
      };
      const res = await fetchJson<{
        stripe: StripeAdminView;
        stripeConfigured: boolean;
        catalogReady?: boolean;
        webhookReady?: boolean;
      }>("/api/admin/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripe: patch }),
      });
      applyStripeResponse(res);
      setMsg(
        stripe.demoMode
          ? "Saved. Demo mode on — sandbox keys are used for Checkout."
          : "Saved. Live mode on — real Stripe charges are enabled."
      );
      window.dispatchEvent(new Event("emdr-stripe-mode"));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  const syncFromStripe = async () => {
    if (!canEdit) return;
    setSyncing(true);
    setMsg("");
    try {
      const res = await fetchJson<{
        stripe: StripeAdminView;
        stripeConfigured: boolean;
        catalogReady?: boolean;
        webhookReady?: boolean;
        summary?: string;
        env?: EnvKey;
      }>("/api/admin/billing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey: active.secretKey.trim() || undefined,
          env: editorEnv,
          save: true,
        }),
      });
      applyStripeResponse(res);
      const envLabel = res.env === "live" ? "live" : "sandbox";
      setMsg(
        res.summary
          ? `Synced into ${envLabel}: ${res.summary}`
          : `Synced plan prices into ${envLabel}.`
      );
      if (!res.webhookReady && editorEnv === stripe.activeEnv) {
        setMsg((m) =>
          `${m} Add the webhook signing secret to finish checkout.`
        );
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };
  const canSync =
    canEdit &&
    (Boolean(active.secretKey.trim()) || active.hasSecretKey);
  const totalMrr = rows.reduce(
    (sum, r) =>
      r.status === "active" && r.plan !== "free" ? sum + r.amountCents : sum,
    0
  );
  const stripeHint = stripeConfigured
    ? stripe.demoMode
      ? "Sandbox catalog + webhook ready"
      : "Live catalog + webhook ready"
    : catalogReady && !webhookReady
      ? "Prices synced — add webhook secret"
      : webhookReady && !catalogReady
        ? "Webhook set — add secret key + Price IDs (or Sync)"
        : "Configure Stripe below";
  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }
  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Billing"
        subtitle="Sandbox vs live Stripe keys, plan prices, subscriptions, and usage."
      />
      <main className="admin-main">
        <AdminTabs
          tabs={TAB_ITEMS}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />
        {tab === "overview" && (
          <>
            <section className="admin-stat-grid">
              <article className="admin-stat-card">
                <p className="admin-stat-label">MRR</p>
                <p className="admin-stat-value">{formatMoney(totalMrr)}</p>
              </article>
              <article className="admin-stat-card">
                <p className="admin-stat-label">Stripe</p>
                <p className="admin-stat-value">
                  {stripeConfigured
                    ? stripe.demoMode
                      ? "Demo"
                      : "Live"
                    : "Off"}
                </p>
                <p className="admin-stat-hint">{stripeHint}</p>
              </article>
              <article className="admin-stat-card">
                <p className="admin-stat-label">Retention 50% offered</p>
                <p className="admin-stat-value">{retentionStats.offered}</p>
                <p className="admin-stat-hint">Monthly, too expensive</p>
              </article>
              <article className="admin-stat-card">
                <p className="admin-stat-label">Retention accepted</p>
                <p className="admin-stat-value">{retentionStats.accepted}</p>
                <p className="admin-stat-hint">
                  {retentionStats.declined} declined
                  {retentionStats.acceptanceRate != null
                    ? ` · ${retentionStats.acceptanceRate}% take rate`
                    : ""}
                </p>
              </article>
            </section>
            {!stripeConfigured && (
              <section className="admin-panel">
                <p className="admin-panel-sub">
                  Checkout works when the <strong>active</strong> env (demo →
                  sandbox, unchecked → live) has a secret key, webhook secret, and at
                  least one Price ID. User page:{" "}
                  <Link href="/app/billing" className="admin-link">
                    /app/billing
                  </Link>
                  . Configure Stripe in the{" "}
                  <button
                    type="button"
                    className="admin-link border-0 bg-transparent p-0"
                    onClick={() => setTab("stripe")}
                  >
                    Stripe tab
                  </button>
                  .
                </p>
              </section>
            )}
          </>
        )}
        {tab === "stripe" && (
          <form
            className="admin-form-stack admin-panel"
            onSubmit={(e) => void saveStripe(e)}
          >
            <h2 className="admin-panel-title">Stripe configuration</h2>
            <p className="admin-panel-sub">
              Keep sandbox and live keys in separate tabs. Checkout always uses
              the mode below.
            </p>

            <AdminSettingToggle
              id="admin-stripe-demo-mode"
              title="Demo mode"
              status={
                stripe.demoMode
                  ? "On — sandbox keys, test charges only"
                  : "Off — live keys, real charges"
              }
              checked={stripe.demoMode}
              disabled={!canEdit}
              tone={stripe.demoMode ? "caution" : "danger"}
              onChange={(nextDemo) => {
                if (
                  !nextDemo &&
                  !window.confirm(
                    "Turn off Demo mode? Checkout will use live Stripe keys and real charges can occur."
                  )
                ) {
                  return;
                }
                setStripe((s) => ({
                  ...s,
                  demoMode: nextDemo,
                  activeEnv: nextDemo ? "sandbox" : "live",
                }));
              }}
            />

            <div
              className="admin-segmented"
              role="tablist"
              aria-label="Credential set to edit"
            >
              <button
                type="button"
                role="tab"
                aria-selected={editorEnv === "sandbox"}
                className={
                  editorEnv === "sandbox"
                    ? "admin-segmented-btn admin-segmented-btn-active"
                    : "admin-segmented-btn"
                }
                onClick={() => setEditorEnv("sandbox")}
              >
                Sandbox
                {stripe.demoMode ? " · checkout" : ""}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editorEnv === "live"}
                className={
                  editorEnv === "live"
                    ? "admin-segmented-btn admin-segmented-btn-active"
                    : "admin-segmented-btn"
                }
                onClick={() => setEditorEnv("live")}
              >
                Live
                {!stripe.demoMode ? " · checkout" : ""}
              </button>
            </div>
            <p className="admin-panel-sub admin-stripe-edit-hint">
              Editing <strong>{editorEnv}</strong> keys
              {editorEnv === stripe.activeEnv
                ? " — this set runs Checkout."
                : " — not used for Checkout until you switch mode."}
              {" "}
              Webhook:{" "}
              <code className="admin-code">/api/webhooks/stripe</code>
              {canEdit
                ? ". Leave secrets blank to keep the saved value."
                : ". View only — platform admin can edit."}
            </p>
            <label className="admin-field-label">
              Secret key
              <input
                type="password"
                autoComplete="off"
                value={active.secretKey}
                disabled={!canEdit}
                onChange={(e) => patchEnv({ secretKey: e.target.value })}
                className="field"
                placeholder={
                  active.hasSecretKey
                    ? "•••• saved — paste to replace"
                    : editorEnv === "live"
                      ? "sk_live_…"
                      : "sk_test_… or rk_test_…"
                }
              />
            </label>
            <label className="admin-field-label">
              Webhook signing secret
              <input
                type="password"
                autoComplete="off"
                value={active.webhookSecret}
                disabled={!canEdit}
                onChange={(e) => patchEnv({ webhookSecret: e.target.value })}
                className="field"
                placeholder={
                  active.hasWebhookSecret
                    ? "•••• saved — paste to replace"
                    : "whsec_…"
                }
              />
            </label>
            <label className="admin-field-label">
              Publishable key (optional)
              <input
                type="text"
                value={active.publishableKey}
                disabled={!canEdit}
                onChange={(e) => patchEnv({ publishableKey: e.target.value })}
                className="field"
                placeholder={
                  editorEnv === "live" ? "pk_live_…" : "pk_test_…"
                }
              />
            </label>
            <h3 className="admin-panel-title" style={{ marginTop: "1rem" }}>
              Plans ({editorEnv})
            </h3>
            <div className="admin-stat-grid">
              {(
                [
                  {
                    label: "Weekly",
                    priceId: active.priceIdWeekly,
                    display: active.displayPriceWeekly,
                    onPriceId: (v: string) => patchEnv({ priceIdWeekly: v }),
                    onDisplay: (v: string) =>
                      patchEnv({ displayPriceWeekly: v }),
                  },
                  {
                    label: "Monthly",
                    priceId: active.priceIdMonthly,
                    display: active.displayPriceMonthly,
                    onPriceId: (v: string) => patchEnv({ priceIdMonthly: v }),
                    onDisplay: (v: string) =>
                      patchEnv({ displayPriceMonthly: v }),
                  },
                  {
                    label: "Yearly",
                    priceId: active.priceIdYearly,
                    display: active.displayPriceYearly,
                    onPriceId: (v: string) => patchEnv({ priceIdYearly: v }),
                    onDisplay: (v: string) =>
                      patchEnv({ displayPriceYearly: v }),
                  },
                ] as const
              ).map((plan) => (
                <article key={plan.label} className="admin-stat-card">
                  <p className="admin-stat-label">{plan.label}</p>
                  <label className="admin-field-label">
                    Display price
                    <input
                      type="text"
                      value={plan.display}
                      disabled={!canEdit}
                      onChange={(e) => plan.onDisplay(e.target.value)}
                      className="field"
                    />
                  </label>
                  <label className="admin-field-label">
                    Stripe Price ID
                    <input
                      type="text"
                      value={plan.priceId}
                      disabled={!canEdit}
                      onChange={(e) => plan.onPriceId(e.target.value)}
                      className="field"
                      placeholder="price_…"
                    />
                  </label>
                </article>
              ))}
            </div>
            {canEdit ? (
              <div className="admin-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || syncing || !canSync}
                  onClick={() => void syncFromStripe()}
                >
                  {syncing
                    ? "Syncing…"
                    : `Sync from Stripe (${editorEnv})`}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || syncing}
                >
                  {busy ? "Saving…" : "Save Stripe settings"}
                </button>
                {msg ? <p className="admin-panel-sub">{msg}</p> : null}
              </div>
            ) : msg ? (
              <p className="admin-panel-sub">{msg}</p>
            ) : null}
          </form>
        )}
        {tab === "winback" && <AdminReactivationPanel />}
        {tab === "problems" && <AdminProblemReportsPanel />}
      {tab === "subscriptions" && (
          <section className="admin-panel">
            <h2 className="admin-panel-title">Subscriptions</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Renews</th>
                    <th>Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        No subscriptions yet
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.userId}>
                      <td>
                        <Link
                          href={`/admin/users/${r.userId}`}
                          className="admin-link"
                        >
                          {r.email}
                        </Link>
                      </td>
                      <td>{r.plan}</td>
                      <td>{r.status}</td>
                      <td>{formatMoney(r.amountCents, r.currency)}</td>
                      <td>{formatDateTime(r.renewsAt)}</td>
                      <td className="text-[var(--text-muted)]">
                        {r.stripeSubscriptionId ? "Linked" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {tab === "usage" && (
          <section className="admin-panel">
            <h2 className="admin-panel-title">Usage</h2>
            <p className="mb-3 text-sm text-[var(--text-muted)]">
              AI tokens, ElevenLabs voice characters, and estimated provider cost
              (USD list prices). Not charged to users.
            </p>
            {(llmMonth || llmWeek || llmAll) && (
              <div className="admin-stat-grid mb-4">
                <article className="admin-stat-card">
                  <p className="admin-stat-label">AI cost (week)</p>
                  <p className="admin-stat-value">
                    {formatUsdMicros(llmWeek?.costUsdMicros ?? 0)}
                  </p>
                  <p className="admin-stat-hint">
                    {formatTokenCount(
                      Math.max(
                        0,
                        (llmWeek?.totalTokens ?? 0) -
                          (voiceWeek?.totalTokens ?? 0)
                      )
                    )}{" "}
                    tokens
                    {(voiceWeek?.totalTokens ?? 0) > 0
                      ? ` · ${formatTokenCount(voiceWeek?.totalTokens ?? 0)} voice chars`
                      : ""}
                  </p>
                </article>
                <article className="admin-stat-card">
                  <p className="admin-stat-label">AI cost (month)</p>
                  <p className="admin-stat-value">
                    {formatUsdMicros(llmMonth?.costUsdMicros ?? 0)}
                  </p>
                  <p className="admin-stat-hint">
                    {formatTokenCount(
                      Math.max(
                        0,
                        (llmMonth?.totalTokens ?? 0) -
                          (voiceMonth?.totalTokens ?? 0)
                      )
                    )}{" "}
                    tokens
                    {(voiceMonth?.totalTokens ?? 0) > 0
                      ? ` · ${formatTokenCount(voiceMonth?.totalTokens ?? 0)} voice chars`
                      : ""}
                  </p>
                </article>
                <article className="admin-stat-card">
                  <p className="admin-stat-label">AI cost (all time)</p>
                  <p className="admin-stat-value">
                    {formatUsdMicros(llmAll?.costUsdMicros ?? 0)}
                  </p>
                  <p className="admin-stat-hint">
                    {formatTokenCount(
                      Math.max(
                        0,
                        (llmAll?.totalTokens ?? 0) - (voiceAll?.totalTokens ?? 0)
                      )
                    )}{" "}
                    tokens · {llmAll?.callCount ?? 0} calls
                    {(voiceAll?.totalTokens ?? 0) > 0
                      ? ` · ${formatTokenCount(voiceAll?.totalTokens ?? 0)} voice chars`
                      : ""}
                  </p>
                </article>
                <article className="admin-stat-card">
                  <p className="admin-stat-label">ElevenLabs voice (month)</p>
                  <p className="admin-stat-value">
                    {formatTokenCount(voiceMonth?.totalTokens ?? 0)}
                  </p>
                  <p className="admin-stat-hint">
                    {formatUsdMicros(voiceMonth?.costUsdMicros ?? 0)} ·{" "}
                    {voiceMonth?.callCount ?? 0} calls
                  </p>
                </article>
              </div>
            )}
            {usageMsg ? <p className="admin-panel-sub">{usageMsg}</p> : null}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Threads</th>
                    <th>Messages</th>
                    <th>AI tokens</th>
                    <th>Est. AI cost</th>
                    <th>Voice chars</th>
                    <th>Est. voice cost</th>
                    <th>Last activity</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {countedUsage.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <Link
                          href={`/admin/users/${u.userId}`}
                          className="admin-link"
                        >
                          {u.email}
                        </Link>
                      </td>
                      <td>{u.threadCount}</td>
                      <td>{u.messageCount}</td>
                      <td>
                        {formatTokenCount(u.llmTotalTokens)}
                        {u.llmCallCount > 0 ? (
                          <span className="text-[var(--text-muted)]">
                            {" "}
                            · {u.llmCallCount} calls
                          </span>
                        ) : null}
                      </td>
                      <td>{formatUsdMicros(u.llmCostUsdMicros)}</td>
                      <td>
                        {formatTokenCount(u.voiceChars ?? 0)}
                        {(u.voiceCallCount ?? 0) > 0 ? (
                          <span className="text-[var(--text-muted)]">
                            {" "}
                            · {u.voiceCallCount} calls
                          </span>
                        ) : null}
                      </td>
                      <td>{formatUsdMicros(u.voiceCostUsdMicros ?? 0)}</td>
                      <td>{formatDateTime(u.lastActivityAt)}</td>
                      <td>
                        {canEdit ? (
                          <button
                            type="button"
                            className="admin-link"
                            disabled={usageBusy}
                            onClick={() => void setStatsExcluded(u.userId, true)}
                          >
                            Ignore in stats
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ignoredUsage.length > 0 && (
              <div className="admin-table-wrap">
                <p className="admin-panel-sub">Ignored in stats</p>
                <table className="admin-table">
                  <tbody>
                    {ignoredUsage.map((u) => (
                      <tr key={u.userId}>
                        <td>
                          <Link
                            href={`/admin/users/${u.userId}`}
                            className="admin-link"
                          >
                            {u.email}
                          </Link>
                        </td>
                        <td>
                          {canEdit ? (
                            <button
                              type="button"
                              className="admin-link"
                              disabled={usageBusy}
                              onClick={() =>
                                void setStatsExcluded(u.userId, false)
                              }
                            >
                              Count in stats
                            </button>
                          ) : (
                            "Ignored"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
export default function AdminBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading…</p>
        </div>
      }
    >
      <AdminBillingPageInner />
    </Suspense>
  );
}
