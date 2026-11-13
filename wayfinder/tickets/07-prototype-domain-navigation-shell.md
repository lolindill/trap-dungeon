---
summary: Prototype standalone workspace tabs and drawers accommodating Dungeon, Estate/Town, Prison, Debt, and Officers
labels: [wayfinder:prototype]
status: closed
assignee: antigravity
blocked-by: [02-decide-day-loop-ux](02-decide-day-loop-ux.md), [03-decide-prison-scope](03-decide-prison-scope.md)
---

# 07 Prototype: Standalone Navigation Shell for Phase 2 Subsystems

## Question

Once Day-loop cadence and Prison interaction scope are decided, what concrete UI layout keeps all Phase 2 subsystems (`Dungeon Floors`, `Prison Holding`, `Estate & Town Map`, `Debt Ledger`, `Officers`) fast to reach within 1 click without shrinking the `ChroniclePanel` reading pane or breaking mobile responsiveness?

Prototype goals:
1. Sketch/implement a clickable static or sandboxed React layout prototype for the locked Ticket 02 architecture: **Phase-Driven Left Pane + Top Sub-Tabs (`Dungeon | Prison | Estate | Debt | Officers`)** paired with the **Dual Night/Day Header Stepper** and compact **Full Town/Debt KPI Strip** (`AP`, `DEBT`, `FOOD`, `ORDER`, `APP` + Phase 1 KPIs).
2. Verify visual fit with the existing `dk-app` retro Galmuri theme (`src/styles/dungeon.css`) without wrapping excessively or shrinking `ChroniclePanel`.
3. Confirm hotkey navigation, out-of-phase AP lock badges, and status alert indicators (e.g., overdue debt warning badge, captive threshold alerts, officer affinity milestone indicator).

## Prototype Asset

- [07-navigation-shell.html](../prototypes/07-navigation-shell.html)

## Resolution

Validated the interactive Phase 2 navigation shell prototype ([07-navigation-shell.html](../prototypes/07-navigation-shell.html)) in-browser (`1366×850`, 0 console errors, 0 horizontal overflow) and locked the shell design with the user:

1. **PC-Only / Desktop-First Ergonomics:**
   - User confirmed the standalone app targets **PC/Desktop viewports (`1280px–1680px+`)** only. Do **not** hide or compress KPIs (`FOOD`, `ORDER`, `APP`, `DEBT`, `AP`) for mobile screens; keep the baseline `@media (max-width: 1040px)` single-column fallback solely for narrow desktop split windows.
2. **Workspace Split & Unshrunk Chronicle:**
   - Widen Left Tactical Pane max width slightly from `540px` to **`580px`** (`grid-template-columns: minmax(420px, 580px) minmax(420px, 1fr)`) so the `162px` Prison Master roster + Detail Card (with 6 category sub-tabs in a `3×2` grid and 2-column action buttons) fit comfortably without cramping, while keeping `ChroniclePanel` wide and unshrunk (`746px × 682px` verified at `1366×850`).
3. **Dual-Group Header KPIs & Dual Night/Day Stepper:**
   - Split `HeaderBar` KPIs into two compact bordered groups (`Core/Dungeon` + `Day/Domain`: `AP`, `DEBT`, `FOOD`, `ORDER`, `APP`) with `warn`/`crit` alert styling, keeping total desktop header height compact (`~106px`).
   - Swap `dk-stepper` contextually between **`NIGHT CYCLE`** (`1. BUILD → 2. PREP → 3. RAID → 4. RESULT`) and **`DAY CYCLE`** (`5. DAY (AP) → 6. M.SETTLE → 7. DEBT [DUE! / IN NW]`).
4. **1-Click Top Sub-Tabs, Hotkeys (`1`–`5`), Locks & Alert Badges:**
   - Persistent top sub-tabs (`[1] Dungeon | [2] Prison | [3] Estate | [4] Debt | [5] Officers`) switch in 1 click or via number hotkeys `1`–`5` (ignored while focused inside inputs/textareas/selects).
   - Phase switches auto-focus the active phase's primary tab; status badges surface `8/8 FULL!`, `FOOD<20!`, `DUE NOW`/`LATE x1!`, and officer milestone `★`; AP-spending controls outside `Day` remain inspectable with dashed `🔒 DAY` lock indicators while `0 AP` actions stay enabled.
