import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
  requirePlatformAdmin,
} from "@/lib/api-auth";
import { createAdminTask, listAdminTasks } from "@/lib/admin-tasks-db";

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  try {
    const result = await listAdminTasks({
      status: searchParams.get("status") || undefined,
      label: searchParams.get("label") || undefined,
      q: searchParams.get("q") || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list tasks.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    body?: string;
    status?: string;
    label?: string | null;
  };

  try {
    const row = await createAdminTask({
      body: body.body || "",
      status: body.status,
      label: body.label,
      createdByUserId: auth.user.id,
    });
    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
