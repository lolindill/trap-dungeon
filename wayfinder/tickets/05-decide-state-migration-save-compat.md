---
summary: Decide save-file schema versioning, Phase 1-to-Phase 2 state migration, and optional RisuAI import
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
blocked-by: [01-research-phase2-lua-audit](01-research-phase2-lua-audit.md), [02-decide-day-loop-ux](02-decide-day-loop-ux.md)
---

# 05 Decide: Save-File Schema Migration (v1 -> v2) & RisuAI Compatibility

## Question

Phase 1 persists `GameState` (`etdm_standalone_state_v1`) and `TrapBlueprint[]` (`etdm_standalone_blueprints_v1`) in browser `localStorage` and `.json` exports. Adding Phase 2 systems (AP, Debt ledger, Town stats, Facilities, Officer affinity/stages, extended Prisoner fields) will expand `GameState` significantly.

Decisions needed before touching `src/types/game.ts`:
1. **Migration Policy:** Should existing Phase 1 JSON/localStorage saves cleanly upgrade into Phase 2 defaults via a pure `migrateGameState(raw)` function so ongoing runs continue with Debt/Town initialized gracefully?
2. **Multiple Save Slots:** Keep single autosave + `.json` export/import, or add named in-browser Save Slots (`Slot 1..5`) in Phase 2?
3. **RisuAI Chat/Save Import:** Is importing `dk_state` / variable dumps from original RisuAI saves desirable, or completely out of scope given Phase 1–2 feature differences?

## Resolution

All save-schema versioning, migration, multi-slot persistence, and RisuAI save-compatibility decisions were settled via grilling with the user:

1. **Schema Versioning & Auto-Migration (`schemaVersion: 2`):**
   - Introduce an explicit numeric `schemaVersion` (`2` for Phase 2; Phase 1 saves without the field are treated as `schemaVersion: 1`).
   - Run pure, unit-tested `migrateGameState(raw)` and `migrateBlueprints(raw)` functions on both `localStorage` startup (`etdm_standalone_state_v1`, `etdm_standalone_blueprints_v1`) and `.json` file imports in `SettingsModal`.
   - Phase 1 saves upgrade seamlessly into Phase 2 defaults anchored to the save's current `wave` (e.g., Goldreich `debt` initialized at `3,000 MP` with `dueWave = currentWave + 3`, `town` at Lv 1 defaults, officers at initial affinities, `ap`/`apMax` ready for the next Day, and existing `Prisoner` records backfilled with `stamina: 100`, zeroed `marks`, derived `pleasure`/`terror`/`shame`, and `gender: 'female'` fallback). `migrateBlueprints` preserves all existing `TrapBlueprint` entries while supporting the Ticket 04 Room Shortcut extension.

2. **Persistence & Save Slots (Autosave + 5 Named In-Browser Slots + `.json`):**
   - Retain the automatic active-run persistence (`etdm_standalone_state_v1`) for instant resume on reload, plus `.json` Export/Import for external backups and sharing.
   - Add **5 named in-browser Save Slots (`Slot 1..5`)** stored alongside metadata previews (`slotName`, `wave`, `day`, `points`, `debt`, `mode`, `savedAt`) so players can snapshot and branch runs before Debt collections, Harsh Pacts, or Ending choices without managing external files. (`LlmConfig` remains stored separately under `etdm_standalone_llm_v1` and is excluded from run saves.)

3. **RisuAI `〔DK-SAVE〕` Import (Out of Scope):**
   - Importing Base64/checksummed RisuAI `〔DK-SAVE〕` chat dumps (`dk_*` variables & Korean card state) is **out of scope**. Save compatibility stays strictly within Standalone `.json` exports, in-browser Save Slots, and `schemaVersion` migrations.
