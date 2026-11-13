---
summary: Expand GameState to schemaVersion 2 with Phase 2/3 slices, pure Phase 1 auto-migration, waveStartSnapshot, and 5 save slots
labels: [wayfinder:task]
status: closed
assignee: antigravity
---

# 01: Schema v2, Phase 1→v2 Migration, Wave-Start Snapshot & 5 Save Slots

**What to build:** Introduce `schemaVersion: 2` across the TypeScript game state and save-persistence layer so existing Phase 1 saves upgrade cleanly without losing progress, every wave automatically snapshots its start state for 1-click Game Over rewind, and players can manage 5 named in-browser Save Slots (`Slot 1..5`) alongside `.json` export/import.

**Blocked by:** None (can start immediately)

**Status:** closed

## Acceptance Criteria

- [x] Expand `GameState`, `GameMode`, `Prisoner`, and `GameSettings` types for `schemaVersion: 2`, adding Phase 2–3 state slices (`day`/`ap`, `estate`/`town`, `debt`, `officers`, `prisoners` extended stats/marks/jobs, `monsters`/`eggs`, `expedition`, `realm`/`crises`/`war`/`wonders`/`relics`/`endings`/`rankTrials`, and `waveStartSnapshot`).
- [x] Implement pure `migrateGameState(raw)` and `migrateBlueprints(raw)` that auto-upgrade Phase 1 saves (`schemaVersion: 1` or missing) anchored to `currentWave` (initializing Goldreich debt, Lv1 Town, Officers, default prisoner fields, and room-shortcut blueprint fields) on `localStorage` startup and `.json` import.
- [x] Implement `Slot 1..5` save/load/delete/rename persistence with metadata previews (`slotName`, `wave`, `day`, `points`, `debt`, `mode`, `savedAt`) inside `SettingsModal`, keeping `LlmConfig` separate.
- [x] Auto-capture `waveStartSnapshot` at the start of every `Build` phase (independent of `Slot 1..5`) and verify Phase 1 save compatibility + migration edge cases with `vitest run` and `tsc -b && vite build`.

## Resolution

Implemented `schemaVersion: 2` types, pure Phase 1->v2 migration (`migrateGameState`, `migrateBlueprints`), `waveStartSnapshot` capture/restore, and `Slot 1..5` CRUD inside `SettingsModal` (with `LlmConfig` kept separate). Verified via `vitest run` (2 files, 16/16 passed) and `tsc -b && vite build`.

## Design & Research References

- [05 Decide: Save-File Schema Migration (v1 -> v2) & RisuAI Compatibility](../../tickets/05-decide-state-migration-save-compat.md)
- [10 Decide: Gallery Unlock Persistence, Asset Reconciliation & Endings / Game Over Loop UX](../../tickets/10-decide-gallery-unlock-endings.md)
- [phase2-lua-audit.md](../../research/phase2-lua-audit.md)
- [phase3-lua-audit.md](../../research/phase3-lua-audit.md)
