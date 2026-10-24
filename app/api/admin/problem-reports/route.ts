import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
  requirePlatformAdminWrite,
} from "@/lib/api-auth";
import {
  generateProblemWinback,
  listProblemReports,
  ProblemReportError,
  sendProblemWinbackEmail,
  setProblemReportNote,
  setProblemReportStatus,
} from "@/lib/problem-reports";
import { isProblemReportStatus } from "@/lib/problem-report-rules";

/** Problem reports (newest first). ?userId=... for one person (admin user page). */
export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;
  const userId = new URL(request.url).searchParams.get("userId");
  try {
    return NextResponse.json({ reports: await listProblemReports(200, { userId: userId || null }) });
  } catch (err) {
    console.error("[admin/problem-reports]", err);
    return NextResponse.json({ error: "Failed to load problem reports" }, { status: 500 });
  }
}

/**
 * { action: "status", id, status: "confirmed" | "dismissed" | "new" }
 * { action: "note", id, note }
 * { action: "generate_winback", id } -> { link, offer, draft } (link shown once)
 * { action: "send_winback", id, subject, body } -> sends the customer email
 */
export async function POST(request: Request) {
  const auth = await requirePlatformAdminWrite();
  if (!isAuthContext(auth)) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
    status?: string;
    note?: string;
    subject?: string;
    body?: string;
  };
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Missing report id" }, { status: 400 });
  }
  const actorUserId = auth.user.id;
  try {
    switch (body.action) {
      case "status": {
        if (!isProblemReportStatus(body.status)) {
          return NextResponse.json({ error: "Unknown status" }, { status: 400 });
        }
        const report = await setProblemReportStatus({ id: body.id, status: body.status, actorUserId });
        return NextResponse.json({ report });
      }
      case "note": {
        const report = await setProblemReportNote({
          id: body.id,
          note: typeof body.note === "string" ? body.note : "",
          actorUserId,
        });
        return NextResponse.json({ report });
      }
      case "generate_winback": {
        const out = await generateProblemWinback({ id: body.id, actorUserId });
        return NextResponse.json(out);
      }
      case "send_winback": {
        const report = await sendProblemWinbackEmail({
          id: body.id,
          subject: body.subject,
          body: body.body,
          actorUserId,
        });
        return NextResponse.json({ report });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof ProblemReportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/problem-reports] POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
