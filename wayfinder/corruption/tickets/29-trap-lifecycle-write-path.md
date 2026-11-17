---
summary: Give TrapSlot its first runtime state — status/wear/attunement/attunedKink with raid-loop write rules, disarm counterplay and settlement decay
labels: [wayfinder:task]
status: closed *(2026-11-17 — slot write-path shipped: applyTrapBeat/settleTrapSlot, disarm counterplay, faced-selection skip, migrateFloors pass-through; 247/247 green post-merge)*
assignee: kevii/agent-w1-29
---

# 29: Trap Lifecycle I — Slot Status Write-Path (`wear` / `attunement` / `attunedKink`)

**What to build:** Revive Phase 5's rejected "F3 trap-wear" as the improvised Stage 2.5 design (research doc §5): today `TrapSlot` is pure config and raid **never mutates slots** — a trap that fires a beat changes nothing. One beat event, two ledgers: the same ero-beat that increments hero `corrFeed` (ticket 26) writes the slot ledger.

**Status:** open

## Spec

1. **`types/game.ts` — TrapSlot:** optional `status?: 'armed' | 'spent' | 'disarmed'` (absent = armed), `wear?: number` (0-100, temporary), `attunement?: number` (0-100, permanent), `attunedKink?: string`. Optional-fields-only; `waveStartSnapshot` (Phase 2) already snapshots full state → rewind free, no migration.
2. **`data/constants.ts`:**
   ```ts
   export const TRAP_WEAR = { PER_BEAT: 10, PER_BEAT_KINK: 15, SOFT_GRADE: 60, SPENT: 100, SETTLE_DECAY: 30 };
   export const TRAP_ATTUNEMENT = { PER_STAGGER: 15, PER_CAPTURE: 15, TIER: 50, ASCENDANT: 85, RATCHET_FLOOR: 50 };
   ```
3. **`engine/raid.ts` write rules (where the beat resolves, same site as corrFeed):**
   - Any beat vs the faced slot: `wear += PER_BEAT` (faced slot kink-matched: `+= PER_BEAT_KINK`).
   - Beat resolves STAGGERED or CAPTURED by this slot: `attunement += PER_STAGGER/PER_CAPTURE` (cap 100), `attunedKink = hero.kinkKey`.
   - **Disarm counterplay:** `disarmer` hero passes their beat on the faced slot with `margin ≥ 5` → slot `status: 'disarmed'` (audit note). Disarmed slots: skipped by F1 faced-selection, contribute no `TRAP_BONUS`, no wear/attunement writes. Prep-intel disarm action is ticket 30 (UI), not here.
4. **Settlement (`applyWaveSettlement`):** `status → 'armed'`, `wear = max(0, wear − SETTLE_DECAY)`; `attunement`/`attunedKink` persist forever with ratchet `attunement = max(attunement, attunement ≥ TIER ? TIER : attunement)` (TiTS pattern: the trap never forgets a milestone).
5. **No read-side consumers yet** — this ticket is write-only-by-design but ships its read consumers in ticket 30 in the same phase; keep the one-commit red line satisfied by landing 29+30 as a pair (map red line: no write-only state in the merged result).

## Acceptance Criteria

- [ ] Beat application pure function (e.g. `applyTrapBeat(slot, ctx)`) table-tested: pass/fail × kink-matched × stagger/capture → exact wear/attunement/attunedKink
- [ ] Disarm proven only for disarmer + pass + margin ≥ 5 on the faced slot; narrow-beat pass (nimble/ironhide saves) does NOT disarm
- [ ] Settlement decay + ratchet proven across 3 simulated waves (wear → 0, attunement holds)
- [ ] Snapshot rewind roundtrip restores post-beat slot state exactly (extend saveLoad test)
- [ ] Faced-selection skips `spent`/`disarmed` slots (with ticket 30's read path, tested there — here: unit-level selection helper proven)
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-17** — commit `71ed8bb` on `wayfinder/corr-29`, auto-merged into main clean alongside ticket 26 (one-commit red line: the 29+30 pair ships in the same phase, ticket 30 next); combined main = **247/247 green + build green**.

- **Slot state:** `TrapSlot` optional `status?: TrapSlotStatus ('armed'|'spent'|'disarmed')` / `wear?: number` / `attunement?: number` / `attunedKink?: string` — absent = armed/unworn/unattuned.
- **Constants:** `TRAP_WEAR` { PER_BEAT: 10, PER_BEAT_KINK: 15, SOFT_GRADE: 60, SPENT: 100, SETTLE_DECAY: 30 } and `TRAP_ATTUNEMENT` { PER_STAGGER: 15, PER_CAPTURE: 15, TIER: 50, ASCENDANT: 85, RATCHET_FLOOR: 50 } exactly per spec.
- **Write path:** pure `applyTrapBeat(slot, ctx)` (wear per beat ±kink rate → `spent` at 100; attunement +15 on stagger/capture cap 100 with `attunedKink`; disarmer pass margin ≥ 5 → `disarmed`; spent/disarmed receive zero writes) wired in `resolveFloorEncounter` (slots become real copies; `caughtBySlot` set in stagger/captured branches; grit ENDURES intentionally writes no attunement; `[disarmed]` audit note); `settleTrapSlot` in `applyWaveSettlement` (status → armed, wear −30 floor 0, TIER ratchet floor 50); faced-selection gives spent/disarmed weight 0, `selectFacedSlot` picks among active slots only (also fixes a `pickWeighted` roll===0 weight-0-bucket edge) and returns null when nothing is active.
- **Deviations (3):** (1) `migrateFloors` pass-through of the four ledger fields — the migrator rebuilds slot objects field-by-field and would silently DROP ledger state on every save/load AND snapshot restore, breaking the rewind acceptance; optional-spread pattern, no schemaVersion bump, legacy saves byte-identical (tested). (2) disarm margin 5 as `TRAP_DISARM_MARGIN` in raid.ts (constants instruction was "add exactly" the two blocks). (3) a disarmed slot's own disarm beat still writes wear ("any beat vs the faced slot" rule, table-tested).
- **Tests:** `trapLifecycle.test.ts` (27: applyTrapBeat table, disarm table incl. narrow/luck/fail/margin-4 non-disarm + disarm-over-spent, selection skips, raid integration — stagger ledger write, in-raid disarm audit, narrow pass, all-spent floor, multi-hero accumulation, settlement 3-wave sim wear 90→60→30→0 / attunement 55+30 hold, ratchet guard) + snapshot rewind roundtrip + legacy-slot migration shape tests in `migrationAndSlots.test.ts`.
- **Scrutinize addendum (2026-11-18):** `settleTrapSlot`'s TIER ratchet expression was a mathematical no-op (`max(a, a≥TIER ? TIER : a) ≡ a`) guarding a decay path that does not exist — removed together with the dead `TRAP_ATTUNEMENT.RATCHET_FLOOR` mirror (zero consumers); returned state byte-identical, suite green after.
