import { afterEach, describe, expect, it, vi } from 'vitest';
import { CFG, KINK_TRAP_MAP, TRAP_ATTUNEMENT, TRAP_WEAR } from '../../data/constants';
import { effectiveGrade, getFloorDC } from '../dungeon';
import { getRepairAllCost, repairAllTraps } from '../dayLoop';
import { applyWaveSettlement, facedSlotWeights, resolveFloorEncounter } from '../raid';
import { prepIntelDisarm } from '../workflow';
import { slotStatusWord, buildRaidMessages } from '../../llm/promptBuilder';
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

function makeSlot(over: Partial<TrapSlot> = {}): TrapSlot {
  return {
    id: 't0',
    text: 'Test Trap 0 — a gimmick',
    grade: 'C',
    types: ['lewd'],
    mpInvested: 10,
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

describe('Ticket 30 — effectiveGrade boundaries', () => {
  it('softens exactly at wear 60 (59 keeps the grade, 60 defends one lower)', () => {
    expect(effectiveGrade(makeSlot({ grade: 'B', wear: 59 }))).toBe('B');
    expect(effectiveGrade(makeSlot({ grade: 'B', wear: 60 }))).toBe('C');
    expect(effectiveGrade(makeSlot({ grade: 'B' }))).toBe('B'); // absent wear = unworn
    expect(effectiveGrade(makeSlot({ grade: 'SSS', wear: 90 }))).toBe('SS');
    expect(effectiveGrade(makeSlot({ grade: 'D', wear: 99 }))).toBe('D'); // no grade below D
  });

  it('spent and disarmed slots defend nothing; unrated stays ?', () => {
    expect(effectiveGrade(makeSlot({ grade: 'S', status: 'spent', wear: 100 }))).toBe('?');
    expect(effectiveGrade(makeSlot({ grade: 'S', status: 'disarmed' }))).toBe('?');
    expect(effectiveGrade(makeSlot({ grade: '?', wear: 80 }))).toBe('?');
  });

  it('DC regression: one softened B in a 2-slot floor drops DC exactly TRAP_BONUS[B] − TRAP_BONUS[C]', () => {
    const clean = makeFloor(['phys'], ['B', 'C']);
    const worn = makeFloor(['phys'], ['B', 'C']);
    worn.slots[0].wear = TRAP_WEAR.SOFT_GRADE;
    expect(getFloorDC(clean)).toBe(
      getFloorDC(worn) + (CFG.TRAP_BONUS.B - CFG.TRAP_BONUS.C)
    );
  });

  it('DC: a spent slot contributes 0 bonus and drops out of the synergy count', () => {
    const floor = makeFloor(['phys'], ['B', 'C']);
    floor.synergy = 'B'; // +1 while 2 slots defend
    expect(getFloorDC(floor)).toBe(
      CFG.DC_BASE + CFG.TRAP_BONUS.B + CFG.TRAP_BONUS.C + CFG.SYNERGY_BONUS.B
    );
    floor.slots[1].status = 'spent';
    expect(getFloorDC(floor)).toBe(CFG.DC_BASE + CFG.TRAP_BONUS.B);
  });

  it('DC: an active ASCENDANT-attuned slot adds +1 (84 does not, spent 85 does not)', () => {
    const floor = makeFloor(['phys'], ['B']);
    expect(getFloorDC(floor)).toBe(CFG.DC_BASE + CFG.TRAP_BONUS.B);
    floor.slots[0].attunement = TRAP_ATTUNEMENT.ASCENDANT - 1;
    expect(getFloorDC(floor)).toBe(CFG.DC_BASE + CFG.TRAP_BONUS.B);
    floor.slots[0].attunement = TRAP_ATTUNEMENT.ASCENDANT;
    expect(getFloorDC(floor)).toBe(CFG.DC_BASE + CFG.TRAP_BONUS.B + 1);
    floor.slots[0].status = 'spent';
    // The floor's only slot is spent: 0 trap bonus AND no ascendant aura.
    expect(getFloorDC(floor)).toBe(CFG.DC_BASE);
  });
});

describe('Ticket 30 — attunement read effects in the raid loop', () => {
  it('TIER-attuned slot: kink-matched hero takes mods −1 facing it (audit-noted)', () => {
    const s = raidState();
    const cleanFloor = makeFloor(['lewd'], ['D']); // praise → lewd: kink match
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...cleanFloor } : f));
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19
    const clean = resolveFloorEncounter(s, cleanFloor, [makeHero({ name: 'Mira' })], 1);

    const attunedFloor = makeFloor(['lewd'], ['D']);
    attunedFloor.slots[0].attunement = TRAP_ATTUNEMENT.TIER;
    const attuned = resolveFloorEncounter(s, attunedFloor, [makeHero({ name: 'Mira' })], 1);

    const otherFloor = makeFloor(['lewd'], ['D']);
    otherFloor.slots[0].attunement = TRAP_ATTUNEMENT.TIER;
    const unmatched = resolveFloorEncounter(
      s,
      otherFloor,
      [makeHero({ name: 'Rough', kinkKey: 'rough' })], // rough → phys, not lewd
      1
    );
    spy.mockRestore();

    expect(attuned.audit[0].mods).toBe(clean.audit[0].mods - 1);
    expect(attuned.detailLines.join('\n')).toContain('attuned trap targets praise kink (mods −1)');
    // No kink mapping to the slot's types → no targetability penalty.
    expect(unmatched.audit[0].mods).toBe(clean.audit[0].mods);
  });

  it('ASCENDANT slot feeds corrFeed +1 even on a clean pass (non-ero phys slot)', () => {
    const s = raidState();
    const floor = makeFloor(['phys'], ['D']); // DC 6+1+1(ascendant)=8, not ero-gated
    floor.slots[0].attunement = TRAP_ATTUNEMENT.ASCENDANT;
    const hero = makeHero({ name: 'Passer', kinkKey: 'praise' }); // no phys mapping
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 19, margin 10 → easy

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('easy');
    expect(res.party[0].status).toBe('alive');
    expect(res.party[0].corrFeed).toBe(1);

    // Boundary: attunement 84 does not feed the loop.
    const below = makeFloor(['phys'], ['D']);
    below.slots[0].attunement = TRAP_ATTUNEMENT.ASCENDANT - 1;
    const spy2 = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const belowRes = resolveFloorEncounter(s, below, [makeHero({ name: 'Passer' })], 1);
    spy2.mockRestore();
    expect(belowRes.party[0].corrFeed).toBeUndefined();
  });

  it('ASCENDANT ero slot: both writers stack on a pass (ticket-26 ero-beat writer intact)', () => {
    const s = raidState();
    const floor = makeFloor(['lewd'], ['D']);
    floor.slots[0].attunement = TRAP_ATTUNEMENT.ASCENDANT;
    const hero = makeHero({ name: 'Soaked', kinkKey: 'praise' }); // lewd = ero + kink match
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const res = resolveFloorEncounter(s, floor, [hero], 1);
    spy.mockRestore();

    expect(res.audit[0].beat).toBe('easy');
    expect(res.party[0].corrFeed).toBe(2); // ero-beat + ascendant pass-through
  });

  it('spent lewd slot drops out of floorTypes (aroused penalty bypassed)', () => {
    const s = raidState();
    const cleanFloor = makeFloor(['lewd'], ['C']);
    const spentFloor = makeFloor(['lewd'], ['C']);
    spentFloor.slots[0].status = 'spent';
    const hero = () => makeHero({ aroused: true });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const clean = resolveFloorEncounter(s, cleanFloor, [hero()], 1);
    const spent = resolveFloorEncounter(s, spentFloor, [hero()], 1);
    spy.mockRestore();

    // Clean: −1 for the aroused flag itself, −1 for the floor's lewd aura.
    // Spent: the cut trap's aura is off — only the aroused flag remains.
    expect(spent.audit[0].mods).toBe(clean.audit[0].mods + 1);
  });

  it('highTrapIdx reads softened grades (brute bonus flips at the softening threshold)', () => {
    const s = raidState();
    const cleanFloor = makeFloor(['phys'], ['B', 'C']); // raw high = 3 → brute +0
    const wornFloor = makeFloor(['phys'], ['B', 'C']); // softened high = 2 → brute +2
    wornFloor.slots[0].wear = 60;
    const hero = () => makeHero({ traits: ['brute'] });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const clean = resolveFloorEncounter(s, cleanFloor, [hero()], 1);
    const worn = resolveFloorEncounter(s, wornFloor, [hero()], 1);
    spy.mockRestore();

    expect(worn.audit[0].mods).toBe(clean.audit[0].mods + 2);
  });

  it('attunedKink selection weight: max(kinkWeight, attunedWeight) — never ×2×2 stacking', () => {
    const hero = makeHero({ kinkKey: 'praise' }); // praise → lewd
    const floor = makeFloor(['lewd'], ['C', 'C', 'C', 'C']);
    floor.slots[0].attunedKink = 'praise'; // kink-matched AND attuned → 2 (would be 4 if multiplicative)
    floor.slots[1].attunedKink = 'tentacle'; // kink-matched, attuned elsewhere → max(2,1)=2
    floor.slots[2].types = ['phys'];
    floor.slots[2].attunedKink = 'praise'; // attuned-only (no kink type match) → max(1,2)=2
    floor.slots[3].types = ['phys']; // plain → 1
    expect(facedSlotWeights(hero, floor)).toEqual([2, 2, 2, 1]);
    expect(facedSlotWeights(hero, floor)).not.toContain(4);
    // KINK_TRAP_MAP sanity: praise genuinely maps to the lewd slots above.
    expect(KINK_TRAP_MAP.praise).toContain('lewd');
  });
});

describe('Ticket 30 — capture seed extension (faced-slot attunement)', () => {
  function captureState(slots: TrapSlot[], heroOver: Partial<Hero>): GameState {
    const s = createInitialGameState();
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...f, slots } : f));
    s.party = [
      makeHero({
        name: 'Capi',
        status: 'captured',
        fallenFloor: 1,
        fallenWave: 1,
        corrFeed: 0,
        ...heroOver,
      }),
    ];
    return s;
  }

  function capturedCorr(slots: TrapSlot[], heroOver: Partial<Hero>): number {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const settled = applyWaveSettlement(captureState(slots, heroOver), 'wipe');
    spy.mockRestore();
    const prisoner = settled.prisoners.find((p) => p.name === 'Capi');
    expect(prisoner).toBeDefined();
    return prisoner!.corr;
  }

  it('a faced slot attuned to TIER adds +10 to the capture seed', () => {
    const plain = [makeSlot({ types: ['lewd'] })];
    expect(capturedCorr(plain, { facedSlotIdx: 0 })).toBe(15); // 5 + matchedKink 10

    const attuned = [makeSlot({ types: ['lewd'], attunement: TRAP_ATTUNEMENT.TIER, attunedKink: 'praise' })];
    expect(capturedCorr(attuned, { facedSlotIdx: 0 })).toBe(25); // + attunement 10
  });

  it('the attunement term reads the SPECIFIC faced slot (plumbed facedSlotIdx)', () => {
    // Slot 0 is attuned but the capture beat was absorbed by plain slot 1.
    const slots = [
      makeSlot({ id: 'a', types: ['lewd'], attunement: TRAP_ATTUNEMENT.TIER, attunedKink: 'praise' }),
      makeSlot({ id: 'b', text: 'Plain Trap — a gimmick', types: ['lewd'] }),
    ];
    expect(capturedCorr(slots, { facedSlotIdx: 1 })).toBe(15);
    expect(capturedCorr(slots, { facedSlotIdx: 0 })).toBe(25);
    // Legacy captures carry no facedSlotIdx → no attunement term.
    expect(capturedCorr(slots, {})).toBe(15);
  });

  it('matchedKink broadens to facedSlot.attunedKink === hero.kinkKey', () => {
    // 'toys' has NO KINK_TRAP_MAP entry — only the attunement memory can match.
    expect(KINK_TRAP_MAP.toys).toBeUndefined();
    const slots = [
      makeSlot({ types: ['phys'], attunement: TRAP_ATTUNEMENT.TIER, attunedKink: 'toys' }),
    ];
    expect(capturedCorr(slots, { kinkKey: 'toys', facedSlotIdx: 0 })).toBe(25); // 5 + broadened 10 + attunement 10
    // Same kink against a slot attuned to someone else → no broadening.
    const other = [
      makeSlot({ types: ['phys'], attunement: TRAP_ATTUNEMENT.TIER, attunedKink: 'praise' }),
    ];
    expect(capturedCorr(other, { kinkKey: 'toys', facedSlotIdx: 0 })).toBe(15);
  });

  it('clamp 45 still holds even with corrFeed + matchedKink + attunement', () => {
    const slots = [
      makeSlot({ types: ['lewd'], attunement: TRAP_ATTUNEMENT.TIER, attunedKink: 'praise' }),
    ];
    // 5 + corrFeed 40 + matched 10 + attunement 10 = 65 → clamped 45.
    expect(capturedCorr(slots, { corrFeed: 5, facedSlotIdx: 0 })).toBe(45);
  });
});

describe('Ticket 30 — Repair All (day loop)', () => {
  function dayState(slots: TrapSlot[], over: Partial<GameState> = {}): GameState {
    const s = createInitialGameState();
    s.mode = 'estate';
    s.dayClosed = false;
    s.ap = 3;
    s.points = 100;
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...f, slots } : f));
    return { ...s, ...over };
  }

  it('AP/MP accounting exact: 1 AP + 3 MP × wornOrSpent; wear→0, spent/disarmed→armed', () => {
    const clean = makeSlot({ id: 'clean' });
    const slots = [
      makeSlot({ id: 'worn', wear: 60 }),
      makeSlot({ id: 'spent', status: 'spent', wear: 100 }),
      makeSlot({ id: 'cut', status: 'disarmed' }),
      clean,
    ];
    const res = repairAllTraps(dayState(slots));
    expect(res.ok).toBe(true);
    expect(getRepairAllCost(dayState(slots))).toEqual({ wornSlots: 3, mpCost: 9 });
    expect(res.state.ap).toBe(2);
    expect(res.state.points).toBe(91);
    expect(res.state.apUsed['repair_all']).toBe(true);
    const [worn, spent, cut, kept] = res.state.floors[0].slots;
    expect(worn.wear).toBe(0);
    expect(spent.status).toBe('armed');
    expect(spent.wear).toBe(0);
    expect(cut.status).toBe('armed');
    // Clean slots stay byte-identical (no ledger churn).
    expect(kept).toBe(clean);
    expect(res.state.dayLines.some((l) => l.text.includes('Repair All traps (3 worn/spent · -9 MP)'))).toBe(true);
  });

  it('no-op (zero cost) when nothing is worn', () => {
    const s = dayState([makeSlot(), makeSlot({ id: 't1', text: 'Second — g', wear: 0 })]);
    const res = repairAllTraps(s);
    expect(res.ok).toBe(false);
    expect(res.state.ap).toBe(3);
    expect(res.state.points).toBe(100);
    expect(res.state.floors).toBe(s.floors);
  });

  it('guards: not day phase, 0 AP, unaffordable MP, and once per day', () => {
    const slots = [makeSlot({ wear: 30 })];
    expect(repairAllTraps(dayState(slots, { mode: 'raid' })).ok).toBe(false);
    expect(repairAllTraps(dayState(slots, { ap: 0 })).ok).toBe(false);
    expect(repairAllTraps(dayState(slots, { points: 2 })).ok).toBe(false);
    const once = repairAllTraps(dayState(slots));
    expect(once.ok).toBe(true);
    expect(repairAllTraps(once.state).ok).toBe(false);
  });

  it('settlement decay still applies (ticket 29 free baseline untouched)', () => {
    const s = dayState([makeSlot({ wear: 40 })]);
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const settled = applyWaveSettlement(s, 'wipe');
    spy.mockRestore();
    expect(settled.floors[0].slots[0].wear).toBe(10); // 40 − SETTLE_DECAY(30)

    // A repaired slot stays at 0 through settlement.
    const repaired = repairAllTraps(dayState([makeSlot({ wear: 40 })]));
    expect(repaired.ok).toBe(true);
    const spy2 = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const settled2 = applyWaveSettlement(repaired.state, 'wipe');
    spy2.mockRestore();
    expect(settled2.floors[0].slots[0].wear).toBe(0);
    expect(settled2.floors[0].slots[0].status).toBe('armed');
  });
});

describe('Ticket 30 — prompt slot status word', () => {
  it('slotStatusWord: single word only when non-default, kink label for attuned', () => {
    expect(slotStatusWord({})).toBe('');
    expect(slotStatusWord({ wear: 0 })).toBe('');
    expect(slotStatusWord({ wear: 30 })).toBe('worn');
    expect(slotStatusWord({ status: 'spent', wear: 100 })).toBe('spent');
    expect(slotStatusWord({ status: 'disarmed' })).toBe('disarmed');
    expect(slotStatusWord({ attunement: 20 })).toBe('attuned');
    expect(slotStatusWord({ attunement: 85, attunedKink: 'bondage' })).toBe('attuned (bondage)');
    // ONE word: terminal state beats wear beats attunement; no raw ints anywhere.
    expect(slotStatusWord({ status: 'spent', wear: 100, attunement: 90, attunedKink: 'praise' })).toBe('spent');
    expect(slotStatusWord({ wear: 20, attunement: 50, attunedKink: 'rough' })).toBe('worn');
  });

  it('buildRaidMessages slot line shows the word only when non-default', () => {
    const s = createInitialGameState();
    s.floors = s.floors.map((f) =>
      f.floor === 1
        ? {
            ...f,
            slots: [
              makeSlot({ text: 'Gas Chamber — a gimmick', types: ['poison'], wear: 30 }),
              makeSlot({ id: 't1', text: 'Clean Floor Panel — a gimmick', types: [] }),
            ],
          }
        : f
    );
    const body = buildRaidMessages(s, 'pass', '1F', 'detail')[1].content;
    expect(body).toContain('#1 [C/poison] (worn) Gas Chamber');
    expect(body).toContain('#2 [C] Clean Floor Panel'); // clean: no diff at all
    expect(body).not.toContain('attuned');
    expect(body).not.toContain('spent');
  });
});

describe('Ticket 30 — prep-intel disarm', () => {
  function prepState(slots: TrapSlot[], partyIntel: number[] = [1, 1, 1]): GameState {
    const s = createInitialGameState();
    s.mode = 'prep';
    s.floors = s.floors.map((f) => (f.floor === 1 ? { ...f, slots } : f));
    s.prepMeta = { wave: 2, newTrapIds: [], comboFloors: [], gradedSummary: '', heroesReady: true };
    s.party = partyIntel.map((intel, i) =>
      makeHero({ slot: (i + 1) as 1 | 2 | 3, name: `H${i + 1}`, intel })
    );
    return s;
  }

  it('marks the highest-grade armed slot of the scouted floor disarmed', () => {
    const slots = [
      makeSlot({ id: 'low', grade: 'C', types: ['phys'] }),
      makeSlot({ id: 'high', grade: 'A', types: ['bind'] }),
    ];
    const res = prepIntelDisarm(prepState(slots));
    expect(res.ok).toBe(true);
    expect(res.state.floors[0].slots[0].status).toBeUndefined(); // untouched
    expect(res.state.floors[0].slots[1].status).toBe('disarmed');
    expect(res.state.prepMeta?.intelDisarmDone).toBe(true);
    expect(res.state.flash).toContain('cut');
  });

  it('skips spent slots and targets the highest ACTIVE grade', () => {
    const slots = [
      makeSlot({ id: 'a', grade: 'A', status: 'spent', wear: 100 }),
      makeSlot({ id: 'b', grade: 'C' }),
    ];
    const res = prepIntelDisarm(prepState(slots));
    expect(res.ok).toBe(true);
    expect(res.state.floors[0].slots[0].status).toBe('spent'); // untouched
    expect(res.state.floors[0].slots[1].status).toBe('disarmed');
  });

  it('consumes exactly ONE intel slot (one point off the first holder)', () => {
    const res = prepIntelDisarm(prepState([makeSlot({ grade: 'B' })], [2, 2, 0]));
    expect(res.ok).toBe(true);
    expect(res.state.party.map((h) => h.intel)).toEqual([1, 2, 0]);
  });

  it('once per prep; refused without intel, outside prep, or with nothing armed', () => {
    const slots = [makeSlot({ grade: 'B' })];
    const first = prepIntelDisarm(prepState(slots));
    expect(first.ok).toBe(true);
    expect(prepIntelDisarm(first.state).ok).toBe(false);

    expect(prepIntelDisarm(prepState(slots, [0, 0, 0])).ok).toBe(false);
    expect(prepIntelDisarm({ ...prepState(slots), mode: 'build' }).ok).toBe(false);
    expect(prepIntelDisarm(prepState([makeSlot({ grade: 'S', status: 'spent', wear: 100 })])).ok).toBe(false);
    const empty = prepState([]);
    expect(prepIntelDisarm(empty).ok).toBe(false);
  });
});
