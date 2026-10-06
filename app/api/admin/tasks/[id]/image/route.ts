import { NextResponse } from "next/server";
import {
  isAuthContext,
  requirePlatformAdmin,
} from "@/lib/api-auth";
import { appendAdminTaskImage, getAdminTask } from "@/lib/admin-tasks-db";
import {
  decodeDataUrlImage,
  saveTaskImageBytes,
} from "@/lib/admin-tasks-media";
import { MAX_TASK_IMAGE_BYTES } from "@/lib/admin-tasks";

type Ctx = { params: Promise<{ id: string }> };

async function readUploadBytes(request: Request): Promise<Buffer> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Attach an image file.");
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_TASK_IMAGE_BYTES) {
      throw new Error("Use an image smaller than 4 MB.");
    }
    return buf;
  }
  const json = (await request.json().catch(() => ({}))) as {
    dataUrl?: string;
  };
  if (!json.dataUrl) {
    throw new Error("Attach an image file.");
  }
  return decodeDataUrlImage(json.dataUrl);
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const { id } = await ctx.params;
  const existing = await getAdminTask(id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const bytes = await readUploadBytes(request);
    const url = await saveTaskImageBytes(bytes);
    const row = await appendAdminTaskImage(id, url);
    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
