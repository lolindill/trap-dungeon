import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORR_RATCHET_FLOOR, KINK_TRAP_MAP } from '../../data/constants';
import type { GameState, Prisoner, SlotGrade } from '../../types/game';
import { startNewDay } from '../dayLoop';
import { applyManagementSettle } from '../estate';
import { createInitialGameState } from '../saveLoad';

afterEach(() => {
  vi.restoreAllMocks();
});

const SETTLE_OPTS = { rollCrisis: false, jobRisks: false } as const;

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

function makeDayState(overrides?: Partial<ReturnType<typeof createInitialGameState>>) {
  const base = startNewDay({
    ...createInitialGameState(),
    wave: 3,
    points: 2000,
  });
  return { ...base, ...overrides };
}

/** Install one trap with the given types on floor 1 (the rest stay empty). */
function withFloorType(state: GameState, types: string[]): GameState {
  return {
    ...state,
    floors: state.floors.map((f) =>
      f.floor === 1
        ? {
            ...f,
            slots: [
              {
                id: 't0',
                text: 'Test Trap — a gimmick',
                grade: 'C' as SlotGrade,
                types,
                mpInvested: 10,
              },
            ],
          }
        : f
    ),
  };
}

function settle(state: GameState) {
  return applyManagementSettle(state, SETTLE_OPTS);
}

describe('Ticket 28: nightly kink-floor drift gate', () => {
  it('drifts +1 corr / -1 resist only when the kink maps to an installed floor type', () => {
    // bondage → ['bind'] per KINK_TRAP_MAP.
    const matched = settle(
      withFloorType(
        makeDayState({ prisoners: [makePrisoner(1, { kinkKey: 'bondage' })] }),
        ['bind']
      )
    );
    expect(matched.state.prisoners[0].corr).toBe(21); // 20 + 1
    expect(matched.state.prisoners[0].resist).toBe(39); // 40 - 1

    // Same kink above a floor whose types do NOT intersect its entry: no drift.
    const unmatched = settle(
      withFloorType(
        makeDayState({ prisoners: [makePrisoner(1, { kinkKey: 'bondage' })] }),
        ['phys']
      )
    );
    expect(unmatched.state.prisoners[0].corr).toBe(20);
    expect(unmatched.state.prisoners[0].resist).toBe(40);
  });

  it('zero drift for a legacy prisoner without kinkKey, even above a matching floor', () => {
    const res = settle(
      withFloorType(makeDayState({ prisoners: [makePrisoner(1)] }), ['bind'])
    );
    expect(res.state.prisoners[0].kinkKey).toBeUndefined();
    expect(res.state.prisoners[0].corr).toBe(20);
    expect(res.state.prisoners[0].resist).toBe(40);
  });

  it('zero drift for kinks absent from KINK_TRAP_MAP (toys, scent)', () => {
    // Guard: these kinks really have no trap-type entry, so the gate is a no-op.
    expect(KINK_TRAP_MAP['toys']).toBeUndefined();
    expect(KINK_TRAP_MAP['scent']).toBeUndefined();
    for (const kink of ['toys', 'scent']) {
      const res = settle(
        withFloorType(makeDayState({ prisoners: [makePrisoner(1, { kinkKey: kink })] }), ['bind'])
      );
      expect(res.state.prisoners[0].corr).toBe(20);
      expect(res.state.prisoners[0].resist).toBe(40);
    }
  });

  it('appends a ledger-truth journal row when the drift fires (ticket 23 precedent)', () => {
    const fired = settle(
      withFloorType(
        makeDayState({ prisoners: [makePrisoner(1, { kinkKey: 'bondage' })] }),
        ['bind']
      )
    );
    expect(
      fired.ledger.lines.some(
        (row) =>
          row.label === 'Nightly Kink-Floor Drift' &&
          row.deltaText === '+corr (kink floor) ×1'
      )
    ).toBe(true);

    // No drift (no installed traps at all) → no journal row.
    const quiet = settle(
      makeDayState({ prisoners: [makePrisoner(1, { kinkKey: 'bondage' })] })
    );
    expect(
      quiet.ledger.lines.some((row) => row.label === 'Nightly Kink-Floor Drift')
    ).toBe(false);
  });
});

describe('Ticket 28: drift determinism table (floor types × kinkKey → exact deltas)', () => {
  const cases: {
    kink: string | undefined;
    floorTypes: string[];
    nights: number;
    dCorr: number;
    dResist: number;
  }[] = [
    { kink: 'bondage', floorTypes: ['bind'], nights: 3, dCorr: 3, dResist: -3 },
    { kink: 'exhibition', floorTypes: ['cloth'], nights: 2, dCorr: 2, dResist: -2 },
    { kink: 'rough', floorTypes: ['phys'], nights: 3, dCorr: 3, dResist: -3 },
    { kink: 'tentacle', floorTypes: ['poison', 'parasite'], nights: 2, dCorr: 2, dResist: -2 },
    // drugs → [poison, parasite]; intersects via poison — one flat tick, not per type.
    { kink: 'drugs', floorTypes: ['bind', 'poison'], nights: 3, dCorr: 3, dResist: -3 },
    // praise → [lewd] only: [mind] does not intersect.
    { kink: 'praise', floorTypes: ['mind'], nights: 3, dCorr: 0, dResist: 0 },
    // rough → [phys] only: [bind] does not intersect.
    { kink: 'rough', floorTypes: ['bind'], nights: 3, dCorr: 0, dResist: 0 },
    // Legacy prisoner without kinkKey above a matching floor.
    { kink: undefined, floorTypes: ['bind'], nights: 3, dCorr: 0, dResist: 0 },
    // Unmapped kink above a floor that would match its neighbors.
    { kink: 'toys', floorTypes: ['bind'], nights: 3, dCorr: 0, dResist: 0 },
  ];

  for (const c of cases) {
    it(
      `${c.kink ?? '(no kinkKey)'} above [${c.floorTypes.join(', ')}] → ` +
        `corr ${c.dCorr >= 0 ? '+' : ''}${c.dCorr} / resist ${c.dResist} after ${c.nights} night(s)`,
      () => {
        let state = withFloorType(
          makeDayState({ prisoners: [makePrisoner(1, { kinkKey: c.kink })] }),
          c.floorTypes
        );
        for (let i = 0; i < c.nights; i++) {
          state = settle(state).state;
        }
        expect(state.prisoners[0].corr).toBe(20 + c.dCorr);
        expect(state.prisoners[0].resist).toBe(40 + c.dResist);
      }
    );
  }
});

describe('Ticket 28: comfort jobs nudge corr (DoL no-pure-recovery)', () => {
  it('bath and tavern workers tick corr +1 per settle', () => {
    // bath prisonerDelta is shame+5/pleasure+3 — no corr — so the +1 is the comfort tick.
    const bath = settle(makeDayState({ prisoners: [makePrisoner(1, { job: 'bath' })] }));
    expect(bath.state.prisoners[0].corr).toBe(21);
    const tavern = settle(makeDayState({ prisoners: [makePrisoner(1, { job: 'tavern' })] }));
    expect(tavern.state.prisoners[0].corr).toBe(21);
  });

  it('non-comfort jobs are unchanged by the comfort tick', () => {
    const farm = settle(makeDayState({ prisoners: [makePrisoner(1, { job: 'farm' })] }));
    expect(farm.state.prisoners[0].corr).toBe(20); // farm delta: resist only
    const brothel = settle(makeDayState({ prisoners: [makePrisoner(1, { job: 'brothel' })] }));
    expect(brothel.state.prisoners[0].corr).toBe(23); // prisonerDelta corr +3 exactly — no comfort double-dip
  });

  it('drift and comfort tick stack but stay bounded (+2 corr/day combined max)', () => {
    // praise → lewd floor (drift +1) + bath job (comfort +1).
    const state = withFloorType(
      makeDayState({ prisoners: [makePrisoner(1, { job: 'bath', kinkKey: 'praise' })] }),
      ['lewd']
    );
    const res = settle(state);
    expect(res.state.prisoners[0].corr).toBe(22);
    expect(res.state.prisoners[0].resist).toBe(39); // comfort tick never lowers resist; drift does
  });
});

describe('Ticket 28: corr cap + ratchet clamp site', () => {
  it('corr never exceeds 100 with drift + comfort stacking', () => {
    const state = withFloorType(
      makeDayState({ prisoners: [makePrisoner(1, { job: 'bath', kinkKey: 'praise', corr: 99 })] }),
      ['lewd']
    );
    const res = settle(state);
    expect(res.state.prisoners[0].corr).toBe(100);
  });

  it('clamp is a no-op today: never raises a sub-floor corr and never caps a Hollowed corr down', () => {
    // Sub-floor corr with no drift sources stays put — the clamp does not push up to 85.
    const sub = settle(makeDayState({ prisoners: [makePrisoner(1, { corr: 84 })] }));
    expect(sub.state.prisoners[0].corr).toBe(84);
    // Corr above the floor is NOT capped back down to the floor by the clamp.
    const above = settle(makeDayState({ prisoners: [makePrisoner(1, { corr: 90 })] }));
    expect(above.state.prisoners[0].corr).toBe(90);
  });

  it('invariant sweep: corr <= 100, exact bounded growth, and Hollowed prisoners never settle below the floor', () => {
    for (let start = 0; start <= 100; start++) {
      const state = withFloorType(
        makeDayState({
          prisoners: [makePrisoner(1, { job: 'bath', kinkKey: 'praise', corr: start })],
        }),
        ['lewd']
      );
      const res = settle(state);
      const corr = res.state.prisoners[0].corr;
      // Ticket 31: Complicit (50-69) kink-matched captives drift +1 harder —
      // +1 kink-floor drift +1 tier drift +1 comfort, capped at 100.
      const tierTick = start >= 50 && start <= 69 ? 1 : 0;
      expect(corr).toBe(Math.min(start + 2 + tierTick, 100));
      expect(corr).toBeLessThanOrEqual(100);
      if (start >= CORR_RATCHET_FLOOR) {
        expect(corr).toBeGreaterThanOrEqual(CORR_RATCHET_FLOOR); // ratchet holds
      }
    }
  });
});
