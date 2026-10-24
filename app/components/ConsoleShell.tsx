"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";
import { AppConsoleFrame } from "./AppConsoleFrame";
import { SidebarNavProvider, useSidebarNav } from "./SidebarNavContext";
import { isSessionHostPath } from "@/lib/sidebar-thread-nav";

/**
 * Chrome shared by every console page (app/app/(console)/layout.tsx): the
 * sidebar frame and drawer state, mounted once. Immersive sets and the consent
 * lock only apply on the session screen (/app), as before.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onSession = isSessionHostPath(pathname);
  const { sessionMode, setSessionMode, consentOk } = useApp();
  const immersive = onSession && sessionMode === "running";
  const consentLock = onSession && consentOk === false;

  // A set cannot run off the session screen; never come back immersive.
  useEffect(() => {
    if (!onSession && sessionMode === "running") setSessionMode("idle");
  }, [onSession, sessionMode, setSessionMode]);

  return (
    <SidebarNavProvider forceClosed={immersive || consentLock}>
      <ConsoleFrame immersive={immersive} consentLock={consentLock}>
        {children}
      </ConsoleFrame>
    </SidebarNavProvider>
  );
}

function ConsoleFrame({
  children,
  immersive,
  consentLock,
}: {
  children: ReactNode;
  immersive: boolean;
  consentLock: boolean;
}) {
  const { open, openSidebar } = useSidebarNav();
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
      {children}
    </AppConsoleFrame>
  );
}
