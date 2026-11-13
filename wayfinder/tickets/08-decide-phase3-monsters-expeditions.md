---
summary: Decide UX, difficulty toggles, and narration flow for the 28-monster raising/deployment system and Expedition phase
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
blocked-by: [06-research-phase3-lua-audit](06-research-phase3-lua-audit.md), [02-decide-day-loop-ux](02-decide-day-loop-ux.md), [03-decide-prison-scope](03-decide-prison-scope.md)
---

# 08 Decide: Phase 3 Monster Pen, Floor Combat Slots & Expedition Phase UX

## Question

From [phase3-lua-audit.md](../research/phase3-lua-audit.md) (§1–§2), Phase 3 adds **28 monster lineages** (84 ★1–★3 forms, eggs, evolution, prisoner/cross-species breeding, preferred-floor DC synergy, adjacent floor links, and maintenance upkeep) plus a dedicated **Expedition (`exped`) sub-phase** (5 lengths, 13 regions, 22 events including deep rift/tomb encounters, `Auto-Progress`, relic shards, and aftermath).

We need decisions on:
1. **Monster Pen & Breeding Surface:** Where do Monster Pen management (`feed`, `abs`, `mevo_`, `mbrd_`, `mdisp_`) and Egg incubators live inside the Phase 2 Left-Pane tabs (`Prison | Estate | Dungeon`), and should monster upkeep (`CFG.UPKEEP`) default ON only in `Hard` (matching Lua) or be an explicit toggle?
2. **Floor Deployment & Link Inspector:** How should players assign up to 2 monsters / captive fighters per trap floor (`CFG.FSLOT`) and visualize Preferred Floor (`+1` `X.MOB_PREF`), Link Combos (`CFG.LINK`, max 3 active), and Betrayal risk (`resist >= 60`) inside `FloorBoard`?
3. **Expedition Map & Pacing:** Should Expedition resolution enter the full interactive `3 AP/day` mini-map (`mv1..3`, `atk/def`, `scout`, `camp`, arrival & event popups) with an explicit `Auto-Progress` button matching Lua, or offer a streamlined 1-click auto-resolve summary? And how are `[DK-EXP]` expedition logs narrated in `ChroniclePanel`?

## Context

- Monster roster (`28` lineages, `X.MOB_PREF`, `X.MOB_FEM`) and floor slots (`CFG.FSLOT`, `CFG.LINK`) are audited in [phase3-lua-audit.md §1](../research/phase3-lua-audit.md#1-monster-roster--raising-system).
- Expeditions (`CFG.EXP2`, `CFG.EXP3`, `CFG.EXR`, `X.EXEV`, `X.AFTER`) are audited in [phase3-lua-audit.md §2](../research/phase3-lua-audit.md#2-expeditions-cfgexp2-cfgexp3-cfgexr-xexev-xafter).

## Resolution

All Phase 3 Monster Pen, Floor Deployment, Upkeep, Expedition Mini-Map, and Narration decisions were settled with the user:

1. **Monster Pen & Breeding Surface (Sub-View Inside `[3] Estate`):**
   - Keep the 5 top-level Left-Pane tabs (`[1] Dungeon | [2] Prison | [3] Estate | [4] Debt | [5] Officers`) and `1–5` hotkeys from [07-prototype-domain-navigation-shell](07-prototype-domain-navigation-shell.md) intact.
   - Add an inner sub-view switcher inside **`[3] Estate`** (**`Town & Facilities | Beast Pen & Eggs | Expedition`**) so all Day AP monster management (`feed`, `abs`, `mevo_`, `mbrd_`, `mdisp_`) and the `mob_eggs` incubator queue live natively in the Day/Estate surface (with `mdisp_` Dispose also usable in `Build` per Lua).

2. **Monster & Estate Upkeep (`CFG.UPKEEP`):**
   - Default **ON only in `Hard` mode** (matching Lua `dk_cfg_upkeep`), **OFF in `Normal` and `Casual`**, and expose an explicit **Upkeep toggle in Settings** so players can override it per run.

3. **Floor Deployment, Link Combos & Betrayal Inspector (`FloorBoard` Inline):**
   - Render an inline **`Floor Guards (0/2)`** section inside [FloorBoard.tsx](../../app/src/components/FloorBoard.tsx) directly below the 3 Trap Slots (`CFG.FSLOT`, max 2 combatants per floor: monsters or `!job` captive fighters).
   - Guard picker highlights **`🏠 PREF +1`** matches (`X.MOB_PREF`), displays the floor's DC guard contribution (`cap +3`) and `Lab (+1)` / `Cmd (+1)` landmark badges when unlocked, and flags **`⚠ BETRAYAL`** on captive fighters with `resist >= 60`.
   - Surface **`🔗 LINK -1/-2`** badges directly between adjacent floors on the `1F..7F` selector strip along with an active-links counter (`x/3` `CFG.LINK` max).

4. **Expedition Map & Pacing (Interactive `3 AP/day` Mini-Map + Smart `Auto-Progress`):**
   - Launch expeditions (`1 AP`, unlocked W3) from `[3] Estate → Expedition`. When active, `exped` runs as a conditional step in the Day Cycle (`M.SETTLE → EXPED [3 AP/day] → [DEBT]`) with the full interactive mini-map (`mv1..3` 3-region forks across `13` regions, `atk/def`, `scout`, `camp`, `village/city` arrival choices, `home` extract, and `22` event popups including `depth >= 8` Deep events).
   - Include the 1-click **`Auto-Progress`** (`exAutoDay` / `exRecommend`) button that auto-pauses on safety thresholds (`exStop`: destination arrival, low stamina `< 35`, or fork with only `ambush >= 30%` nodes).

5. **Monster Pen & `[DK-EXP]` Narration (`Hybrid Chronicle`):**
   - Monster Pen actions (`feed`, `abs`, `mevo_`, `mbrd_`, `mdisp_`) during `Day` feed into the existing **Hybrid Day Journal + on-demand "Narrate Scene Now"** flow ([02-decide-day-loop-ux](02-decide-day-loop-ux.md), [03-decide-prison-scope](03-decide-prison-scope.md)).
   - Expedition (`[DK-EXP]`) uses a **Hybrid Expedition Chronicle**: routine `mv/scout/camp` clicks append deterministic step logs and art cards (`dk_exr_*`, `dk_exd_*`) immediately, paired with a **"Narrate Expedition Log"** button and optional auto-narrate triggers on **Major Beats** (Destination Arrival, Deep Event `depth >= 8`, Relic Shard/Relic unlock, and Crew Casualty/Return).
