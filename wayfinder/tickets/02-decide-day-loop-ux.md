---
summary: Decide turn cadence and navigation UX between the Night defense loop and Day Estate/Town/Debt phases
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
---

# 02 Decide: Day-Loop Cadence & Standalone Phase Navigation UX

## Question

How should the standalone React application structure the transition between **Night (Build → Prep → Raid → Settlement)** and **Day (Estate / Town / Prison / Debt / Officer Actions)** without cluttering the existing two-pane console?

Specifically, we need clear decisions on:
1. **Mode Cycle:** Should every Wave automatically enter a mandatory **Day Phase** with Action Points (matching the original Lua cadence), or allow an optional "Skip Day / Fast Wave Mode" for players who want pure trap defense?
2. **Left-Pane Organization:** Should Day actions live inside dedicated tabs inside the left tactical pane (`Dungeon | Estate/Town | Prison | Debt | Officers`), or replace the left pane by current Phase while keeping secondary inspectors accessible via slide-over drawers?
3. **Officer AP Narration:** Should individual Day AP actions (like talking/gifting Vesper or inspecting town facilities) call the LLM live into Chronicle, batch into a single End-of-Day Journal summary (matching `14_DK_SYS_DayJournal.md`), or let the player toggle per action?

## Resolution

All Day-Loop cadence, navigation, header, and narration decisions were settled via grilling with the user:

1. **Mode Cycle (Full Lua Loop + Fast-Forward + Pure Defense Toggle):**
   - Default cadence follows the complete Lua cycle: **`Build → Prep → Raid → Result → Day (AP) → M.Settle (+ Crisis) → [Debt every 3 waves] → Build`**.
   - **1-Click Rest:** Players can press **End Day & Rest** at any time during `Day` to immediately convert remaining AP into Rest MP (`+10 MP/AP`, doubled with Vesper `V5`) and advance to `M.Settle`.
   - **Optional Skip Toggle:** Add a **"Skip Day / Pure Defense"** toggle in Settings for players who want the streamlined Phase 1 trap-defense loop without Estate/Town/Debt pressure.

2. **Left-Pane Organization (Phase-Driven Primary View + Top Sub-Tabs):**
   - Keep the existing two-pane console (`Left Tactical Pane` + `Right ChroniclePanel`).
   - The Left Pane automatically opens the active phase's primary view (e.g., `FloorBoard` in `Build`, `Day` hub in `Day`, `M.Settle` crisis/ledger in `M.Settle`, `Debt` desk in `Debt`).
   - Add a persistent **Top Sub-Tab Bar** inside the Left Pane (**`Dungeon | Prison | Estate | Debt | Officers`**) so players can inspect any subsystem in 1 click at any phase, displaying clear **lock badges** on AP-spending actions outside `Day` and alert badges (overdue debt, low food/order, officer stage milestones).

3. **Header Stepper & KPI Strip (Dual Night/Day Stepper + Full Town/Debt KPIs):**
   - **Dual-Cycle Stepper:** Swap `dk-stepper` contextually between **Night Mode** (`1. BUILD → 2. PREP → 3. RAID → 4. RESULT`) and **Day Mode** (`5. DAY (AP) → 6. M.SETTLE → [7. DEBT]`).
   - **Full Town & Day KPIs in Header:** Surface `AP`, `DEBT`, `FOOD`, `ORDER`, and `APP` alongside the existing KPI strip in `HeaderBar` (to be fitted cleanly in [07-prototype-domain-navigation-shell](07-prototype-domain-navigation-shell.md)).

4. **Officer & Day AP Narration (Hybrid Batched Journal + Selective Live Scenes):**
   - Routine Day AP actions resolve **instantly and deterministically** and append to the current day's `Day Log` (`dk_day_lines`).
   - Closing the day offers **"End Day + AI Journal"** (narrating all queued actions as one cohesive Vesper/Lilim scene per `14_DK_SYS_DayJournal.md`) or **"Quick Settle (No API Call)"** for offline/fast play.
   - Major interactive beats (**Eleonora Debt Collection Visits**, **Settlement Crisis Events**, and **Officer Stage-Up / Starred Scenes**) provide an optional/on-demand **"Narrate Scene Now"** trigger into Chronicle without blocking routine AP clicks.
