import { createHash } from "crypto";
import { readFile, stat } from "fs/promises";
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
  /** What looks wrong with the stored values (never contains a secret). */
  problem: string | null;
  /** Reference note: which Cloudinary login owns this cloud (saved value or the built-in default). */
  accountEmail: string;
};

/**
 * Built-in reference value: the Cloudinary login that owns Nura's cloud (same
 * account in dev and production). Shown when nothing is saved in settings, so
 * no production DB write is needed; an admin can override it.
 */
export const DEFAULT_CLOUDINARY_ACCOUNT_EMAIL = "hello@alexandermils.com";

/** Saved value, or the built-in default when nothing is saved. */
export function effectiveCloudinaryAccountEmail(saved: string | null | undefined): string {
  return saved?.trim() || DEFAULT_CLOUDINARY_ACCOUNT_EMAIL;
}

const ACCOUNT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The Cloudinary login email is a reference note for admins who use several
 * Cloudinary accounts. Empty is allowed (clears the saved value, so the
 * built-in default shows again); otherwise it must look
 * like an email. Returns the trimmed value, or throws with a message.
 */
export function normalizeCloudinaryAccountEmail(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new Error("Cloudinary account email must be text.");
  const email = value.trim();
  if (!email) return "";
  if (email.length > 254 || !ACCOUNT_EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address for the Cloudinary account, or leave it empty.");
  }
  return email;
}

const API_ROOT = "https://api.cloudinary.com/v1_1";
const FOLDER = "nura";
export const MARKETING_UPLOAD_MAX_BYTES = 24 * 1024 * 1024;

export function rejectUploadSize(size: number): string | null {
  if (!Number.isFinite(size) || size <= 0) return "Choose a file.";
  if (size > MARKETING_UPLOAD_MAX_BYTES) return "Use a file smaller than 24 MB.";
  return null;
}

export function resolveCloudinaryCredentials(
  stored: CloudinaryCredentials,
  env: CloudinaryCredentials
): { creds: CloudinaryCredentials | null; source: CloudinaryStatus["source"] } {
  const complete = (value: CloudinaryCredentials): CloudinaryCredentials | null => {
    const cloudName = value.cloudName.trim();
    const apiKey = value.apiKey.trim();
    const apiSecret = value.apiSecret.trim();
    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  };
  const fromSettings = complete(stored);
  if (fromSettings) return { creds: fromSettings, source: "settings" };
  const fromEnv = complete(env);
  if (fromEnv) return { creds: fromEnv, source: "env" };
  return { creds: null, source: "none" };
}

/** Cloudinary cloud names: letters, digits, "-" and "_" (never an email or URL). */
export const CLOUD_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** The dashboard's "API environment variable": cloudinary://<key>:<secret>@<cloud>. */
export function parseCloudinaryUrl(value: string): CloudinaryCredentials | null {
  const match = /^(?:CLOUDINARY_URL=)?cloudinary:\/\/([^:\s]+):([^@\s]+)@([a-z0-9_-]+)\/?$/i.exec(value.trim());
  if (!match) return null;
  return { apiKey: match[1]!, apiSecret: match[2]!, cloudName: match[3]! };
}

/** Why a cloud name cannot be right, or null. Never echoes secrets. */
export function cloudNameProblem(cloudName: string): string | null {
  const name = cloudName.trim();
  if (!name) return "Cloud name is required.";
  if (name.includes("@")) {
    return "The Cloud name looks like an email address. Use the Cloud name shown on your Cloudinary dashboard (Settings, API Keys), not your login email.";
  }
  if (/^https?:|\//i.test(name)) return "Enter only the Cloud name, not a URL.";
  if (!CLOUD_NAME_RE.test(name)) return "The Cloud name can only contain letters, numbers, - and _.";
  return null;
}

/** Turns a failed Admin API answer into a message that names the field to check. */
export function cloudinaryErrorMessage(status: number, apiMessage: string | undefined, cloudName: string): string {
  const message = apiMessage?.trim() || "";
  const nameProblem = cloudNameProblem(cloudName);
  if (nameProblem) return nameProblem;
  if (status === 404) {
    return `Cloudinary has no cloud named "${cloudName.trim()}". Check the Cloud name on your Cloudinary dashboard.`;
  }
  if (status === 401 || status === 403) {
    if (/cloud_name mismatch/i.test(message)) {
      return "These API keys belong to a different Cloudinary cloud. Check the Cloud name (or enter the key pair for this cloud).";
    }
    if (/api_key|unknown api key/i.test(message)) return "Cloudinary does not recognise the API key.";
    if (/secret|signature/i.test(message)) return "Cloudinary rejected the API secret.";
    return `Cloudinary rejected the credentials${message ? ` (${message})` : ""}. Check the API key and secret.`;
  }
  if (status === 420 || status === 429) return "Cloudinary rate limit reached. Try again in a minute.";
  return message || `Could not list Cloudinary files (HTTP ${status}).`;
}

export function mergeCloudinaryInput(
  current: CloudinaryCredentials,
  input: CloudinaryCredentials
): CloudinaryCredentials {
  // Pasting the dashboard's CLOUDINARY_URL into any field fills all three.
  const pasted = [input.cloudName, input.apiKey, input.apiSecret].map(parseCloudinaryUrl).find(Boolean);
  if (pasted) input = pasted;
  const cloudName = input.cloudName.trim();
  const problem = cloudNameProblem(cloudName);
  if (problem) throw new Error(problem);
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  if (apiKey && !/^\d{6,}$/.test(apiKey)) throw new Error("The API key is a number (digits only). Check the API key field.");
  const nameChanged = cloudName !== current.cloudName.trim();
  // Keys stay bound to their cloud, unless the stored name was never a valid one (e.g. an email typed by mistake).
  if (nameChanged && !cloudNameProblem(current.cloudName) && (!apiKey || !apiSecret)) {
    throw new Error("Enter the API key and secret for this cloud name.");
  }
  if (!apiKey && !current.apiKey.trim()) throw new Error("API key is required.");
  if (!apiSecret && !current.apiSecret.trim()) throw new Error("API secret is required.");
  return {
    cloudName,
    apiKey: apiKey || current.apiKey,
    apiSecret: apiSecret || current.apiSecret,
  };
}

export function sniffMarketingUpload(
  data: Buffer
): { resource: "image" | "video"; type: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { resource: "image", type: "image/jpeg" };
  }
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return { resource: "image", type: "image/png" };
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { resource: "image", type: "image/webp" };
  }
  if (
    data.length >= 6 &&
    (data.subarray(0, 6).toString("ascii") === "GIF87a" || data.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return { resource: "image", type: "image/gif" };
  }
  if (data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp") {
    return { resource: "video", type: "video/mp4" };
  }
  if (data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    return { resource: "video", type: "video/webm" };
  }
  return null;
}

export async function collectCloudinaryPages<T>(
  load: (cursor?: string) => Promise<{ items: T[]; next?: string }>
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const batch = await load(cursor);
    out.push(...batch.items);
    if (!batch.next) break;
    cursor = batch.next;
  }
  return out;
}

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

function envCloudinary(): CloudinaryCredentials {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || "",
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || "",
  };
}

export async function getCloudinaryCredentials(): Promise<CloudinaryCredentials | null> {
  const settings = await getPlatformSettings();
  return resolveCloudinaryCredentials(settings.cloudinary, envCloudinary()).creds;
}

export async function getCloudinaryStatus(): Promise<CloudinaryStatus> {
  const settings = await getPlatformSettings();
  const resolved = resolveCloudinaryCredentials(settings.cloudinary, envCloudinary());
  return {
    cloudName: resolved.creds?.cloudName || settings.cloudinary.cloudName.trim(),
    hasApiKey: Boolean(resolved.creds?.apiKey),
    hasApiSecret: Boolean(resolved.creds?.apiSecret),
    configured: Boolean(resolved.creds),
    source: resolved.source,
    problem: resolved.creds ? cloudNameProblem(resolved.creds.cloudName) : null,
    accountEmail: effectiveCloudinaryAccountEmail(settings.cloudinary.accountEmail),
  };
}

/** Saves only the reference email; credentials are untouched. */
export async function saveCloudinaryAccountEmail(value: unknown): Promise<CloudinaryStatus> {
  const accountEmail = normalizeCloudinaryAccountEmail(value);
  const current = await getPlatformSettings();
  await savePlatformSettings({
    ...current,
    cloudinary: { ...current.cloudinary, accountEmail },
  });
  return getCloudinaryStatus();
}

export async function saveCloudinarySettings(input: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}): Promise<CloudinaryStatus> {
  const current = await getPlatformSettings();
  const cloudinary = mergeCloudinaryInput(current.cloudinary, input);
  await savePlatformSettings({
    ...current,
    cloudinary: { ...cloudinary, accountEmail: current.cloudinary.accountEmail ?? "" },
  });
  return getCloudinaryStatus();
}

export async function uploadToCloudinary(opts: {
  bytes: Buffer;
  filename: string;
  resource: "image" | "video";
  type: string;
  folder?: string;
}): Promise<{ url: string; publicId: string; assetId?: string }> {
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
  body.set("file", new File([new Uint8Array(opts.bytes)], opts.filename, { type: opts.type }));
  body.set("api_key", creds.apiKey);
  body.set("signature", signCloudinaryParams(signed, creds.apiSecret));
  for (const [key, value] of Object.entries(signed)) body.set(key, value);
  const endpoint = opts.resource === "video" ? "video/upload" : "image/upload";
  const res = await fetch(`${API_ROOT}/${encodeURIComponent(creds.cloudName)}/${endpoint}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(120000),
  });
  const data = (await res.json().catch(() => null)) as {
    secure_url?: string;
    public_id?: string;
    asset_id?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !data?.secure_url || !data.public_id) {
    throw new Error(res.ok ? "Cloudinary upload failed." : cloudinaryErrorMessage(res.status, data?.error?.message, creds.cloudName));
  }
  return { url: data.secure_url, publicId: data.public_id, assetId: data.asset_id };
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
  return collectCloudinaryPages(async (cursor) => {
    const params = new URLSearchParams({
      prefix: FOLDER,
      max_results: "100",
    });
    if (cursor) params.set("next_cursor", cursor);
    const url = `${API_ROOT}/${encodeURIComponent(creds.cloudName)}/resources/${resource}/upload?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: basicAuth(creds) },
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => null)) as {
      resources?: {
        secure_url: string;
        public_id: string;
        bytes: number;
        width: number;
        height: number;
      }[];
      next_cursor?: string;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      throw new Error(cloudinaryErrorMessage(res.status, data?.error?.message, creds.cloudName));
    }
    return {
      items: (data?.resources ?? []).map((item) => ({
        url: item.secure_url,
        publicId: item.public_id,
        resource,
        bytes: item.bytes,
        width: item.width,
        height: item.height,
      })),
      next: data?.next_cursor || undefined,
    };
  });
}

export async function testCloudinary(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const images = await listCloudinaryAssets("image");
    return { ok: true, count: images.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed." };
  }
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
  const info = await stat(full);
  const sizeError = rejectUploadSize(info.size);
  if (sizeError) throw new Error(sizeError);
  return readFile(full);
}
