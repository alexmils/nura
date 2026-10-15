import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { billingSummaryStatusLabel } from "@/lib/billing-status-display";

describe("billing status display", () => {
  it("shows canceling when renewal is scheduled to stop", () => {
    assert.equal(
      billingSummaryStatusLabel("trialing", true),
      "Canceling at period end"
    );
    assert.equal(billingSummaryStatusLabel("active", false), "active");
  });
});
