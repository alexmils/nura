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
        return () => root.querySelectorAll("[data-mo-handoff]").forEach((el) => el.removeAttribute("data-mo-handoff"));
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

/** A transformed ancestor breaks sticky and fixed children, so those blocks keep still. */
function hasSticky(el: Element): boolean {
  const pinned = (node: Element) => /sticky|fixed/.test(getComputedStyle(node).position);
  return pinned(el) || [...el.querySelectorAll<HTMLElement>("*")].some(pinned);
}

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
 * - Section-to-section: the blocks after the first alternate "rise" (lift + scale
 *   up), "glide" (slide in from the side) and "settle" (drop in from a slight
 *   zoom), so two neighbours never share a hand-off.
 * Phones get the arrivals only (shorter travel), no scrubbed moves.
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

  // Hand-offs between blocks
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
    if (index === 0 || block.contains(h1) || block.closest(CHOREO_EXCLUDE) || block.querySelector(".fe-custom--marquee, .fe-topics, .v2-price-grid") || hasSticky(block)) return;
    const kind = n++ % 3;
    block.setAttribute("data-mo-handoff", ["rise", "glide", "settle"][kind]);
    if (kind === 0) {
      scrub(block, { y: 90, scale: 0.95, opacity: 0.35, transformOrigin: "50% 0%" }, { y: 0, scale: 1, opacity: 1 }, block, "top bottom", "top 55%");
    } else if (kind === 1) {
      const side = n % 2 ? 1 : -1;
      scrub(block, { xPercent: 6 * side, opacity: 0.3 }, { xPercent: 0, opacity: 1 }, block, "top bottom", "top 60%");
    } else {
      scrub(block, { y: -40, scale: 1.04, opacity: 0.4, transformOrigin: "50% 50%" }, { y: 0, scale: 1, opacity: 1 }, block, "top bottom", "top 58%");
    }
  });
}