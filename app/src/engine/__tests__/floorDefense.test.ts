import { describe, expect, it } from 'vitest';
import { CFG } from '../../data/constants';
import { getFloorDC } from '../dungeon';
import { floorDefense } from '../floorDefense';
import type { FloorState, SlotGrade, SynergyGrade, TrapSlot } from '../../types/game';

const slot = (grade: SlotGrade, extra: Partial<TrapSlot> = {}): TrapSlot => ({
  id: `t-${Math.random()}`,
  text: 'x',
  grade,
  types: [],
  mpInvested: 0,
  ...extra,
});

describe('floorDefense (shared knee formula)', () => {
  it('counts 1:1 up to the knee, then 1 DC per 2 points rounded down', () => {
    expect(floorDefense(0, 0, 0)).toBe(0);
    expect(floorDefense(14, 0, 0)).toBe(14);
    expect(floorDefense(15, 0, 0)).toBe(14);
    expect(floorDefense(16, 0, 0)).toBe(15);
    expect(floorDefense(20, 0, 0)).toBe(17); // 5A
    expect(floorDefense(25, 0, 0)).toBe(19); // 5S (19.5 rounded down)
  });

  it('adds synergy and ascendant AFTER the knee so a full floor does not swallow them', () => {
    expect(floorDefense(20, 2, 1)).toBe(20); // 5A + synergy A + ascendant
    expect(floorDefense(25, 3, 1)).toBe(23); // 5S + synergy S + ascendant
  });

  it('clamps to [0, CAP] and is always an integer', () => {
    expect(floorDefense(1, -1, 0)).toBe(0);
    expect(floorDefense(0, -1, 0)).toBe(0);
    expect(floorDefense(80, 9, 9)).toBe(CFG.FLOOR_DEFENSE.CAP);
    for (let x = 0; x <= 40; x++) expect(Number.isInteger(floorDefense(x, 1, 1))).toBe(true);
  });

  it('is monotonic in trapSum', () => {
    for (let x = 0; x < 40; x++) {
      expect(floorDefense(x + 1, 0, 0)).toBeGreaterThanOrEqual(floorDefense(x, 0, 0));
    }
  });
});

describe('getFloorDC uses the shared formula', () => {
  it('matches DC_BASE + depth + floorDefense for 500 random floors, including empty and spent/disarmed slots', () => {
    const grades: SlotGrade[] = ['?', 'D', 'C', 'B', 'A', 'S', 'SS'];
    const syns: SynergyGrade[] = ['?', '-', 'D', 'C', 'B', 'A', 'S'];
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 500; i++) {
      const n = Math.floor(rnd() * (CFG.SLOTS + 1));
      const slots = Array.from({ length: n }, () =>
        slot(grades[Math.floor(rnd() * grades.length)], {
          status: rnd() < 0.15 ? 'disarmed' : rnd() < 0.1 ? 'spent' : undefined,
        })
      );
      const floorNum = 1 + Math.floor(rnd() * CFG.FLOORS);
      const synergy = syns[Math.floor(rnd() * syns.length)];
      const floor: FloorState = { floor: floorNum, slots, synergy };

      const active = slots.filter((s) => s.grade !== '?' && s.status !== 'spent' && s.status !== 'disarmed');
      const trapSum = active.reduce((sum, s) => sum + CFG.TRAP_BONUS[s.grade as keyof typeof CFG.TRAP_BONUS], 0);
      const syn =
        active.length >= 2 && synergy !== '?' && synergy !== '-' ? CFG.SYNERGY_BONUS[synergy] : 0;
      const expected = CFG.DC_BASE + Math.floor((floorNum - 1) / 2) + floorDefense(trapSum, syn, 0);
      expect(getFloorDC(floor)).toBe(expected);
    }
  });
});
