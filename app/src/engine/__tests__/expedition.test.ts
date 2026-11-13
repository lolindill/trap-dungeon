import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSceneAsset } from '../../data/assetManifest';
import {
  EXPEDITION_AFTEREFFECTS,
  EXPEDITION_ARRIVALS,
  EXPEDITION_ENCOUNTERS,
  EXPEDITION_EVENTS,
  EXPEDITION_LENGTHS,
  EXPEDITION_REGIONS,
  EXPEDITION_RELICS,
  pickExpeditionArt,
} from '../../data/expeditionData';
import type { GameState, Prisoner } from '../../types/game';
import { finishManagementSettle, startNewDay } from '../dayLoop';
import {
  advanceExpeditionDay,
  buildExpeditionChronicleContext,
  canLaunchExpedition,
  canSelectTripLength,
  convertRelicShards,
  endExpeditionDay,
  finalizeExpedition,
  getAutoProgressStopReason,
  getDailyFleeChance,
  getMaxExpeditionCrew,
  isPrisonerEligibleForExpedition,
  launchExpedition,
  performExpeditionAction,
  recommendExpeditionAction,
  resolveExpeditionAftereffects,
  resolveExpeditionEvent,
  runExpeditionAutoDay,
  tickExpeditionAftereffects,
  type RichExpeditionCrewMember,
  type RichExpeditionState,
} from '../expedition';
import { createInitialGameState } from '../saveLoad';

afterEach(() => {
  vi.restoreAllMocks();
});

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
    resist: 30,
    corr: 20,
    gender: 'female',
    stamina: 90,
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

function makeDayState(overrides?: Partial<GameState>): GameState {
  const base = startNewDay({
    ...createInitialGameState(),
    wave: 5,
    points: 2000,
    prisoners: [makePrisoner(1), makePrisoner(2), makePrisoner(3), makePrisoner(4)],
    nextPid: 5,
  });
  return { ...base, ...overrides };
}

function makeExpedState(overrides?: Partial<RichExpeditionState>): GameState {
  const base = makeDayState();
  const res = launchExpedition(base, [1, 2], 'short');
  expect(res.ok).toBe(true);
  return {
    ...res.state,
    mode: 'exped',
    expedition: {
      ...(res.state.expedition as RichExpeditionState),
      activeEncounter: null,
      activeEvent: null,
      ...overrides,
    },
  };
}

describe('Expedition Data Integrity', () => {
  it('defines 5 lengths, 13 regions, 10 encounters, 6 arrivals, 22 events, 4 relics, and 8 aftereffects', () => {
    expect(EXPEDITION_LENGTHS).toHaveLength(5);
    expect(EXPEDITION_REGIONS).toHaveLength(13);
    expect(EXPEDITION_ENCOUNTERS).toHaveLength(10);
    expect(EXPEDITION_ARRIVALS.village).toHaveLength(3);
    expect(EXPEDITION_ARRIVALS.city).toHaveLength(3);
    expect(EXPEDITION_EVENTS).toHaveLength(22);
    expect(EXPEDITION_EVENTS.filter((e) => e.timing === 'morning')).toHaveLength(3);
    expect(EXPEDITION_EVENTS.filter((e) => e.timing === 'field')).toHaveLength(13);
    expect(EXPEDITION_EVENTS.filter((e) => e.timing === 'deep')).toHaveLength(6);
    expect(EXPEDITION_RELICS).toHaveLength(4);
    expect(EXPEDITION_AFTEREFFECTS).toHaveLength(8);
  });

  it('picks valid dk_exd_* and dk_exr_* scene assets', () => {
    expect(pickExpeditionArt({ depart: true }, 'out')).toBe(resolveSceneAsset('dk_exd_depart'));
    expect(pickExpeditionArt({ lost: true, return: true }, 'forest')).toBe(
      resolveSceneAsset('dk_exd_lost')
    );
    expect(pickExpeditionArt({}, 'canyon')).toBe(resolveSceneAsset('dk_exr_canyon'));
  });
});

describe('Expedition Launcher Gates & Eligibility', () => {
  it('enforces W3+ unlock, Holy Crusade block, crew eligibility, HQ cap, and length prerequisites', () => {
    const w2 = makeDayState({ wave: 2 });
    expect(canLaunchExpedition(w2, [1], 'short').ok).toBe(false);

    const crusade = makeDayState({
      crises: {
        ...createInitialGameState().crises,
        crusade: { active: true, wavesLeft: 3, cooldown: 0 },
      },
    });
    expect(canLaunchExpedition(crusade, [1], 'short').ok).toBe(false);

    // Crew eligibility
    expect(isPrisonerEligibleForExpedition(makePrisoner(10, { resist: 41 })).ok).toBe(false);
    expect(isPrisonerEligibleForExpedition(makePrisoner(11, { stamina: 49 })).ok).toBe(false);
    expect(isPrisonerEligibleForExpedition(makePrisoner(12, { legend: true })).ok).toBe(false);
    expect(isPrisonerEligibleForExpedition(makePrisoner(13, { dying: true })).ok).toBe(false);
    expect(isPrisonerEligibleForExpedition(makePrisoner(14)).ok).toBe(true);

    // Max crew 3 -> 4 with HQ
    const normal = makeDayState();
    expect(getMaxExpeditionCrew(normal)).toBe(3);
    expect(canLaunchExpedition(normal, [1, 2, 3, 4], 'short').ok).toBe(false);

    const withHq = makeDayState({
      estate: { ...createInitialGameState().estate, landmarks: { hq: true } },
    });
    expect(getMaxExpeditionCrew(withHq)).toBe(4);
    expect(canLaunchExpedition(withHq, [1, 2, 3, 4], 'short').ok).toBe(true);

    // Length prerequisites: long needs town.lv >= 3 & crew >= 2; grand needs W12+ & long cleared; abyss needs W20+ & grand cleared
    expect(canSelectTripLength(normal, 'long', 2).ok).toBe(false);
    const lv3 = makeDayState({
      wave: 12,
      town: { ...normal.town, lv: 3 },
    });
    expect(canSelectTripLength(lv3, 'long', 2).ok).toBe(true);
    expect(canSelectTripLength(lv3, 'grand', 3).ok).toBe(false);

    const lv3LongCleared = {
      ...lv3,
      expedition: { ...lv3.expedition, clearedLengths: ['long' as const] },
    };
    expect(canSelectTripLength(lv3LongCleared, 'grand', 3).ok).toBe(true);
    expect(canSelectTripLength(lv3LongCleared, 'abyss', 3).ok).toBe(false);

    const lv3GrandClearedW20 = {
      ...lv3LongCleared,
      wave: 20,
      expedition: { ...lv3LongCleared.expedition, clearedLengths: ['long' as const, 'grand' as const] },
    };
    expect(canSelectTripLength(lv3GrandClearedW20, 'abyss', 3).ok).toBe(true);
  });

  it('launches expedition cleanly, transitions msettle -> exped, and creates 3-region forks', () => {
    const base = makeDayState();
    const res = launchExpedition(base, [1, 2], 'short');
    expect(res.ok).toBe(true);
    expect(res.state.ap).toBe(base.ap - 1);
    expect(res.state.points).toBe(base.points - 15);
    expect(res.state.prisoners).toHaveLength(2);
    expect(res.state.expedition.active).toBe(true);
    expect(res.state.expedition.ap).toBe(3);
    expect(res.state.expedition.choices).toHaveLength(3);

    const inExped = finishManagementSettle({ ...res.state, mode: 'msettle' });
    expect(inExped.mode).toBe('exped');
  });
});

describe('Expedition 3 AP/day Mini-Map Actions, Flee & Events', () => {
  it('supports mv1..3 movement, atk/def combat, scout (with depth>=8 shard), camp, and home extract', () => {
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01); // guarantees win & shard when applicable
    let state = makeExpedState({
      lengthKey: 'mid',
      maxDays: 2,
      depth: 8,
      maxDepth: 9,
      region: 'forest',
      choices: [
        { idx: 1, region: 'forest', ambush: 0.12 },
        { idx: 2, region: 'ruin', ambush: 0.18 },
        { idx: 3, region: 'road', ambush: 0.1 },
      ],
    });

    // Scout at depth 8 -> finds shard & triggers relic major beat
    const scoutRes = performExpeditionAction(state, 'scout');
    expect(scoutRes.ok).toBe(true);
    state = scoutRes.state;
    expect(state.expedition.lootShards).toBeGreaterThanOrEqual(1);
    expect(buildExpeditionChronicleContext(state).isMajorBeat).toBe(true);

    // Clear any rolled event so we can move
    if (state.expedition.activeEvent) {
      state = resolveExpeditionEvent(state, 1).state;
    }

    // Move mv2 -> ruin
    const mvRes = performExpeditionAction(state, 'mv2');
    expect(mvRes.ok).toBe(true);
    state = mvRes.state;
    expect(state.expedition.depth).toBe(9);
    expect(state.expedition.region).toBe('ruin');

    if (state.expedition.activeEvent) {
      state = resolveExpeditionEvent(state, 1).state;
    }

    // Attack encounter if present, or set one and fight
    state = {
      ...state,
      expedition: {
        ...state.expedition,
        ap: 2,
        activeEncounter: { key: 'patrol', diff: 6 },
      },
    };
    const atkRes = performExpeditionAction(state, 'atk');
    expect(atkRes.ok).toBe(true);
    expect(atkRes.state.expedition.activeEncounter).toBeNull();
    expect(atkRes.state.expedition.lootMp).toBeGreaterThan(0);

    // Defend clears encounter
    state = {
      ...atkRes.state,
      expedition: {
        ...atkRes.state.expedition,
        ap: 2,
        activeEncounter: { key: 'party', diff: 9 },
      },
    };
    const defRes = performExpeditionAction(state, 'def');
    expect(defRes.ok).toBe(true);
    expect(defRes.state.expedition.activeEncounter).toBeNull();

    // Camp heals and cures ailments
    randSpy.mockReturnValue(0.2); // cures ailments (< 0.5) without night raid (>= 0.1) or flee
    state = {
      ...defRes.state,
      expedition: {
        ...defRes.state.expedition,
        ap: 2,
        crew: defRes.state.expedition.crew.map((m) => ({
          ...m,
          stamina: 50,
          ailments: ['fall'],
        })),
      },
    };
    const campRes = performExpeditionAction(state, 'camp');
    expect(campRes.ok).toBe(true);
    expect(campRes.state.expedition.active).toBe(true);
    expect(campRes.state.expedition.crew[0].stamina).toBeGreaterThan(50);
    expect(campRes.state.expedition.crew[0].ailments).toHaveLength(0);
    randSpy.mockReturnValue(0.01);

    // Home extract returns crew with ailment penalty (-8 per ailment)
    const expState = makeExpedState({
      crew: [
        {
          pid: 1,
          name: 'Captive-1',
          grade: 'B',
          stamina: 60,
          ailments: ['fall', 'burn'],
        },
      ],
    });
    const homeRes = performExpeditionAction(expState, 'home');
    expect(homeRes.ok).toBe(true);
    expect(homeRes.state.expedition.active).toBe(false);
    const returned = homeRes.state.prisoners.find((p) => p.pid === 1);
    expect(returned).toBeDefined();
    // 60 - 8 (possible ambush mock=0.01) - 16 (2 ailments) or 60 - 16
    expect(returned!.stamina).toBeLessThanOrEqual(44);
  });

  it('supports village (v1..v3) and city (c1..c3) arrival choices and daily flee checks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const vilState = makeExpedState({ region: 'village', arrivedVisited: false });
    const v2Res = performExpeditionAction(vilState, 'v2');
    expect(v2Res.ok).toBe(true);
    expect(v2Res.state.expedition.arrivedVisited).toBe(true);
    expect(v2Res.state.expedition.lootMp).toBe(170);
    expect(v2Res.state.expedition.notoriety).toBe(2);

    const cityState = makeExpedState({ region: 'city', arrivedVisited: false });
    const c1Res = performExpeditionAction(cityState, 'c1');
    expect(c1Res.ok).toBe(true);
    expect(c1Res.state.expedition.lootMp).toBe(320);
    expect(c1Res.state.expedition.notoriety).toBe(3);

    // Safe titles have 0 flee chance
    const safeMember: RichExpeditionCrewMember = {
      pid: 9,
      name: 'Safe',
      grade: 'C',
      stamina: 80,
      ailments: [],
      resist: 40,
      title: 'broken knight',
    };
    expect(getDailyFleeChance(vilState, safeMember)).toBe(0);

    const riskyMember: RichExpeditionCrewMember = {
      pid: 10,
      name: 'Risky',
      grade: 'C',
      stamina: 80,
      ailments: [],
      resist: 40,
    };
    expect(getDailyFleeChance(vilState, riskyMember)).toBeGreaterThan(0);

    // End day triggers flee roll -> fled member removed & leak aftermath armed on finish
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const fleeTestState = makeExpedState({
      day: 2,
      maxDays: 2,
      ap: 0,
      crew: [riskyMember],
    });
    const ended = endExpeditionDay(fleeTestState);
    expect(ended.expedition.active).toBe(false);
    expect(ended.expedition.afterEffects.some((a) => a.key === 'leak')).toBe(true);
  });

  it('resolves all 22 expedition events (including 6 Deep events at depth >= 8) cleanly', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    for (const ev of EXPEDITION_EVENTS) {
      const state = makeExpedState({
        depth: ev.minDepth,
        activeEvent: ev.key,
        eventActors: { a: 'Captive-1', b: 'Captive-2' },
      });
      const res = resolveExpeditionEvent(state, 1);
      expect(res.ok).toBe(true);
      expect(res.state.expedition.activeEvent).toBeNull();
      expect(res.summary).toContain(ev.title);
    }

    // Abyssal day 4+ fatigue & 3% vanish check
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // < 0.03 vanish!
    const abyssState = makeExpedState({
      lengthKey: 'abyss',
      day: 3,
      maxDays: 10,
    });
    const vanished = advanceExpeditionDay(abyssState);
    expect(vanished.expedition.active).toBe(false);
    expect(vanished.expedition.afterEffects.some((a) => a.key === 'leak')).toBe(true);
  });
});

describe('Auto-Progress (exRecommend / exStop), Relic Shards & 8 X.AFTER Aftereffects', () => {
  it('pauses Auto-Progress on all exStop safety thresholds', () => {
    // 1. Stamina < 35
    const lowStam = makeExpedState({
      crew: [
        { pid: 1, name: 'Captive-1', grade: 'B', stamina: 30, ailments: [] },
        { pid: 2, name: 'Captive-2', grade: 'B', stamina: 80, ailments: [] },
      ],
    });
    expect(getAutoProgressStopReason(lowStam)).toContain('35');

    // 2. All crew < 30
    const allLow = makeExpedState({
      crew: [
        { pid: 1, name: 'Captive-1', grade: 'B', stamina: 25, ailments: [] },
        { pid: 2, name: 'Captive-2', grade: 'B', stamina: 20, ailments: [] },
      ],
    });
    expect(getAutoProgressStopReason(allLow)).toContain('30');

    // 3. Destination arrival
    const arrived = makeExpedState({ region: 'village', arrivedVisited: false });
    expect(getAutoProgressStopReason(arrived)).toContain('Arrived');

    // 4. All 3 forks ambush >= 30%
    const dangerousFork = makeExpedState({
      choices: [
        { idx: 1, region: 'canyon', ambush: 0.3 },
        { idx: 2, region: 'fort', ambush: 0.3 },
        { idx: 3, region: 'canyon', ambush: 0.35 },
      ],
    });
    expect(getAutoProgressStopReason(dangerousFork)).toContain('30%');
    const autoStopped = runExpeditionAutoDay(dangerousFork);
    expect(autoStopped.stoppedReason).toContain('30%');
    expect(autoStopped.completedDay).toBe(false);

    // Normal safe day completes automatically via exRecommend
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // no ambush / no event
    const safeDay = makeExpedState({
      choices: [
        { idx: 1, region: 'road', ambush: 0.1 },
        { idx: 2, region: 'forest', ambush: 0.12 },
        { idx: 3, region: 'canyon', ambush: 0.3 },
      ],
    });
    expect(recommendExpeditionAction(safeDay)).toBe('mv1');
    const autoDone = runExpeditionAutoDay(safeDay);
    expect(autoDone.completedDay).toBe(true);
    expect(autoDone.steps).toBeGreaterThan(0);
  });

  it('converts 3 Relic Shards into 1 unowned Relic and grants Eleonora +2 Aff on >=150 MP haul', () => {
    const conv = convertRelicShards({ owned: [], shards: 7 });
    expect(conv.unlocked).toHaveLength(2);
    expect(conv.relics.owned).toHaveLength(2);
    expect(conv.relics.shards).toBe(1);

    const state = makeExpedState({
      lootMp: 180,
      lootShards: 3,
      lootEggs: 2,
    });
    const finished = finalizeExpedition(state, 'done');
    expect(finished.relics.owned).toHaveLength(1);
    expect(finished.relics.shards).toBe(0);
    expect(finished.eggs).toHaveLength(2);
    expect(finished.officers.eleonora.aff).toBe(state.officers.eleonora.aff + 2);
  });

  it('triggers and resolves all 8 X.AFTER aftereffects and ticks their durations', () => {
    const rich = makeExpedState({
      lengthKey: 'grand',
      notoriety: 3,
      evFlags: { flee: true },
      afFlags: {
        supply: true,
        scout: 3,
        desecrate: true,
        merchant: 2,
        hunter: true,
      },
    });
    const finished = finalizeExpedition(rich, 'done');
    const keys = finished.expedition.afterEffects.map((a) => a.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'supply',
        'scout',
        'revenge',
        'leak',
        'desecrate',
        'merchant',
        'hunter',
        'royal',
      ])
    );
    expect(finished.crises.wrath).toBe(10);
    expect(finished.crises.activeRaidMods.some((m) => m.key === 'hero_up')).toBe(true);

    // Check modifier resolution across floors/classes/monsters (clamped to [-2, +2])
    const resF1PriestMon = resolveExpeditionAftereffects(finished, {
      heroClassKey: 'priest',
      floorNum: 1,
      hasMonsterOnFloor: true,
    });
    // supply (-1) + scout (-1) + revenge (+1) + leak (+1) + desecrate (-1) + hunter (-1) + royal (+1) = -1
    expect(resF1PriestMon.mod).toBe(-1);

    // Tick down 1 wave -> scout (1W) expires, others stay at 1W
    const ticked = tickExpeditionAftereffects(finished);
    expect(ticked.expedition.afterEffects.some((a) => a.key === 'scout')).toBe(false);
    expect(ticked.expedition.afterEffects.some((a) => a.key === 'supply')).toBe(true);
  });
});
