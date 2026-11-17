import { afterEach, describe, expect, it, vi } from 'vitest';
import { CFG, KINK_TRAP_MAP, TRAP_ERO_TYPES, TRAP_TYPES } from '../../data/constants';
import {
  advanceRaidStep,
  applyWaveSettlement,
  decideBeat,
  facedSlotWeights,
  resolveFloorEncounter,
  selectFacedSlot,
  slotKinkMatched,
} from '../raid';
import { createInitialGameState } from '../saveLoad';
import type { FloorState, GameState, Hero, TrapGrade } from '../../types/game';

function makeHero(over: Partial<Hero> = {}): Hero {
  return {
    slot: 1,
    grade: 'C',
    status: 'alive',
    gender: 'female',
    classKey: 'adventurer',
    classLabel: 'adventurer',
    raceKey: 'human',
    raceLabel: 'human',
    traits: [],
    kinkKey: 'praise',
    kinkDesc: 'praise and gentle words',
    age: 'late 20s',
    body: 'athletic',
    looks: 'plain',
    persona: 'steady',
    origin: 'guild dispatch',
    exp: 'some',
    marital: 'single',
    intel: 0,
    name: 'TestHero',
    appearance: '',
    outfit: '',
    personalityText: '',
    skill: '',
    weakness: '',
    kinkText: '',
    cond: '',
    ailment: 0,
    aroused: false,
    usedLuck: false,
    injIgnored: false,
    lastRollText: '',
    ...over,
  };
}

function makeFloor(types: string[], grades: TrapGrade[]): FloorState {
  return {
    floor: 1,
    synergy: '-',
    slots: grades.map((g, i) => ({
      id: `t${i}`,
      text: `Test Trap ${i} — a gimmick`,
      grade: g,
      types,
      mpInvested: 10,
    })),
  };
}

function raidState(): GameState {
  const s = createInitialGameState();
  s.mode = 'raid';
  s.raidFirstRoom = true;
  s.lust = 0;
  s.fear = 0;
  return s;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 5 — decideBeat pure ladder', () => {
  const base = { die: 10, margin: 10, wasSevere: false, deathMargin: CFG.DEATH_MARGIN, eroGated: false };

  it('pass ladder boundaries stay verbatim (easy 8 / clean 3 / narrow 0)', () => {
    expect(decideBeat({ ...base, margin: 8 })).toBe('easy');
    expect(decideBeat({ ...base, margin: 7 })).toBe('clean');
    expect(decideBeat({ ...base, margin: 3 })).toBe('clean');
    expect(decideBeat({ ...base, margin: 2 })).toBe('narrow');
    expect(decideBeat({ ...base, margin: 0 })).toBe('narrow');
  });

  it('nat20 → luck even on a negative margin (die≠1 pass wins first)', () => {
    expect(decideBeat({ ...base, die: 20, margin: -1 })).toBe('luck');
    expect(decideBeat({ ...base, die: 20, margin: 9 })).toBe('easy');
    expect(decideBeat({ ...base, die: 20, margin: 5 })).toBe('clean');
  });

  it('standard slots keep the death ladder (severe → nat1 → deep-negative)', () => {
    expect(decideBeat({ ...base, die: 3, margin: -50, wasSevere: true })).toBe('dead');
    expect(decideBeat({ ...base, die: 1, margin: -1 })).toBe('blunder');
    expect(decideBeat({ ...base, die: 5, margin: -4 })).toBe('dead');
    expect(decideBeat({ ...base, die: 5, margin: -3 })).toBe('captured');
  });

  it('F1 ero-gating: severe fails, nat1 and deep-negative margins all funnel to captured', () => {
    expect(decideBeat({ ...base, die: 3, margin: -50, wasSevere: true, eroGated: true })).toBe('captured');
    expect(decideBeat({ ...base, die: 1, margin: -30, eroGated: true })).toBe('captured');
    expect(decideBeat({ ...base, die: 5, margin: -99, eroGated: true })).toBe('captured');
    expect(decideBeat({ ...base, die: 6, margin: -1, eroGated: true })).toBe('captured');
  });
});

describe('Phase 5 — faced-slot selection (F1)', () => {
  it('kink-matched slots get ×2 weight, others uniform', () => {
    const floor = makeFloor(['phys'], ['C', 'C', 'C']);
    floor.slots[1].types = ['lewd'];
    const hero = makeHero({ kinkKey: 'praise' }); // praise → lewd
    expect(facedSlotWeights(hero, floor)).toEqual([1, 2, 1]);
    expect(slotKinkMatched('praise', ['lewd'])).toBe(true);
    expect(slotKinkMatched('praise', ['phys'])).toBe(false);
  });

  it('unmapped kinks (toys) stay uniform even in ero rooms', () => {
    const floor = makeFloor(['lewd'], ['C', 'C']);
    expect(facedSlotWeights(makeHero({ kinkKey: 'toys' }), floor)).toEqual([1, 1]);
  });

  it('disarmer faces the highest-grade slot (one-hot weights)', () => {
    const floor = makeFloor(['phys'], ['C', 'A', 'B']);
    expect(facedSlotWeights(makeHero({ traits: ['disarmer'] }), floor)).toEqual([0, 1, 0]);
  });

  it('selectFacedSlot resolves index/label/kink from the weights', () => {
    const floor = makeFloor(['lewd', 'bind'], ['C', 'A']);
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // first weight bucket
    const faced = selectFacedSlot(makeHero({ kinkKey: 'praise' }), floor); // praise → lewd
    spy.mockRestore();
    expect(faced).not.toBeNull();
    expect(faced!.index).toBe(0);
    expect(faced!.label).toBe('Test Trap 0');
    expect(faced!.kinkMatched).toBe(true);
  });

  it('locked constants: ero set is the 5-type subset; every kink maps real TRAP_TYPES', () => {
    expect(TRAP_ERO_TYPES).toEqual(['lewd', 'bind', 'cloth', 'parasite', 'mutate']);
    for (const types of Object.values(KINK_TRAP_MAP)) {
      for (const t of types) expect(TRAP_TYPES).toContain(t);
    }
  });
});

describe('Phase 5 — F2 capture meter in resolveFloorEncounter', () => {
  it('first captured-beat in an ero slot converts to STAGGERED (alive, no fell, no fear)', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']); // DC 13, ero-gated
    const hero = makeHero({ name: 'Mira' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('captured'); // ero-gated: nat1 is captured, not blunder
    expect(res.party[0].status).toBe('alive');
    expect(res.party[0].staggered).toBe(true);
    expect(res.party[0].usedStagger).toBe(true);
    expect(res.fell).toHaveLength(0);
    expect(res.fearGain).toBe(0);
    expect(res.detailLines.join('\n')).toContain('STAGGERED');
    expect(res.audit[0].faced).toContain('#1');
  });

  it('repeat captured-beat while staggered → captured for real', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    const hero = makeHero({ name: 'Mira' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const res1 = resolveFloorEncounter(s, floor, [hero], 1);
    expect(res1.party[0].staggered).toBe(true);

    const res2 = resolveFloorEncounter(s, floor, [res1.party[0]], 1);
    spy.mockRestore();

    expect(res2.party[0].status).toBe('captured');
    expect(res2.fell).toHaveLength(1);
  });

  it('a severe hero failing in an ero slot is never dead — she staggers instead', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    const hero = makeHero({ name: 'Vie', cond: 'severe' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // die 1

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('captured');
    expect(res.party[0].status).toBe('alive');
    expect(res.party[0].staggered).toBe(true);
  });

  it('death paths bypass the meter: severe fail in a standard slot dies outright', () => {
    const s = raidState();
    const floor = makeFloor(['phys'], ['SSS']); // standard type
    const hero = makeHero({ name: 'Rook', cond: 'severe' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // die 1

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('dead');
    expect(res.party[0].status).toBe('dead');
    expect(res.party[0].usedStagger).toBeUndefined();
    expect(res.fell).toHaveLength(1);
    expect(res.fearGain).toBe(CFG.FEAR.KILL);
  });

  it('death paths bypass the meter: deep-negative margin dies without spending it', () => {
    const s = raidState();
    const floor = makeFloor(['phys'], ['SSS']);
    const hero = makeHero({ name: 'Dorn' }); // healthy, die 6 → margin ≈ −7 ≤ −deathMargin
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25); // d20 = 6

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('dead');
    expect(res.party[0].status).toBe('dead');
    expect(res.party[0].usedStagger).toBeUndefined();
  });

  it('staggered heroes take mods −1 in every remaining room', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    const hero = makeHero({ name: 'Nia' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25); // d20 = 6, deterministic

    const res1 = resolveFloorEncounter(s, floor, [hero], 1);
    const modsClean = res1.audit[0].mods;
    expect(res1.party[0].staggered).toBe(true);

    const res2 = resolveFloorEncounter(s, floor, [res1.party[0]], 1);
    spy.mockRestore();

    expect(res2.audit[0].mods).toBe(modsClean - 1);
    expect(res2.party[0].status).toBe('captured'); // repeat beat while staggered
  });

  it('an all-staggered party is never misclassified as a wipe (breach + flags reset)', () => {
    const s = raidState();
    s.floors = s.floors.map((f) =>
      f.floor === 1
        ? { ...f, slots: [{ id: 't0', text: 'Lewd Snare — gimmick', grade: 'SSS' as const, types: ['lewd'], mpInvested: 10 }] }
        : f
    );
    s.party = [
      makeHero({ slot: 1, name: 'A' }),
      makeHero({ slot: 2, name: 'B' }),
      makeHero({ slot: 3, name: 'C' }),
    ];
    // 0.06 → d20 = 2 (fail, ero → staggered); core-capture baseline 0.05 does NOT proc
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.06);

    const step = advanceRaidStep(s);
    spy.mockRestore();

    expect(step.outcome).toBe('breach'); // 3 alive — never a wipe
    expect(step.detailText).toContain('STAGGERED');
    expect(step.state.lastAudit.every((r) => r.statusAfter === 'alive')).toBe(true);
    // settlement resolution point: staggered → plain alive, meter flags reset
    expect(step.state.party.every((h) => h.status === 'alive')).toBe(true);
    expect(step.state.party.every((h) => !h.staggered && !h.usedStagger)).toBe(true);
  });
});

describe('Phase 5 — settlement conversion', () => {
  it('staggered → alive with cond no worse than injured; flags reset; retreated included', () => {
    const s = createInitialGameState();
    s.party = [
      makeHero({ slot: 1, name: 'A', staggered: true, usedStagger: true, cond: 'severe' }),
      makeHero({ slot: 2, name: 'B', status: 'retreated', staggered: true, usedStagger: true, cond: 'severe' }),
      makeHero({ slot: 3, name: 'C', status: 'captured' }),
    ];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const settled = applyWaveSettlement(s, 'wipe');
    spy.mockRestore();

    const [a, b, c] = settled.party;
    expect(a.status).toBe('alive');
    expect(a.cond).toBe('injured');
    expect(a.staggered).toBeUndefined();
    expect(a.usedStagger).toBeUndefined();
    expect(b.cond).toBe('injured');
    expect(b.staggered).toBeUndefined();
    expect(b.usedStagger).toBeUndefined();
    expect(c.status).toBe('captured');
  });
});
