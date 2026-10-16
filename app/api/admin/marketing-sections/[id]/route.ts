import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import {
  loadMarketingCopy,
  saveMarketingSection,
} from "@/lib/marketing-sections-db";
import {
  getSectionDef,
  normalizeSection,
} from "@/lib/marketing-sections";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { id } = await params;
  if (!getSectionDef(id)) {
    return NextResponse.json({ error: "Unknown section." }, { status: 404 });
  }
  const copy = await loadMarketingCopy();
  return NextResponse.json({ config: copy[id] ?? normalizeSection(id, null) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { id } = await params;
  if (!getSectionDef(id)) {
    return NextResponse.json({ error: "Unknown section." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const config = await saveMarketingSection(id, body);
  revalidatePath("/", "layout");
  return NextResponse.json({ config });
}
