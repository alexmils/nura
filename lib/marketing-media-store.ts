import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const MEDIA_DIR = path.join(process.cwd(), "data", "marketing-media");
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 24 * 1024 * 1024;

function sniff(data: Buffer): { ext: string; type: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { ext: ".jpg", type: "image/jpeg" };
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return { ext: ".png", type: "image/png" };
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: ".webp", type: "image/webp" };
  }
  if (
    data.length >= 6 &&
    (data.subarray(0, 6).toString("ascii") === "GIF87a" ||
      data.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return { ext: ".gif", type: "image/gif" };
  }
  if (data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp") {
    return { ext: ".mp4", type: "video/mp4" };
  }
  if (data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    return { ext: ".webm", type: "video/webm" };
  }
  return null;
}

export function marketingMediaFilename(name: string): string | null {
  const base = path.basename(name);
  if (base !== name || !/^[a-f0-9]{16}\.(jpg|png|webp|gif|mp4|webm)$/.test(base)) return null;
  return base;
}

export async function saveMarketingMedia(data: Buffer): Promise<{ url: string }> {
  const kind = sniff(data);
  if (!kind) throw new Error("Use a JPEG, PNG, WebP, GIF, MP4, or WebM file.");
  const max = kind.type.startsWith("video/") ? VIDEO_MAX : IMAGE_MAX;
  if (data.length > max) {
    throw new Error(kind.type.startsWith("video/") ? "Use a video smaller than 24 MB." : "Use an image smaller than 8 MB.");
  }
  await mkdir(MEDIA_DIR, { recursive: true });
  const name = `${randomBytes(8).toString("hex")}${kind.ext}`;
  await writeFile(path.join(MEDIA_DIR, name), data);
  return { url: `/api/marketing-media/${name}` };
}

export async function readMarketingMedia(
  name: string
): Promise<{ data: Buffer; type: string } | null> {
  const file = marketingMediaFilename(name);
  if (!file) return null;
  try {
    const data = await readFile(path.join(MEDIA_DIR, file));
    const kind = sniff(data);
    if (!kind) return null;
    return { data, type: kind.type };
  } catch {
    return null;
  }
}
