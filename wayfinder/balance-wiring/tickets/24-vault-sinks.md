---
summary: Turn the vault from a 25% income black hole into a usable war chest — draft-against-min-due and a sellsword contract sink
labels: [wayfinder:task]
status: closed *(2026-11-15 — vault draft sink + siphon kept 25% + sellsword contract (all_dc mod, one raid, caps-aware, purges at settlement))*
assignee: kevii/agent-w1-24 + kevii/agent-w2-24b
---

# 24: Vault Sinks (M7, Batch 3 PR)

**What to build:** The vault siphons 25% of (tax + baseIncome) per settle, cap 150×lv (estate.ts:1178-1183), with exactly one use — the 50 MP core rescue (endings.ts:532-538). At Town Lv7 up to 1050 MP strand forever. Council direction: sinks first, then consider trimming the siphon.

**Status:** open

## Acceptance Criteria

- [ ] **Draft against min-due:** debt visit action — pay part of `minDue` from vault MP at a 20% premium (Economist table), capped at 50% of min-due per visit (debt.ts:166-177 site)
- [ ] **Sellsword contract:** 100 MP from vault → +2 all-floor DC for exactly one raid, occupying a raid-mod slot (consumes/competes with `crises.activeRaidMods` via ticket 15's seam, capped by the ±4 budget) — wired at the debt-visit or estate action level, decided here
- [ ] Siphon trim decided and recorded (25% → 20% per Economist opening, or keep 25% now that sinks exist)
- [ ] UI: `EstatePanel`/`DebtPanel` show the new vault actions with premium/cap text
- [ ] Tests: `estateDebtOfficers.test.ts` — draft reduces debt at premium and moves vaultMp; sellsword grants one-raid DC then expires via ticket 16's settlement purge; `galleryEndings.test.ts` vault-rescue path (:532-553) unchanged
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15 (two passes)** — final gate 192/192 + build green; sellsword commit `cacc636` merged as `7ece28e`.

**Draft (pass 1, `0bfdcb1`):** 20% premium (`cost = ceil(relief × 1.2)`), capped 50% of minDue per visit, enforced as a FIRST-payment gate (`paidThisVisit === 0` — zero new state; rationale: `finishResultPhase` skips `startNewDay` on `skipDay`, so any `apUsed`-flag would leak across visits). Vault-only; relief routes through shared `applyDebtPayment` (extraLoan → principal), then `checkPayoffEnding`. Core-rescue coexistence proven by test (draft down to exactly 50 vault MP → Core Guard still armed).
**Siphon (recorded): KEPT 25%** — the draft already drains 72–216 MP per visit; trimming would loosen the economy; revisit only if the vault still strands at the 150×lv cap.
**Sellsword (pass 2, `cacc636`):** 100 MP from vault at the debt-visit level → appends `all_dc` (+2) to `state.crises.activeRaidMods`; the resolver's all-floors bucket sums it **inside ticket 15's caps** (bucket clamp [−4,+2], total gate [−4,+4]; contribution clamps at the bucket cap, not added on top); `all_dc` added to ticket 16's `CONSUMED_RAID_MOD_KEYS` so settlement purges it after exactly one raid — zero new lifecycle code. Slot exclusivity: purchase rejected while an `all_dc` entry is pending (one contract at a time, re-purchasable at the next visit); mode + vault gates; cash MP never touched. UI: sibling card under VAULT DRAFT in DebtPanel (pending state "Sellsword Under Contract (expires after this raid)") + sink-list mention in EstatePanel's ESTATE VAULT card.
**UI (pass 1):** DebtPanel "VAULT DRAFT" card (premium/cap/first-payment text, max-draft button); EstatePanel "ESTATE VAULT" card. `debt.ts` additions are file-tail appends (`draftDebtFromVault`, `hireSellswordContract`, info getters); no existing lines touched; `endings.ts` byte-identical.
**Tests:** draft premium/cap/edge cases, draft→Core Guard composition, sellsword purchase/mod/pending-block/cap-clamp/settle-expiry/re-purchase (7 tests).
