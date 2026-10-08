import { NextResponse } from "next/server";
import {
  requireAdminAccess,
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import { effectiveMetaAds } from "@/lib/meta-ads-settings";
import { metaAdsEnv } from "@/lib/meta-ads-refresh";
import {
  getPlatformSettings,
  getPublicAppUrl,
  savePlatformSettings,
  type PlatformSettings,
} from "@/lib/platform-settings";
import {
  mergeSeoConfigPatch,
  toSeoAdminView,
  validateSeoConfigPatch,
  type SeoConfigPatch,
} from "@/lib/seo-admin-settings";
import {
  buildMarketingSeoStatus,
  resolveSiteSeoPages,
} from "@/lib/site-seo";
import { revalidatePublicSeo } from "@/lib/site-seo-cache";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";

function statusFor(settings: PlatformSettings, publicAppUrl: string) {
  const pages = resolveSiteSeoPages(settings.seo, publicAppUrl);
  const ads = effectiveMetaAds(settings.metaAds, metaAdsEnv());
  const status = buildMarketingSeoStatus(settings.seo, pages, publicAppUrl, {
    metaAds: {
      accountId: ads.accountId,
      hasAccessToken: Boolean(ads.accessToken),
    },
  });
  return { pages, status };
}

export async function GET() {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const [settings, publicAppUrl] = await Promise.all([
      getPlatformSettings(),
      getPublicAppUrl(),
    ]);
    const canEdit = auth.user.role === "platform_admin";
    const { pages, status } = statusFor(settings, publicAppUrl);
    return NextResponse.json({
      seo: toSeoAdminView(settings.seo, canEdit),
      pages,
      status,
      canEdit,
    });
  } catch (err) {
    console.error("[admin/seo GET]", err);
    return NextResponse.json({ error: "Failed to load SEO" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const body = (await request.json()) as SeoConfigPatch;
    const errors = validateSeoConfigPatch(body);
    if (errors.length) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }
    const current = await getPlatformSettings();
    const nextSeo = mergeSeoConfigPatch(current.seo, body);
    const next = await savePlatformSettings({
      ...current,
      seo: nextSeo,
    });
    const publicAppUrl = await getPublicAppUrl();
    const { pages, status } = statusFor(next, publicAppUrl);

    revalidatePublicSeo();

    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "settings.seo_updated",
      detail: {
        connections: status.connections
          .filter((c) => c.status === "connected")
          .map((c) => c.id),
        pageCount: Object.keys(next.seo.pages).length,
      },
      ip: clientIp(request),
    });

    return NextResponse.json({
      seo: toSeoAdminView(next.seo, true),
      pages,
      status,
      canEdit: true,
    });
  } catch (err) {
    console.error("[admin/seo PUT]", err);
    return NextResponse.json({ error: "Failed to save SEO" }, { status: 500 });
  }
}
