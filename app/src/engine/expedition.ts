import { resolveSceneAsset } from '../data/assetManifest';
import { CFG } from '../data/constants';
import {
  EXPEDITION_AFTEREFFECT_MAP,
  EXPEDITION_AILMENT_MAP,
  EXPEDITION_ARRIVALS,
  EXPEDITION_CAPTIVE_NAMES,
  EXPEDITION_EGG_LINEAGES,
  EXPEDITION_ENCOUNTER_MAP,
  EXPEDITION_EVENT_MAP,
  EXPEDITION_EVENTS,
  EXPEDITION_LENGTH_MAP,
  EXPEDITION_RELIC_MAP,
  EXPEDITION_REGION_MAP,
  EXPED_CFG,
  GRADE_POWER_INDEX,
  STANDARD_REGION_KEYS,
  pickExpeditionArt,
  type AfterEffectKey,
  type ExpeditionAilmentKey,
  type ExpeditionArrivalChoiceDef,
  type ExpeditionEventDef,
  type ExpeditionLengthDef,
  type ExpeditionLootKind,
  type ExpeditionRegionDef,
} from '../data/expeditionData';
import type {
  ExpeditionCrewMember,
  ExpeditionLengthKey,
  ExpeditionNodeChoice,
  ExpeditionState,
  GameState,
  HeroGrade,
  MonsterEgg,
  Prisoner,
  RelicKey,
  RelicsState,
} from '../types/game';
import {
  appendDayLogLine,
  getOfficerStageForAff,
  getPrisonCapacity,
  isDayPhase,
  spendDayAp,
} from './dayLoop';
import { getPrisonerTitle, isActiveCaptive, isActiveMole } from './prison';
import { clamp, pickOne, pickWeighted, randInt, uid } from './rng';

export type ExpeditionAction =
  | 'mv1'
  | 'mv2'
  | 'mv3'
  | 'atk'
  | 'def'
  | 'scout'
  | 'camp'
  | 'v1'
  | 'v2'
  | 'v3'
  | 'c1'
  | 'c2'
  | 'c3'
  | 'home';

export type ExpeditionMajorBeatKind =
  | 'arrival'
  | 'deep_event'
  | 'relic'
  | 'casualty_or_return';

export interface ExpeditionStepLog {
  text: string;
  en: string;
  majorBeat?: ExpeditionMajorBeatKind;
  artUrl?: string;
}

export interface ExpeditionAfterEffectFlags {
  supply?: boolean;
  scout?: number;
  desecrate?: boolean;
  merchant?: number;
  hunter?: boolean;
}

export interface ExpeditionFinishSummary {
  reason: 'home' | 'done' | 'wiped';
  lengthKey: ExpeditionLengthKey;
  daysElapsed: number;
  depthReached: number;
  survivors: string[];
  lostNames: string[];
  lootLines: string[];
  unlockedRelics: RelicKey[];
  addedAfterEffects: AfterEffectKey[];
  retaliationTriggered: boolean;
  eleonoraAffGain: number;
}

export interface RichExpeditionCrewMember extends ExpeditionCrewMember {
  resist?: number;
  staminaMax?: number;
  obeyMarks?: number;
  loyal?: boolean;
  title?: string;
  prisonerSnapshot?: Prisoner;
}

export interface RichExpeditionState extends ExpeditionState {
  crew: RichExpeditionCrewMember[];
  map?: string[][];
  path?: string[];
  homing?: boolean;
  safe?: boolean;
  seenEvents?: string[];
  evFlags?: Record<string, boolean>;
  afFlags?: ExpeditionAfterEffectFlags;
  eventActors?: { a?: string; b?: string };
  todaySteps?: ExpeditionStepLog[];
  dayComplete?: boolean;
  stopReason?: string | null;
  lootRenown?: number;
  lootApproval?: number;
  lootFear?: number;
  lastSummary?: ExpeditionFinishSummary | null;
}

function asRichExp(exp: ExpeditionState): RichExpeditionState {
  return exp as RichExpeditionState;
}

function getActiveCrew(exp: RichExpeditionState): RichExpeditionCrewMember[] {
  return exp.crew.filter((m) => !m.lost && m.stamina > 0);
}

export function isExpeditionUnlocked(state: GameState): boolean {
  return state.wave >= EXPED_CFG.UNLOCK_W;
}

export function getMaxExpeditionCrew(state: GameState): number {
  return state.estate.landmarks.hq ? EXPED_CFG.CREW_MAX_HQ : EXPED_CFG.CREW_MAX;
}

export function isPrisonerEligibleForExpedition(
  p: Prisoner
): { ok: true } | { ok: false; reason: string } {
  if (!isActiveCaptive(p) || isActiveMole(p)) {
    return { ok: false, reason: 'Converted/mole unavailable' };
  }
  if (p.legend) return { ok: false, reason: 'Legend captive' };
  if (p.dying) return { ok: false, reason: 'Dying' };
  if (p.resist > EXPED_CFG.RESIST_MAX) {
    return { ok: false, reason: `Resist ${p.resist} > ${EXPED_CFG.RESIST_MAX}` };
  }
  if (p.stamina < EXPED_CFG.STAMINA_MIN) {
    return { ok: false, reason: `Stamina ${p.stamina} < ${EXPED_CFG.STAMINA_MIN}` };
  }
  return { ok: true };
}

export function canSelectTripLength(
  state: GameState,
  lengthKey: ExpeditionLengthKey,
  crewCount: number
): { ok: true; def: ExpeditionLengthDef } | { ok: false; reason: string; def: ExpeditionLengthDef } {
  const def = EXPEDITION_LENGTH_MAP[lengthKey];
  if (state.wave < def.minWave) {
    return { ok: false, reason: `Unlocks at Wave ${def.minWave}+`, def };
  }
  if (state.town.lv < def.minTownLv) {
    return { ok: false, reason: `Requires Town Lv.${def.minTownLv}+`, def };
  }
  if (def.reqCleared && !state.expedition.clearedLengths.includes(def.reqCleared)) {
    const reqLabel = EXPEDITION_LENGTH_MAP[def.reqCleared].label;
    return { ok: false, reason: `Clear ${reqLabel} once first`, def };
  }
  if (crewCount < def.minCrew) {
    return { ok: false, reason: `Requires ${def.minCrew}+ crew`, def };
  }
  if (state.points < def.costMp) {
    return { ok: false, reason: `Need ${def.costMp} MP`, def };
  }
  return { ok: true, def };
}

export function canLaunchExpedition(
  state: GameState,
  pids: number[],
  lengthKey: ExpeditionLengthKey
): { ok: true } | { ok: false; reason: string } {
  if (!isDayPhase(state)) {
    return { ok: false, reason: 'Expeditions can only launch during Day (AP) phase.' };
  }
  if (state.estate.activeCrisis) {
    return { ok: false, reason: 'Resolve the active town crisis before launching.' };
  }
  if (!isExpeditionUnlocked(state)) {
    return { ok: false, reason: `Expeditions unlock at Wave ${EXPED_CFG.UNLOCK_W}.` };
  }
  if (state.crises.crusade.active) {
    return { ok: false, reason: 'Blocked while Holy Crusade is active.' };
  }
  if (state.expedition.active) {
    return { ok: false, reason: 'Only 1 active expedition allowed at a time.' };
  }
  if (state.ap < 1) {
    return { ok: false, reason: 'Need 1 AP to launch an expedition.' };
  }
  const maxCrew = getMaxExpeditionCrew(state);
  const uniquePids = Array.from(new Set(pids));
  if (uniquePids.length === 0) {
    return { ok: false, reason: 'Select at least 1 eligible captive.' };
  }
  if (uniquePids.length > maxCrew) {
    return { ok: false, reason: `Maximum crew size is ${maxCrew}.` };
  }
  for (const pid of uniquePids) {
    const p = state.prisoners.find((item) => item.pid === pid);
    if (!p) return { ok: false, reason: `Captive #${pid} not found.` };
    const elig = isPrisonerEligibleForExpedition(p);
    if (!elig.ok) return { ok: false, reason: `${p.name}: ${elig.reason}` };
  }
  const lenCheck = canSelectTripLength(state, lengthKey, uniquePids.length);
  if (!lenCheck.ok) {
    return { ok: false, reason: lenCheck.reason };
  }
  return { ok: true };
}

export function generateExpeditionMap(lengthKey: ExpeditionLengthKey): string[][] {
  const def = EXPEDITION_LENGTH_MAP[lengthKey];
  const pool = [...STANDARD_REGION_KEYS];
  if (lengthKey === 'long' || lengthKey === 'grand' || lengthKey === 'abyss') {
    pool.push('fort');
  }
  const map: string[][] = [];
  for (let d = 0; d < def.maxDepth; d++) {
    const remaining = [...pool];
    const row: string[] = [];
    while (row.length < 3 && remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      row.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    map.push(row);
  }

  const placeDest = (depthIdx: number, dest: 'village' | 'city') => {
    if (depthIdx >= 0 && depthIdx < map.length) {
      const slot = randInt(0, 1);
      map[depthIdx][slot] = dest;
    }
  };

  if (lengthKey === 'mid') {
    placeDest(4, 'village');
    if (Math.random() < 0.6) placeDest(randInt(2, 3), 'village');
  } else if (lengthKey === 'long' || lengthKey === 'grand' || lengthKey === 'abyss') {
    placeDest(randInt(2, 3), 'village');
    placeDest(6, 'city');
    if (Math.random() < 0.5) placeDest(randInt(4, 5), 'city');
    if (lengthKey === 'grand' || lengthKey === 'abyss') {
      if (Math.random() < 0.6) placeDest(8, 'city');
    }
  }
  return map;
}

function buildChoicesForDepth(map: string[][] | undefined, depth: number): ExpeditionNodeChoice[] {
  const row = map?.[depth];
  if (!row || row.length === 0) return [];
  return row.slice(0, 3).map((region, idx) => ({
    idx: (idx + 1) as 1 | 2 | 3,
    region,
    ambush: EXPEDITION_REGION_MAP[region]?.ambush ?? 0.12,
  }));
}

function rollRegionEncounter(regionKey: string): { key: string; diff: number } | null {
  const reg = EXPEDITION_REGION_MAP[regionKey] ?? EXPEDITION_REGION_MAP.out;
  const entries = Object.entries(reg.encWeights);
  if (entries.length === 0) return null;
  const [encKey] = pickWeighted(entries, ([, w]) => w);
  const enc = EXPEDITION_ENCOUNTER_MAP[encKey] ?? Object.values(EXPEDITION_ENCOUNTER_MAP)[0];
  return enc ? { key: enc.key, diff: enc.diff } : null;
}

export function getExpeditionRegionDef(regionKey: string): ExpeditionRegionDef {
  return EXPEDITION_REGION_MAP[regionKey] ?? EXPEDITION_REGION_MAP.out;
}

export function launchExpedition(
  state: GameState,
  pids: number[],
  lengthKey: ExpeditionLengthKey
): { ok: boolean; state: GameState; message: string } {
  const guard = canLaunchExpedition(state, pids, lengthKey);
  if (!guard.ok) {
    return {
      ok: false,
      state: { ...state, flash: guard.reason },
      message: guard.reason,
    };
  }
  const uniquePids = Array.from(new Set(pids));
  const def = EXPEDITION_LENGTH_MAP[lengthKey];
  const selectedSet = new Set(uniquePids);
  const crewMembers: RichExpeditionCrewMember[] = [];
  const remainingPrisoners: Prisoner[] = [];

  for (const p of state.prisoners) {
    if (selectedSet.has(p.pid)) {
      crewMembers.push({
        pid: p.pid,
        name: p.name,
        grade: p.grade,
        stamina: p.stamina,
        ailments: [],
        lost: false,
        resist: p.resist,
        staminaMax: p.staminaMax,
        obeyMarks: p.marks.obey ?? 0,
        loyal: (p.marks.obey ?? 0) >= 2,
        title: p.title ?? getPrisonerTitle(p),
        prisonerSnapshot: { ...p, job: null, assignedFloor: null },
      });
    } else {
      remainingPrisoners.push(p);
    }
  }

  const names = crewMembers.map((m) => m.name).join(', ');
  const launchLine = `Dispatched Expedition (${def.icon} ${def.label}): ${names} (-${def.costMp} MP)`;
  const spent = spendDayAp(state, 'exped_launch', {
    text: launchLine,
    star: true,
    kind: 'exped',
    art: resolveSceneAsset('dk_exd_depart'),
  });
  if (!spent.ok) {
    return { ok: false, state: spent.state, message: spent.state.flash };
  }

  const map = generateExpeditionMap(lengthKey);
  const initialEnc =
    Math.random() < EXPED_CFG.ENC_CHANCE ? rollRegionEncounter('out') : null;
  const choices = buildChoicesForDepth(map, 0);

  const nextExpedition: RichExpeditionState = {
    ...spent.state.expedition,
    active: true,
    lengthKey,
    day: 1,
    maxDays: def.days,
    ap: EXPED_CFG.AP_PER_DAY,
    depth: 0,
    maxDepth: def.maxDepth,
    region: 'out',
    crew: crewMembers,
    lootMp: 0,
    lootFood: 0,
    lootPop: 0,
    lootParts: 0,
    lootEggs: 0,
    lootShards: 0,
    lootIntel: 0,
    gear: clamp(spent.state.expedition.gear ?? 0, 0, EXPED_CFG.GEAR_MAX),
    drill: 0,
    notoriety: 0,
    choices,
    activeEncounter: initialEnc,
    activeEvent: null,
    arrivedVisited: false,
    clearedLengths: [...spent.state.expedition.clearedLengths],
    afterEffects: [...spent.state.expedition.afterEffects],
    log: [`D1 Departed outskirts (${def.label}) with ${names}`],
    map,
    path: ['out'],
    homing: false,
    safe: false,
    seenEvents: [],
    evFlags: { depart: true },
    afFlags: {},
    eventActors: {},
    todaySteps: [
      {
        text: `Departed dungeon outskirts (${def.icon} ${def.label}) — ${names}`,
        en: `The war-party (${names}) departed the dungeon outskirts on a ${def.label}.`,
        artUrl: resolveSceneAsset('dk_exd_depart'),
      },
    ],
    dayComplete: false,
    stopReason: null,
    lootRenown: 0,
    lootApproval: 0,
    lootFear: 0,
    lastSummary: null,
  };

  const nextState: GameState = {
    ...spent.state,
    points: spent.state.points - def.costMp,
    prisoners: remainingPrisoners,
    expedition: nextExpedition,
    flash: `🗺 Expedition launched: ${names} (${def.label}, ${def.days}d). Enters EXPED phase after M.Settle.`,
  };

  return { ok: true, state: nextState, message: nextState.flash };
}

export function getCrewMemberPower(member: ExpeditionCrewMember): number {
  const gradeIdx = Math.max(0, GRADE_POWER_INDEX[member.grade] ?? 2);
  return 1 + gradeIdx + member.stamina / 25 - member.ailments.length;
}

export function getCrewPower(state: GameState): number {
  const exp = asRichExp(state.expedition);
  const activeCrew = getActiveCrew(exp);
  const base = activeCrew.reduce((sum, m) => sum + getCrewMemberPower(m), 0);
  const gearBonus = Math.min(EXPED_CFG.GEAR_MAX, exp.gear ?? 0);
  const drillBonus = (exp.drill ?? 0) * 2;
  return base + gearBonus + drillBonus;
}

export function getEncounterDifficulty(depth: number, baseDiff: number): number {
  return baseDiff + depth * EXPED_CFG.DEPTH_DIFF + 2;
}

export function getExpeditionWinChance(state: GameState, totalDiff: number): number {
  const power = getCrewPower(state);
  return clamp(0.55 + (power - totalDiff) * 0.04, 0.15, 0.92);
}

export function getDailyFleeChance(
  state: GameState,
  member: RichExpeditionCrewMember
): number {
  const title = (member.title ?? '').toLowerCase();
  if (EXPED_CFG.SAFE_TITLES.some((safe) => title.startsWith(safe))) {
    return 0;
  }
  const resist = member.resist ?? member.prisonerSnapshot?.resist ?? 25;
  const loyal = member.loyal ?? (member.prisonerSnapshot?.marks.obey ?? 0) >= 2;
  const obeyMarks = member.obeyMarks ?? member.prisonerSnapshot?.marks.obey ?? 0;
  const isDest = state.expedition.region === 'village' || state.expedition.region === 'city';
  const hasHq = Boolean(state.estate.landmarks.hq);
  const isLong = state.expedition.lengthKey === 'long';

  let p = resist * EXPED_CFG.FLEE_BASE;
  if (loyal) p *= EXPED_CFG.FLEE_LOYAL_MULT;
  p -= obeyMarks * EXPED_CFG.FLEE_OBEY_REDUCE;
  if (isDest) p += EXPED_CFG.FLEE_DEST_ADD;
  if (hasHq) {
    p -= EXPED_CFG.FLEE_HQ_REDUCE;
    if (isLong) p -= EXPED_CFG.FLEE_HQ_LONG_REDUCE;
  }
  return Math.max(0, p);
}

function getLootMult(depth: number): number {
  return EXPED_CFG.LOOT_BASE * (1 + EXPED_CFG.DEPTH_LOOT * depth);
}

function applyLootToExp(
  exp: RichExpeditionState,
  loot: Partial<Record<ExpeditionLootKind, number>>,
  mult = 1
): string[] {
  const labels: string[] = [];
  const scale = (k: ExpeditionLootKind, v: number) =>
    k === 'mp' || k === 'food' || k === 'pop'
      ? Math.max(1, Math.round(v * mult))
      : v;

  for (const [rawKey, rawVal] of Object.entries(loot) as [ExpeditionLootKind, number][]) {
    if (!rawVal || rawVal <= 0) continue;
    const val = scale(rawKey, rawVal);
    switch (rawKey) {
      case 'mp':
        exp.lootMp += val;
        labels.push(`+${val} MP`);
        break;
      case 'food':
        exp.lootFood += val;
        labels.push(`+${val} Food`);
        break;
      case 'pop':
        exp.lootPop += val;
        labels.push(`+${val} Pop`);
        break;
      case 'parts':
        exp.lootParts += val;
        labels.push(`+${val} Parts`);
        break;
      case 'eggs':
        exp.lootEggs += val;
        labels.push(`+${val} Egg`);
        break;
      case 'intel':
        exp.lootIntel += val;
        labels.push(`+${val} Intel`);
        break;
      case 'shard':
        exp.lootShards += val;
        labels.push(`+${val} Relic Shard`);
        break;
      case 'gear':
        exp.gear = Math.min(EXPED_CFG.GEAR_MAX + 1, (exp.gear ?? 0) + val);
        labels.push(`+${val} Gear`);
        break;
      case 'renown':
        exp.lootRenown = (exp.lootRenown ?? 0) + val;
        labels.push(`+${val} Renown`);
        break;
      case 'approval':
        exp.lootApproval = (exp.lootApproval ?? 0) + val;
        labels.push(`+${val} Approval`);
        break;
      case 'fear':
        exp.lootFear = (exp.lootFear ?? 0) + val;
        labels.push(`+${val} Fear`);
        break;
      case 'herb':
        for (const m of getActiveCrew(exp)) {
          m.stamina = Math.min(m.staminaMax ?? 100, m.stamina + val);
        }
        labels.push(`+${val} Stamina (Herbs)`);
        break;
    }
  }
  return labels;
}

function hurtCrewMember(member: RichExpeditionCrewMember, dmg: number): void {
  member.stamina = Math.max(0, member.stamina - dmg);
}

function hurtAllCrew(exp: RichExpeditionState, dmg: number): void {
  for (const m of getActiveCrew(exp)) {
    hurtCrewMember(m, dmg);
  }
}

function healAllCrew(exp: RichExpeditionState, amount: number): void {
  for (const m of getActiveCrew(exp)) {
    m.stamina = Math.min(m.staminaMax ?? 100, m.stamina + amount);
  }
}

function adjustMemberResist(member: RichExpeditionCrewMember, delta: number): void {
  const cur = member.resist ?? member.prisonerSnapshot?.resist ?? 25;
  const next = clamp(cur + delta, 0, 100);
  member.resist = next;
  if (member.prisonerSnapshot) {
    member.prisonerSnapshot = { ...member.prisonerSnapshot, resist: next };
  }
}

function inflictAilment(
  member: RichExpeditionCrewMember,
  prefer?: ExpeditionAilmentKey | null
): ExpeditionAilmentKey | null {
  const existing = new Set(member.ailments);
  if (prefer && !existing.has(prefer) && Math.random() < 0.5) {
    member.ailments = [...member.ailments, prefer];
    return prefer;
  }
  const free = (Object.keys(EXPEDITION_AILMENT_MAP) as ExpeditionAilmentKey[]).filter(
    (k) => !existing.has(k)
  );
  if (free.length === 0) return null;
  const chosen = pickOne(free);
  member.ailments = [...member.ailments, chosen];
  return chosen;
}

function processCrewCasualties(exp: RichExpeditionState, notes: string[]): boolean {
  let anyLost = false;
  for (const m of exp.crew) {
    if (!m.lost && m.stamina <= 0) {
      m.lost = true;
      anyLost = true;
      exp.evFlags = { ...(exp.evFlags ?? {}), lost: true };
      notes.push(`💀 ${m.name} fell in battle`);
    }
  }
  return anyLost;
}

function pushStep(
  exp: RichExpeditionState,
  text: string,
  en: string,
  opts?: { majorBeat?: ExpeditionMajorBeatKind; artUrl?: string }
): void {
  const steps = [...(exp.todaySteps ?? [])];
  steps.push({
    text,
    en,
    ...(opts?.majorBeat ? { majorBeat: opts.majorBeat } : {}),
    ...(opts?.artUrl ? { artUrl: opts.artUrl } : {}),
  });
  exp.todaySteps = steps;
}

export function convertRelicShards(relics: RelicsState): {
  relics: RelicsState;
  unlocked: RelicKey[];
} {
  let shards = relics.shards;
  const owned = [...relics.owned];
  const unlocked: RelicKey[] = [];
  const allRelics: RelicKey[] = ['shield', 'chalice', 'crown', 'lens'];

  while (shards >= EXPED_CFG.SHARDS_PER_RELIC) {
    const pool = allRelics.filter((r) => !owned.includes(r));
    if (pool.length === 0) break;
    const chosen = pickOne(pool);
    shards -= EXPED_CFG.SHARDS_PER_RELIC;
    owned.push(chosen);
    unlocked.push(chosen);
  }

  return {
    relics: { owned, shards },
    unlocked,
  };
}

export function resolveExpeditionAftereffects(
  state: GameState,
  opts?: { heroClassKey?: string; floorNum?: number; hasMonsterOnFloor?: boolean }
): { mod: number; notes: string[]; activeKeys: AfterEffectKey[] } {
  let total = 0;
  const notes: string[] = [];
  const activeKeys: AfterEffectKey[] = [];

  for (const af of state.expedition.afterEffects) {
    if (af.wavesLeft <= 0) continue;
    const def = EXPEDITION_AFTEREFFECT_MAP[af.key as AfterEffectKey];
    if (!def) continue;
    activeKeys.push(def.key);

    if (def.key === 'scout') {
      if ((opts?.floorNum ?? 1) <= 2) {
        total += def.heroMod;
        notes.push(`${def.icon} ${def.label}`);
      }
    } else if (def.key === 'desecrate') {
      const cls = (opts?.heroClassKey ?? '').toLowerCase();
      if (cls === 'priest' || cls === 'cleric' || cls === 'paladin') {
        total += def.heroMod;
        notes.push(`${def.icon} ${def.label}`);
      }
    } else if (def.key === 'hunter') {
      if (opts?.hasMonsterOnFloor) {
        total += def.heroMod;
        notes.push(`${def.icon} ${def.label}`);
      }
    } else if (def.key === 'merchant') {
      notes.push(`${def.icon} ${def.label}`);
    } else if (def.heroMod !== 0) {
      total += def.heroMod;
      notes.push(`${def.icon} ${def.label}`);
    }
  }

  return {
    mod: clamp(total, -2, 2),
    notes,
    activeKeys,
  };
}

export function tickExpeditionAftereffects(state: GameState): GameState {
  if (state.expedition.afterEffects.length === 0) return state;
  const next = state.expedition.afterEffects
    .map((a) => ({ ...a, wavesLeft: a.wavesLeft - 1 }))
    .filter((a) => a.wavesLeft > 0);
  return {
    ...state,
    expedition: {
      ...state.expedition,
      afterEffects: next,
    },
  };
}

function buildPrisonerFromExpedMember(
  state: GameState,
  m: RichExpeditionCrewMember,
  finalStamina: number
): Prisoner {
  if (m.prisonerSnapshot) {
    return {
      ...m.prisonerSnapshot,
      stamina: finalStamina,
      resist: m.resist ?? m.prisonerSnapshot.resist,
      job: null,
      assignedFloor: null,
      dying: finalStamina < 20,
    };
  }
  const resist = m.resist ?? 25;
  return {
    pid: m.pid,
    name: m.name,
    grade: m.grade,
    raceLabel: 'human',
    classLabel: 'adventurer',
    traits: [],
    capturedWave: state.wave,
    capturedFloor: 0,
    resist,
    corr: 20,
    gender: 'female',
    stamina: finalStamina,
    staminaMax: m.staminaMax ?? 100,
    pleasure: 20,
    terror: 20,
    shame: 10,
    marks: {
      obey: m.obeyMarks ?? 0,
      pleasure: 0,
      terror: 0,
      shame: 0,
    },
    cond: '',
    job: null,
    converted: null,
    assignedFloor: null,
    owner: null,
    afflictions: [],
    breeding: null,
  };
}

export function finalizeExpedition(
  state: GameState,
  reason: 'home' | 'done' | 'wiped'
): GameState {
  const exp = asRichExp(state.expedition);
  if (!exp.active && !exp.lengthKey) return state;

  const activeSurvivors = getActiveCrew(exp);
  const lostNames = exp.crew.filter((m) => m.lost || m.stamina <= 0).map((m) => m.name);
  const ok = (reason === 'home' || reason === 'done') && activeSurvivors.length > 0;

  // Return survivors to prison with -8 stamina per active ailment
  const nextPrisoners = [...state.prisoners];
  const survivorNames: string[] = [];
  for (const m of activeSurvivors) {
    const finalStam = Math.max(1, m.stamina - 8 * m.ailments.length);
    const restored = buildPrisonerFromExpedMember(state, m, finalStam);
    const existingIdx = nextPrisoners.findIndex((p) => p.pid === restored.pid);
    if (existingIdx >= 0) {
      nextPrisoners[existingIdx] = restored;
    } else {
      nextPrisoners.push(restored);
    }
    survivorNames.push(m.name);
  }

  // Apply collected loot
  let nextPoints = state.points + exp.lootMp;
  const nextTown = {
    ...state.town,
    food: clamp(state.town.food + exp.lootFood, 0, 100),
    pop: state.town.pop + exp.lootPop,
    renown: clamp(state.town.renown + (exp.lootRenown ?? 0), 0, 100),
    approval: clamp(state.town.approval + (exp.lootApproval ?? 0), 0, 100),
  };
  const nextFear = clamp(state.fear + (exp.lootFear ?? 0), 0, 100);

  // Spawn eggs from lootEggs
  const spawnedEggs: MonsterEgg[] = [];
  for (let i = 0; i < exp.lootEggs; i++) {
    spawnedEggs.push({
      id: uid('egg'),
      lineage: pickOne(EXPEDITION_EGG_LINEAGES),
      hatchWave: state.wave + 1,
      xp: 0,
    });
  }

  // Convert Relic Shards (3 shards -> 1 unowned Relic)
  const shardRes = convertRelicShards({
    owned: [...state.relics.owned],
    shards: state.relics.shards + exp.lootShards,
  });

  // 8 X.AFTER aftereffects
  const af = exp.afFlags ?? {};
  const ev = exp.evFlags ?? {};
  const addedAfter: AfterEffectKey[] = [];
  if (af.supply) addedAfter.push('supply');
  if ((af.scout ?? 0) >= 3) addedAfter.push('scout');
  if (exp.notoriety >= EXPED_CFG.NOTOR_RETAL) addedAfter.push('revenge');
  if (ev.flee || ev.lost || reason === 'wiped') addedAfter.push('leak');
  if (af.desecrate) addedAfter.push('desecrate');
  if ((af.merchant ?? 0) >= 2) addedAfter.push('merchant');
  if (af.hunter) addedAfter.push('hunter');
  if (ok && (exp.lengthKey === 'grand' || exp.lengthKey === 'abyss')) {
    addedAfter.push('royal');
  }

  const nextAfterMap = new Map<string, number>();
  for (const prevAf of exp.afterEffects) {
    if (prevAf.wavesLeft > 0) nextAfterMap.set(prevAf.key, prevAf.wavesLeft);
  }
  for (const k of addedAfter) {
    const def = EXPEDITION_AFTEREFFECT_MAP[k];
    nextAfterMap.set(k, Math.max(nextAfterMap.get(k) ?? 0, def.waves));
  }
  const nextAfterEffects = Array.from(nextAfterMap.entries()).map(([key, wavesLeft]) => ({
    key,
    wavesLeft,
  }));

  // Wrath & retaliation
  let nextWrath = state.crises.wrath;
  if (af.desecrate) {
    nextWrath = clamp(nextWrath + 10, 0, 100);
  }
  const retaliationTriggered = exp.notoriety >= EXPED_CFG.NOTOR_RETAL;
  const nextRaidMods = [...state.crises.activeRaidMods];
  if (retaliationTriggered) {
    nextRaidMods.push({ key: 'hero_up', value: 1 });
  }

  // Eleonora +2 Affection on >= 150 MP haul
  let nextOfficers = state.officers;
  let eleGain = 0;
  if (ok && exp.lootMp >= EXPED_CFG.HIGH_HAUL_MP) {
    eleGain = 2;
    const prevE = state.officers.eleonora;
    const nextAff = prevE.aff + 2;
    const nextStage = Math.max(prevE.stage, getOfficerStageForAff('eleonora', nextAff));
    nextOfficers = {
      ...state.officers,
      eleonora: { ...prevE, aff: nextAff, stage: nextStage },
    };
  }

  const lengthKey = exp.lengthKey ?? 'short';
  const nextCleared =
    ok && !exp.clearedLengths.includes(lengthKey)
      ? [...exp.clearedLengths, lengthKey]
      : [...exp.clearedLengths];

  // Estate perks from parts / intel
  const nextPerks = { ...state.estate.perks };
  if (exp.lootParts > 0) {
    if (!nextPerks.firstDcOnce) {
      nextPerks.firstDcOnce = true;
    } else {
      nextPoints += exp.lootParts * 15;
    }
  }
  if (exp.lootIntel > 0) {
    nextPerks.prepIntelOnce = true;
    nextPerks.maxIntelBonus = (nextPerks.maxIntelBonus ?? 0) + exp.lootIntel;
  }

  const lootLines: string[] = [];
  if (exp.lootMp > 0) lootLines.push(`+${exp.lootMp} MP`);
  if (exp.lootFood > 0) lootLines.push(`+${exp.lootFood} Food`);
  if (exp.lootPop > 0) lootLines.push(`+${exp.lootPop} Pop`);
  if (exp.lootParts > 0) lootLines.push(`+${exp.lootParts} Trap Parts`);
  if (exp.lootEggs > 0) lootLines.push(`+${exp.lootEggs} Monster Egg(s)`);
  if (exp.lootIntel > 0) lootLines.push(`+${exp.lootIntel} Intel`);
  if (exp.lootShards > 0) lootLines.push(`+${exp.lootShards} Relic Shard(s)`);
  if ((exp.lootRenown ?? 0) > 0) lootLines.push(`+${exp.lootRenown} Renown`);
  if ((exp.lootApproval ?? 0) > 0) lootLines.push(`+${exp.lootApproval} Approval`);
  if ((exp.lootFear ?? 0) > 0) lootLines.push(`+${exp.lootFear} Fear`);
  for (const rel of shardRes.unlocked) {
    const rDef = EXPEDITION_RELIC_MAP[rel];
    lootLines.push(`Relic Unlocked: ${rDef.icon} ${rDef.label}`);
  }

  const summary: ExpeditionFinishSummary = {
    reason,
    lengthKey,
    daysElapsed: exp.day,
    depthReached: exp.depth,
    survivors: survivorNames,
    lostNames,
    lootLines,
    unlockedRelics: shardRes.unlocked,
    addedAfterEffects: addedAfter,
    retaliationTriggered,
    eleonoraAffGain: eleGain,
  };

  const endMsg =
    reason === 'wiped'
      ? '💀 Expedition wiped out!'
      : reason === 'home'
        ? `↩ Expedition extracted early (${survivorNames.length} returned).`
        : `🗺 Expedition returned safely (${survivorNames.length} returned).`;

  const nextLog = [
    ...exp.log,
    `${endMsg}${lootLines.length > 0 ? ` · ${lootLines.join(', ')}` : ''}`,
  ].slice(-20);

  const finalizedExp: RichExpeditionState = {
    active: false,
    lengthKey: null,
    day: exp.day,
    maxDays: exp.maxDays,
    ap: 0,
    depth: exp.depth,
    maxDepth: exp.maxDepth,
    region: exp.region,
    crew: [],
    lootMp: 0,
    lootFood: 0,
    lootPop: 0,
    lootParts: 0,
    lootEggs: 0,
    lootShards: 0,
    lootIntel: 0,
    gear: clamp(exp.gear, 0, EXPED_CFG.GEAR_MAX),
    drill: 0,
    notoriety: 0,
    choices: [],
    activeEncounter: null,
    activeEvent: null,
    arrivedVisited: false,
    clearedLengths: nextCleared,
    afterEffects: nextAfterEffects,
    log: nextLog,
    todaySteps: [
      ...(exp.todaySteps ?? []),
      {
        text: endMsg,
        en:
          reason === 'wiped'
            ? 'None of the war-party returned from the expedition.'
            : `The survivors (${survivorNames.join(', ')}) returned to the dungeon.`,
        majorBeat: 'casualty_or_return',
        artUrl: resolveSceneAsset(
          reason === 'wiped' || lostNames.length > 0 ? 'dk_exd_lost' : 'dk_exd_return'
        ),
      },
    ],
    dayComplete: true,
    lastSummary: summary,
  };

  return {
    ...state,
    points: nextPoints,
    fear: nextFear,
    town: nextTown,
    estate: { ...state.estate, perks: nextPerks },
    prisoners: nextPrisoners,
    eggs: [...state.eggs, ...spawnedEggs],
    relics: shardRes.relics,
    officers: nextOfficers,
    crises: {
      ...state.crises,
      wrath: nextWrath,
      activeRaidMods: nextRaidMods,
    },
    expedition: finalizedExp,
    flash: `${endMsg}${lootLines.length > 0 ? ` · ${lootLines.join(' · ')}` : ''}`,
  };
}

export function endExpeditionDay(state: GameState): GameState {
  const prevExp = asRichExp(state.expedition);
  const exp: RichExpeditionState = {
    ...prevExp,
    crew: prevExp.crew.map((m) => ({ ...m, ailments: [...m.ailments] })),
    todaySteps: [...(prevExp.todaySteps ?? [])],
    evFlags: { ...(prevExp.evFlags ?? {}) },
  };
  if (!exp.active) return state;

  let activeCrew = getActiveCrew(exp);
  if (exp.ap > 0 && activeCrew.length > 0 && !exp.homing) {
    const restHeal = EXPED_CFG.REST_PER_AP * exp.ap;
    healAllCrew(exp, restHeal);
    pushStep(
      exp,
      `😮‍💨 Rested remaining ${exp.ap} AP (+${restHeal} Stamina)`,
      'They made camp early and rested for the remainder of the day.'
    );
    exp.ap = 0;
  }

  // Daily flee check
  if (!exp.homing) {
    for (const m of activeCrew) {
      const fleeChance = getDailyFleeChance(
        { ...state, expedition: exp },
        m
      );
      if (fleeChance > 0 && Math.random() < fleeChance) {
        m.lost = true;
        exp.evFlags = { ...(exp.evFlags ?? {}), flee: true };
        pushStep(
          exp,
          `🏃 ${m.name} slipped away and fled during the night!`,
          `${m.name} slipped away into the night and escaped.`,
          {
            majorBeat: 'casualty_or_return',
            artUrl: resolveSceneAsset('dk_exd_flee'),
          }
        );
      }
    }
  }

  activeCrew = getActiveCrew(exp);
  const summaryLine = `D${exp.day} ${(exp.todaySteps ?? []).map((s) => s.text).join(' / ')}`;
  exp.log = [...exp.log, summaryLine].slice(-12);
  exp.dayComplete = true;

  let endedReason: 'home' | 'done' | 'wiped' | null = null;
  if (activeCrew.length === 0) endedReason = 'wiped';
  else if (exp.homing) endedReason = 'home';
  else if (exp.day >= exp.maxDays) endedReason = 'done';

  const updatedState: GameState = {
    ...state,
    expedition: exp,
  };

  if (endedReason) {
    return finalizeExpedition(updatedState, endedReason);
  }
  return {
    ...updatedState,
    flash: `Day ${exp.day}/${exp.maxDays} complete — review log and proceed.`,
  };
}

export function advanceExpeditionDay(state: GameState): GameState {
  const exp0 = asRichExp(state.expedition);
  if (!exp0.active) return state;

  const exp: RichExpeditionState = {
    ...exp0,
    crew: exp0.crew.map((m) => ({ ...m, ailments: [...m.ailments] })),
    day: exp0.day + 1,
    ap: EXPED_CFG.AP_PER_DAY,
    dayComplete: false,
    stopReason: null,
    evFlags: {},
    todaySteps: [],
    eventActors: {},
  };

  const lenDef = EXPEDITION_LENGTH_MAP[exp.lengthKey ?? 'short'];
  if (lenDef.fatiguePerDay > 0 && exp.day >= EXPED_CFG.FATIGUE_START_DAY) {
    hurtAllCrew(exp, lenDef.fatiguePerDay);
    pushStep(
      exp,
      `🥵 Long march fatigue (-${lenDef.fatiguePerDay} Stamina all)`,
      'The grueling march drained the party.'
    );
    const notes: string[] = [];
    processCrewCasualties(exp, notes);
    for (const n of notes) {
      pushStep(exp, n, n, {
        majorBeat: 'casualty_or_return',
        artUrl: resolveSceneAsset('dk_exd_lost'),
      });
    }
  }

  // Abyssal 3% vanish check
  if (lenDef.lostChance > 0 && getActiveCrew(exp).length > 0 && Math.random() < lenDef.lostChance) {
    for (const m of exp.crew) {
      m.lost = true;
    }
    exp.evFlags = { ...(exp.evFlags ?? {}), lost: true };
    pushStep(
      exp,
      '🌑 The war-party vanished into the abyss!',
      'The entire war-party vanished without a trace into the abyss.',
      {
        majorBeat: 'casualty_or_return',
        artUrl: resolveSceneAsset('dk_exd_lost'),
      }
    );
    return finalizeExpedition({ ...state, expedition: exp }, 'wiped');
  }

  if (getActiveCrew(exp).length === 0) {
    return finalizeExpedition({ ...state, expedition: exp }, 'wiped');
  }

  // Morning event roll (30%)
  const morningEv = rollExpeditionEvent(exp, 'morning');
  if (morningEv) {
    exp.activeEvent = morningEv.key;
    exp.eventActors = morningEv.actors;
    exp.seenEvents = [...(exp.seenEvents ?? []), morningEv.key];
  }

  // Morning encounter roll if not at destination
  if (!exp.activeEncounter && exp.region !== 'village' && exp.region !== 'city') {
    if (Math.random() < EXPED_CFG.ENC_CHANCE * 0.5) {
      exp.activeEncounter = rollRegionEncounter(exp.region);
    }
  }

  return {
    ...state,
    expedition: exp,
    flash: `🗺 Expedition Day ${exp.day}/${exp.maxDays} — 3 AP ready.`,
  };
}

function rollExpeditionEvent(
  exp: RichExpeditionState,
  trigger: 'morning' | 'mv' | 'scout'
): { key: string; actors: { a?: string; b?: string }; isDeep: boolean } | null {
  const activeCrew = getActiveCrew(exp);
  if (activeCrew.length === 0) return null;
  const seen = new Set(exp.seenEvents ?? []);

  // Depth >= 8 Deep event check (35% on mv/scout)
  if (trigger !== 'morning' && exp.depth >= EXPED_CFG.DEEP_DEPTH && Math.random() < EXPED_CFG.EV_CHANCE_DEEP) {
    const deepPool = EXPEDITION_EVENTS.filter(
      (ev) => ev.timing === 'deep' && !seen.has(ev.key) && activeCrew.length >= ev.minCrew
    );
    if (deepPool.length > 0) {
      const picked = pickOne(deepPool);
      const a = pickOne(activeCrew);
      return { key: picked.key, actors: { a: a.name }, isDeep: true };
    }
  }

  const p =
    trigger === 'morning'
      ? EXPED_CFG.EV_CHANCE_MORNING
      : trigger === 'scout'
        ? EXPED_CFG.EV_CHANCE_SCOUT
        : EXPED_CFG.EV_CHANCE_MV;

  if (Math.random() >= p) return null;

  const wantTiming = trigger === 'morning' ? 'morning' : 'field';
  const pool = EXPEDITION_EVENTS.filter((ev) => {
    if (ev.timing !== wantTiming) return false;
    if (seen.has(ev.key)) return false;
    if (activeCrew.length < ev.minCrew) return false;
    if (ev.regions && !ev.regions.includes(exp.region)) return false;
    return true;
  });

  if (pool.length === 0) return null;
  const picked = pickOne(pool);
  const a = pickOne(activeCrew);
  let bName: string | undefined;
  if (picked.minCrew >= 2 && activeCrew.length >= 2) {
    const others = activeCrew.filter((m) => m.pid !== a.pid);
    bName = pickOne(others).name;
  }
  return { key: picked.key, actors: { a: a.name, b: bName }, isDeep: false };
}

export function canPerformExpeditionAction(
  state: GameState,
  act: ExpeditionAction
): { ok: true } | { ok: false; reason: string } {
  const exp = asRichExp(state.expedition);
  if (state.mode !== 'exped' || !exp.active) {
    return { ok: false, reason: 'No active expedition in EXPED phase.' };
  }
  if (exp.dayComplete || exp.ap <= 0) {
    return { ok: false, reason: 'Day AP exhausted — complete this day leg.' };
  }
  if (exp.activeEvent) {
    return { ok: false, reason: 'Resolve the active event first.' };
  }
  if (act === 'atk' || act === 'def') {
    if (!exp.activeEncounter) return { ok: false, reason: 'No active encounter to fight.' };
  } else if (act === 'scout') {
    if (exp.activeEncounter) return { ok: false, reason: 'Resolve active encounter before scouting.' };
  } else if (act === 'mv1' || act === 'mv2' || act === 'mv3') {
    const idx = Number(act.slice(2)) - 1;
    if (!exp.choices[idx]) return { ok: false, reason: 'No path available at that fork.' };
  } else if (act === 'v1' || act === 'v2' || act === 'v3') {
    if (exp.region !== 'village' || exp.arrivedVisited) {
      return { ok: false, reason: 'Available only on first arrival at Border Village.' };
    }
  } else if (act === 'c1' || act === 'c2' || act === 'c3') {
    if (exp.region !== 'city' || exp.arrivedVisited) {
      return { ok: false, reason: 'Available only on first arrival at Royal Capital.' };
    }
  }
  return { ok: true };
}

export function performExpeditionAction(
  state: GameState,
  act: ExpeditionAction
): { ok: boolean; state: GameState; message: string } {
  const guard = canPerformExpeditionAction(state, act);
  if (!guard.ok) {
    return { ok: false, state: { ...state, flash: guard.reason }, message: guard.reason };
  }

  const prevExp = asRichExp(state.expedition);
  const exp: RichExpeditionState = {
    ...prevExp,
    crew: prevExp.crew.map((m) => ({ ...m, ailments: [...m.ailments] })),
    choices: [...prevExp.choices],
    log: [...prevExp.log],
    evFlags: { ...(prevExp.evFlags ?? {}) },
    afFlags: { ...(prevExp.afFlags ?? {}) },
    seenEvents: [...(prevExp.seenEvents ?? [])],
    todaySteps: [...(prevExp.todaySteps ?? [])],
    path: [...(prevExp.path ?? [prevExp.region])],
  };

  const activeCrew = getActiveCrew(exp);
  const reg = getExpeditionRegionDef(exp.region);
  const D = EXPED_CFG.DMG;
  let cost = act === 'camp' || act === 'home' ? exp.ap : 1;
  let text = '';
  let en = '';
  let majorBeat: ExpeditionMajorBeatKind | undefined;
  let stepArt: string | undefined;
  const extraNotes: string[] = [];

  const rollAilmentHit = (m: RichExpeditionCrewMember, prefer?: ExpeditionAilmentKey | null) => {
    if (Math.random() < EXPED_CFG.AILMENT_CHANCE) {
      const ail = inflictAilment(m, prefer);
      if (ail) {
        const def = EXPEDITION_AILMENT_MAP[ail];
        extraNotes.push(`${m.name} ${def.icon}${def.label}`);
      }
    }
  };

  if (act === 'atk' || act === 'def') {
    const encDef = EXPEDITION_ENCOUNTER_MAP[exp.activeEncounter!.key];
    const diff = getEncounterDifficulty(exp.depth, exp.activeEncounter!.diff);
    const ch = getExpeditionWinChance({ ...state, expedition: exp }, diff);
    const won = Math.random() < ch;

    if (act === 'atk') {
      if (won) {
        hurtAllCrew(exp, D.atkOk);
        const lootLabels = applyLootToExp(exp, encDef.loot, getLootMult(exp.depth));
        text = `⚔ Defeated ${encDef.label} (-${D.atkOk} Stamina${lootLabels.length ? ` · ${lootLabels.join(', ')}` : ''})`;
        en = `They attacked ${encDef.prose} and won cleanly.`;
        exp.activeEncounter = null;
        exp.evFlags!.battle = true;
        stepArt = resolveSceneAsset('dk_exd_battle');
      } else {
        for (const m of activeCrew) {
          hurtCrewMember(m, D.atkBad);
          rollAilmentHit(m, reg.ailment);
        }
        text = `⚔ Pushed back by ${encDef.label} (-${D.atkBad} Stamina)`;
        en = `They attacked ${encDef.prose} and were beaten back.`;
        exp.evFlags!.ambush = true;
        stepArt = resolveSceneAsset('dk_exd_ambush');
      }
    } else {
      if (won) {
        hurtAllCrew(exp, D.defOk);
        text = `🛡 Slipped past ${encDef.label} (-${D.defOk} Stamina)`;
        en = `They held formation and slipped past ${encDef.prose}.`;
      } else {
        hurtAllCrew(exp, D.defBad);
        text = `🛡 Weathered ${encDef.label} assault (-${D.defBad} Stamina)`;
        en = `They weathered a hard assault from ${encDef.prose} and broke away.`;
      }
      exp.activeEncounter = null;
    }
  } else if (act === 'scout') {
    const lootParts: string[] = [];
    for (const entry of reg.scoutLoot) {
      if (!entry.chance || Math.random() < entry.chance) {
        const mult =
          entry.kind === 'mp' || entry.kind === 'food'
            ? getLootMult(exp.depth) / EXPED_CFG.LOOT_BASE
            : 1;
        lootParts.push(...applyLootToExp(exp, { [entry.kind]: entry.amount }, mult));
      }
    }
    exp.afFlags!.scout = (exp.afFlags!.scout ?? 0) + 1;
    if (exp.depth >= EXPED_CFG.DEEP_DEPTH && Math.random() < EXPED_CFG.SHARD_CHANCE) {
      exp.lootShards += 1;
      lootParts.push('🔮 +1 Relic Shard');
      majorBeat = 'relic';
    }
    if (Math.random() < 0.15 && activeCrew.length > 0) {
      const m = pickOne(activeCrew);
      hurtCrewMember(m, D.trap);
      const ail = inflictAilment(m, reg.ailment);
      extraNotes.push(`${m.name} Trap -${D.trap}${ail ? ` (${EXPEDITION_AILMENT_MAP[ail].label})` : ''}`);
      exp.evFlags!.ambush = true;
    }
    text = `🔎 Scouted ${reg.label}${lootParts.length ? ` · ${lootParts.join(', ')}` : ' · Nothing found'}`;
    en = `They scouted ${reg.prose}.`;
  } else if (act === 'mv1' || act === 'mv2' || act === 'mv3') {
    const idx = Number(act.slice(2)) - 1;
    const chosen = exp.choices[idx];
    const nextReg = getExpeditionRegionDef(chosen.region);
    const wasSafe = Boolean(exp.safe);
    exp.safe = false;

    exp.depth += 1;
    exp.region = chosen.region;
    exp.path = [...(exp.path ?? []), chosen.region];
    exp.activeEncounter = null;
    exp.arrivedVisited = false;
    exp.choices = buildChoicesForDepth(exp.map, exp.depth);

    const moveDmg = D.move + (nextReg.moveExtraDmg ?? 0);
    hurtAllCrew(exp, moveDmg);
    text = `➡ Marched to ${nextReg.icon} ${nextReg.label} (Depth ${exp.depth}, -${moveDmg} Stamina)`;
    en = `They marched onward into ${nextReg.prose}.`;

    const ambushChance = wasSafe ? 0 : chosen.ambush;
    if (ambushChance > 0 && Math.random() < ambushChance && activeCrew.length > 0) {
      const m = pickOne(activeCrew);
      hurtCrewMember(m, D.ambush);
      const ail = inflictAilment(m, nextReg.ailment);
      extraNotes.push(`${m.name} Ambush -${D.ambush}${ail ? ` (${EXPEDITION_AILMENT_MAP[ail].label})` : ''}`);
      exp.evFlags!.ambush = true;
      stepArt = resolveSceneAsset('dk_exd_ambush');
    }

    if (chosen.region === 'village' || chosen.region === 'city') {
      exp.evFlags![chosen.region === 'village' ? 'village' : 'capital'] = true;
      majorBeat = 'arrival';
      stepArt = resolveSceneAsset(
        chosen.region === 'village' ? 'dk_exd_village' : 'dk_exd_capital'
      );
      text += ' · 📍 Arrived!';
    } else if (Math.random() < EXPED_CFG.ENC_CHANCE) {
      const rolled = rollRegionEncounter(chosen.region);
      if (rolled) {
        exp.activeEncounter = rolled;
        const eDef = EXPEDITION_ENCOUNTER_MAP[rolled.key];
        extraNotes.push(`${eDef.icon} ${eDef.label} encountered`);
      }
    }
  } else if (/^[vc]\d$/.test(act)) {
    const dest = act.startsWith('v') ? 'village' : 'city';
    const arrDef = EXPEDITION_ARRIVALS[dest].find((c) => c.id === act) as ExpeditionArrivalChoiceDef;
    exp.arrivedVisited = true;
    const won =
      arrDef.diff <= 0
        ? true
        : Math.random() <
          getExpeditionWinChance(
            { ...state, expedition: exp },
            arrDef.diff + exp.depth * EXPED_CFG.DEPTH_DIFF
          );
    if (won) {
      const lootLabels = applyLootToExp(exp, arrDef.loot, 1);
      exp.notoriety += arrDef.notoriety;
      exp.evFlags![arrDef.evKey] = true;
      majorBeat = 'arrival';
      stepArt = resolveSceneAsset(`dk_exd_${arrDef.evKey}`);
      text = `${arrDef.icon} ${arrDef.label} succeeded (${lootLabels.join(', ')})`;
      en = `They ${arrDef.prose}.`;
    } else {
      for (const m of activeCrew) {
        hurtCrewMember(m, D.arrBad);
        rollAilmentHit(m, reg.ailment);
      }
      exp.evFlags!.ambush = true;
      stepArt = resolveSceneAsset('dk_exd_ambush');
      text = `${arrDef.icon} ${arrDef.label} failed (-${D.arrBad} Stamina all)`;
      en = `They attempted to ${arrDef.label.toLowerCase()} but were driven back.`;
    }
  } else if (act === 'camp') {
    const hqBonus = state.estate.landmarks.hq ? EXPED_CFG.CAMP_HQ : 0;
    const heal = Math.max(EXPED_CFG.CAMP_MIN, EXPED_CFG.CAMP_BASE * cost) + hqBonus;
    for (const m of activeCrew) {
      m.stamina = Math.min(m.staminaMax ?? 100, m.stamina + heal);
      if (m.ailments.length > 0 && Math.random() < 0.5) {
        const cured = m.ailments[0];
        m.ailments = m.ailments.slice(1);
        extraNotes.push(`${m.name} cured ${EXPEDITION_AILMENT_MAP[cured as ExpeditionAilmentKey]?.label ?? cured}`);
      }
    }
    exp.evFlags!.camp = true;
    stepArt = resolveSceneAsset('dk_exd_camp');
    text = `⛺ Made camp in ${reg.label} (+${heal} Stamina)`;
    en = `They made camp in ${reg.prose} and recovered.`;
    if (Math.random() < 0.1 && activeCrew.length > 0) {
      const m = pickOne(activeCrew);
      hurtCrewMember(m, D.night);
      extraNotes.push(`${m.name} Night Raid -${D.night}`);
      exp.evFlags!.ambush = true;
    }
  } else if (act === 'home') {
    exp.homing = true;
    cost = exp.ap;
    if (Math.random() < 0.1 && activeCrew.length > 0) {
      const m = pickOne(activeCrew);
      hurtCrewMember(m, D.home);
      extraNotes.push(`${m.name} Rearguard Ambush -${D.home}`);
    }
    text = '↩ Forced march back to the dungeon';
    en = 'They broke off the expedition and turned back toward the dungeon.';
    majorBeat = 'casualty_or_return';
    stepArt = resolveSceneAsset('dk_exd_return');
  }

  exp.ap = Math.max(0, exp.ap - cost);
  const anyLost = processCrewCasualties(exp, extraNotes);
  if (anyLost) majorBeat = 'casualty_or_return';

  const fullText = extraNotes.length > 0 ? `${text} · ${extraNotes.join(' · ')}` : text;
  if (!stepArt) {
    stepArt = pickExpeditionArt(exp.evFlags ?? {}, exp.region);
  }
  pushStep(exp, fullText, en, { majorBeat, artUrl: stepArt });

  // Roll event after mv1..3 or scout (if alive and not homing and no arrival)
  if (
    getActiveCrew(exp).length > 0 &&
    !exp.homing &&
    (act === 'scout' || act.startsWith('mv')) &&
    !exp.activeEvent
  ) {
    const rolledEv = rollExpeditionEvent(exp, act === 'scout' ? 'scout' : 'mv');
    if (rolledEv) {
      exp.activeEvent = rolledEv.key;
      exp.eventActors = rolledEv.actors;
      exp.seenEvents = [...(exp.seenEvents ?? []), rolledEv.key];
      if (rolledEv.isDeep) {
        pushStep(
          exp,
          `🌀 Deep Event triggered: ${EXPEDITION_EVENT_MAP[rolledEv.key].title}!`,
          `At depth ${exp.depth}, they stumbled upon ${EXPEDITION_EVENT_MAP[rolledEv.key].title}.`,
          { majorBeat: 'deep_event' }
        );
      }
    }
  }

  const nextState: GameState = {
    ...state,
    expedition: exp,
    flash: fullText,
  };

  if (!exp.activeEvent && (getActiveCrew(exp).length === 0 || exp.ap <= 0 || exp.homing)) {
    return { ok: true, state: endExpeditionDay(nextState), message: fullText };
  }

  return { ok: true, state: nextState, message: fullText };
}

function captureExpeditionCaptive(
  state: GameState,
  grade: HeroGrade,
  classKey: string
): { state: GameState; label: string } {
  const cap = getPrisonCapacity(state);
  if (state.prisoners.length >= cap) {
    return {
      state: { ...state, points: state.points + 80 },
      label: 'Prison full — +80 MP ransom',
    };
  }
  const gender: 'female' | 'male' =
    state.settings.genderPref === 'male'
      ? 'male'
      : state.settings.genderPref === 'female'
        ? 'female'
        : Math.random() < 0.5
          ? 'female'
          : 'male';
  const name = pickOne(EXPEDITION_CAPTIVE_NAMES[gender]);
  const resist = clamp(CFG.PRISON_RESIST[grade] ?? 40, 0, 100);
  const newCaptive: Prisoner = {
    pid: state.nextPid,
    name,
    grade,
    raceLabel: 'human',
    classLabel: classKey,
    traits: [],
    capturedWave: state.wave,
    capturedFloor: 0,
    resist,
    corr: 0,
    gender,
    stamina: 80,
    staminaMax: 100,
    pleasure: 0,
    terror: Math.floor((100 - resist) * 0.3),
    shame: 0,
    marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
    cond: 'injured',
    job: null,
    converted: null,
    assignedFloor: null,
    owner: null,
    afflictions: [],
    breeding: null,
  };
  return {
    state: {
      ...state,
      nextPid: state.nextPid + 1,
      prisoners: [...state.prisoners, newCaptive],
    },
    label: `⛓ Captured ${name} (${grade} ${classKey})`,
  };
}

export function formatExpeditionEventDesc(
  ev: ExpeditionEventDef,
  actors?: { a?: string; b?: string }
): string {
  return ev.desc
    .replace(/\{a\}/g, actors?.a ?? 'A crew member')
    .replace(/\{b\}/g, actors?.b ?? 'another member');
}

export function resolveExpeditionEvent(
  state: GameState,
  choiceIdx: number
): { ok: boolean; state: GameState; summary: string } {
  const exp0 = asRichExp(state.expedition);
  if (!exp0.active || !exp0.activeEvent) {
    return { ok: false, state, summary: 'No active expedition event.' };
  }
  const ev = EXPEDITION_EVENT_MAP[exp0.activeEvent];
  if (!ev || choiceIdx < 1 || choiceIdx > ev.options.length) {
    return { ok: false, state, summary: 'Invalid event choice.' };
  }

  let workingState = state;
  const exp: RichExpeditionState = {
    ...exp0,
    crew: exp0.crew.map((m) => ({ ...m, ailments: [...m.ailments] })),
    afFlags: { ...(exp0.afFlags ?? {}) },
    evFlags: { ...(exp0.evFlags ?? {}) },
    todaySteps: [...(exp0.todaySteps ?? [])],
  };

  const activeCrew = getActiveCrew(exp);
  const a =
    activeCrew.find((m) => m.name === exp.eventActors?.a) ?? activeCrew[0];
  const b =
    activeCrew.find((m) => m.name === exp.eventActors?.b) ??
    activeCrew.find((m) => m.pid !== a?.pid) ??
    a;

  const tryPay = (cost: number): boolean => {
    if (workingState.points < cost) return false;
    workingState = { ...workingState, points: workingState.points - cost };
    return true;
  };
  const winRoll = (baseDiff: number): boolean =>
    Math.random() <
    getExpeditionWinChance(
      { ...workingState, expedition: exp },
      baseDiff + exp.depth * EXPED_CFG.DEPTH_DIFF
    );

  let msg = '';
  let en = '';
  let majorBeat: ExpeditionMajorBeatKind | undefined =
    ev.timing === 'deep' ? 'deep_event' : undefined;

  switch (ev.key) {
    case 'quarrel': {
      if (choiceIdx === 1 && a && b) {
        adjustMemberResist(a, -5);
        adjustMemberResist(b, -5);
        hurtCrewMember(a, 3);
        hurtCrewMember(b, 3);
        msg = `${a.name} & ${b.name} disciplined (-5 Resist, -3 Stamina)`;
        en = 'The quarrel was put down harshly.';
      } else if (a && b) {
        const winner = Math.random() < 0.5 ? a : b;
        const loser = winner === a ? b : a;
        hurtCrewMember(loser, 12);
        adjustMemberResist(winner, -8);
        msg = `${winner.name} won the brawl (${loser.name} -12 Stamina, ${winner.name} -8 Resist)`;
        en = `${winner.name} bested ${loser.name} in a camp brawl.`;
      }
      break;
    }
    case 'whisper': {
      if (choiceIdx === 1 && a) {
        exp.ap = Math.max(0, exp.ap - 1);
        adjustMemberResist(a, -5);
        msg = `Watched ${a.name} all night (-1 AP, -5 Resist)`;
        en = `They kept watch over ${a.name} through the night.`;
      } else if (a) {
        const fleeP = Math.min(0.6, getDailyFleeChance(workingState, a) * 20);
        if (Math.random() < fleeP) {
          a.lost = true;
          exp.evFlags!.flee = true;
          majorBeat = 'casualty_or_return';
          msg = `🏃 ${a.name} used the trust to flee!`;
          en = `${a.name} used the moment of trust to slip away.`;
        } else {
          adjustMemberResist(a, -10);
          msg = `${a.name} stayed moved by trust (-10 Resist)`;
          en = `${a.name} remained loyal.`;
        }
      }
      break;
    }
    case 'campfire': {
      if (choiceIdx === 1) {
        healAllCrew(exp, 8);
        for (const m of activeCrew) adjustMemberResist(m, -3);
        msg = 'Campfire rest (+8 Stamina, -3 Resist all)';
        en = 'They shared warm rations around the campfire.';
      } else {
        hurtAllCrew(exp, 5);
        exp.drill = (exp.drill ?? 0) + 1;
        msg = 'Night sparring (-5 Stamina all, +1 Drill)';
        en = 'They sparred through the evening to sharpen their teamwork.';
      }
      break;
    }
    case 'merchant': {
      if (choiceIdx === 1) {
        if (tryPay(30)) {
          healAllCrew(exp, 20);
          exp.afFlags!.merchant = (exp.afFlags!.merchant ?? 0) + 1;
          msg = 'Bought herbs (-30 MP, +20 Stamina all)';
          en = 'They bought restorative herbs from a traveling peddler.';
        } else {
          msg = 'Not enough MP (30 needed) — passed peddler';
          en = 'They could not afford the peddler’s herbs.';
        }
      } else if (choiceIdx === 2) {
        if (tryPay(50)) {
          exp.gear = Math.min(EXPED_CFG.GEAR_MAX + 1, (exp.gear ?? 0) + 1);
          exp.afFlags!.merchant = (exp.afFlags!.merchant ?? 0) + 1;
          msg = 'Bought blades (-50 MP, +1 Gear)';
          en = 'They purchased spare blades from a peddler.';
        } else {
          msg = 'Not enough MP (50 needed) — passed peddler';
          en = 'They could not afford the peddler’s blades.';
        }
      } else {
        msg = 'Passed the peddler';
        en = 'They waved the peddler off.';
      }
      break;
    }
    case 'spring': {
      if (choiceIdx === 1) {
        if (Math.random() < 0.6) {
          healAllCrew(exp, 20);
          msg = 'Spring water revived the party (+20 Stamina all)';
          en = 'The strange spring water invigorated everyone.';
        } else if (a) {
          if (!a.ailments.includes('drug')) a.ailments.push('drug');
          msg = `${a.name} became 💊 Drugged from the spring`;
          en = `The spring water left ${a.name} dazed and drugged.`;
        }
      } else {
        msg = 'Left the strange spring untouched';
        en = 'They bypassed the glittering spring.';
      }
      break;
    }
    case 'shrine': {
      if (choiceIdx === 1) {
        if (Math.random() < 0.5) {
          healAllCrew(exp, 10);
          exp.lootRenown = (exp.lootRenown ?? 0) + 1;
          msg = 'Shrine blessing (+10 Stamina all, +1 Renown)';
          en = 'Their prayer at the ruined shrine drew a faint blessing.';
        } else {
          hurtAllCrew(exp, 6);
          msg = 'Shrine ward burned the party (-6 Stamina all)';
          en = 'An old ward seared them at the ruined shrine.';
        }
      } else if (choiceIdx === 2) {
        exp.lootMp += 40;
        exp.notoriety += 1;
        exp.afFlags!.desecrate = true;
        msg = 'Looted shrine altar (+40 MP, +1 Notoriety, Desecrate)';
        en = 'They looted the ruined shrine’s altar.';
      } else {
        msg = 'Passed the ruined shrine';
        en = 'They left the ruined shrine in peace.';
      }
      break;
    }
    case 'wounded': {
      if (choiceIdx === 1) {
        if (winRoll(6)) {
          const grade: HeroGrade = Math.random() < 0.3 ? 'B' : 'C';
          const capRes = captureExpeditionCaptive(workingState, grade, pickOne(['warrior', 'ranger', 'priest', 'rogue', 'mage']));
          workingState = capRes.state;
          msg = `Captured wounded hero — ${capRes.label}`;
          en = 'They subdued the wounded hero and sent them back in chains.';
        } else {
          hurtAllCrew(exp, 8);
          msg = 'Wounded hero fought free (-8 Stamina all)';
          en = 'The wounded hero fought desperately and escaped.';
        }
      } else if (choiceIdx === 2) {
        exp.lootMp += 20;
        const gotGear = Math.random() < 0.5;
        if (gotGear) exp.gear = Math.min(EXPED_CFG.GEAR_MAX + 1, (exp.gear ?? 0) + 1);
        msg = `Stripped gear (+20 MP${gotGear ? ', +1 Gear' : ''})`;
        en = 'They stripped the fallen hero’s supplies.';
      } else {
        msg = 'Ignored the wounded hero';
        en = 'They left the wounded hero behind.';
      }
      break;
    }
    case 'toll': {
      if (choiceIdx === 1) {
        if (tryPay(25)) {
          msg = 'Paid bandit toll (-25 MP)';
          en = 'They paid the bandits’ toll and passed.';
        } else {
          hurtAllCrew(exp, 8);
          msg = 'Short on MP — beaten by bandits (-8 Stamina all)';
          en = 'Unable to pay the toll, they took a beating.';
        }
      } else if (choiceIdx === 2) {
        if (winRoll(7)) {
          const gained = Math.round(60 * (getLootMult(exp.depth) / EXPED_CFG.LOOT_BASE));
          exp.lootMp += gained;
          exp.afFlags!.supply = true;
          msg = `Routed bandits (+${gained} MP, Supply Sabotage)`;
          en = 'They cut through the bandits and seized their purse.';
        } else {
          hurtAllCrew(exp, 12);
          msg = 'Driven back by bandits (-12 Stamina all)';
          en = 'The bandits forced them to retreat.';
        }
      } else {
        hurtAllCrew(exp, 6);
        msg = 'Detoured around bandits (-6 Stamina all)';
        en = 'They took a tiring detour around the roadblock.';
      }
      break;
    }
    case 'storm': {
      if (choiceIdx === 1) {
        exp.ap = Math.max(0, exp.ap - 1);
        healAllCrew(exp, 5);
        msg = 'Sheltered from storm (-1 AP, +5 Stamina all)';
        en = 'They waited out the storm under cover.';
      } else {
        hurtAllCrew(exp, 8);
        let ailNote = '';
        if (Math.random() < 0.25 && a) {
          const ail = inflictAilment(a, 'fall');
          if (ail) ailNote = ` · ${a.name} ${EXPEDITION_AILMENT_MAP[ail].label}`;
        }
        msg = `Marched through storm (-8 Stamina all${ailNote})`;
        en = 'They pushed forward through blinding rain.';
      }
      break;
    }
    case 'beast': {
      if (choiceIdx === 1) {
        if (winRoll(7)) {
          exp.lootEggs += 1;
          exp.afFlags!.hunter = true;
          msg = 'Tamed stray monster (+1 Egg, Hunter aftermath)';
          en = 'They captured a stray beast for the dungeon pens.';
        } else if (a) {
          hurtCrewMember(a, 14);
          msg = `Stray beast mauled ${a.name} (-14 Stamina)`;
          en = `The stray beast mauled ${a.name} and fled.`;
        }
      } else {
        exp.lootFood += 12;
        msg = 'Hunted stray beast (+12 Food)';
        en = 'They hunted the beast for fresh rations.';
      }
      break;
    }
    case 'board': {
      if (choiceIdx === 1) {
        exp.lootIntel += 1;
        exp.notoriety += 1;
        msg = 'Tore down Guild bounty board (+1 Intel, +1 Notoriety)';
        en = 'They tore down Guild bounty notices for intelligence.';
      } else {
        if (Math.random() < 0.3) {
          hurtAllCrew(exp, 6);
          msg = 'Forged bounty exposed! (-6 Stamina all)';
          en = 'Their forged bounty was exposed, forcing a hasty retreat.';
        } else {
          exp.lootMp += 30;
          msg = 'Collected forged bounty (+30 MP)';
          en = 'They cashed in a forged bounty notice.';
        }
      }
      break;
    }
    case 'slaver': {
      if (choiceIdx === 1) {
        if (winRoll(8)) {
          exp.lootPop += 15;
          exp.afFlags!.supply = true;
          const capRes = captureExpeditionCaptive(workingState, 'C', 'warrior');
          workingState = capRes.state;
          msg = `Ambushed slavers (+15 Pop, ${capRes.label}, Supply)`;
          en = 'They ambushed the slaver column and took a guard captive.';
        } else {
          hurtAllCrew(exp, 12);
          msg = 'Beaten back by slaver guards (-12 Stamina all)';
          en = 'The slavers’ guards drove them off.';
        }
      } else if (choiceIdx === 2) {
        if (tryPay(80)) {
          const grade: HeroGrade = Math.random() < 0.25 ? 'B' : 'C';
          const capRes = captureExpeditionCaptive(workingState, grade, pickOne(['warrior', 'priest', 'rogue']));
          workingState = capRes.state;
          msg = `Bought captive (-80 MP, ${capRes.label})`;
          en = 'They bought a captive straight from the slaver column.';
        } else {
          msg = 'Not enough MP (80 needed) — passed slavers';
          en = 'They could not afford the slavers’ price.';
        }
      } else {
        msg = 'Let slaver column pass';
        en = 'They watched the slaver column pass.';
      }
      break;
    }
    case 'chest': {
      exp.afFlags!.hunter = true;
      if (choiceIdx === 1) {
        const r = Math.random();
        if (r < 0.5) {
          exp.lootParts += 1;
          exp.lootMp += 40;
          msg = 'Chest treasure (+1 Part, +40 MP)';
          en = 'They pried open an old chest packed with parts and coin.';
        } else if (r < 0.8 && a) {
          hurtCrewMember(a, 15);
          msg = `Chest trap hit ${a.name} (-15 Stamina)`;
          en = `A needle trap in the chest wounded ${a.name}.`;
        } else if (a) {
          hurtCrewMember(a, 10);
          exp.lootEggs += 1;
          msg = `Mimic! ${a.name} -10 Stamina, subdued (+1 Egg)`;
          en = 'The chest was a mimic; they subdued it for the pens.';
        }
      } else {
        msg = 'Left the suspicious chest';
        en = 'They wisely left the dusty chest closed.';
      }
      break;
    }
    case 'home': {
      if (choiceIdx === 1 && a) {
        if (Math.random() < 0.25) {
          a.lost = true;
          exp.evFlags!.flee = true;
          majorBeat = 'casualty_or_return';
          msg = `🏃 ${a.name} vanished in their home village!`;
          en = `${a.name} slipped away in their home village and never returned.`;
        } else {
          adjustMemberResist(a, -10);
          exp.lootFood += 10;
          exp.lootMp += 20;
          msg = `${a.name} returned from village visit (+10 Food, +20 MP, -10 Resist)`;
          en = `${a.name} visited home and brought back supplies.`;
        }
      } else if (a) {
        adjustMemberResist(a, 5);
        msg = `Forbade ${a.name} from visiting home (+5 Resist)`;
        en = `${a.name} was forbidden from visiting their village.`;
      }
      break;
    }
    case 'stash': {
      if (choiceIdx === 1) {
        exp.lootMp += 50;
        msg = `Claimed ${a?.name ?? 'crew'}'s hidden stash (+50 MP)`;
        en = 'They confiscated the entire hidden gold purse.';
      } else if (a) {
        exp.lootMp += 25;
        adjustMemberResist(a, -10);
        msg = `Shared stash with ${a.name} (+25 MP, -10 Resist)`;
        en = `They let ${a.name} keep a share of the hidden coin.`;
      }
      break;
    }
    case 'scout': {
      exp.afFlags!.scout = (exp.afFlags!.scout ?? 0) + 3;
      if (choiceIdx === 1 && a) {
        hurtCrewMember(a, 6);
        exp.safe = true;
        msg = `${a.name} scouted ahead (-6 Stamina, next move 0% Ambush)`;
        en = `${a.name} scouted the path ahead, clearing ambush risk.`;
      } else {
        msg = 'Kept party together';
        en = 'They chose to stay in tight formation.';
      }
      break;
    }
    // 6 Deep events (depth >= 8)
    case 'tomb': {
      if (choiceIdx === 1) {
        exp.lootShards += 1;
        majorBeat = 'relic';
        if (Math.random() < 0.5) {
          hurtAllCrew(exp, 10);
          msg = 'Looted royal tomb (+1 Relic Shard, Curse -10 Stamina all)';
          en = 'They broke the royal crypt for a Relic Shard, triggering a ward.';
        } else {
          msg = 'Looted royal tomb (+1 Relic Shard)';
          en = 'They recovered a Relic Shard from the forgotten king’s tomb.';
        }
      } else {
        msg = 'Left the royal tomb sealed';
        en = 'They left the ancient tomb undisturbed.';
      }
      break;
    }
    case 'nest': {
      if (choiceIdx === 1) {
        if (Math.random() < 0.5) {
          exp.lootEggs += 2;
          exp.lootMp += 80;
          msg = 'Raided Dragon Nest (+2 Eggs, +80 MP)';
          en = 'They stole eggs and gold right from beneath a sleeping wyrm.';
        } else {
          hurtAllCrew(exp, 18);
          msg = 'Dragon awoke! (-18 Stamina all)';
          en = 'The dragon woke and scorched the party as they fled.';
        }
      } else {
        msg = 'Snuck past the dragon nest';
        en = 'They crept silently past the sleeping dragon.';
      }
      break;
    }
    case 'vault': {
      exp.afFlags!.supply = true;
      if (choiceIdx === 1) {
        exp.lootMp += 100;
        exp.lootIntel += 1;
        msg = 'Looted Guild Secret Vault (+100 MP, +1 Intel, Supply Sabotage)';
        en = 'They plundered a secret Guild supply vault.';
      } else {
        exp.notoriety += 1;
        msg = 'Burned Guild Secret Vault (+1 Notoriety, Supply Sabotage)';
        en = 'They torched the Guild’s secret supply cache.';
      }
      break;
    }
    case 'deserter': {
      if (choiceIdx === 1) {
        exp.lootPop += 20;
        healAllCrew(exp, 10);
        msg = 'Recruited deserters (+20 Pop, +10 Stamina all)';
        en = 'Demon-Army stragglers joined the column.';
      } else {
        exp.gear = Math.min(EXPED_CFG.GEAR_MAX + 1, (exp.gear ?? 0) + 1);
        msg = 'Disarmed deserters (+1 Gear)';
        en = 'They disarmed the stragglers for spare gear.';
      }
      break;
    }
    case 'pilgrim': {
      if (choiceIdx === 1) {
        if (Math.random() < getExpeditionWinChance({ ...workingState, expedition: exp }, 9 + exp.depth)) {
          workingState = {
            ...workingState,
            crises: { ...workingState.crises, wrath: clamp(workingState.crises.wrath + 10, 0, 100) },
          };
          exp.afFlags!.desecrate = true;
          const capRes = captureExpeditionCaptive(workingState, 'A', 'priest');
          workingState = capRes.state;
          msg = `Ambushed pilgrimage (+10 Wrath, Desecrate, ${capRes.label})`;
          en = 'They ambushed a saint’s procession and captured a high-ranking priest.';
        } else {
          hurtAllCrew(exp, 12);
          msg = 'Driven back by pilgrim paladins (-12 Stamina all)';
          en = 'Escort paladins repelled the ambush.';
        }
      } else {
        msg = 'Hid from the pilgrimage';
        en = 'They stayed hidden until the holy procession passed.';
      }
      break;
    }
    case 'rift': {
      if (choiceIdx === 1) {
        if (Math.random() < 0.4) {
          const grade: HeroGrade = Math.random() < 0.3 ? 'SS' : 'S';
          const capRes = captureExpeditionCaptive(workingState, grade, 'mage');
          workingState = capRes.state;
          msg = `Pulled figure from the rift (${capRes.label})`;
          en = 'They dragged an otherworldly mage out of the spatial tear.';
        } else if (a) {
          hurtCrewMember(a, 20);
          msg = `Rift lashed ${a.name} (-20 Stamina)`;
          en = `Chaotic energy from the rift blasted ${a.name}.`;
        }
      } else {
        exp.lootShards += 1;
        majorBeat = 'relic';
        msg = 'Sealed the rift (+1 Relic Shard)';
        en = 'They sealed the rift and claimed a crystallized Relic Shard.';
      }
      break;
    }
  }

  exp.activeEvent = null;
  exp.eventActors = {};
  const notes: string[] = [];
  if (processCrewCasualties(exp, notes)) {
    majorBeat = 'casualty_or_return';
  }
  const fullSummary = `${ev.icon} ${ev.title}: ${msg}${notes.length ? ` · ${notes.join(' · ')}` : ''}`;
  pushStep(exp, fullSummary, en, {
    majorBeat,
    artUrl: pickExpeditionArt(exp.evFlags ?? {}, exp.region),
  });

  const nextState: GameState = {
    ...workingState,
    expedition: exp,
    flash: fullSummary,
  };

  if (getActiveCrew(exp).length === 0 || exp.ap <= 0) {
    return { ok: true, state: endExpeditionDay(nextState), summary: fullSummary };
  }

  return { ok: true, state: nextState, summary: fullSummary };
}

export function getAutoProgressStopReason(state: GameState): string | null {
  const exp = asRichExp(state.expedition);
  const activeCrew = getActiveCrew(exp);
  if (activeCrew.length === 0) return null;

  let lowest = Infinity;
  let allBelowAdvise = true;
  for (const m of activeCrew) {
    if (m.stamina < lowest) lowest = m.stamina;
    if (m.stamina >= EXPED_CFG.ADVISE_STAMINA) allBelowAdvise = false;
  }

  if (allBelowAdvise) {
    return `Retreat advised — all crew under ${EXPED_CFG.ADVISE_STAMINA} Stamina`;
  }
  if (lowest < EXPED_CFG.STOP_STAMINA) {
    return `Safety pause — crew member at ${lowest} Stamina (< ${EXPED_CFG.STOP_STAMINA})`;
  }
  if ((exp.region === 'village' || exp.region === 'city') && !exp.arrivedVisited) {
    const reg = getExpeditionRegionDef(exp.region);
    return `Arrived at 📍 ${reg.label} — choose arrival action`;
  }
  if (!exp.activeEncounter && exp.choices.length > 0) {
    const allDangerous = exp.choices.every((c) => c.ambush >= EXPED_CFG.AMBUSH_DANGER);
    if (allDangerous) {
      return 'Dangerous fork — all 3 routes have >= 30% ambush risk';
    }
  }
  return null;
}

export function recommendExpeditionAction(state: GameState): ExpeditionAction {
  const exp = asRichExp(state.expedition);
  const activeCrew = getActiveCrew(exp);
  const lowest = activeCrew.reduce((min, m) => Math.min(min, m.stamina), 999);
  if (lowest < 45) return 'camp';

  if ((exp.region === 'village' || exp.region === 'city') && !exp.arrivedVisited) {
    return exp.region === 'village' ? 'v1' : 'c2';
  }

  if (exp.activeEncounter) {
    const diff = getEncounterDifficulty(exp.depth, exp.activeEncounter.diff);
    return getExpeditionWinChance(state, diff) >= 0.6 ? 'atk' : 'def';
  }

  if (exp.choices.length > 0) {
    let bestScore = Infinity;
    let bestIdx: 1 | 2 | 3 = 1;
    for (const c of exp.choices) {
      const isDest = c.region === 'village' || c.region === 'city';
      const score = (isDest ? -1 : 0) + c.ambush;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = c.idx;
      }
    }
    return `mv${bestIdx}` as ExpeditionAction;
  }

  return 'scout';
}

export function runExpeditionAutoDay(
  state: GameState,
  opts?: { ignoreInitialStop?: boolean }
): {
  state: GameState;
  stoppedReason: string | null;
  steps: number;
  completedDay: boolean;
} {
  let current = state;
  let steps = 0;

  // Auto-resolve any pending event first
  const initialExp = asRichExp(current.expedition);
  if (initialExp.active && initialExp.activeEvent) {
    const ev = EXPEDITION_EVENT_MAP[initialExp.activeEvent];
    current = resolveExpeditionEvent(current, ev?.autoChoice ?? 1).state;
    steps += 1;
  }

  for (let i = 0; i < 6; i++) {
    const exp = asRichExp(current.expedition);
    if (!exp.active || exp.dayComplete || exp.ap <= 0) {
      return {
        state: current,
        stoppedReason: null,
        steps,
        completedDay: Boolean(exp.dayComplete || !exp.active),
      };
    }

    const skipStop = Boolean(opts?.ignoreInitialStop && i === 0);
    if (!skipStop) {
      const stop = getAutoProgressStopReason(current);
      if (stop) {
        return {
          state: {
            ...current,
            expedition: { ...exp, stopReason: stop } as RichExpeditionState,
            flash: `⏸ Auto-Progress paused: ${stop}`,
          },
          stoppedReason: stop,
          steps,
          completedDay: false,
        };
      }
    }

    let act = recommendExpeditionAction(current);
    if (!canPerformExpeditionAction(current, act).ok) {
      act = 'camp';
    }
    const res = performExpeditionAction(current, act);
    current = res.state;
    steps += 1;

    // Auto-resolve event if triggered
    const postExp = asRichExp(current.expedition);
    if (postExp.active && postExp.activeEvent) {
      const ev = EXPEDITION_EVENT_MAP[postExp.activeEvent];
      current = resolveExpeditionEvent(current, ev?.autoChoice ?? 1).state;
    }
  }

  const finalExp = asRichExp(current.expedition);
  if (finalExp.active && !finalExp.dayComplete) {
    current = endExpeditionDay(current);
  }
  return {
    state: current,
    stoppedReason: null,
    steps,
    completedDay: true,
  };
}

export function buildExpeditionChronicleContext(state: GameState): {
  title: string;
  sceneContext: string;
  imageUrl?: string;
  isMajorBeat: boolean;
  majorBeatLabel?: string;
} {
  const exp = asRichExp(state.expedition);
  const reg = getExpeditionRegionDef(exp.region);
  const steps = exp.todaySteps ?? [];
  const lastSummary = exp.lastSummary;
  const crewNames =
    getActiveCrew(exp).length > 0
      ? getActiveCrew(exp).map((m) => `${m.name} (${m.grade}, ${m.stamina} ST)`).join(', ')
      : lastSummary?.survivors.join(', ') || 'No survivors left';

  const majorStep = [...steps].reverse().find((s) => Boolean(s.majorBeat));
  const isMajorBeat = Boolean(majorStep);
  const beatLabels: Record<ExpeditionMajorBeatKind, string> = {
    arrival: 'Destination Arrival',
    deep_event: 'Deep Frontier Event (Depth 8+)',
    relic: 'Relic Shard / Relic Discovery',
    casualty_or_return: 'Crew Casualty / Return',
  };

  const title = lastSummary
    ? `〔DK-EXP〕 Expedition ${lastSummary.reason.toUpperCase()} — Day ${lastSummary.daysElapsed}`
    : `〔DK-EXP〕 Day ${exp.day}/${exp.maxDays} · ${reg.label} (Depth ${exp.depth})`;

  const lines = steps.map((s) => `- ${s.en || s.text}`);
  if (lines.length === 0 && exp.log.length > 0) {
    lines.push(`- ${exp.log[exp.log.length - 1]}`);
  }

  const sceneContext = [
    `[DK-EXPEDITION CHRONICLE]`,
    `Crew: ${crewNames}`,
    `Location: ${reg.prose} (Depth ${exp.depth}/${exp.maxDepth})`,
    `Day ${exp.day}/${exp.maxDays} Events:`,
    ...lines,
    lastSummary
      ? `Conclusion (${lastSummary.reason}): ${lastSummary.lootLines.join(', ') || 'No loot'}.`
      : 'Keep narration focused on travel, skirmishes, camp camaraderie, and tension (no sexual content in injury/death).',
  ].join('\n');

  const imageUrl =
    majorStep?.artUrl ??
    pickExpeditionArt(exp.evFlags ?? {}, exp.region);

  return {
    title,
    sceneContext,
    imageUrl,
    isMajorBeat,
    majorBeatLabel: majorStep?.majorBeat ? beatLabels[majorStep.majorBeat] : undefined,
  };
}

export { appendDayLogLine };
