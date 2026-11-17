---
summary: Make CORR_TIERS mechanical — kinkFamily pacts with tier die/resist bonuses, conversion corr clauses + ratchet, predicted deltas on pact buttons
labels: [wayfinder:task]
status: closed *(2026-11-17 — tiers mechanical: kinkFamily pacts with tier die/resist/yield/premium table, conversion corr AND-clauses, applyCorrDelta single ratchet point, predicted deltas on pact buttons; 320/320 green post-merge)*
blocked-by: [27-capture-seed-formula-corr-tiers-labels](27-capture-seed-formula-corr-tiers-labels.md), [28-nightly-kink-drift-comfort-corr](28-nightly-kink-drift-comfort-corr.md)
assignee: kevii/agent-w3-31
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

## Resolution

**RESOLVED 2026-11-17** — commit `992eb11` on `wayfinder/corr-31`, merged clean into main; combined main = **320/320 green + build green**.

- **Data:** `PrisonPactDef.kinkFamily?: string[]` (33 pacts assigned), `PrisonConversionDef.corrReq?` (servant min 70 / alt-route 60 + pleasure3 + obey2, reqSummary updated), `JOB_KINK_FAMILIES` (brothel/dairy). Vocabulary = the 22 `KINK_TRAP_MAP` keys; `feet`/`vampire` have no pact home, `toys`/`scent` unmapped by design.
- **Tier mechanics (prison.ts):** kink-family match = shared trap type via `KINK_TRAP_MAP`; `TIER_PACT_BONUS` + `getCorrTierPactBonus` power Wavering (harsh die +2, resist ×0.9) / Complicit (die +4, resist ×0.8, nightly drift +1, brothel+dairy yield ×1.25) / Devoted (effect +50%, ransom premium ×1.5); die bonus wired in `getHarshDeathChance`; premium in `calculateRansom`; yields in `getJobSettleYield` (+ preview line). Shared `computePactStatEffects` powers both execution and exported `predictPactDeltas`.
- **Conversion lattice:** servant corr AND-clause live; hired stays `obey3 or corr ≥ 80`; old gates unchanged for kink-less prisoners.
- **Single ratchet point:** `applyCorrDelta` lives in `engine/tiers.ts` (dependency-light: constants + `Pick<Prisoner,'corr'>`; pure) — absorbs ticket 28's estate clamp site and funnels pact deltas, ptort masochist +10, conversion writes, drift, and the `prisCorr` crisis write. The Hollowed 85 floor is now enforced in exactly one place.
- **UI:** PrisonPanel pact buttons render `Predicted: <deltas> · Kink match: …` from `predictPactDeltas` (same math as execution; pduo passes the picked officer).
- **Interpretation decisions (5, flagged in code comments):** (1) Hollowed = Devoted numeric treatment + reqs waiver — literal-minimal would make Hollowed train WEAKER than Devoted; the killer-spec reads as additive tiers. (2) `resist ×0.9/×0.8` = post-pact multiplier on the resulting resist stat when the pact carried a resist effect (suppressed when it rounds to no change). (3) "pact effect +50%" multiplies positive deltas only. (4) Premium gated on Devoted/Hollowed + a mapped kinkKey. (5) Conversion ratchet check = conversion write funnels `applyCorrDelta(·, 0)` — floor-safe for any future corr clause.
- **Tests:** `corrPacts.test.ts` (23: 5×2 tier matrix exact, conversion gates at 59/60 + 79/80, ratchet property sweep, predicted-delta parity byte-for-byte across 4 tier/kink configs under mocked RNG — sample excludes pint/ptort whose resist deltas are random resolve-time branches); estateKinkDrift invariant sweep updated to Complicit +3/night (ticket 31's own mechanic).
- **Scrutinize addendum (2026-11-18):** two runtime corr writes bypassed this funnel — interrogate (`dayLoop.ts:685`) and beast-pen breeding (`monsters.ts:636`), both `clamp(corr + 5)` — behavior-identical today (positive deltas) but now funneled through `applyCorrDelta` so the "ONE corr write funnel" claim holds literally; suite green after.
