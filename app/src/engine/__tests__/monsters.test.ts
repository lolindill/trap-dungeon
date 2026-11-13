import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MONSTER_CFG,
  MONSTER_LINEAGES,
  MONSTER_OCC_ACT,
  getMonsterDescription,
  getMonsterDisplayName,
} from '../../data/monsterData';
import {
  assignMonsterToFloor,
  assignPrisonerFighterToFloor,
  getFloorCombatBonus,
  getFloorDC,
  getFloorLinks,
  removeTrapFromFloor,
  toggleFloorLabBuff,
} from '../dungeon';
import {
  absorbMonster,
  applyUpkeepCycle,
  breedMonster,
  calcMonsterUpkeep,
  createMonsterEgg,
  createMonsterInstance,
  disposeMonster,
  evolveMonster,
  feedMonster,
  getMonsterPenCap,
  getMonsterSellPrice,
  hatchMonsterEggs,
  isMonsterHurt,
  isUpkeepActive,
  processMonsterNightlyCycle,
  processPrisonerBreedingBirths,
  resolveMonsterOvercrowding,
} from '../monsters';
import { advanceRaidStep, resolveFloorEncounter } from '../raid';
import { createInitialGameState } from '../saveLoad';
import type { GameState, Hero, MonsterInstance, Prisoner } from '../../types/game';

afterEach(() => {
  vi.restoreAllMocks();
});

function makePrisoner(overrides: Partial<Prisoner> = {}): Prisoner {
  return {
    pid: 101,
    name: 'Test Captive',
    grade: 'B',
    raceLabel: 'Human',
    classLabel: 'Knight',
    traits: ['fierce'],
    capturedWave: 1,
    capturedFloor: 1,
    resist: 30,
    corr: 20,
    gender: 'female',
    stamina: 90,
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
    ...overrides,
  };
}

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    slot: 1,
    grade: 'C',
    status: 'alive',
    gender: 'female',
    classKey: 'knight',
    classLabel: 'Knight',
    raceKey: 'human',
    raceLabel: 'Human',
    traits: [],
    kinkKey: 'bondage',
    kinkDesc: 'Bondage',
    age: '22',
    body: 'Athletic',
    looks: 'Sharp',
    appearance: 'Silver armor',
    outfit: 'Steel Plate',
    personalityText: 'Calm and resolute',
    skill: 'Shield Bash',
    weakness: 'Overprotective',
    kinkText: 'Rope restraint',
    persona: 'Stoic',
    origin: 'Border Guard',
    exp: 'virgin',
    marital: 'single',
    intel: 0,
    name: 'Alden',
    cond: '',
    ailment: 0,
    aroused: false,
    usedLuck: false,
    injIgnored: false,
    lastRollText: '',
    ...overrides,
  };
}

function makeMob(
  id: string,
  lineage: string,
  opts?: Partial<MonsterInstance>
): MonsterInstance {
  return {
    ...createMonsterInstance(lineage, {
      stars: opts?.stars,
      xp: opts?.xp,
      variantOf: opts?.variantOf,
    }),
    id,
    ...opts,
  };
}

function makeDayState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    mode: 'estate',
    wave: 6,
    ap: 5,
    apMax: 5,
    points: 1000,
    estate: {
      ...base.estate,
      facilities: {
        ...base.estate.facilities,
        beastpen: 1,
      },
    },
    ...overrides,
  };
}

describe('monsterData catalog', () => {
  it('defines all 28 lineages with 84 ★1-★3 forms and OCC_ACT descriptions', () => {
    expect(MONSTER_LINEAGES).toHaveLength(28);
    const totalForms = MONSTER_LINEAGES.reduce((sum, l) => sum + l.names.length, 0);
    expect(totalForms).toBe(84);

    const keys = new Set(MONSTER_LINEAGES.map((l) => l.key));
    expect(keys.size).toBe(28);

    const maleBreeders = MONSTER_LINEAGES.filter((l) => l.canBreedMale).map((l) => l.key);
    expect(maleBreeders).toEqual(expect.arrayContaining(['harpy', 'lamia', 'siren', 'demon']));

    for (const l of MONSTER_LINEAGES) {
      expect(l.names).toHaveLength(3);
      expect(l.descriptions).toHaveLength(3);
      expect(MONSTER_OCC_ACT[l.roleTag]).toBeTruthy();
    }
  });
});

describe('Monster Pen management actions', () => {
  it('feeds a captive (1 AP) and evolves ★1 -> ★2 on 2nd feed', () => {
    const mon = makeMob('m1', 'slime', { stars: 1, xp: 0, fed: 0 });
    const p1 = makePrisoner({ pid: 1, name: 'Iris' });
    const p2 = makePrisoner({ pid: 2, name: 'Elena' });
    const state = makeDayState({ monsters: [mon], prisoners: [p1, p2], ap: 2 });

    const r1 = feedMonster(state, 'm1', 1);
    expect(r1.ok).toBe(true);
    expect(r1.state.ap).toBe(1);
    expect(r1.state.prisoners).toHaveLength(1);
    expect(r1.state.monsters[0].fed).toBe(1);
    expect(r1.state.monsters[0].stars).toBe(1);
    expect(r1.state.dayLines.some((l) => l.kind === 'monster')).toBe(true);

    // Next day resets per-monster daily AP key so m1 can be fed a 2nd time
    const nextDay = { ...r1.state, ap: 1, apUsed: {} };
    const r2 = feedMonster(nextDay, 'm1', 2);
    expect(r2.ok).toBe(true);
    expect(r2.state.ap).toBe(0);
    expect(r2.state.prisoners).toHaveLength(0);
    expect(r2.state.monsters[0].stars).toBe(2);
    expect(getMonsterDisplayName(r2.state.monsters[0])).toBe('🫧 Slime Colony ★2');
    expect(getMonsterDescription(r2.state.monsters[0])).toBeTruthy();
  });

  it('absorbs an undeployed monster (1 AP) transferring floor(xp/2)+2 and triggering ★2 evolution', () => {
    const host = makeMob('m1', 'goblin', { stars: 1, xp: 4 });
    const fodder = makeMob('m2', 'kobold', { stars: 1, xp: 8 });
    const deployed = makeMob('m3', 'orc', { stars: 1, xp: 2, deployedFloor: 1 });

    let state = makeDayState({ monsters: [host, fodder, deployed], ap: 2 });
    state = {
      ...state,
      floors: state.floors.map((f) =>
        f.floor === 1
          ? {
              ...f,
              slots: [{ id: 't1', text: 'Spike Pit', grade: 'C', types: ['phys'], mpInvested: 15 }],
              combatSlots: [{ kind: 'monster', monsterId: 'm3' }],
            }
          : f
      ),
    };

    const failDeployed = absorbMonster(state, 'm1', 'm3');
    expect(failDeployed.ok).toBe(false);

    const okAbsorb = absorbMonster(state, 'm1', 'm2');
    expect(okAbsorb.ok).toBe(true);
    expect(okAbsorb.state.ap).toBe(1);
    expect(okAbsorb.state.monsters.map((m) => m.id)).toEqual(['m1', 'm3']);
    // 4 + floor(8/2) + 2 = 10 XP >= 10 -> evolves to ★2
    expect(okAbsorb.state.monsters[0].xp).toBe(10);
    expect(okAbsorb.state.monsters[0].stars).toBe(2);
  });

  it('handles mevo_ Force Evolution (0 AP, >=80% XP, 50*stars MP, 15% fatal -> +1 Trap Parts)', () => {
    const mon = makeMob('m1', 'mimic', { stars: 2, xp: 20 }); // 80% of 25
    const state = makeDayState({ monsters: [mon], points: 200, ap: 0 });

    const failLowXp = evolveMonster(
      { ...state, monsters: [{ ...mon, xp: 19 }] },
      'm1',
      () => 0.5
    );
    expect(failLowXp.ok).toBe(false);

    // Fatal 15% roll (< 0.15)
    const fatal = evolveMonster(state, 'm1', () => 0.05);
    expect(fatal.ok).toBe(true);
    expect(fatal.state.points).toBe(100);
    expect(fatal.state.monsters).toHaveLength(0);
    expect(fatal.state.expedition.lootParts).toBe(1);

    // Success roll (>= 0.15)
    const success = evolveMonster(state, 'm1', () => 0.5);
    expect(success.ok).toBe(true);
    expect(success.state.points).toBe(100);
    expect(success.state.monsters[0].stars).toBe(3);
  });

  it('supports prisoner female/male breeding, cross-species 15% Variant bloodline & max 2/wave cap', () => {
    const m1 = makeMob('m1', 'harpy', { stars: 2 });
    const m2 = makeMob('m2', 'slime', { stars: 2 });
    const fem = makePrisoner({ pid: 10, name: 'Seraphina', grade: 'S', resist: 20, gender: 'female' });
    const maleP = makePrisoner({ pid: 11, name: 'Garrick', grade: 'B', resist: 10, gender: 'male' });
    const state = makeDayState({ monsters: [m1, m2], prisoners: [fem, maleP], ap: 5, wave: 6 });

    // Female breeding succeeds -> pregnant due wave 8, inherits S+ trait
    const rFem = breedMonster(state, 'm1', { kind: 'prisoner', pid: 10 }, () => 0.0);
    expect(rFem.ok).toBe(true);
    expect(rFem.state.prisoners[0].breeding?.dueWave).toBe(8);
    expect(rFem.state.prisoners[0].breeding?.trait).toBe('fierce');
    expect(rFem.state.monsters[0].tiredUntilWave).toBe(7);

    // Male prisoner breeding with harpy (canBreedMale = true) -> immediate egg due W7
    const readyState: GameState = {
      ...rFem.state,
      apUsed: { ...rFem.state.apUsed, mbrd_m1: false },
      monsters: rFem.state.monsters.map((x) => ({ ...x, tiredUntilWave: null })),
    };
    const rMale = breedMonster(readyState, 'm1', { kind: 'prisoner', pid: 11 }, () => 0.0);
    expect(rMale.ok).toBe(true);
    expect(rMale.state.eggs).toHaveLength(1);
    expect(rMale.state.eggs[0].hatchWave).toBe(7);
    // Grade B+ gives +5 xp
    expect(rMale.state.eggs[0].xp).toBe(5);

    // 3rd breed in same wave is blocked by MAX_PER_WAVE = 2
    const rCap = breedMonster(rMale.state, 'm2', { kind: 'prisoner', pid: 11 }, () => 0.0);
    expect(rCap.ok).toBe(false);
    expect(rCap.message).toContain('limit');

    // Cross-species Variant bloodline (15%) & 1.5x sell price
    const crossState = makeDayState({ monsters: [m1, m2], ap: 2, wave: 6 });
    const rCross = breedMonster(crossState, 'm1', { kind: 'monster', partnerId: 'm2' }, () => 0.05);
    expect(rCross.ok).toBe(true);
    expect(rCross.state.eggs[0].variantOf).toBeTruthy();
    const variantMon = createMonsterInstance(rCross.state.eggs[0].lineage, {
      stars: 2,
      variantOf: rCross.state.eggs[0].variantOf,
    });
    const normalMon = createMonsterInstance(rCross.state.eggs[0].lineage, {
      stars: 2,
      variantOf: null,
    });
    expect(getMonsterSellPrice(variantMon)).toBe(Math.round(getMonsterSellPrice(normalMon) * 1.5));
  });

  it('disposes monsters (Sell / Butcher) in both Estate and Build modes', () => {
    const mon = makeMob('mw', 'wyvern', { stars: 2 });
    const estateState = makeDayState({ monsters: [mon], points: 100 });
    const sold = disposeMonster(estateState, 'mw', 'sell');
    expect(sold.ok).toBe(true);
    expect(sold.state.points).toBe(100 + getMonsterSellPrice(mon));
    expect(sold.state.monsters).toHaveLength(0);

    const buildState: GameState = {
      ...estateState,
      mode: 'build',
    };
    const butchered = disposeMonster(buildState, 'mw', 'butcher');
    expect(butchered.ok).toBe(true);
    expect(butchered.state.expedition.lootParts).toBe(1);
    expect(butchered.state.town.food).toBe(estateState.town.food + 10);
  });
});

describe('Eggs, Overcrowding, Spa healing & Upkeep cycle', () => {
  it('delivers pregnant prisoner births, hatches eggs, heals via Spa Lv3, and resolves overcrowding', () => {
    const mom = makePrisoner({
      pid: 20,
      name: 'Lyra',
      breeding: { lineage: 'harpy', dueWave: 7, xp: 5, trait: 'swift' },
    });
    const injuredMon = makeMob('m1', 'slime', {
      injuredUntilWave: 9,
      tiredUntilWave: 9,
    });
    const extra1 = makeMob('m2', 'goblin');
    const extra2 = makeMob('m3', 'kobold');
    const extra3 = makeMob('m4', 'orc');
    const readyEgg = createMonsterEgg('imp', 6, { hatchWave: 7, xp: 5 });

    let state = makeDayState({
      wave: 7,
      prisoners: [mom],
      monsters: [injuredMon, extra1, extra2, extra3],
      eggs: [readyEgg],
      estate: {
        ...makeDayState().estate,
        facilities: {
          ...makeDayState().estate.facilities,
          beastpen: 0, // cap 3
          spa: 3, // heals all injury/tired
        },
      },
    });
    expect(getMonsterPenCap(state)).toBe(3);

    // Deterministic RNG < 0.20 kills excess monsters during overcrowding
    const nightly = processMonsterNightlyCycle(state, () => 0.1);
    state = nightly.state;

    expect(state.prisoners[0].breeding).toBeNull();
    expect(state.eggs.some((e) => e.lineage === 'harpy')).toBe(true);
    expect(state.monsters.length).toBeLessThan(5);
    expect(state.expedition.lootParts).toBeGreaterThan(0);

    // Explicit overcrowding 80% injury check
    const crowdState = makeDayState({
      wave: 7,
      monsters: [
        makeMob('a', 'slime'),
        makeMob('b', 'slime'),
        makeMob('c', 'slime'),
        makeMob('d', 'slime'),
      ],
      estate: {
        ...makeDayState().estate,
        facilities: { ...makeDayState().estate.facilities, beastpen: 0 },
      },
    });
    const injuredCrowd = resolveMonsterOvercrowding(crowdState, () => 0.5);
    expect(injuredCrowd.state.monsters).toHaveLength(4);
    const injuredVictim = injuredCrowd.state.monsters.find((m) => m.injuredUntilWave === 8);
    expect(injuredVictim).toBeDefined();
    expect(isMonsterHurt(injuredCrowd.state, injuredVictim!)).toBe(true);
    expect(isMonsterHurt({ ...injuredCrowd.state, wave: 8 }, injuredVictim!)).toBe(false);

    // Direct helper checks: processPrisonerBreedingBirths & hatchMonsterEggs
    const birthOnly = processPrisonerBreedingBirths(
      makeDayState({ wave: 7, prisoners: [mom] }),
      () => 0.1
    );
    expect(birthOnly.births).toHaveLength(1);
    expect(birthOnly.state.eggs).toHaveLength(1);

    const hatchedOnly = hatchMonsterEggs(makeDayState({ wave: 7, eggs: [readyEgg] }));
    expect(hatchedOnly.hatched).toHaveLength(1);
    expect(hatchedOnly.state.monsters).toHaveLength(1);
    expect(hatchedOnly.state.monsters[0].xp).toBe(5);
  });

  it('calculates CFG.UPKEEP (Hard ON / Normal OFF, W<=5 free, W6-10 half, 25% cap, arrears hazards)', () => {
    const mon = makeMob('md', 'dragon', { stars: 3 }); // 6 MP monster cost
    const normalState = makeDayState({
      wave: 12,
      monsters: [mon],
      settings: { ...makeDayState().settings, difficulty: 'normal', upkeepEnabled: false },
    });
    expect(isUpkeepActive(normalState)).toBe(false);

    const hardState = makeDayState({
      wave: 12,
      points: 2, // too poor to pay
      monsters: [makeMob('ms', 'slime', { stars: 1 })],
      settings: { ...makeDayState().settings, difficulty: 'hard', upkeepEnabled: true },
      estate: {
        ...makeDayState().estate,
        trailingIncome: [200, 200, 200], // avg 200 -> 25% cap = 50 MP
        facilities: { ...makeDayState().estate.facilities, workshop: 2, farmland: 1 },
        upkeepArrears: 1,
      },
      prisoners: [makePrisoner({ pid: 5, resist: 20 })],
    });
    expect(isUpkeepActive(hardState)).toBe(true);

    // Wave 5 is free
    const w5Upkeep = calcMonsterUpkeep({ ...hardState, wave: 5 });
    expect(w5Upkeep.total).toBe(0);

    // Wave 8 is halved
    const w8Upkeep = calcMonsterUpkeep({ ...hardState, wave: 8 });
    const w12Upkeep = calcMonsterUpkeep(hardState);
    expect(w8Upkeep.total).toBeLessThanOrEqual(w12Upkeep.total);
    expect(w12Upkeep.total).toBeLessThanOrEqual(50);

    // Arrears cycle: cannot pay -> arrears becomes 2, prisoner +3 resist, ★1 monster escapes (<0.20)
    const afterArrears = applyUpkeepCycle(hardState, () => 0.05);
    expect(afterArrears.state.estate.upkeepArrears).toBe(2);
    expect(afterArrears.state.prisoners[0].resist).toBe(23);
    expect(afterArrears.state.monsters).toHaveLength(0);
  });
});

describe('Floor Guards (0/2), Adjacent Links & Raid Integration', () => {
  it('computes Floor Guard DC (PREF +1, CAP +3, Lab +1, Cmd +1) and adjacent links (max 3)', () => {
    const mon = makeMob('m1', 'slime', { stars: 2 }); // prefTag: 'bind'
    const fighter = makePrisoner({ pid: 77, grade: 'A', stamina: 80, resist: 65 });

    let state = makeDayState({
      monsters: [mon],
      prisoners: [fighter],
      estate: {
        ...makeDayState().estate,
        landmarks: { hq: false, lab: true, cmd: true },
      },
    });

    // Install traps on 1F (bind, A) and 2F (phys, A) => link (bind, phys) = -2 (both >= A)
    state = {
      ...state,
      floors: state.floors.map((f) => {
        if (f.floor === 1) {
          return {
            ...f,
            slots: [{ id: 't1', text: 'Slime Web', grade: 'A', types: ['bind'], mpInvested: 20 }],
          };
        }
        if (f.floor === 2) {
          return {
            ...f,
            slots: [{ id: 't2', text: 'Crushing Blades', grade: 'A', types: ['phys'], mpInvested: 20 }],
          };
        }
        return f;
      }),
    };

    state = assignMonsterToFloor(state, 1, 'm1').state;
    state = assignPrisonerFighterToFloor(state, 1, 77).state;
    state = toggleFloorLabBuff(state, 1).state;

    const floor1 = state.floors[0];
    const bonus = getFloorCombatBonus(state, floor1);
    // m1 (2) + PREF (1) + fighter A+ (2) + Lab (1) + Cmd (1) = 7 -> capped at 3
    expect(bonus.rawBonus).toBe(7);
    expect(bonus.bonus).toBe(MONSTER_CFG.FSLOT.DC_CAP);
    expect(bonus.hasPrefBonus).toBe(true);
    expect(getFloorDC(floor1, state)).toBe(getFloorDC(floor1) + 3);

    const links = getFloorLinks(state);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ fromFloor: 1, toFloor: 2, penalty: 2 });

    // Removing the only trap on 1F clears orphaned combatSlots (requires Build mode)
    const buildState: GameState = { ...state, mode: 'build' };
    const cleared = removeTrapFromFloor(buildState, 1, 0).state;
    expect(cleared.floors[0].combatSlots ?? []).toHaveLength(0);
  });

  it('integrates guard DC, link penalty, monster XP/injury/death, and captive betrayal into raid resolution', () => {
    const mon = makeMob('m1', 'mimic', { stars: 1, xp: 8 }); // prefTag: 'mind'
    const fighter = makePrisoner({ pid: 77, grade: 'C', stamina: 80, resist: 60 }); // 60/250 = 0.24 betrayal
    const state = makeDayState({
      mode: 'raid',
      wave: 6,
      raidFirstRoom: true,
      monsters: [mon],
      prisoners: [fighter],
      floors: makeDayState().floors.map((f) => {
        if (f.floor === 1) {
          return {
            ...f,
            slots: [{ id: 't1', text: 'Mimic Chest', grade: 'C', types: ['mind'], mpInvested: 15 }],
            combatSlots: [
              { kind: 'monster', monsterId: 'm1' },
              { kind: 'prisoner', pid: 77 },
            ],
          };
        }
        if (f.floor === 2) {
          return {
            ...f,
            slots: [{ id: 't2', text: 'Arrow Volley', grade: 'B', types: ['phys'], mpInvested: 20 }],
          };
        }
        return f;
      }),
    });

    // Random 0.25 => randInt(1, 20) = 6 (neither 1 nor 20).
    // F-grade severe hero Vane fails margin < 0 -> dies -> +3 XP (8+3=11 >= 10 -> ★2 evolution).
    // SSS hero Kael passes -> survives so mimic gets injured (0.25 >= 0.15) & fighter loses 20 stamina (0.25 >= 0.24).
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25);

    const hDead = makeHero({ slot: 1, name: 'Vane', grade: 'F', cond: 'severe' });
    const hPass = makeHero({
      slot: 2,
      name: 'Kael',
      grade: 'SSS',
      traits: ['scout', 'cautious', 'reckless'],
      cond: '',
    });
    const enc = resolveFloorEncounter(
      { ...state, party: [hDead, hPass] },
      state.floors[0],
      [hDead, hPass],
      6
    );

    expect(enc.detailLines.some((l) => l.includes('Floor Guards'))).toBe(true);
    expect(enc.nextMonsters).toHaveLength(1);
    expect(enc.nextMonsters[0].stars).toBe(2);
    expect(enc.nextMonsters[0].injuredUntilWave).toBe(7);
    expect(enc.nextPrisoners[0].stamina).toBe(60);

    // Random 0.09 => randInt(1, 20) = 2 (not natural 1!).
    // Kael (SSS +8 + scout +2 + cautious +1 + reckless +1 + die 2 = 14 >= DC 12) survives!
    // Triggers monster death (0.09 < 0.10) and fighter betrayal (0.09 < 0.24).
    spy.mockReturnValue(0.09);
    const stepState: GameState = {
      ...state,
      party: [hPass],
    };
    const step = advanceRaidStep(stepState);
    expect(step.state.monsters).toHaveLength(0);
    expect(step.state.expedition.lootParts).toBe(1);
    expect(step.state.prisoners).toHaveLength(0);
    expect(step.detailText).toContain('BETRAYED');
  });
});
