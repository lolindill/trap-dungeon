---
summary: Build 28-monster Beast Pen and Eggs sub-view in Estate, Hard-only upkeep toggle, Floor Guards (0/2), and adjacent Link Combos
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md)
---

# 06: 28-Monster Pen, Breeding, Eggs, Floor Guards (`0/2`) & Link Combos

**What to build:** Add the full 28-lineage Monster raising & breeding system inside `[3] Estate → Beast Pen & Eggs` and wire `Floor Guards (0/2)` (`CFG.FSLOT`), `🏠 PREF +1`, `⚠ BETRAYAL`, and adjacent `🔗 LINK -1/-2` combos directly into `FloorBoard` and Raid resolution.

**Blocked by:** [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md)

**Status:** closed

## Acceptance Criteria

- [x] Implement all 28 monster lineages (`84` ★1–★3 forms, `X.MOB_PREF`, `X.MOB_FEM`, `X.OCC_ACT`), Pen capacity, `mob_eggs` hatching queue, and Estate overcrowding (`20%` death / `80%` injury) inside `[3] Estate → Beast Pen & Eggs`.
- [x] Implement `feed`, `abs`, `mevo_`, `mbrd_` (female/male prisoners + cross-species Variant bloodline), and `mdisp_` (Sell/Butcher, available in `Estate` and `Build`), logging actions to Day Journal + `"Narrate Scene Now"`.
- [x] Implement `CFG.UPKEEP` monster/estate upkeep (`Hard` ON by default, `Normal`/`Casual` OFF, with explicit Settings toggle) including arrears escape/starve hazards.
- [x] Add inline **`Floor Guards (0/2)`** picker in `FloorBoard` (`PREF +1`, `cap +3`, `⚠ BETRAYAL` for `resist >= 60`) plus **`🔗 LINK -1/-2`** (`x/3` max) indicators on the `1F..7F` strip, and integrate guard DC, link penalties, XP (`+3` kill / `+2` capture), and injury/death rolls into `raid.ts`, verified by `vitest run` and `vite build`.

## Resolution

Built `monsterData.ts` (28 lineages, `84` ★1–★3 forms, `X.MOB_PREF`/`X.MOB_FEM`/`X.OCC_ACT`, 12 `FLOOR_LINK_RULES`), `engine/monsters.ts`, `MonsterPenView.tsx` (wired into `EstatePanel.tsx`), Hard-default `CFG.UPKEEP` + Settings toggle, inline `Floor Guards (0/2)` & `🔗 LINK` indicators in `FloorBoard.tsx`, raid guard/link/XP/betrayal integration in `raid.ts`/`dungeon.ts`, and `processMonsterNightlyCycle` wired into `engine/estate.ts` M.Settle. Verified via `vitest run` (`monsters.test.ts`: 10/10; total 84/84) and `tsc -b && vite build`.

## Design & Research References

- [08 Decide: Phase 3 Monster Pen, Floor Combat Slots & Expedition Phase UX](../../tickets/08-decide-phase3-monsters-expeditions.md)
- [phase3-lua-audit.md §1](../../research/phase3-lua-audit.md)
