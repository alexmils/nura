"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DayCharts, MarketingLines } from "@/app/components/admin/MarketingDetail";
import { ADMIN_MKT_REPORT_REV } from "@/app/components/admin-mkt-report-rev";
import { ADS_RANGE_LABELS, isAdsRange, type AdsRange } from "@/lib/ads-range";
import {
  marketingTabHref,
  type MarketingCampaignView,
} from "@/lib/admin-marketing-campaign";
import { fetchJson } from "@/lib/fetch-json";

export function MarketingCampaignReport({ campaignId }: { campaignId: string }) {
  const searchParams = useSearchParams();
  const channelParam = searchParams.get("channel");
  const channel = channelParam === "google" || channelParam === "meta" ? channelParam : null;
  const rangeRaw = searchParams.get("range");
  const range: AdsRange = isAdsRange(rangeRaw) ? rangeRaw : "28";
  const account = searchParams.get("account") || "";
  const [data, setData] = useState<MarketingCampaignView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!channel) return;
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("id", campaignId);
    params.set("channel", channel);
    params.set("range", range);
    if (account) params.set("account", account);
    void (async () => {
      try {
        const next = (await fetchJson(
          `/api/admin/marketing/campaign?${params.toString()}`
        )) as MarketingCampaignView;
        if (!cancelled) {
          setData(next);
          setError("");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not load this campaign.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, campaignId, channel, range]);

  const backHref = channel ? marketingTabHref(channel, range) : "/admin/marketing";
  const backLabel = channel === "google" ? "Back to Google Ads" : "Back to Meta";

  if (!channel) {
    return (
      <div className="admin-page" data-mkt-report={ADMIN_MKT_REPORT_REV}>
        <header className="admin-page-header">
          <Link className="mkt-back" href="/admin/marketing">
            Back to Marketing
          </Link>
          <h1 className="admin-page-title">Campaign</h1>
          <p className="admin-page-subtitle">Open a campaign from Meta or Google Ads.</p>
        </header>
      </div>
    );
  }

  const facts = data
    ? [data.status, data.typeLabel, data.sites.join(", ")].filter(Boolean)
    : [];

  return (
    <div className="admin-page" data-mkt-report={ADMIN_MKT_REPORT_REV}>
      <header className="admin-page-header">
        <Link className="mkt-back" href={backHref}>
          {backLabel}
        </Link>
        <h1 className="admin-page-title">{data?.name || "Campaign"}</h1>
        {facts.length > 0 ? <p className="mkt-report-facts">{facts.join(" · ")}</p> : null}
      </header>
      <main className="admin-main mkt-page mkt-stack-page">
        {error ? <p className="mkt-note">{error}</p> : null}
        {!data && !error ? <p className="admin-panel-sub">Loading…</p> : null}
        {data?.error ? <p className="mkt-note">{data.error}</p> : null}
        {data && !data.error ? (
          <>
            {data.metrics.length > 0 ? (
              <section className="admin-panel mkt-report-panel">
                <h2 className="admin-panel-title">{ADS_RANGE_LABELS[data.range]}</h2>
                <dl className="mkt-report-metrics">
                  {data.metrics.map((metric) => (
                    <div key={metric.label}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <p className="mkt-note">No delivery in this range.</p>
            )}
            {data.series.length > 1 ? (
              <DayCharts
                series={data.series}
                currency={data.currency}
                rangeLabel={ADS_RANGE_LABELS[data.range]}
              />
            ) : null}
            <section className="admin-panel mkt-report-panel">
              <h2 className="admin-panel-title">{data.linesTitle}</h2>
              {data.lines.length === 0 ? (
                <p className="mkt-empty-inline">
                  {data.channel === "google"
                    ? "No ad groups for this campaign."
                    : "No ads for this campaign."}
                </p>
              ) : (
                <MarketingLines
                  lines={data.lines}
                  currency={data.currency}
                  moneyLabel={data.channel === "google" ? "Cost" : "Spend"}
                  showConversions={data.channel === "google"}
                  showCampaign={false}
                />
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
