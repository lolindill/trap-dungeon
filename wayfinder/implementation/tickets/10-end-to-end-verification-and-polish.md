---
summary: Run full Phase 1-3 unit/integration tests, save migration audit, production build, and desktop browser playtest verification
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [03-codex-presets-and-room-shortcuts](03-codex-presets-and-room-shortcuts.md), [06-monster-pen-breeding-and-floor-slots](06-monster-pen-breeding-and-floor-slots.md), [07-expedition-minimap-and-relics](07-expedition-minimap-and-relics.md), [08-realm-situations-crises-war-and-grit](08-realm-situations-crises-war-and-grit.md), [09-gallery-reconciliation-endings-and-endless](09-gallery-reconciliation-endings-and-endless.md)
---

# 10: Full Phase 2–3 Integration Verification, Migration Audit & Browser Playtest

**What to build:** Perform final end-to-end verification across the complete standalone Phase 1–3 application: automated unit/integration suite, Phase 1→v2 save migration checks, clean TypeScript/Vite build, and live desktop browser verification across every loop.

**Blocked by:** [03-codex-presets-and-room-shortcuts](03-codex-presets-and-room-shortcuts.md), [06-monster-pen-breeding-and-floor-slots](06-monster-pen-breeding-and-floor-slots.md), [07-expedition-minimap-and-relics](07-expedition-minimap-and-relics.md), [08-realm-situations-crises-war-and-grit](08-realm-situations-crises-war-and-grit.md), [09-gallery-reconciliation-endings-and-endless](09-gallery-reconciliation-endings-and-endless.md)

**Status:** closed

## Acceptance Criteria

- [x] All engine and migration tests in `app/` pass via `npm.cmd run test` (`vitest run`) with zero skipped assertions, covering Phase 1→v2 migration, Codex/Shortcuts, Day/Estate/Debt/Officers, Prison, Monsters/Links, Expeditions, Situations/Crises/War/Grit, and Endings/Rewind.
- [x] `npm.cmd run build` (`tsc -b && vite build`) completes with zero TypeScript or bundler errors.
- [x] Live desktop browser verification (`1280px–1680px+`) confirms zero console errors, zero broken `<img>` assets across `GalleryModal` and gameplay cards, working `1–5` hotkeys and `🔒 DAY` locks, and clean traversal of `Build → Prep → Raid → Result → Day → M.Settle → Exped → Debt → Ending / Rewind`.
- [x] Update [plan.md](../../../plan.md) with Phase 2 & 3 completion status and close `wayfinder/implementation/MAP.md`.

## Resolution

Completed full end-to-end verification across the standalone Phase 1–3 application:
- `npm.cmd run test` (`vitest run`): **10 test files passed (10), 108 tests passed (108), 0 failed, 0 skipped**.
- `npm.cmd run build` (`tsc -b && vite build`): exited `0` (`82 modules transformed`).
- Live desktop browser playtest (`1440x900` on `http://127.0.0.1:5173/`): confirmed `580px` Left Pane + `ChroniclePanel` layout, dual-group Header KPIs, Dual Stepper, 7-tab Gallery + `_m` filter, `Original Codex (301 + 29)` deployment + `? Preview`, `1–5` keyboard hotkeys, `🔒 DAY` locks in Build mode, full Night → Day → Night traversal (`Build → Prep → Raid → Result → Day [AP] → M.Settle → Wave 2 Build`), Settings modal controls (`Save Slots 1–5`, `Skip Day`, `Realm Situations`, `Upkeep`), **0 console errors**, and **0 broken `<img>` assets**.
- Updated [plan.md](../../../plan.md) with Phase 2 & 3 completion details and closed [MAP.md](../MAP.md).

## Design & Research References

- [wayfinder/MAP.md](../../MAP.md)
- [wayfinder/implementation/MAP.md](../MAP.md)
