import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeDeepseekModelId,
  isOpenAiChatModelId,
  isValidElevenLabsVoiceId,
  listLlmModels,
  listVoiceCatalog,
  sanitizeProviderError,
  testProviderConnection,
} from "../lib/provider-catalog.ts";

describe("isValidElevenLabsVoiceId", () => {
  it("accepts typical ElevenLabs ids", () => {
    assert.equal(isValidElevenLabsVoiceId("FGY2WhTYpPnrIDTdsKH5"), true);
    assert.equal(isValidElevenLabsVoiceId("EXAVITQu4vr4xnSDxMaL"), true);
  });

  it("rejects short, spaced, or path-like values", () => {
    assert.equal(isValidElevenLabsVoiceId("short"), false);
    assert.equal(isValidElevenLabsVoiceId("bad id with spaces!!"), false);
    assert.equal(isValidElevenLabsVoiceId("../etc/passwd"), false);
    assert.equal(isValidElevenLabsVoiceId(""), false);
  });
});

describe("sanitizeProviderError", () => {
  it("maps 401 to invalid key without echoing secrets", () => {
    const msg = sanitizeProviderError(401, "Unauthorized sk-abc123secret");
    assert.equal(msg, "Invalid API key");
    assert.equal(msg.includes("sk-abc"), false);
  });

  it("redacts keys in other status bodies", () => {
    const msg = sanitizeProviderError(500, "boom sk-live-secret-value");
    assert.equal(msg.includes("sk-live"), false);
    assert.match(msg, /\[redacted\]/);
  });
});

describe("model id helpers", () => {
  it("canonicalizes DeepSeek allow-list aliases", () => {
    assert.equal(canonicalizeDeepseekModelId("deepseek-flash"), "deepseek-flash");
    for (const legacy of [
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-coder",
      "deepseek-v4-flash",
      "deepseek-v4-flash-vision-exp",
    ]) {
      assert.equal(canonicalizeDeepseekModelId(legacy), "deepseek-flash");
    }
    assert.equal(canonicalizeDeepseekModelId(" deepseek-v4-flash "), "deepseek-flash");
    assert.equal(canonicalizeDeepseekModelId("deepseek-v4-pro"), "deepseek-v4-pro");
  });

  it("keeps OpenAI chat models and drops media SKUs", () => {
    assert.ok(isOpenAiChatModelId("gpt-4.1-mini"));
    assert.ok(isOpenAiChatModelId("gpt-5.5"));
    assert.ok(!isOpenAiChatModelId("gpt-image-1"));
    assert.ok(!isOpenAiChatModelId("gpt-4o-mini-tts"));
    assert.ok(!isOpenAiChatModelId("whisper-1"));
  });
});

describe("listLlmModels", () => {
  it("parses OpenAI-compatible model ids and prefers chat models", async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "whisper-1" },
            { id: "gpt-4o-mini" },
            { id: "gpt-image-1" },
            { id: "gpt-4o-mini-tts" },
            { id: "text-embedding-3-small" },
          ],
        }),
        { status: 200 }
      );
    const models = await listLlmModels("openai", "sk-test", fetchFn);
    assert.deepEqual(models, ["gpt-4o-mini"]);
  });

  it("maps DeepSeek allow-list aliases to documented ids and probes extras", async () => {
    const fetchFn = async (url: string, init?: RequestInit) => {
      if (url.endsWith("/models")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "deepseek-flash" }, { id: "deepseek-v4-pro" }],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/chat/completions")) {
        const body = JSON.parse(String(init?.body || "{}")) as { model?: string };
        const requested = body.model || "";
        // Vision remaps to flash on this key — must not be listed.
        const served =
          requested === "deepseek-v4-pro"
            ? "deepseek-v4-pro"
            : "deepseek-flash";
        return new Response(JSON.stringify({ model: served }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };
    const models = await listLlmModels("deepseek", "sk-test", fetchFn);
    assert.deepEqual(models, ["deepseek-flash", "deepseek-v4-pro"]);
  });

  it("folds legacy DeepSeek ids into deepseek-flash", async () => {
    const fetchFn = async (url: string, init?: RequestInit) => {
      if (url.endsWith("/models")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "deepseek-v4-flash" }, { id: "deepseek-v4-pro" }],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/chat/completions")) {
        const body = JSON.parse(String(init?.body || "{}")) as { model?: string };
        return new Response(JSON.stringify({ model: body.model }), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    };
    const models = await listLlmModels("deepseek", "sk-test", fetchFn);
    assert.deepEqual(models, ["deepseek-flash", "deepseek-v4-pro"]);
  });

  it("does not throw raw secret on 401", async () => {
    const fetchFn = async () =>
      new Response("invalid sk-secret-key-here", { status: 401 });
    await assert.rejects(
      () => listLlmModels("openai", "sk-secret-key-here", fetchFn),
      (err: Error) => {
        assert.equal(err.message, "Invalid API key");
        assert.equal(err.message.includes("sk-secret"), false);
        return true;
      }
    );
  });
});

describe("listVoiceCatalog", () => {
  it("parses ElevenLabs models and voices", async () => {
    const fetchFn = async (url: string) => {
      if (url.includes("/models")) {
        return new Response(
          JSON.stringify([
            { model_id: "eleven_multilingual_v2", can_do_text_to_speech: true },
            { model_id: "voice-convert", can_do_text_to_speech: false },
          ]),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          voices: [
            { voice_id: "abc", name: "Rachel" },
            { voice_id: "xyz", name: "Adam" },
          ],
        }),
        { status: 200 }
      );
    };
    const catalog = await listVoiceCatalog("xi_test", fetchFn);
    assert.deepEqual(catalog.models, ["eleven_multilingual_v2"]);
    assert.equal(catalog.voices[0].name, "Adam");
  });
});

describe("testProviderConnection", () => {
  it("returns ok when list succeeds", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ data: [{ id: "claude-3-5-haiku-latest" }] }), {
        status: 200,
      });
    const result = await testProviderConnection("claude", "sk-ant-test", fetchFn);
    assert.deepEqual(result, { ok: true });
  });

  it("returns failed without leaking the key", async () => {
    const fetchFn = async () =>
      new Response("bad sk-secret-key-here", { status: 403 });
    const result = await testProviderConnection("openai", "sk-secret-key-here", fetchFn);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "Invalid API key");
      assert.equal(result.error.includes("sk-secret"), false);
    }
  });
});
