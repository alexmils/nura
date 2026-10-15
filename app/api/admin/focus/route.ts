import { NextResponse } from "next/server";
import { requireAdminAccess, isAuthContext } from "@/lib/api-auth";
import { clampFocusDays, getSessionFocus } from "@/lib/session-focus";

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const days = clampFocusDays(Number(new URL(request.url).searchParams.get("days")));
  try {
    const summary = await getSessionFocus(days);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[admin/focus]", err);
    return NextResponse.json({ error: "Failed to load focus" }, { status: 500 });
  }
}
