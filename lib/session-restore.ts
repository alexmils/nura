/**
 * Session continuity across reloads.
 *
 * A hard refresh (Ctrl+F5) must not drop the person out of a guided session, so
 * the open thread id is remembered per device and restored on load. This is
 * deliberately *not* "open the newest session": a bare `/app` visit still shows
 * the Home screen unless the person was in a session that is still open.
 *
 * Priority: `?thread=<id>` in the URL wins (links and tabs are explicit), then
 * the stored id. Going Home, deleting the session, or a 404 clears the store.
 */

export const LAST_SESSION_STORAGE_KEY = "nura.last-session-id";

/** Query param used for deep links to a session. */
export const SESSION_THREAD_PARAM = "thread";

/**
 * Permissive shape check. The server enforces ownership, so this only rejects
 * values that could never be an id (`""`, paths, runaway strings).
 */
export function isPlausibleThreadId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

/** Thread id from a query string, or null when absent/invalid. */
export function readThreadIdFromSearch(search: string): string | null {
  if (!search) return null;
  try {
    const raw = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search
    ).get(SESSION_THREAD_PARAM);
    return isPlausibleThreadId(raw) ? raw : null;
  } catch {
    return null;
  }
}

type ReadableStorage = Pick<Storage, "getItem"> | null | undefined;
type WritableStorage = Pick<Storage, "setItem" | "removeItem"> | null | undefined;

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Storage can throw outright in locked-down privacy modes.
    return null;
  }
}

export function readStoredSessionId(storage?: ReadableStorage): string | null {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return null;
  try {
    const raw = store.getItem(LAST_SESSION_STORAGE_KEY);
    return isPlausibleThreadId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeSessionId(
  id: string | null,
  storage?: WritableStorage
): void {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return;
  try {
    if (id === null) store.removeItem(LAST_SESSION_STORAGE_KEY);
    else store.setItem(LAST_SESSION_STORAGE_KEY, id);
  } catch {
    /* storage blocked: the session still works for this page */
  }
}

/**
 * Which session to open on load: the URL wins, otherwise the stored one.
 * Returns null when the person should land on Home.
 */
export function resolveSessionThreadId(opts: {
  search: string;
  stored?: ReadableStorage;
}): string | null {
  return (
    readThreadIdFromSearch(opts.search) ?? readStoredSessionId(opts.stored)
  );
}

/**
 * `/app?thread=<id>` (or cleared) while preserving every other query param.
 * Used with `history.replaceState`, so refreshing keeps the session.
 */
export function withThreadParam(opts: {
  pathname: string;
  search: string;
  threadId: string | null;
}): string {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(
      opts.search.startsWith("?") ? opts.search.slice(1) : opts.search
    );
  } catch {
    params = new URLSearchParams();
  }
  if (isPlausibleThreadId(opts.threadId)) {
    params.set(SESSION_THREAD_PARAM, opts.threadId);
  } else {
    params.delete(SESSION_THREAD_PARAM);
  }
  const query = params.toString();
  return query ? `${opts.pathname}?${query}` : opts.pathname;
}
