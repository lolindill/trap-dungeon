import { describe, expect, it } from 'vitest';
import type { FloorState, GameState, Prisoner, TrapSlot } from '../../types/game';
import {
  checkDebtPayoffEnding,
  checkDominionEnding,
  DOMINION_GATE,
  ENDING_DEFS,
  ENDING_TINT_LINES,
  evaluateRankTrials,
  formatDeterministicEndingSummary,
  getAvgPrisonerCorr,
  getEndingCorrTintLine,
  getHollowedPrisonerCount,
  getRankCorrMultiplier,
  getTotalTrapAttunement,
  RANK_CORR_WEIGHTS,
} from '../endings';
import { createInitialGameState } from '../saveLoad';

function makePrisoner(overrides: Partial<Prisoner> = {}): Prisoner {
  return {
    pid: 101,
    name: 'Test Captive',
    grade: 'B',
    raceLabel: 'Human',
    classLabel: 'Knight',
    traits: [],
    capturedWave: 2,
    capturedFloor: 1,
    resist: 30,
    corr: 20,
    gender: 'female',
    stamina: 80,
    staminaMax: 100,
    pleasure: 0,
    terror: 0,
    shame: 10,
    marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
    cond: '',
    job: null,
    converted: null,
    assignedFloor: null,
    owner: null,
    afflictions: [],
    virgin: false,
    breeding: null,
    intel: 0,
    ...overrides,
  };
}

function makeSlot(attunement: number, idx: number): TrapSlot {
  return {
    id: `slot_${idx}`,
    text: `Attuned trap ${idx}`,
    grade: 'B',
    types: ['ero'],
    mpInvested: 10,
    attunement,
  };
}

/** One floor per entry, each carrying exactly one slot with that attunement. */
function floorsWithAttunement(perFloor: number[]): FloorState[] {
  return perFloor.map((att, i) => ({
    floor: i + 1,
    slots: att > 0 ? [makeSlot(att, i)] : [],
    synergy: '-',
  }));
}

function corrState(
  attunementPerFloor: number[],
  prisoners: Prisoner[],
  overrides: Partial<GameState> = {},
): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    floors: floorsWithAttunement(attunementPerFloor),
    prisoners,
    ...overrides,
  };
}

function hollowed(pid: number): Prisoner {
  return makePrisoner({ pid, corr: 100 });
}

/**
 * Ticket 32 — endings/Endless hooks: dominion gate, liberation/romance tint,
 * Endless rank scoring corruption multiplier.
 */
describe('Ticket 32: dominion gate (attunement flavor)', () => {
  it('pins the first-pass gate thresholds', () => {
    expect(DOMINION_GATE.TOTAL_ATTUNEMENT).toBe(300);
    expect(DOMINION_GATE.HOLLOWED_PRISONERS).toBe(5);
  });

  it('stays locked at exactly 299 total attunement even with 5 hollowed prisoners', () => {
    // 100 + 100 + 99 = 299 (one slot under the gate)
    const state = corrState([100, 100, 99], [1, 2, 3, 4, 5].map((pid) => hollowed(pid)));
    expect(getTotalTrapAttunement(state)).toBe(299);
    expect(getHollowedPrisonerCount(state)).toBe(5);

    const next = checkDominionEnding(state);
    expect(next).toBe(state);
    expect(next.endings.unlocked.dominion).toBeUndefined();
    expect(next.endings.endless).toBe(false);
  });

  it('stays locked at 300 attunement when only 4 prisoners sit at corr 100', () => {
    const state = corrState([100, 100, 100], [1, 2, 3, 4].map((pid) => hollowed(pid)));
    expect(getTotalTrapAttunement(state)).toBe(300);
    expect(getHollowedPrisonerCount(state)).toBe(4);

    const next = checkDominionEnding(state);
    expect(next).toBe(state);
    expect(next.endings.unlocked.dominion).toBeUndefined();
  });

  it('unlocks the Hollowed Dominion variant at 300 attunement + 5 corr-100 prisoners', () => {
    const state = corrState([100, 100, 100], [1, 2, 3, 4, 5].map((pid) => hollowed(pid)), {
      wave: 9,
      debt: { ...createInitialGameState().debt, amount: 500, ended: null },
    });
    expect(getTotalTrapAttunement(state)).toBe(300);
    expect(getHollowedPrisonerCount(state)).toBe(5);

    const next = checkDominionEnding(state);
    expect(next.endings.unlocked.dominion).toBe(9);
    expect(next.endings.activeEnding).toBe('dominion');
    expect(next.endings.endless).toBe(true);
    expect(next.rankTrials.active).toBe(true);
    // The variant never clears Goldreich debt — the contract stays formally open.
    expect(next.debt.ended).toBeNull();
    expect(next.debt.amount).toBe(500);
    expect(next.chronicle[0]?.title).toBe('Ending Unlocked · Hollowed Dominion');
    expect(next.chronicle[0]?.text).toContain('the dungeon itself has hollowed');
  });

  it('is idempotent once unlocked', () => {
    const state = corrState([100, 100, 100], [1, 2, 3, 4, 5].map((pid) => hollowed(pid)));
    const once = checkDominionEnding(state);
    const twice = checkDominionEnding(once);
    expect(twice).toBe(once);
  });

  it('runs at every settlement via evaluateRankTrials — even before any canonical ending', () => {
    const gated = corrState([100, 100, 100], [1, 2, 3, 4, 5].map((pid) => hollowed(pid)), {
      wave: 7,
    });
    const settled = evaluateRankTrials(gated);
    expect(settled.endings.unlocked.dominion).toBe(7);
    expect(settled.endings.endless).toBe(true);
    expect(settled.rankTrials.active).toBe(true);
    expect(settled.rankTrials.currentTrial).toBe('wipe3');

    // Purity regression: a corruption-free fresh state is returned untouched.
    const fresh = createInitialGameState();
    expect(evaluateRankTrials(fresh)).toBe(fresh);
  });

  it('does not unlock on high corr alone when attunement is absent', () => {
    const state = corrState([0, 0, 0, 0, 0, 0, 0], [1, 2, 3, 4, 5].map((pid) => hollowed(pid)));
    expect(getTotalTrapAttunement(state)).toBe(0);
    const next = checkDominionEnding(state);
    expect(next).toBe(state);
  });
});

describe('Ticket 32: liberation/romance divergence tint', () => {
  it('proves the tint branches at the avg-corr boundaries 70/30', () => {
    // avg == 70 exactly -> Hollowed Chorus
    const high = corrState([], [makePrisoner({ pid: 1, corr: 70 }), makePrisoner({ pid: 2, corr: 70 })]);
    expect(getAvgPrisonerCorr(high)).toBe(70);
    expect(getEndingCorrTintLine(high)).toBe(ENDING_TINT_LINES.HIGH);

    // avg == 30 exactly -> Unbroken Chorus
    const low = corrState([], [makePrisoner({ pid: 1, corr: 30 }), makePrisoner({ pid: 2, corr: 30 })]);
    expect(getAvgPrisonerCorr(low)).toBe(30);
    expect(getEndingCorrTintLine(low)).toBe(ENDING_TINT_LINES.LOW);

    // in between -> untinted
    const mid = corrState([], [makePrisoner({ pid: 1, corr: 50 })]);
    expect(getEndingCorrTintLine(mid)).toBeNull();

    // no prisoners -> unaffected (null tint)
    const empty = corrState([], []);
    expect(getEndingCorrTintLine(empty)).toBeNull();
  });

  it('tints the liberation chronicle line at the divergence site (avg corr >= 70)', () => {
    const state = corrState([], [makePrisoner({ pid: 1, corr: 70 }), makePrisoner({ pid: 2, corr: 70 })], {
      wave: 6,
      debt: { ...createInitialGameState().debt, amount: 0, extraLoan: 0, ended: null },
      officers: {
        ...createInitialGameState().officers,
        eleonora: { ...createInitialGameState().officers.eleonora, aff: 40 },
      },
    });

    const next = checkDebtPayoffEnding(state);
    expect(next.debt.ended).toBe('liberation');
    expect(next.chronicle[0]?.title).toBe('Ending Unlocked · Sovereign Liberation');
    expect(next.chronicle[0]?.text).toContain(ENDING_TINT_LINES.HIGH);
  });

  it('tints the divergence site with the Unbroken line at avg corr <= 30', () => {
    const state = corrState([], [makePrisoner({ pid: 1, corr: 30 })], {
      wave: 6,
      debt: { ...createInitialGameState().debt, amount: 0, extraLoan: 0, ended: null },
      officers: {
        ...createInitialGameState().officers,
        eleonora: { ...createInitialGameState().officers.eleonora, aff: 95 },
      },
    });

    const next = checkDebtPayoffEnding(state);
    expect(next.debt.ended).toBe('romance');
    expect(next.chronicle[0]?.text).toContain(ENDING_TINT_LINES.LOW);
  });

  it('leaves the divergence untinted in the mid band', () => {
    const state = corrState([], [makePrisoner({ pid: 1, corr: 50 })], {
      wave: 6,
      debt: { ...createInitialGameState().debt, amount: 0, extraLoan: 0, ended: null },
    });

    const next = checkDebtPayoffEnding(state);
    expect(next.chronicle[0]?.text).not.toContain(ENDING_TINT_LINES.HIGH);
    expect(next.chronicle[0]?.text).not.toContain(ENDING_TINT_LINES.LOW);
  });

  it('keeps endings without prisoners byte-identical (no tint text)', () => {
    const state = corrState([], [], {
      wave: 6,
      debt: { ...createInitialGameState().debt, amount: 0, extraLoan: 0, ended: null },
    });

    const next = checkDebtPayoffEnding(state);
    expect(next.chronicle[0]?.text).toBe(ENDING_DEFS.liberation.summary);
  });

  it('derives the tint in the deterministic ending summary only for romance/liberation', () => {
    const hollowedAvg100 = corrState([], [1, 2, 3].map((pid) => hollowed(pid)));

    expect(formatDeterministicEndingSummary(hollowedAvg100, 'ending', 'liberation')).toContain(
      ENDING_TINT_LINES.HIGH,
    );
    expect(formatDeterministicEndingSummary(hollowedAvg100, 'ending', 'romance')).toContain(
      ENDING_TINT_LINES.HIGH,
    );
    // No new ending objects: every other ending (and game overs) stay untinted.
    for (const key of ['romance_dowry', 'prosperity', 'dominion'] as const) {
      expect(formatDeterministicEndingSummary(hollowedAvg100, 'ending', key)).not.toContain(
        ENDING_TINT_LINES.HIGH,
      );
    }
    expect(formatDeterministicEndingSummary(hollowedAvg100, 'gameover', 'core')).not.toContain(
      ENDING_TINT_LINES.HIGH,
    );

    // Low band flips the tint line, mid band removes it entirely.
    const low = corrState([], [makePrisoner({ pid: 1, corr: 30 })]);
    expect(formatDeterministicEndingSummary(low, 'ending', 'liberation')).toContain(
      ENDING_TINT_LINES.LOW,
    );
    const mid = corrState([], [makePrisoner({ pid: 1, corr: 50 })]);
    expect(formatDeterministicEndingSummary(mid, 'ending', 'liberation')).not.toContain(
      ENDING_TINT_LINES.LOW,
    );
  });
});

describe('Ticket 32: Endless rank scoring corruption multiplier', () => {
  it('pins the exact first-pass weights (avg corr /200, total attunement /400)', () => {
    expect(RANK_CORR_WEIGHTS.AVG_CORR).toBe(1 / 200);
    expect(RANK_CORR_WEIGHTS.TOTAL_ATTUNEMENT).toBe(1 / 400);
  });

  it('computes the multiplier exactly: avg corr 100 + attunement 400 -> 2.5', () => {
    const state = corrState(
      [100, 100, 100, 100],
      [1, 2, 3, 4, 5].map((pid) => hollowed(pid)),
    );
    expect(getAvgPrisonerCorr(state)).toBe(100);
    expect(getTotalTrapAttunement(state)).toBe(400);
    expect(getRankCorrMultiplier(state)).toBe(1 + 100 / 200 + 400 / 400);
    expect(getRankCorrMultiplier(state)).toBe(2.5);
  });

  it('stays at 1.0 with no prisoners and no attunement (baseline unchanged)', () => {
    const fresh = createInitialGameState();
    expect(getRankCorrMultiplier(fresh)).toBe(1);
  });

  it('applies the multiplier to the rank-up reward MP with a Corr note', () => {
    const base = createInitialGameState();
    // avg corr 50 -> +0.25 ; total attunement 300 -> +0.75 ; multiplier = 2.0.
    // Hollowed count is 0, so the dominion gate stays closed while scoring runs.
    const state = corrState([100, 100, 100], [makePrisoner({ pid: 1, corr: 50 }), makePrisoner({ pid: 2, corr: 50 })], {
      wave: 6,
      points: 100,
      endings: {
        ...base.endings,
        unlocked: { liberation: 5 },
        activeEnding: 'liberation',
        endless: true,
      },
      rankTrials: {
        active: true,
        rank: 0,
        currentTrial: 'wipe3',
        progress: 2,
        target: 3,
        nextCheckWave: 11,
        trialStartWave: 6,
        baselineAnnexed: 0,
        consecutiveWipes: 2,
        trialCursor: 0,
      },
    });

    const next = evaluateRankTrials(state, 'wipe');
    expect(next.rankTrials.rank).toBe(1);
    // base 150 + 1*50 = 200, x (1 + 50/200 + 300/400) = x 2.0 -> 400 MP
    expect(next.points).toBe(100 + 400);
    expect(next.chronicle[0]?.text).toContain('+400 MP & +1 Fame · Corr ×2.00');
    expect(next.flash).toContain('Corr ×2.00');
    // Scoring test state deliberately fails the dominion prisoner clause.
    expect(next.endings.unlocked.dominion).toBeUndefined();
  });

  it('keeps the base reward at zero corruption (rank regression)', () => {
    const base = createInitialGameState();
    const state = {
      ...base,
      wave: 6,
      points: 100,
      endings: {
        ...base.endings,
        unlocked: { liberation: 5 },
        activeEnding: 'liberation' as const,
        endless: true,
      },
      rankTrials: {
        active: true,
        rank: 0,
        currentTrial: 'wipe3' as const,
        progress: 2,
        target: 3,
        nextCheckWave: 11,
        trialStartWave: 6,
        baselineAnnexed: 0,
        consecutiveWipes: 2,
        trialCursor: 0,
      },
    };

    const next = evaluateRankTrials(state, 'wipe');
    expect(next.rankTrials.rank).toBe(1);
    expect(next.points).toBe(100 + 200);
    expect(next.chronicle[0]?.text).toContain('+200 MP & +1 Fame.');
    expect(next.chronicle[0]?.text).not.toContain('Corr ×');
  });
});
