import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMAIL_TEMPLATE_IDS,
  EMAIL_TEMPLATE_LABELS,
  emailTemplateLabel,
  keepEmailTemplateId,
  type EmailTemplateId,
} from "../lib/email/template-labels.ts";

const IDS: readonly EmailTemplateId[] = EMAIL_TEMPLATE_IDS;

describe("emailTemplateLabel", () => {
  it("uses sentence-case names without underscores", () => {
    for (const id of IDS) {
      const label = emailTemplateLabel(id);
      assert.equal(label, EMAIL_TEMPLATE_LABELS[id]);
      assert.equal(label.includes("_"), false);
      assert.match(label, /^[A-Z]/);
    }
  });

  it("passes through unknown ids", () => {
    assert.equal(emailTemplateLabel("custom_blast"), "custom_blast");
  });
});

describe("keepEmailTemplateId", () => {
  it("keeps the current pick when it still exists", () => {
    assert.equal(keepEmailTemplateId("welcome_invite", IDS), "welcome_invite");
  });

  it("falls back to the first id when the pick is gone", () => {
    assert.equal(keepEmailTemplateId("welcome_invite", ["welcome"]), "welcome");
  });
});
