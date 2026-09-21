import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_PAYMENT_NOTIFY_EMAIL,
  buildAdminPaymentNotifyCopy,
} from "@/lib/email/admin-payment-notify";

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
