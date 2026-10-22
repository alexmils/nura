import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { rejectUploadSize, sniffMarketingUpload, uploadToCloudinary } from "@/lib/cloudinary";
import { clearCloudinaryCache } from "@/lib/cloudinary-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Picker upload straight into the chosen Cloudinary folder. */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file." }, { status: 400 });
  const folder = String(form?.get("folder") ?? "").trim();
  if (!folder || folder.length > 200 || /(^|\/)\.\.(\/|$)|[^\w\-/ ]/.test(folder)) {
    return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  }
  const sizeError = rejectUploadSize(file.size);
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMarketingUpload(bytes);
  if (!sniffed) return NextResponse.json({ error: "Only JPEG, PNG, WebP, GIF, MP4, or WebM files are allowed." }, { status: 400 });
  try {
    const saved = await uploadToCloudinary({ bytes, filename: file.name || "upload", resource: sniffed.resource, type: sniffed.type, folder });
    clearCloudinaryCache({ folders: true }); // an upload can create a folder
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 502 });
  }
}
