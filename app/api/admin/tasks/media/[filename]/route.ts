import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isAuthContext, requireAdminAccess } from "@/lib/api-auth";
import { resolveTaskMediaPath } from "@/lib/admin-tasks-media";

type Ctx = { params: Promise<{ filename: string }> };

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const { filename: raw } = await ctx.params;
  const filename = decodeURIComponent(raw || "");
  const full = resolveTaskMediaPath(filename);
  if (!full) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeFor(filename),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
