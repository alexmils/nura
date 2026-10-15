"use client";

import { useLayoutEffect, useRef } from "react";
import { useApp } from "./AppProvider";
import { AppConsoleFrame } from "./AppConsoleFrame";
import { SessionWorkspace } from "./SessionWorkspace";
import {
  SidebarNavProvider,
  useSidebarNav,
} from "./SidebarNavContext";

function AppShellFrame() {
  const { sessionMode, consentOk } = useApp();
  const { open, openSidebar } = useSidebarNav();
  const immersive = sessionMode === "running";
  const consentLock = consentOk === false;
  const wasConsentLocked = useRef(false);

  useLayoutEffect(() => {
    if (consentLock) {
      wasConsentLocked.current = true;
      return;
    }
    if (!wasConsentLocked.current) return;
    wasConsentLocked.current = false;
    // Phones keep the drawer shut. The desktop rail opens again once consent is saved.
    if (window.matchMedia("(max-width: 767px)").matches) return;
    openSidebar();
  }, [consentLock, openSidebar]);

  return (
    <AppConsoleFrame
      immersive={immersive}
      drawerOpen={open}
      consentLock={consentLock}
    >
      <SessionWorkspace />
    </AppConsoleFrame>
  );
}

export function AppShell() {
  const { sessionMode, consentOk } = useApp();
  const immersive = sessionMode === "running";
  const consentLock = consentOk === false;

  return (
    <SidebarNavProvider forceClosed={immersive || consentLock}>
      <AppShellFrame />
    </SidebarNavProvider>
  );
}
