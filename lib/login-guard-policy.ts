/** Pure sign-in guard rules. Persistence lives in `lib/login-guard.ts`. */

export const ADMIN_GATE_PREFIX = "/entry";

export const LOGIN_GUARD_DEFAULTS = {
  maxAttempts: 5,
  windowMinutes: 15,
  lockMinutes: 30,
} as const;

const SLUG_RE = /^[A-Za-z0-9_-]{16,64}$/;

const FAILURE_OUTCOMES = [
  "bad_password",
  "unknown_user",
  "staff_public",
  "consumer_gate",
  "disabled",
] as const;

export type LoginFailureOutcome = (typeof FAILURE_OUTCOMES)[number];

export type LoginAttemptOutcome =
  | LoginFailureOutcome
  | "ok"
  | "blocked_ip"
  | "locked";

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "platform_admin" || role === "support";
}

/** Staff only on a matching operator gate. Everyone else only on public sign-in. */
export function roleMayUseSurface(
  role: string | null | undefined,
  gateAccepted: boolean
): boolean {
  if (isStaffRole(role)) return gateAccepted;
  return !gateAccepted;
}

export function isValidGuardSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

export function slugError(value: string): string | null {
  const slug = value.trim();
  if (isValidGuardSlug(slug)) return null;
  return "Use 16 to 64 letters, numbers, hyphens, or underscores.";
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
    input.ip !== "unknown" &&
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

export function countsAsFailure(outcome: string): boolean {
  return (FAILURE_OUTCOMES as readonly string[]).includes(outcome);
}

export function newGuardSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(bytes).toString("base64url");
}
