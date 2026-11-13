import { resolveNpcImage, resolveSceneAsset } from '../data/assetManifest';
import { CFG } from '../data/constants';
import { DEBT_QUESTS, TOWN_LEVELS, type DebtQuestDef } from '../data/estateData';
import type { DebtQuest, GameState, HeroGrade, Prisoner } from '../types/game';
import {
  canSpendDayAp,
  finishDebtPhase,
  getTotalDebt,
  isDayPhase,
  spendDayAp,
} from './dayLoop';
import { checkDebtPayoffEnding, triggerBankruptEnding } from './endings';
import { grantOfficerAffinity } from './officers';
import { clamp, pickOne } from './rng';

const DEBT_MIN_SCHEDULE = [30, 60, 120, 180, 240, 300, 360] as const;

export type DebtVerdict = 'ontime' | 'ext' | 'forgive' | 'late';

export interface DebtSummary {
  principal: number;
  extraLoan: number;
  totalDebt: number;
  dueWave: number;
  dueInWaves: number;
  baseMin: number;
  extCarry: number;
  minCutPct: number;
  entCutMp: number;
  extraLoanMin: number;
  minDue: number;
  paidThisVisit: number;
  remainingDue: number;
  patience: number;
  lates: number;
  maxLates: number;
  interestRatePct: number;
  reliefUsed: number;
  reliefCap: number;
  forgiveAvailable: boolean;
  canExtend: boolean;
  canEntertain: boolean;
  verdictPreview: DebtVerdict;
}

export interface DebtActionResult {
  ok: boolean;
  state: GameState;
  message: string;
  artUrl?: string;
}

export interface DebtVisitResolution {
  verdict: DebtVerdict;
  state: GameState;
  seizedPrisoner: Prisoner | null;
  seizedCredit: number;
  questCompleted: boolean | null;
  ending: 'romance' | 'liberation' | 'bankrupt' | null;
  artUrl?: string;
}

export function calcPrisonerRansom(
  state: GameState,
  prisoner: Prisoner,
  forSale = true
): number {
  const base = CFG.RANSOM[prisoner.grade] ?? CFG.RANSOM.C;
  let mult = 1;
  mult *= 1 + (prisoner.corr ?? 0) / 200;
  const markSum =
    (prisoner.marks?.obey ?? 0) +
    (prisoner.marks?.pleasure ?? 0) +
    (prisoner.marks?.terror ?? 0) +
    (prisoner.marks?.shame ?? 0);
  mult *= 1 + markSum * 0.08;
  if ((prisoner.pleasure ?? 0) >= 70) mult *= 1.15;
  if ((prisoner.stamina ?? 100) < 30) mult *= 0.7;
  if ((prisoner.terror ?? 0) >= 80) mult *= 0.9;
  if (prisoner.traits.includes('noble')) mult *= 1.5;
  if (prisoner.traits.includes('rich')) mult *= 1.3;
  if (prisoner.cond === 'severe') mult *= 0.8;
  if (prisoner.dressed) mult *= 1.2;
  if (prisoner.broken) mult *= 0.7;
  if (prisoner.branded) mult *= 1.05;
  if ((prisoner.cow || prisoner.crest) && (state.estate.facilities.lewdmart ?? 0) >= 1) {
    mult *= 1.2;
  }
  if (prisoner.virgin && !prisoner.traits.includes('pure')) {
    mult *= 1.1;
  }
  if (state.town.renown >= 80) mult *= 1.15;
  else if (state.town.renown >= 60) mult *= 1.1;
  const marketLv = state.estate.facilities.market ?? 0;
  if (marketLv > 0) mult *= 1 + 0.05 * marketLv;

  if (forSale) {
    if (state.officers.vesper.stage >= 1) mult *= 1.1;
    if (state.officers.vesper.aff > 0) {
      mult *= 1 + state.officers.vesper.aff * 0.001;
    }
    if ((state.estate.perks.ransomUpDay ?? 0) > 0) {
      mult *= 1 + (state.estate.perks.ransomUpDay ?? 0);
    }
    if (state.wonders.gold) {
      mult *= 1.15;
    }
    if (state.war.rivals.merchant.annexed) {
      mult *= 1.1;
    }
  }

  return Math.max(1, Math.round(base * mult));
}

function applyDebtPayment(
  state: GameState,
  payAmount: number
): { state: GameState; paidPrincipal: number; paidExtra: number } {
  let rem = Math.max(0, Math.min(payAmount, getTotalDebt(state)));
  const paidExtra = Math.min(state.debt.extraLoan, rem);
  rem -= paidExtra;
  const paidPrincipal = Math.min(state.debt.amount, rem);

  return {
    paidExtra,
    paidPrincipal,
    state: {
      ...state,
      debt: {
        ...state.debt,
        extraLoan: state.debt.extraLoan - paidExtra,
        amount: state.debt.amount - paidPrincipal,
      },
    },
  };
}

function checkPayoffEnding(state: GameState): GameState {
  return checkDebtPayoffEnding(state);
}

export function getDebtVerdict(state: GameState): DebtVerdict {
  const summary = getDebtSummary(state);
  if (summary.remainingDue <= 0 || summary.totalDebt <= 0) return 'ontime';
  if (
    state.debt.patience >= 30 &&
    state.debt.paidThisVisit >= summary.minDue * 0.5
  ) {
    return 'ext';
  }
  if (state.officers.eleonora.stage >= 4 && !state.debt.forgiveUsed) {
    return 'forgive';
  }
  return 'late';
}

export function getDebtSummary(state: GameState): DebtSummary {
  const d = state.debt;
  const principal = Math.max(0, d.amount);
  const extraLoan = Math.max(0, d.extraLoan);
  const totalDebt = principal + extraLoan;
  const baseMin =
    DEBT_MIN_SCHEDULE[Math.min(d.step, DEBT_MIN_SCHEDULE.length - 1)] ?? 360;
  const extCarry = d.extCarry ?? 0;
  const rawNeed = baseMin + extCarry;
  const minCutFrac = Math.min(d.minCut ?? 0, 0.25);
  const cut = Math.floor(rawNeed * minCutFrac);
  const afterMinCut = Math.max(0, rawNeed - cut);
  const entCutMp = state.apUsed.debt_ent_ok
    ? Math.floor(afterMinCut * 0.25)
    : 0;
  const extraLoanMin = extraLoan > 0 ? Math.ceil(extraLoan * 0.1) : 0;
  const minDue = Math.min(
    totalDebt,
    Math.max(0, afterMinCut - entCutMp) + extraLoanMin
  );
  const paidThisVisit = d.paidThisVisit ?? 0;
  const remainingDue = Math.max(0, minDue - paidThisVisit);
  const casMult = state.settings.difficulty === 'casual' ? 0.5 : 1;
  const baseRate = state.officers.eleonora.stage >= 1 ? 0.8 : 1.0;

  let verdictPreview: DebtVerdict = 'ontime';
  if (remainingDue > 0 && totalDebt > 0) {
    if (d.patience >= 30 && paidThisVisit >= minDue * 0.5) {
      verdictPreview = 'ext';
    } else if (state.officers.eleonora.stage >= 4 && !d.forgiveUsed) {
      verdictPreview = 'forgive';
    } else {
      verdictPreview = 'late';
    }
  }

  return {
    principal,
    extraLoan,
    totalDebt,
    dueWave: d.dueWave,
    dueInWaves: Math.max(0, d.dueWave - state.wave),
    baseMin,
    extCarry,
    minCutPct: Math.round(minCutFrac * 100),
    entCutMp,
    extraLoanMin,
    minDue,
    paidThisVisit,
    remainingDue,
    patience: d.patience,
    lates: d.lates,
    maxLates: 3,
    interestRatePct: baseRate * casMult,
    reliefUsed: d.reliefUsed,
    reliefCap: 1200,
    forgiveAvailable: state.officers.eleonora.stage >= 4 && !d.forgiveUsed,
    canExtend:
      state.mode === 'debt' &&
      remainingDue > 0 &&
      d.patience >= 30 &&
      paidThisVisit >= minDue * 0.5,
    canEntertain:
      state.mode === 'debt' &&
      !d.entertainedThisVisit &&
      paidThisVisit === 0 &&
      totalDebt > 0,
    verdictPreview,
  };
}

export function payDebt(state: GameState, requestedAmount: number): DebtActionResult {
  const totalDebt = getTotalDebt(state);
  if (state.debt.ended || totalDebt <= 0) {
    return {
      ok: false,
      state: { ...state, flash: 'No remaining debt to pay.' },
      message: 'No remaining debt to pay.',
    };
  }
  const isPrepay = state.mode === 'estate';
  if (!isPrepay && state.mode !== 'debt') {
    return {
      ok: false,
      state: { ...state, flash: 'Debt payments are only allowed in Day (Prepay) or Debt mode.' },
      message: 'Debt payments are only allowed in Day (Prepay) or Debt mode.',
    };
  }

  const amount = Math.floor(Math.min(requestedAmount, state.points, totalDebt));
  if (amount <= 0) {
    return {
      ok: false,
      state: { ...state, flash: 'Not enough MP for debt payment.' },
      message: 'Not enough MP for debt payment.',
    };
  }

  const beforeSummary = getDebtSummary(state);
  const applied = applyDebtPayment(
    {
      ...state,
      points: state.points - amount,
    },
    amount
  );
  let next = applied.state;

  let affGain = 0;
  if (isPrepay) {
    const slotsUsed =
      (next.apUsed.prepay_aff_1 ? 1 : 0) + (next.apUsed.prepay_aff_2 ? 1 : 0);
    const canGain = Math.max(0, 2 - slotsUsed);
    affGain = Math.min(canGain, Math.floor(amount / 100));
    const nextSlotsUsed = slotsUsed + affGain;
    next = {
      ...next,
      dayLines: [
        ...next.dayLines,
        {
          text: `Prepaid ${amount} MP toward Goldreich debt (remaining ${getTotalDebt(next)} MP)`,
          kind: 'prepay',
          art: 'dk_debt_prepay',
        },
      ],
      apUsed: {
        ...next.apUsed,
        ...(nextSlotsUsed >= 1 ? { prepay_aff_1: true } : {}),
        ...(nextSlotsUsed >= 2 ? { prepay_aff_2: true } : {}),
      },
    };
  } else {
    const paidAfter = next.debt.paidThisVisit + amount;
    const overpaid = Math.max(0, paidAfter - beforeSummary.minDue);
    const prevOverpaid = Math.max(0, beforeSummary.paidThisVisit - beforeSummary.minDue);
    const bonusBefore = Math.min(2, Math.floor(prevOverpaid / 100));
    const bonusAfter = Math.min(2, Math.floor(overpaid / 100));
    affGain = Math.max(0, bonusAfter - bonusBefore);
    next = {
      ...next,
      debt: {
        ...next.debt,
        paidThisVisit: paidAfter,
      },
    };
  }

  if (affGain > 0) {
    next = grantOfficerAffinity(next, 'eleonora', affGain).state;
  }

  next = checkPayoffEnding(next);
  const msg = isPrepay
    ? `Prepaid ${amount} MP toward debt (remaining ${getTotalDebt(next)} MP).`
    : `Paid ${amount} MP installment (remaining ${getTotalDebt(next)} MP).`;

  return {
    ok: true,
    state: {
      ...next,
      flash: next.debt.ended ? next.flash : msg,
    },
    message: msg,
    artUrl: resolveSceneAsset(isPrepay ? 'dk_debt_prepay' : 'dk_debt_ontime'),
  };
}

export function entertainEleonora(
  state: GameState,
  forceOutcome?: boolean
): DebtActionResult {
  const totalDebt = getTotalDebt(state);
  if (state.mode !== 'debt') {
    return {
      ok: false,
      state: { ...state, flash: 'Entertainment is only available during Debt Collection.' },
      message: 'Collection visit required.',
    };
  }
  if (state.debt.entertainedThisVisit || state.debt.paidThisVisit > 0 || totalDebt <= 0) {
    return {
      ok: false,
      state: { ...state, flash: 'Can only entertain Eleonora once before making MP payments.' },
      message: 'Already entertained or payment started.',
    };
  }

  const chance = Math.min(
    0.95,
    0.4 + state.officers.eleonora.aff / 200 + (state.officers.eleonora.stage >= 3 ? 0.15 : 0)
  );
  const success = forceOutcome !== undefined ? forceOutcome : Math.random() < chance;

  let next: GameState = {
    ...state,
    entApPenalty: 1,
    debt: {
      ...state.debt,
      entertainedThisVisit: true,
      patience: success ? state.debt.patience : clamp(state.debt.patience - 5, 0, 100),
    },
    apUsed: success ? { ...state.apUsed, debt_ent_ok: true } : state.apUsed,
  };

  next = grantOfficerAffinity(next, 'eleonora', success ? 4 : 1).state;
  const msg = success
    ? 'Entertainment succeeded! Minimum installment due reduced by 25% (-1 AP next Day).'
    : 'Entertainment fell flat (-5 Patience, -1 AP next Day).';

  return {
    ok: true,
    state: { ...next, flash: msg },
    message: msg,
    artUrl: resolveSceneAsset(success ? 'dk_debt_ent_ok' : 'dk_debt_ent_fail'),
  };
}

export function handoverPrisonerForDebt(
  state: GameState,
  pid: number
): DebtActionResult {
  const totalDebt = getTotalDebt(state);
  if (state.mode !== 'debt' || totalDebt <= 0) {
    return {
      ok: false,
      state: { ...state, flash: 'Prisoner handover requires active Debt Collection mode.' },
      message: 'Debt mode required.',
    };
  }
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state: { ...state, flash: 'Captive not found for handover.' },
      message: 'Captive not found.',
    };
  }
  const prisoner = state.prisoners[idx];
  const mult = state.officers.eleonora.stage >= 2 ? 1.3 : 1.2;
  const credit = Math.min(
    totalDebt,
    Math.floor(calcPrisonerRansom(state, prisoner, false) * mult)
  );
  const nextPrisoners = state.prisoners.filter((p) => p.pid !== pid);
  const applied = applyDebtPayment(
    {
      ...state,
      prisoners: nextPrisoners,
    },
    credit
  );

  let next: GameState = {
    ...applied.state,
    debt: {
      ...applied.state.debt,
      paidThisVisit: applied.state.debt.paidThisVisit + credit,
    },
  };
  next = checkPayoffEnding(next);
  const artKey = prisoner.gender === 'male' ? 'dk_debt_hand_m' : 'dk_debt_hand';
  const msg = `Handed over ${prisoner.name} to Goldreich (-${credit} MP debt).`;

  return {
    ok: true,
    state: { ...next, flash: next.debt.ended ? next.flash : msg },
    message: msg,
    artUrl: resolveSceneAsset(artKey),
  };
}

export function rollDebtQuests(state: GameState): GameState {
  if (state.debt.offeredQuests.length >= 2) return state;
  const pool = [...DEBT_QUESTS];
  const offered: DebtQuest[] = [];
  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const picked = pickOne(pool);
    const idx = pool.findIndex((q) => q.id === picked.id);
    if (idx >= 0) pool.splice(idx, 1);
    offered.push(toDebtQuestInstance(state, picked));
  }
  return {
    ...state,
    debt: {
      ...state.debt,
      offeredQuests: offered,
    },
  };
}

function toDebtQuestInstance(state: GameState, def: DebtQuestDef): DebtQuest {
  let target = def.target;
  let progress = 0;
  if (def.id === 'fame2') {
    target = state.fame + 2;
    progress = state.fame;
  } else if (def.id === 'kill3') {
    target = state.kills + 3;
    progress = state.kills;
  } else if (def.id === 'wipes2') {
    target = state.apGrowth.wipes + 2;
    progress = state.apGrowth.wipes;
  } else if (def.id === 'nobreach') {
    progress = state.estate.nobreachStreak;
  } else if (def.id === 'hold3') {
    progress = state.prisoners.length;
  } else if (def.id === 'fear50') {
    progress = state.fear;
  } else if (def.id === 'lust50') {
    progress = state.lust;
  } else if (def.id === 'corrupt70') {
    progress = Math.max(0, ...state.prisoners.map((p) => p.corr));
  } else if (def.id === 'capture_A') {
    const highCount = state.prisoners.filter((p) =>
      ['A', 'S', 'SS', 'SSS'].includes(p.grade)
    ).length;
    target = highCount + 1;
    progress = highCount;
  }

  return {
    id: def.id,
    desc: def.desc,
    rewardMp: def.rewardMp,
    type: def.type,
    target,
    progress,
  };
}

export function getDebtQuestProgress(
  state: GameState,
  quest: DebtQuest
): { current: number; target: number; complete: boolean } {
  const target = quest.target ?? 1;
  let current = quest.progress ?? 0;
  switch (quest.id) {
    case 'hold3':
      current = state.prisoners.length;
      break;
    case 'fear50':
      current = state.fear;
      break;
    case 'lust50':
      current = state.lust;
      break;
    case 'fame2':
      current = state.fame;
      break;
    case 'kill3':
      current = state.kills;
      break;
    case 'wipes2':
      current = state.apGrowth.wipes;
      break;
    case 'nobreach':
      current = state.estate.nobreachStreak;
      break;
    case 'corrupt70':
      current = Math.max(0, ...state.prisoners.map((p) => p.corr));
      break;
    case 'capture_A':
      current = Math.max(
        quest.progress ?? 0,
        state.prisoners.filter((p) => ['A', 'S', 'SS', 'SSS'].includes(p.grade)).length
      );
      break;
  }
  return { current, target, complete: current >= target };
}

export function startOrProgressGraceQuest(
  state: GameState,
  action: 'accept' | 'decline' | 'evaluate',
  questId?: string
): DebtActionResult {
  if (action === 'decline') {
    return {
      ok: true,
      state: {
        ...state,
        debt: {
          ...state.debt,
          activeQuest: null,
          offeredQuests: [],
        },
        flash: 'Declined Goldreich commission.',
      },
      message: 'Commission declined.',
    };
  }

  if (action === 'accept') {
    const offeredMatch = state.debt.offeredQuests.find((q) => q.id === questId);
    const catalogMatch = questId
      ? DEBT_QUESTS.find((q) => q.id === questId)
      : undefined;
    const questInstance = offeredMatch
      ? offeredMatch
      : catalogMatch
      ? toDebtQuestInstance(state, catalogMatch)
      : null;
    if (!questInstance) {
      return {
        ok: false,
        state: { ...state, flash: 'Select a valid Goldreich commission to accept.' },
        message: 'Invalid quest selection.',
      };
    }

    return {
      ok: true,
      state: {
        ...state,
        debt: {
          ...state.debt,
          activeQuest: questInstance,
          offeredQuests: [],
        },
        flash: `Accepted Goldreich Commission: ${questInstance.desc} (-${questInstance.rewardMp} MP debt).`,
      },
      message: `Accepted commission: ${questInstance.desc}`,
      artUrl: resolveSceneAsset('dk_debt_newquest'),
    };
  }

  // evaluate active quest
  const active = state.debt.activeQuest;
  if (!active) {
    return {
      ok: false,
      state: { ...state, flash: 'No active Goldreich commission.' },
      message: 'No active quest.',
    };
  }

  const status = getDebtQuestProgress(state, active);
  if (!status.complete) {
    const nextPatience = clamp(state.debt.patience - 10, 0, 100);
    return {
      ok: true,
      state: {
        ...state,
        debt: {
          ...state.debt,
          patience: nextPatience,
          activeQuest: null,
        },
        flash: `Commission failed (${active.desc}): -10 Patience.`,
      },
      message: `Commission failed (-10 Patience).`,
      artUrl: resolveSceneAsset('dk_debt_quest_fail'),
    };
  }

  let next = state;
  if (active.id === 'corrupt70') {
    const gradeOrder: HeroGrade[] = ['F', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    const candidates = next.prisoners.filter((p) => p.corr >= 70);
    if (candidates.length > 0) {
      candidates.sort(
        (a, b) => gradeOrder.indexOf(b.grade) - gradeOrder.indexOf(a.grade)
      );
      const delivered = candidates[0];
      next = {
        ...next,
        prisoners: next.prisoners.filter((p) => p.pid !== delivered.pid),
      };
    }
  }

  const paid = applyDebtPayment(next, active.rewardMp);
  next = {
    ...paid.state,
    apGrowth: { ...paid.state.apGrowth, quests: paid.state.apGrowth.quests + 1 },
    debt: {
      ...paid.state.debt,
      activeQuest: null,
    },
  };
  next = grantOfficerAffinity(next, 'eleonora', 2).state;
  next = checkPayoffEnding(next);

  return {
    ok: true,
    state: {
      ...next,
      flash: `Commission completed (${active.desc})! Debt reduced by ${active.rewardMp} MP.`,
    },
    message: `Commission completed (-${active.rewardMp} MP debt, +2 Eleonora Aff).`,
    artUrl: resolveSceneAsset('dk_debt_quest_ok'),
  };
}

export function applyDebtSeizure(state: GameState): {
  state: GameState;
  seizedPrisoner: Prisoner | null;
  seizedCredit: number;
} {
  const totalDebt = getTotalDebt(state);
  if (totalDebt <= 0) {
    return { state, seizedPrisoner: null, seizedCredit: 0 };
  }

  if (state.prisoners.length > 0) {
    let best = state.prisoners[0];
    let bestVal = calcPrisonerRansom(state, best, false);
    for (let i = 1; i < state.prisoners.length; i++) {
      const val = calcPrisonerRansom(state, state.prisoners[i], false);
      if (val > bestVal) {
        best = state.prisoners[i];
        bestVal = val;
      }
    }
    const credit = Math.min(totalDebt, bestVal);
    const applied = applyDebtPayment(
      {
        ...state,
        prisoners: state.prisoners.filter((p) => p.pid !== best.pid),
      },
      credit
    );
    return {
      state: applied.state,
      seizedPrisoner: best,
      seizedCredit: credit,
    };
  }

  // Fallback collateral seizure from treasury/vault if no prisoners are available
  const mpSeized = Math.min(state.points, Math.floor(state.points * 0.15));
  if (mpSeized > 0) {
    const applied = applyDebtPayment(
      {
        ...state,
        points: state.points - mpSeized,
      },
      mpSeized
    );
    return {
      state: applied.state,
      seizedPrisoner: null,
      seizedCredit: mpSeized,
    };
  }

  return { state, seizedPrisoner: null, seizedCredit: 0 };
}

export function requestDebtExtension(state: GameState): DebtActionResult {
  const summary = getDebtSummary(state);
  if (state.mode !== 'debt') {
    return {
      ok: false,
      state: { ...state, flash: 'Extension negotiation only happens during Debt Collection.' },
      message: 'Debt mode required.',
    };
  }
  if (!summary.canExtend) {
    return {
      ok: false,
      state: {
        ...state,
        flash: 'Extension requires Patience >= 30 and at least 50% of minimum due paid.',
      },
      message: 'Extension conditions not met.',
    };
  }

  const extCarry = Math.floor(summary.remainingDue * 1.2);
  let next: GameState = {
    ...state,
    debt: {
      ...state.debt,
      extCarry,
      patience: clamp(state.debt.patience - 20, 0, 100),
      step: state.debt.step + 1,
      minCut: 0,
    },
    apUsed: { ...state.apUsed, debt_ent_ok: false },
  };
  next = grantOfficerAffinity(next, 'eleonora', -3).state;
  next = finishDebtPhase(next);
  return {
    ok: true,
    state: {
      ...next,
      flash: `Debt Extension granted (${extCarry} MP carried at +20% surcharge, -20 Patience).`,
    },
    message: `Extension granted (carried ${extCarry} MP).`,
    artUrl: resolveSceneAsset('dk_debt_ext'),
  };
}

export function resolveDebtVisit(state: GameState): DebtVisitResolution {
  if (state.mode !== 'debt') {
    return {
      verdict: getDebtVerdict(state),
      state,
      seizedPrisoner: null,
      seizedCredit: 0,
      questCompleted: null,
      ending: null,
    };
  }

  let working = state;
  let questCompleted: boolean | null = null;

  if (working.debt.activeQuest) {
    const qStatus = getDebtQuestProgress(working, working.debt.activeQuest);
    questCompleted = qStatus.complete;
    working = startOrProgressGraceQuest(working, 'evaluate').state;
  }

  const summary = getDebtSummary(working);
  const verdict = getDebtVerdict(working);
  let seizedPrisoner: Prisoner | null = null;
  let seizedCredit = 0;
  let artKey = 'dk_debt_ontime';

  if (verdict === 'ontime') {
    working = {
      ...working,
      debt: {
        ...working.debt,
        patience: clamp(working.debt.patience + 6, 0, 100),
        lates: Math.max(0, working.debt.lates - 1),
        extCarry: 0,
      },
    };
    working = grantOfficerAffinity(working, 'eleonora', 1).state;
    artKey = 'dk_debt_ontime';
  } else if (verdict === 'ext') {
    working = {
      ...working,
      debt: {
        ...working.debt,
        extCarry: Math.floor(summary.remainingDue * 1.2),
        patience: clamp(working.debt.patience - 20, 0, 100),
      },
    };
    working = grantOfficerAffinity(working, 'eleonora', -3).state;
    artKey = 'dk_debt_ext';
  } else if (verdict === 'forgive') {
    working = {
      ...working,
      debt: {
        ...working.debt,
        forgiveUsed: true,
        extCarry: summary.remainingDue,
        patience: clamp(working.debt.patience - 10, 0, 100),
      },
    };
    artKey = 'dk_debt_forgive';
  } else {
    // Late strike + 10% principal penalty + seizure
    const nextLates = working.debt.lates + 1;
    working = {
      ...working,
      debt: {
        ...working.debt,
        lates: nextLates,
        amount: Math.floor(working.debt.amount * 1.1),
        patience: clamp(working.debt.patience - 30, 0, 100),
        extCarry: 0,
      },
    };
    const seized = applyDebtSeizure(working);
    working = seized.state;
    seizedPrisoner = seized.seizedPrisoner;
    seizedCredit = seized.seizedCredit;
    artKey = seizedPrisoner ? 'dk_debt_seize' : nextLates >= 2 ? 'dk_debt_late2' : 'dk_debt_late';
  }

  // Check bankrupt or payoff ending
  if (working.debt.lates >= 3) {
    const bankruptState = triggerBankruptEnding(working);
    return {
      verdict,
      state: bankruptState,
      seizedPrisoner,
      seizedCredit,
      questCompleted,
      ending: 'bankrupt',
      artUrl: resolveSceneAsset('dk_end_bankrupt'),
    };
  }

  working = checkPayoffEnding(working);
  if (working.debt.ended === 'romance' || working.debt.ended === 'liberation') {
    const endedKey = working.debt.ended;
    const nextBuild = finishDebtPhase({
      ...working,
      debt: {
        ...working.debt,
        step: working.debt.step + 1,
        minCut: 0,
        offeredQuests: [],
      },
    });
    return {
      verdict,
      state: nextBuild,
      seizedPrisoner,
      seizedCredit,
      questCompleted,
      ending: endedKey,
      artUrl: resolveSceneAsset(
        endedKey === 'romance' ? 'dk_end_romance' : 'dk_end_liberation'
      ),
    };
  }

  const nextState = finishDebtPhase({
    ...working,
    debt: {
      ...working.debt,
      step: working.debt.step + 1,
      minCut: 0,
      offeredQuests: [],
    },
    apUsed: { ...working.apUsed, debt_ent_ok: false },
  });

  return {
    verdict,
    state: nextState,
    seizedPrisoner,
    seizedCredit,
    questCompleted,
    ending: null,
    artUrl: resolveSceneAsset(artKey),
  };
}

export function calcNetAssets(state: GameState): number {
  let total = 0;
  for (const fl of state.floors) {
    for (const slot of fl.slots) {
      total += slot.mpInvested ?? 0;
    }
  }
  for (const lv of Object.values(state.estate.facilities)) {
    total += lv * 100;
  }
  for (let i = 1; i < state.town.lv; i++) {
    total += TOWN_LEVELS[i]?.upgradeCost ?? 0;
  }
  if (state.wonders.spire) total += 1000;
  if (state.wonders.temple) total += 2500;
  if (state.wonders.gold) total += 5000;
  return total;
}

export function getExtraLoanInfo(state: GameState): {
  assets: number;
  limit: number;
  used: number;
  available: number;
} {
  const assets = calcNetAssets(state);
  const limit = Math.max(200, Math.floor(assets * 0.7));
  const used = state.debt.extraLoan;
  return {
    assets,
    limit,
    used,
    available: Math.max(0, limit - used),
  };
}

export function takeExtraLoan(
  state: GameState,
  amount: 50 | 100 | 200
): DebtActionResult {
  if (state.debt.ended) {
    return {
      ok: false,
      state: { ...state, flash: 'Debt contract already concluded.' },
      message: 'Contract ended.',
    };
  }
  if (!isDayPhase(state)) {
    return {
      ok: false,
      state: { ...state, flash: 'Additional loans require Day (AP) phase.' },
      message: 'Day phase required.',
    };
  }
  const guard = canSpendDayAp(state, 'loan');
  if (!guard.ok) {
    return {
      ok: false,
      state: { ...state, flash: guard.reason },
      message: guard.reason,
    };
  }
  const info = getExtraLoanInfo(state);
  if (amount > info.available) {
    return {
      ok: false,
      state: { ...state, flash: `Loan exceeds remaining collateral limit (${info.available} MP).` },
      message: 'Collateral limit exceeded.',
    };
  }

  const spent = spendDayAp(state, 'loan', {
    text: `Took Goldreich emergency loan (+${amount} MP at 3%/wave interest)`,
    kind: 'debt',
    art: 'dk_debt_extra',
  });
  if (!spent.ok) {
    return { ok: false, state: spent.state, message: spent.state.flash };
  }

  const next: GameState = {
    ...spent.state,
    points: spent.state.points + amount,
    debt: {
      ...spent.state.debt,
      extraLoan: spent.state.debt.extraLoan + amount,
    },
    flash: `Borrowed +${amount} MP (Extra loan: ${spent.state.debt.extraLoan + amount} MP).`,
  };
  return {
    ok: true,
    state: next,
    message: `Borrowed +${amount} MP.`,
    artUrl: resolveSceneAsset('dk_debt_extra'),
  };
}

export function getEleonoraVisitSceneContext(state: GameState): {
  title: string;
  context: string;
  imageUrl?: string;
} {
  const summary = getDebtSummary(state);
  const verdict = getDebtVerdict(state);
  return {
    title: `Eleonora Goldreich — Wave ${state.wave} Collection Visit`,
    context: [
      `Eleonora Goldreich (Stage ${state.officers.eleonora.stage}, Aff ${state.officers.eleonora.aff}, Patience ${summary.patience}/100, Strikes ${summary.lates}/3)`,
      `Principal Debt: ${summary.principal} MP | Extra Loan: ${summary.extraLoan} MP | Total: ${summary.totalDebt} MP`,
      `Installment Minimum Due: ${summary.minDue} MP | Paid This Visit: ${summary.paidThisVisit} MP | Remaining: ${summary.remainingDue} MP`,
      `Projected Verdict: ${verdict.toUpperCase()}`,
      state.debt.activeQuest
        ? `Active Commission: ${state.debt.activeQuest.desc}`
        : 'No active commission',
    ].join('\n'),
    imageUrl:
      resolveSceneAsset(state.debt.cycleCount === 0 ? 'dk_debt_intro' : 'dk_base_debt') ??
      resolveNpcImage('eleonora', summary.lates > 0 ? 'angry' : 'proud'),
  };
}
