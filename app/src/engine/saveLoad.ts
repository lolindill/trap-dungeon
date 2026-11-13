import { CFG, OPENING_TEXT } from '../data/constants';
import { assetUrl } from '../data/assetManifest';
import { STARTER_BLUEPRINTS } from '../data/starterBlueprints';
import type {
  ChronicleEntry,
  CrisesState,
  DayLogLine,
  DebtState,
  DifficultyMode,
  EndingsState,
  EstateState,
  ExpeditionLengthKey,
  ExpeditionState,
  FloorCombatSlot,
  FloorState,
  GameMode,
  GameSettings,
  GameState,
  HeroCondition,
  HeroGrade,
  LlmConfig,
  MonsterEgg,
  MonsterInstance,
  OfficerProgress,
  OfficersState,
  Prisoner,
  PrisonerConversion,
  RankTrialsState,
  RealmConfigMode,
  RealmState,
  RelicsState,
  RoomBlueprintSlot,
  SaveSlotId,
  SaveSlotMetadata,
  SaveSlotRecord,
  SlotGrade,
  SynergyGrade,
  TownPolicy,
  TownState,
  TrapBlueprint,
  TrapSlot,
  WarState,
  WaveStartSnapshot,
  WondersState,
} from '../types/game';
import { createEmptyFloors, isSynergyGrade, isTrapGrade } from './dungeon';
import { clamp, uid } from './rng';

export const STORAGE_GAME_KEY = 'etdm_standalone_state_v1';
export const STORAGE_BLUEPRINTS_KEY = 'etdm_standalone_blueprints_v1';
export const STORAGE_LLM_KEY = 'etdm_standalone_llm_v1';
export const STORAGE_SLOTS_KEY = 'etdm_standalone_slots_v2';
export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3, 4, 5];

const VALID_MODES = new Set<GameMode>([
  'build',
  'prep',
  'raid',
  'result',
  'estate',
  'msettle',
  'exped',
  'debt',
  'over',
]);

const VALID_HERO_GRADES = new Set<HeroGrade>([...CFG.HERO_GRADES, 'EPIC']);
const VALID_CONVERSIONS = new Set<PrisonerConversion>([
  'guard',
  'servant',
  'pet',
  'dancer',
  'hired',
]);

function isRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function asNonNegInt(val: unknown, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.floor(val)) : fallback;
}

function asNumber(val: unknown, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

function asString(val: unknown, fallback: string): string {
  return typeof val === 'string' ? val : fallback;
}

function asBoolean(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

function asStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((x): x is string => typeof x === 'string') : [];
}

function normalizeSlotGrade(val: unknown): SlotGrade {
  if (typeof val === 'string' && isTrapGrade(val)) return val;
  return '?';
}

function normalizeSynergyGrade(val: unknown, slotCount: number): SynergyGrade {
  if (slotCount < 2) return '-';
  if (typeof val === 'string' && isSynergyGrade(val)) return val;
  return '?';
}

export function createInitialTownState(): TownState {
  return {
    lv: 1,
    pop: 60,
    approval: 50,
    order: 60,
    housing: 50,
    food: 40,
    renown: 20,
    policy: 'normal',
    guard: 0,
    famine: 0,
    riot: 0,
    lastTax: 0,
  };
}

export function createInitialEstateState(): EstateState {
  return {
    facilities: {},
    landmarks: {},
    vaultMp: 0,
    activeLocation: null,
    activeCrisis: null,
    crisisCooldowns: {},
    lastCrises: [],
    perks: {},
    casualGraceUsed: false,
    nobreachStreak: 0,
    upkeepArrears: 0,
    trailingIncome: [],
    exploreCountToday: 0,
  };
}

export function createInitialDebtState(currentWave = 0): DebtState {
  return {
    amount: 3000,
    extraLoan: 0,
    startWave: currentWave,
    dueWave: currentWave + 3,
    cycleCount: 0,
    step: 0,
    lates: 0,
    patience: 60,
    reliefUsed: 0,
    extCarry: 0,
    minCut: 0,
    noInterest: false,
    forgiveUsed: false,
    paidThisVisit: 0,
    entertainedThisVisit: false,
    activeQuest: null,
    offeredQuests: [],
    ended: null,
  };
}

export function createInitialOfficersState(): OfficersState {
  return {
    vesper: { aff: 0, stage: 0, cooldowns: {}, usedOnce: {} },
    lilim: { aff: 0, stage: 0, cooldowns: {}, usedOnce: {} },
    eleonora: { aff: 10, stage: 0, cooldowns: {}, usedOnce: {} },
    waveAffGain: { vesper: 0, lilim: 0, eleonora: 0 },
  };
}

export function createInitialExpeditionState(): ExpeditionState {
  return {
    active: false,
    lengthKey: null,
    day: 0,
    maxDays: 0,
    ap: 0,
    depth: 0,
    maxDepth: 0,
    region: 'out',
    crew: [],
    lootMp: 0,
    lootFood: 0,
    lootPop: 0,
    lootParts: 0,
    lootEggs: 0,
    lootShards: 0,
    lootIntel: 0,
    gear: 0,
    drill: 0,
    notoriety: 0,
    choices: [],
    activeEncounter: null,
    activeEvent: null,
    arrivedVisited: false,
    clearedLengths: [],
    afterEffects: [],
    log: [],
  };
}

export function createInitialRealmState(): RealmState {
  return {
    active: [],
    cooldowns: {},
    gprep: {
      lv: 0,
      topTags: [],
      sameSigStreak: 0,
      lastSig: '',
    },
  };
}

export function createInitialCrisesState(): CrisesState {
  return {
    wrath: 0,
    cleanKillStreak: 0,
    crusade: { active: false, wavesLeft: 0, cooldown: 0 },
    nemesis: [],
    siege: { active: false, day: 0, wins: 0, losses: 0, cooldown: 0 },
    jailbreakPending: false,
    activeRaidMods: [],
    pendingGameOver: null,
  };
}

export function createInitialWarState(): WarState {
  return {
    rivals: {
      paladin: { scouted: false, wins: 0, annexed: false, def: 12 },
      merchant: { scouted: false, wins: 0, annexed: false, def: 10 },
      witch: { scouted: false, wins: 0, annexed: false, def: 14 },
    },
  };
}

export function createInitialWondersState(): WondersState {
  return { spire: false, temple: false, gold: false };
}

export function createInitialRelicsState(): RelicsState {
  return { owned: [], shards: 0 };
}

export function createInitialEndingsState(): EndingsState {
  return {
    unlocked: {},
    endless: false,
    activeEnding: null,
    gameOver: null,
    titles: [],
  };
}

export function createInitialRankTrialsState(currentWave = 0): RankTrialsState {
  return {
    active: false,
    rank: 0,
    currentTrial: null,
    progress: 0,
    target: 0,
    nextCheckWave: currentWave,
  };
}

export function createDefaultGameSettings(): GameSettings {
  return {
    genderPref: 'random',
    raceScope: 'all',
    gore: false,
    autoScrollChronicle: true,
    aiLanguage: 'th',
    difficulty: 'normal',
    skipDay: false,
    upkeepEnabled: false,
    realmConfig: 'on',
    showPendingGrades: true,
    autoNarrateMajorCrises: false,
  };
}

/**
 * Captures a deep-cloned Wave-Start snapshot with `waveStartSnapshot` stripped
 * so snapshots never nest recursively.
 */
export function captureWaveStartSnapshot(state: GameState): WaveStartSnapshot {
  const { waveStartSnapshot: _ignored, ...rest } = state;
  return JSON.parse(JSON.stringify(rest)) as WaveStartSnapshot;
}

export function withWaveStartSnapshot(state: GameState): GameState {
  return {
    ...state,
    waveStartSnapshot: captureWaveStartSnapshot(state),
  };
}

export function restoreWaveStartSnapshot(state: GameState): GameState | null {
  if (!state.waveStartSnapshot) return null;
  const restored = migrateGameStateInternal(state.waveStartSnapshot, true);
  return withWaveStartSnapshot(restored);
}

export function createInitialGameState(): GameState {
  const base: GameState = {
    schemaVersion: 2,
    version: CFG.VERSION,
    mode: 'build',
    points: CFG.START_POINTS,
    wave: 0,
    day: 0,
    ap: 3,
    apMax: 3,
    dayClosed: false,
    entApPenalty: 0,
    apUsed: {},
    dayLines: [],
    apGrowth: { wipes: 0, conv: 0, quests: 0 },
    floorCursor: 0,
    selectedFloor: 1,
    kills: 0,
    famePoints: 0,
    fame: 0,
    momentum: 0,
    fear: 0,
    lust: 0,
    guildPoints: 0,
    guildActive: false,
    floors: createEmptyFloors(),
    party: [],
    prisoners: [],
    nextPid: 1,
    evalScores: null,
    prepMeta: null,
    awaitingNarration: false,
    raidFirstRoom: true,
    lastRaidDetail: '',
    lastOutcome: null,
    lastAudit: [],
    lastSettlement: null,
    flash: 'Ready in Build mode — craft traps or deploy a Trap Shortcut!',
    chronicle: [
      {
        id: 'opening_1',
        kind: 'opening',
        title: 'The Core Awakens',
        text: OPENING_TEXT,
        bannerUrl: assetUrl('/assets/other/image/dk_open_1.webp.webp'),
        timestamp: Date.now(),
      },
    ],
    recentHeroSignatures: [],
    settings: createDefaultGameSettings(),
    town: createInitialTownState(),
    estate: createInitialEstateState(),
    debt: createInitialDebtState(0),
    officers: createInitialOfficersState(),
    monsters: [],
    eggs: [],
    expedition: createInitialExpeditionState(),
    realm: createInitialRealmState(),
    crises: createInitialCrisesState(),
    war: createInitialWarState(),
    wonders: createInitialWondersState(),
    relics: createInitialRelicsState(),
    endings: createInitialEndingsState(),
    rankTrials: createInitialRankTrialsState(0),
    waveStartSnapshot: null,
  };
  return withWaveStartSnapshot(base);
}

export function createDefaultLlmConfig(): LlmConfig {
  return {
    provider: 'openai_compat',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.85,
    maxTokens: 2048,
  };
}

function migratePrisoner(raw: unknown, fallbackPid: number): Prisoner | null {
  if (!isRecord(raw)) return null;
  const pid = asNonNegInt(raw.pid, fallbackPid);
  const name = asString(raw.name, `Captive #${pid}`).trim() || `Captive #${pid}`;
  const rawGrade = asString(raw.grade, 'D') as HeroGrade;
  const grade: HeroGrade = VALID_HERO_GRADES.has(rawGrade) ? rawGrade : 'D';
  const traits = asStringArray(raw.traits);
  const resist = clamp(asNumber(raw.resist, CFG.PRISON_RESIST[grade] ?? 40), 0, 100);
  const corr = clamp(asNumber(raw.corr, 0), 0, 100);
  const staminaMax = asNonNegInt(raw.staminaMax, traits.includes('tough') ? 120 : 100) || 100;
  const stamina = clamp(asNumber(raw.stamina, 100), 0, staminaMax);

  const rawMarks = isRecord(raw.marks) ? raw.marks : {};
  const rawCond = asString(raw.cond, '');
  const cond: HeroCondition = rawCond === 'injured' || rawCond === 'severe' ? rawCond : '';
  const rawConverted = raw.converted;
  const converted: PrisonerConversion | null =
    typeof rawConverted === 'string' && VALID_CONVERSIONS.has(rawConverted as PrisonerConversion)
      ? (rawConverted as PrisonerConversion)
      : null;

  const rawBreeding = isRecord(raw.breeding)
    ? {
        lineage: asString(raw.breeding.lineage, 'beast'),
        dueWave: asNonNegInt(raw.breeding.dueWave, 1),
        xp: asNonNegInt(raw.breeding.xp, 0),
        ...(typeof raw.breeding.trait === 'string' ? { trait: raw.breeding.trait } : {}),
      }
    : null;

  return {
    pid,
    name,
    grade,
    raceLabel: asString(raw.raceLabel, 'human'),
    classLabel: asString(raw.classLabel, 'warrior'),
    traits,
    capturedWave: asNonNegInt(raw.capturedWave, 1),
    capturedFloor: asNonNegInt(raw.capturedFloor, 1),
    resist,
    corr,
    gender: raw.gender === 'male' ? 'male' : 'female',
    stamina,
    staminaMax,
    pleasure: clamp(asNumber(raw.pleasure, Math.floor(corr * 0.5)), 0, 100),
    terror: clamp(asNumber(raw.terror, Math.floor((100 - resist) * 0.3)), 0, 100),
    shame: clamp(asNumber(raw.shame, 0), 0, 100),
    marks: {
      obey: asNonNegInt(rawMarks.obey, 0),
      pleasure: asNonNegInt(rawMarks.pleasure, 0),
      terror: asNonNegInt(rawMarks.terror, 0),
      shame: asNonNegInt(rawMarks.shame, 0),
    },
    cond,
    job: typeof raw.job === 'string' ? raw.job : null,
    converted,
    assignedFloor: typeof raw.assignedFloor === 'number' ? raw.assignedFloor : null,
    owner: raw.owner === 'V' || raw.owner === 'L' ? raw.owner : null,
    ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
    ...(typeof raw.customName === 'string' ? { customName: raw.customName } : {}),
    ...(typeof raw.dying === 'boolean' ? { dying: raw.dying } : {}),
    ...(typeof raw.legend === 'boolean' ? { legend: raw.legend } : {}),
    afflictions: asStringArray(raw.afflictions),
    ...(typeof raw.dressed === 'boolean' ? { dressed: raw.dressed } : {}),
    ...(typeof raw.branded === 'boolean' ? { branded: raw.branded } : {}),
    ...(typeof raw.cow === 'boolean' ? { cow: raw.cow } : {}),
    ...(typeof raw.crest === 'boolean' ? { crest: raw.crest } : {}),
    ...(typeof raw.broken === 'boolean' ? { broken: raw.broken } : {}),
    ...(typeof raw.renamed === 'boolean' ? { renamed: raw.renamed } : {}),
    ...(typeof raw.virgin === 'boolean' ? { virgin: raw.virgin } : {}),
    breeding: rawBreeding,
    ...(typeof raw.moleRaidsLeft === 'number' ? { moleRaidsLeft: raw.moleRaidsLeft } : {}),
    ...(typeof raw.intel === 'number' ? { intel: raw.intel } : {}),
  };
}

function migrateFloors(rawFloors: unknown[]): FloorState[] {
  const defaults = createEmptyFloors();
  return defaults.map((defFloor, idx) => {
    const candidate = rawFloors.find((f) => isRecord(f) && f.floor === idx + 1) ?? rawFloors[idx];
    if (!isRecord(candidate)) return defFloor;
    const rawSlots = Array.isArray(candidate.slots) ? candidate.slots : [];
    const slots: TrapSlot[] = rawSlots
      .filter((s): s is Record<string, unknown> => isRecord(s) && typeof s.text === 'string')
      .slice(0, CFG.SLOTS)
      .map((s) => ({
        id: asString(s.id, uid('trap')),
        text: s.text as string,
        grade: normalizeSlotGrade(s.grade),
        types: asStringArray(s.types),
        mpInvested: asNonNegInt(s.mpInvested, 0),
        ...(typeof s.blueprintId === 'string' ? { blueprintId: s.blueprintId } : {}),
      }));

    const combatSlots: FloorCombatSlot[] = Array.isArray(candidate.combatSlots)
      ? candidate.combatSlots
          .filter((cs): cs is FloorCombatSlot => {
            if (!isRecord(cs)) return false;
            if (cs.kind === 'monster' && typeof cs.monsterId === 'string') return true;
            if (cs.kind === 'prisoner' && typeof cs.pid === 'number') return true;
            return false;
          })
          .slice(0, 2)
      : [];

    return {
      floor: idx + 1,
      slots,
      synergy: normalizeSynergyGrade(candidate.synergy, slots.length),
      combatSlots,
      ...(typeof candidate.labBuff === 'boolean' ? { labBuff: candidate.labBuff } : {}),
    };
  });
}

function migrateSettings(rawSettings: unknown): GameSettings {
  const d = createDefaultGameSettings();
  if (!isRecord(rawSettings)) return d;

  const difficulty: DifficultyMode =
    rawSettings.difficulty === 'casual' ||
    rawSettings.difficulty === 'normal' ||
    rawSettings.difficulty === 'hard'
      ? rawSettings.difficulty
      : d.difficulty;

  const realmConfig: RealmConfigMode =
    rawSettings.realmConfig === 'on' ||
    rawSettings.realmConfig === 'half' ||
    rawSettings.realmConfig === 'off'
      ? rawSettings.realmConfig
      : d.realmConfig;

  return {
    genderPref:
      rawSettings.genderPref === 'female' ||
      rawSettings.genderPref === 'male' ||
      rawSettings.genderPref === 'random'
        ? rawSettings.genderPref
        : d.genderPref,
    raceScope:
      rawSettings.raceScope === 'all' ||
      rawSettings.raceScope === 'fantasy' ||
      rawSettings.raceScope === 'humanoid' ||
      rawSettings.raceScope === 'human'
        ? rawSettings.raceScope
        : d.raceScope,
    gore: asBoolean(rawSettings.gore, d.gore),
    autoScrollChronicle: asBoolean(rawSettings.autoScrollChronicle, d.autoScrollChronicle),
    aiLanguage: rawSettings.aiLanguage === 'en' || rawSettings.aiLanguage === 'th'
      ? rawSettings.aiLanguage
      : d.aiLanguage,
    difficulty,
    skipDay: asBoolean(rawSettings.skipDay, d.skipDay),
    upkeepEnabled:
      typeof rawSettings.upkeepEnabled === 'boolean'
        ? rawSettings.upkeepEnabled
        : difficulty === 'hard',
    realmConfig,
    showPendingGrades: asBoolean(rawSettings.showPendingGrades, d.showPendingGrades),
    autoNarrateMajorCrises: asBoolean(
      rawSettings.autoNarrateMajorCrises,
      d.autoNarrateMajorCrises ?? false,
    ),
  };
}

function migrateOfficerProgress(raw: unknown, defaultAff: number): OfficerProgress {
  if (!isRecord(raw)) {
    return { aff: defaultAff, stage: 0, cooldowns: {}, usedOnce: {} };
  }
  const cooldowns: Record<string, number> = {};
  if (isRecord(raw.cooldowns)) {
    for (const [k, v] of Object.entries(raw.cooldowns)) {
      if (typeof v === 'number' && Number.isFinite(v)) cooldowns[k] = v;
    }
  }
  const usedOnce: Record<string, boolean> = {};
  if (isRecord(raw.usedOnce)) {
    for (const [k, v] of Object.entries(raw.usedOnce)) {
      if (typeof v === 'boolean') usedOnce[k] = v;
    }
  }
  return {
    aff: asNonNegInt(raw.aff, defaultAff),
    stage: clamp(asNonNegInt(raw.stage, 0), 0, 5),
    cooldowns,
    usedOnce,
  };
}

function migrateNumberRecord(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function migrateBooleanRecord(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function migrateGameStateInternal(raw: unknown, skipSnapshot: boolean): GameState {
  const defaults = createInitialGameState();
  if (!isRecord(raw) || !Array.isArray(raw.floors)) {
    return skipSnapshot ? { ...defaults, waveStartSnapshot: null } : defaults;
  }

  const currentWave = asNonNegInt(raw.wave, 0);
  const rawMode = asString(raw.mode, 'build') as GameMode;
  const mode: GameMode = VALID_MODES.has(rawMode) ? rawMode : 'build';

  const apMax = clamp(asNonNegInt(raw.apMax, 3), 3, 6);
  const ap = clamp(asNonNegInt(raw.ap, apMax), 0, 12);

  const rawDayLines: DayLogLine[] = Array.isArray(raw.dayLines)
    ? raw.dayLines
        .filter((l): l is Record<string, unknown> => isRecord(l) && typeof l.text === 'string')
        .map((l) => ({
          text: l.text as string,
          ...(typeof l.star === 'boolean' ? { star: l.star } : {}),
          ...(typeof l.kind === 'string' ? { kind: l.kind } : {}),
          ...(typeof l.art === 'string' ? { art: l.art } : {}),
        }))
    : [];

  const rawApGrowth = isRecord(raw.apGrowth) ? raw.apGrowth : {};

  const prisoners: Prisoner[] = Array.isArray(raw.prisoners)
    ? raw.prisoners
        .map((p, idx) => migratePrisoner(p, idx + 1))
        .filter((p): p is Prisoner => p !== null)
    : [];

  const maxPid = prisoners.reduce((m, p) => Math.max(m, p.pid), 0);
  const nextPid = Math.max(asNonNegInt(raw.nextPid, maxPid + 1), maxPid + 1);

  const townDef = createInitialTownState();
  const rawTown = isRecord(raw.town) ? raw.town : {};
  const rawPolicy = asString(rawTown.policy, 'normal') as TownPolicy;
  const town: TownState = {
    lv: clamp(asNonNegInt(rawTown.lv, townDef.lv), 1, 7),
    pop: asNonNegInt(rawTown.pop, townDef.pop),
    approval: clamp(asNumber(rawTown.approval, townDef.approval), 0, 100),
    order: clamp(asNumber(rawTown.order, townDef.order), 0, 100),
    housing: clamp(asNumber(rawTown.housing, townDef.housing), 0, 100),
    food: clamp(asNumber(rawTown.food, townDef.food), 0, 100),
    renown: clamp(asNumber(rawTown.renown, townDef.renown), 0, 100),
    policy: rawPolicy === 'low' || rawPolicy === 'normal' || rawPolicy === 'high' ? rawPolicy : 'normal',
    guard: asNonNegInt(rawTown.guard, townDef.guard),
    famine: asNonNegInt(rawTown.famine, townDef.famine),
    riot: asNonNegInt(rawTown.riot, townDef.riot),
    lastTax: asNonNegInt(rawTown.lastTax, townDef.lastTax),
  };

  const estateDef = createInitialEstateState();
  const rawEstate = isRecord(raw.estate) ? raw.estate : {};
  const rawLandmarks = isRecord(rawEstate.landmarks) ? rawEstate.landmarks : {};
  const estate: EstateState = {
    facilities: migrateNumberRecord(rawEstate.facilities),
    landmarks: {
      ...(typeof rawLandmarks.hq === 'boolean' ? { hq: rawLandmarks.hq } : {}),
      ...(typeof rawLandmarks.lab === 'boolean' ? { lab: rawLandmarks.lab } : {}),
      ...(typeof rawLandmarks.cmd === 'boolean' ? { cmd: rawLandmarks.cmd } : {}),
    },
    vaultMp: asNonNegInt(rawEstate.vaultMp, estateDef.vaultMp),
    activeLocation: typeof rawEstate.activeLocation === 'string' ? rawEstate.activeLocation : null,
    activeCrisis: typeof rawEstate.activeCrisis === 'string' ? rawEstate.activeCrisis : null,
    crisisCooldowns: migrateNumberRecord(rawEstate.crisisCooldowns),
    lastCrises: asStringArray(rawEstate.lastCrises),
    perks: isRecord(rawEstate.perks) ? (rawEstate.perks as EstateState['perks']) : {},
    casualGraceUsed: asBoolean(rawEstate.casualGraceUsed, false),
    nobreachStreak: asNonNegInt(rawEstate.nobreachStreak, 0),
    upkeepArrears: asNonNegInt(rawEstate.upkeepArrears, 0),
    trailingIncome: Array.isArray(rawEstate.trailingIncome)
      ? rawEstate.trailingIncome.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      : [],
    exploreCountToday: asNonNegInt(rawEstate.exploreCountToday, 0),
  };

  const debtDef = createInitialDebtState(currentWave);
  const rawDebt = isRecord(raw.debt) ? raw.debt : {};
  const debt: DebtState = {
    amount: asNonNegInt(rawDebt.amount, debtDef.amount),
    extraLoan: asNonNegInt(rawDebt.extraLoan, debtDef.extraLoan),
    startWave: asNonNegInt(rawDebt.startWave, debtDef.startWave),
    dueWave: asNonNegInt(rawDebt.dueWave, debtDef.dueWave),
    cycleCount: asNonNegInt(rawDebt.cycleCount, debtDef.cycleCount),
    step: asNonNegInt(rawDebt.step, debtDef.step),
    lates: asNonNegInt(rawDebt.lates, debtDef.lates),
    patience: clamp(asNumber(rawDebt.patience, debtDef.patience), 0, 100),
    reliefUsed: asNonNegInt(rawDebt.reliefUsed, debtDef.reliefUsed),
    extCarry: asNonNegInt(rawDebt.extCarry, debtDef.extCarry),
    minCut: clamp(asNumber(rawDebt.minCut, debtDef.minCut), 0, 0.25),
    noInterest: asBoolean(rawDebt.noInterest, debtDef.noInterest),
    forgiveUsed: asBoolean(rawDebt.forgiveUsed, debtDef.forgiveUsed),
    paidThisVisit: asNonNegInt(rawDebt.paidThisVisit, debtDef.paidThisVisit),
    entertainedThisVisit: asBoolean(rawDebt.entertainedThisVisit, debtDef.entertainedThisVisit),
    activeQuest: isRecord(rawDebt.activeQuest)
      ? (rawDebt.activeQuest as unknown as DebtState['activeQuest'])
      : null,
    offeredQuests: Array.isArray(rawDebt.offeredQuests)
      ? (rawDebt.offeredQuests.filter(isRecord) as unknown as DebtState['offeredQuests'])
      : [],
    ended: typeof rawDebt.ended === 'string' ? (rawDebt.ended as DebtState['ended']) : null,
  };

  const rawOfficers = isRecord(raw.officers) ? raw.officers : {};
  const rawWaveGain = isRecord(rawOfficers.waveAffGain) ? rawOfficers.waveAffGain : {};
  const officers: OfficersState = {
    vesper: migrateOfficerProgress(rawOfficers.vesper, 0),
    lilim: migrateOfficerProgress(rawOfficers.lilim, 0),
    eleonora: migrateOfficerProgress(rawOfficers.eleonora, 10),
    waveAffGain: {
      vesper: asNonNegInt(rawWaveGain.vesper, 0),
      lilim: asNonNegInt(rawWaveGain.lilim, 0),
      eleonora: asNonNegInt(rawWaveGain.eleonora, 0),
    },
  };

  const monsters: MonsterInstance[] = Array.isArray(raw.monsters)
    ? raw.monsters
        .filter((m): m is Record<string, unknown> => isRecord(m) && typeof m.lineage === 'string')
        .map((m) => ({
          id: asString(m.id, uid('mob')),
          lineage: m.lineage as string,
          stars: m.stars === 2 || m.stars === 3 ? m.stars : 1,
          xp: asNonNegInt(m.xp, 0),
          kills: asNonNegInt(m.kills, 0),
          fed: asNonNegInt(m.fed, 0),
          deployedFloor: typeof m.deployedFloor === 'number' ? m.deployedFloor : null,
          injuredUntilWave: typeof m.injuredUntilWave === 'number' ? m.injuredUntilWave : null,
          tiredUntilWave: typeof m.tiredUntilWave === 'number' ? m.tiredUntilWave : null,
          variantOf: typeof m.variantOf === 'string' ? m.variantOf : null,
        }))
    : [];

  const eggs: MonsterEgg[] = Array.isArray(raw.eggs)
    ? raw.eggs
        .filter((e): e is Record<string, unknown> => isRecord(e) && typeof e.lineage === 'string')
        .map((e) => ({
          id: asString(e.id, uid('egg')),
          lineage: e.lineage as string,
          hatchWave: asNonNegInt(e.hatchWave, currentWave + 1),
          xp: asNonNegInt(e.xp, 0),
          ...(typeof e.trait === 'string' ? { trait: e.trait } : {}),
          variantOf: typeof e.variantOf === 'string' ? e.variantOf : null,
        }))
    : [];

  const expDef = createInitialExpeditionState();
  const rawExp = isRecord(raw.expedition) ? raw.expedition : {};
  const expedition: ExpeditionState = {
    ...expDef,
    active: asBoolean(rawExp.active, expDef.active),
    lengthKey:
      typeof rawExp.lengthKey === 'string'
        ? (rawExp.lengthKey as ExpeditionLengthKey)
        : expDef.lengthKey,
    day: asNonNegInt(rawExp.day, expDef.day),
    maxDays: asNonNegInt(rawExp.maxDays, expDef.maxDays),
    ap: asNonNegInt(rawExp.ap, expDef.ap),
    depth: asNonNegInt(rawExp.depth, expDef.depth),
    maxDepth: asNonNegInt(rawExp.maxDepth, expDef.maxDepth),
    region: asString(rawExp.region, expDef.region),
    crew: Array.isArray(rawExp.crew) ? (rawExp.crew as ExpeditionState['crew']) : [],
    lootMp: asNonNegInt(rawExp.lootMp, 0),
    lootFood: asNonNegInt(rawExp.lootFood, 0),
    lootPop: asNonNegInt(rawExp.lootPop, 0),
    lootParts: asNonNegInt(rawExp.lootParts, 0),
    lootEggs: asNonNegInt(rawExp.lootEggs, 0),
    lootShards: asNonNegInt(rawExp.lootShards, 0),
    lootIntel: asNonNegInt(rawExp.lootIntel, 0),
    gear: asNonNegInt(rawExp.gear, 0),
    drill: asNonNegInt(rawExp.drill, 0),
    notoriety: asNonNegInt(rawExp.notoriety, 0),
    choices: Array.isArray(rawExp.choices) ? (rawExp.choices as ExpeditionState['choices']) : [],
    activeEncounter: isRecord(rawExp.activeEncounter)
      ? (rawExp.activeEncounter as ExpeditionState['activeEncounter'])
      : null,
    activeEvent: typeof rawExp.activeEvent === 'string' ? rawExp.activeEvent : null,
    arrivedVisited: asBoolean(rawExp.arrivedVisited, false),
    clearedLengths: asStringArray(rawExp.clearedLengths) as ExpeditionLengthKey[],
    afterEffects: Array.isArray(rawExp.afterEffects)
      ? (rawExp.afterEffects as ExpeditionState['afterEffects'])
      : [],
    log: asStringArray(rawExp.log),
  };

  const rawRealm = isRecord(raw.realm) ? raw.realm : {};
  const rawGprep = isRecord(rawRealm.gprep) ? rawRealm.gprep : {};
  const realm: RealmState = {
    active: Array.isArray(rawRealm.active) ? (rawRealm.active as RealmState['active']) : [],
    cooldowns: migrateNumberRecord(rawRealm.cooldowns),
    gprep: {
      lv: clamp(asNonNegInt(rawGprep.lv, 0), 0, 5),
      topTags: asStringArray(rawGprep.topTags),
      sameSigStreak: asNonNegInt(rawGprep.sameSigStreak, 0),
      lastSig: asString(rawGprep.lastSig, ''),
      ...(typeof rawGprep.reason === 'string' ? { reason: rawGprep.reason } : {}),
    },
    ...(isRecord(rawRealm.floorSigs)
      ? { floorSigs: rawRealm.floorSigs as RealmState['floorSigs'] }
      : {}),
  };

  const crisesDef = createInitialCrisesState();
  const rawCrises = isRecord(raw.crises) ? raw.crises : {};
  const rawCrusade = isRecord(rawCrises.crusade) ? rawCrises.crusade : {};
  const rawSiege = isRecord(rawCrises.siege) ? rawCrises.siege : {};
  const crises: CrisesState = {
    wrath: clamp(asNonNegInt(rawCrises.wrath, 0), 0, 100),
    cleanKillStreak: asNonNegInt(rawCrises.cleanKillStreak, 0),
    crusade: {
      active: asBoolean(rawCrusade.active, false),
      wavesLeft: asNonNegInt(rawCrusade.wavesLeft, 0),
      cooldown: asNonNegInt(rawCrusade.cooldown, 0),
    },
    nemesis: Array.isArray(rawCrises.nemesis)
      ? (rawCrises.nemesis as CrisesState['nemesis'])
      : [],
    siege: {
      active: asBoolean(rawSiege.active, false),
      day: asNonNegInt(rawSiege.day, 0),
      wins: asNonNegInt(rawSiege.wins, 0),
      losses: asNonNegInt(rawSiege.losses, 0),
      cooldown: asNonNegInt(rawSiege.cooldown, 0),
      ...(typeof rawSiege.lastLog === 'string' ? { lastLog: rawSiege.lastLog } : {}),
    },
    jailbreakPending: asBoolean(rawCrises.jailbreakPending, crisesDef.jailbreakPending),
    activeRaidMods: Array.isArray(rawCrises.activeRaidMods)
      ? (rawCrises.activeRaidMods as CrisesState['activeRaidMods'])
      : [],
    pendingGameOver:
      typeof rawCrises.pendingGameOver === 'string'
        ? (rawCrises.pendingGameOver as CrisesState['pendingGameOver'])
        : null,
    ...(typeof rawCrises.lastNemesisWave === 'number'
      ? { lastNemesisWave: rawCrises.lastNemesisWave }
      : {}),
    ...(typeof rawCrises.lastNoBreachStreak === 'number'
      ? { lastNoBreachStreak: rawCrises.lastNoBreachStreak }
      : {}),
    ...(isRecord(rawCrises.lastCrisisCard)
      ? {
          lastCrisisCard:
            rawCrises.lastCrisisCard as unknown as CrisesState['lastCrisisCard'],
        }
      : {}),
  };

  const warDef = createInitialWarState();
  const rawWar = isRecord(raw.war) && isRecord(raw.war.rivals) ? raw.war.rivals : {};
  const mergeRival = (key: 'paladin' | 'merchant' | 'witch') => {
    const r = isRecord(rawWar[key]) ? rawWar[key] : {};
    const d = warDef.rivals[key];
    return {
      scouted: asBoolean(r.scouted, d.scouted),
      wins: asNonNegInt(r.wins, d.wins),
      annexed: asBoolean(r.annexed, d.annexed),
      def: asNonNegInt(r.def, d.def),
    };
  };
  const war: WarState = {
    rivals: {
      paladin: mergeRival('paladin'),
      merchant: mergeRival('merchant'),
      witch: mergeRival('witch'),
    },
  };

  const rawWonders = isRecord(raw.wonders) ? raw.wonders : {};
  const wonders: WondersState = {
    spire: asBoolean(rawWonders.spire, false),
    temple: asBoolean(rawWonders.temple, false),
    gold: asBoolean(rawWonders.gold, false),
  };

  const rawRelics = isRecord(raw.relics) ? raw.relics : {};
  const relics: RelicsState = {
    owned: asStringArray(rawRelics.owned) as RelicsState['owned'],
    shards: asNonNegInt(rawRelics.shards, 0),
  };

  const rawEndings = isRecord(raw.endings) ? raw.endings : {};
  const endings: EndingsState = {
    unlocked: isRecord(rawEndings.unlocked)
      ? (migrateNumberRecord(rawEndings.unlocked) as EndingsState['unlocked'])
      : {},
    endless: asBoolean(rawEndings.endless, false),
    activeEnding:
      typeof rawEndings.activeEnding === 'string'
        ? (rawEndings.activeEnding as EndingsState['activeEnding'])
        : null,
    gameOver:
      typeof rawEndings.gameOver === 'string'
        ? (rawEndings.gameOver as EndingsState['gameOver'])
        : null,
    titles: asStringArray(rawEndings.titles),
  };

  const rankDef = createInitialRankTrialsState(currentWave);
  const rawRank = isRecord(raw.rankTrials) ? raw.rankTrials : {};
  const rankTrials: RankTrialsState = {
    active: asBoolean(rawRank.active, rankDef.active),
    rank: asNonNegInt(rawRank.rank, rankDef.rank),
    currentTrial:
      typeof rawRank.currentTrial === 'string'
        ? (rawRank.currentTrial as RankTrialsState['currentTrial'])
        : null,
    progress: asNonNegInt(rawRank.progress, rankDef.progress),
    target: asNonNegInt(rawRank.target, rankDef.target),
    nextCheckWave: asNonNegInt(rawRank.nextCheckWave, rankDef.nextCheckWave),
    trialStartWave:
      typeof rawRank.trialStartWave === 'number' ? rawRank.trialStartWave : undefined,
    baselineAnnexed:
      typeof rawRank.baselineAnnexed === 'number' ? rawRank.baselineAnnexed : undefined,
    consecutiveWipes:
      typeof rawRank.consecutiveWipes === 'number' ? rawRank.consecutiveWipes : undefined,
    trialCursor: typeof rawRank.trialCursor === 'number' ? rawRank.trialCursor : undefined,
  };

  const chronicle: ChronicleEntry[] =
    Array.isArray(raw.chronicle) && raw.chronicle.length > 0
      ? (raw.chronicle as ChronicleEntry[])
      : defaults.chronicle;

  const migrated: GameState = {
    schemaVersion: 2,
    version: CFG.VERSION,
    mode,
    points: asNonNegInt(raw.points, defaults.points),
    wave: currentWave,
    day: asNonNegInt(raw.day, currentWave),
    ap,
    apMax,
    dayClosed: asBoolean(raw.dayClosed, false),
    entApPenalty: asNonNegInt(raw.entApPenalty, 0),
    apUsed: migrateBooleanRecord(raw.apUsed),
    dayLines: rawDayLines,
    apGrowth: {
      wipes: asNonNegInt(rawApGrowth.wipes, 0),
      conv: asNonNegInt(rawApGrowth.conv, 0),
      quests: asNonNegInt(rawApGrowth.quests, 0),
    },
    floorCursor: clamp(asNonNegInt(raw.floorCursor, 0), 0, CFG.FLOORS),
    selectedFloor: clamp(asNonNegInt(raw.selectedFloor, 1), 1, CFG.FLOORS),
    kills: asNonNegInt(raw.kills, 0),
    famePoints: clamp(asNonNegInt(raw.famePoints, 0), 0, CFG.FAME.POINT_MAX),
    fame: clamp(asNonNegInt(raw.fame, 0), 0, CFG.FAME.MAX),
    momentum: clamp(asNumber(raw.momentum, 0), -CFG.MOMENTUM.MAX, CFG.MOMENTUM.MAX),
    fear: clamp(asNonNegInt(raw.fear, 0), 0, 100),
    lust: clamp(asNonNegInt(raw.lust, 0), 0, 100),
    guildPoints: clamp(asNonNegInt(raw.guildPoints, 0), 0, 100),
    guildActive: asBoolean(raw.guildActive, false),
    floors: migrateFloors(raw.floors),
    party: Array.isArray(raw.party) ? (raw.party as GameState['party']) : [],
    prisoners,
    nextPid,
    evalScores: isRecord(raw.evalScores) ? (raw.evalScores as unknown as GameState['evalScores']) : null,
    prepMeta: isRecord(raw.prepMeta) ? (raw.prepMeta as unknown as GameState['prepMeta']) : null,
    awaitingNarration: asBoolean(raw.awaitingNarration, false),
    raidFirstRoom: asBoolean(raw.raidFirstRoom, true),
    lastRaidDetail: asString(raw.lastRaidDetail, ''),
    lastOutcome:
      typeof raw.lastOutcome === 'string' ? (raw.lastOutcome as GameState['lastOutcome']) : null,
    lastAudit: Array.isArray(raw.lastAudit) ? (raw.lastAudit as GameState['lastAudit']) : [],
    lastSettlement: isRecord(raw.lastSettlement)
      ? (raw.lastSettlement as unknown as GameState['lastSettlement'])
      : null,
    flash: asString(raw.flash, defaults.flash),
    chronicle,
    recentHeroSignatures: Array.isArray(raw.recentHeroSignatures)
      ? (raw.recentHeroSignatures as GameState['recentHeroSignatures'])
      : [],
    settings: migrateSettings(raw.settings),
    town,
    estate,
    debt,
    officers,
    monsters,
    eggs,
    expedition,
    realm,
    crises,
    war,
    wonders,
    relics,
    endings,
    rankTrials,
    waveStartSnapshot: null,
  };

  if (skipSnapshot) {
    return migrated;
  }

  if (isRecord(raw.waveStartSnapshot) && Array.isArray(raw.waveStartSnapshot.floors)) {
    const snapState = migrateGameStateInternal(raw.waveStartSnapshot, true);
    migrated.waveStartSnapshot = captureWaveStartSnapshot(snapState);
  } else if (migrated.mode === 'build') {
    migrated.waveStartSnapshot = captureWaveStartSnapshot(migrated);
  }

  return migrated;
}

/**
 * Pure migration from Phase 1 (`schemaVersion: 1` or missing) or partial v2
 * save payloads into a complete, valid `schemaVersion: 2` `GameState`.
 */
export function migrateGameState(raw: unknown): GameState {
  return migrateGameStateInternal(raw, false);
}

/**
 * Pure migration for TrapBlueprint arrays, preserving Phase 1 entries while
 * normalizing Room Shortcut & Codex extension fields.
 */
export function migrateBlueprints(raw: unknown): TrapBlueprint[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: TrapBlueprint[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    const kind: 'trap' | 'room' = item.kind === 'room' ? 'room' : 'trap';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const detail = typeof item.detail === 'string' ? item.detail.trim() : '';
    if (!name) continue;
    if (kind === 'trap' && !detail) continue;

    const category: 'ero' | 'standard' = item.category === 'ero' ? 'ero' : 'standard';
    const grade = normalizeSlotGrade(item.grade);
    const types = asStringArray(item.types);

    let roomSlots: RoomBlueprintSlot[] | undefined;
    if (kind === 'room' && Array.isArray(item.roomSlots)) {
      roomSlots = item.roomSlots
        .filter((rs): rs is Record<string, unknown> => isRecord(rs) && typeof rs.name === 'string')
        .slice(0, CFG.SLOTS)
        .map((rs) => ({
          name: (rs.name as string).trim() || 'Room Trap',
          detail: asString(rs.detail, (rs.name as string).trim()),
          category: rs.category === 'ero' ? 'ero' : 'standard',
          grade: normalizeSlotGrade(rs.grade),
          types: asStringArray(rs.types),
        }));
    }

    const roomSynergy: SynergyGrade | undefined =
      kind === 'room'
        ? normalizeSynergyGrade(item.roomSynergy, roomSlots?.length ?? 2)
        : undefined;

    out.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id : uid('bp'),
      name,
      detail: detail || (roomSlots?.map((s) => s.name).join(' + ') ?? name),
      category,
      grade,
      types,
      ...(typeof item.notes === 'string' && item.notes.trim() ? { notes: item.notes } : {}),
      pinned: asBoolean(item.pinned, false),
      createdAt: asNonNegInt(item.createdAt, now),
      updatedAt: asNonNegInt(item.updatedAt, now),
      kind,
      ...(roomSlots ? { roomSlots } : {}),
      ...(roomSynergy !== undefined ? { roomSynergy } : {}),
      ...(typeof item.codexId === 'string' && item.codexId.trim()
        ? { codexId: item.codexId }
        : {}),
    });
  }

  return out;
}

export function loadSavedState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_GAME_KEY);
    if (!raw) return createInitialGameState();
    const parsed = JSON.parse(raw) as unknown;
    return migrateGameState(parsed);
  } catch {
    return createInitialGameState();
  }
}

export function persistGameState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadBlueprints(): TrapBlueprint[] {
  try {
    const raw = localStorage.getItem(STORAGE_BLUEPRINTS_KEY);
    if (!raw) return migrateBlueprints(STARTER_BLUEPRINTS);
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateBlueprints(parsed);
    return migrated.length > 0 ? migrated : migrateBlueprints(STARTER_BLUEPRINTS);
  } catch {
    return migrateBlueprints(STARTER_BLUEPRINTS);
  }
}

export function persistBlueprints(blueprints: TrapBlueprint[]): void {
  try {
    localStorage.setItem(STORAGE_BLUEPRINTS_KEY, JSON.stringify(blueprints));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_LLM_KEY);
    if (!raw) return createDefaultLlmConfig();
    return { ...createDefaultLlmConfig(), ...(JSON.parse(raw) as Partial<LlmConfig>) };
  } catch {
    return createDefaultLlmConfig();
  }
}

export function persistLlmConfig(cfg: LlmConfig): void {
  try {
    localStorage.setItem(STORAGE_LLM_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota errors
  }
}

function createEmptySlotsMap(): Record<SaveSlotId, SaveSlotRecord | null> {
  return { 1: null, 2: null, 3: null, 4: null, 5: null };
}

function persistSlotsMap(slots: Record<SaveSlotId, SaveSlotRecord | null>): void {
  try {
    localStorage.setItem(STORAGE_SLOTS_KEY, JSON.stringify(slots));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSaveSlots(): Record<SaveSlotId, SaveSlotRecord | null> {
  const result = createEmptySlotsMap();
  try {
    const raw = localStorage.getItem(STORAGE_SLOTS_KEY);
    if (!raw) return result;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return result;

    for (const id of SAVE_SLOT_IDS) {
      const entry = parsed[String(id)];
      if (!isRecord(entry) || !isRecord(entry.meta) || !isRecord(entry.state)) continue;
      const migratedState = migrateGameState(entry.state);
      const rawMeta = entry.meta;
      const meta: SaveSlotMetadata = {
        slotId: id,
        slotName: asString(rawMeta.slotName, `Slot ${id}`).trim() || `Slot ${id}`,
        wave: asNonNegInt(rawMeta.wave, migratedState.wave),
        day: asNonNegInt(rawMeta.day, migratedState.day),
        points: asNonNegInt(rawMeta.points, migratedState.points),
        debt: asNonNegInt(
          rawMeta.debt,
          migratedState.debt.amount + migratedState.debt.extraLoan
        ),
        mode: VALID_MODES.has(rawMeta.mode as GameMode)
          ? (rawMeta.mode as GameMode)
          : migratedState.mode,
        savedAt: asNonNegInt(rawMeta.savedAt, Date.now()),
      };
      result[id] = { meta, state: migratedState };
    }
    return result;
  } catch {
    return createEmptySlotsMap();
  }
}

export function saveToSlot(
  slotId: SaveSlotId,
  state: GameState,
  customName?: string
): SaveSlotRecord {
  const slots = loadSaveSlots();
  const existingName = slots[slotId]?.meta.slotName;
  const resolvedName = (customName ?? existingName ?? `Slot ${slotId}`).trim().slice(0, 40) || `Slot ${slotId}`;
  const cleanState = migrateGameState(JSON.parse(JSON.stringify(state)));

  const meta: SaveSlotMetadata = {
    slotId,
    slotName: resolvedName,
    wave: cleanState.wave,
    day: cleanState.day,
    points: cleanState.points,
    debt: cleanState.debt.amount + cleanState.debt.extraLoan,
    mode: cleanState.mode,
    savedAt: Date.now(),
  };

  const record: SaveSlotRecord = { meta, state: cleanState };
  slots[slotId] = record;
  persistSlotsMap(slots);
  return record;
}

export function loadFromSlot(slotId: SaveSlotId): GameState | null {
  const slots = loadSaveSlots();
  const rec = slots[slotId];
  if (!rec) return null;
  return migrateGameState(JSON.parse(JSON.stringify(rec.state)));
}

export function renameSaveSlot(slotId: SaveSlotId, newName: string): SaveSlotRecord | null {
  const slots = loadSaveSlots();
  const existing = slots[slotId];
  if (!existing) return null;
  const cleanName = newName.trim().slice(0, 40) || `Slot ${slotId}`;
  const updated: SaveSlotRecord = {
    ...existing,
    meta: {
      ...existing.meta,
      slotName: cleanName,
    },
  };
  slots[slotId] = updated;
  persistSlotsMap(slots);
  return updated;
}

export function deleteSaveSlot(slotId: SaveSlotId): void {
  const slots = loadSaveSlots();
  slots[slotId] = null;
  persistSlotsMap(slots);
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
