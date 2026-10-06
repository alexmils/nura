# Ground first tutorial — implementation plan

**Goal:** Ship looping camera+cursor tutorial in How it works Ground first media slot.

## Files

| File | Role |
|------|------|
| `app/components/frontend/GroundFirstTutorial.tsx` | Timeline: camera, cursor, type, clicks |
| `app/components/frontend/ground-first-tutorial.css` | Stage, camera, cursor, product chrome |
| `app/components/frontend/SessionPathSticky.tsx` | Swap MediaPlaceholder → tutorial |
| `app/dev/ground-mock/page.tsx` | Full-bleed recording surface |

## Tasks

1. Build `GroundFirstTutorial` with reduced-motion end state + loop when in view.
2. Style camera zooms + cursor click ripple.
3. Wire into ground stage; keep pair cards as placeholders.
4. Add `/dev/ground-mock` page.
5. Lint + `npm test` + changelog `[internal]`.
