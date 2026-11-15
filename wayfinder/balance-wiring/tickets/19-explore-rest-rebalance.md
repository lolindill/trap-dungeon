---
summary: Break the explore-dominates-rest arbitrage — diminishing quiet-stroll payout and honest event EV with real negative branches
labels: [wayfinder:task]
status: closed *(2026-11-15 — stroll decayed to max(3,8−2n), wager EV ≈+6 with real negative branches, +15 cap)*
assignee: kevii/agent-w1-19
---

# 19: Explore vs Rest Rebalance (M1, Batch 3 PR)

**What to build:** Close the AP arbitrage. Today quiet stroll pays a guaranteed +10 MP (estate.ts:672-702) — exactly the rest rate (dayLoop.ts:123-126) — while every explore event has EV ≥ +10 with no downside, so all-AP-explore is strictly optimal.

**Status:** open

## Acceptance Criteria

- [ ] Quiet stroll payout: flat +10 → `max(3, 8 − 2 × exploreCountToday)` (+8/+6/+4/+3…) — rest becomes the floor, not a tie (Economist table)
- [ ] Event EV audit: reweight wager-type branches to EV ≈ +6 and cap any single event payout at +15 MP; add real negative branches costing food/approval (at least one per gamble location) — exact numbers decided and recorded here
- [ ] Free +MP event choices (+6..+12 no-cost lines, estateData.ts:640,654,677,703,723,737,799,845,860) reviewed: each either keeps its stat as the cost or drops ~2-4 MP
- [ ] Explore intel effect (estate.ts:774-785) no longer wasted on repeat purchase — either stack or re-price
- [ ] Tests: `estateDebtOfficers.test.ts` explore block (:170-202) extended — stroll decay curve, event payout cap, negative branch firing
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `912a24e` (`balance(19): explore vs rest rebalance`) merged to main (merge `2589e6c`); full suite 116/116 + build green.

**Final numbers (recorded per ticket):**
- **Stroll decay:** `max(3, 8 − 2 × exploreCountToday)` → +8/+6/+4/+3 floor; rest (10 MP) is now the strict floor at every explore count. `exploreCountToday` pre-existed and already resets in `startNewDay` (dayLoop.ts:283).
- **Wager EV rework** (all successes at the +15 cap): sq_peddler Haggle +15 MP / fail approval −4 (EV ≈ +6, −2 approval); inn_brawl +15 MP / fail mp −3 approval −3 (EV +6); smi_proto Field Test +15 MP / fail mp −3 food −5 (EV +6, −2.5 food); off_ledger debtCut 30→12 (EV +6 MP-eq); spy_report fail branch now `{}` (was a free +3 MP faucet).
- **Hard cap:** new `EVENT_MP_PAYOUT_CAP = 15` in estate.ts, clamped in `applyExploreEffectSpec` — guards future data; new `food?: number` effect field added.
- **Free +MP lines:** mkt_bidder 6→4, mkt_broker 12→8, bro_vip 10→7, smi_proto scrap 10→7, shr_tithe 8→5, man_tea 8→5; order/approval-costed lines kept as-is (already priced); sq_festival 5 and off_errand 5+affE kept.
- **Intel repeat purchase: STACK** — first grant sets `prepIntelOnce`; repeats add to stackable `maxIntelBonus` perk instead of voiding (rationale: boolean can't stack, `maxIntelBonus` already stacks elsewhere, zero type churn).

**Tests:** estateDebtOfficers.test.ts explore block extended (18 tests total: decay curve, cap, negative branch, rest-floor invariant). Notes: `sellBestMult` 1.25× auction-asset sale intentionally uncapped (asset sale, not AP faucet — flag for council if a cap is wanted later).
