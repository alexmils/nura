import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMAIL_TEMPLATE_IDS } from "../lib/email/template-labels";
import {
  EMAIL_TEMPLATE_DESCRIPTION,
  EMAIL_TEMPLATE_GROUP,
  EMAIL_TEMPLATE_GROUP_ORDER,
  EMAIL_TEMPLATE_PLACEHOLDERS,
} from "../lib/email/template-meta";

describe("email template admin metadata", () => {
  it("covers every template, so the Automation list never shows a blank row", () => {
    for (const id of EMAIL_TEMPLATE_IDS) {
      assert.ok(
        EMAIL_TEMPLATE_GROUP_ORDER.includes(EMAIL_TEMPLATE_GROUP[id]),
        `${id} needs a known group`
      );
      assert.ok(
        EMAIL_TEMPLATE_DESCRIPTION[id]?.trim(),
        `${id} needs a description`
      );
      assert.ok(
        Array.isArray(EMAIL_TEMPLATE_PLACEHOLDERS[id]),
        `${id} needs a placeholder list`
      );
    }
  });

  it("gives the post-trial check-in its own placeholders", () => {
    const tokens = EMAIL_TEMPLATE_PLACEHOLDERS.post_trial_checkin.map(
      (p) => p.token
    );
    assert.deepEqual(tokens, [
      "name",
      "trialEndedOn",
      "appUrl",
      "preferencesUrl",
    ]);
  });
});
