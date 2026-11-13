---
summary: Decide whether and how to expose the 330 Lua trap presets and 29 combos inside Trap Shortcuts
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
---

# 04 Decide: Importing Original 330 Trap Presets & 29 Combos into Blueprint Workshop

## Question

The original `dungeon_keeper.lua` contains 330 curated trap definitions (`X.TP`) and 29 named multi-trap room combos (`X.TPC`). Currently Phase 1 ships 10 hand-crafted starter `TrapBlueprint` entries alongside Master's custom Shortcut Workshop.

Before Phase 2/3 feature expansion, should we:
1. Extract and translate all 330 `X.TP` presets + 29 `X.TPC` combos into a built-in **Trap Codex / Preset Pack** inside `BlueprintWorkshopModal` (or keep Workshop uncluttered with an optional "Browse Original Codex (301 + 29)" import tab)?
2. Support **Room Blueprint Shortcuts** (saving an entire 2-trap or 3-trap combo floor as a single multi-slot shortcut that auto-computes combo synergy when deployed)?
3. Assign deterministic default grades/tags to imported Codex entries so 1-click deployment works with zero AI latency?

## Resolution

All Original Codex & Room Blueprint Shortcut decisions were settled via grilling with the user (noting exact Lua count verified in `_reference/dungeon_keeper.lua`: `301` `X.TP` presets [`179` Erotic across 13 subcategories + `122` Normal across 15 subcategories] + `29` `X.TPC` combos [`27` 2-trap + `2` 3-trap] = `330` total entries):

1. **Exposure & UI Placement (Separate "Original Codex" Tab + Build-Mode `🎲 Suggest`):**
   - Keep **My Shortcuts** uncluttered (10 `STARTER_BLUEPRINTS` + user-created/imported/pinned shortcuts only).
   - Add a dedicated **"Original Codex (301 + 29)"** tab inside `BlueprintWorkshopModal` with search, Kind (`Erotic` / `Normal`), and 28-subcategory filters, displaying each entry's translated description, `Counters` (weaknesses), and linked `X.TPC` combo partners.
   - Codex entries support both **1-Click Direct Deploy** to the selected floor and **"Save to My Shortcuts"** (to customize, re-rate, or pin to the Build Quick-Deploy Bar).
   - Add a **"🎲 Suggest"** action in Build Mode (`FloorBoard`) that rolls 3 Codex recommendations — prioritizing any trap that forms an `X.TPC` combo with traps already installed on the selected floor (matching Lua `X.tpRoll`).

2. **Grading & Tagging Policy (Curated Deterministic Defaults + Optional `?` Toggle):**
   - Translate and pre-tag all 301 Codex presets using `TRAP_TYPES` (`lewd`, `bind`, `cloth`, `fire`, `poison`, etc.) and assign agent-curated, early-game-balanced deterministic pre-rated grades (`D` / `C` / `B`, capped to preserve the `Upgrade` loop and MP economy) so 1-click deployment works with **zero AI latency** and full offline playability.
   - Include a Codex header toggle (`Pre-rated` default ON vs `Deploy as '?'` for Lilim AI grading in Prep) for players who want live AI appraisal on Codex traps.

3. **Room Blueprint Shortcuts & Combo Synergy (Full Support):**
   - Support **Room Shortcuts** (multi-trap presets of 2–5 slots) both for all **29 Original Codex Combos** (storing self-contained trap definitions for each member slot so combos deploy cleanly even when a combo member has no standalone `X.TP` row) and for **custom multi-trap floors** (`Save Room as Shortcut` from `FloorBoard`).
   - Deploying a Room/Combo Shortcut inserts its traps sequentially into free slots on the selected floor, charging standard cumulative `CFG.INSTALL_COST` MP (failing gracefully if free slots or MP are insufficient), and automatically sets the floor's pre-rated **Synergy** grade (`B` or `A` for curated combos) with zero AI wait. Modifying traps on that floor afterward resets Synergy to `'?'` via `normalizeSynergy` for re-evaluation.
