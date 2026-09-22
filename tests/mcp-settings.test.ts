import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PLATFORM_MCP,
  MCP_TOKEN_PREFIX,
  generateMcpToken,
  hashMcpToken,
  mcpClientSnippet,
  mcpTokenHint,
  mergeMcpConfigPatch,
  normalizeMcpConfig,
  toMcpAdminView,
  tokenMatchesHash,
  withGeneratedToken,
  withRevokedToken,
} from "../lib/mcp-settings.ts";
import { normalizeSettingsForTest } from "../lib/platform-settings.ts";

describe("mcp token", () => {
  it("generates prefixed tokens with enough entropy", () => {
    const a = generateMcpToken();
    const b = generateMcpToken();
    assert.match(a, /^nura_mcp_[a-f0-9]{40}$/);
    assert.notEqual(a, b);
    assert.equal(a.startsWith(MCP_TOKEN_PREFIX), true);
  });

  it("hashes deterministically and never returns the plaintext in a hint", () => {
    const token = generateMcpToken();
    assert.equal(hashMcpToken(token), hashMcpToken(` ${token} `));
    assert.match(hashMcpToken(token), /^[a-f0-9]{64}$/);
    const hint = mcpTokenHint(token);
    assert.ok(token.startsWith(hint));
    assert.ok(hint.length < token.length);
    assert.ok(hint.length <= MCP_TOKEN_PREFIX.length + 3);
  });

  it("matches only the exact token", () => {
    const token = generateMcpToken();
    const hash = hashMcpToken(token);
    assert.equal(tokenMatchesHash(token, hash), true);
    assert.equal(tokenMatchesHash(`${token}x`, hash), false);
    assert.equal(tokenMatchesHash(token.slice(0, -1), hash), false);
    assert.equal(tokenMatchesHash(generateMcpToken(), hash), false);
    assert.equal(tokenMatchesHash("", hash), false);
    // A malformed stored hash must never match.
    assert.equal(tokenMatchesHash(token, "not-a-hash"), false);
    assert.equal(tokenMatchesHash(token, ""), false);
  });
});

describe("mcp config", () => {
  it("normalizes junk to the default", () => {
    assert.deepEqual(normalizeMcpConfig(null), DEFAULT_PLATFORM_MCP);
    assert.deepEqual(normalizeMcpConfig("nope"), DEFAULT_PLATFORM_MCP);
    const bad = normalizeMcpConfig({
      tokenHash: "not-a-hash",
      lastUsedAt: "not-a-date",
      tokenHint: 12,
    });
    assert.equal(bad.tokenHash, "");
    assert.equal(bad.lastUsedAt, "");
    assert.equal(bad.tokenHint, "");
    assert.equal(bad.tokenName, "");
    assert.equal(bad.enabled, true);
  });

  it("keeps a valid stored hash and disables via enabled", () => {
    const token = generateMcpToken();
    const config = normalizeMcpConfig({
      tokenHash: hashMcpToken(token),
      tokenHint: mcpTokenHint(token),
      lastUsedAt: "2026-09-19T10:00:00.000Z",
      enabled: false,
    });
    assert.equal(config.tokenHash, hashMcpToken(token));
    assert.equal(config.enabled, false);
    assert.equal(config.lastUsedAt, "2026-09-19T10:00:00.000Z");
  });

  it("generate stores only a hash and returns the plaintext once", () => {
    const { config, token } = withGeneratedToken(DEFAULT_PLATFORM_MCP, {
      name: "blog-agent",
    });
    assert.equal(config.tokenHash, hashMcpToken(token));
    assert.equal(config.tokenHint, mcpTokenHint(token));
    assert.equal(config.tokenName, "blog-agent");
    assert.equal(config.enabled, true);
    assert.equal(config.lastUsedAt, "");
    // The stored config must not contain the token itself.
    assert.equal(JSON.stringify(config).includes(token), false);
  });

  it("generate requires a usable name and keeps one on rotate", () => {
    const first = withGeneratedToken(DEFAULT_PLATFORM_MCP, {
      name: "  nura-blog  ",
    });
    assert.equal(first.config.tokenName, "nura-blog");
    const rotated = withGeneratedToken(first.config, { name: "" });
    assert.equal(rotated.config.tokenName, "nura-blog");
    const renamed = withGeneratedToken(first.config, { name: "cursor" });
    assert.equal(renamed.config.tokenName, "cursor");
  });

  it("revoke clears the hash, hint, name, and usage", () => {
    const { config } = withGeneratedToken(DEFAULT_PLATFORM_MCP, {
      name: "blog-agent",
    });
    const revoked = withRevokedToken(config);
    assert.equal(revoked.tokenHash, "");
    assert.equal(revoked.tokenHint, "");
    assert.equal(revoked.tokenName, "");
    assert.equal(revoked.lastUsedAt, "");
  });

  it("merges the enabled toggle and optional rename", () => {
    const { config } = withGeneratedToken(DEFAULT_PLATFORM_MCP, {
      name: "blog-agent",
    });
    assert.equal(mergeMcpConfigPatch(config, undefined), config);
    assert.equal(mergeMcpConfigPatch(config, {}).tokenHash, config.tokenHash);
    assert.equal(mergeMcpConfigPatch(config, { enabled: false }).enabled, false);
    // tokenHash survives a toggle.
    assert.equal(mergeMcpConfigPatch(config, { enabled: false }).tokenHash, config.tokenHash);
    assert.equal(mergeMcpConfigPatch(config, { enabled: true }).enabled, true);
    assert.equal(
      mergeMcpConfigPatch(config, { tokenName: "cursor-agent" }).tokenName,
      "cursor-agent"
    );
  });

  it("never exposes the hash in the admin view", () => {
    const { config, token } = withGeneratedToken(DEFAULT_PLATFORM_MCP, {
      name: "blog-agent",
    });
    const view = toMcpAdminView(config, {
      envTokenSet: false,
      localUrl: "http://localhost:3471",
      publicUrl: "https://nurahelp.com",
    });
    assert.equal(view.hasToken, true);
    assert.equal(view.tokenName, "blog-agent");
    assert.equal(view.source, "database");
    assert.equal(view.envTokenIgnored, false);
    assert.equal(view.localUrl, "http://localhost:3471/api/mcp");
    assert.equal(view.publicUrl, "https://nurahelp.com/api/mcp");
    assert.equal(JSON.stringify(view).includes(config.tokenHash), false);
    assert.equal(JSON.stringify(view).includes(token), false);
  });

  it("reports the env fallback and when it is shadowed", () => {
    const envOnly = toMcpAdminView(DEFAULT_PLATFORM_MCP, {
      envTokenSet: true,
      localUrl: "http://localhost:3471",
      publicUrl: "https://nurahelp.com",
    });
    assert.equal(envOnly.source, "env");
    assert.equal(envOnly.hasToken, false);
    assert.equal(envOnly.envTokenIgnored, false);

    const both = toMcpAdminView(
      withGeneratedToken(DEFAULT_PLATFORM_MCP).config,
      { envTokenSet: true, localUrl: "x", publicUrl: "y" }
    );
    assert.equal(both.source, "database");
    assert.equal(both.envTokenIgnored, true);

    const none = toMcpAdminView(DEFAULT_PLATFORM_MCP, {
      envTokenSet: false,
      localUrl: "x",
      publicUrl: "y",
    });
    assert.equal(none.source, "none");
  });

  it("builds a paste-ready client snippet", () => {
    const { token } = withGeneratedToken(DEFAULT_PLATFORM_MCP);
    const parsed = JSON.parse(mcpClientSnippet("http://localhost:3471/api/mcp", token));
    const server = parsed.mcpServers["nura-blog"];
    assert.equal(server.url, "http://localhost:3471/api/mcp");
    assert.equal(server.type, "streamableHttp");
    assert.equal(server.headers.Authorization, `Bearer ${token}`);
    assert.match(server.headers.Accept, /text\/event-stream/);
  });
});

describe("platform settings mcp block", () => {
  it("round-trips through normalization and defaults to empty", () => {
    const settings = normalizeSettingsForTest({ siteName: "Nura" });
    assert.deepEqual(settings.mcp, DEFAULT_PLATFORM_MCP);
    assert.equal(settings.mcp.enabled, true);

    const { config, token } = withGeneratedToken(DEFAULT_PLATFORM_MCP);
    const round = normalizeSettingsForTest({
      siteName: "Nura",
      mcp: config,
    });
    assert.equal(round.mcp.tokenHash, hashMcpToken(token));
    assert.equal(round.mcp.enabled, true);
  });
});
