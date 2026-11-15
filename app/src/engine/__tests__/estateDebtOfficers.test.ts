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
import { LANDMARK_DEFS, WONDER_DEFS } from '../../data/realmData';
import type { Prisoner, RelicKey } from '../../types/game';
import { calcRestMp, finishManagementSettle, startNewDay } from '../dayLoop';
import {
  convertRelicShards,
  finalizeExpedition,
  launchExpedition,
  type RichExpeditionState,
} from '../expedition';
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
import { installCustomTrap, upgradeTrapOnFloor } from '../dungeon';
import {
  applyManagementSettle,
  buildLandmark,
  buildOrUpgradeFacility,
  buildWonder,
  calcPopCap,
  calcTownTax,
  computeManagementSettle,
  EVENT_MP_PAYOUT_CAP,
  exploreTown,
  getEstateBuildCost,
  getFacilityUpgradeState,
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

// Ticket 25: shard sink + debt formula rescale
describe('Ticket 25: Income-Scaled Min Due, Softened Late Strike, Handover Affinity & Shard Sink', () => {
  const ALL_RELICS: RelicKey[] = ['shield', 'chalice', 'crown', 'lens'];

  it('scales the installment floor to 0.15 x avg net MP of the last 3 settles (schedule stays the floor)', () => {
    // trailingIncome [400, 500, 600] -> avg 500 -> income floor ceil(75) = 75,
    // which binds above the step-0 schedule floor of 30.
    const richState = makeDayState({
      mode: 'estate',
      points: 3500,
      estate: {
        ...createInitialGameState().estate,
        trailingIncome: [400, 500, 600],
      },
    });
    const rich = getDebtSummary(richState);
    expect(rich.incomeMin).toBe(75);
    expect(rich.baseMin).toBe(75);
    expect(rich.minDue).toBe(75);

    // Empty history (legacy save / fresh save) -> neutral schedule floor.
    const floorState = {
      ...richState,
      estate: { ...richState.estate, trailingIncome: [] as number[] },
    };
    const floor = getDebtSummary(floorState);
    expect(floor.incomeMin).toBe(0);
    expect(floor.baseMin).toBe(30);
    expect(floor.minDue).toBe(30);

    // Entertainment -25% still cuts the income-scaled floor (75 - 18 = 57).
    const ent = entertainEleonora({ ...richState, mode: 'debt' }, true);
    expect(ent.ok).toBe(true);
    expect(getDebtSummary(ent.state).minDue).toBe(57);
  });

  it('applies the softened late strike (x1.05 + flat 60) while keeping extCarry wipe, seizure and 3-late bankruptcy', () => {
    const lateState = makeDayState({
      mode: 'debt',
      wave: 3,
      points: 0,
      prisoners: [],
      debt: {
        ...createInitialGameState().debt,
        amount: 1000,
        extCarry: 50,
        dueWave: 3,
      },
    });
    const visit = resolveDebtVisit(lateState);
    expect(visit.verdict).toBe('late');
    // Treasury empty, no captives -> nothing to seize, no credit.
    expect(visit.seizedPrisoner).toBeNull();
    expect(visit.seizedCredit).toBe(0);
    // x1.1 would be 1100; softened = floor(1000 x 1.05) + 60 = 1110.
    expect(visit.state.debt.amount).toBe(1110);
    expect(visit.state.debt.extCarry).toBe(0);
    expect(visit.state.debt.lates).toBe(1);
    expect(visit.state.debt.patience).toBe(30); // 60 - 30, unchanged delta

    // Bankruptcy stays reachable at 3 lates with the softened formula.
    const strike3 = {
      ...visit.state,
      mode: 'debt' as const,
      debt: { ...visit.state.debt, lates: 2, paidThisVisit: 0 },
    };
    const bankrupt = resolveDebtVisit(strike3);
    expect(bankrupt.ending).toBe('bankrupt');
    expect(bankrupt.state.debt.lates).toBe(3);
    expect(bankrupt.state.mode).toBe('over');
    expect(bankrupt.state.endings.gameOver).toBe('bankrupt');
  });

  it('grants +3 Eleonora affinity on prisoner handover', () => {
    const state = makeDayState({
      mode: 'debt',
      wave: 3,
      points: 100,
      prisoners: [makePrisoner(21, { grade: 'A' })],
      debt: { ...createInitialGameState().debt, dueWave: 3 },
    });
    const affBefore = state.officers.eleonora.aff;
    const hand = handoverPrisonerForDebt(state, 21);
    expect(hand.ok).toBe(true);
    expect(hand.state.prisoners).toHaveLength(0);
    expect(hand.state.debt.paidThisVisit).toBeGreaterThan(0);
    expect(hand.state.officers.eleonora.aff).toBe(affBefore + 3);
    expect(hand.message).toContain('+3 Eleonora Aff');
  });

  it('smelts surplus Relic Shards into durable Trap Parts once all 4 relics are owned (sink, not MP faucet)', () => {
    // Pure conversion: 7 surplus shards -> 2 parts, 1 shard left over.
    const conv = convertRelicShards({ owned: [...ALL_RELICS], shards: 7 });
    expect(conv.unlocked).toHaveLength(0);
    expect(conv.relics.owned).toHaveLength(4);
    expect(conv.overflowParts).toBe(2);
    expect(conv.relics.shards).toBe(1);

    // Below the 3-shard threshold nothing is forced.
    const partial = convertRelicShards({ owned: [...ALL_RELICS], shards: 2 });
    expect(partial.overflowParts).toBe(0);
    expect(partial.relics.shards).toBe(2);

    // Mixed: unlocking the last relic takes priority, then surplus smelts.
    const mixed = convertRelicShards({
      owned: ['shield', 'chalice', 'crown'],
      shards: 6,
    });
    expect(mixed.unlocked).toEqual(['lens']);
    expect(mixed.relics.owned).toHaveLength(4);
    expect(mixed.overflowParts).toBe(1);
    expect(mixed.relics.shards).toBe(0);

    // Finalize wiring: 3 shards on a full relic set -> +1 state.parts.
    const day = makeDayState({ points: 2000, prisoners: [makePrisoner(31)] });
    const launched = launchExpedition(day, [31], 'short');
    expect(launched.ok).toBe(true);
    const withShards = {
      ...launched.state,
      relics: { owned: [...ALL_RELICS], shards: 0 },
      expedition: {
        ...(launched.state.expedition as RichExpeditionState),
        lootMp: 0,
        lootShards: 3,
      },
    };
    const partsBefore = withShards.parts;
    const finished = finalizeExpedition(withShards, 'done');
    expect(finished.relics.owned).toHaveLength(4);
    expect(finished.relics.shards).toBe(0);
    expect(finished.parts).toBe(partsBefore + 1);
    const lines =
      (finished.expedition as RichExpeditionState).lastSummary?.lootLines ?? [];
    expect(lines.join(' | ')).toContain('smelted from surplus Shards');
  });
});

// Ticket 18: Lilim upgrade discount + estate buildCostMult install wiring
describe('Ticket 18: Trap Upgrade Discount & Estate buildCostMult Installs', () => {
  function makeRatedTrapState(points: number) {
    let state = makeDayState({ mode: 'build', points });
    state = installCustomTrap(state, 1, 'Discount probe').state;
    const floors = state.floors.map((f, i) =>
      i === 0
        ? { ...f, slots: f.slots.map((s) => ({ ...s, grade: 'C' as const })) }
        : f
    );
    return { ...state, floors };
  }

  it('charges the Lilim S1 discounted upgrade cost and updates flash / mpInvested', () => {
    const state = makeRatedTrapState(500);
    const lilimS1 = {
      ...state,
      officers: {
        ...state.officers,
        lilim: { ...state.officers.lilim, stage: 1 },
      },
    };
    // C -> B base 120 MP, Lilim S1 cut 10% -> floor(120 * 0.9) = 108
    const res = upgradeTrapOnFloor(lilimS1, 1, 0);
    expect(res.ok).toBe(true);
    expect(res.state.points).toBe(500 - 50 - 108);
    expect(res.message).toBe('1F upgraded C → B · -108 MP');
    expect(res.state.flash).toBe('1F upgraded C → B · -108 MP');
    expect(res.state.floors[0].slots[0].grade).toBe('B');
    expect(res.state.floors[0].slots[0].mpInvested).toBe(50 + 108);

    // Insufficient-MP message quotes the DISCOUNTED price, not the base.
    const poor = { ...lilimS1, points: 100 };
    const denied = upgradeTrapOnFloor(poor, 1, 0);
    expect(denied.ok).toBe(false);
    expect(denied.message).toBe('Need 108 MP to upgrade to B.');

    // Discount stacks: stage 1 (-0.10) + trapUpgradeCut (-0.10) + smithy 2 (-0.10)
    // -> multiplier 0.70 -> floor(120 * 0.7) = 84
    const stacked = {
      ...lilimS1,
      estate: {
        ...lilimS1.estate,
        facilities: { ...lilimS1.estate.facilities, smithy: 2 },
        perks: { ...lilimS1.estate.perks, trapUpgradeCut: true },
      },
    };
    const resStacked = upgradeTrapOnFloor(stacked, 1, 0);
    expect(resStacked.ok).toBe(true);
    expect(resStacked.state.points).toBe(500 - 50 - 84);
    expect(resStacked.message).toBe('1F upgraded C → B · -84 MP');
  });

  it('scales facility / landmark / wonder install costs by buildCostMult', () => {
    const dairyRaw = FACILITIES.find((f) => f.key === 'dairy')!.costs[0];

    // Default town (order 60, housing 50) -> mult 1.0: baseline unchanged.
    const base = makeDayState({ points: 5000 });
    expect(getFacilityUpgradeState(base, 'dairy').cost).toBe(dairyRaw);
    const built = buildOrUpgradeFacility(base, 'dairy');
    expect(built.ok).toBe(true);
    expect(base.points - built.state.points).toBe(dairyRaw);
    expect(built.message).toContain(`-${dairyRaw} MP`);

    // Low order (< 20) -> 1.2 penalty; display, affordability gate and charge agree.
    const lowOrderCost = Math.floor(dairyRaw * 1.2);
    const lowOrder = makeDayState({ points: 5000, town: { ...base.town, order: 15 } });
    expect(getFacilityUpgradeState(lowOrder, 'dairy').cost).toBe(lowOrderCost);
    const penalized = buildOrUpgradeFacility(lowOrder, 'dairy');
    expect(penalized.ok).toBe(true);
    expect(lowOrder.points - penalized.state.points).toBe(lowOrderCost);
    expect(penalized.message).toContain(`-${lowOrderCost} MP`);

    const tight = makeDayState({
      points: lowOrderCost - 1,
      town: { ...base.town, order: 15 },
    });
    const denied = buildOrUpgradeFacility(tight, 'dairy');
    expect(denied.ok).toBe(false);
    expect(denied.message).toContain(`Need ${lowOrderCost} MP`);

    // Housing >= 80 (order fine) -> 1.0 - 0.08 = 0.92 reward.
    const cozyCost = Math.floor(dairyRaw * 0.92);
    const cozy = makeDayState({ points: 5000, town: { ...base.town, housing: 80 } });
    expect(getFacilityUpgradeState(cozy, 'dairy').cost).toBe(cozyCost);

    // Landmark installs scale too (charge + flash text consistent).
    const lmExpected = Math.floor(LANDMARK_DEFS.hq.cost * 1.2);
    const lmTown = makeDayState({
      points: 99999,
      town: { ...base.town, lv: 6, order: 15 },
    });
    const lm = buildLandmark(lmTown, 'hq');
    expect(lm.ok).toBe(true);
    expect(lmTown.points - lm.state.points).toBe(lmExpected);
    expect(lm.message).toContain(`-${lmExpected} MP`);

    // Great Wonder commissions scale as well.
    const wExpected = Math.floor(WONDER_DEFS.spire.cost * 1.2);
    const wTown = makeDayState({
      points: 99999,
      ap: 3,
      town: { ...base.town, order: 15 },
    });
    const w = buildWonder(wTown, 'spire');
    expect(w.ok).toBe(true);
    expect(wTown.points - w.state.points).toBe(wExpected);
    expect(w.message).toContain(`-${wExpected} MP`);

    // Helper sanity: rounding rule is floor via getEstateBuildCost.
    expect(getEstateBuildCost(base, 101)).toBe(101); // mult 1.0
    expect(getEstateBuildCost(lowOrder, 101)).toBe(121); // 101 * 1.2 = 121.2
  });
});
