"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowUpRight,
  Clock3,
  Coins,
  Eye,
  MousePointerClick,
  Percent,
  RefreshCw,
  Search,
  ShoppingBag,
  Target,
  Users,
} from "lucide-react";
import {
  ADS_ALL_ACCOUNTS,
  ADS_RANGE_LABELS,
  ADS_RANGES,
  type AdsRange,
} from "@/lib/ads-range";
import type {
  DashboardAds,
  DashboardGoogleAds,
  DashboardSeo,
  MarketingOverview,
  MetaAdsCampaign,
  type MarketingLine,
} from "@/lib/admin-marketing-types";
import {
  formatAdsInt,
  formatAdsMoney,
} from "@/lib/admin-marketing-window";
import "@/app/components/admin/admin-marketing.css";
import { MARKETING_CARDS_REV } from "@/app/components/admin/marketing-cards-rev";
import { GOOGLE_SITES_REV } from "@/app/components/admin/google-sites-rev";
import { fetchJson } from "@/lib/fetch-json";

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "Search",
  PERFORMANCE_MAX: "Performance Max",
  DEMAND_GEN: "Demand Gen",
  DISPLAY: "Display",
  VIDEO: "Video",
  SHOPPING: "Shopping",
  SMART: "Smart",
  LOCAL: "Local",
  DISCOVERY: "Discovery",
  UNKNOWN: "–",
};

function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`mkt-delta${up ? " is-up" : ""}`}>
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function Metric({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="mkt-metric">
      <span className="mkt-metric-label">
        <Icon size={14} />
        {label}
      </span>
      <span className="mkt-metric-value">
        {value}
        {delta === undefined ? null : <DeltaBadge value={delta} />}
      </span>
    </div>
  );
}

function prettyPath(page: string) {
  try {
    return new URL(page).pathname;
  } catch {
    return page;
  }
}

function rangeLine(start: string, end: string, range: AdsRange) {
  if (start && end && range !== "all") return `${start} → ${end}`;
  return ADS_RANGE_LABELS[range].toLowerCase();
}

function SeoCard({ seo }: { seo: DashboardSeo }) {
  const rangeLabel =
    seo.startDate && seo.endDate ? `${seo.startDate} → ${seo.endDate}` : "last 28 days";
  const max = Math.max(1, ...seo.daily.map((day) => day.impressions));
  const total = seo.daily.reduce((sum, day) => sum + day.impressions, 0);

  return (
    <section className="admin-panel mkt-card">
      <div className="mkt-head">
        <div>
          <h2 className="admin-panel-title">SEO performance</h2>
          <p className="admin-panel-sub">Google Search Console · {rangeLabel}</p>
        </div>
        <Link href="/admin/seo?tab=analytics" className="mkt-ghost">
          Full analytics
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mkt-seo-grid">
        <div>
          {!seo.connected ? (
            <div className="mkt-empty">
              <p className="mkt-empty-title">Search Console is not connected</p>
              <p>
                Impressions, clicks, CTR, and average position come from Google
                Search Console. Connect the service account and property, then
                this card fills in on its own.
              </p>
              <Link href="/admin/seo?tab=connections" className="btn-primary mkt-connect">
                Connect Search Console
              </Link>
            </div>
          ) : seo.error ? (
            <div className="mkt-note">{seo.error}</div>
          ) : seo.totals ? (
            <>
              <div className="mkt-metrics">
                <Metric
                  label="Impressions"
                  value={seo.totals.impressions.toLocaleString("en-US")}
                  delta={seo.delta.impressions}
                  icon={Eye}
                />
                <Metric
                  label="Clicks"
                  value={seo.totals.clicks.toLocaleString("en-US")}
                  delta={seo.delta.clicks}
                  icon={MousePointerClick}
                />
                <Metric
                  label="CTR"
                  value={`${(seo.totals.ctr * 100).toFixed(2)}%`}
                  icon={Percent}
                />
                <Metric
                  label="Avg position"
                  value={seo.totals.position.toFixed(1)}
                  icon={Target}
                />
              </div>
              <div className="mkt-bars" aria-hidden>
                {seo.daily.length === 0 ? (
                  <p className="admin-panel-sub">No daily rows for this window.</p>
                ) : (
                  seo.daily.map((day) => (
                    <span
                      key={day.date}
                      title={`${day.date}: ${day.impressions} impressions, ${day.clicks} clicks`}
                      style={{
                        height: `${Math.max(8, (day.impressions / max) * 100)}%`,
                        opacity: 0.45 + (day.impressions / max) * 0.55,
                      }}
                    />
                  ))
                )}
              </div>
              {seo.daily.length > 0 ? (
                <p className="mkt-bars-caption">
                  {total.toLocaleString("en-US")} impressions over {seo.daily.length} days
                </p>
              ) : null}
              {seo.topPages.length > 0 ? (
                <ul className="mkt-pages">
                  {seo.topPages.slice(0, 3).map((row) => (
                    <li key={row.page}>
                      <span>{prettyPath(row.page)}</span>
                      <span>
                        {row.impressions.toLocaleString("en-US")} impr · {row.clicks} clicks
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="mkt-side">
          <p className="mkt-kicker">Also from tracking</p>
          <ul>
            <li>
              <span>Tracking IDs configured</span>
              <strong>
                {seo.tracking.ids}/{seo.tracking.total}
              </strong>
            </li>
            <li>
              <span>URLs indexed</span>
              <strong>–</strong>
            </li>
            <li>
              <span>Indexing errors</span>
              <strong>–</strong>
            </li>
          </ul>
          <Link href="/admin/seo?tab=indexing" className="mkt-inline">
            <Clock3 size={14} />
            Open indexing report
          </Link>
        </aside>
      </div>
    </section>
  );
}

function LinesTable({
  title,
  lines,
  currency,
  moneyLabel,
  showConversions,
}: {
  title: string;
  lines: MarketingLine[];
  currency: string | null;
  moneyLabel: string;
  showConversions: boolean;
}) {
  return (
    <div>
      <p className="mkt-lines-title">{title}</p>
      {lines.length === 0 ? (
        <p className="mkt-empty mkt-empty-inline">Nothing here yet.</p>
      ) : (
        <div className="mkt-table-wrap">
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Campaign</th>
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
                  <td>{line.campaignName || "–"}</td>
                  <td>{line.kind}</td>
                  <td>
                    <span
                      className={`mkt-status${
                        line.status === "ENABLED" || line.status === "ACTIVE" ? " is-on" : ""
                      }`}
                    >
                      {line.status.replace(/_/g, " ")}
                    </span>
                  </td>
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
      )}
    </div>
  );
}

function MetaCard({
  ads,
  onRange,
  onAccount,
  onRefresh,
  refreshing,
  detail,
}: {
  ads: DashboardAds;
  onRange: (range: AdsRange) => void;
  onAccount: (account: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  detail: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "paused" | "delivered">(
    "all"
  );
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ads.campaigns.filter((campaign) => {
      if (statusFilter === "running" && campaign.status !== "ACTIVE") return false;
      if (statusFilter === "paused" && !campaign.status.includes("PAUSED")) return false;
      if (statusFilter === "delivered" && campaign.noDelivery) return false;
      if (!needle) return true;
      return (
        campaign.name.toLowerCase().includes(needle) ||
        campaign.accountName.toLowerCase().includes(needle)
      );
    });
  }, [ads.campaigns, query, statusFilter]);

  const line = rangeLine(ads.startDate, ads.endDate, ads.range);

  return (
    <section className="admin-panel mkt-card">
      <div className="mkt-head">
        <div>
          <h2 className="admin-panel-title">Meta Ads</h2>
          <p className="admin-panel-sub">
            {ads.configured
              ? `${ads.scope === "all" ? "All accounts" : ads.accountName || "–"} · ${line}${
                  ads.currency ? ` · ${ads.currency}` : ""
                }`
              : "Not connected"}
          </p>
        </div>
        <div className="mkt-head-actions">
          {ads.configured ? (
            <button type="button" className="mkt-ghost" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? "mkt-spin" : undefined} />
              Refresh
            </button>
          ) : null}
          <a
            href="https://adsmanager.facebook.com"
            target="_blank"
            rel="noreferrer"
            className="mkt-ghost"
          >
            Ads Manager
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      {!ads.configured ? (
        <div className="mkt-empty">
          <p className="mkt-empty-title">Meta Ads is not connected</p>
          <p>Spend and campaigns show up here once the account is saved.</p>
          <Link href="/admin/seo?tab=connections" className="btn-primary mkt-connect">
            Connect on SEO
          </Link>
        </div>
      ) : ads.error ? (
        <div className="mkt-note">{ads.error}</div>
      ) : ads.totals ? (
        <>
          {ads.notice ? <p className="admin-panel-sub">{ads.notice}</p> : null}
          <div className="mkt-toolbar">
            <select
              className="mkt-select"
              aria-label="Ad account"
              value={ads.accountId ?? ""}
              onChange={(event) => onAccount(event.target.value)}
            >
              {ads.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
              <option value={ADS_ALL_ACCOUNTS}>All accounts</option>
            </select>
            <div className="mkt-pills">
              {ADS_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={ads.range === range ? "is-on" : undefined}
                  onClick={() => onRange(range)}
                >
                  {ADS_RANGE_LABELS[range]}
                </button>
              ))}
            </div>
          </div>

          <div className="mkt-metrics">
            <Metric
              label="Spend"
              value={formatAdsMoney(ads.totals.spend, ads.currency)}
              delta={ads.delta.spend}
              icon={Coins}
            />
            <Metric
              label="Impressions"
              value={formatAdsInt(ads.totals.impressions)}
              delta={ads.delta.impressions}
              icon={Eye}
            />
            <Metric label="Reach" value={formatAdsInt(ads.totals.reach)} icon={Users} />
            <Metric
              label="Clicks"
              value={formatAdsInt(ads.totals.clicks)}
              delta={ads.delta.clicks}
              icon={MousePointerClick}
            />
            <Metric label="CTR" value={`${ads.totals.ctr.toFixed(2)}%`} icon={Percent} />
            <Metric
              label="CPC"
              value={formatAdsMoney(ads.totals.cpc, ads.currency)}
              icon={Target}
            />
            <Metric
              label="CPM"
              value={formatAdsMoney(ads.totals.cpm, ads.currency)}
              icon={Eye}
            />
          </div>

          <CampaignFilters
            query={query}
            onQuery={setQuery}
            statusFilter={statusFilter}
            onStatus={setStatusFilter}
            options={[
              ["all", "All"],
              ["running", "Running"],
              ["paused", "Paused"],
              ["delivered", "Delivered"],
            ]}
            shown={visible.length}
            total={ads.campaigns.length}
          />

          <CampaignTable
            empty="No campaigns in this account yet."
            filteredEmpty="No campaign matches this filter."
            rows={ads.campaigns.length}
            visible={visible.length}
          >
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Runs as</th>
                  <th className="num">Spend</th>
                  <th className="num">Impr.</th>
                  <th className="num">Reach</th>
                  <th className="num">Clicks</th>
                  <th className="num">CTR</th>
                  <th className="num">CPC</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((campaign) => (
                  <MetaRow key={campaign.id} campaign={campaign} currency={ads.currency} />
                ))}
              </tbody>
            </table>
          </CampaignTable>
          {detail ? (
            <LinesTable
              title="Ads"
              lines={ads.lines.filter((line) => {
                const needle = query.trim().toLowerCase();
                if (!needle) return true;
                return (
                  line.name.toLowerCase().includes(needle) ||
                  line.campaignName.toLowerCase().includes(needle) ||
                  line.sites.some((site) => site.includes(needle))
                );
              })}
              currency={ads.currency}
              moneyLabel="Spend"
              showConversions={false}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function MetaRow({
  campaign,
  currency,
}: {
  campaign: MetaAdsCampaign;
  currency: string | null;
}) {
  const act = campaign.accountId.replace(/^act_/, "");
  const href = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${campaign.id}`;
  return (
    <tr>
      <td>
        <a href={href} target="_blank" rel="noreferrer">
          {campaign.name}
        </a>
        <span className="mkt-sub">
          {campaign.accountName}
          {campaign.objective
            ? ` · ${campaign.objective.replace(/^OUTCOME_/, "").toLowerCase()}`
            : ""}
        </span>
      </td>
      <td>
        <span className={`mkt-status${campaign.status === "ACTIVE" ? " is-on" : ""}`}>
          {campaign.status.replace(/_/g, " ")}
        </span>
      </td>
      <td>
        {campaign.pages.length > 0 ? (
          <span className="mkt-runs">
            {campaign.pages.join(", ")}
            {campaign.hasInstagram ? <span className="mkt-ig">IG</span> : null}
          </span>
        ) : (
          "–"
        )}
      </td>
      <td className="num">
        {campaign.noDelivery ? "–" : formatAdsMoney(campaign.spend, currency)}
      </td>
      <td className="num">{campaign.noDelivery ? "–" : formatAdsInt(campaign.impressions)}</td>
      <td className="num">{campaign.noDelivery ? "–" : formatAdsInt(campaign.reach)}</td>
      <td className="num">{campaign.noDelivery ? "–" : formatAdsInt(campaign.clicks)}</td>
      <td className="num">{campaign.noDelivery ? "–" : `${campaign.ctr.toFixed(2)}%`}</td>
      <td className="num">
        {campaign.noDelivery ? "–" : formatAdsMoney(campaign.cpc, currency)}
      </td>
    </tr>
  );
}

function GoogleCard({
  ads,
  onRange,
  onRefresh,
  refreshing,
  detail,
}: {
  ads: DashboardGoogleAds;
  onRange: (range: AdsRange) => void;
  onRefresh: () => void;
  refreshing: boolean;
  detail: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "paused" | "delivered">(
    "all"
  );
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ads.campaigns.filter((campaign) => {
      if (statusFilter === "enabled" && campaign.status !== "ENABLED") return false;
      if (statusFilter === "paused" && campaign.status !== "PAUSED") return false;
      if (statusFilter === "delivered" && campaign.noDelivery) return false;
      if (!needle) return true;
      const channel = CHANNEL_LABELS[campaign.channelType] ?? campaign.channelType;
      return (
        campaign.name.toLowerCase().includes(needle) ||
        channel.toLowerCase().includes(needle) ||
        campaign.sites.some((site) => site.includes(needle))
      );
    });
  }, [ads.campaigns, query, statusFilter]);
  const enabled = ads.campaigns.filter((c) => c.status === "ENABLED").length;
  const line = rangeLine(ads.startDate, ads.endDate, ads.range);

  return (
    <section className="admin-panel mkt-card">
      <div className="mkt-head">
        <div>
          <h2 className="admin-panel-title">Google Ads</h2>
          <p className="admin-panel-sub">
            {ads.connected
              ? `${ads.customerName || "–"} · ${line}${ads.currency ? ` · ${ads.currency}` : ""}`
              : "Not connected"}
          </p>
        </div>
        <div className="mkt-head-actions">
          {ads.connected ? (
            <button type="button" className="mkt-ghost" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? "mkt-spin" : undefined} />
              Refresh
            </button>
          ) : null}
          <a href="https://ads.google.com" target="_blank" rel="noreferrer" className="mkt-ghost">
            Google Ads
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      {!ads.connected ? (
        <div className="mkt-empty">
          <p className="mkt-empty-title">Google Ads is not connected</p>
          <p>
            Add the customer ID, developer token, and OAuth refresh token on the
            Google Ads card.
          </p>
          <Link href="/admin/seo?tab=connections" className="btn-primary mkt-connect">
            Connect Google Ads
          </Link>
        </div>
      ) : ads.error ? (
        <div className="mkt-note">{ads.error}</div>
      ) : ads.totals ? (
        <>
          <div className="mkt-toolbar">
            <div className="mkt-pills">
              {ADS_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={ads.range === range ? "is-on" : undefined}
                  onClick={() => onRange(range)}
                >
                  {ADS_RANGE_LABELS[range]}
                </button>
              ))}
            </div>
            <span className="mkt-count">
              {enabled} enabled of {ads.campaigns.length} campaign
              {ads.campaigns.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mkt-metrics">
            <Metric
              label="Cost"
              value={formatAdsMoney(ads.totals.cost, ads.currency)}
              delta={ads.delta.cost}
              icon={Coins}
            />
            <Metric
              label="Impressions"
              value={formatAdsInt(ads.totals.impressions)}
              delta={ads.delta.impressions}
              icon={Eye}
            />
            <Metric
              label="Clicks"
              value={formatAdsInt(ads.totals.clicks)}
              delta={ads.delta.clicks}
              icon={MousePointerClick}
            />
            <Metric label="CTR" value={`${ads.totals.ctr.toFixed(2)}%`} icon={Percent} />
            <Metric
              label="Avg. CPC"
              value={formatAdsMoney(ads.totals.averageCpc, ads.currency)}
              icon={Target}
            />
            <Metric
              label="Conversions"
              value={ads.totals.conversions.toFixed(1)}
              icon={ShoppingBag}
            />
            <Metric
              label="Conv. value"
              value={formatAdsMoney(ads.totals.conversionsValue, ads.currency)}
              icon={Coins}
            />
          </div>

          <CampaignFilters
            query={query}
            onQuery={setQuery}
            placeholder="Search campaigns or sites"
            statusFilter={statusFilter}
            onStatus={setStatusFilter}
            options={[
              ["all", "All"],
              ["enabled", "Enabled"],
              ["paused", "Paused"],
              ["delivered", "Delivered"],
            ]}
            shown={visible.length}
            total={ads.campaigns.length}
          />

          <CampaignTable
            empty="This account has no campaigns yet."
            filteredEmpty="No campaign matches this filter."
            rows={ads.campaigns.length}
            visible={visible.length}
          >
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th className="num">Cost</th>
                  <th className="num">Impr.</th>
                  <th className="num">Clicks</th>
                  <th className="num">CTR</th>
                  <th className="num">Avg. CPC</th>
                  <th className="num">Conv.</th>
                  {detail ? <th className="num">Conv. value</th> : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <a
                        href={`https://ads.google.com/aw/campaigns?campaignId=${campaign.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {campaign.name}
                      </a>
                      {campaign.sites.length ? (
                        <span className="mkt-sub">{campaign.sites.join(", ")}</span>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`mkt-status${campaign.status === "ENABLED" ? " is-on" : ""}`}
                      >
                        {campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td>{CHANNEL_LABELS[campaign.channelType] ?? campaign.channelType}</td>
                    <td className="num">
                      {campaign.noDelivery
                        ? "–"
                        : formatAdsMoney(campaign.cost, ads.currency)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsInt(campaign.impressions)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : formatAdsInt(campaign.clicks)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : `${campaign.ctr.toFixed(2)}%`}
                    </td>
                    <td className="num">
                      {campaign.noDelivery
                        ? "–"
                        : formatAdsMoney(campaign.averageCpc, ads.currency)}
                    </td>
                    <td className="num">
                      {campaign.noDelivery ? "–" : campaign.conversions.toFixed(1)}
                    </td>
                    {detail ? (
                      <td className="num">
                        {campaign.noDelivery
                          ? "–"
                          : formatAdsMoney(campaign.conversionsValue, ads.currency)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </CampaignTable>
          {detail ? (
            <LinesTable
              title="Ad groups"
              lines={ads.lines.filter((line) => {
                const needle = query.trim().toLowerCase();
                if (!needle) return true;
                return (
                  line.name.toLowerCase().includes(needle) ||
                  line.campaignName.toLowerCase().includes(needle) ||
                  line.kind.toLowerCase().includes(needle) ||
                  line.sites.some((site) => site.includes(needle))
                );
              })}
              currency={ads.currency}
              moneyLabel="Cost"
              showConversions
            />
          ) : null}
          <p className="mkt-foot">
            Google Ads reports stop at yesterday, in the account time zone. Cost
            arrives in micros and is converted here.
          </p>
        </>
      ) : null}
    </section>
  );
}

function CampaignFilters<T extends string>({
  query,
  onQuery,
  placeholder = "Search campaigns or accounts",
  statusFilter,
  onStatus,
  options,
  shown,
  total,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
  statusFilter: T;
  onStatus: (value: T) => void;
  options: Array<[T, string]>;
  shown: number;
  total: number;
}) {
  return (
    <div className="mkt-toolbar">
      <label className="mkt-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      <div className="mkt-filters">
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={statusFilter === value ? "is-on" : undefined}
            onClick={() => onStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown !== total ? (
        <span className="mkt-count">
          {shown} of {total}
        </span>
      ) : null}
    </div>
  );
}

function CampaignTable({
  rows,
  visible,
  empty,
  filteredEmpty,
  children,
}: {
  rows: number;
  visible: number;
  empty: string;
  filteredEmpty: string;
  children: ReactNode;
}) {
  if (rows === 0) return <p className="mkt-empty mkt-empty-inline">{empty}</p>;
  if (visible === 0) return <p className="mkt-empty mkt-empty-inline">{filteredEmpty}</p>;
  return <div className="mkt-table-wrap">{children}</div>;
}

export function MarketingOverview({ detail = false }: { detail?: boolean }) {
  const [data, setData] = useState<MarketingOverview | null>(null);
  const [error, setError] = useState("");
  const [metaRange, setMetaRange] = useState<AdsRange>("28");
  const [metaAccount, setMetaAccount] = useState("");
  const [googleRange, setGoogleRange] = useState<AdsRange>("28");
  const [refreshing, setRefreshing] = useState<"meta" | "google" | null>(null);

  const load = useCallback(
    async (refresh?: "meta" | "google") => {
      const params = new URLSearchParams();
      if (metaRange !== "28") params.set("ads", metaRange);
      if (metaAccount) params.set("account", metaAccount);
      if (googleRange !== "28") params.set("gads", googleRange);
      if (detail) params.set("detail", "1");
      if (refresh) params.set("refresh", refresh);
      const next = (await fetchJson(
        `/api/admin/marketing?${params.toString()}`
      )) as MarketingOverview;
      setData(next);
      setError("");
    },
    [detail, googleRange, metaAccount, metaRange]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not load marketing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function refresh(which: "meta" | "google") {
    setRefreshing(which);
    try {
      await load(which);
    } catch (err) {
      console.error(err);
      setError("Could not refresh.");
    } finally {
      setRefreshing(null);
    }
  }

  if (error && !data) {
    return <p className="mkt-note">{error}</p>;
  }
  if (!data) {
    return (
      <section className="admin-panel mkt-card">
        <p className="admin-panel-sub">Loading marketing…</p>
      </section>
    );
  }

  return (
    <div className="mkt-stack" id="marketing" data-rev={MARKETING_CARDS_REV} data-sites={GOOGLE_SITES_REV}>
      {detail ? null : <SeoCard seo={data.seo} />}
      <MetaCard
        ads={data.meta}
        onRange={setMetaRange}
        onAccount={setMetaAccount}
        onRefresh={() => void refresh("meta")}
        refreshing={refreshing === "meta"}
        detail={detail}
      />
      <GoogleCard
        ads={data.google}
        onRange={setGoogleRange}
        onRefresh={() => void refresh("google")}
        refreshing={refreshing === "google"}
        detail={detail}
      />
    </div>
  );
}
