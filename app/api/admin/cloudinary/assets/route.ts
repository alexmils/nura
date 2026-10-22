import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import {
  getCloudinaryCredentials,
  listCloudinaryAssets,
} from "@/lib/cloudinary";
import {
  ASSET_TTL,
  cachedCloudinary,
  CloudinaryRateLimitError,
  listCloudinaryLibrary,
  searchCloudinaryFolder,
} from "@/lib/cloudinary-library";

export const dynamic = "force-dynamic";

/**
 * Without `paged`: the Media page's full list (images + videos).
 * With `paged=1` (the picker): one page from the library or one folder.
 *
 * `site` stays in the payload so the Media page can keep its "Still on the
 * site" section. It is empty until the marketing-sections inventory ships.
 */
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const url = new URL(request.url);

  if (url.searchParams.get("paged") !== "1") {
    try {
      const [images, videos] = await Promise.all([
        listCloudinaryAssets("image"),
        listCloudinaryAssets("video"),
      ]);
      return NextResponse.json({ assets: [...images, ...videos], site: [] });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load media.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const creds = await getCloudinaryCredentials();
  if (!creds) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not connected. Add the cloud name, API key, and secret under Admin → Media → Settings.",
      },
      { status: 400 }
    );
  }

  const cursor = url.searchParams.get("cursor")?.trim() || undefined;
  const prefix = url.searchParams.get("prefix")?.trim() || undefined;
  const folder = url.searchParams.get("folder")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  const resourceType =
    url.searchParams.get("type") === "video" ? "video" : "image";

  try {
    const key = [
      "assets",
      creds.cloudName,
      resourceType,
      folder ?? "",
      query ?? "",
      prefix ?? "",
      cursor ?? "",
    ].join("|");
    const page = await cachedCloudinary(
      key,
      ASSET_TTL,
      () =>
        folder
          ? searchCloudinaryFolder(creds, {
              folder,
              cursor,
              query,
              resourceType,
            })
          : listCloudinaryLibrary(creds, { cursor, prefix, resourceType }),
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
