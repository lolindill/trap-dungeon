import { resolveSceneAsset } from '../data/assetManifest';
import type {
  EndingKey,
  GameOverKey,
  GameState,
  RankTrialKey,
  RankTrialsState,
  RaidOutcome,
} from '../types/game';
import { restoreWaveStartSnapshot } from './saveLoad';

export const RANK_TRIAL_EVERY = 5;

export interface EndingDef {
  key: EndingKey;
  title: string;
  koTitle: string;
  subtitle: string;
  artKey: string;
  clearsDebt: boolean;
  isGameOver: boolean;
  summary: string;
  rewardNote: string;
}

export interface GameOverDef {
  key: GameOverKey;
  title: string;
  koTitle: string;
  artKey: string;
  cause: string;
  hint: string;
  protectableByVault: boolean;
  protectableByCasualGrace: boolean;
}

export interface RankTrialDef {
  key: RankTrialKey;
  title: string;
  koTitle: string;
  target: number;
  description: string;
}

export const ENDING_DEFS: Record<EndingKey, EndingDef> = {
  romance: {
    key: 'romance',
    title: 'Crimson Contract (Romance)',
    koTitle: '연애 — 붉은 서약',
    subtitle: 'Full Debt Repaid · Eleonora Affinity ≥ 90',
    artKey: 'dk_end_romance',
    clearsDebt: true,
    isGameOver: false,
    summary:
      'Every last coin owed to House Goldreich is settled in full. Rather than parting ways, Eleonora Goldreich tears up the creditor ledger and chooses to remain at Lostbell as your partner and co-sovereign.',
    rewardNote: 'Debt cleared · Eleonora bonds finalized · Endless Rank Trials unlocked.',
  },
  romance_dowry: {
    key: 'romance_dowry',
    title: 'Torn Ledger (Dowry)',
    koTitle: '지참금 — 찢어진 계약서',
    subtitle: 'Eleonora Event E10 · Remaining Debt ≤ 600 MP',
    artKey: 'dk_end_dowry',
    clearsDebt: true,
    isGameOver: false,
    summary:
      'At the pinnacle of her personal stage, Eleonora refuses to wait for the final installment. She waives up to 600 MP of remaining principal as her personal dowry and binds her house directly to your dungeon.',
    rewardNote: 'Remaining debt forgiven as dowry · Endless Rank Trials unlocked.',
  },
  liberation: {
    key: 'liberation',
    title: 'Sovereign Liberation',
    koTitle: '해방 — 자주의 마왕',
    subtitle: 'Full Debt Repaid · Independent Dominion',
    artKey: 'dk_end_liberation',
    clearsDebt: true,
    isGameOver: false,
    summary:
      'With Goldreich’s ledger stamped Paid in Full and no strings attached, Lostbell answers to no creditor, guild, or crown. Your labyrinth stands wholly sovereign.',
    rewardNote: 'Debt cleared permanently · Endless Rank Trials unlocked.',
  },
  prosperity: {
    key: 'prosperity',
    title: 'Grand Prosperity',
    koTitle: '번영 — 풍요의 도읍',
    subtitle: 'Town Reached Lv. 5 · Debt Cycle Continues',
    artKey: 'dk_end_prosperity',
    clearsDebt: false,
    isGameOver: false,
    summary:
      'Lostbell blossoms into a thriving citadel of commerce, order, and dark industry at Town Lv. 5. Goldreich’s debt contract remains open—now a manageable pillar of an ascendant demon domain.',
    rewardNote:
      'Debt remains active · Town Lv. 6–7 Landmarks & Endless Rank Trials unlocked.',
  },
  bankrupt: {
    key: 'bankrupt',
    title: 'Goldreich Foreclosure',
    koTitle: '파산 — 압류된 미궁',
    subtitle: '3 Late Strikes Reached · Foreclosure Game Over',
    artKey: 'dk_end_bankrupt',
    clearsDebt: false,
    isGameOver: true,
    summary:
      'Three consecutive missed debt deadlines exhaust Eleonora’s patience and House Goldreich’s mercy. Imperial bailiffs seal the dungeon gates and foreclose Lostbell.',
    rewardNote: 'Triggers Bankrupt Game Over — rewindable via Wave-Start autosave.',
  },
  // Ticket 32 dominion-tier variant (Agent A's divergence, attunement flavor):
  // unlocked purely by the corruption economy — total trap attunement >= 300
  // AND >= 5 prisoners at corr 100 — alongside (never replacing) the five
  // canonical endings. Does not clear Goldreich debt: the ledger is moot once
  // the dungeon itself has hollowed, but the contract stays formally open.
  dominion: {
    key: 'dominion',
    title: 'Hollowed Dominion',
    koTitle: '공동 지배 — 속이 빈 미궁',
    subtitle: 'Total Trap Attunement ≥ 300 · 5 Prisoners at corr 100',
    artKey: 'dk_end_dominion',
    clearsDebt: false,
    isGameOver: false,
    summary:
      'Every corridor hums with a hunger that no longer needs a keeper. Between the worn stone and the devoted captives who tend it, the dungeon itself has hollowed — Lostbell no longer houses a labyrinth; it has become one, with you as its resonant core.',
    rewardNote:
      'Dominion-tier variant unlocked · Debt stays formally open · Endless Rank Trials unlocked.',
  },
};

export const GAMEOVER_DEFS: Record<GameOverKey, GameOverDef> = {
  ruin: {
    key: 'ruin',
    title: 'Lord of Ruins',
    koTitle: '폐허의 영주',
    artKey: 'dk_go_ruin',
    cause: 'Town population fell to 0, leaving Lostbell abandoned and undefended.',
    hint: 'Upgrade Housing, resolve Famine/Plague crises early, or invest AP in recruiting.',
    protectableByVault: false,
    protectableByCasualGrace: true,
  },
  famine: {
    key: 'famine',
    title: 'Barren Domain',
    koTitle: '버려진 땅',
    artKey: 'dk_go_famine',
    cause: 'Three consecutive waves of starvation (Food ≤ 0) collapsed the town.',
    hint: 'Upgrade Farmland/Granary facilities, buy emergency rations, or annex the Witchwood.',
    protectableByVault: false,
    protectableByCasualGrace: true,
  },
  riot: {
    key: 'riot',
    title: 'Demon at the Guillotine',
    koTitle: '단두대의 마왕',
    artKey: 'dk_go_riot',
    cause: 'Three consecutive waves of critical unrest (Approval ≤ 10 and Order ≤ 10).',
    hint: 'Lower tax pressure, build Tavern/Watchtower facilities, and host festivals.',
    protectableByVault: false,
    protectableByCasualGrace: true,
  },
  core: {
    key: 'core',
    title: 'Shattered Dungeon Core',
    koTitle: '코어 파괴',
    artKey: 'dk_go_core',
    cause: 'Adventurers breached the Sanctum while the Dungeon Core lacked MP to survive.',
    hint: 'Keep ≥ 50 MP in the Estate Vault for automatic Vault Core Protection, or bolster final-floor traps.',
    protectableByVault: true,
    protectableByCasualGrace: true,
  },
  bankrupt: {
    key: 'bankrupt',
    title: 'Goldreich Foreclosure',
    koTitle: '파산',
    artKey: 'dk_go_bankrupt',
    cause: 'Accumulated 3 Late Strikes on Goldreich debt settlements.',
    hint: 'Use partial payments, prisoner handovers, officer debt relief, or Goldreich Quests before deadlines.',
    protectableByVault: false,
    protectableByCasualGrace: false,
  },
};

export const RANK_TRIALS: RankTrialDef[] = [
  {
    key: 'wipe3',
    title: 'Triple Wipe',
    koTitle: '3회 연속 전멸',
    target: 3,
    description: 'Wipe out 3 consecutive invading hero parties without a single escape or breach.',
  },
  {
    key: 'jobs5',
    title: 'Five Laborers',
    koTitle: '포로 5명 배치',
    target: 5,
    description: 'Keep 5 or more captured prisoners actively assigned to estate or facility jobs.',
  },
  {
    key: 'annex1',
    title: 'Conquest Annexation',
    koTitle: '주변 영지 1곳 합병',
    target: 1,
    description: 'Annex 1 additional rival territory via the War campaign.',
  },
  {
    key: 'epic',
    title: 'Legend in Chains',
    koTitle: 'EPIC 사로잡기',
    target: 1,
    description: 'Capture at least 1 EPIC hero (Nemesis or Crusade Grand Master) into your prison.',
  },
];

// --- Ticket 32: corruption-ledger readers (endgame consumers) ----------------

/** First-pass dominion gate thresholds (balance pass owns final numbers). */
export const DOMINION_GATE = {
  TOTAL_ATTUNEMENT: 300,
  HOLLOWED_PRISONERS: 5,
} as const;

/**
 * First-pass Endless rank scoring weights (balance pass owns final numbers),
 * mirroring prison.ts's `mul(1 + p.corr / 200, 'Corr')` ransom precedent:
 * rank reward MP × `(1 + avgPrisonerCorr/200 + totalTrapAttunement/400)`.
 */
export const RANK_CORR_WEIGHTS = {
  AVG_CORR: 1 / 200,
  TOTAL_ATTUNEMENT: 1 / 400,
} as const;

/** Avg corr bands for the liberation/romance divergence tint (text-level only). */
export const ENDING_TINT_BANDS = { HIGH: 70, LOW: 30 } as const;

export const ENDING_TINT_LINES = {
  HIGH:
    'Divergence — the Hollowed Chorus: every captive left in Lostbell hums the dungeon’s tune, and the ledger closes over prisoners who signed their settlement in Contentment.',
  LOW:
    'Divergence — the Unbroken Chorus: the captives who walk out of Lostbell do so with their wills intact, and the labyrinth’s song fades to a whisper behind them.',
} as const;

/** Total persistent attunement across every trap slot on every floor. */
export function getTotalTrapAttunement(state: Pick<GameState, 'floors'>): number {
  return state.floors.reduce(
    (sum, floor) => sum + floor.slots.reduce((s, slot) => s + (slot.attunement ?? 0), 0),
    0,
  );
}

/** Prisoners sitting at the corr ceiling (applyCorrDelta clamps at 100). */
export function getHollowedPrisonerCount(state: Pick<GameState, 'prisoners'>): number {
  return state.prisoners.filter((p) => p.corr >= 100).length;
}

/** Mean prisoner corr; 0 when the dungeon holds no prisoners (tint-free). */
export function getAvgPrisonerCorr(state: Pick<GameState, 'prisoners'>): number {
  if (state.prisoners.length === 0) return 0;
  return state.prisoners.reduce((sum, p) => sum + p.corr, 0) / state.prisoners.length;
}

/**
 * Ticket 32 liberation/romance tint: the divergence line is tinted by the
 * dungeon's corruption character — avg prisoner corr >= 70 reads as a hollowed
 * (devoted-chorus) liberation, <= 30 as an unbroken one, in between stays
 * untinted. Text-level only; no new ending objects. Endings without prisoners
 * are unaffected.
 */
export function getEndingCorrTintLine(state: Pick<GameState, 'prisoners'>): string | null {
  if (state.prisoners.length === 0) return null;
  const avg = getAvgPrisonerCorr(state);
  if (avg >= ENDING_TINT_BANDS.HIGH) return ENDING_TINT_LINES.HIGH;
  if (avg <= ENDING_TINT_BANDS.LOW) return ENDING_TINT_LINES.LOW;
  return null;
}

/** Corruption multiplier applied to Endless rank-trial reward MP. */
export function getRankCorrMultiplier(state: GameState): number {
  return (
    1 +
    getAvgPrisonerCorr(state) * RANK_CORR_WEIGHTS.AVG_CORR +
    getTotalTrapAttunement(state) * RANK_CORR_WEIGHTS.TOTAL_ATTUNEMENT
  );
}

/**
 * Ticket 32 dominion gate (Agent A's divergence, attunement flavor): total
 * trap attunement >= 300 AND >= 5 prisoners at corr == 100 unlock the
 * dominion-tier ending variant alongside the five canonical endings. Pure and
 * idempotent — evaluates at every settlement via evaluateRankTrials.
 */
export function checkDominionEnding(state: GameState): GameState {
  // `!== undefined` (not truthiness): unlock stamps carry the wave number,
  // and wave 0 states must still read as already-unlocked.
  if (state.endings.unlocked.dominion !== undefined) return state;
  if (getTotalTrapAttunement(state) < DOMINION_GATE.TOTAL_ATTUNEMENT) return state;
  if (getHollowedPrisonerCount(state) < DOMINION_GATE.HOLLOWED_PRISONERS) return state;
  return triggerNonBankruptEnding(state, 'dominion');
}

export function hasAnyNonBankruptEnding(state: GameState): boolean {
  const u = state.endings.unlocked;
  return Boolean(
    u.romance ||
      u.romance_dowry ||
      u.liberation ||
      u.prosperity ||
      u.dominion ||
      state.endings.endless,
  );
}

function appendSystemChronicle(
  state: GameState,
  title: string,
  text: string,
  artKey?: string,
): GameState['chronicle'] {
  const entry = {
    id: `chr_end_${state.wave}_${Date.now()}_${state.chronicle.length}`,
    wave: state.wave,
    kind: 'ending' as const,
    title,
    text,
    bannerUrl: artKey ? resolveSceneAsset(artKey) : undefined,
    timestamp: Date.now(),
  };
  return [entry, ...state.chronicle].slice(0, 60);
}

function getAnnexedCount(state: GameState): number {
  return Object.values(state.war.rivals).filter((r) => r.annexed).length;
}

function selectTrialAtCursor(state: GameState, cursor: number): RankTrialDef {
  const normalized = ((cursor % RANK_TRIALS.length) + RANK_TRIALS.length) % RANK_TRIALS.length;
  const candidate = RANK_TRIALS[normalized]!;
  // If all 3 rival territories are already annexed, skip annex1 so Endless trials never stall.
  if (candidate.key === 'annex1' && getAnnexedCount(state) >= Object.keys(state.war.rivals).length) {
    return RANK_TRIALS[(normalized + 1) % RANK_TRIALS.length]!;
  }
  return candidate;
}

export function computeRankTrialProgress(
  state: GameState,
  rankTrials: RankTrialsState = state.rankTrials,
): number {
  switch (rankTrials.currentTrial) {
    case 'wipe3':
      return Math.min(3, rankTrials.consecutiveWipes ?? 0);
    case 'jobs5':
      return state.prisoners.filter((p) => Boolean(p.job)).length;
    case 'annex1': {
      const baseline = rankTrials.baselineAnnexed ?? 0;
      return Math.max(0, getAnnexedCount(state) - baseline);
    }
    case 'epic': {
      const startWave =
        rankTrials.trialStartWave ?? Math.max(1, rankTrials.nextCheckWave - RANK_TRIAL_EVERY);
      const hasCapturedEpic = state.prisoners.some(
        (p) => (p.grade === 'EPIC' || Boolean(p.legend)) && p.capturedWave >= startWave,
      );
      return hasCapturedEpic ? 1 : 0;
    }
    default:
      return 0;
  }
}

export function ensureRankTrialsInitialized(state: GameState): GameState {
  if (!hasAnyNonBankruptEnding(state) && !state.endings.endless) {
    return state;
  }
  const rt = state.rankTrials;
  if (rt.active && rt.currentTrial) {
    return state;
  }
  const cursor = rt.trialCursor ?? rt.rank % RANK_TRIALS.length;
  const trialDef = selectTrialAtCursor(state, cursor);
  const nextTrials: RankTrialsState = {
    active: true,
    rank: rt.rank,
    currentTrial: trialDef.key,
    progress: 0,
    target: trialDef.target,
    nextCheckWave: state.wave + RANK_TRIAL_EVERY,
    trialStartWave: state.wave,
    baselineAnnexed: getAnnexedCount(state),
    consecutiveWipes: rt.consecutiveWipes ?? 0,
    trialCursor: cursor,
  };
  nextTrials.progress = computeRankTrialProgress(state, nextTrials);
  return {
    ...state,
    endings: { ...state.endings, endless: true },
    rankTrials: nextTrials,
  };
}

export function evaluateRankTrials(
  state: GameState,
  raidOutcome?: RaidOutcome,
): GameState {
  // Ticket 32: the dominion gate is evaluated here so the corruption economy
  // can unlock its ending on every settlement (raid + management) without a
  // canonical ending having landed first.
  let working = checkDominionEnding(state);
  if (!hasAnyNonBankruptEnding(working) && !working.endings.endless) {
    return working;
  }
  working = ensureRankTrialsInitialized(working);
  let rt: RankTrialsState = { ...working.rankTrials };

  if (raidOutcome) {
    rt.consecutiveWipes = raidOutcome === 'wipe' ? (rt.consecutiveWipes ?? 0) + 1 : 0;
  }

  const progress = computeRankTrialProgress(working, rt);
  rt.progress = progress;

  if (rt.currentTrial && progress >= rt.target) {
    const newRank = rt.rank + 1;
    // Ticket 32 Endless scoring: rank reward MP gains a corruption multiplier
    // mirroring prison.ts's `mul(1 + p.corr / 200, 'Corr')` precedent —
    // × (1 + avgPrisonerCorr/200 + totalTrapAttunement/400). First-pass
    // weights (RANK_CORR_WEIGHTS); the balance pass owns final numbers.
    const corrMult = getRankCorrMultiplier(working);
    const corrNote =
      Math.abs(corrMult - 1) > 0.0001 ? ` · Corr ×${corrMult.toFixed(2)}` : '';
    const rewardMp = Math.round((150 + newRank * 50) * corrMult);
    const titleStr = `Demon Rank ${newRank}`;
    const nextCursor = ((rt.trialCursor ?? rt.rank) + 1) % RANK_TRIALS.length;
    const nextDef = selectTrialAtCursor(working, nextCursor);
    const titles = working.endings.titles.includes(titleStr)
      ? working.endings.titles
      : [...working.endings.titles, titleStr];

    const updatedRt: RankTrialsState = {
      active: true,
      rank: newRank,
      currentTrial: nextDef.key,
      progress: 0,
      target: nextDef.target,
      nextCheckWave: working.wave + RANK_TRIAL_EVERY,
      trialStartWave: working.wave,
      baselineAnnexed: getAnnexedCount(working),
      consecutiveWipes: 0,
      trialCursor: nextCursor,
    };
    updatedRt.progress = computeRankTrialProgress(working, updatedRt);

    return {
      ...working,
      points: working.points + rewardMp,
      fame: Math.min(10, working.fame + 1),
      endings: {
        ...working.endings,
        endless: true,
        titles,
      },
      rankTrials: updatedRt,
      chronicle: appendSystemChronicle(
        working,
        `Rank Trial Cleared · ${titleStr}`,
        `Passed "${RANK_TRIALS.find((t) => t.key === rt.currentTrial)?.title ?? rt.currentTrial}"! Earned +${rewardMp} MP & +1 Fame${corrNote}. Next Trial: ${nextDef.title} (by Wave ${updatedRt.nextCheckWave}).`,
        'dk_rank_up',
      ),
      flash: `Rank Trial Cleared! Ascended to ${titleStr} (+${rewardMp} MP, +1 Fame${corrNote}).`,
    };
  }

  if (rt.currentTrial && working.wave >= rt.nextCheckWave) {
    const nextCursor = ((rt.trialCursor ?? rt.rank) + 1) % RANK_TRIALS.length;
    const nextDef = selectTrialAtCursor(working, nextCursor);
    const rotatedRt: RankTrialsState = {
      ...rt,
      currentTrial: nextDef.key,
      progress: 0,
      target: nextDef.target,
      nextCheckWave: working.wave + RANK_TRIAL_EVERY,
      trialStartWave: working.wave,
      baselineAnnexed: getAnnexedCount(working),
      consecutiveWipes: 0,
      trialCursor: nextCursor,
    };
    rotatedRt.progress = computeRankTrialProgress(working, rotatedRt);
    return {
      ...working,
      rankTrials: rotatedRt,
      flash: `Rank Trial window expired — rotating to ${nextDef.title} (deadline Wave ${rotatedRt.nextCheckWave}).`,
    };
  }

  return {
    ...working,
    rankTrials: rt,
  };
}

export function triggerNonBankruptEnding(
  state: GameState,
  endingKey: Exclude<EndingKey, 'bankrupt'>,
  options: { tintLine?: string | null } = {},
): GameState {
  const def = ENDING_DEFS[endingKey];
  const alreadyUnlocked = Boolean(state.endings.unlocked[endingKey]);

  let next: GameState = {
    ...state,
    endings: {
      ...state.endings,
      unlocked: alreadyUnlocked
        ? state.endings.unlocked
        : { ...state.endings.unlocked, [endingKey]: state.wave },
      activeEnding: endingKey,
      endless: true,
    },
  };

  if (def.clearsDebt) {
    next = {
      ...next,
      debt: {
        ...next.debt,
        amount: 0,
        extraLoan: 0,
        ended: endingKey,
        activeQuest: null,
      },
    };
  }

  next = ensureRankTrialsInitialized(next);

  if (!alreadyUnlocked) {
    // Ticket 32: an optional tint line (liberation/romance divergence) is
    // appended to the ending chronicle line — text-level only.
    const summaryText = options.tintLine
      ? `${def.summary}\n\n${options.tintLine}`
      : def.summary;
    next = {
      ...next,
      chronicle: appendSystemChronicle(
        next,
        `Ending Unlocked · ${def.title}`,
        summaryText,
        def.artKey,
      ),
    };
  }

  return {
    ...next,
    flash:
      endingKey === 'prosperity'
        ? `${def.title} unlocked at Town Lv. 5! Debt cycle remains active while Endless Rank Trials begin.`
        : `${def.title} unlocked! Endless Mode & Rank Trials are now active.`,
  };
}

export function checkDebtPayoffEnding(state: GameState): GameState {
  if (state.debt.ended || state.debt.amount + state.debt.extraLoan > 0) {
    return state;
  }
  // Ticket 32 divergence site: the romance/liberation choice is tinted by the
  // dungeon's corruption character (avg prisoner corr) — text-level only.
  const endingKey: EndingKey = state.officers.eleonora.aff >= 90 ? 'romance' : 'liberation';
  return triggerNonBankruptEnding(state, endingKey, {
    tintLine: getEndingCorrTintLine(state),
  });
}

export function triggerDowryEnding(state: GameState): GameState {
  const clearAmt = state.debt.amount + state.debt.extraLoan;
  const preCleared: GameState = {
    ...state,
    debt: {
      ...state.debt,
      reliefUsed: state.debt.reliefUsed + clearAmt,
      amount: 0,
      extraLoan: 0,
      ended: 'romance_dowry',
      activeQuest: null,
    },
  };
  return triggerNonBankruptEnding(preCleared, 'romance_dowry');
}

export function triggerProsperityEnding(state: GameState): GameState {
  if (state.endings.unlocked.prosperity) return state;
  // Critical rule: Prosperity ending unlocks Endless Rank Trials WITHOUT clearing debt!
  return triggerNonBankruptEnding(state, 'prosperity');
}

export function enterGameOver(state: GameState, key: GameOverKey): GameState {
  const def = GAMEOVER_DEFS[key];
  const unlockedKey = `go_${key}` as const;
  const nextUnlocked = {
    ...state.endings.unlocked,
    [unlockedKey]: state.endings.unlocked[unlockedKey] ?? state.wave,
    ...(key === 'bankrupt'
      ? { bankrupt: state.endings.unlocked.bankrupt ?? state.wave }
      : {}),
  };

  const next: GameState = {
    ...state,
    mode: 'over',
    crises: {
      ...state.crises,
      pendingGameOver: null,
    },
    endings: {
      ...state.endings,
      unlocked: nextUnlocked,
      activeEnding: key === 'bankrupt' ? 'bankrupt' : state.endings.activeEnding,
      gameOver: key,
    },
  };

  return {
    ...next,
    chronicle: appendSystemChronicle(
      next,
      `GAME OVER · ${def.title}`,
      def.cause,
      def.artKey,
    ),
    flash: `GAME OVER (${def.title}): ${def.cause}`,
  };
}

export function triggerBankruptEnding(state: GameState): GameState {
  const preState: GameState = {
    ...state,
    debt: {
      ...state.debt,
      ended: 'bankrupt',
      paidThisVisit: 0,
      entertainedThisVisit: false,
      offeredQuests: [],
    },
  };
  return enterGameOver(preState, 'bankrupt');
}

export interface GameOverCheckResult {
  state: GameState;
  triggered: boolean;
  protectedBy: 'vault' | 'casual_grace' | null;
}

/**
 * Evaluates a Game Over trigger against Vault Core Protection (v.mp >= 50 on `core`)
 * and Casual Grace (1/run on casual difficulty). When `deferPending` is true (e.g.
 * during Raid settlement), flags `crises.pendingGameOver` so Settlement remains readable;
 * otherwise enters `mode = 'over'` immediately.
 */
export function flagOrProtectGameOver(
  state: GameState,
  key: GameOverKey,
  options: { deferPending?: boolean } = {},
): GameOverCheckResult {
  // 1. Vault Core Protection: spends 50 Estate Vault MP to restore Core +50 MP
  if (key === 'core' && state.estate.vaultMp >= 50) {
    const next: GameState = {
      ...state,
      points: state.points + 50,
      estate: {
        ...state.estate,
        vaultMp: state.estate.vaultMp - 50,
      },
      crises: {
        ...state.crises,
        pendingGameOver: null,
      },
      chronicle: appendSystemChronicle(
        state,
        'Vault Core Guard Activated',
        'Sanctum breach threatened Core collapse, but 50 Vault MP automatically surged into the Dungeon Core (+50 MP restored)!',
        'dk_go_core',
      ),
      flash: 'Vault Core Guard activated! Spent 50 Vault MP to restore +50 Core MP and prevent collapse.',
    };
    return { state: next, triggered: false, protectedBy: 'vault' };
  }

  // 2. Casual Grace (1/run) on casual difficulty for ruin / famine / riot / core
  if (
    state.settings.difficulty === 'casual' &&
    !state.estate.casualGraceUsed &&
    key !== 'bankrupt'
  ) {
    let rescued: GameState = {
      ...state,
      estate: {
        ...state.estate,
        casualGraceUsed: true,
      },
      crises: {
        ...state.crises,
        pendingGameOver: null,
      },
    };
    let rescueDetail = '';

    if (key === 'ruin') {
      rescued = {
        ...rescued,
        town: { ...rescued.town, pop: Math.max(rescued.town.pop, 15) },
      };
      rescueDetail = 'Town population rallied to 15.';
    } else if (key === 'famine') {
      rescued = {
        ...rescued,
        town: { ...rescued.town, famine: 0, food: Math.max(rescued.town.food, 30) },
      };
      rescueDetail = 'Emergency granaries opened (Famine reset, Food ≥ 30).';
    } else if (key === 'riot') {
      rescued = {
        ...rescued,
        town: {
          ...rescued.town,
          riot: 0,
          approval: Math.min(100, rescued.town.approval + 15),
          order: Math.min(100, rescued.town.order + 15),
        },
      };
      rescueDetail = 'Garrison quelled the uprising (Riot reset, +15 Approval & +15 Order).';
    } else if (key === 'core') {
      rescued = {
        ...rescued,
        points: rescued.points + 50,
      };
      rescueDetail = 'Emergency resonance restored +50 Core MP.';
    }

    rescued = {
      ...rescued,
      chronicle: appendSystemChronicle(
        rescued,
        `Casual Grace Rescue (${GAMEOVER_DEFS[key].title})`,
        `One-time Casual Grace prevented collapse: ${rescueDetail}`,
        GAMEOVER_DEFS[key].artKey,
      ),
      flash: `Casual Grace (1/run) rescued Lostbell from ${GAMEOVER_DEFS[key].title}! ${rescueDetail}`,
    };
    return { state: rescued, triggered: false, protectedBy: 'casual_grace' };
  }

  // 3. Unprotected collapse -> defer or enter Game Over immediately
  if (options.deferPending) {
    const pendingState: GameState = {
      ...state,
      crises: {
        ...state.crises,
        pendingGameOver: key,
      },
      flash: `CRITICAL: ${GAMEOVER_DEFS[key].title} triggered! Advance from Settlement to confront Game Over.`,
    };
    return { state: pendingState, triggered: true, protectedBy: null };
  }

  return {
    state: enterGameOver(state, key),
    triggered: true,
    protectedBy: null,
  };
}

export function rewindGameOverToWaveStart(state: GameState): GameState | null {
  const restored = restoreWaveStartSnapshot(state);
  if (!restored) return null;
  return {
    ...restored,
    mode: 'build',
    crises: {
      ...restored.crises,
      pendingGameOver: null,
    },
    endings: {
      ...restored.endings,
      gameOver: null,
    },
    flash: `Rewound to the start of Wave ${restored.wave} Build Phase.`,
  };
}

export function formatDeterministicEndingSummary(
  state: GameState,
  kind: 'ending' | 'gameover',
  key: EndingKey | GameOverKey,
): string {
  if (kind === 'ending') {
    const def = ENDING_DEFS[key as EndingKey];
    // Ticket 32: the liberation/romance divergence line is tinted by avg
    // prisoner corr (>= 70 hollowed / <= 30 unbroken); every other ending —
    // and any dungeon without prisoners — stays untinted. Text-level only.
    const tintLine =
      key === 'liberation' || key === 'romance' ? getEndingCorrTintLine(state) : null;
    const tintText = tintLine ? `\n\n${tintLine}` : '';
    return `${def.title} (${def.koTitle}) — Wave ${state.wave}.\n\n${def.summary}${tintText}\n\n${def.rewardNote} Eleonora Affinity: ${state.officers.eleonora.aff}/100 · Remaining Debt: ${state.debt.amount + state.debt.extraLoan} MP · Town Lv.${state.town.lv}.`;
  }
  const def = GAMEOVER_DEFS[key as GameOverKey];
  return `${def.title} (${def.koTitle}) — Fell on Wave ${state.wave}.\n\n${def.cause}\n\nRecovery Tip: ${def.hint}`;
}
