---
summary: Upgrade GalleryModal to 7 Always-Unlocked tabs with asset fallback mapping, Ending and Game Over modals, Rewind, and Rank Trials
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md), [08-realm-situations-crises-war-and-grit](08-realm-situations-crises-war-and-grit.md)
---

# 09: 7-Tab Gallery Reconciliation, 5 Endings, Game Over Rewind & Rank Trials

**What to build:** Reorganize `GalleryModal` into Lua's 7 Always-Unlocked categories with clean alias/fallback mapping for unbundled keys, and deliver the 5 Canonical Endings, Endless Rank Trials (`CFG.RANK`), and 5 Game Overs with Vault Core Guard, Casual Grace, and 1-click Wave-Start Rewind.

**Blocked by:** [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md), [08-realm-situations-crises-war-and-grit](08-realm-situations-crises-war-and-grit.md)

**Status:** closed

## Acceptance Criteria

- [x] Upgrade `GalleryModal.tsx` to **Always-Unlocked** 7 Category Tabs (`P: Officers`, `D: Debt`, `T: Estate`, `J: Prison`, `N: Endings`, `S: Cards`, `X: Expedition`) with subcategory filter chips and `_m` variant toggle.
- [x] Implement the **Alias & Fallback Mapping** in `assetManifest.ts` (`dk_stage_e3 → dk_int_e5`, `dk_fl_fighter → dk_fl_display`, `dk_act_granary → dk_act_farm`, `dk_fac_torture → dk_fac_prison`, `dk_war_raid → dk_exd_raid`, `hotspring/market → dk_exr_road/dk_exd_village`) so zero broken images occur.
- [x] Implement all **5 Canonical Endings** (`romance`, `romance_dowry` E10 `debt<=600`, `liberation`, `prosperity` keeping Debt active, `bankrupt`) with an **Ending Modal**, `"Narrate Finale [DK-END]"`, and transition into **Endless Rank Trials** (`wipe3`, `jobs5`, `annex1`, `epic` cycling every 5 waves).
- [x] Implement all **5 Game Overs** (`ruin`, `famine`, `riot`, `core`, `bankrupt`) with Vault Core Protection (`v.mp >= 50`), Casual Grace (`1/run`), `"Narrate Fall"`, and recovery buttons (**Rewind Wave Start** via `waveStartSnapshot`, **Load Slot 1–5**, **New Run**), verified by `vitest run` and `vite build`.

## Resolution

Upgraded `GalleryModal.tsx` (`albumCatalog.ts`) to 7 Always-Unlocked Category Tabs (`P/D/T/J/N/S/X`) with subcategory chips & `_m` variant toggle, implemented `SCENE_ASSET_ALIASES` & fallback mapping in `assetManifest.ts` (zero broken images verified on disk), built `engine/endings.ts` & `EndingGameOverModal.tsx` covering all 5 Canonical Endings, Endless Rank Trials (`wipe3`, `jobs5`, `annex1`, `epic`), 5 Game Overs, Vault Core Guard (`v.mp >= 50`), Casual Grace (`1/run`), `"Narrate Finale [DK-END]"` / `"Narrate Fall"`, and Wave-Start Rewind / Save Slot recovery. Verified via `vitest run` (`galleryEndings.test.ts`: 15/15; total 108/108) and `tsc -b && vite build`.

## Design & Research References

- [10 Decide: Gallery Unlock Persistence, Asset Reconciliation & Endings / Game Over Loop UX](../../tickets/10-decide-gallery-unlock-endings.md)
- [phase3-lua-audit.md §4–§5](../../research/phase3-lua-audit.md)
