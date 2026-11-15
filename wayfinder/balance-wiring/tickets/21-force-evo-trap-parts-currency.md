---
summary: Price force-evolution in trap-parts instead of 0-AP MP, and consolidate lootParts into a real cross-system currency that stops leaking
labels: [wayfinder:task]
status: closed *(2026-11-15 — state.parts central pool + force-evo gated on parts/AP/fed with 25% death)*
assignee: kevii/agent-w1-21
---

# 21: Force-Evo in Trap-Parts + Parts Currency Consolidation (M5+M9, Batch 3 PR)

**What to build:** Force-evolve is 0 AP and bypasses the kills/fed gates (monsters.ts:432-509) — 150 MP buys ★3 instantly, killing the breeding/feeding loop. Council-endorsed fix: price it in **trap-parts**, which also forces the parts economy to stop leaking. Today monster deaths anywhere += `expedition.lootParts` (raid.ts:520, monsters.ts:193-197), monetized at 15 MP each on finalize (expedition.ts:851-858) or silently wiped at next launch (expedition.ts:360-366).

**Status:** open

## Acceptance Criteria

- [ ] **Central parts inventory:** new `state.parts` (or equivalent) as the single trap-parts pool; `raid.ts:520` and `monsters.ts:193-197` write there; `expedition.lootParts` consumers migrate — no more silent wipe at launch
- [ ] **Force-evo price:** requires `parts ≥ 2 × targetStars` + keeps MP cost (decide final: e.g. 50×stars MP **and** 2×stars parts + 1 AP + fed ≥ 2 gate — council variant debated; final numbers recorded here), 15%→25% death option decided
- [ ] **Finalize payout:** expedition parts → MP conversion capped (e.g. max 3 monetized per expedition, 8 MP each — Economist table) or rerouted to the pool; behavior decided and recorded
- [ ] Butcher (monsters.ts:771-783) stays a valid parts source; SPA/breeding loop unaffected
- [ ] Tests: `monsters.test.ts` — evo gate refuses without parts/AP/fed; parts persist across expedition launch; `expedition.test.ts` finalize cap
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `2d860a7` (`balance(21): trap-parts currency + force-evo gate`) merged to main (merge commit `5bff0bc`); full suite 113/113 + build green.

**Final numbers (recorded per ticket):**
- **Force-evo price:** XP ≥ 80% (unchanged) + 50×stars MP + **2×targetStars parts** + **1 AP** (per-monster daily key `mevo_<id>`) + **Fed ≥ 2** gate; death roll **15% → 25%**. Config: `MONSTER_CFG.FORCE_EVO` (`PARTS_PER_TARGET_STAR: 2`, `MIN_FED: 2`, `DIE_CHANCE: 0.25`).
- **Finalize payout:** cap **3 monetized at 8 MP each** (max 24 MP vs old unbounded 15 MP/unit), surplus rerouted to `state.parts`; first-parts perk (`firstDcOnce`) preserved.
- **Central pool:** `state.parts` (types/game.ts); raid deaths, evo-death, overcrowding deaths, Butcher all write there. `expedition.lootParts` survives only as an in-flight trip bag, resolved at finalize — silent wipe at launch is dead (migration folds idle legacy bags into the pool, preserves in-flight ones).

**Tests:** evo gate matrix (no parts / no AP / fed<2 / success), parts persist across launch, finalize cap, legacy-save migration (parts=0, idle-bag fold, in-flight bag kept). Merge note: raid.ts hunks kept minimal (~:520 write, ~:695-701 assembly swap) — adjacent but non-overlapping with ticket 15's regions; no conflicts with 22.
