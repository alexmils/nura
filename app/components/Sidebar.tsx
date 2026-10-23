"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MoreHorizontal,
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
import { useLongPress } from "./useLongPress";
import "./sidebar-thread-actions.css";
import { Avatar } from "./Avatar";
import { BrandLockup } from "./BrandLockup";
import { displayNameFor, useCurrentUser } from "./useCurrentUser";
import { useSidebarNav } from "./SidebarNavContext";
import { useGuideHost, useGuideOptional } from "./guide/ProductGuide";
import { APP_BASE, appPath } from "@/lib/app-base";
import { openAccessibilitySettings } from "@/lib/a11y-preferences";

const SIDEBAR_NAV = [
  { href: APP_BASE, label: "Home", icon: Home, exact: true },
  { href: appPath("/resources"), label: "Resources", icon: BookOpen, exact: false },
] as const;

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
  const [editThread, setEditThread] = useState<{ id: string; focus: "title" | "description" } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const accountFootRef = useRef<HTMLDivElement>(null);
  const helpCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Mobile only, matching the app: nav and thread clicks close the drawer but
    // leave the desktop rail alone. A step about the workspace calls this.
    closeSidebar: closeSidebarDrawer,
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

  const openCtxMenu = useCallback((threadId: string, x: number, y: number) => {
    setAccountOpen(false);
    setCtxMenu({ threadId, x, y });
  }, []);

  // Tap-and-hold a Recent item (phones), right-click or the ⋯ button (desktop).
  const longPress = useLongPress<string>((threadId, p) => openCtxMenu(threadId, p.x, p.y));

  const onSelectThread = (id: string) => {
    if (longPress.consumeClick()) return;
    void selectThread(id);
    closeSidebarDrawer();
  };

  const onNewChat = () => {
    void createThread();
    closeSidebarDrawer();
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
          <div key={t.id} className="sidebar-row-wrap" data-thread-id={t.id}>
            <button
              type="button"
              onClick={() => onSelectThread(t.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                longPress.cancel();
                openCtxMenu(t.id, e.clientX, e.clientY);
              }}
              {...longPress.bind(t.id)}
              className={`sidebar-row ${activeThreadId === t.id ? "sidebar-row-active" : ""}`}
            >
              {t.title}
            </button>
            <button
              type="button"
              className="sidebar-row-more"
              aria-label={`Actions for ${t.title}`}
              aria-haspopup="menu"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openCtxMenu(t.id, r.right - 4, r.bottom + 2);
              }}
            >
              <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
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
            {/* Phones have no floating accessibility tab; this opens the same panel. */}
            <button
              type="button"
              className="dropdown-item w-full text-left"
              role="menuitem"
              onClick={() => {
                closeAccountMenus();
                closeSidebarDrawer();
                requestAnimationFrame(() => requestAnimationFrame(openAccessibilitySettings));
              }}
            >
              Accessibility
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
            setEditThread({ id, focus: "title" });
          }}
          onEditDescription={() => {
            const id = ctxMenu.threadId;
            setCtxMenu(null);
            setEditThread({ id, focus: "description" });
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

      {editThread && (
        <ThreadEditMenu
          threadId={editThread.id}
          focus={editThread.focus}
          onClose={() => setEditThread(null)}
        />
      )}
    </aside>
  );
}
