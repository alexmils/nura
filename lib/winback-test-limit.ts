/**
 * Rate limit for admin "Send test email" on the win-back preview: a few per
 * admin per window, in memory (per server process). Enough to stop a stuck
 * button or a script from minting links and mailing in a loop.
 */
export const WINBACK_TEST_LIMIT = 5;
export const WINBACK_TEST_WINDOW_MS = 15 * 60 * 1000;

export function createSlidingLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Records the hit when allowed. retryAfterMs is set when refused. */
    take(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterMs: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterMs: windowMs - (now - recent[0]!) };
      }
      recent.push(now);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}

const globalKey = "__nuraWinbackTestLimiter";
type G = typeof globalThis & { [globalKey]?: ReturnType<typeof createSlidingLimiter> };

/** Shared across hot reloads in dev. */
export function winbackTestLimiter() {
  const g = globalThis as G;
  g[globalKey] ??= createSlidingLimiter(WINBACK_TEST_LIMIT, WINBACK_TEST_WINDOW_MS);
  return g[globalKey]!;
}
