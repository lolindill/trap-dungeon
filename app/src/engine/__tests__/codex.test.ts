import { describe, expect, it } from 'vitest';
import { TRAP_TYPES } from '../../data/constants';
import {
  CODEX_COMBOS,
  CODEX_SUBCATEGORIES,
  CODEX_TRAPS,
  codexComboToBlueprint,
  codexTrapToBlueprint,
  getCodexTrapById,
  getCombosForCodexTrap,
} from '../../data/trapCodex';
import {
  buildCodexSuggestFillBlueprint,
  buildPrepListPayload,
  createRoomBlueprintFromFloor,
  getRoomInstallCost,
  installBlueprintToFloor,
  installCustomTrap,
  previewPendingTrap,
  removeTrapFromFloor,
  rollCodexSuggestions,
} from '../dungeon';
import { createInitialGameState } from '../saveLoad';

const VALID_TAG_SET = new Set<string>(TRAP_TYPES);

describe('Original Codex (301 presets + 29 combos)', () => {
  it('contains exact Lua counts: 301 presets (179 ero + 122 standard) and 29 combos across 28 subcategories', () => {
    expect(CODEX_TRAPS).toHaveLength(301);
    expect(CODEX_TRAPS.filter((t) => t.category === 'ero')).toHaveLength(179);
    expect(CODEX_TRAPS.filter((t) => t.category === 'standard')).toHaveLength(122);

    expect(CODEX_COMBOS).toHaveLength(29);
    expect(CODEX_COMBOS.filter((c) => c.roomSlots.length === 2)).toHaveLength(27);
    expect(CODEX_COMBOS.filter((c) => c.roomSlots.length === 3)).toHaveLength(2);

    expect(CODEX_SUBCATEGORIES.ero).toHaveLength(13);
    expect(CODEX_SUBCATEGORIES.standard).toHaveLength(15);
  });

  it('assigns valid deterministic D/C/B grades, TRAP_TYPES tags, counters, and bidirectional combo links', () => {
    for (const trap of CODEX_TRAPS) {
      expect(['D', 'C', 'B']).toContain(trap.grade);
      expect(trap.name.trim().length).toBeGreaterThan(0);
      expect(trap.detail.trim().length).toBeGreaterThan(0);
      expect(trap.counters.trim().length).toBeGreaterThan(0);
      expect(trap.types.length).toBeGreaterThanOrEqual(1);
      expect(trap.types.length).toBeLessThanOrEqual(3);
      for (const tag of trap.types) {
        expect(VALID_TAG_SET.has(tag)).toBe(true);
      }
    }

    for (const combo of CODEX_COMBOS) {
      expect(['B', 'A']).toContain(combo.roomSynergy);
      expect(combo.memberIds.length).toBe(combo.roomSlots.length);
      for (const memberId of combo.memberIds) {
        const member = getCodexTrapById(memberId);
        expect(member).toBeDefined();
        expect(member!.comboIds).toContain(combo.id);
        expect(getCombosForCodexTrap(memberId).some((c) => c.id === combo.id)).toBe(true);
      }
    }
  });

  it('converts presets and combos to blueprints in both pre-rated and pending (?) modes', () => {
    const trap = getCodexTrapById('E001')!;
    const preRated = codexTrapToBlueprint(trap);
    expect(preRated.grade).toBe(trap.grade);
    expect(preRated.codexId).toBe('E001');

    const pendingTrap = codexTrapToBlueprint(trap, { deployAsPending: true });
    expect(pendingTrap.grade).toBe('?');

    const combo = CODEX_COMBOS[0];
    const roomBp = codexComboToBlueprint(combo);
    expect(roomBp.kind).toBe('room');
    expect(roomBp.roomSynergy).toBe(combo.roomSynergy);
    expect(roomBp.roomSlots).toHaveLength(combo.roomSlots.length);

    const pendingRoom = codexComboToBlueprint(combo, { deployAsPending: true });
    expect(pendingRoom.roomSynergy).toBe('?');
    expect(pendingRoom.roomSlots?.every((s) => s.grade === '?')).toBe(true);
  });
});

describe('Room Blueprint Shortcuts & Atomic MP Validation', () => {
  it('computes cumulative room install costs and installs atomically onto empty and partial floors', () => {
    expect(getRoomInstallCost(0, 2)).toBe(50 + 120);
    expect(getRoomInstallCost(0, 3)).toBe(50 + 120 + 220);
    expect(getRoomInstallCost(1, 2)).toBe(120 + 220);
    expect(getRoomInstallCost(4, 2)).toBeNull();

    const combo2 = CODEX_COMBOS.find((c) => c.roomSlots.length === 2)!;
    const roomBp = codexComboToBlueprint(combo2);

    // Empty floor installation (50 + 120 = 170 MP)
    let state = { ...createInitialGameState(), points: 500 };
    const res1 = installBlueprintToFloor(state, 1, roomBp);
    expect(res1.ok).toBe(true);
    state = res1.state;
    expect(state.points).toBe(330);
    expect(state.floors[0].slots).toHaveLength(2);
    expect(state.floors[0].synergy).toBe(combo2.roomSynergy);

    // Pre-rated room combo skips AI Prep grading
    const prep = buildPrepListPayload(state.floors);
    expect(prep.newTrapIds).toEqual([]);
    expect(prep.comboFloors).toEqual([]);

    // Partial floor installation (1 existing trap + 2-trap room = 120 + 220 = 340 MP)
    let state2 = { ...createInitialGameState(), points: 500 };
    state2 = installCustomTrap(state2, 2, 'Opening spike wall').state; // 450 MP left
    const res2 = installBlueprintToFloor(state2, 2, roomBp);
    expect(res2.ok).toBe(true);
    expect(res2.state.points).toBe(450 - 340);
    expect(res2.state.floors[1].slots).toHaveLength(3);
    expect(res2.state.floors[1].synergy).toBe(combo2.roomSynergy);
  });

  it('fails atomically without partial MP spend or partial slot writes when MP or slots are insufficient', () => {
    const combo3 = CODEX_COMBOS.find((c) => c.roomSlots.length === 3)!;
    const roomBp3 = codexComboToBlueprint(combo3);

    // Insufficient MP (needs 390, has 389)
    const lowMpState = { ...createInitialGameState(), points: 389 };
    const failMp = installBlueprintToFloor(lowMpState, 1, roomBp3);
    expect(failMp.ok).toBe(false);
    expect(failMp.state.points).toBe(389);
    expect(failMp.state.floors[0].slots).toHaveLength(0);
    expect(failMp.state.floors[0].synergy).toBe('-');

    // Insufficient free slots (4 traps installed, trying to deploy 3-trap room)
    let crowdedState = { ...createInitialGameState(), points: 2000 };
    crowdedState = installCustomTrap(crowdedState, 1, 'T1').state;
    crowdedState = installCustomTrap(crowdedState, 1, 'T2').state;
    crowdedState = installCustomTrap(crowdedState, 1, 'T3').state;
    crowdedState = installCustomTrap(crowdedState, 1, 'T4').state;
    const mpBefore = crowdedState.points;

    const failSlots = installBlueprintToFloor(crowdedState, 1, roomBp3);
    expect(failSlots.ok).toBe(false);
    expect(failSlots.state.points).toBe(mpBefore);
    expect(failSlots.state.floors[0].slots).toHaveLength(4);
  });

  it('resets room synergy to ? when floor traps are modified after deployment, and supports Save Floor as Room Shortcut', () => {
    const combo2 = CODEX_COMBOS.find((c) => c.roomSlots.length === 2)!;
    let state = { ...createInitialGameState(), points: 1000 };
    state = installBlueprintToFloor(state, 3, codexComboToBlueprint(combo2)).state;
    expect(state.floors[2].synergy).toBe(combo2.roomSynergy);

    // Save Floor as Room Shortcut captures all slots and synergy
    const savedRoom = createRoomBlueprintFromFloor(state.floors[2], 'My Saved Combo Room');
    expect(savedRoom).not.toBeNull();
    expect(savedRoom!.kind).toBe('room');
    expect(savedRoom!.name).toBe('My Saved Combo Room');
    expect(savedRoom!.roomSlots).toHaveLength(2);
    expect(savedRoom!.roomSynergy).toBe(combo2.roomSynergy);

    // Re-deploy saved room shortcut onto Floor 4
    const redeploy = installBlueprintToFloor(state, 4, savedRoom!);
    expect(redeploy.ok).toBe(true);
    expect(redeploy.state.floors[3].slots).toHaveLength(2);
    expect(redeploy.state.floors[3].synergy).toBe(combo2.roomSynergy);

    // Modifying Floor 3 resets its synergy to '?' (or '-' if < 2)
    const added = installCustomTrap(redeploy.state, 3, 'Extra snare').state;
    expect(added.floors[2].synergy).toBe('?');
    const removed = removeTrapFromFloor(added, 3, 2).state;
    expect(removed.floors[2].synergy).toBe('?');
  });
});

describe('Build Suggest (X.tpRoll) & ? Grade Preview', () => {
  it('prioritizes X.TPC combo partners when rolling 3 suggestions for a partial floor', () => {
    // E076 (Aphrodisiac Gas Chamber) pairs with E051 (Narrow Wall Wedging) in TPC15
    let state = { ...createInitialGameState(), points: 500 };
    const gas = getCodexTrapById('E076')!;
    state = installBlueprintToFloor(state, 1, codexTrapToBlueprint(gas)).state;

    const rolled = rollCodexSuggestions(state.floors[0], 'ero', 3, () => 0);
    expect(rolled.picks).toHaveLength(3);
    expect(rolled.comboPartnerIds).toContain('E051');
    expect(rolled.picks[0].id).toBe('E051');
  });

  it('fills empty floor slots from Codex within available MP budget', () => {
    // Low budget (110) can afford slot #1 (50 MP) but not slot #1 + #2 (170 MP)
    const lowState = { ...createInitialGameState(), points: 110 };
    const lowFill = buildCodexSuggestFillBlueprint(lowState.floors[0], lowState.points, 'mix', () => 0);
    expect(lowFill.blueprint).not.toBeNull();
    expect(lowFill.trapCount).toBe(1);
    expect(lowFill.totalCost).toBe(50);

    const lowDeploy = installBlueprintToFloor(lowState, 1, lowFill.blueprint!);
    expect(lowDeploy.ok).toBe(true);
    expect(lowDeploy.state.points).toBe(60);
    expect(lowDeploy.state.floors[0].slots).toHaveLength(1);

    // Higher MP (450 MP) deploys a multi-trap Codex combo onto empty floor atomically
    const richState = { ...createInitialGameState(), points: 450 };
    const richFill = buildCodexSuggestFillBlueprint(richState.floors[0], richState.points, 'mix', () => 0);
    expect(richFill.blueprint).not.toBeNull();
    expect(richFill.trapCount).toBeGreaterThanOrEqual(2);
    expect(richFill.totalCost).toBeLessThanOrEqual(450);

    const richDeploy = installBlueprintToFloor(richState, 1, richFill.blueprint!);
    expect(richDeploy.ok).toBe(true);
    expect(richDeploy.state.floors[0].slots).toHaveLength(richFill.trapCount);
    expect(richDeploy.state.points).toBe(450 - richFill.totalCost);

    // Insufficient MP (< 50) returns null cleanly
    const brokeFill = buildCodexSuggestFillBlueprint(richState.floors[0], 40, 'mix');
    expect(brokeFill.blueprint).toBeNull();
    expect(brokeFill.trapCount).toBe(0);
  });

  it('non-destructively previews curated grades and inferred TRAP_TYPES for ? traps', () => {
    const trap = getCodexTrapById('E001')!;
    let state = { ...createInitialGameState(), points: 500 };

    // Codex trap deployed as '?'
    state = installBlueprintToFloor(
      state,
      1,
      codexTrapToBlueprint(trap, { deployAsPending: true })
    ).state;
    const codexSlot = state.floors[0].slots[0];
    expect(codexSlot.grade).toBe('?');

    const codexPreview = previewPendingTrap(codexSlot);
    expect(codexPreview.source).toBe('codex');
    expect(codexPreview.grade).toBe(trap.grade);
    expect(codexPreview.types).toEqual(trap.types);
    expect(codexSlot.grade).toBe('?'); // Never mutates underlying slot

    // Custom '?' trap uses heuristic tag & D/C/B grade preview
    state = installCustomTrap(
      state,
      1,
      'Oil-slick floor igniting roaring fire flames and binding vines'
    ).state;
    const customSlot = state.floors[0].slots[1];
    const customPreview = previewPendingTrap(customSlot);
    expect(customPreview.source).toBe('heuristic');
    expect(['D', 'C', 'B']).toContain(customPreview.grade);
    expect(customPreview.types).toContain('fire');
  });
});
