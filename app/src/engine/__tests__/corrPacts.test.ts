import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORR_RATCHET_FLOOR, KINK_TRAP_MAP } from '../../data/constants';
import { PRISON_PACTS, PRISON_PACT_MAP } from '../../data/prisonData';
import type { GameState, Prisoner } from '../../types/game';
import { startNewDay } from '../dayLoop';
import { applyManagementSettle } from '../estate';
import {
  calculateRansom,
  canConvertPrisoner,
  convertPrisoner,
  executePrisonPact,
  getCorrTierPactBonus,
  getHarshDeathChance,
  getJobSettleYield,
  getJobYieldPreview,
  kinkFamilyMatch,
  pactKinkMatch,
  predictPactDeltas,
} from '../prison';
import { clamp } from '../rng';
import { applyCorrDelta, corrTier } from '../tiers';
import { createInitialGameState } from '../saveLoad';

afterEach(() => {
  vi.restoreAllMocks();
});

const SETTLE_OPTS = { rollCrisis: false, jobRisks: false } as const;

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
  const base = startNewDay({
    ...createInitialGameState(),
    wave: 3,
    points: 2000,
  });
  return { ...base, prisoners, ...overrides };
}

/** Install one trap with the given types on floor 1 (ticket 28 helper). */
function withFloorType(state: GameState, types: string[]): GameState {
  return {
    ...state,
    floors: state.floors.map((f) =>
      f.floor === 1
        ? {
            ...f,
            slots: [
              {
                id: 't0',
                text: 'Test Trap — a gimmick',
                grade: 'C' as const,
                types,
                mpInvested: 10,
              },
            ],
          }
        : f
    ),
  };
}

/** Deterministic LCG so property sweeps are reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Ticket 31: kink-match rule
// ---------------------------------------------------------------------------

describe('Ticket 31: kink-match rule (kinkKey × kinkFamily via KINK_TRAP_MAP)', () => {
  it('matches families that share a trap type with the prisoner kink', () => {
    // pain → [phys]; the pwhip family pain/rough both map to [phys].
    expect(KINK_TRAP_MAP['pain']).toEqual(['phys']);
    expect(kinkFamilyMatch('pain', ['pain', 'rough'])).toBe(true);
    // praise → [lewd]; degradation shares the lewd family → also matches.
    expect(kinkFamilyMatch('praise', ['degradation'])).toBe(true);
    // hypnosis → [mind]: no intersection with pain/rough.
    expect(kinkFamilyMatch('hypnosis', ['pain', 'rough'])).toBe(false);
    // Kinks absent from KINK_TRAP_MAP never match.
    expect(kinkFamilyMatch('toys', ['bondage'])).toBe(false);
    // Empty/undefined inputs never match.
    expect(kinkFamilyMatch(undefined, ['pain'])).toBe(false);
    expect(kinkFamilyMatch('pain', undefined)).toBe(false);
    expect(kinkFamilyMatch('pain', [])).toBe(false);
  });

  it('pactKinkMatch: kinkFamily-less pacts never match; Hollowed waives all family reqs', () => {
    expect(PRISON_PACT_MAP['pwhip'].kinkFamily).toEqual(['pain', 'rough']);
    expect(pactKinkMatch(makeCaptive({ kinkKey: 'pain' }), 'pwhip')).toBe(true);
    expect(pactKinkMatch(makeCaptive({ kinkKey: 'hypnosis' }), 'pwhip')).toBe(false);
    // pfeed has no kinkFamily — baseline for every tier, even Hollowed.
    expect(PRISON_PACT_MAP['pfeed'].kinkFamily).toBeUndefined();
    expect(pactKinkMatch(makeCaptive({ corr: 90 }), 'pfeed')).toBe(false);
    // Hollowed waiver: any kinkFamily pact reads as matched…
    expect(pactKinkMatch(makeCaptive({ corr: 90, kinkKey: 'hypnosis' }), 'pwhip')).toBe(true);
    expect(pactKinkMatch(makeCaptive({ corr: 90 }), 'pwhip')).toBe(true);
    // …but Devoted still needs a real family intersection.
    expect(pactKinkMatch(makeCaptive({ corr: 75, kinkKey: 'hypnosis' }), 'pwhip')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ticket 31 AC: tier × kink-match matrix — exact die/resist/yield/premium
// ---------------------------------------------------------------------------

describe('Ticket 31: tier × kink-match pact matrix (exact values)', () => {
  const TIERS = [
    { corr: 10, key: 'resistant' },
    { corr: 30, key: 'wavering' },
    { corr: 60, key: 'complicit' },
    { corr: 75, key: 'devoted' },
    { corr: 90, key: 'hollowed' },
  ] as const;

  it('die matrix: harsh death chance on a kink-matched pact, per tier', () => {
    for (const t of TIERS) {
      const matched = makeCaptive({ corr: t.corr, kinkKey: 'pain' });
      const unmatched = makeCaptive({ corr: t.corr, kinkKey: 'hypnosis' });
      // pxfear: baseDie 0.09, family [pain]; fresh stamina/cond → no other bonus.
      const expected = { resistant: 90, wavering: 110, complicit: 130, devoted: 90, hollowed: 90 }[
        t.key
      ];
      expect(
        Math.round(getHarshDeathChance(makeDayState(), matched, 'pxfear') * 1000),
        `${t.key} matched die`
      ).toBe(expected);
      // Unmatched pacts stay at the base die for every tier.
      expect(Math.round(getHarshDeathChance(makeDayState(), unmatched, 'pxfear') * 1000)).toBe(90);
    }
  });

  it('resist matrix: kink-matched resist collapse ×0.9 / ×0.8, per tier', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (const t of TIERS) {
      // pbind: Resist -6 (fixed) + Terror +4 + Shame +3, family [bondage, chastity];
      // matched by kinkKey 'bondage' → [bind].
      const matched = predictPactDeltas(
        makeDayState(),
        makeCaptive({ corr: t.corr, kinkKey: 'bondage' }),
        'pbind'
      );
      const expected = {
        resistant: { resist: 44, lines: [] as string[] },
        wavering: { resist: 40, lines: ['Kink match: Resist ×0.9'] }, // 50-6 → ×0.9 → round(39.6)
        complicit: { resist: 35, lines: ['Kink match: Resist ×0.8'] }, // 50-6 → ×0.8 → round(35.2)
        devoted: { resist: 44, lines: ['Kink match: effect ×1.5'] }, // Terror/Shame ×1.5
        hollowed: { resist: 44, lines: ['Kink match: effect ×1.5'] }, // waiver → matched
      }[t.key];
      expect(matched.updated.resist, `${t.key} matched resist`).toBe(expected.resist);
      expect(matched.tierLines, `${t.key} matched tier lines`).toEqual(expected.lines);
    }
    // Unmatched column (kink outside the pact family): baseline for every
    // tier that can actually miss — full resist, no bonus lines. A Hollowed
    // prisoner CANNOT miss a kinkFamily pact (waiver), asserted below.
    for (const t of TIERS.filter((x) => x.key !== 'hollowed')) {
      const unmatched = predictPactDeltas(
        makeDayState(),
        makeCaptive({ corr: t.corr, kinkKey: 'hypnosis' }),
        'pbind'
      );
      expect(unmatched.updated.resist, `${t.key} unmatched resist`).toBe(44);
      expect(unmatched.tierLines, `${t.key} unmatched lines`).toEqual([]);
    }
    expect(pactKinkMatch(makeCaptive({ corr: 90, kinkKey: 'hypnosis' }), 'pbind')).toBe(true);
  });

  it('effect matrix: Devoted/Hollowed kink-matched pacts train +50%', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (const t of TIERS) {
      // pwalk: Shame +10..15 (0.99 → 15), Corr +4; family [exhibition],
      // matched by kinkKey 'exhibition' → [cloth, bind] ∩ [cloth, bind].
      const matched = predictPactDeltas(
        makeDayState(),
        makeCaptive({ corr: t.corr, kinkKey: 'exhibition' }),
        'pwalk'
      );
      const expected = {
        resistant: { shame: 25, corr: 14, lines: [] as string[] },
        wavering: { shame: 25, corr: 34, lines: [] },
        complicit: { shame: 25, corr: 64, lines: [] },
        devoted: { shame: 33, corr: 81, lines: ['Kink match: effect ×1.5'] }, // 15×1.5=23, 4×1.5=6
        hollowed: { shame: 33, corr: 96, lines: ['Kink match: effect ×1.5'] },
      }[t.key];
      expect(matched.updated.shame, `${t.key} shame`).toBe(expected.shame);
      expect(matched.updated.corr, `${t.key} corr`).toBe(expected.corr);
      expect(matched.tierLines, `${t.key} lines`).toEqual(expected.lines);
    }
    // Devoted but UNMATCHED (hypnosis vs exhibition family): no bonus at all.
    const off = predictPactDeltas(
      makeDayState(),
      makeCaptive({ corr: 75, kinkKey: 'hypnosis' }),
      'pwalk'
    );
    expect(off.updated.shame).toBe(25);
    expect(off.updated.corr).toBe(79);
    expect(off.tierLines).toEqual([]);
  });

  it('yield matrix: Complicit kink-matched dairy labor yields ×1.25 exactly', () => {
    for (const t of TIERS) {
      const state = makeDayState([
        makeCaptive({ corr: t.corr, kinkKey: 'lactation', job: 'dairy' }),
      ]);
      const y = getJobSettleYield(state, state.prisoners[0], 'dairy');
      // dairy outputs { food: 5, mp: 8 }; fresh aptitude (pleasure 10 /
      // stamina 100) = 2 stars = ×1.0 — the kink multiplier is the only delta.
      const expected = {
        resistant: { food: 5, mp: 8, on: false },
        wavering: { food: 5, mp: 8, on: false },
        complicit: { food: 6, mp: 10, on: true }, // round(5×1.25), round(8×1.25)
        devoted: { food: 5, mp: 8, on: false },
        hollowed: { food: 5, mp: 8, on: false },
      }[t.key];
      expect(y.food, `${t.key} dairy food`).toBe(expected.food);
      expect(y.mp, `${t.key} dairy mp`).toBe(expected.mp);
      expect(y.kinkYield, `${t.key} kinkYield flag`).toBe(expected.on);
    }
    // Unmatched Complicit worker (kink outside the dairy family): no boost.
    const off = makeDayState([makeCaptive({ corr: 60, kinkKey: 'pain', job: 'dairy' })]);
    const yOff = getJobSettleYield(off, off.prisoners[0], 'dairy');
    expect(yOff.kinkYield).toBe(false);
    expect(yOff.food).toBe(5);
    expect(yOff.mp).toBe(8);
    // The preview surfaces the same shared math (ticket 23 parity precedent).
    const prev = getJobYieldPreview(
      makeDayState([makeCaptive({ corr: 60, kinkKey: 'lactation', job: 'dairy' })]),
      makeCaptive({ corr: 60, kinkKey: 'lactation', job: 'dairy' }),
      'dairy'
    );
    expect(prev.stats).toContain('Kink ×1.25');
  });

  it('premium matrix: Devoted/Hollowed mapped-kink captives sell at ×1.50', () => {
    for (const t of TIERS) {
      const matched = calculateRansom(
        makeDayState(),
        makeCaptive({ corr: t.corr, kinkKey: 'pain' }),
        { forSale: true, buyerId: 'slaver' }
      );
      // Unmatched = kink-less (no mapped kinkKey): full baseline pricing.
      const unmatched = calculateRansom(makeDayState(), makeCaptive({ corr: t.corr }), {
        forSale: true,
        buyerId: 'slaver',
      });
      const premiumOn = t.key === 'devoted' || t.key === 'hollowed';
      expect(matched.breakdown.includes('Kink-Devoted ×1.50'), `${t.key} matched`).toBe(premiumOn);
      expect(unmatched.breakdown.includes('Kink-Devoted ×1.50')).toBe(false);
      if (premiumOn) {
        // The premium must actually price up: the identical captive without
        // the mapped kink is strictly cheaper.
        expect(matched.amount, `${t.key} premium priced up`).toBeGreaterThan(unmatched.amount);
      }
    }
  });

  it('the tier bonus struct matches the spec table row-for-row', () => {
    expect(getCorrTierPactBonus(10)).toMatchObject({
      dieBonus: 0, resistMult: 1, effectMult: 1, premiumMult: 1, yieldMult: 1, drift: 0, waiveKinkFamily: false,
    });
    expect(getCorrTierPactBonus(30)).toMatchObject({
      dieBonus: 0.02, resistMult: 0.9, effectMult: 1, premiumMult: 1, yieldMult: 1, drift: 0, waiveKinkFamily: false,
    });
    expect(getCorrTierPactBonus(60)).toMatchObject({
      dieBonus: 0.04, resistMult: 0.8, effectMult: 1, premiumMult: 1, yieldMult: 1.25, drift: 1, waiveKinkFamily: false,
    });
    expect(getCorrTierPactBonus(75)).toMatchObject({
      dieBonus: 0, resistMult: 1, effectMult: 1.5, premiumMult: 1.5, yieldMult: 1, drift: 0, waiveKinkFamily: false,
    });
    expect(getCorrTierPactBonus(90)).toMatchObject({
      dieBonus: 0, resistMult: 1, effectMult: 1.5, premiumMult: 1.5, yieldMult: 1, drift: 0, waiveKinkFamily: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Ticket 31 AC: conversion gate matrix — new corr clauses at the boundaries
// ---------------------------------------------------------------------------

describe('Ticket 31: conversion lattice corr clauses', () => {
  it('servant alt-route: corr >= 60 AND pleasure3 + obey2, proven at 59/60', () => {
    const alt = makeCaptive({ corr: 60, marks: { obey: 2, pleasure: 3, terror: 0, shame: 0 } });
    expect(canConvertPrisoner(makeDayState([alt]), alt, 'servant').ok).toBe(true);

    const below = makeCaptive({ corr: 59, marks: { obey: 2, pleasure: 3, terror: 0, shame: 0 } });
    const belowRes = canConvertPrisoner(makeDayState([below]), below, 'servant');
    expect(belowRes.ok).toBe(false);
    if (!belowRes.ok) {
      expect(belowRes.reason).toBe(
        'Requires Corruption >= 70, or >= 60 + Pleasure Mark 3 + Obey Mark 2.'
      );
    }

    // The AND-gate is real: each mark short of the clause fails at corr 60.
    const lowPleasure = makeCaptive({ corr: 60, marks: { obey: 2, pleasure: 2, terror: 0, shame: 0 } });
    expect(canConvertPrisoner(makeDayState([lowPleasure]), lowPleasure, 'servant').ok).toBe(false);
    const lowObey = makeCaptive({ corr: 60, marks: { obey: 1, pleasure: 3, terror: 0, shame: 0 } });
    expect(canConvertPrisoner(makeDayState([lowObey]), lowObey, 'servant').ok).toBe(false);
  });

  it('servant primary route unchanged: corr >= 70 plain; 69 plain still fails', () => {
    const ok = makeCaptive({ corr: 70 });
    expect(canConvertPrisoner(makeDayState([ok]), ok, 'servant').ok).toBe(true);
    const fail = makeCaptive({ corr: 69 });
    expect(canConvertPrisoner(makeDayState([fail]), fail, 'servant').ok).toBe(false);
  });

  it('hired stays obey3 OR corr >= 80, proven at 79/80 — kink-less included', () => {
    const byMark = makeCaptive({ corr: 0, marks: { obey: 3, pleasure: 0, terror: 0, shame: 0 } });
    expect(canConvertPrisoner(makeDayState([byMark]), byMark, 'hired').ok).toBe(true);
    const by79 = makeCaptive({ corr: 79 });
    expect(canConvertPrisoner(makeDayState([by79]), by79, 'hired').ok).toBe(false);
    const by80 = makeCaptive({ corr: 80 });
    expect(canConvertPrisoner(makeDayState([by80]), by80, 'hired').ok).toBe(true);
  });

  it('existing gates unchanged for kink-less prisoners (guard/pet/dancer)', () => {
    // guard: resist <= 10 + a free trapped floor.
    const guardOk = makeCaptive({ resist: 10 });
    expect(
      canConvertPrisoner(withFloorType(makeDayState([guardOk]), ['bind']), guardOk, 'guard').ok
    ).toBe(true);
    const resisty = makeCaptive({ resist: 11 });
    expect(
      canConvertPrisoner(withFloorType(makeDayState([resisty]), ['bind']), resisty, 'guard').ok
    ).toBe(false);
    // pet: pleasure3 + obey2 (old gate, no corr clause).
    const petOk = makeCaptive({ marks: { obey: 2, pleasure: 3, terror: 0, shame: 0 } });
    expect(canConvertPrisoner(makeDayState([petOk]), petOk, 'pet').ok).toBe(true);
    const petNo = makeCaptive({ marks: { obey: 2, pleasure: 2, terror: 0, shame: 0 } });
    expect(canConvertPrisoner(makeDayState([petNo]), petNo, 'pet').ok).toBe(false);
    // dancer: shame3 + pleasure2 + brothel facility.
    const dancerOk = makeCaptive({ marks: { obey: 0, pleasure: 2, terror: 0, shame: 3 } });
    expect(canConvertPrisoner(makeDayState([dancerOk]), dancerOk, 'dancer').ok).toBe(false);
    const base = makeDayState([dancerOk]);
    const withBrothel: GameState = {
      ...base,
      estate: {
        ...base.estate,
        facilities: { ...base.estate.facilities, brothel: 1 },
      },
    };
    expect(canConvertPrisoner(withBrothel, dancerOk, 'dancer').ok).toBe(true);
  });

  it('ratchet check: converting a Hollowed prisoner never lowers corr (funnel no-op today)', () => {
    const hollowed = makeCaptive({ corr: 90 });
    const res = convertPrisoner(makeDayState([hollowed]), 1, 'servant');
    expect(res.ok).toBe(true);
    expect(res.state.prisoners[0].converted).toBe('servant');
    expect(res.state.prisoners[0].corr).toBe(90);
    expect(res.state.prisoners[0].corr).toBeGreaterThanOrEqual(CORR_RATCHET_FLOOR);
  });
});

// ---------------------------------------------------------------------------
// Ticket 31 AC: ratchet invariant — no write sequence breaches the 85 floor
// ---------------------------------------------------------------------------

describe('Ticket 31: applyCorrDelta ratchet invariant (property-style)', () => {
  it('no random walk of deltas can pull a Hollowed prisoner below 85', () => {
    const rng = lcg(31);
    for (let trial = 0; trial < 300; trial++) {
      let prisoner = { corr: CORR_RATCHET_FLOOR + Math.floor(rng() * 16) }; // 85..100
      for (let step = 0; step < 50; step++) {
        // Mostly-hostile deltas: big drops, small rises.
        const delta = Math.floor(rng() * 61) - 40; // [-40, +20]
        prisoner = { corr: applyCorrDelta(prisoner, delta) };
        expect(prisoner.corr).toBeGreaterThanOrEqual(CORR_RATCHET_FLOOR);
        expect(prisoner.corr).toBeLessThanOrEqual(100);
      }
    }
  });

  it('identical to plain clamp below the floor (pre-31 behavior preserved)', () => {
    const rng = lcg(77);
    for (let trial = 0; trial < 300; trial++) {
      const corr = Math.floor(rng() * 85); // 0..84 — never Hollowed
      const delta = Math.floor(rng() * 201) - 100; // [-100, +100]
      const p = { corr };
      expect(applyCorrDelta(p, delta)).toBe(clamp(corr + delta, 0, 100));
    }
  });

  it('reaching the floor locks it: 84 can drop but 85 never can', () => {
    expect(applyCorrDelta({ corr: 84 }, -40)).toBe(44);
    expect(applyCorrDelta({ corr: 85 }, -40)).toBe(85);
    expect(applyCorrDelta({ corr: 85 }, 0)).toBe(85);
    expect(applyCorrDelta({ corr: 90 }, 10)).toBe(100);
    expect(applyCorrDelta({ corr: 99 }, 5)).toBe(100);
  });

  it('integration: settle drift + comfort + pact corr on a Hollowed prisoner stay >= 85', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    // Ticket 28 loop at full pressure: matched kink floor + comfort job.
    let state = withFloorType(
      makeDayState([makeCaptive({ corr: 85, kinkKey: 'praise', job: 'bath' })]),
      ['lewd']
    );
    const settled = applyManagementSettle(state, SETTLE_OPTS);
    expect(settled.state.prisoners[0].corr).toBe(87); // +1 drift +1 comfort, floor held
    state = settled.state;

    // Pact corr writes ride the same funnel. pxsoft on a Hollowed captive:
    // the waiver matches it, so Corr +5 rides ×1.5 → +8; resist -20 baseline.
    const pact = executePrisonPact(state, 1, 'pxsoft');
    expect(pact.ok).toBe(true);
    expect(pact.state.prisoners[0].corr).toBe(95);
    expect(pact.state.prisoners[0].corr).toBeGreaterThanOrEqual(CORR_RATCHET_FLOOR);
    expect(pact.summary).toContain('Corr +8');
    expect(pact.summary).toContain('Kink match: effect ×1.5');
  });
});

// ---------------------------------------------------------------------------
// Ticket 31 AC: predicted deltas == actual resolution (parity, ticket 23 bar)
// ---------------------------------------------------------------------------

describe('Ticket 31: predicted deltas match actual resolution byte-for-byte', () => {
  const PRISONERS = {
    resistantKinkless: makeCaptive({ pid: 1, corr: 10 }),
    complicitPain: makeCaptive({ pid: 1, corr: 60, kinkKey: 'pain' }),
    devotedPraise: makeCaptive({ pid: 1, corr: 75, kinkKey: 'praise' }),
    hollowedBondage: makeCaptive({ pid: 1, corr: 90, kinkKey: 'bondage' }),
  } as const;

  const STATS = ['pleasure', 'terror', 'shame', 'resist', 'corr', 'stamina'] as const;

  it('every sampled pact × tier prediction equals the executed deltas and stats', () => {
    // Deterministic RNG: range rolls (pcare 8..12 etc.) resolve identically
    // in prediction and execution; random side-branches (injury, harsh death,
    // intel) never fire at 0.99.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const second = makeCaptive({ pid: 2, name: 'Partner' });
    const base = makeDayState();
    const facState: GameState = {
      ...base,
      estate: {
        ...base.estate,
        facilities: {
          ...base.estate.facilities,
          smithy: 1,
          market: 1,
          brothel: 1,
          dairy: 2,
          beastpen: 1,
          shrine: 2,
          torture: 1,
          watch: 1,
          arena: 1,
          bath: 1,
        },
      },
    };
    let checked = 0;

    for (const pact of PRISON_PACTS) {
      // Resolution-time random stat branches outside the effects math.
      if (pact.id === 'pint' || pact.id === 'ptort') continue;
      for (const prisoner of Object.values(PRISONERS)) {
        const state: GameState = {
          ...facState,
          prisoners: [{ ...prisoner }, { ...second }],
        };
        const pre = predictPactDeltas(state, state.prisoners[0], pact.id);
        const res = executePrisonPact(state, prisoner.pid, pact.id);
        if (!res.ok) continue; // mark/flag-locked combos — the gate matrix covers them
        checked++;

        const prefix = [...pre.deltas, ...pre.tierLines].join(' · ');
        expect(
          res.summary.startsWith(prefix),
          `${pact.id} × corr ${prisoner.corr}: summary "${res.summary}" starts with "${prefix}"`
        ).toBe(true);

        const actual = res.state.prisoners.find((p) => p.pid === prisoner.pid);
        expect(actual, `${pact.id} survivor`).toBeDefined();
        for (const stat of STATS) {
          expect(
            actual![stat],
            `${pact.id} × corr ${prisoner.corr}: ${stat}`
          ).toBe(pre.updated[stat]);
        }
      }
    }
    // Sanity: the sample really exercised many pact × tier combinations.
    expect(checked).toBeGreaterThan(40);
  });

  it('tier bonus lines appear in the summary exactly as predicted', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const devoted = makeCaptive({ pid: 1, corr: 75, kinkKey: 'exhibition' });
    const state = makeDayState([devoted]);
    const pre = predictPactDeltas(state, state.prisoners[0], 'pwalk');
    expect(pre.tierLines).toEqual(['Kink match: effect ×1.5']);
    expect(pre.deltas).toEqual(['Shame +23', 'Corr +6']);
    const res = executePrisonPact(state, 1, 'pwalk');
    expect(res.ok).toBe(true);
    expect(res.summary.startsWith('Shame +23 · Corr +6 · Kink match: effect ×1.5')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ticket 31: Complicit kink-matched drift +1 joins ticket 28's loop
// ---------------------------------------------------------------------------

describe('Ticket 31: Complicit tier drift in the estate settle loop', () => {
  function settleWith(corr: number, kink: string | undefined, floorTypes: string[]) {
    const state = withFloorType(
      makeDayState([makeCaptive({ corr, kinkKey: kink })]),
      floorTypes
    );
    return applyManagementSettle(state, SETTLE_OPTS);
  }

  it('kink-matched Complicit captives drift +2 corr total (floor +1, tier +1)', () => {
    const res = settleWith(60, 'praise', ['lewd']);
    expect(res.state.prisoners[0].corr).toBe(62); // 60 +1 kink floor +1 tier
    expect(res.state.prisoners[0].resist).toBe(49); // 50 -1 kink floor (tier drift never touches resist)
    expect(
      res.ledger.lines.some(
        (row) => row.label === 'Complicit Tier Drift' && row.deltaText === '+corr (tier) ×1'
      )
    ).toBe(true);
  });

  it('no tier drift without the ticket 28 floor match, even when Complicit', () => {
    const res = settleWith(60, 'praise', ['phys']);
    expect(res.state.prisoners[0].corr).toBe(60);
    expect(res.ledger.lines.some((row) => row.label === 'Complicit Tier Drift')).toBe(false);
  });

  it('Devoted and Resistant captives keep the plain ticket 28 drift', () => {
    const devoted = settleWith(75, 'praise', ['lewd']);
    expect(devoted.state.prisoners[0].corr).toBe(76);
    expect(devoted.ledger.lines.some((row) => row.label === 'Complicit Tier Drift')).toBe(false);
    const resistant = settleWith(20, 'praise', ['lewd']);
    expect(resistant.state.prisoners[0].corr).toBe(21);
  });

  it('corr words stay the only thing that crosses the UI boundary (tier chip regression)', () => {
    expect(corrTier(85).key).toBe('hollowed');
    expect(corrTier(62).key).toBe('complicit');
  });
});
