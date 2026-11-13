import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CFG } from '../../data/constants';
import { STARTER_BLUEPRINTS } from '../../data/starterBlueprints';
import type { GameState } from '../../types/game';
import { installBlueprintToFloor, installCustomTrap } from '../dungeon';
import { applyPrepReply } from '../tagParser';
import {
  STORAGE_GAME_KEY,
  STORAGE_LLM_KEY,
  STORAGE_SLOTS_KEY,
  captureWaveStartSnapshot,
  createDefaultLlmConfig,
  createInitialGameState,
  deleteSaveSlot,
  loadBlueprints,
  loadFromSlot,
  loadLlmConfig,
  loadSaveSlots,
  loadSavedState,
  migrateBlueprints,
  migrateGameState,
  persistLlmConfig,
  renameSaveSlot,
  restoreWaveStartSnapshot,
  saveToSlot,
} from '../saveLoad';
import {
  cancelPrepBackToBuild,
  finishBuildPhase,
  finishSettlementToNextBuild,
  startInvasionPhase,
} from '../workflow';
import { advanceRaidStep } from '../raid';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('schemaVersion 2 & Phase 1 -> v2 migration', () => {
  it('auto-upgrades a Phase 1 save without schemaVersion anchored to currentWave', () => {
    const phase1Raw = {
      version: '1.15.2-standalone',
      mode: 'build',
      points: 245,
      wave: 4,
      floorCursor: 0,
      selectedFloor: 2,
      kills: 7,
      famePoints: 34,
      fame: 3,
      momentum: 2,
      fear: 18,
      lust: 22,
      guildPoints: 40,
      guildActive: true,
      floors: [
        {
          floor: 1,
          slots: [
            {
              id: 't_1',
              text: 'Tentacle Pit',
              grade: 'B',
              types: ['lewd', 'bind'],
              mpInvested: 50,
            },
          ],
          synergy: '-',
        },
      ],
      party: [],
      prisoners: [
        {
          pid: 1,
          name: 'Seraphina',
          grade: 'B',
          raceLabel: 'high elf',
          classLabel: 'knight',
          traits: ['noble', 'tough'],
          capturedWave: 3,
          capturedFloor: 2,
          resist: 60,
          corr: 25,
        },
        {
          pid: 2,
          name: 'Darian',
          grade: 'C',
          raceLabel: 'human',
          classLabel: 'rogue',
          traits: ['nimble'],
          capturedWave: 4,
          capturedFloor: 1,
          resist: 40,
          corr: 10,
          gender: 'male',
        },
      ],
      nextPid: 3,
      evalScores: null,
      prepMeta: null,
      awaitingNarration: false,
      raidFirstRoom: true,
      lastRaidDetail: '',
      lastOutcome: null,
      lastAudit: [],
      lastSettlement: null,
      flash: 'Phase 1 save',
      chronicle: [
        {
          id: 'c1',
          kind: 'opening',
          title: 'Start',
          text: 'Opening',
          timestamp: 1000,
        },
      ],
      recentHeroSignatures: [],
      settings: {
        genderPref: 'female',
        raceScope: 'fantasy',
        gore: true,
        autoScrollChronicle: false,
        aiLanguage: 'en',
      },
    };

    const migrated = migrateGameState(phase1Raw);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.wave).toBe(4);
    expect(migrated.day).toBe(4);
    expect(migrated.ap).toBe(3);
    expect(migrated.apMax).toBe(3);
    expect(migrated.points).toBe(245);

    // Anchored Goldreich debt
    expect(migrated.debt.amount).toBe(3000);
    expect(migrated.debt.startWave).toBe(4);
    expect(migrated.debt.dueWave).toBe(7);
    expect(migrated.debt.patience).toBe(60);

    // Lv1 Town & Officers
    expect(migrated.town.lv).toBe(1);
    expect(migrated.town.pop).toBe(60);
    expect(migrated.town.food).toBe(40);
    expect(migrated.officers.vesper.aff).toBe(0);
    expect(migrated.officers.lilim.aff).toBe(0);
    expect(migrated.officers.eleonora.aff).toBe(10);

    // Phase 3 slices initialized
    expect(migrated.monsters).toEqual([]);
    expect(migrated.eggs).toEqual([]);
    expect(migrated.expedition.active).toBe(false);
    expect(migrated.realm.gprep.lv).toBe(0);
    expect(migrated.crises.wrath).toBe(0);
    expect(migrated.relics.owned).toEqual([]);
    expect(migrated.rankTrials.active).toBe(false);

    // Floors expanded cleanly to 7 with existing trap preserved
    expect(migrated.floors).toHaveLength(7);
    expect(migrated.floors[0].slots[0].text).toBe('Tentacle Pit');
    expect(migrated.floors[0].combatSlots).toEqual([]);

    // Prisoners backfilled accurately
    expect(migrated.prisoners).toHaveLength(2);
    expect(migrated.prisoners[0]).toMatchObject({
      pid: 1,
      name: 'Seraphina',
      gender: 'female',
      stamina: 100,
      staminaMax: 120,
      pleasure: 12,
      terror: 12,
      shame: 0,
      marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
      job: null,
      converted: null,
    });
    expect(migrated.prisoners[1].gender).toBe('male');
    expect(migrated.prisoners[1].staminaMax).toBe(100);

    // Settings preserved + Phase 2/3 defaults added
    expect(migrated.settings).toMatchObject({
      genderPref: 'female',
      raceScope: 'fantasy',
      gore: true,
      autoScrollChronicle: false,
      aiLanguage: 'en',
      difficulty: 'normal',
      skipDay: false,
      upkeepEnabled: false,
      realmConfig: 'on',
    });

    // Build mode save automatically receives a non-recursive waveStartSnapshot
    expect(migrated.waveStartSnapshot).not.toBeNull();
    expect('waveStartSnapshot' in (migrated.waveStartSnapshot as object)).toBe(false);
  });

  it('handles explicit schemaVersion 1, corrupted inputs, and localStorage startup migration', () => {
    const v1WithVersion = {
      schemaVersion: 1,
      mode: 'estate',
      wave: 2,
      points: 180,
      floors: [],
      settings: { difficulty: 'hard' },
    };
    const m1 = migrateGameState(v1WithVersion);
    expect(m1.schemaVersion).toBe(2);
    expect(m1.debt.dueWave).toBe(5);
    expect(m1.settings.difficulty).toBe('hard');
    expect(m1.settings.upkeepEnabled).toBe(true); // Hard defaults upkeep ON

    // Corrupted inputs fall back gracefully
    expect(migrateGameState(null).schemaVersion).toBe(2);
    expect(migrateGameState('invalid').points).toBe(CFG.START_POINTS);
    expect(migrateGameState({ floors: 'bad' }).floors).toHaveLength(7);

    // localStorage startup migration
    localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify(v1WithVersion));
    const loaded = loadSavedState();
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.wave).toBe(2);
    expect(loaded.debt.dueWave).toBe(5);
  });
});

describe('TrapBlueprint migration', () => {
  it('upgrades Phase 1 blueprints and supports Room Shortcut entries', () => {
    const raw = [
      {
        id: 'bp_old',
        name: 'Sticky Web',
        detail: 'Thick webbing slows intruders.',
        category: 'ero',
        grade: 'C',
        types: ['bind'],
        pinned: true,
        createdAt: 100,
        updatedAt: 200,
      },
      {
        id: 'bp_room_1',
        name: 'Slime + Shock Combo',
        detail: 'Conductive slime followed by lightning coils.',
        category: 'standard',
        grade: 'B',
        types: ['water', 'elec'],
        kind: 'room',
        roomSynergy: 'A',
        codexId: 'tpc_01',
        roomSlots: [
          {
            name: 'Conductive Gel',
            detail: 'Coats boots in conductive fluid.',
            category: 'standard',
            grade: 'C',
            types: ['water'],
          },
          {
            name: 'Arc Pylon',
            detail: 'Discharges lightning.',
            category: 'standard',
            grade: 'B',
            types: ['elec'],
          },
        ],
      },
      { invalid: true },
    ];

    const migrated = migrateBlueprints(raw);
    expect(migrated).toHaveLength(2);
    expect(migrated[0].kind).toBe('trap');
    expect(migrated[0].name).toBe('Sticky Web');
    expect(migrated[1].kind).toBe('room');
    expect(migrated[1].roomSynergy).toBe('A');
    expect(migrated[1].roomSlots).toHaveLength(2);
    expect(migrated[1].codexId).toBe('tpc_01');

    expect(migrateBlueprints(null)).toEqual([]);
    expect(loadBlueprints().length).toBe(STARTER_BLUEPRINTS.length);
  });
});

describe('Save Slots 1..5 CRUD and LlmConfig separation', () => {
  it('saves, previews metadata, renames, loads, and deletes slots without touching LlmConfig', () => {
    const llm = { ...createDefaultLlmConfig(), apiKey: 'sk-secret-test-key', model: 'claude-3-5-sonnet-latest' };
    persistLlmConfig(llm);

    let state = createInitialGameState();
    state = { ...state, wave: 6, day: 6, points: 420 };
    state.debt.amount = 1850;
    state.debt.extraLoan = 150;

    const saved = saveToSlot(2, state, 'Before Debt Visit');
    expect(saved.meta).toMatchObject({
      slotId: 2,
      slotName: 'Before Debt Visit',
      wave: 6,
      day: 6,
      points: 420,
      debt: 2000,
      mode: 'build',
    });
    expect(typeof saved.meta.savedAt).toBe('number');

    // Overwriting without customName preserves existing slot name
    const updatedState: GameState = { ...state, points: 999 };
    const overwritten = saveToSlot(2, updatedState);
    expect(overwritten.meta.slotName).toBe('Before Debt Visit');
    expect(overwritten.meta.points).toBe(999);

    // Rename slot
    const renamed = renameSaveSlot(2, 'Wave 6 Checkpoint');
    expect(renamed?.meta.slotName).toBe('Wave 6 Checkpoint');

    // Load from slot returns independent migrated state
    const loaded = loadFromSlot(2);
    expect(loaded).not.toBeNull();
    expect(loaded!.points).toBe(999);
    expect(loaded!.debt.amount).toBe(1850);
    expect(loaded!.schemaVersion).toBe(2);

    // Ensure LlmConfig is NOT stored in slots payload
    const rawSlotsStr = localStorage.getItem(STORAGE_SLOTS_KEY) ?? '';
    expect(rawSlotsStr).not.toContain('sk-secret-test-key');
    expect(loadLlmConfig().apiKey).toBe('sk-secret-test-key');

    // Delete slot
    deleteSaveSlot(2);
    expect(loadFromSlot(2)).toBeNull();
    expect(loadSaveSlots()[2]).toBeNull();
    expect(localStorage.getItem(STORAGE_LLM_KEY)).toContain('sk-secret-test-key');
  });
});

describe('waveStartSnapshot capture and rewind', () => {
  it('auto-captures non-recursive snapshots at Build start and preserves them across Prep cancel', () => {
    const initial = createInitialGameState();
    expect(initial.waveStartSnapshot).not.toBeNull();
    expect(initial.waveStartSnapshot!.points).toBe(CFG.START_POINTS);
    expect('waveStartSnapshot' in (initial.waveStartSnapshot as object)).toBe(false);

    // Spend MP in Build and save to Slot 1 separately
    let state = installCustomTrap(initial, 1, 'Spike Trap').state;
    expect(state.points).toBe(CFG.START_POINTS - 50);
    saveToSlot(1, state, 'Manual Slot 1');

    // Cancel Prep back to Build should NOT overwrite waveStartSnapshot
    state = finishBuildPhase(state);
    state = cancelPrepBackToBuild(state);
    expect(state.waveStartSnapshot!.points).toBe(CFG.START_POINTS);

    // Rewinding restores Wave 0 Build start (300 MP, empty floor) without touching Slot 1
    const rewound = restoreWaveStartSnapshot(state);
    expect(rewound).not.toBeNull();
    expect(rewound!.points).toBe(CFG.START_POINTS);
    expect(rewound!.floors[0].slots).toHaveLength(0);
    expect(rewound!.waveStartSnapshot).not.toBeNull();
    expect(loadFromSlot(1)?.points).toBe(CFG.START_POINTS - 50);

    // Full wave completion captures a fresh snapshot at start of next Build
    let run = { ...createInitialGameState(), points: 500 };
    const eliteBp = { ...STARTER_BLUEPRINTS[0], grade: 'SSS' as const };
    run = installBlueprintToFloor(run, 1, eliteBp).state;
    run = finishBuildPhase(run);
    run = applyPrepReply(
      run,
      `<eval effectiveness="8" novelty="8" fun="8" aesthetics="8" lewdness="6" overall="A"/>
       <hero n="1">\nname: A\n</hero><hero n="2">\nname: B\n</hero><hero n="3">\nname: C\n</hero>`
    ).state;
    run = startInvasionPhase(run);

    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const raided = advanceRaidStep(run);
    expect(raided.isFinal).toBe(true);

    const nextBuild = finishSettlementToNextBuild(raided.state);
    expect(nextBuild.mode).toBe('build');
    expect(nextBuild.wave).toBe(1);
    expect(nextBuild.waveStartSnapshot).not.toBeNull();
    expect(nextBuild.waveStartSnapshot!.wave).toBe(1);
    expect(nextBuild.waveStartSnapshot!.points).toBe(nextBuild.points);
    expect('waveStartSnapshot' in (nextBuild.waveStartSnapshot as object)).toBe(false);

    // Direct helper test
    const directSnap = captureWaveStartSnapshot(nextBuild);
    expect('waveStartSnapshot' in (directSnap as object)).toBe(false);
  });
});
