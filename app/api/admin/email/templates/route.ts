import { NextResponse } from "next/server";
import {
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import { listEmailTemplates } from "@/lib/email-templates-db";

export async function GET() {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const templates = await listEmailTemplates();
    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        subject: t.subject,
        html: t.html,
        text: t.text,
        isCustom: t.isCustom,
        updatedAt: t.updatedAt,
        enabled: t.enabled,
        delayHours: t.delayHours,
        scheduled: t.scheduled,
      })),
    });
  } catch (err) {
    console.error("[admin/email/templates GET]", err);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}
