/**
 * What a tap on a Recent session in the sidebar does.
 *
 * Every console page (`/app`, `/app/resources`, `/app/resources/<slug>`) mounts
 * its own `AppProvider`, and only `/app` (AppShell) renders the session
 * workspace. Selecting a thread elsewhere only changes that page's in-memory
 * state, so nothing visible happens. Off Home we navigate to `/app?thread=<id>`
 * instead; the Home provider restores the session from that param on mount.
 */
import { APP_BASE } from "@/lib/app-base";
import { SESSION_THREAD_PARAM, isPlausibleThreadId } from "@/lib/session-restore";

/** True on the one route that renders the session workspace. */
export function isSessionHostPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return p === APP_BASE;
}

/** Deep link that opens a session on the Home route. */
export function sessionHref(threadId: string): string {
  return `${APP_BASE}?${SESSION_THREAD_PARAM}=${encodeURIComponent(threadId)}`;
}

export type RecentThreadAction =
  | { kind: "select"; threadId: string }
  | { kind: "navigate"; threadId: string; href: string };

/** Select in place on Home; navigate to the session link from anywhere else. */
export function recentThreadAction(
  pathname: string | null | undefined,
  threadId: string
): RecentThreadAction {
  if (isSessionHostPath(pathname) || !isPlausibleThreadId(threadId)) {
    return { kind: "select", threadId };
  }
  return { kind: "navigate", threadId, href: sessionHref(threadId) };
}

/** Highlight a Recent row only when that session is actually on screen. */
export function isRecentThreadActive(
  pathname: string | null | undefined,
  activeThreadId: string | null | undefined,
  threadId: string
): boolean {
  return (
    Boolean(activeThreadId) &&
    activeThreadId === threadId &&
    isSessionHostPath(pathname)
  );
}