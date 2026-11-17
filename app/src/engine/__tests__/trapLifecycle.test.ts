import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRAP_ATTUNEMENT, TRAP_WEAR } from '../../data/constants';
import {
  applyTrapBeat,
  applyWaveSettlement,
  facedSlotWeights,
  isTrapActive,
  resolveFloorEncounter,
  selectFacedSlot,
  settleTrapSlot,
} from '../raid';
import { createInitialGameState } from '../saveLoad';
import type { FloorState, GameState, Hero, TrapGrade, TrapSlot } from '../../types/game';

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

function makeSlot(over: Partial<TrapSlot> = {}): TrapSlot {
  return {
    id: 't0',
    text: 'Lewd Snare — a gimmick',
    grade: 'C',
    types: ['lewd'],
    mpInvested: 10,
    ...over,
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

/** Floor 1 solo slot, grade D, standard type → DC 7; wave-1 hero-C mods = −1 (+2 disarmer). */
function soloRaidFloor(types: string[], slotOver: Partial<TrapSlot> = {}): FloorState {
  return {
    floor: 1,
    synergy: '-',
    slots: [
      {
        id: 't0',
        text: 'Test Trap 0 — a gimmick',
        grade: 'D',
        types,
        mpInvested: 10,
        ...slotOver,
      },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Ticket 29 — applyTrapBeat table (pass/fail × kink × stagger/capture)', () => {
  const base = { beatKey: 'easy', margin: 10, kinkMatched: false, heroKinkKey: 'praise', isDisarmer: false };

  it('any pass beat wears the faced slot (+10; +15 kink-matched), no attunement', () => {
    const plain = applyTrapBeat(makeSlot(), base);
    expect(plain.wear).toBe(TRAP_WEAR.PER_BEAT);
    expect(plain.attunement).toBeUndefined();
    expect(plain.attunedKink).toBeUndefined();
    expect(plain.status).toBeUndefined();

    const kinked = applyTrapBeat(makeSlot(), { ...base, kinkMatched: true });
    expect(kinked.wear).toBe(TRAP_WEAR.PER_BEAT_KINK);
    expect(kinked.status).toBeUndefined();
  });

  it('beat resolving STAGGERED by this slot: +PER_STAGGER attunement + slot remembers the kink', () => {
    const out = applyTrapBeat(makeSlot(), { ...base, beatKey: 'captured', caughtBySlot: 'staggered' });
    expect(out.wear).toBe(TRAP_WEAR.PER_BEAT);
    expect(out.attunement).toBe(TRAP_ATTUNEMENT.PER_STAGGER);
    expect(out.attunedKink).toBe('praise');
    expect(out.status).toBeUndefined();
  });

  it('beat resolving CAPTURED by this slot: +PER_CAPTURE attunement (kink wear stacks too)', () => {
    const out = applyTrapBeat(makeSlot(), {
      ...base,
      beatKey: 'captured',
      kinkMatched: true,
      caughtBySlot: 'captured',
      heroKinkKey: 'tentacle',
    });
    expect(out.wear).toBe(TRAP_WEAR.PER_BEAT_KINK);
    expect(out.attunement).toBe(TRAP_ATTUNEMENT.PER_CAPTURE);
    expect(out.attunedKink).toBe('tentacle');
  });

  it('fail saved by grit (ENDURES) is neither stagger nor capture → wear only, no attunement', () => {
    const out = applyTrapBeat(makeSlot(), { ...base, beatKey: 'captured' });
    expect(out.wear).toBe(TRAP_WEAR.PER_BEAT);
    expect(out.attunement).toBeUndefined();
    expect(out.attunedKink).toBeUndefined();
  });

  it('attunement accrues on top of prior ledger and caps at 100', () => {
    const mid = applyTrapBeat(makeSlot({ wear: 20, attunement: 20 }), {
      ...base,
      beatKey: 'captured',
      caughtBySlot: 'captured',
    });
    expect(mid.wear).toBe(30);
    expect(mid.attunement).toBe(35);

    const capped = applyTrapBeat(makeSlot({ attunement: 95 }), {
      ...base,
      beatKey: 'captured',
      caughtBySlot: 'staggered',
    });
    expect(capped.attunement).toBe(100);
  });

  it('wear reaching SPENT flips the slot to spent (capped at 100)', () => {
    const exact = applyTrapBeat(makeSlot({ wear: 90 }), base);
    expect(exact.wear).toBe(TRAP_WEAR.SPENT);
    expect(exact.status).toBe('spent');

    const over = applyTrapBeat(makeSlot({ wear: 90 }), { ...base, kinkMatched: true });
    expect(over.wear).toBe(TRAP_WEAR.SPENT);
    expect(over.status).toBe('spent');
  });

  it('spent and disarmed slots receive NO writes at all (pure pass-through)', () => {
    const spent = makeSlot({ status: 'spent', wear: 100, attunement: 40, attunedKink: 'praise' });
    expect(applyTrapBeat(spent, { ...base, beatKey: 'captured', caughtBySlot: 'captured' })).toBe(spent);

    const disarmed = makeSlot({ status: 'disarmed' });
    expect(applyTrapBeat(disarmed, base)).toBe(disarmed);
  });
});

describe('Ticket 29 — disarm counterplay (disarmer + pass + margin ≥ 5)', () => {
  const disarmer = {
    beatKey: 'easy',
    margin: 8,
    kinkMatched: false,
    heroKinkKey: 'praise',
    isDisarmer: true,
  };

  it('disarms exactly at margin 5 on a pass (clean or easy)', () => {
    expect(applyTrapBeat(makeSlot(), { ...disarmer, margin: 5 }).status).toBe('disarmed');
    expect(applyTrapBeat(makeSlot(), { ...disarmer, beatKey: 'clean', margin: 5 }).status).toBe(
      'disarmed'
    );
    // margin 4 pass does NOT disarm — and the beat still wears the slot
    const near = applyTrapBeat(makeSlot(), { ...disarmer, margin: 4 });
    expect(near.status).toBeUndefined();
    expect(near.wear).toBe(TRAP_WEAR.PER_BEAT);
  });

  it('narrow-beat pass never disarms (nimble/ironhide saves are not disarms)', () => {
    const out = applyTrapBeat(makeSlot(), { ...disarmer, beatKey: 'narrow', margin: 2 });
    expect(out.status).toBeUndefined();
    expect(out.wear).toBe(TRAP_WEAR.PER_BEAT);
  });

  it('luck pass (negative margin) and fail beats never disarm', () => {
    expect(applyTrapBeat(makeSlot(), { ...disarmer, beatKey: 'luck', margin: -1 }).status).toBeUndefined();
    expect(
      applyTrapBeat(makeSlot(), { ...disarmer, beatKey: 'captured', margin: -6, caughtBySlot: 'captured' }).status
    ).toBeUndefined();
  });

  it('non-disarmer pass never disarms, even with a huge margin', () => {
    const out = applyTrapBeat(makeSlot(), { ...disarmer, isDisarmer: false, margin: 12 });
    expect(out.status).toBeUndefined();
    expect(out.wear).toBe(TRAP_WEAR.PER_BEAT);
  });

  it('disarm wins over spent when both fire on the same beat', () => {
    const out = applyTrapBeat(makeSlot({ wear: 95 }), { ...disarmer, kinkMatched: true, margin: 8 });
    expect(out.wear).toBe(TRAP_WEAR.SPENT);
    expect(out.status).toBe('disarmed');
  });
});

describe('Ticket 29 — faced-selection skips spent/disarmed slots', () => {
  it('isTrapActive: absent/armed active, spent/disarmed inactive', () => {
    expect(isTrapActive({ status: undefined })).toBe(true);
    expect(isTrapActive({ status: 'armed' })).toBe(true);
    expect(isTrapActive({ status: 'spent' })).toBe(false);
    expect(isTrapActive({ status: 'disarmed' })).toBe(false);
  });

  it('spent/disarmed slots get weight 0 for kink selection', () => {
    const floor = makeFloor(['phys'], ['C', 'C', 'C']);
    floor.slots[1].status = 'spent';
    floor.slots[2].status = 'disarmed';
    expect(facedSlotWeights(makeHero({ kinkKey: 'praise' }), floor)).toEqual([1, 0, 0]);
  });

  it('disarmer one-hot targets the best ACTIVE slot (disarmed best-slot skipped)', () => {
    const floor = makeFloor(['phys'], ['C', 'A', 'B']);
    floor.slots[1].status = 'disarmed'; // grade A out of the fight
    expect(facedSlotWeights(makeHero({ traits: ['disarmer'] }), floor)).toEqual([0, 0, 1]);
  });

  it('selectFacedSlot returns null when every slot is spent/disarmed', () => {
    const floor = makeFloor(['lewd'], ['A', 'S']);
    floor.slots[0].status = 'spent';
    floor.slots[1].status = 'disarmed';
    expect(selectFacedSlot(makeHero({ kinkKey: 'praise' }), floor)).toBeNull();
  });

  it('selectFacedSlot still resolves an active slot among inactive ones', () => {
    const floor = makeFloor(['lewd'], ['C', 'C']);
    floor.slots[0].status = 'spent';
    floor.slots[1].types = ['phys']; // not kink-matched for praise
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // would hit the zero bucket
    const faced = selectFacedSlot(makeHero({ kinkKey: 'praise' }), floor);
    spy.mockRestore();
    expect(faced).not.toBeNull();
    expect(faced!.index).toBe(1);
    expect(faced!.kinkMatched).toBe(false);
  });
});

describe('Ticket 29 — raid write-path integration (resolveFloorEncounter)', () => {
  it('staggered beat writes the kink-matched slot ledger into nextFloors', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']); // DC 13, ero-gated, praise → kink match
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...floor } : f));
    const hero = makeHero({ name: 'Mira' });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → captured beat → STAGGERED

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.party[0].staggered).toBe(true);
    const slot = res.nextFloors[0].slots[0];
    expect(slot.wear).toBe(TRAP_WEAR.PER_BEAT_KINK); // kink-matched beat wear
    expect(slot.attunement).toBe(TRAP_ATTUNEMENT.PER_STAGGER);
    expect(slot.attunedKink).toBe('praise');
    expect(slot.status).toBeUndefined(); // far from spent, not disarmed
    // The pre-raid state floors must stay untouched (nextFloors are copies).
    expect(s.floors[0].slots[0].wear).toBeUndefined();
  });

  it('clean pass at margin ≥ 5: kink wear only — no attunement, non-disarmer never disarms', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...floor } : f));
    const hero = makeHero({ name: 'Kae' }); // praise → kink-matched, not a disarmer
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19, margin 5 → clean pass

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('clean');
    expect(res.audit[0].margin).toBeGreaterThanOrEqual(5);
    const slot = res.nextFloors[0].slots[0];
    expect(slot.wear).toBe(TRAP_WEAR.PER_BEAT_KINK);
    expect(slot.attunement).toBeUndefined();
    expect(slot.status).toBeUndefined();
  });

  it('disarmer passing with margin ≥ 5 disarms the faced slot in-raid (audit note)', () => {
    const s = raidState();
    const floor = soloRaidFloor(['phys']); // DC 7; die 19 + mods 1 → margin 13 → easy pass
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...floor } : f));
    const hero = makeHero({ name: 'Lock', traits: ['disarmer'] });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('easy');
    expect(res.audit[0].margin).toBeGreaterThanOrEqual(5);
    expect(res.party[0].status).toBe('alive');
    const slot = res.nextFloors[0].slots[0];
    expect(slot.status).toBe('disarmed');
    expect(slot.wear).toBe(TRAP_WEAR.PER_BEAT); // the disarm beat still wears the trap
    expect(slot.attunement).toBeUndefined();
    expect(res.audit[0].faced).toContain('[disarmed]');
    expect(res.detailLines.join('\n')).toContain('DISARMED');
  });

  it('narrow-beat pass does NOT disarm (nimble/ironhide territory)', () => {
    const s = raidState();
    const floor = soloRaidFloor(['phys']); // DC 7; die 7 + mods 1 → margin 1 → narrow
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...floor } : f));
    const hero = makeHero({ name: 'Nim', traits: ['disarmer'] });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.3); // d20 = 7

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('narrow');
    const slot = res.nextFloors[0].slots[0];
    expect(slot.status).toBeUndefined(); // no disarm, not spent
    expect(slot.wear).toBe(TRAP_WEAR.PER_BEAT);
  });

  it('a spent slot is never faced and receives no further writes', () => {
    const s = raidState();
    const floor = soloRaidFloor(['phys'], { status: 'spent', wear: 100 });
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...floor } : f));
    const hero = makeHero({ name: 'Ghost', traits: ['disarmer'] });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25); // d20 = 6, margin 0 → narrow pass

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].faced).toBeUndefined(); // nothing to face
    const slot = res.nextFloors[0].slots[0];
    expect(slot.status).toBe('spent');
    expect(slot.wear).toBe(100); // untouched
    expect(slot.attunement).toBeUndefined();
  });

  it('multi-hero beats accumulate on the same faced slot (stagger + real capture)', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['SSS']);
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...floor } : f));
    const party = [
      makeHero({ slot: 1 as const, name: 'A' }),
      makeHero({ slot: 2 as const, name: 'B', usedStagger: true }), // B's meter already spent
    ];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // both nat1 → captured beats

    const res = resolveFloorEncounter(s, floor, party, 1);
    spy.mockRestore();

    const slot = res.nextFloors[0].slots[0];
    // A: STAGGERED (+15 att); B: real CAPTURE (+15 att) — same slot ledger.
    expect(res.party[0].staggered).toBe(true);
    expect(res.party[1].status).toBe('captured');
    expect(res.fell.map((h) => h.name)).toEqual(['B']);
    expect(slot.wear).toBe(TRAP_WEAR.PER_BEAT_KINK * 2);
    expect(slot.attunement).toBe(TRAP_ATTUNEMENT.PER_STAGGER + TRAP_ATTUNEMENT.PER_CAPTURE);
    expect(slot.attunedKink).toBe('praise');
  });
});

describe('Ticket 29 — settlement: re-arm, wear decay, attunement ratchet', () => {
  it('settleTrapSlot: re-arms status, decays wear toward 0, keeps attunement/kink', () => {
    const settled = settleTrapSlot(makeSlot({ status: 'spent', wear: 90, attunement: 55, attunedKink: 'bondage' }));
    expect(settled.status).toBe('armed');
    expect(settled.wear).toBe(60);
    expect(settled.attunement).toBe(55);
    expect(settled.attunedKink).toBe('bondage');

    const disarmed = settleTrapSlot(makeSlot({ status: 'disarmed', wear: 20 }));
    expect(disarmed.status).toBe('armed');
    expect(disarmed.wear).toBe(0);
  });

  it('settleTrapSlot: untouched config slots pass through untouched', () => {
    const plain = makeSlot();
    expect(settleTrapSlot(plain)).toBe(plain);
  });

  it('3-wave simulation: wear trends to 0 while attunement holds (≥ TIER ratchet)', () => {
    const s = createInitialGameState();
    s.floors = s.floors.map((f) =>
      f.floor === 1
        ? {
            ...f,
            slots: [
              makeSlot({ wear: 90, attunement: 55, status: 'spent', attunedKink: 'bondage' }),
              makeSlot({ id: 't1', text: 'Second Snare — a gimmick', wear: 45, attunement: 30 }),
            ],
          }
        : f
    );
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    let state = applyWaveSettlement(s, 'wipe');
    const wave1 = state.floors[0].slots;
    expect(wave1[0]).toEqual(
      makeSlot({ status: 'armed', wear: 60, attunement: 55, attunedKink: 'bondage' })
    );
    expect(wave1[1]).toEqual(
      makeSlot({ id: 't1', text: 'Second Snare — a gimmick', status: 'armed', wear: 15, attunement: 30 })
    );

    state = applyWaveSettlement(state, 'wipe');
    state = applyWaveSettlement(state, 'wipe');
    spy.mockRestore();

    const [tiered, below] = state.floors[0].slots;
    // Wear fully decayed after 3 settlements; attunement never moved an inch.
    expect(tiered.status).toBe('armed');
    expect(tiered.wear).toBe(0);
    expect(tiered.attunement).toBe(55);
    expect(tiered.attunedKink).toBe('bondage');
    expect(below.wear).toBe(0);
    expect(below.attunement).toBe(30); // below TIER: no floor applied either
  });

  it('ratchet guard: an attunement at/above TIER never settles below TIER', () => {
    expect(settleTrapSlot(makeSlot({ attunement: TRAP_ATTUNEMENT.TIER })).attunement).toBe(
      TRAP_ATTUNEMENT.TIER
    );
    expect(settleTrapSlot(makeSlot({ attunement: TRAP_ATTUNEMENT.TIER + 5 })).attunement).toBe(
      TRAP_ATTUNEMENT.TIER + 5
    );
  });
});
