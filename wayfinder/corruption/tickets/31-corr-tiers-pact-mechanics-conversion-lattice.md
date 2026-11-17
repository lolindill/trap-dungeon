---
summary: Make CORR_TIERS mechanical — kinkFamily pacts with tier die/resist bonuses, conversion corr clauses + ratchet, predicted deltas on pact buttons
labels: [wayfinder:task]
status: open
blocked-by: [27-capture-seed-formula-corr-tiers-labels](27-capture-seed-formula-corr-tiers-labels.md), [28-nightly-kink-drift-comfort-corr](28-nightly-kink-drift-comfort-corr.md)
assignee: unclaimed
---

# 31: Trainer Depth — `CORR_TIERS` Pact Mechanics + Conversion Lattice

**What to build:** Stage 3 lattice (judge ruling: CoC AND-gates + KP targetability, prison-only). Tiers stop being labels: kink-matched pacts and conversions read them. The 24 kinks become an economy on the persistent layer.

**Status:** open

## Spec

1. **`data/prisonData.ts`:** pact definitions gain optional `kinkFamily?: string[]` (tag family keys intersecting `KINK_TRAP_MAP` vocabulary); conversions (`PRISON_CONVERSIONS` 1131-1171) gain optional corr clauses.
2. **`engine/prison.ts` `resolvePact`:** kink-match rule — prisoner's `kinkKey` (carried since ticket 26) maps via `KINK_TRAP_MAP` to a family the pact lists → tier bonus applies:
   | Tier | Effect (kink-matched pacts only) |
   |---|---|
   | Wavering 25-49 | harsh die +2, resist ×0.9 |
   | Complicit 50-69 | die +4, resist ×0.8; nightly corr drift +1 (joins ticket 28's loop); brothel/dairy yield ×1.25 |
   | Devoted 70-84 | pact effect +50%; ransom buyer premium ×1.5 |
   | Hollowed 85-100 | all kinkFamily reqs waived; **ratchet locks at 85** (corr can never drop below — enforced at every corr write) |
   Non-matched pacts: baseline, no tier bonus (Resistant = full resist).
3. **Conversion lattice:** `canConvertPrisoner` (prison.ts:1341-1398) gains corr AND-clauses — servant alt-route `corr≥60 AND pleasure3+obey2`; hired stays `obey3 or corr≥80`; ratchet check before any conversion that would lower corr. Existing gates unchanged.
4. **Predicted deltas (pattern 7, UI-only):** `components/PrisonPanel.tsx` pact buttons render the exact stat deltas the resolve will apply (the `pact.effects` math already exists — surface it, including tier bonus line `Kink match: +4 die`), SlaveMaker legibility precedent.
5. **Ratchet enforcement:** every corr write site (pact deltas, ticket 28 drift, buyer/purchase paths) funnels through one small `applyCorrDelta(prisoner, delta)` helper so the 85 floor is enforced in exactly one place.

## Acceptance Criteria

- [ ] Tier × kink-match pact matrix table test (5 tiers × matched/unmatched → exact die/resist/yield/premium)
- [ ] Conversion gate matrix: new corr clauses proven on/off at boundaries (59/60, 79/80); existing 5 conversions' old gates unchanged for kink-less prisoners
- [ ] Ratchet invariant: no sequence of writes can put a Hollowed prisoner below 85 (property-style test over the helper)
- [ ] Predicted deltas match actual resolution byte-for-byte on a sampled pact set (parity test like ticket 23's)
- [ ] `vitest run` + `tsc -b && vite build` green
