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

### Phase 5 — Raid Logic Overhaul: Faced-Trap Resolution & Capture Meter ✅ COMPLETE (Built & Verified)

**Goal:** Make individual trap slots mechanically meaningful (per-hero faced-trap type gating) and give capture a gradual meter (`staggered`) instead of an instant status flip — closing the audit findings that trap *types* are flavor-only (picked after the roll, `raid.ts` `faced:` text) and that heroes die/capture in a single beat with no progression.

**Audit Basis (scrutinized end-to-end):** Trap **grades** already feed floor DC (`dungeon.getFloorDC`: `TRAP_BONUS` sum + synergy + combat slots + capped raid-mod seam), and `highTrapIdx`/`floorTypes` gate `brute`/`sadist`/`lewd`/nemesis traits — but the faced trap has zero mechanical effect, `TrapSlot` has no runtime status, and the capture path is a one-roll `HeroStatus` flip in `resolveFloorEncounter`. Verified the ladder is barely unit-tested (only the core-guard capture text is asserted in `raidMods.test.ts`).

**Locked Design Decisions:**
1. **Scope — F1 + F2 only (F3 trap-wear rejected):** wire faced-trap type resolution (F1) and a capture meter (F2). Trap runtime status (triggered/spent/disarm) is intentionally out of scope.
2. **F1 effect — Ero-gating:** a failed roll inside an **ero-type** slot always resolves `captured` (never `dead` — even for `severe` heroes or deep-negative margins). Standard-type slots keep the existing ladder (`severe → dead`, `nat1 → blunder`, `−margin ≥ deathMargin → dead`, else `captured`).
   - `TRAP_ERO_TYPES = lewd, bind, cloth, parasite, mutate` (5 of the 14 `TRAP_TYPES`; `mind`/`water` stay standard).
3. **F1 targeting — Kink-weighted, selected BEFORE the roll:** every hero *faces* one slot of the floor: `disarmer` → highest-grade slot; heroes whose `kinkKey` matches a slot type via `KINK_TRAP_MAP` → that slot gets ×2 selection weight; others uniform random. The faced slot replaces the post-roll flavor pick and feeds gating, detail text, and the audit row.
   - `KINK_TRAP_MAP`: bondage↔bind · drugs↔poison+parasite · hypnosis↔mind · tentacle↔parasite · praise/degradation/service/edging/worship/group/succubus↔lewd · exhibition/public/uniform/feet/petplay↔cloth(+bind) · vampire/breeding/lactation↔parasite · rough/pain↔phys · chastity↔bind.
4. **F2 trigger — Universal 1-free meter:** the first would-be `captured` beat per hero per raid converts to **STAGGERED** instead (hero remains fully `alive`); a repeat captured-beat while staggered → `captured` for real. Death paths (`severe` fail in standard slots, deep-negative margin) **bypass** the meter — they still kill outright.
5. **F2 recovery — lasts until raid end:** staggered heroes take `mods −1` in every remaining room, do not recover on passing rolls, never enter `fell` (no monster XP, no fear gain), and at settlement convert to `alive` with `cond` no worse than `injured`. Core-guard capture at the Core Room bypasses the meter (climax catch is the point).

**Status Variable Design (locked — boolean flags, NOT an enum member):** `HeroStatus` stays untouched. Add optional `staggered?: boolean` + `usedStagger?: boolean` to `Hero`. Staggered heroes count as `alive` in every existing filter — all ~20 `status === 'alive'` sites in `raid.ts` (room loop, healer, monster-die odds, retreat, outcome counting, core branch, settlement) remain untouched, so an all-staggered party can never be misclassified as a wipe. Both flags reset at the **settlement resolution point** (`applyWaveSettlement`, the same ticket-16 block as the estate.perks one-shots) — *not* at hero creation (`injIgnored`/`usedLuck` are create-time resets and the wrong pattern here). Legacy saves stay valid (optional fields only).

**Ladder Order (grit stays outermost — no double shield):**
```
beat:  pass (die≠1, margin≥0)              → easy / clean / narrow
       nat20                               → luck
       !eroGated && severe fail            → dead
       !eroGated && nat1                   → blunder
       !eroGated && −margin ≥ deathMargin  → dead
       else (all ero fails)                → captured
resolve: grit? → ENDURE (existing 2◆/1◆, cond worsens — meter untouched)
         else captured-beat && !usedStagger → STAGGERED (usedStagger = true, mods −1)
         else                              → dead / captured
```
Extract a **pure `decideBeat(ctx)`** out of `resolveFloorEncounter` so every gate combination (grit × meter × gating × deathMargin × nat1/nat20) is deterministically unit-testable.

**Implementation Surface (6 touch points):**
1. [types/game.ts](file:///c:/novel/trap_dun/app/src/types/game.ts): `Hero.staggered?` / `Hero.usedStagger?`; faced-slot info on `RaidAuditRow`.
2. [data/constants.ts](file:///c:/novel/trap_dun/app/src/data/constants.ts): `TRAP_ERO_TYPES`, `KINK_TRAP_MAP`, and a `BEATS.staggered` entry (missing entry would silently degrade flavor via the `BEATS[beatKey] ?? BEATS.clean` fallback).
3. [engine/raid.ts](file:///c:/novel/trap_dun/app/src/engine/raid.ts): faced-slot selection before rolls, pure `decideBeat`, grit→meter→capture resolution, staggered `mods −1` + floor-link stumble mark, settlement flag reset + `cond` clamp (also for `retreated` heroes).
4. [llm/promptBuilder.ts](file:///c:/novel/trap_dun/app/src/llm/promptBuilder.ts): add `staggered` to the hero `conds` list so the LLM canon rule ("obey every outcome, status…") actually sees it.
5. [components/RaidPanel.tsx](file:///c:/novel/trap_dun/app/src/components/RaidPanel.tsx): staggered status badge alongside alive/dead/captured.
6. Tests: new ladder unit tests per gate combination, all-staggered ≠ wipe regression, settlement conversion, ero-gating never-dead proof; `raidMods.test.ts` council caps (±4 DC seam) must stay green.

**Deliberately unchanged:** `HeroStatus` enum · all `status === 'alive'` filters · `raidMods.ts` council caps · XP/fear rewards (staggered grants none) · core-guard capture · on-disk save format (optional fields only).

**Verification:** `vitest run` passes **209/209 tests** across **12 test files** (17 new Phase 5 ladder/meter tests: `decideBeat` gate matrix, kink-weighted faced-slot selection, ero-never-dead incl. `severe` heroes, first-captured→STAGGERED→repeat-captured, staggered `mods −1`, all-staggered-≠-wipe breach regression, settlement conversion + retreated cond clamp) and `tsc -b && vite build` builds cleanly with zero TypeScript errors. All existing suites (raidMods council caps, monsters XP/betrayal, grit ENDURE, core-guard capture) stay green — the grit → meter → capture resolution keeps grit outermost and the core-guard capture bypasses the meter as locked.

---

### Phase 5.5 — Corruption Seam: Hero→Prison Continuity & CORR Tiers 📋 DESIGNED (Depends on Phase 5)

**Goal:** Close the audit finding that raid and prison are disconnected economies — the capture boundary drops hero identity (`kinkKey/persona/skill/weakness` never reach `Prisoner`), prisoner `corr` has no raid-side feed and no passive loop, and `endings.ts` never reads corr. Make the 24 kink labels economically alive where state actually persists (debate adjudicated: corruption meters belong on the persistent prisoner layer, NOT on disposable per-raid heroes).

**Basis:** [wayfinder/research/phase5-corruption-debate.md](file:///c:/novel/trap_dun/wayfinder/research/phase5-corruption-debate.md) — external genre research (CoC/TiTS/Karryn's Prison/DoL/RimWorld/DD/trainer-genre) + repo label audit + 3-agent debate (Maximalist/Minimalist/Judge). Judge rulings: kink targeting & ero-gating KEEP (Phase 5 sound); boolean STAGGER = right scaffold, wrong ceiling; RimWorld two-phase / KP targetability (prison-only) / TiTS ratchet / CoC AND-gates / DoL no-pure-recovery ADOPT(ED); full in-raid WILL/DESIRE meters REJECTED (one derived `corrFeed` integer instead); tier words to LLM, never raw ints.

**Locked decisions:**
1. **Hero `corrFeed` ledger:** `+1` per ero-slot beat (pass or fail), reset at settlement with the `staggered` flags — the only hero-side corruption state.
2. **Capture identity carry:** `Prisoner` gains optional `kinkKey/kinkDesc/persona/skill/weakness`; capture literal (raid.ts:799-840) copies them. Optional fields only — no schema bump (Phase 5 pattern).
3. **Capture seed formula:** `corr = clamp(5 + (lewd?20) + (aroused?15) + corrFeed×8 + (matchedKink?10), 0, 45)` — captures arrive *warmed*, never pre-broken.
4. **`CORR_TIERS` label lattice:** `Resistant 0-24 · Wavering 25-49 · Complicit 50-69 · Devoted 70-84 · Hollowed 85-100` (+ `CORR_RATCHET_FLOOR = 85` constant) — Phase 5.5 ships labels only (roster prompt context + PrisonPanel chips); mechanics wire in Phase 6.
5. **Nightly kink drift (no second loop):** inside the existing `applyManagementSettle` — prisoner `kinkKey` intersecting installed floor trap types via `KINK_TRAP_MAP` → `corr +1 / resist −1`; comfort jobs `corr +1` (recovery IS corruption — DoL rule).

**Tickets:** [wayfinder/corruption/MAP.md](file:///c:/novel/trap_dun/wayfinder/corruption/MAP.md) (`26`–`28`).

---

### Phase 6 — Trap Lifecycle & Attunement + Trainer Depth 📋 DESIGNED (Depends on Phase 5.5)

**Goal:** Revive Phase 5's rejected "F3 trap-wear" as a harmonized trap-side ledger and wire the trainer-depth lattice, so one beat event corrupts two ledgers at once — the hero remembers in `corrFeed`, the trap remembers in `attunement` (the dungeon itself becomes a corruption asset with permanent cross-wave growth, parallel to monster evolution).

**Locked decisions (improvised Stage 2.5 design + Stage 3 lattice — provenance marked in the research doc §5):**
1. **`TrapSlot` runtime state (first ever):** optional `status?: 'armed'|'spent'|'disarmed'`, `wear?` (0-100, temporary), `attunement?` (0-100, permanent ratchet at tier 50), `attunedKink?` — `waveStartSnapshot` covers rewind free.
2. **Write path:** every beat vs the faced slot `wear +10` (kink-matched +15); stagger/capture beat `attunement +15` + `attunedKink = hero.kinkKey`; `disarmer` pass with margin ≥5 on the faced slot → `disarmed` (skips faced-selection, drops `TRAP_BONUS`). Settlement: `status → armed`, `wear −30`; attunement persists forever.
3. **Read path:** `wear ≥ 60` → `effectiveGrade −1` in `getFloorDC`/`highTrapIdx`; `wear ≥ 100` → spent; `attunement ≥ 50` → kink-matched hero `mods −1` + capture seed `+10`; `attunement ≥ 85` → floor DC `+1` + pass-through `corrFeed +1` (DoL exposure loop, dungeon-side); `Repair All` Day-loop action (AP + MP) clears wear.
4. **Trainer depth (prison-only, KP/CoC per judge):** pact defs gain `kinkFamily?: string[]`; kink-matched pacts scale by `CORR_TIERS` (Wavering die +2/resist ×0.9 → Hollowed: all reqs waived + ratchet lock 85); conversion AND-gates gain corr clauses (`corr≥60 AND pleasure3+obey2` alt-route); predicted deltas on pact buttons; single `applyCorrDelta` ratchet funnel.
5. **Endgame payoff:** dominion-tier ending gate (total attunement ≥300 + ≥5 corr-100 prisoners); liberation/romance ending tint by avg corr; Endless rank scoring corruption multiplier; DD-style in-raid resolve roll = wire-or-cut triage (default CUT).

**Tickets:** [wayfinder/corruption/MAP.md](file:///c:/novel/trap_dun/wayfinder/corruption/MAP.md) (`29`–`32`).

---

## How to Run Right Now

```powershell
Set-Location C:\novel\trap_dun\app
npm.cmd run dev
```
- Configure your API provider/key in **Set LLM API!** (top right), or test immediately offline using pre-rated **Trap Shortcuts**, **Original Codex (301 + 29)**, **Quick Start Without AI Briefing**, and **Quick Settle (No API)**.
- Phase 1–3 Wayfinder maps are complete ([wayfinder/implementation/MAP.md](file:///c:/novel/trap_dun/wayfinder/implementation/MAP.md)); Phase 4 deployment map is ready ([wayfinder/phase4/MAP.md](file:///c:/novel/trap_dun/wayfinder/phase4/MAP.md)).
