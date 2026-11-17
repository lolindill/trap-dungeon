# Phase 5 Research — Corruption / Trainer Parameter Debate

**Date:** 2026-11-16
**Trigger:** Player thesis — "the current logic is too basic, underuses its labels, and lacks corruption parameters in the heroine-corruption / trainer-genre tradition."
**Method:** 2 research agents (external genre research + repo label audit) → 3 debate agents (Maximalist / Minimalist / Architect-Judge).

---

## 1. External Research — Genre Meter Models

| System | Stat model | Reversible? | Combat hookup | Gating style | Schema cost |
|---|---|---|---|---|---|
| CoC | 1 int corruption 0–100 + derived perk flags | Yes (items/meditation) | Indirect (perk gates; lust = alt defeat bar) | Threshold lattice 25/35/50/70/80 + AND-reqs | ~12 fields |
| TiTS | `taint` ratchet floor + willpower pool + lust defeat bar | One-way floor | Willpower resists; max lust = loss | Ratchet floor + trapdoor at 100 | ~4 ints |
| Karryn's Prison | 5–7 per-part desire meters (~50 target) + energy/will pools + act counters + titles | Decay between battles; unlocks permanent | Fully in-combat: desires drive enemy targeting + stat debuffs | Targetability gates (≥50 → act available) + act-count unlocks | 30–50 fields |
| Degrees of Lewdity | Pain/Arousal/Stress/Trauma/Control/Fatigue (short + long meters) | Slow | Direct: Pain/Control resolve struggle turns | Tiered state machine; Control licenses traits | ~15 fields |
| Trainer genre (LLtP, SlaveMaker) | Per-target Obedience/Corruption/Affection (+ Temperament) | Yes | None (meta) | Scene gates = stat AND-combinations; predicted deltas; trainer caps trainee maxima | ~3–5 ints |
| RimWorld prisoners | `resistance` drain → discrete recruit roll; `will` for enslavement | Yes (mood/opinion driven) | None (meta) | Two-phase: numeric drain gate, then probabilistic roll | ~5 floats |
| Darkest Dungeon | Stress 0–200 → roll at 100 → Affliction/Virtue enum | Partial (persists capped at 100) | Direct: afflicted heroes disobey | Threshold → rolled discrete state | 1 int + 1 enum |

**Transferable patterns (ranked by fit):**
1. RimWorld two-phase capture gate — drain-then-roll, independently tunable.
2. KP targetability thresholds — gate the *action menu*, not just outcomes.
3. KP act-counter unlocks — "do X N times" converts grinding into progression.
4. TiTS ratchet floor — `floor = maxTierHit − 25`; decay can't undo milestones.
5. CoC threshold lattice with AND-requirements — max content per int.
6. DoL self-reinforcing loop — relief actions always add corruption (recovery IS corruption).
7. DD threshold → rolled discrete state — drama at the boundary.
8. Trainer predicted deltas + trainer-skill caps — legible pacing.

Sources: smutosaur CoC/TiTS wiki, DoL miraheze wiki, RimWorld wiki, Darkest Dungeon fandom wiki, KP passives/titles guides, LLtP guide, SlaveMaker tropes. Direct genre match found: *Demon Lord's Corruption Codex* (Steam) — "break and transform invading adventurers."

## 2. Repo Label Audit (ground truth)

- **24 KINKS: zero mechanical consumers.** `kinkKey` → LLM prompt only (promptBuilder.ts:48). Phase 5 F1 gives first real use (×2 faced-slot weight via `KINK_TRAP_MAP`).
- **14 TRAP_TYPES: weak/meta only** — floor DC tags, `FLOOR_LINK_RULES`, monster `prefTag` +1 DC, nemesis adaptation. The faced trap is a *post-roll* flavor pick (raid.ts:445-450).
- **34 traits: all consumed** (roll mods, fear, deathMargin, prison mults, resist-at-capture).
- **Prisoner layer already trainer-shaped:** resist 0–100, corr 0–100 (**pact-only deltas — no passive loop, no raid-side feed, zero readers in endings.ts**), pleasure/terror/shame, marks obey/pleasure/terror/shame Lv0–3, 5 conversions gated by `corr≥70 / obey3 / pleasure3+obey2` (prison.ts:1341-1398).
- **Hero side: no cross-wave persistence.** Fresh party per wave; heroes live ~4–7 beat rolls.
- **Capture seam drops identity:** raid.ts:799-840 seeds `corr = (lewd?20)+(aroused?15)` and discards `kinkKey/classKey/raceKey/persona/skill/weakness`.

## 3. Debate Positions

**Agent A — Corruption Maximalist:** Locked Phase 5 F2 is "a 1-bit meter" — a boolean reskin, not a corruption system; kinks feed targeting but then nothing. Proposed full per-hero in-raid meters (WILL 0–100 drain→willbroken, DESIRE 0–100 with targetability/seek thresholds), capture→prison continuity formulas (`corr = raidCorr + traits`, carry 5 identity fields, `eroBeats≥3 → marks.pleasure=1`), prison kink-job trickle, endings corr hooks. Rebutted disposability via nemesis/`adaptedTags` persistence precedent and the ~12-case pure `decideBeat` test matrix.

**Agent B — Scope Minimalist:** Hero meters are "state with a 7-roll lifetime whose only consumer is one prompt line." The trainer layer is already ~85% built in prison.ts (gates = literal AND-lattices); the real gaps are three cheap adds: (1) carry `kinkKey/persona/skill/weakness` into Prisoner, (2) enrich capture seed (+5 corr per ero-room survived, +10 ero-gated capture), (3) nightly kink drift in the existing `estate.ts:1580-1640` settle map, (4) `CORR_TIERS`/`RESIST_TIERS` labels into prompt + UI, (5) pact kink bonus. ~70–100 lines, ~25 tests, zero ladder risk. Conceded in-raid drama is real but STAGGERED already buys it.

**Agent C — Architect-Judge (verdict):** Thesis TRUE (labels underused; raid→prison economies disconnected), but the cure is not full KP/DoL in-raid meters. Rulings: kink targeting KEEP; ero-gating KEEP (first mechanical trap-type outcome gate — load-bearing); boolean STAGGER = right scaffold, wrong ceiling. **In-raid meters: NO (except one derived `corrFeed` integer).** Pattern rulings: RimWorld adopt · KP targetability adopt (prison-only) · TiTS ratchet adopt · CoC lattice adopt · DoL adapt (no pure recovery) · DD resolve roll reject in-raid (optional Stage-3 roll at 3rd ero beat) · predicted deltas adopt (UI-only).

## 4. Ruling — Roadmap

**Stage 1 — Ship locked Phase 5 as-is.** Internally consistent, save-safe, `decideBeat()` is the seam all future meters plug into. No trim, no extension.

**Stage 2 — "Corruption seam" (the real fix for the thesis):**
- `Prisoner` gains optional `kinkKey?`, `raidCorrFeed?`, `matchedKink?` (+ persona/skill/weakness per Agent B).
- Raid room loop accumulates `corrFeed` (every ero-slot beat, pass or fail, +1).
- Capture seed: `corr = clamp(5 + (lewd?20) + (aroused?15) + corrFeed×8 + (matchedKink?10), 0, 45)` — heroes arrive *warmed*, never pre-broken.
- `estate.ts` nightly settle: DoL-adapted drift (comfort jobs corr +1); tier ratchet floor constant lands here.
- `CORR_TIERS` labels → promptBuilder + PrisonPanel/roster context.
- Schema: optional fields, `schemaVersion` 3 migration (v1→v2 precedent exists).

**Stage 3 — Trainer depth:**
- Pact defs gain `kinkFamily?: string[]` + `corrReq?`; kink-match die bonus / resist multiplier.
- `canConvertPrisoner` AND-gates gain corr clauses; ratchet check (floor never decreases).
- Predicted stat deltas on pact buttons.
- Optional in-raid DD-style resolve roll: 3rd ero beat → d20 + gradeBonus vs DC 12, fail = captured regardless of stagger.

**Killer spec (if only one thing):** *Kink-conditioned corruption continuity* — carry `kinkKey` + `corrFeed` through capture; make kink-match govern pact effectiveness + conversion readiness; single-source `CORR_TIERS` table:

| Tier | corr | Effects |
|---|---|---|
| Resistant | 0–24 | Baseline, full resist |
| Wavering | 25–49 | Kink-family pacts die +2, resist ×0.9 |
| Complicit | 50–69 | Kink-family die +4, resist ×0.8; nightly drift +1; brothel/dairy yield ×1.25 |
| Devoted | 70–84 | Existing gates unlock; kink-family pacts +50%; buyer premium ×1.5 |
| Hollowed | 85–100 | Ratchet locks at 85; kink-family reqs waived; tier word = narration register |

---

## 5. Improvised Extension (post-debate) — Stage 2.5: Trap Lifecycle & Attunement (F3 revisited)

*Provenance: designed directly by the orchestrator after the debate, on player request ("improvise trap status var too"). NOT debated by the 3 agents. Phase 5 rejected "F3 trap-wear" for scope reasons; this revisits it as a harmonized system.*

**Ground truth:** `TrapSlot` = `{ id, text, grade, types, mpInvested, blueprintId? }` — pure config; raid reads `highTrapIdx`/`floorTypes` but **never mutates slots** (raid.ts:142-146, 446-450). A trap that fires a beat today changes nothing: no ammo, no wear, no memory. `waveStartSnapshot` (saveLoad, Phase 2) already snapshots full state → rewind stays free.

### Design — one beat event, two ledgers

The same ero-beat that increments hero-side `corrFeed` (Stage 2) also writes the **slot-side ledger**: `wear` (spent, temporary) and `attunement` (remembered, permanent). Hero corruption and trap corruption are symmetric processes — the dungeon is corrupted by what it does to heroes, exactly as heroes are.

```ts
interface TrapSlot {
  // ...existing fields
  status?: 'armed' | 'spent' | 'disarmed'; // default: armed (absent = armed → legacy-safe)
  wear?: number;        // 0-100, temporary: repaired via Day loop / decays -30 per settlement
  attunement?: number;  // 0-100, PERMANENT ratchet (TiTS pattern): the trap remembers
  attunedKink?: string; // kinkKey of the last hero this slot beat/captured
}
```

**Write rules (raid loop, per faced-slot beat):**
- Any beat resolved against the slot: `wear +10` (kink-matched faced slot `+15`).
- Staggered or captured beat resolved by the slot: `attunement +15`, `attunedKink = hero.kinkKey` (never decays; ratchet floor at tier boundary 50).
- Disarm: `disarmer` hero passes their beat on the faced slot with `margin ≥ 5` → slot `status: 'disarmed'` (also available as a Prep-intel action). Disarmed slots are skipped by faced-selection and contribute no `TRAP_BONUS`.
- `wear ≥ 100` → `status: 'spent'` (no bonus, not faceable) until repair.

**Read rules (mechanics):**
- `effectiveGrade(slot)` = grade − 1 while `wear ≥ 60` → feeds `getFloorDC` (dungeon.ts:266-283) and `highTrapIdx` (raid.ts:142-145). Wear thus softens a floor *during* the raid that abuses it — front floors blunt before the party reaches the Core.
- `attunement ≥ 50`: kink-matched heroes take `mods −1` facing it (KP targetability, defense-side); capture seed gains `+10 corr`; faced-selection weight ×2 via `attunedKink` match (cap: `max(weight, kinkWeight)` — never > Phase 5's ×2… extend to ×3 only if Stage 3 adds desire-seek).
- `attunement ≥ 85`: counts as an ero asset — `+1` floor DC and heroes passing through gain `corrFeed +1` even on pass (DoL exposure loop, dungeon-side).
- `attunedKink` → promptBuilder slot line gets one status word (`worn / spent / disarmed / attuned(kink)`) so narration stays canon.

**Lifecycle (settlement):** `status` → `armed`, `wear` → `max(0, wear −30)` (or full clear via Repair MP spend in Day loop), `attunement`/`attunedKink` persist forever (ratchet, tier 50 floor). Cross-wave asset growth parallels monster evolution — Endless runs gain a dungeon-building axis.

**Harmonization with the debate roadmap:**
- Capture seed (Stage 2) becomes `corr = clamp(5 + (lewd?20) + (aroused?15) + corrFeed×8 + (matchedKink || slot.attunedKink === hero.kinkKey ? 10 : 0) + (slot.attunement ≥ 50 ? 10 : 0), 0, 45)`.
- Endings hook (Agent A's dominion ending): total attunement ≥ threshold = "the dungeon itself has hollowed" — reads a persistent dungeon-level corruption meter for free.
- LLM budget: one status word per slot line, tier-word style — same ruling as prisoner tiers (never raw ints).

**Scope estimate:** ~120–150 engine lines across `types/game.ts` (4 optional fields), `constants.ts` (`TRAP_WEAR`/`ATTUNEMENT` tables), `raid.ts` (beat application + faced-selection skip rules), `dungeon.ts` (`effectiveGrade` in DC), `dayLoop.ts`/estate (repair action + settlement decay), `promptBuilder.ts` (status word); ~30 pure tests (`effectiveGrade`, `slotFaceable`, beat-application table, DC wear regression, snapshot-rewind roundtrip). Schema: optional fields only; `waveStartSnapshot` covers rewind with zero extra work.

**Sequencing:** build AFTER Stage 2 (needs `corrFeed` + capture-seed seam to exist), alongside Stage 3. Rationale: Stage 2 defines the hero-side ledger this system writes into; building Stage 2.5 first would force the capture-seed formula to be touched twice.

---

*Consensus of all three agents: Phase 5 ships unchanged; the player-visible corruption depth lives in Stage 2 (seam) and Stage 3 (lattice), on the persistent prisoner layer. Stage 2.5 (improvised) extends the same seam to the trap side: one beat event, two ledgers — the hero remembers in corrFeed, the trap remembers in attunement.*
