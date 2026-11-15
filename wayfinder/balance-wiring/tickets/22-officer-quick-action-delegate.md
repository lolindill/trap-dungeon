---
summary: Make the Day-phase quick officer actions use the real calcOfficerAffGain formula instead of flat +3/+4, updating the test in the same commit
labels: [wayfinder:task]
status: closed *(2026-11-15 — quick actions delegate to calcOfficerAffGain; formula parity with talk/gift)*
assignee: kevii/agent-w1-22
---

# 22: Officer Quick-Action Delegate (M8, Batch 3 PR)

**What to build:** Two parallel affection systems: `talkToOfficer`/`giftOfficer` use the full formula (facility flats, manor ×1.3/lv, stage decay — officers.ts:102-114), while the Day quick action pays flat +3/+4 ignoring all investment (dayLoop.ts:494-546, the `mode === 'gift' ? 4 : 3` line). The cheapest truth in the audit: a ten-line delegate.

**Status:** open

## Acceptance Criteria

- [ ] `performQuickOfficerAction` routes its gain through `calcOfficerAffGain` (officers.ts:102-114) so bath/trade/manor/stage-decay investments matter on the Day screen too
- [ ] Gift cost check stays; log line reports the actual computed gain (+multipliers breakdown when non-trivial)
- [ ] `dayLoop.test.ts:317-322` expected aff updated **in the same commit** (council red line: a test only moves when the numbers move)
- [ ] Regression guard: exact-formula test exists at `estateDebtOfficers.test.ts:450` — reuse its fixture shape for the quick-action path
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `d1aa96c` (`balance(22): quick officer action delegates to calcOfficerAffGain`) merged to main; full suite 110/110 + `tsc -b && vite build` green.

- `performQuickOfficerAction` (dayLoop.ts) routes gain through `calcOfficerAffGain`; gift MP cost/deduction byte-identical to before.
- Stage decay now applies on quick actions (falls out of the formula automatically); bath/trade/manor investments count on the Day screen.
- Log breakdown `[base 3, +2 bath, ×1.6 manor, ×0.9 stage]` appended only when a component ≠ bare base, so existing bare-case log strings/tests are untouched. DayPanel.tsx hints now show live previews instead of hardcoded "+3/+4".
- Test red line honored: dayLoop.test.ts:317-322 did NOT move — the old fixture computes the same value under the new formula (verified by execution); added a new regression test (manor/bath fixture → quick talk 8 aff, quick gift 9 aff, MP 160) reusing the estateDebtOfficers.test.ts:450 fixture shape.
- officers.ts untouched (read-only import; circular import dayLoop→officers→dayLoop is function-level only, ticket-blessed).
- Note for later: dayLoop keeps a display-only mirror of `STAGE_GAIN_MULT` (officers.ts doesn't export it) — export it in a future wave to kill the duplication.
- Merge note: clean fast-forward, no overlaps with parallel wave-1 tickets.
