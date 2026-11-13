---
summary: Implement 25 Realm Situations, 4 Major Crises, Town Lv6-7 Landmarks, War and Wonders Estate sub-tab, Guild Prep, and Grit
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md), [06-monster-pen-breeding-and-floor-slots](06-monster-pen-breeding-and-floor-slots.md)
---

# 08: Realm Situations (25), 4 Major Crises, Town Lv6–7, War, Wonders & Grit

**What to build:** Layer in all Phase 3 mid/late-game threats and strategic expansions: 25 Realm Situations + 11 Countermeasures, 7 Hero Bonds & 8 Stories, Guild Counter-Gear Prep (`Lv0–5`), SS+/EPIC Grit (`◆`), 4 Major Crises, Town Lv6–7 (`hq`/`lab`/`cmd`), and the 4th Estate sub-tab `War & Wonders`.

**Blocked by:** [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md), [06-monster-pen-breeding-and-floor-slots](06-monster-pen-breeding-and-floor-slots.md)

**Status:** closed

## Acceptance Criteria

- [x] Implement 25 `X.REALM` Situations (`W10+`), 11 `X.REALM_CTR` Countermeasures (active in `Build` & `Day` banners; `1 AP` counters gated to `Day`; read-only summary + `7` Bonds / `8` Stories in `PrepPanel`), and Settings `Realm Situations` (`Full / Casual Half / Off`).
- [x] Implement **Guild Counter-Gear Prep (`Lv0–5`)**, **SS/SSS/EPIC Grit (`◆` pips)**, and **4 Major Crises** (Holy Crusade `wrath` & Wave 3 Grand Master, Legendary Nemesis Memory/Adapt, 3-day Royal Siege Bo3, Prison Jailbreak) with concise Threat HUD pills + formula tooltips and 4 Relics (`shield`, `chalice`, `crown`, `lens`).
- [x] Add **Town Lv 6–7** (`hq`, `lab` `+1 DC` on 2 toggled floors, `cmd` `+1 DC` on guard floors) and the 4th `[3] Estate` sub-tab **`War & Wonders`** (`Scout/Raid/Annex` 3 rivals + 3 Great Wonders `spire`/`temple`/`gold`).
- [x] Wire Hybrid Crisis Narration (`Explore` & `War` → Day Journal; `M.Settle` Crises, Major Crises & Relics → immediate deterministic art cards + `"Narrate Scene Now"` + optional auto-narrate Major Crises), verified by `vitest run` and `vite build`.

## Resolution

Built `realmData.ts` & `engine/realm.ts` and integrated across `heroes.ts`, `raid.ts`, `estate.ts`, `dungeon.ts`, `debt.ts`, `prison.ts`, `workflow.ts`, `promptBuilder.ts`, `HeaderBar.tsx`, `FloorBoard.tsx`, `PrepPanel.tsx`, `EstatePanel.tsx`, `SettlementPanel.tsx`, `SettingsModal.tsx`, and `App.tsx` — delivering 25 `X.REALM` Situations (`Full`/`Half`/`Off`), 11 Countermeasures, 7 Bonds & 8 Stories, Guild Prep (`Lv0–5`), SS/SSS/EPIC Grit (`◆`), 4 Major Crises, 4 Relics, Town Lv6–7 (`hq`/`lab`/`cmd`), `War & Wonders`, Threat HUD pills, and Hybrid Crisis Narration. Verified via `vitest run` (`realmCrisesWarGrit.test.ts`: 9/9; total 93/93) and `tsc -b && vite build`.

## Design & Research References

- [09 Decide: Phase 3 Situations, Crises, Territory War, Guild Prep & High-Grade Grit UX](../../tickets/09-decide-phase3-crises-endgame.md)
- [phase3-lua-audit.md §3](../../research/phase3-lua-audit.md)
