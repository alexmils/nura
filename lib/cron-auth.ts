import { timingSafeEqual } from "crypto";

/**
 * Shared guard for the scheduled routes.
 *
 * The secret is compared in constant time: a plain `===` on a bearer token
 * leaks how many leading characters were right, one request at a time. The
 * length check has to come first because `timingSafeEqual` throws on buffers
 * of different sizes.
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : null;
  const header = request.headers.get("x-cron-secret")?.trim() ?? null;

  return (
    (bearer !== null && secretsEqual(bearer, secret)) ||
    (header !== null && secretsEqual(header, secret))
  );
}

function secretsEqual(value: string, secret: string): boolean {
  const a = Buffer.from(value);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
