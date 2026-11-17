import { resolveSceneAsset } from '../data/assetManifest';
import { CFG } from '../data/constants';
import type { ChronicleEntry, GameState, RaidOutcome } from '../types/game';
import { startNewDay } from './dayLoop';
import { enterGameOver } from './endings';
import {
  buildPrepListPayload,
  finalizePendingGrades,
  getNextTrapFloor,
  resetPendingGrades,
  trapGradeIndex,
} from './dungeon';
import { generateParty } from './heroes';
import { isTrapActive } from './raid';
import { resolveRaidModifiers } from './raidMods';
import { clamp } from './rng';
import { withWaveStartSnapshot } from './saveLoad';

export function makeChronicleId(prefix = 'entry'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function pickPhaseBanner(
  kind: 'opening' | 'prep' | 'boss' | 'day' | 'debt' | 'exped' | RaidOutcome,
  wave = 1
): string | undefined {
  if (kind === 'opening') return resolveSceneAsset('dk_open_1');
  if (kind === 'prep') return resolveSceneAsset(wave >= 5 ? 'dk_base_prep_2' : 'dk_base_prep');
  if (kind === 'boss') return resolveSceneAsset('dk_base_raid_boss');
  if (kind === 'day') return resolveSceneAsset('dk_base_day');
  if (kind === 'debt') return resolveSceneAsset('dk_base_debt');
  if (kind === 'exped') return resolveSceneAsset('dk_exd_depart');
  const map: Record<RaidOutcome, string> = {
    pass: 'dk_base_raid_pass',
    fall: 'dk_base_raid_fall',
    wipe: 'dk_base_raid_wipe',
    retreat: 'dk_base_raid_retreat',
    partial: 'dk_base_raid_partial',
    breach: 'dk_base_raid_breach',
  };
  return resolveSceneAsset(map[kind]) ?? resolveSceneAsset('dk_base_raid');
}

export function appendChronicleEntry(
  state: GameState,
  entry: Omit<ChronicleEntry, 'id' | 'timestamp'>
): GameState {
  const fullEntry: ChronicleEntry = {
    ...entry,
    id: makeChronicleId(entry.kind),
    timestamp: Date.now(),
  };
  const nextChronicle = [...state.chronicle, fullEntry].slice(-120);
  return {
    ...state,
    chronicle: nextChronicle,
  };
}

export function finishBuildPhase(state: GameState): GameState {
  if (state.mode !== 'build') return state;

  const nextWave = state.wave + 1;
  const prep = buildPrepListPayload(state.floors);
  const generated = generateParty(state, nextWave);
  // Ticket 15 raid-mods seam: prep intel (Lens relic + estate + crisis `intel`;
  // crisis `intel_zero` forces the whole wave's intel to 0).
  const prepMods = resolveRaidModifiers(state, {
    floorNum: 0,
    isFirstRoom: false,
    hasMonsterOnFloor: false,
  });
  const hasLens = state.relics.owned.includes('lens');
  const intel = prepMods.prepIntelZero ? 0 : (hasLens ? 1 : 0) + prepMods.prepIntelDelta;
  const party = generated.party.map((h) => ({ ...h, intel }));

  const pendingNote =
    prep.newTrapIds.length > 0
      ? `${prep.newTrapIds.length} new trap(s) queued for grading`
      : prep.comboFloors.length > 0
        ? `${prep.comboFloors.length} room combo(s) queued for grading`
        : 'All installed traps pre-rated — quick briefing ready';

  return {
    ...state,
    mode: 'prep',
    party,
    recentHeroSignatures: generated.recentHeroSignatures,
    crises: generated.triggeredNemesisId
      ? { ...state.crises, lastNemesisWave: nextWave }
      : state.crises,
    evalScores: null,
    prepMeta: {
      wave: nextWave,
      newTrapIds: prep.newTrapIds,
      comboFloors: prep.comboFloors,
      gradedSummary: '',
      heroesReady: false,
    },
    awaitingNarration: false,
    lastSettlement: null,
    lastOutcome: null,
    lastAudit: [],
    lastRaidDetail: '',
    flash: `Wave ${nextWave} Prep — ${pendingNote}`,
  };
}

/**
 * Ticket 30 prep-intel counterplay (mirrors the in-raid disarmer trait): the
 * party spends ONE intel slot — a single point off the first hero holding
 * intel — to mark the highest-grade ACTIVE slot of the scouted floor (the
 * entry floor, i.e. the first floor with traps) `disarmed` for the coming
 * raid. Once per prep; the cut persists in the floor slots and the settlement
 * re-arms it as usual.
 */
export function prepIntelDisarm(state: GameState): { ok: boolean; state: GameState } {
  if (state.mode !== 'prep') {
    return {
      ok: false,
      state: { ...state, flash: 'Prep-intel disarm is only available during Prep.' },
    };
  }
  if (state.prepMeta?.intelDisarmDone) {
    return {
      ok: false,
      state: { ...state, flash: 'Prep intel was already spent on a disarm this wave.' },
    };
  }
  const holder = state.party.find((h) => h.intel > 0);
  if (!holder) {
    return {
      ok: false,
      state: { ...state, flash: 'No prep intel available — the party carries 0 intel.' },
    };
  }
  const scoutedFloor = getNextTrapFloor(state.floors, 1);
  const activeIdx: number[] = [];
  (scoutedFloor?.slots ?? []).forEach((s, idx) => {
    if (isTrapActive(s)) activeIdx.push(idx);
  });
  if (!scoutedFloor || activeIdx.length === 0) {
    return {
      ok: false,
      state: { ...state, flash: 'No scouted floor with an armed trap to cut.' },
    };
  }
  let best = activeIdx[0];
  for (const idx of activeIdx) {
    if (trapGradeIndex(scoutedFloor.slots[idx].grade) > trapGradeIndex(scoutedFloor.slots[best].grade)) {
      best = idx;
    }
  }

  const floorIdx = scoutedFloor.floor - 1;
  const nextFloors = state.floors.map((f, i) =>
    i === floorIdx
      ? {
          ...f,
          slots: f.slots.map((s, si) =>
            si === best ? { ...s, status: 'disarmed' as const } : s
          ),
        }
      : f
  );
  const nextParty = state.party.map((h) =>
    h.slot === holder.slot ? { ...h, intel: h.intel - 1 } : h
  );
  const cutLabel = scoutedFloor.slots[best].text.split(' — ')[0].slice(0, 24);
  const holderName = holder.name || `${holder.raceLabel} ${holder.classLabel}`;
  return {
    ok: true,
    state: {
      ...state,
      floors: nextFloors,
      party: nextParty,
      prepMeta: state.prepMeta ? { ...state.prepMeta, intelDisarmDone: true } : state.prepMeta,
      flash: `Prep intel spent: the party cut "${cutLabel}" on ${scoutedFloor.floor}F (-1 intel from ${holderName}).`,
    },
  };
}

export function cancelPrepBackToBuild(state: GameState): GameState {
  if (state.mode !== 'prep') return state;

  const floors = resetPendingGrades(
    state.floors,
    state.prepMeta?.newTrapIds ?? [],
    state.prepMeta?.comboFloors ?? []
  );

  return {
    ...state,
    mode: 'build',
    floors,
    party: [],
    evalScores: null,
    prepMeta: null,
    awaitingNarration: false,
    flash: 'Returned to Build Mode — pending grades restored for editing.',
  };
}

export function startInvasionPhase(state: GameState, allowDefault = false): GameState {
  if (state.mode !== 'prep') return state;
  if (!allowDefault && !state.prepMeta?.heroesReady) return state;

  const nextWave = state.prepMeta?.wave ?? state.wave + 1;
  const finalized = finalizePendingGrades(state.floors);
  const lewdScore = state.evalScores?.lewd ?? 0;
  const lustGain =
    lewdScore > CFG.LUST.EVAL_FROM
      ? (lewdScore - CFG.LUST.EVAL_FROM) * CFG.LUST.EVAL_MULT
      : 0;

  const nextParty = state.party.map((h) => ({
    ...h,
    status: 'alive' as const,
  }));

  return {
    ...state,
    mode: 'raid',
    wave: nextWave,
    floors: finalized.floors,
    party: nextParty,
    lust: clamp(state.lust + lustGain, 0, 100),
    floorCursor: 0,
    raidFirstRoom: true,
    lastOutcome: null,
    lastAudit: [],
    lastRaidDetail: '',
    lastSettlement: null,
    awaitingNarration: false,
    flash: `Wave ${nextWave} begins! ${nextParty.map((h) => `${h.name} (${h.grade})`).join(', ')} enter the dungeon.`,
  };
}

export function finishSettlementToNextBuild(state: GameState): GameState {
  if (state.mode !== 'result') return state;

  return withWaveStartSnapshot({
    ...state,
    mode: 'build',
    party: [],
    floorCursor: 0,
    evalScores: null,
    prepMeta: null,
    awaitingNarration: false,
    raidFirstRoom: true,
    flash: `Wave ${state.wave} settled — prepare traps for Wave ${state.wave + 1}!`,
  });
}

export function finishResultPhase(state: GameState): GameState {
  if (state.mode !== 'result') return state;
  if (state.crises.pendingGameOver) {
    return enterGameOver(state, state.crises.pendingGameOver);
  }
  if (state.settings.skipDay) {
    return finishSettlementToNextBuild(state);
  }
  return startNewDay(state);
}
