export type AdminNavChild = {
  href: string;
  label: string;
  /** Query tab id; used for active matching. Empty = default/no tab. */
  tab?: string;
  adminOnly?: boolean;
};

export type AdminNavIcon =
  | "overview"
  | "users"
  | "help"
  | "feedback"
  | "resources"
  | "billing"
  | "finance"
  | "analytics"
  | "activity"
  | "email"
  | "ai"
  | "platform"
  | "seo";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  exact?: boolean;
  adminOnly?: boolean;
  badge?: "help" | "feedback";
  children?: AdminNavChild[];
};

export type AdminNavSection = {
  id: string;
  label: string;
  adminOnly?: boolean;
  items: AdminNavItem[];
};

/** Sectioned admin sidebar — children map to `?tab=` on the parent page. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      { href: "/admin", label: "Overview", icon: "overview", exact: true },
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: "analytics",
        children: [
          {
            href: "/admin/analytics",
            label: "Overview",
            tab: "overview",
          },
          {
            href: "/admin/analytics?tab=audience",
            label: "Audience",
            tab: "audience",
          },
          {
            href: "/admin/analytics?tab=acquisition",
            label: "Acquisition",
            tab: "acquisition",
          },
          {
            href: "/admin/analytics?tab=engagement",
            label: "Engagement",
            tab: "engagement",
          },
          {
            href: "/admin/analytics?tab=conversions",
            label: "Conversions",
            tab: "conversions",
          },
        ],
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: "users",
        children: [
          { href: "/admin/users?tab=directory", label: "Directory", tab: "directory" },
          {
            href: "/admin/users?tab=invite",
            label: "Invite",
            tab: "invite",
            adminOnly: true,
          },
        ],
      },
      {
        href: "/admin/help",
        label: "Help chat",
        icon: "help",
        badge: "help",
        children: [
          { href: "/admin/help?tab=inbox", label: "Inbox", tab: "inbox" },
          {
            href: "/admin/help?tab=knowledge",
            label: "Knowledge",
            tab: "knowledge",
          },
          {
            href: "/admin/help?tab=settings",
            label: "Settings",
            tab: "settings",
          },
        ],
      },
      {
        href: "/admin/feedback",
        label: "Feedback",
        icon: "feedback",
        badge: "feedback",
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      {
        href: "/admin/resources",
        label: "Resources",
        icon: "resources",
        children: [
          {
            href: "/admin/resources?tab=library",
            label: "Library",
            tab: "library",
          },
          {
            href: "/admin/resources?tab=editor",
            label: "Editor",
            tab: "editor",
            adminOnly: true,
          },
        ],
      },
      {
        href: "/admin/seo",
        label: "SEO",
        icon: "seo",
        children: [
          { href: "/admin/seo", label: "Overview", tab: "overview" },
          { href: "/admin/seo?tab=pages", label: "Pages", tab: "pages" },
          {
            href: "/admin/seo?tab=analytics",
            label: "Analytics",
            tab: "analytics",
          },
          {
            href: "/admin/seo?tab=connections",
            label: "Connections",
            tab: "connections",
          },
          {
            href: "/admin/seo?tab=indexing",
            label: "Indexing",
            tab: "indexing",
          },
          { href: "/admin/seo?tab=cookies", label: "Cookies", tab: "cookies" },
        ],
      },
    ],
  },
  {
    id: "revenue",
    label: "Billing",
    items: [
      {
        href: "/admin/finance",
        label: "Finances",
        icon: "finance",
        children: [
          {
            href: "/admin/finance",
            label: "Dashboard",
            tab: "dashboard",
          },
          { href: "/admin/finance?tab=plans", label: "Plans", tab: "plans" },
          {
            href: "/admin/finance?tab=payments",
            label: "Payments",
            tab: "payments",
          },
        ],
      },
      {
        href: "/admin/billing",
        label: "Billing",
        icon: "billing",
        children: [
          {
            href: "/admin/billing?tab=overview",
            label: "Overview",
            tab: "overview",
          },
          { href: "/admin/billing?tab=stripe", label: "Stripe", tab: "stripe" },
          {
            href: "/admin/billing?tab=subscriptions",
            label: "Subscriptions",
            tab: "subscriptions",
          },
          { href: "/admin/billing?tab=usage", label: "Usage", tab: "usage" },
        ],
      },
      { href: "/admin/activity", label: "Activity", icon: "activity" },
    ],
  },
  {
    id: "system",
    label: "System",
    adminOnly: true,
    items: [
      {
        href: "/admin/email",
        label: "Email",
        icon: "email",
        adminOnly: true,
        children: [
          {
            href: "/admin/email?tab=delivery",
            label: "Delivery",
            tab: "delivery",
          },
          { href: "/admin/email?tab=send", label: "Send", tab: "send" },
          {
            href: "/admin/email?tab=templates",
            label: "Templates",
            tab: "templates",
          },
          { href: "/admin/email?tab=log", label: "Log", tab: "log" },
        ],
      },
      {
        href: "/admin/ai",
        label: "AI & Voice",
        icon: "ai",
        adminOnly: true,
        children: [
          { href: "/admin/ai?tab=ai", label: "AI", tab: "ai" },
          { href: "/admin/ai?tab=voice", label: "Voice", tab: "voice" },
        ],
      },
      {
        href: "/admin/platform",
        label: "Platform",
        icon: "platform",
        adminOnly: true,
        children: [
          {
            href: "/admin/platform?tab=brand",
            label: "Brand",
            tab: "brand",
          },
          {
            href: "/admin/platform?tab=guided-chat",
            label: "Guided chat",
            tab: "guided-chat",
          },
          {
            href: "/admin/platform?tab=free-session",
            label: "Self-guided",
            tab: "free-session",
          },
          {
            href: "/admin/platform?tab=access",
            label: "Access",
            tab: "access",
          },
          {
            href: "/admin/platform?tab=features",
            label: "Features",
            tab: "features",
          },
          { href: "/admin/platform?tab=ads", label: "Ads", tab: "ads" },
          { href: "/admin/platform?tab=agent", label: "Agent", tab: "agent" },
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
  if (!adminPathMatches(pathname, parentHref)) return false;
  const currentTab = new URLSearchParams(search).get("tab") ?? defaultTab;
  const childTab = child.tab ?? defaultTab;
  return currentTab === childTab;
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
  "/admin/seo": "overview",
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
      entries.push({
        id: `page:${item.href}`,
        href: item.href,
        title: item.label,
        group: section.label,
        kind: "page",
        adminOnly: item.adminOnly,
        keywords: [item.icon, ...item.href.split("/").filter(Boolean)],
      });

      for (const child of children) {
        entries.push({
          id: `tab:${child.href}`,
          href: child.href,
          title: child.label,
          group: `${section.label} · ${item.label}`,
          kind: "tab",
          adminOnly: child.adminOnly,
          keywords: child.tab ? [child.tab] : undefined,
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

/** Ranked filter for the admin command search. */
export function filterAdminSearch(
  entries: AdminSearchEntry[],
  query: string,
  limit = 12
): AdminSearchEntry[] {
  const q = normalizeSearch(query);
  if (!q) return [];

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
