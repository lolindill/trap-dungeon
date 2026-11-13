import { afterEach, describe, expect, it, vi } from 'vitest';
import { CFG } from '../../data/constants';
import {
  PRISON_JOBS,
  PRISON_PACTS,
  resolveJobAsset,
  resolveMarkAsset,
  resolvePactAsset,
  resolvePrisonAsset,
} from '../../data/prisonData';
import type { GameState, Prisoner } from '../../types/game';
import {
  assignPrisonerJob,
  auctionPrisoner,
  buildPrisonNarrateContext,
  buildPrisonRosterPromptContext,
  calculateRansom,
  canExecutePact,
  convertPrisoner,
  dispatchPrisonerMole,
  executePrisoner,
  executePrisonPact,
  getAllBuyerQuotes,
  getHarshDeathChance,
  getInterrogateChance,
  getJobAptitudeStars,
  getJobYieldPreview,
  getPrisonerPronouns,
  getSaleRiskOdds,
  releasePrisoner,
  sellPrisoner,
  unassignPrisonerJob,
} from '../prison';
import { createInitialGameState } from '../saveLoad';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCaptive(overrides: Partial<Prisoner> = {}): Prisoner {
  return {
    pid: 1,
    name: 'Lyra',
    grade: 'B',
    raceLabel: 'high elf',
    classLabel: 'knight',
    traits: [],
    capturedWave: 1,
    capturedFloor: 1,
    resist: 50,
    corr: 20,
    gender: 'female',
    stamina: 100,
    staminaMax: 100,
    pleasure: 10,
    terror: 15,
    shame: 10,
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

function makeDayState(
  prisoners: Prisoner[] = [makeCaptive()],
  overrides: Partial<GameState> = {}
): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    mode: 'estate',
    day: 1,
    wave: 1,
    ap: 3,
    apMax: 3,
    dayClosed: false,
    points: 500,
    prisoners,
    ...overrides,
  };
}

describe('Prison Pacts, Marks, AP & Gates', () => {
  it('covers 35+ pacts across the 4 training/care tabs', () => {
    expect(PRISON_PACTS.length).toBeGreaterThanOrEqual(35);
    const tabs = new Set(PRISON_PACTS.map((p) => p.tab));
    expect(tabs).toEqual(new Set(['care', 'train', 'shame', 'dark']));
  });

  it('enforces 1 AP per captive per day and allows 0 AP Rest even at 0 AP or dying', () => {
    const dyingCaptive = makeCaptive({ pid: 1, stamina: 1, dying: true });
    let state = makeDayState([dyingCaptive], { ap: 0 });

    // Non-rest pact blocked when dying
    const blocked = executePrisonPact(state, 1, 'pfeed');
    expect(blocked.ok).toBe(false);

    // Rest works at 0 AP and revives dying captive
    const rested = executePrisonPact(state, 1, 'prest');
    expect(rested.ok).toBe(true);
    expect(rested.state.ap).toBe(0);
    expect(rested.state.prisoners[0].stamina).toBe(100);
    expect(rested.state.prisoners[0].dying).toBe(false);
    expect(rested.state.dayLines.length).toBe(1);

    // With AP available, 1 AP action succeeds and locks that captive for the day
    state = { ...rested.state, ap: 2 };
    const first = executePrisonPact(state, 1, 'pcare');
    expect(first.ok).toBe(true);
    expect(first.state.ap).toBe(1);
    expect(first.state.apUsed['prison_1']).toBe(true);
    expect(first.state.prisoners[0].pleasure).toBeGreaterThan(10);

    const second = executePrisonPact(first.state, 1, 'pfeed');
    expect(second.ok).toBe(false);
  });

  it('enforces Day phase lock and active crisis lock', () => {
    const nightState = { ...makeDayState(), mode: 'build' as const };
    expect(canExecutePact(nightState, nightState.prisoners[0], 'pcare').ok).toBe(false);

    const crisisState = makeDayState([makeCaptive()], {
      estate: { ...createInitialGameState().estate, activeCrisis: 'riot' },
    });
    expect(canExecutePact(crisisState, crisisState.prisoners[0], 'pcare').ok).toBe(false);
  });

  it('checks facility, mark, once-per-day, and purification gates', () => {
    const base = makeDayState([
      makeCaptive({ pid: 1, afflictions: ['curse'] }),
      makeCaptive({ pid: 2, name: 'Kael', gender: 'male' }),
    ]);

    // ptool requires smithy
    expect(canExecutePact(base, base.prisoners[0], 'ptool').ok).toBe(false);
    // ppublic requires watch + shame mark 1
    expect(canExecutePact(base, base.prisoners[0], 'ppublic').ok).toBe(false);
    // pcure curse requires shrine Lv.2
    const shrine1 = {
      ...base,
      estate: { ...base.estate, facilities: { shrine: 1 } },
    };
    expect(canExecutePact(shrine1, shrine1.prisoners[0], 'pcure').ok).toBe(false);

    const shrine2 = {
      ...base,
      estate: { ...base.estate, facilities: { shrine: 2 } },
    };
    const cured = executePrisonPact(shrine2, 1, 'pcure');
    expect(cured.ok).toBe(true);
    expect(cured.state.prisoners[0].afflictions).toEqual([]);
    expect(cured.state.points).toBe(480);

    // pdisplay is once per day across the prison
    const disp = executePrisonPact(cured.state, 2, 'pdisplay');
    expect(disp.ok).toBe(true);
    expect(disp.state.apUsed.pdisplay_day).toBe(true);
  });

  it('upgrades Marks using trainhall markCut and submissive obey bonus', () => {
    const captive = makeCaptive({
      pid: 1,
      resist: 54,
      pleasure: 22,
      traits: ['submissive'],
    });
    const state = makeDayState([captive], {
      estate: { ...createInitialGameState().estate, facilities: { trainhall: 1 } },
    });
    // trainhall Lv.1 => markCut = 5, trainMult = 1.2
    // pcare adds +8..12 * 1.2 >= +10 pleasure (32 >= 30 - 5 = 25 => Pleasure Lv.1)
    // and -2 * 1.2 = -2 resist (52 <= 50 + 5 + 10 = 65 => Obey Lv.1)
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const res = executePrisonPact(state, 1, 'pcare');
    expect(res.ok).toBe(true);
    expect(res.state.prisoners[0].marks.obey).toBeGreaterThanOrEqual(1);
    expect(res.state.prisoners[0].marks.pleasure).toBeGreaterThanOrEqual(1);
    expect(res.isKeyMoment).toBe(true);
    expect(res.upgradedMarks?.length).toBeGreaterThanOrEqual(1);
  });

  it('computes interrogation chance and deterministic harsh death risk accurately', () => {
    const c = makeCaptive({ pid: 1, resist: 40, stamina: 40, cond: 'severe' });
    const state = makeDayState([c], {
      officers: {
        ...createInitialGameState().officers,
        vesper: { aff: 25, stage: 1, cooldowns: {}, usedOnce: {} },
      },
      estate: {
        ...createInitialGameState().estate,
        facilities: { spy: 1, torture: 1 },
      },
    });
    // 0.35 + 60*0.005 (0.30) + 0.15 (V1) + 0.15 (spy) + 0.10 (torture) = 1.05 -> clamped 0.95
    expect(getInterrogateChance(state, c)).toBeCloseTo(0.95, 4);

    // pxfear: base 0.09 * 2 (severe) = 0.18; postStam = 40 - 35 = 5 (<15 => +0.25) => 0.43
    expect(getHarshDeathChance(state, c, 'pxfear')).toBeCloseTo(0.43, 4);

    // Legend captives never die from harsh pacts
    const legend = { ...c, legend: true };
    expect(getHarshDeathChance(state, legend, 'pxfear')).toBe(0);
  });

  it('handles pduo and pgift with officer stage & daily slot tracking', () => {
    const c = makeCaptive({ pid: 1, marks: { obey: 1, pleasure: 0, terror: 0, shame: 0 } });
    const state = makeDayState([c], {
      officers: {
        ...createInitialGameState().officers,
        vesper: { aff: 40, stage: 2, cooldowns: {}, usedOnce: {} },
      },
    });

    const res = executePrisonPact(state, 1, 'pduo', { officer: 'V' });
    expect(res.ok).toBe(true);
    expect(res.state.officers.vesper.aff).toBe(41);
    expect(res.state.apUsed.who_V).toBe(true);
    expect(res.imageUrl).toContain('dk_duo_v');
  });
});

describe('Jobs, Conversions & Double Agent', () => {
  it('includes all 24 Lua CFG.JOBS with 1-3 star aptitude & yield preview', () => {
    expect(PRISON_JOBS.length).toBe(24);
    const lewdCaptive = makeCaptive({
      pid: 1,
      pleasure: 90,
      corr: 85,
      marks: { obey: 2, pleasure: 3, terror: 0, shame: 0 },
    });
    expect(getJobAptitudeStars(lewdCaptive, 'brothel')).toBe(3);

    const state = makeDayState([lewdCaptive], {
      estate: { ...createInitialGameState().estate, facilities: { brothel: 1 } },
    });
    const preview = getJobYieldPreview(state, lewdCaptive, 'brothel');
    expect(preview.mp).toBeGreaterThan(0);

    const assigned = assignPrisonerJob(state, 1, 'brothel');
    expect(assigned.ok).toBe(true);
    expect(assigned.state.prisoners[0].job).toBe('brothel');

    const unassigned = unassignPrisonerJob(assigned.state, 1);
    expect(unassigned.ok).toBe(true);
    expect(unassigned.state.prisoners[0].job).toBeNull();
  });

  it('supports floor-role jobs (bait / lure) on trapped floors', () => {
    const c = makeCaptive({
      pid: 1,
      marks: { obey: 0, pleasure: 2, terror: 0, shame: 0 },
    });
    const state = makeDayState([c]);
    state.floors[0] = {
      ...state.floors[0],
      slots: [{ id: 't1', text: 'Trap', grade: 'C', types: ['lewd'], mpInvested: 50 }],
    };

    const res = assignPrisonerJob(state, 1, 'lure', { floor: 1 });
    expect(res.ok).toBe(true);
    expect(res.state.prisoners[0].job).toBe('lure');
    expect(res.state.prisoners[0].assignedFloor).toBe(1);
  });

  it('executes all 5 conversions and Double Agent dispatch with apGrowth tracking', () => {
    const c1 = makeCaptive({ pid: 1, resist: 5 });
    const c2 = makeCaptive({ pid: 2, corr: 75 });
    const c3 = makeCaptive({
      pid: 3,
      marks: { obey: 2, pleasure: 3, terror: 0, shame: 0 },
    });
    const c4 = makeCaptive({
      pid: 4,
      marks: { obey: 0, pleasure: 2, terror: 0, shame: 3 },
    });
    const c5 = makeCaptive({
      pid: 5,
      corr: 85,
      marks: { obey: 3, pleasure: 0, terror: 0, shame: 0 },
    });
    const c6 = makeCaptive({
      pid: 6,
      marks: { obey: 3, pleasure: 0, terror: 0, shame: 0 },
    });

    let state = makeDayState([c1, c2, c3, c4, c5, c6], {
      ap: 6,
      apMax: 6,
      estate: { ...createInitialGameState().estate, facilities: { brothel: 1 } },
    });
    state.floors[0] = {
      ...state.floors[0],
      slots: [{ id: 't1', text: 'Pit', grade: 'C', types: ['pit'], mpInvested: 50 }],
    };

    state = convertPrisoner(state, 1, 'guard', { floor: 1 }).state;
    state = convertPrisoner(state, 2, 'servant').state;
    state = convertPrisoner(state, 3, 'pet', { owner: 'L' }).state;
    state = convertPrisoner(state, 4, 'dancer').state;
    state = convertPrisoner(state, 5, 'hired', { jobKey: 'square' }).state;

    expect(state.prisoners[0].converted).toBe('guard');
    expect(state.prisoners[0].assignedFloor).toBe(1);
    expect(state.prisoners[1].converted).toBe('servant');
    expect(state.prisoners[2].converted).toBe('pet');
    expect(state.prisoners[2].owner).toBe('L');
    expect(state.prisoners[3].converted).toBe('dancer');
    expect(state.prisoners[4].converted).toBe('hired');
    expect(state.prisoners[4].job).toBe('square');
    expect(state.apGrowth.conv).toBe(5);

    const moleRes = dispatchPrisonerMole(state, 6);
    expect(moleRes.ok).toBe(true);
    expect(moleRes.state.prisoners[5].moleRaidsLeft).toBe(2);
    // Second mole blocked
    expect(dispatchPrisonerMole(moleRes.state, 6).ok).toBe(false);
  });
});

describe('Ransom, Sale Risks, Disposal & M/F Parity', () => {
  it('computes ransom, buyer quotes, sale risk odds, auction, execute & release', () => {
    const c1 = makeCaptive({
      pid: 1,
      grade: 'A',
      traits: ['noble'],
      marks: { obey: 2, pleasure: 0, terror: 0, shame: 0 },
      dressed: true,
    });
    const c2 = makeCaptive({ pid: 2, grade: 'S', name: 'Garrick', gender: 'male' });
    const c3 = makeCaptive({ pid: 3, grade: 'C', name: 'Sera' });

    const state = makeDayState([c1, c2, c3], {
      estate: { ...createInitialGameState().estate, facilities: { market: 1, gibbet: 1, shrine: 3 } },
    });

    const ransom = calculateRansom(state, c1, { forSale: true });
    expect(ransom.amount).toBeGreaterThan(CFG.RANSOM.A);
    const quotes = getAllBuyerQuotes(state, c1);
    expect(quotes.length).toBe(4);
    expect(quotes.some((q) => q.isBest)).toBe(true);

    // Obey >= 2 eliminates escape risk
    const odds = getSaleRiskOdds(state, c1);
    expect(odds.escape).toBe(0);

    vi.spyOn(Math, 'random').mockReturnValue(0.95);
    const sold = sellPrisoner(state, 1, 'noble');
    expect(sold.ok).toBe(true);
    expect(sold.state.points).toBeGreaterThan(state.points);
    expect(sold.state.prisoners.some((p) => p.pid === 1)).toBe(false);

    const auc = auctionPrisoner(sold.state, 2);
    expect(auc.ok).toBe(true);
    expect(auc.state.points).toBeGreaterThan(sold.state.points);

    const exec = executePrisoner(auc.state, 3);
    expect(exec.ok).toBe(true);
    expect(exec.state.kills).toBe(1);
    expect(exec.state.fear).toBeGreaterThan(auc.state.fear);

    const relState = makeDayState([makeCaptive({ pid: 4 })], {
      momentum: 2,
      famePoints: 10,
      fear: 10,
    });
    const rel = releasePrisoner(relState, 4);
    expect(rel.ok).toBe(true);
    expect(rel.state.momentum).toBe(1);
    expect(rel.state.famePoints).toBe(9);
    expect(rel.state.fear).toBe(7);
  });

  it('resolves _m sprites with clean female fallback and generates M/F pronouns + prompt context', () => {
    // Has male variant
    expect(resolvePrisonAsset('dk_pa_care', 'male')).toContain('dk_pa_care_m');
    expect(resolvePactAsset('pduo', 'male', { duoOfficer: 'L' })).toContain('dk_duo_l_m');
    expect(resolveJobAsset('brothel', 'male')).toContain('dk_job_brothel_m');
    expect(resolveMarkAsset('obey', 'male')).toContain('dk_mark_obey_m');

    // No male variant -> clean fallback to default
    expect(resolvePrisonAsset('dk_pa_display', 'male')).toContain('dk_pa_display.');
    expect(resolvePrisonAsset('dk_pa_exec', 'male')).toContain('dk_pa_exec.');
    expect(resolvePrisonAsset('dk_dark_starve', 'male')).toContain('dk_dark_starve.');
    expect(resolvePrisonAsset('dk_pr_guard', 'male')).toContain('dk_pr_guard.');

    const malePr = getPrisonerPronouns('male');
    expect(malePr.subject).toBe('he');
    expect(malePr.possessive).toBe('his');

    const mCaptive = makeCaptive({ pid: 1, name: 'Dorian', gender: 'male' });
    const fTurned = makeCaptive({
      pid: 2,
      name: 'Elena',
      gender: 'female',
      converted: 'guard',
      assignedFloor: 2,
    });
    const state = makeDayState([mCaptive, fTurned]);

    const ctx = buildPrisonRosterPromptContext(state);
    expect(ctx).toContain('[Prison block — 1 captive hero(es)');
    expect(ctx).toContain('Dorian');
    expect(ctx).toContain('he/him');
    expect(ctx).toContain('[Turned heroes now serving the dungeon: Elena');
    expect(ctx).toContain('Guard 2F');

    const sceneCtx = buildPrisonNarrateContext(state, mCaptive, 'Whip Punishment', 'welted');
    expect(sceneCtx).toContain('he/him/his');
  });

  it('handles dark pact permanent flags (brand/crest/cow/rename), ppair, and fatal harsh pact', () => {
    const c1 = makeCaptive({
      pid: 1,
      name: 'Aria',
      marks: { obey: 2, pleasure: 0, terror: 0, shame: 0 },
      stamina: 60,
    });
    const c2 = makeCaptive({ pid: 2, name: 'Bram', gender: 'male' });
    let state = makeDayState([c1, c2], {
      ap: 6,
      apMax: 6,
      estate: {
        ...createInitialGameState().estate,
        facilities: { shrine: 2, dairy: 2 },
      },
    });

    // Pair captives
    const paired = executePrisonPact(state, 1, 'ppair', { partnerPid: 2 });
    expect(paired.ok).toBe(true);
    expect(paired.state.apUsed['prison_1']).toBe(true);
    expect(paired.state.apUsed['prison_2']).toBe(true);

    // Next day flags
    state = { ...paired.state, apUsed: {}, ap: 6 };
    const branded = executePrisonPact(state, 1, 'pbrand');
    expect(branded.ok).toBe(true);
    expect(branded.state.prisoners[0].branded).toBe(true);
    expect(canExecutePact(branded.state, branded.state.prisoners[0], 'pbrand').ok).toBe(false);

    state = { ...branded.state, apUsed: {} };
    const crested = executePrisonPact(state, 1, 'pcrest');
    expect(crested.ok).toBe(true);
    expect(crested.state.prisoners[0].crest).toBe(true);

    state = { ...crested.state, apUsed: {} };
    const cowed = executePrisonPact(state, 1, 'pcow');
    expect(cowed.ok).toBe(true);
    expect(cowed.state.prisoners[0].cow).toBe(true);

    state = { ...cowed.state, apUsed: {} };
    const renamed = executePrisonPact(state, 1, 'prename');
    expect(renamed.ok).toBe(true);
    expect(renamed.state.prisoners[0].renamed).toBe(true);
    expect(getSaleRiskOdds(renamed.state, renamed.state.prisoners[0]).escape).toBe(0);

    // Harsh pact fatal roll
    state = { ...renamed.state, apUsed: {} };
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const fatal = executePrisonPact(state, 1, 'pxfear');
    expect(fatal.ok).toBe(true);
    expect(fatal.died).toBe(true);
    expect(fatal.state.prisoners.some((p) => p.pid === 1)).toBe(false);
    expect(fatal.state.kills).toBe(1);
  });
});
