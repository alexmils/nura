import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSubmitFeedback } from "../lib/feedback-eligibility.ts";
import {
  FEEDBACK_DAYS_ELAPSED,
  FEEDBACK_IMMERSIVE_SELECTOR,
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
  const oldAccount = new Date(
    now - FEEDBACK_DAYS_ELAPSED * 24 * 60 * 60 * 1000
  ).toISOString();

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
    assert.equal(accountAgeEligible(young, FEEDBACK_DAYS_ELAPSED, now), false);
    assert.equal(accountAgeEligible(oldAccount, FEEDBACK_DAYS_ELAPSED, now), true);
  });

  it("force overrides prior response and snooze", () => {
    const r = shouldOfferPrompt({
      hasResponse: true,
      forceShow: true,
      snoozeUntil: snoozeUntilIso(7, now),
      pendingSource: null,
      userCreatedAt: new Date(now).toISOString(),
      hasQualifyingSession: true,
      now,
    });
    assert.deepEqual(r, { show: true, source: "forced" });
  });

  it("never shows in-app popup except forced", () => {
    const r = shouldOfferPrompt({
      hasResponse: false,
      forceShow: false,
      snoozeUntil: null,
      pendingSource: "session_end",
      userCreatedAt: oldAccount,
      hasQualifyingSession: true,
      now,
    });
    assert.deepEqual(r, { show: false, source: null });
  });

  it("requires a qualifying session for any non-forced prompt", () => {
    const r = shouldOfferPrompt({
      hasResponse: false,
      forceShow: false,
      snoozeUntil: null,
      pendingSource: null,
      userCreatedAt: oldAccount,
      hasQualifyingSession: false,
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
        pendingSource: null,
        sourceOverride: "trial_end_email",
        userCreatedAt: new Date(now).toISOString(),
        now,
      }),
      "trial_end_email"
    );
    assert.equal(
      resolveFeedbackSubmitSource({
        forceShow: false,
        pendingSource: null,
        sourceOverride: "page",
        userCreatedAt: new Date(now).toISOString(),
        now,
      }),
      "page"
    );
  });

  it("page submit needs sessions and account age unless trial link", () => {
    const young = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(
      canSubmitFeedback({
        hasResponse: false,
        hasQualifyingSession: true,
        userCreatedAt: young,
        allowTrialLink: false,
        now,
      }).reason,
      "account_too_new"
    );
    assert.equal(
      canSubmitFeedback({
        hasResponse: false,
        hasQualifyingSession: false,
        userCreatedAt: oldAccount,
        allowTrialLink: true,
        now,
      }).reason,
      "no_sessions"
    );
    assert.equal(
      canSubmitFeedback({
        hasResponse: false,
        hasQualifyingSession: true,
        userCreatedAt: young,
        allowTrialLink: true,
        now,
      }).canSubmit,
      true
    );
  });
});
