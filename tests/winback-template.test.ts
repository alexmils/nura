import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  cleanWinbackNote,
  cleanWinbackSubject,
  defaultWinbackSubject,
  winbackTemplateData,
} from "../lib/email/winback-template";
import { renderEmailTemplate } from "../lib/email/templates";
import { createSlidingLimiter } from "../lib/winback-test-limit";
import { EMAIL_TEMPLATE_IDS, EMAIL_TEMPLATE_LABELS } from "../lib/email/template-labels";
import { EMAIL_TEMPLATE_GROUP, EMAIL_TEMPLATE_PLACEHOLDERS } from "../lib/email/template-meta";
import { offerSourceAllowsExtension } from "../lib/reactivation-rules";

const LINK = "https://nurahelp.com/reactivate?token=abcDEF123_-abcDEF123_-abcDEF123_-xyz";
const EXPIRES = new Date("2026-11-23T12:00:00Z");

describe("win-back template data", () => {
  it("words the offer for lapsed and paying members", () => {
    const trial = winbackTemplateData({ name: "Ana Petrovic", link: LINK, expiresAt: EXPIRES, mode: "trial" });
    assert.equal(trial.name, "Ana");
    assert.equal(trial.expiresAt, "November 23, 2026");
    assert.match(trial.offerLine, /30 days of Nura free/);
    assert.match(trial.howItWorks, /nothing is charged/i);
    const extend = winbackTemplateData({ name: null, link: LINK, expiresAt: EXPIRES, mode: "extend" });
    assert.equal(extend.name, "there");
    assert.match(extend.howItWorks, /move your next payment 30 days/);
    assert.equal(defaultWinbackSubject("trial"), "30 days of Nura on us");
    assert.equal(defaultWinbackSubject("extend"), "Your next 30 days of Nura are on us");
  });
  it("cleans the note and subject, escapes the note for HTML", () => {
    assert.equal(cleanWinbackNote("  hi\u0007 there \n\n\n\nbye "), "hi there \n\nbye");
    assert.equal(cleanWinbackNote(undefined), "");
    assert.equal(cleanWinbackNote("x".repeat(2000)).length, 1000);
    assert.equal(cleanWinbackSubject("a\r\nb "), "a b");
    const d = winbackTemplateData({ link: LINK, expiresAt: EXPIRES, mode: "trial", note: "<b>Hi</b>\nthere" });
    assert.equal(d.noteHtml.includes("<b>"), false);
    assert.match(d.noteHtml, /&lt;b&gt;Hi&lt;\/b&gt;<br \/>there/);
    assert.equal(winbackTemplateData({ link: LINK, expiresAt: EXPIRES, mode: "trial" }).noteHtml, "");
  });
});

describe("win-back email render", () => {
  const data = winbackTemplateData({ name: "Ana", link: LINK, expiresAt: EXPIRES, mode: "trial", note: "Thanks for the report" });
  const out = renderEmailTemplate("winback", data, "Nura", "https://nurahelp.com");
  it("is the branded layout with a CTA to the link", () => {
    assert.equal(out.subject, "30 days of Nura on us");
    assert.match(out.html, /<img src="https:\/\/nurahelp\.com/);
    assert.ok(out.html.includes(`href="${LINK}"`));
    assert.match(out.html, /Start my 30 free days/);
    assert.match(out.html, /Thanks for the report/);
    assert.match(out.html, /until November 23, 2026/);
  });
  it("has a plain-text fallback with the link and the note", () => {
    assert.ok(out.text.includes(LINK));
    assert.match(out.text, /^Hi Ana,\n\nThanks for the report\n/);
  });
  it("never mentions the payment processor", () => {
    assert.doesNotMatch(out.html + out.text, /stripe/i);
    const ext = renderEmailTemplate("winback", { ...data, ...winbackTemplateData({ link: LINK, expiresAt: EXPIRES, mode: "extend" }) }, "Nura", "");
    assert.doesNotMatch(ext.html + ext.text, /stripe/i);
  });
  it("is registered in Admin → Email → Automation with its placeholders", () => {
    assert.ok((EMAIL_TEMPLATE_IDS as readonly string[]).includes("winback"));
    assert.equal(EMAIL_TEMPLATE_LABELS.winback, "Win-back offer");
    assert.equal(EMAIL_TEMPLATE_GROUP.winback, "Billing");
    const tokens = EMAIL_TEMPLATE_PLACEHOLDERS.winback.map((p) => p.token);
    for (const t of ["name", "reactivateUrl", "expiresAt"]) assert.ok(tokens.includes(t), t);
  });
});

describe("test-send rate limit", () => {
  it("allows a few per window per admin, then refuses", () => {
    const l = createSlidingLimiter(2, 1000);
    assert.equal(l.take("a", 0).ok, true);
    assert.equal(l.take("a", 10).ok, true);
    const third = l.take("a", 20);
    assert.equal(third.ok, false);
    assert.equal(l.take("b", 20).ok, true);
    assert.equal(l.take("a", 1001).ok, true);
  });
});

describe("test links stay apart from the real one", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  it("schema flags test offers", () => {
    assert.match(read("lib/db.ts"), /ALTER TABLE reactivation_offers ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE/);
  });
  it("a new link only replaces an unused link of the same kind", () => {
    assert.match(read("lib/reactivation.ts"), /WHERE user_id = \$1 AND used_at IS NULL AND is_test = \$2/);
  });
  it("test links never count as redeemed, listed or sendable for real", () => {
    const src = read("lib/winback-email.ts");
    assert.match(src, /used_at IS NOT NULL AND NOT is_test/);
    assert.match(src, /WHERE user_id = \$1 AND NOT is_test/);
    assert.match(src, /offer\.user_id !== input\.userId \|\| offer\.is_test/);
    // The test send writes no winback_emails row and does not mark the link sent.
    const fn = src.slice(src.indexOf("export async function sendUserWinbackTestEmail"));
    assert.doesNotMatch(fn, /winback_emails|markReactivationSent|deliverWinbackEmail/);
    assert.match(fn, /isTest: true/);
    assert.match(fn, /winbackTestLimiter\(\)\.take/);
    assert.match(read("lib/problem-reports.ts"), /used_at IS NOT NULL AND NOT ro\.is_test/);
  });
  it("test links behave like user-page links, but never against live billing", () => {
    assert.ok(offerSourceAllowsExtension("admin_test"));
    const stripe = read("lib/reactivation-stripe.ts");
    assert.match(stripe, /view\.offer\?\.isTest/);
    assert.match(stripe, /"test_live"/);
  });
  it("preview and test send are platform-admin writes", () => {
    const src = read("app/api/admin/reactivation/route.ts");
    assert.match(src, /requirePlatformAdminWrite/);
    assert.match(src, /"user_preview"/);
    assert.match(src, /"user_test_send"/);
  });
});
