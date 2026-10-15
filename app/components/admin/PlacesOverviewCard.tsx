"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PlaceSummary } from "@/lib/auth-place";
import { fetchJson } from "@/lib/fetch-json";

const PlacesMap = dynamic(
  () => import("@/app/components/admin/PlacesMap").then((mod) => mod.PlacesMap),
  {
    ssr: false,
    loading: () => <div className="admin-places-map is-compact" aria-hidden />,
  }
);

export function PlacesOverviewCard() {
  const [summary, setSummary] = useState<PlaceSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<{ summary: PlaceSummary }>("/api/admin/places?days=90")
      .then((res) => {
        if (!cancelled) setSummary(res.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bucket =
    summary && summary.signIns.total > 0 ? summary.signIns : summary?.signups;
  const top = bucket?.countries.slice(0, 4) ?? [];

  return (
    <section className="admin-panel">
      <div className="admin-panel-head-row">
        <div>
          <h2 className="admin-panel-title">
            <Link href="/admin/places" className="admin-panel-title-link">
              Where people sign in
            </Link>
          </h2>
          <p className="admin-panel-sub">Last 90 days.</p>
        </div>
        <Link href="/admin/places" className="admin-link">
          Places
        </Link>
      </div>
      {summary && bucket ? (
        <>
          <PlacesMap countries={bucket.countries} compact />
          {top.length > 0 ? (
            <ul className="admin-places-top">
              {top.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <strong>
                    {row.count} · {row.sharePct}%
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-panel-sub">No sign-ins in the last 90 days.</p>
          )}
        </>
      ) : (
        <PlacesMap countries={[]} compact />
      )}
    </section>
  );
}
