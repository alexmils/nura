import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyReactivationExtension,
  buildReactivationExtendParams,
  extensionMarker,
  extensionTrialEnd,
  isExtendableSubscription,
  isExtensionMarker,
  type StripeSubscriptionsLike,
} from "../lib/reactivation-extend";
import { reactivationState, REACTIVATION_TRIAL_KIND } from "../lib/reactivation-rules";
import { mapStripeSubscription } from "../lib/stripe-admin";
import { buildWinbackEmailDraft, winbackModeFor, WINBACK_MODE_NOTE } from "../lib/problem-report-rules";

const DAY_S = 24 * 60 * 60;
const now = new Date("2026-10-24T12:00:00Z");
const nowS = Math.floor(now.getTime() / 1000);

type Call = { id: string; params: Record<string, unknown>; options?: { idempotencyKey?: string } };

/** In-memory Stripe: no network. */
function mockStripe(sub: Record<string, unknown>) {
  const calls: Call[] = [];
  let current = { ...sub };
  const stripe: StripeSubscriptionsLike = {
    subscriptions: {
      async retrieve(id) {
        assert.equal(id, current.id);
        return current as never;
      },
      async update(id, params, options) {
        calls.push({ id, params: params as Record<string, unknown>, options });
        current = {
          ...current,
          status: "trialing",
          trial_end: params.trial_end,
          metadata: { ...(current.metadata as object), ...(params.metadata as object) },
        };
        return current as never;
      },
    },
  };
  return { stripe, calls, get current() { return current; } };
}

describe("reactivation state for problem-report links", () => {
  const offer = { expiresAt: new Date(now.getTime() + 10 * DAY_S * 1000), usedAt: null };
  const paying = { status: "active", cancelAtPeriodEnd: false };
  it("a paying member gets 'extend' only when the link allows it", () => {
    assert.equal(reactivationState({ offer, subscription: paying, now }), "already_active");
    assert.equal(reactivationState({ offer, subscription: paying, allowExtend: true, now }), "extend");
    assert.equal(
      reactivationState({ offer, subscription: { status: "trialing", cancelAtPeriodEnd: false }, allowExtend: true, now }),
      "extend"
    );
  });
  it("lapsed members and scheduled cancels keep the checkout trial", () => {
    for (const status of ["canceled", "past_due", "unpaid", "incomplete"]) {
      assert.equal(reactivationState({ offer, subscription: { status }, allowExtend: true, now }), "valid", status);
    }
    assert.equal(
      reactivationState({ offer, subscription: { status: "active", cancelAtPeriodEnd: true }, allowExtend: true, now }),
      "valid"
    );
    assert.equal(reactivationState({ offer, subscription: null, allowExtend: true, now }), "valid");
  });
  it("used and expired links stay closed", () => {
    assert.equal(reactivationState({ offer: { ...offer, usedAt: now }, subscription: paying, allowExtend: true, now }), "used");
    assert.equal(
      reactivationState({ offer: { ...offer, expiresAt: new Date(now.getTime() - 1000) }, subscription: paying, allowExtend: true, now }),
      "expired"
    );
  });
});

describe("extension date", () => {
  it("moves the next payment 30 days later", () => {
    const periodEnd = nowS + 8 * DAY_S;
    assert.equal(extensionTrialEnd({ status: "active", currentPeriodEnd: periodEnd }, now), periodEnd + 30 * DAY_S);
  });
  it("uses the trial end while trialing", () => {
    const trialEnd = nowS + 3 * DAY_S;
    assert.equal(
      extensionTrialEnd({ status: "trialing", currentPeriodEnd: nowS + 99 * DAY_S, trialEnd }, now),
      trialEnd + 30 * DAY_S
    );
  });
  it("is never less than 30 days from now and caps at Stripe's 730 days", () => {
    assert.equal(extensionTrialEnd({ status: "active", currentPeriodEnd: nowS - DAY_S }, now), nowS + 30 * DAY_S);
    assert.equal(extensionTrialEnd({ status: "active", currentPeriodEnd: null }, now), nowS + 30 * DAY_S);
    assert.equal(extensionTrialEnd({ status: "active", currentPeriodEnd: nowS + 720 * DAY_S }, now), nowS + 730 * DAY_S);
  });
  it("only extends a paying subscription that is not leaving", () => {
    assert.ok(isExtendableSubscription({ status: "active" }));
    assert.ok(isExtendableSubscription({ status: "trialing", cancelAtPeriodEnd: false }));
    assert.equal(isExtendableSubscription({ status: "active", cancelAtPeriodEnd: true }), false);
    assert.equal(isExtendableSubscription({ status: "past_due" }), false);
    assert.equal(isExtendableSubscription(null), false);
  });
  it("marks the offer and builds no-proration params", () => {
    assert.equal(extensionMarker("sub_1"), "extend:sub_1");
    assert.ok(isExtensionMarker("extend:sub_1"));
    assert.equal(isExtensionMarker("cs_test_1"), false);
    const p = buildReactivationExtendParams({ offerId: "off_1", trialEnd: 123, now });
    assert.equal(p.trial_end, 123);
    assert.equal(p.proration_behavior, "none");
    const meta = p.metadata as Record<string, string>;
    assert.equal(meta.nura_trial_kind, REACTIVATION_TRIAL_KIND);
    assert.equal(meta.reactivation_offer_id, "off_1");
  });
});

describe("applyReactivationExtension (mocked Stripe)", () => {
  const periodEnd = nowS + 8 * DAY_S;
  const active = {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: periodEnd,
    trial_end: null,
    metadata: { user_id: "u1" },
    customer: "cus_1",
    items: { data: [{ price: { id: "price_m", unit_amount: 1500, currency: "usd" } }] },
  };

  it("updates the existing subscription once, with an idempotency key", async () => {
    const m = mockStripe(active);
    const r = await applyReactivationExtension({ stripe: m.stripe, subscriptionId: "sub_1", offerId: "off_1", now });
    assert.ok(r.ok);
    assert.equal(r.trialEnd, periodEnd + 30 * DAY_S);
    assert.equal(r.previousChargeAt, periodEnd);
    assert.equal(r.alreadyApplied, false);
    assert.equal(m.calls.length, 1);
    assert.equal(m.calls[0]!.id, "sub_1");
    assert.equal(m.calls[0]!.params.proration_behavior, "none");
    assert.equal(m.calls[0]!.options?.idempotencyKey, "reactivation-extend:off_1");
    // Same subscription keeps its user metadata; the gift is tagged.
    assert.equal((m.current.metadata as Record<string, string>).user_id, "u1");
  });

  it("a second call for the same offer changes nothing", async () => {
    const m = mockStripe(active);
    await applyReactivationExtension({ stripe: m.stripe, subscriptionId: "sub_1", offerId: "off_1", now });
    const again = await applyReactivationExtension({ stripe: m.stripe, subscriptionId: "sub_1", offerId: "off_1", now });
    assert.ok(again.ok);
    assert.equal(again.alreadyApplied, true);
    assert.equal(m.calls.length, 1);
  });

  it("refuses a subscription that is no longer paying", async () => {
    const m = mockStripe({ ...active, status: "past_due" });
    const r = await applyReactivationExtension({ stripe: m.stripe, subscriptionId: "sub_1", offerId: "off_1", now });
    assert.deepEqual(r, { ok: false, reason: "not_extendable", status: "past_due" });
    assert.equal(m.calls.length, 0);
  });

  it("the synced row is a full-access reactivation trial", async () => {
    const m = mockStripe(active);
    const r = await applyReactivationExtension({ stripe: m.stripe, subscriptionId: "sub_1", offerId: "off_1", now });
    assert.ok(r.ok);
    const mapped = mapStripeSubscription(r.subscription as never, { monthly: "price_m" } as never);
    assert.equal(mapped.status, "trialing");
    assert.equal(mapped.trialKind, REACTIVATION_TRIAL_KIND);
    assert.equal(new Date(mapped.trialEndsAt!).getTime() / 1000, periodEnd + 30 * DAY_S);
  });
});

describe("win-back email per mode", () => {
  const link = "https://dev.nurahelp.com/reactivate?token=abcDEF123_-abcDEF123_-abcDEF123_-xyz";
  const expiresAt = new Date("2026-11-23T00:00:00Z");
  it("paying members get the 'next 30 days' copy", () => {
    assert.equal(winbackModeFor({ status: "active", cancelAtPeriodEnd: false }), "extend");
    const d = buildWinbackEmailDraft({ to: "a@b.co", name: "Ana", link, expiresAt, mode: "extend" });
    assert.equal(d.subject, "Your next 30 days of Nura are on us");
    assert.ok(d.body.includes(link));
    assert.match(d.body, /move your next payment 30 days later/);
    assert.doesNotMatch(d.body, /checkout, but/);
    assert.match(WINBACK_MODE_NOTE.extend, /no checkout/);
  });
  it("lapsed members keep the trial copy", () => {
    assert.equal(winbackModeFor({ status: "canceled" }), "trial");
    assert.equal(winbackModeFor({ status: "active", cancelAtPeriodEnd: true }), "trial");
    assert.equal(winbackModeFor(null), "trial");
    const d = buildWinbackEmailDraft({ to: "a@b.co", link, expiresAt });
    assert.equal(d.subject, "30 days of Nura on us");
    assert.match(d.body, /You add a card at checkout/);
  });
});
