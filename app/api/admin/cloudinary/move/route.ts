import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { getCloudinaryCredentials } from "@/lib/cloudinary";
import { clearCloudinaryCache, CloudinaryRateLimitError, moveCloudinaryAssets } from "@/lib/cloudinary-library";
import { renameLabelledAssets } from "@/lib/media-labels";

export const dynamic = "force-dynamic";

/** Move library files into another folder (picker drag and drop). */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const creds = await getCloudinaryCredentials();
  if (!creds) return NextResponse.json({ error: "Cloudinary is not connected yet." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { publicIds?: unknown; folder?: unknown; type?: unknown } | null;
  const publicIds = (Array.isArray(body?.publicIds) ? body.publicIds : []).filter(
    (id): id is string => typeof id === "string" && id.length > 0 && id.length < 400
  );
  const folder = typeof body?.folder === "string" ? body.folder.trim() : "";
  if (publicIds.length === 0) return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  if (publicIds.length > 200) return NextResponse.json({ error: "Move at most 200 files at once." }, { status: 400 });
  if (!folder || folder.includes("..")) return NextResponse.json({ error: "Choose a folder to move into." }, { status: 400 });
  try {
    const result = await moveCloudinaryAssets(creds, { publicIds, folder, resourceType: body?.type === "video" ? "video" : "image" });
    await clearCloudinaryCache();
    await renameLabelledAssets(result.moved).catch(() => undefined);
    if (result.moved.some((m) => m.from !== m.to)) revalidatePath("/", "layout");
    return NextResponse.json(result, { status: result.moved.length === 0 ? 502 : 200 });
  } catch (error) {
    const status = error instanceof CloudinaryRateLimitError ? 429 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not move the files." }, { status });
  }
}
