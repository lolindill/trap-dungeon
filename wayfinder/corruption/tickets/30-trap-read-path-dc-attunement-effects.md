---
summary: Wire the slot ledger into floor DC and the raid ladder — effectiveGrade wear softening, attunement read effects, repair action, prompt status word
labels: [wayfinder:task]
status: closed *(2026-11-17 — read path live: effectiveGrade wear softening, attunement ≥50/≥85 effects with max-weight selection, Repair All (1 AP + 3 MP/slot), prep-intel disarm, prompt status words; 320/320 green post-merge)*
blocked-by: [29-trap-lifecycle-write-path](29-trap-lifecycle-write-path.md), [27-capture-seed-formula-corr-tiers-labels](27-capture-seed-formula-corr-tiers-labels.md)
assignee: kevii/agent-w3-30
---

# 30: Trap Lifecycle II — Read Path: DC Softening, Attunement Effects, Repair

**What to build:** The read half of the slot ledger (pairs ticket 29). Wear softens a floor *during* the raid that abuses it; attunement turns veteran traps into kink-specialized defense assets; players get a repair lever in the Day loop.

**Status:** open

## Spec

1. **Pure `engine/dungeon.ts` `effectiveGrade(slot)`:** `grade − 1` while `wear ≥ TRAP_WEAR.SOFT_GRADE`; `getFloorDC` (266-283) and raid's `highTrapIdx`/`floorTypes` consumers (raid.ts:142-146) read through it. `status: 'spent'` (wear reaching SPENT, set by ticket 29 rules) → slot contributes 0 bonus and is skipped by faced-selection + synergy counts.
2. **Attunement read effects (raid.ts):**
   - `attunement ≥ TIER (50)`: hero whose `kinkKey` matches the slot's types (F1 mapping) takes `mods −1` facing it — KP targetability, defense-side; audit note.
   - `attunement ≥ ASCENDANT (85)`: floor DC `+1` and heroes passing through the slot gain `corrFeed +1` even on pass (DoL exposure loop, dungeon-side).
   - F1 faced-selection weight: `attunedKink === hero.kinkKey` → weight ×2 (rule: `max(kinkWeight, attunedWeight)` — never multiplicative stacking).
3. **Capture seed extension (ticket 27's formula):** `+ (facedSlot.attunement ≥ 50 ? 10 : 0)`; `matchedKink` broadens to `matchedKink || facedSlot.attunedKink === hero.kinkKey`. Max seed unchanged (clamp 45).
4. **Day loop repair (`engine/dayLoop.ts` + `EstatePanel`/`FloorBoard` affordance):** `Repair All` — one AP, cost `3 MP × wornOrSpentSlotCount` (price recorded in resolution; adjustable in balance pass), sets `wear → 0`, `spent → armed` on all slots. Settlement decay from ticket 29 stays the free baseline.
5. **`llm/promptBuilder.ts`:** slot line gains ONE status word when non-default — `worn / spent / disarmed / attuned` (+attunedKink label) — tier-word ruling: no raw ints.
6. **Prep-intel disarm action (workflow.ts prep site):** spend 1 intel slot → mark the highest-grade slot of the scouted floor `disarmed` for the coming raid (mirrors disarmer-trait counterplay; audit note).

## Acceptance Criteria

- [ ] `effectiveGrade` boundaries exact (59/60 wear, spent) — DC regression test: a 2-slot floor with one softened B → DC drops exactly `TRAP_BONUS[B] − TRAP_BONUS[C]`
- [ ] Attunement ≥50/≥85 effect table proven (mods −1, corrFeed pass-through, +1 DC); attunedKink selection weight `max` rule proven (no ×2×2 stacking)
- [ ] Capture seed extension: attunement-50 capture +10 proven; clamp 45 still holds
- [ ] Repair All: AP/MP accounting exact; no-op when nothing worn; settlement decay still applies
- [ ] Prompt slot line shows status word only when non-default (no diff on clean slots)
- [ ] `vitest run` + `tsc -b && vite build` green; Phase 5 ladder gate matrix stays green

## Resolution

**RESOLVED 2026-11-17** — commit `5a43479` on `wayfinder/corr-30`, merged clean into main; combined main = **320/320 green + build green**. One-commit red line satisfied: ticket 29 (write) + 30 (read) landed as a pair.

- **Read path:** pure `effectiveGrade(slot)` in dungeon.ts — spent/disarmed → 0 bonus (encoded `'?'`), `wear ≥ 60` → grade −1 (grade D held at D when no lower grade exists); `getFloorDC` reads through it (trapSum + synergy gate count active slots only) plus the ascendant +1 DC.
- **Attunement effects (raid.ts):** ≥TIER(50) kink-matched hero → `mods −1` (audit note `attuned trap targets <kink> kink (mods −1)`); ≥ASCENDANT(85) → corrFeed `+1` even on pass (second corrFeed writer — the ticket-26 ero-beat writer intact; ero-slot ascendant = +2); faced-selection uses `max(kinkWeight, attunedWeight)` — no ×2×2 stacking; `highTrapIdx`/`floorTypes` read through effectiveGrade (spent = aura off).
- **Capture seed extension:** `+10` when faced slot attunement ≥ 50; `matchedKink || facedSlot.attunedKink === hero.kinkKey`; clamp 45 unchanged — via new `Hero.facedSlotIdx` plumbing (deleted at the settlement resolution point).
- **Repair All:** dayLoop `repairAllTraps` / `getRepairAllCost` / `countWornOrSpentSlots`, `REPAIR_MP_PER_SLOT = 3` — **1 AP + 3 MP × wornOrSpentSlotCount** (wear > 0 or spent/disarmed; recorded as first-pass pricing for the balance pass); zero-cost no-op when nothing worn; clean slots untouched (identity preserved); ticket 29's −30/wave settlement decay stays the free baseline. UI: EstatePanel DUNGEON MAINTENANCE card.
- **Prep-intel disarm:** `prepIntelDisarm` in workflow.ts consumes **1 hero intel point** (first hero with intel ≥ 1 — "intel slot" per the existing hero-held-intel pattern) → marks the highest-grade ACTIVE slot of the scouted entry floor (`getNextTrapFloor`) `disarmed`, once per prep via `PrepMetadata.intelDisarmDone` (fog item resolved at wiring). UI: PrepPanel + App button.
- **Prompts:** `slotStatusWord` (spent > disarmed > worn > attuned + kink label, no raw ints) inserted in the slot line only when non-default.
- **Deviations (2):** (1) ascendant +1 DC / attunement aura gated on ACTIVE slots only — spent/disarmed slots radiate nothing (consistent with "spent contributes 0"; rule table-tested). (2) `floorTrapPower` mirror in raidMods.ts updated inline to match getFloorDC (the seam forbids importing dungeon.ts; leaving the mirror stale would diverge crisis targeting).
- **Tests:** `trapReadPath.test.ts` (25: effectiveGrade boundaries 59/60 + spent, exact DC regression `TRAP_BONUS[B] − TRAP_BONUS[C]`, attunement effect table, max-weight rule, seed +10/clamp-45, repair AP/MP accounting + no-op + decay, prompt non-default diff, prep disarm) — Phase 5 ladder matrix (17) green.
