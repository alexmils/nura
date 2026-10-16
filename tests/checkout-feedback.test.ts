import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkoutReturnNotice,
  checkoutStartNotice,
} from "@/lib/checkout-feedback";

describe("checkout return notice", () => {
  it("says the trial is ready after a successful trial checkout", () => {
    const notice = checkoutReturnNotice({
      checkout: "success",
      status: "trialing",
      canUseApp: true,
    });
    assert.equal(notice?.kind, "success");
    assert.match(notice?.message ?? "", /trial is ready/i);
  });

  it("says the subscription is active after a paid checkout", () => {
    const notice = checkoutReturnNotice({
      checkout: "success",
      status: "active",
      canUseApp: true,
    });
    assert.equal(notice?.kind, "success");
    assert.match(notice?.message ?? "", /subscription is active/i);
  });

  it("does not claim success when the payment failed", () => {
    const notice = checkoutReturnNotice({
      checkout: "success",
      status: "incomplete",
      canUseApp: false,
    });
    assert.equal(notice?.kind, "error");
    assert.match(notice?.message ?? "", /did not go through/i);
  });

  it("asks for a refresh when status is still unknown", () => {
    const notice = checkoutReturnNotice({
      checkout: "success",
      status: null,
      canUseApp: false,
    });
    assert.equal(notice?.kind, "info");
    assert.match(notice?.message ?? "", /still confirming/i);
  });

  it("explains a canceled checkout", () => {
    const notice = checkoutReturnNotice({ checkout: "canceled" });
    assert.equal(notice?.kind, "info");
    assert.match(notice?.message ?? "", /canceled/i);
  });
});

describe("checkout start notice", () => {
  it("surfaces the API error", () => {
    const notice = checkoutStartNotice({
      ok: false,
      error: "Stripe checkout is not configured",
    });
    assert.equal(notice?.kind, "error");
    assert.equal(notice?.message, "Stripe checkout is not configured");
  });

  it("does not stay silent when Stripe returns no URL", () => {
    const notice = checkoutStartNotice({ ok: true, url: null });
    assert.equal(notice?.kind, "error");
    assert.match(notice?.message ?? "", /did not start/i);
  });

  it("stays quiet when redirecting to Stripe", () => {
    assert.equal(
      checkoutStartNotice({ ok: true, url: "https://checkout.stripe.com/c/pay" }),
      null
    );
  });
});
