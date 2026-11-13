---
summary: Import 301 trap presets and 29 combos into Original Codex tab, add Room Shortcuts, Build Suggest button, and ? tag toggle
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [01-state-v2-migration-and-save-slots](01-state-v2-migration-and-save-slots.md)
---

# 03: Original Trap Codex (301 + 29 Combos), Build `🎲 Suggest` & Room Shortcuts

**What to build:** Bring the original game's 301 curated trap presets and 29 multi-trap room combos into `BlueprintWorkshopModal` without polluting custom user shortcuts, enable multi-trap Room Blueprint Shortcuts (`Synergy B/A`), and speed up Build Mode with a `🎲 Suggest` button and optional `?` tag preview toggle.

**Blocked by:** [01-state-v2-migration-and-save-slots](01-state-v2-migration-and-save-slots.md)

**Status:** closed

## Acceptance Criteria

- [x] Build the curated data module of 301 `X.TP` presets (with `D`/`C`/`B` grades and inferred `TRAP_TYPES` tags) and 29 `X.TPC` multi-trap combos (pre-rated `Synergy B`/`A`) derived from `_reference/dungeon_keeper.lua`.
- [x] Add a separate **"Original Codex (301 + 29)"** tab inside `BlueprintWorkshopModal` supporting search, category/tag filters, **1-click Deploy**, and **Save Copy to My Shortcuts**.
- [x] Extend `TrapBlueprint` & `FloorBoard` deployment so Room Blueprint Shortcuts (2–3 traps + pre-rated Synergy) install onto empty/partial floors cleanly with atomic MP validation and `Save Floor as Room Shortcut`.
- [x] Add Build-mode **`🎲 Suggest`** (filling empty floor slots from Codex presets/combos) and a toggle to reveal/hide curated grades & tags on `?` traps, verified by `vitest run` and `vite build`.

## Resolution

Built `src/data/trapCodex.ts` (301 `X.TP` presets + 29 `X.TPC` combos across 28 subcategories with curated grades and `TRAP_TYPES` tags), added the "Original Codex (301 + 29)" tab in `BlueprintWorkshopModal.tsx`, atomic multi-slot Room Blueprint deployment in `engine/dungeon.ts`, and `🎲 Suggest` + `Save Floor as Room Shortcut` + `?` preview toggle in `FloorBoard.tsx`. Verified via `vitest run` (`codex.test.ts`: 9/9 passed; total 36/36) and `tsc -b && vite build`.

## Design & Research References

- [04 Decide: Importing Original 330 Trap Presets & 29 Combos into Blueprint Workshop](../../tickets/04-decide-trap-codex-integration.md)
