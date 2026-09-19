/**
 * Resolve the MCP bearer token and record use.
 *
 * An admin-generated token (stored as a hash in platform settings) wins over
 * the `NURA_MCP_TOKEN` environment variable. The env token stays supported so
 * an existing deployment keeps working until someone generates one in admin.
 */

import { getPlatformSettings } from "@/lib/platform-settings";
import {
  hashMcpToken,
  tokenMatchesHash,
  type PlatformMcpConfig,
} from "@/lib/mcp-settings";

export type McpAuthState = {
  source: "database" | "env" | "none";
  /** Hash to compare against, or "" when nothing is configured. */
  tokenHash: string;
  /** False when an admin token exists but is switched off. */
  enabled: boolean;
};

/** How long between `lastUsedAt` writes, so MCP traffic is not a write storm. */
const LAST_USED_THROTTLE_MS = 60 * 60 * 1000;

function envTokenHash(): string {
  const env = process.env.NURA_MCP_TOKEN?.trim();
  return env ? hashMcpToken(env) : "";
}

export async function getMcpAuthState(
  config: PlatformMcpConfig
): Promise<McpAuthState> {
  const database = Boolean(config.tokenHash);
  if (database) {
    return { source: "database", tokenHash: config.tokenHash, enabled: config.enabled };
  }
  const env = envTokenHash();
  if (env) return { source: "env", tokenHash: env, enabled: true };
  return { source: "none", tokenHash: "", enabled: false };
}

export function mcpRequestAuthorized(
  presented: string,
  state: McpAuthState
): boolean {
  if (!state.enabled || !state.tokenHash) return false;
  return tokenMatchesHash(presented, state.tokenHash);
}

/** Read the `Authorization: Bearer` header, or "". */
export function bearerFromRequest(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
}

/**
 * Stamp `lastUsedAt` at most once an hour. Best effort: a failure here must
 * never fail the tool call.
 */
export async function recordMcpTokenUse(config: PlatformMcpConfig): Promise<void> {
  if (!config.tokenHash) return;
  const last = config.lastUsedAt ? Date.parse(config.lastUsedAt) : 0;
  if (Number.isFinite(last) && Date.now() - last < LAST_USED_THROTTLE_MS) return;
  try {
    const { savePlatformSettings } = await import("@/lib/platform-settings");
    const settings = await getPlatformSettings();
    if (settings.mcp.tokenHash !== config.tokenHash) return;
    await savePlatformSettings({
      ...settings,
      mcp: { ...settings.mcp, lastUsedAt: new Date().toISOString() },
    });
  } catch {
    // Usage stamping is cosmetic; never surface it to the caller.
  }
}
