import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_BASE, LOGIN_PATH, isAppConsolePath } from "@/lib/app-base";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  ROLE_SYNC_COOKIE,
  ROLE_SYNC_MAX_AGE_SEC,
} from "@/lib/auth/role-sync";
import { NOINDEX_ROBOTS, shouldNoindexPath } from "@/lib/crawl-headers";
import {
  isAuthLinkScreen,
  isAuthPublicPath,
  isUnauthenticatedPublicPath,
  legacyConsolePath,
} from "@/lib/public-paths";
import {
  canManagePlatformSettings,
  isAdminRole,
  type UserRole,
} from "@/lib/roles";

const SYNC_SESSION_PATH = "/api/auth/sync-session";

/**
 * TEMPORARY: sink for public/voice-diagnostic.html. Left unauthenticated so a
 * phone can report even when the app session is missing. Delete together with
 * the page once the iOS voice investigation is closed.
 */
const VOICE_DIAG_PATH = "/api/voice-diagnostic-log";

/**
 * Blog MCP endpoint. Authenticates with its own bearer token
 * (`NURA_MCP_TOKEN`), so it must bypass session middleware.
 */
const MCP_PATH = "/api/mcp";

/**
 * Internal origin for middleware → route fetches.
 * Must NOT use the public tunnel host (dev.nurahelp.com) — Cloudflare Access
 * would intercept and cause redirect loops.
 */
function internalOrigin(request: NextRequest): string {
  const port =
    request.nextUrl.port ||
    process.env.PORT ||
    (request.nextUrl.protocol === "https:" ? "443" : "3471");
  // Prefer loopback: tunnel terminates on localhost; Access never sees this hop.
  if (port === "443" || port === "80") {
    return `http://127.0.0.1:${process.env.PORT || "3471"}`;
  }
  return `http://127.0.0.1:${port}`;
}

function jwtRole(session: { role?: UserRole }): UserRole {
  if (session.role === "platform_admin") return "platform_admin";
  if (session.role === "support") return "support";
  return "user";
}

function needsRoleSync(pathname: string, session: { role?: UserRole }): boolean {
  return (
    isAdminRole(jwtRole(session)) ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin")
  );
}

function hasFreshRoleSync(request: NextRequest): boolean {
  return request.cookies.get(ROLE_SYNC_COOKIE)?.value === "1";
}

/**
 * Sync JWT role from DB at most once per ROLE_SYNC_MAX_AGE_SEC window,
 * and only on document navigations — never on /api/* (admin pages fire many
 * parallel APIs; each used to nest another sync-session and overload Turbopack).
 */
function shouldFetchDbRole(
  request: NextRequest,
  pathname: string,
  session: { role?: UserRole }
): boolean {
  if (!needsRoleSync(pathname, session)) return false;
  if (pathname.startsWith("/api/")) return false;
  if (hasFreshRoleSync(request)) return false;
  return true;
}

function markRoleSynced(response: NextResponse): NextResponse {
  response.cookies.set({
    name: ROLE_SYNC_COOKIE,
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ROLE_SYNC_MAX_AGE_SEC,
  });
  return response;
}

async function resolveRoleFromDb(
  request: NextRequest
): Promise<{ role: UserRole | null; setCookies: string[]; synced: boolean }> {
  const session = await getSessionFromRequest(request);
  if (!session) return { role: null, setCookies: [], synced: false };

  try {
    const syncUrl = new URL(SYNC_SESSION_PATH, internalOrigin(request));
    const res = await fetch(syncUrl, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });

    if (!res.ok) return { role: jwtRole(session), setCookies: [], synced: false };

    const data = (await res.json()) as { role?: UserRole };
    const role =
      data.role === "platform_admin"
        ? "platform_admin"
        : data.role === "support"
          ? "support"
          : "user";
    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie")!]
          : [];

    return { role, setCookies, synced: true };
  } catch {
    return { role: jwtRole(session), setCookies: [], synced: false };
  }
}

function withCookies(
  response: NextResponse,
  setCookies: string[],
  synced: boolean
) {
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  if (synced) markRoleSynced(response);
  return response;
}

function applyCrawlHeaders(pathname: string, res: NextResponse): NextResponse {
  if (shouldNoindexPath(pathname)) {
    res.headers.set("X-Robots-Tag", NOINDEX_ROBOTS);
  }
  return res;
}

function isSupportWriteBlocked(pathname: string, method: string) {
  if (method === "GET" || method === "HEAD") return false;
  // Support may reply in the help inbox.
  if (pathname.startsWith("/api/admin/help")) return false;
  return pathname.startsWith("/api/admin");
}

function isSupportPageBlocked(pathname: string) {
  return (
    pathname.startsWith("/admin/platform") ||
    pathname.startsWith("/admin/email") ||
    pathname.startsWith("/admin/ai") ||
    pathname.startsWith("/api/admin/platform") ||
    pathname.startsWith("/api/admin/email")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Frontend + auth screens + public APIs: never require login.
  if (isUnauthenticatedPublicPath(pathname)) {
    if (isAuthPublicPath(pathname)) {
      // Reset / invite links must open even when a session exists, otherwise a
      // Google-signed-in user can never open the link to set a password.
      if (isAuthLinkScreen(pathname)) {
        return applyCrawlHeaders(pathname, NextResponse.next());
      }
      const session = await getSessionFromRequest(request);
      if (session) {
        const { role, setCookies, synced } = await resolveRoleFromDb(request);
        // Do not call /api/auth/access here — under Cloudflare Access that
        // nested public-URL fetch causes ERR_TOO_MANY_REDIRECTS.
        // Send consumers to /app; AppAccessGate + APIs enforce onboarding.
        const dest = isAdminRole(role ?? "user") ? "/admin" : APP_BASE;
        if (dest === pathname) {
          return applyCrawlHeaders(
            pathname,
            withCookies(NextResponse.next(), setCookies, synced)
          );
        }
        const response = NextResponse.redirect(new URL(dest, request.url));
        return applyCrawlHeaders(
          pathname,
          withCookies(response, setCookies, synced)
        );
      }
    }
    return applyCrawlHeaders(pathname, NextResponse.next());
  }

  // Old console bookmarks / email links (before /app prefix).
  // Unknown frontend paths fall through to not-found (do not soft-redirect to `/`).
  if (!isAppConsolePath(pathname) && !pathname.startsWith("/admin")) {
    const mapped = legacyConsolePath(pathname);
    if (mapped) {
      const url = request.nextUrl.clone();
      url.pathname = mapped;
      return applyCrawlHeaders(pathname, NextResponse.redirect(url, 308));
    }
    if (!pathname.startsWith("/api/")) {
      return applyCrawlHeaders(pathname, NextResponse.next());
    }
  }

  if (
    pathname === SYNC_SESSION_PATH ||
    pathname === "/api/auth/access" ||
    pathname === VOICE_DIAG_PATH ||
    pathname === MCP_PATH
  ) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL(LOGIN_PATH, request.url);
    const nextTarget = `${pathname}${request.nextUrl.search || ""}` || APP_BASE;
    login.searchParams.set("next", nextTarget);
    return applyCrawlHeaders(pathname, NextResponse.redirect(login));
  }

  const sync = shouldFetchDbRole(request, pathname, session);
  const { role, setCookies, synced } = sync
    ? await resolveRoleFromDb(request)
    : { role: jwtRole(session), setCookies: [] as string[], synced: false };

  if (role === "platform_admin" || role === "support") {
    const adminAllowed =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/api/help");
    if (!adminAllowed) {
      if (pathname.startsWith("/api/")) {
        return applyCrawlHeaders(
          pathname,
          withCookies(
            NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            setCookies,
            synced
          )
        );
      }
      return applyCrawlHeaders(
        pathname,
        withCookies(
          NextResponse.redirect(new URL("/admin", request.url)),
          setCookies,
          synced
        )
      );
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!isAdminRole(role ?? "user")) {
      if (pathname.startsWith("/api/")) {
        return applyCrawlHeaders(
          pathname,
          withCookies(
            NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            setCookies,
            synced
          )
        );
      }
      return applyCrawlHeaders(
        pathname,
        withCookies(
          NextResponse.redirect(new URL(APP_BASE, request.url)),
          setCookies,
          synced
        )
      );
    }

    if (role === "support") {
      if (
        isSupportPageBlocked(pathname) ||
        isSupportWriteBlocked(pathname, request.method)
      ) {
        if (pathname.startsWith("/api/")) {
          return applyCrawlHeaders(
            pathname,
            withCookies(
              NextResponse.json({ error: "Forbidden" }, { status: 403 }),
              setCookies,
              synced
            )
          );
        }
        return applyCrawlHeaders(
          pathname,
          withCookies(
            NextResponse.redirect(new URL("/admin", request.url)),
            setCookies,
            synced
          )
        );
      }
    }
  }

  if (
    pathname.startsWith("/admin/platform") ||
    pathname.startsWith("/api/admin/platform")
  ) {
    if (!canManagePlatformSettings(role ?? "user")) {
      if (pathname.startsWith("/api/")) {
        return applyCrawlHeaders(
          pathname,
          withCookies(
            NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            setCookies,
            synced
          )
        );
      }
      return applyCrawlHeaders(
        pathname,
        withCookies(
          NextResponse.redirect(new URL("/admin", request.url)),
          setCookies,
          synced
        )
      );
    }
  }

  // Onboarding / payment UX gate lives in AppAccessGate (client) + APIs.
  // Middleware must not nested-fetch /api/auth/access via the public host —
  // Cloudflare Access on dev.nurahelp.com turns that into redirect loops.

  return applyCrawlHeaders(
    pathname,
    withCookies(NextResponse.next(), setCookies, synced)
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
