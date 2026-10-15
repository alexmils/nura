/**
 * Cloudflare Turnstile — server-side siteverify helpers.
 * Tokens are single-use; always call siteverify from the backend (never the browser).
 */

import {
  TURNSTILE_TOKEN_FIELD,
  type TurnstileAction,
} from "@/lib/turnstile-shared";

export {
  TURNSTILE_SITE_KEY,
  TURNSTILE_TOKEN_FIELD,
  type TurnstileAction,
} from "@/lib/turnstile-shared";

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileSiteverifyResult = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
  challenge_ts?: string;
  cdata?: string;
};

export function turnstileHostnames(): Set<string> {
  return new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean)
  );
}

function siteverifyTimeoutMs(): number {
  const raw = process.env.TURNSTILE_SITEVERIFY_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 25_000;
  return Number.isFinite(n) && n >= 5_000 ? n : 25_000;
}

function devTurnstileBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.TURNSTILE_BYPASS_DEV === "true"
  );
}

function logTurnstileDevFailure(
  reason: string,
  detail?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn("[turnstile]", reason, detail ?? "");
}

export function extractTurnstileToken(
  body: Record<string, unknown> | null | undefined
): string {
  if (!body) return "";
  const raw = body[TURNSTILE_TOKEN_FIELD];
  return typeof raw === "string" ? raw : "";
}

export function isPlausibleTurnstileToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    token.length > 0 &&
    token.length <= 2048
  );
}

/**
 * Canonical siteverify: success, expected action, approved hostname.
 * Returns a failure payload or ok when verification passes.
 */
export async function verifyTurnstileToken(options: {
  token: unknown;
  expectedAction: TurnstileAction;
  remoteip?: string | null;
}): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  const secret = process.env.TURNSTILE_SECRET?.trim() ?? "";
  const expectedHostnames = turnstileHostnames();
  const { token, expectedAction, remoteip } = options;

  if (!isPlausibleTurnstileToken(token) || expectedHostnames.size === 0) {
    logTurnstileDevFailure("missing token or TURNSTILE_HOSTNAMES");
    return {
      ok: false,
      status: 403,
      error: "Verification failed. Refresh and try again.",
    };
  }

  if (!secret) {
    logTurnstileDevFailure("TURNSTILE_SECRET not set");
    return {
      ok: false,
      status: 403,
      error: "Verification failed. Refresh and try again.",
    };
  }

  if (devTurnstileBypassEnabled()) {
    logTurnstileDevFailure("TURNSTILE_BYPASS_DEV=true — siteverify skipped");
    return { ok: true };
  }

  let result: TurnstileSiteverifyResult;
  try {
    const params = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteip) params.set("remoteip", remoteip);

    const r = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(siteverifyTimeoutMs()),
      body: params,
    });
    if (!r.ok) {
      logTurnstileDevFailure("siteverify HTTP error", { status: r.status });
      return {
        ok: false,
        status: 403,
        error: "Verification failed. Refresh and try again.",
      };
    }
    result = (await r.json()) as TurnstileSiteverifyResult;
  } catch (err) {
    logTurnstileDevFailure("siteverify request failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      status: 403,
      error: "Verification failed. Refresh and try again.",
    };
  }

  const hostname = result.hostname?.trim().toLowerCase() ?? "";
  if (
    !result.success ||
    result.action !== expectedAction ||
    !hostname ||
    !expectedHostnames.has(hostname)
  ) {
    logTurnstileDevFailure("siteverify rejected", {
      success: result.success,
      action: result.action,
      expectedAction,
      hostname,
      codes: result["error-codes"],
    });
    return {
      ok: false,
      status: 403,
      error: "Verification failed. Refresh and try again.",
    };
  }

  return { ok: true };
}
