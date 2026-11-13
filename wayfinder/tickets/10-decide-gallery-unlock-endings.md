---
summary: Decide Gallery unlock persistence vs Sandbox view, asset manifest reconciliation, 5 Endings / Game Overs UX, Rewind, and Rank Trials
labels: [wayfinder:grilling]
status: closed
assignee: antigravity
blocked-by: [06-research-phase3-lua-audit](06-research-phase3-lua-audit.md)
---

# 10 Decide: Gallery Unlock Persistence, Asset Reconciliation & Endings / Game Over Loop UX

## Question

From [phase3-lua-audit.md](../research/phase3-lua-audit.md) (§4–§5), Phase 1's [GalleryModal.tsx](../../app/src/components/GalleryModal.tsx) shows all `348` bundled `SCENE_ASSETS` unlocked, whereas the original Lua tracks per-run/global unlocks across **7 categories (`P, D, T, J, N, S, X`)**, `X.albOpen` dynamic portrait/town checks, `X.MALE_OK` `_m` variants, and `10` Lua keys missing from `SCENE_ASSETS` (plus `dk_fl_display` extra). Additionally, there are **5 Canonical Endings** (continuing into Infinite **Rank Trials**, except `bankrupt`) and **5 Game Overs** (with **Vault Core Protection**, **Casual Grace**, and **Wave-Start Rewind**).

We need decisions on:
1. **Gallery Unlock Scope & Sandbox Mode:** Should CG/portrait unlocks persist across runs in a global account/meta `localStorage` album, stay scoped per save slot, or track unlocks by default with a **Sandbox / Unlock-All (Spoiler Toggle)** button in Settings/Gallery?
2. **Album Organization & Missing Asset Handling:** Should `GalleryModal.tsx` implement Lua's 7 category tabs (`P, D, T, J, N, S, X`) + subcategories + unlock hints + `_m` variant toggle? And how should we handle unbundled keys (`dk_act_granary`, `dk_base_load`, `dk_fac_torture`, `dk_fl_fighter`, `dk_war_raid`, `dk_exr_hotspring`, `dk_exr_market`, and alias `dk_fl_display` <-> `dk_fl_fighter`) — fallback placeholder, alias mapping, or hiding unbundled tiles?
3. **Ending, Game Over & Endless Transition UX:** How should `romance`, `romance_dowry` (`E10`, `debt <= 600`), `liberation`, `prosperity` (keeping Debt alive), and `bankrupt` / `go_*` be presented in UI modals + Chronicle (`16_DK_SYS_Ending.md`), and how should **Casual Grace**, **Wave-Start Rewind (`go_rewind`)**, and **Endless Rank Trials (`CFG.RANK`)** feel seamless alongside multi-slot saves ([05-decide-state-migration-save-compat](05-decide-state-migration-save-compat.md))?

## Context

- Album categories, unlock hooks, aliases, and the `348` vs `357` asset audit are documented in [phase3-lua-audit.md §4](../research/phase3-lua-audit.md#4-album-unlock-system--asset-cross-check).
- The 5 canonical endings, 5 game overs, Casual Grace, and Rewind flow are documented in [phase3-lua-audit.md §5](../research/phase3-lua-audit.md#5-5-canonical-endings--5-game-overs).

## Resolution

All Gallery persistence, asset reconciliation, and Ending / Game Over / Endless Rank Trials decisions were settled with the user:

1. **Gallery Unlock Scope (Always Keep All Assets Unlocked):**
   - Retain Phase 1's **Always Unlocked** gallery behavior in [GalleryModal.tsx](../../app/src/components/GalleryModal.tsx) so all bundled portraits and CGs are browseable anytime without locked silhouettes or cross-run unlock gates.

2. **Album Organization & Missing Asset Reconciliation (`7 Categories` + `Alias/Fallback`):**
   - Upgrade [GalleryModal.tsx](../../app/src/components/GalleryModal.tsx) from 4 flat tabs to Lua's **7 Category Tabs** (`P: Officers`, `D: Debt`, `T: Estate`, `J: Prison`, `N: Endings`, `S: Cards`, `X: Expedition`) with subcategory filter pills and a **`_m` Male Variant** filter/toggle.
   - Reconcile the `348` bundled `SCENE_ASSETS` vs `357` Lua keys via an explicit **Alias & Fallback Mapping** (`dk_stage_e3 -> dk_int_e5`, `dk_fl_fighter -> dk_fl_display`, `dk_act_granary -> dk_act_farm`, `dk_fac_torture -> dk_fac_prison`, `dk_war_raid -> dk_exd_raid`, `hotspring/market -> dk_exr_road/dk_exd_village`) so every gameplay event card and gallery tile renders cleanly with zero broken images.

3. **Endings, Game Over, Wave-Start Rewind & Endless Rank Trials (`CFG.RANK`):**
   - Maintain a dedicated **`waveStartSnapshot`** (auto-captured at the start of every `Build` phase, separate from manual `Slot 1..5` saves from [05-decide-state-migration-save-compat](05-decide-state-migration-save-compat.md)) to power 1-click **Rewind to Wave Start**.
   - **5 Canonical Endings (`romance`, `romance_dowry`, `liberation`, `prosperity`, `bankrupt`):** Non-bankrupt endings trigger a dedicated **Ending Modal** showing ending art (`dk_end_*`), run summary, a **"Narrate Finale (`[DK-END]`)"** button into `ChroniclePanel`, and **"Continue into Endless Rank Trials"** (displaying the active Rank Trial quest & `Demon Lord Rank` badge in `HeaderBar`/`Estate`; `prosperity` keeps Debt active per Lua).
   - **5 Game Overs (`ruin`, `famine`, `riot`, `core`, `bankrupt`):** Show exact trigger cause, **Vault Guard (`v.mp >= 50`)** / **Casual Grace (`1/run`)** protection notes, `dk_go_*` art, optional **"Narrate Fall"** button, and 3 recovery actions: **Rewind Wave Start**, **Load Save Slot (`1–5`)**, or **New Run**.
