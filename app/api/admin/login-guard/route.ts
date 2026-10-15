import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/api-auth";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import {
  getLoginGuardSettings,
  listLoginAttempts,
  listLoginLocks,
  regenerateLoginGuardSlug,
  saveLoginGuardSettings,
  unlockLoginSubject,
} from "@/lib/login-guard";
import {
  clampGuardNumber,
  LOGIN_GUARD_DEFAULTS,
  parseAddressList,
  slugError,
} from "@/lib/login-guard-policy";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const [settings, attempts, locks] = await Promise.all([
    getLoginGuardSettings(),
    listLoginAttempts(150),
    listLoginLocks(),
  ]);

  return NextResponse.json({ settings, attempts, locks });
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    slug?: string;
    maxAttempts?: number;
    windowMinutes?: number;
    lockMinutes?: number;
    whitelist?: string;
    blocklist?: string;
  };

  const slug = (body.slug ?? "").trim();
  const slugProblem = slugError(slug);
  if (slugProblem) {
    return NextResponse.json({ error: slugProblem }, { status: 400 });
  }

  const whitelist = parseAddressList(body.whitelist ?? "");
  if (!whitelist.ok) {
    return NextResponse.json({ error: whitelist.error }, { status: 400 });
  }
  const blocklist = parseAddressList(body.blocklist ?? "");
  if (!blocklist.ok) {
    return NextResponse.json({ error: blocklist.error }, { status: 400 });
  }

  const settings = await saveLoginGuardSettings({
    slug,
    maxAttempts: clampGuardNumber(
      body.maxAttempts,
      LOGIN_GUARD_DEFAULTS.maxAttempts,
      3,
      50
    ),
    windowMinutes: clampGuardNumber(body.windowMinutes, 15, 1, 1440),
    lockMinutes: clampGuardNumber(body.lockMinutes, 30, 1, 10080),
    whitelist: whitelist.list,
    blocklist: blocklist.list,
  });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "settings.login_guard_updated",
    detail: {
      maxAttempts: settings.maxAttempts,
      windowMinutes: settings.windowMinutes,
      lockMinutes: settings.lockMinutes,
      whitelist: settings.whitelist.length,
      blocklist: settings.blocklist.length,
    },
    ip: clientIp(request),
  });

  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { action?: string; subjectKey?: string };

  if (body.action === "regenerate") {
    const settings = await regenerateLoginGuardSlug();
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "settings.login_guard_updated",
      detail: { regenerated: true },
      ip: clientIp(request),
    });
    return NextResponse.json({ settings });
  }

  if (body.action === "unlock") {
    const subjectKey = (body.subjectKey ?? "").trim();
    if (!subjectKey.startsWith("ip:") && !subjectKey.startsWith("email:")) {
      return NextResponse.json({ error: "Unknown lock" }, { status: 400 });
    }
    await unlockLoginSubject(subjectKey);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
