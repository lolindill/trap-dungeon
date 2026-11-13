import { resolveSceneAsset } from './assetManifest';
import type { HeroGrade, PrisonerConversion, PrisonerMarks } from '../types/game';

export type PrisonCategoryTab = 'care' | 'train' | 'shame' | 'dark';
export type PrisonDetailTab = PrisonCategoryTab | 'jobs' | 'fate';

export type PactStatKey = 'pleasure' | 'terror' | 'shame' | 'resist' | 'corr';
export type BuyerKey = 'slaver' | 'noble' | 'brothel' | 'arena';
export type JobLocation = 'town' | 'floor' | 'prison';

export interface PrisonPactDef {
  id: string;
  label: string;
  tab: PrisonCategoryTab;
  luaGroup: 'soft' | 'train' | 'shame' | 'fear' | 'use' | 'dark';
  mpCost: number;
  staminaCost: number; // negative restores stamina
  noAp?: boolean;
  isFearVerb?: boolean;
  effects: Partial<Record<PactStatKey, [number, number]>>;
  req?: {
    facility?: string;
    facilityLv?: number;
    mark?: [keyof PrisonerMarks, number];
    minPrisoners?: number;
    needsPair?: boolean;
    oncePerDay?: boolean;
    needsOfficerDuo?: boolean;
    needsOfficerGift?: boolean;
    notFlag?: 'branded' | 'crest' | 'cow' | 'renamed';
    needsCureTarget?: boolean;
  };
  harsh?: {
    baseDie: number;
    en: string;
    noregen?: boolean;
    mpGain?: number;
    foodGain?: number;
  };
  assetKey: string;
  summary: string;
  resultProse: string;
}

export interface PrisonJobDef {
  key: string;
  label: string;
  facility: string | null;
  facilityLv?: number;
  baseSlots: number;
  location: JobLocation;
  reqMark?: [keyof PrisonerMarks, number];
  staminaCost: number;
  outputs: {
    mp?: number;
    mpRansomRatio?: number;
    food?: number;
    approval?: number;
    order?: number;
    renown?: number;
    fear?: number;
    lust?: number;
    affVesper?: number;
  };
  prisonerDelta: Partial<Record<PactStatKey, number>>;
  aptitude: { stat: 'shame' | 'resist' | 'stamina' | 'pleasure' | 'corr' | 'terror'; dir: 1 | -1 }[];
  desc: string;
  assetKey: string;
}

export interface PrisonConversionDef {
  key: PrisonerConversion;
  label: string;
  maxCapLabel: string;
  reqSummary: string;
  effectSummary: string;
  assetKey: string;
}

export interface BuyerDef {
  id: BuyerKey;
  label: string;
  shortLabel: string;
  desc: string;
}

export const PRISON_DETAIL_TABS: readonly { id: PrisonDetailTab; label: string; group: string }[] = [
  { id: 'care', label: 'Care & Soft', group: 'Condition' },
  { id: 'train', label: 'Interrogate & Train', group: 'Condition' },
  { id: 'shame', label: 'Shame & Fear', group: 'Condition' },
  { id: 'dark', label: 'Dark & Harsh', group: 'Condition' },
  { id: 'jobs', label: 'Jobs & Convert', group: 'Deploy' },
  { id: 'fate', label: 'Fate', group: 'Dispose' },
] as const;

export const MARK_LABELS: Record<keyof PrisonerMarks, string> = {
  obey: 'Obey',
  pleasure: 'Pleasure',
  terror: 'Terror',
  shame: 'Shame',
};

export const MARK_THRESHOLDS: Record<keyof PrisonerMarks, readonly [number, number, number]> = {
  obey: [50, 25, 5],
  pleasure: [30, 60, 90],
  terror: [30, 60, 90],
  shame: [30, 60, 90],
};

export const PRISON_STAMINA_CFG = {
  START: 100,
  INJURED: 80,
  SEVERE: 60,
  REGEN: 20,
  DIE_BELOW: 10,
  DIE_P: 0.25,
} as const;

export const HARSH_CFG = {
  INJ_CHANCE: 0.25,
  LOW1_THRESHOLD: 30,
  LOW1_BONUS: 0.1,
  LOW2_THRESHOLD: 15,
  LOW2_BONUS: 0.25,
  SEVERE_MULT: 2,
  DEATH_FEAR: 2,
} as const;

export const MOLE_CFG = {
  RAIDS: 2,
  INTEL: 2,
  FIND_CHANCE: 0.2,
  ALERT_PENALTY: 10,
} as const;

export const SERVANT_MP_BY_GRADE: Record<HeroGrade, number> = {
  F: 4,
  D: 6,
  C: 9,
  B: 12,
  A: 16,
  S: 20,
  SS: 25,
  SSS: 30,
  EPIC: 38,
};

export const EXEC_CFG = {
  RATE: 0.4,
  FAME_MULT: 2,
  FEAR_BASE: 6,
  FEAR_PER_GRADE: 2,
} as const;

export const APTITUDE_MULT: Record<1 | 2 | 3, number> = {
  1: 0.7,
  2: 1.0,
  3: 1.4,
};

export const BUYERS: readonly BuyerDef[] = [
  {
    id: 'slaver',
    label: 'Slaver Guild',
    shortLabel: 'Slavers',
    desc: 'Favors high Obey marks, low Resist, and healthy Stamina.',
  },
  {
    id: 'noble',
    label: 'Noble Collector',
    shortLabel: 'Noble',
    desc: 'Pays premiums for Noble/Pure/Virgin captives; dislikes brands & high Corr.',
  },
  {
    id: 'brothel',
    label: 'Brothel Keeper',
    shortLabel: 'Brothel',
    desc: 'Favors high Pleasure, Corruption, Shame marks, and Lewd Crest.',
  },
  {
    id: 'arena',
    label: 'Arena Promoter',
    shortLabel: 'Arena',
    desc: 'Favors high Stamina and intact fighting spirit; dislikes Terror & injuries.',
  },
] as const;

export const PRISON_PACTS: readonly PrisonPactDef[] = [
  // 1. Care & Soft
  {
    id: 'pfeed',
    label: 'Feed Meal',
    tab: 'care',
    luaGroup: 'soft',
    mpCost: 0,
    staminaCost: -25,
    effects: { resist: [-2, -2] },
    assetKey: 'dk_pa_feed',
    summary: 'Stamina +25, Resist -2',
    resultProse: 'fed a warm meal and left slightly calmer, guard lowered',
  },
  {
    id: 'ptalk',
    label: 'Converse',
    tab: 'care',
    luaGroup: 'soft',
    mpCost: 0,
    staminaCost: 0,
    effects: { resist: [-6, -3] },
    assetKey: 'dk_pa_talk',
    summary: 'Resist -3..-6, 15% +1 Intel',
    resultProse: 'drawn into conversation and letting slip more than intended',
  },
  {
    id: 'preward',
    label: 'Gentle Reward',
    tab: 'care',
    luaGroup: 'soft',
    mpCost: 5,
    staminaCost: 0,
    effects: { pleasure: [5, 5], resist: [-5, -5] },
    assetKey: 'dk_pa_reward',
    summary: '5 MP, Pleasure +5, Resist -5',
    resultProse: 'rewarded gently, confused by how comforting obedience felt',
  },
  {
    id: 'prest',
    label: 'Rest & Recover',
    tab: 'care',
    luaGroup: 'soft',
    mpCost: 0,
    staminaCost: -120,
    noAp: true,
    effects: {},
    assetKey: 'dk_pa_rest',
    summary: '0 AP · Full Stamina recovery, clears Dying',
    resultProse: 'allowed uninterrupted rest in the cell to recover strength',
  },
  {
    id: 'pgift',
    label: 'Gift to Officer',
    tab: 'care',
    luaGroup: 'use',
    mpCost: 0,
    staminaCost: 5,
    effects: { corr: [6, 6] },
    req: { mark: ['obey', 1], needsOfficerGift: true },
    assetKey: 'dk_pa_gift',
    summary: 'Obey 1 · Corr +6, Officer Aff +2',
    resultProse: "presented as a living gift, kneeling obediently at the officer's feet",
  },
  {
    id: 'pdress',
    label: 'Dress as Merchandise',
    tab: 'care',
    luaGroup: 'use',
    mpCost: 0,
    staminaCost: 0,
    effects: { shame: [4, 4] },
    req: { facility: 'market' },
    assetKey: 'dk_pa_dress',
    summary: 'Market · Shame +4, Next Sale +20%',
    resultProse: 'dressed up in revealing finery like prized merchandise',
  },
  {
    id: 'pcure',
    label: 'Shrine Purification',
    tab: 'care',
    luaGroup: 'soft',
    mpCost: 20,
    staminaCost: 0,
    effects: {},
    req: { facility: 'shrine', needsCureTarget: true },
    assetKey: 'dk_fac_shrine',
    summary: '20 MP · Shrine · Cures Parasite (Lv2: Curse)',
    resultProse: "purified by the shrine's rite as the infestation or curse burns away",
  },
  {
    id: 'pwork',
    label: 'Brothel Dispatch',
    tab: 'care',
    luaGroup: 'use',
    mpCost: 0,
    staminaCost: 15,
    effects: { pleasure: [5, 5] },
    req: { facility: 'brothel', mark: ['pleasure', 1] },
    assetKey: 'dk_pa_work',
    summary: 'Brothel + Pleas 1 · +15% Ransom MP, Lust +3',
    resultProse: 'dispatched to the Pleasure Quarter and returned spent and well paid for',
  },

  // 2. Interrogate & Train
  {
    id: 'pint',
    label: 'Interrogate',
    tab: 'train',
    luaGroup: 'fear',
    mpCost: 0,
    staminaCost: 5,
    isFearVerb: true,
    effects: { terror: [3, 3] },
    assetKey: 'dk_pa_int_ok',
    summary: 'Chance +1 Intel & Resist -5 (Fail: -3)',
    resultProse: 'pressed under harsh questioning for Guild secrets',
  },
  {
    id: 'pcare',
    label: 'Intimate Caress',
    tab: 'train',
    luaGroup: 'train',
    mpCost: 0,
    staminaCost: 5,
    effects: { pleasure: [8, 12], resist: [-2, -2] },
    assetKey: 'dk_pa_care',
    summary: 'Pleasure +8..12, Resist -2',
    resultProse: 'left trembling, flushed and aching for more than they admit',
  },
  {
    id: 'ptool',
    label: 'Toy Conditioning',
    tab: 'train',
    luaGroup: 'train',
    mpCost: 0,
    staminaCost: 10,
    effects: { pleasure: [10, 16], corr: [4, 4], resist: [-3, -3] },
    req: { facility: 'smithy' },
    assetKey: 'dk_pa_tool',
    summary: 'Smithy · Pleas +10..16, Corr +4, Resist -3',
    resultProse: 'wrung out by dungeon implements, twitching and dazed',
  },
  {
    id: 'pbind',
    label: 'Bind & Neglect',
    tab: 'train',
    luaGroup: 'train',
    mpCost: 0,
    staminaCost: 5,
    effects: { resist: [-6, -6], terror: [4, 4], shame: [3, 3] },
    assetKey: 'dk_pa_bind',
    summary: 'Resist -6, Terror +4, Shame +3',
    resultProse: 'left bound and helpless in the cell while defiance drains away',
  },
  {
    id: 'pdrug',
    label: 'Aphrodisiac Dose',
    tab: 'train',
    luaGroup: 'train',
    mpCost: 5,
    staminaCost: 5,
    effects: { pleasure: [15, 15], resist: [-4, -4] },
    assetKey: 'dk_pa_drug',
    summary: '5 MP · Pleas +15, Resist -4, Next Pact ×1.3',
    resultProse: 'burning with drugged heat, unable to focus on anything else',
  },
  {
    id: 'pmilk',
    label: 'Dairy Milking',
    tab: 'train',
    luaGroup: 'train',
    mpCost: 0,
    staminaCost: 12,
    effects: { pleasure: [8, 8], shame: [6, 6] },
    req: { facility: 'dairy' },
    assetKey: 'dk_pa_milk',
    summary: 'Dairy · Pleas +8, Shame +6, Food +3, +5 MP',
    resultProse: 'hooked up for milking, sore and shamefully relieved',
  },
  {
    id: 'pduo',
    label: 'Officer Duo Session',
    tab: 'train',
    luaGroup: 'train',
    mpCost: 0,
    staminaCost: 10,
    effects: {},
    req: { needsOfficerDuo: true },
    assetKey: 'dk_duo_v',
    summary: 'V/L Stage 2+ · Officer Aff +1 & heavy conditioning',
    resultProse: 'claimed by the officer in a joint conditioning session, shivering',
  },

  // 3. Shame & Fear
  {
    id: 'pwalk',
    label: 'Exposed Walk',
    tab: 'shame',
    luaGroup: 'shame',
    mpCost: 0,
    staminaCost: 5,
    effects: { shame: [10, 15], corr: [4, 4] },
    assetKey: 'dk_pa_walk',
    summary: 'Shame +10..15, Corr +4, Renown -1, Lust +3',
    resultProse: 'paraded exposed through the corridors under leering eyes',
  },
  {
    id: 'pdisplay',
    label: 'Town Square Display',
    tab: 'shame',
    luaGroup: 'shame',
    mpCost: 0,
    staminaCost: 5,
    effects: { shame: [15, 15] },
    req: { oncePerDay: true },
    assetKey: 'dk_pa_display',
    summary: '1/day · Shame +15, App +2, Renown -2, Lust +6',
    resultProse: 'displayed in the town square stocks for the domain to gawk at',
  },
  {
    id: 'ppair',
    label: 'Pair Captives',
    tab: 'shame',
    luaGroup: 'shame',
    mpCost: 0,
    staminaCost: 8,
    effects: { shame: [8, 8], pleasure: [6, 6], resist: [-3, -3] },
    req: { needsPair: true },
    assetKey: 'dk_pa_pair',
    summary: 'Needs 2nd idle captive · Both Shame +8, Pleas +6, Res -3',
    resultProse: 'tangled together with another captive, both humiliated and flushed',
  },
  {
    id: 'ppublic',
    label: 'Barracks Service',
    tab: 'shame',
    luaGroup: 'shame',
    mpCost: 0,
    staminaCost: 15,
    effects: { shame: [12, 12], corr: [6, 6] },
    req: { facility: 'watch', mark: ['shame', 1] },
    assetKey: 'dk_pa_public',
    summary: 'Watch + Shame 1 · Shame +12, Corr +6, Order +2, App +1',
    resultProse: 'used by the watch garrison until barely able to stand',
  },
  {
    id: 'pwhip',
    label: 'Whip Punishment',
    tab: 'shame',
    luaGroup: 'fear',
    mpCost: 0,
    staminaCost: 10,
    isFearVerb: true,
    effects: { resist: [-8, -4], terror: [6, 6] },
    assetKey: 'dk_pa_whip',
    summary: 'Resist -4..-8, Terror +6 (Exhaustion death risk if Stam<10)',
    resultProse: 'welted and sobbing as defiance cracks under the lash',
  },
  {
    id: 'pthreat',
    label: 'Threaten Comrade',
    tab: 'shame',
    luaGroup: 'fear',
    mpCost: 0,
    staminaCost: 0,
    isFearVerb: true,
    effects: { resist: [-4, -4], terror: [8, 8] },
    req: { minPrisoners: 2 },
    assetKey: 'dk_pa_threat',
    summary: '2+ Captives · Resist -4, Terror +8 (0 Stamina)',
    resultProse: 'terrified for a fellow prisoner, trembling on the verge of obeying',
  },
  {
    id: 'ptort',
    label: 'Cell Torture',
    tab: 'shame',
    luaGroup: 'fear',
    mpCost: 0,
    staminaCost: 15,
    isFearVerb: true,
    effects: { terror: [10, 10] },
    assetKey: 'dk_pa_tort',
    summary: 'Resist -(11..20), Terror +10, Fear +3 (25% Injury/Severe->Death)',
    resultProse: 'broken down in the torture rack as fear sinks deep',
  },

  // 4. Dark & Harsh — 10 Dark Pacts
  {
    id: 'pbrand',
    label: 'Iron Brand',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 10,
    effects: { terror: [10, 10], shame: [8, 8], resist: [-6, -6] },
    req: { notFlag: 'branded' },
    assetKey: 'dk_dark_brand',
    summary: '1/captive · Terror +10, Shame +8, Res -6, Brand (+5% Ransom), Fear +2',
    resultProse: "branded with the Lord's sigil, the hiss of scorched skin still echoing",
  },
  {
    id: 'pstarve',
    label: 'Starve Rations',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 20,
    effects: { resist: [-10, -8], terror: [5, 5] },
    assetKey: 'dk_dark_starve',
    summary: 'Resist -8..-10, Terror +5, Food +1',
    resultProse: 'starved and shaking, begging for scraps from the keeper',
  },
  {
    id: 'ptent',
    label: 'Tentacle Pen',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 15,
    effects: { pleasure: [15, 20], shame: [8, 8], corr: [6, 6] },
    req: { facility: 'beastpen' },
    assetKey: 'dk_dark_tent',
    summary: 'Beast Pen · Pleas +15..20, Shame +8, Corr +6, Lust +4',
    resultProse: 'dragged out of the tentacle pen dripping and trembling senseless',
  },
  {
    id: 'pslime',
    label: 'Slime Bath',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 8,
    effects: { pleasure: [10, 12], shame: [10, 10] },
    req: { facility: 'bath' },
    assetKey: 'dk_dark_slime',
    summary: 'Bath · Pleas +10..12, Shame +10, Lust +2, App +1',
    resultProse: 'soaked and slick from the slime vat, twitching from forced climaxes',
  },
  {
    id: 'pcrest',
    label: 'Carve Lewd Crest',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 10,
    staminaCost: 10,
    effects: { pleasure: [12, 12], corr: [10, 10] },
    req: { facility: 'shrine', facilityLv: 2, notFlag: 'crest' },
    assetKey: 'dk_dark_crest',
    summary: '10 MP · Shrine 2 · Pleas +12, Corr +10, Lewd Crest (+20% LewdMart)',
    resultProse: 'marked with a glowing lewd crest low on the belly that pulses with heat',
  },
  {
    id: 'phypno',
    label: 'Hypnotic Brainwash',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 10,
    staminaCost: 5,
    effects: { resist: [-12, -12] },
    req: { facility: 'shrine', facilityLv: 2 },
    assetKey: 'dk_dark_hypno',
    summary: '10 MP · Shrine 2 · Resist -12, 30% +1 Intel (Res 0 -> Broken)',
    resultProse: 'glassy-eyed under deep hypnosis, repeating every command aloud',
  },
  {
    id: 'pcow',
    label: 'Cow Conversion',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 5,
    staminaCost: 12,
    effects: { pleasure: [10, 10], shame: [12, 12] },
    req: { facility: 'dairy', facilityLv: 2, notFlag: 'cow' },
    assetKey: 'dk_dark_cow',
    summary: '5 MP · Dairy 2 · Pleas +10, Shame +12, Food +2, Cow Tag',
    resultProse: 'swollen and leaking after the dairy draught, collared with a cowbell',
  },
  {
    id: 'pconfess',
    label: 'Confession Rack',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 15,
    isFearVerb: true,
    effects: { terror: [12, 12], resist: [-8, -8] },
    req: { facility: 'torture' },
    assetKey: 'dk_dark_confess',
    summary: 'Torture · Terror +12, Resist -8, 40% +1 Intel',
    resultProse: 'strapped to the confession rack, sobbing out buried Guild secrets',
  },
  {
    id: 'prename',
    label: 'Strip Name',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 5,
    effects: { shame: [15, 15], resist: [-10, -10] },
    req: { mark: ['obey', 2], notFlag: 'renamed' },
    assetKey: 'dk_dark_rename',
    summary: 'Obey 2 · Shame +15, Res -10, No Sale Escape Risk',
    resultProse: 'stripped of their former name and assigned a cold cell number',
  },
  {
    id: 'pduel',
    label: 'Forced Arena Duel',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 0,
    staminaCost: 15,
    effects: { terror: [8, 8] },
    req: { facility: 'arena', needsPair: true },
    assetKey: 'dk_dark_duel',
    summary: 'Arena + 2nd Captive · Both Terror +8, +10 MP, Renown +1',
    resultProse: 'forced to fight another captive bare-handed in the arena for wagers',
  },

  // 4. Dark & Harsh — 6 Harsh Death-Risk Pacts
  {
    id: 'pxtrain',
    label: 'All-Night Training',
    tab: 'dark',
    luaGroup: 'train',
    mpCost: 0,
    staminaCost: 35,
    effects: { resist: [-20, -20], pleasure: [10, 10], corr: [5, 5] },
    harsh: {
      baseDie: 0.05,
      en: 'kept awake and trained through the entire night without rest',
    },
    assetKey: 'dk_pa_train',
    summary: 'Stam -35 · Res -20, Pleas +10, Corr +5 (Harsh death risk)',
    resultProse: 'kept awake and trained through the entire night without rest',
  },
  {
    id: 'pxshame',
    label: 'Pillory Exposure',
    tab: 'dark',
    luaGroup: 'shame',
    mpCost: 0,
    staminaCost: 30,
    effects: { resist: [-18, -18], shame: [20, 20] },
    harsh: {
      baseDie: 0.05,
      en: "locked in the square's pillory from dawn to dusk in the cold",
    },
    assetKey: 'dk_pa_show',
    summary: 'Stam -30 · Res -18, Shame +20 (Harsh death risk)',
    resultProse: "locked in the square's pillory from dawn to dusk in the cold",
  },
  {
    id: 'pxfear',
    label: 'Water Torture',
    tab: 'dark',
    luaGroup: 'fear',
    mpCost: 0,
    staminaCost: 35,
    isFearVerb: true,
    effects: { resist: [-25, -25], terror: [15, 15] },
    harsh: {
      baseDie: 0.09,
      en: 'half-drowned again and again until begging for mercy',
    },
    assetKey: 'dk_pa_tort',
    summary: 'Stam -35 · Res -25, Terror +15 (Harsh death risk)',
    resultProse: 'half-drowned again and again until begging for mercy',
  },
  {
    id: 'pxsoft',
    label: 'Drug Withdrawal',
    tab: 'dark',
    luaGroup: 'soft',
    mpCost: 10,
    staminaCost: 25,
    effects: { resist: [-20, -20], corr: [5, 5] },
    harsh: {
      baseDie: 0.06,
      en: "given an addictive draught, then denied it until craving the dungeon's touch",
      noregen: true,
    },
    assetKey: 'dk_pa_drug',
    summary: '10 MP · Stam -25 · Res -20, Corr +5, No Regen (Harsh risk)',
    resultProse: "given an addictive draught, then denied it until craving the dungeon's touch",
  },
  {
    id: 'pxuse',
    label: 'Abyssal Mine',
    tab: 'dark',
    luaGroup: 'use',
    mpCost: 0,
    staminaCost: 45,
    effects: { resist: [-18, -18] },
    harsh: {
      baseDie: 0.07,
      en: 'worked to collapse in the abyssal mine',
      mpGain: 15,
      foodGain: 3,
    },
    assetKey: 'dk_pa_work',
    summary: 'Stam -45 · Res -18, +15 MP, Food +3 (Harsh death risk)',
    resultProse: 'worked to collapse in the abyssal mine',
  },
  {
    id: 'pxdark',
    label: 'Soul Binding Rite',
    tab: 'dark',
    luaGroup: 'dark',
    mpCost: 10,
    staminaCost: 40,
    effects: { resist: [-30, -30], corr: [10, 10], terror: [10, 10] },
    req: { facility: 'shrine' },
    harsh: {
      baseDie: 0.11,
      en: 'has a binding sigil carved into their very soul',
    },
    assetKey: 'dk_dark_crest',
    summary: '10 MP · Shrine · Stam -40 · Res -30, Corr +10, Terror +10 (Harsh risk)',
    resultProse: 'has a binding sigil carved into their very soul',
  },
];

export const PRISON_PACT_MAP: Record<string, PrisonPactDef> = Object.fromEntries(
  PRISON_PACTS.map((p) => [p.id, p])
);

// All CFG.JOBS from dungeon_keeper.lua (base 8 x1.5, town/facility 8, role 3, v1.8.0 5 = 24 + hired/bait parity)
export const PRISON_JOBS: readonly PrisonJobDef[] = [
  {
    key: 'square',
    label: 'Square Stocks',
    facility: null,
    baseSlots: 1,
    location: 'town',
    staminaCost: 5,
    outputs: { fear: 3, renown: -2 },
    prisonerDelta: { shame: 8 },
    aptitude: [
      { stat: 'shame', dir: 1 },
      { stat: 'resist', dir: -1 },
    ],
    desc: 'Fear +3, Renown -2 per settle · Shame +8',
    assetKey: 'dk_job_square',
  },
  {
    key: 'farm',
    label: 'Farmland Labor',
    facility: 'farmland',
    baseSlots: 1,
    location: 'town',
    staminaCost: 8,
    outputs: { food: 3 },
    prisonerDelta: { resist: -2 },
    aptitude: [{ stat: 'stamina', dir: 1 }],
    desc: 'Food +3 per settle · Resist -2',
    assetKey: 'dk_job_farm',
  },
  {
    key: 'bath',
    label: 'Bathhouse Attendant',
    facility: 'bath',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 1],
    staminaCost: 8,
    outputs: { approval: 3 },
    prisonerDelta: { shame: 5, pleasure: 3 },
    aptitude: [
      { stat: 'resist', dir: -1 },
      { stat: 'shame', dir: 1 },
    ],
    desc: 'Approval +3 per settle · Obey 1',
    assetKey: 'dk_job_bath',
  },
  {
    key: 'brothel',
    label: 'Brothel Host',
    facility: 'brothel',
    baseSlots: 2,
    location: 'town',
    reqMark: ['pleasure', 1],
    staminaCost: 10,
    outputs: { mpRansomRatio: 0.15, lust: 3 },
    prisonerDelta: { pleasure: 5, corr: 3 },
    aptitude: [
      { stat: 'pleasure', dir: 1 },
      { stat: 'corr', dir: 1 },
    ],
    desc: '15% Ransom MP, Lust +3 · Pleas 1',
    assetKey: 'dk_job_brothel',
  },
  {
    key: 'dairy',
    label: 'Dairy Milking',
    facility: 'dairy',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 1],
    staminaCost: 12,
    outputs: { food: 5, mp: 8 },
    prisonerDelta: { pleasure: 4, shame: 3 },
    aptitude: [
      { stat: 'pleasure', dir: 1 },
      { stat: 'stamina', dir: 1 },
    ],
    desc: '+8 MP, Food +5 · Obey 1',
    assetKey: 'dk_job_dairy',
  },
  {
    key: 'arena',
    label: 'Arena Gladiator',
    facility: 'arena',
    baseSlots: 1,
    location: 'town',
    reqMark: ['terror', 1],
    staminaCost: 15,
    outputs: { mpRansomRatio: 0.225, renown: 2 },
    prisonerDelta: { terror: 4 },
    aptitude: [
      { stat: 'stamina', dir: 1 },
      { stat: 'terror', dir: -1 },
    ],
    desc: '22.5% Ransom MP, Renown +2 · Terror 1 (death risk)',
    assetKey: 'dk_job_arena',
  },
  {
    key: 'barracks',
    label: 'Barracks Service',
    facility: 'watch',
    baseSlots: 1,
    location: 'town',
    reqMark: ['shame', 1],
    staminaCost: 15,
    outputs: { order: 3 },
    prisonerDelta: { shame: 10, corr: 4 },
    aptitude: [
      { stat: 'shame', dir: 1 },
      { stat: 'resist', dir: -1 },
    ],
    desc: 'Order +3 per settle · Shame 1',
    assetKey: 'dk_job_barracks',
  },
  {
    key: 'manor',
    label: 'Manor Valet',
    facility: 'manor',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 2],
    staminaCost: 5,
    outputs: { affVesper: 1 },
    prisonerDelta: { corr: 3 },
    aptitude: [
      { stat: 'resist', dir: -1 },
      { stat: 'corr', dir: 1 },
    ],
    desc: 'Vesper Aff +1 per settle · Obey 2',
    assetKey: 'dk_job_manor',
  },
  {
    key: 'toilet',
    label: 'Latrine Servitor',
    facility: 'housing',
    baseSlots: 1,
    location: 'town',
    reqMark: ['shame', 2],
    staminaCost: 5,
    outputs: { approval: 2 },
    prisonerDelta: { shame: 12, corr: 5 },
    aptitude: [
      { stat: 'shame', dir: 1 },
      { stat: 'resist', dir: -1 },
    ],
    desc: 'Approval +2, Housing +1, Plague risk down · Shame 2',
    assetKey: 'dk_fac_housing',
  },
  {
    key: 'tavern',
    label: 'Tavern Server',
    facility: 'inn',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 1],
    staminaCost: 8,
    outputs: { mpRansomRatio: 0.1 },
    prisonerDelta: { pleasure: 4, shame: 4 },
    aptitude: [
      { stat: 'pleasure', dir: 1 },
      { stat: 'resist', dir: -1 },
    ],
    desc: '10% Ransom MP, 30% +1 Intel · Obey 1',
    assetKey: 'dk_job_tavern',
  },
  {
    key: 'tasting',
    label: 'Tasting Table',
    facility: 'inn',
    facilityLv: 2,
    baseSlots: 1,
    location: 'town',
    reqMark: ['pleasure', 2],
    staminaCost: 8,
    outputs: { approval: 4, lust: 3 },
    prisonerDelta: { shame: 8, pleasure: 6 },
    aptitude: [
      { stat: 'shame', dir: 1 },
      { stat: 'pleasure', dir: 1 },
    ],
    desc: 'Approval +4, Lust +3 · Inn Lv2 + Pleas 2',
    assetKey: 'dk_fac_inn',
  },
  {
    key: 'bellows',
    label: 'Smithy Bellows',
    facility: 'smithy',
    baseSlots: 1,
    location: 'town',
    staminaCost: 10,
    outputs: {},
    prisonerDelta: { terror: 3 },
    aptitude: [{ stat: 'stamina', dir: 1 }],
    desc: 'Trap Upgrade Cost -5%/worker (max -15%) · 2% accident',
    assetKey: 'dk_fac_smithy',
  },
  {
    key: 'trapbench',
    label: 'Trap Test Subject',
    facility: 'workshop',
    baseSlots: 1,
    location: 'town',
    reqMark: ['terror', 1],
    staminaCost: 15,
    outputs: {},
    prisonerDelta: { terror: 6, pleasure: 4 },
    aptitude: [
      { stat: 'stamina', dir: 1 },
      { stat: 'terror', dir: -1 },
    ],
    desc: 'New Trap +1 Grade chance +15% · Terror 1 · 3% accident',
    assetKey: 'dk_fac_workshop',
  },
  {
    key: 'decoy',
    label: 'Decoy Informant',
    facility: 'spy',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 2],
    staminaCost: 5,
    outputs: {},
    prisonerDelta: {},
    aptitude: [
      { stat: 'resist', dir: -1 },
      { stat: 'shame', dir: 1 },
    ],
    desc: 'Exposes next raid weakness · Obey 2 · 10% betrayal',
    assetKey: 'dk_fac_spy',
  },
  {
    key: 'altar',
    label: 'Altar Attendant',
    facility: 'shrine',
    baseSlots: 1,
    location: 'town',
    reqMark: ['terror', 2],
    staminaCost: 8,
    outputs: { fear: 4, lust: 2 },
    prisonerDelta: { terror: 8 },
    aptitude: [
      { stat: 'corr', dir: 1 },
      { stat: 'terror', dir: 1 },
    ],
    desc: 'Fear +4, Lust +2 · Terror 2 · 3% sacrifice risk',
    assetKey: 'dk_job_altar',
  },
  {
    key: 'doll',
    label: 'Training Doll',
    facility: 'trainhall',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 1],
    staminaCost: 8,
    outputs: {},
    prisonerDelta: { shame: 6, resist: -3 },
    aptitude: [
      { stat: 'pleasure', dir: 1 },
      { stat: 'resist', dir: -1 },
    ],
    desc: 'Other captives training +15% · Obey 1',
    assetKey: 'dk_fac_trainhall',
  },
  {
    key: 'bait',
    label: 'Chained Bait',
    facility: null,
    baseSlots: 7,
    location: 'floor',
    staminaCost: 0,
    outputs: {},
    prisonerDelta: { terror: 3, shame: 4 },
    aptitude: [
      { stat: 'shame', dir: 1 },
      { stat: 'terror', dir: 1 },
    ],
    desc: 'Floor role · Heroes -1 roll on floor (25% rescue risk)',
    assetKey: 'dk_job_bait',
  },
  {
    key: 'lure',
    label: 'Corridor Lure',
    facility: null,
    baseSlots: 7,
    location: 'floor',
    reqMark: ['pleasure', 2],
    staminaCost: 0,
    outputs: {},
    prisonerDelta: { pleasure: 4, corr: 3 },
    aptitude: [
      { stat: 'pleasure', dir: 1 },
      { stat: 'corr', dir: 1 },
    ],
    desc: 'Floor role · Makes floor lewd, Lewd heroes -1 (Pleas 2)',
    assetKey: 'dk_job_lure',
  },
  {
    key: 'trusty',
    label: 'Cell Boss (Trusty)',
    facility: null,
    baseSlots: 1,
    location: 'prison',
    reqMark: ['obey', 2],
    staminaCost: 5,
    outputs: {},
    prisonerDelta: { corr: 2 },
    aptitude: [
      { stat: 'resist', dir: 1 },
      { stat: 'terror', dir: -1 },
    ],
    desc: 'Other captives Resist -1/settle, halves jailbreak · Obey 2',
    assetKey: 'dk_job_trusty',
  },
  {
    key: 'showcase',
    label: 'Auction Showcase',
    facility: 'market',
    baseSlots: 1,
    location: 'town',
    staminaCost: 8,
    outputs: { mp: 8 },
    prisonerDelta: { shame: 5 },
    aptitude: [
      { stat: 'shame', dir: 1 },
      { stat: 'stamina', dir: 1 },
    ],
    desc: '+8 MP & private sale bids · Market',
    assetKey: 'dk_pa_auction',
  },
  {
    key: 'tortdemo',
    label: 'Torture Demo',
    facility: 'torture',
    baseSlots: 1,
    location: 'town',
    staminaCost: 12,
    outputs: { fear: 2 },
    prisonerDelta: { terror: 6 },
    aptitude: [{ stat: 'terror', dir: 1 }],
    desc: 'Fear +2, other captives Resist -1 · 3% accident',
    assetKey: 'dk_pa_tort',
  },
  {
    key: 'breeder',
    label: 'Beast Pen Breeder',
    facility: 'beastpen',
    baseSlots: 1,
    location: 'town',
    reqMark: ['obey', 1],
    staminaCost: 12,
    outputs: { mp: 6 },
    prisonerDelta: { corr: 4, pleasure: 4 },
    aptitude: [
      { stat: 'stamina', dir: 1 },
      { stat: 'pleasure', dir: 1 },
    ],
    desc: '+6 MP · Obey 1 · Monster breeding & parasite risk',
    assetKey: 'dk_dark_tent',
  },
  {
    key: 'model',
    label: 'Lewd Ware Model',
    facility: 'lewdmart',
    baseSlots: 1,
    location: 'town',
    reqMark: ['pleasure', 1],
    staminaCost: 8,
    outputs: { mpRansomRatio: 0.08, lust: 1 },
    prisonerDelta: { shame: 4, pleasure: 3 },
    aptitude: [
      { stat: 'pleasure', dir: 1 },
      { stat: 'shame', dir: 1 },
    ],
    desc: '8% Ransom MP, Lust +1 · LewdMart + Pleas 1',
    assetKey: 'dk_fac_lewdmart',
  },
  {
    key: 'gibbetx',
    label: 'Gibbet Warning',
    facility: 'gibbet',
    baseSlots: 1,
    location: 'town',
    staminaCost: 10,
    outputs: { fear: 3, order: 1 },
    prisonerDelta: { terror: 8 },
    aptitude: [{ stat: 'terror', dir: 1 }],
    desc: 'Fear +3, Order +1 · Gibbet · 5% accident',
    assetKey: 'dk_fac_gibbet',
  },
];

export const PRISON_JOB_MAP: Record<string, PrisonJobDef> = Object.fromEntries(
  PRISON_JOBS.map((j) => [j.key, j])
);

export const PRISON_CONVERSIONS: readonly PrisonConversionDef[] = [
  {
    key: 'guard',
    label: 'Floor Guard',
    maxCapLabel: 'Cap 3',
    reqSummary: 'Resist <= 10% + Free trapped floor',
    effectSummary: 'Deploys to a dungeon floor (+1 DC)',
    assetKey: 'dk_pr_guard',
  },
  {
    key: 'servant',
    label: 'Dungeon Servant',
    maxCapLabel: 'Cap 3',
    reqSummary: 'Corruption >= 70',
    effectSummary: 'Passive MP by grade (+4..+30 MP) + Lust +2/settle',
    assetKey: 'dk_pr_servant',
  },
  {
    key: 'pet',
    label: 'Officer Pet',
    maxCapLabel: 'Cap 2',
    reqSummary: 'Pleasure Mark 3 + Obey Mark 2',
    effectSummary: 'Lust +3 & Owner (Vesper/Lilim) Aff +1/settle',
    assetKey: 'dk_pr_pet',
  },
  {
    key: 'dancer',
    label: 'Exclusive Dancer',
    maxCapLabel: 'Cap 2',
    reqSummary: 'Shame Mark 3 + Pleasure Mark 2 + Brothel',
    effectSummary: 'Approval +1 & +10% of last tax/settle',
    assetKey: 'dk_pr_dancer',
  },
  {
    key: 'hired',
    label: 'Hired Staff',
    maxCapLabel: 'Cap 3 + Manor',
    reqSummary: 'Obey Mark 3 or Corruption >= 80 + Open Job',
    effectSummary: 'Works any unlocked job at ×2 yield (-5 MP salary)',
    assetKey: 'dk_pr_hire',
  },
];

/**
 * Resolves a Prison scene/action/job/conversion sprite from assetManifest,
 * preferring `_m` variant for male captives with clean fallback to default.
 */
export function resolvePrisonAsset(
  baseKey: string,
  gender: 'female' | 'male'
): string | undefined {
  if (gender === 'male') {
    const male = resolveSceneAsset(`${baseKey}_m`);
    if (male) return male;
  }
  return resolveSceneAsset(baseKey);
}

export function resolvePactAsset(
  pactId: string,
  gender: 'female' | 'male',
  opts?: { duoOfficer?: 'V' | 'L'; interroSuccess?: boolean }
): string | undefined {
  if (pactId === 'pduo') {
    const key = opts?.duoOfficer === 'L' ? 'dk_duo_l' : 'dk_duo_v';
    return resolvePrisonAsset(key, gender);
  }
  if (pactId === 'pint') {
    const key = opts?.interroSuccess === false ? 'dk_pa_int_fail' : 'dk_pa_int_ok';
    return resolvePrisonAsset(key, gender);
  }
  const pact = PRISON_PACT_MAP[pactId];
  if (!pact) return undefined;
  return resolvePrisonAsset(pact.assetKey, gender);
}

export function resolveJobAsset(
  jobKey: string,
  gender: 'female' | 'male'
): string | undefined {
  const job = PRISON_JOB_MAP[jobKey];
  if (!job) return undefined;
  return resolvePrisonAsset(job.assetKey, gender);
}

export function resolveMarkAsset(
  mark: keyof PrisonerMarks,
  gender: 'female' | 'male'
): string | undefined {
  return resolvePrisonAsset(`dk_mark_${mark}`, gender);
}
