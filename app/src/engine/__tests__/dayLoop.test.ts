import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_BLUEPRINTS } from '../../data/starterBlueprints';
import { buildDayJournalMessages, selectDayJournalLines } from '../../llm/promptBuilder';
import {
  calcApMax,
  calcRestMp,
  canSpendDayAp,
  closeDayAndRest,
  finishDebtPhase,
  finishExpeditionPhase,
  finishManagementSettle,
  formatDeterministicDayJournal,
  getNavTabBadges,
  getPrimaryTabForMode,
  isDayPhase,
  performQuickOfficerAction,
  performQuickPrisonAction,
  performQuickTownAction,
  resolveTabShortcutKey,
  spendDayAp,
  startNewDay,
} from '../dayLoop';
import { installBlueprintToFloor } from '../dungeon';
import { advanceRaidStep } from '../raid';
import { createInitialGameState } from '../saveLoad';
import { applyPrepReply } from '../tagParser';
import {
  finishBuildPhase,
  finishResultPhase,
  startInvasionPhase,
} from '../workflow';

afterEach(() => {
  vi.restoreAllMocks();
});

function runOneNightWaveToResult() {
  let state = { ...createInitialGameState(), points: 500 };
  const eliteBp = { ...STARTER_BLUEPRINTS[0], grade: 'SSS' as const };
  state = installBlueprintToFloor(state, 1, eliteBp).state;
  state = finishBuildPhase(state);
  state = applyPrepReply(
    state,
    `<eval effectiveness="8" novelty="8" fun="8" aesthetics="8" lewdness="6" overall="A"/>
     <hero n="1">\nname: Rowan\n</hero><hero n="2">\nname: Mira\n</hero><hero n="3">\nname: Sera\n</hero>`
  ).state;
  state = startInvasionPhase(state);
  vi.spyOn(Math, 'random').mockReturnValue(0.0);
  const step = advanceRaidStep(state);
  expect(step.isFinal).toBe(true);
  expect(step.state.mode).toBe('result');
  return step.state;
}

describe('Night/Day turn loop transitions & skipDay toggle', () => {
  it('transitions Result -> Day (estate) -> M.Settle -> Build by default', () => {
    const resultState = runOneNightWaveToResult();
    expect(resultState.settings.skipDay).toBe(false);

    const dayState = finishResultPhase(resultState);
    expect(dayState.mode).toBe('estate');
    expect(dayState.day).toBe(1);
    expect(dayState.ap).toBe(3);
    expect(dayState.apMax).toBe(3);
    expect(dayState.dayClosed).toBe(false);
    expect(isDayPhase(dayState)).toBe(true);

    const closed = closeDayAndRest(dayState);
    expect(closed.restMp).toBe(30); // 3 AP * 10 MP
    expect(closed.state.points).toBe(dayState.points + 30);
    expect(closed.state.ap).toBe(0);
    expect(closed.state.dayClosed).toBe(true);
    expect(closed.state.mode).toBe('msettle');
    expect(isDayPhase(closed.state)).toBe(false);

    const nextBuild = finishManagementSettle(closed.state);
    expect(nextBuild.mode).toBe('build');
    expect(nextBuild.waveStartSnapshot).not.toBeNull();
  });

  it('preserves Phase 1 loop (Result -> Build) when skipDay is enabled', () => {
    const resultState = runOneNightWaveToResult();
    const skipState = {
      ...resultState,
      settings: { ...resultState.settings, skipDay: true },
    };
    const nextBuild = finishResultPhase(skipState);
    expect(nextBuild.mode).toBe('build');
    expect(nextBuild.wave).toBe(1);
    expect(nextBuild.party).toEqual([]);
  });

  it('routes M.Settle -> Exped -> Debt -> Build when expedition and debt are due', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'msettle',
      wave: 3,
      day: 3,
      expedition: { ...state.expedition, active: true, depth: 1, maxDepth: 3 },
      debt: { ...state.debt, amount: 2500, dueWave: 3 },
    };

    const expedState = finishManagementSettle(state);
    expect(expedState.mode).toBe('exped');

    const debtState = finishExpeditionPhase(expedState);
    expect(debtState.mode).toBe('debt');

    const nextBuild = finishDebtPhase(debtState);
    expect(nextBuild.mode).toBe('build');
    expect(nextBuild.debt.dueWave).toBe(6);
    expect(nextBuild.debt.cycleCount).toBe(1);
  });

  it('routes M.Settle directly to Debt when dueWave is reached without active expedition', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'msettle',
      wave: 3,
      debt: { ...state.debt, amount: 3000, dueWave: 3 },
    };
    const debtState = finishManagementSettle(state);
    expect(debtState.mode).toBe('debt');
  });
});

describe('AP Growth, Penalties & Rest MP (Normal vs Vesper V5)', () => {
  it('computes apMax from the 7 growth paths up to cap 6 and applies entApPenalty + apBonus', () => {
    let state = createInitialGameState();
    expect(calcApMax(state)).toBe(3);

    state = {
      ...state,
      wave: 5,
      kills: 12,
      entApPenalty: 1,
      town: { ...state.town, lv: 5 },
      officers: {
        ...state.officers,
        vesper: { ...state.officers.vesper, stage: 4 },
      },
      estate: {
        ...state.estate,
        facilities: { manor: 2 },
        perks: { ...state.estate.perks, apBonus: 1 },
      },
    };
    // 4 paths satisfied -> capped at +3 growth -> apMax = 6
    expect(calcApMax(state)).toBe(6);

    const day = startNewDay(state);
    expect(day.apMax).toBe(6);
    // 6 - 1 (entApPenalty) + 1 (apBonus) = 6
    expect(day.ap).toBe(6);
    expect(day.entApPenalty).toBe(0);
    expect(day.estate.perks.apBonus).toBe(0);
  });

  it('doubles Rest MP (+20/AP) when Vesper V5 rest2Day perk is active and consumes it', () => {
    let state = startNewDay({ ...createInitialGameState(), wave: 2, points: 100 });
    expect(calcRestMp(state)).toBe(30); // 3 AP * 10

    state = {
      ...state,
      estate: {
        ...state.estate,
        perks: { ...state.estate.perks, rest2Day: true },
      },
    };
    expect(calcRestMp(state)).toBe(60); // 3 AP * 20

    const closed = closeDayAndRest(state);
    expect(closed.restMp).toBe(60);
    expect(closed.state.points).toBe(160);
    expect(closed.state.estate.perks.rest2Day).toBe(false);
  });
});

describe('Navigation tabs, 1..5 hotkeys, AP lock guards & alert badges', () => {
  it('maps modes to primary tabs and resolves 1..5 keyboard shortcuts safely', () => {
    expect(getPrimaryTabForMode('build')).toBe('dungeon');
    expect(getPrimaryTabForMode('prep')).toBe('dungeon');
    expect(getPrimaryTabForMode('raid')).toBe('dungeon');
    expect(getPrimaryTabForMode('result')).toBe('dungeon');
    expect(getPrimaryTabForMode('estate')).toBe('estate');
    expect(getPrimaryTabForMode('msettle')).toBe('estate');
    expect(getPrimaryTabForMode('exped')).toBe('estate');
    expect(getPrimaryTabForMode('debt')).toBe('debt');

    expect(resolveTabShortcutKey('1', { tagName: 'BODY' })).toBe('dungeon');
    expect(resolveTabShortcutKey('2', { tagName: 'DIV' })).toBe('prison');
    expect(resolveTabShortcutKey('3', null)).toBe('estate');
    expect(resolveTabShortcutKey('4', { tagName: 'BUTTON' })).toBe('debt');
    expect(resolveTabShortcutKey('5', { tagName: 'SPAN' })).toBe('officers');
    expect(resolveTabShortcutKey('6', { tagName: 'BODY' })).toBeNull();

    // Ignored inside inputs/textareas/selects/contentEditable
    expect(resolveTabShortcutKey('2', { tagName: 'INPUT' })).toBeNull();
    expect(resolveTabShortcutKey('3', { tagName: 'TEXTAREA' })).toBeNull();
    expect(resolveTabShortcutKey('4', { tagName: 'SELECT' })).toBeNull();
    expect(resolveTabShortcutKey('5', { tagName: 'DIV', isContentEditable: true })).toBeNull();
  });

  it('locks AP spending outside Day phase and enforces 1-per-key-per-day', () => {
    const buildState = createInitialGameState();
    expect(canSpendDayAp(buildState, 'town_patrol').ok).toBe(false);

    const dayState = startNewDay({ ...buildState, wave: 1 });
    expect(canSpendDayAp(dayState, 'town_patrol').ok).toBe(true);

    const first = spendDayAp(dayState, 'town_patrol', 'Patrol');
    expect(first.ok).toBe(true);
    expect(first.state.ap).toBe(2);
    expect(first.state.dayLines).toHaveLength(1);

    // Repeating same action key on the same day is blocked
    const dup = spendDayAp(first.state, 'town_patrol', 'Patrol again');
    expect(dup.ok).toBe(false);
    expect(dup.state.ap).toBe(2);
  });

  it('produces accurate crisis/milestone alert badges for Sub-Tabs', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      wave: 3,
      town: { ...state.town, food: 15 },
      debt: { ...state.debt, dueWave: 3, lates: 1 },
      officers: {
        ...state.officers,
        lilim: { ...state.officers.lilim, aff: 62, stage: 2 }, // within 3 of S3 (65)
      },
      prisoners: Array.from({ length: 6 }, (_, i) => ({
        pid: i + 1,
        name: `C${i + 1}`,
        grade: 'C',
        raceLabel: 'human',
        classLabel: 'rogue',
        traits: [],
        capturedWave: 1,
        capturedFloor: 1,
        resist: 40,
        corr: 10,
        gender: 'female',
        stamina: 100,
        staminaMax: 100,
        pleasure: 5,
        terror: 10,
        shame: 0,
        marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
        cond: '',
        job: null,
        converted: null,
        assignedFloor: null,
        owner: null,
        afflictions: [],
        breeding: null,
      })),
    };

    const badges = getNavTabBadges(state);
    expect(badges.prison).toEqual({ text: '6/6 FULL!', tone: 'crit' });
    expect(badges.estate).toEqual({ text: 'FOOD<20!', tone: 'crit' });
    expect(badges.debt).toEqual({ text: 'DUE NOW', tone: 'crit' });
    expect(badges.officers).toEqual({ text: '★ L62', tone: 'star' });
  });
});

describe('Day Log queuing, Quick Settle & Batched AI Journal prompt', () => {
  it('queues quick town/officer/prison actions and generates deterministic Quick Settle summary', () => {
    let state = startNewDay({ ...createInitialGameState(), wave: 2, points: 200 });
    state = {
      ...state,
      officers: {
        ...state.officers,
        vesper: { ...state.officers.vesper, aff: 18, stage: 0 },
      },
      prisoners: [
        {
          pid: 1,
          name: 'Seraphina',
          grade: 'A',
          raceLabel: 'high elf',
          classLabel: 'paladin',
          traits: [],
          capturedWave: 1,
          capturedFloor: 2,
          resist: 60,
          corr: 0,
          gender: 'female',
          stamina: 60,
          staminaMax: 100,
          pleasure: 0,
          terror: 12,
          shame: 0,
          marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
          cond: '',
          job: null,
          converted: null,
          assignedFloor: null,
          owner: null,
          afflictions: [],
          breeding: null,
        },
      ],
    };

    // 1 AP: Town Patrol
    const tRes = performQuickTownAction(state, 'patrol');
    expect(tRes.ok).toBe(true);
    state = tRes.state;
    expect(state.town.order).toBe(66);

    // 1 AP: Officer Time (hits Vesper Stage 1 at aff 21 -> star=true!)
    const oRes = performQuickOfficerAction(state, 'vesper', 'time');
    expect(oRes.ok).toBe(true);
    state = oRes.state;
    expect(state.officers.vesper.aff).toBe(21);
    expect(state.officers.vesper.stage).toBe(1);

    // 0 AP: Prison Rest (free)
    const pRest = performQuickPrisonAction(state, 1, 'rest');
    expect(pRest.ok).toBe(true);
    state = pRest.state;
    expect(state.prisoners[0].stamina).toBe(100);
    expect(state.ap).toBe(1);

    const closed = closeDayAndRest(state);
    expect(closed.restMp).toBe(10);
    expect(closed.journalLines).toHaveLength(3);
    expect(closed.state.dayLines).toEqual([]);

    const summary = formatDeterministicDayJournal(state, closed.journalLines, closed.restMp);
    expect(summary).toContain('Day 2 Summary Ledger:');
    expect(summary).toContain('Town Guard Patrol (+6 Order)');
    expect(summary).toContain('★ Spent time with Vesper (+3 Aff → Stage 1!)');
    expect(summary).toContain('+10 MP');
  });

  it('batches up to 12 Day Log entries prioritizing ★ star scenes per 14_DK_SYS_DayJournal', () => {
    const lines = Array.from({ length: 16 }, (_, i) => ({
      text: `Entry ${i + 1}`,
      star: i === 14 || i === 15,
      kind: i === 2 ? 'town_news' : 'act',
    }));

    const batched = selectDayJournalLines(lines, 12);
    expect(batched).toHaveLength(12);
    expect(batched.some((l) => l.text === 'Entry 15' && l.star)).toBe(true);
    expect(batched.some((l) => l.text === 'Entry 16' && l.star)).toBe(true);

    const state = startNewDay({ ...createInitialGameState(), wave: 4 });
    const msgs = buildDayJournalMessages(state, batched, 20);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toContain('〔DK-DAY〕');
    expect(msgs[1].content).toContain('Journal (fixed outcomes):');
    expect(msgs[1].content).toContain('★ Entry 15');
    expect(msgs[1].content).toContain('[TOWN NEWS] Entry 3');
    expect(msgs[1].content).toContain('Town mood:');
  });
});
