import { useEffect, useRef, useState } from 'react';
import {
  EXPEDITION_AFTEREFFECT_MAP,
  EXPEDITION_AILMENT_MAP,
  EXPEDITION_ARRIVALS,
  EXPEDITION_ENCOUNTER_MAP,
  EXPEDITION_EVENT_MAP,
  EXPEDITION_LENGTH_MAP,
  EXPEDITION_RELIC_MAP,
  EXPED_CFG,
  type AfterEffectKey,
  type ExpeditionAilmentKey,
} from '../data/expeditionData';
import { finishExpeditionPhase } from '../engine/dayLoop';
import {
  advanceExpeditionDay,
  buildExpeditionChronicleContext,
  canPerformExpeditionAction,
  endExpeditionDay,
  formatExpeditionEventDesc,
  getCrewPower,
  getDailyFleeChance,
  getEncounterDifficulty,
  getExpeditionRegionDef,
  getExpeditionWinChance,
  performExpeditionAction,
  resolveExpeditionEvent,
  runExpeditionAutoDay,
  type ExpeditionAction,
  type RichExpeditionState,
} from '../engine/expedition';
import '../styles/expedition.css';
import type { GameState } from '../types/game';
import { GradeBadge } from './GradeBadge';

export interface ExpeditionPanelProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
  onFinishExped?: () => void;
}

const AUTO_NARRATE_STORAGE_KEY = 'etdm_exped_autonarrate_v1';

export function ExpeditionPanel({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
  onFinishExped,
}: ExpeditionPanelProps) {
  const [autoNarrateBeats, setAutoNarrateBeats] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_NARRATE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const lastNarratedBeatRef = useRef<string>('');

  const exp = state.expedition as RichExpeditionState;
  const reg = getExpeditionRegionDef(exp.region);
  const lenDef = exp.lengthKey ? EXPEDITION_LENGTH_MAP[exp.lengthKey] : null;
  const chronicleCtx = buildExpeditionChronicleContext(state);

  const steps = exp.todaySteps ?? [];
  const latestBeatKey = steps
    .map((s, idx) => (s.majorBeat ? `${exp.day}_${idx}_${s.majorBeat}` : ''))
    .filter(Boolean)
    .pop();

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_NARRATE_STORAGE_KEY, autoNarrateBeats ? '1' : '0');
    } catch {
      // Ignore storage quota errors
    }
  }, [autoNarrateBeats]);

  useEffect(() => {
    if (!autoNarrateBeats || !onNarrateScene || isBusy || !latestBeatKey) return;
    if (lastNarratedBeatRef.current === latestBeatKey) return;
    lastNarratedBeatRef.current = latestBeatKey;
    onNarrateScene(chronicleCtx.title, chronicleCtx.sceneContext, chronicleCtx.imageUrl);
  }, [
    autoNarrateBeats,
    onNarrateScene,
    isBusy,
    latestBeatKey,
    chronicleCtx.title,
    chronicleCtx.sceneContext,
    chronicleCtx.imageUrl,
  ]);

  const activeCrew = exp.crew.filter((m) => !m.lost && m.stamina > 0);
  const crewPower = getCrewPower(state);
  const activeEv = exp.activeEvent ? EXPEDITION_EVENT_MAP[exp.activeEvent] ?? null : null;
  const activeEnc = exp.activeEncounter
    ? EXPEDITION_ENCOUNTER_MAP[exp.activeEncounter.key] ?? null
    : null;
  const encDiff = exp.activeEncounter
    ? getEncounterDifficulty(exp.depth, exp.activeEncounter.diff)
    : 0;
  const encWinPct = exp.activeEncounter
    ? Math.round(getExpeditionWinChance(state, encDiff) * 100)
    : 0;

  const isArrivalPending =
    (exp.region === 'village' || exp.region === 'city') && !exp.arrivedVisited;
  const arrivalChoices =
    exp.region === 'village'
      ? EXPEDITION_ARRIVALS.village
      : exp.region === 'city'
        ? EXPEDITION_ARRIVALS.city
        : [];

  const isDayDone = Boolean(exp.dayComplete || exp.ap <= 0 || !exp.active);

  const runAct = (act: ExpeditionAction) => {
    if (isBusy) return;
    onUpdateState((prev) => performExpeditionAction(prev, act).state);
  };

  const handleAutoProgress = () => {
    if (isBusy) return;
    onUpdateState((prev) => runExpeditionAutoDay(prev, { ignoreInitialStop: true }).state);
  };

  const handleCompleteLeg = () => {
    if (isBusy) return;
    if (exp.active) {
      onUpdateState((prev) => {
        const advanced = advanceExpeditionDay(prev);
        return onFinishExped ? advanced : finishExpeditionPhase(advanced);
      });
      if (onFinishExped) onFinishExped();
    } else {
      if (onFinishExped) {
        onFinishExped();
      } else {
        onUpdateState((prev) => finishExpeditionPhase(prev));
      }
    }
  };

  const pathNodes = exp.path ?? [exp.region];
  const lastSummary = exp.lastSummary;

  return (
    <div>
      {/* Header Banner */}
      <div className={`dk-lock-banner ${exp.active ? 'day-ready' : ''}`}>
        <span>
          {exp.active
            ? `🗺 ${lenDef?.icon ?? '🗺'} ${lenDef?.label ?? 'Expedition'} · Day ${exp.day}/${exp.maxDays} · AP ${exp.ap}/${EXPED_CFG.AP_PER_DAY} · Depth ${exp.depth}/${exp.maxDepth}`
            : `🗺 EXPEDITION CONCLUDED (${lastSummary?.reason.toUpperCase() ?? 'COMPLETE'})`}
        </span>
        <span className="dk-badge c">Power {crewPower.toFixed(1)}</span>
      </div>

      {/* Art Card + Hybrid Chronicle Controls */}
      <div className="dk-card accent">
        {chronicleCtx.imageUrl && (
          <img
            src={chronicleCtx.imageUrl}
            alt={reg.label}
            className="dk-scene-banner"
          />
        )}
        <div className="dk-row" style={{ marginBottom: 6 }}>
          <div>
            <strong style={{ color: 'var(--y)' }}>
              {reg.icon} {reg.label.toUpperCase()}
            </strong>{' '}
            <span className="dk-badge n">Gear +{exp.gear}</span>{' '}
            {exp.drill > 0 && <span className="dk-badge m">Drill +{exp.drill}</span>}{' '}
            {exp.notoriety > 0 && (
              <span className={`dk-badge ${exp.notoriety >= EXPED_CFG.NOTOR_RETAL ? 'r' : 'y'}`}>
                Notoriety {exp.notoriety}
              </span>
            )}
          </div>
          {onNarrateScene && (
            <button
              type="button"
              className="dk-btn sm pri"
              disabled={isBusy}
              onClick={() =>
                onNarrateScene(
                  chronicleCtx.title,
                  chronicleCtx.sceneContext,
                  chronicleCtx.imageUrl
                )
              }
            >
              📜 Narrate Expedition Log
            </button>
          )}
        </div>

        <div className="dk-row" style={{ fontSize: 11 }}>
          <span className="dk-help-hint">
            Loot: {exp.lootMp} MP · {exp.lootFood} Food · {exp.lootPop} Pop · {exp.lootParts} Parts ·{' '}
            {exp.lootEggs} Eggs · {exp.lootIntel} Intel · {exp.lootShards} Shards
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoNarrateBeats}
              onChange={(e) => setAutoNarrateBeats(e.target.checked)}
            />
            <span>Auto-Narrate Major Beats</span>
          </label>
        </div>

        {/* Mini-map Node Trail */}
        <div className="dk-exp-trail">
          {pathNodes.map((rk, i) => {
            const nodeReg = getExpeditionRegionDef(rk);
            const isCurr = i === pathNodes.length - 1;
            return (
              <span
                key={`${rk}-${i}`}
                className={`dk-exp-node ${isCurr ? 'current' : 'visited'}`}
              >
                {i === 0 ? '0' : i}: {nodeReg.icon} {nodeReg.label}
              </span>
            );
          })}
          {exp.active && exp.depth < exp.maxDepth && (
            <span className="dk-exp-node">→ Depth {exp.depth + 1}/{exp.maxDepth}</span>
          )}
        </div>
      </div>

      {/* Auto-Progress Safety Pause Alert */}
      {exp.stopReason && (
        <div className="dk-exp-stop-banner">
          ⏸ AUTO-PROGRESS PAUSED: {exp.stopReason}
        </div>
      )}

      {/* Crew Roster */}
      {activeCrew.length > 0 && (
        <div className="dk-card">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <strong style={{ color: 'var(--c)' }}>WAR-PARTY CREW ({activeCrew.length})</strong>
            <span className="dk-help-hint">
              Relics: {state.relics.owned.length}/4 · Shards: {state.relics.shards + exp.lootShards}/3
            </span>
          </div>
          <div className="dk-exp-crew-grid">
            {activeCrew.map((m) => {
              const fleePct = Math.round(getDailyFleeChance(state, m) * 1000) / 10;
              return (
                <div key={m.pid} className="dk-exp-crew-card">
                  <div className="dk-row">
                    <b>{m.name}</b>
                    <GradeBadge grade={m.grade} />
                  </div>
                  <div style={{ fontSize: 11 }}>
                    Stamina:{' '}
                    <b style={{ color: m.stamina < EXPED_CFG.STOP_STAMINA ? 'var(--r)' : 'var(--n)' }}>
                      {m.stamina}/{m.staminaMax ?? 100}
                    </b>{' '}
                    · Flee {fleePct}%/d
                    <div className="dk-mini-bar" style={{ marginTop: 2 }}>
                      <div
                        className={`dk-mini-fill ${m.stamina < EXPED_CFG.STOP_STAMINA ? 'low' : ''}`}
                        style={{
                          width: `${Math.min(100, Math.round((m.stamina / (m.staminaMax ?? 100)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  {m.ailments.length > 0 && (
                    <div className="dk-wrap">
                      {m.ailments.map((a) => {
                        const def = EXPEDITION_AILMENT_MAP[a as ExpeditionAilmentKey];
                        return (
                          <span key={a} className="dk-badge r">
                            {def ? `${def.icon} ${def.label}` : a}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Event Popup (22 Events incl. Depth 8+ Deep Events) */}
      {exp.active && activeEv && (
        <div className={`dk-exp-event-card ${activeEv.timing === 'deep' ? 'deep' : ''}`}>
          <div className="dk-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: activeEv.timing === 'deep' ? 'var(--y)' : 'var(--m)' }}>
              {activeEv.icon} {activeEv.title.toUpperCase()}
              {activeEv.timing === 'deep' ? ' · DEEP EVENT (DEPTH 8+)' : ''}
            </strong>
            <span className="dk-badge m">0 AP</span>
          </div>
          <p style={{ margin: '4px 0 8px', fontSize: 12 }}>
            {formatExpeditionEventDesc(activeEv, exp.eventActors)}
          </p>
          <div className="dk-act-grid">
            {activeEv.options.map((opt, idx) => (
              <button
                key={opt.label}
                type="button"
                className="dk-act-btn"
                disabled={isBusy}
                onClick={() =>
                  onUpdateState((prev) => resolveExpeditionEvent(prev, idx + 1).state)
                }
              >
                <div className="dk-row">
                  <span>{opt.label}</span>
                  {activeEv.autoChoice === idx + 1 && <span className="dk-badge c">Auto</span>}
                </div>
                <small>{opt.hint}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Encounter Combat */}
      {exp.active && !activeEv && !isDayDone && activeEnc && (
        <div className="dk-exp-enc-card">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <strong style={{ color: 'var(--r)' }}>
              {activeEnc.icon} ENCOUNTER: {activeEnc.label.toUpperCase()}
            </strong>
            <span className="dk-badge y">
              Diff {encDiff.toFixed(1)} · Win {encWinPct}%
            </span>
          </div>
          <div className="dk-act-grid">
            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !canPerformExpeditionAction(state, 'atk').ok}
              onClick={() => runAct('atk')}
            >
              <div className="dk-row">
                <span>⚔ Attack</span>
                <span className="ap-chip">1 AP</span>
              </div>
              <small>Win: -{EXPED_CFG.DMG.atkOk} ST &amp; Loot · Fail: -{EXPED_CFG.DMG.atkBad} ST</small>
            </button>
            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !canPerformExpeditionAction(state, 'def').ok}
              onClick={() => runAct('def')}
            >
              <div className="dk-row">
                <span>🛡 Defend &amp; Slip Past</span>
                <span className="ap-chip">1 AP</span>
              </div>
              <small>Win: -{EXPED_CFG.DMG.defOk} ST · Fail: -{EXPED_CFG.DMG.defBad} ST (Clears)</small>
            </button>
          </div>
        </div>
      )}

      {/* Destination Arrival Choices (v1..v3, c1..c3) */}
      {exp.active && !activeEv && !activeEnc && !isDayDone && isArrivalPending && (
        <div className="dk-card teal">
          <strong style={{ color: 'var(--y)', display: 'block', marginBottom: 6 }}>
            📍 ARRIVED AT {reg.label.toUpperCase()} — CHOOSE ACTION
          </strong>
          <div className="dk-act-grid">
            {arrivalChoices.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className="dk-act-btn"
                disabled={isBusy || !canPerformExpeditionAction(state, ch.id).ok}
                onClick={() => runAct(ch.id)}
              >
                <div className="dk-row">
                  <span>
                    {ch.icon} {ch.label}
                  </span>
                  <span className="ap-chip">1 AP</span>
                </div>
                <small>
                  {ch.diff > 0 ? `Combat Diff ${ch.diff} · Notor +${ch.notoriety}` : 'Guaranteed · Safe'}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3-Region Forks (mv1..mv3) & Field Actions */}
      {exp.active && !activeEv && !isDayDone && (
        <div className="dk-card">
          {!activeEnc && exp.choices.length > 0 && (
            <>
              <div className="dk-row" style={{ marginBottom: 6 }}>
                <strong style={{ color: 'var(--c)' }}>CHOOSE ROUTE (3-REGION FORK · 1 AP)</strong>
                <span className="dk-help-hint">Move: -{EXPED_CFG.DMG.move} ST</span>
              </div>
              <div className="dk-exp-fork-grid">
                {exp.choices.map((c) => {
                  const fReg = getExpeditionRegionDef(c.region);
                  const ambushPct = Math.round(c.ambush * 100);
                  const isDest = c.region === 'village' || c.region === 'city';
                  const isDanger = c.ambush >= EXPED_CFG.AMBUSH_DANGER;
                  const actKey = `mv${c.idx}` as ExpeditionAction;
                  return (
                    <button
                      key={`${c.idx}-${c.region}`}
                      type="button"
                      className={`dk-exp-fork-btn ${isDest ? 'dest' : ''} ${isDanger ? 'danger' : ''}`}
                      disabled={isBusy || !canPerformExpeditionAction(state, actKey).ok}
                      onClick={() => runAct(actKey)}
                    >
                      <div className="dk-row">
                        <strong>
                          {fReg.icon} {fReg.label}
                        </strong>
                        <span className="ap-chip">mv{c.idx}</span>
                      </div>
                      <span
                        className={`dk-badge ${isDanger ? 'r' : isDest ? 'y' : 'n'}`}
                      >
                        Ambush {ambushPct}%
                      </span>
                      {fReg.ailment && (
                        <small style={{ color: 'var(--o)', fontSize: 10 }}>
                          Hazard: {EXPEDITION_AILMENT_MAP[fReg.ailment].label}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Field Actions: Scout, Camp, Extract Home, End Day, Auto-Progress */}
          <div className="dk-act-grid">
            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !canPerformExpeditionAction(state, 'scout').ok}
              onClick={() => runAct('scout')}
            >
              <div className="dk-row">
                <span>🔎 Scout Region</span>
                <span className="ap-chip">1 AP</span>
              </div>
              <small>Gather region loot{exp.depth >= EXPED_CFG.DEEP_DEPTH ? ' · 30% Relic Shard' : ''}</small>
            </button>

            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !canPerformExpeditionAction(state, 'camp').ok}
              onClick={() => runAct('camp')}
            >
              <div className="dk-row">
                <span>⛺ Make Camp</span>
                <span className="ap-chip">All AP</span>
              </div>
              <small>Heal Stamina &amp; 50% cure 1 ailment</small>
            </button>

            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !canPerformExpeditionAction(state, 'home').ok}
              onClick={() => runAct('home')}
            >
              <div className="dk-row">
                <span>↩ Extract Home</span>
                <span className="ap-chip">End</span>
              </div>
              <small>Return early with current haul</small>
            </button>

            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy}
              onClick={handleAutoProgress}
            >
              <div className="dk-row">
                <span>⏩ Auto-Progress Day</span>
                <span className="dk-badge c">Smart</span>
              </div>
              <small>Runs exRecommend · pauses on exStop safety thresholds</small>
            </button>
          </div>

          {!activeEv && (
            <button
              type="button"
              className="dk-btn sm"
              style={{ marginTop: 6, width: '100%' }}
              disabled={isBusy}
              onClick={() => onUpdateState((prev) => endExpeditionDay(prev))}
            >
              😮‍💨 End Day &amp; Rest Unspent AP (+{exp.ap * EXPED_CFG.REST_PER_AP} ST)
            </button>
          )}
        </div>
      )}

      {/* Expedition Final Return / Aftermath Summary */}
      {!exp.active && lastSummary && (
        <div className="dk-card teal">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <strong style={{ color: 'var(--y)' }}>
              EXPEDITION SUMMARY ({lastSummary.reason.toUpperCase()})
            </strong>
            <span className="dk-badge c">
              Depth {lastSummary.depthReached} · {lastSummary.daysElapsed}d
            </span>
          </div>
          <div className="dk-ledger-row">
            <span>Survivors Returned</span>
            <b>{lastSummary.survivors.join(', ') || 'None'}</b>
          </div>
          {lastSummary.lostNames.length > 0 && (
            <div className="dk-ledger-row">
              <span>Lost / Fled</span>
              <b style={{ color: 'var(--r)' }}>{lastSummary.lostNames.join(', ')}</b>
            </div>
          )}
          <div className="dk-ledger-row">
            <span>Haul &amp; Rewards</span>
            <b style={{ color: 'var(--n)' }}>{lastSummary.lootLines.join(' · ') || 'None'}</b>
          </div>
          {lastSummary.unlockedRelics.length > 0 && (
            <div className="dk-ledger-row">
              <span>Relics Unlocked</span>
              <b style={{ color: 'var(--y)' }}>
                {lastSummary.unlockedRelics
                  .map((r) => `${EXPEDITION_RELIC_MAP[r].icon} ${EXPEDITION_RELIC_MAP[r].label}`)
                  .join(', ')}
              </b>
            </div>
          )}
          {lastSummary.addedAfterEffects.length > 0 && (
            <div className="dk-wrap" style={{ marginTop: 6 }}>
              {lastSummary.addedAfterEffects.map((k) => {
                const def = EXPEDITION_AFTEREFFECT_MAP[k as AfterEffectKey];
                return (
                  <span key={k} className={`dk-badge ${def.heroMod < 0 ? 'n' : 'r'}`}>
                    {def.icon} {def.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hybrid Expedition Chronicle Step Log */}
      <div className="dk-card">
        <div className="dk-row" style={{ marginBottom: 6 }}>
          <strong style={{ color: 'var(--w)' }}>EXPEDITION STEP LOG</strong>
          <span className="dk-help-hint">{steps.length} step(s) today</span>
        </div>
        <div className="dk-exp-log">
          {steps.length === 0 ? (
            <div className="dk-help-hint">No actions logged yet today.</div>
          ) : (
            steps.map((s, idx) => (
              <div key={idx} className={`dk-exp-log-line ${s.majorBeat ? 'beat' : ''}`}>
                {s.majorBeat ? '★ ' : ''}
                {s.text}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Continue Button when Day Complete or Expedition Finished */}
      {isDayDone && (
        <button
          type="button"
          className="dk-btn cta"
          disabled={isBusy}
          onClick={handleCompleteLeg}
        >
          <span>
            {exp.active
              ? `COMPLETE DAY ${exp.day}/${exp.maxDays} & PROCEED →`
              : 'CONCLUDE EXPEDITION & PROCEED →'}
          </span>
          <span style={{ color: '#000' }}>Next Phase</span>
        </button>
      )}
    </div>
  );
}
