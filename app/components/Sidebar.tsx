"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Home,
  Plus,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { ThreadEditMenu } from "./ThreadEditMenu";
import { ThreadContextMenu } from "./ThreadContextMenu";
import { Avatar } from "./Avatar";
import { BrandLockup } from "./BrandLockup";
import { displayNameFor, useCurrentUser } from "./useCurrentUser";
import { useSidebarNav } from "./SidebarNavContext";
import { useGuideHost, useGuideOptional } from "./guide/ProductGuide";
import { APP_BASE, appPath } from "@/lib/app-base";

const SIDEBAR_NAV = [
  { href: APP_BASE, label: "Home", icon: Home, exact: true },
  { href: appPath("/resources"), label: "Resources", icon: BookOpen, exact: false },
] as const;

const LONG_PRESS_MS = 480;
const UPGRADE_DISMISS_KEY = "nura-sidebar-upgrade-dismissed";

type CtxMenu = { threadId: string; x: number; y: number };

function upgradeDismissStorageKey(userId: string | undefined) {
  return `${UPGRADE_DISMISS_KEY}:${userId ?? "anon"}`;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    threads,
    activeThreadId,
    selectThread,
    clearActiveThread,
    createThread,
    deleteThread,
    entitlement,
    openUpgradeModal,
  } = useApp();
  const { user } = useCurrentUser();
  const { closeSidebar, closeSidebarDrawer, openSidebar } = useSidebarNav();
  const guide = useGuideOptional();
  const [accountOpen, setAccountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const [editThreadId, setEditThreadId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const accountFootRef = useRef<HTMLDivElement>(null);
  const helpCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    threadId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(upgradeDismissStorageKey(user?.id));
      setUpgradeDismissed(raw === "1");
    } catch {
      setUpgradeDismissed(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!accountOpen) {
      setHelpOpen(false);
      return;
    }
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // The tour opens this menu on purpose; its own clicks must not close it.
      if (target?.closest?.("[data-guide-root]")) return;
      if (!accountFootRef.current?.contains(target as Node)) {
        setAccountOpen(false);
        setHelpOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (helpOpen) {
        setHelpOpen(false);
        return;
      }
      setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, helpOpen]);

  useEffect(() => {
    setAccountOpen(false);
    setHelpOpen(false);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (helpCloseTimerRef.current) clearTimeout(helpCloseTimerRef.current);
    };
  }, []);

  const openHelpMenu = () => {
    if (helpCloseTimerRef.current) {
      clearTimeout(helpCloseTimerRef.current);
      helpCloseTimerRef.current = null;
    }
    setHelpOpen(true);
  };

  const scheduleCloseHelpMenu = () => {
    if (helpCloseTimerRef.current) clearTimeout(helpCloseTimerRef.current);
    helpCloseTimerRef.current = setTimeout(() => setHelpOpen(false), 120);
  };

  const closeAccountMenus = () => {
    setHelpOpen(false);
    setAccountOpen(false);
    closeSidebarDrawer();
  };

  const dismissUpgrade = () => {
    setUpgradeDismissed(true);
    try {
      localStorage.setItem(upgradeDismissStorageKey(user?.id), "1");
    } catch {
      /* ignore */
    }
  };

  const showUpgradeBanner =
    !upgradeDismissed &&
    Boolean(
      entitlement &&
        (entitlement.isTrialLimited || entitlement.needsPayment)
    );

  const upgradeBannerLead = entitlement?.isTrialLimited
    ? "Unlimited sessions — no trial caps."
    : "Unlock unlimited sessions.";

  const upgradeBannerMeta = entitlement?.isTrialLimited
    ? `${Math.max(0, entitlement.guidedRemaining)} guided · ${Math.floor(Math.max(0, entitlement.blsSecondsRemaining) / 60)}m Free remaining`
    : null;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/app/login");
    router.refresh();
  };

  const label = displayNameFor(user);

  // The product tour drives the rail: open the drawer, open the account menu,
  // and get back Home for the last step.
  useGuideHost({
    openSidebar,
    openAccountMenu: () => {
      setHelpOpen(false);
      setAccountOpen(true);
    },
    closeAccountMenu: () => {
      setHelpOpen(false);
      setAccountOpen(false);
    },
    showHome: () => {
      clearActiveThread();
      closeSidebarDrawer();
      router.push(APP_BASE);
    },
  });

  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }, []);

  const openCtxMenu = useCallback((threadId: string, x: number, y: number) => {
    setAccountOpen(false);
    setCtxMenu({ threadId, x, y });
  }, []);

  const onSelectThread = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    void selectThread(id);
    closeSidebarDrawer();
  };

  const onNewChat = () => {
    void createThread();
    closeSidebarDrawer();
  };

  const onThreadPointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    threadId: string
  ) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearLongPress();
    const x = e.clientX;
    const y = e.clientY;
    longPressRef.current = {
      threadId,
      x,
      y,
      timer: setTimeout(() => {
        const cur = longPressRef.current;
        longPressRef.current = null;
        if (!cur) return;
        suppressClickRef.current = true;
        openCtxMenu(cur.threadId, cur.x, cur.y);
      }, LONG_PRESS_MS),
    };
  };

  return (
    <aside className="app-sidebar flex h-full shrink-0 flex-col">
      <div className="app-sidebar-top">
        <BrandLockup href={null} tone="white" asset="app" />
        <button
          type="button"
          className="app-sidebar-close"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          data-guide="new-chat"
          className="btn-primary flex w-full"
        >
          <Plus size={15} strokeWidth={2} />
          New chat
        </button>
        {entitlement?.isTrialLimited && !showUpgradeBanner && (
          <button
            type="button"
            className="sidebar-trial-chip mt-2 w-full text-left"
            onClick={() => {
              openUpgradeModal("generic");
              closeSidebarDrawer();
            }}
          >
            Trial · {Math.max(0, entitlement.guidedRemaining)} guided ·{" "}
            {Math.floor(Math.max(0, entitlement.blsSecondsRemaining) / 60)}m free
          </button>
        )}
      </div>

      <nav className="sidebar-primary-nav px-2 pb-1" aria-label="Main">
        {SIDEBAR_NAV.map(({ href, label: navLabel, icon: Icon, exact }) => {
          const isHome = href === APP_BASE;
          const active = isHome
            ? pathname === href && !activeThreadId
            : exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              data-guide={isHome ? undefined : "nav-resources"}
              onClick={() => {
                if (isHome) clearActiveThread();
                closeSidebarDrawer();
              }}
              className={`sidebar-nav-link ${active ? "sidebar-nav-link-active" : ""}`}
            >
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
              {navLabel}
            </Link>
          );
        })}
      </nav>

      <p className="text-sidebar-section px-4 pb-1 pt-2">Recent</p>

      <nav className="flex-1 overflow-y-auto px-2 py-1" data-guide="threads">
        {threads.length === 0 && (
          <p className="text-sidebar-muted px-3 py-4 text-center">
            No sessions yet
          </p>
        )}
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectThread(t.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              clearLongPress();
              openCtxMenu(t.id, e.clientX, e.clientY);
            }}
            onPointerDown={(e) => onThreadPointerDown(e, t.id)}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerMove={(e) => {
              const cur = longPressRef.current;
              if (!cur) return;
              const dx = e.clientX - cur.x;
              const dy = e.clientY - cur.y;
              if (dx * dx + dy * dy > 64) {
                clearLongPress();
              }
            }}
            className={`sidebar-row ${activeThreadId === t.id ? "sidebar-row-active" : ""}`}
          >
            {t.title}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot" ref={accountFootRef}>
        {showUpgradeBanner ? (
          <div className="sidebar-upgrade-banner">
            <div className="sidebar-upgrade-banner-top">
              <span className="sidebar-upgrade-icon" aria-hidden>
                <Zap size={14} strokeWidth={2.25} />
              </span>
              <button
                type="button"
                className="sidebar-upgrade-close"
                aria-label="Dismiss upgrade offer"
                onClick={dismissUpgrade}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <p className="sidebar-upgrade-title">Upgrade to Pro!</p>
            <p className="sidebar-upgrade-body">{upgradeBannerLead}</p>
            {upgradeBannerMeta ? (
              <p className="sidebar-upgrade-meta">{upgradeBannerMeta}</p>
            ) : null}
            <button
              type="button"
              className="sidebar-upgrade-cta"
              onClick={() => {
                openUpgradeModal("generic");
                closeSidebarDrawer();
              }}
            >
              Upgrade now
            </button>
          </div>
        ) : null}
        {accountOpen ? (
          <div className="sidebar-account-menu" role="menu">
            {(user?.role === "platform_admin" || user?.role === "support") && (
              <Link
                href="/admin"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  closeSidebarDrawer();
                }}
              >
                Admin dashboard
              </Link>
            )}
            <Link
              href="/app/settings?tab=profile"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setAccountOpen(false);
                closeSidebarDrawer();
              }}
            >
              Settings
            </Link>
            <Link
              href="/app/billing"
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setAccountOpen(false);
                setHelpOpen(false);
                closeSidebarDrawer();
              }}
            >
              Billing
            </Link>
            <button
              type="button"
              className="dropdown-item w-full text-left"
              role="menuitem"
              data-guide="guide-item"
              onClick={() => {
                closeAccountMenus();
                guide?.start(0);
              }}
            >
              Guide
            </button>
            <div
              className="sidebar-help-wrap"
              onMouseEnter={openHelpMenu}
              onMouseLeave={scheduleCloseHelpMenu}
            >
              <button
                type="button"
                className={`dropdown-item sidebar-help-trigger w-full text-left${helpOpen ? " is-open" : ""}`}
                role="menuitem"
                aria-expanded={helpOpen}
                aria-haspopup="menu"
                onClick={() => setHelpOpen((o) => !o)}
              >
                <span>Help</span>
                <ChevronRight
                  size={14}
                  strokeWidth={2}
                  className="sidebar-help-chevron"
                  aria-hidden
                />
              </button>
              {helpOpen ? (
                <div
                  className="sidebar-help-submenu"
                  role="menu"
                  aria-label="Help"
                >
                  <Link
                    href="/privacy"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={closeAccountMenus}
                  >
                    Privacy policy
                  </Link>
                  <Link
                    href="/privacy#cookies"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={closeAccountMenus}
                  >
                    Cookie policy
                  </Link>
                  <Link
                    href="/terms"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={closeAccountMenus}
                  >
                    Terms of service
                  </Link>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="dropdown-item w-full text-left text-[var(--destructive)]"
              role="menuitem"
              onClick={() => void logout()}
            >
              Logout
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() =>
            setAccountOpen((o) => {
              if (o) setHelpOpen(false);
              return !o;
            })
          }
          className="sidebar-account-btn"
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          data-guide="account"
        >
          <span className="sidebar-account-identity">
            <Avatar
              src={user?.avatarUrl}
              alt={label}
              fallback={label}
              className="avatar-sm"
            />
            <span className="min-w-0 truncate text-[length:var(--ui-body)]">
              {label}
              {user?.role === "platform_admin" && (
                <span className="ml-1 text-[var(--accent)]">· Admin</span>
              )}
              {user?.role === "support" && (
                <span className="ml-1 text-[var(--accent)]">· Support</span>
              )}
            </span>
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 opacity-60 transition ${accountOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {ctxMenu && (
        <ThreadContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onRename={() => {
            const id = ctxMenu.threadId;
            setCtxMenu(null);
            setEditThreadId(id);
          }}
          onDelete={() => {
            const id = ctxMenu.threadId;
            const title =
              threads.find((t) => t.id === id)?.title ?? "this session";
            setCtxMenu(null);
            if (
              !window.confirm(
                `Delete “${title}”? This cannot be undone.`
              )
            ) {
              return;
            }
            void deleteThread(id);
          }}
        />
      )}

      {editThreadId && (
        <ThreadEditMenu
          threadId={editThreadId}
          onClose={() => setEditThreadId(null)}
        />
      )}
    </aside>
  );
}
