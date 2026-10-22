export type AdminNavChild = {
  href: string;
  label: string;
  /** Query tab id; used for active matching. Empty = the whole page. */
  tab?: string;
  /** Match this exact path (needed for /admin, which prefixes every page). */
  exact?: boolean;
  adminOnly?: boolean;
  /** Present in search, hidden from the sidebar submenu. */
  searchOnly?: boolean;
};

export type AdminNavIcon =
  | "overview"
  | "users"
  | "help"
  | "feedback"
  | "blog"
  | "resources"
  | "media"
  | "billing"
  | "finance"
  | "analytics"
  | "focus"
  | "places"
  | "activity"
  | "email"
  | "ai"
  | "platform"
  | "security"
  | "seo"
  | "mcp"
  | "tasks"
  | "marketing";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  exact?: boolean;
  adminOnly?: boolean;
  badge?: "help" | "feedback";
  /** A grouped parent can carry both inbox counts. */
  badges?: Array<"help" | "feedback">;
  children?: AdminNavChild[];
};

export type AdminNavSection = {
  id: string;
  label: string;
  adminOnly?: boolean;
  items: AdminNavItem[];
};

/**
 * A short, grouped sidebar: six top-level destinations instead of one row per
 * page. A group opens on its own page or on any child page, and the page tabs
 * remain in the search index (`searchOnly`) without lengthening the menu.
 */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      {
        href: "/admin",
        label: "Workspace",
        icon: "overview",
        exact: true,
        children: [
          { href: "/admin", label: "Overview", exact: true },
          { href: "/admin/tasks", label: "Tasks" },
          { href: "/admin/focus", label: "Focus" },
          { href: "/admin/places", label: "Places" },
          { href: "/admin/activity", label: "Activity" },
        ],
      },
      {
        href: "/admin/users",
        label: "People",
        icon: "users",
        badges: ["help", "feedback"],
        children: [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/help", label: "Help chat" },
          { href: "/admin/feedback", label: "Feedback & reviews" },
          {
            href: "/admin/users?tab=directory",
            label: "Directory",
            tab: "directory",
            searchOnly: true,
          },
          {
            href: "/admin/users?tab=invite",
            label: "Invite",
            tab: "invite",
            adminOnly: true,
            searchOnly: true,
          },
          {
            href: "/admin/help?tab=inbox",
            label: "Inbox",
            tab: "inbox",
            searchOnly: true,
          },
          {
            href: "/admin/help?tab=knowledge",
            label: "Knowledge",
            tab: "knowledge",
            searchOnly: true,
          },
          {
            href: "/admin/help?tab=settings",
            label: "Settings",
            tab: "settings",
            searchOnly: true,
          },
        ],
      },
      {
        href: "/admin/blog",
        label: "Content",
        icon: "blog",
        children: [
          { href: "/admin/blog", label: "Blog" },
          { href: "/admin/resources", label: "Resources" },
          { href: "/admin/media", label: "Media", adminOnly: true },
          { href: "/admin/mcp", label: "MCP", adminOnly: true },
          {
            href: "/admin/media?tab=library",
            label: "Library",
            tab: "library",
            adminOnly: true,
            searchOnly: true,
          },
          {
            href: "/admin/media?tab=settings",
            label: "Settings",
            tab: "settings",
            adminOnly: true,
            searchOnly: true,
          },
        ],
      },
      {
        href: "/admin/marketing",
        label: "Marketing",
        icon: "marketing",
        children: [
          { href: "/admin/marketing", label: "Marketing" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/seo", label: "SEO" },
          {
            href: "/admin/marketing",
            label: "Meta",
            tab: "meta",
            searchOnly: true,
          },
          {
            href: "/admin/marketing?tab=google",
            label: "Google Ads",
            tab: "google",
            searchOnly: true,
          },
          {
            href: "/admin/analytics",
            label: "Overview",
            tab: "overview",
            searchOnly: true,
          },
          {
            href: "/admin/analytics?tab=audience",
            label: "Audience",
            tab: "audience",
            searchOnly: true,
          },
          {
            href: "/admin/analytics?tab=acquisition",
            label: "Acquisition",
            tab: "acquisition",
            searchOnly: true,
          },
          {
            href: "/admin/analytics?tab=engagement",
            label: "Engagement",
            tab: "engagement",
            searchOnly: true,
          },
          {
            href: "/admin/analytics?tab=conversions",
            label: "Conversions",
            tab: "conversions",
            searchOnly: true,
          },
          {
            href: "/admin/seo",
            label: "Overview",
            tab: "overview",
            searchOnly: true,
          },
          {
            href: "/admin/seo?tab=pages",
            label: "Pages",
            tab: "pages",
            searchOnly: true,
          },
          {
            href: "/admin/seo?tab=analytics",
            label: "Analytics",
            tab: "analytics",
            searchOnly: true,
          },
          {
            href: "/admin/seo?tab=connections",
            label: "Connections",
            tab: "connections",
            searchOnly: true,
          },
          {
            href: "/admin/seo?tab=indexing",
            label: "Indexing",
            tab: "indexing",
            searchOnly: true,
          },
          {
            href: "/admin/seo?tab=cookies",
            label: "Cookies",
            tab: "cookies",
            searchOnly: true,
          },
        ],
      },
      {
        href: "/admin/billing",
        label: "Billing",
        icon: "billing",
        children: [
          { href: "/admin/billing", label: "Billing" },
          { href: "/admin/finance", label: "Finances" },
          {
            href: "/admin/billing?tab=overview",
            label: "Overview",
            tab: "overview",
            searchOnly: true,
          },
          {
            href: "/admin/billing?tab=stripe",
            label: "Stripe",
            tab: "stripe",
            searchOnly: true,
          },
          {
            href: "/admin/billing?tab=subscriptions",
            label: "Subscriptions",
            tab: "subscriptions",
            searchOnly: true,
          },
          {
            href: "/admin/billing?tab=usage",
            label: "Usage",
            tab: "usage",
            searchOnly: true,
          },
          {
            href: "/admin/finance",
            label: "Dashboard",
            tab: "dashboard",
            searchOnly: true,
          },
          {
            href: "/admin/finance?tab=plans",
            label: "Plans",
            tab: "plans",
            searchOnly: true,
          },
          {
            href: "/admin/finance?tab=payments",
            label: "Payments",
            tab: "payments",
            searchOnly: true,
          },
        ],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    adminOnly: true,
    items: [
      {
        href: "/admin/platform",
        label: "System",
        icon: "platform",
        adminOnly: true,
        children: [
          { href: "/admin/platform", label: "Platform" },
          { href: "/admin/email", label: "Email" },
          { href: "/admin/ai", label: "AI & Voice" },
          { href: "/admin/security", label: "Sign-in" },
          {
            href: "/admin/platform?tab=brand",
            label: "Brand",
            tab: "brand",
            searchOnly: true,
          },
          {
            href: "/admin/platform?tab=guided-chat",
            label: "Guided chat",
            tab: "guided-chat",
            searchOnly: true,
          },
          {
            href: "/admin/platform?tab=free-session",
            label: "Self-guided",
            tab: "free-session",
            searchOnly: true,
          },
          {
            href: "/admin/platform?tab=access",
            label: "Access",
            tab: "access",
            searchOnly: true,
          },
          {
            href: "/admin/platform?tab=features",
            label: "Features",
            tab: "features",
            searchOnly: true,
          },
          {
            href: "/admin/platform?tab=ads",
            label: "Ads",
            tab: "ads",
            searchOnly: true,
          },
          {
            href: "/admin/platform?tab=agent",
            label: "Agent",
            tab: "agent",
            searchOnly: true,
          },
          {
            href: "/admin/email?tab=delivery",
            label: "Delivery",
            tab: "delivery",
            searchOnly: true,
          },
          {
            href: "/admin/email?tab=send",
            label: "Send",
            tab: "send",
            searchOnly: true,
          },
          {
            href: "/admin/email?tab=templates",
            label: "Templates",
            tab: "templates",
            searchOnly: true,
          },
          {
            href: "/admin/email?tab=admin",
            label: "Admin",
            tab: "admin",
            searchOnly: true,
          },
          {
            href: "/admin/email?tab=log",
            label: "Log",
            tab: "log",
            searchOnly: true,
          },
          {
            href: "/admin/ai?tab=ai",
            label: "AI",
            tab: "ai",
            searchOnly: true,
          },
          {
            href: "/admin/ai?tab=voice",
            label: "Voice",
            tab: "voice",
            searchOnly: true,
          },
          {
            href: "/admin/security",
            label: "Settings",
            tab: "settings",
            searchOnly: true,
          },
          {
            href: "/admin/security?tab=limits",
            label: "Limits",
            tab: "limits",
            searchOnly: true,
          },
          {
            href: "/admin/security?tab=addresses",
            label: "Addresses",
            tab: "addresses",
            searchOnly: true,
          },
          {
            href: "/admin/security?tab=attempts",
            label: "Attempts",
            tab: "attempts",
            searchOnly: true,
          },
          {
            href: "/admin/security?tab=locks",
            label: "Locks",
            tab: "locks",
            searchOnly: true,
          },
        ],
      },
    ],
  },
];

export function adminPathMatches(
  pathname: string,
  href: string,
  exact?: boolean
): boolean {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function adminChildIsActive(
  pathname: string,
  search: string,
  parentHref: string,
  child: AdminNavChild,
  defaultTab: string
): boolean {
  const childPath = new URL(child.href, "http://nura.local").pathname;
  if (!adminPathMatches(pathname, childPath, child.exact)) return false;
  // A page-level child (Email, Users, …) stays active on any of its tabs.
  if (!child.tab) return true;

  const fallbackTab =
    childPath === parentHref
      ? defaultTab
      : ADMIN_DEFAULT_TAB_BY_PATH[childPath] ?? "";
  const currentTab = new URLSearchParams(search).get("tab") ?? fallbackTab;
  return currentTab === child.tab;
}

/** Default `?tab=` when a page omits the query — keep in sync with page tabs. */
export const ADMIN_DEFAULT_TAB_BY_PATH: Record<string, string> = {
  "/admin/users": "directory",
  "/admin/help": "inbox",
  "/admin/resources": "library",
  "/admin/billing": "overview",
  "/admin/finance": "dashboard",
  "/admin/analytics": "overview",
  "/admin/email": "delivery",
  "/admin/ai": "ai",
  "/admin/platform": "brand",
  "/admin/security": "settings",
  "/admin/seo": "overview",
  "/admin/marketing": "meta",
};

export type AdminSearchKind = "section" | "page" | "tab" | "action";

export type AdminSearchEntry = {
  id: string;
  href: string;
  title: string;
  /** e.g. "Billing · Finances" */
  group: string;
  kind: AdminSearchKind;
  adminOnly?: boolean;
  /** Extra tokens for fuzzy find (aliases). */
  keywords?: string[];
};

/**
 * Flat search index derived from `ADMIN_NAV_SECTIONS` (+ account actions).
 * New sidebar pages/sections/tabs must be added to the nav registry — search
 * picks them up automatically. Do not maintain a parallel list.
 */
export function buildAdminSearchIndex(
  isPlatformAdmin: boolean
): AdminSearchEntry[] {
  const entries: AdminSearchEntry[] = [];

  for (const section of ADMIN_NAV_SECTIONS) {
    if (section.adminOnly && !isPlatformAdmin) continue;
    const items = section.items.filter(
      (item) => !item.adminOnly || isPlatformAdmin
    );
    if (!items.length) continue;

    entries.push({
      id: `section:${section.id}`,
      href: items[0].href,
      title: section.label,
      group: "Section",
      kind: "section",
      adminOnly: section.adminOnly,
      keywords: [section.id, "section"],
    });

    for (const item of items) {
      const children = (item.children ?? []).filter(
        (c) => !c.adminOnly || isPlatformAdmin
      );
      const pageKeywords = [
        item.icon,
        ...item.href.split("/").filter(Boolean),
      ];
      if (item.href === "/admin/tasks") {
        pageKeywords.push("todo", "todos", "ideas", "board", "scratchpad");
      }
      if (item.href === "/admin" && item.exact) {
        pageKeywords.push("search console", "seo performance");
      }
      if (item.href === "/admin/marketing") {
        pageKeywords.push(
          "meta ads",
          "google ads",
          "facebook",
          "campaigns",
          "ad groups"
        );
      }
      entries.push({
        id: `page:${item.href}`,
        href: item.href,
        title: item.label,
        group: section.label,
        kind: "page",
        adminOnly: item.adminOnly,
        keywords: pageKeywords,
      });

      for (const child of children) {
        const childKeywords = child.tab
          ? [child.tab]
          : child.href.split("/").filter(Boolean);
        if (child.href === "/admin/tasks") {
          childKeywords.push("todo", "todos", "ideas", "board", "scratchpad");
        }
        entries.push({
          id: `${child.tab ? "tab" : "page"}:${item.href}:${child.href}`,
          href: child.href,
          title: child.label,
          group: `${section.label} · ${item.label}`,
          kind: child.tab ? "tab" : "page",
          adminOnly: child.adminOnly,
          keywords: childKeywords,
        });
      }
    }
  }

  entries.push({
    id: "action:/admin/settings",
    href: "/admin/settings",
    title: "Settings",
    group: "Account",
    kind: "action",
    keywords: ["profile", "avatar", "account"],
  });

  return entries;
}

function normalizeSearch(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Suggested pages when the search field is focused with an empty query. */
export function defaultAdminSearchHits(
  entries: AdminSearchEntry[],
  limit = 8
): AdminSearchEntry[] {
  const preferred = [
    "/admin/tasks",
    "/admin",
    "/admin/analytics",
    "/admin/users",
    "/admin/help",
    "/admin/seo",
    "/admin/finance",
    "/admin/settings",
  ];
  const pages = entries.filter((e) => e.kind === "page" || e.kind === "action");
  const byHref = new Map(pages.map((e) => [e.href, e]));
  const out: AdminSearchEntry[] = [];
  for (const href of preferred) {
    const hit = byHref.get(href);
    if (hit) out.push(hit);
    if (out.length >= limit) return out;
  }
  for (const page of pages) {
    if (out.some((e) => e.id === page.id)) continue;
    out.push(page);
    if (out.length >= limit) break;
  }
  return out;
}

/** Ranked filter for the admin command search. */
export function filterAdminSearch(
  entries: AdminSearchEntry[],
  query: string,
  limit = 12
): AdminSearchEntry[] {
  const q = normalizeSearch(query);
  if (!q) return defaultAdminSearchHits(entries, Math.min(limit, 8));

  const scored: { entry: AdminSearchEntry; score: number }[] = [];

  for (const entry of entries) {
    const hay = normalizeSearch(
      [entry.title, entry.group, entry.href, ...(entry.keywords ?? [])].join(" ")
    );
    const title = normalizeSearch(entry.title);
    let score = 0;
    if (title === q) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (hay.includes(q)) score = 40;
    else {
      const parts = q.split(" ").filter(Boolean);
      if (parts.length > 1 && parts.every((p) => hay.includes(p))) score = 35;
    }
    if (score > 0) {
      if (entry.kind === "page") score += 2;
      if (entry.kind === "section") score -= 1;
      scored.push({ entry, score });
    }
  }

  scored.sort(
    (a, b) =>
      b.score - a.score || a.entry.title.localeCompare(b.entry.title)
  );
  return scored.slice(0, limit).map((s) => s.entry);
}
