import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMAIL_TEMPLATE_IDS,
  EMAIL_TEMPLATE_LABELS,
  emailLogTemplateIds,
  emailTemplateLabel,
  keepEmailTemplateId,
  type EmailTemplateId,
} from "../lib/email/template-labels.ts";
import { renderEmailTemplate } from "../lib/email/templates.ts";
import { EMAIL_LOGO_PATH, EMAIL_LOGO_WIDTH, rewriteEmailLogoSrc } from "../lib/brand-assets.ts";
import { BRAND_SUPPORT_EMAIL } from "../lib/brand.ts";

const IDS: readonly EmailTemplateId[] = EMAIL_TEMPLATE_IDS;

describe("emailTemplateLabel", () => {
  it("uses sentence-case names without underscores", () => {
    for (const id of IDS) {
      const label = emailTemplateLabel(id);
      assert.equal(label, EMAIL_TEMPLATE_LABELS[id]);
      assert.equal(label.includes("_"), false);
      assert.match(label, /^[A-Z]/);
    }
  });

  it("passes through unknown ids", () => {
    assert.equal(emailTemplateLabel("custom_blast"), "custom_blast");
  });
});

describe("emailLogTemplateIds", () => {
  it("splits admin operator mail from user mail", () => {
    const admin = emailLogTemplateIds("admin");
    const user = emailLogTemplateIds("user");
    assert.deepEqual(admin, ["admin_signup", "admin_trial", "admin_payment"]);
    assert.equal(user.includes("welcome"), true);
    assert.equal(user.includes("broadcast"), true);
    assert.equal(user.some((id) => admin.includes(id)), false);
  });
});

describe("keepEmailTemplateId", () => {
  it("keeps the current pick when it still exists", () => {
    assert.equal(keepEmailTemplateId("welcome_invite", IDS), "welcome_invite");
  });

  it("falls back to the first id when the pick is gone", () => {
    assert.equal(keepEmailTemplateId("welcome_invite", ["welcome"]), "welcome");
  });
});

/** Minimal fixtures — enough for each template to render. */
const FIXTURES: Record<string, Record<string, string | boolean>> = {
  password_reset: { name: "Alex", resetUrl: "https://nurahelp.com/r", expiresIn: "72 hours" },
  welcome_invite: { name: "Alex", createPasswordUrl: "https://nurahelp.com/p", expiresIn: "72 hours" },
  password_changed: { name: "Alex", loginUrl: "https://nurahelp.com/app/login" },
  welcome: { name: "Alex", loginUrl: "https://nurahelp.com/app/login" },
  account_deleted: {
    name: "Alex",
    supportEmail: BRAND_SUPPORT_EMAIL,
    homeUrl: "https://nurahelp.com/",
    billingNote: "Your subscription was canceled.",
  },
  payment_receipt: {
    name: "Alex",
    planLabel: "Monthly",
    amount: "$14.99",
    paidAt: "September 21, 2026",
    manageBillingUrl: "https://nurahelp.com/app/billing",
    supportEmail: BRAND_SUPPORT_EMAIL,
  },
  trial_started: {
    name: "Alex",
    planLabel: "Monthly",
    amount: "$14.99",
    trialEndsAt: "October 22, 2026",
    manageBillingUrl: "https://nurahelp.com/app/billing",
    supportEmail: BRAND_SUPPORT_EMAIL,
  },
  payment_failed: {
    name: "Alex",
    amount: "$14.99",
    manageBillingUrl: "https://nurahelp.com/app/billing",
    supportEmail: BRAND_SUPPORT_EMAIL,
  },
  trial_charge_reminder: {
    name: "Alex",
    planLabel: "Monthly",
    amount: "$14.99",
    chargeDate: "October 22, 2026",
    manageBillingUrl: "https://nurahelp.com/app/billing",
  },
  subscription_canceled: {
    name: "Alex",
    accessEndsAt: "October 22, 2026",
    homeUrl: "https://nurahelp.com/",
    supportEmail: BRAND_SUPPORT_EMAIL,
    billingNote: "Your plan will not renew.",
    keepsAccess: false,
  },
  admin_signup: {
    customerName: "Sam",
    customerEmail: "sam@example.com",
    source: "Google",
    adminUserUrl: "https://nurahelp.com/admin/users/u1",
  },
  admin_trial: {
    customerName: "Sam",
    customerEmail: "sam@example.com",
    planLabel: "Weekly",
    amount: "$0",
    trialEndsAt: "October 22, 2026",
    mode: "Live",
    adminUserUrl: "https://nurahelp.com/admin/users/u1",
  },
  admin_payment: {
    customerName: "Alex",
    customerEmail: "alex@example.com",
    planLabel: "Monthly",
    amount: "$14.99",
    paidAt: "September 21, 2026",
    adminUserUrl: "https://nurahelp.com/admin/users/u1",
  },
};

const ORIGIN = "https://nurahelp.com";

describe("email brand header", () => {
  it("puts the linked logo in every template", () => {
    for (const id of IDS) {
      const { html } = renderEmailTemplate(
        id,
        FIXTURES[id] as never,
        "Nura",
        ORIGIN
      );
      assert.match(
        html,
        new RegExp(`<img src="${ORIGIN}${EMAIL_LOGO_PATH}"`),
        `${id} must carry the logo`
      );
      assert.match(html, new RegExp(`<a href="${ORIGIN}"`), `${id} must link it`);
      // Images blocked is the common case, so the alt carries the brand.
      assert.match(html, /alt="Nura"/);
      // Size and alignment are pinned: a client that ignores inline styles must
      // still get the fixed-width cell, or the lockup grows to the card width.
      assert.match(html, new RegExp(`width="${EMAIL_LOGO_WIDTH}"`));
      assert.match(html, new RegExp(`max-width:${EMAIL_LOGO_WIDTH}px`));
      assert.match(html, /align="left"/);
      assert.equal(
        html.includes(`max-width:100%`),
        false,
        `${id} lets the logo stretch`
      );
      // The old plain-text wordmark must be gone.
      assert.equal(
        html.includes(`>Nura</p>`),
        false,
        `${id} still renders the wordmark as text`
      );
    }
  });

  it("falls back to the wordmark when no origin is known", () => {
    const { html } = renderEmailTemplate("welcome", FIXTURES.welcome as never, "Nura");
    assert.equal(html.includes("<img"), false);
    assert.match(html, />Nura<\/p>/);
  });

  it("survives a missing name or origin instead of returning a 500", () => {
    // The admin template list renders every template: a non-string name used to
    // throw inside the escaper and blank the whole page.
    const { html } = renderEmailTemplate(
      "welcome",
      FIXTURES.welcome as never,
      undefined as never,
      undefined as never
    );
    assert.match(html, />Nura<\/p>/);
    assert.equal(html.includes("<img"), false);
  });

  it("replaces a retired brand name with the current one", () => {
    const { html } = renderEmailTemplate(
      "welcome",
      FIXTURES.welcome as never,
      "NuraHelp",
      ORIGIN
    );
    assert.match(html, /alt="Nura"/);
    assert.equal(html.includes("NuraHelp"), false);
  });

  it("does not double the slash when the origin ends with one", () => {
    const { html } = renderEmailTemplate(
      "welcome",
      FIXTURES.welcome as never,
      "Nura",
      `${ORIGIN}/`
    );
    assert.match(html, new RegExp(`src="${ORIGIN}${EMAIL_LOGO_PATH}"`));
    assert.equal(html.includes(`${ORIGIN}//brand`), false);
  });

  it("keeps the logo on the public site when the app origin is gated", () => {
    const { html } = renderEmailTemplate(
      "welcome",
      FIXTURES.welcome as never,
      "Nura",
      "https://dev.nurahelp.com"
    );
    assert.match(html, new RegExp(`src="${ORIGIN}${EMAIL_LOGO_PATH}"`));
    assert.equal(html.includes("dev.nurahelp.com/brand"), false);
    assert.match(html, /href="https:\/\/dev\.nurahelp\.com"/);
  });

  it("rewrites a saved logo url before the mail leaves", () => {
    const html = rewriteEmailLogoSrc(
      '<img src="https://dev.nurahelp.com/brand/nura-wave-logo.png" />'
    );
    assert.equal(
      html,
      '<img src="https://nurahelp.com/brand/nura-wave-logo.png" />'
    );
  });

  it("ships the support inbox, not a placeholder address", () => {
    assert.equal(BRAND_SUPPORT_EMAIL, "support@nurahelp.com");
    const { html, text } = renderEmailTemplate(
      "payment_receipt",
      FIXTURES.payment_receipt as never,
      "Nura",
      ORIGIN
    );
    assert.match(html, /support@nurahelp\.com/);
    assert.match(text, /support@nurahelp\.com/);
    assert.equal(html.includes("example.com"), false);
  });
});
