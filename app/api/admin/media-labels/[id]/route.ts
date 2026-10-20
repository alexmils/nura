import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { cleanLabelColor } from "@/lib/media-label-colors";
import { cleanLabelName, deleteMediaLabel, mediaLabelAssets, mediaLabelExists, updateMediaLabel } from "@/lib/media-labels";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The files in one label (the picker's label view). */
export async function GET(request: Request, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { id } = await params;
  if (!(await mediaLabelExists(id))) return NextResponse.json({ error: "Label not found." }, { status: 404 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "video" ? "video" : "image";
  const assets = await mediaLabelAssets(id, type, url.searchParams.get("q") ?? "");
  return NextResponse.json({ assets, nextCursor: null });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: unknown; color?: unknown } | null;
  const name = body?.name === undefined ? undefined : cleanLabelName(body.name);
  if (name === null) return NextResponse.json({ error: "Give the label a name (up to 60 characters)." }, { status: 400 });
  const color = body?.color === undefined ? undefined : cleanLabelColor(body.color);
  if (color === null) return NextResponse.json({ error: "Unknown colour." }, { status: 400 });
  try {
    const ok = await updateMediaLabel(id, { name, color });
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Label not found." }, { status: 404 });
  } catch (error) {
    const dup = error instanceof Error && /unique|duplicate/i.test(error.message);
    return NextResponse.json({ error: dup ? "A label with that name already exists." : "Could not update the label." }, { status: dup ? 409 : 500 });
  }
}

/** Deletes only the label; the files stay in Cloudinary. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const { id } = await params;
  return (await deleteMediaLabel(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Label not found." }, { status: 404 });
}
