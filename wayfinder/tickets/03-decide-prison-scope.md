---
summary: Decide scope, adult intensity controls, and UI ergonomics for Phase 2 Prisoner training, jobs, and disposal
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
---

# 03 Decide: Prison Management Interactions, Jobs & Content Controls

## Question

Phase 1 captures defeated heroes into `state.prisoners`, while the original card exposes 25+ prisoner actions (`dk_pa_*`), prisoner jobs (`dk_job_*`), marks (`dk_mark_*`), interrogation (`dk_int_*`), male/female scene variants (`_m` sprites), and disposal routes (ransom, auction, release, execution).

We need user decisions on:
1. **Interaction Grouping & UX:** How should 25+ actions per prisoner be organized so the standalone UI feels strategic rather than a huge wall of buttons (e.g., categorized by Care / Interrogation / Conditioning / Marks / Jobs / Disposal)?
2. **Male vs. Female Variant Parity:** Several asset pairs have `_m` variants (`dk_pa_*_m`) while some actions don't. How should UI options and narration adapt based on captive gender and Master's `genderPref`?
3. **Intensity / Filter Safeguards:** Beyond the Phase 1 `gore` toggle, what content granularity toggles (e.g., Soft/Romance-only vs. Dark Conditioning vs. Non-con/Violence filters) should Phase 2 Settings support?
4. **LLM Cost Control:** Which prison actions justify dedicated LLM narration calls vs. fast deterministic status logs?

## Resolution

All Prison UX, gender/sprite parity, content control, and LLM cost decisions were settled with the user:

1. **Interaction Grouping & UX (Master-Detail Split + 6 Category Sub-Tabs):**
   - Inside the `Prison` top sub-tab, use a **Master-Detail Split**: left list of captives (with Grade, Status, Stamina bar, and Mark badges) and right Detail Card for the selected prisoner.
   - Organize the 35+ actions, 25 jobs, 5 conversions, double-agent dispatch, and disposal routes into **6 clean Category Sub-Tabs**:
     1. **`Care & Soft`** (`pfeed`, `ptalk`, `preward`, `prest` [0 AP], `pgift`, `pdress`, `pcure`)
     2. **`Interrogate & Train`** (`pint`, `pcare`, `ptool`, `pbind`, `pdrug`, `pmilk`, `pduo`)
     3. **`Shame & Fear`** (`pwalk`, `pdisplay`, `ppair`, `ppublic`, `pwhip`, `pthreat`, `ptort`)
     4. **`Dark & Harsh`** (10 Dark Pacts `pbrand..pduel` + 6 Harsh death-risk Pacts `pxtrain..pxdark`)
     5. **`Jobs & Convert`** (25 `CFG.JOBS` assignments with `1–3★` aptitude preview, 5 Conversions `Guard/Servant/Pet/Dancer/Hired Staff`, and Double Agent `mole`)
     6. **`Fate`** (`Sell` with buyer/risk preview, `Auction`, `Execute`, `Release`)
   - Every AP-consuming button clearly shows its `1 AP` badge (or `0 AP` for `prest`), facility/mark prerequisites, and deterministic stat/risk preview.

2. **Male vs. Female Variant Parity (Full Parity + Smart Sprite Fallback):**
   - All actions and jobs remain available to both `female` and `male` captives (matching Lua `X.MALE_OK`).
   - Resolve `dk_pa_*` / `dk_dark_*` / `dk_job_*` / `dk_mark_*` / `dk_pr_*` sprites using `_m` variants for male captives when present, falling back cleanly to the default sprite when an `_m` asset does not exist (e.g., `dk_pa_display`, `dk_pa_exec`, `dk_pa_sell`, `dk_pa_tort_death`, `dk_dark_starve`, `dk_dark_confess`, `dk_dark_rename`).
   - LLM prompts explicitly pass captive `gender` and enforce matching pronouns/descriptors.

3. **Intensity / Filter Safeguards (Skipped / Keep Phase 1 Baseline):**
   - User chose to skip adding extra Prison intensity filters; retain the existing Phase 1 `gore` toggle (`Allow Graphic Gore on Fatal Traps`) and keep the full Lua Prison action/pact suite enabled by default.

4. **LLM Cost Control (Sync with Day Journal + On-Demand "Narrate Scene Now" + Compact Roster Context):**
   - Routine pacts, interrogations, job assignments, and disposals resolve **instantly and deterministically** (updating stats, showing action sprite/result, and appending to `Day Log` for batched narration in the End-of-Day AI Journal per [02-decide-day-loop-ux](02-decide-day-loop-ux.md)).
   - Provide a **1-click "Narrate Scene Now"** button on key moments (Mark upgrades, Conversions, Executions/Fatalities, or any scene the player wants narrated live into Chronicle).
   - Inject a compact, token-capped summary of active prisoners and turned heroes into System Prompts (matching `03_DK_SYS_Prisoners.md` rules).
