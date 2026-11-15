---
summary: Reprice the crisis free-money choices in the same build the raidMods go live, and fix the three wrong estateData art keys
labels: [wayfinder:task]
status: closed *(2026-11-15 — bribes +35/−10order/−5approval, export +30/−2renown/−25food, caravan text honest, modText shows magnitudes, 2 art keys fixed 1 kept)*
assignee: kevii/agent-w2-17
blocked-by: [15-seam-raid-modifiers-resolver](15-seam-raid-modifiers-resolver.md)
---

# 17: Crisis Repricing (M2) + estateData Fixes (Batch 1)

**What to build:** The Economist's rider — "the raidMod IS the price of the MP; ship the price with the good." Once ticket 15 makes `trap_off`/`first_dc` real, the free-money crisis choices get their honest numbers, and the three copy-paste art keys in the same data file are corrected.

**Blocked by:** [15-seam-raid-modifiers-resolver](15-seam-raid-modifiers-resolver.md)

**Status:** open

## Acceptance Criteria

- [ ] **Take Bribes** (estateData.ts:1015-1026): +40 MP → **+35 MP**, add `order −10`, `approval −5` (the `trap_off` raidMod now bites for real — keep it)
- [ ] **Export Surplus** (estateData.ts:1186-1196): +40 MP → **+30 MP**, add `renown −2`, `food −25` (keep raidMod)
- [ ] **Caravan welcome** (estateData.ts:1103-1112): keep +30 MP/+15 food with its real `first_dc −2` — verify the net now reads as a tradeoff in the choice text, update label/desc to state the raid penalty
- [ ] Sweep remaining crisis choices whose only downside is a now-real raidMod; ensure every +MP choice has a visible cost line (mp/order/approval/renown/food or raidMod) — adjust `modText` flash (estate.ts:1738-1739) so the promised penalty renders with its magnitude
- [ ] **Art keys:** `torture → dk_fac_trainhall` → correct key; `reform → dk_fac_annex` → correct key; `spa → dk_fac_bath` → correct key (estateData.ts:277, 321, 329)
- [ ] Tests: extend `estateDebtOfficers.test.ts` crisis block (:248-267) — assert the new stat deltas and that raidMods apply to the following raid's DC/mods end-to-end
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `d2749a0` (`balance(17): crisis repricing + estateData art key fixes`) merged to main (EOF test conflict resolved keeping all describes; merge `3b61e7c`, gate 170/170 + build green).

- **Take Bribes:** +40 → **+35 MP**, add `order −10, approval −5`, `trap_off` kept.
- **Export Surplus:** +40 → **+30 MP**, add `renown −2, food −25`. Note: this choice never had a raidMod on this base — the visible cost is the stat line (council may add a raidMod later if wanted; one-line change).
- **Welcome Caravan:** numbers unchanged; label now `Welcome Caravan (+30 MP, +15 Food, raid risk)`; text states infiltrators scout the first room.
- **Sweep:** all 16 SETTLEMENT_CRISES enumerated — the trio above are the ONLY +MP choices (asserted as data invariant: every +MP choice must carry a stat cost or raidMod); all others already carry visible stat costs.
- **modText flash** (drifted to estate.ts:1748-1810): added `deltaText` rendering every applied effect with magnitude, e.g. `Take Bribes (+35 MP, -10 Order, -5 Approval) · Next Raid: 1 Trap Room DC -2`; wired into flash + message.
- **Art keys (evidence-based):** `torture → dk_fac_torture` (canonical multi-hop alias `dk_fac_torture → dk_fac_prison → dk_fac_annex`, the Lua original's key at dungeon_keeper.lua:6218/6471); `reform → dk_fac_pens` (no reform asset exists anywhere; pens art is the visual intent); `spa → kept dk_fac_bath` (no spa asset exists — bath IS spa imagery; recorded per ticket fallback).
- Tests: 7 new (stat deltas, raidMods bite e2e via `resolveRaidModifiers`, data invariant).
