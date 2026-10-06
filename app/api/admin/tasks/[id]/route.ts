import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
  requirePlatformAdmin,
} from "@/lib/api-auth";
import {
  deleteAdminTask,
  getAdminTask,
  updateAdminTask,
} from "@/lib/admin-tasks-db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const { id } = await ctx.params;
  const row = await getAdminTask(id);
  if (!row) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    body?: string;
    status?: string;
    label?: string | null;
    sortOrder?: number;
    clearImages?: boolean;
    removeImageUrl?: string;
  };

  try {
    const row = await updateAdminTask(id, {
      body: body.body,
      status: body.status,
      label: body.label,
      sortOrder: body.sortOrder,
      clearImages: body.clearImages,
      removeImageUrl: body.removeImageUrl,
    });
    if (!row) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const { id } = await ctx.params;
  const ok = await deleteAdminTask(id);
  if (!ok) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
