import { describe, expect, it } from 'vitest';
import {
  ALBUM_CATEGORIES,
  ALBUM_CATALOG,
  getAlbumEntriesForCategory,
  getPairedVariantEntry,
} from '../../data/albumCatalog';
import {
  NPC_ASSETS,
  resolveSceneAsset,
  resolveSceneAssetKey,
  SCENE_ASSET_ALIASES,
  SCENE_ASSETS,
} from '../../data/assetManifest';
import {
  FACILITIES,
  SETTLEMENT_CRISES,
  TOWN_ACTIONS,
  TOWN_LEVELS,
} from '../../data/estateData';
import { EXPEDITION_REGIONS, pickExpeditionArt } from '../../data/expeditionData';
import {
  MARK_LABELS,
  PRISON_JOBS,
  PRISON_PACTS,
  resolveJobAsset,
  resolveMarkAsset,
  resolvePactAsset,
  resolvePrisonAsset,
} from '../../data/prisonData';
import { buildEndingNarrationMessages } from '../../llm/promptBuilder';
import type { Prisoner, PrisonerMarks } from '../../types/game';
import {
  computeRankTrialProgress,
  ENDING_DEFS,
  evaluateRankTrials,
  flagOrProtectGameOver,
  GAMEOVER_DEFS,
  rewindGameOverToWaveStart,
} from '../endings';
import { payDebt, resolveDebtVisit } from '../debt';
import { applyManagementSettle, upgradeTown } from '../estate';
import { performOfficerInteraction } from '../officers';
import { applyWaveSettlement } from '../raid';
import { createInitialGameState, withWaveStartSnapshot } from '../saveLoad';
import { finishResultPhase } from '../workflow';

const nodeFsMod = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
  existsSync(path: URL): boolean;
};

function diskAssetExists(url: string): boolean {
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return nodeFsMod.existsSync(new URL(`../../../public/${clean}`, import.meta.url));
}

function makePrisoner(overrides: Partial<Prisoner> = {}): Prisoner {
  return {
    pid: 101,
    name: 'Test Captive',
    grade: 'B',
    raceLabel: 'Human',
    classLabel: 'Knight',
    traits: [],
    capturedWave: 2,
    capturedFloor: 1,
    resist: 30,
    corr: 20,
    gender: 'female',
    stamina: 80,
    staminaMax: 100,
    pleasure: 0,
    terror: 0,
    shame: 10,
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

describe('Asset Manifest & 7-Tab Always-Unlocked Gallery', () => {
  it('verifies every key in SCENE_ASSETS and NPC_ASSETS maps to an existing file on disk', () => {
    for (const [key, url] of Object.entries(SCENE_ASSETS)) {
      expect(diskAssetExists(url), `Missing disk file for SCENE_ASSETS[${key}] -> ${url}`).toBe(true);
    }

    for (const [npc, exprs] of Object.entries(NPC_ASSETS)) {
      for (const [expr, url] of Object.entries(exprs)) {
        expect(diskAssetExists(url), `Missing disk file for NPC_ASSETS[${npc}][${expr}] -> ${url}`).toBe(true);
      }
    }
  });

  it('resolves all canonical alias keys and data module references to real disk files', () => {
    const requiredAliases: [string, string][] = [
      ['dk_stage_e3', 'dk_int_e5'],
      ['dk_fl_fighter', 'dk_fl_display'],
      ['dk_act_granary', 'dk_fac_farmland'],
      ['dk_fac_torture', 'dk_fac_annex'],
      ['dk_war_raid', 'dk_exd_raid'],
      ['dk_exr_hotspring', 'dk_exr_road'],
      ['hotspring', 'dk_exr_road'],
      ['dk_exr_market', 'dk_exd_village'],
      ['market', 'dk_exd_village'],
      ['dk_base_load', 'dk_base_cont'],
    ];

    for (const [alias, expectedCanonical] of requiredAliases) {
      expect(resolveSceneAssetKey(alias)).toBe(expectedCanonical);
      const url = resolveSceneAsset(alias);
      expect(url, `Alias ${alias} failed to resolve`).toBeTruthy();
      expect(diskAssetExists(url!), `Missing disk file for alias ${alias} -> ${url}`).toBe(true);
    }

    for (const aliasKey of Object.keys(SCENE_ASSET_ALIASES)) {
      const url = resolveSceneAsset(aliasKey);
      expect(url, `SCENE_ASSET_ALIASES[${aliasKey}] did not resolve`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }

    for (const fac of FACILITIES) {
      const url = resolveSceneAsset(fac.artKey);
      expect(url, `Facility ${fac.key} art ${fac.artKey} missing`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }
    for (const act of TOWN_ACTIONS) {
      const url = resolveSceneAsset(act.artKey);
      expect(url, `Town action ${act.key} art ${act.artKey} missing`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }
    for (const crisis of SETTLEMENT_CRISES) {
      const url = resolveSceneAsset(crisis.artKey);
      expect(url, `Crisis ${crisis.id} art ${crisis.artKey} missing`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }
    for (const lv of TOWN_LEVELS) {
      const url = resolveSceneAsset(lv.artKey);
      expect(url, `Town level ${lv.lv} art ${lv.artKey} missing`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }
    for (const reg of EXPEDITION_REGIONS) {
      const url = resolveSceneAsset(reg.artKey);
      expect(url, `Region ${reg.key} art ${reg.artKey} missing`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }
    for (const kind of ['camp', 'raid', 'sack', 'flee', 'village', 'capital', 'depart', 'ambush'] as const) {
      const url = pickExpeditionArt({ [kind]: true }, 'road');
      expect(url, `pickExpeditionArt(${kind}) returned undefined`).toBeTruthy();
      expect(diskAssetExists(url!)).toBe(true);
    }
    for (const pact of PRISON_PACTS) {
      const url = resolvePactAsset(pact.id, 'female');
      expect(url && diskAssetExists(url)).toBe(true);
    }
    for (const job of PRISON_JOBS) {
      const url = resolveJobAsset(job.key, 'female');
      expect(url && diskAssetExists(url)).toBe(true);
    }
    for (const mark of Object.keys(MARK_LABELS) as (keyof PrisonerMarks)[]) {
      const url = resolveMarkAsset(mark, 'female');
      expect(url && diskAssetExists(url)).toBe(true);
    }
    expect(resolvePrisonAsset('dk_debt_hand', 'male')).toBe(SCENE_ASSETS.dk_debt_hand_m);
    expect(resolvePrisonAsset('dk_debt_hand', 'female')).toBe(SCENE_ASSETS.dk_debt_hand);
  });

  it('exposes all 7 always-unlocked Gallery categories and filters _m variants cleanly', () => {
    expect(ALBUM_CATEGORIES.map((c) => c.id)).toEqual(['P', 'D', 'T', 'J', 'N', 'S', 'X']);

    for (const cat of ALBUM_CATEGORIES) {
      const items = getAlbumEntriesForCategory(cat.id, 'all', 'all');
      expect(items.length, `Category ${cat.id} should not be empty`).toBeGreaterThan(0);
      for (const item of items) {
        expect(diskAssetExists(item.url), `Broken album entry ${item.key} -> ${item.url}`).toBe(true);
      }
    }

    const maleOnly = ALBUM_CATALOG.filter((e) => e.isMaleVariant);
    expect(maleOnly.length).toBeGreaterThan(0);
    for (const mEntry of maleOnly) {
      expect(mEntry.key.endsWith('_m')).toBe(true);
    }

    const allDebtMale = getAlbumEntriesForCategory('D', 'all', 'male');
    expect(allDebtMale.length).toBeGreaterThan(0);
    expect(allDebtMale.every((e) => e.isMaleVariant)).toBe(true);

    const allDebtBase = getAlbumEntriesForCategory('D', 'all', 'base');
    expect(allDebtBase.length).toBeGreaterThan(0);
    expect(allDebtBase.every((e) => !e.isMaleVariant)).toBe(true);

    const handEntry = ALBUM_CATALOG.find((e) => e.key === 'dk_debt_hand');
    expect(handEntry).toBeDefined();
    const pairedMale = getPairedVariantEntry(handEntry!);
    expect(pairedMale?.key).toBe('dk_debt_hand_m');
    expect(getPairedVariantEntry(pairedMale!)?.key).toBe('dk_debt_hand');
  });
});

describe('5 Canonical Endings & Endless Rank Trials', () => {
  it('unlocks Romance ending when debt hits 0 and Eleonora affinity >= 90', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'debt',
      wave: 4,
      points: 500,
      debt: { ...state.debt, amount: 150, extraLoan: 0, dueWave: 4 },
      officers: {
        ...state.officers,
        eleonora: { ...state.officers.eleonora, aff: 92 },
      },
    };

    const res = payDebt(state, 150);
    expect(res.ok).toBe(true);
    expect(res.state.debt.ended).toBe('romance');
    expect(res.state.debt.amount).toBe(0);
    expect(res.state.endings.unlocked.romance).toBe(4);
    expect(res.state.endings.activeEnding).toBe('romance');
    expect(res.state.endings.endless).toBe(true);
    expect(res.state.rankTrials.active).toBe(true);
    expect(res.state.rankTrials.currentTrial).toBe('wipe3');
  });

  it('unlocks Liberation ending when debt hits 0 and Eleonora affinity < 90', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'debt',
      wave: 5,
      points: 400,
      debt: { ...state.debt, amount: 100, extraLoan: 0, dueWave: 5 },
      officers: {
        ...state.officers,
        eleonora: { ...state.officers.eleonora, aff: 40 },
      },
    };

    const res = payDebt(state, 100);
    expect(res.ok).toBe(true);
    expect(res.state.debt.ended).toBe('liberation');
    expect(res.state.endings.unlocked.liberation).toBe(5);
    expect(res.state.endings.activeEnding).toBe('liberation');
    expect(res.state.endings.endless).toBe(true);
  });

  it('unlocks Romance Dowry ending via E10 when Eleonora Stage 5 and debt <= 600', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'estate',
      wave: 8,
      ap: 2,
      debt: { ...state.debt, amount: 550, extraLoan: 0, reliefUsed: 0 },
      officers: {
        ...state.officers,
        eleonora: { ...state.officers.eleonora, stage: 5, aff: 90 },
      },
    };

    const res = performOfficerInteraction(state, 'E10');
    expect(res.ok).toBe(true);
    expect(res.state.debt.ended).toBe('romance_dowry');
    expect(res.state.debt.amount).toBe(0);
    expect(res.state.endings.unlocked.romance_dowry).toBe(8);
    expect(res.state.endings.activeEnding).toBe('romance_dowry');
    expect(res.state.endings.endless).toBe(true);
    expect(res.state.rankTrials.active).toBe(true);
  });

  it('unlocks Prosperity ending at Town Lv.5 WITHOUT clearing Debt', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'estate',
      wave: 10,
      ap: 3,
      points: 2000,
      debt: { ...state.debt, amount: 900, extraLoan: 0 },
      town: { ...state.town, lv: 4, pop: 1050 },
      estate: {
        ...state.estate,
        facilities: {
          ...state.estate.facilities,
          inn: 3,
          farmland: 3,
          market: 3,
          brothel: 3,
          smithy: 2,
        },
      },
    };

    const res = upgradeTown(state);
    expect(res.ok).toBe(true);
    expect(res.state.town.lv).toBe(5);
    expect(res.state.endings.unlocked.prosperity).toBe(10);
    expect(res.state.endings.endless).toBe(true);
    // Critical contract: Prosperity keeps Goldreich debt active!
    expect(res.state.debt.ended).toBeNull();
    expect(res.state.debt.amount).toBe(900);
    expect(res.state.rankTrials.active).toBe(true);
  });

  it('triggers Bankrupt ending & Game Over at 3 late strikes', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      mode: 'debt',
      wave: 9,
      debt: { ...state.debt, amount: 800, dueWave: 9, lates: 2, paidThisVisit: 0 },
    };

    const res = resolveDebtVisit(state);
    expect(res.ending).toBe('bankrupt');
    expect(res.state.mode).toBe('over');
    expect(res.state.debt.ended).toBe('bankrupt');
    expect(res.state.endings.gameOver).toBe('bankrupt');
    expect(res.state.endings.unlocked.bankrupt).toBe(9);
    expect(res.state.endings.unlocked.go_bankrupt).toBe(9);
  });

  it('tracks & cycles Endless Rank Trials (wipe3 -> jobs5 -> annex1 -> epic) every 5 waves', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      wave: 6,
      points: 200,
      fame: 2,
      endings: {
        ...state.endings,
        unlocked: { liberation: 5 },
        activeEnding: 'liberation',
        endless: true,
      },
      rankTrials: {
        active: true,
        rank: 0,
        currentTrial: 'wipe3',
        progress: 0,
        target: 3,
        nextCheckWave: 11,
        trialStartWave: 6,
        baselineAnnexed: 0,
        consecutiveWipes: 0,
        trialCursor: 0,
      },
    };

    // 1) wipe3: 3 consecutive full wipes advance Rank 0 -> 1 and cycle to jobs5
    state = evaluateRankTrials(state, 'wipe');
    expect(state.rankTrials.progress).toBe(1);
    state = evaluateRankTrials(state, 'wipe');
    expect(state.rankTrials.progress).toBe(2);
    state = evaluateRankTrials(state, 'wipe');
    expect(state.rankTrials.rank).toBe(1);
    expect(state.endings.titles).toContain('Demon Rank 1');
    expect(state.points).toBeGreaterThan(200);
    expect(state.fame).toBe(3);
    expect(state.rankTrials.currentTrial).toBe('jobs5');
    expect(state.rankTrials.nextCheckWave).toBe(6 + 5);

    // 2) jobs5: assign 5 prisoners to jobs -> Rank 1 -> 2, cycle to annex1
    state = {
      ...state,
      wave: 8,
      prisoners: [1, 2, 3, 4, 5].map((pid) => makePrisoner({ pid, job: 'guard' })),
    };
    expect(computeRankTrialProgress(state)).toBe(5);
    state = evaluateRankTrials(state);
    expect(state.rankTrials.rank).toBe(2);
    expect(state.rankTrials.currentTrial).toBe('annex1');

    // 3) annex1: annex 1 rival territory -> Rank 2 -> 3, cycle to epic
    state = {
      ...state,
      wave: 9,
      war: {
        ...state.war,
        rivals: {
          ...state.war.rivals,
          paladin: { ...state.war.rivals.paladin, annexed: true },
        },
      },
    };
    state = evaluateRankTrials(state);
    expect(state.rankTrials.rank).toBe(3);
    expect(state.rankTrials.currentTrial).toBe('epic');

    // 4) epic: capture an EPIC prisoner since trialStartWave -> Rank 3 -> 4, wraps to wipe3
    state = {
      ...state,
      wave: 10,
      prisoners: [
        ...state.prisoners,
        makePrisoner({ pid: 99, grade: 'EPIC', legend: true, capturedWave: 10 }),
      ],
    };
    state = evaluateRankTrials(state);
    expect(state.rankTrials.rank).toBe(4);
    expect(state.endings.titles).toContain('Demon Rank 4');
    expect(state.rankTrials.currentTrial).toBe('wipe3');
  });
});

describe('5 Game Overs, Vault Core Guard, Casual Grace & Wave-Start Rewind', () => {
  it('verifies all 5 canonical Game Overs & Ending narration prompt generation', () => {
    const base = createInitialGameState();
    for (const endKey of Object.keys(ENDING_DEFS) as (keyof typeof ENDING_DEFS)[]) {
      const msgs = buildEndingNarrationMessages(base, 'ending', endKey);
      expect(msgs).toHaveLength(2);
      expect(msgs[1].content).toContain('〔DK-END〕');
      expect(msgs[1].content).toContain(endKey);
    }
    for (const goKey of Object.keys(GAMEOVER_DEFS) as (keyof typeof GAMEOVER_DEFS)[]) {
      const msgs = buildEndingNarrationMessages(base, 'gameover', goKey);
      expect(msgs).toHaveLength(2);
      expect(msgs[1].content).toContain(`go_${goKey}`);
    }
  });

  it('triggers Ruin, Famine, and Riot Game Overs on normal difficulty', () => {
    const base = createInitialGameState();

    // Famine (3 consecutive starvation waves)
    const famineState = {
      ...base,
      mode: 'msettle' as const,
      settings: { ...base.settings, difficulty: 'normal' as const },
      town: { ...base.town, pop: 500, food: 0, famine: 2 },
      estate: {
        ...base.estate,
        facilities: { ...base.estate.facilities, farmland: 0 },
      },
    };
    const famineRes = applyManagementSettle(famineState);
    expect(famineRes.state.mode).toBe('over');
    expect(famineRes.state.endings.gameOver).toBe('famine');

    // Riot (3 consecutive waves of approval <= 10 & order <= 10)
    const riotState = {
      ...base,
      mode: 'msettle' as const,
      settings: { ...base.settings, difficulty: 'normal' as const },
      town: { ...base.town, food: 80, approval: 5, order: 5, riot: 2 },
    };
    const riotRes = applyManagementSettle(riotState);
    expect(riotRes.state.mode).toBe('over');
    expect(riotRes.state.endings.gameOver).toBe('riot');

    // Ruin (pop <= 0)
    const ruinState = {
      ...base,
      settings: { ...base.settings, difficulty: 'normal' as const },
      town: { ...base.town, pop: 0 },
    };
    const ruinRes = flagOrProtectGameOver(ruinState, 'ruin');
    expect(ruinRes.triggered).toBe(true);
    expect(ruinRes.state.mode).toBe('over');
    expect(ruinRes.state.endings.gameOver).toBe('ruin');
  });

  it('activates Vault Core Protection on Core breach when Vault MP >= 50', () => {
    const base = createInitialGameState();
    const state = {
      ...base,
      mode: 'raid' as const,
      points: 0,
      estate: { ...base.estate, vaultMp: 75 },
      party: [],
    };

    const settled = applyWaveSettlement(state, 'breach');
    expect(settled.crises.pendingGameOver).toBeNull();
    expect(settled.estate.vaultMp).toBe(25);
    expect(settled.points).toBeGreaterThanOrEqual(50);
  });

  it('triggers Core Game Over via pendingGameOver when Vault MP < 50 on normal difficulty', () => {
    const base = createInitialGameState();
    const state = {
      ...base,
      mode: 'raid' as const,
      points: 0,
      settings: { ...base.settings, difficulty: 'normal' as const },
      estate: { ...base.estate, vaultMp: 20 },
      party: [],
    };

    const settled = applyWaveSettlement(state, 'breach');
    expect(settled.crises.pendingGameOver).toBe('core');

    const next = finishResultPhase(settled);
    expect(next.mode).toBe('over');
    expect(next.endings.gameOver).toBe('core');
    expect(next.endings.unlocked.go_core).toBe(state.wave);
  });

  it('grants Casual Grace (1/run) on casual difficulty for Core, Ruin, Famine, Riot, then allows collapse once used', () => {
    const base = createInitialGameState();
    const casualRiot = {
      ...base,
      settings: { ...base.settings, difficulty: 'casual' as const },
      estate: { ...base.estate, casualGraceUsed: false },
      town: { ...base.town, approval: 5, order: 5, riot: 3 },
    };

    const firstRescue = flagOrProtectGameOver(casualRiot, 'riot');
    expect(firstRescue.triggered).toBe(false);
    expect(firstRescue.protectedBy).toBe('casual_grace');
    expect(firstRescue.state.estate.casualGraceUsed).toBe(true);
    expect(firstRescue.state.town.riot).toBe(0);
    expect(firstRescue.state.town.approval).toBe(20);
    expect(firstRescue.state.town.order).toBe(20);
    expect(firstRescue.state.mode).not.toBe('over');

    // Second collapse in the same run is no longer protected
    const secondCollapse = flagOrProtectGameOver(firstRescue.state, 'ruin');
    expect(secondCollapse.triggered).toBe(true);
    expect(secondCollapse.protectedBy).toBeNull();
    expect(secondCollapse.state.mode).toBe('over');
    expect(secondCollapse.state.endings.gameOver).toBe('ruin');
  });

  it('rewinds from Game Over back to the captured Wave-Start Build snapshot', () => {
    const wave3Start = withWaveStartSnapshot({
      ...createInitialGameState(),
      wave: 3,
      day: 3,
      mode: 'build',
      points: 420,
    });

    // Simulate wave collapse later in Wave 3
    const breached = flagOrProtectGameOver(
      {
        ...wave3Start,
        mode: 'raid',
        points: 0,
        settings: { ...wave3Start.settings, difficulty: 'normal' },
        estate: { ...wave3Start.estate, vaultMp: 0 },
      },
      'core',
    );
    expect(breached.state.mode).toBe('over');
    expect(breached.state.endings.gameOver).toBe('core');

    const rewound = rewindGameOverToWaveStart(breached.state);
    expect(rewound).not.toBeNull();
    expect(rewound!.mode).toBe('build');
    expect(rewound!.wave).toBe(3);
    expect(rewound!.points).toBe(420);
    expect(rewound!.endings.gameOver).toBeNull();
    expect(rewound!.crises.pendingGameOver).toBeNull();
  });
});
