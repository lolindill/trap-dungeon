import { describe, expect, it } from 'vitest';
import { CFG } from '../../data/constants';
import { CRISIS_CFG, EPIC_CFG } from '../../data/realmData';
import type { GameState, NemesisRecord } from '../../types/game';
import { generateParty, promoteHeroToEpic } from '../heroes';
import { installCustomTrap, removeTrapFromFloor } from '../dungeon';
import { applyWaveSettlement } from '../raid';
import { capNemesisRoster, computeHeroSituationAndMetaMods } from '../realm';
import { createInitialGameState } from '../saveLoad';
import { getTrapRefund } from '../trapRefund';

describe('balance patch: pinned constants', () => {
  it('pins the agreed numbers so accidental drift fails loudly', () => {
    expect([...CFG.INSTALL_COST]).toEqual([60, 110, 170, 240, 320]);
    expect(CFG.UPGRADE_COST).toEqual({ D: 60, C: 100, B: 160, A: 240, S: 380, SS: 520 });
    expect(CFG.DEATH_MARGIN).toBe(5);
    expect(CFG.GUILD.START).toBe(20);
    expect(CFG.GUILD.THREAT.slice(7)).toEqual([3, 4, 5, 6]);
    expect(CFG.HERO_PENALTY.EPIC).toBe(350);
    expect(CFG.FLOOR_DEFENSE).toEqual({ KNEE: 14, CAP: 24 });
    expect(CRISIS_CFG.WRATH_FROM).toBe(16);
    expect(EPIC_CFG.NEM_CAP).toBe(3);
  });
});

describe('balance patch: used-trap refund', () => {
  it('armed traps refund 50%, spent/disarmed traps refund 25%', () => {
    expect(getTrapRefund({ mpInvested: 100 })).toBe(50);
    expect(getTrapRefund({ mpInvested: 100, status: 'armed' })).toBe(50);
    expect(getTrapRefund({ mpInvested: 100, status: 'spent' })).toBe(25);
    expect(getTrapRefund({ mpInvested: 100, status: 'disarmed' })).toBe(25);
  });

  it('dismantle pays the reduced refund for a disarmed slot', () => {
    let state = { ...createInitialGameState(), points: 500 };
    state = installCustomTrap(state, 1, 'Spike wall').state;
    const before = state.points;
    const slot = state.floors[0].slots[0];
    state = {
      ...state,
      floors: state.floors.map((f, i) =>
        i === 0 ? { ...f, slots: [{ ...slot, status: 'disarmed' as const }] } : f
      ),
    };
    const res = removeTrapFromFloor(state, 1, 0);
    expect(res.state.points).toBe(before + Math.floor(slot.mpInvested * 0.25));
  });
});

const nem = (id: string, grade: NemesisRecord['grade'], wave: number): NemesisRecord => ({
  id,
  name: id,
  grade,
  classKey: 'knight',
  raceKey: 'human',
  gender: 'female',
  traits: [],
  signatures: [],
  adaptedTags: [],
  escapedWave: wave,
});

describe('balance patch: nemesis roster', () => {
  it('evicts the lowest-threat nemesis, not the oldest', () => {
    const roster = [nem('old-S', 'S', 1), nem('mid-A', 'A', 2), nem('new-B', 'B', 3), nem('new-A', 'A', 4)];
    const capped = capNemesisRoster(roster, 3);
    expect(capped.map((n) => n.id)).toEqual(['old-S', 'mid-A', 'new-A']);
  });

  it('ties evict the oldest', () => {
    const capped = capNemesisRoster([nem('a1', 'A', 1), nem('a2', 'A', 2), nem('a3', 'A', 3), nem('a4', 'A', 4)], 3);
    expect(capped.map((n) => n.id)).toEqual(['a2', 'a3', 'a4']);
  });

  const escapeOutcome = (outcome: 'retreat' | 'partial' | 'breach') => {
    const s = { ...createInitialGameState(), wave: CRISIS_CFG.WRATH_FROM, mode: 'raid' as const };
    const hero = { ...generateParty(s, s.wave).party[0], grade: 'A' as const, status: 'retreated' as const, epic: false };
    return applyWaveSettlement({ ...s, party: [hero] }, outcome).crises.nemesis.length;
  };

  it('retreat and breach can create a nemesis; partial cannot', () => {
    expect(escapeOutcome('retreat')).toBe(1);
    expect(escapeOutcome('breach')).toBe(1);
    expect(escapeOutcome('partial')).toBe(0);
  });
});

describe('balance patch: nemesis memory is gradual', () => {
  it('unchanged floor = +3, one changed trap keeps partial memory, a fully new floor = 0', () => {
    let s: GameState = { ...createInitialGameState(), points: 5000, wave: CRISIS_CFG.WRATH_FROM };
    for (const t of ['Fire pit', 'Net snare', 'Gas vent']) s = installCustomTrap(s, 1, t).state;
    s = {
      ...s,
      floors: s.floors.map((f) =>
        f.floor === 1 ? { ...f, slots: f.slots.map((sl) => ({ ...sl, grade: 'B' as const, types: ['fire'] })) } : f
      ),
    };
    const base = generateParty(s, s.wave).party[0];
    const rec = (sigSource: GameState) => {
      const hero = { ...base, grade: 'A' as const, status: 'alive' as const };
      const escaped = applyWaveSettlement({ ...sigSource, mode: 'raid', party: [{ ...hero, status: 'retreated' }] }, 'retreat');
      return escaped.crises.nemesis[0];
    };
    const record = rec(s);
    const nemHero = { ...promoteHeroToEpic(base, 'nemesis', record), status: 'alive' as const };
    const mod = (state: GameState) =>
      computeHeroSituationAndMetaMods(state, nemHero, state.floors[0], [nemHero], [nemHero]).nemesisMod;

    expect(mod(s)).toBe(3);

    const changedOne = {
      ...s,
      floors: s.floors.map((f) =>
        f.floor === 1 ? { ...f, slots: f.slots.map((sl, i) => (i === 0 ? { ...sl, text: 'Brand new trap' } : sl)) } : f
      ),
    };
    expect(mod(changedOne)).toBe(2);

    const allNew = {
      ...s,
      floors: s.floors.map((f) =>
        f.floor === 1 ? { ...f, slots: f.slots.map((sl, i) => ({ ...sl, text: `Totally new ${i}` })) } : f
      ),
    };
    expect(mod(allNew)).toBe(0);
  });
});
