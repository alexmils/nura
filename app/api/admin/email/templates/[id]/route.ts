import { NextResponse } from "next/server";
import {
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import {
  getEmailTemplate,
  saveEmailTemplate,
} from "@/lib/email-templates-db";
import { isEmailTemplateId } from "@/lib/email/template-labels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const { id } = await params;
  if (!isEmailTemplateId(id)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const template = await getEmailTemplate(id);
    return NextResponse.json({ template });
  } catch (err) {
    console.error("[admin/email/templates/id GET]", err);
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const { id } = await params;
  if (!isEmailTemplateId(id)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      subject?: string;
      html?: string;
      text?: string;
      enabled?: boolean;
      delayHours?: number | null;
    };
    if (!body.subject?.trim() || !body.html || !body.text) {
      return NextResponse.json(
        { error: "subject, html, and text are required" },
        { status: 400 }
      );
    }
    if (
      body.delayHours !== undefined &&
      body.delayHours !== null &&
      (!Number.isFinite(body.delayHours) || body.delayHours < 0)
    ) {
      return NextResponse.json(
        { error: "delayHours must be zero or a positive number" },
        { status: 400 }
      );
    }
    const template = await saveEmailTemplate(id, {
      subject: body.subject,
      html: body.html,
      text: body.text,
      enabled: body.enabled,
      delayHours: body.delayHours,
    });
    return NextResponse.json({ template });
  } catch (err) {
    console.error("[admin/email/templates/id PUT]", err);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
