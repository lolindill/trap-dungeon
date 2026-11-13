import {
  getDebtDueInWaves,
  getPrisonCapacity,
  getTotalDebt,
  isDayPhase,
  isDebtDue,
  isNightMode,
} from '../engine/dayLoop';
import { getGuildLevel } from '../engine/heroes';
import { computeRankTrialProgress, RANK_TRIALS } from '../engine/endings';
import { getActiveThreatSummary } from '../engine/realm';
import { RELIC_DEFS } from '../data/realmData';
import { assetUrl } from '../data/assetManifest';
import type { GameMode, GameState, LlmConfig } from '../types/game';

interface HeaderBarProps {
  state: GameState;
  llmConfig: LlmConfig;
  blueprintCount: number;
  onOpenWorkshop: () => void;
  onOpenGallery: () => void;
  onOpenSettings: () => void;
  onOpenEndingModal?: () => void;
  onNewGame: () => void;
}

const NIGHT_STEPS: { mode: GameMode; label: string }[] = [
  { mode: 'build', label: '1. BUILD' },
  { mode: 'prep', label: '2. PREP' },
  { mode: 'raid', label: '3. RAID' },
  { mode: 'result', label: '4. RESULT' },
];

export function HeaderBar({
  state,
  llmConfig,
  blueprintCount,
  onOpenWorkshop,
  onOpenGallery,
  onOpenSettings,
  onOpenEndingModal,
  onNewGame,
}: HeaderBarProps) {
  const guildLv = getGuildLevel(state, state.wave + (state.mode === 'build' ? 1 : 0));
  const apiReady =
    Boolean(llmConfig.apiKey.trim()) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(llmConfig.baseUrl);

  const prisonCap = getPrisonCapacity(state);
  const dayActive = isDayPhase(state);
  const totalDebt = getTotalDebt(state);
  const dueNow = state.mode === 'debt' || isDebtDue(state);
  const dueIn = getDebtDueInWaves(state);
  const threats = getActiveThreatSummary(state);
  const relicTooltip =
    threats.relicsCount > 0
      ? state.relics.owned.map((k) => `${RELIC_DEFS[k].icon} ${RELIC_DEFS[k].name}: ${RELIC_DEFS[k].effectDesc}`).join(' | ')
      : 'No Relics owned yet (win Crusade/Nemesis or refine 3 Relic Shards).';

  const nightMode = isNightMode(state.mode);
  const nightStepIndex = NIGHT_STEPS.findIndex((s) => s.mode === state.mode);

  const includeExped = state.expedition.active || state.mode === 'exped';
  const dueLabel =
    totalDebt <= 0 ? 'PAID' : dueNow ? 'DUE!' : `IN ${dueIn}W`;
  const daySteps: { mode: GameMode; label: string; alert?: boolean }[] = [
    { mode: 'estate', label: `5. DAY (${state.ap}/${state.apMax} AP)` },
    { mode: 'msettle', label: '6. M.SETTLE' },
    ...(includeExped
      ? [
          { mode: 'exped' as GameMode, label: '7. EXPED' },
          { mode: 'debt' as GameMode, label: `8. DEBT [${dueLabel}]`, alert: dueNow || state.debt.lates > 0 },
        ]
      : [
          { mode: 'debt' as GameMode, label: `7. DEBT [${dueLabel}]`, alert: dueNow || state.debt.lates > 0 },
        ]),
  ];
  const dayStepIndex = daySteps.findIndex((s) => s.mode === state.mode);

  return (
    <header className="dk-topbar">
      <div className="dk-topbar-row">
        <div className="dk-brand">
          <img
            src={assetUrl('/assets/icon/image/main.png')}
            alt="Ero Trap Dungeon Maker"
            className="dk-brand-icon"
          />
          <div>
            <div className="dk-brand-title">ERO TRAP DUNGEON MAKER</div>
            <div className="dk-brand-sub">
              Phase 2 Tactical &amp; Narrative Console · v{state.version} · Hotkeys [1-5]
            </div>
          </div>
        </div>

        {/* Dual-Group Compact KPI Dock */}
        <div className="dk-kpi-dock">
          <div className="dk-kpi-group" title="Dungeon & Core KPIs">
            <div className="dk-kpi-pill mp">
              <span>MP</span>
              <b>{state.points}</b>
            </div>
            <div className="dk-kpi-pill">
              <span>WAVE</span>
              <b>{state.wave}</b>
            </div>
            <div className="dk-kpi-pill fame">
              <span>FAME</span>
              <b>{state.fame}</b>
            </div>
            <div className="dk-kpi-pill fear">
              <span>FEAR</span>
              <b>{state.fear}</b>
            </div>
            <div className="dk-kpi-pill lust">
              <span>LUST</span>
              <b>{state.lust}</b>
            </div>
            <div className="dk-kpi-pill">
              <span>MOM</span>
              <b>{state.momentum >= 0 ? `+${state.momentum}` : state.momentum}</b>
            </div>
            <div className="dk-kpi-pill">
              <span>GUILD</span>
              <b>Lv.{guildLv}</b>
            </div>
            <div
              className={`dk-kpi-pill ${state.prisoners.length >= prisonCap ? 'warn' : ''}`}
            >
              <span>CAP</span>
              <b>
                {state.prisoners.length}/{prisonCap}
              </b>
            </div>
            {threats.showWrath && (
              <div
                className={`dk-kpi-pill ${threats.crusadeActive || threats.wrath >= 80 ? 'crit' : threats.wrath >= 50 ? 'warn' : ''}`}
                title="Holy Crusade Wrath (W25+): +6 per kill/capture, +4 streak >=3, +5 execution, -6/-12 decay. At 100 -> 3-wave Crusade led by EPIC Grand Master."
              >
                <span>WRATH</span>
                <b>{threats.crusadeActive ? `CRUSADE ${threats.crusadeWavesLeft}W` : `${threats.wrath}%`}</b>
              </div>
            )}
            {(threats.nemesisCount > 0 || threats.hasEpicInParty) && (
              <div
                className={`dk-kpi-pill ${threats.hasEpicInParty ? 'crit' : 'warn'}`}
                title="Legendary Nemesis Roster: Escaped A+ heroes return as EPIC champions (+3 Memory on unchanged floors, Adaptation vs repeated trap tags). Defeat for 900 MP & Relic."
              >
                <span>NEMESIS</span>
                <b>{threats.hasEpicInParty ? 'ACTIVE!' : threats.nemesisCount}</b>
              </div>
            )}
            {threats.gprepLv > 0 && (
              <div
                className={`dk-kpi-pill ${threats.gprepEffectiveLv >= 3 ? 'warn' : ''}`}
                title="Guild Counter-Gear Prep (Lv0-5, W10+): +1 on Wipe or 3+ waves unchanged layout; -1 on Breach or Remodel. Counters top 1-3 trap tags (+1/+2). Watchspire reduces by 1 Lv."
              >
                <span>GPREP</span>
                <b>
                  Lv.{threats.gprepEffectiveLv}
                  {threats.gprepEffectiveLv < threats.gprepLv ? '*' : ''}
                </b>
              </div>
            )}
            {threats.relicsCount > 0 && (
              <div className="dk-kpi-pill" title={relicTooltip}>
                <span>RELIC</span>
                <b>{threats.relicsCount}/4</b>
              </div>
            )}
            {(state.endings.endless || state.endings.activeEnding || state.mode === 'over') && (
              <button
                type="button"
                className={`dk-kpi-pill ${state.mode === 'over' ? 'crit' : ''}`}
                style={{ cursor: onOpenEndingModal ? 'pointer' : 'default' }}
                onClick={onOpenEndingModal}
                title={(() => {
                  if (state.mode === 'over') {
                    return `GAME OVER (${state.endings.gameOver ?? 'collapse'}) — click to open Recovery / Rewind Modal`;
                  }
                  const rt = state.rankTrials;
                  const tDef = RANK_TRIALS.find((t) => t.key === rt.currentTrial);
                  const prog = tDef ? computeRankTrialProgress(state, rt) : 0;
                  return tDef
                    ? `Demon Rank ${rt.rank} · Trial: ${tDef.title} (${prog}/${tDef.target}) by Wave ${rt.nextCheckWave} — click to inspect Ending & Rank Trials`
                    : `Demon Rank ${rt.rank} — click to inspect Ending & Rank Trials`;
                })()}
              >
                <span>{state.mode === 'over' ? 'OVER' : 'RANK'}</span>
                <b>
                  {state.mode === 'over'
                    ? (state.endings.gameOver ?? 'FALL').toUpperCase()
                    : `R${state.rankTrials.rank}${
                        state.rankTrials.currentTrial
                          ? ` · ${computeRankTrialProgress(state, state.rankTrials)}/${state.rankTrials.target}`
                          : ''
                      }`}
                </b>
              </button>
            )}
          </div>

          <div className="dk-kpi-group day-group" title="Day, Estate & Debt KPIs">
            <div className={`dk-kpi-pill ap ${dayActive ? 'active-ap' : 'locked-ap'}`}>
              <span>AP</span>
              <b>{dayActive ? `${state.ap}/${state.apMax}` : 'LOCK'}</b>
            </div>
            <div
              className={`dk-kpi-pill ${
                dueNow || state.debt.lates > 0
                  ? 'crit'
                  : totalDebt > 0 && dueIn <= 1
                    ? 'warn'
                    : ''
              }`}
            >
              <span>DEBT</span>
              <b>{totalDebt}</b>
            </div>
            <div className={`dk-kpi-pill ${state.town.food < 20 ? 'crit' : ''}`}>
              <span>FOOD</span>
              <b>{state.town.food}</b>
            </div>
            <div className={`dk-kpi-pill ${state.town.order < 30 ? 'crit' : ''}`}>
              <span>ORDER</span>
              <b>{state.town.order}</b>
            </div>
            <div className={`dk-kpi-pill ${state.town.approval < 40 ? 'warn' : ''}`}>
              <span>APP</span>
              <b>{state.town.approval}</b>
            </div>
          </div>
        </div>

        <div className="dk-nav-actions">
          <button
            type="button"
            className="dk-btn sm amber"
            onClick={onOpenWorkshop}
            title="Create, rate, and 1-click deploy reusable trap blueprints"
          >
            Trap Shortcuts ({blueprintCount})
          </button>
          <button type="button" className="dk-btn sm" onClick={onOpenGallery}>
            Gallery
          </button>
          <button
            type="button"
            className={`dk-btn sm ${apiReady ? 'up' : 'del'}`}
            onClick={onOpenSettings}
          >
            {apiReady ? `API: ${llmConfig.model}` : 'Set LLM API!'}
          </button>
          <button type="button" className="dk-btn sm del" onClick={onNewGame}>
            New Run
          </button>
        </div>
      </div>

      {/* Contextual Dual Night / Day Stepper */}
      <div className="dk-stepper-wrap">
        {nightMode ? (
          <>
            <span className="dk-cycle-tag">NIGHT CYCLE</span>
            <div className="dk-stepper night-4">
              {NIGHT_STEPS.map((st, idx) => {
                const cls =
                  st.mode === state.mode
                    ? 'active'
                    : idx < nightStepIndex
                      ? 'done'
                      : '';
                return (
                  <div key={st.mode} className={`dk-step-item ${cls}`}>
                    <span>{st.label}</span>
                    <span>
                      {st.mode === state.mode ? 'NOW' : idx < nightStepIndex ? 'OK' : '·'}
                    </span>
                  </div>
                );
              })}
            </div>
            <span className="dk-help-hint" style={{ whiteSpace: 'nowrap' }}>
              {state.settings.skipDay ? '⏭ Day Skipped' : '→ Day Next'}
            </span>
          </>
        ) : (
          <>
            <span className="dk-cycle-tag day">DAY CYCLE</span>
            <div className={`dk-stepper ${includeExped ? 'day-4' : 'day-3'}`}>
              {daySteps.map((st, idx) => {
                const isCurrent = st.mode === state.mode;
                const isDone = dayStepIndex >= 0 && idx < dayStepIndex;
                const cls = isCurrent
                  ? 'day-active'
                  : isDone
                    ? 'done'
                    : st.alert
                      ? 'due-alert'
                      : '';
                return (
                  <div key={st.mode} className={`dk-step-item ${cls}`}>
                    <span>{st.label}</span>
                    <span>{isCurrent ? 'NOW' : isDone ? 'OK' : '·'}</span>
                  </div>
                );
              })}
            </div>
            <span className="dk-help-hint" style={{ whiteSpace: 'nowrap' }}>
              → Build Next
            </span>
          </>
        )}
      </div>
    </header>
  );
}
