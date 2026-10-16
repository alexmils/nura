import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformAdmin } from "@/lib/api-auth";
import { saveMarketingMedia } from "@/lib/marketing-media-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach an image or video." }, { status: 400 });
    }
    const saved = await saveMarketingMedia(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
