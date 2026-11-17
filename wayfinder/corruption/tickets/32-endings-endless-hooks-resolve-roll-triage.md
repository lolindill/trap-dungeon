---
summary: Wire corruption ledgers into endings/Endless scoring (attunement dominion gate, corr-tinted divergence) and triage the optional in-raid resolve roll
labels: [wayfinder:task]
status: closed *(2026-11-17 — dominion ending gated at attunement 300 + 5×corr-100, corr tint at 70/30, Endless corr multiplier unit-pinned, resolve-roll triage = CUT; 338/338 green post-merge)*
blocked-by: [30-trap-read-path-dc-attunement-effects](30-trap-read-path-dc-attunement-effects.md), [31-corr-tiers-pact-mechanics-conversion-lattice](31-corr-tiers-pact-mechanics-conversion-lattice.md)
assignee: kevii/agent-w4-32
---

# 32: Corruption Payoff — Endings/Endless Hooks + Resolve-Roll Triage

**What to build:** The ledgers from tickets 26-31 currently have no endgame readers (audit: `endings.ts` reads corr **zero times**). Close the loop so the corruption economy has a destination — then triage the one remaining judge-optional ladder change.

**Status:** open

## Spec

1. **`engine/endings.ts`:**
   - **Dominion gate (Agent A's divergence, attunement flavor):** total trap `attunement ≥ 300` AND ≥5 prisoners `corr == 100` → unlock the dominion-tier ending variant ("the dungeon itself has hollowed") alongside the existing 5 canonical endings — new `ENDING_DEFS` entry, Gallery-visible.
   - **Liberation/romance tint:** at the divergence site (~line 436) tint the ending line by average prisoner corr (`avg ≥ 70` → one variant line, ≤ 30 → another) — text-level only, no new ending objects.
2. **Endless rank scoring:** `CFG.RANK` scoring gains a corruption multiplier mirroring the existing `mul(1 + p.corr/200, 'Corr')` precedent (prison.ts:1731) — e.g. rank score × `(1 + avgPrisonerCorr/200 + totalAttunement/400)`; exact weights recorded in resolution (balance pass owns the final numbers).
3. **Wire-or-cut triage — DD-style in-raid resolve roll (judge: "reject in-raid; revisit only if corrFeed graduates"):** a hero absorbing their 3rd ero beat rolls `d20 + gradeBonus vs DC 12`, fail = captured regardless of stagger. **Default CUT** (the boolean stagger + corrFeed already deliver fail-forward drama; the roll adds a second capture axis to the ladder's highest-risk seam). Wire ONLY if triage during this ticket finds decideBeat makes it a clean ctx field — decision + rationale recorded either way, mirroring ticket 15's `critRoomSaveChance` precedent.
4. **`EndingGameOverModal.tsx` / GalleryModal:** render the new ending + tint; attunement/corr summary lines on the ending screen (totals already computable from state).

## Acceptance Criteria

- [ ] Dominion gate exact: 299 attunement → locked; 300 + 4×corr-100 → locked; 300 + 5×corr-100 → unlocked
- [ ] Tint branches proven (avg corr boundary 70/30); endings without prisoners unaffected (regression on existing 5 endings + 5 game overs)
- [ ] Endless scoring formula unit-pinned; rank regression suite green
- [ ] Resolve-roll triage decision recorded (wire with tests, or cut with rationale)
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-17** — commit `cc84310` on `wayfinder/corr-32`, merged clean into main; main = **338/338 green + build green**. Map complete.

- **Dominion ending:** `ENDING_DEFS.dominion` ("Hollowed Dominion", `clearsDebt: false`, artKey `dk_end_dominion`) parallel to the 5 canonical endings; pure `checkDominionEnding` — total trap attunement ≥ 300 AND ≥ 5 prisoners `corr == 100` (unlock-stamp guard uses `!== undefined`: the stamp is a wave number, 0 must not read as unlocked); wired at the TOP of `evaluateRankTrials` so it evaluates on EVERY settlement (raid + management) — **raid.ts untouched**.
- **Corr tint:** `getEndingCorrTintLine` — avg prisoner corr ≥ 70 → Hollowed Chorus line, ≤ 30 → Unbroken Chorus line, middle / no prisoners → no tint; bound at the divergence site via `triggerNonBankruptEnding(…, { tintLine })` → chronicle; shown for romance/liberation only — text-level, no new ending objects.
- **Endless scoring (unit-pinned `RANK_CORR_WEIGHTS`):** `rewardMp = round((150 + newRank×50) × (1 + avgPrisonerCorr/200 + totalTrapAttunement/400))` — mirrors the `mul(1 + p.corr/200, 'Corr')` precedent; chronicle/flash note `· Corr ×N.NN` when mult ≠ 1; corruption-less baseline = 200 MP unchanged.
- **Resolve-roll triage: CUT** — `decideBeat` receives an already-rolled d20 (die/margin ctx); a resolve roll must override the pass-branch (`margin ≥ 0` was previously never-captured), add a hero gradeBonus that does not exist, add a new RNG draw (shifting the seeded sequence across the whole raid matrix + settlement), and define grit/stagger bypass behavior — ladder restructuring at the highest-risk seam. corrFeed has not graduated (still a derived integer: 2 writers + 1 reset) per the judge ruling. Decision + rationale recorded here per ticket 15's `critRoomSaveChance` precedent; no raid change shipped.
- **UI:** EndingGameOverModal corruption chips (Trap Attunement + Dominion criteria, Avg Prisoner Corr, Hollowed ×n); unlocked count reads `ENDING_DEFS` (x/6); GalleryModal is data-driven off ALBUM_CATALOG — no edit needed; `ENDING_BEATS.dominion` added to promptBuilder; `assetManifest`/`albumCatalog` alias `dk_end_dominion → dk_end_prosperity`.
- **Deviations (2):** (1) triage decision recorded in this Resolution (the implementing agent was instructed not to touch `wayfinder/`). (2) dominion CG is an alias to the prosperity art pending real asset — existing alias pattern (`dk_end_bankrupt → dk_go_bankrupt`), swap-in ready.
- **Tests:** `corruptionEndings.test.ts` (18: gate 299 / 300+4 / 300+5 exact, tint boundaries 70/30, existing 5 endings + 5 game overs byte-identical without prisoners, scoring unit-pinned).
