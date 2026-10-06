import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  MAX_TASK_IMAGE_BYTES,
  adminTaskMediaUrl,
} from "@/lib/admin-tasks";

const MEDIA_DIR = path.join(process.cwd(), "data", "admin-tasks");

function sniffSuffix(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return ".jpg";
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return ".png";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }
  if (
    data.length >= 6 &&
    (data.subarray(0, 6).toString("ascii") === "GIF87a" ||
      data.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return ".gif";
  }
  return null;
}

export function mediaFilenameFromUrl(url: string): string | null {
  const prefix = "/api/admin/tasks/media/";
  if (!url.startsWith(prefix)) return null;
  const name = decodeURIComponent(url.slice(prefix.length).split("?")[0] || "");
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return null;
  }
  return name;
}

export function resolveTaskMediaPath(filename: string): string | null {
  const name = path.basename(filename);
  if (name !== filename || name.includes("..")) return null;
  return path.join(MEDIA_DIR, name);
}

export async function saveTaskImageBytes(data: Buffer): Promise<string> {
  if (data.length > MAX_TASK_IMAGE_BYTES) {
    throw new Error("Use an image smaller than 4 MB.");
  }
  const suffix = sniffSuffix(data);
  if (!suffix) {
    throw new Error("Image must be JPEG, PNG, WebP, or GIF.");
  }
  await mkdir(MEDIA_DIR, { recursive: true });
  const name = `${randomBytes(8).toString("hex")}${suffix}`;
  await writeFile(path.join(MEDIA_DIR, name), data);
  return adminTaskMediaUrl(name);
}

export async function unlinkTaskImageUrl(url: string): Promise<void> {
  const name = mediaFilenameFromUrl(url);
  if (!name) return;
  const full = resolveTaskMediaPath(name);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* already gone */
  }
}

export async function decodeDataUrlImage(dataUrl: string): Promise<Buffer> {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([\s\S]+)$/i.exec(
    dataUrl.trim()
  );
  if (!m) {
    throw new Error("Image must be a JPEG, PNG, WebP, or GIF data URL.");
  }
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length) throw new Error("Empty image.");
  return buf;
}
