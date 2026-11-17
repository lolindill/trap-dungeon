---
summary: Give prisoner corr its missing passive loop — nightly kink-matched floor drift and no-pure-recovery comfort jobs in the estate settle
labels: [wayfinder:task]
status: closed *(2026-11-17 — nightly kink-floor drift (corr+1/resist−1) + COMFORT_JOBS [bath,tavern] corr tick + ratchet clamp site landed in the existing settle loop; 272/272 green post-merge)*
blocked-by: [27-capture-seed-formula-corr-tiers-labels](27-capture-seed-formula-corr-tiers-labels.md)
assignee: kevii/agent-w2-28
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

## Resolution

**RESOLVED 2026-11-17** — commit `2dcc32c` on `wayfinder/corr-28`, merged to main (dedupe `351bcff`); main = **272/272 green + build green**.

- **Drift:** inside `applyManagementSettle`'s existing per-prisoner map only (no second loop) — `installedTrapTypes` Set precomputed from `state.floors` once; kink-floor drift `corr +1 / resist −1` fires when `KINK_TRAP_MAP[p.kinkKey]` intersects the installed types; kink-less/legacy prisoners drift zero.
- **Comfort jobs:** `COMFORT_JOBS = ['bath', 'tavern']` — bath (Bathhouse Attendant, the only true spa-facing job: pleasure +3, no corr) + tavern (Tavern Server, hospitality: pleasure +4, no corr). Jobs already carrying corr in prisonerDelta (brothel/manor/toilet/barracks/lure/trusty/breeder) deliberately excluded (no double-dipping); dairy/tasting/model are extraction/humiliation, not comfort.
- **Ratchet clamp site:** spec formula landed in the same settle map — no-op today, guards ticket 31's lowering paths; invariant-tested.
- **Ledger:** row `Nightly Kink-Floor Drift → +corr (kink floor) ×N` on both return sites, following ticket 23's `jobRiskNotes` precedent (applied ledger only, not preview).
- **Deviations (2):** (1) drift does NOT filter slot `status` — spent/disarmed slots still count as installed (spec said "installed floors' slot types" literally); one-line fix in the `installedTrapTypes` loop if the judge wants disarmed slots to stop biting corr. (2) `EstatePanel.tsx` untouched — the drift row flows through the existing M.SETTLE DETERMINISTIC LEDGER lines, satisfying "no new UI".
- **Tests:** `estateKinkDrift.test.ts` (19: drift gate, determinism table floor×kink, comfort tick, cap-100 + ratchet invariant sweep); ticket 23 job-yield parity stays green.
