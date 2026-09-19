/**
 * MCP access token for the blog endpoint (`POST /api/mcp`).
 *
 * Stored in platform settings as a SHA-256 hash, so the admin API — and the
 * database — never hold a value that can be replayed. The plaintext is
 * returned exactly once, when it is generated, and never again; rotating is
 * how you get a new one. That matches the rest of Admin → * secret handling,
 * which never echoes a stored secret.
 *
 * Precedence: an admin-generated token wins over `NURA_MCP_TOKEN`. While an
 * admin token exists the environment token is ignored, so revoking in admin
 * really revokes.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const MCP_TOKEN_PREFIX = "nura_mcp_";
const MCP_TOKEN_BYTES = 20; // 40 hex chars
const HASH_RE = /^[a-f0-9]{64}$/;

export type PlatformMcpConfig = {
  /** SHA-256 hex of the active token. Empty = no admin token. */
  tokenHash: string;
  /** Leading characters of the token, for display only (e.g. `nura_mcp_c37`). */
  tokenHint: string;
  /** ISO timestamp of the last authenticated call, or "". */
  lastUsedAt: string;
  /** Off makes every request unauthorized without losing the token. */
  enabled: boolean;
};

export const DEFAULT_PLATFORM_MCP: PlatformMcpConfig = {
  tokenHash: "",
  tokenHint: "",
  lastUsedAt: "",
  enabled: true,
};

/** New random token. `nura_mcp_` + 40 hex chars. */
export function generateMcpToken(): string {
  return `${MCP_TOKEN_PREFIX}${randomBytes(MCP_TOKEN_BYTES).toString("hex")}`;
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Display hint: the stable-looking prefix, never enough to reconstruct. */
export function mcpTokenHint(token: string): string {
  return token.trim().slice(0, MCP_TOKEN_PREFIX.length + 3);
}

/** Constant-time compare of a presented token against a stored hash. */
export function tokenMatchesHash(presented: string, hash: string): boolean {
  if (!presented.trim() || !HASH_RE.test(hash)) return false;
  const a = Buffer.from(hashMcpToken(presented), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function normalizeMcpConfig(raw: unknown): PlatformMcpConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PLATFORM_MCP };
  const r = raw as Partial<PlatformMcpConfig>;
  const tokenHash = typeof r.tokenHash === "string" ? r.tokenHash.trim() : "";
  const lastUsedAt = typeof r.lastUsedAt === "string" ? r.lastUsedAt.trim() : "";
  return {
    tokenHash: HASH_RE.test(tokenHash) ? tokenHash : "",
    tokenHint:
      typeof r.tokenHint === "string"
        ? r.tokenHint.trim().slice(0, MCP_TOKEN_PREFIX.length + 8)
        : "",
    lastUsedAt: Number.isNaN(Date.parse(lastUsedAt)) ? "" : lastUsedAt,
    enabled: r.enabled !== false,
  };
}

/** Admin payload — never includes the hash. */
export type McpAdminView = {
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string;
  lastUsedAt: string;
  /** Where the working token comes from right now. */
  source: "database" | "env" | "none";
  /** True when an env token exists but is shadowed by the admin token. */
  envTokenIgnored: boolean;
  localUrl: string;
  publicUrl: string;
};

export function toMcpAdminView(
  config: PlatformMcpConfig,
  opts: { envTokenSet: boolean; localUrl: string; publicUrl: string }
): McpAdminView {
  const hasToken = Boolean(config.tokenHash);
  return {
    enabled: config.enabled,
    hasToken,
    tokenHint: config.tokenHint,
    lastUsedAt: config.lastUsedAt,
    source: hasToken ? "database" : opts.envTokenSet ? "env" : "none",
    envTokenIgnored: hasToken && opts.envTokenSet,
    localUrl: `${opts.localUrl.replace(/\/$/, "")}/api/mcp`,
    publicUrl: `${opts.publicUrl.replace(/\/$/, "")}/api/mcp`,
  };
}

export type McpConfigPatch = {
  enabled?: boolean;
};

/** Apply the enable/disable toggle. Token changes go through generate/revoke. */
export function mergeMcpConfigPatch(
  current: PlatformMcpConfig,
  patch: McpConfigPatch | undefined
): PlatformMcpConfig {
  if (!patch || typeof patch !== "object") return current;
  return {
    ...current,
    enabled: patch.enabled === undefined ? current.enabled : patch.enabled === true,
  };
}

/** Config with a freshly generated token: hash stored, plaintext returned once. */
export function withGeneratedToken(
  current: PlatformMcpConfig,
  now = new Date().toISOString()
): { config: PlatformMcpConfig; token: string } {
  const token = generateMcpToken();
  return {
    config: {
      tokenHash: hashMcpToken(token),
      tokenHint: mcpTokenHint(token),
      lastUsedAt: "",
      // Generating a token implies you want it usable.
      enabled: true,
    },
    token,
  };
}

export function withRevokedToken(
  current: PlatformMcpConfig
): PlatformMcpConfig {
  return { ...current, tokenHash: "", tokenHint: "", lastUsedAt: "" };
}

/** `~/.cursor/mcp.json` entry, ready to paste. */
export function mcpClientSnippet(url: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        "nura-blog": {
          url,
          type: "streamableHttp",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json, text/event-stream",
          },
        },
      },
    },
    null,
    4
  );
}
