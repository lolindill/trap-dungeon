import type { OfficerKey, TownPolicy } from '../types/game';

export interface TownLevelDef {
  lv: number;
  name: string;
  upgradeCost: number;
  reqFacLevels: number;
  reqPop: number;
  popCap: number;
  baseTax: number;
  baseIncome: number;
  upkeep: number;
  artKey: string;
}

export const TOWN_LEVELS: readonly TownLevelDef[] = [
  {
    lv: 1,
    name: 'Outpost',
    upgradeCost: 0,
    reqFacLevels: 0,
    reqPop: 0,
    popCap: 200,
    baseTax: 25,
    baseIncome: 30,
    upkeep: 0,
    artKey: 'dk_town_1',
  },
  {
    lv: 2,
    name: 'Village',
    upgradeCost: 200,
    reqFacLevels: 2,
    reqPop: 120,
    popCap: 450,
    baseTax: 50,
    baseIncome: 60,
    upkeep: 0,
    artKey: 'dk_town_2',
  },
  {
    lv: 3,
    name: 'Town',
    upgradeCost: 450,
    reqFacLevels: 5,
    reqPop: 300,
    popCap: 800,
    baseTax: 85,
    baseIncome: 100,
    upkeep: 0,
    artKey: 'dk_town_3',
  },
  {
    lv: 4,
    name: 'Walled Town',
    upgradeCost: 700,
    reqFacLevels: 9,
    reqPop: 600,
    popCap: 1300,
    baseTax: 130,
    baseIncome: 150,
    upkeep: 0,
    artKey: 'dk_town_4',
  },
  {
    lv: 5,
    name: 'Domain Capital',
    upgradeCost: 1100,
    reqFacLevels: 14,
    reqPop: 1000,
    popCap: 2000,
    baseTax: 180,
    baseIncome: 220,
    upkeep: 0,
    artKey: 'dk_town_5',
  },
  {
    lv: 6,
    name: 'Royal Seat',
    upgradeCost: 1600,
    reqFacLevels: 20,
    reqPop: 1600,
    popCap: 2800,
    baseTax: 230,
    baseIncome: 280,
    upkeep: 40,
    artKey: 'dk_town_6',
  },
  {
    lv: 7,
    name: 'Demon Capital',
    upgradeCost: 2600,
    reqFacLevels: 26,
    reqPop: 2400,
    popCap: 3600,
    baseTax: 290,
    baseIncome: 350,
    upkeep: 80,
    artKey: 'dk_town_7',
  },
] as const;

export const TOWN_POLICY_MODS: Record<
  TownPolicy,
  { label: string; taxMult: number; orderDelta: number; approvalDelta: number }
> = {
  low: { label: 'Low Tax', taxMult: 0.7, orderDelta: 3, approvalDelta: 4 },
  normal: { label: 'Standard', taxMult: 1.0, orderDelta: 0, approvalDelta: 0 },
  high: { label: 'Heavy Tax', taxMult: 1.4, orderDelta: -4, approvalDelta: -5 },
};

export type FacilityCategory = 'economy' | 'security' | 'dark';

export interface FacilityDef {
  key: string;
  name: string;
  category: FacilityCategory;
  costs: readonly [number, number, number];
  prereq?: { key: string; lv: number };
  summary: string;
  artKey: string;
}

export const FACILITIES: readonly FacilityDef[] = [
  {
    key: 'inn',
    name: 'Tavern & Inn',
    category: 'economy',
    costs: [60, 150, 300],
    summary: 'Tax +15%/lv, Pop cap +10%/lv, Lv2: 30% prep intel +1',
    artKey: 'dk_fac_inn',
  },
  {
    key: 'market',
    name: 'Slave Market',
    category: 'economy',
    costs: [100, 200, 350],
    summary: 'Ransom +5%/lv, Sale cut risk -5%p/lv, unlocks Dress & Auction',
    artKey: 'dk_fac_market',
  },
  {
    key: 'brothel',
    name: 'Pleasure Quarter',
    category: 'dark',
    costs: [100, 220, 400],
    summary: 'Tax +20%/lv, Approval +1/lv, Lust +2/lv, Festival Approval +6',
    artKey: 'dk_fac_brothel',
  },
  {
    key: 'smithy',
    name: 'Smithy',
    category: 'security',
    costs: [120, 250, 400],
    summary: 'Trap install/upgrade -5%/lv, Crit dmg -10%p/lv, unlocks Tool',
    artKey: 'dk_fac_smithy',
  },
  {
    key: 'spy',
    name: 'Spy Guild',
    category: 'security',
    costs: [80, 180, 320],
    summary: 'Interrogation +15%p/lv, Lv2: 20% prep intel +1',
    artKey: 'dk_fac_spy',
  },
  {
    key: 'shrine',
    name: 'Dark Shrine',
    category: 'dark',
    costs: [100, 220, 380],
    summary: 'Fear +2/lv, Approval -1/lv, Free Punish, Lv3 Exec Fear x1.5',
    artKey: 'dk_fac_shrine',
  },
  {
    key: 'manor',
    name: "Lord's Manor",
    category: 'economy',
    costs: [150, 300, 550],
    summary: 'Officer Aff x(1+0.3/lv), Lv2 +1 AP path, Lv3 Order +3, Hired +1/lv',
    artKey: 'dk_fac_manor',
  },
  {
    key: 'annex',
    name: 'Prison Annex',
    category: 'dark',
    costs: [80, 160, 280],
    summary: 'Prison capacity +2/lv',
    artKey: 'dk_fac_annex',
  },
  {
    key: 'housing',
    name: 'Housing',
    category: 'economy',
    costs: [80, 180, 320],
    summary: 'Housing +2/lv per settle, Pop cap +5%/lv',
    artKey: 'dk_fac_housing',
  },
  {
    key: 'farmland',
    name: 'Farmland',
    category: 'economy',
    costs: [60, 140, 260],
    summary: 'Food +3/lv per settle, unlocks Farm job slots',
    artKey: 'dk_fac_farmland',
  },
  {
    key: 'bath',
    name: 'Public Bath',
    category: 'economy',
    costs: [90, 200, 360],
    summary: 'Approval +2/lv, V/L Aff +1/lv, unlocks Slime & Bath job',
    artKey: 'dk_fac_bath',
  },
  {
    key: 'watch',
    name: 'Watchtower',
    category: 'security',
    costs: [70, 160, 300],
    summary: 'Order +2/lv, Breach dmg -10%/lv, Guard cap +2/lv, Lv3 Core +10%',
    artKey: 'dk_fac_watch',
  },
  {
    key: 'trade',
    name: 'Trading Post',
    category: 'economy',
    costs: [100, 220, 380],
    summary: 'Tax +10 MP/lv, Renown +1/lv, Eleonora Aff +1/lv',
    artKey: 'dk_fac_trade',
  },
  {
    key: 'workshop',
    name: 'Arcane Workshop',
    category: 'security',
    costs: [150, 300, 500],
    summary: 'Fix cost -15%, Crit save 25%/lv, Lv3 All floors DC +1',
    artKey: 'dk_fac_workshop',
  },
  {
    key: 'trainhall',
    name: 'Training Hall',
    category: 'dark',
    costs: [120, 250, 420],
    summary: 'Prison act +20%/lv, Mark threshold -5/lv, Guard DC +1',
    artKey: 'dk_fac_trainhall',
  },
  {
    key: 'dairy',
    name: 'Dairy',
    category: 'economy',
    costs: [100, 220, 380],
    summary: 'Food +1/lv per settle, unlocks Milk & Cow jobs',
    artKey: 'dk_fac_dairy',
  },
  {
    key: 'arena',
    name: 'Arena',
    category: 'security',
    costs: [120, 260, 450],
    summary: 'Renown +2/lv, Fear +1/lv, Lv2 25% hero injured, unlocks Duel',
    artKey: 'dk_fac_arena',
  },
  {
    key: 'beastpen',
    name: 'Beast Pen',
    category: 'dark',
    costs: [120, 260, 420],
    prereq: { key: 'dairy', lv: 1 },
    summary: 'Lust +2/lv, Monster Pen cap +2/lv, spawns Monster on upgrade',
    artKey: 'dk_fac_beastpen',
  },
  {
    key: 'torture',
    name: 'Torture Chamber',
    category: 'dark',
    costs: [100, 220, 380],
    prereq: { key: 'trainhall', lv: 1 },
    summary: 'Interro +10%p/lv, Fear resist drop +25%/lv, Fear +2/lv',
    artKey: 'dk_fac_trainhall',
  },
  {
    key: 'gibbet',
    name: 'Gibbet',
    category: 'security',
    costs: [80, 180, 300],
    prereq: { key: 'watch', lv: 1 },
    summary: 'Exec/Sacrifice +3 Order & +2 Fear, Approval -1/lv',
    artKey: 'dk_fac_gibbet',
  },
  {
    key: 'pens',
    name: 'Slave Pens',
    category: 'dark',
    costs: [90, 200, 340],
    prereq: { key: 'annex', lv: 1 },
    summary: 'Prison capacity +2/lv',
    artKey: 'dk_fac_pens',
  },
  {
    key: 'grail',
    name: 'Blood Grail',
    category: 'dark',
    costs: [150, 300, 500],
    prereq: { key: 'shrine', lv: 2 },
    summary: 'Blood Rite MP x1.5, +1 first-room DC bonus',
    artKey: 'dk_fac_grail',
  },
  {
    key: 'lewdmart',
    name: 'Lewd Market',
    category: 'dark',
    costs: [140, 280, 450],
    prereq: { key: 'market', lv: 2 },
    summary: 'Cow/Crest ransom +20%, Auction fee 0%, Renown +1',
    artKey: 'dk_fac_lewdmart',
  },
  {
    key: 'reform',
    name: 'Reformatory',
    category: 'dark',
    costs: [90, 200, 360],
    summary: 'Passive captive resist -3/-5/-8 per settle',
    artKey: 'dk_fac_annex',
  },
  {
    key: 'spa',
    name: 'Regen Spa',
    category: 'economy',
    costs: [200, 350, 550],
    summary: 'Prison stamina +5/+10/+20, Lv2 50% heal injured, Lv3 heal mobs',
    artKey: 'dk_fac_bath',
  },
] as const;

export const FACILITY_MAP: Record<string, FacilityDef> = Object.fromEntries(
  FACILITIES.map((f) => [f.key, f])
);

export interface TownActionDef {
  key: string;
  label: string;
  mpCost: number;
  foodCost?: number;
  needFac?: string;
  summary: string;
  artKey: string;
  effects: {
    mp?: number;
    approval?: number;
    approvalBrothelBonus?: number;
    order?: number;
    fear?: number;
    lust?: number;
    renown?: number;
    food?: number;
    housing?: number;
    guard?: number;
    taxNext?: number;
  };
}

export const TOWN_ACTIONS: readonly TownActionDef[] = [
  {
    key: 'petition',
    label: 'Hear Petitions',
    mpCost: 0,
    summary: '+6 Approval',
    artKey: 'dk_act_petition',
    effects: { approval: 6 },
  },
  {
    key: 'festival',
    label: 'Domain Festival',
    mpCost: 10,
    foodCost: 5,
    summary: '+8 Lust, +4 App (+6 w/ Brothel), +3 Renown, -5 Food',
    artKey: 'dk_act_festival',
    effects: { lust: 8, approval: 4, approvalBrothelBonus: 2, renown: 3, food: -5 },
  },
  {
    key: 'punish',
    label: 'Public Punishment',
    mpCost: 10,
    summary: '+8 Fear, +4 Order, -4 Approval (Free w/ Shrine)',
    artKey: 'dk_act_punish',
    effects: { fear: 8, order: 4, approval: -4 },
  },
  {
    key: 'brothel_visit',
    label: 'Brothel Inspection',
    mpCost: 0,
    needFac: 'brothel',
    summary: '+8 MP, +6 Lust, +2 Approval',
    artKey: 'dk_act_brothel',
    effects: { mp: 8, lust: 6, approval: 2 },
  },
  {
    key: 'patrol',
    label: 'Guard Patrol',
    mpCost: 0,
    summary: '+6 Order, -1 Approval',
    artKey: 'dk_act_patrol',
    effects: { order: 6, approval: -1 },
  },
  {
    key: 'garrison',
    label: 'Recruit Garrison',
    mpCost: 40,
    needFac: 'watch',
    summary: '+1 Town Guard (requires Watchtower)',
    artKey: 'dk_act_garrison',
    effects: { guard: 1 },
  },
  {
    key: 'house',
    label: 'Build Quarters',
    mpCost: 40,
    summary: '+12 Housing',
    artKey: 'dk_act_house',
    effects: { housing: 12 },
  },
  {
    key: 'granary',
    label: 'Stock Granary',
    mpCost: 30,
    summary: '+15 Food',
    artKey: 'dk_act_patrol',
    effects: { food: 15 },
  },
  {
    key: 'trade',
    label: 'Caravan Trade',
    mpCost: 0,
    foodCost: 10,
    summary: '-10 Food, +20 MP, +2 Renown',
    artKey: 'dk_act_trade',
    effects: { mp: 20, renown: 2, food: -10 },
  },
  {
    key: 'tax_relief',
    label: 'Tax Relief Decree',
    mpCost: 0,
    summary: '+8 Approval, +1 Renown, Next Tax -50%',
    artKey: 'dk_act_tax_relief',
    effects: { approval: 8, renown: 1, taxNext: -0.5 },
  },
] as const;

export interface ExploreLocationDef {
  id: string;
  label: string;
  facilityKey?: string;
  requiresDebt?: boolean;
}

/**
 * 9 canonical town explore locations (square + 8 core facilities) plus
 * Goldreich Branch Office (`office`) when debt contract is active so all 20 CFG.EVENTS are reachable.
 */
export const EXPLORE_LOCATIONS: readonly ExploreLocationDef[] = [
  { id: 'square', label: 'Town Square' },
  { id: 'inn', label: 'Tavern & Inn', facilityKey: 'inn' },
  { id: 'market', label: 'Slave Market', facilityKey: 'market' },
  { id: 'brothel', label: 'Pleasure Quarter', facilityKey: 'brothel' },
  { id: 'smithy', label: 'Smithy', facilityKey: 'smithy' },
  { id: 'spy', label: 'Spy Guild', facilityKey: 'spy' },
  { id: 'shrine', label: 'Dark Shrine', facilityKey: 'shrine' },
  { id: 'manor', label: "Lord's Manor", facilityKey: 'manor' },
  { id: 'annex', label: 'Prison Annex', facilityKey: 'annex' },
  { id: 'office', label: 'Goldreich Office', requiresDebt: true },
] as const;

export interface ExploreEffectSpec {
  mp?: number;
  fear?: number;
  lust?: number;
  intel?: number;
  famePt?: number;
  order?: number;
  approval?: number;
  pop?: number;
  taxNext?: number;
  patience?: number;
  debtCut?: number;
  affV?: number;
  affL?: number;
  affE?: number;
  prisCorr?: number;
  prisResist?: number;
  sellBestMult?: number;
  chance?: {
    p: number;
    success: Omit<ExploreEffectSpec, 'chance'>;
    fail: Omit<ExploreEffectSpec, 'chance'>;
  };
}

export interface ExploreEventChoice {
  label: string;
  cost?: number;
  requiresPrisoners?: number;
  eff: ExploreEffectSpec;
  outcomeText: string;
}

export interface ExploreEventDef {
  id: string;
  loc: string;
  title: string;
  prompt: string;
  artKey: string;
  minTownLv?: number;
  minPrisoners?: number;
  minServants?: number;
  requiresDebt?: boolean;
  weight: number;
  choices: readonly [ExploreEventChoice, ExploreEventChoice];
}

export const EXPLORE_EVENTS: readonly ExploreEventDef[] = [
  {
    id: 'sq_peddler',
    loc: 'square',
    title: 'Shady Peddler',
    prompt: 'A grinning hooded peddler spreads suspicious trinkets on a square stall.',
    artKey: 'dk_ex_sq_peddler',
    weight: 1,
    choices: [
      {
        label: 'Haggle Hard',
        eff: { chance: { p: 0.5, success: { mp: 20 }, fail: {} } },
        outcomeText: 'haggled with the shady peddler in the town square',
      },
      {
        label: 'Buy Road Rumors (8 MP)',
        cost: 8,
        eff: { intel: 1 },
        outcomeText: 'bought Guild scouting rumors from the peddler',
      },
    ],
  },
  {
    id: 'sq_petition',
    loc: 'square',
    title: 'Citizen Petition',
    prompt: 'Townsfolk gather by the fountain begging for well and road repairs.',
    artKey: 'dk_ex_sq_petition',
    weight: 1,
    choices: [
      {
        label: 'Grant Petition',
        eff: { order: 4, approval: 6 },
        outcomeText: 'granted the villagers’ infrastructure petition',
      },
      {
        label: 'Levy Repair Tax',
        eff: { mp: 12, order: -4, approval: -5 },
        outcomeText: 'squeezed the petitioners for an emergency repair levy',
      },
    ],
  },
  {
    id: 'sq_festival',
    loc: 'square',
    title: 'Impromptu Street Festival',
    prompt: 'Merchants propose turning tonight into a wild lantern festival.',
    artKey: 'dk_ex_sq_festival',
    minTownLv: 2,
    weight: 1,
    choices: [
      {
        label: 'Sponsor Festival (20 MP)',
        cost: 20,
        eff: { order: 6, lust: 8, approval: 6, taxNext: 0.3 },
        outcomeText: 'threw a debauched street festival in Lostbell',
      },
      {
        label: 'Save for Later',
        eff: { mp: 5 },
        outcomeText: 'kept the stalls open for normal trade instead',
      },
    ],
  },
  {
    id: 'inn_drunk',
    loc: 'inn',
    title: 'Drunken Adventurer',
    prompt: 'A loose-tongued Guild scout is bragging loudly over spiced ale.',
    artKey: 'dk_ex_inn_drunk',
    weight: 1,
    choices: [
      {
        label: 'Buy Strong Ale (6 MP)',
        cost: 6,
        eff: { intel: 1 },
        outcomeText: 'plied the drunk adventurer for Guild raid intel',
      },
      {
        label: 'Eavesdrop Quietly',
        eff: { chance: { p: 0.5, success: { intel: 1 }, fail: {} } },
        outcomeText: 'eavesdropped on the drunken table at the inn',
      },
    ],
  },
  {
    id: 'inn_brawl',
    loc: 'inn',
    title: 'Tavern Brawl',
    prompt: 'Chairs splinter across the common room as mercenaries trade blows.',
    artKey: 'dk_ex_inn_brawl',
    weight: 1,
    choices: [
      {
        label: 'Break Up Brawl',
        eff: { order: 6, approval: 2, affL: 2 },
        outcomeText: 'broke up the tavern brawl alongside Lilim',
      },
      {
        label: 'Place Wagers',
        eff: { chance: { p: 0.5, success: { mp: 25 }, fail: { mp: -5 } } },
        outcomeText: 'placed backroom wagers on the tavern brawl',
      },
    ],
  },
  {
    id: 'mkt_bidder',
    loc: 'market',
    title: 'High-Roller Collector',
    prompt: 'A veiled noble collector demands a private look at your prize captives.',
    artKey: 'dk_ex_mkt_bidder',
    minPrisoners: 1,
    weight: 1,
    choices: [
      {
        label: 'Auction Top Captive (1.25x)',
        eff: { sellBestMult: 1.25 },
        outcomeText: 'auctioned the highest-value captive to a noble collector',
      },
      {
        label: 'Charge Viewing Fee',
        eff: { mp: 6 },
        outcomeText: 'collected a private viewing fee from the collector',
      },
    ],
  },
  {
    id: 'mkt_broker',
    loc: 'market',
    title: 'Slave Broker Deal',
    prompt: 'An underworld broker offers either brokerage coin or custom shackles.',
    artKey: 'dk_ex_mkt_broker',
    weight: 1,
    choices: [
      {
        label: 'Collect Broker Fee',
        eff: { mp: 12 },
        outcomeText: 'pocketed a brokerage cut at the slave market',
      },
      {
        label: 'Buy Restraints (10 MP)',
        cost: 10,
        requiresPrisoners: 1,
        eff: { prisResist: -10 },
        outcomeText: 'purchased reinforced restraints for the cells',
      },
    ],
  },
  {
    id: 'bro_vip',
    loc: 'brothel',
    title: 'VIP Patron',
    prompt: 'A wealthy merchant prince requests discreet entertainment from a turned servant.',
    artKey: 'dk_ex_bro_vip',
    minServants: 1,
    weight: 1,
    choices: [
      {
        label: 'Send Turned Servant',
        eff: { mp: 10, lust: 3 },
        outcomeText: 'dispatched a turned servant to attend the VIP patron',
      },
      {
        label: 'Decline Politely',
        eff: { order: 4, affV: 2 },
        outcomeText: 'turned the VIP away with Vesper’s approval',
      },
    ],
  },
  {
    id: 'bro_show',
    loc: 'brothel',
    title: 'Midnight Stage Show',
    prompt: 'The quarter’s dancers pitch a scandalous new midnight showcase.',
    artKey: 'dk_ex_bro_show',
    weight: 1,
    choices: [
      {
        label: 'Sponsor Show (10 MP)',
        cost: 10,
        eff: { lust: 15, order: 4 },
        outcomeText: 'sponsored a decadent midnight stage show',
      },
      {
        label: 'Raise Cover Charge',
        eff: { mp: 10, order: -2, approval: -3 },
        outcomeText: 'hiked the pleasure quarter’s entrance fee',
      },
    ],
  },
  {
    id: 'smi_proto',
    loc: 'smithy',
    title: 'Prototype Trap Part',
    prompt: 'The smith offers to field-test an experimental spring mechanism.',
    artKey: 'dk_ex_smi_proto',
    weight: 1,
    choices: [
      {
        label: 'Run Field Test',
        eff: { chance: { p: 0.5, success: { mp: 20 }, fail: { mp: -5 } } },
        outcomeText: 'field-tested an experimental trap assembly',
      },
      {
        label: 'Auction Scrap Metal',
        eff: { mp: 10 },
        outcomeText: 'sold excess smithy scrap for mana crystals',
      },
    ],
  },
  {
    id: 'smi_order',
    loc: 'smithy',
    title: 'Mercenary Arms Order',
    prompt: 'A passing mercenary band wants to buy bulk steel from your forge.',
    artKey: 'dk_ex_smi_order',
    weight: 1,
    choices: [
      {
        label: 'Accept Contract',
        eff: { mp: 12, order: -2, approval: -2 },
        outcomeText: 'armed a mercenary company for coin',
      },
      {
        label: 'Refuse Weapons Sale',
        eff: { order: 4 },
        outcomeText: 'refused to arm outside mercenaries inside town limits',
      },
    ],
  },
  {
    id: 'spy_report',
    loc: 'spy',
    title: 'Informant Briefing',
    prompt: 'An agent slips in from the capital carrying sealed Guild dispatches.',
    artKey: 'dk_ex_spy_report',
    weight: 1,
    choices: [
      {
        label: 'Debrief Agent',
        eff: { chance: { p: 0.6, success: { intel: 1 }, fail: { mp: 3 } } },
        outcomeText: 'debriefed a returning spy from the Adventurer Guild',
      },
      {
        label: 'Dig Up Goldreich Dirt',
        eff: { patience: 6, affE: -2 },
        outcomeText: 'gathered quiet leverage on House Goldreich’s ledger',
      },
    ],
  },
  {
    id: 'spy_double',
    loc: 'spy',
    title: 'Captured Double Agent',
    prompt: 'Your watch caught a Guild infiltrator snooping near the dungeon gate.',
    artKey: 'dk_ex_spy_double',
    weight: 1,
    choices: [
      {
        label: 'Bribe & Turn (12 MP)',
        cost: 12,
        eff: { intel: 1 },
        outcomeText: 'bought and turned a Guild infiltrator',
      },
      {
        label: 'Public Execution',
        eff: { fear: 8, famePt: 1, approval: -2 },
        outcomeText: 'made a public example of the Guild spy at the gate',
      },
    ],
  },
  {
    id: 'shr_tithe',
    loc: 'shrine',
    title: 'Cultist Tithe',
    prompt: 'Masked devotees kneel before the obsidian altar bearing tribute.',
    artKey: 'dk_ex_shr_tithe',
    weight: 1,
    choices: [
      {
        label: 'Accept Tribute',
        eff: { mp: 8, fear: 3 },
        outcomeText: 'accepted the shrine cultists’ mana tithe',
      },
      {
        label: 'Sacrifice to Core',
        eff: { fear: 10 },
        outcomeText: 'burned the tithe in dark flames for the Dungeon Core',
      },
    ],
  },
  {
    id: 'shr_mass',
    loc: 'shrine',
    title: 'Black Mass',
    prompt: 'Shrine priests ask permission to chant a nocturnal rite of dread and lust.',
    artKey: 'dk_ex_shr_mass',
    weight: 1,
    choices: [
      {
        label: 'Preside Over Rite (10 MP)',
        cost: 10,
        eff: { fear: 15, lust: 5 },
        outcomeText: 'presided over a midnight black mass',
      },
      {
        label: 'Let Cultists Pray',
        eff: { fear: 5 },
        outcomeText: 'left the devotees to their nocturnal prayers',
      },
    ],
  },
  {
    id: 'man_tea',
    loc: 'manor',
    title: "Vesper's Tea Service",
    prompt: 'Vesper lays out silver tea service and neatly stacked domain ledgers.',
    artKey: 'dk_ex_man_tea',
    weight: 1,
    choices: [
      {
        label: 'Share Quiet Tea',
        eff: { affV: 4 },
        outcomeText: 'shared unhurried tea with Vesper in the manor parlor',
      },
      {
        label: 'Audit Ledgers Together',
        eff: { mp: 8 },
        outcomeText: 'audited estate balances alongside Vesper',
      },
    ],
  },
  {
    id: 'man_prank',
    loc: 'manor',
    title: "Lilim's Bedroom Prank",
    prompt: 'Lilim awaits by your bedchamber door with a suspiciously wicked smirk.',
    artKey: 'dk_ex_man_prank',
    weight: 1,
    choices: [
      {
        label: 'Play Along',
        eff: { affL: 4 },
        outcomeText: 'played along with Lilim’s mischievous manor prank',
      },
      {
        label: 'Reprimand Her',
        eff: { affL: 2, order: 3 },
        outcomeText: 'scolded Lilim and restored manor decorum',
      },
    ],
  },
  {
    id: 'anx_riot',
    loc: 'annex',
    title: 'Cellblock Disturbance',
    prompt: 'Restless prisoners rattle their bars and jeer at the wardens.',
    artKey: 'dk_ex_anx_riot',
    minPrisoners: 2,
    weight: 1,
    choices: [
      {
        label: 'Make an Example',
        eff: { fear: 6, prisResist: -8 },
        outcomeText: 'made a harsh example of a rowdy captive in the annex',
      },
      {
        label: 'Seductive Pacification',
        eff: { prisCorr: 8 },
        outcomeText: 'pacified the cellblock through lingering lewd torment',
      },
    ],
  },
  {
    id: 'off_ledger',
    loc: 'office',
    title: 'Ledger Renegotiation',
    prompt: 'Eleonora adjusts her reading glasses over an open Goldreich ledger.',
    artKey: 'dk_ex_off_ledger',
    requiresDebt: true,
    weight: 1,
    choices: [
      {
        label: 'Negotiate Principal',
        eff: { chance: { p: 0.5, success: { debtCut: 30 }, fail: { patience: -5 } } },
        outcomeText: 'negotiated debt terms across Eleonora’s desk',
      },
      {
        label: 'Share Afternoon Tea',
        eff: { affE: 3, patience: 4 },
        outcomeText: 'shared quiet tea with Eleonora in her branch office',
      },
    ],
  },
  {
    id: 'off_errand',
    loc: 'office',
    title: "Young Lady's Errand",
    prompt: 'Eleonora glances away, asking for a discreet personal favor.',
    artKey: 'dk_ex_off_errand',
    weight: 1,
    choices: [
      {
        label: 'Run the Errand',
        eff: { patience: 8, affE: 2 },
        outcomeText: 'handled an embarrassing personal errand for Eleonora',
      },
      {
        label: 'Decline',
        eff: { affE: -2, mp: 5 },
        outcomeText: 'declined Eleonora’s errand and kept to business',
      },
    ],
  },
] as const;

export interface SettlementCrisisChoice {
  label: string;
  mpCost: number;
  effects: {
    food?: number;
    approval?: number;
    order?: number;
    housing?: number;
    renown?: number;
    popPct?: number;
    guard?: number;
    mp?: number;
    fear?: number;
    lust?: number;
  };
  raidMod?: {
    key: string;
    value: number;
    rewardMult?: number;
    chance?: number;
    label: string;
  };
}

export interface SettlementCrisisDef {
  id: string;
  title: string;
  text: string;
  weight: number;
  artKey: string;
  choices: readonly [SettlementCrisisChoice, SettlementCrisisChoice];
}

export const SETTLEMENT_CRISES: readonly SettlementCrisisDef[] = [
  {
    id: 'famine',
    title: 'Crop Failure',
    text: 'Granary bins run dry and gaunt villagers stare toward the manor.',
    weight: 1,
    artKey: 'dk_sev_famine',
    choices: [
      {
        label: 'Emergency Relief (30 MP)',
        mpCost: 30,
        effects: { food: 10, approval: 4 },
      },
      {
        label: 'Ignore Starvation',
        mpCost: 0,
        effects: { approval: -6 },
        raidMod: { key: 'first_dc', value: -2, label: 'First Room DC -2' },
      },
    ],
  },
  {
    id: 'unrest',
    title: 'Brewing Riot',
    text: 'Torches gather in the town square as agitators curse your rule.',
    weight: 1,
    artKey: 'dk_sev_unrest',
    choices: [
      {
        label: 'Crush Agitators (20 MP)',
        mpCost: 20,
        effects: { order: 6, approval: -4, fear: 4 },
      },
      {
        label: 'Leave Unchecked',
        mpCost: 0,
        effects: { approval: -3 },
        raidMod: { key: 'hero_up', value: 1, label: 'Top Hero Grade +1' },
      },
    ],
  },
  {
    id: 'smuggler',
    title: 'Smuggler Den',
    text: 'Black-market smugglers have set up shop in the back alleys.',
    weight: 1,
    artKey: 'dk_sev_smuggler',
    choices: [
      {
        label: 'Raid Hideout (20 MP)',
        mpCost: 20,
        effects: { order: 8 },
        raidMod: { key: 'intel', value: 1, label: 'Prep Intel +1' },
      },
      {
        label: 'Take Bribes',
        mpCost: 0,
        effects: { mp: 40 },
        raidMod: { key: 'trap_off', value: 1, label: '1 Trap Room DC -2' },
      },
    ],
  },
  {
    id: 'fire',
    title: 'Slum Fire',
    text: 'Flames tear through tightly packed timber shanties.',
    weight: 2,
    artKey: 'dk_sev_fire',
    choices: [
      {
        label: 'Organize Firebreak (30 MP)',
        mpCost: 30,
        effects: { housing: -3 },
      },
      {
        label: 'Let It Burn',
        mpCost: 0,
        effects: { housing: -10, popPct: -0.05 },
        raidMod: { key: 'intel_zero', value: 1, label: 'Next Wave Intel 0' },
      },
    ],
  },
  {
    id: 'plague',
    title: 'Fever Outbreak',
    text: 'A virulent fever spreads rapidly through crowded tenements.',
    weight: 2,
    artKey: 'dk_sev_plague',
    choices: [
      {
        label: 'Enforce Quarantine (30 MP)',
        mpCost: 30,
        effects: { popPct: -0.03 },
      },
      {
        label: 'Do Nothing',
        mpCost: 0,
        effects: { popPct: -0.1, approval: -5 },
        raidMod: { key: 'hero_injured', value: 1, label: '1 Hero Starts Injured' },
      },
    ],
  },
  {
    id: 'envoy',
    title: 'Guild Envoy',
    text: 'An Adventurer Guild envoy requests an audience at the manor gate.',
    weight: 1,
    artKey: 'dk_sev_envoy',
    choices: [
      {
        label: 'Lavish Hospitality (30 MP)',
        mpCost: 30,
        effects: {},
        raidMod: { key: 'hero_down', value: 1, label: 'Top Hero Grade -1' },
      },
      {
        label: 'Mock & Dismiss',
        mpCost: 0,
        effects: { renown: 3, fear: 5 },
        raidMod: {
          key: 'hero_up',
          value: 1,
          rewardMult: 1.5,
          label: 'Top Hero Grade +1 · Bounty x1.5',
        },
      },
    ],
  },
  {
    id: 'caravan',
    title: 'Merchant Caravan',
    text: 'A grand trade caravan asks to winter inside your domain walls.',
    weight: 1,
    artKey: 'dk_sev_caravan',
    choices: [
      {
        label: 'Welcome Caravan',
        mpCost: 0,
        effects: { food: 15, mp: 30 },
        raidMod: { key: 'first_dc', value: -2, label: 'First Room DC -2' },
      },
      {
        label: 'Turn Away',
        mpCost: 0,
        effects: { renown: -2 },
      },
    ],
  },
  {
    id: 'harvest',
    title: 'Harvest Festival',
    text: 'Citizens petition to celebrate a bountiful harvest with wine and song.',
    weight: 1,
    artKey: 'dk_sev_harvest',
    choices: [
      {
        label: 'Hold Harvest Feast',
        mpCost: 0,
        effects: { food: -10, approval: 5, lust: 5 },
        raidMod: { key: 'intel', value: 2, label: 'Prep Intel +2' },
      },
      {
        label: 'Cancel & Ration',
        mpCost: 0,
        effects: { food: 5 },
      },
    ],
  },
  {
    id: 'migrants',
    title: 'Refugee Column',
    text: 'Displaced families crowd the outer road seeking shelter in Lostbell.',
    weight: 1,
    artKey: 'dk_sev_migrants',
    choices: [
      {
        label: 'Admit Settlers',
        mpCost: 0,
        effects: { popPct: 0.15, housing: -8 },
        raidMod: {
          key: 'first_dc',
          value: -1,
          chance: 0.3,
          label: '30% First Room DC -1',
        },
      },
      {
        label: 'Bar the Gates',
        mpCost: 0,
        effects: { renown: -3 },
      },
    ],
  },
  {
    id: 'pilgrims',
    title: 'Demon-Lord Pilgrims',
    text: 'Devout dark pilgrims arrive chanting praises of your labyrinth.',
    weight: 1,
    artKey: 'dk_sev_pilgrims',
    choices: [
      {
        label: 'Receive Pilgrims',
        mpCost: 0,
        effects: { fear: 5, renown: -2 },
        raidMod: { key: 'first_dc', value: 1, label: 'First Room DC +1' },
      },
      {
        label: 'Drive Them Out',
        mpCost: 0,
        effects: { approval: 2 },
      },
    ],
  },
  {
    id: 'bumper',
    title: 'Bumper Harvest',
    text: 'Golden grain overflows the estate fields as far as the eye can see.',
    weight: 1,
    artKey: 'dk_sev_bumper',
    choices: [
      {
        label: 'Stockpile Grain',
        mpCost: 0,
        effects: { food: 15 },
      },
      {
        label: 'Export Surplus',
        mpCost: 0,
        effects: { mp: 40, renown: 2 },
      },
    ],
  },
  {
    id: 'militia',
    title: 'Town Militia',
    text: 'Orderly townsfolk volunteer to form a standing dungeon defense militia.',
    weight: 1,
    artKey: 'dk_sev_militia',
    choices: [
      {
        label: 'Charter Militia',
        mpCost: 0,
        effects: { guard: 1 },
        raidMod: { key: 'core_guard', value: 0.2, label: 'Core Capture +20%p' },
      },
      {
        label: 'Disband Group',
        mpCost: 0,
        effects: { order: -3, approval: -2 },
      },
    ],
  },
  {
    id: 'bards',
    title: 'Wandering Bards',
    text: 'A troupe of traveling minstrels asks to perform in the town square.',
    weight: 0.6,
    artKey: 'dk_sev_harvest',
    choices: [
      {
        label: 'Sponsor Troupe (15 MP)',
        mpCost: 15,
        effects: { approval: 4, renown: 1 },
      },
      {
        label: 'Chase Them Off',
        mpCost: 0,
        effects: { order: 2 },
      },
    ],
  },
  {
    id: 'peddler',
    title: 'Traveling Tinker',
    text: 'A mysterious tinker unpacks bargain supplies along the main road.',
    weight: 0.6,
    artKey: 'dk_sev_caravan',
    choices: [
      {
        label: 'Buy Bulk Supplies (20 MP)',
        mpCost: 20,
        effects: { food: 6, housing: 2 },
      },
      {
        label: 'Pass By',
        mpCost: 0,
        effects: {},
      },
    ],
  },
  {
    id: 'rumor',
    title: 'Back-Alley Rumors',
    text: 'Wild whispers about the Demon Lord’s true identity circulate in taverns.',
    weight: 0.6,
    artKey: 'dk_sev_unrest',
    choices: [
      {
        label: 'Stoke the Dread',
        mpCost: 0,
        effects: { fear: 4, approval: -2 },
      },
      {
        label: 'Hush Rumors (10 MP)',
        mpCost: 10,
        effects: { approval: 2, order: 2 },
      },
    ],
  },
  {
    id: 'storm',
    title: 'Foul Weather',
    text: 'Relentless gales and cold rain batter roofs and granary walls.',
    weight: 0.6,
    artKey: 'dk_sev_fire',
    choices: [
      {
        label: 'Reinforce Roofs (20 MP)',
        mpCost: 20,
        effects: { housing: 3 },
      },
      {
        label: 'Weather the Storm',
        mpCost: 0,
        effects: { housing: -3, food: -2 },
      },
    ],
  },
] as const;

export const SETTLEMENT_CRISIS_MAP: Record<string, SettlementCrisisDef> = Object.fromEntries(
  SETTLEMENT_CRISES.map((c) => [c.id, c])
);

export interface DebtQuestDef {
  id: string;
  desc: string;
  rewardMp: number;
  type: string;
  target: number;
}

export const DEBT_QUESTS: readonly DebtQuestDef[] = [
  { id: 'capture_A', desc: 'Capture a Grade A+ Hero', rewardMp: 180, type: 'capture_A', target: 1 },
  { id: 'wipes2', desc: 'Achieve 2 Party Wipes', rewardMp: 180, type: 'wipes2', target: 2 },
  { id: 'nobreach', desc: 'Defend 1 Wave with Zero Breaches', rewardMp: 210, type: 'nobreach', target: 1 },
  { id: 'fame2', desc: 'Increase Domain Fame by +2', rewardMp: 150, type: 'fame2', target: 2 },
  { id: 'corrupt70', desc: 'Deliver a 70+ Corruption Captive', rewardMp: 180, type: 'corrupt70', target: 70 },
  { id: 'fear50', desc: 'Reach 50+ Fear', rewardMp: 120, type: 'fear50', target: 50 },
  { id: 'lust50', desc: 'Reach 50+ Lust', rewardMp: 120, type: 'lust50', target: 50 },
  { id: 'hold3', desc: 'Hold 3+ Captives in Prison', rewardMp: 120, type: 'hold3', target: 3 },
  { id: 'kill3', desc: 'Slay 3 Heroes inside the Dungeon', rewardMp: 150, type: 'kill3', target: 3 },
] as const;

export interface OfficerInteractionDef {
  id: string;
  officer: OfficerKey;
  stage: number;
  title: string;
  effectText: string;
  mpCost?: number;
  star?: boolean;
  debtOnly?: boolean;
  cooldown?: 'game' | 'cycle' | 'waves';
  cooldownWaves?: number;
  artKey: string;
}

export const OFFICER_INTERACTIONS: readonly OfficerInteractionDef[] = [
  // Vesper (V1..V10)
  {
    id: 'V1',
    officer: 'vesper',
    stage: 1,
    title: 'Ledger Balancing',
    effectText: '+10 MP (direct treasury balance)',
    artKey: 'dk_int_v1',
  },
  {
    id: 'V2',
    officer: 'vesper',
    stage: 1,
    title: 'Blood Wine Toast',
    effectText: '+2 Fear',
    artKey: 'dk_int_v2',
  },
  {
    id: 'V3',
    officer: 'vesper',
    stage: 2,
    title: 'Crimson Briefing',
    effectText: 'Today interrogation success +10%p',
    artKey: 'dk_int_v3',
  },
  {
    id: 'V4',
    officer: 'vesper',
    stage: 2,
    title: 'Lap-Pillow Report',
    effectText: 'Today interrogation +10%p & conditioning +10%',
    artKey: 'dk_int_v4',
  },
  {
    id: 'V5',
    officer: 'vesper',
    stage: 3,
    title: 'Chamber Invitation',
    effectText: 'Rest MP x2 today (+20 MP/AP)',
    star: true,
    artKey: 'dk_int_v5',
  },
  {
    id: 'V6',
    officer: 'vesper',
    stage: 3,
    title: 'Night of Crimson Thirst',
    effectText: '-20 MP, +6 Lust',
    mpCost: 20,
    star: true,
    artKey: 'dk_int_v6',
  },
  {
    id: 'V7',
    officer: 'vesper',
    stage: 4,
    title: 'Role Reversal',
    effectText: '+1 AP on the next Day phase',
    star: true,
    artKey: 'dk_int_v7',
  },
  {
    id: 'V8',
    officer: 'vesper',
    stage: 4,
    title: 'Renew Blood Pact',
    effectText: '+5 Fear, +1 Prison Capacity (once)',
    star: true,
    cooldown: 'waves',
    cooldownWaves: 10,
    artKey: 'dk_int_v8',
  },
  {
    id: 'V9',
    officer: 'vesper',
    stage: 2,
    title: 'Cellblock Inspection',
    effectText: 'All prisoners +5 Terror, Town +2 Order',
    artKey: 'dk_int_v9',
  },
  {
    id: 'V10',
    officer: 'vesper',
    stage: 4,
    title: 'Blood Auction Banquet',
    effectText: '+15% Prisoner sale & auction ransom today',
    star: true,
    artKey: 'dk_int_v10',
  },

  // Lilim (L1..L10)
  {
    id: 'L1',
    officer: 'lilim',
    stage: 1,
    title: 'Scouting Date',
    effectText: '30% chance +1 Prep Intel',
    artKey: 'dk_int_l1',
  },
  {
    id: 'L2',
    officer: 'lilim',
    stage: 1,
    title: 'Teasing Wager',
    effectText: '50% chance +15 MP prize',
    artKey: 'dk_int_l2',
  },
  {
    id: 'L3',
    officer: 'lilim',
    stage: 2,
    title: 'Tail-Catch Game',
    effectText: 'Next trap upgrade cost -10%',
    artKey: 'dk_int_l3',
  },
  {
    id: 'L4',
    officer: 'lilim',
    stage: 2,
    title: 'Penalty Game',
    effectText: '+4 Lust',
    artKey: 'dk_int_l4',
  },
  {
    id: 'L5',
    officer: 'lilim',
    stage: 3,
    title: 'Tables Turned',
    effectText: 'Next Prep +1 Intel leak',
    star: true,
    artKey: 'dk_int_l5',
  },
  {
    id: 'L6',
    officer: 'lilim',
    stage: 3,
    title: 'Watchtower Night',
    effectText: '+6 Lust, Next raid 1F DC +1',
    star: true,
    artKey: 'dk_int_l6',
  },
  {
    id: 'L7',
    officer: 'lilim',
    stage: 4,
    title: 'Spoiled Monopoly',
    effectText: 'Next Prep top hero downgrade chance +20%p',
    star: true,
    artKey: 'dk_int_l7',
  },
  {
    id: 'L8',
    officer: 'lilim',
    stage: 4,
    title: 'Exclusive Succubus Crest',
    effectText: 'Max Raid Intel +1 permanently (1/game)',
    star: true,
    cooldown: 'game',
    artKey: 'dk_int_l8',
  },
  {
    id: 'L9',
    officer: 'lilim',
    stage: 2,
    title: 'Trap Showcase',
    effectText: '+20%p chance new trap upgrades +1 grade',
    artKey: 'dk_int_l9',
  },
  {
    id: 'L10',
    officer: 'lilim',
    stage: 4,
    title: 'Labyrinth Inspection',
    effectText: 'All floors DC +1 on next Raid',
    star: true,
    artKey: 'dk_int_l10',
  },

  // Eleonora (E1..E12)
  {
    id: 'E1',
    officer: 'eleonora',
    stage: 1,
    title: 'Tea-Time Audit',
    effectText: '+5 Debt Patience',
    artKey: 'dk_int_e1',
  },
  {
    id: 'E2',
    officer: 'eleonora',
    stage: 1,
    title: 'Cover Ledger Error',
    effectText: '+8 Debt Patience',
    artKey: 'dk_int_e2',
  },
  {
    id: 'E3',
    officer: 'eleonora',
    stage: 2,
    title: 'Collateral Appraisal',
    effectText: 'Next installment minimum due -5%',
    debtOnly: true,
    artKey: 'dk_int_e3',
  },
  {
    id: 'E4',
    officer: 'eleonora',
    stage: 2,
    title: 'Ballroom Lesson',
    effectText: '+5 Debt Patience',
    artKey: 'dk_int_e4',
  },
  {
    id: 'E5',
    officer: 'eleonora',
    stage: 3,
    title: 'Midnight Appraisal',
    effectText: 'Next installment minimum due -10%',
    star: true,
    debtOnly: true,
    cooldown: 'cycle',
    artKey: 'dk_int_e5',
  },
  {
    id: 'E6',
    officer: 'eleonora',
    stage: 3,
    title: 'Secret Outing',
    effectText: '-30 MP, +10 Debt Patience',
    mpCost: 30,
    star: true,
    artKey: 'dk_int_e6',
  },
  {
    id: 'E7',
    officer: 'eleonora',
    stage: 4,
    title: 'Engagement Contract Draft',
    effectText: 'Principal Debt -5% (Relief Cap 1,200)',
    star: true,
    debtOnly: true,
    cooldown: 'cycle',
    artKey: 'dk_int_e7',
  },
  {
    id: 'E8',
    officer: 'eleonora',
    stage: 4,
    title: 'Night Over the Ledger',
    effectText: 'Waive next M.Settle debt interest',
    star: true,
    debtOnly: true,
    cooldown: 'cycle',
    artKey: 'dk_int_e8',
  },
  {
    id: 'E9',
    officer: 'eleonora',
    stage: 5,
    title: 'Secret Debt Write-Off',
    effectText: 'Principal Debt -15% (max 450 MP, 1/game)',
    star: true,
    debtOnly: true,
    cooldown: 'game',
    artKey: 'dk_int_e9',
  },
  {
    id: 'E10',
    officer: 'eleonora',
    stage: 5,
    title: 'Dowry Declaration',
    effectText: 'If debt <= 600 MP: forgive all & unlock Romance Dowry Ending',
    star: true,
    debtOnly: true,
    cooldown: 'game',
    artKey: 'dk_int_e10',
  },
  {
    id: 'E11',
    officer: 'eleonora',
    stage: 2,
    title: 'Auction Preview Decree',
    effectText: '+3 Town Renown, +10% Prisoner sale value today',
    artKey: 'dk_int_e11',
  },
  {
    id: 'E12',
    officer: 'eleonora',
    stage: 3,
    title: 'Forge Guild Permits',
    effectText: '-5 Guild Alert Points',
    star: true,
    artKey: 'dk_int_e12',
  },
] as const;

export const OFFICER_PASSIVE_PERKS: Record<
  OfficerKey,
  readonly { stage: number; text: string }[]
> = {
  vesper: [
    { stage: 1, text: 'Prisoner sale price +10% & Interrogation +15%p' },
    { stage: 2, text: 'Prison conditioning corruption x1.25' },
    { stage: 3, text: '+10 MP per Management Settlement & Sale risk x0.75' },
    { stage: 4, text: 'Sale risk x0.50 & AP Growth Path (+1 Max AP)' },
  ],
  lilim: [
    { stage: 1, text: 'Trap upgrade cost -10%' },
    { stage: 2, text: '+1 Raid Prep Intel & 10% new trap +1 grade' },
    { stage: 3, text: 'First trap floor hero roll -1 (effectively +1 DC)' },
    { stage: 4, text: '30% top-hero downgrade at Prep & trapbench x2' },
  ],
  eleonora: [
    { stage: 1, text: 'Debt interest lowered from 1.0% to 0.8%/wave' },
    { stage: 2, text: 'Prisoner handover debt credit x1.3 (from x1.2)' },
    { stage: 3, text: 'Entertainment success +15%p & Auction fee 0%' },
    { stage: 4, text: 'Once-per-run late forgiveness, +1 Renown/settle, Romance eligible' },
    { stage: 5, text: 'Unlocks E9 Write-Off & E10 Dowry Romance Ending (Aff 100)' },
  ],
};
