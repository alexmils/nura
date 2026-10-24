/**
 * Paged tables on the admin single-user page (login history, payments,
 * guided sessions). Pure so the API route, the page and tests agree.
 * The page shows the newest few rows; "Load more" asks the server for the
 * next slice, so a long history is never fetched in one go.
 */
export const ADMIN_HISTORY_KINDS = ["logins", "payments", "sessions"] as const;
export type AdminHistoryKind = (typeof ADMIN_HISTORY_KINDS)[number];

/** Rows the page renders before any "Load more". */
export const ADMIN_HISTORY_FIRST_PAGE = 5;
/** Rows each "Load more" click adds. */
export const ADMIN_HISTORY_PAGE = 10;
export const ADMIN_HISTORY_MAX_PAGE = 50;

export type AdminHistoryPage<T> = {
  items: T[];
  total: number;
  offset: number;
  hasMore: boolean;
};

export function isAdminHistoryKind(v: unknown): v is AdminHistoryKind {
  return typeof v === "string" && (ADMIN_HISTORY_KINDS as readonly string[]).includes(v);
}

export function parseHistoryQuery(params: URLSearchParams): {
  kind: AdminHistoryKind | null;
  offset: number;
  limit: number;
} {
  const kind = params.get("kind");
  const offset = Math.floor(Number(params.get("offset") ?? 0));
  const limit = Math.floor(Number(params.get("limit") ?? ADMIN_HISTORY_PAGE));
  return {
    kind: isAdminHistoryKind(kind) ? kind : null,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(offset, 1_000_000) : 0,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, ADMIN_HISTORY_MAX_PAGE) : ADMIN_HISTORY_PAGE,
  };
}

export function historyPage<T>(items: T[], total: number, offset: number): AdminHistoryPage<T> {
  return { items, total, offset, hasMore: offset + items.length < total };
}

/** "Showing 5 of 37" (or nothing when the table is empty). */
export function showingLabel(shown: number, total: number): string {
  if (total <= 0) return "";
  return `Showing ${Math.min(shown, total)} of ${total}`;
}
