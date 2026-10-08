"use client";

import { Suspense, use } from "react";
import { MarketingCampaignReport } from "@/app/components/admin/MarketingCampaignReport";

export default function AdminMarketingCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<p className="admin-panel-sub">Loading…</p>}>
      <MarketingCampaignReport campaignId={id} />
    </Suspense>
  );
}
