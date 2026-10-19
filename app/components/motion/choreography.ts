"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { MOTION_DURATION, MOTION_STAGGER } from "@/lib/motion";

/**
 * Scroll choreography: named, transform/opacity-only scroll patterns that the
 * home page wires by hand and every other public page gets automatically.
 *
 * Learned from the alexandermils studio site: each section boundary gets ONE
 * named move (recede, rise, glide, settle, drift, cascade) and neighbours never
 * repeat. Time-based arrivals use the motion tokens (`lib/motion.ts`);
 * scroll-linked moves are linear in scroll (`ease: "none"` + scrub).
 *
 * - SSR renders everything visible; start states are only set here, on the client.
 * - Reduced motion (media query or the a11y widget) builds nothing, and turning
 *   the widget on mid-visit reverts every tween.
 * - The build re-runs when the page's editable sections change (show / hide /
 *   reorder in the section editor), so offsets and neighbours stay correct.
 *   Elements that already played their arrival are not hidden again.
 */

export const CHOREO_MOBILE_QUERY = "(max-width: 760px)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Never touched by the automatic pass: own motion, sticky stages, editor UI. */
export const CHOREO_EXCLUDE = [
  ".fe-topics",
  ".v2-price-grid",
  ".fe-ft-wordmark",
  ".fe-custom--marquee",
  ".fe-spath",
  ".fe-letter-reveal",
  ".fe-animate",
  ".fe-editor-drawer",
  ".fe-section-chip",
  ".fe-hidden-section",
  ".fe-layout-editor",
  "[data-mo-skip]",
].join(", ");

export type ChoreoContext = {
  root: HTMLElement;
  mobile: boolean;
  /** Elements whose arrival already played (kept across rebuilds). */
  seen: WeakSet<Element>;
};

/** Arrival ease: the token `--mo-ease-out` (.22,1,.36,1) is an expo-out. */
export const ARRIVE_EASE = "expo.out";

/**
 * Once-only arrival for a set of elements: each plays when it reaches `start`,
 * siblings that enter together stagger. Items already played are skipped.
 */
export function arrive(
  els: Element[],
  from: gsap.TweenVars,
  ctx: ChoreoContext,
  opts: { start?: string; stagger?: number; duration?: number } = {}
) {
  const todo = els.filter((el) => !ctx.seen.has(el));
  if (!todo.length) return;
  const to: gsap.TweenVars = {};
  for (const key of Object.keys(from)) {
    to[key] = key === "opacity" || key === "scale" ? 1 : 0;
  }
  gsap.set(todo, from);
  ScrollTrigger.batch(todo, {
    start: opts.start ?? "top 88%",
    once: true,
    onEnter: (batch) => {
      batch.forEach((el) => ctx.seen.add(el));
      gsap.to(batch, {
        ...to,
        duration: opts.duration ?? MOTION_DURATION.slow,
        ease: ARRIVE_EASE,
        stagger: opts.stagger ?? MOTION_STAGGER.loose,
        overwrite: "auto",
        // Leave no transform behind: it would trap fixed/sticky descendants.
        clearProps: "transform,translate,rotate,scale,opacity",
      });
    },
  });
}

/** Scroll-linked move, linear in scroll. */
export function scrub(
  target: Element | Element[],
  from: gsap.TweenVars,
  to: gsap.TweenVars,
  trigger: Element,
  start: string,
  end: string
) {
  gsap.fromTo(target, from, {
    ...to,
    ease: "none",
    scrollTrigger: { trigger, start, end, scrub: 0.6, invalidateOnRefresh: true },
  });
}

const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

/** The colour a block actually shows: its own background, else the nearest painted ancestor's. */
export function paintedBg(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (!TRANSPARENT.test(bg)) return bg;
  }
  return "rgb(255, 255, 255)";
}

const ownsBg = (el: Element) => {
  const s = getComputedStyle(el);
  return !TRANSPARENT.test(s.backgroundColor) || s.backgroundImage !== "none";
};

/** Sticky/fixed children break under a transformed ancestor. */
function pinnedInside(el: Element): boolean {
  const pinned = (node: Element) => /sticky|fixed/.test(getComputedStyle(node).position);
  return pinned(el) || [...el.querySelectorAll<HTMLElement>("*")].some(pinned);
}

export type HandoffKind = "stack" | "curve";

/**
 * Section-level hand-off between two neighbouring blocks, scrubbed over the
 * next block's entry (its top from the viewport bottom to the top).
 *
 * - stack: adapted from alexandermils' SectionHandoff effect="rise". There the
 *   outgoing panel is pinned (sticky, bottom on the viewport bottom), the next
 *   section is pulled up 100svh with a higher z-index and slides over it, and
 *   a black layer dims the pinned panel to 55%. Here the previous block is
 *   counter-translated down at almost the scroll speed instead of pinned (so
 *   no wrapper heights, pull-ups or pins that would fight the section editor's
 *   show/hide/reorder), scales to 92% and dims to 55% brightness, while the
 *   next block slides over it with rounded top corners and a soft shadow.
 * - curve: the next block arrives with a curved, dome-shaped top edge that
 *   flattens as it comes up; the previous block sinks back and dims.
 *
 * Only the two section boxes move (transform/opacity, plus the radius and the
 * dome edge on the incoming block), so whatever animates inside them keeps
 * working. A previous block with sticky children is never transformed. Curve
 * falls back to stack when the two blocks share a colour (the dome would be
 * invisible) or the next block clips its overflow.
 */
/** Climb to the ancestors of a and b that are siblings, so z-index compares in one stacking context. */
function siblingBoxes(a: HTMLElement, b: HTMLElement): [HTMLElement, HTMLElement] {
  let nb = b;
  while (nb.parentElement && !nb.parentElement.contains(a)) nb = nb.parentElement;
  const parent = nb.parentElement;
  let na = a;
  while (parent && na.parentElement && na.parentElement !== parent) na = na.parentElement;
  return [na, nb];
}

const zOf = (el: Element) => parseInt(getComputedStyle(el).zIndex, 10) || 0;

export const siblingBoxesOf = siblingBoxes;
export const pinnedInsideOf = pinnedInside;

export function handoff(prevIn: HTMLElement | null, nextIn: HTMLElement | null, kind: HandoffKind, mobile = false): HandoffKind | null {
  if (!nextIn) return null;
  const [prev, next] = prevIn ? siblingBoxes(prevIn, nextIn) : [null, nextIn];
  if (prev === next) return null;
  const nextBg = paintedBg(next);
  let use = kind;
  if (use === "curve") {
    const clips = /hidden|clip/.test(getComputedStyle(next).overflowY);
    if (clips || (prev && paintedBg(prev) === nextBg)) use = "stack";
  }
  nextIn.setAttribute("data-mo-handoff", use);
  // Each incoming block sits one layer above the block it covers.
  const prevZ = prev ? Math.max(1, zOf(prev)) : 1;
  gsap.set(next, { position: getComputedStyle(next).position === "static" ? "relative" : undefined, zIndex: Math.max(prevZ + 1, zOf(next)) });
  if (!ownsBg(next)) gsap.set(next, { backgroundColor: nextBg });
  const range = { trigger: next, start: "top bottom", end: mobile ? "top 30%" : "top top", scrub: 0.5, invalidateOnRefresh: true };
  const movePrev = prev && !pinnedInside(prev);
  if (prev && !zOf(prev)) gsap.set(prev, { position: getComputedStyle(prev).position === "static" ? "relative" : undefined, zIndex: 1 });

  if (use === "stack") {
    const r = mobile ? 28 : 56;
    gsap.fromTo(
      next,
      { borderTopLeftRadius: r, borderTopRightRadius: r, boxShadow: "0 -28px 60px -24px rgba(42, 48, 32, 0.35)" },
      { borderTopLeftRadius: 0, borderTopRightRadius: 0, boxShadow: "0 0px 0px 0px rgba(42, 48, 32, 0)", ease: "none", scrollTrigger: range }
    );
    if (movePrev) {
      gsap.fromTo(
        prev,
        { y: 0, scale: 1, filter: "brightness(1)", transformOrigin: "50% 100%" },
        {
          y: () => Math.min(window.innerHeight, next.offsetHeight) * (mobile ? 0.5 : 0.85),
          scale: mobile ? 0.95 : 0.92,
          filter: "brightness(0.55)",
          ease: "none",
          scrollTrigger: range,
        }
      );
    }
  } else {
    next.classList.add("mo-curve");
    gsap.set(next, { "--mo-curve-bg": nextBg });
    gsap.fromTo(next, { "--mo-curve": 1 }, { "--mo-curve": 0, ease: "none", scrollTrigger: { ...range, end: "top 25%" } });
    if (movePrev) {
      gsap.fromTo(
        prev,
        { y: 0, scale: 1, filter: "brightness(1)", transformOrigin: "50% 100%" },
        { y: () => Math.min(window.innerHeight, next.offsetHeight) * (mobile ? 0.35 : 0.6), filter: "brightness(0.7)", scale: 0.95, ease: "none", scrollTrigger: range }
      );
    }
  }
  return use;
}

function motionReduced(): boolean {
  return window.matchMedia(REDUCE_QUERY).matches || isA11yReduceMotionPreferred();
}

/**
 * Runs `build` inside a GSAP context on `getRoot()`, and rebuilds when the
 * signature (editable sections, headings, images) changes or the viewport
 * crosses the mobile breakpoint. `key` re-runs it (e.g. the pathname).
 */
export function useChoreography(
  getRoot: () => HTMLElement | null,
  build: (ctx: ChoreoContext) => void,
  key: string = "",
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    const root = getRoot();
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const seen = new WeakSet<Element>();
    let gctx: gsap.Context | null = null;
    let timer = 0;
    let signature = "";
    const sign = () =>
      [
        [...root.querySelectorAll("[data-section]")].map((el) => el.getAttribute("data-section")).join(","),
        root.querySelectorAll("h1, h2, h3, img, details").length,
      ].join("|");

    const run = () => {
      gctx?.revert();
      gctx = null;
      signature = sign();
      if (motionReduced()) return;
      const mobile = window.matchMedia(CHOREO_MOBILE_QUERY).matches;
      gctx = gsap.context(() => {
        build({ root, mobile, seen });
        // Named hand-offs are tagged for debugging and tests; untag on revert.
        return () => {
          root.querySelectorAll("[data-mo-handoff]").forEach((el) => el.removeAttribute("data-mo-handoff"));
          root.querySelectorAll(".mo-curve").forEach((el) => el.classList.remove("mo-curve"));
          root.querySelectorAll(".mo-layer").forEach((el) => el.remove());
        };
      }, root);
      ScrollTrigger.refresh();
    };

    // Let the page's own layout and motion settle first.
    const first = window.setTimeout(run, 60);
    const onMutate = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (sign() !== signature) run();
      }, 450);
    };
    const tree = new MutationObserver(onMutate);
    tree.observe(root, { childList: true, subtree: true });
    const a11y = new MutationObserver(run);
    a11y.observe(document.documentElement, { attributes: true, attributeFilter: ["data-a11y-motion"] });
    const mq = window.matchMedia(CHOREO_MOBILE_QUERY);
    const rq = window.matchMedia(REDUCE_QUERY);
    mq.addEventListener("change", run);
    rq.addEventListener("change", run);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(timer);
      tree.disconnect();
      a11y.disconnect();
      mq.removeEventListener("change", run);
      rq.removeEventListener("change", run);
      gctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}

const usable = (el: Element) => !el.closest(CHOREO_EXCLUDE) && !el.querySelector(".fe-animate, .fe-letter-reveal");


/** A grid/flex row of 3+ like-for-like blocks (cards, tiles, panels). */
function cardGroups(root: HTMLElement): HTMLElement[][] {
  const groups: HTMLElement[][] = [];
  root.querySelectorAll<HTMLElement>("*").forEach((parent) => {
    const kids = [...parent.children] as HTMLElement[];
    if (kids.length < 3 || kids.length > 40) return;
    const display = getComputedStyle(parent).display;
    if (!/grid|flex/.test(display)) return;
    const sig = (el: Element) => `${el.tagName}.${(el.className && typeof el.className === "string" ? el.className.split(" ")[0] : "")}`;
    const first = sig(kids[0]);
    if (!kids.every((kid) => sig(kid) === first)) return;
    if (/^(P|SPAN|A|H\d|LABEL|INPUT|BUTTON|IMG|SVG)\./i.test(first)) return;
    // Masonry columns and full-height panels are containers, not cards.
    if (!kids.every((kid) => kid.offsetHeight >= 72 && kid.offsetHeight < window.innerHeight * 1.1 && usable(kid))) return;
    if (groups.some((g) => g.some((kid) => kid.contains(parent)))) return;
    groups.push(kids);
  });
  return groups;
}

/**
 * Automatic pass for every public page except home (which is wired by hand):
 *
 * - Page title: "title lift" — kicker, H1 and lead rise with a slight skew settling.
 * - Section headings: "heading rise" with the next paragraph trailing.
 * - Card rows: "cascade" — rise + settle from 96%, alternate cards travel further.
 * - Accordions: "ticker" — items slide in from the left one by one.
 * - Large images in a clipping frame: "drift" — parallax inside the frame.
 * - Section-to-section: every block after the first takes a section-level
 *   hand-off, alternating "stack" (slides over the previous, which shrinks and
 *   dims) and "curve" (domed top edge that flattens), so neighbours differ.
 * Phones get the arrivals and lighter hand-offs, no image drift.
 */
export function buildPageChoreography(ctx: ChoreoContext) {
  const { root, mobile } = ctx;
  const done = new Set<Element>();
  const take = (els: Element[]) => els.filter((el) => !done.has(el) && usable(el)).map((el) => (done.add(el), el));
  const travel = mobile ? 0.6 : 1;

  // Title lift
  const h1 = root.querySelector<HTMLElement>("h1");
  if (h1 && usable(h1)) {
    const parts: Element[] = [];
    const prev = h1.previousElementSibling;
    if (prev && /^(P|SPAN|DIV)$/.test(prev.tagName) && (prev.textContent ?? "").length < 80) parts.push(prev);
    parts.push(h1);
    let next = h1.nextElementSibling;
    for (let i = 0; next && i < 2; i++, next = next.nextElementSibling) parts.push(next);
    arrive(take(parts), { y: 44 * travel, skewY: 2.5, opacity: 0 }, ctx, { start: "top 98%", stagger: MOTION_STAGGER.loose });
  }

  // Heading rise
  root.querySelectorAll<HTMLElement>("h2").forEach((h2) => {
    const parts: Element[] = [h2];
    const next = h2.nextElementSibling;
    if (next && next.tagName === "P") parts.push(next);
    arrive(take(parts), { y: 30 * travel, opacity: 0 }, ctx, { start: "top 90%", stagger: MOTION_STAGGER.loose });
  });

  // Cascade
  const cards: Element[] = [];
  cardGroups(root).forEach((kids) => {
    cards.push(...kids);
    const list = take(kids);
    if (!list.length) return;
    gsap.set(list, { transformOrigin: "50% 100%" });
    arrive(list, { y: (i: number) => (i % 2 ? 76 : 48) * travel, scale: 0.96, opacity: 0 } as gsap.TweenVars, ctx, {
      start: "top 92%",
      stagger: MOTION_STAGGER.loose,
    });
  });

  // Ticker
  const items = take([...root.querySelectorAll("details, .fe-faq-item")]);
  if (items.length) arrive(items, { x: -28 * travel, opacity: 0 }, ctx, { start: "top 94%", stagger: MOTION_STAGGER.base * 1.5 });

  // Section hand-offs between blocks
  const units = [...root.querySelectorAll<HTMLElement>("[data-section]")].filter(
    (el) => !el.parentElement?.closest("[data-section]")
  );
  const blocks =
    units.length > 1
      ? units
      : units.length === 1
        ? ([...units[0].querySelectorAll<HTMLElement>(":scope > *, :scope > * > section")].filter(
            (el) => el.tagName === "SECTION" || el.offsetHeight >= 260
          ) as HTMLElement[])
        : [];
  let n = 0;
  blocks.forEach((block, index) => {
    if (index === 0 || block.closest(CHOREO_EXCLUDE) || block.querySelector(".fe-custom--marquee, .fe-topics, .v2-price-grid")) return;
    const prev = blocks[index - 1];
    const safePrev = prev.closest(CHOREO_EXCLUDE) || prev.querySelector(".fe-custom--marquee, .fe-topics, .v2-price-grid") ? null : prev;
    handoff(safePrev, block, n++ % 2 ? "curve" : "stack", mobile);
  });

  if (mobile) return;

  // Drift
  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const frame = img.parentElement;
    if (!frame || !usable(img)) return;
    const box = img.getBoundingClientRect();
    if (box.width < 280 || box.height < 160) return;
    if (!/hidden|clip/.test(getComputedStyle(frame).overflow)) return;
    // Cards already move (and zoom on hover); images with their own transform transition stay put.
    if (cards.some((card) => card.contains(img))) return;
    const style = getComputedStyle(img);
    if (/transform|all/.test(style.transitionProperty) && parseFloat(style.transitionDuration) > 0) return;
    scrub(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12 }, frame, "top bottom", "bottom top");
  });
}
