# Nura — motion brand direction

Colour and type already carry the brand (`docs/brand.md`). This is the third
leg: **motion**. In the studio site the brand "lives" because every animation
reads from one named vocabulary — same timings, same easing, same kinds of
hand-off — so no section feels bolted on. Nura follows the same idea, adapted to
the pistachio palette.

Code lives in `app/components/motion/` and `lib/motion.ts`. Rules:
`.cursor/rules/motion.mdc`.

## The idea in one line

Motion is calm and editorial. It appears at moments of change — an arrival, a
boundary between sections, a route change, a hover — never as decoration. One
effect per moment.

## 1. Tokens

Single source: `lib/motion.ts`, mirrored as CSS `--mo-*`.

| Token | Value | Where |
|---|---|---|
| `--mo-dur-instant` | .18s | control feedback |
| `--mo-dur-fast` | .28s | word fade, small shifts |
| `--mo-dur-base` | .55s | reveals, hovers |
| `--mo-dur-slow` | .9s | image zooms, panels |
| `--mo-dur-slower` | 1.35s | counters, hero-scale moves |
| `--mo-ease-out` | `.22,1,.36,1` | arrivals, reveals, cards |
| `--mo-ease-in-out` | `.87,0,.13,1` | page transitions, curtains, wipes |
| `--mo-ease-soft` | `.4,0,.2,1` | hovers, chrome |
| `--mo-ease-wave` | `.76,0,.24,1` | the brand lift (preloader, rising panels) |
| `--mo-ease-pop` | `.34,1.56,.64,1` | playful accents, counter landing |
| `--mo-stagger` | .045s | between siblings |

Shadows are ink-tinted (`--mo-shadow-lift`, `--mo-shadow-card`) — never neutral
black, same rule as `brand.md`.

**Presets** (`soft` default, `bold`, `minimal`, `off`) scale travel and duration
via `getRevealConfig()`; `entranceEffect` picks the shape (fadeUp/Down/Left/Right,
zoomIn, blur). This is the seam an admin setting plugs into later.

## 2. Motion primitives

Reuse these; never hand-roll a tween for the same job.

| Primitive | Job |
|---|---|
| `Reveal` | Scroll entrance: opacity + travel (+ optional scale/blur) |
| `StaggerText` | Word-by-word rise for leads / mid headings |
| `LetterRevealHeading` | Letter-rise for big section H2s (existing, mandatory) |
| `CountUp` | Number counts up in view |
| `Marquee` | Seamless horizontal ticker |
| `SectionRise` | Section opens from an inset card as it scrolls in |

## 3. Page transitions (route changes)

`PageTransitionOverlay` runs on every marketing route change: cover → the route
swaps underneath → reveal. CSS keyframes only, no dependency. Built from the
pistachio palette (mint `#A4EDA5`, pistachio `#C6D67E`, sage `#84B067`,
olive-ink `#3D4129`, ink `#2A3020`, ground `#EDF9ED`).

One transition is active site-wide (default `waveSweep` — the signature, a sage
panel with the Nura wave edge). Others in the library:

`fade` (through mint) · `blurDissolve` · `waveSweep` · `mintCurtain` ·
`sageColumns` · `stackUp` · `doors` · `iris` · `dots` · `logoFlash` · `none`.

Timings in `TRANSITION_TIMING` (cover ~320–560ms, reveal ~460–560ms); the shop /
app flows may run a notch faster (`FAST_FACTOR`). Reduced motion gets the plain
swap (the overlay never renders).

## 4. Section hand-offs (landing)

Every boundary between two landing sections should be one **named** pattern, and
two adjacent boundaries must differ. Catalogue:

| Pattern | Mechanism | Where it reads best |
|---|---|---|
| Rounded rise | `SectionRise` — inset card widens to full bleed | a distinct (e.g. dark) block arriving over a light one |
| Wave wipe | `SectionWipe` — a mint veil with the Nura wavy edge lifts off the section top | a section arriving under lighter content |
| Bloom | `SectionBloom` — a soft pistachio disc grows from the top and dissolves | available, not wired (reads as a tint over a light section) |
| Curtain cut | pinned outgoing + rising clip edge | two full-bleed sections |
| Letterbox / aperture | bars close and part through black | into a black-and-white / dark section |
| Page slide | pinned outgoing + full-screen sheet and stage inner translate horizontally | a full-screen film handing into a sticky stage |

Current wiring on `/`:

- `HomeMemorySets → pricing` = **Rounded rise** (`SectionRise` on pricing).
- `stories → journal` = **Wave wipe** (`SectionWipe` around `BlogSection`).
- `how stages → between` = **Letterbox** (`useHomeChoreography`: the finale opens
  from a centre slit with lime rules, driven by the numeric `--finale-wipe`
  variable, while its copy lifts in). The sticky track above is never transformed.
- `between → languages` = **Colour morph** (`pinnedHandoff(..., "morph")`): both
  blocks shift into the languages colour and its content rises out. No panel
  sliding over another panel.
- `video → how` = **Page slide** (`useHomeChoreography`): the video screen exits
  right while a full-screen sheet and the first How stage's inner copy enter from
  the left and move right. The How section overlaps **two** video viewports
  (`margin-top: -200svh`) so the video screen stays sticky for the whole slide;
  only the zero-height sheet and the stage inner translate, never the sticky
  nav/panels. One viewport of overlap would make the video drift up and the
  slide read as diagonal.
- Everything else uses `Reveal` / letter-rise entrances plus the existing GSAP
  `.fe-animate` scroll reveals. (`journal → FAQ` was tried with a cut/bloom and
  left plain — see the note on the FAQ hand-off.)

Do not tween `clip-path` **strings** with GSAP here — `inset(...)` jumps to the
end value instead of interpolating. Animate a unitless CSS variable (e.g.
`--finale-wipe: 100 → 0`) and use it inside `calc()` in the CSS clip/inset.
Also keep the two colours in a colour morph as plain `rgb()`/hex values; a
computed `color(srgb …)` value interpolates through black.

No two adjacent boundaries repeat a pattern (rise → plain → wipe → plain).

Still plain (candidates for the next hand-offs, keep neighbours distinct):

- `hero → How it works`, `How it works → topics`, `topics → one-app`,
  `one-app → pause`, `pause → memory sets`, `pricing → stories`.

Do not wrap a section with sticky/fixed children in `SectionRise` / `SectionWipe`
/ `SectionBloom` — clip/overflow breaks sticky (this is why `SessionPathSticky`
"how it works" is left plain).

## 5. Micro-interactions

In `interactions.css`: card lift + image zoom (`.fe-blog-masonry-card`,
`.fe-stories-card`, `.fe-price-card`), CTA press. Utilities `.mo-lift`,
`.mo-press`, `.mo-underline` for new elements.

## 6. Rules (short)

- Reduced motion → plain blocks everywhere; both the media query and
  `html[data-a11y-motion="reduced"]`.
- Overlays are `pointer-events: none` except the visible/covering panel.
- Scroll-linked = linear in scroll; easing only for time-based motion.
- No layout shift, no spacer gaps, no invisible click blockers.
- Palette only. SSR-safe (deterministic start states).
- Extend the shared component, never duplicate it.
