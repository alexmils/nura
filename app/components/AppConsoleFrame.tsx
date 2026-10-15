"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { SidebarBackdrop } from "./SidebarNavContext";

export function AppConsoleFrame({
  children,
  immersive = false,
  drawerOpen = false,
  consentLock = false,
}: {
  children: ReactNode;
  immersive?: boolean;
  drawerOpen?: boolean;
  /** Safety consent fills the screen. The rail stays out until it is confirmed. */
  consentLock?: boolean;
}) {
  return (
    <div
      className={`app-shell flex h-dvh max-h-dvh overflow-hidden ${immersive ? "session-immersive" : ""} ${drawerOpen && !consentLock ? "sidebar-drawer-open" : ""} ${consentLock ? "consent-lock" : ""}`}
    >
      {consentLock ? null : <SidebarBackdrop />}
      {consentLock ? null : <Sidebar />}
      {children}
    </div>
  );
}
