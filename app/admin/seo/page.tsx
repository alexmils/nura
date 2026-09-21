"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { fetchJson } from "@/lib/fetch-json";
import { BRAND_DOMAIN } from "@/lib/brand";
import type { SeoAdminView, SeoConfigPatch } from "@/lib/seo-admin-settings";
import type {
  SiteSeoPage,
  MarketingSeoStatus,
  ConnectionStatus,
} from "@/lib/site-seo-types";
import { displayOgImageUrl } from "@/lib/seo-og-image";
import type {
  SiteAnalytics,
  SiteAnalyticsRange,
} from "@/lib/site-analytics-types";
import type { SeoPageId } from "@/lib/seo-config";
import { fileToOgImageDataUrl } from "@/lib/avatar-client";
import { parseAnalyticsIgnoreIps } from "@/lib/analytics-ignore";

function ignoreIpRowsFromRaw(raw: string): string[] {
  const list = parseAnalyticsIgnoreIps(raw);
  return list.length > 0 ? list : [""];
}

function ignoreIpsFromRows(rows: string[]): string {
  return rows
    .map((row) => row.trim())
    .filter(Boolean)
    .join(", ");
}

const TABS = [
  "overview",
  "pages",
  "analytics",
  "connections",
  "indexing",
  "cookies",
] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "pages", label: "Pages" },
  { id: "analytics", label: "Analytics" },
  { id: "connections", label: "Connections" },
  { id: "indexing", label: "Indexing" },
  { id: "cookies", label: "Cookies" },
] as const;

function statusLabel(status: ConnectionStatus): string {
  if (status === "connected") return "Connected";
  if (status === "via_tag_manager") return "In Tag Manager";
  return "Not connected";
}

function statusClass(status: ConnectionStatus): string {
  if (status === "connected") return "admin-seo-status-ok";
  if (status === "via_tag_manager") return "admin-seo-status-alt";
  return "admin-seo-status-off";
}

type ConnId =
  | "gsc"
  | "ignore_ips"
  | "clarity"
  | "ga4"
  | "gtm"
  | "bing"
  | "meta"
  | "linkedin"
  | "conversions";

type ConnFormState = {
  ga4MeasurementId: string;
  gtmId: string;
  clarityId: string;
  gscProperty: string;
  ga4PropertyId: string;
  ignoreIps: string;
  gscVerification: string;
  bingVerification: string;
  googleServiceAccountJson: string;
  /** Server-side conversions — stored identifiers, echoed into the form. */
  metaPixelId: string;
  metaTestEventCode: string;
  googleAdsCustomerId: string;
  googleAdsConversionActionId: string;
  googleAdsLoginCustomerId: string;
  googleAdsOAuthClientId: string;
  googleAdsApiVersion: string;
  /** Server-side conversions — write-only, blank keeps, `off` clears. */
  ga4ApiSecret: string;
  metaCapiAccessToken: string;
  googleAdsDeveloperToken: string;
  googleAdsOAuthClientSecret: string;
  googleAdsOAuthRefreshToken: string;
};

function emptySecretFields(): Pick<
  ConnFormState,
  | "gscVerification"
  | "bingVerification"
  | "googleServiceAccountJson"
  | "ga4ApiSecret"
  | "metaCapiAccessToken"
  | "googleAdsDeveloperToken"
  | "googleAdsOAuthClientSecret"
  | "googleAdsOAuthRefreshToken"
> {
  return {
    gscVerification: "",
    bingVerification: "",
    googleServiceAccountJson: "",
    ga4ApiSecret: "",
    metaCapiAccessToken: "",
    googleAdsDeveloperToken: "",
    googleAdsOAuthClientSecret: "",
    googleAdsOAuthRefreshToken: "",
  };
}

type ConversionPlainKey =
  | "metaPixelId"
  | "metaTestEventCode"
  | "googleAdsCustomerId"
  | "googleAdsConversionActionId"
  | "googleAdsLoginCustomerId"
  | "googleAdsOAuthClientId"
  | "googleAdsApiVersion";

/**
 * Stored (non-secret) conversion fields, read from either the server view or
 * the local draft, so the initial state and the reload path cannot drift.
 */
function conversionPlainFields(
  source?: Partial<Record<ConversionPlainKey, string>>
): Pick<ConnFormState, ConversionPlainKey> {
  return {
    metaPixelId: source?.metaPixelId ?? "",
    metaTestEventCode: source?.metaTestEventCode ?? "",
    googleAdsCustomerId: source?.googleAdsCustomerId ?? "",
    googleAdsConversionActionId: source?.googleAdsConversionActionId ?? "",
    googleAdsLoginCustomerId: source?.googleAdsLoginCustomerId ?? "",
    googleAdsOAuthClientId: source?.googleAdsOAuthClientId ?? "",
    googleAdsApiVersion: source?.googleAdsApiVersion ?? "",
  };
}

/** Suffix shown on a credential field that already holds a stored value. */
function secretHint(has: boolean): string {
  return has ? " (leave blank to keep; type off to clear)" : "";
}

function emptyConnDraft(): ConnFormState {
  return {
    ga4MeasurementId: "",
    gtmId: "",
    clarityId: "",
    gscProperty: "",
    ga4PropertyId: "",
    ignoreIps: "",
    ...conversionPlainFields(),
    ...emptySecretFields(),
  };
}

/**
 * One builder for every path that opens the modal. Credentials are always
 * blank: the server never sends them down, and blank means "keep stored".
 */
function connDraftFromSeo(seo: SeoAdminView): ConnFormState {
  return {
    ...emptyConnDraft(),
    ga4MeasurementId: seo.ga4MeasurementId,
    gtmId: seo.gtmId,
    clarityId: seo.clarityId,
    gscProperty: seo.gscProperty,
    ga4PropertyId: seo.ga4PropertyId,
    ignoreIps: seo.ignoreIps,
    ...conversionPlainFields(seo),
  };
}

function connActionLabel(
  status: ConnectionStatus,
  canEdit: boolean
): string | null {
  if (!canEdit) return null;
  if (status === "via_tag_manager") return "How to";
  if (status === "connected") return "Edit";
  return "Connect";
}

type SeoConnCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; profile?: string; details?: string[] }
  | { status: "failed"; error: string };

function SeoConnectionBadge({ check }: { check: SeoConnCheck }) {
  if (check.status === "checking") {
    return <p className="admin-conn-idle">Checking connection…</p>;
  }
  if (check.status === "ok") {
    return (
      <div className="admin-seo-conn-check">
        <p className="admin-conn-ok">
          Connection OK
          {check.profile ? ` — ${check.profile}` : ""}
        </p>
        {check.details?.length ? (
          <ul className="admin-seo-conn-check-details">
            {check.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (check.status === "failed") {
    return (
      <p className="admin-conn-fail">
        Failed{check.error ? ` — ${check.error}` : ""}
      </p>
    );
  }
  return null;
}

function ConnectionConnectModal({
  connId,
  seo,
  busy,
  initial,
  onClose,
  onSave,
  onOpenGtm,
}: {
  connId: ConnId;
  seo: SeoAdminView;
  busy: boolean;
  initial: ConnFormState;
  onClose: () => void;
  onSave: (patch: SeoConfigPatch) => Promise<boolean>;
  onOpenGtm: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [ipRows, setIpRows] = useState(() =>
    ignoreIpRowsFromRaw(initial.ignoreIps)
  );
  const [check, setCheck] = useState<SeoConnCheck>({ status: "idle" });
  const [testing, setTesting] = useState(false);
  const titles: Record<ConnId, string> = {
    gsc: "Google Search Console",
    ignore_ips: "Ignored IPs",
    clarity: "Microsoft Clarity",
    ga4: "Google Analytics",
    gtm: "Google Tag Manager",
    bing: "Bing Webmaster Tools",
    meta: "Meta Pixel",
    linkedin: "LinkedIn Insight",
    conversions: "Server-side conversions",
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const infoOnly = connId === "meta" || connId === "linkedin";
  const canTest =
    connId === "ga4" ||
    connId === "gsc" ||
    connId === "gtm" ||
    connId === "clarity" ||
    connId === "bing" ||
    connId === "ignore_ips";

  async function runTest(): Promise<boolean> {
    if (!canTest) return false;
    setTesting(true);
    setCheck({ status: "checking" });
    try {
      const res = await fetch("/api/admin/seo/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: connId,
          ga4MeasurementId: draft.ga4MeasurementId,
          ga4PropertyId: draft.ga4PropertyId,
          googleServiceAccountJson: draft.googleServiceAccountJson,
          gscProperty: draft.gscProperty,
          gscVerification: draft.gscVerification,
          gtmId: draft.gtmId,
          clarityId: draft.clarityId,
          bingVerification: draft.bingVerification,
          ignoreIps: draft.ignoreIps,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        profile?: string;
        details?: string[];
      };
      if (data.ok) {
        setCheck({
          status: "ok",
          profile: data.profile,
          details: data.details,
        });
        return true;
      }
      setCheck({
        status: "failed",
        error: data.error || "Connection check failed",
      });
      return false;
    } catch {
      setCheck({ status: "failed", error: "Connection check failed" });
      return false;
    } finally {
      setTesting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (infoOnly) return;
    let patch: SeoConfigPatch = {};
    if (connId === "gsc") {
      patch = {
        gscProperty: draft.gscProperty,
        gscVerification: draft.gscVerification,
      };
    } else if (connId === "ignore_ips") {
      patch = { ignoreIps: draft.ignoreIps };
    } else if (connId === "clarity") {
      patch = { clarityId: draft.clarityId };
    } else if (connId === "ga4") {
      patch = {
        ga4MeasurementId: draft.ga4MeasurementId,
        ga4PropertyId: draft.ga4PropertyId,
        googleServiceAccountJson: draft.googleServiceAccountJson,
      };
    } else if (connId === "gtm") {
      patch = { gtmId: draft.gtmId };
    } else if (connId === "bing") {
      patch = { bingVerification: draft.bingVerification };
    } else if (connId === "conversions") {
      patch = {
        ...conversionPlainFields(draft),
        ga4ApiSecret: draft.ga4ApiSecret,
        metaCapiAccessToken: draft.metaCapiAccessToken,
        googleAdsDeveloperToken: draft.googleAdsDeveloperToken,
        googleAdsOAuthClientSecret: draft.googleAdsOAuthClientSecret,
        googleAdsOAuthRefreshToken: draft.googleAdsOAuthRefreshToken,
      };
    }
    const ok = await onSave(patch);
    if (!ok) return;
    if (canTest) {
      const passed = await runTest();
      if (passed) {
        window.setTimeout(() => onClose(), 900);
        return;
      }
      return;
    }
    onClose();
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`admin-modal${
          connId === "ga4" || connId === "conversions" ? " admin-modal-wide" : ""
        }`}
        role="dialog"
        aria-labelledby="admin-seo-conn-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="admin-seo-conn-modal-title" className="admin-panel-title">
          {titles[connId]}
        </h2>

        {infoOnly ? (
          <>
            <p className="admin-panel-sub">
              {connId === "meta"
                ? "Add the Meta Pixel inside Google Tag Manager. Nura does not load a separate Meta script."
                : "Add the LinkedIn tag inside Google Tag Manager. Nura does not load a separate LinkedIn script."}
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-btn-edit" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="admin-btn-edit"
                onClick={onOpenGtm}
              >
                Open Tag Manager
              </button>
            </div>
          </>
        ) : (
          <form className="admin-form-stack mt-4" onSubmit={(e) => void submit(e)}>
            {connId === "gsc" ? (
              <>
                <p className="admin-panel-sub">
                  Paste the property and verification code from Search Console.
                  Test uses the Google service account from Analytics when set.
                </p>
                <label className="admin-field-label">
                  Property
                  <input
                    className="field"
                    placeholder={`sc-domain:${BRAND_DOMAIN}`}
                    value={draft.gscProperty}
                    disabled={busy}
                    autoFocus
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, gscProperty: e.target.value }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Verification code
                  {seo.hasGscVerification
                    ? " (leave blank to keep; type off to clear)"
                    : ""}
                  <input
                    className="field"
                    type="password"
                    autoComplete="off"
                    value={draft.gscVerification}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        gscVerification: e.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}

            {connId === "ignore_ips" ? (
              <>
                <p className="admin-panel-sub">
                  Visits from these addresses skip Analytics, Clarity, and Tag
                  Manager.
                </p>
                <div className="admin-field-label">
                  <span>IP addresses</span>
                  <div className="admin-ip-list">
                    {ipRows.map((ip, index) => (
                      <div key={index} className="admin-ip-row">
                        <input
                          className="field admin-ip-input"
                          placeholder="1.2.3.4"
                          value={ip}
                          disabled={busy}
                          autoFocus={index === 0}
                          aria-label={`Ignored IP ${index + 1}`}
                          onChange={(e) => {
                            const next = ipRows.map((row, i) =>
                              i === index ? e.target.value : row
                            );
                            setIpRows(next);
                            setDraft((d) => ({
                              ...d,
                              ignoreIps: ignoreIpsFromRows(next),
                            }));
                          }}
                        />
                        {ipRows.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-ghost admin-ip-remove"
                            disabled={busy}
                            aria-label={`Remove IP ${index + 1}`}
                            onClick={() => {
                              const next = ipRows.filter((_, i) => i !== index);
                              const rows = next.length > 0 ? next : [""];
                              setIpRows(rows);
                              setDraft((d) => ({
                                ...d,
                                ignoreIps: ignoreIpsFromRows(rows),
                              }));
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                        {index === ipRows.length - 1 ? (
                          <button
                            type="button"
                            className="btn btn-ghost admin-ip-add"
                            disabled={busy}
                            onClick={() => {
                              const next = [...ipRows, ""];
                              setIpRows(next);
                            }}
                          >
                            Add
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {connId === "clarity" ? (
              <>
                <p className="admin-panel-sub">
                  Tag loads on public pages; enable Consent Mode in Clarity so
                  cookies stay off until analytics cookies are allowed.
                </p>
                <label className="admin-field-label">
                  Project ID
                  <input
                    className="field"
                    value={draft.clarityId}
                    disabled={busy}
                    autoFocus
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, clarityId: e.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}

            {connId === "ga4" ? (
              <>
                <p className="admin-panel-sub">
                  Measurement ID for the public site. Property ID and service
                  account power the Analytics tab.
                </p>
                <label className="admin-field-label">
                  Measurement ID
                  <input
                    className="field"
                    placeholder="G-XXXXXXXX"
                    value={draft.ga4MeasurementId}
                    disabled={busy}
                    autoFocus
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        ga4MeasurementId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Property ID (Analytics API)
                  <input
                    className="field"
                    placeholder="123456789"
                    value={draft.ga4PropertyId}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        ga4PropertyId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Service account JSON
                  {seo.hasGoogleServiceAccount
                    ? " (leave blank to keep; type off to clear)"
                    : ""}
                  {seo.serviceAccountEmail ? (
                    <span className="admin-seo-mono muted">
                      {" "}
                      · {seo.serviceAccountEmail}
                    </span>
                  ) : null}
                  <textarea
                    className="field admin-textarea"
                    rows={5}
                    placeholder='{"type":"service_account",...}'
                    value={draft.googleServiceAccountJson}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleServiceAccountJson: e.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}

            {connId === "gtm" ? (
              <>
                <p className="admin-panel-sub">
                  Use Tag Manager for Meta and LinkedIn later — not for GA or
                  Clarity.
                </p>
                <label className="admin-field-label">
                  Container ID
                  <input
                    className="field"
                    placeholder="GTM-XXXXXXX"
                    value={draft.gtmId}
                    disabled={busy}
                    autoFocus
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, gtmId: e.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}

            {connId === "conversions" ? (
              <>
                <p className="admin-panel-sub">
                  Reports the first real Stripe charge to GA4, Meta, and Google
                  Ads. Checkout only saves a card — the money moves days later on
                  Stripe&apos;s servers, so nothing in the browser can see it.
                  Saved values take effect immediately, with no redeploy. Leave a
                  credential blank to keep the stored one, or type off to clear
                  it.
                </p>

                <h3 className="admin-field-label">GA4 · Measurement Protocol</h3>
                <label className="admin-field-label">
                  API secret{secretHint(seo.hasGa4ApiSecret)}
                  <input
                    className="field"
                    placeholder="Admin → Data streams → Measurement Protocol API secrets"
                    value={draft.ga4ApiSecret}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, ga4ApiSecret: e.target.value }))
                    }
                  />
                </label>
                <p className="admin-panel-sub">
                  Measurement ID comes from the Google Analytics card — one
                  source, so the browser and the server always agree.
                </p>

                <h3 className="admin-field-label">Meta · Conversions API</h3>
                <label className="admin-field-label">
                  Pixel ID
                  <input
                    className="field"
                    placeholder="1120650977294654"
                    value={draft.metaPixelId}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, metaPixelId: e.target.value }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Access token{secretHint(seo.hasMetaCapiAccessToken)}
                  <input
                    className="field"
                    placeholder="Events Manager → Settings → Conversions API"
                    value={draft.metaCapiAccessToken}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        metaCapiAccessToken: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Test event code (optional)
                  <input
                    className="field"
                    placeholder="TEST12345"
                    value={draft.metaTestEventCode}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        metaTestEventCode: e.target.value,
                      }))
                    }
                  />
                </label>

                <h3 className="admin-field-label">Google Ads · offline conversions</h3>
                <p className="admin-panel-sub">
                  The only channel that credits the exact click. Needs a
                  developer token, an OAuth client, and a refresh token with the
                  adwords scope.
                </p>
                <label className="admin-field-label">
                  Customer ID
                  <input
                    className="field"
                    placeholder="352-258-1611"
                    value={draft.googleAdsCustomerId}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsCustomerId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Conversion action ID
                  <input
                    className="field"
                    placeholder="123456789"
                    value={draft.googleAdsConversionActionId}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsConversionActionId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Developer token{secretHint(seo.hasGoogleAdsDeveloperToken)}
                  <input
                    className="field"
                    value={draft.googleAdsDeveloperToken}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsDeveloperToken: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Manager account ID (optional)
                  <input
                    className="field"
                    placeholder="Only when the action lives under an MCC"
                    value={draft.googleAdsLoginCustomerId}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsLoginCustomerId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  OAuth client ID
                  <input
                    className="field"
                    value={draft.googleAdsOAuthClientId}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsOAuthClientId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  OAuth client secret{secretHint(seo.hasGoogleAdsOAuthClientSecret)}
                  <input
                    className="field"
                    value={draft.googleAdsOAuthClientSecret}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsOAuthClientSecret: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  OAuth refresh token{secretHint(seo.hasGoogleAdsOAuthRefreshToken)}
                  <input
                    className="field"
                    value={draft.googleAdsOAuthRefreshToken}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsOAuthRefreshToken: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  API version (optional)
                  <input
                    className="field"
                    placeholder="v21"
                    value={draft.googleAdsApiVersion}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        googleAdsApiVersion: e.target.value,
                      }))
                    }
                  />
                </label>
                <p className="admin-panel-sub">
                  Verify setup at any time: GET /api/admin/conversions lists what
                  parsed and the recent delivery log, POST it with{" "}
                  <span className="admin-seo-mono">
                    {`{"channel":"ga4"}`}
                  </span>{" "}
                  to send one probe.
                </p>
              </>
            ) : null}

            {connId === "bing" ? (
              <>
                <p className="admin-panel-sub">
                  Paste the verification code from Bing Webmaster Tools.
                </p>
                <label className="admin-field-label">
                  Verification code
                  {seo.hasBingVerification
                    ? " (leave blank to keep; type off to clear)"
                    : ""}
                  <input
                    className="field"
                    type="password"
                    autoComplete="off"
                    value={draft.bingVerification}
                    disabled={busy}
                    autoFocus
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        bingVerification: e.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}

            <div className="admin-conn-row">
              <SeoConnectionBadge check={check} />
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn-edit"
                onClick={onClose}
                disabled={busy || testing}
              >
                Cancel
              </button>
              {canTest ? (
                <button
                  type="button"
                  className="admin-btn-edit"
                  disabled={busy || testing}
                  onClick={() => void runTest()}
                >
                  {testing ? "Testing…" : "Test"}
                </button>
              ) : null}
              <button
                type="submit"
                className="admin-btn-edit"
                disabled={busy || testing}
              >
                {busy ? "Saving…" : testing ? "Checking…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return BRAND_DOMAIN;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("en").format(n);
}

function pageLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.host : `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

function SeoSnippetPreview({
  canonical,
  title,
  description,
  ogTitle,
  ogImageUrl,
}: {
  canonical: string;
  title: string;
  description: string;
  ogTitle: string;
  ogImageUrl: string;
}) {
  return (
    <div className="admin-seo-previews">
      <section className="admin-panel">
        <h3 className="admin-panel-title">Search preview</h3>
        <div className="admin-seo-serp">
          <p className="admin-seo-serp-url">{hostLabel(canonical)}</p>
          <p className="admin-seo-serp-title">{title}</p>
          <p className="admin-seo-serp-desc">{description}</p>
        </div>
      </section>
      <section className="admin-panel">
        <h3 className="admin-panel-title">Share preview</h3>
        <div className="admin-seo-share">
          <div className="admin-seo-share-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ogImageUrl} alt="" />
          </div>
          <div className="admin-seo-share-meta">
            <p className="admin-seo-share-host">{hostLabel(canonical)}</p>
            <p className="admin-seo-share-title">{ogTitle || title}</p>
            <p className="admin-seo-share-desc">{description}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SeoOgImageField({
  label,
  hint,
  value,
  previewUrl,
  disabled,
  busy,
  clearLabel = "Use default",
  onChange,
  onClear,
  onBusy,
  onError,
}: {
  label: string;
  hint: string;
  value: string;
  previewUrl: string;
  disabled: boolean;
  busy: boolean;
  clearLabel?: string;
  onChange: (next: string) => void;
  onClear: () => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="admin-seo-og-field">
      <p className="admin-field-label" style={{ marginBottom: 0 }}>
        {label}
      </p>
      <p className="admin-panel-sub">{hint}</p>
      <div className="admin-seo-og-row">
        <div className="admin-seo-og-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" />
        </div>
        <div className="admin-seo-og-actions">
          <label className="admin-btn-edit admin-seo-upload-label">
            {busy ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled || busy}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (!file) return;
                void (async () => {
                  onBusy(true);
                  onError("");
                  try {
                    const url = await fileToOgImageDataUrl(file);
                    onChange(url);
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
            disabled={disabled || busy || !value}
            onClick={onClear}
          >
            {clearLabel}
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
          disabled={disabled || busy}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

function SeoAnalyticsPanel() {
  const [range, setRange] = useState<SiteAnalyticsRange>("7d");
  const [data, setData] = useState<SiteAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<{ analytics: SiteAnalytics }>(
      `/api/admin/seo/analytics?range=${range}`
    )
      .then((res) => {
        if (!cancelled) {
          setData(res.analytics);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const maxCountry = Math.max(
    1,
    ...(data?.countries.map((c) => c.sessions) ?? [0])
  );
  const gaLive = Boolean(data?.ga4.connected);
  const gscLive = Boolean(data?.gsc.connected);

  return (
    <div className="admin-seo-section">
      <div className="admin-seo-section-head">
        <div>
          <h2 className="admin-panel-title">Analytics</h2>
          <p className="admin-panel-sub">
            Visits and search for {BRAND_DOMAIN}.
          </p>
          <p className="admin-seo-note">
            Your office IP is ignored for new visits (see Connections → Ignored
            IPs). Numbers below can still include older clicks from before that
            filter.
          </p>
        </div>
        <div className="admin-seo-range">
          {(["7d", "28d"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={
                range === key
                  ? "admin-seo-range-btn is-active"
                  : "admin-seo-range-btn"
              }
            >
              {key === "7d" ? "7 days" : "28 days"}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="admin-invite-msg">
          Could not load analytics. {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-[var(--text-secondary)]">Loading…</p>
      ) : null}

      {data && !data.connected ? (
        <div className="admin-panel admin-seo-empty">
          <p className="admin-panel-title">Connect Google Analytics</p>
          <p className="admin-panel-sub">{data.setupNote}</p>
          {data.serviceAccountEmail ? (
            <p className="admin-seo-mono">{data.serviceAccountEmail}</p>
          ) : null}
        </div>
      ) : null}

      {data?.connected ? (
        <>
          <section className="admin-seo-block">
            <h3 className="admin-seo-kicker">Visits</h3>
            {gaLive ? (
              <div className="admin-seo-kpi-grid">
                <div className="admin-panel">
                  <div className="admin-seo-kicker">Visits</div>
                  <div className="admin-seo-kpi">{fmt(data.visits.sessions)}</div>
                </div>
                <div className="admin-panel">
                  <div className="admin-seo-kicker">People</div>
                  <div className="admin-seo-kpi">{fmt(data.visits.users)}</div>
                </div>
                <div className="admin-panel">
                  <div className="admin-seo-kicker">Page views</div>
                  <div className="admin-seo-kpi">
                    {fmt(data.visits.pageviews)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="admin-panel-sub">
                Connect Google Analytics to see visits.
              </p>
            )}
            {gaLive && data.visits.sessions === 0 ? (
              <p className="admin-panel-sub">No visits in this period yet.</p>
            ) : null}
          </section>

          <section className="admin-seo-block">
            <h3 className="admin-seo-kicker">Top countries</h3>
            {gaLive && data.countries.length > 0 ? (
              <div className="admin-panel admin-seo-list">
                {data.countries.map((c) => (
                  <div key={c.country} className="admin-seo-list-row">
                    <span className="admin-seo-list-label">{c.country}</span>
                    <div className="admin-seo-bar-track">
                      <div
                        className="admin-seo-bar-fill"
                        style={{
                          width: `${Math.max(6, (c.sessions / maxCountry) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="admin-seo-list-meta">
                      {fmt(c.sessions)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-panel-sub">
                {gaLive
                  ? "No country data yet."
                  : "Connect Google Analytics to see countries."}
              </p>
            )}
          </section>

          <section className="admin-seo-block">
            <h3 className="admin-seo-kicker">What happened</h3>
            {gaLive && data.events.length > 0 ? (
              <div className="admin-panel admin-seo-list">
                {data.events.map((e) => (
                  <div key={e.name} className="admin-seo-list-row">
                    <span className="admin-seo-list-label">{e.label}</span>
                    <span className="admin-seo-list-meta">{fmt(e.count)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-panel-sub">
                {gaLive
                  ? "No events in this period yet."
                  : "Connect Google Analytics to see events."}
              </p>
            )}
          </section>

          <section className="admin-seo-block">
            <h3 className="admin-seo-kicker">New and indexed pages</h3>
            {gscLive && data.indexedPages.length > 0 ? (
              <div className="admin-panel admin-seo-list">
                {data.indexedPages.map((p) => (
                  <div key={p.url} className="admin-seo-list-row">
                    <span className="admin-seo-list-label">
                      {p.isNew ? (
                        <span className="admin-seo-badge">New</span>
                      ) : null}
                      {pageLabel(p.url)}
                    </span>
                    <span className="admin-seo-list-meta">
                      {fmt(p.impressions)} shown · {fmt(p.clicks)} clicks
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-panel-sub">
                {gscLive
                  ? "No page data yet."
                  : "Connect Search Console to see indexed pages."}
              </p>
            )}
          </section>

          <section className="admin-seo-block">
            <h3 className="admin-seo-kicker">Search queries</h3>
            {gscLive && data.queries.length > 0 ? (
              <div className="admin-panel admin-seo-list">
                {data.queries.map((q) => (
                  <div key={q.query} className="admin-seo-list-row">
                    <span className="admin-seo-list-label">{q.query}</span>
                    <span className="admin-seo-list-meta">
                      {fmt(q.clicks)} clicks · {fmt(q.impressions)} shown
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-panel-sub">
                {gscLive
                  ? "No queries yet."
                  : "Connect Search Console to see queries."}
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function AdminSeoPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useAdminTab(TABS, "overview");
  const selectedPage = (searchParams.get("page") || "home") as SeoPageId;

  const [seo, setSeo] = useState<SeoAdminView | null>(null);
  const [pages, setPages] = useState<SiteSeoPage[]>([]);
  const [status, setStatus] = useState<MarketingSeoStatus | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [draftPage, setDraftPage] = useState({
    title: "",
    description: "",
    ogTitle: "",
    ogImageUrl: "",
  });
  const [draftDefaultOg, setDraftDefaultOg] = useState("");
  const [ogBusy, setOgBusy] = useState(false);

  const [connDraft, setConnDraft] = useState<ConnFormState>(emptyConnDraft);
  const [connModal, setConnModal] = useState<ConnId | null>(null);

  const load = useCallback(async () => {
    const res = await fetchJson<{
      seo: SeoAdminView;
      pages: SiteSeoPage[];
      status: MarketingSeoStatus;
      canEdit: boolean;
    }>("/api/admin/seo");
    setSeo(res.seo);
    setPages(res.pages);
    setStatus(res.status);
    setCanEdit(res.canEdit);
    setConnDraft(connDraftFromSeo(res.seo));
    setDraftDefaultOg(res.seo.defaultOgImageUrl || "");
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to load SEO");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const activePage = useMemo(
    () => pages.find((p) => p.id === selectedPage) || pages[0],
    [pages, selectedPage]
  );

  useEffect(() => {
    if (!activePage || !seo) return;
    const pageOverride = seo.pages[activePage.id]?.ogImageUrl || "";
    setDraftPage({
      title: activePage.title,
      description: activePage.description,
      ogTitle:
        activePage.ogTitle === activePage.title ? "" : activePage.ogTitle,
      ogImageUrl: pageOverride,
    });
  }, [activePage, seo]);

  const setPage = (id: string) => {
    router.replace(`/admin/seo?tab=pages&page=${encodeURIComponent(id)}`, {
      scroll: false,
    });
  };

  const savePatch = async (
    patch: SeoConfigPatch,
    okMsg: string
  ): Promise<boolean> => {
    if (!canEdit) return false;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetchJson<{
        seo: SeoAdminView;
        pages: SiteSeoPage[];
        status: MarketingSeoStatus;
      }>("/api/admin/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSeo(res.seo);
      setPages(res.pages);
      setStatus(res.status);
      setDraftDefaultOg(res.seo.defaultOgImageUrl || "");
      setMsg(okMsg);
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading || !seo || !status) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }

  const home = pages.find((p) => p.id === "home") || pages[0];
  const connectedCount = status.connections.filter(
    (c) => c.status === "connected"
  ).length;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="SEO"
        subtitle={`Titles, descriptions, search tools, and indexing for ${BRAND_DOMAIN}.`}
      />
      <main className="admin-main admin-main-wide">
        <AdminTabs
          tabs={TAB_ITEMS}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {msg ? <p className="admin-invite-msg">{msg}</p> : null}

        {tab === "overview" && home ? (
          <div className="admin-seo-section">
            <SeoSnippetPreview
              canonical={home.canonical}
              title={home.title}
              description={home.description}
              ogTitle={home.ogTitle}
              ogImageUrl={displayOgImageUrl(
                seo.defaultOgImageUrl ||
                  seo.pages.home?.ogImageUrl ||
                  undefined,
                home.ogImageUrl
              )}
            />
            <dl className="admin-seo-stat-grid">
              <div className="admin-panel">
                <dt className="admin-seo-kicker">Page address</dt>
                <dd className="admin-seo-stat-value">{home.canonical}</dd>
              </div>
              <div className="admin-panel">
                <dt className="admin-seo-kicker">Tools connected</dt>
                <dd className="admin-seo-stat-value">
                  {connectedCount} of {status.connections.length}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {tab === "pages" && activePage ? (
          <div className="admin-seo-pages">
            <div>
              <h2 className="admin-panel-title">Pages</h2>
              <p className="admin-panel-sub">
                Title, description, and share image for each public page.
              </p>

              <form
                className="admin-form-stack admin-panel admin-seo-default-og"
                onSubmit={(e) => {
                  e.preventDefault();
                  void savePatch(
                    { defaultOgImageUrl: draftDefaultOg || "clear" },
                    "Default share image saved."
                  );
                }}
              >
                <SeoOgImageField
                  label="Default share image (Open Graph)"
                  hint="Used on every public page unless that page sets its own image. Built-in fallback is the Nura lockup."
                  value={draftDefaultOg}
                  previewUrl={displayOgImageUrl(
                    draftDefaultOg,
                    "/brand/lockup.png"
                  )}
                  disabled={!canEdit}
                  busy={busy || ogBusy}
                  clearLabel="Use lockup"
                  onChange={(next) => setDraftDefaultOg(next)}
                  onClear={() => setDraftDefaultOg("")}
                  onBusy={setOgBusy}
                  onError={setMsg}
                />
                {canEdit ? (
                  <div className="admin-form-actions">
                    <button
                      type="submit"
                      className="admin-btn-edit"
                      disabled={busy || ogBusy}
                    >
                      {busy ? "Saving…" : "Save default image"}
                    </button>
                  </div>
                ) : null}
              </form>

              <div className="admin-seo-page-picker">
                {pages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      p.id === activePage.id
                        ? "admin-seo-page-chip is-active"
                        : "admin-seo-page-chip"
                    }
                    onClick={() => setPage(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <form
                className="admin-form-stack admin-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  void savePatch(
                    {
                      pages: {
                        [activePage.id]: {
                          title: draftPage.title,
                          description: draftPage.description,
                          ogTitle: draftPage.ogTitle,
                          ogImageUrl: draftPage.ogImageUrl,
                        },
                      },
                    },
                    "Page SEO saved."
                  );
                }}
              >
                <label className="admin-field-label">
                  Title
                  <input
                    className="field"
                    value={draftPage.title}
                    disabled={!canEdit || busy}
                    onChange={(e) =>
                      setDraftPage((d) => ({ ...d, title: e.target.value }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Description
                  <textarea
                    className="field admin-textarea"
                    rows={3}
                    value={draftPage.description}
                    disabled={!canEdit || busy}
                    onChange={(e) =>
                      setDraftPage((d) => ({
                        ...d,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Share title (optional)
                  <input
                    className="field"
                    value={draftPage.ogTitle}
                    disabled={!canEdit || busy}
                    placeholder={draftPage.title}
                    onChange={(e) =>
                      setDraftPage((d) => ({ ...d, ogTitle: e.target.value }))
                    }
                  />
                </label>
                <SeoOgImageField
                  label="Share image for this page"
                  hint="Leave empty to use the default share image above."
                  value={draftPage.ogImageUrl}
                  previewUrl={displayOgImageUrl(
                    draftPage.ogImageUrl || draftDefaultOg,
                    "/brand/lockup.png"
                  )}
                  disabled={!canEdit}
                  busy={busy || ogBusy}
                  onChange={(next) =>
                    setDraftPage((d) => ({ ...d, ogImageUrl: next }))
                  }
                  onClear={() =>
                    setDraftPage((d) => ({ ...d, ogImageUrl: "" }))
                  }
                  onBusy={setOgBusy}
                  onError={setMsg}
                />
                {canEdit ? (
                  <div className="admin-form-actions">
                    <button
                      type="submit"
                      className="admin-btn-edit"
                      disabled={busy || ogBusy}
                    >
                      {busy ? "Saving…" : "Save page"}
                    </button>
                  </div>
                ) : null}
              </form>
            </div>
            <SeoSnippetPreview
              canonical={activePage.canonical}
              title={draftPage.title || activePage.title}
              description={draftPage.description || activePage.description}
              ogTitle={draftPage.ogTitle || draftPage.title || activePage.title}
              ogImageUrl={displayOgImageUrl(
                draftPage.ogImageUrl || draftDefaultOg,
                "/brand/lockup.png"
              )}
            />
          </div>
        ) : null}

        {tab === "analytics" ? <SeoAnalyticsPanel /> : null}

        {tab === "connections" ? (
          <div className="admin-seo-section">
            <h2 className="admin-panel-title">Connections</h2>
            <p className="admin-panel-sub">
              Public IDs are masked in the cards. Verification codes and the
              service account stay hidden after save.
            </p>
            <div className="admin-seo-conn-grid">
              {status.connections.map((c) => {
                const id = c.id as ConnId;
                const action = connActionLabel(c.status, canEdit);
                return (
                  <article key={c.id} className="admin-panel">
                    <div className="admin-seo-conn-head">
                      <h3>{c.name}</h3>
                      <div className="admin-seo-conn-actions">
                        {action ? (
                          <button
                            type="button"
                            className="admin-seo-connect-btn"
                            disabled={busy}
                            onClick={() => {
                              setConnDraft(connDraftFromSeo(seo));
                              setConnModal(id);
                            }}
                          >
                            {action}
                          </button>
                        ) : null}
                        <span className={statusClass(c.status)}>
                          {statusLabel(c.status)}
                        </span>
                      </div>
                    </div>
                    {c.detail ? (
                      <p className="admin-seo-mono">{c.detail}</p>
                    ) : null}
                    {c.publicIdMasked ? (
                      <p className="admin-seo-mono muted">{c.publicIdMasked}</p>
                    ) : null}
                    <p className="admin-panel-sub">{c.hint}</p>
                  </article>
                );
              })}
            </div>
            {!canEdit ? (
              <p className="admin-panel-sub">
                Support can view connections. Platform admin can connect them.
              </p>
            ) : null}
            {connModal && seo ? (
              <ConnectionConnectModal
                key={connModal}
                connId={connModal}
                seo={seo}
                busy={busy}
                initial={connDraft}
                onClose={() => setConnModal(null)}
                onOpenGtm={() => setConnModal("gtm")}
                onSave={async (patch) => {
                  const ok = await savePatch(patch, "Connection saved.");
                  if (ok) {
                    setConnDraft((d) => ({
                      ...d,
                      ...emptySecretFields(),
                      ...(typeof patch.ga4MeasurementId === "string"
                        ? { ga4MeasurementId: patch.ga4MeasurementId }
                        : {}),
                      ...(typeof patch.ga4PropertyId === "string"
                        ? { ga4PropertyId: patch.ga4PropertyId }
                        : {}),
                      ...(typeof patch.gtmId === "string"
                        ? { gtmId: patch.gtmId }
                        : {}),
                      ...(typeof patch.clarityId === "string"
                        ? { clarityId: patch.clarityId }
                        : {}),
                      ...(typeof patch.gscProperty === "string"
                        ? { gscProperty: patch.gscProperty }
                        : {}),
                      ...(typeof patch.ignoreIps === "string"
                        ? { ignoreIps: patch.ignoreIps }
                        : {}),
                    }));
                  }
                  return ok;
                }}
              />
            ) : null}
          </div>
        ) : null}

        {tab === "indexing" ? (
          <div className="admin-seo-section">
            <h2 className="admin-panel-title">Indexing</h2>
            <p className="admin-panel-sub">
              Sitemap, robots.txt, and llms.txt for public routes.
            </p>
            <div className="admin-panel admin-seo-list">
              <div className="admin-seo-index-row">
                <p className="admin-panel-title">Sitemap</p>
                <a
                  href={status.sitemapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-seo-link"
                >
                  {status.sitemapUrl}
                </a>
                <p className="admin-panel-sub">{status.sitemapNote}</p>
              </div>
              <div className="admin-seo-index-row">
                <p className="admin-panel-title">robots.txt</p>
                <a
                  href={status.robotsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-seo-link"
                >
                  {status.robotsUrl}
                </a>
                <p className="admin-panel-sub">
                  Public routes for search and AI grounding bots. /app, /admin,
                  and /api stay closed. Training crawlers are disallowed.
                </p>
              </div>
              <div className="admin-seo-index-row">
                <p className="admin-panel-title">llms.txt</p>
                <a
                  href={status.llmsTxtUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-seo-link"
                >
                  {status.llmsTxtUrl}
                </a>
                <p className="admin-panel-sub">
                  Notes for AI search on what they may cite from public pages.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "cookies" ? (
          <div className="admin-seo-section">
            <h2 className="admin-panel-title">Cookies</h2>
            <div className="admin-panel">
              <p className="admin-panel-sub">
                Cookie banner and analytics tags on the marketing site.
              </p>
              <p className="admin-seo-cookie-actions">
                <Link href="/" className="admin-seo-link">
                  Open public site
                </Link>
                <span className="admin-panel-sub">
                  {" "}
                  to change cookie choices
                </span>
              </p>
              <p>
                <Link href="/privacy" className="admin-seo-link muted">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminSeoPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading…</p>
        </div>
      }
    >
      <AdminSeoPageInner />
    </Suspense>
  );
}
