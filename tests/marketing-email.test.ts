import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTrialReminderDue } from "../lib/email/billing-customer.ts";
import { parseBrevoListId } from "../lib/email/brevo-contacts.ts";
import {
  brevoEventsFromBody,
  brevoWebhookAuthorized,
  isBrevoOptOutEvent,
} from "../lib/brevo-webhook.ts";

describe("isTrialReminderDue", () => {
  const now = new Date("2026-10-15T12:00:00.000Z");

  it("is due inside the two-day window", () => {
    assert.equal(
      isTrialReminderDue(new Date("2026-10-17T00:00:00.000Z"), now),
      true
    );
  });

  it("skips charges more than two days away", () => {
    assert.equal(
      isTrialReminderDue(new Date("2026-10-20T12:00:00.000Z"), now),
      false
    );
  });

  it("is still due on the last day", () => {
    assert.equal(
      isTrialReminderDue(new Date("2026-10-16T06:00:00.000Z"), now),
      true
    );
  });

  it("skips a trial that already ended", () => {
    assert.equal(
      isTrialReminderDue(new Date("2026-10-15T11:00:00.000Z"), now),
      false
    );
  });
});

describe("parseBrevoListId", () => {
  it("accepts a positive integer", () => {
    assert.equal(parseBrevoListId("12"), 12);
  });

  it("rejects blanks and junk", () => {
    assert.equal(parseBrevoListId(""), null);
    assert.equal(parseBrevoListId("abc"), null);
    assert.equal(parseBrevoListId("0"), null);
  });
});

describe("brevo webhook helpers", () => {
  it("authorizes the shared secret", () => {
    const req = new Request("https://nurahelp.com/api/webhooks/brevo", {
      headers: { "x-brevo-secret": "s3cret" },
    });
    assert.equal(brevoWebhookAuthorized(req, "s3cret"), true);
    assert.equal(brevoWebhookAuthorized(req, "other"), false);
    assert.equal(brevoWebhookAuthorized(req, ""), false);
  });

  it("reads one event or a batch", () => {
    assert.equal(brevoEventsFromBody({ event: "unsubscribed", email: "a@b.c" }).length, 1);
    assert.equal(
      brevoEventsFromBody([{ event: "spam", email: "a@b.c" }]).length,
      1
    );
    assert.equal(isBrevoOptOutEvent("unsubscribed"), true);
    assert.equal(isBrevoOptOutEvent("delivered"), false);
    assert.equal(isBrevoOptOutEvent("hard_bounce"), false);
    assert.equal(isBrevoOptOutEvent("spam"), false);
  });
});
