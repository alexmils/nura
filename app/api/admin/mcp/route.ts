import { NextResponse } from "next/server";
import {
  isAuthContext,
  requirePlatformSettingsAccess,
} from "@/lib/api-auth";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import {
  mergeMcpConfigPatch,
  mcpClientSnippet,
  toMcpAdminView,
  withGeneratedToken,
  withRevokedToken,
  type McpConfigPatch,
  type PlatformMcpConfig,
} from "@/lib/mcp-settings";
import { getPublicAppUrl, getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

/** Local endpoint for Cursor on this machine; the public one is for deploys. */
function localMcpOrigin(): string {
  const port = process.env.PORT || "3471";
  return `http://localhost:${port}`;
}

async function adminPayload() {
  const settings = await getPlatformSettings();
  let publicUrl = "";
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = "";
  }
  return toMcpAdminView(settings.mcp, {
    envTokenSet: Boolean(process.env.NURA_MCP_TOKEN?.trim()),
    localUrl: localMcpOrigin(),
    publicUrl: publicUrl || localMcpOrigin(),
  });
}

export async function GET() {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;
  return NextResponse.json({ mcp: await adminPayload() });
}

export async function POST(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    patch?: McpConfigPatch;
  };
  const settings = await getPlatformSettings();
  let mcp: PlatformMcpConfig = settings.mcp;
  let issuedToken: string | null = null;

  switch (body.action) {
    case "generate": {
      const generated = withGeneratedToken(mcp);
      mcp = generated.config;
      issuedToken = generated.token;
      break;
    }
    case "revoke": {
      mcp = withRevokedToken(mcp);
      break;
    }
    case "save": {
      mcp = mergeMcpConfigPatch(mcp, body.patch);
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await savePlatformSettings({ ...settings, mcp });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action:
      body.action === "generate"
        ? "mcp.token_generated"
        : body.action === "revoke"
          ? "mcp.token_revoked"
          : "mcp.settings_updated",
    detail: { source: "admin", enabled: mcp.enabled, hint: mcp.tokenHint },
    ip: clientIp(request),
  });

  const view = await adminPayload();
  return NextResponse.json({
    mcp: view,
    // Plaintext is returned only here, only once.
    token: issuedToken,
    snippet: issuedToken
      ? mcpClientSnippet(view.localUrl, issuedToken)
      : undefined,
  });
}
