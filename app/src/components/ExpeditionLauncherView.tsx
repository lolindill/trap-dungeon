import { useState } from 'react';
import { resolveSceneAsset } from '../data/assetManifest';
import {
  EXPEDITION_AFTEREFFECT_MAP,
  EXPEDITION_LENGTHS,
  EXPEDITION_RELICS,
  EXPED_CFG,
  type AfterEffectKey,
} from '../data/expeditionData';
import { isDayPhase } from '../engine/dayLoop';
import {
  canLaunchExpedition,
  canSelectTripLength,
  getDailyFleeChance,
  getMaxExpeditionCrew,
  isExpeditionUnlocked,
  isPrisonerEligibleForExpedition,
  launchExpedition,
  type RichExpeditionCrewMember,
} from '../engine/expedition';
import '../styles/expedition.css';
import type { ExpeditionLengthKey, GameState } from '../types/game';
import { GradeBadge } from './GradeBadge';

export interface ExpeditionLauncherViewProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
}

export function ExpeditionLauncherView({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
}: ExpeditionLauncherViewProps) {
  const [selectedLength, setSelectedLength] = useState<ExpeditionLengthKey>('short');
  const [selectedPids, setSelectedPids] = useState<number[]>([]);

  const unlocked = isExpeditionUnlocked(state);
  const dayActive = isDayPhase(state);
  const maxCrew = getMaxExpeditionCrew(state);
  const crusadeBlocked = state.crises.crusade.active;
  const activeExp = state.expedition.active;

  const togglePid = (pid: number) => {
    setSelectedPids((prev) => {
      if (prev.includes(pid)) return prev.filter((id) => id !== pid);
      if (prev.length >= maxCrew) return prev;
      return [...prev, pid];
    });
  };

  const validSelectedPids = selectedPids.filter((pid) => {
    const p = state.prisoners.find((item) => item.pid === pid);
    return p ? isPrisonerEligibleForExpedition(p).ok : false;
  });

  const launchCheck = canLaunchExpedition(state, validSelectedPids, selectedLength);
  const departArt = resolveSceneAsset('dk_exd_depart');

  const handleLaunch = () => {
    if (isBusy || !launchCheck.ok) return;
    onUpdateState((prev) => {
      const res = launchExpedition(prev, validSelectedPids, selectedLength);
      return res.state;
    });
    setSelectedPids([]);
  };

  const handleNarrateBriefing = () => {
    if (!onNarrateScene) return;
    const names = validSelectedPids
      .map((pid) => state.prisoners.find((p) => p.pid === pid)?.name)
      .filter(Boolean)
      .join(', ');
    onNarrateScene(
      'Expedition Briefing',
      `At the dungeon gate, the keeper inspects the ${selectedLength} expedition roster (${names || 'undecided'}) and reviews relics (${state.relics.owned.length}/4 owned, ${state.relics.shards}/3 shards).`,
      departArt
    );
  };

  return (
    <div>
      {/* Gate & Status Banner */}
      <div className={`dk-lock-banner ${unlocked && dayActive && !crusadeBlocked ? 'day-ready' : ''}`}>
        <span>
          {!unlocked
            ? `🔒 Expeditions unlock at Wave ${EXPED_CFG.UNLOCK_W} (Current: Wave ${state.wave}).`
            : crusadeBlocked
              ? '🚫 Expeditions blocked while a Holy Crusade is active!'
              : activeExp
                ? `🗺 Expedition currently active (${state.expedition.day}/${state.expedition.maxDays}d · Depth ${state.expedition.depth}/${state.expedition.maxDepth}).`
                : dayActive
                  ? `⚡ EXPEDITION DESK — ${state.ap}/${state.apMax} AP · Max Crew: ${maxCrew}${state.estate.landmarks.hq ? ' (HQ +1)' : ''}`
                  : '🔒 DAY — Expeditions launch during Day (AP) phase (1 AP).'}
        </span>
        {onNarrateScene && (
          <button
            type="button"
            className="dk-btn sm pri"
            disabled={isBusy}
            onClick={handleNarrateBriefing}
          >
            Narrate Briefing
          </button>
        )}
      </div>

      {/* Relics, Shards & Aftereffects Strip */}
      <div className="dk-card teal">
        <div className="dk-row" style={{ marginBottom: 4 }}>
          <strong style={{ color: 'var(--c)' }}>RELICS &amp; EXPEDITION AFTEREFFECTS</strong>
          <span className="dk-badge y">Shards: {state.relics.shards}/{EXPED_CFG.SHARDS_PER_RELIC}</span>
        </div>
        <div className="dk-exp-relic-strip" style={{ marginBottom: 6 }}>
          {EXPEDITION_RELICS.map((rel) => {
            const owned = state.relics.owned.includes(rel.key);
            return (
              <span
                key={rel.key}
                className={`dk-badge ${owned ? 'n' : 'n'}`}
                style={{ opacity: owned ? 1 : 0.4 }}
                title={rel.effect}
              >
                {rel.icon} {rel.label} {owned ? '✓' : '· Locked'}
              </span>
            );
          })}
        </div>
        {state.expedition.afterEffects.length > 0 && (
          <div className="dk-wrap">
            {state.expedition.afterEffects.map((af) => {
              const def = EXPEDITION_AFTEREFFECT_MAP[af.key as AfterEffectKey];
              if (!def) return null;
              return (
                <span
                  key={af.key}
                  className={`dk-badge ${def.heroMod < 0 ? 'n' : def.heroMod > 0 ? 'r' : 'y'}`}
                  title={def.desc}
                >
                  {def.icon} {def.label} ({af.wavesLeft}W)
                </span>
              );
            })}
          </div>
        )}
      </div>

      {activeExp ? (
        <div className="dk-card accent">
          {departArt && (
            <img src={departArt} alt="Expedition Underway" className="dk-scene-banner" />
          )}
          <div className="dk-row">
            <strong style={{ color: 'var(--y)' }}>WAR-PARTY DEPLOYED</strong>
            <span className="dk-badge c">
              Day {state.expedition.day}/{state.expedition.maxDays} · Depth {state.expedition.depth}/{state.expedition.maxDepth}
            </span>
          </div>
          <div className="dk-help-hint" style={{ marginTop: 4 }}>
            Crew: {state.expedition.crew.map((m) => `${m.name} (${m.stamina} ST)`).join(', ')} ·
            Resolves in the EXPED phase after M.Settle.
          </div>
        </div>
      ) : (
        <>
          {/* 5 Trip Lengths */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--y)' }}>1. SELECT TRIP LENGTH (5 ROUTES)</strong>
              <span className="dk-help-hint">Cleared: {state.expedition.clearedLengths.length}/5</span>
            </div>
            <div className="dk-exp-len-grid">
              {EXPEDITION_LENGTHS.map((len) => {
                const check = canSelectTripLength(state, len.key, validSelectedPids.length);
                const cleared = state.expedition.clearedLengths.includes(len.key);
                return (
                  <button
                    key={len.key}
                    type="button"
                    className={`dk-exp-len-card ${selectedLength === len.key ? 'sel' : ''} ${!check.ok ? 'locked' : ''}`}
                    onClick={() => setSelectedLength(len.key)}
                  >
                    <div className="dk-row">
                      <strong>
                        {len.icon} {len.label}
                      </strong>
                      <span className="dk-badge y">{len.costMp} MP</span>
                    </div>
                    <div className="dk-help-hint">
                      {len.days} Days · Depth {len.maxDepth} {cleared ? '· ✓ Cleared' : ''}
                    </div>
                    <small style={{ color: check.ok ? 'var(--o)' : 'var(--r)', fontSize: 10 }}>
                      {check.ok ? len.tip : `Locked: ${check.reason}`}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Crew Selection */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--c)' }}>
                2. SELECT CREW ({validSelectedPids.length}/{maxCrew})
              </strong>
              <span className="dk-help-hint">
                Eligible: Resist &le; {EXPED_CFG.RESIST_MAX} · Stamina &ge; {EXPED_CFG.STAMINA_MIN}
              </span>
            </div>
            {state.prisoners.length === 0 ? (
              <div className="dk-help-hint">No captives in holding cells.</div>
            ) : (
              <div className="dk-exp-crew-grid">
                {state.prisoners.map((p) => {
                  const elig = isPrisonerEligibleForExpedition(p);
                  const isSel = validSelectedPids.includes(p.pid);
                  const fleePct = Math.round(
                    getDailyFleeChance(
                      state,
                      {
                        pid: p.pid,
                        name: p.name,
                        grade: p.grade,
                        stamina: p.stamina,
                        ailments: [],
                        resist: p.resist,
                        obeyMarks: p.marks.obey,
                        loyal: p.marks.obey >= 2,
                        title: p.title,
                        prisonerSnapshot: p,
                      } as RichExpeditionCrewMember
                    ) * 1000
                  ) / 10;
                  return (
                    <button
                      key={p.pid}
                      type="button"
                      className={`dk-exp-crew-card ${isSel ? 'sel' : ''}`}
                      disabled={!elig.ok || (!isSel && validSelectedPids.length >= maxCrew)}
                      onClick={() => togglePid(p.pid)}
                    >
                      <div className="dk-row">
                        <span>
                          {isSel ? '☑ ' : '☐ '}
                          <b>{p.name}</b>
                        </span>
                        <GradeBadge grade={p.grade} />
                      </div>
                      <div className="dk-help-hint">
                        ST {p.stamina}/{p.staminaMax} · Res {p.resist}% · Flee {fleePct}%/d
                      </div>
                      {!elig.ok && (
                        <small style={{ color: 'var(--r)', fontSize: 10 }}>{elig.reason}</small>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Launch Action */}
          <button
            type="button"
            className="dk-btn cta"
            disabled={isBusy || !launchCheck.ok}
            onClick={handleLaunch}
          >
            <span>
              {launchCheck.ok
                ? `🗺 LAUNCH EXPEDITION (${validSelectedPids.length} Crew)`
                : `🔒 ${launchCheck.reason}`}
            </span>
            <span style={{ color: '#000' }}>1 AP</span>
          </button>
        </>
      )}
    </div>
  );
}
