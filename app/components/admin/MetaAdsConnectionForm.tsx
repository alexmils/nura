"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { MetaAdsAdminView } from "@/lib/meta-ads-settings";
import { fetchJson } from "@/lib/fetch-json";

function expiryLine(view: MetaAdsAdminView): string {
  if (!view.hasAccessToken) {
    return "Paste the ad account and token, then Save.";
  }
  if (view.expiresAt === 0) return "This token does not expire.";
  if (view.expiresAt && view.expiresAt > 0) {
    const date = new Date(view.expiresAt * 1000).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    if (view.autoRefresh) {
      return `Expires ${date}. It refreshes on its own in the two weeks before that.`;
    }
    return `Expires ${date}. Add the app id and app secret, then Save, so it can refresh on its own.`;
  }
  if (view.autoRefresh) {
    return "A user token refreshes on its own before it runs out.";
  }
  return "Add the app id and app secret if this token should refresh on its own.";
}

export function MetaAdsConnectionForm({ onSaved }: { onSaved: () => void }) {
  const [view, setView] = useState<MetaAdsAdminView | null>(null);
  const [accountId, setAccountId] = useState("");
  const [appId, setAppId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = (await fetchJson("/api/admin/meta-ads")) as {
          metaAds: MetaAdsAdminView;
        };
        if (cancelled) return;
        setView(data.metaAds);
        setAccountId(data.metaAds.accountId);
        setAppId(data.metaAds.appId);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not load the Meta connection.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!view?.canEdit || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const data = (await fetchJson("/api/admin/meta-ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, appId, accessToken, appSecret }),
      })) as { metaAds: MetaAdsAdminView };
      setView(data.metaAds);
      setAccountId(data.metaAds.accountId);
      setAppId(data.metaAds.appId);
      setAccessToken("");
      setAppSecret("");
      setMessage("Saved.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mkt-conn" onSubmit={(event) => void onSubmit(event)}>
      <div className="mkt-conn-head">
        <h3>Connection</h3>
        <p>{view ? expiryLine(view) : "Loading connection…"}</p>
      </div>
      <label>
        Ad account ID
        <input
          className="field"
          value={accountId}
          disabled={!view?.canEdit || busy}
          onChange={(event) => setAccountId(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Access token
        <input
          className="field"
          type="password"
          value={accessToken}
          placeholder={view?.hasAccessToken ? "Saved. Leave blank to keep it." : ""}
          disabled={!view?.canEdit || busy}
          onChange={(event) => setAccessToken(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        App ID
        <input
          className="field"
          value={appId}
          disabled={!view?.canEdit || busy}
          onChange={(event) => setAppId(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        App secret
        <input
          className="field"
          type="password"
          value={appSecret}
          placeholder={view?.hasAppSecret ? "Saved. Leave blank to keep it." : ""}
          disabled={!view?.canEdit || busy}
          onChange={(event) => setAppSecret(event.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="mkt-conn-actions">
        <button type="submit" className="btn-primary" disabled={!view?.canEdit || busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {message ? <span className="mkt-conn-ok">{message}</span> : null}
        {error ? <span className="mkt-conn-err">{error}</span> : null}
      </div>
      <p className="mkt-conn-hint">
        Leave a secret blank to keep it. Type off to clear it.
      </p>
    </form>
  );
}
