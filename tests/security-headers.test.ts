import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { securityHeaders } from "../lib/security-headers.ts";

function header(env: string, key: string): string {
  const found = securityHeaders(env).find((item) => item.key === key);
  assert.ok(found, key);
  return found.value;
}

describe("security headers", () => {
  it("sends the baseline on every environment", () => {
    const keys = new Set(securityHeaders("development").map((item) => item.key));
    for (const key of [
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      assert.equal(keys.has(key), true, key);
    }
    assert.equal(header("development", "X-Frame-Options"), "DENY");
    assert.equal(header("development", "Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.equal(header("development", "X-Content-Type-Options"), "nosniff");
  });

  it("pins HSTS only in production", () => {
    assert.equal(
      securityHeaders("development").some((item) => item.key === "Strict-Transport-Security"),
      false
    );
    assert.match(header("production", "Strict-Transport-Security"), /max-age=63072000/);
    assert.match(header("production", "Strict-Transport-Security"), /includeSubDomains/);
  });

  it("locks framing and plugins, and keeps the session microphone", () => {
    const csp = header("production", "Content-Security-Policy");
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /https:\/\/www\.googletagmanager\.com/);
    assert.match(csp, /upgrade-insecure-requests/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    // Stripe Checkout Elements on /checkout (script, API, card + 3DS frames).
    assert.match(csp, /script-src[^;]*https:\/\/js\.stripe\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/api\.stripe\.com/);
    assert.match(csp, /frame-src[^;]*https:\/\/hooks\.stripe\.com/);

    const policy = header("production", "Permissions-Policy");
    assert.match(policy, /camera=\(\)/);
    assert.match(policy, /geolocation=\(\)/);
    assert.match(policy, /microphone=\(self\)/);
  });

  it("allows the dev server to refresh", () => {
    const csp = header("development", "Content-Security-Policy");
    assert.match(csp, /unsafe-eval/);
    assert.match(csp, /ws:/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  });
});
