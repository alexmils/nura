import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESET_EMAIL_ALREADY_SENT,
  RESET_EMAIL_SENT,
  RESET_EMAIL_THROTTLE_SECONDS,
  resetEmailThrottled,
} from "../lib/auth/password-reset.ts";

describe("resetEmailThrottled", () => {
  const now = new Date("2026-09-18T20:00:00.000Z");

  it("allows a first request", () => {
    assert.equal(resetEmailThrottled(null, now), false);
    assert.equal(resetEmailThrottled(undefined, now), false);
  });

  it("blocks a request inside the window", () => {
    assert.equal(
      resetEmailThrottled("2026-09-18T19:59:30.000Z", now),
      true
    );
  });

  it("allows a request once the window has passed", () => {
    const older = new Date(
      now.getTime() - (RESET_EMAIL_THROTTLE_SECONDS + 1) * 1000
    ).toISOString();
    assert.equal(resetEmailThrottled(older, now), false);
  });

  it("ignores an unparseable timestamp", () => {
    assert.equal(resetEmailThrottled("not-a-date", now), false);
  });

  it("keeps the reset copy free of em dashes", () => {
    assert.equal(RESET_EMAIL_SENT.includes("—"), false);
    assert.equal(RESET_EMAIL_ALREADY_SENT.includes("—"), false);
  });
});
