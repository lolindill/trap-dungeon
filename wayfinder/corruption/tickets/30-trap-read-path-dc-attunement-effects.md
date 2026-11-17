---
summary: Wire the slot ledger into floor DC and the raid ladder — effectiveGrade wear softening, attunement read effects, repair action, prompt status word
labels: [wayfinder:task]
status: open
blocked-by: [29-trap-lifecycle-write-path](29-trap-lifecycle-write-path.md), [27-capture-seed-formula-corr-tiers-labels](27-capture-seed-formula-corr-tiers-labels.md)
assignee: unclaimed
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
