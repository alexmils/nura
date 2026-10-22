/** Pure sign-in guard rules. Persistence lives in `lib/login-guard.ts`. */

export const LOGIN_GUARD_DEFAULTS = {
  maxAttempts: 5,
  windowMinutes: 15,
  lockMinutes: 30,
} as const;

/**
 * Root paths the site already owns. The private sign-in path is a single root
 * segment, so it must never shadow a real page (or a reserved API/console one).
 */
export const RESERVED_GUARD_SLUGS = new Set([
  "_next",
  "about",
  "admin",
  "api",
  "app",
  "billing",
  "blog",
  "brand-assets",
  "changelog",
  "checkout",
  "create-account",
  "create-password",
  "dev",
  "editorial",
  "emdr",
  "entry",
  "faq",
  "forgot-password",
  "health",
  "knowledge",
  "learn",
  "limits",
  "login",
  "og",
  "og-image",
  "onboarding",
  "pricing",
  "privacy",
  "reset-password",
  "safety",
  "settings",
  "signup",
  "support",
  "terms",
]);

/** 6–64 chars, starts with a letter, letters/numbers/hyphens only. */
/**
 * Production needs 6 characters so the private path is not guessable. `next
 * dev` allows 3 so a local address is quick to type. Reserved root paths stay
 * blocked either way: they already belong to a real page.
 */
export const GUARD_SLUG_MIN_LENGTH =
  process.env.NODE_ENV === "development" ? 3 : 6;

const SLUG_RE = new RegExp(
  `^[A-Za-z][A-Za-z0-9-]{${GUARD_SLUG_MIN_LENGTH - 1},63}$`
);

/** Failures that spend the attempt budget: the credentials were not proven. */
export const LOCKOUT_OUTCOMES = [
  "bad_password",
  "unknown_user",
  "disabled",
] as const;

/**
 * Proven credentials on the wrong sign-in page for the role. Recorded for the
 * Security log, but never counted toward IP or email locks.
 */
export const WRONG_SURFACE_OUTCOMES = ["staff_public", "consumer_gate"] as const;

const FAILURE_OUTCOMES = [...LOCKOUT_OUTCOMES, ...WRONG_SURFACE_OUTCOMES] as const;

export type LoginFailureOutcome = (typeof FAILURE_OUTCOMES)[number];
export type WrongSurfaceOutcome = (typeof WRONG_SURFACE_OUTCOMES)[number];

/** Shown only after the password, Google account, or passkey is verified. */
export const STAFF_ON_PUBLIC_MESSAGE =
  "This account must sign in through the admin sign-in page.";
export const MEMBER_ON_GATE_MESSAGE =
  "This sign-in page is for staff only. Use the regular sign-in page.";

export type LoginAttemptOutcome =
  | LoginFailureOutcome
  | "ok"
  | "blocked_ip"
  | "locked";

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "platform_admin" || role === "support";
}

export function wrongSurfaceOutcome(
  role: string | null | undefined
): WrongSurfaceOutcome {
  return isStaffRole(role) ? "staff_public" : "consumer_gate";
}

export function wrongSurfaceMessage(role: string | null | undefined): string {
  return isStaffRole(role) ? STAFF_ON_PUBLIC_MESSAGE : MEMBER_ON_GATE_MESSAGE;
}

/** Staff only on a matching operator gate. Everyone else only on public sign-in. */
export function roleMayUseSurface(
  role: string | null | undefined,
  gateAccepted: boolean
): boolean {
  if (isStaffRole(role)) return gateAccepted;
  return !gateAccepted;
}

export function normalizeGuardSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidGuardSlug(value: string): boolean {
  const slug = value.trim();
  if (!SLUG_RE.test(slug)) return false;
  return !RESERVED_GUARD_SLUGS.has(slug.toLowerCase());
}

export function slugError(value: string): string | null {
  const slug = value.trim();
  if (isValidGuardSlug(slug)) return null;
  if (SLUG_RE.test(slug)) {
    return "That address is already used by the site. Pick another.";
  }
  return `Use ${GUARD_SLUG_MIN_LENGTH} to 64 letters, numbers, or hyphens, and start with a letter.`;
}

export function normalizeGuardIp(ip: string | null | undefined): string {
  const value = (ip ?? "").trim().toLowerCase();
  return value || "unknown";
}

export function normalizeGuardEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    n = (n * 256 + value) >>> 0;
  }
  return n;
}

export function isValidGuardAddress(entry: string): boolean {
  const value = entry.trim().toLowerCase();
  if (!value || value === "unknown") return false;
  if (ipv4ToInt(value) != null) return true;
  if (value.includes(":") && /^[0-9a-f:]+$/.test(value)) return true;
  const slash = value.indexOf("/");
  if (slash <= 0) return false;
  const bits = Number(value.slice(slash + 1));
  if (!Number.isInteger(bits) || bits < 1 || bits > 32) return false;
  return ipv4ToInt(value.slice(0, slash)) != null;
}

export function ipMatchesEntry(ip: string, entry: string): boolean {
  const subject = ip.trim().toLowerCase();
  const rule = entry.trim().toLowerCase();
  if (!subject || !rule || subject === "unknown") return false;
  if (subject === rule) return true;
  const slash = rule.indexOf("/");
  if (slash <= 0) return false;
  const bits = Number(rule.slice(slash + 1));
  const ipN = ipv4ToInt(subject);
  const baseN = ipv4ToInt(rule.slice(0, slash));
  if (
    ipN == null ||
    baseN == null ||
    !Number.isInteger(bits) ||
    bits < 1 ||
    bits > 32
  ) {
    return false;
  }
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

const INTERNAL_V4_RANGES = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
] as const;

/**
 * True for loopback, RFC 1918, and IPv6 ULA (fc00::/7) addresses. Seeing one as
 * the client IP means the proxy chain dropped the real address.
 */
export function isPrivateOrInternalIp(ip: string | null | undefined): boolean {
  let value = (ip ?? "").trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  if (!value || value === "unknown") return false;
  if (value.startsWith("::ffff:") && ipv4ToInt(value.slice(7)) != null) {
    value = value.slice(7);
  }
  if (ipv4ToInt(value) != null) {
    return INTERNAL_V4_RANGES.some((range) => ipMatchesEntry(value, range));
  }
  if (!value.includes(":") || !/^[0-9a-f:]+$/.test(value)) return false;
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  const first = value.split(":")[0];
  if (!first) return false;
  const hextet = parseInt(first, 16);
  return Number.isFinite(hextet) && (hextet & 0xfe00) === 0xfc00;
}

/** IP-based counting and locks only apply to a real, public client address. */
export function ipLockable(ip: string | null | undefined): boolean {
  const value = (ip ?? "").trim().toLowerCase();
  return Boolean(value) && value !== "unknown" && !isPrivateOrInternalIp(value);
}

export function ipListed(ip: string, list: readonly string[]): boolean {
  return list.some((entry) => ipMatchesEntry(ip, entry));
}

export function parseAddressList(
  raw: string
): { ok: true; list: string[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const line of raw.split(/[\n,]+/)) {
    const value = line.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    if (!isValidGuardAddress(value)) {
      return { ok: false, error: `Not a valid address: ${line.trim()}` };
    }
    seen.add(value);
    list.push(value);
    if (list.length > 200) {
      return { ok: false, error: "Keep the list to 200 addresses." };
    }
  }
  return { ok: true, list };
}

export function clampGuardNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export type GuardDecision =
  | { allow: true }
  | {
      allow: false;
      status: 403 | 429;
      error: string;
      outcome: "blocked_ip" | "locked";
    };

export function decideGuard(input: {
  ip: string;
  whitelist: readonly string[];
  blocklist: readonly string[];
  maxAttempts: number;
  ipFailures: number;
  emailFailures: number;
  ipLocked: boolean;
  emailLocked: boolean;
}): GuardDecision {
  if (ipListed(input.ip, input.whitelist)) return { allow: true };
  if (ipListed(input.ip, input.blocklist)) {
    return {
      allow: false,
      status: 403,
      error: "Sign-in is not available from this network.",
      outcome: "blocked_ip",
    };
  }
  const ipHot =
    ipLockable(input.ip) &&
    (input.ipLocked || input.ipFailures >= input.maxAttempts);
  if (ipHot || input.emailLocked || input.emailFailures >= input.maxAttempts) {
    return {
      allow: false,
      status: 429,
      error: "Too many attempts. Try again later.",
      outcome: "locked",
    };
  }
  return { allow: true };
}

/** Only failures with unproven credentials count toward IP or email locks. */
export function countsAsFailure(outcome: string): boolean {
  return (LOCKOUT_OUTCOMES as readonly string[]).includes(outcome);
}

export function newGuardSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const rest = `${letters}0123456789`;
  let slug = letters[bytes[0]! % letters.length]!;
  for (let i = 1; i < bytes.length; i += 1) {
    slug += rest[bytes[i]! % rest.length];
  }
  return slug;
}
