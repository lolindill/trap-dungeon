---
summary: Build the resolveRaidModifiers pure seam that finally reads activeRaidMods, estate modifiers, Lilim DC, aftereffects and mole — under council caps
labels: [wayfinder:task]
status: closed *(2026-11-15 — resolveRaidModifiers live in raid/dungeon/heroes/workflow/debt under caps ±4/+3/+2/−4)*
assignee: kevii/agent-w1-15
---

# 15: Raid-Mods Seam — `resolveRaidModifiers(state, ctx)` (Batch 1 core)

**What to build:** The single pure seam that turns five write-only systems into live mechanics. New module `app/src/engine/raidMods.ts` exporting `resolveRaidModifiers(state, ctx)` and consumed by `raid.ts` (DC + hero mods) and `dungeon.ts` (`getFloorDC`). Import cycle check passed: `estate.ts`/`officers.ts`/`expedition.ts` do not import `raid.ts`/`dungeon.ts`.

**Status:** open

## Question / mapping to resolve while wiring

`ctx = { floorNum, isFirstRoom, hasMonsterOnFloor, heroClassKey }`. Resolver returns `{ firstRoomDcDelta, allFloorsDcDelta, floorDcDelta (ctx-specific), heroModDelta, prepIntelDelta, coreCaptureBonus, notes }`, merging:

1. **`crises.activeRaidMods`** (written estate.ts:1724-1763, expedition.ts:826-965; read nowhere today) — key map by phase:
   - raid roll: `first_dc` (±N first room), `trap_off` (lowest-DC trap room −2), `core_guard` (+0.2 core capture)
   - party gen (apply in `heroes.ts generateParty`, not the seam): `hero_up` (top grade +1), `hero_down` (top grade −1), `hero_injured` (one hero starts `injured`)
   - prep (workflow.ts intel site): `intel` (+N), `intel_zero` (0)
2. **`getEstateRaidModifiers`** (estate.ts:942-998, display-only today): `firstRoomDcDelta`, `allFloorsDcDelta`, `prepIntelDelta`, `guardDcBonus` (food≥60 → +1 on guarded floors), `coreCaptureBonus`, `leakedFloors` (lowest-DC occupied floors get −2 each), `ransomBonusMult` (wire into `calcPrisonerRansom`, debt.ts:100-110). Per-field triage, default wire: `critRoomSaveChance` has no crit mechanic — decide wire-as-ailment/injury-save or cut from `EstatePanel.tsx:113`; `buildCostMult` goes to ticket 18's cost paths; `servantMpHalved` already re-implemented (estate.ts:1026) — exclude.
3. **Lilim DC** `getNextRaidDcBonus` (officers.ts:677-689, UI-only today): firstRoom/firstDcOnce + allFloors/allDcNext under the same caps.
4. **Expedition aftereffects** `resolveExpeditionAftereffects` (expedition.ts:630-673, test-only today): ±2 clamped heroMod applied after `metaMods` (raid.ts:231).
5. **Mole minimal:** if an active mole exists (`moleRaidsLeft > 0`): hero mods −2 (mole intel, mirrors the `− h.intel` term at raid.ts:202) with audit note; decrement handled in ticket 16.

**Caps (locked):** total positive external DC delta ≤ +4/raid; firstRoom ≤ +3; allFloors ≤ +2; negative ≤ −4. Apply inside the resolver so no consumer can bypass them.

**Consumption sites:** `getFloorDC` (dungeon.ts:264-277, pattern exists at :274 shield relic), DC at raid.ts:113, hero mods stack raid.ts:195-241, core capture at the breach/partial branch (raid.ts:681-687).

## Acceptance Criteria

- [ ] `engine/raidMods.ts` pure resolver with caps enforced and unit-testable in isolation
- [ ] `getFloorDC` consumes allFloors/floor deltas; `resolveFloorEncounter` consumes firstRoom delta + heroModDelta + mole intel
- [ ] `heroes.ts generateParty` consumes `hero_up`/`hero_down`/`hero_injured`; prep intel site consumes `intel`/`intel_zero`/`prepIntelDelta`
- [ ] `calcPrisonerRansom` consumes `ransomBonusMult`; `critRoomSaveChance` wired or cut with rationale recorded
- [ ] Exact-margin tests: state with `first_dc: −2` → `res.dc === baseDc − 2` (extend `realmCrisesWarGrit.test.ts`); aftereffects ±2 visible in audit mods (extend past `expedition.test.ts:478`); caps table proven (stack 3 positive sources → delta pinned at +4)
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `cab9b35` (`balance(15): raidMods seam resolver with council caps`) merged to main (auto-merge clean, gate 142/142 + build green).

- New `engine/raidMods.ts`: pure `resolveRaidModifiers(state, ctx)` + `RaidModsResult` with audit `notes`; caps enforced inside — total ctx-gated [−4,+4], firstRoom [−4,+3], allFloors [−4,+2]; on breach the ctx bucket sheds first, then firstRoom, then allFloors.
- **Consumers:** `getFloorDC` (+external delta, trapped floors only, firstRoom bucket only in raid mode), `resolveFloorEncounter` (per-hero `raidMods.heroModDelta` after `metaMods`, audit note on alive[0]), core-capture roll at breach/partial `advanceRaidStep` (per-survivor, captures downgrade breach→partial→wipe only when they proc; baseline 0.05), `heroes.generateParty` (hero_up/down shift top grade clamped F..SSS; hero_injured marks top hero), `workflow.finishBuildPhase` (`prepIntelZero ? 0 : lens + prepIntelDelta`), `calcPrisonerRansom(state, p, mult?)` — optional `ransomBonusMult` param replaces inline renown block (numerics identical); estate dowry path passes `getEstateRaidModifiers().ransomBonusMult` explicitly (debt.ts can't import estate — cycle).
- **Decisions:** `critRoomSaveChance` WIRE as injury-save (first check in narrow-beat branch); `buildCostMult` DEFERRED to ticket 18; `servantMpHalved` excluded (re-implemented estate.ts:1026); `trap_off`/`leakedFloors` rank lowest-DC rooms/floors via a pure local mirror of getFloorDC base (raidMods must not import dungeon).
- EstatePanel needed no edit (renders `raidMods.notes` already).
- **Ticket 16 handoff:** `activeRaidMods` + `firstDcOnce`/`allDcNext` are now read but never purged/decremented — until 16 lands, a consumed crisis mod persists across waves.
- Indirect ESM cycles verified safe (function-level bindings only); core-capture uses Math.random but no existing test reaches that path unmocked.
