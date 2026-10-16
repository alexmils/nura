import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { readSiteMedia, uploadToCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

function kindOf(name: string, bytes: Buffer): "image" | "video" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".webm")) return "video";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return "video";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video";
  }
  return "image";
}

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
      bytes = Buffer.from(await file.arrayBuffer());
      filename = file.name || "upload";
    } else if (source.startsWith("/marketing/")) {
      bytes = await readSiteMedia(source);
      filename = source.split("/").pop() || "upload";
    } else {
      return NextResponse.json({ error: "Choose a file or a site image." }, { status: 400 });
    }
    if (bytes.length > 24 * 1024 * 1024) {
      return NextResponse.json({ error: "Use a file smaller than 24 MB." }, { status: 400 });
    }
    const resource = kindOf(filename, bytes);
    const saved = await uploadToCloudinary({ bytes, filename, resource, folder: "nura/marketing" });
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
