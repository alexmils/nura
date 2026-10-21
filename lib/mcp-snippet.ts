/**
 * Cursor `mcp.json` entry. Kept free of node imports so the admin screen can
 * build the snippet with the URL the operator is actually browsing.
 */

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
