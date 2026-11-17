import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceRaidStep,
  applyWaveSettlement,
  resolveFloorEncounter,
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
    skill: 'keen eyes',
    weakness: 'stubborn pride',
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

describe('Corruption seam I — hero corrFeed ledger (ticket 26)', () => {
  it('accumulates exactly once on a PASS beat inside an ero-type slot', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']); // DC 13, ero-gated
    const hero = makeHero({ name: 'Mira' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.96); // d20 = 20

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(['easy', 'clean', 'narrow']).toContain(res.audit[0].beat);
    expect(res.party[0].corrFeed).toBe(1);
  });

  it('accumulates exactly once on a FAIL beat inside an ero-type slot', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    const hero = makeHero({ name: 'Nia' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.06); // d20 = 2, fail → captured-beat

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('captured'); // ero-gated: never dead
    expect(res.party[0].staggered).toBe(true); // capture meter spent
    expect(res.party[0].corrFeed).toBe(1); // failed beat still feeds the ledger
  });

  it('a kink-matched faced slot still counts exactly once', () => {
    const s = raidState();
    // praise → lewd (KINK_TRAP_MAP): the single faced slot is kink-matched
    // (×2 selection weight) but the beat resolves once → +1, not +2.
    const floor = makeFloor(['lewd'], ['SSS']);
    const hero = makeHero({ name: 'Kae', kinkKey: 'praise' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.96);

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].faced).toContain('(kink)');
    expect(res.party[0].corrFeed).toBe(1);
  });

  it('never writes on standard-slot beats — pass or fail', () => {
    const s = raidState();
    const floor = makeFloor(['phys'], ['SSS']); // standard type, not in TRAP_ERO_TYPES
    const passer = makeHero({ slot: 1, name: 'Rook' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.96);
    const pass = resolveFloorEncounter(s, floor, [passer], 1);
    expect(pass.party[0].corrFeed).toBeUndefined();

    // Deep-negative fail in a standard slot → dead (death ladder intact),
    // and the ledger still never wrote.
    const failer = makeHero({ slot: 1, name: 'Dorn' });
    spy.mockReturnValue(0.25); // d20 = 6
    const fail = resolveFloorEncounter(s, floor, [failer], 1);
    spy.mockRestore();

    expect(fail.audit[0].beat).toBe('dead');
    expect(fail.party[0].status).toBe('dead');
    expect(fail.party[0].corrFeed).toBeUndefined();
  });

  it('stacks one per ero room across a raid (no per-room reset)', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    const hero = makeHero({ name: 'Vie' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.96); // pass both rooms

    const res1 = resolveFloorEncounter(s, floor, [hero], 1);
    expect(res1.party[0].corrFeed).toBe(1);
    const res2 = resolveFloorEncounter(s, floor, res1.party, 2);
    spy.mockRestore();

    expect(res2.party[0].corrFeed).toBe(2);
  });
});

describe('Corruption seam I — capture identity carry (ticket 26)', () => {
  it('captured hero → prisoner carries kinkKey/kinkDesc/persona/skill/weakness', () => {
    const s = raidState();
    // Capture floor with the hero's kink-matched type so the local
    // matchedKink seam computation sees real data at settlement.
    s.floors = s.floors.map((f) =>
      f.floor === 1
        ? {
            ...f,
            slots: [
              {
                id: 't0',
                text: 'Lewd Snare — gimmick',
                grade: 'SSS' as const,
                types: ['lewd'],
                mpInvested: 10,
              },
            ],
          }
        : f
    );
    s.party = [
      makeHero({
        name: 'Mira',
        status: 'captured',
        fallenFloor: 1,
        fallenWave: 2,
        corrFeed: 3,
        kinkKey: 'bondage',
        kinkDesc: 'ropes and strict restraints',
        persona: 'defiant',
        skill: 'lockpicking',
        weakness: 'stubborn pride',
      }),
    ];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const settled = applyWaveSettlement(s, 'wipe');
    spy.mockRestore();

    expect(settled.prisoners).toHaveLength(1);
    const p = settled.prisoners[0];
    expect(p.name).toBe('Mira');
    expect(p.kinkKey).toBe('bondage');
    expect(p.kinkDesc).toBe('ropes and strict restraints');
    expect(p.persona).toBe('defiant');
    expect(p.skill).toBe('lockpicking');
    expect(p.weakness).toBe('stubborn pride');
    // The matchedKink seam is a LOCAL value only — no new field is stored
    // (ticket 27 consumes it inside the settlement).
    expect('matchedKink' in p).toBe(false);
    expect('facedSlotTypes' in p).toBe(false);
  });
});

describe('Corruption seam I — settlement corrFeed reset (ticket 26)', () => {
  it('resets corrFeed for captured, retreated AND staggered-converted heroes', () => {
    const s = createInitialGameState();
    s.party = [
      makeHero({ slot: 1, name: 'A', staggered: true, usedStagger: true, corrFeed: 2 }),
      makeHero({ slot: 2, name: 'B', status: 'retreated', corrFeed: 1 }),
      makeHero({
        slot: 3,
        name: 'C',
        status: 'captured',
        corrFeed: 3,
        fallenFloor: 1,
        kinkKey: 'bondage',
        persona: 'defiant',
        skill: 'lockpicking',
        weakness: 'stubborn pride',
        kinkDesc: 'ropes',
      }),
    ];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const settled = applyWaveSettlement(s, 'wipe');
    spy.mockRestore();

    const [a, b, c] = settled.party;
    expect(a.status).toBe('alive'); // staggered converted back
    expect(a.corrFeed).toBeUndefined();
    expect(b.status).toBe('retreated');
    expect(b.corrFeed).toBeUndefined();
    expect(c.status).toBe('captured');
    expect(c.corrFeed).toBeUndefined();
    // Prisoner built BEFORE the reset: identity carried regardless.
    expect(settled.prisoners.find((p) => p.name === 'C')?.kinkKey).toBe('bondage');
  });

  it('resets corrFeed on a retreat outcome too, and leaves clean heroes untouched', () => {
    const s = createInitialGameState();
    const clean = makeHero({ slot: 1, name: 'A' });
    s.party = [
      clean,
      makeHero({ slot: 2, name: 'B', status: 'retreated', corrFeed: 2 }),
    ];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const settled = applyWaveSettlement(s, 'retreat');
    spy.mockRestore();

    expect(settled.party[0].corrFeed).toBeUndefined(); // absent stays absent
    expect(settled.party[1].corrFeed).toBeUndefined();
  });

  it('a full raid ending in capture resets the ledger at settlement (advanceRaidStep path)', () => {
    const s = raidState();
    s.floors = s.floors.map((f) =>
      f.floor === 1
        ? {
            ...f,
            slots: [
              {
                id: 't0',
                text: 'Lewd Snare — gimmick',
                grade: 'SSS' as const,
                types: ['lewd'],
                mpInvested: 10,
              },
            ],
          }
        : f
    );
    s.party = [makeHero({ slot: 1, name: 'Solo' })];
    // 0.06 → d20 = 2 (ero fail → staggered, corrFeed +1); core-capture
    // baseline 0.05 does NOT proc. Solo survivor breaches alive.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.06);

    const step = advanceRaidStep(s);
    expect(step.isFinal).toBe(true);
    expect(step.state.party[0].corrFeed).toBeUndefined(); // settlement reset
    expect(step.state.party[0].staggered).toBeUndefined();
    spy.mockRestore();
  });
});
