import { resolveSceneAsset } from '../data/assetManifest';
import { CFG } from '../data/constants';
import {
  CRISIS_CFG,
  LANDMARK_DEFS,
  type LandmarkKey,
  WAR_CFG,
  WAR_RIVALS,
  WONDER_DEFS,
  type WonderKey,
} from '../data/realmData';
import {
  EXPLORE_EVENTS,
  EXPLORE_LOCATIONS,
  FACILITY_MAP,
  SETTLEMENT_CRISES,
  SETTLEMENT_CRISIS_MAP,
  TOWN_ACTIONS,
  TOWN_LEVELS,
  TOWN_POLICY_MODS,
  type ExploreEffectSpec,
  type ExploreEventDef,
  type ExploreLocationDef,
  type SettlementCrisisDef,
  type TownLevelDef,
} from '../data/estateData';
import type {
  GameState,
  MonsterInstance,
  Prisoner,
  TownPolicy,
  WarRivalKey,
} from '../types/game';
import {
  canSpendDayAp,
  getTotalDebt,
  isDayPhase,
  spendDayAp,
} from './dayLoop';
import { calcPrisonerRansom } from './debt';
import {
  checkDebtPayoffEnding,
  enterGameOver,
  evaluateRankTrials,
  triggerProsperityEnding,
} from './endings';
import { processMonsterNightlyCycle } from './monsters';
import { grantOfficerAffinity } from './officers';
import { buildNemesisFromHero } from './realm';
import { clamp, pickOne, pickWeighted, randInt, uid } from './rng';

const SERVANT_MP_BY_GRADE: Record<string, number> = {
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

export interface TownUpgradeInfo {
  currentDef: TownLevelDef;
  nextDef: TownLevelDef | null;
  totalFacilityLevels: number;
  canUpgrade: boolean;
  blockers: string[];
}

export interface ManagementSettleLedger {
  wave: number;
  popBefore: number;
  popAfter: number;
  popCap: number;
  approvalBefore: number;
  approvalAfter: number;
  orderBefore: number;
  orderAfter: number;
  housingBefore: number;
  housingAfter: number;
  foodBefore: number;
  foodAfter: number;
  foodProd: number;
  foodEat: number;
  renownBefore: number;
  renownAfter: number;
  taxIncome: number;
  baseIncome: number;
  popManaIncome: number;
  servantMp: number;
  jobMp: number;
  dancerMp: number;
  vesperBonusMp: number;
  eleonoraRomanceMp: number;
  hiredSalary: number;
  upkeepCost: number;
  vaultDeposit: number;
  vaultAfter: number;
  vaultCap: number;
  rioted: boolean;
  riotMpLoss: number;
  netMpDelta: number;
  pointsAfter: number;
  debtInterestPrincipal: number;
  debtInterestExtra: number;
  interestWaived: boolean;
  fearBefore: number;
  fearAfter: number;
  lustBefore: number;
  lustAfter: number;
  famineStreak: number;
  riotStreak: number;
  pendingGameOver: 'ruin' | 'famine' | 'riot' | null;
  casualGraceTriggered: boolean;
  lines: { label: string; deltaText: string }[];
}

export interface EstateActionResult {
  ok: boolean;
  state: GameState;
  message: string;
  artUrl?: string;
}

export interface ExploreResult {
  ok: boolean;
  state: GameState;
  event: ExploreEventDef | null;
  quietStroll: boolean;
  message: string;
  artUrl?: string;
}

export interface EstateRaidModifiers {
  leakedFloors: number;
  firstRoomDcDelta: number;
  allFloorsDcDelta: number;
  prepIntelDelta: number;
  buildCostMult: number;
  coreCaptureBonus: number;
  guardDcBonus: number;
  critRoomSaveChance: number;
  ransomBonusMult: number;
  servantMpHalved: boolean;
  notes: string[];
}

export function getTotalFacilityLevels(state: GameState): number {
  return Object.values(state.estate.facilities).reduce((sum, lv) => sum + Math.max(0, lv), 0);
}

export function getTownLevelDef(lv: number): TownLevelDef {
  return TOWN_LEVELS[clamp(lv - 1, 0, TOWN_LEVELS.length - 1)] ?? TOWN_LEVELS[0];
}

export function calcPopCap(state: GameState): number {
  const def = getTownLevelDef(state.town.lv);
  const innLv = state.estate.facilities.inn ?? 0;
  const housingLv = state.estate.facilities.housing ?? 0;
  return Math.max(
    1,
    Math.floor(
      def.popCap *
        (1 + 0.1 * innLv) *
        (1 + 0.05 * housingLv) *
        (0.8 + state.town.housing / 250)
    )
  );
}

export function calcTownTax(state: GameState): number {
  const def = getTownLevelDef(state.town.lv);
  const popCap = calcPopCap(state);
  const policy = TOWN_POLICY_MODS[state.town.policy] ?? TOWN_POLICY_MODS.normal;
  const innLv = state.estate.facilities.inn ?? 0;
  const brothelLv = state.estate.facilities.brothel ?? 0;
  const tradeLv = state.estate.facilities.trade ?? 0;
  const popRatio = clamp(state.town.pop / Math.max(1, popCap), 0, 1.2);
  const approvalMult = state.town.approval >= 70 ? 1.1 : 1.0;
  const renownMult = state.town.renown < 20 ? 0.8 : 1.0;
  const taxNextMod = Math.max(0, 1 + (state.estate.perks.taxNext ?? 0));
  const eleAffMult = 1 + state.officers.eleonora.aff * 0.001;

  const base =
    def.baseTax *
    policy.taxMult *
    (0.4 + 0.6 * popRatio) *
    (1 + 0.15 * innLv + 0.2 * brothelLv) *
    approvalMult *
    taxNextMod *
    renownMult *
    eleAffMult;

  return Math.max(0, Math.floor(base) + 10 * tradeLv);
}

export function getTownTitle(state: GameState): {
  title: string;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  score: number;
} {
  const popCap = calcPopCap(state);
  const popRatio = clamp(state.town.pop / popCap, 0, 1);
  const baseTax = getTownLevelDef(state.town.lv).baseTax;
  const wealthRatio = clamp((state.town.lastTax || calcTownTax(state)) / Math.max(1, baseTax), 0, 1.2) / 1.2;
  const score = Math.round(
    30 * popRatio +
      25 * (state.town.approval / 100) +
      20 * (state.town.order / 100) +
      25 * wealthRatio
  );

  let grade: 'S' | 'A' | 'B' | 'C' | 'D' = 'D';
  if (score >= 85) grade = 'S';
  else if (score >= 70) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 40) grade = 'C';

  const descriptors: string[] = [];
  if (popRatio >= 0.8) descriptors.push('Bustling');
  else if (popRatio <= 0.3) descriptors.push('Sparse');
  if (state.town.approval >= 80) descriptors.push('Adoring');
  else if (state.town.approval <= 20) descriptors.push('Resentful');
  if (state.town.order >= 80) descriptors.push('Orderly');
  else if (state.town.order <= 25) descriptors.push('Lawless');
  if (state.fear >= 50) descriptors.push('Dread-Haunted');
  if (state.lust >= 50) descriptors.push('Debauched');

  const prefix = descriptors.slice(0, 2).join(', ') || 'Modest';
  const lvName = getTownLevelDef(state.town.lv).name;
  return {
    title: `${prefix} ${lvName} Lostbell`,
    grade,
    score,
  };
}

export function getNextTownLevelInfo(state: GameState): TownUpgradeInfo {
  const currentDef = getTownLevelDef(state.town.lv);
  const nextDef =
    state.town.lv < TOWN_LEVELS.length ? TOWN_LEVELS[state.town.lv] : null;
  const totalFacilityLevels = getTotalFacilityLevels(state);
  const blockers: string[] = [];

  if (!nextDef) {
    blockers.push('Maximum Domain Level reached');
  } else {
    if (!isDayPhase(state)) blockers.push('Requires Day (AP) phase');
    if (state.estate.activeCrisis) blockers.push('Resolve active crisis first');
    if (state.points < nextDef.upgradeCost) {
      blockers.push(`Need ${nextDef.upgradeCost} MP`);
    }
    if (totalFacilityLevels < nextDef.reqFacLevels) {
      blockers.push(`Need ${nextDef.reqFacLevels} total facility levels (${totalFacilityLevels})`);
    }
    if (state.town.pop < nextDef.reqPop) {
      blockers.push(`Need ${nextDef.reqPop} population (${state.town.pop})`);
    }
  }

  return {
    currentDef,
    nextDef,
    totalFacilityLevels,
    canUpgrade: blockers.length === 0,
    blockers,
  };
}

export function upgradeTown(state: GameState): EstateActionResult {
  const info = getNextTownLevelInfo(state);
  if (!info.nextDef || !info.canUpgrade) {
    const reason = info.blockers[0] ?? 'Cannot upgrade Town.';
    return {
      ok: false,
      state: { ...state, flash: reason },
      message: reason,
    };
  }

  const nextLv = info.nextDef.lv;
  const celebBonus = info.nextDef.baseIncome * 2;
  let next: GameState = {
    ...state,
    points: state.points - info.nextDef.upgradeCost + celebBonus,
    town: {
      ...state.town,
      lv: nextLv,
    },
    dayLines: [
      ...state.dayLines,
      {
        text: `Domain upgraded to Lv.${nextLv} ${info.nextDef.name}! (+${celebBonus} MP celebration grant)`,
        star: true,
        kind: 'townlevel',
        art: info.nextDef.artKey,
      },
    ],
  };

  if (nextLv === 5 && !next.endings.unlocked.prosperity) {
    next = triggerProsperityEnding(next);
  }

  return {
    ok: true,
    state: {
      ...next,
      flash: `Town upgraded to Lv.${nextLv} ${info.nextDef.name} (+${celebBonus} MP bonus)!`,
    },
    message: `Upgraded to Lv.${nextLv} ${info.nextDef.name}.`,
    artUrl: resolveSceneAsset(info.nextDef.artKey),
  };
}

export function setTownPolicy(
  state: GameState,
  policy: TownPolicy
): GameState {
  if (state.town.policy === policy) return state;
  return {
    ...state,
    town: { ...state.town, policy },
    flash: `Tax policy updated to ${TOWN_POLICY_MODS[policy].label}.`,
  };
}

export function getFacilityUpgradeState(
  state: GameState,
  facilityKey: string
): {
  canBuild: boolean;
  currentLv: number;
  maxLvForTown: number;
  cost: number | null;
  reason: string | null;
} {
  const def = FACILITY_MAP[facilityKey];
  if (!def) {
    return {
      canBuild: false,
      currentLv: 0,
      maxLvForTown: 0,
      cost: null,
      reason: 'Unknown facility',
    };
  }
  const currentLv = state.estate.facilities[facilityKey] ?? 0;
  const maxLvForTown = Math.min(3, state.town.lv);
  if (currentLv >= 3) {
    return {
      canBuild: false,
      currentLv,
      maxLvForTown,
      cost: null,
      reason: 'Max Lv.3 reached',
    };
  }
  if (currentLv >= maxLvForTown) {
    return {
      canBuild: false,
      currentLv,
      maxLvForTown,
      cost: def.costs[currentLv] ?? null,
      reason: `Requires Town Lv.${currentLv + 1}`,
    };
  }
  if (def.prereq) {
    const reqLv = state.estate.facilities[def.prereq.key] ?? 0;
    if (reqLv < def.prereq.lv) {
      const reqName = FACILITY_MAP[def.prereq.key]?.name ?? def.prereq.key;
      return {
        canBuild: false,
        currentLv,
        maxLvForTown,
        cost: def.costs[currentLv] ?? null,
        reason: `Requires ${reqName} Lv.${def.prereq.lv}`,
      };
    }
  }
  const cost = def.costs[currentLv];
  if (!isDayPhase(state)) {
    return {
      canBuild: false,
      currentLv,
      maxLvForTown,
      cost,
      reason: 'Locked outside Day (AP) phase',
    };
  }
  if (state.estate.activeCrisis) {
    return {
      canBuild: false,
      currentLv,
      maxLvForTown,
      cost,
      reason: 'Resolve active crisis first',
    };
  }
  if (state.points < cost) {
    return {
      canBuild: false,
      currentLv,
      maxLvForTown,
      cost,
      reason: `Need ${cost} MP`,
    };
  }
  return {
    canBuild: true,
    currentLv,
    maxLvForTown,
    cost,
    reason: null,
  };
}

export function buildOrUpgradeFacility(
  state: GameState,
  facilityKey: string
): EstateActionResult {
  const def = FACILITY_MAP[facilityKey];
  const check = getFacilityUpgradeState(state, facilityKey);
  if (!def || !check.canBuild || check.cost === null) {
    const reason = check.reason ?? 'Cannot build facility.';
    return { ok: false, state: { ...state, flash: reason }, message: reason };
  }

  const nextLv = check.currentLv + 1;
  let nextMonsters = state.monsters;
  if (facilityKey === 'beastpen') {
    const penCap = 3 + 2 * nextLv;
    if (nextMonsters.length < penCap) {
      const starter: MonsterInstance = {
        id: uid('mob'),
        lineage: nextLv === 1 ? 'beast' : nextLv === 2 ? 'slime' : 'harpy',
        stars: 1,
        xp: 0,
        kills: 0,
        fed: 0,
        deployedFloor: null,
        injuredUntilWave: null,
        tiredUntilWave: null,
      };
      nextMonsters = [...nextMonsters, starter];
    }
  }

  const label = `${def.name} upgraded to Lv.${nextLv} (-${check.cost} MP)`;
  const next: GameState = {
    ...state,
    points: state.points - check.cost,
    monsters: nextMonsters,
    estate: {
      ...state.estate,
      facilities: {
        ...state.estate.facilities,
        [facilityKey]: nextLv,
      },
    },
    dayLines: [
      ...state.dayLines,
      {
        text: label,
        star: nextLv === 1 || nextLv === 3,
        kind: 'facility',
        art: def.artKey,
      },
    ],
    flash: label,
  };

  return {
    ok: true,
    state: next,
    message: label,
    artUrl: resolveSceneAsset(def.artKey),
  };
}

export function performTownAction(
  state: GameState,
  actionKey: string
): EstateActionResult {
  const def = TOWN_ACTIONS.find((a) => a.key === actionKey);
  if (!def) {
    return {
      ok: false,
      state: { ...state, flash: `Unknown town action: ${actionKey}` },
      message: 'Unknown town action.',
    };
  }
  const apKey = `town_${def.key}`;
  const guard = canSpendDayAp(state, apKey);
  if (!guard.ok) {
    return { ok: false, state: { ...state, flash: guard.reason }, message: guard.reason };
  }
  if (def.needFac && (state.estate.facilities[def.needFac] ?? 0) < 1) {
    const reqName = FACILITY_MAP[def.needFac]?.name ?? def.needFac;
    const msg = `Requires ${reqName} Lv.1.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }

  const mpCost =
    def.key === 'punish' && (state.estate.facilities.shrine ?? 0) >= 1
      ? 0
      : def.mpCost;
  if (state.points < mpCost) {
    const msg = `Need ${mpCost} MP for ${def.label}.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (def.foodCost && state.town.food < def.foodCost) {
    const msg = `Need ${def.foodCost} Food for ${def.label}.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }

  const spent = spendDayAp(state, apKey, {
    text: `${def.label} (${def.summary})`,
    kind: 'town',
    art: def.artKey,
  });
  if (!spent.ok) {
    return { ok: false, state: spent.state, message: spent.state.flash };
  }

  const fx = def.effects;
  const brothelBonus =
    fx.approvalBrothelBonus && (spent.state.estate.facilities.brothel ?? 0) > 0
      ? fx.approvalBrothelBonus
      : 0;

  const next: GameState = {
    ...spent.state,
    points: Math.max(0, spent.state.points - mpCost + (fx.mp ?? 0)),
    fear: clamp(spent.state.fear + (fx.fear ?? 0), 0, 100),
    lust: clamp(spent.state.lust + (fx.lust ?? 0), 0, 100),
    town: {
      ...spent.state.town,
      approval: clamp(
        spent.state.town.approval + (fx.approval ?? 0) + brothelBonus,
        0,
        100
      ),
      order: clamp(spent.state.town.order + (fx.order ?? 0), 0, 100),
      renown: clamp(spent.state.town.renown + (fx.renown ?? 0), 0, 100),
      food: clamp(
        spent.state.town.food + (fx.food ?? 0) - (def.foodCost ?? 0),
        0,
        100
      ),
      housing: clamp(spent.state.town.housing + (fx.housing ?? 0), 0, 100),
      guard: spent.state.town.guard + (fx.guard ?? 0),
    },
    estate: {
      ...spent.state.estate,
      perks: {
        ...spent.state.estate.perks,
        taxNext: (spent.state.estate.perks.taxNext ?? 0) + (fx.taxNext ?? 0),
      },
    },
    flash: `${def.label} completed (-1 AP).`,
  };

  return {
    ok: true,
    state: next,
    message: `${def.label} completed.`,
    artUrl: resolveSceneAsset(def.artKey),
  };
}

// --- Explore Town (9 Locations + Office, 20 CFG.EVENTS) ---

export function isExploreLocationUnlocked(
  state: GameState,
  loc: ExploreLocationDef
): boolean {
  if (loc.facilityKey) {
    return (state.estate.facilities[loc.facilityKey] ?? 0) >= 1;
  }
  if (loc.requiresDebt) {
    return !state.debt.ended && getTotalDebt(state) > 0;
  }
  return true;
}

export function getUnlockedExploreLocations(
  state: GameState
): ExploreLocationDef[] {
  return EXPLORE_LOCATIONS.filter((loc) => isExploreLocationUnlocked(state, loc));
}

export function getActiveExploreEvent(state: GameState): ExploreEventDef | null {
  const raw = state.estate.activeLocation;
  if (!raw || !raw.includes(':')) return null;
  const [, eventId] = raw.split(':');
  return EXPLORE_EVENTS.find((e) => e.id === eventId) ?? null;
}

function isExploreEventEligible(state: GameState, event: ExploreEventDef): boolean {
  if (event.minTownLv && state.town.lv < event.minTownLv) return false;
  if (event.minPrisoners && state.prisoners.length < event.minPrisoners) return false;
  if (event.minServants) {
    const servants = state.prisoners.filter((p) => p.converted === 'servant').length;
    if (servants < event.minServants) return false;
  }
  if (event.requiresDebt && (state.debt.ended || getTotalDebt(state) <= 0)) {
    return false;
  }
  const dayNum = state.day || state.wave;
  const cdUntil = state.estate.crisisCooldowns[`ev_${event.id}`] ?? 0;
  return cdUntil <= dayNum;
}

export function exploreTown(
  state: GameState,
  locationId: string,
  forceEventId?: string
): ExploreResult {
  const locDef = EXPLORE_LOCATIONS.find((l) => l.id === locationId);
  if (!locDef) {
    return {
      ok: false,
      state: { ...state, flash: `Unknown explore location: ${locationId}` },
      event: null,
      quietStroll: false,
      message: 'Unknown location.',
    };
  }
  if (!isExploreLocationUnlocked(state, locDef)) {
    const msg = locDef.facilityKey
      ? `Build ${FACILITY_MAP[locDef.facilityKey]?.name ?? locDef.facilityKey} to explore ${locDef.label}.`
      : `${locDef.label} is currently locked.`;
    return {
      ok: false,
      state: { ...state, flash: msg },
      event: null,
      quietStroll: false,
      message: msg,
    };
  }
  if (getActiveExploreEvent(state)) {
    const msg = 'Resolve the active Explore event choice first.';
    return {
      ok: false,
      state: { ...state, flash: msg },
      event: null,
      quietStroll: false,
      message: msg,
    };
  }

  const exploreIndex = state.estate.exploreCountToday + 1;
  const actionKey = `explore_${exploreIndex}`;
  const guard = canSpendDayAp(state, actionKey);
  if (!guard.ok) {
    return {
      ok: false,
      state: { ...state, flash: guard.reason },
      event: null,
      quietStroll: false,
      message: guard.reason,
    };
  }

  const candidates = EXPLORE_EVENTS.filter(
    (e) => e.loc === locationId && isExploreEventEligible(state, e)
  );

  if (candidates.length === 0) {
    const spent = spendDayAp(state, actionKey, {
      text: `Explored ${locDef.label} — quiet stroll (+10 MP)`,
      kind: 'explore',
    });
    if (!spent.ok) {
      return {
        ok: false,
        state: spent.state,
        event: null,
        quietStroll: false,
        message: spent.state.flash,
      };
    }
    return {
      ok: true,
      state: {
        ...spent.state,
        points: spent.state.points + 10,
        estate: {
          ...spent.state.estate,
          activeLocation: locationId,
          exploreCountToday: exploreIndex,
        },
        flash: `Quiet stroll at ${locDef.label} (+10 MP).`,
      },
      event: null,
      quietStroll: true,
      message: `Quiet stroll at ${locDef.label} (+10 MP).`,
    };
  }

  const picked =
    (forceEventId ? candidates.find((c) => c.id === forceEventId) : undefined) ??
    pickWeighted(candidates, (c) => c.weight);

  const spent = spendDayAp(state, actionKey, {
    text: `Explored ${locDef.label}: ${picked.title}`,
    kind: 'explore',
    art: picked.artKey,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      event: null,
      quietStroll: false,
      message: spent.state.flash,
    };
  }

  return {
    ok: true,
    state: {
      ...spent.state,
      estate: {
        ...spent.state.estate,
        activeLocation: `${locationId}:${picked.id}`,
        exploreCountToday: exploreIndex,
      },
      flash: `Encountered "${picked.title}" at ${locDef.label}! Choose a response.`,
    },
    event: picked,
    quietStroll: false,
    message: picked.title,
    artUrl: resolveSceneAsset(picked.artKey),
  };
}

function applyExploreEffectSpec(
  state: GameState,
  eff: ExploreEffectSpec,
  forceSuccess?: boolean
): { state: GameState; branchHit: boolean | null } {
  let next = state;
  let branchHit: boolean | null = null;

  if (eff.chance) {
    const appShift =
      next.town.approval >= 80 ? 0.1 : next.town.approval < 20 ? -0.1 : 0;
    const p = clamp(eff.chance.p + appShift, 0.05, 0.95);
    branchHit = forceSuccess !== undefined ? forceSuccess : Math.random() < p;
    const sub = applyExploreEffectSpec(
      next,
      branchHit ? eff.chance.success : eff.chance.fail,
      forceSuccess
    );
    next = sub.state;
  }

  if (eff.mp) {
    next = { ...next, points: Math.max(0, next.points + eff.mp) };
  }
  if (eff.fear) {
    next = { ...next, fear: clamp(next.fear + eff.fear, 0, 100) };
  }
  if (eff.lust) {
    next = { ...next, lust: clamp(next.lust + eff.lust, 0, 100) };
  }
  if (eff.famePt) {
    next = { ...next, famePoints: clamp(next.famePoints + eff.famePt, 0, 100) };
  }
  if (eff.intel) {
    next = {
      ...next,
      estate: {
        ...next.estate,
        perks: {
          ...next.estate.perks,
          prepIntelOnce: true,
        },
      },
    };
  }
  if (eff.order || eff.approval || eff.pop || eff.taxNext) {
    next = {
      ...next,
      town: {
        ...next.town,
        order: clamp(next.town.order + (eff.order ?? 0), 0, 100),
        approval: clamp(next.town.approval + (eff.approval ?? 0), 0, 100),
        pop: Math.max(0, next.town.pop + (eff.pop ?? 0)),
      },
      estate: {
        ...next.estate,
        perks: {
          ...next.estate.perks,
          taxNext: (next.estate.perks.taxNext ?? 0) + (eff.taxNext ?? 0),
        },
      },
    };
  }
  if (eff.patience || eff.debtCut) {
    const cut = eff.debtCut ?? 0;
    const remExtra = Math.min(next.debt.extraLoan, cut);
    const remPrincipal = Math.min(next.debt.amount, cut - remExtra);
    next = {
      ...next,
      debt: {
        ...next.debt,
        patience: clamp(next.debt.patience + (eff.patience ?? 0), 0, 100),
        extraLoan: next.debt.extraLoan - remExtra,
        amount: next.debt.amount - remPrincipal,
      },
    };
  }
  if (eff.affV) next = grantOfficerAffinity(next, 'vesper', eff.affV).state;
  if (eff.affL) next = grantOfficerAffinity(next, 'lilim', eff.affL).state;
  if (eff.affE) next = grantOfficerAffinity(next, 'eleonora', eff.affE).state;

  if ((eff.prisCorr || eff.prisResist) && next.prisoners.length > 0) {
    const targetIdx = 0;
    const p = next.prisoners[targetIdx];
    const updated: Prisoner = {
      ...p,
      corr: clamp(p.corr + (eff.prisCorr ?? 0), 0, 100),
      resist: clamp(p.resist + (eff.prisResist ?? 0), 0, 100),
    };
    const nextPrisoners = [...next.prisoners];
    nextPrisoners[targetIdx] = updated;
    next = { ...next, prisoners: nextPrisoners };
  }

  if (eff.sellBestMult && next.prisoners.length > 0) {
    let bestIdx = 0;
    let bestVal = calcPrisonerRansom(next, next.prisoners[0], true);
    for (let i = 1; i < next.prisoners.length; i++) {
      const val = calcPrisonerRansom(next, next.prisoners[i], true);
      if (val > bestVal) {
        bestIdx = i;
        bestVal = val;
      }
    }
    const sold = next.prisoners[bestIdx];
    const payout = Math.floor(bestVal * eff.sellBestMult);
    next = {
      ...next,
      points: next.points + payout,
      prisoners: next.prisoners.filter((p) => p.pid !== sold.pid),
    };
  }

  return { state: next, branchHit };
}

export function resolveExploreEvent(
  state: GameState,
  choiceIndex: 0 | 1,
  forceChanceSuccess?: boolean
): EstateActionResult {
  const active = getActiveExploreEvent(state);
  if (!active) {
    return {
      ok: false,
      state: { ...state, flash: 'No active explore event to resolve.' },
      message: 'No active explore event.',
    };
  }

  const choice = active.choices[choiceIndex];
  if (!choice) {
    return {
      ok: false,
      state: { ...state, flash: 'Invalid event choice.' },
      message: 'Invalid choice.',
    };
  }
  if (choice.cost && state.points < choice.cost) {
    return {
      ok: false,
      state: { ...state, flash: `Need ${choice.cost} MP for "${choice.label}".` },
      message: 'Insufficient MP.',
    };
  }
  if (choice.requiresPrisoners && state.prisoners.length < choice.requiresPrisoners) {
    return {
      ok: false,
      state: { ...state, flash: `Requires at least ${choice.requiresPrisoners} captive(s).` },
      message: 'Insufficient captives.',
    };
  }

  const afterCost: GameState = {
    ...state,
    points: state.points - (choice.cost ?? 0),
  };
  const applied = applyExploreEffectSpec(afterCost, choice.eff, forceChanceSuccess);
  const dayNum = state.day || state.wave;
  const branchText =
    applied.branchHit === null
      ? ''
      : applied.branchHit
        ? ' [Success]'
        : ' [Failed]';

  let next: GameState = {
    ...applied.state,
    estate: {
      ...applied.state.estate,
      activeLocation: active.loc,
      crisisCooldowns: {
        ...applied.state.estate.crisisCooldowns,
        [`ev_${active.id}`]: dayNum + 3,
      },
    },
    dayLines: [
      ...applied.state.dayLines,
      {
        text: `${active.title} — ${choice.label}${branchText} (${choice.outcomeText})`,
        kind: 'explore',
        art: active.artKey,
      },
    ],
    flash: `${active.title}: ${choice.label}${branchText}.`,
  };

  if (!next.debt.ended && getTotalDebt(next) <= 0) {
    next = checkDebtPayoffEnding(next);
  }

  return {
    ok: true,
    state: next,
    message: `${active.title}: ${choice.label}${branchText}.`,
    artUrl: resolveSceneAsset(active.artKey),
  };
}

// --- Estate Modifiers on Raid ---

export function getEstateRaidModifiers(state: GameState): EstateRaidModifiers {
  const t = state.town;
  const fac = state.estate.facilities;
  const notes: string[] = [];

  const leakedFloors = t.approval < 20 ? 2 : t.approval < 40 ? 1 : 0;
  if (leakedFloors > 0) notes.push(`Low Approval leaks ${leakedFloors} floor(s) (DC -2)`);

  let firstRoomDcDelta = 0;
  if (t.approval >= 60 && t.approval < 80) {
    firstRoomDcDelta += 1;
    notes.push('Content Town: 1F DC +1');
  }
  if ((fac.grail ?? 0) >= 1) {
    firstRoomDcDelta += 1;
    notes.push('Blood Grail: 1F DC +1');
  }

  let allFloorsDcDelta = 0;
  if (t.food < 20) {
    allFloorsDcDelta -= 1;
    notes.push('Food < 20: All floors DC -1');
  }
  if ((fac.workshop ?? 0) >= 3) {
    allFloorsDcDelta += 1;
    notes.push('Arcane Workshop Lv.3: All floors DC +1');
  }

  const prepIntelDelta = t.approval >= 80 ? 1 : 0;
  if (prepIntelDelta > 0) notes.push('Adoring Town: Prep Intel +1');

  const orderMult = t.order < 20 ? 1.2 : t.order < 40 ? 1.1 : 1.0;
  const houseCut = t.housing >= 80 ? 0.08 : t.housing >= 60 ? 0.04 : 0;
  const buildCostMult = Math.max(0.7, orderMult - houseCut);

  const coreCaptureBonus =
    (t.order >= 80 ? 0.1 : t.order >= 60 ? 0.05 : 0) +
    ((fac.watch ?? 0) >= 3 ? 0.1 : 0);

  const guardDcBonus = t.food >= 60 ? 1 : 0;
  const critRoomSaveChance = Math.min(0.75, 0.25 * (fac.workshop ?? 0));
  const ransomBonusMult = t.renown >= 80 ? 1.15 : t.renown >= 60 ? 1.1 : 1.0;

  return {
    leakedFloors,
    firstRoomDcDelta,
    allFloorsDcDelta,
    prepIntelDelta,
    buildCostMult,
    coreCaptureBonus,
    guardDcBonus,
    critRoomSaveChance,
    ransomBonusMult,
    servantMpHalved: t.food < 20,
    notes,
  };
}

// --- M.Settle Deterministic Ledger ---

export function computeManagementSettle(
  state: GameState,
  options?: { allowRiot?: boolean }
): ManagementSettleLedger {
  const t = state.town;
  const fac = state.estate.facilities;
  const popCap = calcPopCap(state);
  const policy = TOWN_POLICY_MODS[t.policy] ?? TOWN_POLICY_MODS.normal;

  // 1. Prisoner conversions & jobs
  let servantMp = 0;
  let jobMp = 0;
  let jobFood = 0;
  let jobApproval = 0;
  let jobOrder = 0;
  let jobRenown = 0;
  let dancerCount = 0;
  let hiredSalary = 0;
  let servantLust = 0;
  let petLust = 0;

  for (const p of state.prisoners) {
    if (p.converted === 'servant') {
      const baseServant = SERVANT_MP_BY_GRADE[p.grade] ?? 9;
      servantMp += t.food < 20 ? Math.floor(baseServant * 0.5) : baseServant;
      servantLust += 2;
    } else if (p.converted === 'pet') {
      petLust += 3;
    } else if (p.converted === 'dancer') {
      dancerCount += 1;
      jobApproval += 1;
    } else if (p.converted === 'hired') {
      hiredSalary += 5;
    }

    if (p.job) {
      const mult = p.converted === 'hired' ? 2 : 1;
      if (p.job === 'farm') jobFood += 3 * mult;
      else if (p.job === 'dairy') jobFood += 2 * mult;
      else if (p.job === 'bath' || p.job === 'brothel') {
        jobMp += 6 * mult;
        jobApproval += 1 * mult;
      } else if (p.job === 'square' || p.job === 'tavern') {
        jobMp += 5 * mult;
      } else if (p.job === 'barracks') {
        jobOrder += 2 * mult;
      } else if (p.job === 'arena') {
        jobRenown += 1 * mult;
        jobMp += 4 * mult;
      } else {
        jobMp += 4 * mult;
      }
    }
  }

  // 2. Food production & consumption
  const witchFood = state.war.rivals.witch.annexed ? WAR_CFG.WIT_FOOD : 0;
  const foodProd = 8 + 3 * (fac.farmland ?? 0) + (fac.dairy ?? 0) + jobFood + witchFood;
  const foodEat = Math.ceil((t.pop / Math.max(1, popCap)) * 10);
  const foodAfter = clamp(t.food + foodProd - foodEat, 0, 100);

  let popAfter = t.pop;
  let approvalAfter = t.approval;
  let famineStreak = t.famine;
  if (foodAfter <= 0) {
    famineStreak += 1;
    popAfter = Math.floor(popAfter * 0.95);
    approvalAfter = clamp(approvalAfter - 6, 0, 100);
  } else {
    famineStreak = 0;
  }
  if (foodAfter < 20) {
    approvalAfter = clamp(approvalAfter - 3, 0, 100);
  }

  // 3. Housing
  const housingDecay = popAfter >= popCap * 0.9 ? 3 : 1;
  const housingAfter = clamp(
    t.housing - housingDecay + 2 * (fac.housing ?? 0),
    0,
    100
  );
  if (housingAfter < 25) {
    approvalAfter = clamp(approvalAfter - 2, 0, 100);
  }

  // 4. Approval & Order
  approvalAfter = clamp(
    approvalAfter +
      (t.approval < 40 ? 2 : 0) +
      policy.approvalDelta +
      (fac.brothel ?? 0) -
      (fac.shrine ?? 0) +
      2 * (fac.bath ?? 0) +
      jobApproval +
      (state.fear >= 50 ? -1 : 0) +
      (t.order < 30 ? -2 : 0),
    0,
    100
  );

  let orderAfter = clamp(
    t.order +
      (t.order < 40 ? 2 : 0) +
      policy.orderDelta +
      ((fac.manor ?? 0) >= 3 ? 3 : 0) +
      (state.fear >= 50 ? 1 : 0) +
      t.guard +
      2 * (fac.watch ?? 0) +
      jobOrder +
      Math.floor(state.officers.vesper.aff / 25),
    0,
    100
  );

  // 5. Tax & Riot
  let taxIncome = calcTownTax(state);
  let rioted = false;
  let riotMpLoss = 0;
  let renownAfter = t.renown;

  if (options?.allowRiot && (orderAfter < 30 || approvalAfter < 20)) {
    const riotChance = orderAfter < 30 && approvalAfter < 20 ? 0.5 : 0.3;
    if (Math.random() < riotChance) {
      rioted = true;
      taxIncome = 0;
      riotMpLoss = Math.floor(state.points * 0.15);
      popAfter = Math.floor(popAfter * 0.9);
      renownAfter = clamp(renownAfter - 10, 0, 100);
    }
  }

  // 6. Dancer MP, Pop Growth, Renown
  const dancerMp = Math.floor((t.lastTax || taxIncome) * 0.1 * dancerCount);

  if (approvalAfter < 30) {
    popAfter = Math.floor(popAfter * 0.95);
  } else if (popAfter < popCap && foodAfter >= 20) {
    const growRate = 0.1 * (approvalAfter / 50) * (renownAfter < 20 ? 0.5 : 1);
    const grow = Math.floor((popCap - popAfter) * growRate + 0.5);
    popAfter = Math.min(popCap, popAfter + Math.max(0, grow));
  }

  const titleAfter = getTownTitle({
    ...state,
    town: { ...t, pop: popAfter, approval: approvalAfter, order: orderAfter, lastTax: taxIncome },
  });
  renownAfter = clamp(
    renownAfter +
      (titleAfter.grade === 'S' ? 2 : titleAfter.grade === 'A' ? 1 : 0) +
      (fac.trade ?? 0) +
      2 * (fac.arena ?? 0) +
      (state.officers.eleonora.stage >= 4 ? 1 : 0) +
      jobRenown -
      (renownAfter > 70 ? 1 : 0) +
      (renownAfter < 30 ? 1 : 0),
    0,
    100
  );

  const popManaIncome = Math.min(50, 5 * Math.floor(popAfter / 100));
  const rawBase = getTownLevelDef(t.lv).baseIncome;
  const baseIncome = Math.round(
    rawBase * (state.relics.owned.includes('crown') ? 1.1 : 1)
  );
  const vesperBonusMp = state.officers.vesper.stage >= 3 ? 10 : 0;
  const eleonoraRomanceMp =
    state.debt.ended === 'romance' || state.debt.ended === 'romance_dowry'
      ? 30
      : 0;
  const upkeepCost = getTownLevelDef(t.lv).upkeep;
  const annexedCount = (['paladin', 'merchant', 'witch'] as const).filter(
    (k) => state.war.rivals[k].annexed
  ).length;
  const annexIncome = annexedCount * (30 + 10 * t.lv - 10);

  const vaultCap = 150 * t.lv;
  const vaultDeposit = Math.min(
    Math.max(0, vaultCap - state.estate.vaultMp),
    Math.round((taxIncome + baseIncome) * 0.25)
  );
  const vaultAfter = state.estate.vaultMp + vaultDeposit;

  const netMpDelta =
    taxIncome +
    baseIncome +
    annexIncome +
    popManaIncome +
    servantMp +
    jobMp +
    dancerMp +
    vesperBonusMp +
    eleonoraRomanceMp -
    hiredSalary -
    upkeepCost -
    riotMpLoss -
    vaultDeposit;
  const pointsAfter = Math.max(0, state.points + netMpDelta);

  // 7. Fear & Lust additions + 0.85 decay
  const fearWithFac = clamp(
    state.fear + 2 * (fac.shrine ?? 0) + (fac.arena ?? 0),
    0,
    100
  );
  const lustWithFac = clamp(
    state.lust + 2 * (fac.brothel ?? 0) + 2 * (fac.beastpen ?? 0) + servantLust + petLust,
    0,
    100
  );
  const fearAfter = Math.floor(fearWithFac * CFG.DECAY);
  const lustAfter = Math.floor(lustWithFac * CFG.DECAY);

  // 8. Debt interest
  let debtInterestPrincipal = 0;
  let debtInterestExtra = 0;
  const interestWaived = Boolean(state.debt.noInterest);
  if (!state.debt.ended && getTotalDebt(state) > 0 && !interestWaived) {
    const casMult = state.settings.difficulty === 'casual' ? 0.5 : 1;
    const rate = (state.officers.eleonora.stage >= 1 ? 0.008 : 0.01) * casMult;
    debtInterestPrincipal = Math.ceil(state.debt.amount * rate);
    if (state.debt.extraLoan > 0) {
      debtInterestExtra = Math.ceil(state.debt.extraLoan * 0.03 * casMult);
    }
  }

  // 9. Riot Streak & Game Over check
  let riotStreak = approvalAfter <= 10 && orderAfter <= 10 ? t.riot + 1 : 0;
  let pendingGameOver: 'ruin' | 'famine' | 'riot' | null = null;
  if (popAfter <= 0) pendingGameOver = 'ruin';
  else if (famineStreak >= 3) pendingGameOver = 'famine';
  else if (riotStreak >= 3) pendingGameOver = 'riot';

  let casualGraceTriggered = false;
  if (
    pendingGameOver &&
    state.settings.difficulty === 'casual' &&
    !state.estate.casualGraceUsed
  ) {
    casualGraceTriggered = true;
    if (pendingGameOver === 'ruin') popAfter = Math.max(popAfter, 15);
    if (pendingGameOver === 'famine') famineStreak = 0;
    if (pendingGameOver === 'riot') {
      riotStreak = 0;
      approvalAfter = clamp(approvalAfter + 15, 0, 100);
      orderAfter = clamp(orderAfter + 15, 0, 100);
    }
    pendingGameOver = null;
  }

  const lines: { label: string; deltaText: string }[] = [
    {
      label: `Domain Tax (${t.policy.toUpperCase()})`,
      deltaText: rioted ? '0 MP (RIOT!)' : `+${taxIncome} MP`,
    },
    {
      label: `Base Income (${getTownLevelDef(t.lv).name})`,
      deltaText: `+${baseIncome} MP`,
    },
    {
      label: `Population Mana (${popAfter} pop)`,
      deltaText: `+${popManaIncome} MP`,
    },
    {
      label: 'Food Production / Consumption',
      deltaText: `+${foodProd} / -${foodEat} (Food ${t.food} -> ${foodAfter})`,
    },
    {
      label: 'Housing & Population',
      deltaText: `Housing ${t.housing} -> ${housingAfter} · Pop ${t.pop} -> ${popAfter}/${popCap}`,
    },
    {
      label: 'Order & Approval',
      deltaText: `Order ${t.order} -> ${orderAfter} · Approval ${t.approval} -> ${approvalAfter}`,
    },
  ];
  if (servantMp + jobMp + dancerMp > 0) {
    lines.push({
      label: 'Prisoner Jobs / Servants / Dancers',
      deltaText: `+${servantMp + jobMp + dancerMp} MP`,
    });
  }
  if (vesperBonusMp > 0) {
    lines.push({ label: 'Vesper Stage 3 Management Bonus', deltaText: `+${vesperBonusMp} MP` });
  }
  if (eleonoraRomanceMp > 0) {
    lines.push({ label: 'Goldreich Romance Dividend', deltaText: `+${eleonoraRomanceMp} MP` });
  }
  if (annexIncome > 0) {
    lines.push({
      label: `Annexed Territories (${annexedCount}) Net Income`,
      deltaText: `+${annexIncome} MP`,
    });
  }
  if (hiredSalary > 0) {
    lines.push({ label: 'Hired Staff Salaries', deltaText: `-${hiredSalary} MP` });
  }
  if (upkeepCost > 0) {
    lines.push({ label: 'Royal / Demon Capital Upkeep', deltaText: `-${upkeepCost} MP` });
  }
  if (vaultDeposit > 0) {
    lines.push({
      label: 'Estate Vault Reserve (25%)',
      deltaText: `-${vaultDeposit} MP (Vault ${vaultAfter}/${vaultCap})`,
    });
  }
  if (debtInterestPrincipal + debtInterestExtra > 0) {
    lines.push({
      label: 'Debt Interest Accrued',
      deltaText: `+${debtInterestPrincipal + debtInterestExtra} MP debt`,
    });
  } else if (interestWaived) {
    lines.push({ label: 'Debt Interest', deltaText: 'Waived (Eleonora E8)' });
  }

  return {
    wave: state.wave,
    popBefore: t.pop,
    popAfter,
    popCap,
    approvalBefore: t.approval,
    approvalAfter,
    orderBefore: t.order,
    orderAfter,
    housingBefore: t.housing,
    housingAfter,
    foodBefore: t.food,
    foodAfter,
    foodProd,
    foodEat,
    renownBefore: t.renown,
    renownAfter,
    taxIncome,
    baseIncome,
    popManaIncome,
    servantMp,
    jobMp,
    dancerMp,
    vesperBonusMp,
    eleonoraRomanceMp,
    hiredSalary,
    upkeepCost,
    vaultDeposit,
    vaultAfter,
    vaultCap,
    rioted,
    riotMpLoss,
    netMpDelta,
    pointsAfter,
    debtInterestPrincipal,
    debtInterestExtra,
    interestWaived,
    fearBefore: state.fear,
    fearAfter,
    lustBefore: state.lust,
    lustAfter,
    famineStreak,
    riotStreak,
    pendingGameOver,
    casualGraceTriggered,
    lines,
  };
}

// --- 16 Settlement Crises ---

export function getEligibleSettlementCrises(
  state: GameState
): { def: SettlementCrisisDef; weight: number }[] {
  const t = state.town;
  const popCap = calcPopCap(state);
  const cdMap = state.estate.crisisCooldowns;
  const out: { def: SettlementCrisisDef; weight: number }[] = [];

  for (const def of SETTLEMENT_CRISES) {
    const lastWave = cdMap[def.id];
    if (lastWave !== undefined && state.wave - lastWave < 4) continue;

    let eligible = false;
    let dist = 0;

    switch (def.id) {
      case 'famine':
        eligible = t.food < 25;
        dist = (25 - t.food) / 25;
        break;
      case 'unrest':
        eligible = t.approval < 30;
        dist = (30 - t.approval) / 30;
        break;
      case 'smuggler':
        eligible = t.order < 30;
        dist = (30 - t.order) / 30;
        break;
      case 'fire':
        eligible = t.housing < 25;
        dist = (25 - t.housing) / 25;
        break;
      case 'plague':
        eligible = t.housing < 25 && t.pop >= 100;
        dist = (25 - t.housing) / 25;
        break;
      case 'envoy':
        eligible = t.renown >= 60;
        dist = (t.renown - 60) / 40;
        break;
      case 'caravan':
        eligible = t.renown >= 50 && t.approval >= 60;
        dist = Math.min((t.renown - 50) / 50, (t.approval - 60) / 40);
        break;
      case 'harvest':
        eligible = t.approval >= 70 && t.food >= 50;
        dist = Math.min((t.approval - 70) / 30, (t.food - 50) / 50);
        break;
      case 'migrants':
        eligible = t.pop >= popCap * 0.9 || t.housing >= 70;
        dist = Math.max((t.housing - 70) / 30, (t.pop / popCap - 0.9) / 0.1);
        break;
      case 'pilgrims':
        eligible = state.fear >= 50 || (state.estate.facilities.shrine ?? 0) >= 1;
        dist = Math.max(
          (state.fear - 50) / 50,
          (state.estate.facilities.shrine ?? 0) >= 1 ? 0.5 : 0
        );
        break;
      case 'bumper':
        eligible = t.food >= 60 && (state.estate.facilities.farmland ?? 0) >= 2;
        dist = (t.food - 60) / 40;
        break;
      case 'militia':
        eligible = t.order >= 70 && t.approval >= 60;
        dist = Math.min((t.order - 70) / 30, (t.approval - 60) / 40);
        break;
      case 'bards':
      case 'peddler':
      case 'rumor':
      case 'storm':
        eligible = true;
        dist = 0;
        break;
    }

    if (!eligible) continue;
    let w = def.weight * (1 + 2 * clamp(dist, 0, 1));
    if (state.estate.lastCrises.includes(def.id)) {
      w *= 0.2;
    }
    out.push({ def, weight: w });
  }

  return out;
}

export function rollSettlementCrisis(
  state: GameState,
  options?: { forceChance?: boolean; forceCrisisId?: string }
): { state: GameState; crisis: SettlementCrisisDef | null } {
  if (state.estate.activeCrisis) {
    return {
      state,
      crisis: SETTLEMENT_CRISIS_MAP[state.estate.activeCrisis] ?? null,
    };
  }

  if (options?.forceCrisisId) {
    const forced = SETTLEMENT_CRISIS_MAP[options.forceCrisisId] ?? null;
    if (!forced) return { state, crisis: null };
    return {
      crisis: forced,
      state: {
        ...state,
        estate: {
          ...state.estate,
          activeCrisis: forced.id,
          crisisCooldowns: { ...state.estate.crisisCooldowns, [forced.id]: state.wave },
          lastCrises: [forced.id, ...state.estate.lastCrises].slice(0, 2),
        },
      },
    };
  }

  const eligible = getEligibleSettlementCrises(state);
  if (eligible.length === 0) return { state, crisis: null };
  if (!options?.forceChance && Math.random() >= 0.7) {
    return { state, crisis: null };
  }

  const picked = pickWeighted(eligible, (e) => e.weight).def;
  return {
    crisis: picked,
    state: {
      ...state,
      estate: {
        ...state.estate,
        activeCrisis: picked.id,
        crisisCooldowns: { ...state.estate.crisisCooldowns, [picked.id]: state.wave },
        lastCrises: [picked.id, ...state.estate.lastCrises].slice(0, 2),
      },
    },
  };
}

export function applyManagementSettle(
  state: GameState,
  options?: {
    allowRiot?: boolean;
    rollCrisis?: boolean;
    forceCrisisChance?: boolean;
    forceCrisisId?: string;
    forceSiege?: boolean;
    forceJailbreak?: boolean;
  }
): { state: GameState; ledger: ManagementSettleLedger; crisis: SettlementCrisisDef | null } {
  const ledger = computeManagementSettle(state, { allowRiot: options?.allowRiot });

  // Prisoner stamina recovery & Reformatory passive resist drop
  const foodAfter = ledger.foodAfter;
  const spaLv = state.estate.facilities.spa ?? 0;
  const spaRegen = [0, 5, 10, 20][spaLv] ?? 0;
  const baseStamRegen = foodAfter >= 60 ? 25 : foodAfter >= 20 ? 15 : 0;
  const reformLv = state.estate.facilities.reform ?? 0;
  const reformDrop = [0, 3, 5, 8][reformLv] ?? 0;

  let nextPrisoners = state.prisoners.map((p) => {
    const nextStam = clamp(p.stamina + baseStamRegen + spaRegen, 0, p.staminaMax);
    const drop = p.job || p.legend ? Math.floor(reformDrop / 2) : reformDrop;
    const nextResist = clamp(p.resist - drop, 0, 100);
    const healInj = spaLv >= 2 && p.cond === 'injured' ? '' : p.cond;
    return {
      ...p,
      stamina: nextStam,
      dying: nextStam >= 20 ? false : p.dying,
      resist: nextResist,
      cond: healInj as Prisoner['cond'],
    };
  });

  // Pet owner affinity gain
  let working: GameState = {
    ...state,
    points: ledger.pointsAfter,
    fear: ledger.fearAfter,
    lust: ledger.lustAfter,
    prisoners: nextPrisoners,
    town: {
      ...state.town,
      pop: ledger.popAfter,
      approval: ledger.approvalAfter,
      order: ledger.orderAfter,
      housing: ledger.housingAfter,
      food: ledger.casualGraceTriggered && ledger.foodAfter <= 0 ? 30 : ledger.foodAfter,
      renown: ledger.renownAfter,
      famine: ledger.famineStreak,
      riot: ledger.riotStreak,
      lastTax: ledger.taxIncome,
    },
    estate: {
      ...state.estate,
      vaultMp: ledger.vaultAfter,
      casualGraceUsed: state.estate.casualGraceUsed || ledger.casualGraceTriggered,
      trailingIncome: [...state.estate.trailingIncome, ledger.taxIncome + ledger.baseIncome].slice(-3),
      perks: {
        ...state.estate.perks,
        taxNext: 0,
      },
    },
    debt: {
      ...state.debt,
      amount: state.debt.amount + ledger.debtInterestPrincipal,
      extraLoan: state.debt.extraLoan + ledger.debtInterestExtra,
      noInterest: false,
    },
  };

  for (const p of state.prisoners) {
    if (p.converted === 'pet') {
      const targetOfficer = p.owner === 'L' ? 'lilim' : 'vesper';
      working = grantOfficerAffinity(working, targetOfficer, 1).state;
    }
  }

  const monsterCycle = processMonsterNightlyCycle(working);
  working = monsterCycle.state;

  if (ledger.pendingGameOver) {
    const goKey = ledger.pendingGameOver;
    return {
      state: enterGameOver(working, goKey),
      ledger,
      crisis: null,
    };
  }

  working = evaluateRankTrials(working);

  let crisis: SettlementCrisisDef | null = null;
  if (options?.rollCrisis !== false) {
    const rolled = rollSettlementCrisis(working, {
      forceChance: options?.forceCrisisChance,
      forceCrisisId: options?.forceCrisisId,
    });
    working = rolled.state;
    crisis = rolled.crisis;
  }

  // Major Crises checks during M.Settle: Royal Siege Bo3 & Prison Jailbreak
  if (options?.rollCrisis !== false || options?.forceSiege || options?.forceJailbreak) {
    if (
      !working.crises.siege.active &&
      working.wave >= working.crises.siege.cooldown &&
      (options?.forceSiege || (isSiegeEligible(working) && Math.random() < calcSiegeChance(working)))
    ) {
      working = {
        ...working,
        crises: {
          ...working.crises,
          siege: { active: true, day: 0, wins: 0, losses: 0, cooldown: working.wave },
          lastCrisisCard: {
            kind: 'siege',
            title: '3-Day Royal Siege!',
            subtitle: `Wave ${working.wave} — Best-of-3 Domain Defense`,
            body: `Royal armies surround the walls! Current Siege Defense: ${calcSiegeDefense(working)}. Win 2 of 3 encounters before leaving Management Settlement.`,
            assetKey: 'dk_cr_siege',
            wave: working.wave,
            resolved: false,
          },
        },
      };
    }

    const highResistCount = working.prisoners.filter(
      (p) => p.resist >= CRISIS_CFG.JAIL_RES && p.job !== 'trusty'
    ).length;
    const hasTrusty = working.prisoners.some((p) => p.job === 'trusty');
    const jailP = hasTrusty ? CRISIS_CFG.JAIL_TRUSTY_P : CRISIS_CFG.JAIL_P;
    if (
      !working.crises.jailbreakPending &&
      (options?.forceJailbreak || (highResistCount >= CRISIS_CFG.JAIL_NUM && Math.random() < jailP))
    ) {
      working = {
        ...working,
        crises: {
          ...working.crises,
          jailbreakPending: true,
          lastCrisisCard: {
            kind: 'jailbreak',
            title: 'Prison Jailbreak Plot!',
            subtitle: `${highResistCount} High-Resistance Prisoners Conspiring`,
            body: 'Lockpicks and filed bars discovered in the dungeon cells! Suppress the revolt before leaving Management Settlement.',
            assetKey: 'dk_cr_jailbreak',
            wave: working.wave,
            resolved: false,
          },
        },
      };
    }
  }

  return {
    state: {
      ...working,
      flash: crisis
        ? `M.Settle complete (${ledger.netMpDelta >= 0 ? '+' : ''}${ledger.netMpDelta} MP). Crisis: ${crisis.title}!`
        : working.crises.siege.active
          ? 'M.Settle: Royal Siege Bo3 awaits defense!'
          : working.crises.jailbreakPending
            ? 'M.Settle: Prison Jailbreak plot requires suppression!'
            : `M.Settle complete (${ledger.netMpDelta >= 0 ? '+' : ''}${ledger.netMpDelta} MP).`,
    },
    ledger,
    crisis,
  };
}

export function resolveSettlementCrisis(
  state: GameState,
  choiceIndex: 0 | 1,
  forceModProc?: boolean
): EstateActionResult {
  const crisisId = state.estate.activeCrisis;
  if (!crisisId) {
    return {
      ok: false,
      state: { ...state, flash: 'No active settlement crisis.' },
      message: 'No active crisis.',
    };
  }
  const def = SETTLEMENT_CRISIS_MAP[crisisId];
  if (!def) {
    return {
      ok: false,
      state: {
        ...state,
        estate: { ...state.estate, activeCrisis: null },
        flash: 'Cleared unknown crisis.',
      },
      message: 'Unknown crisis cleared.',
    };
  }

  const choice = def.choices[choiceIndex];
  if (!choice) {
    return {
      ok: false,
      state: { ...state, flash: 'Invalid crisis choice.' },
      message: 'Invalid crisis choice.',
    };
  }
  if (state.points < choice.mpCost) {
    return {
      ok: false,
      state: { ...state, flash: `Need ${choice.mpCost} MP for "${choice.label}".` },
      message: 'Insufficient MP.',
    };
  }

  const fx = choice.effects;
  let nextPop = state.town.pop;
  if (fx.popPct) {
    nextPop = Math.max(0, Math.floor(nextPop * (1 + fx.popPct)));
  }

  let nextRaidMods = state.crises.activeRaidMods;
  let modText = '';
  if (choice.raidMod) {
    const proc =
      choice.raidMod.chance === undefined
        ? true
        : forceModProc !== undefined
          ? forceModProc
          : Math.random() < choice.raidMod.chance;
    if (proc) {
      nextRaidMods = [
        ...nextRaidMods,
        { key: choice.raidMod.key, value: choice.raidMod.value },
      ];
      modText = ` · Next Raid: ${choice.raidMod.label}`;
    }
  }

  const next: GameState = {
    ...state,
    points: Math.max(0, state.points - choice.mpCost + (fx.mp ?? 0)),
    fear: clamp(state.fear + (fx.fear ?? 0), 0, 100),
    lust: clamp(state.lust + (fx.lust ?? 0), 0, 100),
    town: {
      ...state.town,
      pop: nextPop,
      food: clamp(state.town.food + (fx.food ?? 0), 0, 100),
      approval: clamp(state.town.approval + (fx.approval ?? 0), 0, 100),
      order: clamp(state.town.order + (fx.order ?? 0), 0, 100),
      housing: clamp(state.town.housing + (fx.housing ?? 0), 0, 100),
      renown: clamp(state.town.renown + (fx.renown ?? 0), 0, 100),
      guard: state.town.guard + (fx.guard ?? 0),
    },
    estate: {
      ...state.estate,
      activeCrisis: null,
    },
    crises: {
      ...state.crises,
      activeRaidMods: nextRaidMods,
    },
    flash: `Crisis Resolved — ${def.title}: ${choice.label}${modText}`,
  };

  return {
    ok: true,
    state: next,
    message: `${def.title}: ${choice.label}${modText}`,
    artUrl: resolveSceneAsset(def.artKey),
  };
}


export function buildLandmark(state: GameState, key: LandmarkKey): EstateActionResult {
  if (!isDayPhase(state)) {
    return {
      ok: false,
      state: { ...state, flash: 'Landmarks can only be constructed during the Day phase.' },
      message: 'Requires Day phase.',
    };
  }
  const def = LANDMARK_DEFS[key];
  if (!def) {
    return { ok: false, state, message: 'Unknown landmark.' };
  }
  if (state.town.lv < def.reqTownLv) {
    const msg = `${def.name} requires Town Lv.${def.reqTownLv}.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (state.estate.landmarks[key]) {
    const msg = `${def.name} is already constructed.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (state.points < def.cost) {
    const msg = `${def.name} requires ${def.cost} MP.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }

  const label = `Built ${def.icon} ${def.name} (-${def.cost} MP)`;
  const next: GameState = {
    ...state,
    points: state.points - def.cost,
    estate: {
      ...state.estate,
      landmarks: {
        ...state.estate.landmarks,
        [key]: true,
      },
    },
    dayLines: [
      ...state.dayLines,
      {
        text: `${label} — ${def.effectDesc}`,
        star: true,
        kind: 'facility',
        art: def.assetKey,
      },
    ],
    flash: label,
  };
  return {
    ok: true,
    state: next,
    message: label,
    artUrl: resolveSceneAsset(def.assetKey),
  };
}

export function isWarOpen(state: GameState): boolean {
  if (state.endings.endless || Object.keys(state.endings.unlocked).length > 0) return true;
  return state.wave >= WAR_CFG.FROM_W && state.town.lv >= WAR_CFG.FROM_LV;
}

export function getWarAnnexedCount(state: GameState): number {
  return (['paladin', 'merchant', 'witch'] as const).filter(
    (k) => state.war.rivals[k].annexed
  ).length;
}

export function calcWarPower(state: GameState): number {
  const fac = state.estate.facilities;
  const arenaPrisoners = state.prisoners.filter((p) => p.job === 'arena').length;
  const hiredStaff = state.prisoners.filter((p) => p.converted === 'hired').length;
  const guards = state.prisoners.filter((p) => p.converted === 'guard').length;
  return (
    state.town.guard +
    (fac.watch ?? 0) +
    (fac.arena ?? 0) +
    arenaPrisoners * 2 +
    hiredStaff * 2 +
    guards
  );
}

export function performWarAction(
  state: GameState,
  action: 'scout' | 'raid' | 'annex',
  rivalKey: WarRivalKey,
  forceWin?: boolean
): EstateActionResult {
  if (!isDayPhase(state)) {
    const msg = 'War & Territory actions are only available in the Day phase.';
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (!isWarOpen(state)) {
    const msg = `War & Territory unlocks at Wave ${WAR_CFG.FROM_W}+ and Town Lv.${WAR_CFG.FROM_LV}+.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  const rival = state.war.rivals[rivalKey];
  const def = WAR_RIVALS[rivalKey];
  if (!rival || !def || rival.annexed) {
    return { ok: false, state, message: 'Territory already annexed or invalid.' };
  }

  const apCost = action === 'scout' ? 1 : 2;
  if (state.dayClosed || state.ap < apCost) {
    const msg = `Not enough AP (requires ${apCost} AP).`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (action === 'annex' && rival.wins < 2) {
    const msg = `Must win at least 2 Raids against ${def.name} before Annexing (${rival.wins}/2).`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }

  let working: GameState = {
    ...state,
    ap: state.ap - apCost,
    apUsed: { ...state.apUsed, [`war_${action}_${rivalKey}`]: true },
  };

  if (action === 'scout') {
    const msg = `🔭 Scouted ${def.icon} ${def.name} (Defense ${rival.def}).`;
    working = {
      ...working,
      war: {
        ...working.war,
        rivals: {
          ...working.war.rivals,
          [rivalKey]: { ...rival, scouted: true },
        },
      },
      dayLines: [...working.dayLines, { text: msg, kind: 'war_scout' }],
      flash: msg,
    };
    return { ok: true, state: working, message: msg };
  }

  const pow = calcWarPower(working);
  const targetDef = rival.def + (action === 'annex' ? WAR_CFG.ANNEX_DEF : 0);
  let wins = 0;
  let losses = 0;
  const rolls: number[] = [];
  if (forceWin !== undefined) {
    wins = forceWin ? 2 : 0;
    losses = forceWin ? 0 : 2;
    rolls.push(forceWin ? 20 : 1);
  } else {
    for (let i = 0; i < 3 && wins < 2 && losses < 2; i++) {
      const r = randInt(1, 20);
      rolls.push(r);
      if (r + pow >= targetDef) wins += 1;
      else losses += 1;
    }
  }
  const won = wins >= 2;
  const rollNote = `[${rolls.join('·')} +${pow} vs ${targetDef}]`;

  if (action === 'raid') {
    if (won) {
      const lootMp = Math.floor(
        (WAR_CFG.RAID_MP + working.wave * 6) * (rivalKey === 'merchant' ? 1.5 : 1)
      );
      const foodGain = rivalKey === 'witch' ? 20 : 10;
      const lustGain = rivalKey === 'witch' ? 5 : 0;
      let nextPrisoners = working.prisoners;
      let nextPid = working.nextPid;
      let capText = '';
      if (forceWin === undefined && Math.random() < 0.3) {
        const capName =
          rivalKey === 'paladin'
            ? 'Paladin Commander'
            : rivalKey === 'merchant'
              ? 'League Guard Captain'
              : 'Mistwood Warden';
        nextPrisoners = [
          ...nextPrisoners,
          {
            pid: nextPid++,
            name: capName,
            grade: 'A',
            raceLabel: 'Human',
            classLabel: rivalKey === 'witch' ? 'Witch' : 'Knight',
            traits: ['brave'],
            capturedWave: working.wave,
            capturedFloor: 0,
            resist: 60,
            corr: 0,
            gender: rivalKey === 'witch' ? 'female' : 'male',
            stamina: 80,
            staminaMax: 100,
            pleasure: 0,
            terror: 15,
            shame: 0,
            marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
            cond: 'injured',
            job: null,
            converted: null,
            assignedFloor: null,
            owner: null,
            afflictions: [],
            virgin: false,
            breeding: null,
            intel: 0,
          },
        ];
        capText = ' · Captured Commander!';
      }

      const msg = `⚔ Raided ${def.icon} ${def.name} — VICTORY! +${lootMp} MP, +${foodGain} Food${capText} ${rollNote}`;
      working = {
        ...working,
        points: working.points + lootMp,
        lust: clamp(working.lust + lustGain, 0, 100),
        prisoners: nextPrisoners,
        nextPid,
        town: { ...working.town, food: clamp(working.town.food + foodGain, 0, 100) },
        war: {
          ...working.war,
          rivals: {
            ...working.war.rivals,
            [rivalKey]: { ...rival, wins: rival.wins + 1 },
          },
        },
        dayLines: [...working.dayLines, { text: msg, star: true, kind: 'war_raid' }],
        flash: msg,
      };
      return { ok: true, state: working, message: msg };
    }
    const lostMp = Math.min(working.points, 30);
    const msg = `⚔ Raided ${def.icon} ${def.name} — Repelled! -${lostMp} MP, -5 Approval ${rollNote}`;
    working = {
      ...working,
      points: working.points - lostMp,
      town: { ...working.town, approval: clamp(working.town.approval - 5, 0, 100) },
      dayLines: [...working.dayLines, { text: msg, kind: 'war_raid' }],
      flash: msg,
    };
    return { ok: true, state: working, message: msg };
  }

  // Annex
  if (won) {
    const titles = working.endings.titles.includes('Conqueror')
      ? working.endings.titles
      : [...working.endings.titles, 'Conqueror'];
    const msg = `🏴 Annexed ${def.icon} ${def.name}! (${def.annexBonusDesc}) ${rollNote}`;
    working = {
      ...working,
      endings: { ...working.endings, titles },
      war: {
        ...working.war,
        rivals: {
          ...working.war.rivals,
          [rivalKey]: { ...rival, annexed: true },
        },
      },
      dayLines: [
        ...working.dayLines,
        { text: msg, star: true, kind: 'war_annex', art: 'dk_war_annex' },
      ],
      flash: msg,
    };
    return { ok: true, state: working, message: msg, artUrl: resolveSceneAsset('dk_war_annex') };
  }

  const msg = `🏴 Siege of ${def.icon} ${def.name} failed! Raid wins -1 ${rollNote}`;
  working = {
    ...working,
    war: {
      ...working.war,
      rivals: {
        ...working.war.rivals,
        [rivalKey]: { ...rival, wins: Math.max(0, rival.wins - 1) },
      },
    },
    dayLines: [...working.dayLines, { text: msg, kind: 'war_annex' }],
    flash: msg,
  };
  return { ok: true, state: working, message: msg };
}

export function buildWonder(state: GameState, key: WonderKey): EstateActionResult {
  if (!isDayPhase(state)) {
    return {
      ok: false,
      state: { ...state, flash: 'Great Wonders can only be constructed in the Day phase.' },
      message: 'Requires Day phase.',
    };
  }
  const def = WONDER_DEFS[key];
  if (!def) return { ok: false, state, message: 'Unknown Wonder.' };
  if (state.wonders[key]) {
    const msg = `${def.name} is already built.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (state.dayClosed || state.ap < 1) {
    const msg = 'Requires 1 AP to commission a Great Wonder.';
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }
  if (state.points < def.cost) {
    const msg = `${def.name} requires ${def.cost} MP.`;
    return { ok: false, state: { ...state, flash: msg }, message: msg };
  }

  const msg = `Built Great Wonder ${def.icon} ${def.name} (-${def.cost} MP) — ${def.effectDesc}`;
  const next: GameState = {
    ...state,
    points: state.points - def.cost,
    ap: state.ap - 1,
    apUsed: { ...state.apUsed, [`wonder_${key}`]: true },
    wonders: { ...state.wonders, [key]: true },
    dayLines: [...state.dayLines, { text: msg, star: true, kind: 'facility' }],
    flash: msg,
  };
  return { ok: true, state: next, message: msg };
}

export function calcSiegeDefense(state: GameState): number {
  const fac = state.estate.facilities;
  const arenaOrBarracks = state.prisoners.filter(
    (p) => p.job === 'arena' || p.job === 'barracks'
  ).length;
  const hiredBonus = state.prisoners.filter((p) => p.converted === 'hired').length;
  return (
    state.town.guard +
    3 * (fac.watch ?? 0) +
    Math.floor(state.town.order / 10) +
    (state.town.food >= 60 ? 2 : 0) +
    arenaOrBarracks +
    hiredBonus +
    WAR_CFG.SIEGE_ANNEX_DEF * getWarAnnexedCount(state)
  );
}

export function isSiegeEligible(state: GameState): boolean {
  if (state.wave < CRISIS_CFG.SIEGE_FROM) return false;
  return (
    state.town.lv >= CRISIS_CFG.SIEGE_LV ||
    (state.town.lv >= 3 && getTotalFacilityLevels(state) >= 12)
  );
}

export function calcSiegeChance(state: GameState): number {
  let p = CRISIS_CFG.SIEGE_BASE;
  if (state.fame >= 7) p += CRISIS_CFG.SIEGE_FAME;
  if (state.town.order < 40) p += CRISIS_CFG.SIEGE_ORDER;
  p += CRISIS_CFG.SIEGE_ANNEX * getWarAnnexedCount(state);
  if ((state.crises.lastNoBreachStreak ?? 0) >= 5) p += CRISIS_CFG.SIEGE_NOBREACH;
  return Math.min(CRISIS_CFG.SIEGE_CAP, p);
}

export function resolveRoyalSiegeDay(state: GameState, forceWin?: boolean): EstateActionResult {
  if (!state.crises.siege.active) {
    return { ok: false, state, message: 'No active Royal Siege.' };
  }
  const nextDay = state.crises.siege.day + 1;
  const def = calcSiegeDefense(state);
  const atk = 20 + Math.floor(state.wave / 2) + nextDay * 2;
  const roll = forceWin !== undefined ? (forceWin ? 20 : 1) : randInt(1, 20);
  const win = forceWin !== undefined ? forceWin : roll + def >= atk;
  const wins = state.crises.siege.wins + (win ? 1 : 0);
  const losses = state.crises.siege.losses + (win ? 0 : 1);
  const roundLog = `Siege Day ${nextDay}/3: d20(${roll}) + Def(${def}) = ${roll + def} vs Atk(${atk}) -> ${
    win ? 'HELD!' : 'PUSHED BACK!'
  }`;

  if (wins >= 2) {
    const rewardMp = 50 + state.wave * 5;
    const nextFamePts = clamp(state.famePoints + 20, 0, CFG.FAME.POINT_MAX);
    const titles = state.endings.titles.includes('Defender of the Realm')
      ? state.endings.titles
      : [...state.endings.titles, 'Defender of the Realm'];
    const knightCaptive: Prisoner = {
      pid: state.nextPid,
      name: 'Royal Knight-Captain',
      grade: 'A',
      raceLabel: 'Human',
      classLabel: 'Knight',
      traits: ['brave', 'noble'],
      capturedWave: state.wave,
      capturedFloor: 0,
      resist: 75,
      corr: 0,
      gender: 'male',
      stamina: 80,
      staminaMax: 100,
      pleasure: 0,
      terror: 10,
      shame: 0,
      marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
      cond: 'injured',
      job: null,
      converted: null,
      assignedFloor: null,
      owner: null,
      afflictions: [],
      virgin: false,
      breeding: null,
      intel: 0,
    };
    const msg = `🏰 Royal Siege Repelled (${wins}W-${losses}L)! +${rewardMp} MP, +2 Fame, Knight-Captain captured!`;
    const next: GameState = {
      ...state,
      points: state.points + rewardMp,
      famePoints: nextFamePts,
      fame: Math.floor(nextFamePts / 10),
      prisoners: [...state.prisoners, knightCaptive],
      nextPid: state.nextPid + 1,
      endings: { ...state.endings, titles },
      crises: {
        ...state.crises,
        siege: {
          active: false,
          day: nextDay,
          wins,
          losses,
          cooldown: state.wave + CRISIS_CFG.SIEGE_CD,
          lastLog: roundLog,
        },
        lastCrisisCard: {
          kind: 'siege',
          title: 'Royal Siege Repelled!',
          subtitle: `${wins}W - ${losses}L · ${roundLog}`,
          body: msg,
          assetKey: 'dk_war_defend',
          wave: state.wave,
          resolved: true,
          won: true,
        },
      },
      flash: msg,
    };
    return { ok: true, state: next, message: msg, artUrl: resolveSceneAsset('dk_war_defend') };
  }

  if (losses >= 2) {
    const casMult = state.settings.difficulty === 'casual' ? 0.5 : 1;
    const popLoss = Math.floor(state.town.pop * 0.15 * casMult);
    const builtFacs = Object.entries(state.estate.facilities).filter(([, lv]) => lv > 0);
    let nextFacilities = state.estate.facilities;
    let damagedFacNote = '';
    if (builtFacs.length > 0) {
      const [hitKey, hitLv] = pickOne(builtFacs);
      nextFacilities = { ...state.estate.facilities, [hitKey]: Math.max(0, hitLv - 1) };
      damagedFacNote = ` · ${FACILITY_MAP[hitKey]?.name ?? hitKey} -1 Lv`;
    }
    const msg = `🏰 Royal Siege Breached (${wins}W-${losses}L): -${popLoss} Pop, -10 Order${damagedFacNote}`;
    const next: GameState = {
      ...state,
      town: {
        ...state.town,
        pop: Math.max(0, state.town.pop - popLoss),
        order: clamp(state.town.order - 10, 0, 100),
      },
      estate: {
        ...state.estate,
        facilities: nextFacilities,
      },
      crises: {
        ...state.crises,
        siege: {
          active: false,
          day: nextDay,
          wins,
          losses,
          cooldown: state.wave + CRISIS_CFG.SIEGE_CD,
          lastLog: roundLog,
        },
        lastCrisisCard: {
          kind: 'siege',
          title: 'Walls Breached in Royal Siege',
          subtitle: `${wins}W - ${losses}L · ${roundLog}`,
          body: msg,
          assetKey: 'dk_war_defend',
          wave: state.wave,
          resolved: true,
          won: false,
        },
      },
      flash: msg,
    };
    return { ok: true, state: next, message: msg, artUrl: resolveSceneAsset('dk_war_defend') };
  }

  // Ongoing Bo3
  const next: GameState = {
    ...state,
    crises: {
      ...state.crises,
      siege: {
        ...state.crises.siege,
        day: nextDay,
        wins,
        losses,
        lastLog: roundLog,
      },
      lastCrisisCard: {
        kind: 'siege',
        title: `Royal Siege Bo3 (Day ${nextDay}/3: ${wins}W-${losses}L)`,
        subtitle: roundLog,
        body: `Defense ${def} vs Royal Siege Force. Resolve remaining days before leaving M.Settle.`,
        assetKey: 'dk_cr_siege',
        wave: state.wave,
        resolved: false,
      },
    },
    flash: roundLog,
  };
  return { ok: true, state: next, message: roundLog, artUrl: resolveSceneAsset('dk_cr_siege') };
}

export function resolvePrisonJailbreak(state: GameState, forceSuccess?: boolean): EstateActionResult {
  if (!state.crises.jailbreakPending) {
    return { ok: false, state, message: 'No active Prison Jailbreak.' };
  }
  const watchLv = state.estate.facilities.watch ?? 0;
  const hasTrusty = state.prisoners.some((p) => p.job === 'trusty');
  const instigators = state.prisoners.filter(
    (p) => p.resist >= CRISIS_CFG.JAIL_RES && p.job !== 'trusty'
  );
  const roll = forceSuccess !== undefined ? (forceSuccess ? 20 : 1) : randInt(1, 20);
  const def =
    roll +
    3 * watchLv +
    2 * state.town.guard +
    Math.floor(state.fear / 10) +
    (hasTrusty ? 5 : 0);
  const dc = 15 + 2 * instigators.length;
  const success = forceSuccess !== undefined ? forceSuccess : instigators.length === 0 || def >= dc;

  if (success) {
    const instIds = new Set(instigators.map((p) => p.pid));
    const nextPrisoners = state.prisoners.map((p) =>
      instIds.has(p.pid) ? { ...p, resist: clamp(p.resist - 10, 0, 100) } : p
    );
    const msg = `🔓 Jailbreak Suppressed (${def} vs DC ${dc})! +5 Fear, instigators -10 Resist.`;
    const next: GameState = {
      ...state,
      fear: clamp(state.fear + 5, 0, 100),
      prisoners: nextPrisoners,
      crises: {
        ...state.crises,
        jailbreakPending: false,
        lastCrisisCard: {
          kind: 'jailbreak',
          title: 'Prison Jailbreak Crushed',
          subtitle: `Roll ${def} vs DC ${dc}`,
          body: msg,
          assetKey: 'dk_cr_jailbreak',
          wave: state.wave,
          resolved: true,
          won: true,
        },
      },
      flash: msg,
    };
    return { ok: true, state: next, message: msg, artUrl: resolveSceneAsset('dk_cr_jailbreak') };
  }

  const instIds = new Set(instigators.map((p) => p.pid));
  const escapedNames = instigators.map((p) => p.name);
  const addedNems = instigators.map((p) =>
    buildNemesisFromHero(
      state,
      {
        slot: 1,
        grade: p.grade,
        status: 'retreated',
        gender: p.gender,
        classKey: 'warrior',
        classLabel: p.classLabel,
        raceKey: 'human',
        raceLabel: p.raceLabel,
        traits: [...p.traits],
        kinkKey: '',
        kinkDesc: '',
        age: 'adult',
        body: '',
        looks: '',
        persona: '',
        origin: '',
        exp: 'some',
        marital: 'single',
        intel: p.intel ?? 0,
        name: p.name,
        appearance: '',
        outfit: '',
        personalityText: '',
        skill: '',
        weakness: '',
        kinkText: '',
        cond: p.cond,
        ailment: 0,
        aroused: false,
        usedLuck: false,
        injIgnored: false,
        lastRollText: '',
      },
      state.wave
    )
  );
  const nextPrisoners = state.prisoners.filter((p) => !instIds.has(p.pid));
  const nextFloors = state.floors.map((fl) => ({
    ...fl,
    combatSlots: (fl.combatSlots ?? []).filter(
      (cs) => !(cs.kind === 'prisoner' && instIds.has(cs.pid))
    ),
  }));
  const nextNemesis = [...state.crises.nemesis, ...addedNems].slice(-3);
  const msg = `🔓 Prison Jailbreak! ${escapedNames.join(', ')} escaped and swore vengeance as Nemeses!`;
  const next: GameState = {
    ...state,
    prisoners: nextPrisoners,
    floors: nextFloors,
    crises: {
      ...state.crises,
      jailbreakPending: false,
      nemesis: nextNemesis,
      lastCrisisCard: {
        kind: 'jailbreak',
        title: 'Prisoners Escaped!',
        subtitle: `Roll ${def} vs DC ${dc}`,
        body: msg,
        assetKey: 'dk_cr_jailbreak',
        wave: state.wave,
        resolved: true,
        won: false,
      },
    },
    flash: msg,
  };
  return { ok: true, state: next, message: msg, artUrl: resolveSceneAsset('dk_cr_jailbreak') };
}
