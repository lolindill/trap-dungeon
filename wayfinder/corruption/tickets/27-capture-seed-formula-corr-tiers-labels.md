---
summary: Replace the 2-boolean capture seed with the debate formula and add the CORR_TIERS label lattice to roster prompt + prison UI
labels: [wayfinder:task]
status: open
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
