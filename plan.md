# Ero Trap Dungeon Maker — Standalone Project Plan

**Workspace:** `C:\novel\trap_dun`  
**App Root:** [app/](file:///c:/novel/trap_dun/app) (React + TypeScript + Vite)  
**Original Card Reference:** [\_reference/](file:///c:/novel/trap_dun/_reference) (`CharX v3` / `v1.15.2` Lua engine + 19 Lorebooks + 446 extracted sprites/scenes)  
**Decision Tracking (Wayfinder):** [wayfinder/MAP.md](file:///c:/novel/trap_dun/wayfinder/MAP.md)

---

## Project Vision

Recreate *Ero Trap Dungeon Maker* from a RisuAI chat-embedded Lua module into a clean, fast, standalone browser RPG (`React + TypeScript + Vite`) with:
- Full **English UI** and authentic retro DOS/Galmuri dark aesthetic.
- Direct **LLM API integration** (OpenAI-compatible / Ollama / OpenRouter, Google Gemini, Anthropic Claude) without chat clutter or RisuAI wrappers.
- Dedicated **Trap Blueprint Shortcut System** so players craft, test/AI-rate, pin, import/export, and 1-click deploy favorite trap setups across any floor without rewriting descriptions every wave.
- Full offline-resilient fallback options (manual overrides, pre-rated shortcuts, quick-resolve steps) so API outages never lock a run.

---

## Phase Overview

### Phase 1 — Core Playable Loop & Trap Shortcut Engine ✅ COMPLETE (Built & Verified)

**Goal:** Deliver the complete tactical defense loop (`Build → Prep → Raid → Settle`), reusable Trap Shortcut Library, direct LLM client, asset rendering, and local/JSON saves.

**Delivered Modules:**
1. **Asset Pipeline:** All 446 CharX visual assets (`4` icons + `442` character sprites & scene art) indexed in [assetManifest.ts](file:///c:/novel/trap_dun/app/src/data/assetManifest.ts) and served from [public/assets/](file:///c:/novel/trap_dun/app/public/assets).
2. **Core Engine (`src/engine/`):**
   - [dungeon.ts](file:///c:/novel/trap_dun/app/src/engine/dungeon.ts): 7 floors × 5 slots, escalating slot MP costs, upgrades/renames/50% dismantle refunds, Floor DC formula, combo room detection, pre-rated shortcut install (skips LLM grading queue).
   - [heroes.ts](file:///c:/novel/trap_dun/app/src/engine/heroes.ts): 3-hero party generator, Guild Alert level/tier scaling, 31 classes, 34 traits, races, kinks, origin/appearance metadata.
   - [raid.ts](file:///c:/novel/trap_dun/app/src/engine/raid.ts): d20 encounter resolution, trait modifiers, injuries/ailments/arousal, retreat/capture/death branches, itemized wave settlement ledger.
   - [tagParser.ts](file:///c:/novel/trap_dun/app/src/engine/tagParser.ts): Robust parser for `<trap>`, `<room>`, `<eval>`, `<hero>`, `<eval_blueprint>`, quota enforcement (`1 S / 2 A`), and inline `<img="character_keyword">` rich prose parsing.
   - [workflow.ts](file:///c:/novel/trap_dun/app/src/engine/workflow.ts) & [saveLoad.ts](file:///c:/novel/trap_dun/app/src/engine/saveLoad.ts): Clean mode transitions, Chronicle log persistence, JSON save/load & blueprint export/import.
3. **LLM Client (`src/llm/`):**
   - [promptBuilder.ts](file:///c:/novel/trap_dun/app/src/llm/promptBuilder.ts) & [client.ts](file:///c:/novel/trap_dun/app/src/llm/client.ts): Structured prompts & multi-provider fetch client + connection tester.
4. **Standalone React UI (`src/components/`):**
   - Two-pane retro workspace ([App.tsx](file:///c:/novel/trap_dun/app/src/App.tsx), [HeaderBar.tsx](file:///c:/novel/trap_dun/app/src/components/HeaderBar.tsx), [FloorBoard.tsx](file:///c:/novel/trap_dun/app/src/components/FloorBoard.tsx), [PrepPanel.tsx](file:///c:/novel/trap_dun/app/src/components/PrepPanel.tsx), [RaidPanel.tsx](file:///c:/novel/trap_dun/app/src/components/RaidPanel.tsx), [SettlementPanel.tsx](file:///c:/novel/trap_dun/app/src/components/SettlementPanel.tsx), [ChroniclePanel.tsx](file:///c:/novel/trap_dun/app/src/components/ChroniclePanel.tsx)).
   - Interactive Modals: [BlueprintWorkshopModal.tsx](file:///c:/novel/trap_dun/app/src/components/BlueprintWorkshopModal.tsx) (create, AI-rate, tag, pin, export/import, 1-click deploy), [SettingsModal.tsx](file:///c:/novel/trap_dun/app/src/components/SettingsModal.tsx), [GalleryModal.tsx](file:///c:/novel/trap_dun/app/src/components/GalleryModal.tsx).
5. **Verification:** `vitest run` passes **9/9 tests** ([engine.test.ts](file:///c:/novel/trap_dun/app/src/engine/__tests__/engine.test.ts)) and `tsc -b && vite build` builds cleanly with zero TypeScript errors.

---

### Phase 2 — Domain Day-Loop, Prison Management, Debt Ledger & Officer Perks ✅ COMPLETE (Built & Verified)

**Goal:** Expand between-wave gameplay to match the full *Day / Estate* management depth of `v1.15.2` Lua engine:
- **Schema v2 & Persistence:** `schemaVersion: 2` with pure `migrateGameState` / `migrateBlueprints`, automatic `waveStartSnapshot` capture/rewind, and 5 named in-browser Save Slots (`Slot 1..5`) in [saveLoad.ts](file:///c:/novel/trap_dun/app/src/engine/saveLoad.ts) & [SettingsModal.tsx](file:///c:/novel/trap_dun/app/src/components/SettingsModal.tsx).
- **Navigation Shell & Day Loop:** `580px` 5-tab console (`[1] Dungeon | [2] Prison | [3] Estate | [4] Debt | [5] Officers`) with `1–5` hotkeys, `🔒 DAY` locks, Dual Night/Day Stepper, Rest MP, Skip-Day toggle, and Hybrid batched Day Journal in [dayLoop.ts](file:///c:/novel/trap_dun/app/src/engine/dayLoop.ts) & [HeaderBar.tsx](file:///c:/novel/trap_dun/app/src/components/HeaderBar.tsx).
- **Original Trap Codex & Room Shortcuts:** 301 `X.TP` presets + 29 `X.TPC` combos in [trapCodex.ts](file:///c:/novel/trap_dun/app/src/data/trapCodex.ts), Original Codex tab in [BlueprintWorkshopModal.tsx](file:///c:/novel/trap_dun/app/src/components/BlueprintWorkshopModal.tsx), atomic Room Blueprint deployment, `🎲 Suggest`, and `?` grade/tag preview toggle in [FloorBoard.tsx](file:///c:/novel/trap_dun/app/src/components/FloorBoard.tsx).
- **Prison Holding & Training:** Master-Detail [PrisonPanel.tsx](file:///c:/novel/trap_dun/app/src/components/PrisonPanel.tsx) & [prison.ts](file:///c:/novel/trap_dun/app/src/engine/prison.ts) with 6 sub-tabs, 38 pacts, 24 `CFG.JOBS` (`1–3★` aptitude), 5 conversions, Double Agent (`mole`), Disposal (`Fate`), M/F `_m` sprite fallback & pronouns, and `"Narrate Scene Now"`.
- **Estate, Debt & Officers:** [estate.ts](file:///c:/novel/trap_dun/app/src/engine/estate.ts), [debt.ts](file:///c:/novel/trap_dun/app/src/engine/debt.ts), and [officers.ts](file:///c:/novel/trap_dun/app/src/engine/officers.ts) powering Town Lv1–5 + 25 facilities, 9 Explore locations (20 events), `M.Settle` ledger & 16 Settlement Crises, 3-wave Goldreich Debt cycle, and Vesper/Lilim/Eleonora stage `1–5` progression & perks.

**Wayfinder Tickets:** See [wayfinder/MAP.md](file:///c:/novel/trap_dun/wayfinder/MAP.md) (Design) and [wayfinder/implementation/MAP.md](file:///c:/novel/trap_dun/wayfinder/implementation/MAP.md) (Implementation Tickets `01`–`05` ✅).

---

### Phase 3 — Monsters, Expeditions, World Events, Album Unlocks & Multiple Endings ✅ COMPLETE (Built & Verified)

**Goal:** Reach feature parity with the complete CharX endgame and replayability systems:
- **Monster Pen, Breeding & Floor Combat Slots:** 28 monster lineages (`84` ★1–★3 forms), `mob_eggs`, overcrowding, Hard-default `CFG.UPKEEP`, and inline `Floor Guards (0/2)` + `🔗 LINK -1/-2` combos in [monsters.ts](file:///c:/novel/trap_dun/app/src/engine/monsters.ts), [MonsterPenView.tsx](file:///c:/novel/trap_dun/app/src/components/MonsterPenView.tsx), and [FloorBoard.tsx](file:///c:/novel/trap_dun/app/src/components/FloorBoard.tsx).
- **Expeditions (`3 AP/day`) & Relics:** Wave 3+ launcher in [ExpeditionLauncherView.tsx](file:///c:/novel/trap_dun/app/src/components/ExpeditionLauncherView.tsx) and interactive `3 AP/day` mini-map in [ExpeditionPanel.tsx](file:///c:/novel/trap_dun/app/src/components/ExpeditionPanel.tsx) & [expedition.ts](file:///c:/novel/trap_dun/app/src/engine/expedition.ts) covering 13 regions, 22 events, `Auto-Progress` (`exStop`), Relic Shards, 8 `X.AFTER` aftereffects, and Hybrid Expedition Chronicle.
- **Realm Situations, Major Crises, Town Lv6–7, War & Grit:** 25 `X.REALM` situations + 11 countermeasures (`Full / Casual Half / Off`), 7 Bonds & 8 Stories, Guild Counter-Gear Prep (`Lv0–5`), SS/SSS/EPIC Grit (`◆`), 4 Major Crises (Holy Crusade, Nemesis, Royal Siege Bo3, Jailbreak), 4 Relics, Town Lv6–7 (`hq`/`lab`/`cmd`), and `War & Wonders` in [realm.ts](file:///c:/novel/trap_dun/app/src/engine/realm.ts) & [realmData.ts](file:///c:/novel/trap_dun/app/src/data/realmData.ts).
- **7-Tab Always-Unlocked Gallery & Endings / Endless / Rewind:** Upgraded [GalleryModal.tsx](file:///c:/novel/trap_dun/app/src/components/GalleryModal.tsx) (`P/D/T/J/N/S/X` + `_m` toggle) with zero-broken-image alias mapping in [assetManifest.ts](file:///c:/novel/trap_dun/app/src/data/assetManifest.ts), plus 5 Canonical Endings, Endless Rank Trials (`CFG.RANK`), 5 Game Overs, Vault Core Protection, Casual Grace, and Wave-Start Rewind in [endings.ts](file:///c:/novel/trap_dun/app/src/engine/endings.ts) & [EndingGameOverModal.tsx](file:///c:/novel/trap_dun/app/src/components/EndingGameOverModal.tsx).
- **Verification:** `vitest run` passes **108/108 tests** across **10 test files**, `tsc -b && vite build` passes cleanly (`82 modules transformed`), and live desktop browser playtest (`1440x900`) passes with 0 console errors and 0 broken images.

**Wayfinder Implementation Map:** [wayfinder/implementation/MAP.md](file:///c:/novel/trap_dun/wayfinder/implementation/MAP.md) (Tickets `06`–`10` ✅ COMPLETE).

---

### Phase 4 — Git Workspace, Asset Portability & GitHub Pages Deployment 📋 DESIGNED (Ready to Execute)

**Goal:** Turn `C:\novel\trap_dun` into a clean, portable Git workspace and auto-deploy the standalone browser RPG to **Public GitHub + GitHub Pages** via GitHub Actions.

**Planned Modules & Tickets ([wayfinder/phase4/MAP.md](file:///c:/novel/trap_dun/wayfinder/phase4/MAP.md)):**
1. **Ticket 11 — Git Workspace & Hygiene ([11-git-workspace-and-hygiene.md](file:///c:/novel/trap_dun/wayfinder/phase4/tickets/11-git-workspace-and-hygiene.md)):** Root `.gitignore` (excluding `CharX Embeded Jpeg.jpeg` 82.5 MB, `_reference/`, `app/node_modules/`, `app/dist/`, local chat JSON), `.gitattributes` (LF normalization + binary rules), and root `README.md`.
2. **Ticket 12 — Subpath `BASE_URL` Portability ([12-base-url-and-asset-portability.md](file:///c:/novel/trap_dun/wayfinder/phase4/tickets/12-base-url-and-asset-portability.md)):** Parameterize `base` in [vite.config.ts](file:///c:/novel/trap_dun/app/vite.config.ts), add `assetUrl()` via `import.meta.env.BASE_URL` in [assetManifest.ts](file:///c:/novel/trap_dun/app/src/data/assetManifest.ts), and normalize [index.html](file:///c:/novel/trap_dun/app/index.html), [HeaderBar.tsx](file:///c:/novel/trap_dun/app/src/components/HeaderBar.tsx), [saveLoad.ts](file:///c:/novel/trap_dun/app/src/engine/saveLoad.ts), and [ChroniclePanel.tsx](file:///c:/novel/trap_dun/app/src/components/ChroniclePanel.tsx) for subpath hosting.
3. **Ticket 13 — GitHub Actions CI & Pages Auto-Deploy ([13-github-actions-ci-and-pages-deploy.md](file:///c:/novel/trap_dun/wayfinder/phase4/tickets/13-github-actions-ci-and-pages-deploy.md)):** `.github/workflows/ci.yml` (`vitest run`, `tsc -b && vite build`, asset-manifest disk check) and `.github/workflows/deploy.yml` (`VITE_BASE_PATH` build + `actions/deploy-pages@v4`).
4. **Ticket 14 — Repo Creation, Push & Live Verification ([14-repo-creation-live-deploy-and-verify.md](file:///c:/novel/trap_dun/wayfinder/phase4/tickets/14-repo-creation-live-deploy-and-verify.md)):** `git init -b main`, clean initial commit, public GitHub repo creation (`lolindill`), GitHub Pages activation, and live URL verification.

---

## How to Run Right Now

```powershell
Set-Location C:\novel\trap_dun\app
npm.cmd run dev
```
- Configure your API provider/key in **Set LLM API!** (top right), or test immediately offline using pre-rated **Trap Shortcuts**, **Original Codex (301 + 29)**, **Quick Start Without AI Briefing**, and **Quick Settle (No API)**.
- Phase 1–3 Wayfinder maps are complete ([wayfinder/implementation/MAP.md](file:///c:/novel/trap_dun/wayfinder/implementation/MAP.md)); Phase 4 deployment map is ready ([wayfinder/phase4/MAP.md](file:///c:/novel/trap_dun/wayfinder/phase4/MAP.md)).
