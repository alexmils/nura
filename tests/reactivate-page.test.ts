import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  formatInviteDate,
  inviteGreeting,
  REACTIVATE_CLOSED_COPY,
  REACTIVATE_INCLUDED,
} from "../app/components/ReactivateOfferView";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("/reactivate personal invite", () => {
  it("greets by first name, falls back without one", () => {
    assert.equal(inviteGreeting("Ana Petrovic"), "Hi Ana, this is your personal invite");
    assert.equal(inviteGreeting("  "), "Hi, this is your personal invite");
    assert.equal(inviteGreeting(null), "Hi, this is your personal invite");
  });
  it("formats dates the same on server and client", () => {
    assert.equal(formatInviteDate("2026-11-23T23:30:00.000Z"), "November 23, 2026");
    assert.equal(formatInviteDate(null), "");
    assert.equal(formatInviteDate("nope"), "");
  });
  it("covers every closed state with a next step", () => {
    for (const k of ["used", "expired", "invalid", "already_active", "wrong_account"] as const) {
      assert.ok(REACTIVATE_CLOSED_COPY[k].title && REACTIVATE_CLOSED_COPY[k].body, k);
    }
    assert.equal(REACTIVATE_CLOSED_COPY.expired.cta, "support");
    assert.equal(REACTIVATE_CLOSED_COPY.already_active.cta, "app");
    assert.ok(REACTIVATE_INCLUDED.length >= 3);
  });
  it("takes the payment on the page (with the hosted page as fallback)", () => {
    const view = read("app/components/ReactivateOfferView.tsx");
    assert.match(view, /ui: "elements"/);
    assert.match(view, /PaymentElement/);
    assert.match(view, /window\.location\.assign\(data\.url\)/);
    const route = read("app/api/reactivate/checkout/route.ts");
    assert.match(route, /clientSecret/);
  });
  it("only promises a reminder email when one is really sent", () => {
    const page = read("app/reactivate/page.tsx");
    assert.match(page, /activeStripeLivemode/);
    assert.match(page, /reminderDays=\{reminderDays\}/);
  });
  it("never names the payment processor to members", () => {
    for (const p of [
      "app/components/ReactivateOfferView.tsx",
      "app/reactivate/page.tsx",
    ]) {
      const text = read(p)
        .split("\n")
        .filter((l) => !/^\s*(import|\/\/|\*|\/\*)/.test(l) && !/from "/.test(l))
        .join("\n");
      assert.doesNotMatch(text.replace(/activeStripeLivemode|getStripeConfig|stripe=\{|Stripe\.js/g, ""), /stripe/i, p);
    }
  });
});
