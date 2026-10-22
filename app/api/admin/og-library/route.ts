import { NextResponse } from "next/server";
import {
  isAuthContext,
  requirePlatformSettingsAccess,
} from "@/lib/api-auth";
import {
  createOgImage,
  deleteOgImage,
  importLegacyOgImages,
  listOgImages,
  OgImageInUseError,
  updateOgImage,
} from "@/lib/og-library";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const images = await listOgImages();
    return NextResponse.json({ images });
  } catch (err) {
    console.error("[admin/og-library GET]", err);
    return NextResponse.json(
      { error: "Could not load the OG library" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    name?: unknown;
    dataUrl?: unknown;
  };

  try {
    if (body.action === "import") {
      const imported = await importLegacyOgImages();
      return NextResponse.json({ ok: true, imported });
    }
    const image = await createOgImage({
      name: body.name,
      dataUrl: body.dataUrl,
    });
    return NextResponse.json({ ok: true, image });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the image" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    name?: unknown;
    dataUrl?: unknown;
  };
  if (typeof body.id !== "string" || !body.id.trim()) {
    return NextResponse.json({ error: "Missing image id" }, { status: 400 });
  }

  try {
    const image = await updateOgImage(body.id, {
      name: body.name,
      dataUrl: body.dataUrl,
    });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, image });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update the image" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing image id" }, { status: 400 });
  }

  try {
    await deleteOgImage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OgImageInUseError) {
      return NextResponse.json(
        { error: err.message, usedBy: err.usedBy },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete the image" },
      { status: 404 }
    );
  }
}
