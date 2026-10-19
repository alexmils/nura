import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import {
  canAutoLinkGoogleAccount,
  googleAuthErrorMessage,
  googleAuthErrorPath,
  isPgUniqueViolation,
  parseGoogleReturnTo,
} from "../lib/auth/google-ui.ts";
import {
  buildGoogleAuthorizeUrl,
  createGoogleOAuthState,
  shouldUseSecureAuthCookies,
  verifyGoogleOAuthState,
} from "../lib/auth/google.ts";

describe("parseGoogleReturnTo", () => {
  it("defaults to login", () => {
    assert.equal(parseGoogleReturnTo(null), "login");
    assert.equal(parseGoogleReturnTo("signup"), "login");
    assert.equal(parseGoogleReturnTo("create-account"), "create-account");
  });
});

describe("googleAuthErrorPath", () => {
  it("routes errors to the right auth screen", () => {
    assert.equal(
      googleAuthErrorPath("login", "google"),
      "/app/login?error=google"
    );
    assert.equal(
      googleAuthErrorPath("create-account", "google_cancelled"),
      "/app/create-account?error=google_cancelled"
    );
    assert.equal(
      googleAuthErrorPath("login", "google_denied", "abcdefghijklmnop"),
      "/entry/abcdefghijklmnop?error=google_denied"
    );
  });
});

describe("googleAuthErrorMessage", () => {
  it("maps known codes", () => {
    assert.match(
      googleAuthErrorMessage("google") ?? "",
      /cancelled or failed/i
    );
    assert.match(
      googleAuthErrorMessage("google_not_configured") ?? "",
      /not configured/i
    );
    assert.match(
      googleAuthErrorMessage("google_link_required") ?? "",
      /already exists/i
    );
    assert.equal(googleAuthErrorMessage("other"), null);
  });

  it("names the right sign-in page after a wrong-surface Google sign-in", () => {
    assert.match(
      googleAuthErrorMessage("google_staff_gate") ?? "",
      /admin sign-in page/
    );
    assert.match(
      googleAuthErrorMessage("google_member_gate") ?? "",
      /regular sign-in page/
    );
  });
});

describe("canAutoLinkGoogleAccount", () => {
  it("allows oauth-only, verified password, or already-linked", () => {
    assert.equal(
      canAutoLinkGoogleAccount({
        passwordHash: null,
        emailVerified: false,
      }),
      true
    );
    assert.equal(
      canAutoLinkGoogleAccount({
        passwordHash: "hash",
        emailVerified: true,
      }),
      true
    );
    assert.equal(
      canAutoLinkGoogleAccount({
        passwordHash: "hash",
        emailVerified: false,
        googleSub: "sub-1",
      }),
      true
    );
  });

  it("blocks unverified password accounts without google_sub", () => {
    assert.equal(
      canAutoLinkGoogleAccount({
        passwordHash: "hash",
        emailVerified: false,
      }),
      false
    );
  });
});

describe("isPgUniqueViolation", () => {
  it("detects postgres 23505", () => {
    assert.equal(isPgUniqueViolation({ code: "23505" }), true);
    assert.equal(isPgUniqueViolation({ code: "23503" }), false);
    assert.equal(isPgUniqueViolation(null), false);
  });
});

describe("buildGoogleAuthorizeUrl", () => {
  it("includes required OAuth params", () => {
    const url = new URL(
      buildGoogleAuthorizeUrl({
        clientId: "cid.apps.googleusercontent.com",
        redirectUri: "http://localhost:3471/api/auth/google/callback",
        state: "signed-state",
      })
    );
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(
      url.searchParams.get("client_id"),
      "cid.apps.googleusercontent.com"
    );
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "openid email profile");
    assert.equal(url.searchParams.get("state"), "signed-state");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://localhost:3471/api/auth/google/callback"
    );
  });
});

describe("shouldUseSecureAuthCookies", () => {
  it("is true for https public URLs", () => {
    assert.equal(
      shouldUseSecureAuthCookies("https://dev.nurahelp.com"),
      true
    );
  });

  it("is false for http localhost when not production", () => {
    if (process.env.NODE_ENV === "production") return;
    assert.equal(shouldUseSecureAuthCookies("http://localhost:3471"), false);
  });
});

describe("google OAuth state JWT", () => {
  before(() => {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      process.env.AUTH_SECRET = "test-auth-secret-min-32-chars-long!!";
    }
  });

  it("round-trips nonce, next, and returnTo", async () => {
    const { state, nonce } = await createGoogleOAuthState({
      next: "/app/settings",
      returnTo: "create-account",
      appBase: "http://localhost:3471",
    });
    const parsed = await verifyGoogleOAuthState(state);
    assert.ok(parsed);
    assert.equal(parsed!.nonce, nonce);
    assert.equal(parsed!.next, "/app/settings");
    assert.equal(parsed!.returnTo, "create-account");
    assert.equal(parsed!.appBase, "http://localhost:3471");
  });

  it("sanitizes unsafe next via safeAppNext", async () => {
    const { state } = await createGoogleOAuthState({
      next: "https://evil.example/phish",
      returnTo: "login",
      appBase: "http://localhost:3471",
    });
    const parsed = await verifyGoogleOAuthState(state);
    assert.ok(parsed);
    assert.equal(parsed!.next, "/app");
  });

  it("rejects tampered state", async () => {
    const { state } = await createGoogleOAuthState({
      next: "/app",
      returnTo: "login",
      appBase: "http://localhost:3471",
    });
    const bad = state.slice(0, -4) + "xxxx";
    assert.equal(await verifyGoogleOAuthState(bad), null);
  });
});

describe("resolveOAuthAppBase", () => {
  it("uses request origin when allowlisted", async () => {
    const { resolveOAuthAppBase } = await import("../lib/auth/google.ts");
    const req = new Request("http://localhost:3471/api/auth/google");
    assert.equal(
      resolveOAuthAppBase(req, "https://dev.nurahelp.com"),
      "http://localhost:3471"
    );
  });

  it("prefers forwarded host when TRUST_PROXY is on", async () => {
    const prev = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "true";
    try {
      const { resolveOAuthAppBase } = await import("../lib/auth/google.ts");
      const req = new Request("http://localhost:3471/api/auth/google", {
        headers: {
          "x-forwarded-host": "dev.nurahelp.com",
          "x-forwarded-proto": "https",
        },
      });
      assert.equal(
        resolveOAuthAppBase(req, "https://dev.nurahelp.com"),
        "https://dev.nurahelp.com"
      );
    } finally {
      process.env.TRUST_PROXY = prev;
    }
  });
});
