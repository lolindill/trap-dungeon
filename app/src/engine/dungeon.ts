import { CFG } from '../data/constants';
import {
  FLOOR_LINK_RULES,
  MONSTER_CFG,
  getMonsterDisplayName,
  getMonsterLineage,
} from '../data/monsterData';
import {
  CODEX_COMBOS,
  CODEX_TRAPS,
  codexComboToBlueprint,
  codexTrapToBlueprint,
  getCodexTrapById,
  type CodexTrapEntry,
} from '../data/trapCodex';
import type {
  FloorCombatSlot,
  FloorState,
  GameState,
  MonsterInstance,
  Prisoner,
  RoomBlueprintSlot,
  SynergyGrade,
  TrapBlueprint,
  TrapGrade,
  TrapSlot,
} from '../types/game';
import { heroGradeIndex } from './heroes';
import { isMonsterDeployed, isMonsterHurt } from './monsters';
import { clamp, uid } from './rng';

const TRAP_ORDER: Record<TrapGrade, number> = {
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SS: 6,
  SSS: 7,
};

export function isTrapGrade(g: string): g is TrapGrade {
  return g in CFG.TRAP_BONUS;
}

export function isSynergyGrade(g: string): g is Exclude<SynergyGrade, '?' | '-'> {
  return g in CFG.SYNERGY_BONUS;
}

export function trapGradeIndex(g: string): number {
  return TRAP_ORDER[g as TrapGrade] ?? 0;
}

export function createEmptyFloors(): FloorState[] {
  return Array.from({ length: CFG.FLOORS }, (_, idx) => ({
    floor: idx + 1,
    slots: [],
    synergy: '-',
  }));
}

export function getInstallCost(currentSlotCount: number): number | null {
  if (currentSlotCount < 0 || currentSlotCount >= CFG.SLOTS) return null;
  return CFG.INSTALL_COST[currentSlotCount] ?? null;
}

/**
 * Total cumulative MP cost to install `roomSlotCount` traps starting at `currentSlotCount`.
 * Returns null if the floor cannot fit all `roomSlotCount` traps.
 */
export function getRoomInstallCost(currentSlotCount: number, roomSlotCount: number): number | null {
  if (roomSlotCount <= 0 || currentSlotCount < 0 || currentSlotCount + roomSlotCount > CFG.SLOTS) {
    return null;
  }
  let total = 0;
  for (let i = 0; i < roomSlotCount; i++) {
    const step = getInstallCost(currentSlotCount + i);
    if (step === null) return null;
    total += step;
  }
  return total;
}

/**
 * Infers current occupied slot count (0..CFG.SLOTS) from the next single-slot install cost.
 */
export function inferSlotCountFromNextCost(nextSlotCost: number | null): number {
  if (nextSlotCost === null) return CFG.SLOTS;
  const idx = (CFG.INSTALL_COST as readonly number[]).indexOf(nextSlotCost);
  return idx >= 0 ? idx : 0;
}

export function getUpgradeCost(grade: TrapSlot['grade']): number | null {
  if (grade === '?') return null;
  return CFG.UPGRADE_COST[grade] ?? null;
}

export function getNextGrade(grade: TrapSlot['grade']): TrapGrade | null {
  if (grade === '?') return null;
  return CFG.NEXT_GRADE[grade] ?? null;
}

export function normalizeSynergy(slots: TrapSlot[], current: SynergyGrade): SynergyGrade {
  if (slots.length < 2) return '-';
  return isSynergyGrade(current) ? current : '?';
}

export interface FloorCombatBonusInfo {
  bonus: number;
  rawBonus: number;
  breakdown: string[];
  hasPrefBonus: boolean;
  guardCount: number;
  hasFighter: boolean;
}

export interface FloorLinkInstance {
  fromFloor: number;
  toFloor: number;
  penalty: 1 | 2;
  rank: 'A' | 'B';
  tagA: string;
  tagB: string;
  label: string;
  desc: string;
}

export function getFloorCombatSlots(floor: FloorState): FloorCombatSlot[] {
  return floor.combatSlots ?? [];
}

export function isMonsterPrefMatch(floor: FloorState, lineageKey: string): boolean {
  const pref = getMonsterLineage(lineageKey).prefTag;
  if (!pref) return false;
  return floor.slots.some((s) => s.types.includes(pref));
}

export function getFighterFloorDC(prisoner: Prisoner): number {
  return heroGradeIndex(prisoner.grade) >= 4 ? 2 : 1;
}

export function getFloorCombatBonus(state: GameState, floor: FloorState): FloorCombatBonusInfo {
  if (floor.slots.length === 0) {
    return {
      bonus: 0,
      rawBonus: 0,
      breakdown: [],
      hasPrefBonus: false,
      guardCount: 0,
      hasFighter: false,
    };
  }

  let rawBonus = 0;
  const breakdown: string[] = [];
  let hasPrefBonus = false;
  let guardCount = 0;
  let hasFighter = false;

  for (const cs of getFloorCombatSlots(floor)) {
    if (cs.kind === 'monster') {
      const mob = state.monsters.find((m) => m.id === cs.monsterId);
      if (!mob || isMonsterHurt(state, mob)) continue;
      guardCount += 1;
      const prefMatch = isMonsterPrefMatch(floor, mob.lineage);
      const val = mob.stars + (prefMatch ? 1 : 0);
      rawBonus += val;
      if (prefMatch) hasPrefBonus = true;
      breakdown.push(
        `${getMonsterDisplayName(mob)} +${mob.stars}${prefMatch ? ' (🏠 PREF +1)' : ''}`
      );
    } else {
      const p = state.prisoners.find((x) => x.pid === cs.pid);
      if (!p || p.job !== null || p.dying || p.stamina <= 0) continue;
      guardCount += 1;
      hasFighter = true;
      const val = getFighterFloorDC(p);
      rawBonus += val;
      breakdown.push(`⚔ ${p.name} +${val}`);
    }
  }

  if (state.estate.landmarks.lab && floor.labBuff) {
    rawBonus += 1;
    breakdown.push('🔬 Lab +1');
  }

  const hasConvertedGuardHere = state.prisoners.some(
    (p) => p.converted === 'guard' && p.assignedFloor === floor.floor
  );
  if (state.estate.landmarks.cmd && (guardCount > 0 || hasConvertedGuardHere)) {
    rawBonus += 1;
    breakdown.push('🏴 Cmd +1');
  }

  return {
    bonus: Math.min(MONSTER_CFG.FSLOT.DC_CAP, rawBonus),
    rawBonus,
    breakdown,
    hasPrefBonus,
    guardCount,
    hasFighter,
  };
}

export function getFloorLinks(state: GameState): FloorLinkInstance[] {
  const occupied = state.floors.filter((f) => f.slots.length > 0);
  const out: FloorLinkInstance[] = [];

  for (let i = 0; i < occupied.length - 1; i++) {
    if (out.length >= MONSTER_CFG.LINK.MAX_ACTIVE) break;
    const a = occupied[i];
    const b = occupied[i + 1];
    const tagsA = new Set(a.slots.flatMap((s) => s.types));
    const tagsB = new Set(b.slots.flatMap((s) => s.types));
    const hiA = a.slots.reduce((mx, s) => Math.max(mx, trapGradeIndex(s.grade)), 0);
    const hiB = b.slots.reduce((mx, s) => Math.max(mx, trapGradeIndex(s.grade)), 0);
    const penalty: 1 | 2 = hiA >= 3 && hiB >= 3 ? 2 : 1;

    let best: FloorLinkInstance | null = null;
    for (const rule of FLOOR_LINK_RULES) {
      if (tagsA.has(rule.tagA) && tagsB.has(rule.tagB)) {
        if (!best || penalty > best.penalty) {
          best = {
            fromFloor: a.floor,
            toFloor: b.floor,
            penalty,
            rank: penalty >= 2 ? 'A' : 'B',
            tagA: rule.tagA,
            tagB: rule.tagB,
            label: rule.label,
            desc: rule.desc,
          };
        }
      }
    }

    if (!best) {
      const hasActiveFighter = getFloorCombatSlots(a).some((cs) => {
        if (cs.kind !== 'prisoner') return false;
        const p = state.prisoners.find((x) => x.pid === cs.pid);
        return Boolean(p && p.job === null && !p.dying && p.stamina > 0);
      });
      if (hasActiveFighter) {
        best = {
          fromFloor: a.floor,
          toFloor: b.floor,
          penalty: 1,
          rank: 'B',
          tagA: 'fighter',
          tagB: 'any',
          label: 'Captive Fighter Exhaustion',
          desc: 'heroes worn out by the captive fighter stumble into the next room',
        };
      }
    }

    if (best) out.push(best);
  }

  return out;
}

export function getFloorDC(floor: FloorState, state?: GameState): number {
  const synBonus = floor.slots.length >= 2 && isSynergyGrade(floor.synergy)
    ? CFG.SYNERGY_BONUS[floor.synergy]
    : 0;
  const trapSum = floor.slots.reduce(
    (sum, s) => sum + (s.grade !== '?' ? CFG.TRAP_BONUS[s.grade] : 0),
    0
  );
  const baseDc = CFG.DC_BASE + Math.floor((floor.floor - 1) / 3) + clamp(trapSum + synBonus, 0, CFG.FLOOR_CAP);
  if (!state || floor.slots.length === 0) return baseDc;
  const shieldBonus = floor.floor === 1 && state.relics?.owned.includes('shield') ? 1 : 0;
  return baseDc + getFloorCombatBonus(state, floor).bonus + shieldBonus;
}

export function getTotalTrapCount(floors: FloorState[]): number {
  return floors.reduce((sum, f) => sum + f.slots.length, 0);
}

export function getNextTrapFloor(floors: FloorState[], fromFloor: number): FloorState | null {
  for (const f of floors) {
    if (f.floor >= fromFloor && f.slots.length > 0) return f;
  }
  return null;
}

export function formatFloorRoomText(floor: FloorState): string {
  if (floor.slots.length === 0) return '(empty)';
  const parts = floor.slots.map(
    (s, idx) => `#${idx + 1} ${s.text} (${s.grade === '?' ? 'unrated' : s.grade})`
  );
  const synText =
    floor.slots.length >= 2
      ? ` · combo: ${floor.synergy === '?' ? 'unrated' : floor.synergy}`
      : '';
  return `${parts.join(' · ')}${synText}`;
}

export function formatAllFloorsText(floors: FloorState[]): string {
  const lines: string[] = [];
  for (const f of floors) {
    if (f.slots.length > 0) {
      lines.push(`${f.floor}F (DC ${getFloorDC(f)}): ${formatFloorRoomText(f)}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : 'No traps yet; every floor is empty.';
}

export function buildPrepListPayload(floors: FloorState[]): {
  listText: string;
  newTrapIds: string[];
  comboFloors: number[];
} {
  const lines: string[] = [];
  const empty: string[] = [];
  const newTrapIds: string[] = [];
  const comboFloors: number[] = [];

  for (const f of floors) {
    if (f.slots.length === 0) {
      empty.push(`${f.floor}F`);
      continue;
    }
    const items = f.slots.map((s, idx) => {
      const slotNum = idx + 1;
      if (s.grade === '?') {
        newTrapIds.push(`${f.floor}-${slotNum}`);
        return `[${f.floor}-${slotNum}] ${s.text} — NEW`;
      }
      return `[${f.floor}-${slotNum}] ${s.text} — ${s.grade}`;
    });
    let line = `${f.floor}F: ${items.join(' · ')}`;
    if (f.slots.length >= 2) {
      if (f.synergy === '?') {
        line += ' → combination: COMBO?';
        comboFloors.push(f.floor);
      } else {
        line += ` → combination ${f.synergy}`;
      }
    }
    lines.push(line);
  }

  if (lines.length === 0) lines.push('(no traps installed)');
  if (empty.length > 0) {
    lines.push(`Empty floors (heroes walk through): ${empty.join(', ')}`);
  }

  return { listText: lines.join('\n'), newTrapIds, comboFloors };
}

export function installCustomTrap(
  state: GameState,
  floorNum: number,
  rawText: string
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build') {
    return { state, ok: false, message: 'Traps can only be installed in Build mode.' };
  }
  const text = rawText.trim().replace(/[\r\n\t]+/g, ' ').slice(0, CFG.NAME_MAXLEN);
  if (!text) return { state, ok: false, message: 'Trap description cannot be empty.' };

  const floorIdx = floorNum - 1;
  const floor = state.floors[floorIdx];
  if (!floor) return { state, ok: false, message: 'Invalid floor.' };

  const cost = getInstallCost(floor.slots.length);
  if (cost === null) {
    return { state, ok: false, message: `Floor ${floorNum} is full (max ${CFG.SLOTS} traps).` };
  }
  if (state.points < cost) {
    return { state, ok: false, message: `Not enough MP (need ${cost} MP, have ${state.points} MP).` };
  }

  const newSlot: TrapSlot = {
    id: uid('trap'),
    text,
    grade: '?',
    types: [],
    mpInvested: cost,
  };

  const nextSlots = [...floor.slots, newSlot];
  const nextFloors = state.floors.map((f, idx) =>
    idx === floorIdx
      ? { ...f, slots: nextSlots, synergy: normalizeSynergy(nextSlots, '?') }
      : f
  );

  const msg = `${floorNum}F installed "${text.slice(0, 28)}" (unrated) · -${cost} MP`;
  return {
    state: {
      ...state,
      points: state.points - cost,
      floors: nextFloors,
      selectedFloor: floorNum,
      flash: msg,
    },
    ok: true,
    message: msg,
  };
}

export function installBlueprintToFloor(
  state: GameState,
  floorNum: number,
  blueprint: TrapBlueprint
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build') {
    return { state, ok: false, message: 'Traps can only be installed in Build mode.' };
  }
  const floorIdx = floorNum - 1;
  const floor = state.floors[floorIdx];
  if (!floor) return { state, ok: false, message: 'Invalid floor.' };

  if (blueprint.kind === 'room') {
    const roomSlots = blueprint.roomSlots ?? [];
    if (roomSlots.length === 0) {
      return { state, ok: false, message: `Room shortcut "${blueprint.name}" has no trap slots.` };
    }
    const freeSlots = CFG.SLOTS - floor.slots.length;
    if (freeSlots < roomSlots.length) {
      return {
        state,
        ok: false,
        message: `${floorNum}F needs ${roomSlots.length} free slots for "${blueprint.name}" (${freeSlots} free).`,
      };
    }
    const totalCost = getRoomInstallCost(floor.slots.length, roomSlots.length);
    if (totalCost === null) {
      return { state, ok: false, message: `Floor ${floorNum} cannot fit room "${blueprint.name}".` };
    }
    if (state.points < totalCost) {
      return {
        state,
        ok: false,
        message: `Not enough MP for room "${blueprint.name}" (need ${totalCost} MP, have ${state.points} MP).`,
      };
    }

    const newSlots: TrapSlot[] = roomSlots.map((rs, idx) => {
      const slotCost = getInstallCost(floor.slots.length + idx)!;
      const combinedText = `${rs.name} — ${rs.detail}`.slice(0, CFG.NAME_MAXLEN);
      return {
        id: uid('trap'),
        text: combinedText,
        grade: rs.grade,
        types: [...rs.types],
        mpInvested: slotCost,
        blueprintId: blueprint.id,
      };
    });

    const nextSlots = [...floor.slots, ...newSlots];
    const desiredSynergy: SynergyGrade =
      blueprint.roomSynergy && isSynergyGrade(blueprint.roomSynergy)
        ? blueprint.roomSynergy
        : '?';
    const nextSynergy = normalizeSynergy(nextSlots, desiredSynergy);
    const nextFloors = state.floors.map((f, idx) =>
      idx === floorIdx ? { ...f, slots: nextSlots, synergy: nextSynergy } : f
    );

    const synLabel = nextSynergy === '?' ? 'Synergy ?' : `Synergy ${nextSynergy}`;
    const msg = `${floorNum}F deployed room "${blueprint.name}" (${newSlots.length} traps, ${synLabel}) · -${totalCost} MP`;
    return {
      state: {
        ...state,
        points: state.points - totalCost,
        floors: nextFloors,
        selectedFloor: floorNum,
        flash: msg,
      },
      ok: true,
      message: msg,
    };
  }

  const cost = getInstallCost(floor.slots.length);
  if (cost === null) {
    return { state, ok: false, message: `Floor ${floorNum} is full (max ${CFG.SLOTS} traps).` };
  }
  if (state.points < cost) {
    return { state, ok: false, message: `Not enough MP (need ${cost} MP, have ${state.points} MP).` };
  }

  const combinedText = `${blueprint.name} — ${blueprint.detail}`.slice(0, CFG.NAME_MAXLEN);
  const newSlot: TrapSlot = {
    id: uid('trap'),
    text: combinedText,
    grade: blueprint.grade,
    types: [...blueprint.types],
    mpInvested: cost,
    blueprintId: blueprint.id,
  };

  const nextSlots = [...floor.slots, newSlot];
  const nextFloors = state.floors.map((f, idx) =>
    idx === floorIdx
      ? { ...f, slots: nextSlots, synergy: normalizeSynergy(nextSlots, '?') }
      : f
  );

  const gradeBadge = blueprint.grade === '?' ? 'unrated' : `pre-rated ${blueprint.grade}`;
  const msg = `${floorNum}F deployed shortcut "${blueprint.name}" (${gradeBadge}) · -${cost} MP`;
  return {
    state: {
      ...state,
      points: state.points - cost,
      floors: nextFloors,
      selectedFloor: floorNum,
      flash: msg,
    },
    ok: true,
    message: msg,
  };
}

export function upgradeTrapOnFloor(
  state: GameState,
  floorNum: number,
  slotIdx: number
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build') {
    return { state, ok: false, message: 'Upgrades are only allowed in Build mode.' };
  }
  const floor = state.floors[floorNum - 1];
  const slot = floor?.slots[slotIdx];
  if (!floor || !slot) return { state, ok: false, message: 'Trap slot not found.' };
  if (slot.grade === '?') {
    return { state, ok: false, message: 'Unrated traps must be graded in Prep (or via Shortcut) before upgrading.' };
  }
  const nextGrade = getNextGrade(slot.grade);
  const cost = getUpgradeCost(slot.grade);
  if (!nextGrade || cost === undefined || cost === null) {
    return { state, ok: false, message: 'Already at maximum grade (SSS).' };
  }
  if (state.points < cost) {
    return { state, ok: false, message: `Need ${cost} MP to upgrade to ${nextGrade}.` };
  }

  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1
      ? {
          ...f,
          slots: f.slots.map((s, sIdx) =>
            sIdx === slotIdx ? { ...s, grade: nextGrade, mpInvested: s.mpInvested + cost } : s
          ),
        }
      : f
  );

  const msg = `${floorNum}F upgraded ${slot.grade} → ${nextGrade} · -${cost} MP`;
  return {
    state: {
      ...state,
      points: state.points - cost,
      floors: nextFloors,
      flash: msg,
    },
    ok: true,
    message: msg,
  };
}

export function renameTrapOnFloor(
  state: GameState,
  floorNum: number,
  slotIdx: number,
  newText: string
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build') return { state, ok: false, message: 'Only editable in Build mode.' };
  const floor = state.floors[floorNum - 1];
  const slot = floor?.slots[slotIdx];
  if (!floor || !slot) return { state, ok: false, message: 'Trap not found.' };
  if (slot.grade !== '?') {
    return { state, ok: false, message: 'Rated traps cannot be renamed; dismantle and reinstall instead.' };
  }
  const cleanText = newText.trim().replace(/[\r\n\t]+/g, ' ').slice(0, CFG.NAME_MAXLEN);
  if (!cleanText) return { state, ok: false, message: 'Name cannot be empty.' };

  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1
      ? {
          ...f,
          synergy: normalizeSynergy(f.slots, '?'),
          slots: f.slots.map((s, sIdx) => (sIdx === slotIdx ? { ...s, text: cleanText } : s)),
        }
      : f
  );

  const msg = `${floorNum}F renamed trap #${slotIdx + 1}`;
  return { state: { ...state, floors: nextFloors, flash: msg }, ok: true, message: msg };
}

export function removeTrapFromFloor(
  state: GameState,
  floorNum: number,
  slotIdx: number
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build') return { state, ok: false, message: 'Can only dismantle in Build mode.' };
  const floor = state.floors[floorNum - 1];
  const slot = floor?.slots[slotIdx];
  if (!floor || !slot) return { state, ok: false, message: 'Trap not found.' };

  const refund = Math.floor(slot.mpInvested * CFG.REFUND_RATE);
  const nextSlots = floor.slots.filter((_, i) => i !== slotIdx);
  const removedCombat = nextSlots.length === 0 ? getFloorCombatSlots(floor) : [];
  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1
      ? {
          ...f,
          slots: nextSlots,
          synergy: (nextSlots.length < 2 ? '-' : '?') as SynergyGrade,
          ...(nextSlots.length === 0 ? { combatSlots: [] } : {}),
        }
      : f
  );

  let nextMonsters = state.monsters;
  let nextPrisoners = state.prisoners;
  if (removedCombat.length > 0) {
    const freedMobIds = new Set(
      removedCombat
        .filter((c): c is Extract<FloorCombatSlot, { kind: 'monster' }> => c.kind === 'monster')
        .map((c) => c.monsterId)
    );
    const freedPids = new Set(
      removedCombat
        .filter((c): c is Extract<FloorCombatSlot, { kind: 'prisoner' }> => c.kind === 'prisoner')
        .map((c) => c.pid)
    );
    if (freedMobIds.size > 0) {
      nextMonsters = nextMonsters.map((m) =>
        freedMobIds.has(m.id) ? { ...m, deployedFloor: null } : m
      );
    }
    if (freedPids.size > 0) {
      nextPrisoners = nextPrisoners.map((p) =>
        freedPids.has(p.pid) ? { ...p, assignedFloor: null } : p
      );
    }
  }

  const msg = `${floorNum}F dismantled trap · +${refund} MP refunded`;
  return {
    state: {
      ...state,
      points: state.points + refund,
      floors: nextFloors,
      monsters: nextMonsters,
      prisoners: nextPrisoners,
      flash: msg,
    },
    ok: true,
    message: msg,
  };
}

export function getEligibleFloorMonsters(state: GameState): MonsterInstance[] {
  return state.monsters.filter(
    (m) => !isMonsterHurt(state, m) && !isMonsterDeployed(state, m)
  );
}

export function getEligibleFloorFighters(state: GameState): Prisoner[] {
  return state.prisoners.filter(
    (p) =>
      p.converted === null &&
      !(p.moleRaidsLeft && p.moleRaidsLeft > 0) &&
      p.job === null &&
      p.assignedFloor === null &&
      !p.dying &&
      p.stamina >= MONSTER_CFG.FSLOT.FIGHTER_MIN_STAMINA
  );
}

export function assignMonsterToFloor(
  state: GameState,
  floorNum: number,
  monsterId: string
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build' && state.mode !== 'estate') {
    return { state, ok: false, message: 'Floor guards can only be changed in Build or Estate mode.' };
  }
  const floor = state.floors[floorNum - 1];
  if (!floor) return { state, ok: false, message: 'Invalid floor.' };
  if (floor.slots.length === 0) {
    return { state, ok: false, message: `Install at least 1 trap on ${floorNum}F first.` };
  }
  const current = getFloorCombatSlots(floor);
  if (current.length >= MONSTER_CFG.FSLOT.MAX_PER_FLOOR) {
    return { state, ok: false, message: `${floorNum}F guards full (max ${MONSTER_CFG.FSLOT.MAX_PER_FLOOR}).` };
  }
  const mob = state.monsters.find((m) => m.id === monsterId);
  if (!mob) return { state, ok: false, message: 'Monster not found.' };
  if (isMonsterHurt(state, mob)) {
    return { state, ok: false, message: 'Injured or tired monsters cannot be deployed.' };
  }
  if (isMonsterDeployed(state, mob)) {
    return { state, ok: false, message: 'Monster is already deployed on a floor.' };
  }

  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1
      ? { ...f, combatSlots: [...current, { kind: 'monster' as const, monsterId }] }
      : f
  );
  const nextMonsters = state.monsters.map((m) =>
    m.id === monsterId ? { ...m, deployedFloor: floorNum } : m
  );
  const pref = isMonsterPrefMatch(floor, mob.lineage) ? ' (🏠 PREF +1)' : '';
  const msg = `${floorNum}F assigned ${getMonsterDisplayName(mob)}${pref}`;
  return {
    state: { ...state, floors: nextFloors, monsters: nextMonsters, flash: msg },
    ok: true,
    message: msg,
  };
}

export function assignPrisonerFighterToFloor(
  state: GameState,
  floorNum: number,
  pid: number
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build' && state.mode !== 'estate') {
    return { state, ok: false, message: 'Floor guards can only be changed in Build or Estate mode.' };
  }
  const floor = state.floors[floorNum - 1];
  if (!floor) return { state, ok: false, message: 'Invalid floor.' };
  if (floor.slots.length === 0) {
    return { state, ok: false, message: `Install at least 1 trap on ${floorNum}F first.` };
  }
  const current = getFloorCombatSlots(floor);
  if (current.length >= MONSTER_CFG.FSLOT.MAX_PER_FLOOR) {
    return { state, ok: false, message: `${floorNum}F guards full (max ${MONSTER_CFG.FSLOT.MAX_PER_FLOOR}).` };
  }
  const p = getEligibleFloorFighters(state).find((x) => x.pid === pid);
  if (!p) {
    return {
      state,
      ok: false,
      message: `Prisoner ineligible (needs idle captive with Stamina ≥ ${MONSTER_CFG.FSLOT.FIGHTER_MIN_STAMINA}).`,
    };
  }

  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1
      ? { ...f, combatSlots: [...current, { kind: 'prisoner' as const, pid }] }
      : f
  );
  const nextPrisoners = state.prisoners.map((x) =>
    x.pid === pid ? { ...x, assignedFloor: floorNum } : x
  );
  const dcVal = getFighterFloorDC(p);
  const warn = p.resist >= MONSTER_CFG.FSLOT.BETRAY_RESIST_FROM ? ' · ⚠ BETRAYAL RISK' : '';
  const msg = `${floorNum}F assigned fighter ${p.name} (+${dcVal} DC${warn})`;
  return {
    state: { ...state, floors: nextFloors, prisoners: nextPrisoners, flash: msg },
    ok: true,
    message: msg,
  };
}

export function removeFloorCombatSlot(
  state: GameState,
  floorNum: number,
  slotIdx: number
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build' && state.mode !== 'estate') {
    return { state, ok: false, message: 'Floor guards can only be changed in Build or Estate mode.' };
  }
  const floor = state.floors[floorNum - 1];
  const current = floor ? getFloorCombatSlots(floor) : [];
  const target = current[slotIdx];
  if (!floor || !target) return { state, ok: false, message: 'Combat slot not found.' };

  const nextCombat = current.filter((_, i) => i !== slotIdx);
  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1 ? { ...f, combatSlots: nextCombat } : f
  );

  let nextMonsters = state.monsters;
  let nextPrisoners = state.prisoners;
  if (target.kind === 'monster') {
    nextMonsters = nextMonsters.map((m) =>
      m.id === target.monsterId ? { ...m, deployedFloor: null } : m
    );
  } else {
    nextPrisoners = nextPrisoners.map((p) =>
      p.pid === target.pid ? { ...p, assignedFloor: null } : p
    );
  }

  const msg = `Removed guard from ${floorNum}F`;
  return {
    state: { ...state, floors: nextFloors, monsters: nextMonsters, prisoners: nextPrisoners, flash: msg },
    ok: true,
    message: msg,
  };
}

export function toggleFloorLabBuff(
  state: GameState,
  floorNum: number
): { state: GameState; ok: boolean; message: string } {
  if (state.mode !== 'build' && state.mode !== 'estate') {
    return { state, ok: false, message: 'Lab buff can only be toggled in Build or Estate mode.' };
  }
  if (!state.estate.landmarks.lab) {
    return { state, ok: false, message: 'Arcane Trap Laboratory landmark not built yet.' };
  }
  const floor = state.floors[floorNum - 1];
  if (!floor) return { state, ok: false, message: 'Invalid floor.' };

  const currentlyOn = Boolean(floor.labBuff);
  if (!currentlyOn) {
    const activeCount = state.floors.filter((f) => f.labBuff).length;
    if (activeCount >= MONSTER_CFG.FSLOT.LAB_MAX_FLOORS) {
      return {
        state,
        ok: false,
        message: `Arcane Lab can only buff ${MONSTER_CFG.FSLOT.LAB_MAX_FLOORS} floors at once.`,
      };
    }
  }

  const nextFloors = state.floors.map((f, idx) =>
    idx === floorNum - 1 ? { ...f, labBuff: !currentlyOn } : f
  );
  const msg = `${floorNum}F Arcane Lab buff ${!currentlyOn ? 'enabled (+1 DC)' : 'disabled'}`;
  return {
    state: { ...state, floors: nextFloors, flash: msg },
    ok: true,
    message: msg,
  };
}

export function finalizePendingGrades(floors: FloorState[]): { floors: FloorState[]; fixedCount: number } {
  let fixedCount = 0;
  const next = floors.map((f) => {
    const slots = f.slots.map((s) => {
      if (s.grade === '?') {
        fixedCount++;
        return { ...s, grade: CFG.FALLBACK_GRADE };
      }
      return s;
    });
    let synergy = f.synergy;
    if (slots.length >= 2 && synergy === '?') {
      synergy = CFG.FALLBACK_GRADE as SynergyGrade;
      fixedCount++;
    } else if (slots.length < 2) {
      synergy = '-';
    }
    return { ...f, slots, synergy };
  });
  return { floors: next, fixedCount };
}

export function resetPendingGrades(floors: FloorState[], newTrapIds: string[], comboFloors: number[]): FloorState[] {
  const trapSet = new Set(newTrapIds);
  const roomSet = new Set(comboFloors);
  return floors.map((f) => {
    const slots = f.slots.map((s, idx) =>
      trapSet.has(`${f.floor}-${idx + 1}`) ? { ...s, grade: '?' as const } : s
    );
    const synergy: SynergyGrade =
      slots.length >= 2 && roomSet.has(f.floor) ? '?' : normalizeSynergy(slots, f.synergy);
    return { ...f, slots, synergy };
  });
}

function slotToRoomBlueprintSlot(slot: TrapSlot): RoomBlueprintSlot {
  const sepIdx = slot.text.indexOf(' — ');
  const name = (sepIdx > 0 ? slot.text.slice(0, sepIdx) : slot.text.slice(0, 48)).trim() || 'Trap';
  const detail = (sepIdx > 0 ? slot.text.slice(sepIdx + 3) : slot.text).trim() || name;
  const isEro = slot.types.some(
    (t) => t === 'lewd' || t === 'cloth' || t === 'parasite' || t === 'erotic'
  );
  return {
    name,
    detail,
    category: isEro ? 'ero' : 'standard',
    grade: slot.grade,
    types: [...slot.types],
  };
}

/**
 * Packages a multi-trap floor (2..5 slots) into a reusable Room Blueprint Shortcut.
 */
export function createRoomBlueprintFromFloor(
  floor: FloorState,
  customName?: string
): TrapBlueprint | null {
  if (floor.slots.length < 2) return null;
  const now = Date.now();
  const roomSlots = floor.slots.slice(0, CFG.SLOTS).map(slotToRoomBlueprintSlot);
  const category: 'ero' | 'standard' = roomSlots.some((r) => r.category === 'ero')
    ? 'ero'
    : 'standard';
  const roomSynergy: Exclude<SynergyGrade, '-'> = isSynergyGrade(floor.synergy) ? floor.synergy : '?';
  const typesSet = new Set<string>();
  for (const rs of roomSlots) {
    for (const t of rs.types) typesSet.add(t);
  }
  const autoName = `${floor.floor}F Room: ${roomSlots
    .slice(0, 2)
    .map((r) => r.name)
    .join(' + ')}`.slice(0, 60);
  const name = customName?.trim().slice(0, 60) || autoName;
  return {
    id: uid('bp_room'),
    kind: 'room',
    name,
    detail: roomSlots.map((r) => r.name).join(' + ').slice(0, CFG.NAME_MAXLEN),
    category,
    grade: roomSynergy,
    types: [...typesSet].slice(0, 4),
    roomSlots,
    roomSynergy,
    notes: `Saved from ${floor.floor}F (${roomSlots.length} traps)`,
    pinned: true,
    createdAt: now,
    updatedAt: now,
  };
}

function getInstalledCodexIds(floor: FloorState): Set<string> {
  const installed = new Set<string>();
  for (const slot of floor.slots) {
    if (slot.blueprintId?.startsWith('codex_')) {
      const cid = slot.blueprintId.slice('codex_'.length);
      if (getCodexTrapById(cid)) installed.add(cid);
    }
    const lowerText = slot.text.toLowerCase();
    for (const entry of CODEX_TRAPS) {
      const entryLower = entry.name.toLowerCase();
      if (lowerText === entryLower || lowerText.startsWith(`${entryLower} — `)) {
        installed.add(entry.id);
      }
    }
  }
  return installed;
}

export type CodexSuggestMode = 'mix' | 'ero' | 'standard';

/**
 * Rolls `count` (default 3) Codex trap suggestions for a floor, prioritizing
 * entries that form an X.TPC combo with traps already installed on the floor
 * (matching original Lua X.tpRoll).
 */
export function rollCodexSuggestions(
  floor: FloorState,
  mode: CodexSuggestMode = 'mix',
  count = 3,
  rng: () => number = Math.random
): { picks: CodexTrapEntry[]; comboPartnerIds: string[] } {
  const wantCategory = mode === 'mix' ? null : mode;
  const pool = CODEX_TRAPS.filter((t) => !wantCategory || t.category === wantCategory);
  const installedIds = getInstalledCodexIds(floor);

  const partnerCandidates: CodexTrapEntry[] = [];
  const seenPartners = new Set<string>();
  for (const combo of CODEX_COMBOS) {
    const hasMember = combo.memberIds.some((mid) => installedIds.has(mid));
    if (!hasMember) continue;
    for (const mid of combo.memberIds) {
      if (installedIds.has(mid) || seenPartners.has(mid)) continue;
      const entry = getCodexTrapById(mid);
      if (entry && (!wantCategory || entry.category === wantCategory)) {
        seenPartners.add(mid);
        partnerCandidates.push(entry);
      }
    }
  }

  const picks: CodexTrapEntry[] = [];
  const used = new Set<string>(installedIds);
  const comboPartnerIds: string[] = [];

  if (partnerCandidates.length > 0 && picks.length < count) {
    const partner = partnerCandidates[Math.floor(rng() * partnerCandidates.length)];
    picks.push(partner);
    used.add(partner.id);
    comboPartnerIds.push(partner.id);
  }

  const remainingPool = pool.filter((candidate) => !used.has(candidate.id));
  while (picks.length < count && remainingPool.length > 0) {
    const idx = Math.floor(rng() * remainingPool.length);
    const [picked] = remainingPool.splice(idx, 1);
    picks.push(picked);
    used.add(picked.id);
  }

  return { picks, comboPartnerIds };
}

/**
 * Picks Codex presets or an X.TPC room combo to fill empty slots on `floor`
 * within `availableMp`, returning a single atomic TrapBlueprint ready for
 * `installBlueprintToFloor`.
 */
export function buildCodexSuggestFillBlueprint(
  floor: FloorState,
  availableMp: number,
  mode: CodexSuggestMode = 'mix',
  rng: () => number = Math.random
): { blueprint: TrapBlueprint | null; totalCost: number; trapCount: number; comboId?: string } {
  const freeSlots = CFG.SLOTS - floor.slots.length;
  if (freeSlots <= 0) {
    return { blueprint: null, totalCost: 0, trapCount: 0 };
  }

  // Count how many consecutive slots we can afford starting at floor.slots.length
  let affordableSlots = 0;
  let runningCost = 0;
  for (let i = 0; i < freeSlots; i++) {
    const nextCost = getInstallCost(floor.slots.length + i);
    if (nextCost === null || runningCost + nextCost > availableMp) break;
    runningCost += nextCost;
    affordableSlots++;
  }
  if (affordableSlots === 0) {
    return { blueprint: null, totalCost: 0, trapCount: 0 };
  }

  const wantCategory = mode === 'mix' ? null : mode;

  // If floor is empty and we can afford at least 2 slots, prefer a matching Codex combo!
  if (floor.slots.length === 0 && affordableSlots >= 2) {
    const eligibleCombos = CODEX_COMBOS.filter((c) => {
      if (wantCategory && c.category !== wantCategory) return false;
      if (c.roomSlots.length > affordableSlots) return false;
      const cost = getRoomInstallCost(0, c.roomSlots.length);
      return cost !== null && cost <= availableMp;
    });
    if (eligibleCombos.length > 0) {
      const pickedCombo = eligibleCombos[Math.floor(rng() * eligibleCombos.length)];
      const totalCost = getRoomInstallCost(0, pickedCombo.roomSlots.length)!;
      return {
        blueprint: codexComboToBlueprint(pickedCombo),
        totalCost,
        trapCount: pickedCombo.roomSlots.length,
        comboId: pickedCombo.id,
      };
    }
  }

  // Otherwise fill up to min(affordableSlots, 3) slots using combo-aware Codex suggestions
  const targetCount = Math.min(affordableSlots, 3);
  const { picks } = rollCodexSuggestions(floor, mode, targetCount, rng);
  if (picks.length === 0) {
    return { blueprint: null, totalCost: 0, trapCount: 0 };
  }

  if (picks.length === 1) {
    const cost = getInstallCost(floor.slots.length)!;
    return {
      blueprint: codexTrapToBlueprint(picks[0]),
      totalCost: cost,
      trapCount: 1,
    };
  }

  const totalCost = getRoomInstallCost(floor.slots.length, picks.length)!;
  const now = Date.now();
  const installedIds = getInstalledCodexIds(floor);
  const afterIds = new Set([...installedIds, ...picks.map((p) => p.id)]);
  const matchedCombo = CODEX_COMBOS.find((c) => c.memberIds.every((mid) => afterIds.has(mid)));
  const roomSynergy: Exclude<SynergyGrade, '-'> = matchedCombo ? matchedCombo.roomSynergy : '?';
  const typesSet = new Set<string>();
  for (const p of picks) {
    for (const t of p.types) typesSet.add(t);
  }
  const category: 'ero' | 'standard' = picks.some((p) => p.category === 'ero')
    ? 'ero'
    : 'standard';

  const blueprint: TrapBlueprint = {
    id: uid('codex_fill'),
    kind: 'room',
    name: matchedCombo ? matchedCombo.name : `Codex Fill (${picks.map((p) => p.name).join(' + ')})`.slice(0, 60),
    detail: matchedCombo ? matchedCombo.detail : picks.map((p) => p.name).join(' + '),
    category,
    grade: roomSynergy,
    types: [...typesSet].slice(0, 4),
    roomSlots: picks.map((p) => ({
      name: p.name,
      detail: p.detail,
      category: p.category,
      grade: p.grade,
      types: [...p.types],
    })),
    roomSynergy,
    notes: matchedCombo ? `Combo: ${matchedCombo.memberNames.join(' + ')}` : 'Auto-suggested from Original Codex',
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };

  return {
    blueprint,
    totalCost,
    trapCount: picks.length,
    comboId: matchedCombo?.id,
  };
}

const PREVIEW_TAG_RULES: [string, RegExp][] = [
  ['lewd', /tentacle|lust|aphrodisiac|erotic|pleasure|sensitiv|succubus|milking|vibrat|tickle|lewd|arous|orgasm|skimpy|lingerie/i],
  ['bind', /bind|chain|shackle|cuff|pillory|stock|net|snare|web|pin|trapdoor|restrain|strap|collar|tie|immob/i],
  ['cloth', /cloth|armor|dress|strip|skirt|bikini|costume|outfit|dissolv|acid|rust|naked/i],
  ['fire', /fire|flame|lava|burn|magma|sulfur|bomb|explod|powder|molten|torch|heat/i],
  ['ice', /ice|frost|freeze|cryo|glaci|icicle|cold|snow/i],
  ['elec', /electr|shock|lightning|volt|static|arc|coil|pulse|thunder/i],
  ['water', /water|flood|pool|spring|mire|bog|steam|rapids|slime|wet|drown/i],
  ['poison', /poison|venom|toxic|gas|mist|spore|sleep|anesthetic|acid|drunk|rot|disease/i],
  ['pit', /pit|chute|drop|slope|ramp|slide|bridge|tile|fall|quicksand/i],
  ['mind', /mind|hypno|illusion|mirage|confus|terror|charm|memory|dream|quiz|riddle|decoy|whisper/i],
  ['parasite', /parasit|egg|worm|leech|swarm|beetle|scarab|hornet/i],
  ['mutate', /mutat|transform|polymorph|petrif|doll|slime-body|shrink|inflate|gender|swap/i],
  ['curse', /curse|hex|sigil|rune|seal|ward|drain|siphon|warp|soul|necro/i],
  ['phys', /blade|saw|spike|arrow|spear|boulder|hammer|crusher|pendulum|iron maiden|bear trap|rock|wall/i],
];

/**
 * Non-destructively previews a curated grade (D/C/B) and inferred TRAP_TYPES
 * for unrated '?' traps without mutating GameState.
 */
export function previewPendingTrap(slot: TrapSlot): {
  grade: TrapGrade;
  types: string[];
  source: 'codex' | 'heuristic';
} {
  if (slot.blueprintId?.startsWith('codex_')) {
    const cid = slot.blueprintId.slice('codex_'.length);
    const entry = getCodexTrapById(cid);
    if (entry) {
      return { grade: entry.grade, types: [...entry.types], source: 'codex' };
    }
  }

  const lower = slot.text.toLowerCase();
  const matchedEntry = CODEX_TRAPS.find((e) => {
    const entryLower = e.name.toLowerCase();
    return lower === entryLower || lower.startsWith(`${entryLower} — `);
  });
  if (matchedEntry) {
    return { grade: matchedEntry.grade, types: [...matchedEntry.types], source: 'codex' };
  }

  const tags = new Set<string>(slot.types);
  for (const [tag, re] of PREVIEW_TAG_RULES) {
    if (re.test(slot.text)) {
      tags.add(tag);
      if (tags.size >= 3) break;
    }
  }
  if (tags.size === 0) tags.add('phys');

  const len = slot.text.trim().length;
  const grade: TrapGrade =
    len >= 75 && tags.size >= 2 ? 'B' : len >= 24 || tags.size >= 1 ? 'C' : 'D';

  return {
    grade,
    types: [...tags].slice(0, 3),
    source: 'heuristic',
  };
}
