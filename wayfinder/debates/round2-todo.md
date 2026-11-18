# Debate Round 2 (second wave) — Reconciled TODO

Personas: Glitch (Chaos QA), Rook (Roguelike Veteran), Warden Hestia (Back-Office), Dr. Lumen (Retention). 2 rounds, 2026-11-18.
Builds on round1-todo.md. STATUS: PLAN ONLY — no code changed. Items marked [code-read] were read in code by an agent but NOT run live; items marked [est] are agent estimates.

## A. Bugs / exploits found (fix regardless of design)
- [ ] casualGraceUsed lives in state.estate and is inside the wave-start snapshot (saveLoad.ts ~L322-326, endings.ts ~L688-695/768): rewind restores it to false so Casual Grace can refire. Confirmed by 2 agents reading code [code-read]; not run live. Fix: run-level ledger outside the snapshot, re-applied after restore. Add test. Same rule for any new once-per-run flag (Rebuild Grant, Prepay).
- [ ] Cap formula duplicated: dungeon.ts:306 and raidMods.ts:117 (raidMods must not import dungeon.ts). Replace with one shared pure function + parity test (500 random floors).
- [ ] Disarmed/spent traps refund 50% on dismantle (dungeon.ts ~L644-654) -> 25%.
- [ ] Install price indexed by slot COUNT not slot (dungeon.ts ~L66-67, 410): dismantle slot 1 + reinstall priced as 5th; also last-slot dismantle clears synergy/combatSlots (dungeon.ts ~L660-668) silently dropping monster/prisoner assignment.
- [ ] Nemesis list `.slice(-NEM_CAP)` (raid.ts ~L1441) evicts oldest: evict lowest-threat instead.
- [ ] calcNetAssets (debt.ts:928): only used by getExtraLoanInfo (debt.ts:947) -> minor leak (+20 per 100MP trap via loan). Use refund value (50%) and actual facility cost. NOT a top-tier exploit (Hestia checked callers).
- [ ] Unseeded RNG (Math.random, ~140 sites) + unlimited free rewind = save-scum.

## B. Agreed design
- [ ] Rewind policy (Glitch+Lumen+Rook): `waveSeed` in state, rewind keeps the seed ("Replan": change plan, not dice). Run tagged "Replanned xN". Reroll Token to draw a new seed: 3/run Normal, unlimited Casual (Glitch) — Lumen prefers unlimited+tag; OWNER TO CHOOSE (see D).
- [ ] Defense formula (Rook): one `floorDefense()` = min(24, K(trapSum)+synergy+ascendant), K(x)=x up to 14, then 14+0.5*(x-14). Replaces FLOOR_CAP 22 + non-integer TRAP_BONUS cut. (5A=17, 5S=19.5, max 24.5 -> clamp 24.) Glitch objects to non-integer values — use integer rounding or scaled ints [open: rounding rule].
- [ ] Overdraw Tithe: 1 overflow DC -> 5 MP, hard cap 15 MP/raid, shown in Prep.
- [ ] Rebuild Grant: measured at wave-start snapshot, once per 5 waves, flag stored outside snapshot. Hestia/Glitch: pick Grant OR START_POINTS 340, not both (Glitch picks Grant).
- [ ] Wave Edict draft: pick 1 of 3 at Build start, offer derived from waveSeed (rewind shows same 3), one reroll per run, 3-wave duration; implemented ONLY as a modifier via resolveRaidModifiers (raidMods.ts ~L137). All costs visible up front; no decoy options.
- [ ] Faucet ceiling: all NEW MP faucets combined <= 25% of base income (~50 MP/wave) [est]. Curse/Boon +60 -> +30 with mandatory curse.
- [ ] Slots 4/5 via run events: grant 50% discount voucher, not a free unlock (keep the sink alive).
- [ ] Casual Restructure (Hestia): Casual only, once/run — 3rd late strike doesn't end run; apply principal x1.05+60 once, wipe extCarry, hold step, reset strikes to 2.
- [ ] Debt Prepay Rebate (fixed): rebate only on principal paid from the cash pool (not extraLoan / Vault Draft); Fame +5 once per 3 visits; stacks reset if extraLoan>0; show "2/3" bar; fold into Chapter Ledger as a capped goal.
- [ ] Maintenance Day must cost MP scaled by level*100 (else dismantle-rebuild churn is cheaper) — opt-in.
- [ ] Prison Quotas: pick 1 of 3 every 5 waves, each with a tradeoff.
- [ ] Town L6/L7: payback fix (upkeep 40/80 -> 25/50 or L7 cost 2600 -> 2000); Rook wants L6 as a branch choice instead of flat buff.
- [ ] Echoes/Titles: Lumen cosmetic; Rook wants sidegrades (extra edicts, mutation variants, combo hints) with no DC/MP. Rank reward flat past rank 10.
- [ ] Chapter Ledger (opt-in, passive), Ending Whispers (opt-out, 1 per 5 waves), near-miss line using real margin.
- [ ] Real A-grade presets in codex, SYNERGY_BONUS B2/A3/S4, GRADE_QUOTA A:3 (Rook — Glitch rejected stacking LINK.MAX_ACTIVE 3->4 as a third power lever).
- [ ] Every monster lineage gets a prefTag with one distinct readable effect.

## C. Rejected / deferred
- Trap Mutation on upgrade (Glitch: touches migration saveLoad.ts ~L505-541 + both formula copies) — defer.
- Floor Themes, Curse/Boon (beyond capped version) — defer.
- Monster upkeep OFF-on-Normal change (Hestia proposed 50% soft upkeep; Glitch rejects removing the sink either way) — undecided.
- Hidden-strength curses (Lumen).
- Unlimited/silent debt "extension" (Hestia).

## D. Open disputes (owner decision needed)
- [ ] Anti-winning lever: Lumen = WRATH_FROM 25->16 only (keep wipe reward, NEM_CAP 3, drop GUILD/FAME/MOMENTUM nerfs); round-1 package had WRATH 18 + wipe nerfs + NEM_CAP 2 together. Glitch/Lumen/Hestia agree: pick ONE lever.
- [ ] Reroll policy: 3 tokens/run (Glitch) vs unlimited tagged (Lumen).
- [ ] Rook's knee function vs round-1 FLOOR_CAP 22 — knee proposed as replacement.
- [ ] Rewind tag only vs tag + cap.
- [ ] Hestia: Town branch vs flat fix; upkeep on Normal.

## E. Caveats
- No simulation run on any of this. Hestia's faucet table is an estimate; Quill's earlier MC ignored traits/injuries. Run real-engine sims (50+ runs) before locking numbers.
- Lumen/Glitch read the casualGraceUsed path but did not run a live rewind.
