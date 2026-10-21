/**
 * What an MCP token may do. Kept free of node imports so the admin screen can
 * render the same list the server enforces.
 */

export const MCP_SCOPES = [
  "blog:read",
  "blog:write",
  "seo:read",
  "seo:write",
  "resources:read",
  "resources:write",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_SCOPE_LABELS: Record<McpScope, string> = {
  "blog:read": "Read blog posts and categories",
  "blog:write": "Create, edit, and delete blog posts",
  "seo:read": "Read page SEO titles and descriptions",
  "seo:write": "Edit page SEO titles and descriptions",
  "resources:read": "Read the in-app Resources library",
  "resources:write": "Create and edit in-app Resources",
};

/** Scopes every token had before scopes existed. */
export const DEFAULT_MCP_SCOPES: McpScope[] = ["blog:read", "blog:write"];

export function isMcpScope(value: unknown): value is McpScope {
  return (
    typeof value === "string" && (MCP_SCOPES as readonly string[]).includes(value)
  );
}

/**
 * Keep known scopes, drop duplicates. A value that is not an array (an older
 * stored config) falls back to the blog scopes so existing tokens keep working.
 */
export function normalizeMcpScopes(raw: unknown): McpScope[] {
  if (!Array.isArray(raw)) return [...DEFAULT_MCP_SCOPES];
  const out: McpScope[] = [];
  for (const value of raw) {
    if (isMcpScope(value) && !out.includes(value)) out.push(value);
  }
  return out;
}
