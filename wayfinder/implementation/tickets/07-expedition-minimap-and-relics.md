---
summary: Implement Expedition launch in Estate, interactive 3 AP/day Mini-Map phase, Auto-Progress, 22 events, Relic Shards, and Hybrid Chronicle
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [04-prison-training-jobs-and-disposal](04-prison-training-jobs-and-disposal.md), [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md)
---

# 07: Interactive `3 AP/day` Expedition Mini-Map, Auto-Progress & Relic Shards

**What to build:** Add the Wave 3+ Expedition system: party selection & launch in `[3] Estate → Expedition`, the conditional `exped` (`3 AP/day`) sub-phase after `M.Settle` with 13 regions, 22 events, smart `Auto-Progress`, Relic Shards, post-trip aftereffects, and Hybrid Expedition Chronicle narration.

**Blocked by:** [04-prison-training-jobs-and-disposal](04-prison-training-jobs-and-disposal.md), [05-estate-town-debt-and-officers](05-estate-town-debt-and-officers.md)

**Status:** closed

## Acceptance Criteria

- [x] Implement `[3] Estate → Expedition` launcher (`W3+`, 5 trip lengths `short..abyss`, crew eligibility `resist <= 40`, `stamina >= 50`, max `3` or `4` with `hq`, blocked during Holy Crusade).
- [x] Implement the conditional **`EXPED`** step in the Day Cycle (`M.Settle → EXPED [3 AP/day] → [DEBT] → Build`) with `mv1..3` 3-region forks across `13` regions, `atk/def`, `scout`, `camp`, `village/city` arrival choices (`v1..v3`, `c1..c3`), `home` extract, ailments, daily flee checks, and `22` events (including `depth >= 8` Deep events).
- [x] Implement 1-click **`Auto-Progress`** (`exAutoDay` / `exRecommend`) with `exStop` safety pauses (destination arrival, stamina `< 35`, or all forks `ambush >= 30%`), plus `3` Relic Shards → Relic conversion and `8` `X.AFTER` aftereffects.
- [x] Wire **Hybrid Expedition Chronicle** (`dk_exr_*`/`dk_exd_*` art cards + deterministic step logs, `"Narrate Expedition Log"`, and optional auto-narrate on Major Beats), verified by `vitest run` and `vite build`.

## Resolution

Built `expeditionData.ts`, `engine/expedition.ts`, `ExpeditionLauncherView.tsx` (wired into `EstatePanel.tsx`), and `ExpeditionPanel.tsx` (wired into `App.tsx` for `mode === 'exped'`), covering W3+ launcher/eligibility/Crusade gate, `3 AP/day` mini-map across 13 regions & 22 events, `Auto-Progress` with `exStop` safety pauses, 3 Relic Shards -> Relic conversion, 8 `X.AFTER` aftereffects, and Hybrid Expedition Chronicle narration. Verified via `vitest run` (`expedition.test.ts`: 10/10; total 84/84) and `tsc -b && vite build`.

## Design & Research References

- [08 Decide: Phase 3 Monster Pen, Floor Combat Slots & Expedition Phase UX](../../tickets/08-decide-phase3-monsters-expeditions.md)
- [phase3-lua-audit.md §2](../../research/phase3-lua-audit.md)
