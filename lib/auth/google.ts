import { SignJWT, jwtVerify } from "jose";
import { APP_BASE, safeAppNext } from "@/lib/app-base";
import { isValidGuardSlug } from "@/lib/login-guard-policy";
import {
  parseGoogleReturnTo,
  type GoogleOAuthReturnTo,
} from "@/lib/auth/google-ui";

export {
  canAutoLinkGoogleAccount,
  googleAuthErrorMessage,
  googleAuthErrorPath,
  isPgUniqueViolation,
  parseGoogleReturnTo,
  type GoogleOAuthReturnTo,
} from "@/lib/auth/google-ui";

export const GOOGLE_OAUTH_COOKIE = "emdr_google_oauth";
export const GOOGLE_OAUTH_SCOPES = "openid email profile";

const STATE_TTL = "10m";

export type GoogleOAuthState = {
  nonce: string;
  next: string;
  returnTo: GoogleOAuthReturnTo;
  /** Origin used for redirect_uri + post-login redirects (cookie host). */
  appBase: string;
  /** Operator sign-in slug. Absent on the public login screen. */
  gate?: string;
};

export type GoogleUserInfo = {
  email: string;
  emailVerified: boolean;
  name: string | null;
  sub: string;
};

export type GoogleOAuthCredentialSource = "google" | "gmail_fallback";

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set (min 32 chars). Generate: openssl rand -base64 32"
    );
  }
  return new TextEncoder().encode(secret);
}

/** Prefer dedicated Google sign-in env; Gmail OAuth only as non-production fallback. */
export function getGoogleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
  source: GoogleOAuthCredentialSource;
} | null {
  const googleId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (googleId && googleSecret) {
    return { clientId: googleId, clientSecret: googleSecret, source: "google" };
  }

  const allowGmailFallback = process.env.NODE_ENV !== "production";
  if (!allowGmailFallback) return null;

  const gmailId = process.env.GMAIL_CLIENT_ID?.trim() || "";
  const gmailSecret = process.env.GMAIL_CLIENT_SECRET?.trim() || "";
  if (gmailId && gmailSecret) {
    console.warn(
      "[auth/google] Using GMAIL_CLIENT_ID/SECRET fallback — set GOOGLE_CLIENT_ID/SECRET for Sign-In."
    );
    return {
      clientId: gmailId,
      clientSecret: gmailSecret,
      source: "gmail_fallback",
    };
  }
  return null;
}

export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthCredentials() !== null;
}

/** Prefer Secure cookies on HTTPS (tunnel/prod), not only NODE_ENV=production. */
export function shouldUseSecureAuthCookies(publicAppUrl: string): boolean {
  try {
    return (
      process.env.NODE_ENV === "production" ||
      new URL(publicAppUrl).protocol === "https:"
    );
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function normalizeOrigin(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Public origin for this OAuth attempt — matches the browser host (and cookie).
 * Uses x-forwarded-* when TRUST_PROXY is on (Cloudflare tunnel).
 * Never redirects across hosts (that caused localhost↔APP_URL 307 loops).
 */
export function resolveOAuthAppBase(
  request: Request,
  configuredAppUrl: string
): string {
  const reqUrl = new URL(request.url);
  const configured = normalizeOrigin(configuredAppUrl) ?? reqUrl.origin;

  const allow = new Set<string>([
    configured,
    "http://localhost:3471",
    "http://127.0.0.1:3471",
  ]);

  const trustProxy =
    process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";

  if (trustProxy) {
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      "https";
    if (host) {
      const fromForwarded = normalizeOrigin(`${proto}://${host}`);
      if (fromForwarded && allow.has(fromForwarded)) return fromForwarded;
    }
  }

  if (allow.has(reqUrl.origin)) return reqUrl.origin;
  return configured;
}

export async function createGoogleOAuthState(
  input: Omit<GoogleOAuthState, "nonce"> & { nonce?: string }
): Promise<{ state: string; nonce: string }> {
  const nonce = input.nonce ?? crypto.randomUUID();
  const next = safeAppNext(input.next, APP_BASE);
  const appBase = normalizeOrigin(input.appBase) ?? input.appBase;
  const gate =
    input.gate && isValidGuardSlug(input.gate) ? input.gate : undefined;
  const state = await new SignJWT({
    nonce,
    next,
    returnTo: input.returnTo,
    appBase,
    ...(gate ? { gate } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(getAuthSecret());
  return { state, nonce };
}

export async function verifyGoogleOAuthState(
  state: string,
  configuredAppUrl?: string
): Promise<GoogleOAuthState | null> {
  try {
    const { payload } = await jwtVerify(state, getAuthSecret());
    if (typeof payload.nonce !== "string" || !payload.nonce) return null;
    const returnTo = parseGoogleReturnTo(
      typeof payload.returnTo === "string" ? payload.returnTo : undefined
    );
    const next = safeAppNext(
      typeof payload.next === "string" ? payload.next : undefined,
      APP_BASE
    );
    const fallback =
      normalizeOrigin(configuredAppUrl ?? "") ?? "http://localhost:3471";
    const appBaseRaw =
      typeof payload.appBase === "string" ? payload.appBase : fallback;
    const appBase = normalizeOrigin(appBaseRaw) ?? fallback;
    const gate =
      typeof payload.gate === "string" && isValidGuardSlug(payload.gate)
        ? payload.gate
        : undefined;
    return { nonce: payload.nonce, next, returnTo, appBase, gate };
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES);
  url.searchParams.set("state", input.state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Google token exchange failed"
    );
  }
  return { accessToken: data.access_token };
}

export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    error?: string;
  };
  if (!res.ok || !data.email || !data.sub) {
    throw new Error(data.error || "Could not load Google profile");
  }
  const emailVerified =
    data.email_verified === true || data.email_verified === "true";
  return {
    sub: data.sub,
    email: data.email.trim().toLowerCase(),
    emailVerified,
    name: data.name?.trim() || null,
  };
}

export function googleOAuthCookieOptions(
  nonce: string,
  opts?: { secure?: boolean }
) {
  return {
    name: GOOGLE_OAUTH_COOKIE,
    value: nonce,
    httpOnly: true,
    secure: opts?.secure ?? process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
}

export function clearGoogleOAuthCookieOptions(opts?: { secure?: boolean }) {
  return {
    name: GOOGLE_OAUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: opts?.secure ?? process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
