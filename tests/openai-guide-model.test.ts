import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PLATFORM_SETTINGS,
  normalizeSettingsForTest,
} from "../lib/platform-settings.ts";

describe("openai guided model defaults", () => {
  it("defaults to gpt-4.1-mini for OpenAI", () => {
    assert.equal(
      DEFAULT_PLATFORM_SETTINGS.ai.connectors.openai.model,
      "gpt-4.1-mini"
    );
  });

  it("remaps gpt-5* reasoning models to the chat default", () => {
    const next = normalizeSettingsForTest({
      ...DEFAULT_PLATFORM_SETTINGS,
      ai: {
        ...DEFAULT_PLATFORM_SETTINGS.ai,
        connectors: {
          ...DEFAULT_PLATFORM_SETTINGS.ai.connectors,
          openai: {
            apiKey: "sk-x",
            model: "gpt-5-nano",
            enabled: true,
          },
        },
      },
    });
    assert.equal(next.ai.connectors.openai.model, "gpt-4.1-mini");
  });
});

describe("deepseek model id normalization", () => {
  it("stores the canonical deepseek-flash id for legacy aliases", () => {
    for (const legacy of ["deepseek-chat", "deepseek-v4-flash"]) {
      const next = normalizeSettingsForTest({
        ...DEFAULT_PLATFORM_SETTINGS,
        ai: {
          ...DEFAULT_PLATFORM_SETTINGS.ai,
          connectors: {
            ...DEFAULT_PLATFORM_SETTINGS.ai.connectors,
            deepseek: { apiKey: "ds-x", model: legacy, enabled: true },
          },
        },
      });
      assert.equal(next.ai.connectors.deepseek.model, "deepseek-flash");
    }
  });

  it("keeps deepseek-v4-pro and canonicalizes the default", () => {
    const next = normalizeSettingsForTest({
      ...DEFAULT_PLATFORM_SETTINGS,
      ai: {
        ...DEFAULT_PLATFORM_SETTINGS.ai,
        connectors: {
          ...DEFAULT_PLATFORM_SETTINGS.ai.connectors,
          deepseek: { apiKey: "", model: "deepseek-v4-pro", enabled: true },
        },
      },
    });
    assert.equal(next.ai.connectors.deepseek.model, "deepseek-v4-pro");
    assert.equal(
      normalizeSettingsForTest({}).ai.connectors.deepseek.model,
      "deepseek-flash"
    );
  });
});
