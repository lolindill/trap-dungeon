---
summary: Build Master-Detail Prison UI with 6 action tabs, M/F _m sprite parity, 25 jobs, 5 conversions, mole, disposal, and Narrate Now
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [02-navigation-shell-and-day-loop](02-navigation-shell-and-day-loop.md)
---

# 04: Prison Master-Detail, 35+ Actions, 25 Jobs, Conversions & Fate

**What to build:** Replace Phase 1's passive captive list with the full `[2] Prison` Master-Detail management suite: 6 categorized action sub-tabs, full M/F parity with `_m` sprite fallback, 25 jobs, 5 conversions + Double Agent dispatch, disposal routes, and Day Journal + on-demand narration.

**Blocked by:** [02-navigation-shell-and-day-loop](02-navigation-shell-and-day-loop.md)

**Status:** closed

## Acceptance Criteria

- [x] Implement the Master-Detail split inside `[2] Prison` (`roster` list with Grade, Status, Stamina bar, Mark badges; `Detail Card` with 6 sub-tabs: `Care & Soft`, `Interrogate & Train`, `Shame & Fear`, `Dark & Harsh`, `Jobs & Convert`, `Fate`).
- [x] Implement deterministic Phase 2 Lua formulas for all 35+ prisoner pacts/actions, Marks (`pleasure/terror/shame/obey`), 25 `CFG.JOBS` (with `1–3★` aptitude preview), 5 Conversions (`Guard/Servant/Pet/Dancer/Hired Staff`), Double Agent (`mole`), and `Fate` (`Sell`, `Auction`, `Execute`, `Release`), enforcing `1 AP` / `0 AP` (`prest`) and facility/mark gates.
- [x] Support full M/F action parity with smart `_m` sprite fallback when male-specific assets are absent, plus matching pronouns and compact active-prisoner/turned-hero roster summaries in LLM prompts.
- [x] Log routine actions into `Day Log` with instant sprite/stat feedback and add 1-click **"Narrate Scene Now"** on key moments, verified by `vitest run` and `vite build`.

## Resolution

Built Master-Detail `PrisonPanel.tsx` (`prisonData.ts`, `engine/prison.ts`, `prison.css`) with 6 action tabs, 38 pacts, 24 `CFG.JOBS` (`1–3★` aptitude), 5 conversions, Double Agent `mole`, Fate routes, `_m` sprite fallback + M/F pronouns, `buildPrisonRosterPromptContext` wired into `promptBuilder.ts`, and `Narrate Scene Now` wired in `App.tsx`. Verified via `vitest run` (`prison.test.ts`: 13/13; total 64/64) and `tsc -b && vite build`.

## Design & Research References

- [03 Decide: Prison Management Interactions, Jobs & Content Controls](../../tickets/03-decide-prison-scope.md)
- [phase2-lua-audit.md](../../research/phase2-lua-audit.md)
