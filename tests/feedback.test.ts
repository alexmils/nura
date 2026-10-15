import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEEDBACK_DAYS_ELAPSED,
  FEEDBACK_IMMERSIVE_SELECTOR,
  FEEDBACK_SESSION_END_MIN_DAYS,
  FEEDBACK_SNOOZE_DAYS,
  accountAgeEligible,
  isSnoozeActive,
  isValidFeedbackScore,
  resolveFeedbackSubmitSource,
  shouldOfferPrompt,
  snoozeUntilIso,
} from "../lib/feedback.ts";

describe("feedback eligibility", () => {
  const now = Date.parse("2026-09-12T12:00:00.000Z");

  it("validates NPS scores", () => {
    assert.equal(isValidFeedbackScore(1), true);
    assert.equal(isValidFeedbackScore(10), true);
    assert.equal(isValidFeedbackScore(0), false);
    assert.equal(isValidFeedbackScore(11), false);
    assert.equal(isValidFeedbackScore(3.5), false);
  });

  it("targets immersive class on app-shell, not body", () => {
    assert.equal(FEEDBACK_IMMERSIVE_SELECTOR, ".app-shell.session-immersive");
  });

  it("snoozes for configured days", () => {
    const until = snoozeUntilIso(FEEDBACK_SNOOZE_DAYS, now);
    assert.equal(isSnoozeActive(until, now), true);
    assert.equal(
      isSnoozeActive(until, now + FEEDBACK_SNOOZE_DAYS * 24 * 60 * 60 * 1000 + 1),
      false
    );
  });

  it("requires account age for days_elapsed", () => {
    const young = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(
      now - FEEDBACK_DAYS_ELAPSED * 24 * 60 * 60 * 1000
    ).toISOString();
    assert.equal(accountAgeEligible(young, FEEDBACK_DAYS_ELAPSED, now), false);
    assert.equal(accountAgeEligible(old, FEEDBACK_DAYS_ELAPSED, now), true);
  });

  it("force overrides prior response and snooze", () => {
    const r = shouldOfferPrompt({
      hasResponse: true,
      forceShow: true,
      snoozeUntil: snoozeUntilIso(7, now),
      pendingSource: null,
      userCreatedAt: new Date(now).toISOString(),
      now,
    });
    assert.deepEqual(r, { show: true, source: "forced" });
  });

  it("hides after response unless forced", () => {
    const r = shouldOfferPrompt({
      hasResponse: true,
      forceShow: false,
      snoozeUntil: null,
      pendingSource: "session_end",
      userCreatedAt: new Date(0).toISOString(),
      now,
    });
    assert.deepEqual(r, { show: false, source: null });
  });

  it("defers session_end until account is at least one day old", () => {
    const young = new Date(now).toISOString();
    const rYoung = shouldOfferPrompt({
      hasResponse: false,
      forceShow: false,
      snoozeUntil: null,
      pendingSource: "session_end",
      userCreatedAt: young,
      now,
    });
    assert.deepEqual(rYoung, { show: false, source: null });

    const old = new Date(
      now - FEEDBACK_SESSION_END_MIN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const rOld = shouldOfferPrompt({
      hasResponse: false,
      forceShow: false,
      snoozeUntil: null,
      pendingSource: "session_end",
      userCreatedAt: old,
      now,
    });
    assert.deepEqual(rOld, { show: true, source: "session_end" });
  });

  it("respects snooze even with session_end pending", () => {
    const r = shouldOfferPrompt({
      hasResponse: false,
      forceShow: false,
      snoozeUntil: snoozeUntilIso(7, now),
      pendingSource: "session_end",
      userCreatedAt: new Date(0).toISOString(),
      now,
    });
    assert.deepEqual(r, { show: false, source: null });
  });

  it("resolves submit source from server state, not client", () => {
    assert.equal(
      resolveFeedbackSubmitSource({
        forceShow: true,
        pendingSource: "session_end",
        userCreatedAt: new Date(now).toISOString(),
        now,
      }),
      "forced"
    );
    assert.equal(
      resolveFeedbackSubmitSource({
        forceShow: false,
        pendingSource: "session_end",
        userCreatedAt: new Date(now).toISOString(),
        now,
      }),
      "session_end"
    );
    assert.equal(
      resolveFeedbackSubmitSource({
        forceShow: false,
        pendingSource: null,
        userCreatedAt: new Date(
          now - FEEDBACK_DAYS_ELAPSED * 24 * 60 * 60 * 1000
        ).toISOString(),
        now,
      }),
      "days_elapsed"
    );
  });
});
