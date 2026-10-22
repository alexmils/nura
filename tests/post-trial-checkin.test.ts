import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POST_TRIAL_ANCHOR_WINDOW_DAYS,
  isPostTrialCheckinDue,
  isWithinPostTrialAnchorWindow,
} from "../lib/email/post-trial-checkin-policy";
import { renderEmailTemplate } from "../lib/email/templates";
import {
  EMAIL_TEMPLATE_IDS,
  SCHEDULED_TEMPLATE_DELAY_HOURS,
  emailTemplateLabel,
  isScheduledTemplate,
} from "../lib/email/template-labels";

const SEEN = new Date("2026-10-01T12:00:00.000Z");

describe("post-trial check-in schedule", () => {
  it("waits for the delay and fires exactly on it", () => {
    assert.equal(
      isPostTrialCheckinDue(SEEN, 72, new Date("2026-10-04T11:59:59.000Z")),
      false
    );
    assert.equal(
      isPostTrialCheckinDue(SEEN, 72, new Date("2026-10-04T12:00:00.000Z")),
      true
    );
  });

  it("a zero delay is due immediately", () => {
    assert.equal(isPostTrialCheckinDue(SEEN, 0, SEEN), true);
  });

  it("refuses a negative or non-finite delay instead of sending early", () => {
    assert.equal(isPostTrialCheckinDue(SEEN, -1, SEEN), false);
    assert.equal(isPostTrialCheckinDue(SEEN, Number.NaN, SEEN), false);
  });
});

describe("post-trial anchor window", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");

  it("accepts a trial that ended inside the window", () => {
    assert.equal(
      isWithinPostTrialAnchorWindow(
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        now
      ),
      true
    );
  });

  it("rejects a trial that ended before the window", () => {
    assert.equal(
      isWithinPostTrialAnchorWindow(
        new Date(
          now.getTime() - (POST_TRIAL_ANCHOR_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000
        ),
        now
      ),
      false
    );
  });

  it("rejects a trial that has not ended yet", () => {
    assert.equal(
      isWithinPostTrialAnchorWindow(
        new Date(now.getTime() + 60 * 60 * 1000),
        now
      ),
      false
    );
  });
});

describe("post-trial template wiring", () => {
  it("is a known, scheduled template with a 72-hour default", () => {
    assert.ok((EMAIL_TEMPLATE_IDS as readonly string[]).includes("post_trial_checkin"));
    assert.equal(isScheduledTemplate("post_trial_checkin"), true);
    assert.equal(SCHEDULED_TEMPLATE_DELAY_HOURS.post_trial_checkin, 72);
    assert.equal(emailTemplateLabel("post_trial_checkin"), "Post-trial check-in");
  });

  it("renders the trial date and escapes the name", () => {
    const rendered = renderEmailTemplate(
      "post_trial_checkin",
      {
        name: "Ana <script>",
        trialEndedOn: "1 October 2026",
        appUrl: "https://nurahelp.com/app",
        preferencesUrl: "https://nurahelp.com/app/settings",
      },
      "Nura",
      "https://nurahelp.com"
    );

    assert.match(rendered.subject, /sessions/i);
    assert.match(rendered.html, /Ana &lt;script&gt;/);
    assert.doesNotMatch(rendered.html, /Ana <script>/);
    assert.match(rendered.html, /1 October 2026/);
    assert.match(rendered.html, /https:\/\/nurahelp\.com\/app\/settings/);
  });
});
