"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { MarketingChannel } from "@/app/components/admin/MarketingDetail";
import { ADS_REPORT_AGE_REV } from "@/app/components/admin/ads-report-age";
import { ADMIN_MKT_REPORT_REV } from "@/app/components/admin-mkt-report-rev";
import { isAdsRange, type AdsRange } from "@/lib/ads-range";

const TABS = ["meta", "google"] as const;

function MarketingPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "meta");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rangeRaw = searchParams.get("range");
  const range: AdsRange = isAdsRange(rangeRaw) ? rangeRaw : "28";

  const setRange = useCallback(
    (next: AdsRange) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "28") params.delete("range");
      else params.set("range", next);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="admin-page" data-mkt-report={ADMIN_MKT_REPORT_REV} data-age={ADS_REPORT_AGE_REV}>
      <AdminPageHeader
        title="Marketing"
        subtitle="Daily spend and clicks, then each campaign and the site it points at."
      />
      <main className="admin-main mkt-page">
        <AdminTabs
          tabs={[
            { id: "meta", label: "Meta" },
            { id: "google", label: "Google Ads" },
          ]}
          value={tab}
          onChange={(id) => setTab(id as (typeof TABS)[number])}
        />
        <MarketingChannel key={tab} channel={tab} range={range} onRange={setRange} />
      </main>
    </div>
  );
}

export default function AdminMarketingPage() {
  return (
    <Suspense fallback={<p className="admin-panel-sub">Loading…</p>}>
      <MarketingPageInner />
    </Suspense>
  );
}
