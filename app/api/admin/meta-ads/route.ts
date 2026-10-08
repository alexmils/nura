import { NextResponse } from "next/server";
import { isAuthContext, requireAdminAccess, requirePlatformSettingsAccess } from "@/lib/api-auth";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import { ensureFreshMetaAdsToken, metaAdsEnv } from "@/lib/meta-ads-refresh";
import {
  mergeMetaAdsPatch,
  toMetaAdsAdminView,
  validateMetaAdsPatch,
  type MetaAdsPatch,
} from "@/lib/meta-ads-settings";
import { getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const settings = await getPlatformSettings();
    const fresh = await ensureFreshMetaAdsToken(settings.metaAds).catch(() => null);
    const stored = fresh
      ? (await getPlatformSettings()).metaAds
      : settings.metaAds;
    return NextResponse.json({
      metaAds: toMetaAdsAdminView(
        stored,
        metaAdsEnv(),
        auth.user.role === "platform_admin"
      ),
    });
  } catch (err) {
    console.error("[admin/meta-ads GET]", err);
    return NextResponse.json({ error: "Failed to load Meta Ads" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const body = (await request.json()) as MetaAdsPatch;
    const errors = validateMetaAdsPatch(body);
    if (errors.length) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }
    const current = await getPlatformSettings();
    const nextAds = mergeMetaAdsPatch(current.metaAds, body);
    await savePlatformSettings({ ...current, metaAds: nextAds });
    await ensureFreshMetaAdsToken(nextAds).catch((err) => {
      console.error("[admin/meta-ads] expiry check failed", err);
    });
    const saved = await getPlatformSettings();

    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "settings.meta_ads_updated",
      detail: { accountId: saved.metaAds.accountId || null },
      ip: clientIp(request),
    });

    return NextResponse.json({
      metaAds: toMetaAdsAdminView(saved.metaAds, metaAdsEnv(), true),
    });
  } catch (err) {
    console.error("[admin/meta-ads PUT]", err);
    return NextResponse.json({ error: "Failed to save Meta Ads" }, { status: 500 });
  }
}
