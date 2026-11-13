import { useState } from 'react';
import { resolveNpcImage, resolveSceneAsset } from '../data/assetManifest';
import {
  OFFICER_INTERACTIONS,
  OFFICER_PASSIVE_PERKS,
  type OfficerInteractionDef,
} from '../data/estateData';
import { isDayPhase } from '../engine/dayLoop';
import {
  canUseOfficerInteraction,
  getOfficerPerksSummary,
  getOfficerProfileStats,
  getOfficerSceneContext,
  giftOfficer,
  OFFICER_DISPLAY,
  performOfficerInteraction,
  talkToOfficer,
} from '../engine/officers';
import '../styles/estate.css';
import type { GameState, OfficerKey } from '../types/game';

export interface OfficersPanelProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
  onFinishMSettle?: () => void;
  onFinishDebt?: () => void;
  onEndDayAiJournal?: () => void;
  onEndDayQuickSettle?: () => void;
}

const OFFICER_KEYS: readonly OfficerKey[] = ['vesper', 'lilim', 'eleonora'];

export function OfficersPanel({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
}: OfficersPanelProps) {
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerKey>('vesper');
  const [lastInteraction, setLastInteraction] = useState<OfficerInteractionDef | null>(
    null
  );

  const dayActive = isDayPhase(state);
  const hasCrisis = Boolean(state.estate.activeCrisis);
  const apLocked = !dayActive || state.ap <= 0 || hasCrisis;
  const apBadgeText = !dayActive
    ? '🔒 DAY'
    : hasCrisis
      ? '🔒 CRISIS'
      : state.ap <= 0
        ? '🔒 0 AP'
        : '1 AP';

  const profile = getOfficerProfileStats(state, selectedOfficer);
  const perksSummary = getOfficerPerksSummary(state);
  const usedToday = Boolean(state.apUsed[`officer_${selectedOfficer}`]);
  const interactions = OFFICER_INTERACTIONS.filter(
    (ia) => ia.officer === selectedOfficer
  );
  const passives = OFFICER_PASSIVE_PERKS[selectedOfficer];

  const handleNarrate = () => {
    if (!onNarrateScene) return;
    const recent =
      lastInteraction && lastInteraction.officer === selectedOfficer
        ? lastInteraction
        : undefined;
    const ctx = getOfficerSceneContext(state, selectedOfficer, recent);
    onNarrateScene(ctx.title, ctx.context, ctx.imageUrl);
  };

  return (
    <div>
      <div className={`dk-lock-banner ${dayActive ? 'day-ready' : ''}`}>
        <span>
          {dayActive
            ? `⚡ DAY PHASE ACTIVE — ${state.ap}/${state.apMax} AP · 1 action per officer/day.`
            : '🔒 DAY — Inspect Officer stages & perks freely; AP actions unlock in Day (AP).'}
        </span>
      </div>

      {/* Officer Selector Row */}
      <div className="dk-officer-row" style={{ marginBottom: 8 }}>
        {OFFICER_KEYS.map((key) => {
          const p = getOfficerProfileStats(state, key);
          const nearStage =
            p.nextThreshold !== null && p.nextThreshold - p.aff <= 6;
          const sprite = resolveNpcImage(key, 'standing');
          return (
            <button
              key={key}
              type="button"
              className={`dk-officer-card ${selectedOfficer === key ? 'sel' : ''}`}
              onClick={() => setSelectedOfficer(key)}
            >
              {sprite && (
                <img src={sprite} alt={p.name} className="dk-officer-portrait" />
              )}
              <strong>
                {p.name} {nearStage ? '★' : ''}
              </strong>
              <span className="dk-help-hint">
                S{p.stage}/{p.maxStage} · Aff {p.aff}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Officer Profile & Stats */}
      <div className="dk-card teal">
        <div className="dk-row" style={{ marginBottom: 6 }}>
          <div className="dk-wrap">
            {profile.portraitUrl && (
              <img
                src={profile.portraitUrl}
                alt={profile.name}
                className="dk-officer-portrait"
                style={{ width: 48, height: 54 }}
              />
            )}
            <div>
              <div>
                <strong style={{ color: 'var(--y)' }}>
                  {profile.name.toUpperCase()}
                </strong>{' '}
                <span className="dk-badge m">
                  Stage {profile.stage}/{profile.maxStage}
                </span>
              </div>
              <div className="dk-help-hint">
                {OFFICER_DISPLAY[selectedOfficer].role} · Mood: <i>{profile.mood}</i>
              </div>
            </div>
          </div>

          {onNarrateScene && (
            <button
              type="button"
              className="dk-btn sm pri"
              disabled={isBusy}
              onClick={handleNarrate}
            >
              Narrate Scene Now
            </button>
          )}
        </div>

        <div className="dk-stat-grid" style={{ fontSize: 11, marginBottom: 8 }}>
          <div>
            Affinity: <b>{profile.aff}</b>
            {profile.nextThreshold !== null
              ? ` / ${profile.nextThreshold}`
              : ' (Max)'}
            <div className="dk-mini-bar">
              <div
                className="dk-mini-fill lust"
                style={{
                  width: `${
                    profile.nextThreshold
                      ? Math.min(100, Math.round((profile.aff / profile.nextThreshold) * 100))
                      : 100
                  }%`,
                }}
              />
            </div>
          </div>
          <div>
            Trust: <b>{profile.trust}%</b>
            <div className="dk-mini-bar">
              <div className="dk-mini-fill" style={{ width: `${profile.trust}%` }} />
            </div>
          </div>
          <div>
            Corruption: <b>{profile.corruption}%</b>
            <div className="dk-mini-bar">
              <div
                className="dk-mini-fill amber"
                style={{ width: `${profile.corruption}%` }}
              />
            </div>
          </div>
          <div className="dk-help-hint" style={{ alignSelf: 'center' }}>
            {selectedOfficer === 'vesper' &&
              `Rest x${perksSummary.restMultiplier} · Sale x${perksSummary.prisonSaleMult.toFixed(2)}`}
            {selectedOfficer === 'lilim' &&
              `Upg x${perksSummary.trapUpgradeDiscountMult.toFixed(2)} · Prep Intel +${perksSummary.prepIntelBonus}`}
            {selectedOfficer === 'eleonora' &&
              `Interest ${(perksSummary.debtInterestRate * 100).toFixed(1)}% · Handover x${perksSummary.handoverMult}`}
          </div>
        </div>

        {/* Talk / Gift (1 AP) */}
        <div className="dk-act-grid" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className="dk-act-btn"
            disabled={isBusy || apLocked || usedToday}
            onClick={() =>
              onUpdateState((prev) => talkToOfficer(prev, selectedOfficer).state)
            }
          >
            <div className="dk-row">
              <span>Talk / Spend Time</span>
              <span className="ap-chip">{usedToday ? 'DONE' : apBadgeText}</span>
            </div>
            <small>Gain Affinity (Manor &amp; Facility bonuses apply)</small>
          </button>

          <button
            type="button"
            className="dk-act-btn"
            disabled={isBusy || apLocked || usedToday || state.points < 40}
            onClick={() =>
              onUpdateState((prev) => giftOfficer(prev, selectedOfficer).state)
            }
          >
            <div className="dk-row">
              <span>Give Gift (40 MP)</span>
              <span className="ap-chip">{usedToday ? 'DONE' : apBadgeText}</span>
            </div>
            <small>+4 Base Affinity · Queued to Day Log</small>
          </button>
        </div>

        {/* Passive Perks */}
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: 'var(--c)', fontSize: 11, display: 'block', marginBottom: 4 }}>
            STAGE PASSIVE PERKS
          </strong>
          <div className="dk-perk-list">
            {passives.map((perk) => {
              const unlocked = profile.stage >= perk.stage;
              return (
                <div
                  key={perk.stage}
                  className={`dk-perk-item ${unlocked ? 'unlocked' : ''}`}
                >
                  <span className={`dk-badge ${unlocked ? 'n' : ''}`}>
                    S{perk.stage}
                  </span>
                  <span>{perk.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Starred & Stage Interactions (1 AP) */}
        <div>
          <div className="dk-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--m)', fontSize: 11 }}>
              OFFICER DECREES &amp; STARRED SCENES (★)
            </strong>
            <span className="ap-chip">{usedToday ? 'VISITED TODAY' : apBadgeText}</span>
          </div>
          <div className="dk-ia-grid">
            {interactions.map((ia) => {
              const check = canUseOfficerInteraction(state, ia);
              const artThumb = resolveSceneAsset(ia.artKey);
              return (
                <button
                  key={ia.id}
                  type="button"
                  className={`dk-ia-btn ${ia.star ? 'star' : ''}`}
                  disabled={isBusy || !check.ok}
                  title={check.ok ? ia.effectText : check.reason}
                  onClick={() => {
                    onUpdateState((prev) => {
                      const res = performOfficerInteraction(prev, ia.id);
                      if (res.ok) setLastInteraction(ia);
                      return res.state;
                    });
                  }}
                >
                  <div className="dk-row">
                    <span>
                      {ia.star ? '★ ' : ''}
                      <b>{ia.id}</b> {ia.title}
                    </span>
                    <span className="dk-badge y">S{ia.stage}</span>
                  </div>
                  <small>
                    {ia.mpCost ? `${ia.mpCost} MP · ` : ''}
                    {ia.effectText}
                  </small>
                  {!check.ok && (
                    <small style={{ color: 'var(--r)' }}>
                      {artThumb ? '' : ''}🔒 {check.reason}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
