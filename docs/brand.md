# Nura — brand system

Use this file as the source of truth for naming, color, type, and voice.
Agents: follow `.cursor/rules/nura-brand.mdc` (always on). Code constants live in `lib/brand.ts`.
Operator entity: `lib/legal-entity.ts` (**Receptly LLC**).

**Shareable PDF:** [`docs/nura-brand-guidelines.pdf`](nura-brand-guidelines.pdf) — regenerate from this doc when the system changes.

## Name

**Say and write Nura. URL is nurahelp.com (domain only — not a brand word).**

| Layer | Name | Where |
|---|---|---|
| Brand / UI chrome | Nura | Header, sidebar, email from-name, Stripe Checkout, lockup |
| Legal operator | Receptly LLC | Terms, Privacy, JSON-LD `legalName` |
| Marketing footer line | © {year} Nura \| All rights reserved | Site footer only — operator stays on legal pages |
| Domain | nurahelp.com | Host only. Do not write “NuraHelp” in UI copy. |
| Current product | Nura · EMDR Support | Feature, not a second company name |
| Never in public | NuraHelp / NuraHelp AI / Nura Help | Retired; rewrite via `rewriteRetiredBrandCopy` |

Titles, hero copy, and H1s may lead with “AI” for the product — Nura is **AI-guided EMDR** (the position and the search term). The wordmark and brand name stay **Nura** — never “Nura AI” or “NuraHelp AI”.

## Position

Nura is a calm place for guided therapy support — EMDR sessions and resources in the app.

Not an AI therapist. Not an EHR. Not emergency care.

Hero: **EMDR therapy online.** *in a calm app.* (tagline still: Support for therapy. Starting with EMDR.)

Disclaimer (always visible on marketing): self-help tool, not a licensed therapist.

## Color

**Pistachio** palette — mint, sage, and olive (modern, calm green).

| Token | Hex | Use |
|---|---|---|
| Paper (mint) | `#A4EDA5` | Highlights, canvas tint, light surfaces |
| Pistachio | `#C6D67E` | Focus, hover, selection — never body text or default borders |
| Sage (earth) | `#84B067` | Wordmark, icons, primary buttons |
| Olive | `#948F4E` | Muted text, secondary chrome |
| Ink | `#2A3020` | Body text |
| Sidebar | `#3D4129` | App / admin sidebar (dark olive) |

Page background uses a softened mint (`#EDF9ED`). Constants: `lib/brand.ts` → `BRAND_COLORS`.

Forbidden: OpenAI `#10a37f`, Apple `#007AFF`, purple “wellness”, hospital blue.

## Type

### Product (`/app`, `.app-shell`)

- **Source Sans 3 only** (`--font-sans`) for titles, body, and chrome
- `.app-shell` / `.settings-shell` / `.auth-shell` remap `--font-display` → `--font-sans` (no ornamental Fraunces in product or auth)

### Admin (`/admin`, `.admin-shell`)

- **Source Sans 3 only** (`--font-sans`) for page titles, card titles, headings, KPIs, and labels
- `.admin-shell` remaps `--font-display` → `--font-sans` so admin chrome stays sober (no ornamental Fraunces)

### Marketing (`.frontend-home`)

Fraunces is the **decorative** display face for the marketing **home hero title only** — not for section titles, dense reading, legal docs, or app chrome:

| Role | Font | Notes |
|---|---|---|
| Home hero title | **Fraunces** | Weight 400; italic for emphasis. Hero only |
| Landing sections, Blog, Learn, articles, About/EMDR, legal | **Source Sans 3** | Headings **600**, body **400**. Never Fraunces outside the home hero |
| Body / UI / nav / buttons | **Source Sans 3** | All other marketing UI |
| Labels | **Roboto Mono** | Kickers, marquee, uppercase ~0.9375rem |

**Do not** use Fraunces for Blog/Learn titles, pricing/how-it-works section titles, Termly/legal headings, settings, admin, or `/app`. Ornamental serif next to the wave lockup is fine in the home hero only.

Loaded via `next/font` in `app/layout.tsx` (`--font-fraunces`, `--font-source-sans`, `--font-fe-alt`). Scoped on `.frontend-home` in `app/globals.css`. Legal overrides: `.frontend-home .frontend-legal h1–h3` → `--font-sans`.

Do not use Inter on any surface. Avoid rounded soft grotesks (Nunito, Manrope, retired BDOGrotesk) next to the wave lockup.

## Logo

- **Wordmark**: wave ribbon flowing into lowercase **nura** (green→gold gradient). UI chrome shows the wave wordmark only.
- **Mark**: single mint→sage stroke wave with round tips and padding (not a flat crop into “n”). Files: `mark.png` / `mark-black.png` / `mark-white.png` (+ `mark.svg`).
- Favicon / apple-touch: same stroke wave on near-black `#0E100E`, generous inset so both round caps clear the frame. Files: `favicon.png`, `favicon-32.png`, `apple-touch-icon.png`, `app/icon.svg`, `app/icon.png`, `app/apple-icon.png`.
- Square lockups (500 / 2500):
  - Black/white transparent: `nura-wave-logo-black|white-{500,2500}.png`
  - Black on white / white on black: `nura-wave-logo-black-on-white-*`, `nura-wave-logo-white-on-black-*`
  - Color transparent: `nura-wave-logo-color-{500,2500}.png`
  - Color on white / black: `nura-wave-logo-color-on-white-*`, `nura-wave-logo-color-on-black-*`
- Wordmark only (no wave) — same letterforms as the lockup (`u`/`r`/`a` cropped; `n` = vertical flip of `u` so the wave tip isn’t part of the letter):
  - Transparent: `nura-text.png`, `nura-text-black.png`, `nura-text-white.png` (+ `-500` / `-2500` squares)
  - On backgrounds: `nura-text-color-on-white|black-*`, `nura-text-black-on-white-*`, `nura-text-white-on-black-*`
- Never: brain, lotus, chat bubble, cross, heart, or the retired two-dots arc.

Files: `public/brand/nura-wave-logo.png` (+ `-black` / `-white` / color squares), `nura-text*.png`, `mark.png`, `lockup.png` / `lockup.svg`, `mark.svg`. Component: `app/components/BrandLockup.tsx` (`tone="color" | "black" | "white"`).

**Master vector (correct paths):** `public/brand/Nura Logo.svg`. Palette exports (lockup / text-only / circle, SVG + PNG): `public/brand/logo-variants/` (`contact-sheet.png`, `README.md`).

## Voice

English, sentence case, short sentences. No hype (“revolutionary”, “neural networks”, “blockchain”). Clinic-quiet, not a startup pitch.

**Never use the em dash (—)** in user-facing sentences (UI, agent lines, emails, FAQ, marketing body). It reads as AI-written. Prefer a comma, period, colon, or parentheses. Strip it from agent prompts too, or the model will keep writing it. OK in code comments and the layout title template ` — Nura`. See `.cursor/rules/nura-brand.mdc`.

**Never say BLS to users.** Prefer **self-guided set time** / **Set running** / **visual sets** / **session controls**. Internal code names (`bls`, `TRIAL_BLS_SECONDS`) are fine. See `.cursor/rules/nura-brand.mdc`.

**Do not default Self-guided to “moving ball.”** Sets include animation choices (Dot, Flash, …), sound, and optional gamepad rumble. Prefer **visual sets** / **sets you run yourself**. Name the ball only when teaching visual rhythm on an educational page — never as the Self-guided headline.

**Session modes:** do not say bare “Guided or Free.” Use **AI agent-guided** vs **Self-guided** (never **Free session** — that reads as $0). Headlines may lead with **AI-guided EMDR**; wordmark stays **Nura**. See `.cursor/rules/session-mode-names.mdc`.

## SEO

The brand name does not need to contain “EMDR”. Pages do.

| URL | Intent |
|---|---|
| `/` | Brand + EMDR primary CTA |
| `/about` | Who Nura is, what the app offers, disclaimers |
| `/editorial` | How public guides are written (self-help, not a named clinician) |
| `/emdr` | What EMDR is, visual sets, how a session works |
| `/learn` | Start-here map (understand / practice / safety) |
| `/blog` | Article index (cover images, newest first) |
| `/blog/[slug]` | Individual guides (visual sets, practice, safety) |
| `/changelog` | Public product notes parsed from `CHANGELOG.md` |
| `/llms.txt` | AI search: cite public pages, do not train, do not fetch `/app` |

Retired: `/therapy`, `/therapists`, `/resources` → redirect to `/learn`.

Default document title: `Guided EMDR therapy online app — Nura`.
