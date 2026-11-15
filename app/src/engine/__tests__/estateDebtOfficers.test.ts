import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSceneAsset } from '../../data/assetManifest';
import {
  EXPLORE_EVENTS,
  EXPLORE_LOCATIONS,
  FACILITIES,
  FACILITY_MAP,
  OFFICER_INTERACTIONS,
  SETTLEMENT_CRISES,
} from '../../data/estateData';
import type { ExploreEffectSpec } from '../../data/estateData';
import { PRISON_JOB_MAP, SERVANT_MP_BY_GRADE } from '../../data/prisonData';
import type { GameState, Prisoner, RelicKey } from '../../types/game';
import { calcRestMp, finishManagementSettle, startNewDay } from '../dayLoop';
import {
  convertRelicShards,
  finalizeExpedition,
  launchExpedition,
  type RichExpeditionState,
} from '../expedition';
import {
  applyDebtSeizure,
  draftDebtFromVault,
  entertainEleonora,
  getDebtSummary,
  getEleonoraVisitSceneContext,
  getSellswordContractInfo,
  getVaultDraftInfo,
  handoverPrisonerForDebt,
  hireSellswordContract,
  payDebt,
  requestDebtExtension,
  resolveDebtVisit,
  rollDebtQuests,
  SELLSWORD_CONTRACT_COST_MP,
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
import { applyWaveSettlement } from '../raid';
import { createInitialGameState } from '../saveLoad';
import {
  CONSUMED_RAID_MOD_KEYS,
  resolveRaidModifiers,
  SELLSWORD_RAID_MOD_KEY,
  SELLSWORD_RAID_MOD_VALUE,
} from '../raidMods';

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

describe('Debt: Vault Draft against Min-Due (Ticket 24)', () => {
  function makeDraftState(overrides?: Partial<ReturnType<typeof createInitialGameState>>) {
    return makeDayState({
      mode: 'debt',
      wave: 3,
      points: 0, // vault-only sink: cash MP must stay untouched
      estate: { ...createInitialGameState().estate, vaultMp: 500 },
      debt: {
        ...createInitialGameState().debt,
        step: 2, // baseMin = 120 -> minDue = 120
        dueWave: 3,
      },
      ...overrides,
    });
  }

  it('drafts max 50% of min-due from the vault at 20% premium and moves vaultMp', () => {
    const state = makeDraftState();
    const info = getVaultDraftInfo(state);
    expect(info.canDraft).toBe(true);
    expect(info.capRelief).toBe(60); // 50% of minDue 120
    expect(info.maxRelief).toBe(60);
    expect(info.maxCost).toBe(72); // ceil(60 * 1.2)

    const res = draftDebtFromVault(state);
    expect(res.ok).toBe(true);
    expect(res.state.estate.vaultMp).toBe(500 - 72); // premium paid from vault
    expect(res.state.points).toBe(0); // vault-only: cash untouched
    expect(res.state.debt.amount).toBe(3000 - 60); // principal reduced by relief
    expect(res.state.debt.paidThisVisit).toBe(60); // counts toward min-due
    expect(getDebtSummary(res.state).remainingDue).toBe(60);

    // Per-visit cap: a second draft is blocked (no longer the first payment).
    const again = draftDebtFromVault(res.state);
    expect(again.ok).toBe(false);
    expect(again.state.estate.vaultMp).toBe(500 - 72); // state unchanged on fail
  });

  it('applies the 20% premium to a custom draft (40 relief = 48 vault MP)', () => {
    const res = draftDebtFromVault(makeDraftState(), 40);
    expect(res.ok).toBe(true);
    expect(res.state.estate.vaultMp).toBe(500 - 48);
    expect(res.state.debt.paidThisVisit).toBe(40);
    expect(res.state.debt.amount).toBe(2960);
  });

  it('clamps oversized requests to the 50% cap and floors fractional relief', () => {
    const clamped = draftDebtFromVault(makeDraftState(), 999);
    expect(clamped.ok).toBe(true);
    expect(clamped.state.debt.paidThisVisit).toBe(60);
    expect(clamped.state.estate.vaultMp).toBe(500 - 72);

    // Vault-limited draft: 50 vault MP affords floor(50 / 1.2) = 41 relief.
    const poorVault = draftDebtFromVault(
      makeDraftState({
        estate: { ...createInitialGameState().estate, vaultMp: 50 },
      }),
      60
    );
    expect(poorVault.ok).toBe(true);
    expect(poorVault.state.debt.paidThisVisit).toBe(41);
    expect(poorVault.state.estate.vaultMp).toBe(50 - Math.ceil(41 * 1.2)); // 50 - 50
  });

  it('blocks drafts outside debt visits, on ended debt, and when vault cannot fund the premium', () => {
    // Wrong mode (Day prepay is a cash-only action)
    expect(draftDebtFromVault(makeDraftState({ mode: 'estate' })).ok).toBe(false);

    // Debt contract concluded
    const ended = makeDraftState();
    ended.debt = { ...ended.debt, ended: 'romance' };
    expect(draftDebtFromVault(ended).ok).toBe(false);

    // Vault too poor to fund even 1 MP relief (+ premium)
    const broke = draftDebtFromVault(
      makeDraftState({
        estate: { ...createInitialGameState().estate, vaultMp: 1 },
      })
    );
    expect(broke.ok).toBe(false);
    expect(broke.state.estate.vaultMp).toBe(1);

    // No debt left at all
    expect(
      draftDebtFromVault(
        makeDraftState({
          debt: { ...createInitialGameState().debt, amount: 0 },
        })
      ).ok
    ).toBe(false);
  });

  it('blocks drafts after cash payments but allows cash to finish the covered min-due', () => {
    const afterCash = makeDraftState({
      points: 100,
      debt: {
        ...createInitialGameState().debt,
        step: 2,
        dueWave: 3,
        paidThisVisit: 50,
      },
    });
    expect(getVaultDraftInfo(afterCash).canDraft).toBe(false);
    expect(draftDebtFromVault(afterCash).ok).toBe(false);

    // Draft first, then cash-pay the rest -> min-due fully covered.
    const drafted = draftDebtFromVault(makeDraftState({ points: 100 }));
    expect(drafted.ok).toBe(true);
    expect(drafted.state.points).toBe(100); // draft moved no cash
    const cashRest = payDebt(drafted.state, 60);
    expect(cashRest.ok).toBe(true);
    expect(cashRest.state.debt.paidThisVisit).toBe(120);
    expect(getDebtSummary(cashRest.state).remainingDue).toBe(0);
    // points dropped by exactly the cash portion (60), vault already debited.
    expect(cashRest.state.points).toBe(40);
    expect(cashRest.state.estate.vaultMp).toBe(500 - 72);
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

// Ticket 17: crisis repricing (the raidMod IS the price of the MP) + estateData art key fixes
describe('Ticket 17: Crisis Repricing (honest MP prices) & Art Key Fixes', () => {
  const crisisById = (id: string) => {
    const def = SETTLEMENT_CRISES.find((c) => c.id === id);
    expect(def, `crisis ${id} must exist`).toBeDefined();
    return def!;
  };

  /** Copy of raidMods.test.ts's floor installer (kept local to this suite). */
  function installTrapAt(state: GameState, floorIdx: number, grade: 'D' | 'C'): GameState {
    const floors = [...state.floors];
    floors[floorIdx] = {
      ...floors[floorIdx],
      slots: [
        {
          id: `t${floorIdx}`,
          text: 'Test Trap',
          grade,
          types: ['phys'],
          mpInvested: 10,
        },
      ],
    };
    return { ...state, floors };
  }

  it('reprices Take Bribes to +35 MP with -10 Order / -5 Approval and keeps the real trap_off raidMod', () => {
    const bribes = crisisById('smuggler').choices[1];
    expect(bribes.label).toBe('Take Bribes');
    expect(bribes.mpCost).toBe(0);
    expect(bribes.effects.mp).toBe(35);
    expect(bribes.effects.order).toBe(-10);
    expect(bribes.effects.approval).toBe(-5);
    expect(bribes.raidMod?.key).toBe('trap_off');
    expect(bribes.raidMod?.value).toBe(1);
  });

  it('keeps Welcome Caravan at +30 MP / +15 Food with its real first_dc -2 and states the tradeoff in the choice text', () => {
    const caravanDef = crisisById('caravan');
    const welcome = caravanDef.choices[0];
    expect(welcome.effects.mp).toBe(30);
    expect(welcome.effects.food).toBe(15);
    expect(welcome.raidMod).toEqual({
      key: 'first_dc',
      value: -2,
      label: 'First Room DC -2',
    });
    // The net must read as a tradeoff: label + crisis text state the raid penalty.
    expect(welcome.label).toContain('raid');
    expect(caravanDef.text).toContain('infiltrators');
    // Turn Away remains the safe-but-sour alternative.
    expect(caravanDef.choices[1].effects.renown).toBe(-2);
  });

  it('reprices Export Surplus to +30 MP with -2 Renown / -25 Food', () => {
    const exportChoice = crisisById('bumper').choices[1];
    expect(exportChoice.label).toBe('Export Surplus');
    expect(exportChoice.effects.mp).toBe(30);
    expect(exportChoice.effects.renown).toBe(-2);
    expect(exportChoice.effects.food).toBe(-25);
  });

  it('sweep invariant: every +MP crisis choice shows a visible cost line (stat cost or raidMod)', () => {
    for (const def of SETTLEMENT_CRISES) {
      for (const choice of def.choices) {
        const mp = choice.effects.mp ?? 0;
        if (mp <= 0) continue;
        const hasStatCost = Object.entries(choice.effects).some(
          ([key, value]) => key !== 'mp' && typeof value === 'number' && value < 0
        );
        expect(hasStatCost || choice.raidMod !== undefined).toBe(true);
      }
    }
    // The free-MP choices are exactly the repriced trio (no new hidden faucets).
    const mpChoices = SETTLEMENT_CRISES.flatMap((d) => d.choices).filter(
      (c) => (c.effects.mp ?? 0) > 0
    );
    expect(mpChoices).toHaveLength(3);
  });

  it('fixes copy-paste art keys: torture -> dk_fac_torture, reform -> dk_fac_pens (spa intentionally keeps dk_fac_bath)', () => {
    expect(FACILITY_MAP.torture.artKey).toBe('dk_fac_torture'); // canonical alias (Lua canon), resolves via dk_fac_annex
    expect(FACILITY_MAP.reform.artKey).toBe('dk_fac_pens'); // pens art = captives in collars, visually-intended
    expect(FACILITY_MAP.spa.artKey).toBe('dk_fac_bath'); // no dedicated spa asset exists; bathhouse art IS spa imagery
    // No facility duplicates its prerequisite/sibling's key anymore.
    expect(FACILITY_MAP.torture.artKey).not.toBe(FACILITY_MAP.trainhall.artKey);
    expect(FACILITY_MAP.reform.artKey).not.toBe(FACILITY_MAP.annex.artKey);
    for (const fac of FACILITIES) {
      expect(
        resolveSceneAsset(fac.artKey),
        `Facility ${fac.key} art ${fac.artKey} unresolvable`
      ).toBeDefined();
    }
  });

  it('applies Take Bribes end-to-end: stat deltas land, trap_off enters activeRaidMods, and the next raid loses -2 DC on the weakest trap room', () => {
    let state = makeDayState({ mode: 'msettle', points: 50 });
    state = installTrapAt(state, 0, 'D'); // 1F: trap power 7 (weakest)
    state = installTrapAt(state, 2, 'C'); // 3F: trap power 8

    const rolled = rollSettlementCrisis(state, { forceCrisisId: 'smuggler' });
    expect(rolled.crisis?.id).toBe('smuggler');
    const ptsBefore = rolled.state.points;
    const orderBefore = rolled.state.town.order;
    const approvalBefore = rolled.state.town.approval;

    const bribed = resolveSettlementCrisis(rolled.state, 1);
    expect(bribed.ok).toBe(true);
    expect(bribed.state.points).toBe(ptsBefore + 35);
    expect(bribed.state.town.order).toBe(orderBefore - 10);
    expect(bribed.state.town.approval).toBe(approvalBefore - 5);
    expect(bribed.state.crises.activeRaidMods).toContainEqual({
      key: 'trap_off',
      value: 1,
    });
    // The flash renders every promised magnitude with its raid penalty.
    expect(bribed.message).toContain('+35 MP');
    expect(bribed.message).toContain('-10 Order');
    expect(bribed.message).toContain('-5 Approval');
    expect(bribed.message).toContain('Next Raid: 1 Trap Room DC -2');

    // The promised penalty bites the NEXT raid's weakest trap room.
    const weakRoom = resolveRaidModifiers(bribed.state, {
      floorNum: 1,
      isFirstRoom: false,
      hasMonsterOnFloor: false,
    });
    expect(weakRoom.floorDcDelta).toBe(-2);
    expect(weakRoom.totalDcDelta).toBe(-2);
    expect(weakRoom.notes).toContain('activeRaidMods:trap_off -2 (1F)');

    // The stronger trap room is untouched by trap_off.
    const strongRoom = resolveRaidModifiers(bribed.state, {
      floorNum: 3,
      isFirstRoom: false,
      hasMonsterOnFloor: false,
    });
    expect(strongRoom.floorDcDelta).toBe(0);
    expect(strongRoom.totalDcDelta).toBe(0);
  });

  it('applies Welcome Caravan end-to-end: first_dc -2 enters activeRaidMods and hits the next raid first room', () => {
    const state = makeDayState({ mode: 'msettle', points: 50 });
    const rolled = rollSettlementCrisis(state, { forceCrisisId: 'caravan' });
    expect(rolled.crisis?.id).toBe('caravan');
    const ptsBefore = rolled.state.points;
    const foodBefore = rolled.state.town.food;

    const welcomed = resolveSettlementCrisis(rolled.state, 0);
    expect(welcomed.ok).toBe(true);
    expect(welcomed.state.points).toBe(ptsBefore + 30);
    expect(welcomed.state.town.food).toBe(foodBefore + 15);
    expect(welcomed.state.crises.activeRaidMods).toContainEqual({
      key: 'first_dc',
      value: -2,
    });
    expect(welcomed.message).toContain('+30 MP');
    expect(welcomed.message).toContain('+15 Food');
    expect(welcomed.message).toContain('Next Raid: First Room DC -2');

    const firstRoom = resolveRaidModifiers(welcomed.state, {
      floorNum: 1,
      isFirstRoom: true,
      hasMonsterOnFloor: false,
    });
    expect(firstRoom.firstRoomDcDelta).toBe(-2);
    expect(firstRoom.totalDcDelta).toBe(-2);
  });
});

// Ticket 16: settlement resolution point — purge, tick, mole decrement, flag reset
describe('Ticket 16: Settlement Resolution — one-shot mod purge & perk-flag reset', () => {
  it('purges the L6/L10 next-raid perk flags and one-shot raid mods after one settlement (stage perks persist)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const fresh = createInitialGameState();
    const state = makeDayState({
      mode: 'result',
      wave: 3,
      party: [],
      estate: {
        ...fresh.estate,
        perks: {
          firstDcOnce: true, // L6 / expedition parts bag
          allDcNext: true, // L10
          prepIntelOnce: true, // L1/L5 / expedition intel
          aceDowngradeNext: true, // L7
          newTrapUpNext: true, // L9
          trapUpgradeCut: true, // L3 — standing stage perk, must persist
          maxIntelBonus: 2, // L8 + expedition stack (ticket 19), must persist
        },
      },
      crises: {
        ...fresh.crises,
        activeRaidMods: [
          { key: 'first_dc', value: 1 },
          { key: 'first_dc', value: 1 }, // exact duplicate -> normalized away
          { key: 'intel', value: 2 },
          { key: 'intel_zero', value: 1 },
        ],
      },
    });

    const settled = applyWaveSettlement(state, 'wipe');
    expect(settled.estate.perks.firstDcOnce).toBe(false);
    expect(settled.estate.perks.allDcNext).toBe(false);
    expect(settled.estate.perks.prepIntelOnce).toBe(false);
    expect(settled.estate.perks.aceDowngradeNext).toBe(false);
    expect(settled.estate.perks.newTrapUpNext).toBe(false);
    // Stage perks survive the settlement (no difficulty-inflation either way:
    // trapUpgradeCut is a workshop cost sink, maxIntelBonus is a durable stack).
    expect(settled.estate.perks.trapUpgradeCut).toBe(true);
    expect(settled.estate.perks.maxIntelBonus).toBe(2);
    // Every one-shot raid mod consumed by the raid is gone; dupes normalized.
    expect(settled.crises.activeRaidMods).toHaveLength(0);
  });

  it('a consumed Lilim DC promise is gone for the NEXT raid (resolver no longer sees it)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const fresh = createInitialGameState();
    const state = makeDayState({
      mode: 'result',
      wave: 3,
      party: [],
      estate: {
        ...fresh.estate,
        perks: { firstDcOnce: true, allDcNext: true },
      },
    });
    const ctx = { floorNum: 1, isFirstRoom: true, hasMonsterOnFloor: false };
    // Fresh estate (approval 50 / food 40) + lilim aff 0 -> the only DC
    // contributors are the two once-flags.
    const before = resolveRaidModifiers(state, ctx);
    expect(before.firstRoomDcDelta).toBe(1); // firstDcOnce
    expect(before.allFloorsDcDelta).toBe(1); // allDcNext

    const settled = applyWaveSettlement(state, 'wipe');
    const after = resolveRaidModifiers(settled, ctx);
    expect(after.firstRoomDcDelta).toBe(0);
    expect(after.allFloorsDcDelta).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Ticket 24: Sellsword Contract — 100 vault MP -> +2 all-floor DC, one raid
// ---------------------------------------------------------------------------
describe('Ticket 24: Sellsword Contract — one-raid all-floor DC vault sink', () => {
  function makeSellswordState(
    overrides?: Partial<ReturnType<typeof createInitialGameState>>
  ) {
    return makeDayState({
      mode: 'debt',
      wave: 3,
      points: 80, // vault-only sink: cash MP must stay untouched
      estate: { ...createInitialGameState().estate, vaultMp: 250 },
      debt: {
        ...createInitialGameState().debt,
        step: 2,
        dueWave: 3,
      },
      ...overrides,
    });
  }

  const RESOLVER_CTX = { floorNum: 2, isFirstRoom: false, hasMonsterOnFloor: false };

  it('binds the seam constants: all_dc +2 and the key is settlement-consumed', () => {
    expect(SELLSWORD_RAID_MOD_KEY).toBe('all_dc');
    expect(SELLSWORD_RAID_MOD_VALUE).toBe(2);
    expect(SELLSWORD_CONTRACT_COST_MP).toBe(100);
    // Expiry rides ticket 16's settlement purge — no separate lifecycle code.
    expect(CONSUMED_RAID_MOD_KEYS).toContain('all_dc');
  });

  it('hires for exactly 100 vault MP, appends all_dc +2, and leaves cash untouched', () => {
    const state = makeSellswordState();
    const info = getSellswordContractInfo(state);
    expect(info.canHire).toBe(true);
    expect(info.pending).toBe(false);
    expect(info.costMp).toBe(100);
    expect(info.dcPerFloor).toBe(2);

    const res = hireSellswordContract(state);
    expect(res.ok).toBe(true);
    expect(res.state.estate.vaultMp).toBe(250 - 100); // X -> X - 100
    expect(res.state.points).toBe(80); // vault-only: cash untouched
    expect(res.state.crises.activeRaidMods).toContainEqual({
      key: 'all_dc',
      value: 2,
    });
    expect(getSellswordContractInfo(res.state).pending).toBe(true);
  });

  it('rejects a second purchase while one is pending, a short vault, and non-visit modes', () => {
    const hired = hireSellswordContract(makeSellswordState()).state;

    // Slot occupied: no stacking a second sellsword onto the same raid.
    const second = hireSellswordContract(hired);
    expect(second.ok).toBe(false);
    expect(second.state.estate.vaultMp).toBe(150); // state unchanged on fail
    expect(second.state.crises.activeRaidMods).toHaveLength(1);

    // Vault too poor for the 100 MP fee.
    const broke = hireSellswordContract(
      makeSellswordState({
        estate: { ...createInitialGameState().estate, vaultMp: 99 },
      })
    );
    expect(broke.ok).toBe(false);
    expect(broke.state.estate.vaultMp).toBe(99);

    // Only offered during Debt Collection visits.
    expect(hireSellswordContract(makeSellswordState({ mode: 'estate' })).ok).toBe(false);
  });

  it('resolver reads all_dc as an allFloors source: +2 on every floor from a neutral estate', () => {
    const hired = hireSellswordContract(makeSellswordState()).state;
    const r = resolveRaidModifiers(hired, RESOLVER_CTX);
    expect(r.allFloorsDcDelta).toBe(2);
    expect(r.totalDcDelta).toBe(2);
    expect(r.notes).toContain('activeRaidMods:all_dc +2 (sellsword contract)');
  });

  it('bucket cap: with other sources pushing allFloors past +2, the sellsword is clamped, not added', () => {
    // Arcane Workshop Lv.3 gives estate allFloors +1; sellsword adds +2 -> raw 3.
    const hired = hireSellswordContract(
      makeSellswordState({
        estate: {
          ...createInitialGameState().estate,
          vaultMp: 250,
          facilities: {
            ...createInitialGameState().estate.facilities,
            workshop: 3,
          },
        },
      })
    ).state;
    const r = resolveRaidModifiers(hired, RESOLVER_CTX);
    expect(r.allFloorsDcDelta).toBe(2); // clamped to the bucket cap, not 3
    expect(r.totalDcDelta).toBe(2);
    expect(r.notes).toContain('estate:allFloors +1');
    expect(r.notes).toContain('activeRaidMods:all_dc +2 (sellsword contract)');
    expect(r.notes).toContain('capped: allFloors clamped to +2');
  });

  it('total cap: firstRoom + sellsword allFloors pushing past +4 sheds firstRoom, allFloors held at +2', () => {
    let stacked = hireSellswordContract(makeSellswordState()).state;
    stacked = {
      ...stacked,
      town: { ...stacked.town, approval: 65 }, // estate firstRoom +1
      estate: {
        ...stacked.estate,
        facilities: { ...stacked.estate.facilities, grail: 1 }, // firstRoom +1
      },
      officers: {
        ...stacked.officers,
        lilim: { ...stacked.officers.lilim, aff: 120, stage: 3 }, // firstRoom +4
      },
    };
    const r = resolveRaidModifiers(stacked, {
      floorNum: 1,
      isFirstRoom: true,
      hasMonsterOnFloor: false,
    });
    // firstRoom raw 6 -> bucket-clamped 3; allFloors (sellsword) 2; total 5 -> cap 4.
    expect(r.firstRoomDcDelta).toBe(2); // sheds 1 first
    expect(r.allFloorsDcDelta).toBe(2);
    expect(r.totalDcDelta).toBe(4);
    expect(r.notes).toContain('capped: total DC clamped to +4');
  });

  it('expires after exactly one raid via settlement purge, then a re-purchase is possible', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const hired = hireSellswordContract(makeSellswordState()).state;
    expect(hired.crises.activeRaidMods).toContainEqual({ key: 'all_dc', value: 2 });

    // The one raid it bought: resolver sees it...
    expect(resolveRaidModifiers(hired, RESOLVER_CTX).allFloorsDcDelta).toBe(2);

    // ...then the wave settles and ticket 16's purge removes the contract.
    const settled = applyWaveSettlement(
      { ...hired, mode: 'result', party: [] },
      'wipe'
    );
    expect(settled.crises.activeRaidMods).toHaveLength(0);
    expect(settled.estate.vaultMp).toBe(150); // the 100 MP stay spent
    expect(resolveRaidModifiers(settled, RESOLVER_CTX).allFloorsDcDelta).toBe(0);
    expect(getSellswordContractInfo(settled).pending).toBe(false);

    // Next collection visit: the slot is free again.
    const rehire = hireSellswordContract({ ...settled, mode: 'debt' });
    expect(rehire.ok).toBe(true);
    expect(rehire.state.estate.vaultMp).toBe(150 - 100);
    expect(rehire.state.crises.activeRaidMods).toContainEqual({
      key: 'all_dc',
      value: 2,
    });
  });
});
