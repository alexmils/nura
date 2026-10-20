import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { assignMediaLabel, cleanEtag, mediaLabelExists, type MediaLabelAsset } from "@/lib/media-labels";

export const dynamic = "force-dynamic";

const CLD = /^https:\/\/res\.cloudinary\.com\//;

function cleanAsset(value: unknown): MediaLabelAsset | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const publicId = str(a.publicId);
  const url = str(a.url);
  if (!publicId || publicId.length > 400 || !CLD.test(url)) return null;
  const thumb = str(a.thumb);
  return {
    assetId: str(a.assetId) || undefined,
    publicId,
    url,
    thumb: CLD.test(thumb) ? thumb : url,
    width: Number.isFinite(a.width) ? Number(a.width) : 0,
    height: Number.isFinite(a.height) ? Number(a.height) : 0,
    etag: cleanEtag(a.etag) || undefined,
  };
}

/** Add files to (or remove them from) one label. */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const body = (await request.json().catch(() => null)) as { labelId?: unknown; action?: unknown; assets?: unknown; type?: unknown } | null;
  const labelId = typeof body?.labelId === "string" ? body.labelId : "";
  const action = body?.action === "remove" ? "remove" : "add";
  const resourceType = body?.type === "video" ? "video" : "image";
  const assets = (Array.isArray(body?.assets) ? body.assets : []).map(cleanAsset).filter((a): a is MediaLabelAsset => Boolean(a));
  if (!labelId || assets.length === 0) return NextResponse.json({ error: "Nothing to label." }, { status: 400 });
  if (assets.length > 500) return NextResponse.json({ error: "Label at most 500 files at once." }, { status: 400 });
  if (!(await mediaLabelExists(labelId))) return NextResponse.json({ error: "Label not found." }, { status: 404 });
  await assignMediaLabel(labelId, action, assets, resourceType);
  return NextResponse.json({ ok: true });
}
