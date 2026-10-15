import { NextResponse } from "next/server";
import { requireAdminAccess, isAuthContext } from "@/lib/api-auth";
import { clampPlaceDays, getPlaceSummary } from "@/lib/auth-place";

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const days = clampPlaceDays(Number(new URL(request.url).searchParams.get("days")));
  try {
    const summary = await getPlaceSummary(days);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[admin/places]", err);
    return NextResponse.json({ error: "Failed to load places" }, { status: 500 });
  }
}
