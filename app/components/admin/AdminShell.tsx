"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BookOpen,
  ChevronDown,
  CreditCard,
  BarChart3,
  LayoutGrid,
  Wallet,
  LifeBuoy,
  Mail,
  MessageSquareQuote,
  Plug,
  Search,
  Settings2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Avatar } from "@/app/components/Avatar";
import { BrandLockup } from "@/app/components/BrandLockup";
import { displayNameFor } from "@/app/components/useCurrentUser";
import {
  ADMIN_DEFAULT_TAB_BY_PATH,
  ADMIN_NAV_SECTIONS,
  adminChildIsActive,
  adminPathMatches,
  type AdminNavChild,
  type AdminNavIcon,
  type AdminNavItem,
} from "@/lib/admin-nav";
import { AdminSearch } from "@/app/components/admin/AdminSearch";
import { AdminPushToggle } from "@/app/components/admin/AdminPushToggle";

type AdminUser = {
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role?: string;
};

const NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutGrid,
  analytics: BarChart3,
  users: Users,
  help: LifeBuoy,
  feedback: MessageSquareQuote,
  resources: BookOpen,
  billing: CreditCard,
  finance: Wallet,
  activity: Activity,
  email: Mail,
  ai: Sparkles,
  platform: Settings2,
  seo: Search,
  mcp: Plug,
};

const USER_UPDATED = "emdr-user-updated";

function filterChildren(
  children: AdminNavChild[] | undefined,
  isPlatformAdmin: boolean
): AdminNavChild[] {
  if (!children) return [];
  return children.filter((c) => !c.adminOnly || isPlatformAdmin);
}

function NavItemLink({
  item,
  isPlatformAdmin,
  helpUnread,
  feedbackUnread,
  pathname,
  search,
}: {
  item: AdminNavItem;
  isPlatformAdmin: boolean;
  helpUnread: number;
  feedbackUnread: number;
  pathname: string;
  search: string;
}) {
  const children = filterChildren(item.children, isPlatformAdmin);
  const parentActive = adminPathMatches(pathname, item.href, item.exact);
  const defaultTab = ADMIN_DEFAULT_TAB_BY_PATH[item.href] ?? "";
  const showChildren = children.length > 0 && parentActive;
  const Icon = NAV_ICONS[item.icon];
  const leafActive = parentActive && children.length === 0;

  return (
    <div className="admin-nav-group">
      <Link
        href={item.href}
        className={`admin-nav-item ${
          leafActive ? "admin-nav-item-active" : ""
        } ${parentActive && children.length > 0 ? "admin-nav-item-open" : ""}`}
      >
        <span className="admin-nav-item-main">
          <Icon size={20} strokeWidth={1.75} className="admin-nav-icon" />
          <span className="admin-nav-label">{item.label}</span>
          {item.badge === "help" && helpUnread > 0 && (
            <span className="admin-nav-badge">{helpUnread}</span>
          )}
          {item.badge === "feedback" && feedbackUnread > 0 && (
            <span className="admin-nav-badge">{feedbackUnread}</span>
          )}
        </span>
        {children.length > 0 && (
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={`admin-nav-chevron ${showChildren ? "admin-nav-chevron-open" : ""}`}
            aria-hidden
          />
        )}
      </Link>
      {showChildren && (
        <div className="admin-nav-sub">
          {children.map((child) => {
            const active = adminChildIsActive(
              pathname,
              search,
              item.href,
              child,
              defaultTab
            );
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`admin-nav-subitem ${
                  active ? "admin-nav-subitem-active" : ""
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminShellNav({
  user,
  helpUnread,
  feedbackUnread,
}: {
  user: AdminUser | null;
  helpUnread: number;
  feedbackUnread: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isPlatformAdmin = user?.role === "platform_admin";

  return (
    <nav className="admin-sidebar-nav">
      {ADMIN_NAV_SECTIONS.filter(
        (section) => !section.adminOnly || isPlatformAdmin
      ).map((section) => {
        const items = section.items.filter(
          (item) => !item.adminOnly || isPlatformAdmin
        );
        if (!items.length) return null;
        return (
          <div key={section.id} className="admin-nav-section">
            <p className="admin-nav-section-label">{section.label}</p>
            {items.map((item) => (
              <NavItemLink
                key={item.href}
                item={item}
                isPlatformAdmin={isPlatformAdmin}
                helpUnread={helpUnread}
                feedbackUnread={feedbackUnread}
                pathname={pathname}
                search={search}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function AdminAccountMenu({
  user,
  onLogout,
}: {
  user: AdminUser | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = displayNameFor(
    user
      ? {
          id: "",
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl ?? null,
          role: user.role,
        }
      : null
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="admin-sidebar-foot" ref={rootRef}>
      <button
        type="button"
        className="admin-account-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="admin-account-identity">
          <Avatar
            src={user?.avatarUrl}
            alt={label}
            fallback={label}
            className="avatar-sm"
          />
          <span className="admin-account-text">
            <span className="admin-account-name">{label}</span>
            {user?.role === "support" ? (
              <span className="admin-account-role">Support</span>
            ) : user?.role === "platform_admin" ? (
              <span className="admin-account-role">Admin</span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`admin-account-chevron ${open ? "admin-account-chevron-open" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="admin-account-menu" role="menu">
          <Link
            href="/admin/settings"
            className="admin-account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button
            type="button"
            className="admin-account-menu-item admin-account-menu-item-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [helpUnread, setHelpUnread] = useState(0);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [demoMode, setDemoMode] = useState<boolean | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      if (!d.user) {
        router.replace("/app/login");
        return;
      }
      if (d.user.role !== "platform_admin" && d.user.role !== "support") {
        router.replace("/app");
        return;
      }
      setUser({
        email: d.user.email,
        name: d.user.name ?? null,
        avatarUrl: d.user.avatarUrl ?? null,
        role: d.user.role,
      });
    } catch {
      router.replace("/app/login");
    }
  }, [router]);

  useEffect(() => {
    void loadUser();
    const onUpdate = () => void loadUser();
    window.addEventListener(USER_UPDATED, onUpdate);
    return () => window.removeEventListener(USER_UPDATED, onUpdate);
  }, [loadUser]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const [helpRes, feedbackRes] = await Promise.all([
          fetch("/api/admin/help?view=unread"),
          fetch("/api/admin/feedback?view=unread"),
        ]);
        const helpData = await helpRes.json();
        const feedbackData = await feedbackRes.json();
        if (!cancelled && helpRes.ok) {
          setHelpUnread(Number(helpData.unread ?? 0));
        }
        if (!cancelled && feedbackRes.ok) {
          setFeedbackUnread(Number(feedbackData.unread ?? 0));
        }
      } catch {
        /* ignore */
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pullMode = async () => {
      try {
        const res = await fetch("/api/admin/stripe-mode");
        const data = (await res.json()) as { demoMode?: boolean };
        if (!cancelled && res.ok && typeof data.demoMode === "boolean") {
          setDemoMode(data.demoMode);
        }
      } catch {
        /* ignore */
      }
    };
    void pullMode();
    const onMode = () => void pullMode();
    window.addEventListener("emdr-stripe-mode", onMode);
    window.addEventListener("focus", onMode);
    return () => {
      cancelled = true;
      window.removeEventListener("emdr-stripe-mode", onMode);
      window.removeEventListener("focus", onMode);
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/app/login");
    router.refresh();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <BrandLockup href="/admin" tone="white" asset="app" />
          <p className="admin-sidebar-kicker">Admin</p>
        </div>
        <Suspense
          fallback={<nav className="admin-sidebar-nav" aria-hidden="true" />}
        >
          <AdminShellNav
            user={user}
            helpUnread={helpUnread}
            feedbackUnread={feedbackUnread}
          />
        </Suspense>
        <AdminAccountMenu user={user} onLogout={() => void logout()} />
      </aside>
      <div className="admin-canvas">
        {demoMode === true ? (
          <div className="admin-mode-banner admin-mode-banner-demo" role="status">
            <span>
              Demo / sandbox mode is active — Stripe test keys only (no real
              charges).
            </span>
            <Link
              href="/admin/billing?tab=stripe"
              className="admin-mode-banner-link"
            >
              Billing settings
            </Link>
          </div>
        ) : null}
        <div className="admin-topbar">
          <AdminSearch isPlatformAdmin={user?.role === "platform_admin"} />
          <AdminPushToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
