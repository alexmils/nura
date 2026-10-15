import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatRetentionActionLabel,
  halfDisplayPrice,
  retentionOfferCopy,
  retentionReasonsEligible,
  RETENTION_ELIGIBLE_PLAN,
  RETENTION_TRIGGER_REASON,
} from "@/lib/subscription-retention-shared";

describe("subscription retention", () => {
  it("only triggers on too expensive", () => {
    assert.equal(retentionReasonsEligible(["too_expensive"]), true);
    assert.equal(retentionReasonsEligible(["not_using"]), false);
    assert.equal(
      retentionReasonsEligible(["too_expensive", "not_using"]),
      true
    );
  });

  it("halves display price when possible", () => {
    assert.equal(halfDisplayPrice("$14.99"), "$7.5");
    assert.equal(halfDisplayPrice("€14.99"), "7.5");
  });

  it("formats offer copy", () => {
    const copy = retentionOfferCopy("$14.99");
    assert.match(copy.priceLine, /\$7/);
    assert.equal(RETENTION_ELIGIBLE_PLAN, "monthly");
    assert.equal(RETENTION_TRIGGER_REASON, "too_expensive");
  });

  it("labels retention actions for admin", () => {
    assert.match(formatRetentionActionLabel("accepted"), /stayed/i);
    assert.match(formatRetentionActionLabel("declined"), /Declined/i);
  });
});
