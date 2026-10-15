import { isAppConsolePath } from "@/lib/app-base";
import { isAdminGatePath } from "@/lib/public-paths";

/** Sent on /app and /admin responses so crawlers do not index login or console HTML. */
export const NOINDEX_ROBOTS = "noindex, nofollow, noarchive";

export function shouldNoindexPath(pathname: string): boolean {
  return (
    isAppConsolePath(pathname) ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    isAdminGatePath(pathname) ||
    pathname === "/health" ||
    pathname === "/dev" ||
    pathname.startsWith("/dev/")
  );
}
