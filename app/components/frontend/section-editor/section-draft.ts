"use client";

import { useEffect, useSyncExternalStore } from "react";

type Entry = { value: unknown; committed: boolean };

const drafts = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setSectionDraft(id: string, value: unknown) {
  drafts.set(id, { value, committed: false });
  emit();
}

/** Current draft value, if an editor has one open for `id`. */
export function getSectionDraft<T>(id: string): T | undefined {
  return drafts.get(id)?.value as T | undefined;
}

export function clearSectionDraft(id: string) {
  if (drafts.delete(id)) emit();
}

/**
 * After a save the draft stays on screen until the refreshed server data
 * matches it (see useDraftOr). Fallback: it is dropped after this long anyway,
 * so a save the server never reflects cannot pin a draft forever.
 */
export const COMMITTED_DRAFT_TTL_MS = 30000;

export function commitSectionDraft(id: string) {
  const entry = drafts.get(id);
  if (!entry) return;
  entry.committed = true;
  window.setTimeout(() => {
    if (drafts.get(id) === entry) clearSectionDraft(id);
  }, COMMITTED_DRAFT_TTL_MS);
}

/** Order-insensitive JSON for comparing a draft with server data. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (!inner || typeof inner !== "object" || Array.isArray(inner)) return inner;
    const record = inner as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  });
}

/** True when the saved (server) value already shows what the draft holds. */
export function draftMatches(draft: unknown, saved: unknown): boolean {
  if (draft === saved) return true;
  try {
    return stableJson(draft) === stableJson(saved);
  } catch {
    return false;
  }
}

export function useSectionDraft<T>(id: string): T | undefined {
  return useSyncExternalStore(
    subscribe,
    () => drafts.get(id)?.value as T | undefined,
    () => undefined
  );
}

export function useDraftOr<T>(id: string, saved: T): T {
  const draft = useSectionDraft<T>(id);
  useEffect(() => {
    const entry = drafts.get(id);
    // A committed draft yields only to server data that matches it; a stale
    // (cached) refresh keeps the draft until COMMITTED_DRAFT_TTL_MS.
    if (entry?.committed && draftMatches(entry.value, saved)) clearSectionDraft(id);
  }, [id, saved, draft]);
  return draft ?? saved;
}

export function useEditorDraft<T>(id: string, value: T | null | undefined) {
  useEffect(() => {
    if (value != null) setSectionDraft(id, value);
  }, [id, value]);
  useEffect(
    () => () => {
      if (drafts.get(id) && !drafts.get(id)?.committed) clearSectionDraft(id);
    },
    [id]
  );
}
