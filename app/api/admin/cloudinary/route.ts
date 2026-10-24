import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import {
  getCloudinaryStatus,
  saveCloudinaryAccountEmail,
  saveCloudinarySettings,
  testCloudinary,
} from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const status = await getCloudinaryStatus();
  return NextResponse.json(status);
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const body = (await request.json().catch(() => null)) as {
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
    accountEmail?: string;
  } | null;
  // Reference note only ("which Cloudinary login owns this cloud"): saved on its own.
  if (body && "accountEmail" in body && typeof body.cloudName !== "string") {
    try {
      return NextResponse.json(await saveCloudinaryAccountEmail(body.accountEmail));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  if (!body || typeof body.cloudName !== "string") {
    return NextResponse.json({ error: "Cloud name is required." }, { status: 400 });
  }
  try {
    const status = await saveCloudinarySettings({
      cloudName: body.cloudName,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : "",
      apiSecret: typeof body.apiSecret === "string" ? body.apiSecret : "",
    });
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST() {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  const result = await testCloudinary();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ count: result.count });
}
