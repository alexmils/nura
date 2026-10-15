import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentMethodFromStripe } from "@/lib/billing-manage-server";

describe("billing manage", () => {
  it("formats card payment methods from Stripe", () => {
    const pm = paymentMethodFromStripe({
      id: "pm_1",
      object: "payment_method",
      type: "card",
      card: {
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2028,
      },
    } as import("stripe").Stripe.PaymentMethod);
    assert.deepEqual(pm, {
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2028,
    });
  });

  it("returns null for non-card methods", () => {
    assert.equal(
      paymentMethodFromStripe({
        id: "pm_2",
        object: "payment_method",
        type: "link",
      } as import("stripe").Stripe.PaymentMethod),
      null
    );
  });
});
