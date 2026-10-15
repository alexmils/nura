import { NextResponse } from "next/server";
import {
  requireAdminAccess,
  requirePlatformAdminWrite,
  isAuthContext,
} from "@/lib/api-auth";
import { getAdminUserDetail } from "@/lib/admin-user-detail";
import { setUserStatsExcluded, updateAdminUser } from "@/lib/admin-users";
import { isValidUserRole, type UserRole } from "@/lib/roles";
import type { UserStatus } from "@/lib/users";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const { id } = await params;
  try {
    const user = await getAdminUserDetail(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[admin/users/id GET]", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdminWrite();
  if (!isAuthContext(auth)) return auth;

  const { id } = await params;
  try {
    const body = (await request.json()) as {
      name?: string;
      role?: UserRole;
      status?: UserStatus;
      statsExcluded?: boolean;
    };

    if (typeof body.statsExcluded === "boolean") {
      const flagged = await setUserStatsExcluded(id, body.statsExcluded);
      if ("error" in flagged) {
        return NextResponse.json({ error: flagged.error }, { status: 400 });
      }
      await writeAuditEvent({
        actorUserId: auth.user.id,
        targetUserId: id,
        action: "user.updated",
        detail: { statsExcluded: body.statsExcluded },
        ip: clientIp(request),
      });
      if (
        body.name === undefined &&
        body.role === undefined &&
        body.status === undefined
      ) {
        return NextResponse.json({ ok: true, statsExcluded: body.statsExcluded });
      }
    }

    if (body.role !== undefined && !isValidUserRole(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const result = await updateAdminUser(id, auth.user.id, body);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (body.status === "disabled") {
      await writeAuditEvent({
        actorUserId: auth.user.id,
        targetUserId: id,
        action: "user.disabled",
        ip: clientIp(request),
      });
    } else if (body.status === "active") {
      await writeAuditEvent({
        actorUserId: auth.user.id,
        targetUserId: id,
        action: "user.enabled",
        ip: clientIp(request),
      });
    } else {
      await writeAuditEvent({
        actorUserId: auth.user.id,
        targetUserId: id,
        action: "user.updated",
        detail: { name: body.name, role: body.role },
        ip: clientIp(request),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users/id PATCH]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
