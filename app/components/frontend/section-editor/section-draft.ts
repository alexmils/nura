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

export function clearSectionDraft(id: string) {
  if (drafts.delete(id)) emit();
}

export function commitSectionDraft(id: string) {
  const entry = drafts.get(id);
  if (!entry) return;
  entry.committed = true;
  window.setTimeout(() => {
    if (drafts.get(id) === entry) clearSectionDraft(id);
  }, 15000);
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
    if (drafts.get(id)?.committed) clearSectionDraft(id);
  }, [id, saved]);
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
