import type { HeroGrade, RelicKey, WarRivalKey } from '../types/game';

export const REALM_CFG = {
  FROM: 10,
  P1: 0.9,
  FROM2: 20,
  P2: 0.5,
  FROM3: 30,
  P3: 0.3,
  COOL: 5,
  CAP: 3,
  BOND_CAP: 3,
  PREP_CAP: 2,
  TOTAL_CAP: 5,
  GPREP_FROM: 10,
  GPREP_MAX: 5,
} as const;

export interface RealmSituationDef {
  key: string;
  icon: string;
  name: string;
  waves: number;
  summary: string;
  promptTag: string;
  counterHint: string;
}

export const REALM_SITUATIONS: Record<string, RealmSituationDef> = {
  iseg: {
    key: 'iseg',
    icon: '🌀',
    name: 'Otherworld Summoned Hero',
    waves: 1,
    summary: 'One hero wields a cheat skill (+2 on all floors; Intel 2 reduces to +1).',
    promptTag: 'an otherworld-summoned hero wields a cheat skill',
    counterHint: 'Analyze skill with 2 Intel -> +1',
  },
  leak: {
    key: 'leak',
    icon: '🗂',
    name: 'Leaked Dungeon Guide',
    waves: 2,
    summary: 'Heroes get +2 on trap floors unchanged for 3+ waves.',
    promptTag: 'a leaked dungeon guide maps the unchanged floors',
    counterHint: 'Rebuild floor traps or plant Fake Map (150 MP)',
  },
  academy: {
    key: 'academy',
    icon: '🎓',
    name: 'Knight Academy Graduates',
    waves: 1,
    summary: 'Hero grades -1 tier, but gain +1 per other living ally (max +2).',
    promptTag: "a fresh graduate party from a knights' academy fights as one",
    counterHint: 'Drop one early on Floor 1 to break teamwork',
  },
  disarm: {
    key: 'disarm',
    icon: '🔧',
    name: 'Trap-Breaker Guild',
    waves: 1,
    summary: 'Rogue/Hunter or disarmer heroes gain +2 on floors without defenders.',
    promptTag: 'a trap-breaker guild sends disarmers',
    counterHint: 'Deploy a Monster or Guard on key floors',
  },
  tamer: {
    key: 'tamer',
    icon: '🐉',
    name: 'Beast Tamer Party',
    waves: 1,
    summary: '+2 vs monster floors (+1 if ★2+ only); 30% chance to steal ★1 monsters.',
    promptTag: "a monster-tamer hero turns the dungeon's beasts",
    counterHint: 'Deploy ★2+ evolved monsters instead of ★1',
  },
  chosen: {
    key: 'chosen',
    icon: '⭐',
    name: 'Oracle-Chosen One',
    waves: 1,
    summary: 'One chosen hero gains +2 on all floors (Shrine/Torture Lv2+ cuts to +1).',
    promptTag: 'an oracle-chosen hero is favored by fate',
    counterHint: 'Dark Shrine or Torture Chamber Lv2+ cuts bonus to +1',
  },
  festival: {
    key: 'festival',
    icon: '🍀',
    name: 'Goddess Festival',
    waves: 2,
    summary: 'All heroes +1, but slay/capture bounties pay 1.5x MP.',
    promptTag: "the goddess's festival blesses every adventurer",
    counterHint: 'No counter — higher risk, 1.5x bounty reward',
  },
  overload: {
    key: 'overload',
    icon: '🔋',
    name: 'Core Overload',
    waves: 1,
    summary: 'Two random trap floors flicker, granting heroes +2 there.',
    promptTag: "the Core overloads and two floors' traps flicker",
    counterHint: 'Stabilize Core (100 MP)',
  },
  saint: {
    key: 'saint',
    icon: '✝',
    name: 'Accompanying Saint',
    waves: 1,
    summary: 'Heroes gain +2 on lewd/mind floors (cut to +1 with Corr 60+ prisoner).',
    promptTag: 'a saint travels with the party, purifying corruption',
    counterHint: 'Having a Corr 60+ prisoner dampens aura to +1',
  },
  revenge: {
    key: 'revenge',
    icon: '💔',
    name: 'Avenging Comrade',
    waves: 1,
    summary: 'Avenger gets +2 (-2 instead if target prisoner is deployed as guard).',
    promptTag: 'a hero comes to rescue a captive comrade',
    counterHint: 'Deploy the named prisoner on a floor to demoralize (-2)',
  },
  alliance: {
    key: 'alliance',
    icon: '📯',
    name: 'Demon-Lord Subjugation Alliance',
    waves: 1,
    summary: 'All heroes +1 (1 Intel cuts formation bonus to 0).',
    promptTag: 'the Demon-Lord Subjugation Alliance sends coordinated parties',
    counterHint: 'Disrupt formation with 1 Intel',
  },
  princess: {
    key: 'princess',
    icon: '👑',
    name: 'Royal Princess Escort',
    waves: 1,
    summary: 'Princess +2; allies +1 while she stands. Capturing her grants +300 MP.',
    promptTag: 'a knight-princess leads the party',
    counterHint: 'Drop the Princess early; capture yields +300 MP',
  },
  regress: {
    key: 'regress',
    icon: '🔁',
    name: 'Time Regressor',
    waves: 1,
    summary: 'One hero gains +3 on floors unchanged for 2+ waves.',
    promptTag: "a returner who remembers the dungeon's halls",
    counterHint: 'Alter traps on stale floors',
  },
  charm: {
    key: 'charm',
    icon: '🔰',
    name: 'Anti-Lewd Amulets',
    waves: 1,
    summary: 'Heroes +2 on lewd/bind floors (Lewd Market Lv2+ cuts to +1).',
    promptTag: 'merchants sold the heroes wards against lewd curses and bindings',
    counterHint: 'Lewd Market Lv2+ cuts effectiveness to +1',
  },
  bounty: {
    key: 'bounty',
    icon: '🎯',
    name: 'Officer Bounty',
    waves: 1,
    summary: 'On Breach/Partial, officer medical fees cost up to 120 MP.',
    promptTag: "bounty hunters target the dungeon's officers",
    counterHint: 'Escort Officers in Day phase (1 AP)',
  },
  purify: {
    key: 'purify',
    icon: '⛪',
    name: 'Purification Barrier',
    waves: 1,
    summary: 'Heroes +2 on lewd/mind/mutate floors.',
    promptTag: "a church barrier dampens the dungeon's foul magic",
    counterHint: 'Counter-Hex in Day phase (1 AP, requires Dark Shrine Lv1+)',
  },
  spy: {
    key: 'spy',
    icon: '🕵',
    name: 'Spy in the Dungeon',
    waves: 1,
    summary: 'One floor layout leaked (+2 to heroes on that floor).',
    promptTag: 'a Guild spy hidden among the captives leaks the layout',
    counterHint: 'Interrogate Suspects in Day phase (1 AP)',
  },
  plague: {
    key: 'plague',
    icon: '🦠',
    name: 'Monster Pen Plague',
    waves: 2,
    summary: 'Heroes +1 on monster floors; 10% chance each monster dies post-raid.',
    promptTag: 'a plague spreads through the monster pens',
    counterHint: 'Quarantine Pens in Day phase (1 AP)',
  },
  tax: {
    key: 'tax',
    icon: '📜',
    name: 'Demon Army Tribute',
    waves: 1,
    summary: '1.5x Upkeep (or 100 MP flat tribute if Upkeep is off).',
    promptTag: 'the Demon Army demands tribute',
    counterHint: 'Send 1 non-legend Prisoner as tribute',
  },
  riot: {
    key: 'riot',
    icon: '🏳',
    name: 'Prison Revolt Plot',
    waves: 1,
    summary: 'Heroes gain +1 on deep floors (5F+) while high-resist captives plot.',
    promptTag: 'restless captives plot a jailbreak',
    counterHint: 'Break prisoner resistance below 60',
  },
  exile: {
    key: 'exile',
    icon: '🚪',
    name: 'Exiled S-Rank',
    waves: 1,
    summary: 'Top hero +3, but fractious teammates suffer -1.',
    promptTag: 'an exiled hero joins out of spite',
    counterHint: 'Burst down the exiled carry first',
  },
  knightess: {
    key: 'knightess',
    icon: '🛡',
    name: 'Unyielding Knightess',
    waves: 1,
    summary: 'Designated knightess gains +2 on lewd/mind floors.',
    promptTag: 'a proud knight who will never yield',
    counterHint: 'Break her with physical/elemental floors instead',
  },
  mass: {
    key: 'mass',
    icon: '👻',
    name: 'Mass Summoning Ritual',
    waves: 1,
    summary: 'All heroes +1 (1 Intel cuts to 0).',
    promptTag: 'a mass summoning brought a whole class of otherworlders',
    counterHint: 'Expose Weaknesses with 1 Intel',
  },
  broadcast: {
    key: 'broadcast',
    icon: '📺',
    name: 'Live Raid Broadcast',
    waves: 1,
    summary: 'All heroes +1; Wipe/Retreat grants +2 Fame & +3 Fear.',
    promptTag: 'a crystal-ball broadcast streams the raid to the realm',
    counterHint: 'High-stakes spectacle — crush them on stream!',
  },
  gacha: {
    key: 'gacha',
    icon: '🎰',
    name: 'Guild Gacha Gear',
    waves: 1,
    summary: 'Each hero gets +2 vs one random trap tag (1 Intel halves to +1).',
    promptTag: 'the Guild handed out random gacha gear',
    counterHint: 'Reveal Loadouts with 1 Intel -> +1',
  },
};

export const REALM_ORDER: string[] = Object.keys(REALM_SITUATIONS);

export interface RealmCounterDef {
  situationKey: string;
  costKind: 'intel' | 'mp' | 'ap' | 'pri';
  costAmount: number;
  label: string;
  dayOnly: boolean;
  requiresShrine?: boolean;
}

export const REALM_COUNTERMEASURES: Record<string, RealmCounterDef> = {
  iseg: { situationKey: 'iseg', costKind: 'intel', costAmount: 2, label: 'Analyze Skill', dayOnly: false },
  leak: { situationKey: 'leak', costKind: 'mp', costAmount: 150, label: 'Plant Fake Map', dayOnly: false },
  overload: { situationKey: 'overload', costKind: 'mp', costAmount: 100, label: 'Stabilize Core', dayOnly: false },
  alliance: { situationKey: 'alliance', costKind: 'intel', costAmount: 1, label: 'Break Formation', dayOnly: false },
  mass: { situationKey: 'mass', costKind: 'intel', costAmount: 1, label: 'Expose Ritual', dayOnly: false },
  gacha: { situationKey: 'gacha', costKind: 'intel', costAmount: 1, label: 'Reveal Loadout', dayOnly: false },
  tax: { situationKey: 'tax', costKind: 'pri', costAmount: 1, label: 'Send Prisoner Tribute', dayOnly: false },
  bounty: { situationKey: 'bounty', costKind: 'ap', costAmount: 1, label: 'Escort Officers', dayOnly: true },
  purify: {
    situationKey: 'purify',
    costKind: 'ap',
    costAmount: 1,
    label: 'Counter-Hex',
    dayOnly: true,
    requiresShrine: true,
  },
  spy: { situationKey: 'spy', costKind: 'ap', costAmount: 1, label: 'Interrogate Spy', dayOnly: true },
  plague: { situationKey: 'plague', costKind: 'ap', costAmount: 1, label: 'Quarantine Pens', dayOnly: true },
};

export interface HeroBondDef {
  key: string;
  icon: string;
  label: string;
  promptDesc: string;
  effectHint: string;
}

export const HERO_BONDS: Record<string, HeroBondDef> = {
  lovers: {
    key: 'lovers',
    icon: '💞',
    label: 'Lovers',
    promptDesc: 'lovers',
    effectHint: '+1 while together, +2 vengeance if partner falls',
  },
  siblings: {
    key: 'siblings',
    icon: '👭',
    label: 'Siblings',
    promptDesc: 'siblings',
    effectHint: '+1 together; if separated elder +2 / younger -1',
  },
  mentor: {
    key: 'mentor',
    icon: '🗡',
    label: 'Mentor & Apprentice',
    promptDesc: 'mentor and apprentice',
    effectHint: 'Apprentice +1 with mentor, -2 if mentor falls',
  },
  friends: {
    key: 'friends',
    icon: '🤞',
    label: 'Childhood Friends',
    promptDesc: 'childhood friends',
    effectHint: '+1 when afflicted together or avenging fallen friend',
  },
  rivals: {
    key: 'rivals',
    icon: '⚔',
    label: 'Rivals',
    promptDesc: 'rivals',
    effectHint: '+1 together (competitive drive), -1 if rival falls',
  },
  knight: {
    key: 'knight',
    icon: '🛡',
    label: 'Knight & Liege',
    promptDesc: 'sworn knight and liege',
    effectHint: 'Liege +1 with knight; knight +2 if liege falls',
  },
  fiance: {
    key: 'fiance',
    icon: '💍',
    label: 'Betrothed',
    promptDesc: 'betrothed',
    effectHint: '+1 together, -2 grief shock if betrothed falls',
  },
};

export const HERO_BOND_ORDER = Object.keys(HERO_BONDS);

export interface HeroStoryDef {
  key: string;
  icon: string;
  label: string;
  promptDesc: string;
  effectHint: string;
}

export const HERO_STORIES: Record<string, HeroStoryDef> = {
  revenge: {
    key: 'revenge',
    icon: '🔥',
    label: 'Avenging Home',
    promptDesc: "seeks revenge for a home village burned by the Demon Lord's raiders",
    effectHint: '+1 on all floors',
  },
  family: {
    key: 'family',
    icon: '🔍',
    label: 'Missing Kin',
    promptDesc: 'searches for a lost family member held captive in this dungeon',
    effectHint: '+2 on 4F+ when prisoners exist',
  },
  merc: {
    key: 'merc',
    icon: '💰',
    label: 'Indebted Mercenary',
    promptDesc: 'a debt-ridden mercenary who cannot afford to retreat',
    effectHint: '+1 when injured/severe',
  },
  honor: {
    key: 'honor',
    icon: '🏳',
    label: 'Reclaiming Honor',
    promptDesc: 'came to wash away the shame of an earlier defeat',
    effectHint: '+1 on all floors',
  },
  last: {
    key: 'last',
    icon: '🧓',
    label: 'Final Mission',
    promptDesc: 'on a final mission before retirement',
    effectHint: '+1 on 1-3F, -1 on 5F+',
  },
  curse: {
    key: 'curse',
    icon: '⛓',
    label: 'Curse-Breaking Pilgrimage',
    promptDesc: 'a pilgrim seeking to break a curse',
    effectHint: '+2 on curse/mutate/parasite floors',
  },
  oracle: {
    key: 'oracle',
    icon: '📿',
    label: 'Oracle Prophecy',
    promptDesc: "guided by an oracle's prophecy",
    effectHint: '+1 on all floors (W20+)',
  },
  promise: {
    key: 'promise',
    icon: '💌',
    label: 'Promise to Return',
    promptDesc: 'swore to return home to someone waiting',
    effectHint: '+1 when injured/severe',
  },
};

export const HERO_STORY_ORDER = Object.keys(HERO_STORIES);

export const GPREP_TABLE: Record<number, number[]> = {
  0: [],
  1: [1],
  2: [1, 1],
  3: [2, 1],
  4: [2, 2],
  5: [2, 2, 1],
};

export const GPREP_GEAR_LABELS: Record<string, string> = {
  fire: '🔥 Fireproof Cloak',
  poison: '🧪 Antidote Vial',
  pit: '🪢 Grappling Hook',
  lewd: '🕯 Ward Incense',
  mind: '🕯 Clarity Charm',
  elec: '⚡ Insulated Gloves',
  ice: '🧊 Thermal Coat',
  bind: '🔓 Lockpick Kit',
  water: '🫧 Breathing Talisman',
  phys: '🛡 Reinforced Buckler',
  cloth: '🧥 Spare Garments',
  curse: '📿 Purification Seal',
  parasite: '🧴 Anti-Parasite Salve',
  mutate: '📿 Mutagen Ward',
};

export const GRIT_BY_GRADE: Partial<Record<HeroGrade, number>> = {
  SS: 3,
  SSS: 4,
  EPIC: 5,
};

export const EPIC_CFG = {
  BONUS: 18,
  RES: 5,
  SANCTUARY_DC_ADD: 2,
  BREACH_PEN: 450,
  REWARD: 450,
  AURA: 1,
  GM_CHANCE: 0.35,
  NEM_BASE: 0.08,
  NEM_STEP: 0.03,
  NEM_EXIST: 0.08,
  NEM_MAX: 0.5,
  NEM_CAP: 3,
  ADAPT_MAX: 2,
} as const;

export const CRISIS_CFG = {
  WRATH_FROM: 25,
  WRATH_KILL: 6,
  WRATH_STREAK: 4,
  WRATH_BREACH: 12,
  WRATH_FAIL_DECAY: 6,
  WRATH_EXEC: 5,
  WRATH_MAX: 100,
  CRUSADE_WAVES: 3,
  CRUSADE_CD: 12,
  SIEGE_FROM: 20,
  SIEGE_LV: 4,
  SIEGE_BASE: 0.03,
  SIEGE_FAME: 0.06,
  SIEGE_ORDER: 0.06,
  SIEGE_ANNEX: 0.08,
  SIEGE_NOBREACH: 0.04,
  SIEGE_CAP: 0.35,
  SIEGE_CD: 8,
  JAIL_NUM: 3,
  JAIL_RES: 60,
  JAIL_P: 0.15,
  JAIL_TRUSTY_P: 0.075,
} as const;

export const GM_NAMES = [
  'Grand Master Seraphiel',
  'Grand Master Aurelia',
  'Grand Master Cassian',
  'Grand Master Valerian',
] as const;

export const RELIC_DEFS: Record<
  RelicKey,
  { key: RelicKey; icon: string; name: string; effectDesc: string }
> = {
  shield: {
    key: 'shield',
    icon: '🛡',
    name: 'Aegis of the First Gate',
    effectDesc: '1F Trap DC +1 permanently.',
  },
  chalice: {
    key: 'chalice',
    icon: '🍷',
    name: 'Chalice of Dread',
    effectDesc: '+2 Fear per raid wave.',
  },
  crown: {
    key: 'crown',
    icon: '👑',
    name: 'Crown of Tribute',
    effectDesc: '+10% Town Management Settlement income.',
  },
  lens: {
    key: 'lens',
    icon: '🔮',
    name: 'All-Seeing Lens',
    effectDesc: '+1 Prep Intel at the start of every wave.',
  },
};

export const RELIC_ORDER: RelicKey[] = ['shield', 'chalice', 'crown', 'lens'];

export type LandmarkKey = 'hq' | 'lab' | 'cmd';

export const LANDMARK_DEFS: Record<
  LandmarkKey,
  {
    key: LandmarkKey;
    icon: string;
    name: string;
    cost: number;
    reqTownLv: number;
    effectDesc: string;
    assetKey: string;
  }
> = {
  hq: {
    key: 'hq',
    icon: '🗺',
    name: 'Expedition Command HQ',
    cost: 600,
    reqTownLv: 6,
    effectDesc: 'Expedition crew max +1 (4th slot), camp recovery +25, ambush flee -8% (-12% Long+).',
    assetKey: 'dk_fac_hq',
  },
  lab: {
    key: 'lab',
    icon: '🧪',
    name: 'Arcane Trap Lab',
    cost: 900,
    reqTownLv: 7,
    effectDesc: 'Toggle up to 2 dungeon floors for +1 Trap DC each.',
    assetKey: 'dk_fac_lab',
  },
  cmd: {
    key: 'cmd',
    icon: '🎖',
    name: 'War Command Citadel',
    cost: 900,
    reqTownLv: 7,
    effectDesc: 'All floors with assigned Guard prisoners gain +1 Trap DC.',
    assetKey: 'dk_fac_cmd',
  },
};

export const LANDMARK_ORDER: LandmarkKey[] = ['hq', 'lab', 'cmd'];

export const WAR_CFG = {
  FROM_W: 12,
  FROM_LV: 3,
  SCOUT_COST: 0,
  RAID_MP: 60,
  ANNEX_DEF: 5,
  PAL_FEAR: 2,
  MER_MUL: 1.1,
  WIT_FOOD: 5,
  SIEGE_ANNEX_DEF: 2,
} as const;

export const WAR_RIVALS: Record<
  WarRivalKey,
  {
    key: WarRivalKey;
    icon: string;
    name: string;
    def: number;
    annexBonusDesc: string;
  }
> = {
  paladin: {
    key: 'paladin',
    icon: '⚔',
    name: 'Silver Bastion Order',
    def: 12,
    annexBonusDesc: 'MP/settle +40 · +2 Fear per raid · +2 Siege Defense',
  },
  merchant: {
    key: 'merchant',
    icon: '💰',
    name: 'Golden League Free City',
    def: 10,
    annexBonusDesc: 'MP/settle +40 · +10% Prisoner Ransom/Sale · +2 Siege Defense',
  },
  witch: {
    key: 'witch',
    icon: '🧙‍♀️',
    name: 'Coven of the Mistwood',
    def: 14,
    annexBonusDesc: 'MP/settle +40 · +5 Food per Management Settle · +2 Siege Defense',
  },
};

export const WAR_RIVAL_ORDER: WarRivalKey[] = ['paladin', 'merchant', 'witch'];

export type WonderKey = 'spire' | 'temple' | 'gold';

export const WONDER_DEFS: Record<
  WonderKey,
  {
    key: WonderKey;
    icon: string;
    name: string;
    cost: number;
    effectDesc: string;
  }
> = {
  spire: {
    key: 'spire',
    icon: '🗼',
    name: 'Watchspire of Shadows',
    cost: 1000,
    effectDesc: 'Jams Guild scouts: effective Guild Counter-Gear Prep Lv reduced by 1.',
  },
  temple: {
    key: 'temple',
    icon: '⛩',
    name: 'Erotic Sanctuary Temple',
    cost: 2500,
    effectDesc: '+3 Fear and +3 Lust gained after every raid.',
  },
  gold: {
    key: 'gold',
    icon: '🏛',
    name: 'Gilded Vault of Avarice',
    cost: 5000,
    effectDesc: '+15% MP from all prisoner ransoms & slave sales.',
  },
};

export const WONDER_ORDER: WonderKey[] = ['spire', 'temple', 'gold'];
