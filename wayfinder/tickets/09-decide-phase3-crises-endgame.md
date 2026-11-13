---
summary: Decide UX, visibility, and balance controls for 25 Realm Situations, 16 Settlement Crises, 4 Major Crises, War/Wonders, and Guild Prep/Grit
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
blocked-by: [06-research-phase3-lua-audit](06-research-phase3-lua-audit.md), [02-decide-day-loop-ux](02-decide-day-loop-ux.md)
---

# 09 Decide: Phase 3 Situations, Crises, Territory War, Guild Prep & High-Grade Grit UX

## Question

From [phase3-lua-audit.md](../research/phase3-lua-audit.md) (§3), late-game pressure (`W10+` to `W30+` and post-ending) layers multiple interlocking systems onto every Night/Day cycle: **25 Realm Situations** (`X.REALM`, + 11 countermeasures `X.REALM_CTR`), **7 Hero Bonds & 8 Stories**, **16 Settlement Crises (`CFG.TOWN.SEV`)**, **4 Major Crises** (Holy Crusade wrath & Grand Master, Legendary Nemesis adaptation, 3-day Royal Siege Bo3, Prison Jailbreak), **Rival Territory War & 3 Wonders**, **Town Lv 6–7 & 3 Landmarks**, **Guild Counter-Gear Prep Lv0–5**, and **SS/SSS/EPIC Grit** (`CFG.GRIT`).

We need decisions on:
1. **Crisis & Threat Banner Visibility:** How much of the hidden/late-game math (`wrath 0..100`, `Nemesis` memory signatures, `gprep.lv` trap-signature counters, `CFG.GRIT` remaining shields) should be exposed transparently in the Header / Prep HUD vs kept concise like Lua's `.dk-crisis` / `.dk-epic` callouts?
2. **Situation & Countermeasure Workflow (`Prep` vs `Day`):** When Situations (`X.REALM`) and Countermeasures (`X.REALM_CTR` — spending `intel`, `MP`, `AP`, or prisoner tribute) unlock at `W10+`, where does the player inspect and trigger counters, and should `dk_cfg_realm` (`On / Casual Half / Off`) be surfaced in Settings?
3. **Late-Game Estate Congestion (`Lv 6–7`, `Landmarks`, `Rival War`, `Wonders`):** How should `Estate` and `M.Settle` organize Location Explore (`20` `CFG.EVENTS`), Settlement Crisis modals (`16` `SEV`), Royal Siege daily Bo3 rolls, Rival Territory raids/annexation, and Wonders without overwhelming the Day console?

## Context

- Realm Situations (`25`), Countermeasures (`11`), Bonds (`7`), Stories (`8`), Guild Prep, and Grit are audited in [phase3-lua-audit.md §3.1, §3.4](../research/phase3-lua-audit.md#3-situations-town-crises-threats--endgame-systems).
- Major Crises (`4`), Relics (`4`), Town Lv6–7 (`CFG.LM`), Rival War (`CFG.WAR`), and Wonders (`CFG.WONDER`) are audited in [phase3-lua-audit.md §3.2–§3.4](../research/phase3-lua-audit.md#3-situations-town-crises-threats--endgame-systems).

## Resolution

All Phase 3 Realm Situations, Crises, Territory War, Guild Prep, Grit, and Endgame Estate UX decisions were settled with the user:

1. **Crisis & Threat Banner Visibility (Concise Alert Strip + Expandable Intel):**
   - Keep `HeaderBar` and `PrepPanel` uncluttered by surfacing compact threat pills only when active: **`⚔ WRATH XX/100`** (once `>= 15`), **`💀 NEMESIS`** (with adapted tags & memory indicator), **`🛡 GPREP Lv.X`** (top countered trap tags), and **`Resolve/Grit ◆◆◆`** pips on `SS`/`SSS`/`EPIC` hero cards.
   - Reveal exact underlying formulas, thresholds, and wave forecasts via hover/expandable tooltips rather than a permanent raw probability dashboard.

2. **Realm Situations (`25`), Bonds/Stories (`7`/`8`), & Countermeasures (`11`):**
   - Display active and next-wave **Realm Situation Banners** inside **`Build`** and **`Day`** (`Estate`) with 1-click **Countermeasure (`X.REALM_CTR`)** buttons matching Lua scope (`1 AP` counters in `Day`; `Intel` / `MP` / `Prisoner Tribute` counters in both `Day` and `Build`).
   - Show a read-only Situation summary alongside Hero Bond & Story badges inside **`PrepPanel`**.
   - Expose a **`Realm Situations`** selector (**`Full` / `Casual Half` / `Off`**) in Settings (`dk_cfg_realm`).

3. **Late-Game Estate Congestion (`4th Estate Sub-Tab` + Blocking `M.Settle` Cards):**
   - Expand the `[3] Estate` inner sub-tab bar (from [08-decide-phase3-monsters-expeditions](08-decide-phase3-monsters-expeditions.md)) to 4 sub-views: **`Town & Facilities | Beast Pen & Eggs | Expedition | War & Wonders`**, preserving the `1–5` top-level Left-Pane tabs.
   - **`Town & Facilities`** houses Town Upgrades (`Lv1–7`, including `hq`, `lab`, `cmd` Landmarks), Facilities, and a compact 9-location **`Explore Town (1 AP)`** pill strip (`20` `CFG.EVENTS`).
   - **`War & Wonders`** unlocks at `W12+ / Lv3+` for **Rival Territory War** (`Scout / Raid / Annex` across 3 rivals) and **3 Great Wonders** (`spire`, `temple`, `gold`).
   - **`M.Settle`** renders **Settlement Crises (`16` `SEV`)** and **Royal Siege (`3-day Bo3`)** rolls as blocking interactive decision cards before advancing to `Exped`/`Debt`/`Build`.

4. **AI Narration Flow (`Hybrid Crisis Narration`):**
   - `Location Explore` (`20` events) and `Rival War` (`Scout/Raid/Annex`) resolve deterministically with art cards (`dk_ex_*`, `dk_war_*`) and feed into the **Day Journal + "Narrate Scene Now"** flow.
   - `M.Settle` **Settlement Crises (`16`)**, **4 Major Crises** (Holy Crusade Wave 3 Grand Master, Legendary Nemesis, Royal Siege Bo3, Prison Jailbreak), and **4 Relic unlocks** post immediate deterministic outcome cards to `ChroniclePanel` with a 1-click **"Narrate Scene Now"** button (plus an optional auto-narrate toggle for Major Crises).
