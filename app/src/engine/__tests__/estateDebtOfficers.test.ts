import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSceneAsset } from '../../data/assetManifest';
import {
  EXPLORE_EVENTS,
  EXPLORE_LOCATIONS,
  FACILITIES,
  OFFICER_INTERACTIONS,
  SETTLEMENT_CRISES,
} from '../../data/estateData';
import type { ExploreEffectSpec } from '../../data/estateData';
import { PRISON_JOB_MAP, SERVANT_MP_BY_GRADE } from '../../data/prisonData';
import type { Prisoner } from '../../types/game';
import { calcRestMp, finishManagementSettle, startNewDay } from '../dayLoop';
import {
  applyDebtSeizure,
  entertainEleonora,
  getDebtSummary,
  getEleonoraVisitSceneContext,
  handoverPrisonerForDebt,
  payDebt,
  requestDebtExtension,
  resolveDebtVisit,
  rollDebtQuests,
  startOrProgressGraceQuest,
  takeExtraLoan,
} from '../debt';
import {
  applyManagementSettle,
  buildOrUpgradeFacility,
  calcPopCap,
  calcTownTax,
  computeManagementSettle,
  EVENT_MP_PAYOUT_CAP,
  exploreTown,
  getNextTownLevelInfo,
  performTownAction,
  resolveExploreEvent,
  resolveSettlementCrisis,
  rollSettlementCrisis,
  setTownPolicy,
  upgradeTown,
} from '../estate';
import {
  calcOfficerAffGain,
  getOfficerPerksSummary,
  getOfficerProfileStats,
  getOfficerSceneContext,
  giftOfficer,
  performOfficerInteraction,
  talkToOfficer,
} from '../officers';
import { getJobSettleYield, getJobYieldPreview } from '../prison';
import { createInitialGameState } from '../saveLoad';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeDayState(overrides?: Partial<ReturnType<typeof createInitialGameState>>) {
  const base = startNewDay({
    ...createInitialGameState(),
    wave: 3,
    points: 2000,
  });
  return { ...base, ...overrides };
}

function makePrisoner(pid: number, overrides?: Partial<Prisoner>): Prisoner {
  return {
    pid,
    name: `Captive-${pid}`,
    grade: 'B',
    raceLabel: 'human',
    classLabel: 'knight',
    traits: ['noble'],
    capturedWave: 1,
    capturedFloor: 1,
    resist: 40,
    corr: 20,
    gender: 'female',
    stamina: 100,
    staminaMax: 100,
    pleasure: 10,
    terror: 10,
    shame: 5,
    marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
    cond: '',
    job: null,
    converted: null,
    assignedFloor: null,
    owner: null,
    afflictions: [],
    breeding: null,
    ...overrides,
  };
}

describe('Estate Data Integrity', () => {
  it('defines all 25 facilities, 20 explore events, 16 settlement crises, and 32 officer interactions', () => {
    expect(FACILITIES).toHaveLength(25);
    expect(EXPLORE_EVENTS).toHaveLength(20);
    expect(SETTLEMENT_CRISES).toHaveLength(16);
    expect(OFFICER_INTERACTIONS).toHaveLength(32);
    expect(EXPLORE_LOCATIONS.length).toBeGreaterThanOrEqual(9);

    for (const ia of OFFICER_INTERACTIONS) {
      expect(resolveSceneAsset(ia.artKey)).toBeDefined();
    }
    for (const ev of EXPLORE_EVENTS) {
      expect(resolveSceneAsset(ev.artKey)).toBeDefined();
    }
  });
});

describe('Estate: Town Lv1-5, 25 Facilities, Explore (20 Events) & M.Settle', () => {
  it('enforces facility prerequisites, town level caps, and spawns monster on beastpen', () => {
    let state = makeDayState({ points: 1000 });
    // beastpen requires dairy >= 1
    const failRes = buildOrUpgradeFacility(state, 'beastpen');
    expect(failRes.ok).toBe(false);

    // Build dairy Lv.1
    const dairyRes = buildOrUpgradeFacility(state, 'dairy');
    expect(dairyRes.ok).toBe(true);
    state = dairyRes.state;
    expect(state.estate.facilities.dairy).toBe(1);

    // Cannot upgrade dairy to Lv.2 while Town is Lv.1
    const capRes = buildOrUpgradeFacility(state, 'dairy');
    expect(capRes.ok).toBe(false);

    // Build beastpen Lv.1 -> spawns 1 monster
    const penRes = buildOrUpgradeFacility(state, 'beastpen');
    expect(penRes.ok).toBe(true);
    expect(penRes.state.monsters).toHaveLength(1);
    expect(penRes.state.dayLines.length).toBeGreaterThanOrEqual(2);
  });

  it('progresses Town Lv 1 -> 5 and unlocks prosperity ending at Lv 5', () => {
    let state = makeDayState({
      points: 5000,
      town: {
        ...createInitialGameState().town,
        lv: 1,
        pop: 1200,
      },
      estate: {
        ...createInitialGameState().estate,
        facilities: {
          inn: 2,
          farmland: 2,
          housing: 2,
          market: 2,
          smithy: 2,
          watch: 2,
          manor: 2,
        },
      },
    });

    for (let target = 2; target <= 5; target++) {
      const info = getNextTownLevelInfo(state);
      expect(info.canUpgrade).toBe(true);
      const res = upgradeTown(state);
      expect(res.ok).toBe(true);
      state = res.state;
      expect(state.town.lv).toBe(target);
    }

    expect(state.endings.unlocked.prosperity).toBe(state.wave);
    expect(state.endings.endless).toBe(true);
  });

  it('runs Explore Town (1 AP) across locations, resolves choice, and falls back to quiet stroll on cooldown', () => {
    let state = makeDayState({ points: 300, ap: 3 });

    // Town square is always unlocked
    const exp1 = exploreTown(state, 'square', 'sq_petition');
    expect(exp1.ok).toBe(true);
    expect(exp1.event?.id).toBe('sq_petition');
    expect(exp1.state.ap).toBe(2);

    const res1 = resolveExploreEvent(exp1.state, 0);
    expect(res1.ok).toBe(true);
    expect(res1.state.town.order).toBe(64);
    expect(res1.state.town.approval).toBe(56);
    expect(res1.state.estate.activeLocation).toBe('square');

    // Put remaining square events on cooldown -> next explore is a quiet stroll.
    // Ticket 19: after 1 explore today, the payout decays to max(3, 8 - 2*1) = 6 MP.
    state = {
      ...res1.state,
      estate: {
        ...res1.state.estate,
        crisisCooldowns: {
          ...res1.state.estate.crisisCooldowns,
          ev_sq_peddler: 99,
          ev_sq_festival: 99,
        },
      },
    };
    const ptsBefore = state.points;
    const stroll = exploreTown(state, 'square');
    expect(stroll.ok).toBe(true);
    expect(stroll.quietStroll).toBe(true);
    expect(stroll.state.points).toBe(ptsBefore + 6);
    expect(stroll.state.estate.exploreCountToday).toBe(2);
  });

  it('decays quiet stroll MP (+8/+6/+4/+3) across explores and keeps rest as the floor', () => {
    // Silence every square event so each explore resolves to a quiet stroll.
    let state = makeDayState({
      points: 100,
      ap: 4,
      estate: {
        ...createInitialGameState().estate,
        crisisCooldowns: {
          ev_sq_peddler: 99,
          ev_sq_petition: 99,
          ev_sq_festival: 99,
        },
      },
    });
    const payouts: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = state.points;
      const res = exploreTown(state, 'square');
      expect(res.ok).toBe(true);
      expect(res.quietStroll).toBe(true);
      payouts.push(res.state.points - before);
      state = res.state;
    }
    expect(payouts).toEqual([8, 6, 4, 3]);
    expect(state.estate.exploreCountToday).toBe(4);
    // Rest floor: resting converts each AP at 10 MP (calcRestMp), so a stroll
    // must never match or beat the rest rate, even on the first explore.
    const restRatePerAp = calcRestMp({ ...state, ap: 1 });
    payouts.forEach((p) => expect(p).toBeLessThan(restRatePerAp));
  });

  it('caps event MP payouts at +15 and fires real negative wager branches (approval/food)', () => {
    // Data invariant: every positive mp payout (incl. chance branches) respects the cap.
    for (const ev of EXPLORE_EVENTS) {
      for (const choice of ev.choices) {
        const branches: ExploreEffectSpec[] = [choice.eff];
        if (choice.eff.chance) {
          branches.push(choice.eff.chance.success, choice.eff.chance.fail);
        }
        for (const eff of branches) {
          if ((eff.mp ?? 0) > 0) {
            expect(eff.mp as number).toBeLessThanOrEqual(EVENT_MP_PAYOUT_CAP);
          }
        }
      }
    }

    // Inn brawl wager SUCCESS pays the promised +15 (right at the cap).
    const winState = makeDayState({
      points: 300,
      ap: 3,
      estate: { ...createInitialGameState().estate, facilities: { inn: 1 } },
    });
    const winEnc = exploreTown(winState, 'inn', 'inn_brawl');
    expect(winEnc.ok).toBe(true);
    const winPts = winEnc.state.points;
    const win = resolveExploreEvent(winEnc.state, 1, true);
    expect(win.ok).toBe(true);
    expect(win.state.points).toBe(winPts + 15);

    // Inn brawl wager FAILURE costs MP AND approval (real downside, not zero).
    const loseState = makeDayState({
      points: 300,
      ap: 3,
      estate: { ...createInitialGameState().estate, facilities: { inn: 1 } },
    });
    const loseEnc = exploreTown(loseState, 'inn', 'inn_brawl');
    expect(loseEnc.ok).toBe(true);
    const losePts = loseEnc.state.points;
    const approvalBefore = loseEnc.state.town.approval;
    const lose = resolveExploreEvent(loseEnc.state, 1, false);
    expect(lose.ok).toBe(true);
    expect(lose.state.points).toBe(losePts - 3);
    expect(lose.state.town.approval).toBe(approvalBefore - 3);

    // Smithy field-test FAILURE costs MP AND food.
    const smithState = makeDayState({
      points: 300,
      ap: 3,
      estate: { ...createInitialGameState().estate, facilities: { smithy: 1 } },
    });
    const smithEnc = exploreTown(smithState, 'smithy', 'smi_proto');
    expect(smithEnc.ok).toBe(true);
    const smithPts = smithEnc.state.points;
    const foodBefore = smithEnc.state.town.food;
    const smithFail = resolveExploreEvent(smithEnc.state, 0, false);
    expect(smithFail.ok).toBe(true);
    expect(smithFail.state.points).toBe(smithPts - 3);
    expect(smithFail.state.town.food).toBe(foodBefore - 5);
  });

  it('stacks repeat explore intel into maxIntelBonus instead of wasting the repeat', () => {
    let state = makeDayState({ points: 300, ap: 3 });
    const enc1 = exploreTown(state, 'square', 'sq_peddler');
    expect(enc1.ok).toBe(true);
    const buy1 = resolveExploreEvent(enc1.state, 1); // Buy Road Rumors (8 MP)
    expect(buy1.ok).toBe(true);
    expect(buy1.state.estate.perks.prepIntelOnce).toBe(true);
    expect(buy1.state.estate.perks.maxIntelBonus ?? 0).toBe(0);

    // Clear the event cooldown so the same intel purchase can be made again.
    state = {
      ...buy1.state,
      estate: { ...buy1.state.estate, crisisCooldowns: {} },
    };
    const enc2 = exploreTown(state, 'square', 'sq_peddler');
    expect(enc2.ok).toBe(true);
    const ptsBefore = enc2.state.points;
    const buy2 = resolveExploreEvent(enc2.state, 1);
    expect(buy2.ok).toBe(true);
    expect(buy2.state.points).toBe(ptsBefore - 8);
    expect(buy2.state.estate.perks.maxIntelBonus ?? 0).toBe(1);
  });

  it('computes M.Settle deterministic ledger and applies town, servant, vault, and debt interest updates', () => {
    const servant = makePrisoner(1, { grade: 'A', converted: 'servant' });
    const state = makeDayState({
      mode: 'msettle',
      points: 100,
      prisoners: [servant],
      town: {
        ...createInitialGameState().town,
        lv: 2,
        pop: 200,
        food: 50,
        housing: 60,
        approval: 75,
        order: 70,
        policy: 'high',
      },
      estate: {
        ...createInitialGameState().estate,
        facilities: { farmland: 1, inn: 1, brothel: 1 },
      },
      officers: {
        ...createInitialGameState().officers,
        vesper: { aff: 70, stage: 3, cooldowns: {}, usedOnce: {} },
        eleonora: { aff: 25, stage: 1, cooldowns: {}, usedOnce: {} },
      },
    });

    const popCap = calcPopCap(state);
    expect(popCap).toBeGreaterThan(450);
    expect(calcTownTax(state)).toBeGreaterThan(0);

    const ledger = computeManagementSettle(state);
    expect(ledger.servantMp).toBe(16); // Grade A servant
    expect(ledger.vesperBonusMp).toBe(10); // Vesper Stage 3
    expect(ledger.foodProd).toBe(11); // 8 + 3*1 farmland
    expect(ledger.vaultDeposit).toBeGreaterThan(0);
    expect(ledger.debtInterestPrincipal).toBe(Math.ceil(3000 * 0.008));

    const settled = applyManagementSettle(state, { rollCrisis: false });
    expect(settled.state.points).toBe(ledger.pointsAfter);
    expect(settled.state.estate.vaultMp).toBe(ledger.vaultAfter);
    expect(settled.state.debt.amount).toBe(3000 + ledger.debtInterestPrincipal);
  });

  it('rolls condition-gated Settlement Crises and resolves choices with raid modifiers', () => {
    const hungryState = makeDayState({
      mode: 'msettle',
      points: 100,
      town: { ...createInitialGameState().town, food: 10 },
    });

    const rolled = rollSettlementCrisis(hungryState, { forceCrisisId: 'famine' });
    expect(rolled.crisis?.id).toBe('famine');
    expect(rolled.state.estate.activeCrisis).toBe('famine');

    // Choice 1 (Ignore Starvation) -> -6 approval + first_dc -2 raid mod
    const resolved = resolveSettlementCrisis(rolled.state, 1);
    expect(resolved.ok).toBe(true);
    expect(resolved.state.estate.activeCrisis).toBeNull();
    expect(resolved.state.town.approval).toBe(rolled.state.town.approval - 6);
    expect(resolved.state.crises.activeRaidMods).toEqual([
      { key: 'first_dc', value: -2 },
    ]);
  });

  it('triggers Casual Grace once on famine/ruin and triggers Game Over on normal mode', () => {
    const casualState = makeDayState({
      mode: 'msettle',
      settings: { ...createInitialGameState().settings, difficulty: 'casual' },
      town: { ...createInitialGameState().town, food: 0, famine: 2, pop: 180, housing: 50 },
    });
    const saved = applyManagementSettle(casualState, { rollCrisis: false });
    expect(saved.ledger.casualGraceTriggered).toBe(true);
    expect(saved.state.mode).toBe('msettle');
    expect(saved.state.estate.casualGraceUsed).toBe(true);

    const normalState = {
      ...casualState,
      settings: { ...casualState.settings, difficulty: 'normal' as const },
    };
    const over = applyManagementSettle(normalState, { rollCrisis: false });
    expect(over.state.mode).toBe('over');
    expect(over.state.endings.gameOver).toBe('famine');
  });

  it('supports town policy changes and direct town actions', () => {
    const state = makeDayState();
    const highTax = setTownPolicy(state, 'high');
    expect(highTax.town.policy).toBe('high');

    const act = performTownAction(highTax, 'petition');
    expect(act.ok).toBe(true);
    expect(act.state.town.approval).toBe(56);
    expect(act.state.ap).toBe(2);
  });
});

describe('Debt: 3-Wave Goldreich Schedule, Prepay, Grace Quests, Seizure & Bankrupt', () => {
  it('computes installment minimum due, prepay with affinity bonus, and payoff ending', () => {
    const state = makeDayState({
      mode: 'estate',
      points: 3500,
      officers: {
        ...createInitialGameState().officers,
        eleonora: { aff: 90, stage: 4, cooldowns: {}, usedOnce: {} },
      },
    });
    const summary = getDebtSummary(state);
    expect(summary.minDue).toBe(30);
    expect(summary.totalDebt).toBe(3000);

    // Prepay 250 MP -> +2 Eleonora affinity cap
    const pre = payDebt(state, 250);
    expect(pre.ok).toBe(true);
    expect(pre.state.debt.amount).toBe(2750);
    expect(pre.state.officers.eleonora.aff).toBe(92);

    // Pay off remaining 2750 MP -> Romance Ending (aff >= 90)
    const payoff = payDebt(pre.state, 2750);
    expect(payoff.ok).toBe(true);
    expect(payoff.state.debt.ended).toBe('romance');
    expect(payoff.state.endings.unlocked.romance).toBe(payoff.state.wave);
  });

  it('supports Eleonora entertainment, prisoner handover, and extension math', () => {
    const p1 = makePrisoner(1, { grade: 'A' });
    let state = makeDayState({
      mode: 'debt',
      wave: 3,
      points: 100,
      prisoners: [p1],
      officers: {
        ...createInitialGameState().officers,
        eleonora: { aff: 45, stage: 2, cooldowns: {}, usedOnce: {} },
      },
      debt: {
        ...createInitialGameState().debt,
        step: 2, // baseMin = 120
        dueWave: 3,
      },
    });

    // Entertain success -> -25% min due (120 -> 90), entApPenalty = 1
    const ent = entertainEleonora(state, true);
    expect(ent.ok).toBe(true);
    expect(ent.state.entApPenalty).toBe(1);
    expect(getDebtSummary(ent.state).minDue).toBe(90);

    // Handover captive -> Stage 2 Eleonora gives 1.3x ransom credit
    const hand = handoverPrisonerForDebt(ent.state, 1);
    expect(hand.ok).toBe(true);
    expect(hand.state.prisoners).toHaveLength(0);
    expect(hand.state.debt.paidThisVisit).toBeGreaterThan(0);

    // Extension check on partial payment (pay 50 of 100 min due)
    const extBase = makeDayState({
      mode: 'debt',
      wave: 3,
      points: 200,
      debt: {
        ...createInitialGameState().debt,
        step: 2, // baseMin = 120
        paidThisVisit: 60, // >= 50% of 120
        patience: 50,
      },
    });
    const ext = requestDebtExtension(extBase);
    expect(ext.ok).toBe(true);
    expect(ext.state.mode).toBe('build');
    expect(ext.state.debt.extCarry).toBe(Math.floor(60 * 1.2)); // 72
    expect(ext.state.debt.patience).toBe(30);
    expect(ext.state.debt.dueWave).toBe(6);
  });

  it('handles Grace Quests, late seizure, and 3-strike Bankruptcy', () => {
    let state = makeDayState({
      mode: 'debt',
      wave: 3,
      points: 0,
      fear: 60,
      prisoners: [makePrisoner(1, { grade: 'S' })],
      debt: {
        ...createInitialGameState().debt,
        lates: 0,
      },
    });

    state = rollDebtQuests(state);
    expect(state.debt.offeredQuests).toHaveLength(2);

    // Accept fear50 quest and evaluate -> immediately met since fear=60
    const acc = startOrProgressGraceQuest(state, 'accept', 'fear50');
    expect(acc.ok).toBe(true);
    const done = startOrProgressGraceQuest(acc.state, 'evaluate');
    expect(done.ok).toBe(true);
    expect(done.state.debt.amount).toBe(3000 - 120);
    expect(done.state.apGrowth.quests).toBe(1);

    // Late verdict seizes highest-ransom prisoner and adds +10% late fee
    const lateVisit = resolveDebtVisit(done.state);
    expect(lateVisit.verdict).toBe('late');
    expect(lateVisit.seizedPrisoner?.pid).toBe(1);
    expect(lateVisit.state.debt.lates).toBe(1);
    expect(lateVisit.state.prisoners).toHaveLength(0);

    // 3rd late strike -> Bankrupt Game Over
    const strike2 = {
      ...lateVisit.state,
      mode: 'debt' as const,
      debt: { ...lateVisit.state.debt, lates: 2, paidThisVisit: 0 },
    };
    const bankruptRes = resolveDebtVisit(strike2);
    expect(bankruptRes.ending).toBe('bankrupt');
    expect(bankruptRes.state.mode).toBe('over');
    expect(bankruptRes.state.endings.gameOver).toBe('bankrupt');

    // Also test direct seizure helper & scene context
    const directSeize = applyDebtSeizure(
      makeDayState({ prisoners: [makePrisoner(7, { grade: 'SS' })] })
    );
    expect(directSeize.seizedPrisoner?.pid).toBe(7);
    expect(directSeize.seizedCredit).toBeGreaterThan(0);

    const ctx = getEleonoraVisitSceneContext(strike2);
    expect(ctx.title).toContain('Eleonora Goldreich');
  });

  it('allows taking Extra Loans within LTV cap and charges 3% interest', () => {
    const state = makeDayState({ points: 100 });
    const loan = takeExtraLoan(state, 100);
    expect(loan.ok).toBe(true);
    expect(loan.state.points).toBe(200);
    expect(loan.state.debt.extraLoan).toBe(100);
    expect(getDebtSummary(loan.state).extraLoanMin).toBe(10);
  });
});

describe('Officers: Stage 1-5, Affinity, Interactions & Active Perk Hooks', () => {
  it('scales affinity gain with Manor and Bath/Trade facilities and locks 1 AP per officer/day', () => {
    const state = makeDayState({
      estate: {
        ...createInitialGameState().estate,
        facilities: { manor: 2, bath: 2, trade: 1 },
      },
    });
    // Manor Lv2 = 1.6x, Bath Lv2 = +2 flat
    expect(calcOfficerAffGain(state, 'vesper', 4)).toBe(Math.floor((4 + 2) * 1.6 * 1));

    const talk = talkToOfficer(state, 'vesper');
    expect(talk.ok).toBe(true);
    expect(talk.state.ap).toBe(2);

    // Second action on Vesper same day fails
    const giftFail = giftOfficer(talk.state, 'vesper');
    expect(giftFail.ok).toBe(false);

    // Can still gift Lilim on the same day
    const lilimGift = giftOfficer(talk.state, 'lilim');
    expect(lilimGift.ok).toBe(true);
    expect(lilimGift.state.ap).toBe(1);
  });

  it('activates Vesper V5/V7/V8 perks, Lilim intel/grading leaks, and Eleonora E8/E10 decrees', () => {
    let state = makeDayState({
      points: 500,
      ap: 3,
      officers: {
        vesper: { aff: 90, stage: 4, cooldowns: {}, usedOnce: {} },
        lilim: { aff: 90, stage: 4, cooldowns: {}, usedOnce: {} },
        eleonora: { aff: 100, stage: 5, cooldowns: {}, usedOnce: {} },
        waveAffGain: { vesper: 0, lilim: 0, eleonora: 0 },
      },
    });

    // Vesper V5 -> Rest MP x2 (+20 MP/AP)
    const v5 = performOfficerInteraction(state, 'V5');
    expect(v5.ok).toBe(true);
    expect(calcRestMp(v5.state)).toBe(v5.state.ap * 20);

    // Next day test V7 -> +1 AP bonus carried to startNewDay
    const v7 = performOfficerInteraction(
      { ...v5.state, apUsed: {}, ap: 2 },
      'V7'
    );
    expect(v7.ok).toBe(true);
    const nextDay = startNewDay(v7.state);
    expect(nextDay.ap).toBe(nextDay.apMax + 1);

    // Lilim L5 (+1 prep intel) + L7 (+20%p ace downgrade) + L3 (upgrade discount)
    const l5 = performOfficerInteraction(nextDay, 'L5');
    expect(l5.ok).toBe(true);
    const l7 = performOfficerInteraction(
      { ...l5.state, apUsed: {} },
      'L7'
    );
    expect(l7.ok).toBe(true);
    const perks = getOfficerPerksSummary(l7.state);
    expect(perks.prepIntelBonus).toBe(2); // Stage 2 (+1) + L5 (+1)
    expect(perks.aceDowngradeChance).toBeCloseTo(0.5); // Stage 4 (0.3) + L7 (0.2)
    expect(perks.trapUpgradeDiscountMult).toBeCloseTo(0.9); // Stage 1 (-10%)

    // Eleonora E8 -> waives interest in M.Settle
    const e8 = performOfficerInteraction(
      { ...l7.state, apUsed: {} },
      'E8'
    );
    expect(e8.ok).toBe(true);
    expect(e8.state.debt.noInterest).toBe(true);
    const msettle = computeManagementSettle(e8.state);
    expect(msettle.interestWaived).toBe(true);
    expect(msettle.debtInterestPrincipal).toBe(0);

    // Eleonora E10 -> Dowry Romance Ending when debt <= 600
    const lowDebtState = {
      ...e8.state,
      apUsed: {},
      debt: { ...e8.state.debt, amount: 500, extraLoan: 0 },
    };
    const e10 = performOfficerInteraction(lowDebtState, 'E10');
    expect(e10.ok).toBe(true);
    expect(e10.state.debt.ended).toBe('romance_dowry');
    expect(e10.state.endings.unlocked.romance_dowry).toBe(e10.state.wave);
  });

  it('builds officer profile stats, scene context, and enforces M.Settle -> Debt transition', () => {
    const state = makeDayState({
      mode: 'msettle',
      wave: 3,
      debt: { ...createInitialGameState().debt, dueWave: 3 },
    });
    const prof = getOfficerProfileStats(state, 'eleonora');
    expect(prof.maxStage).toBe(5);
    const sceneCtx = getOfficerSceneContext(state, 'vesper');
    expect(sceneCtx.title).toContain('Vesper');

    const toDebt = finishManagementSettle(state);
    expect(toDebt.mode).toBe('debt');
  });
});

// ---------------------------------------------------------------------------
// Ticket 23: Job Settle Ledger from Preview Math
// ---------------------------------------------------------------------------
describe('Ticket 23: Job Settle Ledger from Preview Math', () => {
  const SETTLE_OPTS = { rollCrisis: false, jobRisks: false } as const;

  it('pays 3-star workers more than 1-star on the same job and matches preview exactly', () => {
    // Dairy aptitude = pleasure + stamina. 1-star vs 3-star dairy workers.
    const w1 = makePrisoner(1, { pleasure: 5, stamina: 50, job: 'dairy' });
    const w3 = makePrisoner(2, { pleasure: 90, stamina: 100, job: 'dairy' });
    const state = makeDayState({ prisoners: [w1, w3] });

    const y1 = getJobSettleYield(state, w1, 'dairy');
    const y3 = getJobSettleYield(state, w3, 'dairy');
    expect(y1.stars).toBe(1);
    expect(y3.stars).toBe(3);
    expect(y1.mp).toBe(6); // round(8 * 0.7)
    expect(y1.food).toBe(4); // round(5 * 0.7)
    expect(y3.mp).toBe(11); // round(8 * 1.4)
    expect(y3.food).toBe(7);
    expect(y3.mp).toBeGreaterThan(y1.mp);

    const ledger = computeManagementSettle(state);
    expect(ledger.jobMp).toBe(17);
    expect(ledger.jobFood).toBe(11);

    // Parity: solo worker ledger == preview == shared math.
    const soloState = makeDayState({ prisoners: [w3] });
    const soloLedger = computeManagementSettle(soloState);
    expect(soloLedger.jobMp).toBe(11);
    expect(soloLedger.jobMp).toBe(getJobYieldPreview(soloState, w3, 'dairy').mp);
    expect(soloLedger.jobMp).toBe(getJobSettleYield(soloState, w3, 'dairy').mp);
  });

  it('charges job staminaCost per settle and keeps the rest/spa loop viable', () => {
    // food 40 -> base regen 15. Farm worker (cost 8): 40 - 8 + 15 = 47.
    const worker = makePrisoner(1, { stamina: 40, job: 'farm' });
    const bystander = makePrisoner(2, { stamina: 40 });
    const res = applyManagementSettle(
      makeDayState({ prisoners: [worker, bystander] }),
      SETTLE_OPTS
    );
    const settledWorker = res.state.prisoners.find((p) => p.pid === 1)!;
    const settledBystander = res.state.prisoners.find((p) => p.pid === 2)!;
    expect(settledBystander.stamina).toBe(55); // 40 + 15 regen
    expect(settledWorker.stamina).toBe(47); // 40 - 8 work + 15 regen
    expect(settledBystander.stamina - settledWorker.stamina).toBe(8);

    // Viability: Spa Lv3 + food 60 regen (25+20=45) beats the heaviest job (arena 15).
    const spaState = makeDayState({
      prisoners: [makePrisoner(1, { stamina: 50, job: 'arena' })],
      town: { ...createInitialGameState().town, food: 60 },
      estate: {
        ...createInitialGameState().estate,
        facilities: { spa: 3 },
      },
    });
    const spaRes = applyManagementSettle(spaState, SETTLE_OPTS);
    expect(spaRes.state.prisoners[0].stamina).toBe(80); // 50 - 15 + 45
  });

  it('halves job output for exhausted workers (stamina < 30) and flags it in the preview', () => {
    const tired = makePrisoner(1, { pleasure: 90, stamina: 25, job: 'dairy' });
    const state = makeDayState({ prisoners: [tired] });

    const y = getJobSettleYield(state, tired, 'dairy');
    expect(y.stars).toBe(2);
    expect(y.lowStamina).toBe(true);
    expect(y.mp).toBe(4); // round(8 * 1.0 * 0.5)
    expect(y.food).toBe(3); // round(5 * 0.5)

    const preview = getJobYieldPreview(state, tired, 'dairy');
    expect(preview.mp).toBe(4);
    expect(preview.stats).toContain('Exhausted (1/2 output)');

    const ledger = computeManagementSettle(state);
    expect(ledger.jobMp).toBe(4);
    expect(ledger.jobFood).toBe(3);

    // Right at the threshold (30) the worker is NOT exhausted.
    const ok = getJobSettleYield(state, { ...tired, stamina: 30 }, 'dairy');
    expect(ok.lowStamina).toBe(false);
    expect(ok.mp).toBe(8);
  });

  it('applies the job prisonerDelta conditioning at settle', () => {
    const stockWorker = makePrisoner(1, { shame: 5, job: 'square' }); // shame +8
    const farmWorker = makePrisoner(2, { resist: 40, job: 'farm' }); // resist -2
    const res = applyManagementSettle(
      makeDayState({ prisoners: [stockWorker, farmWorker] }),
      SETTLE_OPTS
    );
    expect(res.state.prisoners[0].shame).toBe(13); // 5 + 8
    expect(res.state.prisoners[1].resist).toBe(38); // 40 - 2
  });

  it('rolls job risks: bait rescue, altar sacrifice, decoy betrayal, gibbet accident', () => {
    const runWithRoll = (job: string, roll: number) => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(roll);
      const res = applyManagementSettle(
        makeDayState({ prisoners: [makePrisoner(1, { job })] }),
        { rollCrisis: false }
      );
      spy.mockRestore();
      return res;
    };

    // Every roll is 0 -> the first (and only) risk branch of each job fires.
    const rescue = runWithRoll('bait', 0);
    expect(rescue.state.prisoners).toHaveLength(0);
    expect(rescue.ledger.jobRiskNotes[0]).toContain('rescued');

    const sacrifice = runWithRoll('altar', 0);
    expect(sacrifice.state.prisoners).toHaveLength(0);
    expect(sacrifice.ledger.jobRiskNotes[0]).toContain('sacrificed');

    const betrayal = runWithRoll('decoy', 0);
    expect(betrayal.state.prisoners).toHaveLength(0);
    expect(betrayal.ledger.jobRiskNotes[0]).toContain('betrayed');

    const accident = runWithRoll('gibbetx', 0);
    expect(accident.state.prisoners).toHaveLength(1);
    expect(accident.state.prisoners[0].cond).toBe('injured');
    expect(accident.state.prisoners[0].stamina).toBe(85); // regen applied, then -15
    expect(accident.ledger.jobRiskNotes[0]).toContain('accident');

    // A safe roll (0.99 beats every job chance incl. bait 25%) keeps everyone.
    const safe = runWithRoll('bait', 0.99);
    expect(safe.state.prisoners).toHaveLength(1);
    expect(safe.ledger.jobRiskNotes).toHaveLength(0);
  });

  it('rolls tavern server intel (+1 Intel at 30%) per settle', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const lucky = applyManagementSettle(
      makeDayState({ prisoners: [makePrisoner(1, { job: 'tavern' })] }),
      { rollCrisis: false }
    );
    expect(lucky.state.prisoners[0].intel).toBe(1);
    expect(lucky.ledger.jobRiskNotes[0]).toContain('Intel');
    spy.mockRestore();

    const dry = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const unlucky = applyManagementSettle(
      makeDayState({ prisoners: [makePrisoner(1, { job: 'tavern' })] }),
      { rollCrisis: false }
    );
    expect(unlucky.state.prisoners[0].intel).toBeUndefined();
    dry.mockRestore();
  });

  it('applies Cell Boss & Torture Demo auras: other captives Resist -1 each', () => {
    const trusty = makePrisoner(1, { resist: 40, job: 'trusty' });
    const demo = makePrisoner(2, { resist: 40, job: 'tortdemo' });
    const bystander = makePrisoner(3, { resist: 40 });
    const res = applyManagementSettle(
      makeDayState({ prisoners: [trusty, demo, bystander] }),
      SETTLE_OPTS
    );
    expect(res.state.prisoners[0].resist).toBe(39); // self-exempt trusty, hit by demo
    expect(res.state.prisoners[1].resist).toBe(39); // self-exempt demo, hit by trusty
    expect(res.state.prisoners[2].resist).toBe(38); // -1 trusty -1 tortdemo
  });

  it('pays Manor Valet previewed Vesper affinity (hired x2 preserved)', () => {
    const valet = makePrisoner(1, { job: 'manor' });
    const res = applyManagementSettle(
      makeDayState({ prisoners: [valet] }),
      SETTLE_OPTS
    );
    expect(res.state.officers.vesper.aff).toBe(1);

    const hiredValet = makePrisoner(1, { job: 'manor', converted: 'hired' });
    const hiredRes = applyManagementSettle(
      makeDayState({ prisoners: [hiredValet] }),
      SETTLE_OPTS
    );
    expect(hiredRes.state.officers.vesper.aff).toBe(2);
  });

  it('keeps dairy headline yields honest vs the servant conversion table', () => {
    // Dairy doc promised +8 MP/+5 food: now paid exactly at 2-star baseline.
    const base = makePrisoner(1, { pleasure: 50, stamina: 50, job: 'dairy' });
    const baseY = getJobSettleYield(makeDayState({ prisoners: [base] }), base, 'dairy');
    expect(baseY.stars).toBe(2);
    expect(baseY.mp).toBe(8);
    expect(baseY.food).toBe(5);
    // A mundane C-grade servant conversion (9 MP, no stamina/AP cost) still
    // outpays the baseline dairy job.
    expect(baseY.mp).toBeLessThan(SERVANT_MP_BY_GRADE.C);

    // Even max investment (3-star hired dairy, Obey-trained + facility) must
    // not trivially outpay a top-end servant conversion (SSS = 30 MP).
    const hired = makePrisoner(1, {
      pleasure: 90,
      stamina: 100,
      job: 'dairy',
      converted: 'hired',
    });
    const hiredY = getJobSettleYield(makeDayState({ prisoners: [hired] }), hired, 'dairy');
    expect(hiredY.mp).toBe(22); // round(8 * 1.4 * 2) = 22
    expect(hiredY.mp).toBeLessThanOrEqual(SERVANT_MP_BY_GRADE.SSS);
  });

  it('keeps preview and settle ledger in parity for all 24 jobs (fresh + exhausted)', () => {
    for (const job of Object.values(PRISON_JOB_MAP)) {
      const fresh = makePrisoner(1, { stamina: 100, job: job.key });
      const freshState = makeDayState({ prisoners: [fresh] });
      const freshLedger = computeManagementSettle(freshState);
      const freshY = getJobSettleYield(freshState, fresh, job.key);
      const freshPreview = getJobYieldPreview(freshState, fresh, job.key);
      expect(freshLedger.jobMp).toBe(freshY.mp);
      expect(freshPreview.mp).toBe(freshY.mp);
      expect(freshLedger.jobFood).toBe(freshY.food);
      expect(freshLedger.jobFear).toBe(freshY.fear);
      expect(freshLedger.jobLust).toBe(freshY.lust);

      const tired = makePrisoner(1, { stamina: 10, job: job.key });
      const tiredState = makeDayState({ prisoners: [tired] });
      const tiredLedger = computeManagementSettle(tiredState);
      const tiredY = getJobSettleYield(tiredState, tired, job.key);
      expect(tiredY.lowStamina).toBe(true);
      expect(tiredLedger.jobMp).toBe(tiredY.mp);
    }
  });
});
