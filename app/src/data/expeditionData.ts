import { resolveSceneAsset } from './assetManifest';
import type { ExpeditionLengthKey, HeroGrade, RelicKey } from '../types/game';

export const EXPED_CFG = {
  UNLOCK_W: 3,
  RESIST_MAX: 40,
  STAMINA_MIN: 50,
  CREW_MAX: 3,
  CREW_MAX_HQ: 4,
  AP_PER_DAY: 3,
  FLEE_BASE: 0.0012,
  FLEE_LOYAL_MULT: 0.3,
  FLEE_OBEY_REDUCE: 0.01,
  FLEE_DEST_ADD: 0.03,
  FLEE_HQ_REDUCE: 0.02,
  FLEE_HQ_LONG_REDUCE: 0.01,
  SAFE_TITLES: ['broken', 'tamed', 'pleasure-trained'] as readonly string[],
  STOP_STAMINA: 35,
  ADVISE_STAMINA: 30,
  AMBUSH_DANGER: 0.3,
  GEAR_MAX: 2,
  NOTOR_RETAL: 3,
  DMG: {
    atkOk: 5,
    atkBad: 14,
    defOk: 3,
    defBad: 8,
    move: 5,
    ambush: 12,
    trap: 8,
    night: 8,
    arrBad: 16,
    home: 8,
  },
  AILMENT_CHANCE: 0.25,
  CAMP_BASE: 10,
  CAMP_MIN: 15,
  CAMP_HQ: 10,
  REST_PER_AP: 5,
  LOOT_BASE: 0.9,
  DEPTH_LOOT: 0.35,
  DEPTH_DIFF: 1.5,
  ENC_CHANCE: 0.7,
  EV_CHANCE_MV: 0.35,
  EV_CHANCE_SCOUT: 0.25,
  EV_CHANCE_MORNING: 0.3,
  EV_CHANCE_DEEP: 0.35,
  DEEP_DEPTH: 8,
  SHARD_CHANCE: 0.3,
  SHARDS_PER_RELIC: 3,
  ABYSS_LOST_CHANCE: 0.03,
  FATIGUE_START_DAY: 4,
  HIGH_HAUL_MP: 150,
} as const;

export interface ExpeditionLengthDef {
  index: 1 | 2 | 3 | 4 | 5;
  key: ExpeditionLengthKey;
  icon: string;
  label: string;
  days: number;
  costMp: number;
  maxDepth: number;
  minWave: number;
  minTownLv: number;
  minCrew: number;
  reqCleared: ExpeditionLengthKey | null;
  fatiguePerDay: number;
  lostChance: number;
  tip: string;
}

export const EXPEDITION_LENGTHS: readonly ExpeditionLengthDef[] = [
  {
    index: 1,
    key: 'short',
    icon: '🥾',
    label: 'Short Recon',
    days: 2,
    costMp: 15,
    maxDepth: 3,
    minWave: 3,
    minTownLv: 1,
    minCrew: 1,
    reqCleared: null,
    fatiguePerDay: 0,
    lostChance: 0,
    tip: 'Safe · Food, Pop & Parts · Starter run',
  },
  {
    index: 2,
    key: 'mid',
    icon: '🐎',
    label: 'Mid Expedition',
    days: 3,
    costMp: 30,
    maxDepth: 5,
    minWave: 3,
    minTownLv: 1,
    minCrew: 1,
    reqCleared: null,
    fatiguePerDay: 0,
    lostChance: 0,
    tip: 'Moderate · Border Village arrival (Trade / Raid / Lure)',
  },
  {
    index: 3,
    key: 'long',
    icon: '⚔',
    label: 'Long Campaign',
    days: 5,
    costMp: 50,
    maxDepth: 7,
    minWave: 3,
    minTownLv: 3,
    minCrew: 2,
    reqCleared: null,
    fatiguePerDay: 0,
    lostChance: 0,
    tip: 'Hazardous · Adds Border Fortress · Border Village → Royal Capital',
  },
  {
    index: 4,
    key: 'grand',
    icon: '🏰',
    label: 'Grand Crusade',
    days: 7,
    costMp: 80,
    maxDepth: 9,
    minWave: 12,
    minTownLv: 3,
    minCrew: 3,
    reqCleared: 'long',
    fatiguePerDay: 5,
    lostChance: 0,
    tip: 'Very High Risk · Day 4+ Fatigue (-5/day) · Relic Shards & Deep Events (8+)',
  },
  {
    index: 5,
    key: 'abyss',
    icon: '🌑',
    label: 'Abyssal March',
    days: 10,
    costMp: 120,
    maxDepth: 12,
    minWave: 20,
    minTownLv: 3,
    minCrew: 3,
    reqCleared: 'grand',
    fatiguePerDay: 8,
    lostChance: 0.03,
    tip: 'Extreme · Day 4+ Fatigue (-8/day) · 3%/day Party Vanish · Deep Events & Shards',
  },
] as const;

export const EXPEDITION_LENGTH_MAP: Record<ExpeditionLengthKey, ExpeditionLengthDef> =
  Object.fromEntries(EXPEDITION_LENGTHS.map((l) => [l.key, l])) as Record<
    ExpeditionLengthKey,
    ExpeditionLengthDef
  >;

export type ExpeditionAilmentKey =
  | 'burn'
  | 'fall'
  | 'cramp'
  | 'gear'
  | 'drug'
  | 'exposed';

export interface ExpeditionAilmentDef {
  key: ExpeditionAilmentKey;
  icon: string;
  label: string;
  desc: string;
}

export const EXPEDITION_AILMENTS: readonly ExpeditionAilmentDef[] = [
  { key: 'burn', icon: '🔥', label: 'Burned', desc: 'burned' },
  { key: 'fall', icon: '🦴', label: 'Bruised', desc: 'bruised' },
  { key: 'cramp', icon: '⚡', label: 'Cramping', desc: 'cramping' },
  { key: 'gear', icon: '🪓', label: 'Gear Broken', desc: 'gear broken' },
  { key: 'drug', icon: '💊', label: 'Drugged', desc: 'drugged' },
  { key: 'exposed', icon: '🫣', label: 'Exposed', desc: 'exposed' },
] as const;

export const EXPEDITION_AILMENT_MAP: Record<ExpeditionAilmentKey, ExpeditionAilmentDef> =
  Object.fromEntries(EXPEDITION_AILMENTS.map((a) => [a.key, a])) as Record<
    ExpeditionAilmentKey,
    ExpeditionAilmentDef
  >;

export type ExpeditionLootKind =
  | 'mp'
  | 'food'
  | 'pop'
  | 'parts'
  | 'eggs'
  | 'intel'
  | 'renown'
  | 'approval'
  | 'gear'
  | 'fear'
  | 'shard'
  | 'herb';

export interface ScoutLootEntry {
  kind: ExpeditionLootKind;
  amount: number;
  chance?: number;
}

export interface ExpeditionRegionDef {
  key: string;
  icon: string;
  label: string;
  prose: string;
  ambush: number;
  encWeights: Record<string, number>;
  scoutLoot: ScoutLootEntry[];
  ailment: ExpeditionAilmentKey | null;
  moveExtraDmg?: number;
  artKey: string;
  pool: 'standard' | 'long' | 'fixed';
}

export const EXPEDITION_REGIONS: readonly ExpeditionRegionDef[] = [
  {
    key: 'forest',
    icon: '🌲',
    label: 'Deep Forest',
    prose: 'the deep forest',
    ambush: 0.12,
    encWeights: { patrol: 3, refugee: 2, nest: 3, caravan: 1, witch: 1 },
    scoutLoot: [
      { kind: 'food', amount: 8 },
      { kind: 'eggs', amount: 1, chance: 0.25 },
    ],
    ailment: 'fall',
    artKey: 'dk_exr_forest',
    pool: 'standard',
  },
  {
    key: 'ruin',
    icon: '🏚',
    label: 'Crumbling Ruins',
    prose: 'the crumbling ruins',
    ambush: 0.18,
    encWeights: { ruin: 4, patrol: 2, nest: 1, party: 1 },
    scoutLoot: [
      { kind: 'parts', amount: 1, chance: 0.35 },
      { kind: 'mp', amount: 10 },
    ],
    ailment: 'fall',
    artKey: 'dk_exr_ruin',
    pool: 'standard',
  },
  {
    key: 'swamp',
    icon: '🌫',
    label: 'Misty Swamp',
    prose: 'the misty swamp',
    ambush: 0.18,
    encWeights: { nest: 3, refugee: 2, patrol: 1, witch: 2 },
    scoutLoot: [{ kind: 'herb', amount: 10 }],
    ailment: 'drug',
    moveExtraDmg: 3,
    artKey: 'dk_exr_swamp',
    pool: 'standard',
  },
  {
    key: 'canyon',
    icon: '⛰',
    label: 'Red Canyon',
    prose: 'the narrow canyon',
    ambush: 0.3,
    encWeights: { party: 2, patrol: 2, scout: 1, bounty: 1 },
    scoutLoot: [
      { kind: 'gear', amount: 1, chance: 0.2 },
      { kind: 'mp', amount: 15 },
    ],
    ailment: 'fall',
    artKey: 'dk_exr_canyon',
    pool: 'standard',
  },
  {
    key: 'mine',
    icon: '⛏',
    label: 'Mining Village',
    prose: 'a hillside mining village',
    ambush: 0.18,
    encWeights: { militia: 3, caravan: 2, party: 1 },
    scoutLoot: [
      { kind: 'mp', amount: 20 },
      { kind: 'parts', amount: 1, chance: 0.25 },
    ],
    ailment: 'cramp',
    artKey: 'dk_exr_mine',
    pool: 'standard',
  },
  {
    key: 'abbey',
    icon: '⛪',
    label: 'Mountain Abbey',
    prose: 'a remote mountain abbey',
    ambush: 0.15,
    encWeights: { scout: 3, refugee: 2, patrol: 1 },
    scoutLoot: [
      { kind: 'intel', amount: 1, chance: 0.4 },
      { kind: 'renown', amount: 1 },
    ],
    ailment: 'exposed',
    artKey: 'dk_exr_abbey',
    pool: 'standard',
  },
  {
    key: 'road',
    icon: '🛤',
    label: 'Trade Road',
    prose: 'a busy trade road',
    ambush: 0.1,
    encWeights: { caravan: 4, party: 2, patrol: 2, refugee: 1, bounty: 1 },
    scoutLoot: [
      { kind: 'mp', amount: 15 },
      { kind: 'food', amount: 5 },
    ],
    ailment: 'exposed',
    artKey: 'dk_exr_road',
    pool: 'standard',
  },
  {
    key: 'hotspring',
    icon: '♨',
    label: 'Hot-Spring Valley',
    prose: 'a steaming hot-spring valley',
    ambush: 0.1,
    encWeights: { refugee: 2, caravan: 1, patrol: 1, witch: 1 },
    scoutLoot: [
      { kind: 'herb', amount: 15 },
      { kind: 'food', amount: 4 },
    ],
    ailment: 'exposed',
    artKey: 'dk_exr_hotspring',
    pool: 'standard',
  },
  {
    key: 'market',
    icon: '🕯',
    label: 'Black Market',
    prose: 'a hidden black market in the hills',
    ambush: 0.15,
    encWeights: { caravan: 3, bounty: 2, patrol: 1 },
    scoutLoot: [
      { kind: 'mp', amount: 25 },
      { kind: 'gear', amount: 1, chance: 0.2 },
    ],
    ailment: 'drug',
    artKey: 'dk_exr_market',
    pool: 'standard',
  },
  {
    key: 'fort',
    icon: '🏰',
    label: 'Border Fortress',
    prose: 'a border fortress',
    ambush: 0.3,
    encWeights: { scout: 3, patrol: 3, party: 2, bounty: 1 },
    scoutLoot: [
      { kind: 'gear', amount: 1, chance: 0.35 },
      { kind: 'mp', amount: 20 },
    ],
    ailment: 'gear',
    artKey: 'dk_exr_fort',
    pool: 'long',
  },
  {
    key: 'out',
    icon: '🏯',
    label: 'Dungeon Outskirts',
    prose: "the dungeon's outskirts",
    ambush: 0.08,
    encWeights: { patrol: 3, refugee: 2, caravan: 1 },
    scoutLoot: [{ kind: 'food', amount: 5 }],
    ailment: null,
    artKey: 'dk_exd_depart',
    pool: 'fixed',
  },
  {
    key: 'village',
    icon: '📍',
    label: 'Border Village',
    prose: 'the border village',
    ambush: 0.05,
    encWeights: {},
    scoutLoot: [{ kind: 'food', amount: 5 }],
    ailment: null,
    artKey: 'dk_exd_village',
    pool: 'fixed',
  },
  {
    key: 'city',
    icon: '📍',
    label: 'Royal Capital',
    prose: 'the royal capital',
    ambush: 0.1,
    encWeights: {},
    scoutLoot: [{ kind: 'mp', amount: 20 }],
    ailment: null,
    artKey: 'dk_exd_capital',
    pool: 'fixed',
  },
] as const;

export const EXPEDITION_REGION_MAP: Record<string, ExpeditionRegionDef> = Object.fromEntries(
  EXPEDITION_REGIONS.map((r) => [r.key, r])
);

export const STANDARD_REGION_KEYS = EXPEDITION_REGIONS.filter(
  (r) => r.pool === 'standard'
).map((r) => r.key);

export interface ExpeditionEncounterDef {
  key: string;
  icon: string;
  label: string;
  prose: string;
  diff: number;
  loot: Partial<Record<ExpeditionLootKind, number>>;
}

export const EXPEDITION_ENCOUNTERS: readonly ExpeditionEncounterDef[] = [
  { key: 'patrol', icon: '🛡', label: 'Guild Patrol', prose: 'a Guild patrol', diff: 6, loot: { mp: 40 } },
  { key: 'party', icon: '⚔', label: 'Wandering Hero Party', prose: 'a wandering hero party', diff: 9, loot: { mp: 70, gear: 1 } },
  { key: 'caravan', icon: '🐫', label: 'Merchant Caravan', prose: 'a merchant caravan', diff: 5, loot: { mp: 60, food: 10 } },
  { key: 'ruin', icon: '🏚', label: 'Ruin Guardians', prose: "an old ruin's guardians", diff: 7, loot: { parts: 1, mp: 30 } },
  { key: 'refugee', icon: '🧺', label: 'Refugee Band', prose: 'a band of refugees', diff: 3, loot: { pop: 20, mp: 15 } },
  { key: 'nest', icon: '🥚', label: 'Monster Nest', prose: 'a monster nest', diff: 8, loot: { eggs: 1 } },
  { key: 'militia', icon: '🏹', label: 'Village Militia', prose: 'village militia', diff: 8, loot: { mp: 55, food: 15 } },
  { key: 'scout', icon: '🐎', label: 'Order Knight Scouts', prose: 'Order knight scouts', diff: 10, loot: { intel: 1, mp: 40 } },
  { key: 'witch', icon: '🧙', label: 'Wandering Witch', prose: 'a wandering witch', diff: 8, loot: { intel: 1, mp: 40 } },
  { key: 'bounty', icon: '🎯', label: 'Bounty Hunters', prose: 'a band of bounty hunters', diff: 9, loot: { mp: 80, gear: 1 } },
] as const;

export const EXPEDITION_ENCOUNTER_MAP: Record<string, ExpeditionEncounterDef> =
  Object.fromEntries(EXPEDITION_ENCOUNTERS.map((e) => [e.key, e]));

export interface ExpeditionArrivalChoiceDef {
  id: 'v1' | 'v2' | 'v3' | 'c1' | 'c2' | 'c3';
  dest: 'village' | 'city';
  icon: string;
  label: string;
  prose: string;
  loot: Partial<Record<ExpeditionLootKind, number>>;
  diff: number;
  notoriety: number;
  evKey: string;
}

export const EXPEDITION_ARRIVALS: Record<'village' | 'city', readonly ExpeditionArrivalChoiceDef[]> = {
  village: [
    {
      id: 'v1',
      dest: 'village',
      icon: '🤝',
      label: 'Trade Plunder',
      prose: 'traded plunder at the border village',
      loot: { mp: 100, renown: 2 },
      diff: 0,
      notoriety: 0,
      evKey: 'village',
    },
    {
      id: 'v2',
      dest: 'village',
      icon: '💰',
      label: 'Raid Village',
      prose: 'raided the border village',
      loot: { mp: 170, food: 20 },
      diff: 11,
      notoriety: 2,
      evKey: 'raid',
    },
    {
      id: 'v3',
      dest: 'village',
      icon: '🕵',
      label: 'Lure Settlers',
      prose: "lured villagers to settle in the lord's domain",
      loot: { pop: 25, approval: 2 },
      diff: 0,
      notoriety: 0,
      evKey: 'village',
    },
  ],
  city: [
    {
      id: 'c1',
      dest: 'city',
      icon: '🔥',
      label: 'Sack District',
      prose: 'sacked a district of the royal capital',
      loot: { mp: 320 },
      diff: 15,
      notoriety: 3,
      evKey: 'sack',
    },
    {
      id: 'c2',
      dest: 'city',
      icon: '📜',
      label: 'Steal Guild Intel',
      prose: 'stole Guild plans in the capital',
      loot: { intel: 2, mp: 60 },
      diff: 0,
      notoriety: 0,
      evKey: 'capital',
    },
    {
      id: 'c3',
      dest: 'city',
      icon: '👑',
      label: 'Spread Infamy',
      prose: "spread the Demon Lord's name through the capital",
      loot: { renown: 5, fear: 5, mp: 40 },
      diff: 0,
      notoriety: 0,
      evKey: 'capital',
    },
  ],
};

export interface ExpeditionEventOptionDef {
  label: string;
  hint: string;
}

export interface ExpeditionEventDef {
  key: string;
  icon: string;
  title: string;
  desc: string;
  timing: 'morning' | 'field' | 'deep';
  regions: readonly string[] | null;
  minCrew: number;
  minDepth: number;
  autoChoice: number; // 1-based index
  options: readonly ExpeditionEventOptionDef[];
}

export const EXPEDITION_EVENTS: readonly ExpeditionEventDef[] = [
  // 3 Morning / Camp-only events
  {
    key: 'quarrel',
    icon: '💢',
    title: 'Crew Quarrel',
    desc: '{a} and {b} quarrel over rations.',
    timing: 'morning',
    regions: null,
    minCrew: 2,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '🗡 Harsh Discipline', hint: 'Both Resist -5 · Stamina -3' },
      { label: '👀 Let Them Fight', hint: 'Loser -12 Stamina · Winner Resist -8' },
    ],
  },
  {
    key: 'whisper',
    icon: '🌙',
    title: 'Whispers of Escape',
    desc: '{a} keeps staring off toward the horizon each night.',
    timing: 'morning',
    regions: null,
    minCrew: 1,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '👁 Watch All Night', hint: 'AP -1 · Resist -5' },
      { label: '🤝 Show Trust', hint: 'Resist -10 · Chance to flee immediately' },
    ],
  },
  {
    key: 'campfire',
    icon: '🔥',
    title: 'Campfire Stories',
    desc: "The crew grows talkative around last night's campfire.",
    timing: 'morning',
    regions: null,
    minCrew: 2,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '🍲 Rest Together', hint: 'All Stamina +8 · Resist -3' },
      { label: '⚔ Night Sparring', hint: 'All Stamina -5 · +1 Drill (+8% combat chance)' },
    ],
  },
  // 13 Road / Scout events
  {
    key: 'merchant',
    icon: '🧳',
    title: 'Traveling Peddler',
    desc: 'A heavily laden peddler hails the war-party.',
    timing: 'field',
    regions: null,
    minCrew: 1,
    minDepth: 0,
    autoChoice: 3,
    options: [
      { label: '🌿 Buy Herbs', hint: '-30 MP · All Stamina +20' },
      { label: '🗡 Buy Gear', hint: '-50 MP · Expedition Gear +1' },
      { label: '🚶 Pass By', hint: 'Nothing happens' },
    ],
  },
  {
    key: 'spring',
    icon: '💧',
    title: 'Strange Spring',
    desc: 'A hidden spring glitters with an uncanny sheen.',
    timing: 'field',
    regions: ['forest', 'swamp', 'ruin', 'abbey', 'out', 'hotspring'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 2,
    options: [
      { label: '🥤 Drink', hint: '60% All +20 Stamina · 40% 1 member Drugged' },
      { label: '🚶 Pass By', hint: 'Leave the water alone' },
    ],
  },
  {
    key: 'shrine',
    icon: '🕯',
    title: 'Ruined Shrine',
    desc: 'Candles still flicker inside a crumbling wayside shrine.',
    timing: 'field',
    regions: ['ruin', 'abbey', 'forest', 'canyon'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 3,
    options: [
      { label: '🙏 Pray', hint: '50% Renown +1 & All +10 / 50% Ward -6 Stamina' },
      { label: '💰 Loot Altar', hint: '+40 MP · Notoriety +1 · Desecrate aftermath' },
      { label: '🚶 Pass By', hint: 'Walk past quietly' },
    ],
  },
  {
    key: 'wounded',
    icon: '🩸',
    title: 'Wounded Hero',
    desc: 'An injured adventurer lies collapsed beside the trail.',
    timing: 'field',
    regions: null,
    minCrew: 1,
    minDepth: 0,
    autoChoice: 2,
    options: [
      { label: '⛓ Capture', hint: 'Win (d6): Captive (B/C) · Fail: All -8 Stamina' },
      { label: '🎒 Strip Gear', hint: '+20 MP · 50% Gear +1' },
      { label: '🚶 Pass By', hint: 'Leave them behind' },
    ],
  },
  {
    key: 'toll',
    icon: '🪓',
    title: 'Bandit Toll',
    desc: 'Armed brigands block the trail demanding coin.',
    timing: 'field',
    regions: ['road', 'canyon', 'forest', 'mine', 'fort', 'market'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '💰 Pay Toll', hint: '-25 MP (or -8 Stamina if short)' },
      { label: '⚔ Fight Bandits', hint: 'Win (d7): +60 MP & Supply aftermath · Fail: -12' },
      { label: '↪ Detour', hint: 'Long detour · All -6 Stamina' },
    ],
  },
  {
    key: 'storm',
    icon: '⛈',
    title: 'Sudden Storm',
    desc: 'Black clouds gather and gale-force rain sweeps the path.',
    timing: 'field',
    regions: null,
    minCrew: 1,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '⛺ Take Shelter', hint: 'AP -1 · All +5 Stamina' },
      { label: '🥾 Push Through', hint: 'All -8 Stamina · 25% Bruised ailment' },
    ],
  },
  {
    key: 'beast',
    icon: '🐾',
    title: 'Stray Monster',
    desc: 'A young monster separated from its pack wanders nearby.',
    timing: 'field',
    regions: ['forest', 'swamp', 'ruin', 'canyon', 'hotspring'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 2,
    options: [
      { label: '🤲 Tame', hint: 'Win (d7): +1 Egg & Hunter aftermath · Fail: -14' },
      { label: '🍖 Hunt', hint: 'Food +12' },
    ],
  },
  {
    key: 'board',
    icon: '📜',
    title: 'Guild Bounty Board',
    desc: 'Familiar dungeon notices are nailed to a Guild posting.',
    timing: 'field',
    regions: ['mine', 'road', 'abbey', 'fort', 'market'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '📜 Tear Down', hint: 'Intel +1 · Notoriety +1' },
      { label: '✍ Forge Bounty', hint: '+30 MP · 30% exposed (-6 Stamina all)' },
    ],
  },
  {
    key: 'slaver',
    icon: '⛓',
    title: 'Slaver Column',
    desc: 'A chained column of prisoners marches under slaver escort.',
    timing: 'field',
    regions: ['road', 'mine', 'canyon', 'market'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 3,
    options: [
      { label: '⚔ Ambush Slavers', hint: 'Win (d8): Pop +15, Captive (C) & Supply · Fail: -12' },
      { label: '💰 Buy Captive', hint: '-80 MP · Captive (B/C)' },
      { label: '🚶 Pass By', hint: 'Let the column pass' },
    ],
  },
  {
    key: 'chest',
    icon: '📦',
    title: 'Old Treasure Chest',
    desc: 'A dust-caked iron chest sits half-buried in rubble.',
    timing: 'field',
    regions: ['ruin', 'fort', 'mine', 'market'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 2,
    options: [
      { label: '🔓 Open', hint: '50% Parts+MP · 30% Trap (-15) · 20% Mimic (-10, Egg)' },
      { label: '🚶 Leave It', hint: 'Ignore the suspicious chest' },
    ],
  },
  {
    key: 'home',
    icon: '🏡',
    title: "Crew's Home Village",
    desc: '{a} confesses their home village lies just off the road.',
    timing: 'field',
    regions: ['forest', 'mine', 'road', 'abbey', 'hotspring'],
    minCrew: 1,
    minDepth: 0,
    autoChoice: 2,
    options: [
      { label: '✅ Permit Visit', hint: '75% Food +10, +20 MP, Resist -10 · 25% Flee' },
      { label: '✋ Forbid', hint: 'Resist +5' },
    ],
  },
  {
    key: 'stash',
    icon: '💰',
    title: 'Hidden Stash',
    desc: '{a} uncovers a concealed purse of gold coins.',
    timing: 'field',
    regions: null,
    minCrew: 1,
    minDepth: 0,
    autoChoice: 1,
    options: [
      { label: '💰 Claim All', hint: '+50 MP' },
      { label: '🎁 Share Cut', hint: '+25 MP · Resist -10' },
    ],
  },
  {
    key: 'scout',
    icon: '👣',
    title: 'Volunteer Scout',
    desc: '{a} offers to scout ahead before the party advances.',
    timing: 'field',
    regions: null,
    minCrew: 1,
    minDepth: 0,
    autoChoice: 2,
    options: [
      { label: '✅ Send Ahead', hint: '-6 Stamina · Next move 0% Ambush · +3 Scout points' },
      { label: '✋ Stay Together', hint: 'Keep formation' },
    ],
  },
  // 6 Deep events (depth >= 8)
  {
    key: 'tomb',
    icon: '⚰',
    title: "Forgotten King's Tomb",
    desc: 'A sealed royal crypt yawns open in the deep frontier.',
    timing: 'deep',
    regions: null,
    minCrew: 1,
    minDepth: 8,
    autoChoice: 2,
    options: [
      { label: '🔓 Grave Rob', hint: 'Relic Shard +1 · 50% Curse (All -10 Stamina)' },
      { label: '🙇 Leave Sealed', hint: 'Do not disturb the crypt' },
    ],
  },
  {
    key: 'nest',
    icon: '🐉',
    title: "Dragon's Nest",
    desc: 'Eggs and gold glitter beside a slumbering wyrm.',
    timing: 'deep',
    regions: null,
    minCrew: 1,
    minDepth: 8,
    autoChoice: 2,
    options: [
      { label: '🥚 Steal Eggs', hint: '50% +2 Eggs & +80 MP · 50% All -18 Stamina' },
      { label: '🚶 Sneak Past', hint: 'Creep away silently' },
    ],
  },
  {
    key: 'vault',
    icon: '🗝',
    title: 'Guild Secret Vault',
    desc: 'You uncover a hidden Guild supply cache.',
    timing: 'deep',
    regions: null,
    minCrew: 1,
    minDepth: 8,
    autoChoice: 1,
    options: [
      { label: '📦 Loot Vault', hint: '+100 MP · Intel +1 · Supply Sabotage aftermath' },
      { label: '🔥 Burn Vault', hint: 'Notoriety +1 · Supply Sabotage aftermath' },
    ],
  },
  {
    key: 'deserter',
    icon: '🏳',
    title: 'Demon-Army Deserters',
    desc: 'Stray Demon-Army stragglers beg to join the party.',
    timing: 'deep',
    regions: null,
    minCrew: 1,
    minDepth: 8,
    autoChoice: 1,
    options: [
      { label: '🤝 Recruit', hint: 'Pop +20 · All +10 Stamina' },
      { label: '⚔ Disarm', hint: 'Expedition Gear +1' },
    ],
  },
  {
    key: 'pilgrim',
    icon: '⛪',
    title: "Saint's Pilgrimage",
    desc: 'An armed holy procession escorts a shrine maiden.',
    timing: 'deep',
    regions: null,
    minCrew: 1,
    minDepth: 8,
    autoChoice: 2,
    options: [
      { label: '⛓ Ambush', hint: 'Win (d9+depth): Grade A Priest Captive, +10 Wrath, Desecrate · Fail: -12' },
      { label: '🚶 Hide', hint: 'Let the procession pass' },
    ],
  },
  {
    key: 'rift',
    icon: '🌀',
    title: 'Otherworldly Rift',
    desc: 'Strange mana bleeds from a tear in space itself.',
    timing: 'deep',
    regions: null,
    minCrew: 1,
    minDepth: 8,
    autoChoice: 2,
    options: [
      { label: '🖐 Reach Inside', hint: '40% Grade S/SS Mage Captive · 60% 1 member -20' },
      { label: '🚶 Seal Rift', hint: 'Relic Shard +1' },
    ],
  },
] as const;

export const EXPEDITION_EVENT_MAP: Record<string, ExpeditionEventDef> = Object.fromEntries(
  EXPEDITION_EVENTS.map((e) => [e.key, e])
);

export interface ExpeditionRelicDef {
  key: RelicKey;
  icon: string;
  label: string;
  effect: string;
}

export const EXPEDITION_RELICS: readonly ExpeditionRelicDef[] = [
  { key: 'shield', icon: '🛡', label: 'Paladin Shield', effect: '1F Defense DC +1' },
  { key: 'chalice', icon: '🍷', label: 'Blood Chalice', effect: '+2 Fear per raid' },
  { key: 'crown', icon: '👑', label: 'Plundered Crown', effect: '+10% Base Estate Income' },
  { key: 'lens', icon: '🔮', label: 'Rival Lens', effect: '+1 Intel per hero party' },
] as const;

export const EXPEDITION_RELIC_MAP: Record<RelicKey, ExpeditionRelicDef> = Object.fromEntries(
  EXPEDITION_RELICS.map((r) => [r.key, r])
) as Record<RelicKey, ExpeditionRelicDef>;

export type AfterEffectKey =
  | 'supply'
  | 'scout'
  | 'revenge'
  | 'leak'
  | 'desecrate'
  | 'merchant'
  | 'hunter'
  | 'royal';

export interface ExpeditionAfterEffectDef {
  key: AfterEffectKey;
  icon: string;
  label: string;
  heroMod: -1 | 0 | 1;
  waves: number;
  scope: 'all' | 'f1_2' | 'clerics' | 'income' | 'monsters';
  promptText: string;
  desc: string;
}

export const EXPEDITION_AFTEREFFECTS: readonly ExpeditionAfterEffectDef[] = [
  {
    key: 'supply',
    icon: '📦',
    label: 'Supply Sabotage',
    heroMod: -1,
    waves: 2,
    scope: 'all',
    promptText: "the Guild's supply lines were raided — the heroes are short on potions and food",
    desc: 'All heroes -1 across all floors (2 waves)',
  },
  {
    key: 'scout',
    icon: '🔭',
    label: 'Scouted Approaches',
    heroMod: -1,
    waves: 1,
    scope: 'f1_2',
    promptText: "the dungeon's scouts mapped the approach — the first two floors are better prepared",
    desc: 'Heroes on 1F–2F -1 (1 wave)',
  },
  {
    key: 'revenge',
    icon: '🔥',
    label: 'Vengeful Retaliation',
    heroMod: 1,
    waves: 2,
    scope: 'all',
    promptText: 'villages burned by the raiders send vengeful heroes',
    desc: 'All heroes +1 (from Notoriety >= 3, 2 waves)',
  },
  {
    key: 'leak',
    icon: '🕵',
    label: 'Layout Leak',
    heroMod: 1,
    waves: 2,
    scope: 'all',
    promptText: "a deserter sold the dungeon's layout to the Guild",
    desc: 'All heroes +1 (from crew flee / casualty / wipe, 2 waves)',
  },
  {
    key: 'desecrate',
    icon: '⛪',
    label: 'Desecrated Shrines',
    heroMod: -1,
    waves: 2,
    scope: 'clerics',
    promptText: 'the Church is enraged by desecrated shrines; clerics fight shaken',
    desc: 'Priest/Cleric/Paladin heroes -1, +10 Wrath (2 waves)',
  },
  {
    key: 'merchant',
    icon: '🤝',
    label: 'Merchant Contacts',
    heroMod: 0,
    waves: 2,
    scope: 'income',
    promptText: 'friendly merchants pay the dungeon a share',
    desc: 'Friendly trade network (+10% estate trade bonus, 2 waves)',
  },
  {
    key: 'hunter',
    icon: '🐾',
    label: 'Beast-Hunter Rumors',
    heroMod: -1,
    waves: 2,
    scope: 'monsters',
    promptText: 'rumors of monster-hunting draw beast-tamers; the pens monsters are fierce',
    desc: 'Floors guarded by monsters impose -1 on heroes (2 waves)',
  },
  {
    key: 'royal',
    icon: '👑',
    label: 'Capital Uproar',
    heroMod: 1,
    waves: 2,
    scope: 'all',
    promptText: 'the capital is in uproar — stronger heroes come, with bigger bounties on their heads',
    desc: 'All heroes +1 (Grand/Abyss return, 2 waves)',
  },
] as const;

export const EXPEDITION_AFTEREFFECT_MAP: Record<AfterEffectKey, ExpeditionAfterEffectDef> =
  Object.fromEntries(EXPEDITION_AFTEREFFECTS.map((a) => [a.key, a])) as Record<
    AfterEffectKey,
    ExpeditionAfterEffectDef
  >;

export const EXD_ART_ORDER = [
  'lost',
  'flee',
  'sack',
  'raid',
  'capital',
  'village',
  'depart',
  'return',
  'ambush',
  'battle',
  'camp',
] as const;

export function pickExpeditionArt(
  evFlags: Record<string, boolean>,
  region: string
): string | undefined {
  for (const k of EXD_ART_ORDER) {
    if (evFlags[k]) {
      const key = k === 'return' && evFlags.lost ? 'dk_exd_lost' : `dk_exd_${k}`;
      const asset = resolveSceneAsset(key);
      if (asset) return asset;
    }
  }
  if (region && region !== 'out' && region !== 'village' && region !== 'city') {
    const regAsset = resolveSceneAsset(`dk_exr_${region}`);
    if (regAsset) return regAsset;
  }
  return resolveSceneAsset('dk_exd_depart');
}

export const GRADE_POWER_INDEX: Record<HeroGrade, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SS: 6,
  SSS: 7,
  EPIC: 8,
};

export const EXPEDITION_EGG_LINEAGES = [
  'beast',
  'slime',
  'tentacle',
  'mimic',
  'plant',
  'orc',
  'lizard',
  'bug',
  'mush',
  'golem',
  'harpy',
  'lamia',
  'spider',
  'minotaur',
  'chimera',
  'elemental',
  'were',
  'fox',
  'oni',
  'snow',
  'siren',
  'centaur',
  'troll',
  'darkelf',
  'demon',
  'vampire',
  'dragon',
  'mare',
] as const;

export const EXPEDITION_CAPTIVE_NAMES = {
  female: ['Elin', 'Mirae', 'Sora', 'Liesel', 'Kaya', 'Ondine', 'Brielle', 'Talia'],
  male: ['Corwin', 'Bram', 'Edrik', 'Lucan', 'Taro', 'Matthis', 'Rowan', 'Silas'],
} as const;
