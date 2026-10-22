import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { getCloudinaryCredentials } from "@/lib/cloudinary";
import { cachedCloudinary, CloudinaryRateLimitError, FOLDER_TTL, listCloudinaryFolders } from "@/lib/cloudinary-library";

export const dynamic = "force-dynamic";

/** Folder tree for the picker sidebar. */
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const creds = await getCloudinaryCredentials();
  if (!creds) return NextResponse.json({ error: "Cloudinary is not connected yet." }, { status: 400 });
  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const folders = await cachedCloudinary(`folders|${creds.cloudName}`, FOLDER_TTL, () => listCloudinaryFolders(creds), { refresh });
    return NextResponse.json({ folders });
  } catch (error) {
    const status = error instanceof CloudinaryRateLimitError ? 429 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load folders." }, { status });
  }
}
