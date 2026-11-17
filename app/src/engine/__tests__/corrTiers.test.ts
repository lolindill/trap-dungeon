import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORR_RATCHET_FLOOR, CORR_TIERS } from '../../data/constants';
import { applyWaveSettlement } from '../raid';
import { buildPrisonRosterPromptContext } from '../prison';
import { corrTier } from '../tiers';
import { createInitialGameState } from '../saveLoad';
import type { GameState, Hero, Prisoner } from '../../types/game';

function makeHero(over: Partial<Hero> = {}): Hero {
  return {
    slot: 1,
    grade: 'C',
    status: 'captured',
    fallenFloor: 1,
    fallenWave: 1,
    gender: 'female',
    classKey: 'adventurer',
    classLabel: 'adventurer',
    raceKey: 'human',
    raceLabel: 'human',
    traits: [],
    kinkKey: 'praise', // KINK_TRAP_MAP: praise → lewd
    kinkDesc: 'praise and gentle words',
    age: 'late 20s',
    body: 'athletic',
    looks: 'plain',
    persona: 'steady',
    origin: 'guild dispatch',
    exp: 'some',
    marital: 'single',
    intel: 0,
    name: 'SeedHero',
    appearance: '',
    outfit: '',
    personalityText: '',
    skill: 'keen eyes',
    weakness: 'stubborn pride',
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

/**
 * Capture-floor state for the seed matrix: the hero fell on floor 1. When
 * `matched` is set the floor's faced slot types include the hero's kink-mapped
 * type (praise → lewd); otherwise a non-matching type is faced.
 */
function captureState(matched: boolean, hero: Hero): GameState {
  const s = createInitialGameState();
  s.floors = s.floors.map((f) =>
    f.floor === 1
      ? {
          ...f,
          slots: [
            {
              id: 't0',
              text: 'Test Snare — gimmick',
              grade: 'SSS' as const,
              types: matched ? ['lewd'] : ['phys'],
              mpInvested: 10,
            },
          ],
        }
      : f
  );
  s.party = [hero];
  return s;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Corruption seam II — capture seed formula (ticket 27)', () => {
  it('pins the full seed matrix: lewd × aroused × corrFeed(0/3/6) × matchedKink, never > 45', () => {
    // corr = clamp(5 + lewd*20 + aroused*15 + corrFeed*8 + matchedKink*10, 0, 45)
    const matrix: {
      lewd: boolean;
      aroused: boolean;
      feed: number;
      matched: boolean;
      expected: number;
    }[] = [
      { lewd: false, aroused: false, feed: 0, matched: false, expected: 5 },
      { lewd: false, aroused: false, feed: 0, matched: true, expected: 15 },
      { lewd: false, aroused: false, feed: 3, matched: false, expected: 29 },
      { lewd: false, aroused: false, feed: 3, matched: true, expected: 39 },
      { lewd: false, aroused: false, feed: 6, matched: false, expected: 45 },
      { lewd: false, aroused: false, feed: 6, matched: true, expected: 45 },
      { lewd: false, aroused: true, feed: 0, matched: false, expected: 20 },
      { lewd: false, aroused: true, feed: 0, matched: true, expected: 30 },
      { lewd: false, aroused: true, feed: 3, matched: false, expected: 44 },
      { lewd: false, aroused: true, feed: 3, matched: true, expected: 45 },
      { lewd: false, aroused: true, feed: 6, matched: false, expected: 45 },
      { lewd: false, aroused: true, feed: 6, matched: true, expected: 45 },
      { lewd: true, aroused: false, feed: 0, matched: false, expected: 25 },
      { lewd: true, aroused: false, feed: 0, matched: true, expected: 35 },
      { lewd: true, aroused: false, feed: 3, matched: false, expected: 45 },
      { lewd: true, aroused: false, feed: 3, matched: true, expected: 45 },
      { lewd: true, aroused: false, feed: 6, matched: false, expected: 45 },
      { lewd: true, aroused: false, feed: 6, matched: true, expected: 45 },
      { lewd: true, aroused: true, feed: 0, matched: false, expected: 40 },
      { lewd: true, aroused: true, feed: 0, matched: true, expected: 45 },
      { lewd: true, aroused: true, feed: 3, matched: false, expected: 45 },
      { lewd: true, aroused: true, feed: 3, matched: true, expected: 45 },
      { lewd: true, aroused: true, feed: 6, matched: false, expected: 45 },
      { lewd: true, aroused: true, feed: 6, matched: true, expected: 45 },
    ];

    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    for (const row of matrix) {
      const hero = makeHero({
        name: `Seed_${row.lewd ? 'L' : 'l'}${row.aroused ? 'A' : 'a'}${row.feed}F${row.matched ? 'M' : 'm'}`,
        traits: row.lewd ? ['lewd'] : [],
        aroused: row.aroused,
        corrFeed: row.feed,
      });
      const settled = applyWaveSettlement(captureState(row.matched, hero), 'wipe');
      const p = settled.prisoners.find(
        (q) => q.name === hero.name
      );
      expect(p, `prisoner built for ${hero.name}`).toBeDefined();
      expect(
        p!.corr,
        `lewd=${row.lewd} aroused=${row.aroused} feed=${row.feed} matched=${row.matched}`
      ).toBe(row.expected);
      expect(p!.corr).toBeLessThanOrEqual(45);
    }
    spy.mockRestore();
  });

  it('a hero captured on the first room with zero ero exposure seeds corr = 5 (Resistant)', () => {
    const hero = makeHero({ name: 'FreshCapture', corrFeed: undefined });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const settled = applyWaveSettlement(captureState(false, hero), 'wipe');
    spy.mockRestore();

    const p = settled.prisoners[0];
    expect(p.corr).toBe(5);
    expect(corrTier(p.corr).label).toBe('Resistant');
    // Deliberate rebalance (recorded in the ticket resolution): the old seed
    // gave a plain capture corr 0 and a lewd-only capture corr 20; the new
    // floor is 5 — strictly warmer than nothing.
    expect(p.pleasure).toBe(2); // floor(5 * 0.5) — existing derivation untouched
  });

  it('pays the corrFeed ledger out at the capture boundary BEFORE the settlement reset', () => {
    // Feed 3, no other pressure: 5 + 24 = 29. If the reset ever ran before
    // the prisoner build this would regress to the 5 baseline.
    const hero = makeHero({ name: 'FedHero', corrFeed: 3 });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const settled = applyWaveSettlement(captureState(false, hero), 'wipe');
    spy.mockRestore();

    expect(settled.prisoners[0].corr).toBe(29);
    expect(settled.party[0].corrFeed).toBeUndefined(); // reset still fired after
  });
});

describe('Corruption seam II — CORR_TIERS lattice (ticket 27)', () => {
  it('covers 0-100 contiguously with exact boundaries (24/25, 49/50, 69/70, 84/85)', () => {
    expect(CORR_TIERS[0].min).toBe(0);
    expect(CORR_TIERS[CORR_TIERS.length - 1].max).toBe(100);
    for (let i = 0; i < CORR_TIERS.length; i++) {
      if (i === 0) continue;
      expect(CORR_TIERS[i].min).toBe(CORR_TIERS[i - 1].max + 1);
    }
    // The ratchet floor constant is the Hollowed threshold, landed per
    // spec item 3 (tickets 28/31 enforce it).
    expect(CORR_RATCHET_FLOOR).toBe(85);
    expect(CORR_RATCHET_FLOOR).toBe(CORR_TIERS.find((t) => t.key === 'hollowed')!.min);
  });

  it('corrTier boundaries are exact', () => {
    expect(corrTier(0)).toEqual({ key: 'resistant', label: 'Resistant' });
    expect(corrTier(24).key).toBe('resistant');
    expect(corrTier(25).key).toBe('wavering');
    expect(corrTier(49).key).toBe('wavering');
    expect(corrTier(50).key).toBe('complicit');
    expect(corrTier(69).key).toBe('complicit');
    expect(corrTier(70).key).toBe('devoted');
    expect(corrTier(84).key).toBe('devoted');
    expect(corrTier(85).key).toBe('hollowed');
    expect(corrTier(100)).toEqual({ key: 'hollowed', label: 'Hollowed' });
    // Total: out-of-range inputs clamp to the boundary tiers.
    expect(corrTier(-5).key).toBe('resistant');
    expect(corrTier(120).key).toBe('hollowed');
  });
});

describe('Corruption seam II — roster prompt tier words (ticket 27)', () => {
  it('appends exactly one tier word per captive to the existing Res/Corr/Marks line', () => {
    const s = createInitialGameState();
    s.prisoners = [
      makeCaptive({ pid: 1, name: 'Mira', corr: 10 }),
      makeCaptive({ pid: 2, name: 'Nael', corr: 60 }),
      makeCaptive({ pid: 3, name: 'Osse', corr: 90 }),
    ];

    const ctx = buildPrisonRosterPromptContext(s);
    expect(ctx).toContain('Corr 10% (Resistant)');
    expect(ctx).toContain('Corr 60% (Complicit)');
    expect(ctx).toContain('Corr 90% (Hollowed)');

    // Judge ruling: tier WORDS to the LLM — no raw corr ints added beyond
    // what the line already carried. Exactly one `Corr <int>%` per prisoner.
    const corrInts = ctx.match(/Corr \d+%/g) ?? [];
    expect(corrInts).toHaveLength(3);
  });
});
