"use client";

import { Suspense } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { MarketingChannel } from "@/app/components/admin/MarketingDetail";

const TABS = ["meta", "google"] as const;

function MarketingPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "meta");
  return (
    <>
      <AdminPageHeader
        title="Marketing"
        subtitle="Daily spend and clicks, then each campaign and the site it points at."
      />
      <AdminTabs
        tabs={[
          { id: "meta", label: "Meta" },
          { id: "google", label: "Google Ads" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as (typeof TABS)[number])}
      />
      <MarketingChannel key={tab} channel={tab} />
    </>
  );
}

export default function AdminMarketingPage() {
  return (
    <Suspense fallback={<p className="admin-panel-sub">Loading…</p>}>
      <MarketingPageInner />
    </Suspense>
  );
}
