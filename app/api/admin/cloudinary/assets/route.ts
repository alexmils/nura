import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { listCloudinaryAssets } from "@/lib/cloudinary";
import { localMarketingPathsInUse } from "@/lib/marketing-sections-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  try {
    const [images, videos, site] = await Promise.all([
      listCloudinaryAssets("image"),
      listCloudinaryAssets("video"),
      localMarketingPathsInUse(),
    ]);
    return NextResponse.json({ assets: [...images, ...videos], site });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load media.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
