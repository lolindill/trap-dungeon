---
summary: Audit exact Lua formulas and state variables for Phase 2 AP, prison, debt, town, and officer perks
labels: [wayfinder:research]
status: closed
assignee: antigravity
---

# 01 Research: Phase 2 Lua Mechanics (AP, Prison, Debt, Town, Officer Perks)

## Question

What are the exact state schemas, constants, formulas, probability tables, and prompt lorebook rules in `_reference/dungeon_keeper.lua`, `_reference/default_variables.txt`, and `_reference/lorebook/` (`03_DK_SYS_Prisoners.md`, `11_DK_SYS_Location.md`, `14_DK_SYS_DayJournal.md`, `15_DK_SYS_Debt.md`, `17_DK_ACT_Lines.md`) for:

1. **Day Action Points (`CFG.AP` & daily cycle):** How AP resets, extra AP sources, and turn transitions between Night settlement and Day estate loop work.
2. **Prisoner Management (`CFG.PRISON`):** All captive stats (`resist`, `corr`, trauma/affection/obedience if any), job slots, Marks, interrogation/training actions, ransom/sale formulas, and escape/death risks.
3. **Debt System (`15_DK_SYS_Debt.md`):** Installment wave cadence, interest/late penalties, extension quests, prepay rewards, and seizure/bankruptcy triggers.
4. **Town & Estate Facilities (`CFG.TOWN`, `dk_fac_*`):** Build/upgrade costs, upkeep, income/intel/morale bonuses, unrest/riot risk.
5. **Officer Affinity & Perks (`CFG.STAFF`, `X.stage`, `X.perks`):** Favor/stage thresholds (`1..5`) for Vesper, Lilim, and Eleonora, gifts (`dk_gift_*`), and concrete gameplay modifiers they grant during Prep/Raid/Estate.

## Notes for Research Agent

- Inspect read-only inside `C:/novel/trap_dun/_reference/`.
- Produce a structured summary document under `wayfinder/research/phase2-lua-audit.md` and link it back when closing this ticket.

## Resolution

Completed full read-only audit of `_reference/dungeon_keeper.lua` (core Phase 2 definitions + v1.6.0–v1.15.2 patch overrides), `_reference/default_variables.txt`, and `_reference/lorebook/{03,11,14,15,17}` and documented all schemas, constants, formulas, probability tables, and prompt rules in [phase2-lua-audit.md](../research/phase2-lua-audit.md).

Key confirmed behaviors and patch discrepancies for downstream decision tickets:
- **AP Cycle:** `CFG.AP.BASE = 3`, raised cap `CFG.AP.CAP = 6` (via 7 `CFG.APG` growth paths, max +3), deducting `dk_ent_ap` after debt entertainment and consuming queued `V7` bonus AP on `X.newDay`.
- **Prison:** 4 Marks (`obey/pleasure/terror/shame`), 19 base + 10 dark + 6 harsh pacts, stamina exhaustion death sweep (`<= 0`), 25 jobs with aptitude multipliers, 5 conversions, double-agent mole, multiplicative ransom + sale-risk vs fee-exempt auction.
- **Debt:** 3-wave cadence, 7-step `MIN` (`30..360`), `1%`/`0.8%` wave interest (+ optional `3%` v1.7.0 additional loans), 8 quests, entertainment, `1.2×/1.3×` prisoner handover, `+10%` late penalty + highest-ransom seizure, 3-strike bankruptcy vs liberation/romance endings.
- **Town & Facilities:** 25 facilities (max `min(3, town.lv)`) + Lv 6–7 landmarks (`hq/lab/cmd`), Vault (`25%` income reserve), 12 settlement crises (`CFG.TOWN.SEV`), 11 estate acts/events, riot & domain game-over checks, and `X.estateMods` affecting dungeon DCs/damage/loot.
- **Officers & Perks:** Stages `1..4` `{20,40,65,90}` + `E5 = 100`, v1.15.0 buffed `STAGE_GAIN` & automatic `X.affBy` (cap `8`/wave), and the verified `V↔L` Stage 1 / `V3↔L3` implementation swap already reflected in `X.benefits`.
