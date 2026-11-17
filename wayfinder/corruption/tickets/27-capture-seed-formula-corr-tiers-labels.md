---
summary: Replace the 2-boolean capture seed with the debate formula and add the CORR_TIERS label lattice to roster prompt + prison UI
labels: [wayfinder:task]
status: closed *(2026-11-17 — debate seed formula live (floor 5, clamp 45, corrFeed×8 + matchedKink+10); CORR_TIERS + corrTier lattice + roster/UI tier words shipped; 272/272 green post-merge)*
blocked-by: [26-corrfeed-ledger-capture-identity-carry](26-corrfeed-ledger-capture-identity-carry.md)
assignee: kevii/agent-w2-27
---

# 27: Corruption Seam II — Capture Seed Formula + `CORR_TIERS` Labels

**What to build:** The capture seed today is `corr = (lewd?20)+(aroused?15)` (raid.ts:805-817) — two booleans. Replace it with the debate formula that pays corrFeed out, and make prisoner corr **legible** via named tier words (judge ruling: tier words to LLM/UI, never raw ints).

**Status:** open

## Spec

1. **`engine/raid.ts` capture seed:** `corr = clamp(5 + (lewdTrait ? 20) + (aroused ? 15) + corrFeed * 8 + (matchedKink ? 10 : 0), 0, 45)` — a fully-pressured kink-matched capture lands at the Wavering/Complicit border (continuity, never a free win). `matchedKink` from ticket 26. Existing resist/staminaMax/virgin/legend derivation untouched.
2. **`data/constants.ts` — `CORR_TIERS`** (single source of truth, judge's killer-spec table; mechanics wired in tickets 30/31, this ticket = labels only):
   `Resistant 0-24 · Wavering 25-49 · Complicit 50-69 · Devoted 70-84 · Hollowed 85-100`
3. **Pure helper `engine/prison.ts` (or a small `engine/tiers.ts` if prison would cycle):** `corrTier(corr): { key, label }` — deterministic, unit-testable; tiers lock a ratchet floor constant `CORR_RATCHET_FLOOR = 85` (land the constant now; enforced in ticket 28/31).
4. **`engine/prison.ts` `buildPrisonRosterPromptContext` (2219+):** append tier word to the existing `Res X%, Corr Y%, Marks …` line — one word per prisoner, no raw-int duplication.
5. **`components/PrisonPanel.tsx`:** tier chip on the prisoner detail + roster row (same retro styling as marks badges).

## Acceptance Criteria

- [ ] Seed matrix table test: lewd × aroused × corrFeed(0/3/6) × matchedKink → corr pinned exactly, never > 45
- [ ] A hero captured on the first room with zero ero exposure seeds corr = 5 (strictly warmer than nothing, colder than the old lewd 20? — record the deliberate rebalance note in the ticket resolution)
- [ ] `corrTier` boundaries exact (24/25, 49/50, 69/70, 84/85)
- [ ] Roster prompt context contains the tier word; UI shows it; no raw corr ints added to prompt lines beyond what exists today
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-17** — commit `1b937eb` on `wayfinder/corr-27`, merged to main; wave-2 `CORR_RATCHET_FLOOR` double-land dedupe in `351bcff` (kept this ticket's block); main = **272/272 green + build green**.

- **Seed formula:** `corr = clamp(5 + (lewd?20) + (aroused?15) + corrFeed×8 + (matchedKink?10), 0, 45)` replacing the two-boolean seed; ticket 26's `void matchedKink` placeholder now consumed. Existing resist/staminaMax/virgin/legend derivation untouched.
- **Ordering verified:** corrFeed is read in the prisoner-build loop over `state.party` (raid.ts ~:1054-1093) BEFORE the corrFeed reset maps `postState.party` (~:1504-1512) — ticket 26's placement held; pinned by a dedicated regression test (feed 3 → corr 29, reset still fires).
- **Lattice:** `CORR_TIERS` as `{ key, label, min, max }[]` (Resistant 0-24 · Wavering 25-49 · Complicit 50-69 · Devoted 70-84 · Hollowed 85-100) + `CORR_RATCHET_FLOOR = 85` immediately after TRAP_ATTUNEMENT; pure `corrTier(corr)` in new `engine/tiers.ts` (dependency-light, cycle-free so PrisonPanel can import without the prison module; out-of-range input clamps 0-100).
- **Legibility:** roster prompt line reads `Corr Y% (TierWord)` — one word per prisoner, no new raw ints; PrisonPanel tier chips on roster row + detail badges; `prison.css` color escalation green→yellow→magenta→red→hollow-white reusing existing pill/badge geometry.
- **Rebalance note (deliberate):** old seed = plain capture 0 / lewd-only 20 / lewd+aroused 35; new floor = 5 (strictly warmer than nothing, colder than old lewd-only 20 — spec's stated intent); fully-pressured kink-matched capture (lewd+aroused+feed 6+matched = raw 98) clamps to 45 = Wavering — continuity, never a free win. No difficulty compensation wired (MAP red line).
- **Deviations:** none.
- **Tests:** `corrTiers.test.ts` (6: 24-combo seed matrix literal-pinned + never > 45; zero-exposure capture = corr 5/Resistant; corrFeed-before-reset ordering; lattice contiguity + ratchet floor = Hollowed.min; exact boundaries 24/25, 49/50, 69/70, 84/85; roster prompt tier word + exactly one `Corr <int>%` per prisoner).
