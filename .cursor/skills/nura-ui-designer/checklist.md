# nura-ui-designer — shipping checklist

Use before ending a UI/UX turn.

## Visual

- [ ] Correct surface tokens (marketing vs product vs admin)
- [ ] Type: Fraunces **only** on home hero title; Source Sans 3 for all other marketing + `/app` + admin; Roboto Mono kickers on marketing
- [ ] Pistachio palette only; `#C6D67E` focus/hover only
- [ ] BrandLockup used; type does not echo rounded wordmark
- [ ] One primary action; secondary chrome does not compete
- [ ] No forbidden colors/fonts; no BLS in user copy
- [ ] Removing the lockup would still feel like Nura (or deliberate product chrome)
- [ ] New marketing section H2s use `LetterRevealHeading` (not hero / about / legal / Session path Attio fade); title not wrapped in `.fe-animate`; do not substitute GSAP fade (rule `letter-rise-headings.mdc`)
- [ ] Session path / How it works: `id="how-it-works"` on section start; letter-rise on stage leads, pair titles, finale (not intro H2)
- [ ] Centered title + sub above cards: flex `gap` on container (not margin-only); overlay header cleared; equal air under pill / under sub / under band (rule `marketing-section-spacing.mdc`)

## Copy (if strings changed)

- [ ] `/redpen` truth + no echo across kicker/title/lead/CTA
- [ ] `/writing-copy` — CTA says what happens; one idea per block
- [ ] Sentence case English; clinic-quiet

## Device + quality

- [ ] Mobile ~390×844 (header/nav/tabs/composer/sidebar)
- [ ] Desktop hero or primary screen screenshot or measured layout
- [ ] `ReadLints` on edited files
- [ ] `npm test` (and lint when non-trivial)
- [ ] Dev server smoke on **3471** if routes/auth/layout touched
- [ ] CHANGELOG `[Unreleased]` + Mem0 `user_id: emdr`
