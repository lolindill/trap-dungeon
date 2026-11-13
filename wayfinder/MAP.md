# Ero Trap Dungeon Maker — Phase 2 & 3 Wayfinder Map

## Destination ✅ COMPLETED (2026-11-13)

Resolve all architecture, gameplay-loop, data-schema, and UI/UX design decisions required to expand the playable **Phase 1 Standalone App** (`C:/novel/trap_dun/app`) to full feature parity across **Phase 2** (Day Loop, Estate/Town, Prison Training, Debt, Officer Perks) and **Phase 3** (Monsters, Expeditions, Situations/Crusades, Album Unlocks, Endings), with zero open design fog before implementation begins.

## Notes

- **Parent Project Plan:** [../plan.md](../plan.md)
- **Baseline Codebase:** Phase 1 is built and verified (`vitest run`: 9/9 pass; `vite build`: pass). Never break the Phase 1 core `Build → Prep → Raid → Result` loop or the Trap Blueprint Shortcut workflow while designing Phase 2–3.
- **Reference Materials:** `C:/novel/trap_dun/_reference/dungeon_keeper.lua`, `default_variables.txt`, `card.json`, and `lorebook/00..19`.
- **Standalone Preferences:** English UI, retro DOS/Galmuri dark theme (`src/styles/dungeon.css`), PC/Desktop-first ergonomics (`1280px–1680px+`; no mobile-specific KPI trimming), direct client-side LLM API integration (no server backend), graceful offline/fallback playability alongside full AI narration.
- **Skills for Working Tickets:**
  - Use `research` for `wayfinder:research` tickets (read-only audit under `_reference/`).
  - Use `grill-me` (HITL — one question at a time with recommended answers) for `wayfinder:grilling` tickets.
  - Use `frontend-design` / `ui-design-review` alongside `prototype` for UI shell prototyping.

## Decisions so far

<!-- Index of closed tickets will be appended here as one-line summaries + links -->
- **[01 Research: Phase 2 Lua Mechanics (AP, Prison, Debt, Town, Officer Perks)](tickets/01-research-phase2-lua-audit.md)** — Audited all Phase 2 schemas, formulas, probability tables, lorebook rules, and v1.6.0–v1.15.2 patch overrides (AP cap 6, 35 pacts, 25 jobs/facilities, debt schedule/interest, and officer stage swaps) into [phase2-lua-audit.md](research/phase2-lua-audit.md).
- **[02 Decide: Day-Loop Cadence & Standalone Phase Navigation UX](tickets/02-decide-day-loop-ux.md)** — Locked full Night/Day loop (`Result → Day [AP] → M.Settle [+Crisis] → [Debt/3w] → Build`) with End-Day Rest MP & optional Skip-Day toggle, phase-driven Left Pane + Top Sub-Tabs, dual Night/Day Header Stepper with full Town/Debt KPIs, and Hybrid batched Day Journal + on-demand Narrate Now.
- **[03 Decide: Prison Management Interactions, Jobs & Content Controls](tickets/03-decide-prison-scope.md)** — Locked Master-Detail + 6-sub-tab Prison UI, full M/F action parity with `_m` sprite fallback, keeping existing `gore` toggle with full Lua Prison suite enabled (extra filters skipped), and Hybrid Day Journal sync + 1-click "Narrate Scene Now" + compact roster prompt context.
- **[04 Decide: Importing Original 330 Trap Presets & 29 Combos into Blueprint Workshop](tickets/04-decide-trap-codex-integration.md)** — Locked separate "Original Codex (301 + 29)" tab + Build-mode `🎲 Suggest`, agent-curated `D`/`C`/`B` grades & `TRAP_TYPES` tags with `?` toggle, and full Room Blueprint Shortcuts (29 combos + custom multi-trap floors) with pre-rated Synergy (`B`/`A`).
- **[05 Decide: Save-File Schema Migration (v1 -> v2) & RisuAI Compatibility](tickets/05-decide-state-migration-save-compat.md)** — Locked `schemaVersion: 2` with pure `migrateGameState` / `migrateBlueprints` auto-upgrading Phase 1 saves, Autosave + 5 named in-browser Save Slots (`Slot 1..5`) + `.json` Export/Import, and RisuAI `〔DK-SAVE〕` import ruled out of scope.
- **[06 Research: Phase 3 Monsters, Expeditions, Town Crises, Album Ledger & Endings](tickets/06-research-phase3-lua-audit.md)** — Audited 28 monsters, 5-tier expeditions (13 regions, 22 events), 25 realm situations, 16 settlement + 4 major crises, war/wonders/rank/prep/grit, 7-cat album (`348` bundled vs `357` Lua keys), and 5 endings / 5 game overs into [phase3-lua-audit.md](research/phase3-lua-audit.md), graduating Phase 3 & Gallery design into Tickets 08–10.
- **[07 Prototype: Standalone Navigation Shell for Phase 2 Subsystems](tickets/07-prototype-domain-navigation-shell.md)** — Built and verified clickable shell [07-navigation-shell.html](prototypes/07-navigation-shell.html) (`580px` Left Pane + unshrunk `ChroniclePanel`, dual-group Header KPIs, Dual Night/Day Stepper, `1–5` hotkeys, `🔒 DAY` locks, alert badges), locked for **PC-only** desktop ergonomics.
- **[08 Decide: Phase 3 Monster Pen, Floor Combat Slots & Expedition Phase UX](tickets/08-decide-phase3-monsters-expeditions.md)** — Locked `[3] Estate` sub-views (`Beast Pen & Eggs | Expedition`), Hard-only default `CFG.UPKEEP` + Settings toggle, inline `FloorBoard` `Floor Guards (0/2)` + `1F..7F` `🔗 LINK` / `PREF +1` / `BETRAYAL` indicators, interactive `3 AP/day` Expedition mini-map + smart `Auto-Progress`, and Hybrid Expedition Chronicle.
- **[09 Decide: Phase 3 Situations, Crises, Territory War, Guild Prep & High-Grade Grit UX](tickets/09-decide-phase3-crises-endgame.md)** — Locked concise threat pills + tooltip formulas (`WRATH`, `NEMESIS`, `GPREP`, `Grit ◆`), `Build`/`Day` Situation & Countermeasure banners + Settings `Full/Casual Half/Off`, 4th `[3] Estate` sub-tab `War & Wonders` + blocking `M.Settle` Crisis/Siege cards, and Hybrid Crisis Narration.
- **[10 Decide: Gallery Unlock Persistence, Asset Reconciliation & Endings / Game Over Loop UX](tickets/10-decide-gallery-unlock-endings.md)** — Locked Always-Unlocked Gallery upgraded to 7 Category Tabs (`P/D/T/J/N/S/X`) + `_m` filter + alias/fallback asset mapping (zero broken images), dedicated `waveStartSnapshot` Rewind, Ending/Game Over Modal (`[DK-END]`), and Endless Rank Trials.

## Not yet specified

<!-- None remaining toward the Phase 2 & 3 feature-parity design destination. -->

## Out of scope

- RisuAI chat DOM hacks, CSS hiding tricks, or coupling back to RisuAI runtime APIs (including importing RisuAI `〔DK-SAVE〕` variable dumps).
- Paid hosted backend database, user account authentication, or server-side proxy servers (all keys & saves remain user-local).
- Translating the UI away from English (user chat communication stays Nong Maid Thai; standalone game UI remains English).
- Deferred past Phase 2–3 feature-parity scope: **Audio & Feedback Polish** (chiptune/SFX) and **Distribution Packaging** (PWA/Electron/Tauri/static deploy).
