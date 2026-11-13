---
summary: Implement Estate Town Lv1-5, 25 facilities, 20 explore events, M.Settle ledger and crises, Goldreich Debt desk, and 3 Officers
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [02-navigation-shell-and-day-loop](02-navigation-shell-and-day-loop.md)
---

# 05: Estate Town Lv1–5, Explore (20 Events), Goldreich Debt & 3 Officers

**What to build:** Deliver the core Phase 2 Day economy and character progression across `[3] Estate` (`Town & Facilities` + `M.Settle`), `[4] Debt`, and `[5] Officers` (Vesper, Lilim, Eleonora), including Location Explore events, Settlement Crises, 3-wave Debt collection, and Officer Perks.

**Blocked by:** [02-navigation-shell-and-day-loop](02-navigation-shell-and-day-loop.md)

**Status:** closed

## Acceptance Criteria

- [x] Implement **`[3] Estate → Town & Facilities`**: Town Level `1–5` progression, 25 facilities/upgrades, compact `Explore Town (1 AP)` across 9 locations (`20` `CFG.EVENTS`), and `M.Settle` deterministic ledger (tax, food, housing, pop, order, approval, prisoner job yields, vault) + `16` Settlement Crisis choice cards.
- [x] Implement **`[4] Debt`**: 3-wave Goldreich installment cycle, interest/late penalties, prepay/extension/grace-quest negotiation, seizure triggers, and Eleonora `Narrate Scene Now` on collection visits.
- [x] Implement **`[5] Officers`**: Vesper, Lilim, and Eleonora stage `1–5` progression, affinity/trust/corruption stats, `1 AP` Talk/Gift/Starred scenes, active gameplay perks (Rest bonus, raid intel/grading leaks, debt/estate decrees), and on-demand `"Narrate Scene Now"`.
- [x] Verify Estate economy formulas, Debt schedule math, and Officer perk hooks with `vitest run` and `tsc -b && vite build`.

## Resolution

Built `estateData.ts`, `engine/estate.ts`, `engine/debt.ts`, `engine/officers.ts`, and `EstatePanel.tsx` / `DebtPanel.tsx` / `OfficersPanel.tsx` (wired into `App.tsx` + `promptBuilder.ts`), delivering Town Lv1–5, 25 facilities, 9 Explore locations & 20 events, `M.Settle` ledger & 16 crises, 3-wave Goldreich Debt cycle, and Vesper/Lilim/Eleonora stages & perks. Verified via `vitest run` (`estateDebtOfficers.test.ts`: 15/15; total 64/64) and `tsc -b && vite build`.

## Design & Research References

- [02 Decide: Day-Loop Cadence & Standalone Phase Navigation UX](../../tickets/02-decide-day-loop-ux.md)
- [09 Decide: Phase 3 Situations, Crises, Territory War, Guild Prep & High-Grade Grit UX](../../tickets/09-decide-phase3-crises-endgame.md)
- [phase2-lua-audit.md](../../research/phase2-lua-audit.md)
- [phase3-lua-audit.md §3.2](../../research/phase3-lua-audit.md)
