import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { processDueGuestTranscripts } from "@/lib/help-guest-transcript";

async function run(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDueGuestTranscripts();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
