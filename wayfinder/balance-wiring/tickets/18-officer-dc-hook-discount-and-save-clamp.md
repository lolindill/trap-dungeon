---
summary: Wire Lilim DC hook into getFloorDC, trap-upgrade discount into the cost paths, prep intel getters, and clamp legacy saves with unbounded aftereffect stacks
labels: [wayfinder:task]
status: closed *(2026-11-15 — Lilim DC path verified (zero fixes needed), prepIntel gap fixed in resolver, discount + buildCostMult wired floor-rounded, aftereffects clamp on load)*
assignee: kevii/agent-w2-18
blocked-by: [15-seam-raid-modifiers-resolver](15-seam-raid-modifiers-resolver.md)
---

# 18: Lilim Hook + Discount Wiring + Legacy-Save Clamp (Batch 2)

**What to build:** The officer-side half of the wiring, on the seam from ticket 15: Lilim's stage perks finally charge and protect what their UI promises, and live saves with unbounded aftereffect stacks get clamped on load.

**Blocked by:** [15-seam-raid-modifiers-resolver](15-seam-raid-modifiers-resolver.md)

**Status:** open

## Acceptance Criteria

- [ ] **DC hook:** `getFloorDC` (dungeon.ts:264-277) consumes Lilim `allFloorsDcBonus` after the shield term (:274) and the first-room variant via the `firstRoom`/`firstDcOnce` path — inside ticket 15's caps budget, not on top of it
- [ ] **Discount:** `upgradeTrapOnFloor` (dungeon.ts:521-559; `state` already in scope at :521) charges `getUpgradeCost × getTrapUpgradeDiscountMultiplier(state)` (officers.ts:628-633) — same multiplier also applied to install cost paths if `buildCostMult` (order/housing, estate.ts:973-975) is triaged in; round consistently and update the flash text
- [ ] **Prep intel:** `getPrepIntelLeakBonus` (officers.ts:655-675) + `prepIntelDelta` + `intel`/`intel_zero` mods consumed at the single prep-intel site (workflow.ts, Lens relic pattern at workflow.ts:62-65)
- [ ] **Legacy save clamp** (Economist's migration contract): `migrateGameState` clamps `expedition.afterEffects` stacks (cap 3 active, `wavesLeft` ≤ 3) — `saveLoad.ts:829-830` already normalizes `activeRaidMods`, same block
- [ ] Tests: extend `engine.test.ts:114-118` DC test — state with `perks.firstDcOnce` → +1 floor-1-only; `estateDebtOfficers.test.ts` — upgrade discount applies with Lilim S1; `migrationAndSlots.test.ts` — legacy save with 8 stacked aftereffects clamps to 3 on load
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `0f2cebd` (`balance(18): Lilim DC verification, upgrade discount, prep intel, legacy-save clamp`) merged to main (two test-file EOF conflicts resolved; merge `581917b`, gate 185/185 + build green).

- **DC hook: ticket 15's seam verified CORRECT — zero code changes needed.** Lilim merges inside the resolver with caps enforced; `firstDcOnce` is first-ROOM-only via `state.raidFirstRoom` (flips after first roll, raid.ts:746); full Lilim stack (raw +5) clamps to firstRoom +3 / total ≤ +4. Verified by extended engine.test.ts DC test (old assertions kept).
- **Genuine gap found + fixed:** `getPrepIntelLeakBonus().prepIntel` (Lilim stage≥2 +1, `prepIntelOnce` +1) was NOT in the resolver — added as source `lilim:prepIntel` (raidMods.ts section 6, before the `intel_zero` gate; not a DC source).
- **Discount:** `upgradeTrapOnFloor` charges `Math.floor(baseCost × getTrapUpgradeDiscountMultiplier(state))` — insufficient-MP message, flash and `mpInvested` all use the discounted cost. Rounding rule: **floor everywhere** (consistent with dismantle refund).
- **buildCostMult: WIRED IN** — pure estate-economy cost knob (order <20/40 → ×1.2/×1.1, housing ≥60/80 → −0.04/−0.08, floor 0.7); applied to facility installs/upgrades (one effective cost via new exported `getEstateBuildCost` — display, affordability, charge), landmarks, wonders. **Left out: `upgradeTown`** (core progression with its own refund — kept flat to avoid double-penalizing low-order players).
- **Legacy clamp:** `clampExpeditionAfterEffects` in `migrateGameStateInternal` (covers live loads, slot loads, wave-start snapshots): sanitize entries, trim `wavesLeft` ≤3, keep the 3 closest to expiry (stable sort, legacy order breaks ties), junk/expired dropped. Ticket 21 parts + 25 trailingIncome migrations untouched.
- Notes: `getPrepIntelLeakBonus`'s other fields (maxIntelBonus/aceDowngradeChance/newTrapGradeUpChance) remain unwired — outside this ticket's contract.
