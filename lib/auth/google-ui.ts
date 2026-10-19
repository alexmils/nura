import { APP_BASE, LOGIN_PATH } from "@/lib/app-base";
import {
  MEMBER_ON_GATE_MESSAGE,
  STAFF_ON_PUBLIC_MESSAGE,
} from "@/lib/login-guard-policy";

const GATE_SLUG = /^[A-Za-z0-9_-]{16,64}$/;

export type GoogleOAuthReturnTo = "login" | "create-account";

export function parseGoogleReturnTo(
  value: string | null | undefined
): GoogleOAuthReturnTo {
  return value === "create-account" ? "create-account" : "login";
}

export function googleAuthErrorPath(
  returnTo: GoogleOAuthReturnTo,
  code: string,
  gateSlug?: string | null
): string {
  const base =
    gateSlug && GATE_SLUG.test(gateSlug)
      ? `/entry/${gateSlug}`
      : returnTo === "create-account"
        ? `${APP_BASE}/create-account`
        : LOGIN_PATH;
  return `${base}?error=${encodeURIComponent(code)}`;
}

export function googleAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "google_not_configured":
      return "Google sign-in is not configured yet.";
    case "google_cancelled":
      return "Google sign-in was cancelled. Try again.";
    case "google_disabled":
      return "This account has been disabled.";
    case "google_unverified":
      return "Your Google email is not verified. Verify it with Google, then try again.";
    case "google_link_required":
      return "An account with this email already exists. Sign in with your password first.";
    case "google_conflict":
      return "This Google account is already linked to another Nura user.";
    case "google_staff_gate":
      return STAFF_ON_PUBLIC_MESSAGE;
    case "google_member_gate":
      return MEMBER_ON_GATE_MESSAGE;
    case "google_denied":
      return "Sign-in failed. Try again.";
    case "google_locked":
      return "Too many attempts. Try again later.";
    case "google_blocked":
      return "Sign-in is not available from this network.";
    case "google":
    default:
      if (code.startsWith("google")) {
        return "Google sign-in was cancelled or failed. Try again.";
      }
      return null;
  }
}

/**
 * Auto-link Google when the mailbox is proven or the account has no password yet.
 * Block password accounts that never verified email (avoid takeover of guessed signups).
 */
export function canAutoLinkGoogleAccount(user: {
  passwordHash: string | null;
  emailVerified: boolean;
  googleSub?: string | null;
}): boolean {
  if (user.googleSub) return true;
  if (!user.passwordHash) return true;
  return user.emailVerified;
}

export function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
