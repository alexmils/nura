import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { cleanLabelColor } from "@/lib/media-label-colors";
import { cleanLabelName, createMediaLabel, listMediaLabels } from "@/lib/media-labels";

export const dynamic = "force-dynamic";

/** All labels with counts and member keys. DB only, no Cloudinary calls. */
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const type = new URL(request.url).searchParams.get("type") === "video" ? "video" : "image";
  return NextResponse.json({ labels: await listMediaLabels(type) });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const body = (await request.json().catch(() => null)) as { name?: unknown; color?: unknown } | null;
  const name = cleanLabelName(body?.name);
  if (!name) return NextResponse.json({ error: "Give the label a name (up to 60 characters)." }, { status: 400 });
  try {
    const label = await createMediaLabel(name, cleanLabelColor(body?.color) ?? "default");
    return NextResponse.json({ label });
  } catch (error) {
    const dup = error instanceof Error && /unique|duplicate/i.test(error.message);
    return NextResponse.json({ error: dup ? "A label with that name already exists." : "Could not create the label." }, { status: dup ? 409 : 500 });
  }
}
