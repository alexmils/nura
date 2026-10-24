"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_HISTORY_PAGE,
  showingLabel,
  type AdminHistoryKind,
  type AdminHistoryPage,
} from "@/lib/admin-history-page";

/**
 * Rows of one paged table on the admin single-user page. Starts with what
 * the detail endpoint already sent (the newest few) and fetches the next
 * slice from the server on "Load more".
 */
export function usePagedHistory<T>(
  userId: string,
  kind: AdminHistoryKind,
  initial: T[] | undefined,
  initialTotal: number | undefined
) {
  const [items, setItems] = useState<T[]>(initial ?? []);
  const [total, setTotal] = useState<number>(initialTotal ?? initial?.length ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A reload of the detail (e.g. after an action) resets to the first page.
  useEffect(() => {
    setItems(initial ?? []);
    setTotal(initialTotal ?? initial?.length ?? 0);
    setError(null);
  }, [initial, initialTotal]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        kind,
        offset: String(items.length),
        limit: String(ADMIN_HISTORY_PAGE),
      });
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/history?${qs}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as AdminHistoryPage<T> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not load more");
      setItems((prev) => {
        const seen = new Set(prev.map((p) => JSON.stringify(p)));
        return [...prev, ...body.items.filter((i) => !seen.has(JSON.stringify(i)))];
      });
      setTotal(body.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoading(false);
    }
  }, [kind, items.length, userId]);

  return { items, total, loading, error, hasMore: items.length < total, loadMore };
}

export type PagedHistory<T> = ReturnType<typeof usePagedHistory<T>>;

/** "Showing 5 of 37" + Load more, under a table. */
export function HistoryPagerFooter<T>(props: { history: PagedHistory<T>; testId?: string }) {
  const { history } = props;
  if (history.total <= 0) return null;
  return (
    <div
      className="admin-history-pager"
      style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.6rem" }}
      data-testid={props.testId}
    >
      <span className="admin-panel-sub" style={{ margin: 0 }} aria-live="polite">
        {showingLabel(history.items.length, history.total)}
      </span>
      {history.hasMore ? (
        <button
          type="button"
          className="btn-secondary admin-btn-sm"
          disabled={history.loading}
          onClick={() => void history.loadMore()}
        >
          {history.loading ? "Loading..." : "Load more"}
        </button>
      ) : null}
      {history.error ? (
        <span className="admin-panel-sub" style={{ margin: 0 }} role="alert">
          {history.error}
        </span>
      ) : null}
    </div>
  );
}
