"use client";

import { useLayoutEffect } from "react";
import { useApp } from "./AppProvider";
import { SessionWorkspace } from "./SessionWorkspace";
import { readThreadIdFromSearch } from "@/lib/session-restore";

/**
 * The session screen at /app. The sidebar and frame live in ConsoleShell
 * (shared console layout), so state survives trips to Resources.
 */
export function AppShell() {
  const { activeThreadId, restoringSession, selectThread, threadTarget } =
    useApp();

  // Arriving with ?thread=<id> after the first load (Back/Forward, a link):
  // open that session. A cold load is AppProvider's restore. Layout effect so
  // it runs before the workspace registers its leave guard: coming back from
  // Resources never asks about a session that was not on screen.
  useLayoutEffect(() => {
    if (restoringSession) return;
    const id = readThreadIdFromSearch(window.location.search);
    if (!id || id === activeThreadId || id === threadTarget()) return;
    void selectThread(id);
    // Mount only: later changes come from in-app selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SessionWorkspace />;
}
