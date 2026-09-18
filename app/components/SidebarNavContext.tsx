"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PanelLeft } from "lucide-react";

type SidebarNavState = {
  open: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  /** Close only on the mobile drawer — desktop rail stays open after nav/thread clicks. */
  closeSidebarDrawer: () => void;
  toggleSidebar: () => void;
};

const SidebarNavContext = createContext<SidebarNavState | null>(null);

export function SidebarNavProvider({
  children,
  forceClosed = false,
}: {
  children: ReactNode;
  /** e.g. BLS immersive — keep drawer shut */
  forceClosed?: boolean;
}) {
  const [open, setOpen] = useState(true);

  useLayoutEffect(() => {
    // Mobile drawer starts closed; desktop rail starts open (no collapse flash).
    if (window.matchMedia("(max-width: 767px)").matches) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (forceClosed) setOpen(false);
  }, [forceClosed]);

  useEffect(() => {
    if (forceClosed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      // Leave Escape to open dialogs / popovers (crisis, gear, help, …).
      if (document.querySelector('[role="dialog"]')) return;
      setOpen((wasOpen) => !wasOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forceClosed]);

  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);
  const closeSidebarDrawer = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setOpen(false);
    }
  }, []);
  const toggleSidebar = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      open,
      openSidebar,
      closeSidebar,
      closeSidebarDrawer,
      toggleSidebar,
    }),
    [open, openSidebar, closeSidebar, closeSidebarDrawer, toggleSidebar]
  );

  return (
    <SidebarNavContext.Provider value={value}>
      {children}
    </SidebarNavContext.Provider>
  );
}

export function useSidebarNav() {
  const ctx = useContext(SidebarNavContext);
  if (!ctx) {
    throw new Error("useSidebarNav must be used within SidebarNavProvider");
  }
  return ctx;
}

/** Optional when a subtree may render outside the shell (tests). */
export function useSidebarNavOptional() {
  return useContext(SidebarNavContext);
}

export function WorkspaceMenuButton() {
  const nav = useSidebarNavOptional();
  if (!nav) return null;

  return (
    <button
      type="button"
      className="workspace-menu-btn"
      aria-label={nav.open ? "Close sidebar" : "Open sidebar"}
      aria-expanded={nav.open}
      onClick={nav.toggleSidebar}
    >
      <PanelLeft size={20} strokeWidth={2} />
    </button>
  );
}

export function SidebarBackdrop() {
  const { open, closeSidebar } = useSidebarNav();
  return (
    <button
      type="button"
      className={`app-sidebar-backdrop ${open ? "is-visible" : ""}`}
      aria-label="Close sidebar"
      tabIndex={open ? 0 : -1}
      onClick={closeSidebar}
    />
  );
}
