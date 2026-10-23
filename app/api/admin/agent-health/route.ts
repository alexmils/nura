import { NextResponse } from "next/server";
import { requireAdminAccess, isAuthContext } from "@/lib/api-auth";
import { getAgentHealthOverview } from "@/lib/agent-health";

/** Guided-session health: sets per thread, stuck threads, interpreter failures. */
export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;
  try {
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    const overview = await getAgentHealthOverview(Number.isFinite(days) ? days : 30);
    return NextResponse.json({ overview });
  } catch (err) {
    console.error("[admin/agent-health]", err);
    return NextResponse.json({ error: "Failed to load agent health" }, { status: 500 });
  }
}
