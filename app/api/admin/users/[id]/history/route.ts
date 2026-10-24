import { NextResponse } from "next/server";
import { isAuthContext, requireAdminAccess } from "@/lib/api-auth";
import { parseHistoryQuery } from "@/lib/admin-history-page";
import { getAdminUserHistoryPage } from "@/lib/admin-user-detail";
import { getUserById } from "@/lib/users";

/**
 * GET ?kind=logins|payments|sessions&offset=5&limit=10
 * One slice of a paged table on the admin single-user page ("Load more").
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;
  const { id } = await params;
  const q = parseHistoryQuery(new URL(request.url).searchParams);
  if (!q.kind) return NextResponse.json({ error: "Unknown history" }, { status: 400 });
  try {
    if (!(await getUserById(id))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const page = await getAdminUserHistoryPage(id, q.kind, q.offset, q.limit);
    return NextResponse.json(page);
  } catch (err) {
    console.error("[admin/users/id/history]", err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
