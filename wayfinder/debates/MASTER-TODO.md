# MASTER TODO — merged from Debate Wave 1 + Wave 2 (2026-11-18)

Sources: round1-todo.md (Vex, Seraphine, Mochi, Quill) and round2-todo.md (Glitch, Rook, Hestia, Lumen). Those two files stay as history; THIS file is the working list.
STATUS: PLAN ONLY — no game code has been changed. No real-engine simulation has been run. [code-read] = an agent read it in code but did not run it; [est] = agent estimate.

> **CURRENT STATE (after wave 3): §4 and §5 below are SUPERSEDED by §7 and §10. In §2, 'Grant OR START_POINTS 340' is resolved to Grant only; in §3 the Reckoning entry is superseded by the split in §7.5. Read §6-§10 for the live list.**

## 1. Bugs / exploits (fix first, design-independent)
- [ ] casualGraceUsed is restored by Rewind (lives in state.estate, inside wave-start snapshot; saveLoad.ts ~L322-326, endings.ts ~L688-695/768) [code-read x2]. Fix: run-level ledger outside snapshot, re-applied after restore + test. Applies to every once-per-run flag below.
- [ ] Cap formula duplicated (dungeon.ts:306, raidMods.ts:117) -> one shared pure function + parity test.
- [ ] Synergy/ascendant eaten by clamp (dungeon.ts:306) -> clamp trapSum only (superseded by 3a if knee function adopted).
- [ ] Disarmed/spent refund 50% -> 25% (dungeon.ts ~L644-654).
- [ ] Install price indexed by slot count; last-slot dismantle silently drops synergy/combat slots (dungeon.ts ~L66-67, 410, 660-668).
- [ ] Nemesis eviction by age (raid.ts ~L1441) -> evict lowest-threat; decide whether `partial` may create a nemesis (code currently allows it; 7 of 8 personas want it excluded).
- [ ] Nemesis Memory +3 all-or-nothing -> +1 per matching floor (max +3) (raid.ts ~L706).
- [ ] Disarmed slot counts toward the 2-slot synergy GATE only, not the grade bonus.
- [ ] Nat-1 hard-fails only when margin < 8; else "narrow".
- [ ] calcNetAssets (debt.ts:928): use 50% refund value + actual facility cost (minor; only feeds emergency-loan limit).
- [ ] Seed raid RNG per wave (`waveSeed`); ~140 Math.random sites.

## 2. Numbers (agreed unless marked)
- [ ] INSTALL_COST [50,120,220,360,540] -> [60,110,170,240,320]
- [ ] UPGRADE_COST -> D60,C100,B160,A240,S380,SS520
- [ ] DC depth floor((f-1)/3) -> floor((f-1)/2)
- [ ] DEATH_MARGIN 4 -> 5
- [ ] THREAT tail, Guild Lv7-10: ...4,5,6,7 -> 3,4,5,6 (single late-game lever)
- [ ] GUILD.START 25 -> 20
- [ ] EPIC breach HERO_PENALTY 450 -> 350
- [ ] Rebuild Grant +40 MP: MP<120 measured at wave-start snapshot, once per 5 waves, flag outside snapshot. Take Grant OR START_POINTS 340, not both [owner to pick].
- [ ] Anti-dominance (3a): floorDefense = min(24, K(trapSum)+synergy+ascendant), K(x)=x to 14 then 14+0.5(x-14). Replaces FLOOR_CAP 22 + TRAP_BONUS cut. Rounding rule for half-points TBD (Glitch: DC must stay integer).

## 3. Gimmicks / UX
- [ ] Replan Rewind: seed kept on rewind; run tagged "Replanned xN"; Casual may toggle Reroll.
- [ ] Wave Edict draft: 1 of 3 at Build start, seed-derived, 1 reroll/run, 3-wave duration, only via resolveRaidModifiers; costs visible, no decoys.
- [ ] The Reckoning: escaped heroes return +1 mod per escape (cap +4), grievance tag on party capture/break -> Nemesis promotion + named return, 2x ransom only for named returnees. Hard-only default (Mochi/Lumen).
- [ ] Overdraw Tithe: 1 overflow DC -> 5 MP, cap 15 MP/raid, preview in Prep.
- [ ] New-faucet ceiling: all NEW faucets combined <= ~50 MP/wave (25% of ~205) [est]; Curse/Boon +60 -> +30 with mandatory curse.
- [ ] Slot 4/5 run-event reward = 50% discount voucher, not free unlock.
- [ ] Soft Slot Variety (diminishing returns for repeated trap type).
- [ ] Debt: pre-warning (2 and 1 waves), Prepay Rebate (cash-pool principal only, Fame +5 once per 3 visits, stacks reset if extraLoan>0, "2/3" bar), Casual Restructure once/run on 3rd strike (x1.05+60 applied, extCarry wiped, step held, strikes reset to 2).
- [ ] Town L6/L7 payback fix (upkeep 40/80 -> 25/50 or L7 2600 -> 2000), or L6 as a branch choice.
- [ ] Prison Quotas (pick 1 of 3 per 5 waves); opt-in Maintenance Day costing MP scaled by level*100.
- [ ] Clarity bundle: Vault>=50MP Core-insurance chip; "why you lost" line (names rival/grievance); near-miss line from real margin; tooltips on locked DAY actions; "Tonight's Priority" banner; Forecast Lantern bands (Safe/Risky/Doomed); Nemesis telegraph in Prep; Mercy/Seal prompt after first breach (auto-repeat).
- [ ] Narrative: history-conditional BEATS; Reputation Titles (deferred).
- [ ] Retention: Chapter Ledger (opt-in), Ending Whispers (opt-out), Demon Rank Titles with flat reward past rank 10, Echoes (cosmetic vs sidegrade unlocks — open).
- [ ] Build diversity: real A-grade presets, SYNERGY_BONUS B2/A3/S4, GRADE_QUOTA A:3, prefTag + distinct effect for all 28 monster lineages.
- Deferred/rejected: Trap Mutation, Floor Themes, hidden-strength curses, silent debt extension, LINK.MAX_ACTIVE 3->4 (third power lever), HERO_BONUS cuts (sim: ~no effect).

## 4. OPEN DECISIONS (owner)
1. Anti-winning lever — pick ONE: WRATH_FROM 25->16 (Lumen) / 18 (Quill, Vex) / 14 (Seraphine); wipe nerf (GUILD.OUT wipe 12->9, FAME wipe 8->6, MOMENTUM cap .6->.4) yes/no; NEM_CAP 3 or 2.
2. Early game: Grant vs START_POINTS 340; EARLY_W 3->5 (Mochi yes, Quill no); INCOME 70->80 (Mochi/Hestia yes, Vex no, Quill withdrew).
3. Reroll: 3 tokens/run (Glitch) vs unlimited+tag (Lumen).
4. Echoes/Titles: cosmetic (Lumen) vs sidegrade (Rook).
5. Reckoning difficulty scope: Hard-only vs all.
6. Rounding rule for the knee function.

## 5. Next step options
(a) implement section 1 bugs + tests; (b) build a real-engine simulator (50+ runs) to settle section 4; (c) another debate wave.

---
# WAVE 3 UPDATE (Ironclad, Hex, Lyra, Pip) — 2026-11-18
STATUS: still PLAN ONLY. All code facts below were read by agents, not run.

## 6. Verified code facts (corrections)
- Difficulty: the ONLY `difficulty === 'hard'` effect in non-test code is the default of `upkeepEnabled` (saveLoad.ts:555/590); SettingsModal.tsx:452 sets it on difficulty change and L473 is an independent checkbox -> Hard + upkeep off is reachable and equals Normal. Confirmed by Ironclad + Hex (separate greps). Casual = casMult 0.5 (debt.ts:208, estate.ts:1274/2430, officers.ts:697), Casual Grace 1/run (endings.ts:685), forced half realm (realm.ts:134). (Note: an agent referred to "debt.ts Hard rules" — that claim is NOT supported; ignore it. It was never written into these TODO files.)
- WRATH_FROM = 25 at data/realmData.ts:469, read in heroes.ts:397, prison.ts:2347, raid.ts:1430/1475.
- Math.random: ~103 raw non-test lines + ~68 callers of randInt/pickOne/pickWeighted ≈ 140-160 effective sites (both counts are right).
- Endless guild scaling does not use rank; failed Rank Trial has no penalty; reward grows with rank (endings.ts ~L180-222, 395-500, 470-480). consecutiveWipes (rankTrials) lives inside the snapshot -> must move to runLedger for "wipe3 without rewind".
- Export Run Save does NOT contain LLM API keys (LlmConfig stored separately, saveLoad.ts L52/417/1163-1173) — Pip's earlier claim was withdrawn. It DOES contain Chronicle/prisoner names/LLM prose -> not share-safe.
- Quota 1S/2A enforced only in tagParser.ts L179-197 (AI path); installBlueprintToFloor (dungeon.ts ~L534) copies grade directly [Pip read it; Hex/Ironclad accept; Lyra could only confirm capNewTrapGrade] -> treat as likely bug, add test first.
- tagParser: S quota is LLM-order dependent; no tag sanitization of echoed text; loose `grade: X` fallback (tagParser.ts ~L321) [Lyra].

## 7. Wave-3 decisions on the 6 open items (4 votes + carried-over positions)
1. Anti-winning lever: ONE lever = WRATH_FROM, no wipe nerf, NEM_CAP stays 3 (Ironclad, Lyra, Pip, Hex, Lumen agree). Value: 16 (Hex, Ironclad, Lumen) vs 18 (Lyra, Pip, Quill, Vex); Seraphine wanted 14. Proposed: ship 16, fall back to 18 if the sim shows Normal too harsh. -> OWNER may confirm.
2. Early game: Grant (flag via runLedger, ~1h) — NOT START_POINTS 340; leave EARLY_W (3) and INCOME (70) unchanged until the sim runs (Lyra wanted EARLY_W 5; dissent noted).
3. Reroll/rewind: tier table rows, all tagged. Normal 3 tokens, Casual unlimited, Hard 0-1 (Ironclad now says 1; Hex/Pip say 0) -> OWNER picks 0 or 1.
4. Echoes/Titles: cosmetic only (Ironclad, Lyra, Pip, Hex, Lumen; Rook dissents for sidegrades).
5. Reckoning split: LIGHT version on all difficulties (grievance tag, escape count cap 4, named returnees, dossier line — narration only, no resolveRaidModifiers change). ESCALATION (+1 mod per escape, party capture/break -> Nemesis, 2x ransom) behind tier/Heat: Hard cap +4 & 2x ransom; Normal +2 cap, no ransom bonus (Ironclad) or off (Hex); Casual off. Ships flagged OFF until sim.
6. Knee rounding: FLOOR (Hex, Ironclad, Lyra conceded/agreed; Pip: show the number on screen = engine number). Max 24.5 -> clamp 24; effect on 5A/5S is nil at the cap.

## 8. New items from wave 3
- [ ] DIFFICULTY_TIERS typed record {casual|normal|hard}: upkeepEnabled, reckoningCap, reckoningRansomMult, rerollTokens, graceCount, grantEnabled; Heat toggles override fields. Effort M (~5h Hex) / S (Ironclad) — Hex's estimate wins. Must exist BEFORE any Hard-only feature. Fixes "Hard = toggle default".
- [ ] Heat modifier table (data only; ships early, adds no new numbers until sim tunes). Ironman = Heat toggle (self-enforced; unenforceable vs editable localStorage — say so in UI). Ascension ladder past rank 10 (+1 THREAT tail, +1 DC per 3 ranks, cap +4), flat rank reward past 10, Trial mutators: AFTER sim.
- [ ] Rank Trial: failure costs 1 Fame; wipe3 without rewind via runLedger; jobs5 needs 5 non-idle workers.
- [ ] Grade-integrity PR (merged Lyra/Pip/Hex spec): sanitize `<`,`>`,tag names in s.text/h.name/appearance; parse tags only from reply; cap tags per slot count; quota by engine score (ties by slot), not LLM order; return `downgraded[{slot,from,to}]`; same quota path at blueprint install (`enforceGradeQuota()`, first-installed keeps grade); remove/route `grade:` fallback. Tests: 5 S tags -> 1S/2A; injected <trap> in hero name ignored; shuffled tag order same grades; install-5-S -> 1S/2A. Effort ~3h + ~4h.
- [ ] Blueprint Pack v2: versioned envelope {format, packVersion, gameVersion, count, checksum}, legacy bare array = v0, caps (200 items, name/detail length), types allowlist, skipped-items report, merge/replace + re-id. ~5h, independent.
- [ ] Share-safe "run card" export: whitelist only (code, wave, result tag, margin, rank), enums/numbers, no names/prose; test: no string >32 chars outside allowlist.
- [ ] Run Code ETDM1-<seed32>-<diff>-<flags>-<crc4>: loud reject on unknown version; promise = "same mechanics rolls, not same prose or choices"; edict-pool version NOT in v1 (bump to ETDM2 when edicts land). Challenge Code = seed + difficulty + Heat bitmask + ironman flag (a recipe, no leaderboard). Behind flags; needs waveSeed first.
- [ ] Spectator Settlement card from RaidOutcome via a `CardFacts` view-model (StoryBeat can feed later). Facts only; LLM text labelled "AI flavor, varies".
- [ ] StoryBeat as pure `deriveBeats(audit, crises)` (8 fields: kind, wave, floor, heroId, slot?, margin?, tag?, refId?) feeding "why you lost"/near-miss; additive `beats[]` + `emitBeat()` only if needed; emission is a review-checklist item, not a gate (Hex). Offline narrator = pick(pool, hash(waveSeed, heroId, floor, beatKind)) — pure, no Math.random; narrator stream separate from mechanical RNG.
- [ ] One refund helper shared by removeTrapFromFloor and calcNetAssets (so loan limit tracks the 25%/50% refund).
- [ ] Parity test must also cover empty-floor path (dungeon.ts:307 returns baseDc before shield; raidMods differs).
- [ ] Sim harness before any balance sign-off; new-faucet ceiling (~50 MP/wave) becomes an assertion; golden-seed regression (5 seeds) after seeding.

## 9. Recommended PR order (Hex, adjusted)
1. PR1 shared floorDefense + parity (incl. empty-floor path), integer knee (floor) behind it.
2. PR2 runLedger outside snapshot: casualGraceUsed, grant wave, rewind/reroll tokens, consecutiveWipes; "ledger wins on restore" test.
3. PR3 withSeededRandom around advanceRaidStep + applyWaveSettlement (+ seed shown in UI). Narrator keyed by hash, not Math.random.
3b (parallel, independent) Quota-at-install + tagParser hardening; Blueprint Pack v2.
4. PR4 DIFFICULTY_TIERS table (difficulty switch sets it explicitly; test: Hard + upkeep off still applies Hard table).
5. PR5 constants PR with pinned-constants table test + Grant (uses ledger).
6. PR6 Nemesis fixes (eviction by threat, partial, +1/floor memory, nat-1) + headless sim harness (gates everything after).
7. PR7 Debt bundle split into 3 (pre-warning, Prepay Rebate, Casual Restructure).
8. PR8+ flagged gimmicks default off: Edicts, Reckoning escalation, Heat/Ascension, beats emitters, Run/Challenge Codes, Spectator card.
Veto (Hex): Edicts, Reckoning escalation, Prepay, Soft Slot Variety do not ship before PR1-3 + sim.

## 10. Still open for owner
- WRATH_FROM 16 vs 18 (sim fallback proposed).
- Hard rerolls 0 vs 1.
- Normal Reckoning cap +2 vs off.
- EARLY_W 3 vs 5 and INCOME 70 vs 80 (default: unchanged until sim).
- Rook's sidegrade Echoes dissent; Rook's diversity items (A-grade presets, SYNERGY_BONUS, prefTag per lineage) not yet scheduled — they need the sim.

---
# IMPLEMENTATION STATUS (2026-11-18, no simulation run — owner chose to skip it)
Applied to code, vitest 355/355 (8 consecutive runs), `tsc -b` clean, `vite build` ok:
- [x] PR1 `engine/floorDefense.ts` shared knee formula (knee 14, floor-rounded, cap 24); synergy/ascendant added after the knee; used by `dungeon.getFloorDC` and `raidMods.floorTrapPower`; random-floor parity test.
- [x] Blueprint quota at install (`installBlueprintToFloor`, single + room): per-wave 1S/2A, SS/SSS capped to S, first installs keep grade; new optional `TrapSlot.installedWave`. NOTE: AI-graded custom traps still use their own per-pass quota, so one wave can hold 1S from a blueprint + 1S from AI grading.
- [x] Constants: INSTALL_COST, UPGRADE_COST, DC depth /2 (both copies), DEATH_MARGIN 5, THREAT tail 3,4,5,6, GUILD.START 20, EPIC HERO_PENALTY 350, WRATH_FROM 16.
- [x] Spent/disarmed refund 25% (`engine/trapRefund.ts`, shared by dismantle, UI preview, `calcNetAssets`).
- [x] Nemesis: evict lowest-threat (ties oldest), `partial` no longer creates one, Memory = +3 unchanged floor / +1 per remembered trap (max +2) when changed.
- [x] Nat-1 only sinks a pass when margin < EASY_MARGIN (8), else `narrow`.
- [x] Tests: new floorDefense / blueprintQuota / balancePatch files; pinned-constants table; 9 old tests updated for new numbers; one Grit test made margin-robust (it sat exactly on the nat-1 boundary).
NOT done (deliberately): runLedger + Rebuild Grant, Replan/seed (`withSeededRandom`), DIFFICULTY_TIERS, Debt bundle, all flagged gimmicks, Hard-rerolls/Reckoning decisions. casualGraceUsed rewind refresh is real but narrow (only when Grace and a later Game Over land in the same wave) — it needs runLedger only once Grant lands.
