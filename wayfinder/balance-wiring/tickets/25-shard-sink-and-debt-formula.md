---
summary: Give surplus relic shards a sink, rescale the debt min-due to track income, soften the late cliff, and grant handover affinity
labels: [wayfinder:task]
status: closed *(2026-11-15 — 3 shards→1 state.parts sink; minDue tracks trailingIncome ×15%; late strike ×1.05+60; handover +3 Eleonora)*
assignee: kevii/agent-w1-25
---

# 25: Shard Sink + Debt Formula (M10 + M11, Batch 3 PR)

**What to build:** Two endgame dead-ends: (a) relic shards convert silently to nothing once all 4 relics are owned (expedition.ts:613-618 `pool.length === 0 → break`); (b) the debt min-due schedule caps at 360 (debt.ts:16) so late-game installments are trivial while one early late strike = principal ×1.1 + `extCarry` wipe (debt.ts:814-825). Note: the shard sink must be a **sink**, not a new faucet (Designer's catch on the Economist's "5 MP each").

**Status:** open

## Acceptance Criteria

- [ ] **Shard sink:** with all relics owned, shards convert into a durable resource — e.g. 3 shards → 1 trap-part into ticket 21's central pool, or a rare codex/trap-grade boon; the "5 MP faucet" variant is rejected unless priced into the upkeep cap; final choice recorded here
- [ ] **Debt formula:** `minDue = max(DEBT_MIN_SCHEDULE[step], ceil(0.15 × avg net MP of last 3 settles))` (Economist opening) — `estate.trailingIncome` (estate.ts ledger) is the data source; verify it exists per-save and migrate if absent
- [ ] **Late cliff softening:** principal ×1.1 → ×1.05 + flat 60 MP, keeping the `extCarry` wipe and seizure (debt.ts:814-825); Patience deltas unchanged
- [ ] **Handover affinity:** granting handover +3 Eleonora affinity (it currently grants none — debt.ts:375-427), or recording why not
- [ ] Ext-loan terms sanity: 3%/wave interest and 10% min repayment stay (already live, debt.ts tests :301-438)
- [ ] Tests: `estateDebtOfficers.test.ts` debt blocks — min-due tracks trailing income; late strike applies ×1.05+60; shard overflow converts via the chosen sink; `galleryEndings.test.ts` bankruptcy path still reachable (3 lates)
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `4d09ce6` (`balance(25): shard sink + debt formula rescale`) merged to main (auto-merge clean with ticket 15's debt.ts changes; gate 146/146 + build green).

- **Shard sink (recorded): 3 shards → 1 `state.parts`** via `convertRelicShards` overflow loop → `overflowParts`, folded into finalize (`nextParts = state.parts + partsStored + overflowParts`). Parts are NEVER auto-monetized (3×8 MP cap applies only to the expedition loot bag path). Relic unlock takes priority over smelting (mixed case unlocks 4th relic first). Red line held: sink not faucet.
- **Debt formula:** `baseMin = max(DEBT_MIN_SCHEDULE[step], ceil(0.15 × avg trailingIncome))` — **`estate.trailingIncome` already existed** (written per settle at estate.ts ~:1583, initialized/migrated in saveLoad.ts — no migration needed). Applied BEFORE extCarry/minCut/entCut so all interactions preserved. Exposed as additive `incomeMin` on `DebtSummary`; DebtPanel min-due row shows `· Income floor N`.
- **Late cliff:** `floor(amount × 1.05) + 60` (was ×1.1); `extCarry: 0` wipe, Patience −30, seizure, 3-late bankruptcy all unchanged; bankruptcy path verified still reachable.
- **Handover affinity: granted** — `handoverPrisonerForDebt` grants +3 Eleonora via `grantOfficerAffinity`, message updated.
- Ext-loan terms untouched (3%/wave, 10% min). New consts `DEBT_INCOME_MIN_PCT = 0.15`, `DEBT_LATE_FLAT_MP = 60`.
- Notes: central-pool parts have no sell path (pure sink); DebtSummary `incomeMin` is additive for future UI.
