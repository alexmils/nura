import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashReviewToken,
  isPlausibleReviewToken,
} from "../lib/review-invite";

describe("review invite tokens", () => {
  it("hashes deterministically, without keeping the raw token", () => {
    const raw = "a".repeat(40);
    assert.equal(hashReviewToken(raw), hashReviewToken(raw));
    assert.match(hashReviewToken(raw), /^[0-9a-f]{64}$/);
    assert.notEqual(hashReviewToken(raw), raw);
  });

  it("rejects values that cannot be a real invite", () => {
    assert.equal(isPlausibleReviewToken(""), false);
    assert.equal(isPlausibleReviewToken("short"), false);
    assert.equal(isPlausibleReviewToken("a".repeat(201)), false);
    assert.equal(isPlausibleReviewToken(null), false);
    assert.equal(isPlausibleReviewToken("a".repeat(40)), true);
  });
});
