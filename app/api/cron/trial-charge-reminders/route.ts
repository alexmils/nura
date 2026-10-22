import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { sendDueTrialChargeReminders } from "@/lib/email/billing-customer";

async function run(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueTrialChargeReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
