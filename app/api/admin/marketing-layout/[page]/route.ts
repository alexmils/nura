import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { purgeMarketingCache } from "@/lib/cloudflare-purge";
import { defaultLayout, isMarketingPageId } from "@/lib/marketing-layout";
import {
  loadPageLayouts,
  resetPageLayout,
  savePageLayout,
} from "@/lib/marketing-sections-db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ page: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { page } = await params;
  if (!isMarketingPageId(page)) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 });
  }
  const layouts = await loadPageLayouts();
  const saved = layouts[page];
  return NextResponse.json({ layout: saved ?? defaultLayout(page), saved: Boolean(saved) });
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { page } = await params;
  if (!isMarketingPageId(page)) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    sections?: unknown;
    seeds?: unknown;
  } | null;
  if (!body || typeof body !== "object" || !Array.isArray(body.sections)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const seeds =
    body.seeds && typeof body.seeds === "object" && !Array.isArray(body.seeds)
      ? (body.seeds as Record<string, unknown>)
      : {};
  try {
    const layout = await savePageLayout(page, { sections: body.sections }, seeds);
    revalidatePath("/", "layout");
    await purgeMarketingCache(`layout ${page} save`);
    return NextResponse.json({ layout });
  } catch (err) {
    console.error("[marketing-layout] save failed", err);
    return NextResponse.json({ error: "Could not save the layout." }, { status: 500 });
  }
}

/** Reset to default order, everything shown, added sections removed. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { page } = await params;
  if (!isMarketingPageId(page)) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 });
  }
  try {
    const layout = await resetPageLayout(page);
    revalidatePath("/", "layout");
    await purgeMarketingCache(`layout ${page} reset`);
    return NextResponse.json({ layout });
  } catch (err) {
    console.error("[marketing-layout] reset failed", err);
    return NextResponse.json({ error: "Could not reset the layout." }, { status: 500 });
  }
}