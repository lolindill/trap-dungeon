import { CFG } from '../data/constants';
import type { FloorState, GameState } from '../types/game';
import { getEstateRaidModifiers } from './estate';
import { resolveExpeditionAftereffects } from './expedition';
import { getNextRaidDcBonus, getPrepIntelLeakBonus } from './officers';
import { clamp } from './rng';

/**
 * Raid-Mods Seam — the single pure resolver that turns previously write-only
 * systems into live raid mechanics:
 *   1. `crises.activeRaidMods`      (written by estate crises / expedition retaliation)
 *   2. `getEstateRaidModifiers`     (estate facilities + town stats)
 *   3. `getNextRaidDcBonus`         (Lilim affection / one-shot DC perks)
 *   4. `resolveExpeditionAftereffects` (war-party aftereffects on hero mods)
 *   5. Mole intel                   (an active double-agent gives hero mods -2)
 *   6. `getPrepIntelLeakBonus`      (Lilim stage-2+ / `prepIntelOnce` → prep intel)
 *
 * Council caps (LOCKED, enforced HERE so no consumer can bypass):
 *   - total external DC delta per roll: [-4, +4]
 *   - firstRoom bucket clamp: [-4, +3]
 *   - allFloors bucket clamp: [-4, +2]
 *
 * Import discipline: this module may import estate/officers/expedition but
 * must NEVER import raid.ts or dungeon.ts (they consume the seam). It must
 * stay pure (no React/UI imports, no Math.random usage).
 */

// --- Council caps (locked consensus) ---
export const RAID_DC_CAP_TOTAL_POS = 4;
export const RAID_DC_CAP_TOTAL_NEG = -4;
export const RAID_DC_CAP_FIRST_ROOM = 3;
export const RAID_DC_CAP_ALL_FLOORS = 2;

const MOLE_HERO_MOD = -2;

export interface RaidModsCtx {
  /** 1-based floor number the roll is for (0 = the Core Room / phase-agnostic query). */
  floorNum: number;
  /** true when this is the first room of the raid (firstRoom bucket applies). */
  isFirstRoom: boolean;
  /** true when the current floor has deployed monsters (guarded floor). */
  hasMonsterOnFloor: boolean;
  /** class key of the hero the hero-mod bucket is being computed for (expedition aftereffects). */
  heroClassKey?: string;
}

export interface RaidModsResult {
  /**
   * First-room DC bucket AFTER council caps, as applied for THIS roll
   * (0 when ctx.isFirstRoom is false or when shed by the total cap).
   */
  firstRoomDcDelta: number;
  /** All-floors DC bucket AFTER council caps (estate + Lilim). */
  allFloorsDcDelta: number;
  /** Ctx-specific floor bucket AFTER caps (trap_off / leakedFloors / guardDcBonus). */
  floorDcDelta: number;
  /**
   * The final, ctx-gated and council-capped DC delta for this exact roll.
   * (= isFirstRoom ? firstRoomDcDelta : 0) + allFloorsDcDelta + floorDcDelta,
   * clamped to [-4, +4]. Consumers must add THIS value — it cannot be bypassed.
   */
  totalDcDelta: number;
  /** Hero-mod delta for this roll: expedition aftereffects ([-2, +2]) + mole intel (-2). */
  heroModDelta: number;
  /** Prep-phase intel delta (estate + crisis `intel`); consumed in workflow.ts finishBuildPhase. */
  prepIntelDelta: number;
  /** Crisis `intel_zero` — forces the whole prep intel (incl. Lens relic) to 0 for the wave. */
  prepIntelZero: boolean;
  /** Core-room capture chance (estate + crisis `core_guard`); consumed in raid.ts breach branch. */
  coreCaptureBonus: number;
  /** Workshop critical-room injury-save chance; consumed in raid.ts narrow-beat branch. */
  critRoomSaveChance: number;
  /** Estate ransom premium; wired into calcPrisonerRansom (debt.ts) via optional param. */
  ransomBonusMult: number;
  /** Audit trail: one entry per contributing source / cap event. */
  notes: string[];
}

// --- internal helpers (pure) ---

function sumMods(state: GameState, key: string): number {
  const mods = state.crises?.activeRaidMods ?? [];
  return mods.reduce((sum, m) => (m.key === key ? sum + m.value : sum), 0);
}

function hasMod(state: GameState, key: string): boolean {
  return (state.crises?.activeRaidMods ?? []).some((m) => m.key === key);
}

/** Trap-only DC power of a floor, mirroring dungeon.getFloorDC's base formula (no state deps). */
function floorTrapPower(floor: FloorState): number {
  const trapSum = floor.slots.reduce(
    (sum, s) => sum + (s.grade !== '?' ? CFG.TRAP_BONUS[s.grade] : 0),
    0
  );
  const syn = floor.synergy;
  const synBonus =
    floor.slots.length >= 2 && syn !== '?' && syn !== '-' ? CFG.SYNERGY_BONUS[syn] : 0;
  return CFG.DC_BASE + Math.floor((floor.floor - 1) / 3) + clamp(trapSum + synBonus, 0, CFG.FLOOR_CAP);
}

/** The N lowest-DC occupied (trapped) floors, ties broken by floor number. */
function lowestDcOccupiedFloors(state: GameState, count: number): number[] {
  const ranked = (state.floors ?? [])
    .filter((f) => f.slots.length > 0)
    .sort((a, b) => floorTrapPower(a) - floorTrapPower(b) || a.floor - b.floor);
  return ranked.slice(0, Math.max(0, count)).map((f) => f.floor);
}

const fmt = (v: number): string => {
  const n = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
  return v > 0 ? `+${n}` : n;
};

/**
 * The single seam. Pure: same (state, ctx) -> same result; no Math.random.
 */
export function resolveRaidModifiers(state: GameState, ctx: RaidModsCtx): RaidModsResult {
  const notes: string[] = [];
  const estate = getEstateRaidModifiers(state);
  const lilim = getNextRaidDcBonus(state);

  // ---- 1. First-room DC bucket (estate + Lilim + crisis `first_dc`) ----
  let firstRoomRaw = estate.firstRoomDcDelta;
  if (estate.firstRoomDcDelta !== 0) notes.push(`estate:firstRoom ${fmt(estate.firstRoomDcDelta)}`);
  if (lilim.firstRoomDcBonus !== 0) {
    firstRoomRaw += lilim.firstRoomDcBonus;
    notes.push(`lilim:firstRoom ${fmt(lilim.firstRoomDcBonus)}`);
  }
  const firstDcMods = sumMods(state, 'first_dc');
  if (firstDcMods !== 0) {
    firstRoomRaw += firstDcMods;
    notes.push(`activeRaidMods:first_dc ${fmt(firstDcMods)} (first room only)`);
  }
  const firstRoomDcDelta = clamp(firstRoomRaw, RAID_DC_CAP_TOTAL_NEG, RAID_DC_CAP_FIRST_ROOM);
  if (firstRoomDcDelta !== firstRoomRaw) {
    notes.push(`capped: firstRoom clamped to ${fmt(firstRoomDcDelta)}`);
  }

  // ---- 2. All-floors DC bucket (estate + Lilim) ----
  let allFloorsRaw = estate.allFloorsDcDelta;
  if (estate.allFloorsDcDelta !== 0) notes.push(`estate:allFloors ${fmt(estate.allFloorsDcDelta)}`);
  if (lilim.allFloorsDcBonus !== 0) {
    allFloorsRaw += lilim.allFloorsDcBonus;
    notes.push(`lilim:allFloors ${fmt(lilim.allFloorsDcBonus)}`);
  }
  const allFloorsDcDelta = clamp(allFloorsRaw, RAID_DC_CAP_TOTAL_NEG, RAID_DC_CAP_ALL_FLOORS);
  if (allFloorsDcDelta !== allFloorsRaw) {
    notes.push(`capped: allFloors clamped to ${fmt(allFloorsDcDelta)}`);
  }

  // ---- 3. Ctx-specific floor bucket (trap_off, leakedFloors, guardDcBonus) ----
  let floorRaw = 0;
  const trapOffRooms = sumMods(state, 'trap_off');
  if (trapOffRooms > 0) {
    const affected = lowestDcOccupiedFloors(state, trapOffRooms);
    if (affected.includes(ctx.floorNum)) {
      floorRaw -= 2;
      notes.push(`activeRaidMods:trap_off -2 (${ctx.floorNum}F)`);
    }
  }
  if (estate.leakedFloors > 0) {
    const leaked = lowestDcOccupiedFloors(state, estate.leakedFloors);
    if (leaked.includes(ctx.floorNum)) {
      floorRaw -= 2;
      notes.push(`estate:leakedFloors -2 (${ctx.floorNum}F)`);
    }
  }
  if (estate.guardDcBonus > 0 && ctx.hasMonsterOnFloor) {
    floorRaw += estate.guardDcBonus;
    notes.push(`estate:guardDc ${fmt(estate.guardDcBonus)} (guarded floor)`);
  }
  const floorDcDelta = clamp(floorRaw, RAID_DC_CAP_TOTAL_NEG, RAID_DC_CAP_TOTAL_POS);
  if (floorDcDelta !== floorRaw) {
    notes.push(`capped: floor DC clamped to ${fmt(floorDcDelta)}`);
  }

  // ---- 4. Council total cap: gated sum clamped to [-4, +4] ----
  let gatedFirst = ctx.isFirstRoom ? firstRoomDcDelta : 0;
  let gatedAll = allFloorsDcDelta;
  let gatedFloor = floorDcDelta;
  let total = gatedFirst + gatedAll + gatedFloor;
  if (total > RAID_DC_CAP_TOTAL_POS) {
    let excess = total - RAID_DC_CAP_TOTAL_POS;
    // Shed ctx-specific bucket first, then firstRoom, then allFloors.
    const buckets: ('floor' | 'first' | 'all')[] = ['floor', 'first', 'all'];
    for (const b of buckets) {
      if (excess <= 0) break;
      if (b === 'floor' && gatedFloor > 0) {
        const take = Math.min(gatedFloor, excess);
        gatedFloor -= take;
        excess -= take;
      } else if (b === 'first' && gatedFirst > 0) {
        const take = Math.min(gatedFirst, excess);
        gatedFirst -= take;
        excess -= take;
      } else if (b === 'all' && gatedAll > 0) {
        const take = Math.min(gatedAll, excess);
        gatedAll -= take;
        excess -= take;
      }
    }
    total = gatedFirst + gatedAll + gatedFloor;
    notes.push(`capped: total DC clamped to +${RAID_DC_CAP_TOTAL_POS}`);
  } else if (total < RAID_DC_CAP_TOTAL_NEG) {
    let deficit = RAID_DC_CAP_TOTAL_NEG - total;
    // Restore ctx-specific bucket first, then allFloors, then firstRoom.
    const buckets: ('floor' | 'all' | 'first')[] = ['floor', 'all', 'first'];
    for (const b of buckets) {
      if (deficit <= 0) break;
      if (b === 'floor' && gatedFloor < 0) {
        const give = Math.min(-gatedFloor, deficit);
        gatedFloor += give;
        deficit -= give;
      } else if (b === 'all' && gatedAll < 0) {
        const give = Math.min(-gatedAll, deficit);
        gatedAll += give;
        deficit -= give;
      } else if (b === 'first' && gatedFirst < 0) {
        const give = Math.min(-gatedFirst, deficit);
        gatedFirst += give;
        deficit -= give;
      }
    }
    total = gatedFirst + gatedAll + gatedFloor;
    notes.push(`capped: total DC clamped to ${RAID_DC_CAP_TOTAL_NEG}`);
  }

  // ---- 5. Hero-mod bucket (expedition aftereffects + mole intel) ----
  let heroModDelta = 0;
  if ((state.expedition?.afterEffects?.length ?? 0) > 0) {
    const expedition = resolveExpeditionAftereffects(state, {
      heroClassKey: ctx.heroClassKey,
      floorNum: ctx.floorNum,
      hasMonsterOnFloor: ctx.hasMonsterOnFloor,
    });
    heroModDelta += expedition.mod;
    for (const n of expedition.notes) notes.push(`expedition:${n}`);
  }
  const moleActive = (state.prisoners ?? []).some((p) => (p.moleRaidsLeft ?? 0) > 0);
  if (moleActive) {
    heroModDelta += MOLE_HERO_MOD;
    notes.push(`moleIntel: hero mods ${fmt(MOLE_HERO_MOD)}`);
  }

  // ---- 6. Prep intel (consumed at the workflow.ts prep-intel site) ----
  let prepIntelDelta = 0;
  let prepIntelZero = false;
  // Ticket 18: Lilim officer-side intel leak (stage >= 2 / `prepIntelOnce`
  // perk) enters here as a resolver source — never at the consumer.
  const lilimPrepIntel = getPrepIntelLeakBonus(state).prepIntel;
  if (lilimPrepIntel > 0) {
    prepIntelDelta += lilimPrepIntel;
    notes.push(`lilim:prepIntel ${fmt(lilimPrepIntel)}`);
  }
  if (estate.prepIntelDelta !== 0) {
    prepIntelDelta += estate.prepIntelDelta;
    notes.push(`estate:prepIntel ${fmt(estate.prepIntelDelta)}`);
  }
  const intelMods = sumMods(state, 'intel');
  if (intelMods !== 0) {
    prepIntelDelta += intelMods;
    notes.push(`activeRaidMods:intel ${fmt(intelMods)}`);
  }
  if (hasMod(state, 'intel_zero')) {
    prepIntelZero = true;
    prepIntelDelta = 0;
    notes.push('activeRaidMods:intel_zero → prep intel 0');
  }

  // ---- 7. Core capture & misc pass-throughs ----
  const coreCaptureBonus = estate.coreCaptureBonus + sumMods(state, 'core_guard');
  if (estate.coreCaptureBonus > 0) notes.push(`estate:coreCapture ${fmt(estate.coreCaptureBonus)}`);
  const coreGuardMods = sumMods(state, 'core_guard');
  if (coreGuardMods > 0) notes.push(`activeRaidMods:core_guard ${fmt(coreGuardMods)}`);

  return {
    firstRoomDcDelta: gatedFirst,
    allFloorsDcDelta: gatedAll,
    floorDcDelta: gatedFloor,
    totalDcDelta: total,
    heroModDelta,
    prepIntelDelta,
    prepIntelZero,
    coreCaptureBonus,
    critRoomSaveChance: estate.critRoomSaveChance,
    ransomBonusMult: estate.ransomBonusMult,
    notes,
  };
}

// --- Ticket 16: one-shot raid-mod lifecycle -------------------------------
// Every key currently written into `crises.activeRaidMods` (estate crises at
// resolveSettlementCrisis, expedition retaliation at finalizeExpedition) is a
// "NEXT raid" promise. The raid consumes it during resolveFloorEncounter /
// the core-room capture branch, and applyWaveSettlement — the single
// end-of-raid resolution point — must expire it so ticket 15's seam cannot
// ship permanent buffs.

/**
 * All mod keys the raid consumes. Every entry in `crises.activeRaidMods`
 * carrying one of these keys is one-shot and is purged at settlement.
 * Future writers that add a genuinely persistent key must NOT list it here.
 */
export const CONSUMED_RAID_MOD_KEYS: readonly string[] = [
  'first_dc',
  'trap_off',
  'core_guard',
  'hero_up',
  'hero_down',
  'hero_injured',
  'intel',
  'intel_zero',
];

export interface ActiveRaidMod {
  key: string;
  value: number;
}

/**
 * Normalize an activeRaidMods array: drop exact duplicates (same key AND
 * value), preserving first-seen order. Used both at the write sites (estate
 * crisis application used to spread without dedupe, so repeated crises with
 * the same rolled mod stacked identical entries) and in the purge path.
 * Same-key-different-value entries are intentionally kept: the resolver sums
 * values, so distinct rolls legitimately stack.
 */
export function normalizeActiveRaidMods(mods: ActiveRaidMod[]): ActiveRaidMod[] {
  const seen = new Set<string>();
  const out: ActiveRaidMod[] = [];
  for (const m of mods) {
    const id = `${m.key}=${m.value}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ key: m.key, value: m.value });
  }
  return out;
}

/**
 * The settlement-side expiry: remove every entry whose key the raid consumes,
 * then normalize what remains. Pure; returns a new array.
 */
export function purgeConsumedRaidMods(mods: ActiveRaidMod[]): ActiveRaidMod[] {
  const consumed = new Set<string>(CONSUMED_RAID_MOD_KEYS);
  return normalizeActiveRaidMods(mods.filter((m) => !consumed.has(m.key)));
}
