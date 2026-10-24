import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BILLING_PLANS } from "../lib/billing-constants";
import {
  CHECKOUT_FEATURES,
  CHECKOUT_PLAN_SUMMARY,
  checkoutUpsell,
  formatMoney,
  passwordOk,
  passwordRules,
  payButtonLabel,
  priceNumber,
  trialBillingStart,
  yearlySavingBadge,
} from "../lib/checkout-summary";
import { validatePassword } from "../lib/auth/password";

test("priceNumber and formatMoney", () => {
  assert.equal(priceNumber("$14.99"), 14.99);
  assert.equal(priceNumber("free"), null);
  assert.equal(formatMoney(80), "$80");
  assert.equal(formatMoney(8.25), "$8.25");
});

test("upsell: weekly and monthly offer Yearly savings, yearly shows per-month value", () => {
  assert.deepEqual(checkoutUpsell(BILLING_PLANS, "monthly"), { kind: "switch", target: "yearly", save: "$80" });
  assert.deepEqual(checkoutUpsell(BILLING_PLANS, "weekly"), { kind: "switch", target: "yearly", save: "$160" });
  assert.deepEqual(checkoutUpsell(BILLING_PLANS, "yearly"), { kind: "value", perMonth: "$8.25" });
  assert.equal(checkoutUpsell({ monthly: BILLING_PLANS.monthly }, "monthly"), null);
  assert.equal(yearlySavingBadge(BILLING_PLANS), "Save $80");
});

test("trial billing start date and pay label", () => {
  assert.equal(trialBillingStart(7, new Date("2026-10-24T12:00:00Z")), "October 31, 2026");
  assert.equal(payButtonLabel(BILLING_PLANS.yearly, 7), "Start free trial");
  assert.equal(payButtonLabel(BILLING_PLANS.monthly, 0), "Pay $14.99");
});

test("password checklist matches server validation", () => {
  for (const pw of ["", "short1", "longenough", "12345678", "abcdefg1", "Passw0rd!"]) {
    assert.equal(passwordOk(pw), validatePassword(pw) === null, pw);
  }
  assert.deepEqual(passwordRules("abc").map((r) => r.ok), [false, true, false]);
});

test("checkout copy follows brand rules", () => {
  const view = readFileSync("app/components/checkout/CheckoutView.tsx", "utf8");
  const copy = [...CHECKOUT_FEATURES, ...Object.values(CHECKOUT_PLAN_SUMMARY), view].join("\n");
  assert.ok(!copy.includes("\u2014"), "no em dash");
  assert.ok(!/\bBLS\b/.test(copy));
  assert.ok(!/moving ball/i.test(copy));
  assert.ok(!/Free session/.test(copy));
});

test("checkout page is full-screen (no marketing shell) and keeps consent/tags", () => {
  const page = readFileSync("app/checkout/page.tsx", "utf8");
  assert.ok(!page.includes("<FrontendShell"));
  assert.ok(page.includes("<MarketingExtras />"));
});
