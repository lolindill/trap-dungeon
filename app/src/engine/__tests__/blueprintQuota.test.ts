import { describe, expect, it } from 'vitest';
import { installBlueprintToFloor } from '../dungeon';
import { createInitialGameState } from '../saveLoad';
import type { GameState, TrapBlueprint } from '../../types/game';

const bp = (id: string, grade: TrapBlueprint['grade']): TrapBlueprint => ({
  id,
  name: `bp-${id}`,
  detail: 'detail',
  category: 'standard',
  grade,
  types: [],
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  kind: 'trap',
});

const rich = (): GameState => ({ ...createInitialGameState(), points: 99999 });

describe('blueprint install obeys the per-wave grade quota', () => {
  it('five S blueprints on one floor end up 1S / 2A / 2B', () => {
    let state = rich();
    for (let i = 0; i < 5; i++) {
      const res = installBlueprintToFloor(state, 1, bp(`s${i}`, 'S'));
      expect(res.ok).toBe(true);
      state = res.state;
    }
    const grades = state.floors[0].slots.map((s) => s.grade);
    expect(grades).toEqual(['S', 'A', 'A', 'B', 'B']);
  });

  it('counts across floors in the same wave, and SS/SSS blueprints are capped to the new-trap max', () => {
    let state = rich();
    state = installBlueprintToFloor(state, 1, bp('a', 'SS')).state;
    state = installBlueprintToFloor(state, 2, bp('b', 'S')).state;
    expect(state.floors[0].slots[0].grade).toBe('S');
    expect(state.floors[1].slots[0].grade).toBe('A');
  });

  it('quota resets on a new wave', () => {
    let state = rich();
    state = installBlueprintToFloor(state, 1, bp('a', 'S')).state;
    state = { ...state, wave: state.wave + 1 };
    state = installBlueprintToFloor(state, 2, bp('b', 'S')).state;
    expect(state.floors[1].slots[0].grade).toBe('S');
  });

  it('lower grades pass through untouched and room blueprints share the same quota', () => {
    let state = rich();
    state = installBlueprintToFloor(state, 1, bp('c', 'B')).state;
    expect(state.floors[0].slots[0].grade).toBe('B');
    const room: TrapBlueprint = {
      ...bp('room', 'S'),
      kind: 'room',
      roomSynergy: 'A',
      roomSlots: [0, 1, 2].map((i) => ({
        name: `r${i}`,
        detail: 'd',
        category: 'standard' as const,
        grade: 'S' as const,
        types: [],
      })),
    };
    const res = installBlueprintToFloor(state, 3, room);
    expect(res.ok).toBe(true);
    expect(res.state.floors[2].slots.map((s) => s.grade)).toEqual(['S', 'A', 'A']);
  });
});
