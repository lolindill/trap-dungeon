import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPEDITION_AFTEREFFECT_MAP } from '../../data/expeditionData';
import { calcPrisonerRansom } from '../debt';
import { getFloorDC } from '../dungeon';
import { generateParty } from '../heroes';
import {
  normalizeActiveRaidMods,
  purgeConsumedRaidMods,
  RAID_DC_CAP_ALL_FLOORS,
  RAID_DC_CAP_FIRST_ROOM,
  RAID_DC_CAP_TOTAL_NEG,
  RAID_DC_CAP_TOTAL_POS,
  resolveRaidModifiers,
  type RaidModsCtx,
} from '../raidMods';
import { advanceRaidStep, applyWaveSettlement, resolveFloorEncounter } from '../raid';
import { createInitialGameState } from '../saveLoad';
import { finishBuildPhase } from '../workflow';
import type { GameState, Prisoner } from '../../types/game';

function freshState(): GameState {
  return createInitialGameState();
}

function withMods(state: GameState, mods: { key: string; value: number }[]): GameState {
  state.crises.activeRaidMods = [...state.crises.activeRaidMods, ...mods];
  return state;
}

function makePrisoner(over: Partial<Prisoner> = {}): Prisoner {
  return {
    pid: 1,
    name: 'Test Hero',
    grade: 'C',
    raceLabel: 'human',
    classLabel: 'adventurer',
    traits: [],
    capturedWave: 1,
    capturedFloor: 1,
    resist: 30,
    corr: 0,
    gender: 'female',
    stamina: 100,
    staminaMax: 100,
    pleasure: 0,
    terror: 0,
    shame: 0,
    marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
    cond: '',
    job: null,
    converted: null,
    assignedFloor: null,
    owner: null,
    afflictions: [],
    breeding: null,
    ...over,
  };
}

const CTX: RaidModsCtx = { floorNum: 1, isFirstRoom: true, hasMonsterOnFloor: false };

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('raidMods seam — council caps', () => {
  it('exports the locked council caps', () => {
    expect(RAID_DC_CAP_FIRST_ROOM).toBe(3);
    expect(RAID_DC_CAP_ALL_FLOORS).toBe(2);
    expect(RAID_DC_CAP_TOTAL_POS).toBe(4);
    expect(RAID_DC_CAP_TOTAL_NEG).toBe(-4);
  });

  it('returns all-zero deltas for a neutral fresh state (except baseline core capture)', () => {
    const r = resolveRaidModifiers(freshState(), CTX);
    expect(r.firstRoomDcDelta).toBe(0);
    expect(r.allFloorsDcDelta).toBe(0);
    expect(r.floorDcDelta).toBe(0);
    expect(r.totalDcDelta).toBe(0);
    expect(r.heroModDelta).toBe(0);
    expect(r.prepIntelDelta).toBe(0);
    expect(r.prepIntelZero).toBe(false);
    expect(r.critRoomSaveChance).toBe(0);
    expect(r.ransomBonusMult).toBe(1.0);
    // default town order is 60 -> estate core capture baseline applies
    expect(r.coreCaptureBonus).toBeCloseTo(0.05, 5);
  });

  it('clamps firstRoom bucket to +3 and reports the cap in notes', () => {
    const s = freshState();
    s.town.approval = 65; // estate +1
    s.estate.facilities.grail = 1; // estate +1
    s.officers.lilim.aff = 120; // min(2, 3) = +2
    s.officers.lilim.stage = 3; // +1
    s.estate.perks.firstDcOnce = true; // +1
    withMods(s, [{ key: 'first_dc', value: 2 }]); // +2 -> raw 8

    const r = resolveRaidModifiers(s, CTX);
    expect(r.firstRoomDcDelta).toBe(3);
    expect(r.totalDcDelta).toBe(3);
    expect(r.notes).toContain('capped: firstRoom clamped to +3');
    expect(r.notes).toContain('estate:firstRoom +2');
    expect(r.notes).toContain('lilim:firstRoom +4');
    expect(r.notes).toContain('activeRaidMods:first_dc +2 (first room only)');
  });

  it('clamps allFloors bucket to +2', () => {
    const s = freshState();
    s.estate.facilities.workshop = 3; // estate +1
    s.estate.perks.allDcNext = true; // lilim +1
    const r = resolveRaidModifiers(s, CTX);
    expect(r.allFloorsDcDelta).toBe(2);
    expect(r.totalDcDelta).toBe(2);
    expect(r.notes).toContain('estate:allFloors +1');
    expect(r.notes).toContain('lilim:allFloors +1');
  });

  it('enforces the total +4 raid cap across firstRoom + allFloors buckets', () => {
    const s = freshState();
    s.town.approval = 65;
    s.estate.facilities.grail = 1;
    s.officers.lilim.aff = 120;
    s.officers.lilim.stage = 3;
    s.estate.perks.firstDcOnce = true;
    s.estate.facilities.workshop = 3;
    s.estate.perks.allDcNext = true;
    // firstRoom raw = 1+1+3+1 = 6 -> clamped 3; allFloors = 1+1 = 2; total 5 -> cap 4
    const r = resolveRaidModifiers(s, CTX);
    expect(r.firstRoomDcDelta).toBe(2); // shed 1 from firstRoom
    expect(r.allFloorsDcDelta).toBe(2);
    expect(r.totalDcDelta).toBe(4);
    expect(r.notes).toContain('capped: total DC clamped to +4');
  });

  it('enforces the total -4 raid cap with leaked floors, trap_off and famine', () => {
    let s = freshState();
    s.town.food = 15; // estate allFloors -1
    s.town.approval = 15; // leakedFloors = 2
    s = installTrapAt(s, 0, 'D');
    s = installTrapAt(s, 1, 'D');
    withMods(s, [{ key: 'trap_off', value: 1 }]);

    // Floor 1 is the lowest-DC occupied floor (tie-break by floor number)
    const r1 = resolveRaidModifiers(s, { ...CTX, floorNum: 1, isFirstRoom: false });
    expect(r1.floorDcDelta).toBe(-3); // -2 leak -2 trap_off +1 restored by cap
    expect(r1.totalDcDelta).toBe(-4); // (-4) + (-1) clamped to -4
    expect(r1.notes).toContain('capped: total DC clamped to -4');

    // Floor 2 is the second lowest: -2 leak only, no cap needed
    const r2 = resolveRaidModifiers(s, { ...CTX, floorNum: 2, isFirstRoom: false });
    expect(r2.floorDcDelta).toBe(-2);
    expect(r2.totalDcDelta).toBe(-3);
    expect(r2.notes).not.toContain('capped: total DC clamped to -4');
  });

  it('clamps firstRoom negative crisis mods to -4', () => {
    const s = withMods(freshState(), [{ key: 'first_dc', value: -9 }]);
    const r = resolveRaidModifiers(s, CTX);
    expect(r.firstRoomDcDelta).toBe(-4);
    expect(r.totalDcDelta).toBe(-4);
    expect(r.notes).toContain('capped: firstRoom clamped to -4');
  });
});

describe('raidMods seam — ctx-specific floorDcDelta', () => {
  it('applies trap_off only to the lowest-DC trap room', () => {
    let s = freshState();
    s = installTrapAt(s, 0, 'D'); // power: 6 + 0 + 1 = 7
    s = installTrapAt(s, 2, 'C'); // power: 6 + 0 + 2 = 8
    withMods(s, [{ key: 'trap_off', value: 1 }]);

    const rLow = resolveRaidModifiers(s, { ...CTX, floorNum: 1, isFirstRoom: false });
    const rHigh = resolveRaidModifiers(s, { ...CTX, floorNum: 3, isFirstRoom: false });
    expect(rLow.floorDcDelta).toBe(-2);
    expect(rLow.notes).toContain('activeRaidMods:trap_off -2 (1F)');
    expect(rHigh.floorDcDelta).toBe(0);
    expect(rLow.totalDcDelta).toBe(-2);
    expect(rHigh.totalDcDelta).toBe(0);
  });

  it('applies leakedFloors to the lowest-DC occupied floors only (approval tiers)', () => {
    let s = freshState();
    s.town.approval = 30; // 1 leaked floor
    s = installTrapAt(s, 0, 'D');
    s = installTrapAt(s, 2, 'C');
    const rLow = resolveRaidModifiers(s, { ...CTX, floorNum: 1, isFirstRoom: false });
    const rHigh = resolveRaidModifiers(s, { ...CTX, floorNum: 3, isFirstRoom: false });
    expect(rLow.floorDcDelta).toBe(-2);
    expect(rLow.notes).toContain('estate:leakedFloors -2 (1F)');
    expect(rHigh.floorDcDelta).toBe(0);
  });

  it('applies guardDcBonus only on guarded floors (food >= 60)', () => {
    const s = freshState();
    s.town.food = 70;
    const guarded = resolveRaidModifiers(s, { ...CTX, hasMonsterOnFloor: true });
    const unguarded = resolveRaidModifiers(s, { ...CTX, hasMonsterOnFloor: false });
    expect(guarded.floorDcDelta).toBe(1);
    expect(guarded.notes).toContain('estate:guardDc +1 (guarded floor)');
    expect(unguarded.floorDcDelta).toBe(0);
  });

  it('gates firstRoom bucket by ctx.isFirstRoom in totalDcDelta', () => {
    const s = withMods(freshState(), [{ key: 'first_dc', value: 2 }]);
    const first = resolveRaidModifiers(s, { ...CTX, isFirstRoom: true });
    const later = resolveRaidModifiers(s, { ...CTX, isFirstRoom: false });
    expect(first.totalDcDelta).toBe(2);
    expect(later.totalDcDelta).toBe(0);
  });
});

describe('raidMods seam — heroModDelta (expedition aftereffects + mole)', () => {
  it('merges expedition aftereffects with their scopes', () => {
    const s = freshState();
    s.expedition.afterEffects = [{ key: 'scout', wavesLeft: 1 }];
    const rF1 = resolveRaidModifiers(s, { ...CTX, floorNum: 1 });
    const rF5 = resolveRaidModifiers(s, { ...CTX, floorNum: 5 });
    expect(rF1.heroModDelta).toBe(EXPEDITION_AFTEREFFECT_MAP.scout.heroMod);
    expect(rF1.notes.some((n) => n.startsWith('expedition:'))).toBe(true);
    expect(rF5.heroModDelta).toBe(0);

    const s2 = freshState();
    s2.expedition.afterEffects = [{ key: 'desecrate', wavesLeft: 2 }];
    const rCleric = resolveRaidModifiers(s2, { ...CTX, heroClassKey: 'cleric' });
    const rKnight = resolveRaidModifiers(s2, { ...CTX, heroClassKey: 'knight' });
    expect(rCleric.heroModDelta).toBe(EXPEDITION_AFTEREFFECT_MAP.desecrate.heroMod);
    expect(rKnight.heroModDelta).toBe(0);

    const s3 = freshState();
    s3.expedition.afterEffects = [{ key: 'hunter', wavesLeft: 2 }];
    const rHunter = resolveRaidModifiers(s3, { ...CTX, hasMonsterOnFloor: true });
    const rNoGuard = resolveRaidModifiers(s3, { ...CTX, hasMonsterOnFloor: false });
    expect(rHunter.heroModDelta).toBe(EXPEDITION_AFTEREFFECT_MAP.hunter.heroMod);
    expect(rNoGuard.heroModDelta).toBe(0);
  });

  it('clamps combined expedition aftereffects to ±2', () => {
    const s = freshState();
    s.expedition.afterEffects = [
      { key: 'supply', wavesLeft: 2 },
      { key: 'supply', wavesLeft: 2 },
      { key: 'scout', wavesLeft: 1 },
    ];
    const r = resolveRaidModifiers(s, { ...CTX, floorNum: 1 });
    expect(r.heroModDelta).toBe(-2); // raw -3 clamped inside resolveExpeditionAftereffects
  });

  it('applies mole intel -2 when an active mole exists', () => {
    const s = freshState();
    s.prisoners = [makePrisoner({ moleRaidsLeft: 2 })];
    const r = resolveRaidModifiers(s, CTX);
    expect(r.heroModDelta).toBe(-2);
    expect(r.notes).toContain('moleIntel: hero mods -2');

    const rSpent = resolveRaidModifiers(
      { ...s, prisoners: [makePrisoner({ moleRaidsLeft: 0 })] },
      CTX
    );
    expect(rSpent.heroModDelta).toBe(0);
  });

  it('stacks expedition aftereffects with mole intel', () => {
    const s = freshState();
    s.expedition.afterEffects = [{ key: 'revenge', wavesLeft: 2 }]; // heroes +1
    s.prisoners = [makePrisoner({ moleRaidsLeft: 1 })]; // heroes -2
    const r = resolveRaidModifiers(s, CTX);
    expect(r.heroModDelta).toBe(-1);
  });
});

describe('raidMods seam — prep intel, core capture, ransom', () => {
  it('merges estate prep intel with crisis intel and intel_zero override', () => {
    const s = freshState();
    s.town.approval = 80; // estate +1
    withMods(s, [{ key: 'intel', value: 2 }]);
    const r = resolveRaidModifiers(s, CTX);
    expect(r.prepIntelDelta).toBe(3);
    expect(r.prepIntelZero).toBe(false);
    expect(r.notes).toContain('estate:prepIntel +1');
    expect(r.notes).toContain('activeRaidMods:intel +2');

    const sZero = withMods(freshState(), [
      { key: 'intel', value: 2 },
      { key: 'intel_zero', value: 1 },
    ]);
    const rZero = resolveRaidModifiers(sZero, CTX);
    expect(rZero.prepIntelDelta).toBe(0);
    expect(rZero.prepIntelZero).toBe(true);
    expect(rZero.notes).toContain('activeRaidMods:intel_zero → prep intel 0');
  });

  it('sums core capture bonus from estate and core_guard crisis mods', () => {
    const s = freshState();
    s.town.order = 85; // +0.1
    s.estate.facilities.watch = 3; // +0.1
    withMods(s, [{ key: 'core_guard', value: 0.2 }]);
    const r = resolveRaidModifiers(s, CTX);
    expect(r.coreCaptureBonus).toBeCloseTo(0.4, 5);
    expect(r.notes).toContain('activeRaidMods:core_guard +0.2');
  });

  it('exposes ransomBonusMult and calcPrisonerRansom consumes it', () => {
    const sLow = freshState(); // renown 20 -> 1.0
    const sMid = freshState();
    sMid.town.renown = 65; // 1.1
    const sHigh = freshState();
    sHigh.town.renown = 85; // 1.15
    expect(resolveRaidModifiers(sLow, CTX).ransomBonusMult).toBe(1.0);
    expect(resolveRaidModifiers(sMid, CTX).ransomBonusMult).toBeCloseTo(1.1, 5);
    expect(resolveRaidModifiers(sHigh, CTX).ransomBonusMult).toBeCloseTo(1.15, 5);

    const p = makePrisoner({ grade: 'C' }); // RANSOM.C = 28, no other multipliers
    expect(calcPrisonerRansom(sLow, p, true)).toBe(28);
    expect(calcPrisonerRansom(sLow, p, true, 1.15)).toBe(Math.round(28 * 1.15));
    // default path stays renown-driven; explicit param overrides it 1:1
    expect(calcPrisonerRansom(sHigh, p, true)).toBe(calcPrisonerRansom(sLow, p, true, 1.15));
    expect(calcPrisonerRansom(sMid, p, true)).toBe(Math.round(28 * 1.1));
  });
});

describe('raidMods seam — consumption sites', () => {
  it('getFloorDC adds the resolver total (allFloors) and gates first room by raid mode', () => {
    let s = installTrapAt(freshState(), 0, 'D');
    const base = getFloorDC(s.floors[0]);
    expect(getFloorDC(s.floors[0], s)).toBe(base); // neutral state -> no delta

    s.estate.facilities.workshop = 3;
    s.estate.perks.allDcNext = true;
    expect(getFloorDC(s.floors[0], s)).toBe(base + 2);

    // first-room bucket only applies while actually raiding the first room
    s.town.approval = 65;
    s.mode = 'raid';
    s.raidFirstRoom = true;
    expect(getFloorDC(s.floors[0], s)).toBe(base + 3);
    s.raidFirstRoom = false;
    expect(getFloorDC(s.floors[0], s)).toBe(base + 2);

    // empty floors keep the unmodded base DC (early return preserved)
    expect(getFloorDC(s.floors[3], s)).toBe(getFloorDC(s.floors[3]));
  });

  it('finishBuildPhase consumes prep intel (estate + crisis intel, intel_zero override)', () => {
    let s = withMods(freshState(), [{ key: 'intel', value: 2 }]);
    s.town.approval = 80;
    s.points = 500;
    s = finishBuildPhase(s);
    expect(s.party).toHaveLength(3);
    expect(s.party.every((h) => h.intel === 3)).toBe(true);

    let sZero = withMods(freshState(), [
      { key: 'intel', value: 2 },
      { key: 'intel_zero', value: 1 },
    ]);
    sZero.relics.owned.push('lens'); // lens +1 is also overridden by intel_zero
    sZero.points = 500;
    sZero = finishBuildPhase(sZero);
    expect(sZero.party.every((h) => h.intel === 0)).toBe(true);

    let sLens = freshState();
    sLens.relics.owned.push('lens');
    sLens.points = 500;
    sLens = finishBuildPhase(sLens);
    expect(sLens.party.every((h) => h.intel === 1)).toBe(true);
  });

  it('generateParty consumes hero_up / hero_down / hero_injured (party-gen, not the seam)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const mk = () => {
      const s = freshState();
      s.crises.crusade = { active: true, wavesLeft: 5, cooldown: 0 };
      return s;
    };

    // Baseline (crusade + rng 0.99): SSS leader + two SS escorts
    const base = generateParty(mk(), 5);
    expect(base.party.map((h) => h.grade)).toEqual(['SSS', 'SS', 'SS']);

    const down = generateParty(withMods(mk(), [{ key: 'hero_down', value: 1 }]), 5);
    expect(down.party.map((h) => h.grade)).toEqual(['SS', 'SS', 'SS']);

    const up = generateParty(withMods(mk(), [{ key: 'hero_up', value: 1 }]), 5);
    expect(up.party.map((h) => h.grade)).toEqual(['SSS', 'SS', 'SS']); // capped at SSS, never EPIC

    const injured = generateParty(withMods(mk(), [{ key: 'hero_injured', value: 1 }]), 5);
    expect(injured.party.filter((h) => h.cond === 'injured')).toHaveLength(1);
    expect(injured.party[0].grade).toBe('SSS'); // the top-grade hero is the one injured
  });

  it('advanceRaidStep core capture converts breachers at the Core (council seam)', () => {
    const mk = () => {
      const s = freshState();
      s.mode = 'raid';
      s.party = generateParty(s, 1).party.map((h) => ({ ...h, status: 'alive' as const }));
      return s;
    };

    // Roll succeeds -> every breacher is captured -> raid downgrades to wipe
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const captured = advanceRaidStep(mk());
    expect(captured.outcome).toBe('wipe');
    expect(captured.state.party.every((h) => h.status === 'captured')).toBe(true);
    expect(captured.detailText).toContain('CAPTURED by the core guard');
    expect(captured.state.prisoners.length).toBe(3);

    // Roll fails -> plain breach, behavior unchanged
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const breached = advanceRaidStep(mk());
    expect(breached.outcome).toBe('breach');
    expect(breached.state.party.every((h) => h.status === 'alive')).toBe(true);
  });

  it('resolveFloorEncounter reports seam audit notes and keeps dc consistent with getFloorDC', () => {
    let s = installTrapAt(freshState(), 0, 'D');
    s.mode = 'raid';
    s.raidFirstRoom = true;
    s.town.approval = 65;
    s.expedition.afterEffects = [{ key: 'supply', wavesLeft: 2 }];
    const party = generateParty(s, 1).party.map((h) => ({ ...h, status: 'alive' as const }));
    s.party = party;

    const res = resolveFloorEncounter(s, s.floors[0], party, 1);
    expect(res.dc).toBe(getFloorDC(s.floors[0], s));
    const joined = res.detailLines.join('\n');
    expect(joined).toContain('estate:firstRoom +1');
    expect(joined).toContain('expedition:');
  });
});

// Ticket 16: one-shot raid-mod lifecycle (settlement resolution point)
describe('Ticket 16: purge/normalize raid-mod helpers', () => {
  it('purgeConsumedRaidMods removes every consumed key and normalizes duplicates', () => {
    const mods = [
      { key: 'first_dc', value: 1 },
      { key: 'trap_off', value: 2 },
      { key: 'core_guard', value: 1 },
      { key: 'hero_up', value: 1 },
      { key: 'hero_down', value: 1 },
      { key: 'hero_injured', value: 1 },
      { key: 'intel', value: 2 },
      { key: 'intel_zero', value: 1 },
    ];
    expect(purgeConsumedRaidMods(mods)).toEqual([]);
  });

  it('normalizeActiveRaidMods keeps distinct same-key values (resolver sums) and drops exact duplicates', () => {
    expect(
      normalizeActiveRaidMods([
        { key: 'first_dc', value: 1 },
        { key: 'first_dc', value: 2 },
        { key: 'first_dc', value: 1 },
        { key: 'intel', value: 2 },
        { key: 'intel', value: 2 },
      ])
    ).toEqual([
      { key: 'first_dc', value: 1 },
      { key: 'first_dc', value: 2 },
      { key: 'intel', value: 2 },
    ]);
  });

  it('settled raids expire the seam: resolveRaidModifiers no longer sees purged mods', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let s = freshState();
    s.wave = 3;
    s = withMods(s, [
      { key: 'first_dc', value: 1 },
      { key: 'first_dc', value: 1 },
      { key: 'intel', value: 2 },
      { key: 'hero_up', value: 1 },
    ]);
    expect(resolveRaidModifiers(s, CTX).prepIntelDelta).toBe(2);

    const settled = applyWaveSettlement(s, 'wipe');
    expect(settled.crises.activeRaidMods).toEqual([]);
    const after = resolveRaidModifiers(settled, CTX);
    expect(after.prepIntelDelta).toBe(0);
    expect(after.firstRoomDcDelta).toBe(0);
    expect(after.heroModDelta).toBe(0);
  });
});

// Ticket 18: Lilim officer-side prep intel now enters through the resolver.
describe('raidMods seam — ticket 18 Lilim prep intel source', () => {
  it('adds Lilim stage-2 / prepIntelOnce prep intel inside the resolver (DC untouched)', () => {
    const s = freshState();
    s.officers.lilim.stage = 2; // +1 prep intel
    const r = resolveRaidModifiers(s, CTX);
    expect(r.prepIntelDelta).toBe(1);
    expect(r.notes).toContain('lilim:prepIntel +1');
    // The intel leak is NOT a DC source.
    expect(r.totalDcDelta).toBe(0);

    const withPerk = freshState();
    withPerk.officers.lilim.stage = 2;
    withPerk.estate.perks.prepIntelOnce = true; // +1
    expect(resolveRaidModifiers(withPerk, CTX).prepIntelDelta).toBe(2);

    // Stage < 2 without the perk contributes nothing (unchanged neutral path).
    const neutral = freshState();
    neutral.officers.lilim.stage = 1;
    expect(resolveRaidModifiers(neutral, CTX).prepIntelDelta).toBe(0);
  });

  it('merges Lilim intel with estate + crisis intel and gates everything behind intel_zero', () => {
    const s = freshState();
    s.officers.lilim.stage = 2; // lilim +1
    s.town.approval = 80; // estate +1
    withMods(s, [{ key: 'intel', value: 2 }]);
    const r = resolveRaidModifiers(s, CTX);
    expect(r.prepIntelDelta).toBe(4);
    expect(r.notes).toContain('lilim:prepIntel +1');

    const sZero = freshState();
    sZero.officers.lilim.stage = 2;
    sZero.relics.owned.push('lens');
    withMods(sZero, [{ key: 'intel_zero', value: 1 }]);
    const rZero = resolveRaidModifiers(sZero, CTX);
    expect(rZero.prepIntelZero).toBe(true);
    expect(rZero.prepIntelDelta).toBe(0);
  });

  it('raises party intel at the workflow prep site via the Lilim leak (Lens pattern)', () => {
    let s = freshState();
    s.officers.lilim.stage = 2;
    s.points = 500;
    s = finishBuildPhase(s);
    expect(s.party).toHaveLength(3);
    expect(s.party.every((h) => h.intel === 1)).toBe(true);
  });
});
