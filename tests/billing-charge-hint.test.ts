import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysUntilIso,
  resolveChargeHint,
} from "../lib/billing-charge-hint.ts";

describe("daysUntilIso", () => {
  it("returns null for invalid dates", () => {
    assert.equal(daysUntilIso("not-a-date"), null);
  });

  it("returns 0 when the date is in the past", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    assert.equal(daysUntilIso("2026-09-09T12:00:00.000Z", now), 0);
  });

  it("ceils partial days", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    assert.equal(daysUntilIso("2026-09-11T18:00:00.000Z", now), 2);
    assert.equal(daysUntilIso("2026-09-13T12:00:00.000Z", now), 3);
  });
});

describe("resolveChargeHint", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("hides legacy and missing dates", () => {
    assert.equal(
      resolveChargeHint({
        status: "legacy",
        accessTier: "legacy",
        trialEndsAt: "2026-09-13T12:00:00.000Z",
        now,
      }),
      null
    );
    assert.equal(
      resolveChargeHint({
        status: "trialing",
        accessTier: "trialing",
        trialEndsAt: null,
        now,
      }),
      null
    );
  });

  it("prefers trial charge copy", () => {
    const hint = resolveChargeHint({
      status: "trialing",
      accessTier: "trialing",
      trialEndsAt: "2026-09-13T12:00:00.000Z",
      now,
    });
    assert.ok(hint);
    assert.equal(hint.days, 3);
    assert.equal(hint.label, "Charges in 3 days");
  });

  it("formats today and singular day", () => {
    assert.equal(
      resolveChargeHint({
        status: "trialing",
        trialEndsAt: "2026-09-10T10:00:00.000Z",
        now,
      })?.label,
      "Charges today"
    );
    assert.equal(
      resolveChargeHint({
        status: "trialing",
        trialEndsAt: "2026-09-11T12:00:00.000Z",
        now,
      })?.label,
      "Charges in 1 day"
    );
  });

  it("stays quiet for paying subscribers", () => {
    // A renewal countdown after payment reads like the charge never went through.
    assert.equal(
      resolveChargeHint({
        status: "active",
        accessTier: "active",
        trialEndsAt: "2026-09-10T10:00:00.000Z",
        now,
      }),
      null
    );
  });

  it("stays quiet for unpaid or undated accounts", () => {
    assert.equal(
      resolveChargeHint({
        status: "past_due",
        accessTier: "blocked",
        trialEndsAt: "2026-09-13T12:00:00.000Z",
        now,
      }),
      null
    );
    assert.equal(
      resolveChargeHint({ status: "trialing", trialEndsAt: "not-a-date", now }),
      null
    );
  });
});
