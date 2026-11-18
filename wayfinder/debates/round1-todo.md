# Debate Round 1 — Balance / Gimmick / Logic TODO

Source: 4-persona debate (Vex Min-Maxer, Seraphine Dramatist, Mochi Newcomer, Dr. Quill Mathematician), 2 rounds, 2026-11-18.
STATUS: PLAN ONLY — nothing below has been applied to code yet. Numbers from Quill's rough Monte-Carlo (3-hero party, no traits/injuries); re-verify with the real engine before shipping.

## A. Agreed — logic fixes
- [ ] Cap clamp: clamp `trapSum` only, add synergy + ascendant AFTER the clamp (`engine/dungeon.ts` ~L306). Unify the duplicate in `engine/raidMods.ts` ~L112-117 into one function.
- [ ] Disarm: a disarmed slot keeps counting toward synergy for the rest of that raid.
- [ ] Nat-1 only hard-fails when margin < EASY_MARGIN (8); otherwise downgrade to "narrow".
- [ ] Nemesis Memory: +1 per matching floor signature (max +3), not all-or-nothing (`raid.ts` ~L706).
- [ ] Nemesis creation from `partial` (`raid.ts` ~L1429-1441): decide whether to exclude (Seraphine/Vex/Mochi want it excluded; code currently includes it).

## B. Agreed — numbers
- [ ] INSTALL_COST [50,120,220,360,540] -> [60,110,170,240,320]
- [ ] UPGRADE_COST D80,C120,B180,A260,S400,SS600 -> D60,C100,B160,A240,S380,SS520
- [ ] DC depth term floor((f-1)/3) -> floor((f-1)/2)
- [ ] FLOOR_CAP 20 -> 22 (with synergy/ascendant outside the clamp)
- [ ] DEATH_MARGIN 4 -> 5
- [ ] THREAT tail (Guild Lv7-10) -1 each step: ...4,5,6,7 -> 3,4,5,6  (single late-game difficulty lever; HERO_BONUS cuts dropped — ~no effect per sim)
- [ ] START_POINTS 300 -> 340; GUILD.START 25 -> 20
- [ ] Rebuild Grant: +40 MP next Build if MP < 120 after a breach (cap/gating: early waves, once per run suggested)
- [ ] GUILD.OUT wipe 12->9, FAME.OUTCOME wipe 8->6, MOMENTUM CAP .6->.4 (Seraphine/Mochi partly dispute — see D)
- [ ] WRATH_FROM 25 -> 18; NEM_CAP 3 -> 2; NEM_BASE stays .08
- [ ] EPIC breach HERO_PENALTY 450 -> 350 (verified 450 today)

## C. Agreed — gimmicks / UX
- [ ] The Reckoning: escaped heroes return +1 mod per escape (cap +4); heroes whose party suffered capture/break gain a grievance tag -> Nemesis promotion + named return line; 2x ransom only for named returnees.
- [ ] Overdraw: DC above cap converts to MP (needs preview; no negative MP).
- [ ] Soft Slot Variety: repeated trap type on one floor gives diminishing returns (not a hard ban).
- [ ] Persistent HeaderBar chip: Vault >= 50 MP = Core insurance.
- [ ] "Why you lost" line in Settlement (fame/guild/momentum deltas, names rival/grievance if any).
- [ ] Debt pre-warning (2 waves, 1 wave) + Casual Late-Strike forgiveness option.
- [ ] Tooltip on every locked DAY action ("Switch to Day: spends AP"); "Tonight's Priority" banner.
- [ ] Forecast Lantern in Prep: Safe / Risky / Doomed bands (no exact %).
- [ ] Mercy/Seal choice after the first breach (two-button prompt, auto-repeat after).
- [ ] Nemesis telegraph line in Prep header.
- [ ] History-conditional BEATS (recognise prior floor / captured party-mate).

## D. Open disputes (owner decision needed)
- [ ] INCOME 70 -> 80? Mochi yes; Quill withdrew; Vex no.
- [ ] GUILD.EARLY_W 3 -> 5? Mochi yes; Quill no (early game trivial).
- [ ] Wipe nerf: Seraphine wants wipe reward kept (MOMENTUM .5 + 2nd wipe in 3 waves pays half); Mochi wants nerf only from wave 6.
- [ ] WRATH_FROM 14 (Seraphine) vs 18 (Quill/Vex); first nemesis wave 12 vs >=6 floor (Mochi).
- [ ] Escalating Bounty/Reckoning on all difficulties or Hard only (Mochi: Hard only).
- [ ] Overheat gimmick (Vex), Bait Floor, Wear Maintenance (Quill), Reputation Titles (Seraphine) — not yet adjudicated.

## E. Caveats
- Vex read ~6 files; Seraphine did not read endings/debt/officers deeply; Mochi confirmed tabs are NOT wave-gated (only DAY/night phase locks).
- Quill's sim ignores traits/injuries/fear; run real-engine sims (50+ runs) before locking numbers.
