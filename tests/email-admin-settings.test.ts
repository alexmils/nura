import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PLATFORM_EMAIL,
  emailFromEnvFallback,
  normalizeEmailConfig,
  resolveBrevoApiKey,
  isGmailCredentialsConfigured,
} from "../lib/email-config.ts";
import {
  mergeEmailConfigPatch,
  toEmailAdminView,
  emailAdminStatus,
} from "../lib/email-admin-settings.ts";

describe("normalizeEmailConfig", () => {
  it("returns defaults for empty input", () => {
    const cfg = normalizeEmailConfig(null);
    assert.deepEqual(cfg, DEFAULT_PLATFORM_EMAIL);
  });

  it("trims stored fields", () => {
    const cfg = normalizeEmailConfig({
      brevoApiKey: "  key  ",
      replyTo: " support@nurahelp.com ",
    });
    assert.equal(cfg.brevoApiKey, "key");
    assert.equal(cfg.replyTo, "support@nurahelp.com");
  });
});

describe("mergeEmailConfigPatch", () => {
  it("keeps secrets when patch sends empty strings", () => {
    const current = {
      ...DEFAULT_PLATFORM_EMAIL,
      brevoApiKey: "keep-brevo",
      gmailClientSecret: "keep-secret",
      replyTo: "old@example.com",
    };
    const next = mergeEmailConfigPatch(current, {
      brevoApiKey: "",
      gmailClientSecret: "   ",
      replyTo: "new@example.com",
    });
    assert.equal(next.brevoApiKey, "keep-brevo");
    assert.equal(next.gmailClientSecret, "keep-secret");
    assert.equal(next.replyTo, "new@example.com");
  });

  it("replaces secrets when non-empty", () => {
    const current = {
      ...DEFAULT_PLATFORM_EMAIL,
      brevoApiKey: "old",
    };
    const next = mergeEmailConfigPatch(current, {
      brevoApiKey: " new-key ",
      gmailClientId: "cid",
    });
    assert.equal(next.brevoApiKey, "new-key");
    assert.equal(next.gmailClientId, "cid");
  });
});

describe("toEmailAdminView", () => {
  it("never returns secrets", () => {
    const view = toEmailAdminView(
      {
        ...DEFAULT_PLATFORM_EMAIL,
        brevoApiKey: "secret-key",
        brevoWebhookSecret: "hook-secret",
        gmailClientId: "cid",
        gmailClientSecret: "csecret",
        gmailRefreshToken: "rtoken",
      },
      { fromName: "Nura", fromAddress: "hi@contact.nurahelp.com" },
      true
    );
    assert.equal(view.brevoApiKey, "");
    assert.equal(view.brevoWebhookSecret, "");
    assert.equal(view.hasBrevoWebhookSecret, true);
    assert.equal(view.gmailClientSecret, "");
    assert.equal(view.gmailRefreshToken, "");
    assert.equal(view.hasBrevoApiKey, true);
    assert.equal(view.hasGmailClientId, true);
    assert.equal(view.fromName, "Nura");
    assert.equal(view.brevoSource, "stored");
  });
});

describe("emailAdminStatus", () => {
  it("marks providers from stored config", () => {
    const status = emailAdminStatus(
      {
        ...DEFAULT_PLATFORM_EMAIL,
        brevoApiKey: "k",
      },
      {
        fromName: "Nura",
        fromAddress: "hi@contact.nurahelp.com",
        appUrl: "http://localhost:3471",
        resolvedFromName: "Nura",
        resolvedFromAddress: "hi@contact.nurahelp.com",
        },
    );
    assert.equal(status.brevoConfigured, true);
    assert.equal(status.primaryProvider, "brevo");
    assert.equal(status.fromAddress, "hi@contact.nurahelp.com");
  });
});

describe("emailFromEnvFallback", () => {
  it("fills blank DB fields from env without overwriting", () => {
    const prev = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = "env-key";
    try {
      const filled = emailFromEnvFallback({
        ...DEFAULT_PLATFORM_EMAIL,
        brevoApiKey: "",
      });
      assert.equal(filled.brevoApiKey, "env-key");
      assert.equal(resolveBrevoApiKey(filled), "env-key");
      const kept = emailFromEnvFallback({
        ...DEFAULT_PLATFORM_EMAIL,
        brevoApiKey: "db-key",
      });
      assert.equal(kept.brevoApiKey, "db-key");
      assert.equal(resolveBrevoApiKey(DEFAULT_PLATFORM_EMAIL), null);
    } finally {
      if (prev === undefined) delete process.env.BREVO_API_KEY;
      else process.env.BREVO_API_KEY = prev;
    }
  });
});

describe("isGmailCredentialsConfigured", () => {
  it("requires all three pieces", () => {
    assert.equal(
      isGmailCredentialsConfigured({
        ...DEFAULT_PLATFORM_EMAIL,
        gmailClientId: "a",
        gmailClientSecret: "b",
      }),
      false
    );
    assert.equal(
      isGmailCredentialsConfigured({
        ...DEFAULT_PLATFORM_EMAIL,
        gmailClientId: "a",
        gmailClientSecret: "b",
        gmailRefreshToken: "c",
      }),
      true
    );
  });
});
