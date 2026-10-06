# Ground first tutorial mock — design

**Date:** 2026-09-22  
**Status:** approved (user: CSS/React mock + cursor + typing + camera zoom)

## Goal

Replace the How it works **Ground first** “IMAGE OR VIDEO” slot with a muted, looping **tutorial-style** product mock: visible cursor, typing, clicks, and **zoom in / zoom out** camera moves (same energy as the reference Approval Workflow Creation webm).

## Approach

CSS/React marketing mock (Nura product chrome), not stock footage and not a real `/app` session recording for v1.

- **Live embed** in `SessionPathSticky` ground media (immediate on homepage).
- **Full-bleed recording page** at `/dev/ground-mock` for optional later `.webm` export.

## Storyboard (~25–30s loop)

| Beat | Camera | Action |
|------|--------|--------|
| Wide | scale ~1, origin mid | Mode picker: Start a session + 2 cards |
| Zoom card 2 | origin on Self-guided | Cursor glance |
| Zoom card 1 | origin on AI agent-guided | Hover + click |
| Session wide | scale 1 | App shell |
| Zoom composer | origin on composer | Type `Feet on the floor.` + send |
| Zoom agent / chip | follow cursor | Reply + `I'm settled` |
| Zoom Safe place | origin on left pair | Click highlight |
| Zoom No cold starts | origin on right pair | Click highlight |
| Wide | scale 1 | Hold; loop |

## Camera rule

`transform-origin` = cursor target (`focusX`/`focusY`). Cursor is **inside** the camera layer so zoom keeps the click target in frame.

## Copy (no em dash, no BLS)

- User types: `Feet on the floor.`
- Agent: `Good. Stay with that calm place for a moment.`
- Chip: `I'm settled`
- Agent confirm: `When you're ready, we can begin a set.`

## Tech

- `GroundFirstTutorial` client component + scoped CSS
- Camera: wrapper `transform: scale + translate` keyframes / timed state
- Cursor: absolute layer, synced positions
- `prefers-reduced-motion`: jump to end frame, no loop motion
- Tokens: pistachio / Source Sans 3 / sage sidebar

## Out of scope

- Other How it works stages; Attio pair card media; Modes pair stock clips; real video file required for v1
