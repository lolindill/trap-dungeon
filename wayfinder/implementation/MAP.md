# Ero Trap Dungeon Maker — Phase 2 & 3 Implementation Map

## Destination ✅ COMPLETED (2026-11-13)

Expand the playable Phase 1 standalone React + TypeScript + Vite app (`C:/novel/trap_dun/app`) to full Phase 2 and Phase 3 feature parity — verified by `vitest run`, `tsc -b && vite build`, and end-to-end desktop browser playtest — following every locked architectural and UX decision in the completed design map (`../MAP.md`).

## Notes

- **Execution Override:** This map carries **implementation execution** (`wayfinder:task`) rather than planning-only. Work tickets on the frontier one vertical slice at a time (`ready-for-agent`), running `npm.cmd run test` (`vitest run`) and `npm.cmd run build` (`tsc -b && vite build`) in `app/` before closing each ticket.
- **Design Source of Truth (Completed):** `wayfinder/MAP.md` (Tickets `01`–`10`), `wayfinder/research/phase2-lua-audit.md`, `wayfinder/research/phase3-lua-audit.md`, and `wayfinder/prototypes/07-navigation-shell.html`.
- **Phase 1 Preservation Rule:** Never break the existing `Build → Prep → Raid → Result` loop or the Trap Blueprint Shortcut workflow while expanding to Phase 2–3.
- **PC-Only Ergonomics:** Target desktop viewports (`1280px–1680px+`) with English UI, dark Galmuri/DOS theme, offline/fallback resilience alongside client-side LLM narration, and zero server backend.

## Decisions so far

<!-- Index of completed implementation tickets will be appended here as one-line summaries + links -->
- **[01: Schema v2, Phase 1→v2 Migration, Wave-Start Snapshot & 5 Save Slots](tickets/01-state-v2-migration-and-save-slots.md)** — Expanded `GameState` to `schemaVersion: 2` with all Phase 2–3 slices, implemented `migrateGameState`/`migrateBlueprints`, `waveStartSnapshot` auto-capture/rewind, and `Slot 1..5` persistence in `SettingsModal` (`vitest run`: 16/16, `vite build`: pass).
- **[02: Phase 2/3 Navigation Shell, Dual Stepper & Day-Loop Cadence](tickets/02-navigation-shell-and-day-loop.md)** — Implemented `580px` 5-tab shell, Dual Night/Day Stepper, `1–5` shortcuts, `🔒 DAY` locks, full Day loop, Rest MP, Skip-Day toggle, and Hybrid batched Day Journal (`vitest run`: 27/27, `vite build`: pass).
- **[03: Original Trap Codex (301 + 29 Combos), Build `🎲 Suggest` & Room Shortcuts](tickets/03-codex-presets-and-room-shortcuts.md)** — Extracted 301 `X.TP` presets + 29 `X.TPC` combos into `trapCodex.ts`, added Original Codex tab, atomic Room Blueprint Shortcuts, `🎲 Suggest`, and `?` grade/tag preview toggle (`vitest run`: 36/36, `vite build`: pass).
- **[04: Prison Master-Detail, 35+ Actions, 25 Jobs, Conversions & Fate](tickets/04-prison-training-jobs-and-disposal.md)** — Implemented Master-Detail `PrisonPanel`, 38 pacts, 24 `CFG.JOBS` (`1–3★` aptitude), 5 conversions, Double Agent `mole`, Fate disposal, M/F `_m` fallback & pronouns, and `Narrate Scene Now` (`vitest run`: 49/49, `vite build`: pass).
- **[05: Estate Town Lv1–5, Explore (20 Events), Goldreich Debt & 3 Officers](tickets/05-estate-town-debt-and-officers.md)** — Implemented Town Lv1–5, 25 facilities, 9 Explore locations & 20 events, `M.Settle` ledger & 16 crises, Goldreich 3-wave Debt desk, and Vesper/Lilim/Eleonora stages & perks (`vitest run`: 64/64, `vite build`: pass).
- **[06: 28-Monster Pen, Breeding, Eggs, Floor Guards (`0/2`) & Link Combos](tickets/06-monster-pen-breeding-and-floor-slots.md)** — Implemented 28 lineages (`84` forms), `MonsterPenView`, eggs/overcrowding/Hard upkeep, inline `Floor Guards (0/2)` + `🔗 LINK` combos in `FloorBoard` & `raid.ts`, and M.Settle nightly cycle (`vitest run`: 84/84, `vite build`: pass).
- **[07: Interactive `3 AP/day` Expedition Mini-Map, Auto-Progress & Relic Shards](tickets/07-expedition-minimap-and-relics.md)** — Implemented W3+ `ExpeditionLauncherView`, `ExpeditionPanel` (`3 AP/day` mini-map, 13 regions, 22 events, `Auto-Progress` & `exStop`), Relic Shards, 8 `X.AFTER` aftereffects, and Hybrid Expedition Chronicle (`vitest run`: 84/84, `vite build`: pass).
- **[08: Realm Situations (25), 4 Major Crises, Town Lv6–7, War, Wonders & Grit](tickets/08-realm-situations-crises-war-and-grit.md)** — Implemented 25 `X.REALM` situations + 11 countermeasures, 7 Bonds & 8 Stories, Guild Prep (`Lv0–5`), SS/SSS/EPIC Grit (`◆`), 4 Major Crises, 4 Relics, Town Lv6–7 (`hq`/`lab`/`cmd`), `War & Wonders`, and Hybrid Crisis Narration (`vitest run`: 93/93, `vite build`: pass).
- **[09: 7-Tab Gallery Reconciliation, 5 Endings, Game Over Rewind & Rank Trials](tickets/09-gallery-reconciliation-endings-and-endless.md)** — Upgraded `GalleryModal` to 7 Always-Unlocked tabs (`P/D/T/J/N/S/X`) with `_m` toggle & zero broken asset aliases, implemented 5 Canonical Endings, Endless Rank Trials, 5 Game Overs, Vault Core Guard, Casual Grace, and Rewind Wave Start (`vitest run`: 108/108, `vite build`: pass).
- **[10: Full Phase 2–3 Integration Verification, Migration Audit & Browser Playtest](tickets/10-end-to-end-verification-and-polish.md)** — Verified all 10 test suites (`108/108` passed), `tsc -b && vite build` (`82 modules`), live `1440x900` desktop browser playtest (0 console errors, 0 broken images, `1–5` hotkeys, `🔒 DAY` locks, full Night/Day loop), updated `plan.md`, and closed implementation map.

## Not yet specified

<!-- None remaining; all implementation slices are charted and wired. -->

## Out of scope

- RisuAI chat DOM hacks or importing RisuAI `〔DK-SAVE〕` dumps.
- Hosted backend servers, user accounts, or proxy databases.
- Non-English game UI localization.
- Post-parity polish deferred beyond Phase 2–3: Audio/SFX polish and PWA/Electron/Tauri packaging.
