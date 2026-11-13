import { resolveNpcImage, resolveSceneAsset } from '../data/assetManifest';
import {
  OFFICER_INTERACTIONS,
  OFFICER_PASSIVE_PERKS,
  type OfficerInteractionDef,
} from '../data/estateData';
import type { GameState, OfficerKey } from '../types/game';
import {
  canSpendDayAp,
  getOfficerNextThreshold,
  getOfficerStageForAff,
  getTotalDebt,
  spendDayAp,
} from './dayLoop';
import { checkDebtPayoffEnding, triggerDowryEnding } from './endings';
import { clamp, randInt } from './rng';

const STAGE_GAIN_MULT = [1.0, 0.9, 0.75, 0.6, 0.5] as const;

export const OFFICER_DISPLAY: Record<
  OfficerKey,
  { name: string; role: string; maxStage: number; moods: readonly string[] }
> = {
  vesper: {
    name: 'Vesper',
    role: 'Chief Butler & Warden',
    maxStage: 4,
    moods: ['professional', 'warming up', 'fond', 'intimate', 'devoted'],
  },
  lilim: {
    name: 'Lilim',
    role: 'Trap Architect & Succubus',
    maxStage: 4,
    moods: ['professional', 'teasing', 'fond', 'intimate', 'devoted'],
  },
  eleonora: {
    name: 'Eleonora',
    role: 'Goldreich Debt Collector',
    maxStage: 5,
    moods: [
      'haughty and businesslike',
      'grudgingly curious',
      'flustered',
      'smitten (hiding it badly)',
      'openly devoted',
      'hopelessly in love',
    ],
  },
};

export interface OfficerProfileStats {
  officer: OfficerKey;
  name: string;
  role: string;
  stage: number;
  maxStage: number;
  aff: number;
  nextThreshold: number | null;
  trust: number;
  corruption: number;
  mood: string;
  portraitUrl: string | undefined;
}

export interface OfficerActionResult {
  ok: boolean;
  state: GameState;
  affGain: number;
  stagedUp: boolean;
  newStage: number;
  interaction?: OfficerInteractionDef;
  artUrl?: string;
}

export interface OfficerPerksSummary {
  // Vesper
  restMultiplier: number;
  prisonInterroBonus: number;
  prisonTrainMult: number;
  prisonSaleMult: number;
  saleRiskScale: number;
  settlementBonusMp: number;
  nextDayApBonus: number;
  // Lilim
  trapUpgradeDiscountMult: number;
  prepIntelBonus: number;
  maxIntelBonus: number;
  firstRoomHeroRollMod: number;
  aceDowngradeChance: number;
  newTrapGradeUpChance: number;
  allFloorDcBonus: number;
  firstFloorDcBonus: number;
  // Eleonora
  debtInterestRate: number;
  handoverMult: number;
  entertainBonus: number;
  auctionFeeZero: boolean;
  forgiveAvailable: boolean;
  romanceEligible: boolean;
}

export function calcOfficerAffGain(
  state: GameState,
  officer: OfficerKey,
  baseGain: number
): number {
  const fac = state.estate.facilities;
  const flat =
    officer === 'eleonora' ? fac.trade ?? 0 : fac.bath ?? 0;
  const manorMult = 1 + 0.3 * (fac.manor ?? 0);
  const stage = state.officers[officer].stage;
  const decay = STAGE_GAIN_MULT[Math.min(stage, STAGE_GAIN_MULT.length - 1)] ?? 0.5;
  return Math.max(1, Math.floor((baseGain + flat) * manorMult * decay));
}

export function grantOfficerAffinity(
  state: GameState,
  officer: OfficerKey,
  delta: number
): { state: GameState; stagedUp: boolean; newStage: number; prevStage: number } {
  const prev = state.officers[officer];
  const nextAff = Math.max(0, prev.aff + delta);
  const computedStage = getOfficerStageForAff(officer, nextAff);
  const newStage = Math.max(prev.stage, computedStage);
  const stagedUp = newStage > prev.stage;

  return {
    stagedUp,
    newStage,
    prevStage: prev.stage,
    state: {
      ...state,
      officers: {
        ...state.officers,
        [officer]: {
          ...prev,
          aff: nextAff,
          stage: newStage,
        },
      },
    },
  };
}

export function getOfficerProfileStats(
  state: GameState,
  officer: OfficerKey
): OfficerProfileStats {
  const meta = OFFICER_DISPLAY[officer];
  const prog = state.officers[officer];
  const nextThreshold = getOfficerNextThreshold(officer, prog.stage);

  // Derived Trust (0..100) and Corruption (0..100) from relationship & domain state
  const trustBase =
    officer === 'eleonora'
      ? Math.round(prog.aff * 0.55 + state.debt.patience * 0.45 - state.debt.lates * 12)
      : officer === 'vesper'
        ? Math.round(prog.aff * 0.65 + state.town.order * 0.25 + prog.stage * 4)
        : Math.round(prog.aff * 0.6 + state.fame * 3 + prog.stage * 5);

  const corrBase =
    officer === 'vesper'
      ? Math.round(state.lust * 0.45 + prog.stage * 10 + (state.estate.perks.rest2Day ? 10 : 0))
      : officer === 'lilim'
        ? Math.round(35 + state.lust * 0.45 + prog.stage * 6)
        : Math.round(state.lust * 0.3 + prog.stage * 11 + (state.debt.ended === 'romance' ? 15 : 0));

  const mood =
    meta.moods[Math.min(prog.stage, meta.moods.length - 1)] ?? meta.moods[0];

  const portraitKeyword =
    prog.stage >= 4 ? 'lovestuck' : prog.stage >= 2 ? 'joyful' : 'standing';

  return {
    officer,
    name: meta.name,
    role: meta.role,
    stage: prog.stage,
    maxStage: meta.maxStage,
    aff: prog.aff,
    nextThreshold,
    trust: clamp(trustBase, 0, 100),
    corruption: clamp(corrBase, 0, 100),
    mood,
    portraitUrl: resolveNpcImage(officer, portraitKeyword) ?? resolveNpcImage(officer, 'standing'),
  };
}

export function talkToOfficer(
  state: GameState,
  officer: OfficerKey
): OfficerActionResult {
  const actionKey = `officer_${officer}`;
  const guard = canSpendDayAp(state, actionKey);
  if (!guard.ok) {
    return {
      ok: false,
      state: { ...state, flash: guard.reason },
      affGain: 0,
      stagedUp: false,
      newStage: state.officers[officer].stage,
    };
  }

  const baseGain = officer === 'eleonora' ? randInt(1, 3) : randInt(2, 4);
  const gain = calcOfficerAffGain(state, officer, baseGain);
  const prevStage = state.officers[officer].stage;
  const predictedAff = state.officers[officer].aff + gain;
  const predictedStage = Math.max(prevStage, getOfficerStageForAff(officer, predictedAff));
  const stagedUp = predictedStage > prevStage;
  const meta = OFFICER_DISPLAY[officer];
  const artKey = `dk_time_${officer[0]}`;

  const label = `Spent time with ${meta.name} (+${gain} Aff${
    stagedUp ? ` -> Stage ${predictedStage}!` : ''
  })`;
  const spent = spendDayAp(state, actionKey, {
    text: label,
    star: stagedUp,
    kind: 'officer',
    art: artKey,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      affGain: 0,
      stagedUp: false,
      newStage: prevStage,
    };
  }

  const granted = grantOfficerAffinity(spent.state, officer, gain);
  return {
    ok: true,
    state: {
      ...granted.state,
      flash: `${label} (-1 AP). Queued to Day Log.`,
    },
    affGain: gain,
    stagedUp: granted.stagedUp,
    newStage: granted.newStage,
    artUrl: resolveSceneAsset(artKey),
  };
}

export function giftOfficer(
  state: GameState,
  officer: OfficerKey
): OfficerActionResult {
  const actionKey = `officer_${officer}`;
  const guard = canSpendDayAp(state, actionKey);
  if (!guard.ok) {
    return {
      ok: false,
      state: { ...state, flash: guard.reason },
      affGain: 0,
      stagedUp: false,
      newStage: state.officers[officer].stage,
    };
  }
  if (state.points < 40) {
    return {
      ok: false,
      state: { ...state, flash: 'Need 40 MP to present an Officer Gift.' },
      affGain: 0,
      stagedUp: false,
      newStage: state.officers[officer].stage,
    };
  }

  const gain = calcOfficerAffGain(state, officer, 4);
  const prevStage = state.officers[officer].stage;
  const predictedStage = Math.max(
    prevStage,
    getOfficerStageForAff(officer, state.officers[officer].aff + gain)
  );
  const stagedUp = predictedStage > prevStage;
  const meta = OFFICER_DISPLAY[officer];
  const artKey = `dk_gift_${officer[0]}`;

  const label = `Gift to ${meta.name} (-40 MP, +${gain} Aff${
    stagedUp ? ` -> Stage ${predictedStage}!` : ''
  })`;
  const spent = spendDayAp(state, actionKey, {
    text: label,
    star: stagedUp,
    kind: 'officer',
    art: artKey,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      affGain: 0,
      stagedUp: false,
      newStage: prevStage,
    };
  }

  const granted = grantOfficerAffinity(
    { ...spent.state, points: spent.state.points - 40 },
    officer,
    gain
  );

  return {
    ok: true,
    state: {
      ...granted.state,
      flash: `${label} (-1 AP). Queued to Day Log.`,
    },
    affGain: gain,
    stagedUp: granted.stagedUp,
    newStage: granted.newStage,
    artUrl: resolveSceneAsset(artKey),
  };
}

export function canUseOfficerInteraction(
  state: GameState,
  def: OfficerInteractionDef
): { ok: true } | { ok: false; reason: string } {
  const prog = state.officers[def.officer];
  if (prog.stage < def.stage) {
    return {
      ok: false,
      reason: def.stage === 5 ? 'Requires Aff 100 (Stage 5)' : `Requires Stage ${def.stage}`,
    };
  }
  if (def.cooldown === 'game' && prog.usedOnce[def.id]) {
    return { ok: false, reason: 'Already used (1/game)' };
  }
  if (
    def.cooldown === 'cycle' &&
    prog.cooldowns[def.id] !== undefined &&
    prog.cooldowns[def.id] === state.debt.cycleCount
  ) {
    return { ok: false, reason: 'Used this debt cycle' };
  }
  if (
    def.cooldown === 'waves' &&
    prog.cooldowns[def.id] !== undefined &&
    state.wave < prog.cooldowns[def.id]
  ) {
    return { ok: false, reason: `Cooldown until W${prog.cooldowns[def.id]}` };
  }
  const totalDebt = getTotalDebt(state);
  if (def.debtOnly && (state.debt.ended || totalDebt <= 0)) {
    return { ok: false, reason: 'No active debt balance' };
  }
  if (def.id === 'E10') {
    if (totalDebt > 600) {
      return { ok: false, reason: 'Debt must be <= 600 MP' };
    }
    const reliefRemaining = 1200 - state.debt.reliefUsed;
    if (reliefRemaining < totalDebt) {
      return { ok: false, reason: 'Insufficient debt relief cap remaining' };
    }
  }
  const dayCheck = canSpendDayAp(state, `officer_${def.officer}`);
  if (!dayCheck.ok) return dayCheck;
  if (def.mpCost && state.points < def.mpCost) {
    return { ok: false, reason: `Need ${def.mpCost} MP` };
  }
  return { ok: true };
}

export function performOfficerInteraction(
  state: GameState,
  interactionId: string
): OfficerActionResult {
  const def = OFFICER_INTERACTIONS.find((x) => x.id === interactionId);
  if (!def) {
    return {
      ok: false,
      state: { ...state, flash: `Unknown interaction: ${interactionId}` },
      affGain: 0,
      stagedUp: false,
      newStage: 0,
    };
  }

  const check = canUseOfficerInteraction(state, def);
  if (!check.ok) {
    return {
      ok: false,
      state: { ...state, flash: `${def.title}: ${check.reason}` },
      affGain: 0,
      stagedUp: false,
      newStage: state.officers[def.officer].stage,
      interaction: def,
    };
  }

  const gain = calcOfficerAffGain(
    state,
    def.officer,
    def.officer === 'eleonora' ? 2 : 3
  );
  const prevProg = state.officers[def.officer];
  const predictedStage = Math.max(
    prevProg.stage,
    getOfficerStageForAff(def.officer, prevProg.aff + gain)
  );
  const stagedUp = predictedStage > prevProg.stage;
  const meta = OFFICER_DISPLAY[def.officer];
  const logLabel = `${meta.name} — ${def.title} (+${gain} Aff · ${def.effectText})`;

  const spent = spendDayAp(state, `officer_${def.officer}`, {
    text: logLabel,
    star: Boolean(def.star || stagedUp),
    kind: `int_${def.id}`,
    art: def.artKey,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      affGain: 0,
      stagedUp: false,
      newStage: prevProg.stage,
      interaction: def,
    };
  }

  let next = {
    ...spent.state,
    points: spent.state.points - (def.mpCost ?? 0),
  };

  // Mark cooldown / usedOnce
  const prog = { ...next.officers[def.officer] };
  if (def.cooldown === 'game') {
    prog.usedOnce = { ...prog.usedOnce, [def.id]: true };
  } else if (def.cooldown === 'cycle') {
    prog.cooldowns = { ...prog.cooldowns, [def.id]: next.debt.cycleCount };
  } else if (def.cooldown === 'waves') {
    prog.cooldowns = {
      ...prog.cooldowns,
      [def.id]: next.wave + (def.cooldownWaves ?? 10),
    };
  }
  next = {
    ...next,
    officers: {
      ...next.officers,
      [def.officer]: prog,
    },
  };

  // Apply interaction effect
  const perks = { ...next.estate.perks };
  let debt = { ...next.debt };
  let town = { ...next.town };
  let prisoners = next.prisoners;
  let endings = next.endings;
  let mode = next.mode;

  switch (def.id) {
    case 'V1':
      next.points += 10;
      break;
    case 'V2':
      next.fear = clamp(next.fear + 2, 0, 100);
      break;
    case 'V3':
      perks.interroDay = true;
      break;
    case 'V4':
      perks.interroDay = true;
      perks.prisonDay = true;
      break;
    case 'V5':
      perks.rest2Day = true;
      break;
    case 'V6':
      next.lust = clamp(next.lust + 6, 0, 100);
      break;
    case 'V7':
      perks.apBonus = (perks.apBonus ?? 0) + 1;
      break;
    case 'V8':
      next.fear = clamp(next.fear + 5, 0, 100);
      if (!perks.capBonus) perks.capBonus = 1;
      break;
    case 'V9':
      prisoners = prisoners.map((p) => ({
        ...p,
        terror: clamp(p.terror + 5, 0, 100),
      }));
      town.order = clamp(town.order + 2, 0, 100);
      break;
    case 'V10':
      perks.ransomUpDay = Math.max(perks.ransomUpDay ?? 0, 0.15);
      break;
    case 'L1':
      if (Math.random() < 0.3) {
        perks.prepIntelOnce = true;
      }
      break;
    case 'L2':
      if (Math.random() < 0.5) {
        next.points += 15;
      }
      break;
    case 'L3':
      perks.trapUpgradeCut = true;
      break;
    case 'L4':
      next.lust = clamp(next.lust + 4, 0, 100);
      break;
    case 'L5':
      perks.prepIntelOnce = true;
      break;
    case 'L6':
      next.lust = clamp(next.lust + 6, 0, 100);
      perks.firstDcOnce = true;
      break;
    case 'L7':
      perks.aceDowngradeNext = true;
      break;
    case 'L8':
      if (!perks.maxIntelBonus) perks.maxIntelBonus = 1;
      break;
    case 'L9':
      perks.newTrapUpNext = true;
      break;
    case 'L10':
      perks.allDcNext = true;
      break;
    case 'E1':
      debt.patience = clamp(debt.patience + 5, 0, 100);
      break;
    case 'E2':
      debt.patience = clamp(debt.patience + 8, 0, 100);
      break;
    case 'E3':
      debt.minCut = Math.min(0.25, debt.minCut + 0.05);
      break;
    case 'E4':
      debt.patience = clamp(debt.patience + 5, 0, 100);
      break;
    case 'E5':
      debt.minCut = Math.min(0.25, debt.minCut + 0.1);
      break;
    case 'E6':
      debt.patience = clamp(debt.patience + 10, 0, 100);
      break;
    case 'E7': {
      const want = Math.floor(debt.amount * 0.05);
      const cut = Math.max(0, Math.min(want, debt.amount, 1200 - debt.reliefUsed));
      debt.amount -= cut;
      debt.reliefUsed += cut;
      break;
    }
    case 'E8':
      debt.noInterest = true;
      break;
    case 'E9': {
      const want = Math.min(450, Math.floor(debt.amount * 0.15));
      const cut = Math.max(0, Math.min(want, debt.amount, 1200 - debt.reliefUsed));
      debt.amount -= cut;
      debt.reliefUsed += cut;
      break;
    }
    case 'E10': {
      // Finalize via unified triggerDowryEnding below after state merge
      break;
    }
    case 'E11':
      town.renown = clamp(town.renown + 3, 0, 100);
      perks.ransomUpDay = Math.max(perks.ransomUpDay ?? 0, 0.1);
      break;
    case 'E12':
      next.guildPoints = clamp(next.guildPoints - 5, 0, 100);
      break;
  }

  next = {
    ...next,
    mode,
    prisoners,
    town,
    debt,
    endings,
    estate: {
      ...next.estate,
      perks,
    },
  };

  if (def.id === 'E10') {
    next = triggerDowryEnding(next);
  }

  const granted = grantOfficerAffinity(next, def.officer, gain);
  let finalState = granted.state;

  // Check if principal + extra debt hit 0 outside E10
  if (def.id !== 'E10') {
    finalState = checkDebtPayoffEnding(finalState);
  }

  return {
    ok: true,
    state: {
      ...finalState,
      flash:
        def.id === 'E10' || (finalState.endings.activeEnding && !state.endings.activeEnding)
          ? finalState.flash
          : `${logLabel} (-1 AP).`,
    },
    affGain: gain,
    stagedUp: granted.stagedUp,
    newStage: granted.newStage,
    interaction: def,
    artUrl: resolveSceneAsset(def.artKey),
  };
}

// --- Active Gameplay Perk Helpers ---

export function getRestMpMultiplier(state: GameState): number {
  return state.estate.perks.rest2Day ? 2 : 1;
}

export function getTrapUpgradeDiscountMultiplier(state: GameState): number {
  const stageCut = state.officers.lilim.stage >= 1 ? 0.1 : 0;
  const perkCut = state.estate.perks.trapUpgradeCut ? 0.1 : 0;
  const smithyCut = 0.05 * (state.estate.facilities.smithy ?? 0);
  return Math.max(0.5, 1 - stageCut - perkCut - smithyCut);
}

export function getPrisonInterroBonus(state: GameState): number {
  let bonus = 0;
  if (state.officers.vesper.stage >= 1) bonus += 0.15;
  if (state.estate.perks.interroDay) bonus += 0.1;
  if (state.estate.perks.prisonDay) bonus += 0.1;
  bonus += 0.15 * (state.estate.facilities.spy ?? 0);
  bonus += 0.1 * (state.estate.facilities.torture ?? 0);
  return bonus;
}

export function getPrisonSaleMultiplier(state: GameState): number {
  let mult = 1;
  if (state.officers.vesper.stage >= 1) mult *= 1.1;
  if (state.officers.vesper.aff > 0) mult *= 1 + state.officers.vesper.aff * 0.001;
  if ((state.estate.perks.ransomUpDay ?? 0) > 0) {
    mult *= 1 + (state.estate.perks.ransomUpDay ?? 0);
  }
  return mult;
}

export function getPrepIntelLeakBonus(state: GameState): {
  prepIntel: number;
  maxIntelBonus: number;
  aceDowngradeChance: number;
  newTrapGradeUpChance: number;
} {
  const lilim = state.officers.lilim;
  const perks = state.estate.perks;
  const prepIntel = (lilim.stage >= 2 ? 1 : 0) + (perks.prepIntelOnce ? 1 : 0);
  const maxIntelBonus = perks.maxIntelBonus ?? 0;
  const aceDowngradeChance =
    (lilim.stage >= 4 ? 0.3 : 0) + (perks.aceDowngradeNext ? 0.2 : 0);
  const newTrapGradeUpChance =
    (lilim.stage >= 2 ? 0.1 : 0) + (perks.newTrapUpNext ? 0.2 : 0);
  return {
    prepIntel,
    maxIntelBonus,
    aceDowngradeChance: Math.min(0.8, aceDowngradeChance),
    newTrapGradeUpChance: Math.min(0.8, newTrapGradeUpChance),
  };
}

export function getNextRaidDcBonus(state: GameState): {
  firstRoomDcBonus: number;
  allFloorsDcBonus: number;
} {
  const lilim = state.officers.lilim;
  const perks = state.estate.perks;
  const lilimAffMod = Math.min(2, Math.floor(lilim.aff / 40));
  const lilimStage3Mod = lilim.stage >= 3 ? 1 : 0;
  const firstRoomDcBonus =
    lilimAffMod + lilimStage3Mod + (perks.firstDcOnce ? 1 : 0);
  const allFloorsDcBonus = perks.allDcNext ? 1 : 0;
  return { firstRoomDcBonus, allFloorsDcBonus };
}

export function getOfficerPerksSummary(state: GameState): OfficerPerksSummary {
  const v = state.officers.vesper;
  const e = state.officers.eleonora;
  const perks = state.estate.perks;
  const intelLeaks = getPrepIntelLeakBonus(state);
  const dcBonus = getNextRaidDcBonus(state);
  const casMult = state.settings.difficulty === 'casual' ? 0.5 : 1;

  return {
    restMultiplier: getRestMpMultiplier(state),
    prisonInterroBonus: getPrisonInterroBonus(state),
    prisonTrainMult: v.stage >= 2 ? 1.25 : 1,
    prisonSaleMult: getPrisonSaleMultiplier(state),
    saleRiskScale: v.stage >= 4 ? 0.5 : v.stage >= 3 ? 0.75 : 1,
    settlementBonusMp: v.stage >= 3 ? 10 : 0,
    nextDayApBonus: perks.apBonus ?? 0,
    trapUpgradeDiscountMult: getTrapUpgradeDiscountMultiplier(state),
    prepIntelBonus: intelLeaks.prepIntel,
    maxIntelBonus: intelLeaks.maxIntelBonus,
    firstRoomHeroRollMod: -dcBonus.firstRoomDcBonus,
    aceDowngradeChance: intelLeaks.aceDowngradeChance,
    newTrapGradeUpChance: intelLeaks.newTrapGradeUpChance,
    allFloorDcBonus: dcBonus.allFloorsDcBonus,
    firstFloorDcBonus: dcBonus.firstRoomDcBonus,
    debtInterestRate: (e.stage >= 1 ? 0.008 : 0.01) * casMult,
    handoverMult: e.stage >= 2 ? 1.3 : 1.2,
    entertainBonus: e.stage >= 3 ? 0.15 : 0,
    auctionFeeZero: e.stage >= 3,
    forgiveAvailable: e.stage >= 4 && !state.debt.forgiveUsed,
    romanceEligible: e.aff >= 90,
  };
}

export function getOfficerSceneContext(
  state: GameState,
  officer: OfficerKey,
  recentInteraction?: OfficerInteractionDef
): { title: string; context: string; imageUrl?: string } {
  const profile = getOfficerProfileStats(state, officer);
  const passives = OFFICER_PASSIVE_PERKS[officer]
    .filter((p) => profile.stage >= p.stage)
    .map((p) => p.text);

  if (recentInteraction) {
    return {
      title: `${profile.name} ★ ${recentInteraction.title}`,
      context: [
        `Officer: ${profile.name} (${profile.role})`,
        `Stage ${profile.stage}/${profile.maxStage} · Affinity ${profile.aff} · Mood: ${profile.mood}`,
        `Scene Beat: ${recentInteraction.title} (${recentInteraction.effectText})`,
        `Day ${state.day || state.wave}, Town Lv.${state.town.lv}, Fear ${state.fear}, Lust ${state.lust}`,
        passives.length > 0 ? `Unlocked Perks: ${passives.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      imageUrl: resolveSceneAsset(recentInteraction.artKey) ?? profile.portraitUrl,
    };
  }

  return {
    title: `${profile.name} — Stage ${profile.stage} Private Audience`,
    context: [
      `Officer: ${profile.name} (${profile.role})`,
      `Stage ${profile.stage}/${profile.maxStage} · Affinity ${profile.aff} · Trust ${profile.trust}% · Corruption ${profile.corruption}%`,
      `Mood: ${profile.mood}`,
      `Day ${state.day || state.wave}, Town Lv.${state.town.lv}, Debt ${getTotalDebt(state)} MP`,
      passives.length > 0 ? `Active Perks: ${passives.join('; ')}` : 'Early professional bond',
    ].join('\n'),
    imageUrl:
      resolveSceneAsset(`dk_stage_${officer[0]}${Math.max(1, profile.stage)}`) ??
      profile.portraitUrl,
  };
}
