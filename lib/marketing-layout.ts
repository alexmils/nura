import { articleSlotIds, getSectionDef, isCustomSectionId, pageCtaId } from "@/lib/marketing-sections";

const articleSlots = (baseId: string) => articleSlotIds(baseId).map((id) => ({ id }));
/** Closing call to action, hidden until an admin switches it on. */
const cta = (page: string) => ({ id: pageCtaId(page) });

/**
 * Page-level section order and visibility for the public marketing pages.
 * With no saved row a page renders its built-in sections in code order,
 * which is exactly the markup it had before layouts existed.
 */

export type LayoutEntry = { id: string; hidden?: boolean };
export type PageLayout = { sections: LayoutEntry[] };

type PageSlot = { id: string; label?: string };
type PageDef = { label: string; path: string; slots: readonly PageSlot[] };

export const MARKETING_PAGES = {
  home: {
    label: "Home",
    path: "/",
    slots: [
      { id: "home-hero" },
      { id: "home-trust" },
      { id: "home-how" },
      { id: "home-modes" },
      { id: "home-session" },
      { id: "home-topics" },
      { id: "home-stories" },
      { id: "home-pricing" },
      { id: "home-faq" },
      { id: "home-blog" },
      { id: "home-close" },
    ],
  },
  pricing: {
    label: "Pricing",
    path: "/pricing",
    slots: [
      { id: "pricing-plans" },
      { id: "pricing-included" },
      { id: "pricing-faq" },
      { id: "pricing-cta" },
    ],
  },
  about: { label: "About", path: "/about", slots: [{ id: "about-page" }, cta("about")] },
  faq: { label: "FAQ", path: "/faq", slots: [{ id: "faq-page" }, cta("faq")] },
  blog: { label: "Blog", path: "/blog", slots: [{ id: "blog-index" }, cta("blog")] },
  learn: { label: "Learn", path: "/learn", slots: [{ id: "learn-hub" }, cta("learn")] },
  knowledge: {
    label: "Knowledge",
    path: "/knowledge",
    slots: [{ id: "knowledge-hero" }, { id: "knowledge-series" }, cta("knowledge")],
  },
  support: { label: "Support", path: "/support", slots: [{ id: "support-page" }, cta("support")] },
  editorial: { label: "Editorial", path: "/editorial", slots: [{ id: "editorial-page" }, cta("editorial")] },
  safety: { label: "Safety", path: "/safety", slots: [...articleSlots("safety-page"), cta("safety")] },
  limits: { label: "Limits", path: "/limits", slots: [...articleSlots("limits-page"), cta("limits")] },
  clinical: {
    label: "Clinical review",
    path: "/about/clinical-team",
    slots: [...articleSlots("clinical-intro"), { id: "clinical-advisor" }, { id: "clinical-outro" }, cta("clinical")],
  },
  emdr: {
    label: "EMDR",
    path: "/emdr",
    slots: [
      ...articleSlots("emdr-intro"),
      { id: "emdr-compare" },
      ...articleSlots("emdr-guide"),
      { id: "emdr-faq" },
      { id: "emdr-close" },
      { id: "emdr-more", label: "EMDR: keep reading (automatic links)" },
    ],
  },
} as const satisfies Record<string, PageDef>;

export type MarketingPageId = keyof typeof MARKETING_PAGES;

export const MAX_CUSTOM_SECTIONS_PER_PAGE = 24;

export const LAYOUT_ROW_PREFIX = "layout-";

export function layoutRowId(page: MarketingPageId): string {
  return `${LAYOUT_ROW_PREFIX}${page}`;
}

export function layoutDraftId(page: string): string {
  return `layout:${page}`;
}

export function isMarketingPageId(value: string): value is MarketingPageId {
  return Object.prototype.hasOwnProperty.call(MARKETING_PAGES, value);
}

function pageDef(page: MarketingPageId): PageDef {
  return MARKETING_PAGES[page] as PageDef;
}

export function builtInSlotIds(page: MarketingPageId): string[] {
  return pageDef(page).slots.map((slot) => slot.id);
}

export function slotLabel(page: MarketingPageId, id: string): string {
  const slot = pageDef(page).slots.find((entry) => entry.id === id);
  return slot?.label ?? getSectionDef(id)?.name ?? id;
}

/** Built-in slot that has a copy editor (some slots are layout-only). */
export function slotIsEditable(id: string): boolean {
  return Boolean(getSectionDef(id));
}

const DEFAULTS = new Map<MarketingPageId, PageLayout>();

export function defaultLayout(page: MarketingPageId): PageLayout {
  let layout = DEFAULTS.get(page);
  if (!layout) {
    layout = { sections: builtInSlotIds(page).map((id) => ({ id })) };
    DEFAULTS.set(page, layout);
  }
  return layout;
}

/**
 * Keeps known built-ins once each and valid custom ids; drops anything else.
 * Built-ins missing from a saved layout (new code sections) are re-inserted
 * after their nearest preceding default neighbour, so nothing disappears.
 */
export function normalizeLayout(page: MarketingPageId, input: unknown): PageLayout {
  const builtIns = builtInSlotIds(page);
  const raw =
    input && typeof input === "object" && Array.isArray((input as PageLayout).sections)
      ? ((input as PageLayout).sections as unknown[])
      : null;
  if (!raw) return defaultLayout(page);
  const seen = new Set<string>();
  const out: LayoutEntry[] = [];
  let customs = 0;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = (row as LayoutEntry).id;
    if (typeof id !== "string" || seen.has(id)) continue;
    const builtIn = builtIns.includes(id);
    if (!builtIn) {
      if (!isCustomSectionId(id) || customs >= MAX_CUSTOM_SECTIONS_PER_PAGE) continue;
      customs += 1;
    }
    seen.add(id);
    out.push((row as LayoutEntry).hidden === true ? { id, hidden: true } : { id });
  }
  builtIns.forEach((id, index) => {
    if (seen.has(id)) return;
    let at = 0;
    for (let prev = index - 1; prev >= 0; prev -= 1) {
      const found = out.findIndex((entry) => entry.id === builtIns[prev]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, { id });
    seen.add(id);
  });
  return { sections: out };
}

export function isDefaultLayout(page: MarketingPageId, layout: PageLayout): boolean {
  const def = defaultLayout(page).sections;
  return (
    layout.sections.length === def.length &&
    layout.sections.every((entry, index) => entry.id === def[index]?.id && !entry.hidden)
  );
}

export function isSectionShown(layout: PageLayout | undefined, id: string): boolean {
  if (!layout) return true;
  const entry = layout.sections.find((row) => row.id === id);
  return entry ? !entry.hidden : true;
}

export function customIdsIn(layout: PageLayout): string[] {
  return layout.sections.map((entry) => entry.id).filter(isCustomSectionId);
}