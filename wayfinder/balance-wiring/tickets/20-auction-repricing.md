---
summary: End the Slave Market auction's zero-risk dominance of the four risk-band buyers — reprice to EV below the buyer system
labels: [wayfinder:task]
status: closed *(2026-11-15 — auction EV 0.815× gross (10% fizzle 0.5×, 10 MP fee) below buyer 0.872; fizzle band live via getSaleRiskOdds)*
assignee: kevii/agent-w1-20
---

# 20: Auction Repricing (M4, Batch 3 PR)

**What to build:** The auction pays `ransom × 1.1` with zero risk (prison.ts:1884-1911) versus buyer EV ≈ 0.872 through the risk bands (prison.ts:1736-1739) — one facility purchase makes the entire 4-buyer system, `pdress` (+20% next sale) and buyer-targeting pointless.

**Status:** open

## Acceptance Criteria

- [ ] Reprice to make buyers competitive again — Economist opening numbers as the starting bid: `floor(base × 0.85)`, 10% "bidding fizzles" paying 0.5×, 10 MP listing fee waived at Market Lv3 → EV ≈ 0.81 vs buyer 0.872; hot-buyer day bumps the *best buyer* to ×1.3 so buyers keep a niche. Alternatives considered and the final table recorded here
- [ ] Risk system stays live: auction no longer bypasses `getSaleRiskOdds` entirely — decide which risk band (if any) applies at auction and record it
- [ ] `pdress` (+20% next sale, prison.ts:655-657) and buyer-targeting pacts regain a purpose (assert in test that dress bonus applies to at least the buyer path)
- [ ] Tests: `prison.test.ts` auction block (:1869-1942) — new EV table, fizzle branch, listing fee
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `2060c83` (`balance(20): auction repricing`) merged to main (merge `6cee41e`); full suite 119/119 + build green.

**Final table (recorded per ticket):**
- Clean sale `floor(ransom × 0.85)`; **10% "bidding fizzle" pays `floor(ransom × 0.5)`**; **10 MP listing fee waived at Market Lv3 OR Eleonora S.3** (wires the dead `auctionFeeZero` perk flag — tooltips already promised it); net floor `max(1, gross − fee)`.
- Resulting EV `0.9×0.85 + 0.1×0.5 = 0.815×` gross < buyer 0.872 — auction never dominates; hot-buyer ×1.3 keeps the best-buyer niche (test asserts EV_auction < EV_best-buyer across all 4 hot rotations).
- **Risk band (recorded):** auction gets ONE band — `fizzle = clamp(getSaleRiskOdds().stiff + 0.03, 0.02, 0.10)` → baseline 0.10; order ≥70 / Vesper S.3-S.4 halve stiff → 0.065. Escape/cut/bonus bands deliberately don't apply (public auction can't have wagon escape); market level doesn't touch fizzle.
- **pdress (recorded):** `Dressed ×1.20` prices BOTH buyer path and auction (shared `calculateRansom`) + debt collateral; no reset needed (prisoner removed on sale = "next sale" holds). Asserted exact value 73 (dress + Shame-mark ×1.08 stack).
- New exported `getAuctionTerms(state, p)` + `AUCTION_*` consts; `auctionPrisoner` rewritten; PrisonPanel Fate sub-tab shows live terms. `sellPrisoner`/`calculateRansom`/job-preview untouched.
