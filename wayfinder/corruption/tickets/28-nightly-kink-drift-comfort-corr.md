---
summary: Give prisoner corr its missing passive loop — nightly kink-matched floor drift and no-pure-recovery comfort jobs in the estate settle
labels: [wayfinder:task]
status: open
assignee: unclaimed
---

# 28: Corruption Seam III — Nightly Kink Drift + No-Pure-Recovery Settle

**What to build:** Audit ground truth: prisoner `corr` moves only via pact deltas — no passive loop, no raid-side feed beyond the seed, zero readers in endings. Ticket 27 fixed the seed; this ticket adds the nightly drift inside the EXISTING settle loop (no second loop — judge ruling "extend, don't add").

**Status:** open

## Spec

1. **`engine/estate.ts` `applyManagementSettle` (~1578-1640, inside the per-prisoner map):**
   - **Kink-floor drift:** if `KINK_TRAP_MAP[prisoner.kinkKey]` shares any type with an installed floor's slot types (`state.floors` — the dungeon the prisoner is held under): `corr +1`, `resist −1`. Rationale: living above the trap that embodies your kink erodes you.
   - **Comfort jobs nudge corr:** job keys in a new `COMFORT_JOBS` set (spa-facing/comfort-adjacent entries among the 24 `CFG.JOBS` — pick conservatively, list them in the ticket resolution) add `corr +1` — DoL rule: recovery IS corruption; no action reduces resist without a corr tick.
2. **Ratchet floor enforcement point:** `corr = max(corr, corr < CORR_RATCHET_FLOOR ? corr : CORR_RATCHET_FLOOR)` — no-op until ticket 31 introduces paths that could lower a Hollowed prisoner; land the clamp site now with an invariant test.
3. **`components/EstatePanel.tsx`:** no new UI; the settle journal line may append `+corr (kink floor)` when the drift fires (follow ticket 23's ledger-truth precedent).
4. **No changes** to `prisonerDelta` job yields, trusty/tortdemo auras, or risk rolls — drift is additive and bounded (+1/day each source, both sources max +2 corr/day).

## Acceptance Criteria

- [ ] Drift fires only when kinkKey + floor types actually intersect; zero-drift proven for kink-less/legacy prisoners
- [ ] Drift determinism table test (floor types × kinkKey → exact corr/resist deltas after N nights)
- [ ] Comfort-job corr tick proven; non-comfort jobs unchanged (job yield parity test from ticket 23 stays green)
- [ ] Corr never exceeds 100; ratchet clamp site proven by direct unit test
- [ ] 192+ existing tests green; `vitest run` + `tsc -b && vite build` green
