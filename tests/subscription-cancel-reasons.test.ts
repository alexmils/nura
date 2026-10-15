import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCancelReasonSummary,
  parseCancelFeedbackBody,
} from "@/lib/subscription-cancel-reasons";
import { parseBillingEventDescription } from "@/lib/subscription-cancel-feedback";

describe("subscription cancel reasons", () => {
  it("requires at least one reason", () => {
    assert.throws(() => parseCancelFeedbackBody({ reasons: [] }));
  });

  it("allows only one reason", () => {
    assert.throws(() =>
      parseCancelFeedbackBody({
        reasons: ["too_expensive", "not_using"],
      })
    );
  });

  it("requires text when other is selected", () => {
    assert.throws(() =>
      parseCancelFeedbackBody({ reasons: ["other"], comment: "  " })
    );
  });

  it("formats summary with comment", () => {
    const summary = formatCancelReasonSummary(
      ["too_expensive", "not_using"],
      "Price is high for me"
    );
    assert.match(summary, /Too expensive/);
    assert.match(summary, /Price is high/);
  });

  it("parses billing description with reasons", () => {
    const parsed = parseBillingEventDescription(
      "2026-10-22T00:00:00.000Z::Too expensive; Not using it enough"
    );
    assert.equal(parsed.accessEndsAt, "2026-10-22T00:00:00.000Z");
    assert.match(parsed.reasonSummary ?? "", /Too expensive/);
  });
});
