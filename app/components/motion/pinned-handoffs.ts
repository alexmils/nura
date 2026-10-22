"use client";

import gsap from "gsap";
import { DEFAULT_HANDOFF_HOLD, paintedBg, siblingBoxesOf, pinnedInsideOf } from "./choreography";

/**
 * Pinned section hand-offs, partly ported from D:\Python\alexandermils
 * (src/components/motion/SectionHandoff.tsx, CurtainPin.tsx, Aperture.tsx;
 * rules in .cursor/rules/transitions.mdc) plus Nura's own quiet family
 * (lift / settle / halo) for the boundaries that should not shout.
 *
 * The studio site pins the outgoing section (sticky, bottom on the viewport
 * bottom), pulls the next one up 100svh underneath/over it, and runs ONE
 * viewport of effect. Here the same picture is made without wrappers or pin
 * spacers (which would fight React and the section editor's reorder): over the
 * scroll window where the next section's top travels from the viewport bottom
 * to the top, the previous block is counter-translated by exactly the scroll
 * (so it holds perfectly still) and, for effects that need it, the next block
 * is counter-translated the other way (so it is already in place, "pinned
 * underneath"). Everything is scrubbed 1:1 with scroll (scrub: true, linear).
 *
 * Effects (one per boundary, neighbours differ):
 * - zoom     outgoing image scales up into the screen and darkens while the next slides over (SectionHandoff "zoom")
 * - lift     the held block settles back a touch while the next rises over it as a soft sheet (no clip, no circle)
 * - halo     the next block rises over the held one and its own brand mark leads: the halo around the nura core grows, the core settles (no full-screen disc)
 * - iris     the next block is revealed through a circle that grows out of its own nura mark; its copy and ring rise out of the circle as it opens
 * - morph    the outgoing backdrop morphs into the next section's colour, the next one's content rises out of it
 * - settle   calm sheet rise: the held block eases back under a soft wash in the next block's colour while that block rises over it, top corners flattening as it lands
 * - curtain  a straight edge with a lime rule rises and cuts the held section away, revealing the next one pinned underneath (CurtainPin)
 * - lens     the next section emerges out of an actual card of the held one (its rect and aspect) and grows to full screen (Aperture / lens)
 * - tilt     the outgoing block is held and folds away: it tips back gently in perspective into a rounded card, a light tint over it, while the next one rises over it
 *
 * Overlay layers are pointer-events none and hidden at progress 0. Desktop only;
 * callers fall back to the lighter `handoff` on phones. Nothing is built under
 * reduced motion (see useChoreography).
 */
export type PinnedEffect = "zoom" | "lift" | "halo" | "iris" | "morph" | "settle" | "curtain" | "lens" | "tilt";

const WASH = "rgb(14, 18, 10)";
const LIME = "#c6d67e";

function layer(host: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.className = "mo-layer";
  Object.assign(el.style, {
    position: "absolute",
    left: "0",
    right: "0",
    bottom: "0",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "60",
    visibility: "hidden",
    ...style,
  });
  host.appendChild(el);
  return el;
}

/**
 * The pair must still be neighbours: the section editor can reorder, hide or
 * insert sections, and a held block must never hold over an unrelated one.
 * Hidden siblings and thin strips (under a quarter viewport, e.g. the trust
 * row) between them are tolerated.
 */
export function adjacent(prev: Element, next: Element): boolean {
  let n = prev.nextElementSibling;
  while (n && n !== next) {
    const h = (n as HTMLElement).offsetHeight || 0;
    if (h > window.innerHeight * 0.25) return false;
    n = n.nextElementSibling;
  }
  return n === next;
}

/**
 * The section that currently follows `el` (its sibling box, skipping hidden
 * siblings and thin strips), so a hand-off can target "whatever comes next"
 * when the editor may insert a section there (e.g. the poster after the hero).
 */
export function following(el: HTMLElement | null): HTMLElement | null {
  let box: HTMLElement | null = el;
  while (box?.parentElement && box.parentElement.children.length < 2) box = box.parentElement;
  let n = box?.nextElementSibling as HTMLElement | null;
  while (n && (n.offsetHeight || 0) <= window.innerHeight * 0.25) n = n.nextElementSibling as HTMLElement | null;
  return n;
}

/** Document bottom of an element from layout, ignoring transforms. */
export function layoutBottom(el: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y + el.offsetHeight;
}

/** The block's painted colour, a touch deeper (fills the space around a shrinking card). */
const tintOf = (el: HTMLElement) => `color-mix(in srgb, ${paintedBg(el)} 88%, #2a3020)`;
const relative = (el: HTMLElement) => (getComputedStyle(el).position === "static" ? "relative" : undefined);
const zOf = (el: Element) => parseInt(getComputedStyle(el).zIndex, 10) || 0;

export function pinnedHandoff(
  prevIn: HTMLElement | null,
  nextIn: HTMLElement | null,
  effect: PinnedEffect,
  opts: {
    image?: Element | null;
    content?: Element | null;
    /** lens: candidate cards the next section emerges from (nearest visible wins). */
    from?: () => HTMLElement[];
    /** morph: starting y offset of the incoming content (default 160). */
    morphY?: number;
    /** morph: fade the incoming content in (default true). */
    fade?: boolean;
    /** morph: element whose colour drives the blend when the box is a wrapper. */
    tint?: HTMLElement | null;
    /** morph: visible incoming block, when `next` is an admin wrapper around it. */
    nextTint?: HTMLElement | null;
    /**
     * Still viewports the outgoing block is pinned before the effect starts
     * (SectionHandoff's `hold`). Adds that much scroll runway below `prev`; a
     * section shorter than the viewport cannot cover it, so it is skipped.
     */
    hold?: number;
  } = {}
): PinnedEffect | null {
  if (!prevIn || !nextIn) return null;
  const [prev, next] = siblingBoxesOf(prevIn, nextIn);
  if (!prev || prev === next || !adjacent(prev, next)) return null;
  const vh = () => window.innerHeight;
  const vw = () => window.innerWidth;
  const nextBg = paintedBg(next);
  const prevStill = !pinnedInsideOf(prev);
  const nextStill = !pinnedInsideOf(next) && next.offsetHeight >= window.innerHeight * 0.95;
  // The hold needs a full-viewport outgoing block that can be counter-
  // translated; its runway is a static margin below `prev`.
  const wantedHold = Math.max(0, opts.hold ?? DEFAULT_HANDOFF_HOLD);
  const hold = prevStill && prev.offsetHeight >= vh() * 0.99 ? wantedHold : 0;
  const holdPx = () => hold * vh();
  if (hold > 0) gsap.set(prev, { marginBottom: holdPx() });
  nextIn.setAttribute("data-mo-handoff", effect);

  // Layering: the covering block above the covered one.
  const base = Math.max(1, zOf(prev));
  const nextOnTop = effect !== "curtain";
  gsap.set(prev, { position: relative(prev), zIndex: nextOnTop ? base : base + 1 });
  gsap.set(next, { position: relative(next), zIndex: nextOnTop ? base + 1 : base });
  if (getComputedStyle(next).backgroundColor.match(/rgba\(0, 0, 0, 0\)|transparent/) && getComputedStyle(next).backgroundImage === "none") {
    gsap.set(next, { backgroundColor: nextBg });
  }

  const refreshers: Array<() => void> = [];
  const tl = gsap.timeline({
    defaults: { ease: "none", duration: 1 },
    // Measured on the previous block (its start state is untransformed); the
    // window is its bottom travelling from the viewport bottom to the top,
    // i.e. exactly the next block's top doing the same.
    scrollTrigger: {
      trigger: prev,
      // Measured from LAYOUT (offsets ignore transforms): neighbouring
      // hand-offs translate these same blocks (e.g. the iris holds the session
      // at -100vh until its own window), and a transform-skewed measurement
      // would run this window a whole viewport early, over the wrong section.
      start: () => layoutBottom(prev) - vh(),
      // The hold runway sits between prev's bottom and next's top.
      end: () => layoutBottom(prev) + holdPx(),
      scrub: true,
      invalidateOnRefresh: true,
      onRefreshInit: () => {
        if (hold > 0) gsap.set(prev, { marginBottom: holdPx() });
      },
      // A refresh moves the progress without firing onUpdate; repaint proxies.
      onRefresh: () => refreshers.forEach((fn) => fn()),
    },
  });
  const holdPrev = () => {
    // immediateRender: false — the hold tween must own `y` before this starts;
    // otherwise its start frame (y = holdPx) is painted at scroll 0.
    if (prevStill) tl.fromTo(prev, { y: () => holdPx() }, { y: () => holdPx() + vh(), immediateRender: false }, 0);
  };
  const holdNext = () => {
    if (nextStill) tl.fromTo(next, { y: () => -vh() }, { y: 0 }, 0);
    return nextStill;
  };
  // Proxy-painted effects follow the timeline's own progress (a spacer keeps
  // its length at 1), so they track the scrub exactly in both directions.
  const drive = (state: { p: number }, paint: () => void) => {
    tl.to({}, { duration: 1 }, 0);
    const sync = () => {
      // Timeline time includes the hold segment; proxies only care about the
      // effect itself (the last unit of the track).
      state.p = Math.min(1, Math.max(0, tl.time() - hold));
      paint();
    };
    tl.eventCallback("onUpdate", sync);
    refreshers.push(sync);
  };
  const wash = (to: number, at = 0) => {
    const w = layer(prev, { background: WASH });
    tl.fromTo(w, { autoAlpha: 0 }, { autoAlpha: to }, at);
  };

  switch (effect) {
    case "tilt": {
      holdPrev();
      if (prevStill) {
        tl.fromTo(
          prev,
          { rotateX: 0, scale: 1, transformPerspective: 1600, transformOrigin: "50% 100%", borderRadius: 0 },
          { rotateX: 7, scale: 0.92, borderRadius: 32 },
          0
        );
        // A soft spread in the card's own (slightly deepened) colour fills the
        // space it leaves (no bare page, no black). It exists ONLY inside the
        // window: a 120vmax spread left on a positioned block would paint over
        // the sections around it (it greyed out "Between sessions" above).
        gsap.set(prev, { boxShadow: "none" });
        /* Clip only while the card is actually tipped: a build-time
           overflow:hidden clipped the previous section's content during the
           preceding hand-off (the language facts). */
        tl.set(prev, { overflow: "hidden" }, 0.001);
        tl.set(prev, { overflow: "visible" }, 0.999);
        tl.set(prev, { boxShadow: () => `0 0 0 120vmax ${tintOf(prev)}` }, 0.002);
        tl.set(prev, { boxShadow: "none" }, 0.998);
      }
      wash(0.18);
      tl.fromTo(next, { boxShadow: "0 -40px 80px -30px rgba(42, 48, 32, 0.28)" }, { boxShadow: "0 0px 0px 0px rgba(14, 18, 10, 0)" }, 0);
      break;
    }
    case "zoom": {
      holdPrev();
      const target = opts.image ?? prev;
      tl.fromTo(target, { scale: 1, transformOrigin: "50% 55%" }, { scale: 1.45 }, 0);
      if (opts.content) tl.fromTo(opts.content, { opacity: 1 }, { opacity: 0, duration: 0.5 }, 0);
      wash(0.7);
      tl.fromTo(next, { borderTopLeftRadius: 48, borderTopRightRadius: 48 }, { borderTopLeftRadius: 0, borderTopRightRadius: 0 }, 0);
      break;
    }
    case "lift": {
      // Calm rise: the held modes block settles back a touch (its board dims)
      // while session rises over it as a soft sheet. No clip, no circle, no wash.
      holdPrev();
      if (prevStill) {
        tl.fromTo(prev, { scale: 1 }, { scale: 0.98 }, 0);
        const board = prev.querySelector<HTMLElement>(".v2-modes-board");
        if (board) tl.fromTo(board, { opacity: 1 }, { opacity: 0.55, duration: 0.6 }, 0);
      }
      tl.fromTo(
        next,
        { borderTopLeftRadius: 28, borderTopRightRadius: 28, boxShadow: "0 -28px 60px -28px rgba(42, 48, 32, 0.22)" },
        { borderTopLeftRadius: 0, borderTopRightRadius: 0, boxShadow: "0 0px 0px 0px rgba(42, 48, 32, 0)", duration: 0.7 },
        0
      );
      break;
    }
    case "halo": {
      // No full-screen disc: the topics block rises over the held session while
      // its own nura core leads the arrival - the halo around the logo grows
      // and the core settles, so the transition reads as the mark expanding.
      holdPrev();
      if (prevStill) tl.fromTo(prev, { scale: 1 }, { scale: 0.985 }, 0);
      const glow = next.querySelector<HTMLElement>(".fe-topics-glow");
      const core = next.querySelector<HTMLElement>(".fe-topics-core");
      if (glow) tl.fromTo(glow, { scale: 0.45, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.85 }, 0.15);
      if (core) tl.fromTo(core, { scale: 0.9 }, { scale: 1, duration: 0.7 }, 0.2);
      tl.fromTo(
        next,
        { borderTopLeftRadius: 32, borderTopRightRadius: 32, boxShadow: "0 -30px 60px -30px rgba(42, 48, 32, 0.24)" },
        { borderTopLeftRadius: 0, borderTopRightRadius: 0, boxShadow: "0 0px 0px 0px rgba(42, 48, 32, 0)", duration: 0.75 },
        0
      );
      break;
    }
    case "iris": {
      // The guides section opens through a circle that grows out of its own
      // nura mark. The held session stays put underneath, so the circle is
      // the only movement; the head and the ring rise inside it as it opens.
      holdPrev();
      // The guides section owns a sticky frame, so `holdNext` would skip it.
      // The counter-translation is still what keeps the section in place under
      // the opening circle; the frame never sticks past the section top.
      if (next.offsetHeight >= vh() * 0.95) {
        tl.fromTo(next, { y: () => -vh() }, { y: 0 }, 0);
      }
      const head = next.querySelector<HTMLElement>(".fe-topics-head");
      const stage = next.querySelector<HTMLElement>(".fe-topics-stage");
      // The circle grows out of the brand mark in the page header, not out of
      // the guides' own core: that mark belongs to the incoming section and
      // must not surface while the session is still on screen.
      const brand =
        (["frontend-header-brand", "frontend-header-mobile-brand"]
          .map((cls) => document.querySelector<HTMLElement>(`.${cls}`))
          .find((el) => el && el.getBoundingClientRect().width > 0) as HTMLElement | undefined) ?? null;
      // The section is counter-translated so its top-left sits on the viewport
      // top-left for the whole hand-off, so viewport and clip coordinates are
      // the same; measuring the brand directly avoids a start-frame race.
      const mark = () => {
        const r = brand ? brand.getBoundingClientRect() : null;
        return {
          x: r && r.width ? r.left + r.width / 2 : 92,
          y: r && r.height ? r.top + r.height / 2 : 72,
        };
      };
      const circle = (open: boolean) => {
        const m = mark();
        // Only the first viewport of the (taller) section is on screen while
        // it is held, so the circle covers the viewport, not the section box.
        const radius = open
          ? Math.hypot(Math.max(m.x, vw() - m.x), Math.max(m.y, vh() - m.y)) + 40
          : 0;
        return `circle(${radius}px at ${m.x}px ${m.y}px)`;
      };
      tl.fromTo(
        next,
        { clipPath: () => circle(false) },
        { clipPath: () => circle(true), duration: 0.92, ease: "none" },
        0
      );
      // Only transform: whatever the circle reveals is already at full
      // opacity, so the copy never reads washed out while it opens.
      if (head) {
        tl.fromTo(head, { y: 28 }, { y: 0, duration: 0.55 }, 0.15);
      }
      if (stage) {
        tl.fromTo(stage, { scale: 0.96 }, { scale: 1, duration: 0.6 }, 0);
      }
      // The section is taller than the viewport (sticky ring track), so the
      // circle only has to cover the held viewport. Drop the clip once the
      // hand-off is done so the rest of the sticky track stays visible.
      tl.set(next, { clipPath: "none" }, 1);
      break;
    }
    case "morph": {
      // When the incoming block paints a photo/video, there is no solid colour
      // to blend to; tweening would pull `paintedBg` up to the page canvas and
      // smear it (a cream band on a photo). The content still rises.
      if (!next.querySelector(".fe-bgwrap-media")) {
        // A wrapper shell can hold the layout while the visible section lives
        // inside it; `tint` keeps the colour blend on that visible section.
        const from = paintedBg(opts.tint ?? prev);
        // Read the target from the visible incoming block too: an admin wrapper
        // can be transparent, and paintedBg(wrapper) would pick the page canvas
        // (cream) and leave the pricing block the wrong colour.
        const to = opts.nextTint ? paintedBg(opts.nextTint) : nextBg;
        gsap.set(prev, { backgroundColor: from });
        tl.fromTo(prev, { backgroundColor: from }, { backgroundColor: to, duration: 0.7 }, 0);
        if (opts.tint && opts.tint !== prev) {
          gsap.set(opts.tint, { backgroundColor: from });
          tl.fromTo(opts.tint, { backgroundColor: from }, { backgroundColor: to, duration: 0.7 }, 0);
        }
        tl.fromTo(next, { backgroundColor: from }, { backgroundColor: to, duration: 0.7 }, 0);
        // Editor wrappers can leave the visible block painting its own colour
        // above the tweened wrapper; blend that block too so the join never
        // shows a hard yellow-to-green line.
        if (opts.nextTint && opts.nextTint !== next) {
          gsap.set(opts.nextTint, { backgroundColor: from });
          tl.fromTo(opts.nextTint, { backgroundColor: from }, { backgroundColor: to, duration: 0.7 }, 0);
        }
      }
      const content = opts.content ?? next.firstElementChild;
      const contentY = opts.morphY ?? 160;
      if (content) {
        // `fade: false` keeps the incoming copy at full opacity so a section
        // held mid-arrival never reads as translucent.
        tl.fromTo(
          content,
          { y: contentY, opacity: opts.fade === false ? 1 : 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          0.1
        );
      }
      break;
    }
    case "settle": {
      // Calm sheet rise: stories is held and eases back a hair while a soft
      // pricing-coloured veil settles over it, and pricing itself rises over
      // the held block with rounded top corners that flatten as it lands. No
      // sideways travel, no cut edge, no dark wash, no held next block.
      holdPrev();
      if (prevStill) tl.fromTo(prev, { scale: 1 }, { scale: 0.985 }, 0);
      const veil = layer(prev, { background: nextBg });
      tl.fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 0.38 }, 0);
      tl.fromTo(
        next,
        { borderTopLeftRadius: 32, borderTopRightRadius: 32, boxShadow: "0 -30px 60px -30px rgba(42, 48, 32, 0.24)" },
        { borderTopLeftRadius: 0, borderTopRightRadius: 0, boxShadow: "0 0px 0px 0px rgba(42, 48, 32, 0)", duration: 0.75 },
        0
      );
      break;
    }
    case "curtain": {
      holdPrev();
      const pinned = holdNext();
      tl.fromTo(prev, { clipPath: "inset(0px 0px 0px 0px)" }, { clipPath: () => `inset(0px 0px ${vh()}px 0px)` }, 0);
      if (pinned) {
        const rule = layer(next, { top: "0", bottom: "auto", height: "3px", background: LIME, zIndex: "70" });
        tl.fromTo(rule, { autoAlpha: 1, y: () => vh() }, { y: 0 }, 0);
        tl.to(rule, { autoAlpha: 0, duration: 0.04 }, 0.96);
      }
      break;
    }
    case "lens": {
      // Post-card emerge (Aperture / lens, re-aimed): the closing section opens
      // out of an actual blog card - from its rect and aspect ratio - and grows
      // to the full screen, while the post's own picture dissolves into the
      // CTA photo. The CTA copy only fades in once the window is (almost) full,
      // so it is never seen clipped or distorted.
      holdPrev();
      const pinned = holdNext();
      wash(0.55);
      // The copy fades with the scroll instead of being cut away by the
      // growing card; the pictures stay until the lens covers them.
      const blogCopy = [
        ...prev.querySelectorAll<HTMLElement>(
          ".fe-blog-head, .fe-blog-masonry-meta, .fe-blog-masonry-title, .fe-blog-more"
        ),
      ];
      if (blogCopy.length) {
        tl.fromTo(blogCopy, { opacity: 1 }, { opacity: 0, duration: 0.55, ease: "none" }, 0.1);
      }
      if (pinned) {
        type Rect = { l: number; t: number; w: number; h: number; r: number; img: string };
        const state = { p: 0 };
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
        const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const ghost = layer(next, { top: "0", bottom: "auto", left: "0", right: "auto", width: "0", height: "0", zIndex: "1", overflow: "hidden" });
        Object.assign(ghost.style, { backgroundSize: "cover", backgroundPosition: "50% 30%" });
        let src: Rect | null = null;
        let shown = "";
        let concealed = false;
        // `clip-path: inset(0 0 <height>px)` on a fractional-height block leaves a
        // ~1px antialiased sliver of it painted over the section above (a stray
        // full-width rule in the blog). autoAlpha hides it exactly; gsap records
        // the change, so the context revert restores it.
        const conceal = (on: boolean) => {
          if (concealed === on) return;
          concealed = on;
          gsap.set(next, { autoAlpha: on ? 0 : 1 });
        };
        // The visible card nearest the middle of the screen (hidden or
        // reordered cards simply drop out of the candidates).
        const pick = (): Rect => {
          const h = vh(), w = vw();
          let best: { el: HTMLElement; r: DOMRect; d: number } | null = null;
          for (const el of opts.from?.() ?? []) {
            if (!el.offsetParent) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) continue;
            const d = Math.hypot(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2);
            if (!best || d < best.d) best = { el, r, d };
          }
          if (!best) return { l: w * 0.38, t: h * 0.3, w: w * 0.24, h: h * 0.4, r: 20, img: "" };
          const img = best.el.querySelector("img");
          return {
            l: best.r.left,
            t: best.r.top,
            w: best.r.width,
            h: best.r.height,
            r: parseFloat(getComputedStyle(best.el).borderTopLeftRadius) || 18,
            img: img?.currentSrc || img?.src || "",
          };
        };
        const paint = () => {
          const p = state.p;
          const h = vh(), w = vw(), H = next.offsetHeight;
          // Pick the card when the window opens (the held block keeps it still).
          if (p <= 0.001) src = null;
          else if (!src) src = pick();
          if (p >= 1) {
            src = null;
            next.style.clipPath = "";
            conceal(false);
            ghost.style.visibility = "hidden";
            return;
          }
          if (!src) {
            next.style.clipPath = `inset(0px 0px ${Math.ceil(H) + 1}px 0px)`;
            conceal(true);
            ghost.style.visibility = "hidden";
            return;
          }
          conceal(false);
          const e = inOut(clamp01(p / 0.86));
          const L = lerp(src.l, 0, e);
          const T = lerp(src.t, 0, e);
          const W = lerp(src.w, w, e);
          const Hh = lerp(src.h, h, e);
          const R = lerp(src.r, 0, e);
          next.style.clipPath = `inset(${T}px ${Math.max(0, w - L - W)}px ${Math.max(0, H - T - Hh)}px ${L}px round ${R}px)`;
          const fade = 1 - clamp01((p - 0.12) / 0.4);
          ghost.style.visibility = src.img && fade > 0 && p > 0.001 ? "visible" : "hidden";
          ghost.style.opacity = String(fade);
          ghost.style.transform = `translate(${L}px, ${T}px)`;
          ghost.style.width = `${W}px`;
          ghost.style.height = `${Hh}px`;
          if (src.img && shown !== src.img) {
            shown = src.img;
            ghost.style.backgroundImage = `url("${src.img.replace(/"/g, "%22")}")`;
          }
        };
        // Recorded by the gsap.context, so its revert restores the original inline clip.
        gsap.set(next, { clipPath: "none" });
        paint();
        drive(state, paint);
        if (opts.image) tl.fromTo(opts.image, { scale: 1.14 }, { scale: 1 }, 0);
        if (opts.content) tl.fromTo(opts.content, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.16 }, 0.8);
      }
      break;
    }
  }
  // Move every effect child one hold-length later, then pin the outgoing block
  // through that runway: the page scrolls, the block does not.
  if (hold > 0) {
    tl.shiftChildren(hold, false, -1);
    tl.fromTo(prev, { y: 0 }, { y: holdPx, duration: hold, ease: "none" }, 0);
  }
  return effect;
}
