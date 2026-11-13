---
summary: Audit Phase 3 Lua tables for 28 monsters, expeditions, 25 situations, album unlocks, and 5 endings
labels: [wayfinder:research]
status: closed
assignee: antigravity
blocked-by: [01-research-phase2-lua-audit](01-research-phase2-lua-audit.md)
---

# 06 Research: Phase 3 Monsters, Expeditions, Town Crises, Album Ledger & Endings

## Question

Before charting concrete Phase 3 decision tickets out of Fog of War, extract exact specifications from `_reference/dungeon_keeper.lua` and `_reference/lorebook/` (`16_DK_SYS_Ending.md` and relevant sections) for:

1. **Monster Roster (28 units):** Costs, floor placement rules (`dk_fl_monster`), wave upkeep, combat bonuses/passives, and breeding/unlock triggers.
2. **Expeditions (`dk_exd_*`, `dk_exr_*`):** Node list (`abbey`, `canyon`, `forest`, `fort`, `mine`, `road`, `ruin`, `swamp`, `capital`, `village`), party composition/risk calculation, and loot tables.
3. **Situations & Crusades (`dk_sev_*`, `dk_evt_*`, `dk_cr_*`):** Trigger frequencies, resolution choices, and interactions with Fame/Fear/Lust/Debt.
4. **Album Unlock System (`X.ALB_CATS`):** Exact unlock keys tying game actions/outcomes to the 442 scene/portrait images.
5. **5 Canonical Endings (`dk_end_*`):** Exact conditions for `bankrupt`, `liberation`, `prosperity`, `dowry`, `romance`, and post-ending state handling.

## Notes for Research Agent

- Capture findings into `wayfinder/research/phase3-lua-audit.md`.
- Identify which parts are mature enough to graduate into Phase 3 UI/UX design tickets vs remain in Fog of War.

## Resolution

Completed the full Phase 3 Lua, lorebook, and asset manifest audit in [phase3-lua-audit.md](../research/phase3-lua-audit.md):

1. **Monster Roster (`CFG.MOB`, `X.MOB_LINES`, `CFG.FSLOT`, `CFG.UPKEEP`):** Audited all `28` lineages (84 ★1–★3 forms, egg weights `4:2:1` / rare `1:2:3`, `X.MOB_PREF` preferred-floor bonus `+1`, `X.MOB_FEM` male-prisoner breeding gates), pen capacity (`3 + 2 * beastpen`), overcrowding injuries/deaths, `XP={10,25}` evolution + forced evolution (`80%` threshold, `50*st MP`, `15%` death), breeding (`MAX=2/wave`, `15%` cross-mob variant bloodlines), disposal (`30*st` MP sell or `+1 parts / +10 food`), floor combat (`CFG.FSLOT.N=2`, `CAP=3`, 12 `CFG.LINK` combos), and `Hard` upkeep (`st * 2 MP`).
2. **Expeditions (`CFG.EXP2`, `CFG.EXP3`, `CFG.EXR`, `X.EXEV`, `X.AFTER`):** Audited Wave 3 unlock, 5 trip lengths (`short`, `mid`, `long`, `grand`, `abyss` with `3%` daily vanish & fatigue), 13 regions (`9` pool + `fort` + `out` + `village/city`), `10` encounter types, `16` regular + `6` deep random events (`depth >= 8`), `X.exFlee` / `X.exChance` formulas, `notor >= 3` retaliation, relic shards (`3` -> `1` Relic), and 8 post-expedition `X.AFTER` modifiers.
3. **Situations, Crises & Endgame (`X.REALM`, `CFG.TOWN.SEV`, `CFG.CRISIS`, `CFG.WAR`, `CFG.WONDER`, `CFG.RANK`, `CFG.GPREP`, `CFG.GRIT`):** Cataloged all `25` Realm Situations (`W10+`, v1.15.2 `90%/50%/30%` rollout, `COOL=5`, `TOTAL_CAP=5`, `11` `X.REALM_CTR` counters), `7` Bonds, `8` Stories, `16` Settlement Crises (`12` stat-gated + `4` filler, `P=0.7`, `CD=4`), `20` Location Explore events (`CFG.EVENTS`), `4` Major Crises (Holy Crusade `wrath`, Legendary Nemesis `8%..50%` override, Royal Siege Bo3, Jailbreak), `4` Relics, Town Lv 6–7 + Landmarks (`hq/lab/cmd`), Rival War, `3` Wonders, Rank Trials, Guild Counter-Gear Prep Lv0–5, and `SS/SSS/EPIC` Grit (`3/4/5`).
4. **Album Ledger & Asset Cross-Check (`X.ALB_CATS`, `X.ALB`, `assetManifest.ts`):** Documented all `7` categories (`P, D, T, J, N, S, X`), 4 unlock hooks (`greetApply`, `X.line -> X.artFromLine`, `artKey/reqArtKeys/pickArt`, `X.albOpen`), `X.ART_ALT` aliases, `X.MALE_OK` `_m` gating, and verified `348` bundled `SCENE_ASSETS` vs `357` Lua art literals (`10` missing/prefix/alias keys + `1` extra `dk_fl_display` key).
5. **5 Canonical Endings & 5 Game Overs (`X.ENDS`, `X.goKo`, `16_DK_SYS_Ending.md`):** Documented exact unlock rules for `romance`, `romance_dowry` (`E10` `debt <= 600`), `liberation`, `prosperity` (Town Lv5; keeps debt active), and `bankrupt` (`lates >= 3` -> `enterOver("bankrupt")`), alongside `go_ruin`, `go_famine`, `go_riot`, `go_core` (Vault `>=50` MP rescue), `go_bankrupt`, Casual Grace, `autosave` Rewind, and post-ending Rank Trials.
6. **Graduated Fog of War:** Split `Phase 3 Detailed UX & Balancing` and `Gallery Unlock Persistence vs Sandbox Mode` out of `MAP.md` Fog of War into [08-decide-phase3-monsters-expeditions](08-decide-phase3-monsters-expeditions.md), [09-decide-phase3-crises-endgame](09-decide-phase3-crises-endgame.md), and [10-decide-gallery-unlock-endings](10-decide-gallery-unlock-endings.md).
