import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveSessionUser } from "@/lib/auth/refresh-session";
import { markGuideSeen } from "@/lib/users";

/**
 * The product tour was finished or dismissed. Persist it on the account so a
 * new device (or cleared browser storage) does not bring the tour back.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const resolved = await resolveSessionUser(session);
  if (!resolved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markGuideSeen(resolved.userId);
  return NextResponse.json({ ok: true });
}
