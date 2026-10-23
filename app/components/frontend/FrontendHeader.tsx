"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Accessibility, ArrowRight, Menu, UserRound, X } from "lucide-react";
import { openAccessibilitySettings } from "@/lib/a11y-preferences";
import { APP_BASE, LOGIN_PATH, appPath } from "@/lib/app-base";
import { Avatar } from "@/app/components/Avatar";
import { BrandLockup } from "@/app/components/BrandLockup";
import {
  scrollToLandingSection,
  stashPendingLandingHash,
} from "@/lib/landing-scroll";
import "./frontend-header.css";

type MeUser = {
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role?: string;
};

/** Landing section anchors — logo is Home; keep center nav compact. */
const NAV_LINKS = [
  { href: "/", label: "Home", id: "home" },
  { href: "/#how-it-works", label: "How it works", id: "how-it-works" },
  { href: "/pricing", label: "Prices", id: "prices" },
  { href: "/learn", label: "Learn", id: "blog" },
  { href: "/faq", label: "FAQ", id: "faq" },
] as const;

/** Real routes — do not hijack as a home hash (Lenis). */
const PATH_NAV_IDS = new Set<string>(["blog", "prices", "faq"]);

function HeaderCta({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link href={href} className="frontend-header-cta">
      <span className="frontend-header-cta-text">
        <span className="frontend-header-cta-line">{label}</span>
        <span className="frontend-header-cta-line frontend-header-cta-line--hover">
          {label}
        </span>
      </span>
      <span className="frontend-header-cta-icon" aria-hidden>
        <ArrowRight />
      </span>
    </Link>
  );
}

function displayLabel(user: MeUser) {
  if (user.name?.trim()) return user.name.trim();
  return user.email.split("@")[0] ?? user.email;
}

export function FrontendHeader({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: MeUser | null }) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash.replace(/^#/, ""));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const hero = document.querySelector<HTMLElement>(".fe-hero, .v2-hero");
      if (overlay && hero) {
        const bottom = hero.getBoundingClientRect().bottom;
        // Hysteresis around the hero edge so fixed overlay does not flicker.
        setScrolled((prev) => {
          if (prev) return bottom < 140;
          return bottom < 100;
        });
        return;
      }
      // Sticky chrome: hysteresis — short pages must not oscillate at the threshold.
      setScrolled((prev) => {
        const y = window.scrollY;
        if (prev) return y > 6;
        return y > 48;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // The sheet is mobile-only; closing it on desktop also releases the scroll lock.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 992px)");
    const apply = () => {
      if (mq.matches) setMenuOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Full-screen menu: Escape closes it, Tab stays inside, focus returns to the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const menu = mobileMenuRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => menu?.querySelector<HTMLElement>("[data-autofocus]")?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (e.key !== "Tab" || !menu) return;
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus?.();
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [userMenuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const onSectionNav = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: string) => {
      closeMenu();

      // Real routes (Blog, later Resources): let Next navigate.
      if (PATH_NAV_IDS.has(id)) return;

      // Same-page: Lenis smooth scroll (Next soft-nav would not scroll).
      if (pathname === "/") {
        e.preventDefault();
        if (id === "home") {
          const ok = scrollToLandingSection("home");
          if (ok) {
            window.history.pushState(null, "", "/");
            setActiveHash("");
          }
          return;
        }
        const ok = scrollToLandingSection(id);
        if (ok) {
          window.history.pushState(null, "", `#${id}`);
          setActiveHash(id);
        }
        return;
      }

      // Other routes (404, about, …): Next soft-nav often drops `/#hash`.
      // Stash id, navigate to `/`; HomeLanding scrolls + restores the fragment.
      e.preventDefault();
      if (id === "home") {
        stashPendingLandingHash("");
        router.push("/");
        return;
      }
      stashPendingLandingHash(id);
      setActiveHash(id);
      router.push("/");
    },
    [pathname, closeMenu, router]
  );

  const isAdmin =
    user?.role === "platform_admin" || user?.role === "support";
  const dashboardHref = isAdmin ? "/admin" : APP_BASE;

  const logout = async () => {
    setUserMenuOpen(false);
    closeMenu();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  };

  const headerClass = [
    "frontend-header",
    overlay ? "frontend-header--overlay" : "",
    scrolled ? "frontend-header-scrolled" : "",
    menuOpen ? "frontend-header-menu-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = user ? displayLabel(user) : "";

  const isNavCurrent = (id: string) => {
    if (id === "blog") {
      return pathname === "/blog" || pathname.startsWith("/blog/");
    }
    if (id === "prices") {
      return pathname === "/pricing" || pathname.startsWith("/pricing/");
    }
    if (id === "faq") {
      return pathname === "/faq" || pathname.startsWith("/faq/");
    }
    if (id === "learn") {
      return pathname === "/learn" || pathname.startsWith("/learn/");
    }
    if (pathname !== "/") return false;
    if (id === "home") return !activeHash || activeHash === "home";
    return activeHash === id;
  };

  return (
    <header className={headerClass}>
      <div className="frontend-header-wrap">
        <div className="frontend-header-pill">
          <div className="frontend-header-left">
            <Link
              href="/"
              className="frontend-header-brand"
              aria-label="Nura home"
              onClick={closeMenu}
            >
              <BrandLockup
                tone={overlay && !scrolled ? "white" : "color"}
              />
            </Link>
          </div>

          <nav className="frontend-header-nav" aria-label="Site">
            {NAV_LINKS.map(({ href, label: linkLabel, id }) => (
              <Link
                key={id}
                href={href}
                className="frontend-header-link"
                aria-current={isNavCurrent(id) ? "page" : undefined}
                onClick={(e) => onSectionNav(e, id)}
              >
                {linkLabel}
              </Link>
            ))}
          </nav>

          <div className="frontend-header-right">
            {user === undefined ? (
              <span className="frontend-nav-muted" aria-hidden>
                …
              </span>
            ) : user ? (
              <div className="frontend-header-user" ref={userMenuRef}>
                <span className="frontend-header-user-name">{label}</span>
                <button
                  type="button"
                  className="frontend-header-user-avatar-btn"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Account menu for ${label}`}
                  onClick={() => setUserMenuOpen((o) => !o)}
                >
                  <Avatar
                    src={user.avatarUrl}
                    alt={label}
                    fallback={label}
                    className="avatar-sm frontend-header-avatar"
                  />
                </button>
                {userMenuOpen ? (
                  <div className="frontend-header-dropdown" role="menu">
                    <Link
                      href={dashboardHref}
                      className="frontend-header-dropdown-item"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    {!isAdmin ? (
                      <>
                        <Link
                          href={appPath("/settings?tab=profile")}
                          className="frontend-header-dropdown-item"
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          Settings
                        </Link>
                        <Link
                          href={appPath("/billing")}
                          className="frontend-header-dropdown-item"
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          Billing
                        </Link>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="frontend-header-dropdown-item frontend-header-dropdown-item--danger"
                      role="menuitem"
                      onClick={() => void logout()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="frontend-header-guest">
                <Link href={LOGIN_PATH} className="frontend-header-signin">
                  Sign in
                </Link>
                <HeaderCta
                  href={appPath("/create-account")}
                  label="Get started"
                />
              </div>
            )}

            <button
              type="button"
              className="frontend-header-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="frontend-mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={mobileMenuRef}
                id="frontend-mobile-nav"
                className="frontend-header-mobile"
                role="dialog"
                aria-modal="true"
                aria-label="Site menu"
                data-lenis-prevent
              >
                <div className="frontend-header-mobile-top">
                  <Link
                    href="/"
                    className="frontend-header-mobile-brand"
                    aria-label="Nura home"
                    onClick={closeMenu}
                  >
                    <BrandLockup tone="color" />
                  </Link>
                  <button
                    type="button"
                    data-autofocus
                    className="frontend-header-mobile-close"
                    aria-label="Close menu"
                    onClick={closeMenu}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="frontend-header-mobile-scroll">
                  <nav className="frontend-header-mobile-nav" aria-label="Mobile site">
                    {NAV_LINKS.map(({ href, label: linkLabel, id }, index) => (
                      <Link
                        key={id}
                        href={href}
                        className="frontend-header-mobile-link"
                        style={{ "--i": index } as CSSProperties}
                        aria-current={isNavCurrent(id) ? "page" : undefined}
                        onClick={(e) => onSectionNav(e, id)}
                      >
                        {linkLabel}
                      </Link>
                    ))}
                  </nav>

                  <Link
                    href={user ? dashboardHref : appPath("/create-account")}
                    className="frontend-header-mobile-cta"
                    style={{ "--i": NAV_LINKS.length } as CSSProperties}
                    onClick={closeMenu}
                  >
                    <span>{user ? "Open Nura" : "Get started"}</span>
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                </div>

                <div className="frontend-header-mobile-foot">
                  {/* Phones have no floating accessibility tab; this opens the same panel. */}
                  <button
                    type="button"
                    className="frontend-header-mobile-foot-link"
                    onClick={() => {
                      closeMenu();
                      // After the menu has closed and focus is back on its trigger.
                      requestAnimationFrame(() => requestAnimationFrame(openAccessibilitySettings));
                    }}
                  >
                    <Accessibility size={18} aria-hidden />
                    Accessibility
                  </button>
                  {user === undefined ? (
                    <span className="frontend-header-mobile-foot-muted" aria-hidden>
                      …
                    </span>
                  ) : user ? (
                    <>
                      <Link
                        href={dashboardHref}
                        className="frontend-header-mobile-foot-link"
                        onClick={closeMenu}
                      >
                        <Avatar
                          src={user.avatarUrl}
                          alt={label}
                          fallback={label}
                          className="avatar-sm frontend-header-mobile-avatar"
                        />
                        <span>{label}</span>
                      </Link>
                      <button
                        type="button"
                        className="frontend-header-mobile-foot-link"
                        onClick={() => void logout()}
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={LOGIN_PATH}
                        className="frontend-header-mobile-foot-link"
                        onClick={closeMenu}
                      >
                        <UserRound size={18} aria-hidden />
                        Sign in
                      </Link>
                      <Link
                        href="/support"
                        className="frontend-header-mobile-foot-link"
                        onClick={closeMenu}
                      >
                        Support
                      </Link>
                    </>
                  )}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </header>
  );
}
