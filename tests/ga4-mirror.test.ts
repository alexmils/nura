import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  GA4_EVENT_NAMES,
  buildGa4EventParams,
  trackMetaEvent,
} from "@/lib/meta-pixel";
import { CONSENT_STORAGE_KEY } from "@/lib/marketing-consent";

type GtagCall = [string, string, Record<string, unknown>];
type FbqCall = unknown[];

function stubWindow(consent?: { analytics: boolean; marketing: boolean }) {
  const storage = new Map<string, string>();
  if (consent) {
    storage.set(CONSENT_STORAGE_KEY, JSON.stringify({ ...consent, updatedAt: "" }));
  }
  const gtagCalls: GtagCall[] = [];
  const fbqCalls: FbqCall[] = [];
  const session = new Map<string, string>();

  // @ts-expect-error test stub
  globalThis.window = {
    dataLayer: [],
    gtag: (...args: unknown[]) => {
      gtagCalls.push(args as GtagCall);
    },
    fbq: (...args: unknown[]) => {
      fbqCalls.push(args);
    },
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
    sessionStorage: {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => session.set(k, v),
    },
  };
  return { gtagCalls, fbqCalls };
}

describe("GA4 event mirroring", () => {
  beforeEach(() => {
    // @ts-expect-error reset between tests
    delete globalThis.window;
  });

  it("never maps a browser event to GA4 purchase", () => {
    // Only the Stripe webhook may report a purchase: it is the only place that
    // knows the invoice id the delayed charge is deduplicated by.
    assert.equal(GA4_EVENT_NAMES.Purchase, "start_subscription");
    assert.equal(GA4_EVENT_NAMES.Subscribe, "start_subscription");
    assert.equal(GA4_EVENT_NAMES.StartTrial, "start_trial");
    assert.equal(GA4_EVENT_NAMES.CompleteRegistration, "sign_up");
    assert.equal(GA4_EVENT_NAMES.InitiateCheckout, "begin_checkout");
    assert.equal(GA4_EVENT_NAMES.Lead, "generate_lead");
  });

  it("sends the GA4 twin alongside the pixel", () => {
    const { gtagCalls, fbqCalls } = stubWindow();
    trackMetaEvent("InitiateCheckout", {
      value: 99,
      currency: "usd",
      content_name: "yearly",
      content_category: "subscription",
    });

    assert.equal(gtagCalls.length, 1);
    assert.equal(gtagCalls[0][0], "event");
    assert.equal(gtagCalls[0][1], "begin_checkout");
    assert.deepEqual(gtagCalls[0][2], {
      value: 99,
      currency: "USD",
      plan: "yearly",
      content_category: "subscription",
      items: [{ item_id: "yearly", item_name: "yearly", quantity: 1, price: 99 }],
    });
    assert.equal(fbqCalls[0][1], "InitiateCheckout");
  });

  it("leaves items off events that are not monetization", () => {
    const { gtagCalls } = stubWindow();
    trackMetaEvent("CompleteRegistration", { content_name: "email" });
    assert.equal(gtagCalls[0][1], "sign_up");
    assert.deepEqual(gtagCalls[0][2], { plan: "email" });
  });

  it("passes a transaction id through to both platforms", () => {
    const { gtagCalls, fbqCalls } = stubWindow();
    trackMetaEvent("Purchase", { value: 14.99 }, { transactionId: "in_123" });
    assert.equal(gtagCalls[0][2].transaction_id, "in_123");
    assert.deepEqual(fbqCalls[0][3], { eventID: "in_123" });
  });

  it("honours an explicit analytics rejection without muting Meta", () => {
    const { gtagCalls, fbqCalls } = stubWindow({ analytics: false, marketing: true });
    trackMetaEvent("InitiateCheckout", { content_name: "monthly" });
    assert.equal(gtagCalls.length, 0);
    assert.equal(fbqCalls.length, 1);
  });

  it("honours an explicit marketing rejection without muting GA4", () => {
    const { gtagCalls, fbqCalls } = stubWindow({ analytics: true, marketing: false });
    trackMetaEvent("InitiateCheckout", { content_name: "monthly" });
    assert.equal(gtagCalls.length, 1);
    assert.equal(fbqCalls.length, 0);
  });

  it("fires once per session when a onceKey is given", () => {
    const { fbqCalls } = stubWindow();
    trackMetaEvent("Subscribe", {}, { onceKey: "subscribe_checkout" });
    trackMetaEvent("Subscribe", {}, { onceKey: "subscribe_checkout" });
    assert.equal(fbqCalls.length, 1);
  });

  it("still pushes the dataLayer event for Tag Manager", () => {
    stubWindow();
    trackMetaEvent("StartTrial", { content_name: "yearly" });
    const dataLayer = (globalThis.window as { dataLayer: Record<string, unknown>[] })
      .dataLayer;
    assert.equal(dataLayer[0].event, "meta_StartTrial");
    assert.equal(dataLayer[0].meta_event, "StartTrial");
  });
});

describe("buildGa4EventParams", () => {
  it("omits everything when the caller passes nothing", () => {
    assert.deepEqual(buildGa4EventParams("sign_up", undefined), {});
  });

  it("uppercases the currency and keeps the plan", () => {
    assert.deepEqual(
      buildGa4EventParams("start_trial", { currency: "eur", content_name: "weekly" }),
      {
        currency: "EUR",
        plan: "weekly",
        items: [{ item_id: "weekly", item_name: "weekly", quantity: 1 }],
      }
    );
  });

  it("adds a price to the item only when a value is known", () => {
    assert.deepEqual(
      buildGa4EventParams("begin_checkout", { content_name: "yearly", value: 99 })
        .items,
      [{ item_id: "yearly", item_name: "yearly", quantity: 1, price: 99 }]
    );
  });
});
