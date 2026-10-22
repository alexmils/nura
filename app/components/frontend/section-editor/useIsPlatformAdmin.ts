"use client";

import { useSyncExternalStore } from "react";

type Gate = "unknown" | "admin" | "no";

let gate: Gate = "unknown";
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ensure() {
  if (started || typeof window === "undefined") return;
  started = true;
  void fetch("/api/auth/me")
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { user?: { role?: string } } | null) => {
      gate = body?.user?.role === "platform_admin" ? "admin" : "no";
      emit();
    })
    .catch(() => {
      gate = "no";
      emit();
    });
}

/** True only after /api/auth/me reports platform_admin. Visitors stay false. */
export function useIsPlatformAdmin(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensure();
      return gate === "admin";
    },
    () => false
  );
}
