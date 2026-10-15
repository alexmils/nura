import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_PAYMENT_NOTIFY_EMAIL,
  buildAdminPaymentNotifyCopy,
  buildAdminSignupNotifyCopy,
  buildAdminTrialNotifyCopy,
  signupSourceLabel,
} from "@/lib/email/admin-payment-notify";
import {
  formatActivityBilling,
  formatActivitySignup,
} from "@/lib/admin-activity-format";

describe("admin payment notify", () => {
  it("pins the operator inbox", () => {
    assert.equal(ADMIN_PAYMENT_NOTIFY_EMAIL, "amilosavljevic09@gmail.com");
  });

  it("puts amount, plan, and customer in the subject and body", () => {
    const { subject, text, html } = buildAdminPaymentNotifyCopy({
      customerEmail: "alex@example.com",
      customerName: "Alex",
      planLabel: "Monthly",
      amount: "$14.99",
      paidAt: "September 21, 2026",
      adminUserUrl: "https://nurahelp.com/admin/users/u1",
    });
    assert.equal(subject, "Payment received: $14.99 · Monthly");
    assert.match(text, /alex@example\.com/);
    assert.match(text, /\$14\.99/);
    assert.match(text, /Monthly/);
    assert.match(text, /https:\/\/nurahelp\.com\/admin\/users\/u1/);
    assert.match(html, /Alex/);
    assert.match(html, /\$14\.99/);
    assert.equal(html.includes("<script>"), false);
  });

  it("escapes a name that carries markup", () => {
    const { html } = buildAdminPaymentNotifyCopy({
      customerEmail: "a@b.com",
      customerName: "<script>x</script>",
      planLabel: "Weekly",
      amount: "$4.99",
      paidAt: "September 22, 2026",
      adminUserUrl: "https://nurahelp.com/admin/users/u1",
    });
    assert.equal(html.includes("<script>"), false);
    assert.match(html, /&lt;script&gt;/);
  });
});

describe("admin trial notify", () => {
  it("names the plan, a zero charge, the trial end, and Live", () => {
    const { subject, text, html } = buildAdminTrialNotifyCopy({
      customerEmail: "new@example.com",
      customerName: "Sam",
      planLabel: "Weekly",
      amount: "$0",
      trialEndsAt: "October 22, 2026",
      mode: "Live",
      adminUserUrl: "https://nurahelp.com/admin/users/u2",
    });
    assert.equal(subject, "Trial started: Weekly · $0 · Live");
    assert.match(text, /Weekly/);
    assert.match(text, /\$0/);
    assert.match(text, /October 22, 2026/);
    assert.match(text, /Live/);
    assert.match(html, /Open user in admin/);
    assert.equal(html.includes("<script>"), false);
  });

  it("keeps a sandbox trial visible", () => {
    const { subject, text } = buildAdminTrialNotifyCopy({
      customerEmail: "test@example.com",
      customerName: "Test",
      planLabel: "Monthly",
      amount: "$0",
      trialEndsAt: null,
      mode: "Sandbox",
      adminUserUrl: "https://nurahelp.com/admin/users/u3",
    });
    assert.match(subject, /Sandbox/);
    assert.match(text, /Monthly/);
    assert.equal(text.includes("Trial ends:"), false);
  });
});

describe("admin activity lines", () => {
  it("puts email, Google, and the plan on a signup", () => {
    const { title, detail } = formatActivitySignup({
      name: "Sam",
      email: "sam@example.com",
      source: "google_oauth",
      hasGoogle: true,
      plan: "weekly",
    });
    assert.equal(title, "Sam");
    assert.match(detail, /sam@example.com/);
    assert.match(detail, /Google/);
    assert.match(detail, /Weekly/);
  });

  it("puts plan, amount, trial end, and Live on a trial", () => {
    const { detail } = formatActivityBilling({
      name: null,
      email: "pay@example.com",
      plan: "weekly",
      amountCents: 0,
      currency: "USD",
      status: "trial_started",
      livemode: true,
      trialEndsAt: "2026-10-22T06:30:18.000Z",
    });
    assert.match(detail, /Weekly trial/);
    assert.match(detail, /\$0/);
    assert.match(detail, /October 22, 2026/);
    assert.match(detail, /Live/);
  });

  it("puts a real charge amount on a paid event", () => {
    const { detail } = formatActivityBilling({
      name: "Alex",
      email: "alex@example.com",
      plan: "monthly",
      amountCents: 1499,
      currency: "USD",
      status: "succeeded",
      livemode: false,
      trialEndsAt: null,
    });
    assert.match(detail, /\$14\.99/);
    assert.match(detail, /Monthly/);
    assert.match(detail, /Sandbox/);
  });
});

describe("admin signup notify", () => {
  it("labels email and Google sources", () => {
    assert.equal(signupSourceLabel("email"), "Email");
    assert.equal(signupSourceLabel("google"), "Google");
  });

  it("puts the new account in the subject and body", () => {
    const { subject, text, html } = buildAdminSignupNotifyCopy({
      customerEmail: "new@example.com",
      customerName: "Sam",
      source: "google",
      adminUserUrl: "https://nurahelp.com/admin/users/u2",
    });
    assert.equal(subject, "New account: new@example.com");
    assert.match(text, /Google/);
    assert.match(text, /new@example\.com/);
    assert.match(html, /Google/);
    assert.match(html, /Open user in admin/);
  });
});
