import { describe, expect, it, vi } from 'vitest';
import {
  HERO_BOND_ORDER,
  HERO_STORY_ORDER,
  LANDMARK_ORDER,
  REALM_COUNTERMEASURES,
  REALM_ORDER,
  RELIC_ORDER,
  WAR_RIVAL_ORDER,
  WONDER_ORDER,
} from '../../data/realmData';
import type { GameState, Prisoner } from '../../types/game';
import { finishManagementSettle, startNewDay } from '../dayLoop';
import { calcPrisonerRansom } from '../debt';
import { assignPrisonerFighterToFloor, getFloorDC, installCustomTrap, toggleFloorLabBuff } from '../dungeon';
import {
  applyManagementSettle,
  buildLandmark,
  buildWonder,
  calcSiegeDefense,
  computeManagementSettle,
  performWarAction,
  resolvePrisonJailbreak,
  resolveRoyalSiegeDay,
} from '../estate';
import { getMaxExpeditionCrew } from '../expedition';
import { generateParty, promoteHeroToEpic } from '../heroes';
import { executePrisoner } from '../prison';
import { applyWaveSettlement, calcRetreatChance, resolveFloorEncounter } from '../raid';
import {
  applyRealmCountermeasure,
  assignPartyBondsAndStories,
  computeHeroSituationAndMetaMods,
  getActiveRealmSituations,
  getGuildPrepInfo,
  grantUnownedRelic,
  rollRealmSituationsForNextWave,
  updateGuildPrepOnRaidEnd,
} from '../realm';
import { createInitialGameState } from '../saveLoad';
import { finishBuildPhase } from '../workflow';

function makePrisoner(pid: number, overrides?: Partial<Prisoner>): Prisoner {
  return {
    pid,
    name: `Captive ${pid}`,
    grade: 'A',
    raceLabel: 'Human',
    classLabel: 'Knight',
    traits: ['brave'],
    capturedWave: 5,
    capturedFloor: 1,
    resist: 70,
    corr: 10,
    gender: 'female',
    stamina: 90,
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
    virgin: false,
    breeding: null,
    intel: 0,
    ...overrides,
  };
}

function setupTrapFloor(state: GameState, floorNum = 1, types: string[] = ['fire']): GameState {
  const res = installCustomTrap(
    { ...state, points: Math.max(state.points, 500) },
    floorNum,
    `Blaze Trap ${floorNum}`
  );
  if (!res.ok) return state;
  return {
    ...res.state,
    floors: res.state.floors.map((fl) =>
      fl.floor === floorNum
        ? {
            ...fl,
            slots: fl.slots.map((s) => ({ ...s, grade: 'A', types })),
          }
        : fl
    ),
  };
}

describe('Phase 3: Realm Situations, Countermeasures, Bonds, Stories & Guild Prep', () => {
  it('defines exact catalog counts: 25 situations, 11 countermeasures, 7 bonds, 8 stories, 4 relics, 3 landmarks, 3 rivals, 3 wonders', () => {
    expect(REALM_ORDER).toHaveLength(25);
    expect(Object.keys(REALM_COUNTERMEASURES)).toHaveLength(11);
    expect(HERO_BOND_ORDER).toHaveLength(7);
    expect(HERO_STORY_ORDER).toHaveLength(8);
    expect(RELIC_ORDER).toHaveLength(4);
    expect(LANDMARK_ORDER).toHaveLength(3);
    expect(WAR_RIVAL_ORDER).toHaveLength(3);
    expect(WONDER_ORDER).toHaveLength(3);
  });

  it('rolls Realm Situations from W10+, obeys Half/Off modes, and gates 1 AP countermeasures to Day', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['lewd', 'mind']);

    // Pre-W10 never rolls
    const early = rollRealmSituationsForNextWave(s, 8, () => 0.1);
    expect(early.rolled).toHaveLength(0);

    // W10+ rolls with P1 = 0.9
    const r10 = rollRealmSituationsForNextWave(s, 9, () => 0.05);
    expect(r10.rolled).toHaveLength(1);
    expect(getActiveRealmSituations(r10.state, 10)).toHaveLength(1);

    // Settings Off disables active situations and rolls
    const offState: GameState = {
      ...r10.state,
      settings: { ...r10.state.settings, realmConfig: 'off' },
    };
    expect(getActiveRealmSituations(offState, 10)).toHaveLength(0);
    expect(rollRealmSituationsForNextWave(offState, 10, () => 0.05).rolled).toHaveLength(0);

    // Settings Half halves positive penalties (e.g., festival +1 -> ceil(1/2)=1, overload +2 -> +1)
    let halfState: GameState = {
      ...s,
      wave: 12,
      mode: 'raid',
      settings: { ...s.settings, realmConfig: 'half' },
      realm: {
        ...s.realm,
        active: [{ key: 'overload', wavesLeft: 1, fromWave: 12, toWave: 12, floors: [1] }],
      },
    };
    const gen = generateParty(halfState, 12, () => 0.5);
    const fullState: GameState = {
      ...halfState,
      settings: { ...halfState.settings, realmConfig: 'on' },
    };
    const modFull = computeHeroSituationAndMetaMods(
      fullState,
      gen.party[0],
      fullState.floors[0],
      gen.party,
      gen.party
    );
    const modHalf = computeHeroSituationAndMetaMods(
      halfState,
      gen.party[0],
      halfState.floors[0],
      gen.party,
      gen.party
    );
    expect(modFull.realmMod).toBe(2);
    expect(modHalf.realmMod).toBe(1);

    // Gate 1 AP countermeasure ('spy') to Day ('estate') mode, allow Intel/MP in Build
    let ctrState: GameState = {
      ...s,
      mode: 'build',
      wave: 11,
      expedition: { ...s.expedition, lootIntel: 3 },
      realm: {
        ...s.realm,
        active: [
          { key: 'spy', wavesLeft: 2, fromWave: 12, toWave: 13, targetFloor: 1 },
          { key: 'iseg', wavesLeft: 1, fromWave: 12, toWave: 12 },
          { key: 'purify', wavesLeft: 1, fromWave: 12, toWave: 12 },
        ],
      },
    };
    const blockedSpy = applyRealmCountermeasure(ctrState, 'spy');
    expect(blockedSpy.ok).toBe(false);
    expect(blockedSpy.message).toContain('DAY ONLY');

    const okIseg = applyRealmCountermeasure(ctrState, 'iseg');
    expect(okIseg.ok).toBe(true);
    expect(okIseg.state.expedition.lootIntel).toBe(1);
    expect(okIseg.state.realm.active.find((c) => c.key === 'iseg')?.countered).toBe(true);

    // Enter Day phase and verify purify requires Dark Shrine Lv1+, while spy succeeds for 1 AP
    let dayState = startNewDay({ ...okIseg.state, wave: 12 });
    dayState = { ...dayState, ap: 3 };
    const blockedPurify = applyRealmCountermeasure(dayState, 'purify');
    expect(blockedPurify.ok).toBe(false);
    expect(blockedPurify.message).toContain('Shrine');

    const okSpy = applyRealmCountermeasure(dayState, 'spy');
    expect(okSpy.ok).toBe(true);
    expect(okSpy.state.ap).toBe(2);
    expect(okSpy.state.realm.active.find((c) => c.key === 'spy')?.countered).toBe(true);
  });

  it('assigns Hero Bonds & Stories, enforces TOTAL_CAP=+5, and updates Guild Prep Lv0-5', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['fire']);
    s = { ...s, wave: 25 };
    const gen = generateParty(s, 25, () => 0.1);
    const partyWithB = gen.party.map((h, idx) => (idx === 0 ? { ...h, grade: 'B' as const } : h));
    const bonded = assignPartyBondsAndStories(partyWithB, 25, () => 0.1);
    expect(bonded.some((h) => Boolean(h.bondKey))).toBe(true);
    expect(bonded.some((h) => Boolean(h.storyKey))).toBe(true);

    // Married heroes never roll lovers or fiance
    const marriedParty = gen.party.map((h) => ({ ...h, marital: 'married' as const }));
    const bondedMarried = assignPartyBondsAndStories(marriedParty, 25, () => 0.05);
    for (const h of bondedMarried) {
      expect(h.bondKey).not.toBe('lovers');
      expect(h.bondKey).not.toBe('fiance');
    }

    // TOTAL_CAP = 5 enforcement
    let capState: GameState = {
      ...s,
      mode: 'raid',
      wave: 25,
      realm: {
        active: [
          { key: 'festival', wavesLeft: 2 }, // +1
          { key: 'alliance', wavesLeft: 1 }, // +1
          { key: 'overload', wavesLeft: 1, floors: [1] }, // +2 -> Realm cap 3
        ],
        cooldowns: {},
        gprep: { lv: 5, topTags: ['fire'], sameSigStreak: 2, lastSig: '' }, // Prep +2
      },
    };
    const highHero = {
      ...gen.party[0],
      slot: 1 as const,
      bondKey: 'lovers',
      bondTargetSlot: 2 as const, // +1
      storyKey: 'revenge', // +1
      status: 'alive' as const,
    };
    const mods = computeHeroSituationAndMetaMods(
      capState,
      highHero,
      capState.floors[0],
      [highHero, { ...gen.party[1], slot: 2 as const, status: 'alive' as const }],
      [highHero, { ...gen.party[1], slot: 2 as const, status: 'alive' as const }]
    );
    expect(mods.realmMod + Math.max(0, mods.bondMod) + mods.prepMod).toBeLessThanOrEqual(5);

    // Guild Prep escalation + Watchspire reduction
    let gpState = updateGuildPrepOnRaidEnd(s, 'wipe');
    expect(gpState.realm.gprep.lv).toBe(1);
    gpState = updateGuildPrepOnRaidEnd(gpState, 'wipe'); // sameSigStreak = 1
    gpState = updateGuildPrepOnRaidEnd(gpState, 'wipe'); // sameSigStreak = 2 -> +2 (+1 wipe, +1 stale)
    expect(gpState.realm.gprep.lv).toBe(4);
    expect(getGuildPrepInfo(gpState, 15).effectiveLv).toBe(4);
    expect(getGuildPrepInfo({ ...gpState, wonders: { ...gpState.wonders, spire: true } }, 15).effectiveLv).toBe(3);

    // Breach reduces gprep (when layout streak resets or layout changes)
    const freshStreakState: GameState = {
      ...gpState,
      realm: { ...gpState.realm, gprep: { ...gpState.realm.gprep, sameSigStreak: 0 } },
    };
    const breached = updateGuildPrepOnRaidEnd(freshStreakState, 'breach');
    expect(breached.realm.gprep.lv).toBe(3);

    // Layout change + breach drops gprep by 2
    const changed = updateGuildPrepOnRaidEnd(setupTrapFloor(gpState, 1, ['poison']), 'breach');
    expect(changed.realm.gprep.lv).toBe(2);
  });
});

describe('Phase 3: SS/SSS/EPIC Grit, 4 Major Crises, and 4 Relics', () => {
  it('consumes SS/SSS/EPIC Grit pips (dead -2, capture -1) and grants Relics cleanly', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['fire']);
    s = { ...s, wave: 25 };
    const ssBase = generateParty(s, 25).party[0];
    const ssHero = {
      ...ssBase,
      grade: 'SS' as const,
      mod: 1,
      tier: 1,
      traits: [] as typeof ssBase.traits,
      gearBonus: 0,
      status: 'alive' as const,
      grit: 3,
      maxGrit: 3,
      cond: '' as const,
    };
    const hardFloor = {
      ...s.floors[0],
      slots: Array.from({ length: 5 }, (_, i) => ({
        id: `t${i}`,
        text: 'Doom Trap',
        grade: 'SSS' as const,
        types: ['fire'],
        mpInvested: 100,
      })),
    };
    const rngSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1); // d20 = 3
    try {
      // Case A: Lethal roll (-margin >= deathMargin) consumes 2 Grit pips (3 -> 1)
      const resDead = resolveFloorEncounter({ ...s, fear: 100 }, hardFloor, [ssHero], 25);
      expect(resDead.party[0].status).toBe('alive');
      expect(resDead.party[0].grit).toBe(1);
      expect(resDead.party[0].cond).toBe('injured');

      // Case B: Capture / blunder roll (die = 1, non-lethal) consumes 1 Grit pip (3 -> 2)
      rngSpy.mockReturnValue(0); // d20 = 1 -> blunder
      const resCap = resolveFloorEncounter({ ...s, fear: 0, lust: 0 }, s.floors[0], [ssHero], 25);
      expect(resCap.party[0].status).toBe('alive');
      expect(resCap.party[0].grit).toBe(2);
      expect(resCap.party[0].cond).toBe('injured');
    } finally {
      rngSpy.mockRestore();
    }

    // Shield relic adds +1 DC on 1F
    const dcBase = getFloorDC(s.floors[0], s);
    const dcShield = getFloorDC(s.floors[0], { ...s, relics: { owned: ['shield'], shards: 0 } });
    expect(dcShield).toBe(dcBase + 1);

    // Lens relic adds +1 intel on finishBuildPhase
    const lensBuild = finishBuildPhase({
      ...s,
      mode: 'build',
      relics: { owned: ['lens'], shards: 0 },
    });
    expect(lensBuild.party.every((h) => h.intel >= 1)).toBe(true);

    // Grant unowned relics 1..4 then fallback +100 MP on 5th
    let relState = s;
    for (let i = 0; i < 4; i++) {
      const g = grantUnownedRelic(relState, 'Test');
      expect(g.granted).not.toBeNull();
      relState = g.state;
    }
    expect(relState.relics.owned).toHaveLength(4);
    const overflow = grantUnownedRelic(relState, 'Test 5');
    expect(overflow.granted).toBeNull();
    expect(overflow.fallbackMp).toBe(100);
  });

  it('triggers Holy Crusade on Wrath 100, spawns Grand Master EPIC on Wave 3, and rewards Relic on victory', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['fire']);
    s = {
      ...s,
      mode: 'estate',
      wave: 26,
      prisoners: [makePrisoner(1)],
      crises: { ...s.crises, wrath: 96, crusade: { active: false, wavesLeft: 0, cooldown: 0 } },
    };

    // Execution adds +5 wrath -> 100
    const execRes = executePrisoner(s, 1);
    expect(execRes.ok).toBe(true);
    expect(execRes.state.crises.wrath).toBe(100);

    // Wave settlement at wrath 100 with a kill triggers 3-wave Holy Crusade
    const partyWithKill = generateParty(execRes.state, 26).party.map((h, i) => ({
      ...h,
      status: i === 0 ? ('dead' as const) : ('retreated' as const),
    }));
    const trig = applyWaveSettlement(
      { ...execRes.state, mode: 'raid', party: partyWithKill },
      'retreat'
    );
    expect(trig.crises.crusade.active).toBe(true);
    expect(trig.crises.crusade.wavesLeft).toBe(3);

    // Crusade Wave 3 finale spawns Grand Master EPIC with No Retreat
    const w3State: GameState = {
      ...trig,
      crises: { ...trig.crises, crusade: { active: true, wavesLeft: 1, cooldown: 38 } },
    };
    const w3Party = generateParty(w3State, 29);
    expect(w3Party.party[0].grade).toBe('EPIC');
    expect(w3Party.party[0].epicKind).toBe('grandmaster');
    expect(calcRetreatChance(w3State, w3Party.party, 2)).toBe(0);

    // Beating Crusade Wave 3 maxes Fame & awards Relic + title
    const wipedW3 = w3Party.party.map((h) => ({ ...h, status: 'dead' as const }));
    const wonCrusade = applyWaveSettlement({ ...w3State, mode: 'raid', party: wipedW3 }, 'wipe');
    expect(wonCrusade.crises.crusade.active).toBe(false);
    expect(wonCrusade.fame).toBe(10);
    expect(wonCrusade.relics.owned).toHaveLength(1);
    expect(wonCrusade.endings.titles).toContain('Crusade Breaker');
  });

  it('tracks Legendary Nemesis memory/adaptation and settles Nemesis defeat cleanly', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['fire']);
    s = { ...s, wave: 25, mode: 'raid' };
    const escapedA = {
      ...generateParty(s, 25).party[0],
      name: 'Valkyrie Kira',
      grade: 'A' as const,
      status: 'retreated' as const,
    };
    const afterEscape = applyWaveSettlement({ ...s, party: [escapedA] }, 'retreat');
    expect(afterEscape.crises.nemesis).toHaveLength(1);

    const nemRec = afterEscape.crises.nemesis[0];
    const nemHero = promoteHeroToEpic(escapedA, 'nemesis', nemRec);
    // Unchanged floor signature grants +3 Memory!
    const mods = computeHeroSituationAndMetaMods(
      afterEscape,
      { ...nemHero, status: 'alive' },
      afterEscape.floors[0],
      [{ ...nemHero, status: 'alive' }],
      [{ ...nemHero, status: 'alive' }]
    );
    expect(mods.nemesisMod).toBe(3);

    // Defeating Nemesis grants 900 total MP (450 + 450) + Relic + title + removes from roster
    const beforeMp = afterEscape.points;
    const settled = applyWaveSettlement(
      { ...afterEscape, wave: 27, party: [{ ...nemHero, status: 'captured' }] },
      'wipe'
    );
    expect(settled.crises.nemesis).toHaveLength(0);
    expect(settled.relics.owned).toHaveLength(1);
    expect(settled.endings.titles).toContain('Nemesis Bane');
    expect(settled.prisoners.some((p) => p.legend && p.resist === 100)).toBe(true);
    expect(settled.points).toBeGreaterThanOrEqual(beforeMp + 900);
  });

  it('runs blocking Royal Siege Bo3 and Prison Jailbreak during M.Settle', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['fire']);
    s = {
      ...s,
      mode: 'msettle',
      wave: 22,
      debt: { ...s.debt, dueWave: 26 },
      town: { ...s.town, lv: 4, pop: 500, guard: 4, order: 60 },
      prisoners: [
        makePrisoner(1, { resist: 80 }),
        makePrisoner(2, { resist: 75 }),
        makePrisoner(3, { resist: 70 }),
      ],
    };

    const settled = applyManagementSettle(s, {
      rollCrisis: false,
      forceSiege: true,
      forceJailbreak: true,
    });
    expect(settled.state.crises.siege.active).toBe(true);
    expect(settled.state.crises.jailbreakPending).toBe(true);

    // finishManagementSettle stays blocked while crises remain
    const blocked = finishManagementSettle(settled.state);
    expect(blocked.mode).toBe('msettle');

    // Resolve Jailbreak win
    const jbWin = resolvePrisonJailbreak(blocked, true);
    expect(jbWin.ok).toBe(true);
    expect(jbWin.state.crises.jailbreakPending).toBe(false);
    expect(jbWin.state.fear).toBeGreaterThan(blocked.fear);

    // Resolve Royal Siege Bo3 (2 wins -> Victory!)
    const day1 = resolveRoyalSiegeDay(jbWin.state, true);
    expect(day1.state.crises.siege.active).toBe(true);
    expect(day1.state.crises.siege.wins).toBe(1);

    const day2 = resolveRoyalSiegeDay(day1.state, true);
    expect(day2.state.crises.siege.active).toBe(false);
    expect(day2.state.endings.titles).toContain('Defender of the Realm');
    expect(day2.state.prisoners.some((p) => p.name === 'Royal Knight-Captain')).toBe(true);

    // Now finishManagementSettle advances cleanly to Wave 23 Build!
    const done = finishManagementSettle(day2.state);
    expect(done.mode).toBe('build');
  });
});

describe('Phase 3: Town Lv 6-7 Landmarks & War & Wonders', () => {
  it('constructs hq/lab/cmd landmarks, toggles up to 2 lab floors, and buffs guard/expedition', () => {
    let s = setupTrapFloor(createInitialGameState(), 1, ['fire']);
    s = setupTrapFloor(s, 2, ['poison']);
    s = setupTrapFloor(s, 3, ['pit']);
    s = {
      ...s,
      mode: 'estate',
      day: 20,
      ap: 5,
      apMax: 5,
      points: 5000,
      town: { ...s.town, lv: 7 },
      prisoners: [makePrisoner(10, { converted: null, stamina: 100 })],
    };

    const hqRes = buildLandmark(s, 'hq');
    expect(hqRes.ok).toBe(true);
    expect(hqRes.state.estate.landmarks.hq).toBe(true);
    expect(getMaxExpeditionCrew(hqRes.state)).toBe(4);

    const labRes = buildLandmark(hqRes.state, 'lab');
    expect(labRes.ok).toBe(true);
    const cmdRes = buildLandmark(labRes.state, 'cmd');
    expect(cmdRes.ok).toBe(true);

    // Toggle Lab buff on 1F & 2F (max 2)
    let st = cmdRes.state;
    const baseDc1 = getFloorDC(st.floors[0], st);
    st = toggleFloorLabBuff(st, 1).state;
    expect(getFloorDC(st.floors[0], st)).toBe(baseDc1 + 1);
    st = toggleFloorLabBuff(st, 2).state;
    const thirdLab = toggleFloorLabBuff(st, 3);
    expect(thirdLab.ok).toBe(false);

    // Assign Prisoner fighter to 3F -> cmd adds +1 DC alongside fighter bonus
    const before3F = getFloorDC(st.floors[2], st);
    const assigned = assignPrisonerFighterToFloor(st, 3, 10);
    expect(assigned.ok).toBe(true);
    expect(getFloorDC(assigned.state.floors[2], assigned.state)).toBeGreaterThanOrEqual(before3F + 2);
  });

  it('executes War Scout/Raid/Annex & Great Wonders with passive bonuses', () => {
    let s = startNewDay({
      ...createInitialGameState(),
      wave: 15,
      points: 10000,
      town: { ...createInitialGameState().town, lv: 4, guard: 5, food: 50 },
      prisoners: [makePrisoner(1, { grade: 'S', resist: 20 })],
    });
    s = { ...s, ap: 10 };

    const scoutRes = performWarAction(s, 'scout', 'merchant');
    expect(scoutRes.ok).toBe(true);
    expect(scoutRes.state.war.rivals.merchant.scouted).toBe(true);

    const raid1 = performWarAction(scoutRes.state, 'raid', 'merchant', true);
    expect(raid1.ok).toBe(true);
    expect(raid1.state.war.rivals.merchant.wins).toBe(1);

    // Cannot annex before 2 wins
    const earlyAnnex = performWarAction(raid1.state, 'annex', 'merchant', true);
    expect(earlyAnnex.ok).toBe(false);

    const raid2 = performWarAction(raid1.state, 'raid', 'merchant', true);
    const annex = performWarAction(raid2.state, 'annex', 'merchant', true);
    expect(annex.ok).toBe(true);
    expect(annex.state.war.rivals.merchant.annexed).toBe(true);
    expect(calcSiegeDefense(annex.state)).toBeGreaterThan(calcSiegeDefense(s));

    // Build Gold Wonder (+15% ransom stacking with Merchant +10%)
    const goldRes = buildWonder(annex.state, 'gold');
    expect(goldRes.ok).toBe(true);
    expect(goldRes.state.wonders.gold).toBe(true);
    const baseRansom = calcPrisonerRansom(s, s.prisoners[0], true);
    const boostedRansom = calcPrisonerRansom(goldRes.state, goldRes.state.prisoners[0], true);
    expect(boostedRansom).toBeGreaterThan(baseRansom);

    // Compute M.Settle includes Annexed territory net income (+60 MP at Lv4: 30 + 40 - 10)
    const ledger = computeManagementSettle(goldRes.state);
    expect(ledger.lines.some((l) => l.label.includes('Annexed Territories'))).toBe(true);
  });
});
