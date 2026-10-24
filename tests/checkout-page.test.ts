import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkoutBackHref,
  checkoutConflictRedirect,
  checkoutPageHref,
  checkoutReturnPath,
  parseCheckoutPlan,
  parseCheckoutSource,
} from "../lib/checkout-page.ts";

describe("checkout page helpers", () => {
  it("builds Subscribe links", () => {
    assert.equal(checkoutPageHref("yearly"), "/checkout?plan=yearly");
    assert.equal(checkoutPageHref("monthly", "pricing"), "/checkout?plan=monthly");
    assert.equal(
      checkoutPageHref("weekly", "onboarding"),
      "/checkout?plan=weekly&from=onboarding"
    );
  });

  it("parses plan and source defensively", () => {
    assert.equal(parseCheckoutPlan("monthly"), "monthly");
    assert.equal(parseCheckoutPlan("gold"), "yearly");
    assert.equal(parseCheckoutPlan(null), "yearly");
    assert.equal(parseCheckoutSource("billing"), "billing");
    assert.equal(parseCheckoutSource("https://evil.example"), "pricing");
    assert.equal(parseCheckoutSource(undefined), "pricing");
  });

  it("returns to the existing success handlers", () => {
    assert.equal(
      checkoutReturnPath("onboarding", "success"),
      "/app/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}"
    );
    assert.equal(
      checkoutReturnPath("billing", "success"),
      "/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}"
    );
    assert.equal(checkoutReturnPath("billing", "canceled"), "/app/billing?checkout=canceled");
  });

  it("sends existing subscribers to Manage billing", () => {
    assert.equal(checkoutConflictRedirect("already_subscribed"), "/app/billing/manage");
    assert.equal(checkoutConflictRedirect("use_portal"), "/app/billing/manage");
    assert.equal(checkoutConflictRedirect("other"), null);
  });

  it("picks a sensible back link", () => {
    assert.equal(checkoutBackHref("pricing", false), "/pricing");
    assert.equal(checkoutBackHref("onboarding", true), "/app/onboarding");
    assert.equal(checkoutBackHref("billing", true), "/app/billing");
    assert.equal(checkoutBackHref("billing", false), "/pricing");
  });
});
