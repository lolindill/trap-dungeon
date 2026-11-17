# Ero Trap Dungeon Maker — Corruption Seam & Trap Lifecycle Implementation Map

## Destination ✅ COMPLETED (2026-11-17) — Corruption Seam & Trap Lifecycle shipped via tickets 26-32, 338/338 green + build green

Ship the corruption/trainer parameter system synthesized by the 2026-11-16 research + 3-way debate (**Phase 5.5 — Corruption Seam**, tickets 26-28) and the improvised harmonized trap-side ledger + trainer depth lattice (**Phase 6 — Trap Lifecycle & Attunement + Trainer Depth**, tickets 29-32) — with the full `vitest` suite green after every ticket.

**Prerequisite ✅ MET (2026-11-16):** Phase 5 (F1 faced-trap ero-gating + F2 capture meter) is built and verified — `decideBeat()` lives in `engine/raid.ts`, `KINK_TRAP_MAP`/`TRAP_ERO_TYPES` exist in `data/constants.ts`, and the `staggered` flag reset rides the settlement resolution point tickets 26/29 extend. 209/209 tests green.

## Source of truth

- **Research + debate:** [../research/phase5-corruption-debate.md](../research/phase5-corruption-debate.md) (external genre research — CoC/TiTS/KP/DoL/RimWorld/DD/trainer-genre; repo label audit; Maximalist vs Minimalist position papers; Architect-Judge ruling; §5 = improvised Stage 2.5, NOT debated — provenance marked).
- **Player thesis (2026-11-16):** "logic ยัง basic ไป ใช้ label ไม่ครบ ขาด corruption parameter แบบ heroine corruption / trainer" — adjudicated TRUE (24 kinks zero mechanical consumers; capture boundary drops hero identity; corr has no passive loop and no raid-side feed; endings never read corr).

## Notes (locked consensus)

- **Judge architecture ruling:** corruption state belongs on the PERSISTENT prisoner layer, not per-hero in-raid meters. Full KP/DoL hero-meter triple REJECTED; one derived hero integer (`corrFeed`) ADOPTED.
- **Pattern rulings:** RimWorld two-phase ADOPT (implicit) · KP targetability ADOPT prison-only (+trap-side attunement) · TiTS ratchet floor ADOPT (corr tier 85; attunement tier 50) · CoC AND-gate lattice ADOPT (conversions + tiers) · DoL loop ADAPT (no pure recovery — comfort jobs add corr) · DD threshold-rolled state REJECT in-raid (resolve roll = wire-or-cut triage in ticket 32, default CUT) · predicted deltas ADOPT UI-only (ticket 31).
- **One beat event, two ledgers (Stage 2.5):** the ero-beat that increments hero `corrFeed` also writes slot `wear`/`attunement` — hero and dungeon corrupt symmetrically.
- **LLM ruling:** tier words and slot status words only — never raw meter ints into prompts.
- **Schema red line:** optional fields only (Phase 5 `staggered` pattern) — no `HeroStatus` change, no schemaVersion bump, no `status === 'alive'` filter touched; `waveStartSnapshot` covers slot-state rewind for free.
- **One-commit rule (balance-wiring precedent):** every ledger write lands with its consumer + cap/reset in the same phase; ticket 29 (write-path) + 30 (read-path) merge as a pair so no write-only state reaches `main`.
- **Numbers are first-pass:** capture seed weights, drift rates, repair pricing, tier bonuses, ending thresholds, and Endless scoring weights are recorded-in-resolution first passes; final tuning rides the balance pass (never inflate difficulty to compensate — balance council red line continues).

## Decisions so far

- [26: corrFeed ledger + capture identity carry](tickets/26-corrfeed-ledger-capture-identity-carry.md): hero `corrFeed` accumulates once per ero-beat (pass/fail) at the beat site; captured prisoners carry kinkKey/persona/skill/weakness; corrFeed resets at the settlement resolution point; `matchedKink` stays a settlement local until ticket 27's seed consumes it.
- [29: trap lifecycle write-path](tickets/29-trap-lifecycle-write-path.md): TrapSlot gains status/wear/attunement/attunedKink behind pure `applyTrapBeat` + `settleTrapSlot` (decay + TIER ratchet); spent/disarmed slots drop out of faced-selection; `migrateFloors` passes the ledger fields through.
- [27: capture seed formula + CORR_TIERS labels](tickets/27-capture-seed-formula-corr-tiers-labels.md): seed = clamp(5 + lewd20 + aroused15 + corrFeed×8 + matchedKink+10, 0, 45) — floor 5, max 45 (Wavering, never a free win); `CORR_TIERS` + pure `corrTier` in `engine/tiers.ts`; tier words on roster prompt + PrisonPanel chips.
- [28: nightly kink drift + comfort-corr](tickets/28-nightly-kink-drift-comfort-corr.md): kink-floor drift corr+1/resist−1 + `COMFORT_JOBS ['bath','tavern']` corr+1 inside the existing settle loop; ratchet clamp site landed (no-op until 31); ledger row per ticket-23 precedent.
- [30: trap read path + repair](tickets/30-trap-read-path-dc-attunement-effects.md): `effectiveGrade` wear softening + spent=0 bonus; attunement ≥50 mods−1 / ≥85 corrFeed pass-through + DC+1; max-weight attuned selection; Repair All 1 AP + 3 MP/slot; prep-intel disarm (1 intel, entry floor, once per prep); prompt status words.
- [31: tier pact mechanics + conversion lattice](tickets/31-corr-tiers-pact-mechanics-conversion-lattice.md): kinkFamily pacts with the 5-tier die/resist/yield/premium table; servant corr AND-clause; `applyCorrDelta` in `engine/tiers.ts` = the single Hollowed-85 ratchet point (absorbed ticket 28's clamp); predicted deltas on pact buttons.
- [32: endings/Endless hooks + resolve-roll triage](tickets/32-endings-endless-hooks-resolve-roll-triage.md): dominion ending at attunement ≥ 300 + 5×corr-100 (Gallery-visible); corr tint at avg 70/30; Endless rank × (1 + avgCorr/200 + attunement/400); in-raid resolve roll triaged **CUT** with rationale recorded.

## Tickets (execution order)

| # | Ticket | Ships |
|---|---|---|
| 26 | [corrFeed ledger + capture identity carry](tickets/26-corrfeed-ledger-capture-identity-carry.md) | Hero `corrFeed` accumulator; Prisoner gains `kinkKey/persona/skill/weakness`; settlement reset |
| 27 | [capture seed formula + `CORR_TIERS` labels](tickets/27-capture-seed-formula-corr-tiers-labels.md) | `corr = clamp(5 + … + corrFeed×8 + matchedKink?10, 0, 45)`; tier words → roster prompt + PrisonPanel |
| 28 | [nightly kink drift + comfort-corr](tickets/28-nightly-kink-drift-comfort-corr.md) | corr passive loop in existing settle map; DoL no-pure-recovery rule; ratchet clamp site |
| 29 | [trap lifecycle write-path](tickets/29-trap-lifecycle-write-path.md) | `TrapSlot.status/wear/attunement/attunedKink`; beat write rules; disarmer counterplay; settle decay + ratchet |
| 30 | [trap read path + repair](tickets/30-trap-read-path-dc-attunement-effects.md) | `effectiveGrade` → DC/highTrapIdx; attunement ≥50/≥85 effects; Repair All AP action; prompt status words |
| 31 | [tier pact mechanics + conversion lattice](tickets/31-corr-tiers-pact-mechanics-conversion-lattice.md) | `kinkFamily` pacts; tier die/resist/yield/premium table; conversion corr clauses; predicted deltas; single ratchet helper |
| 32 | [endings/Endless hooks + resolve-roll triage](tickets/32-endings-endless-hooks-resolve-roll-triage.md) | Dominion ending gate; corr tint; Endless scoring; DD-roll wire-or-cut decision |

## Not yet specified (deferred fog)

*(empty at close — remaining deferred items were ruled out of scope below as follow-on efforts.)*

## Out of scope

- Per-hero in-raid WILL/DESIRE/TRAUMA meters (maximalist bid) — rejected by the judge ruling; revisit only via ticket 32's corrFeed-graduation clause.
- Explicit prose anywhere in mechanics, prompts defaults, or tests — LLM narration stays provider-side.
- Difficulty inflation as compensation for capture-seed rebalance (ticket 27 records the delta instead).
- Audio/PWA/packaging; RisuAI compat; LLM provider work.
- Post-map follow-on efforts, ruled beyond this destination at close (2026-11-17): FloorBoard attunement mini-badge (own UI pass), monster × spent/disarmed-slot interplay (M6-adjacent, own design pass), desire-seek weight ×3 (only if corrFeed ever graduates).
