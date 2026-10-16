import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { readSiteMedia, rejectUploadSize, sniffMarketingUpload, uploadToCloudinary } from "@/lib/cloudinary";
import { replaceMarketingMediaPath } from "@/lib/marketing-sections-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  try {
    const form = await request.formData();
    const source = String(form.get("source") ?? "");
    const file = form.get("file");
    let bytes: Buffer;
    let filename: string;
    if (file instanceof File) {
      const sizeError = rejectUploadSize(file.size);
      if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 });
      bytes = Buffer.from(await file.arrayBuffer());
      filename = file.name || "upload";
    } else if (source.startsWith("/marketing/")) {
      bytes = await readSiteMedia(source);
      filename = source.split("/").pop() || "upload";
    } else {
      return NextResponse.json({ error: "Choose a file or a site image." }, { status: 400 });
    }
    const sniffed = sniffMarketingUpload(bytes);
    if (!sniffed) {
      return NextResponse.json(
        { error: "Use a JPEG, PNG, WebP, GIF, MP4, or WebM file." },
        { status: 400 }
      );
    }
    const saved = await uploadToCloudinary({
      bytes,
      filename,
      resource: sniffed.resource,
      type: sniffed.type,
      folder: "nura/marketing",
    });
    const updated = source.startsWith("/marketing/")
      ? await replaceMarketingMediaPath(source, saved.url)
      : 0;
    if (updated > 0) revalidatePath("/", "layout");
    return NextResponse.json({ ...saved, updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
