---
summary: Build the hero-side corrFeed ledger and carry hero identity (kink/persona/skill) through the capture boundary into Prisoner
labels: [wayfinder:task]
status: closed *(2026-11-17 — corrFeed ledger + capture identity carry shipped; matchedKink left as settlement local for ticket 27; 247/247 green post-merge)*
assignee: kevii/agent-w1-26
---

# 26: Corruption Seam I — Hero `corrFeed` Ledger + Capture Identity Carry

**What to build:** Close the two halves of the capture-boundary audit finding: the raid never contributes to prisoner state, and `applyWaveSettlement` (raid.ts:799-840) drops `kinkKey/classKey/raceKey/persona/skill/weakness` when building the `Prisoner`. Ship the hero-side ledger (`corrFeed`) and the identity carry — the seam every later corruption ticket writes into.

**Status:** open

## Spec

1. **`types/game.ts` — Hero:** optional `corrFeed?: number` (0..~40, count of ero-slot beats absorbed this raid). Same reset pattern as the locked Phase 5 flags: cleared at the settlement resolution point (`applyWaveSettlement`, the ticket-16 block) — NOT at hero creation. Absent = 0 (legacy-safe).
2. **`types/game.ts` — Prisoner:** optional `kinkKey?: string`, `kinkDesc?: string`, `persona?: string`, `skill?: string`, `weakness?: string`. No schemaVersion bump — optional-fields-only pattern, identical to Phase 5's `staggered` ruling; legacy saves stay valid.
3. **`engine/raid.ts` room loop:** accumulate `corrFeed +1` on every beat resolved inside an ero-type slot (`TRAP_ERO_TYPES`, Phase 5 F1) — pass AND fail. Kink-matched faced slot (F1 selection already knows this) still counts once. This is the ONLY writer.
4. **`engine/raid.ts` `applyWaveSettlement` (~799-840):** copy `hero.kinkKey`, `kinkDesc`, `persona`, `skill`, `weakness` into the new prisoner literal; compute `matchedKink = KINK_TRAP_MAP[hero.kinkKey]?.some(t => facedSlotTypes.includes(t)) ?? false` — store nothing yet (consumed by ticket 27's seed formula); reset `corrFeed` at the settlement resolution point for ALL heroes (captured, retreated, staggered-converted) exactly like `usedStagger`.
5. **`llm/promptBuilder.ts` `summarizeHeroLine` (38-57):** no change this ticket (corrFeed is not narrated raw; tier words come in ticket 27).

## Acceptance Criteria

- [ ] `corrFeed` accumulates exactly once per ero-slot beat (pass and fail), never on standard-slot beats
- [ ] Captured prisoner carries kinkKey/persona/skill/weakness (assert in settlement test)
- [ ] `corrFeed` reset proven for captured + retreated + staggered-converted heroes
- [ ] Legacy save without the new fields loads and plays (extend `migrationAndSlots.test.ts` load test)
- [ ] Phase 5's all-staggered-≠-wipe and ero-never-dead proofs stay green
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-17** — commit `304d946` on `wayfinder/corr-26`, fast-forwarded to main, then carried clean through the auto-merge with ticket 29; combined main = **247/247 green + `tsc -b && vite build` green**.

- **corrFeed writer:** room loop, immediately after `decideBeat()` when the beat is ero-gated (`TRAP_ERO_TYPES`) — `+1` on pass AND fail; kink-matched faced slot counts once; the field's only writer.
- **Identity carry:** `applyWaveSettlement` copies `kinkKey/kinkDesc/persona/skill/weakness` into the prisoner literal; `matchedKink` computed per spec formula (`KINK_TRAP_MAP[hero.kinkKey]?.some(t => facedSlotTypes.includes(t))`) as a LOCAL only — nothing stored (ticket 27 consumes).
- **Reset:** corrFeed cleared at the ticket-16 settlement resolution point for ALL heroes (captured / retreated / staggered-converted), placed after the prisoner build so ticket 27 can read the raid's corrFeed inside the same settlement.
- **Deviations (2):** (1) `void matchedKink` placeholder — `noUnusedLocals: true` fails the build on an unconsumed local; local kept + voided with a pointer comment until ticket 27 consumes it. (2) `facedSlotTypes` at settlement derives from the capture floor's slot types (`h.fallenFloor ?? state.floorCursor`) — spec left the source open; ticket 27 may adjust when wiring the seed.
- **Tests:** `corruptionSeam.test.ts` (9: once-per-ero-beat pass/fail, never on standard slots, kink-matched once, cross-room accumulation, prisoner carries all 5 identity fields, no `matchedKink` field stored, reset proven for all 3 hero fates incl. advanceRaidStep e2e) + legacy-load test in `migrationAndSlots.test.ts` (save without the new fields loads and beats).
