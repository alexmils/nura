import test from "node:test";
import assert from "node:assert/strict";
import { isGuidePreviewSearch, isGuidePreviewUrl } from "../lib/guide-preview";
import { resolveAccessRedirect } from "../lib/access-gate";

test("preview param is recognised only with the exact value", () => {
  assert.equal(isGuidePreviewSearch("?tour=frost1"), true);
  assert.equal(isGuidePreviewSearch("tour=frost1&x=1"), true);
  assert.equal(isGuidePreviewSearch("?tour=frost2"), false);
  assert.equal(isGuidePreviewSearch(""), false);
});

test("preview url is only the session home", () => {
  assert.equal(isGuidePreviewUrl("/app?tour=frost1"), true);
  assert.equal(isGuidePreviewUrl("/app/?tour=frost1"), true);
  assert.equal(isGuidePreviewUrl("/app/settings?tour=frost1"), false);
  assert.equal(isGuidePreviewUrl("/app"), false);
  assert.equal(isGuidePreviewUrl("//evil.example/app?tour=frost1"), false);
  assert.equal(isGuidePreviewUrl("https://evil.example/app?tour=frost1"), false);
});

test("admins signing in via the preview link land on it, else /admin", () => {
  assert.equal(
    resolveAccessRedirect({ role: "platform_admin", next: "/app?tour=frost1" }),
    "/app?tour=frost1"
  );
  assert.equal(resolveAccessRedirect({ role: "platform_admin", next: "/app" }), "/admin");
});

test("pending onboarding does not block the preview, but missing access does", () => {
  assert.equal(
    resolveAccessRedirect({
      role: "user",
      onboardingPending: true,
      canUseApp: true,
      next: "/app?tour=frost1",
    }),
    "/app?tour=frost1"
  );
  assert.equal(
    resolveAccessRedirect({
      role: "user",
      onboardingPending: true,
      canUseApp: true,
      next: "/app",
    }),
    "/app/onboarding"
  );
  assert.equal(
    resolveAccessRedirect({
      role: "user",
      needsOnboarding: true,
      canUseApp: false,
      next: "/app?tour=frost1",
    }),
    "/app/onboarding"
  );
});
