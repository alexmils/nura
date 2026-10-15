import { NextResponse } from "next/server";
import {
  requireAdminAccess,
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import {
  getPlatformSettings,
  savePlatformSettings,
  getPublicAppUrl,
} from "@/lib/platform-settings";
import { getFromAddress } from "@/lib/email/types";
import {
  emailAdminStatus,
  mergeEmailConfigPatch,
  toEmailAdminView,
} from "@/lib/email-admin-settings";
import type { PlatformEmailConfig } from "@/lib/email-config";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import { chromeBrandName } from "@/lib/brand";
import { countMarketingOptIns } from "@/lib/email/brevo-contacts";

export async function GET() {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const settings = await getPlatformSettings();
    const canEdit = auth.user.role === "platform_admin";
    let resolvedFromName: string | null = null;
    let resolvedFromAddress: string | null = null;
    try {
      const from = await getFromAddress();
      resolvedFromName = from.name;
      resolvedFromAddress = from.email;
    } catch {
      /* optional until configured */
    }
    const appUrl = await getPublicAppUrl();
    const marketing = await countMarketingOptIns().catch(() => ({
      users: 0,
      leads: 0,
    }));
    const status = emailAdminStatus(settings.email, {
      fromName: settings.fromName,
      fromAddress: settings.fromAddress,
      appUrl,
      resolvedFromName,
      resolvedFromAddress,
    });

    return NextResponse.json({
      status,
      email: toEmailAdminView(
        settings.email,
        {
          fromName: settings.fromName,
          fromAddress: settings.fromAddress,
        },
        canEdit
      ),
      canEdit,
      marketing,
      webhookUrl: `${appUrl}/api/webhooks/brevo`,
    });
  } catch (err) {
    console.error("[admin/email/settings GET]", err);
    return NextResponse.json(
      { error: "Failed to load email settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const body = (await request.json()) as {
      fromName?: unknown;
      fromAddress?: unknown;
      email?: Partial<PlatformEmailConfig>;
    };

    const current = await getPlatformSettings();
    const nextEmail = mergeEmailConfigPatch(current.email, body.email);

    let fromName = current.fromName;
    let fromAddress = current.fromAddress;
    if (typeof body.fromName === "string") {
      fromName = chromeBrandName(body.fromName.trim()) || fromName;
    }
    if (typeof body.fromAddress === "string") {
      const trimmed = body.fromAddress.trim();
      if (trimmed) fromAddress = trimmed;
    }

    const next = await savePlatformSettings({
      ...current,
      fromName,
      fromAddress,
      email: nextEmail,
    });

    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "settings.email_updated",
      detail: {
        fromAddress: next.fromAddress,
        hasBrevo: Boolean(next.email.brevoApiKey),
        hasGmail: Boolean(
          next.email.gmailClientId &&
            next.email.gmailClientSecret &&
            next.email.gmailRefreshToken
        ),
        hasReplyTo: Boolean(next.email.replyTo),
      },
      ip: clientIp(request),
    });

    let resolvedFromName: string | null = null;
    let resolvedFromAddress: string | null = null;
    try {
      const from = await getFromAddress();
      resolvedFromName = from.name;
      resolvedFromAddress = from.email;
    } catch {
      /* optional */
    }
    const appUrl = await getPublicAppUrl();
    const status = emailAdminStatus(next.email, {
      fromName: next.fromName,
      fromAddress: next.fromAddress,
      appUrl,
      resolvedFromName,
      resolvedFromAddress,
    });

    return NextResponse.json({
      status,
      email: toEmailAdminView(
        next.email,
        { fromName: next.fromName, fromAddress: next.fromAddress },
        true
      ),
      canEdit: true,
    });
  } catch (err) {
    console.error("[admin/email/settings PUT]", err);
    return NextResponse.json(
      { error: "Failed to save email settings" },
      { status: 500 }
    );
  }
}
