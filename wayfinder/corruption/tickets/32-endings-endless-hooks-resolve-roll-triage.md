---
summary: Wire corruption ledgers into endings/Endless scoring (attunement dominion gate, corr-tinted divergence) and triage the optional in-raid resolve roll
labels: [wayfinder:task]
status: open
blocked-by: [30-trap-read-path-dc-attunement-effects](30-trap-read-path-dc-attunement-effects.md), [31-corr-tiers-pact-mechanics-conversion-lattice](31-corr-tiers-pact-mechanics-conversion-lattice.md)
assignee: unclaimed
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
