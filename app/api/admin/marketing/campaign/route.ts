import { NextResponse } from "next/server";
import { isAdsRange } from "@/lib/ads-range";
import { loadMarketingCampaign } from "@/lib/admin-marketing";
import { normalizeMetaAccountId } from "@/lib/admin-marketing-window";
import { isAuthContext, requireAdminAccess } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const url = new URL(request.url);
  const channel = url.searchParams.get("channel");
  const id = url.searchParams.get("id") || "";
  const rangeRaw = url.searchParams.get("range");
  const range = isAdsRange(rangeRaw) ? rangeRaw : "28";
  const accountRaw = url.searchParams.get("account");
  const account =
    accountRaw === "all" ? "all" : normalizeMetaAccountId(accountRaw) || null;

  if (channel !== "google" && channel !== "meta") {
    return NextResponse.json({ error: "Choose Meta or Google Ads." }, { status: 400 });
  }

  try {
    const report = await loadMarketingCampaign({
      channel,
      campaignId: id,
      range,
      metaAccount: channel === "meta" ? account : null,
    });
    return NextResponse.json(report);
  } catch (err) {
    console.error("[admin/marketing/campaign]", err);
    return NextResponse.json(
      { error: "Failed to load this campaign" },
      { status: 500 }
    );
  }
}
