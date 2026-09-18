import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAuthLinkScreen,
  isAuthPublicPath,
  isFrontendPublicPath,
  isUnauthenticatedPublicPath,
  legacyConsolePath,
  shouldRedirectToLoginOn401,
} from "../lib/public-paths.ts";

describe("isFrontendPublicPath", () => {
  it("allows site root and legal stubs", () => {
    assert.equal(isFrontendPublicPath("/"), true);
    assert.equal(isFrontendPublicPath("/privacy"), true);
    assert.equal(isFrontendPublicPath("/terms"), true);
    assert.equal(isFrontendPublicPath("/about"), true);
    assert.equal(isFrontendPublicPath("/about/clinical-team"), true);
    assert.equal(isFrontendPublicPath("/emdr"), true);
    assert.equal(isFrontendPublicPath("/learn"), true);
    assert.equal(isFrontendPublicPath("/knowledge"), true);
    assert.equal(isFrontendPublicPath("/pricing"), true);
    assert.equal(isFrontendPublicPath("/faq"), true);
    assert.equal(isFrontendPublicPath("/support"), true);
    assert.equal(isFrontendPublicPath("/resources"), false);
    assert.equal(isFrontendPublicPath("/blog"), true);
    assert.equal(isFrontendPublicPath("/changelog"), true);
    assert.equal(isFrontendPublicPath("/editorial"), true);
    assert.equal(isFrontendPublicPath("/blog/what-is-emdr"), true);
    assert.equal(isFrontendPublicPath("/therapy"), false);
    assert.equal(isFrontendPublicPath("/therapists"), false);
  });

  it("does not treat /app as frontend", () => {
    assert.equal(isFrontendPublicPath("/app"), false);
    assert.equal(isFrontendPublicPath("/app/login"), false);
    assert.equal(isFrontendPublicPath("/app/resources"), false);
  });
});

describe("isAuthPublicPath / isUnauthenticatedPublicPath", () => {
  it("keeps email link screens open while signed in", () => {
    assert.equal(isAuthLinkScreen("/app/reset-password"), true);
    assert.equal(isAuthLinkScreen("/app/create-password"), true);
    assert.equal(isAuthLinkScreen("/app/login"), false);
    assert.equal(isAuthLinkScreen("/app/create-account"), false);
    assert.equal(isAuthLinkScreen("/app/forgot-password"), false);
    assert.equal(isAuthLinkScreen("/app/settings"), false);
  });

  it("allows auth screens under /app", () => {
    assert.equal(isAuthPublicPath("/app/login"), true);
    assert.equal(isUnauthenticatedPublicPath("/app/login"), true);
    assert.equal(isUnauthenticatedPublicPath("/app/forgot-password"), true);
    assert.equal(isUnauthenticatedPublicPath("/app/reset-password"), true);
    assert.equal(isUnauthenticatedPublicPath("/app/create-password"), true);
    assert.equal(isUnauthenticatedPublicPath("/app/create-account"), true);
    assert.equal(isUnauthenticatedPublicPath("/api/auth/register"), true);
  });

  it("prefix trap: /app itself is not public", () => {
    assert.equal(isUnauthenticatedPublicPath("/app"), false);
    assert.equal(isUnauthenticatedPublicPath("/app/settings"), false);
    assert.equal(isUnauthenticatedPublicPath("/app/resources"), false);
    assert.equal(isUnauthenticatedPublicPath("/apple"), false);
  });

  it("allows passkey login APIs and stripe webhook", () => {
    assert.equal(
      isUnauthenticatedPublicPath("/api/auth/passkey/login/options"),
      true
    );
    assert.equal(
      isUnauthenticatedPublicPath("/api/auth/passkey/login/verify"),
      true
    );
    assert.equal(isUnauthenticatedPublicPath("/api/webhooks/stripe"), true);
  });

  it("allows Google OAuth start and callback", () => {
    assert.equal(isUnauthenticatedPublicPath("/api/auth/google"), true);
    assert.equal(
      isUnauthenticatedPublicPath("/api/auth/google/callback"),
      true
    );
  });

  it("allows the public OG image route", () => {
    assert.equal(isUnauthenticatedPublicPath("/og-image"), true);
  });

  it("allows GET /health for Coolify and Docker probes", () => {
    assert.equal(isUnauthenticatedPublicPath("/health"), true);
  });

  it("allows the marketing analytics-gate", () => {
    assert.equal(
      isUnauthenticatedPublicPath("/api/marketing/analytics-gate"),
      true
    );
  });

  it("allows the marketing tags endpoint", () => {
    assert.equal(isUnauthenticatedPublicPath("/api/marketing/tags"), true);
  });

  it("allows guest help chat and transcript cron", () => {
    assert.equal(isUnauthenticatedPublicPath("/api/help/chat"), true);
    assert.equal(isUnauthenticatedPublicPath("/api/help/guest-contact"), true);
    assert.equal(
      isUnauthenticatedPublicPath("/api/cron/help-guest-transcripts"),
      true
    );
  });

  it("allows brand asset routes", () => {
    assert.equal(isUnauthenticatedPublicPath("/brand-assets/favicon"), true);
    assert.equal(isUnauthenticatedPublicPath("/brand-assets/app-logo"), true);
  });

  it("allows robots.txt and llms.txt", () => {
    assert.equal(isUnauthenticatedPublicPath("/robots.txt"), true);
    assert.equal(isUnauthenticatedPublicPath("/llms.txt"), true);
    assert.equal(isUnauthenticatedPublicPath("/sitemap.xml"), true);
  });
});

describe("shouldRedirectToLoginOn401", () => {
  it("only redirects from product console", () => {
    assert.equal(shouldRedirectToLoginOn401("/app"), true);
    assert.equal(shouldRedirectToLoginOn401("/app/settings"), true);
    assert.equal(shouldRedirectToLoginOn401("/"), false);
    assert.equal(shouldRedirectToLoginOn401("/privacy"), false);
    assert.equal(shouldRedirectToLoginOn401("/emdr"), false);
    assert.equal(shouldRedirectToLoginOn401("/learn"), false);
    assert.equal(shouldRedirectToLoginOn401("/blog"), false);
    assert.equal(shouldRedirectToLoginOn401("/app/login"), false);
    assert.equal(shouldRedirectToLoginOn401("/apple"), false);
  });
});

describe("legacyConsolePath", () => {
  it("maps old bookmarks under /app", () => {
    assert.equal(legacyConsolePath("/login"), "/app/login");
    assert.equal(legacyConsolePath("/settings"), "/app/settings");
    assert.equal(
      legacyConsolePath("/reset-password"),
      "/app/reset-password"
    );
    assert.equal(legacyConsolePath("/billing"), "/app/billing");
    assert.equal(legacyConsolePath("/onboarding"), "/app/onboarding");
    assert.equal(legacyConsolePath("/create-account"), "/app/create-account");
    assert.equal(legacyConsolePath("/about"), null);
  });
});
