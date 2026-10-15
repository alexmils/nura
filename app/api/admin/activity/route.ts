import { NextResponse } from "next/server";
import { requireAdminAccess, isAuthContext } from "@/lib/api-auth";
import { listAdminActivity } from "@/lib/admin-activity";

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 12);

  try {
    const items = await listAdminActivity(Number.isFinite(limit) ? limit : 12);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[admin/activity]", err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
