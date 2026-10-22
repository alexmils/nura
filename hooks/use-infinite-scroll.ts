"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Infinite scroll for paged lists (e.g. Cloudinary's next_cursor).
 *
 * Watches a sentinel at the end of the list and calls onLoadMore when it comes
 * within rootMargin of the root's viewport (root = the scroll container; null
 * = the page). Does nothing while loading, after an error (pass disabled) or
 * when hasMore is false. The observer is recreated after every load and a new
 * observer reports straight away, so a first page that doesn't fill the
 * container keeps loading until it does or the data runs out. onLoadMore
 * should still guard against concurrent calls itself.
 */
export function useInfiniteScroll(
  sentinelRef: RefObject<Element | null>,
  {
    root,
    onLoadMore,
    hasMore,
    loading,
    disabled = false,
    rootMargin = "0px 0px 400px 0px",
    /** Anything that changes when items are appended, e.g. the item count. */
    itemCount,
  }: {
    root?: RefObject<Element | null>;
    onLoadMore: () => void | Promise<void>;
    hasMore: boolean;
    loading: boolean;
    disabled?: boolean;
    rootMargin?: string;
    itemCount?: number;
  },
) {
  const callback = useRef(onLoadMore);
  useEffect(() => {
    callback.current = onLoadMore;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || disabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void callback.current();
      },
      { root: root?.current ?? null, rootMargin },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef, root, hasMore, loading, disabled, rootMargin, itemCount]);
}