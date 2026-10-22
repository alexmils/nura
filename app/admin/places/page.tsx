"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { PlacesMap } from "@/app/components/admin/PlacesMap";
import type { PlaceBucket, PlaceCount, PlaceSummary } from "@/lib/auth-place";
import { fetchJson } from "@/lib/fetch-json";

const WINDOWS = [30, 90, 365] as const;

function RankList({ rows, empty }: { rows: PlaceCount[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="admin-panel-sub">{empty}</p>;
  }
  return (
    <ol className="admin-places-rank">
      {rows.map((row) => (
        <li key={row.key}>
          <span>{row.label}</span>
          <span className="admin-places-bar" aria-hidden>
            <i style={{ width: `${Math.max(row.sharePct, row.count > 0 ? 4 : 0)}%` }} />
          </span>
          <strong>
            {row.count} · {row.sharePct}%
          </strong>
        </li>
      ))}
    </ol>
  );
}

function BucketBlock({
  title,
  bucket,
  className = "",
}: {
  title: string;
  bucket: PlaceBucket;
  className?: string;
}) {
  return (
    <section className={`admin-panel ${className}`.trim()}>
      <h2 className="admin-panel-title">{title}</h2>
      <p className="admin-panel-sub">{bucket.total} in this window.</p>
      <div className="admin-places-grid">
        <div>
          <h3 className="admin-places-kicker">Countries</h3>
          <RankList rows={bucket.countries} empty="No countries yet." />
        </div>
        <div>
          <h3 className="admin-places-kicker">Languages</h3>
          <RankList rows={bucket.languages} empty="No languages yet." />
        </div>
        <div>
          <h3 className="admin-places-kicker">Time zones</h3>
          <RankList rows={bucket.timezones} empty="No time zones yet." />
        </div>
        <div>
          <h3 className="admin-places-kicker">Browsers</h3>
          <RankList rows={bucket.browsers} empty="No browsers yet." />
        </div>
      </div>
    </section>
  );
}

export default function AdminPlacesPage() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(90);
  const [summary, setSummary] = useState<PlaceSummary | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (windowDays: number) => {
    const res = await fetchJson<{ summary: PlaceSummary }>(
      `/api/admin/places?days=${windowDays}`
    );
    setSummary(res.summary);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void load(days)
      .catch(() => {
        if (!cancelled) setError("Could not load places.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, load]);

  const copySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy.");
    }
  };

  const mapBucket =
    summary && summary.signIns.total > 0 ? summary.signIns : summary?.signups;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Places"
        subtitle="Where people sign in, for marketing."
      />
      <main className="admin-main admin-main-wide">
        <div className="admin-panel-head-row">
          <div className="admin-places-windows" role="group" aria-label="Time window">
            {WINDOWS.map((windowDays) => (
              <button
                key={windowDays}
                type="button"
                className={`btn-secondary${days === windowDays ? " is-active" : ""}`}
                aria-pressed={days === windowDays}
                onClick={() => setDays(windowDays)}
              >
                {windowDays} days
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary shrink-0"
            disabled={!summary}
            onClick={() => void copySummary()}
          >
            {copied ? "Copied" : "Copy summary"}
          </button>
        </div>

        {loading ? <p className="admin-panel-sub">Loading…</p> : null}
        {error ? <p className="text-[var(--destructive)]">{error}</p> : null}

        {summary ? (
          <div className="admin-places-board">
            <BucketBlock
              title="Sign-ins"
              bucket={summary.signIns}
              className="admin-places-signins"
            />
            <section className="admin-panel admin-places-map-panel">
              <PlacesMap countries={mapBucket?.countries ?? []} />
              {mapBucket && mapBucket.total > 0 ? null : (
                <p className="admin-panel-sub">No sign-ins in this window yet.</p>
              )}
            </section>
            <BucketBlock
              title="New accounts"
              bucket={summary.signups}
              className="admin-places-signups"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
