import { NextResponse } from "next/server";
import { getOgImage } from "@/lib/og-library";
import { parseOgImageDataUrl } from "@/lib/seo-config";

export const dynamic = "force-dynamic";

/** Public bytes for an OG share image. The id is opaque; the row is the auth. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await getOgImage(id);
  if (!image) return new NextResponse("Not found", { status: 404 });
  const parsed = parseOgImageDataUrl(image.dataUrl);
  if (!parsed) return new NextResponse("Not found", { status: 404 });

  // A short cache, not immutable: "Replace image" keeps the same URL so the
  // SEO settings stay valid, and the new bytes should show up soon after.
  return new NextResponse(new Uint8Array(parsed.body), {
    headers: {
      "Content-Type": parsed.contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
