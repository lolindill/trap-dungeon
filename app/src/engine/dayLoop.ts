import { clamp } from './rng';
import { withWaveStartSnapshot } from './saveLoad';
import type {
  DayLogLine,
  GameMode,
  GameState,
  OfficerKey,
  Prisoner,
} from '../types/game';

export type NavTabId = 'dungeon' | 'prison' | 'estate' | 'debt' | 'officers';

export interface NavTabBadge {
  text: string;
  tone: 'neutral' | 'info' | 'warn' | 'crit' | 'star';
}

export interface NavTabDef {
  id: NavTabId;
  hotkey: '1' | '2' | '3' | '4' | '5';
  label: string;
}

export const NAV_TABS: readonly NavTabDef[] = [
  { id: 'dungeon', hotkey: '1', label: 'Dungeon' },
  { id: 'prison', hotkey: '2', label: 'Prison' },
  { id: 'estate', hotkey: '3', label: 'Estate' },
  { id: 'debt', hotkey: '4', label: 'Debt' },
  { id: 'officers', hotkey: '5', label: 'Officers' },
] as const;

const HOTKEY_TO_TAB: Record<string, NavTabId> = {
  '1': 'dungeon',
  '2': 'prison',
  '3': 'estate',
  '4': 'debt',
  '5': 'officers',
};

const OFFICER_STAGE_THRESHOLDS = [20, 40, 65, 90, 100] as const;

export function getPrimaryTabForMode(mode: GameMode): NavTabId {
  switch (mode) {
    case 'build':
    case 'prep':
    case 'raid':
    case 'result':
      return 'dungeon';
    case 'estate':
    case 'msettle':
    case 'exped':
    case 'over':
      return 'estate';
    case 'debt':
      return 'debt';
  }
}

export function isNightMode(mode: GameMode): boolean {
  return mode === 'build' || mode === 'prep' || mode === 'raid' || mode === 'result';
}

export function isDayPhase(state: GameState): boolean {
  return state.mode === 'estate' && !state.dayClosed;
}

export function resolveTabShortcutKey(
  key: string,
  target?: { tagName?: string; isContentEditable?: boolean } | null
): NavTabId | null {
  if (target) {
    const tag = (target.tagName ?? '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;
    if (target.isContentEditable) return null;
  }
  return HOTKEY_TO_TAB[key] ?? null;
}

export function calcApMax(state: GameState): number {
  const paths = [
    state.officers.vesper.stage >= 4,
    (state.estate.facilities.manor ?? 0) >= 2,
    state.town.lv >= 5,
    state.apGrowth.wipes >= 5,
    state.apGrowth.conv >= 5,
    state.apGrowth.quests >= 3,
    state.kills >= 10,
  ];
  const grown = Math.min(3, paths.filter(Boolean).length);
  return Math.min(6, 3 + grown);
}

export function getPrisonCapacity(state: GameState): number {
  const annex = state.estate.facilities.annex ?? 0;
  const pens = state.estate.facilities.pens ?? 0;
  const capBonus = state.estate.perks.capBonus ?? 0;
  return 6 + 2 * annex + 2 * pens + capBonus;
}

export function getTotalDebt(state: GameState): number {
  return Math.max(0, (state.debt.amount ?? 0) + (state.debt.extraLoan ?? 0));
}

export function isDebtDue(state: GameState): boolean {
  return getTotalDebt(state) > 0 && state.wave >= state.debt.dueWave;
}

export function getDebtDueInWaves(state: GameState): number {
  return Math.max(0, state.debt.dueWave - state.wave);
}

export function getEstimatedDebtDueMin(state: GameState): number {
  const total = getTotalDebt(state);
  if (total <= 0) return 0;
  const mins = [30, 60, 120, 180, 240, 300, 360];
  const baseMin = mins[Math.min(state.debt.step, mins.length - 1)] ?? 360;
  const rawNeed = baseMin + state.debt.extCarry;
  const cut = Math.floor(rawNeed * Math.min(state.debt.minCut, 0.25));
  const extraMin = state.debt.extraLoan > 0 ? Math.ceil(state.debt.extraLoan * 0.1) : 0;
  return Math.min(total, Math.max(0, rawNeed - cut) + extraMin);
}

export function calcRestMp(state: GameState): number {
  const mult = state.estate.perks.rest2Day ? 2 : 1;
  return Math.max(0, state.ap) * 10 * mult;
}

export function getOfficerStageForAff(officer: OfficerKey, aff: number): number {
  const limit = officer === 'eleonora' ? 5 : 4;
  let stage = 0;
  for (let i = 0; i < limit; i++) {
    if (aff >= OFFICER_STAGE_THRESHOLDS[i]) stage = i + 1;
  }
  return stage;
}

export function getOfficerNextThreshold(officer: OfficerKey, stage: number): number | null {
  const limit = officer === 'eleonora' ? 5 : 4;
  if (stage >= limit) return null;
  return OFFICER_STAGE_THRESHOLDS[stage] ?? null;
}

export function getNavTabBadges(state: GameState): Record<NavTabId, NavTabBadge> {
  const totalTraps = state.floors.reduce((sum, f) => sum + f.slots.length, 0);
  const activeFloors = state.floors.filter((f) => f.slots.length > 0).length;

  const cap = getPrisonCapacity(state);
  const prisonersCount = state.prisoners.length;
  const prisonBadge: NavTabBadge =
    prisonersCount >= cap
      ? { text: `${prisonersCount}/${cap} FULL!`, tone: 'crit' }
      : { text: `${prisonersCount}/${cap}`, tone: 'info' };

  let estateBadge: NavTabBadge = { text: `Lv.${state.town.lv} Town`, tone: 'neutral' };
  if (state.mode === 'msettle') {
    estateBadge = { text: '! SETTLE', tone: 'crit' };
  } else if (state.mode === 'exped') {
    estateBadge = { text: 'EXPED', tone: 'info' };
  } else if (state.town.food < 20) {
    estateBadge = { text: 'FOOD<20!', tone: 'crit' };
  } else if (state.town.order < 30) {
    estateBadge = { text: 'RIOT!', tone: 'crit' };
  } else if (state.town.approval < 40) {
    estateBadge = { text: 'LOW APP', tone: 'warn' };
  }

  const totalDebt = getTotalDebt(state);
  const dueIn = getDebtDueInWaves(state);
  let debtBadge: NavTabBadge;
  if (totalDebt <= 0) {
    debtBadge = { text: 'CLEARED', tone: 'info' };
  } else if (state.mode === 'debt' || isDebtDue(state)) {
    debtBadge = { text: 'DUE NOW', tone: 'crit' };
  } else if (state.debt.lates > 0) {
    debtBadge = { text: `LATE x${state.debt.lates}!`, tone: 'crit' };
  } else {
    debtBadge = { text: `In ${dueIn}W`, tone: dueIn <= 1 ? 'warn' : 'neutral' };
  }

  const officersList: { key: OfficerKey; tag: string }[] = [
    { key: 'vesper', tag: 'V' },
    { key: 'lilim', tag: 'L' },
    { key: 'eleonora', tag: 'E' },
  ];
  let starCandidate: { tag: string; aff: number } | null = null;
  for (const item of officersList) {
    const prog = state.officers[item.key];
    const next = getOfficerNextThreshold(item.key, prog.stage);
    if (next !== null && next - prog.aff <= 6) {
      if (!starCandidate || prog.aff > starCandidate.aff) {
        starCandidate = { tag: item.tag, aff: prog.aff };
      }
    }
  }
  const officersBadge: NavTabBadge = starCandidate
    ? { text: `★ ${starCandidate.tag}${starCandidate.aff}`, tone: 'star' }
    : {
        text: `S${state.officers.vesper.stage}/${state.officers.lilim.stage}/${state.officers.eleonora.stage}`,
        tone: 'neutral',
      };

  return {
    dungeon: { text: `${activeFloors}F · ${totalTraps}T`, tone: 'info' },
    prison: prisonBadge,
    estate: estateBadge,
    debt: debtBadge,
    officers: officersBadge,
  };
}

export function canSpendDayAp(
  state: GameState,
  actionKey?: string
): { ok: true } | { ok: false; reason: string } {
  if (!isDayPhase(state)) {
    return { ok: false, reason: 'Locked: Switch to Day (AP) phase to spend Action Points.' };
  }
  if (state.estate.activeCrisis) {
    return { ok: false, reason: 'Resolve the active town crisis before spending AP.' };
  }
  if (state.ap <= 0) {
    return { ok: false, reason: '0 AP left! Click "End Day & Rest" to settle.' };
  }
  if (actionKey && state.apUsed[actionKey]) {
    return { ok: false, reason: `Action "${actionKey}" has already been performed today.` };
  }
  return { ok: true };
}

export function appendDayLogLine(state: GameState, line: DayLogLine | string): GameState {
  const normalized: DayLogLine =
    typeof line === 'string' ? { text: line } : { ...line };
  return {
    ...state,
    dayLines: [...state.dayLines, normalized],
  };
}

export function spendDayAp(
  state: GameState,
  actionKey: string,
  line: DayLogLine | string
): { ok: boolean; state: GameState } {
  const guard = canSpendDayAp(state, actionKey);
  if (!guard.ok) {
    return { ok: false, state: { ...state, flash: guard.reason } };
  }
  const withLog = appendDayLogLine(
    {
      ...state,
      ap: state.ap - 1,
      apUsed: { ...state.apUsed, [actionKey]: true },
    },
    line
  );
  return { ok: true, state: withLog };
}

export function startNewDay(state: GameState): GameState {
  const apMax = calcApMax(state);
  const apBonus = state.estate.perks.apBonus ?? 0;
  const ap = Math.max(0, apMax - state.entApPenalty) + apBonus;
  const dayNum = state.wave;

  return {
    ...state,
    mode: 'estate',
    day: dayNum,
    apMax,
    ap,
    dayClosed: false,
    entApPenalty: 0,
    apUsed: {},
    dayLines: [],
    party: [],
    floorCursor: 0,
    evalScores: null,
    prepMeta: null,
    awaitingNarration: false,
    raidFirstRoom: true,
    estate: {
      ...state.estate,
      exploreCountToday: 0,
      perks: {
        ...state.estate.perks,
        apBonus: 0,
        rest2Day: false,
        interroDay: false,
        prisonDay: false,
        ransomUpDay: 0,
      },
    },
    flash: `Day ${dayNum} begins — ${ap}/${apMax} AP ready.`,
  };
}

export function closeDayAndRest(state: GameState): {
  state: GameState;
  restMp: number;
  journalLines: DayLogLine[];
} {
  if (state.mode !== 'estate') {
    return { state, restMp: 0, journalLines: [...state.dayLines] };
  }

  const restMp = state.dayClosed ? 0 : calcRestMp(state);
  const journalLines = [...state.dayLines];

  const nextState: GameState = {
    ...state,
    mode: 'msettle',
    points: state.points + restMp,
    ap: 0,
    dayClosed: true,
    dayLines: [],
    estate: {
      ...state.estate,
      perks: {
        ...state.estate.perks,
        rest2Day: false,
        interroDay: false,
        prisonDay: false,
        ransomUpDay: 0,
      },
    },
    flash:
      restMp > 0
        ? `Day ${state.day || state.wave} closed (+${restMp} Rest MP). Review Management Settlement.`
        : `Day ${state.day || state.wave} closed. Review Management Settlement.`,
  };

  return { state: nextState, restMp, journalLines };
}

export function transitionToNextBuild(state: GameState): GameState {
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

export function finishManagementSettle(state: GameState): GameState {
  if (state.mode !== 'msettle') return state;

  if (state.crises.jailbreakPending) {
    return {
      ...state,
      flash: 'Resolve the Prison Jailbreak crisis before closing Management Settlement!',
    };
  }
  if (state.crises.siege.active) {
    return {
      ...state,
      flash: `Resolve Royal Siege Bo3 (${state.crises.siege.wins}W-${state.crises.siege.losses}L) before closing Management Settlement!`,
    };
  }

  if (state.expedition.active) {
    return {
      ...state,
      mode: 'exped',
      flash: 'Expedition underway — resolve expedition leg before continuing.',
    };
  }

  if (isDebtDue(state)) {
    return {
      ...state,
      mode: 'debt',
      debt: {
        ...state.debt,
        paidThisVisit: 0,
        entertainedThisVisit: false,
      },
      flash: `Wave ${state.wave} Debt Collection — Eleonora Goldreich has arrived!`,
    };
  }

  return transitionToNextBuild(state);
}

export function finishExpeditionPhase(state: GameState): GameState {
  if (state.mode !== 'exped') return state;

  if (isDebtDue(state)) {
    return {
      ...state,
      mode: 'debt',
      debt: {
        ...state.debt,
        paidThisVisit: 0,
        entertainedThisVisit: false,
      },
      flash: `Wave ${state.wave} Debt Collection — Eleonora Goldreich awaits at the ledger.`,
    };
  }

  return transitionToNextBuild(state);
}

export function finishDebtPhase(state: GameState): GameState {
  if (state.mode !== 'debt') return state;

  const nextDue = Math.max(state.wave, state.debt.dueWave) + 3;
  return transitionToNextBuild({
    ...state,
    debt: {
      ...state.debt,
      dueWave: nextDue,
      cycleCount: state.debt.cycleCount + 1,
      paidThisVisit: 0,
      entertainedThisVisit: false,
    },
  });
}

export function formatDeterministicDayJournal(
  state: GameState,
  lines: DayLogLine[],
  restMp: number
): string {
  const dayNum = state.day || state.wave;
  if (lines.length === 0 && restMp === 0) {
    return `Day ${dayNum} concluded quietly with no logged actions.`;
  }
  const bulletLines = lines.map((l) => `• ${l.star ? '★ ' : ''}${l.text}`);
  if (restMp > 0) {
    bulletLines.push(`• Rest & Recovery: Unspent AP converted into +${restMp} MP.`);
  }
  return [`Day ${dayNum} Summary Ledger:`, ...bulletLines].join('\n');
}

export function performQuickTownAction(
  state: GameState,
  action: 'patrol' | 'petitions' | 'forage' | 'market'
): { ok: boolean; state: GameState } {
  const key = `town_${action}`;
  const specs: Record<
    typeof action,
    { label: string; apply: (s: GameState) => GameState }
  > = {
    patrol: {
      label: 'Town Guard Patrol (+6 Order)',
      apply: (s) => ({
        ...s,
        town: { ...s.town, order: clamp(s.town.order + 6, 0, 100) },
      }),
    },
    petitions: {
      label: 'Hear Citizen Petitions (+5 Approval)',
      apply: (s) => ({
        ...s,
        town: { ...s.town, approval: clamp(s.town.approval + 5, 0, 100) },
      }),
    },
    forage: {
      label: 'Requisition Granary Supplies (+8 Food)',
      apply: (s) => ({
        ...s,
        town: { ...s.town, food: clamp(s.town.food + 8, 0, 100) },
      }),
    },
    market: {
      label: 'Domain Market Trade Run (+25 MP, +1 Renown)',
      apply: (s) => ({
        ...s,
        points: s.points + 25,
        town: { ...s.town, renown: clamp(s.town.renown + 1, 0, 100) },
      }),
    },
  };

  const spec = specs[action];
  const spent = spendDayAp(state, key, { text: spec.label, kind: 'town' });
  if (!spent.ok) return spent;

  const updated = spec.apply(spent.state);
  return {
    ok: true,
    state: {
      ...updated,
      flash: `${spec.label} (-1 AP). Queued to Day Log.`,
    },
  };
}

export function performQuickOfficerAction(
  state: GameState,
  officer: OfficerKey,
  mode: 'time' | 'gift'
): { ok: boolean; state: GameState } {
  const actionKey = `officer_${officer}`;
  const guard = canSpendDayAp(state, actionKey);
  if (!guard.ok) {
    return { ok: false, state: { ...state, flash: guard.reason } };
  }

  if (mode === 'gift' && state.points < 40) {
    return {
      ok: false,
      state: { ...state, flash: 'Need 40 MP to present an Officer Gift.' },
    };
  }

  const prev = state.officers[officer];
  const gain = mode === 'gift' ? 4 : 3;
  const nextAff = prev.aff + gain;
  const nextStage = Math.max(prev.stage, getOfficerStageForAff(officer, nextAff));
  const stagedUp = nextStage > prev.stage;
  const name = officer.charAt(0).toUpperCase() + officer.slice(1);
  const label =
    mode === 'gift'
      ? `Gift to ${name} (-40 MP, +${gain} Aff${stagedUp ? ` → Stage ${nextStage}!` : ''})`
      : `Spent time with ${name} (+${gain} Aff${stagedUp ? ` → Stage ${nextStage}!` : ''})`;

  const spent = spendDayAp(state, actionKey, {
    text: label,
    star: stagedUp,
    kind: 'officer',
  });
  if (!spent.ok) return spent;

  return {
    ok: true,
    state: {
      ...spent.state,
      points: mode === 'gift' ? spent.state.points - 40 : spent.state.points,
      officers: {
        ...spent.state.officers,
        [officer]: {
          ...prev,
          aff: nextAff,
          stage: nextStage,
        },
      },
      flash: `${label} (-1 AP). Queued to Day Log.`,
    },
  };
}

export function performQuickPrisonAction(
  state: GameState,
  pid: number,
  action: 'interrogate' | 'rest'
): { ok: boolean; state: GameState } {
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return { ok: false, state: { ...state, flash: 'No matching captive selected.' } };
  }
  const cap = state.prisoners[idx];

  if (action === 'rest') {
    const updated: Prisoner = {
      ...cap,
      stamina: cap.staminaMax,
      dying: false,
    };
    const nextPrisoners = [...state.prisoners];
    nextPrisoners[idx] = updated;
    const nextState = isDayPhase(state)
      ? appendDayLogLine(
          { ...state, prisoners: nextPrisoners },
          { text: `${cap.name}: Rest recovery (Stamina restored to ${cap.staminaMax}).`, kind: 'prison' }
        )
      : { ...state, prisoners: nextPrisoners };

    return {
      ok: true,
      state: {
        ...nextState,
        flash: `${cap.name} rested cleanly (0 AP · Stamina ${cap.staminaMax}/${cap.staminaMax}).`,
      },
    };
  }

  const actionKey = `prison_${pid}`;
  const label = `Interrogated ${cap.name} (-5 Resist, +5 Corr)`;
  const spent = spendDayAp(state, actionKey, { text: label, kind: 'prison' });
  if (!spent.ok) return spent;

  const updated: Prisoner = {
    ...cap,
    resist: clamp(cap.resist - 5, 0, 100),
    corr: clamp(cap.corr + 5, 0, 100),
    stamina: clamp(cap.stamina - 10, 0, cap.staminaMax),
  };
  const nextPrisoners = [...spent.state.prisoners];
  nextPrisoners[idx] = updated;

  return {
    ok: true,
    state: {
      ...spent.state,
      prisoners: nextPrisoners,
      flash: `${label} (-1 AP). Queued to Day Log.`,
    },
  };
}
