---
summary: Implement the 580px 5-tab navigation shell, Dual Night/Day Stepper, full Day-loop cadence, Rest, Skip-Day toggle, and Hybrid Day Journal
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [01-state-v2-migration-and-save-slots](01-state-v2-migration-and-save-slots.md)
---

# 02: Phase 2/3 Navigation Shell, Dual Stepper & Day-Loop Cadence

**What to build:** Upgrade the two-pane console to the prototyped Phase 2/3 navigation shell and wire the complete Night/Day turn loop (`Build → Prep → Raid → Result → Day [AP] → M.Settle → [Exped] → [Debt/3w] → Build`) with 1-click Rest, optional Pure-Defense Skip-Day mode, and Hybrid batched Day Journal narration.

**Blocked by:** [01-state-v2-migration-and-save-slots](01-state-v2-migration-and-save-slots.md)

**Status:** closed

## Acceptance Criteria

- [x] Apply the `580px` Left Pane + unshrunk `ChroniclePanel` layout, dual-group Header KPIs (`Core` + `AP`, `DEBT`, `FOOD`, `ORDER`, `APP` with `warn`/`crit` styling), and contextual Dual Night/Day Stepper matching `07-navigation-shell.html`.
- [x] Add persistent Top Sub-Tabs (`[1] Dungeon | [2] Prison | [3] Estate | [4] Debt | [5] Officers`) with `1–5` keyboard shortcuts (ignored inside inputs), auto-focus on phase switch, alert badges, and `🔒 DAY` lock indicators on AP actions outside `Day`.
- [x] Wire full turn transitions including **End Day & Rest** (`+10 MP/AP`, doubled at Vesper V5) and Settings **"Skip Day / Pure Defense"** toggle (preserving Phase 1 loop when enabled).
- [x] Implement `Day Log` queuing (`dk_day_lines`), **"End Day + AI Journal"** (1 batched LLM Chronicle call per `14_DK_SYS_DayJournal.md`), and **"Quick Settle (No API Call)"**, verified by workflow unit tests and `vite build`.

## Resolution

Implemented the `580px` 5-tab navigation shell (`HeaderBar`, `NavTabs`, `DayPanel`, `ChroniclePanel`, `dungeon.css`), `1–5` hotkeys & auto-focus, `🔒 DAY` locks, full Night/Day loop (`engine/dayLoop.ts`, `engine/workflow.ts`), `skipDay` toggle, `Rest` MP recovery, and Hybrid batched Day Journal (`promptBuilder.ts`). Verified via `vitest run` (`dayLoop.test.ts`: 11/11 passed; total 36/36) and `tsc -b && vite build`.

## Design & Research References

- [02 Decide: Day-Loop Cadence & Standalone Phase Navigation UX](../../tickets/02-decide-day-loop-ux.md)
- [07 Prototype: Standalone Navigation Shell for Phase 2 Subsystems](../../tickets/07-prototype-domain-navigation-shell.md)
- [07-navigation-shell.html](../../prototypes/07-navigation-shell.html)
