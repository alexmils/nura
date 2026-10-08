"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ADS_REPORT_AGE_REV, formatAdsUpdatedAgo } from "@/app/components/admin/ads-report-age";
import {
  AdminLineChart,
  type LineChartPoint,
} from "@/app/components/admin/AdminCharts";
import {
  ADS_ALL_ACCOUNTS,
  ADS_RANGE_LABELS,
  ADS_RANGES,
  type AdsRange,
} from "@/lib/ads-range";
import { marketingCampaignHref } from "@/lib/admin-marketing-campaign";
import type {
  DashboardAds,
  DashboardGoogleAds,
  MarketingDay,
  MarketingLine,
  MarketingOverview,
} from "@/lib/admin-marketing-types";
import { formatAdsInt, formatAdsMoney } from "@/lib/admin-marketing-window";
import { fetchJson } from "@/lib/fetch-json";

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "Search",
  DISPLAY: "Display",
  PERFORMANCE_MAX: "Performance Max",
  VIDEO: "Video",
  SHOPPING: "Shopping",
  DEMAND_GEN: "Demand Gen",
};

function chartPoints(
  series: MarketingDay[],
  pick: (day: MarketingDay) => number
): LineChartPoint[] {
  const step = series.length > 12 ? Math.ceil(series.length / 6) : 1;
  return series.map((day, index) => ({
    value: pick(day),
    label:
      index % step === 0 || index === series.length - 1 ? day.date.slice(5) : "",
  }));
}

export function DayCharts({
  series,
  currency,
  rangeLabel,
}: {
  series: MarketingDay[];
  currency: string | null;
  rangeLabel: string;
}) {
  const spend = chartPoints(series, (day) => day.spend);
  const clicks = chartPoints(series, (day) => day.clicks);
  const totalSpend = series.reduce((sum, day) => sum + day.spend, 0);
  const totalClicks = series.reduce((sum, day) => sum + day.clicks, 0);
  return (
    <div className="mkt-chart-grid">
      <section className="admin-panel mkt-chart">
        <h2 className="admin-panel-title">Spend</h2>
        <p className="mkt-chart-value">{formatAdsMoney(totalSpend, currency)}</p>
        <p className="admin-panel-sub">{rangeLabel}</p>
        {series.length > 1 ? (
          <AdminLineChart
            points={spend}
            height={128}
            ariaLabel="Spend by day"
            markers={series.length <= 16}
          />
        ) : (
          <p className="mkt-empty-inline">No daily spend in this range.</p>
        )}
      </section>
      <section className="admin-panel mkt-chart">
        <h2 className="admin-panel-title">Clicks</h2>
        <p className="mkt-chart-value">{formatAdsInt(totalClicks)}</p>
        <p className="admin-panel-sub">{rangeLabel}</p>
        {series.length > 1 ? (
          <AdminLineChart
            points={clicks}
            height={128}
            ariaLabel="Clicks by day"
            markers={series.length <= 16}
          />
        ) : (
          <p className="mkt-empty-inline">No daily clicks in this range.</p>
        )}
      </section>
    </div>
  );
}

function SpendMix({
  rows,
  currency,
}: {
  rows: { id: string; name: string; site: string; amount: number }[];
  currency: string | null;
}) {
  const top = rows.filter((row) => row.amount > 0).slice(0, 6);
  const max = Math.max(1, ...top.map((row) => row.amount));
  if (top.length === 0) return null;
  return (
    <section className="admin-panel mkt-chart">
      <h2 className="admin-panel-title">Where the spend went</h2>
      <ul className="mkt-mix">
        {top.map((row) => (
          <li key={row.id}>
            <span className="mkt-mix-name">
              {row.name}
              {row.site ? <span className="mkt-sub">{row.site}</span> : null}
            </span>
            <span className="mkt-mix-track" aria-hidden="true">
              <span style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }} />
            </span>
            <span className="mkt-mix-amt">{formatAdsMoney(row.amount, currency)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MarketingLines({
  lines,
  currency,
  moneyLabel,
  showConversions,
  showCampaign = true,
}: {
  lines: MarketingLine[];
  currency: string | null;
  moneyLabel: string;
  showConversions: boolean;
  showCampaign?: boolean;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="mkt-table-wrap">
      <table className="mkt-table">
        <thead>
          <tr>
            <th>Name</th>
            {showCampaign ? <th>Campaign</th> : null}
            <th>Kind</th>
            <th>Status</th>
            <th className="num">{moneyLabel}</th>
            <th className="num">Impr.</th>
            <th className="num">Clicks</th>
            <th className="num">CTR</th>
            {showConversions ? <th className="num">Conv.</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`${line.kind}-${line.id}`}>
              <td>
                {line.name}
                {line.sites.length ? (
                  <span className="mkt-sub">{line.sites.join(", ")}</span>
                ) : null}
              </td>
              {showCampaign ? <td>{line.campaignName || "–"}</td> : null}
              <td>{line.kind}</td>
              <td>{line.status.replace(/_/g, " ")}</td>
              <td className="num">{formatAdsMoney(line.spend, currency)}</td>
              <td className="num">{formatAdsInt(line.impressions)}</td>
              <td className="num">{formatAdsInt(line.clicks)}</td>
              <td className="num">{`${line.ctr.toFixed(2)}%`}</td>
              {showConversions ? (
                <td className="num">{line.conversions.toFixed(1)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketingChannel({
  channel,
  range,
  onRange,
}: {
  channel: "meta" | "google";
  range: AdsRange;
  onRange: (range: AdsRange) => void;
}) {
  const [account, setAccount] = useState("");
  const [data, setData] = useState<MarketingOverview | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    const params = new URLSearchParams();
    params.set("detail", "1");
    if (range !== "28") {
      params.set(channel === "meta" ? "ads" : "gads", range);
    }
    if (channel === "meta" && account) params.set("account", account);
    if (refresh) params.set("refresh", channel);
    const next = (await fetchJson(
      `/api/admin/marketing?${params.toString()}`
    )) as MarketingOverview;
    setData(next);
    setError("");
  }, [account, channel, range]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not load this tab.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const meta = data?.meta;
  const google = data?.google;
  const series = channel === "meta" ? meta?.series ?? [] : google?.series ?? [];
  const currency = channel === "meta" ? meta?.currency ?? null : google?.currency ?? null;
  const cachedAt = channel === "meta" ? meta?.cachedAt : google?.cachedAt;
  const canRefresh = channel === "meta" ? Boolean(meta?.configured) : Boolean(google?.connected);

  async function refreshReport() {
    setRefreshing(true);
    try {
      await load(true);
    } catch (err) {
      console.error(err);
      setError("Could not refresh.");
    } finally {
      setRefreshing(false);
    }
  }
  const metaAccount =
    channel === "meta"
      ? account || (meta?.scope === "all" ? ADS_ALL_ACCOUNTS : meta?.accountId || "")
      : "";

  const mix = useMemo(() => {
    if (channel === "meta") {
      return (meta?.campaigns ?? []).map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        site: campaign.pages[0] || campaign.accountName,
        amount: campaign.spend,
      }));
    }
    return (google?.campaigns ?? []).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      site: campaign.sites[0] || "",
      amount: campaign.cost,
    }));
  }, [channel, google?.campaigns, meta?.campaigns]);

  return (
    <div className="mkt-detail mkt-stack-page" data-age={ADS_REPORT_AGE_REV}>
      <div className="mkt-toolbar">
        {channel === "meta" && meta && meta.accounts.length > 0 ? (
          <select
            className="mkt-account"
            aria-label="Ad account"
            value={meta.scope === "all" ? ADS_ALL_ACCOUNTS : meta.accountId || ""}
            onChange={(event) => setAccount(event.target.value)}
          >
            {meta.accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value={ADS_ALL_ACCOUNTS}>All accounts</option>
          </select>
        ) : null}
        <div className="mkt-pills">
          {ADS_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={range === item ? "is-on" : undefined}
              onClick={() => onRange(item)}
            >
              {ADS_RANGE_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="mkt-toolbar-end">
          {cachedAt ? <span className="mkt-age">{formatAdsUpdatedAgo(cachedAt)}</span> : null}
          {canRefresh ? (
            <button
              type="button"
              className="mkt-ghost"
              onClick={() => void refreshReport()}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "mkt-spin" : undefined} />
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mkt-note">{error}</p> : null}
      {!data && !error ? <p className="admin-panel-sub">Loading…</p> : null}

      {channel === "meta" && meta?.error ? <p className="mkt-note">{meta.error}</p> : null}
      {channel === "google" && google?.error ? <p className="mkt-note">{google.error}</p> : null}

      {data ? (
        <>
          <DayCharts
            series={series}
            currency={currency}
            rangeLabel={ADS_RANGE_LABELS[range]}
          />
          <SpendMix rows={mix} currency={currency} />
          {channel === "meta" && meta ? (
            <MetaTables ads={meta} range={range} account={metaAccount} />
          ) : null}
          {channel === "google" && google ? (
            <GoogleTables ads={google} range={range} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MetaTables({
  ads,
  range,
  account,
}: {
  ads: DashboardAds;
  range: AdsRange;
  account: string;
}) {
  return (
    <>
      <section className="admin-panel mkt-report-panel">
        <h2 className="admin-panel-title">Campaigns</h2>
        <p className="admin-panel-sub">{ads.accountName || "Meta Ads"}</p>
        {ads.campaigns.length === 0 ? (
          <p className="mkt-empty-inline">No campaigns in this account.</p>
        ) : (
          <div className="mkt-table-wrap">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th className="num">Spend</th>
                  <th className="num">Impr.</th>
                  <th className="num">Reach</th>
                  <th className="num">Clicks</th>
                  <th className="num">CTR</th>
                  <th className="num">CPC</th>
                </tr>
              </thead>
              <tbody>
                {ads.campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link
                        className="mkt-campaign-link"
                        href={marketingCampaignHref({
                          id: campaign.id,
                          channel: "meta",
                          range,
                          account,
                        })}
                      >
                        {campaign.name}
                      </Link>
                      <span className="mkt-sub">
                        {campaign.accountName}
                        {campaign.objective
                          ? ` · ${campaign.objective.replace(/^OUTCOME_/, "").toLowerCase()}`
                          : ""}
                      </span>
                    </td>
                    <td>{campaign.status.replace(/_/g, " ")}</td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsMoney(campaign.spend, ads.currency)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsInt(campaign.impressions)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsInt(campaign.reach)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsInt(campaign.clicks)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : `${campaign.ctr.toFixed(2)}%`}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsMoney(campaign.cpc, ads.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="admin-panel mkt-report-panel">
        <h2 className="admin-panel-title">Ads</h2>
        {ads.lines.length === 0 ? (
          <p className="mkt-empty-inline">No ads in this account.</p>
        ) : (
          <MarketingLines
            lines={ads.lines}
            currency={ads.currency}
            moneyLabel="Spend"
            showConversions={false}
          />
        )}
      </section>
    </>
  );
}

function GoogleTables({ ads, range }: { ads: DashboardGoogleAds; range: AdsRange }) {
  return (
    <>
      <section className="admin-panel mkt-report-panel">
        <h2 className="admin-panel-title">Campaigns</h2>
        <p className="admin-panel-sub">{ads.customerName || "Google Ads"}</p>
        {ads.campaigns.length === 0 ? (
          <p className="mkt-empty-inline">No campaigns in this account.</p>
        ) : (
          <div className="mkt-table-wrap">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th className="num">Cost</th>
                  <th className="num">Clicks</th>
                  <th className="num">CTR</th>
                  <th className="num">Conv.</th>
                  <th className="num">Conv. value</th>
                </tr>
              </thead>
              <tbody>
                {ads.campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link
                        className="mkt-campaign-link"
                        href={marketingCampaignHref({
                          id: campaign.id,
                          channel: "google",
                          range,
                        })}
                      >
                        {campaign.name}
                      </Link>
                      {campaign.sites.length ? (
                        <span className="mkt-sub">{campaign.sites.join(", ")}</span>
                      ) : null}
                    </td>
                    <td>{campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}</td>
                    <td>{CHANNEL_LABELS[campaign.channelType] ?? campaign.channelType}</td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsMoney(campaign.cost, ads.currency)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsInt(campaign.clicks)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : `${campaign.ctr.toFixed(2)}%`}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : campaign.conversions.toFixed(1)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery
                        ? "–"
                        : formatAdsMoney(campaign.conversionsValue, ads.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="admin-panel mkt-report-panel">
        <h2 className="admin-panel-title">Ad groups</h2>
        {ads.lines.length === 0 ? (
          <p className="mkt-empty-inline">No ad groups in this account.</p>
        ) : (
          <MarketingLines
            lines={ads.lines}
            currency={ads.currency}
            moneyLabel="Cost"
            showConversions
          />
        )}
      </section>
    </>
  );
}
