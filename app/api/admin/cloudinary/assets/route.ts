import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { getCloudinaryCredentials } from "@/lib/cloudinary";
import {
  ASSET_TTL,
  cachedCloudinary,
  CloudinaryRateLimitError,
  listCloudinaryLibrary,
} from "@/lib/cloudinary-library";

export const dynamic = "force-dynamic";

/** One page of the Cloudinary library for the media picker. */
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const creds = await getCloudinaryCredentials();
  if (!creds) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not connected. Add the cloud name, API key, and secret under Admin → Media.",
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor")?.trim() || undefined;
  const prefix = url.searchParams.get("prefix")?.trim() || undefined;
  const resourceType =
    url.searchParams.get("type") === "video" ? "video" : "image";

  try {
    const key = [
      "assets",
      creds.cloudName,
      resourceType,
      prefix ?? "",
      cursor ?? "",
    ].join("|");
    const page = await cachedCloudinary(
      key,
      ASSET_TTL,
      () => listCloudinaryLibrary(creds, { cursor, prefix, resourceType }),
      { refresh: url.searchParams.get("refresh") === "1" }
    );
    return NextResponse.json(page);
  } catch (error) {
    const status = error instanceof CloudinaryRateLimitError ? 429 : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load Cloudinary.",
      },
      { status }
    );
  }
}
