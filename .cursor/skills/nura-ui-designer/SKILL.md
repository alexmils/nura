---
name: nura-ui-designer
description: >-
  Nura UI/UX design system for marketing, /app, and /admin — pistachio tokens,
  Fraunces only on home hero title; Source Sans 3 everywhere else including
  /app and /admin; wave lockup contrast, clinic-calm layouts, no BLS jargon;
  marketing letter-rise H2s via LetterRevealHeading.
  Use when designing, restyling, reviewing, or shipping any UI/UX, page, layout,
  component, modal, empty state, sidebar, header, landing section, onboarding,
  auth, billing chrome, or visual polish for Nura / EMDR.
  Triggers: /nura-ui-designer, nura-ui-designer, UI, UX, design, restyle, layout,
  typography, spacing, mobile shell, screenshot clone for Nura.
---

# nura-ui-designer

You are Nura’s product designer. Ship calm, clinic-quiet UI that could not be mistaken for ChatGPT green, Apple HIG, or generic wellness SaaS after removing the wave lockup.

**Read this skill fully before changing UI.** Then follow the workflow below. Do not invent a parallel design system.

## Sources of truth (read when needed)

| Need | Path |
|---|---|
| Name, color, type, voice | `docs/brand.md` · `.cursor/rules/nura-brand.mdc` · `lib/brand.ts` |
| Product chrome tokens | `.cursor/rules/product-ui.mdc` · `app/globals.css` |
| Logo component | `app/components/BrandLockup.tsx` (`tone="color" \| "black" \| "white"`) |
| Marketing CSS | `app/components/frontend/**` · `.frontend-home` · content column **76rem** (`.frontend-main` = header wrap) |
| Finish gates | `.cursor/rules/page-copy-design-review.mdc` · `/redpen` · `/writing-copy` · `/frontend-design` |
| Accessibility panel | `.cursor/rules/accessibility-panel.mdc` · `app/components/AccessibilityWidget.tsx` |
| Mobile | `.cursor/rules/mobile-shell-check.mdc` (~390×844) |
| Verify | `.cursor/rules/verify-before-done.mdc` |

Retired for this product: `.cursor/skills/apple-ui`, Apple HIG, Inter, `#007AFF`, `#10a37f`.

## Pick the surface

| Surface | Where | Type | Layout feel |
|---|---|---|---|
| Marketing | `.frontend-home` | Fraunces **only** on home hero title; Source Sans 3 everywhere else + Roboto Mono kickers | Editorial, one job per section, wave lockup is brand hero; content column **76rem** (same as header pill) |
| **Legal / long-form** | `/terms`, `/privacy`, other dense public docs | **Source Sans 3 only** (headings 600) — never Fraunces | Sober document rhythm; same as product type for scanability |
| **Product** | `/app/**` (session, settings, billing, onboarding) | **Source Sans 3 only** | Dark olive sidebar `#3D4129`, mint canvas `#EDF9ED`, flat 1px borders, 6–8px radius |
| **Admin** | `/admin/**`, `.admin-shell` | **Source Sans 3 only** (no Fraunces) | Same pistachio chrome as product; denser data UI; titles/KPIs at weight 600 |

Onboarding follows marketing rhythm (`OnboardingShell` + `.frontend-home` tokens).

## Brand hard rules

### Name
- Speak and write **Nura**. Operator: **Receptly LLC**. Feature: **EMDR Support**.
- Never “NuraHelp”, “NuraHelp AI”, “Nura Help”, or leading with “AI” in titles/wordmark.

### Color (pistachio only)
| Token | Hex | Use |
|---|---|---|
| Paper/mint | `#A4EDA5` | Tint, highlights |
| Sage | `#84B067` | Primary buttons, icons, wordmark |
| Ink | `#2A3020` | Body |
| Pistachio | `#C6D67E` | **Focus/hover only** — never body or default field borders |
| Olive | `#948F4E` | Muted |
| Sidebar | `#3D4129` | App/admin rail |
| Page | `#EDF9ED` | Soft mint canvas |

Forbidden: OpenAI green, Apple blue, purple wellness, hospital blue, neon competitor greens.

### Type
- **Display:** Fraunces 400 (italic for emphasis) — **home hero title only**. Never on other landing sections, `/app`, `/admin`, or legal/long-form public docs (`/terms`, `/privacy`).
- **UI/body:** Source Sans 3 — humanist, sharper terminals; all product + admin titles and body; **also legal headings and body**.
- **Admin:** Source Sans 3 for all titles and body (`.admin-shell` remaps `--font-display` to sans). Weight 500–600 on headings — never ornamental serif in Settings/Voices/data UI.
- **Kickers:** Roboto Mono, uppercase, muted — never bold sans competing with the lockup (marketing).
- **Do not** use Inter, Nunito, Manrope, Satoshi-playful, or any soft rounded grotesk next to the wave logo (retired: BDOGrotesk, Libre Caslon Condensed).
- Readable floor ~12px. Prefer shared utilities (`.text-headline`, `.text-subhead`, …) over one-off tiny rem.

### Logo
- Use `BrandLockup` / wave PNGs — do not redraw or invent marks.
- Site type must **contrast** the rounded geometric “nura” wordmark, not echo it.
- Never: brain, lotus, chat bubble, cross, heart, two-dots arc.

### Copy (user-facing)
- English, sentence case, short, clinic-quiet.
- **Never use the em dash (—)** in UI/agent/marketing sentences (reads as AI). Prefer comma, period, colon, or parentheses. See `nura-brand`.
- **Never say BLS** → self-guided set time / Set running / Session controls / visual sets (not “moving ball” as the default Self-guided pitch). Never name the self-run mode **Free session** (reads as $0). See `session-mode-names`.
- No fake metrics, clinical overclaims, or “find a therapist”.
- New/edited user-facing strings → run **/redpen** first.

## Design principles (Nura)

1. **One composition** — first viewport is one idea, not a dashboard (unless it is `/app` or admin).
2. **Brand first** — wave lockup must remain a hero-level signal on marketing; headline must not overpower it.
3. **One job per section** — one headline, one short support line, one primary CTA.
4. **Cards sparingly** — default no cards; cards only when they contain a real interaction. Never cards in the marketing hero.
5. **Atmosphere without clutter** — mint gradients/imagery OK; no pill clusters, stat strips, floating badges on hero media, or emoji decoration.
6. **Motion with purpose** — GSAP/Lenis/`useLandingMotion` for landing; letter-rise H2s via `LetterRevealHeading` (see Motion); 2–3 intentional motions max for visual-led work; no noise.
7. **Clinic calm** — soft surfaces, room to breathe; not frosted-glass iOS, not ChatGPT clone chrome.
8. **Accessible focus** — pistachio `#C6D67E` focus rings; visible `:focus-visible`.
9. **Centered section heads** — title + sub above cards/grids use the spacing contract below (flex `gap`, clear overlay header). See also `.cursor/rules/marketing-section-spacing.mdc`.

## Centered section heads (spacing contract)

When a marketing section centers a **title + supporting line** above a card row or grid (`/pricing` plans, similar hubs):

| Step | Rule |
|---|---|
| Clear overlay | `padding-top` must place the title **below** `.frontend-header-pill` with ~2.5–3.5rem air. Measure `titleTop > pillBottom`. |
| Head → content | Parent `.fe-container` is `display: flex; flex-direction: column; gap: clamp(3.5rem, 6vw, 5rem)`. **Do not** rely on `margin-bottom` alone. |
| Kill global head margin | Set `.…-head { margin: 0 auto }` so landing `.fe-pricing-head { margin: 0 auto clamp(…) }` cannot steal the gap. |
| Equal rhythm | Air under pill ≈ gap under sub ≈ section `padding-bottom`. |
| Override shared bands | Page modifier (e.g. `--page`) must win over `.fe-pricing-section { padding: … }` shorthand. |

```css
/* ✅ GOOD — pricing / similar hubs */
.page-section > .fe-container {
  display: flex;
  flex-direction: column;
  gap: clamp(4rem, 7vw, 5rem);
}
.page-section .fe-pricing-head {
  margin: 0 auto;
}

/* ❌ BAD — margin only; global clamp + collapse */
.fe-pricing-head {
  margin-bottom: 3rem;
}
```

Reference implementation: `app/components/frontend/pricing-page.css` (plans band).

## Motion (marketing)

Home / marketing motion lives in `useLandingMotion` (Lenis + GSAP ScrollTrigger) and small dedicated components. Prefer these patterns over inventing new libraries.

### Letter-rise section titles (Aiero-style)

Main section **H2**s animate letter-by-letter on scroll — rise from below with a clipped word mask (reference: Aiero `aiero_heading_animation`).

| Item | Detail |
|---|---|
| Component | `app/components/frontend/LetterRevealHeading.tsx` |
| CSS | `letter-reveal-heading.css` (imported by the component) |
| Effect | Split words → letters; `translateY(120%)` + fade → `0`; stagger `index / 50` s; ease `cubic-bezier(0.26, -0.14, 0, 1.01)` |
| Trigger | `IntersectionObserver` adds `.is-in` for the letter-rise. When the heading is fully off-screen, `.is-in` is removed so the same rise can play again on the next scroll-in. `eager` sticky leads stay one-shot. |
| A11y | `aria-label` on the `h2`; visual letter spans `aria-hidden` |
| Reduced motion | Immediately add `.is-in` (no animation) |

**Use for:** marketing section titles (Why Nura, How it works, pricing, blog, FAQ, stories, footer CTA, similar new H2s under `.frontend-home`).

**Do not use for:**
- Home **hero** H1 (already uses `.fe-split-word` load animation)
- About statement (`.fe-about-title` / `.fe-about-word` — scroll-scrub **word color**, Curevo)
- Home **Session path** intro H2 (Attio ink→muted inline fade — see below)
- Product `/app` or `/admin` headings
- Dense legal body headings

**Implementing a new section title:**

```tsx
import { LetterRevealHeading } from "@/app/components/frontend/LetterRevealHeading";

// ✅ Title alone — do not wrap it in `.fe-animate` (GSAP opacity fights letter rise)
<p className="fe-section-kicker fe-animate">Why {BRAND_SPOKEN}</p>
<LetterRevealHeading className="fe-section-title">
  Support crafted around your pace
</LetterRevealHeading>
<p className="fe-section-body fe-animate">…</p>

// ❌ BAD — whole head fades while letters also animate
<div className="fe-section-head fe-animate">
  <h2 className="fe-section-title">…</h2>
</div>
```

Pass existing title classNames (`fe-section-title`, `fe-spath-kit-title`, `fe-pricing-title`, …) so type scale stays unchanged. Children must be a plain **string** (no nested JSX).

### Other landing motion (already wired)

- Hero word rise: `.fe-split-word` on load
- Section body/cards: `.fe-animate` + ScrollTrigger in `useLandingMotion`
- About word color scrub: `.fe-about-word`
- Do **not** paste Webflow IX2 / Elementor animation JS — recreate with this stack
- Session path (home): sticky stacked stages + finale zoom — see **Sticky session path** below

## Sticky session path (Attio clone → Nura)

Home section after the hero: `SessionPathSticky` — Attio platform-showcase layout, pistachio tokens. Clone **hierarchy and rhythm** from Attio, then brand (`.cursor/rules/reference-site-clone.mdc`).

| Item | Path |
|---|---|
| Component | `app/components/frontend/SessionPathSticky.tsx` |
| CSS | `session-path-sticky.css` |
| Motion | `useLandingMotion.ts` (finale zoom); Lenis spy via `getLandingLenis()` |
| Header nav | `#how-it-works` on the **section start** (intro), not a later “How it works” band |
| Stage hashes | sentinels `#session-path-{ground,rhythm,checkin,close}` |

### Hierarchy (do not scramble)

```
[badge] How it works
[H2] one flowing block ~3 wrapped lines — ink then muted fade (inline spans, not stacked display:block)
        ↑ large gap (margin-bottom on H2) before the divider
──────── divider ────────
        ↑ padding-top on the track
[left sticky nav] short labels     [right sticky stage] bold lead + muted line + media
```

| Slot | Rule |
|---|---|
| Badge | **How it works** (same as header nav). Header `/#how-it-works` scrolls to this section’s top. |
| Intro H2 | Source Sans **500**, `clamp(1.75rem, 3.15vw, 2.5rem)` — Attio Platform size, **not** a hero H1 / not `LetterRevealHeading` |
| Stage / pair / finale titles | **Letter-rise** (`LetterRevealHeading`, `eager` on sticky leads). Intro H2 stays fade wrap. |
| Fade | Inline spans `.fe-spath-intro-fade--1/2/3` (ink → olive mix). `text-wrap: pretty`. Do **not** `display: block` each sentence (that makes 6 short rows) |
| Right lead | Smaller than intro (`~1.15–1.4rem`). **Bold ink phrase + muted continuation** on one flow. Nav label ≠ right headline |
| Left nav | Short stage names only (Ground first · Choose your rhythm · …). Active = ink weight 600; outline on hover (sage), not a default chip |
| Breathing | Padding (not **margin-top**) under hero — margin creates a hard mint/white seam. Big gap **under intro H2** before the track border |

### Stages (scroll)

- **One stage visible at a time.** Stack panels in a sticky frame (`.fe-spath-panels`); scroll height via `.fe-spath-stage-scroll` + sentinels. Next stage copy must not peek (Choose your rhythm hidden while Ground first is active).
- **Flip** inactive → active: `rotateX` + fade. `prefers-reduced-motion`: no transform.
- Sticky frame sits **mid-viewport**, not under the header: `--spath-sticky-top` (~`24vh`), `--spath-stage-h` (~`56dvh`). Spy marker at **50%** viewport height. Listen to **Lenis `scroll`**, not only `window`.
- **Phone:** chip row uses **`translate3d`**, not `scrollLeft` (iOS Chrome ignores overflow scrollTo). No `50vw` padding (blows past the container and clips copy). Copy: `min-width: 0` + `overflow-wrap: anywhere`. `.frontend-home` `overflow-x: clip`. Panels stay **grid overlay** (`grid-area: 1 / 1`) — never `flex-direction: column` (hidden stages still take height and push cards off-screen). Copy + media/cards **vertically centered** in leftover viewport; media `flex: none` (do not grow to fill). Rhythm stays 3-up.
- Ground layout: **one full-width media on top**, then **two cards side-by-side** (stack only &lt;860px). Duo cards flip in after ~35% of the Ground sentinel — not always visible, not stacked vertically on desktop.
- Finale (`Self-guided session — sets without an agent`): starts far (`scale` + blur + slight `rotateX`) and **zooms in** on scroll (`.fe-spath-finale-zoom` + GSAP scrub).
- **After finale (same band):** BrightHub-style language board (`SessionLoopKit`) — kicker **Your language** (Roboto Mono); H2 **A calm session in many languages.** (`LetterRevealHeading`, Source Sans 3); one factual sub. Flag marquees + three points. `fe-animate` on kicker/sub/board/points is triggered by **`.fe-spath-kit`** (`top 80%`), not the parent `.fe-spath` (that would play at How it works start). Agent prompt matches the user’s written language (`protocol-knowledge.ts`).
- **After language board:** DOSS-style topic grid (`SessionTopicsGrid`) — kicker **Why people start**; H2 **What they bring to a session.** (`LetterRevealHeading`; `max-width: 22ch` on the **H2**, never `ch` on the head — that uses kicker size and stacks one word per line). Compact line icons (~2.85rem), hover lift; staggered GSAP in. Black CTA tile. Labels only — do **not** claim Nura treats those conditions.
- **After topics:** Intercom two-products (`SessionModesPair`) — H2 **One app, two seamless experiences.** (`LetterRevealHeading`); two tabs **AI agent-guided session** / **Self-guided session**; video stage.
- **After modes:** Reflex-style pause (`HomePauseCta`) — empty white field, large centered H2 (`LetterRevealHeading`, Source Sans 3), quiet outline **Get started** + plus. Copy is a placeholder they can swap.
- **After pause:** Memory notes (`HomeMemorySets`) — left: mid-session chat (not a cold ask). Agent continues a thread; user mentions a past note; **Memory loading** then **Memory processing**; agent replies with the stored detail. Right: kicker **Memory**; H2 **Notes you keep. The agent can use them in every session.** (`LetterRevealHeading`); three short points (write once / agent can use it / delete or clear all). No infinite-memory claim.

### Copy

Marketing-no-explain: titles, labels, cards. No **BLS**. Self-guided / visual sets / AI agent-guided as in `nura-brand` + `session-mode-names`. Placeholder media is fine until assets exist.

### Do not

| Bad | Why |
|---|---|
| Two competing titles (intro H2 + giant right H3 saying the same thing) | Attio: one Platform H2; right is a smaller lead |
| 100vh stacked articles in normal flow | Next stage peeks; spy lies |
| Sticky `top` glued under the pill (~6rem) | Stage sits too high; flip is off-screen |
| `margin-top` on `.fe-spath` | Hairline seam under hero |
| Letter-rise on this H2 | Wrong motion — Attio is color fade + wrap |

## Workflow (do in order)

```
Progress:
- [ ] 1. Surface + job (marketing / product / admin; one sentence)
- [ ] 2. Read brand + existing CSS for that surface
- [ ] 3. Sketch hierarchy (type scale, primary action, mobile)
- [ ] 4. Implement with tokens — no new palette/fonts
- [ ] 5. Copy pass (/redpen if strings change)
- [ ] 6. Visual pass (/frontend-design + this skill)
- [ ] 7. Mobile ~390×844
- [ ] 8. Lint + tests + smoke (verify-before-done)
```

### Implementing
- Prefer existing classes/tokens in `app/globals.css` and scoped frontend CSS.
- Marketing content column: `.frontend-main` / header wrap / `.fe-container` = **76rem** — do not reintroduce a narrower shell (52rem) or 42rem legal/cluster caps that leave a gap beside the pill.
- Marketing motion: project GSAP/Lenis stack + `LetterRevealHeading` for section H2s — do not paste Webflow IX2/jQuery.
- Screenshot + reference URL → follow `.cursor/rules/reference-site-clone.mdc`, then map to pistachio + Nura type.
- If asked for “Apple” or “ChatGPT look”: translate to Nura tokens; do not reintroduce retired systems.

### Shipping checklist
See [checklist.md](checklist.md).

## Anti-patterns (reject on sight)

| Bad | Why |
|---|---|
| Inter / rounded soft sans next to logo | Eats the wave signature |
| New floating chrome ignored by the accessibility button | The panel lifts itself above bottom bars and hides during sets; register new bars and corners (`.cursor/rules/accessibility-panel.mdc`) |
| `#10a37f` / `#007AFF` / purple gradients | Wrong brand |
| BLS in UI copy | Internal jargon |
| Hero full of stats + cards + badges | Clutter; fails brand test |
| Inventing a new logo or wordmark font | Use BrandLockup |
| Only desktop check | Must verify ~390×844 for page chrome |
| Generic SaaS template after removing lockup | Failed Nura signature test |
| New marketing H2 without letter-rise | Use `LetterRevealHeading` (unless hero / about scrub / legal / Session path fade H2) |
| GSAP `fe-animate` / `y`+`opacity` on a big section title | Wrong motion — fade is for kicker/body/cards only (rule `letter-rise-headings`) |
| “Fix title replay” by rewriting `useLandingMotion` fades | Letter-rise already replays in `LetterRevealHeading` |
| Letter-reveal H2 inside `.fe-animate` | Opacity fight — animate kicker/body separately |
| Session path next stage visible while previous is active | Sticky stack + hide inactive; flip on change |
| Session path intro as six short `display:block` lines | Inline fade spans, ~3 wrapped rows |
| Session path stuck under the header | Mid-viewport `--spath-sticky-top` |
| Centered head with only `margin-bottom` | Use flex `gap` on the container; clear overlay pill (rule `marketing-section-spacing`) |
| Title underlapping `.frontend-header--overlay` | Raise section `padding-top` until `titleTop > pillBottom` |

## Invoke

- Explicit: `/nura-ui-designer` or “nura-ui-designer”
- Implicit: any UI/UX, layout, restyle, visual polish, or page chrome task in this repo → load this skill first
