import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReceiptAmount,
  formatReceiptDate,
  receiptPlanLabel,
} from "@/lib/email/purchase-receipt";
import { renderEmailTemplate } from "@/lib/email/templates";

describe("receipt formatting", () => {
  it("drops the cents on a whole-dollar charge", () => {
    assert.equal(formatReceiptAmount(9900, "USD"), "$99");
    assert.equal(formatReceiptAmount(1499, "USD"), "$14.99");
    assert.equal(formatReceiptAmount(499, "USD"), "$4.99");
  });

  it("follows the charge currency", () => {
    assert.equal(formatReceiptAmount(1499, "eur"), "€14.99");
    assert.equal(formatReceiptAmount(499, null), "$4.99");
  });

  it("describes the plan the way the customer sees it", () => {
    assert.equal(receiptPlanLabel("monthly"), "Monthly");
    assert.equal(receiptPlanLabel("yearly"), "Yearly");
    assert.equal(receiptPlanLabel("pro"), "pro");
    assert.equal(receiptPlanLabel(null), "subscription");
  });

  it("dates the invoice in UTC, so it matches what Stripe stored", () => {
    assert.equal(
      formatReceiptDate(new Date("2026-09-21T23:30:00.000Z")),
      "September 21, 2026"
    );
  });
});

describe("purchase receipt template", () => {
  const data = {
    name: "Alex",
    planLabel: "Monthly",
    amount: "$14.99",
    paidAt: "September 21, 2026",
    manageBillingUrl: "https://nurahelp.com/app/billing",
    supportEmail: "help@nurahelp.com",
  };

  it("thanks the customer and states what was charged", () => {
    const { subject, html, text } = renderEmailTemplate("payment_receipt", data);
    assert.equal(subject, "Thank you for your purchase");
    for (const body of [html, text]) {
      assert.match(body, /Thank you/);
      assert.match(body, /\$14\.99/);
      assert.match(body, /September 21, 2026/);
      assert.match(body, /Monthly/);
      assert.match(body, /https:\/\/nurahelp\.com\/app\/billing/);
    }
  });

  it("escapes a name that carries markup", () => {
    const { html } = renderEmailTemplate("payment_receipt", {
      ...data,
      name: "<script>alert(1)</script>",
    });
    assert.equal(html.includes("<script>"), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it("replaces the default ignore-this-email footer", () => {
    const { html } = renderEmailTemplate("payment_receipt", data);
    assert.equal(html.includes("you can safely ignore it"), false);
    assert.match(html, /receipt for a charge/);
  });
});
