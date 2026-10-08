import { NextResponse } from "next/server";
import { isAdsRange } from "@/lib/ads-range";
import { loadMarketingOverview } from "@/lib/admin-marketing";
import { normalizeMetaAccountId } from "@/lib/admin-marketing-window";
import { isAuthContext, requireAdminAccess } from "@/lib/api-auth";

function rangeOf(raw: string | null) {
  return isAdsRange(raw) ? raw : "28";
}

function refreshOf(raw: string | null): "seo" | "meta" | "google" | null {
  if (raw === "seo" || raw === "meta" || raw === "google") return raw;
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const url = new URL(request.url);
  const accountRaw = url.searchParams.get("account");
  const account =
    accountRaw === "all" ? "all" : normalizeMetaAccountId(accountRaw) || null;

  try {
    const overview = await loadMarketingOverview({
      metaRange: rangeOf(url.searchParams.get("ads")),
      metaAccount: account,
      googleRange: rangeOf(url.searchParams.get("gads")),
      refresh: refreshOf(url.searchParams.get("refresh")),
    });
    return NextResponse.json(overview);
  } catch (err) {
    console.error("[admin/marketing]", err);
    return NextResponse.json(
      { error: "Failed to load marketing overview" },
      { status: 500 }
    );
  }
}
