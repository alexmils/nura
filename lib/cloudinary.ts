import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings";

export type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export type CloudinaryStatus = {
  cloudName: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  configured: boolean;
  source: "settings" | "env" | "none";
};

const API_ROOT = "https://api.cloudinary.com/v1_1";
const FOLDER = "nura";

export function signCloudinaryParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

function basicAuth(creds: CloudinaryCredentials): string {
  return `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString("base64")}`;
}

export async function getCloudinaryCredentials(): Promise<CloudinaryCredentials | null> {
  const settings = await getPlatformSettings();
  const stored = settings.cloudinary;
  const cloudName = stored.cloudName.trim() || process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
  const apiKey = stored.apiKey.trim() || process.env.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = stored.apiSecret.trim() || process.env.CLOUDINARY_API_SECRET?.trim() || "";
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export async function getCloudinaryStatus(): Promise<CloudinaryStatus> {
  const settings = await getPlatformSettings();
  const stored = settings.cloudinary;
  const envName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
  const envKey = process.env.CLOUDINARY_API_KEY?.trim() || "";
  const envSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "";
  const cloudName = stored.cloudName.trim() || envName;
  const hasApiKey = Boolean(stored.apiKey.trim() || envKey);
  const hasApiSecret = Boolean(stored.apiSecret.trim() || envSecret);
  const fromSettings = Boolean(stored.cloudName.trim() && stored.apiKey.trim() && stored.apiSecret.trim());
  return {
    cloudName,
    hasApiKey,
    hasApiSecret,
    configured: Boolean(cloudName && hasApiKey && hasApiSecret),
    source: fromSettings ? "settings" : cloudName && hasApiKey && hasApiSecret ? "env" : "none",
  };
}

export async function saveCloudinarySettings(input: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}): Promise<CloudinaryStatus> {
  const current = await getPlatformSettings();
  const cloudName = input.cloudName.trim();
  const apiKey = input.apiKey.trim() || current.cloudinary.apiKey;
  const apiSecret = input.apiSecret.trim() || current.cloudinary.apiSecret;
  await savePlatformSettings({
    ...current,
    cloudinary: { cloudName, apiKey, apiSecret },
  });
  return getCloudinaryStatus();
}

export async function uploadToCloudinary(opts: {
  bytes: Buffer;
  filename: string;
  resource: "image" | "video";
  folder?: string;
}): Promise<{ url: string; publicId: string }> {
  const creds = await getCloudinaryCredentials();
  if (!creds) {
    throw new Error("Connect Cloudinary under Media, then Settings.");
  }
  const folder = (opts.folder || FOLDER).replace(/^\/+|\/+$/g, "");
  const signed: Record<string, string> = {
    folder,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const body = new FormData();
  const type = opts.resource === "video" ? "video/mp4" : "image/jpeg";
  body.set("file", new File([new Uint8Array(opts.bytes)], opts.filename, { type }));
  body.set("api_key", creds.apiKey);
  body.set("signature", signCloudinaryParams(signed, creds.apiSecret));
  for (const [key, value] of Object.entries(signed)) body.set(key, value);
  const endpoint = opts.resource === "video" ? "video/upload" : "image/upload";
  const res = await fetch(`${API_ROOT}/${creds.cloudName}/${endpoint}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(120000),
  });
  const data = (await res.json().catch(() => null)) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !data?.secure_url || !data.public_id) {
    throw new Error(data?.error?.message || "Cloudinary upload failed.");
  }
  return { url: data.secure_url, publicId: data.public_id };
}

export type CloudinaryAsset = {
  url: string;
  publicId: string;
  resource: "image" | "video";
  bytes: number;
  width: number;
  height: number;
};

export async function listCloudinaryAssets(resource: "image" | "video"): Promise<CloudinaryAsset[]> {
  const creds = await getCloudinaryCredentials();
  if (!creds) return [];
  const url = `${API_ROOT}/${creds.cloudName}/resources/${resource}/upload?prefix=${encodeURIComponent(FOLDER)}&max_results=100`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(creds) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(data?.error?.message || "Could not list Cloudinary files.");
  }
  const data = (await res.json()) as {
    resources?: {
      secure_url: string;
      public_id: string;
      bytes: number;
      width: number;
      height: number;
    }[];
  };
  return (data.resources ?? []).map((item) => ({
    url: item.secure_url,
    publicId: item.public_id,
    resource,
    bytes: item.bytes,
    width: item.width,
    height: item.height,
  }));
}

export async function testCloudinary(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const images = await listCloudinaryAssets("image");
    return { ok: true, count: images.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed." };
  }
}

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm"]);

export async function listSiteMedia(): Promise<{ path: string; kind: "image" | "video" }[]> {
  const root = path.join(process.cwd(), "public", "marketing");
  const out: { path: string; kind: "image" | "video" }[] = [];
  async function walk(dir: string) {
    const { readdir } = await import("fs/promises");
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!MEDIA_EXT.has(ext)) continue;
      const rel = "/" + path.relative(path.join(process.cwd(), "public"), full).split(path.sep).join("/");
      out.push({ path: rel, kind: ext === ".mp4" || ext === ".webm" ? "video" : "image" });
    }
  }
  try {
    await walk(root);
  } catch {
    return [];
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readSiteMedia(publicPath: string): Promise<Buffer> {
  if (!publicPath.startsWith("/marketing/") || publicPath.includes("..") || publicPath.includes("\\")) {
    throw new Error("That file is not a site image.");
  }
  const full = path.resolve(process.cwd(), "public", publicPath.slice(1));
  const root = path.resolve(process.cwd(), "public", "marketing");
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("That file is not a site image.");
  }
  return readFile(full);
}
