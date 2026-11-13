import { TRAIT_MAP } from '../data/constants';
import { HERO_BONDS, HERO_STORIES, REALM_SITUATIONS } from '../data/realmData';
import { getGuildLevel, getGuildTierInfo } from '../engine/heroes';
import { getActiveRealmSituations, getGuildPrepInfo } from '../engine/realm';
import type { GameState } from '../types/game';
import { GradeBadge } from './GradeBadge';

interface PrepPanelProps {
  state: GameState;
  isBusy: boolean;
  onRunAiPrep: () => void;
  onStartRaid: (allowDefault?: boolean) => void;
  onBackToBuild: () => void;
}

export function PrepPanel({
  state,
  isBusy,
  onRunAiPrep,
  onStartRaid,
  onBackToBuild,
}: PrepPanelProps) {
  const wave = state.prepMeta?.wave ?? state.wave + 1;
  const guildLv = getGuildLevel(state, wave);
  const tier = getGuildTierInfo(wave, guildLv);
  const ready = Boolean(state.prepMeta?.heroesReady);
  const evalScores = state.evalScores;
  const activeRealms = getActiveRealmSituations(state, wave);
  const gprepInfo = getGuildPrepInfo(state, wave);

  const evalRows: { label: string; value?: number; lewd?: boolean }[] = evalScores
    ? [
        { label: 'Effect', value: evalScores.effect },
        { label: 'Novelty', value: evalScores.novelty },
        { label: 'Fun', value: evalScores.fun },
        { label: 'Aesthetic', value: evalScores.aesthetic },
        { label: 'Lewdness', value: evalScores.lewd, lewd: true },
      ]
    : [];

  return (
    <div>
      <div className="dk-floor-head">
        <div>
          <strong style={{ color: 'var(--c)' }}>WAVE {wave} RECONNAISSANCE</strong>
          <div className="dk-help-hint">
            Guild Threat Lv.{guildLv} · {tier.tag} ({tier.desc})
          </div>
        </div>
        <GradeBadge grade={ready ? 'S' : '?'} label={ready ? 'READY' : 'AWAITING EVAL'} />
      </div>

      {/* Eval Card */}
      {evalScores ? (
        <div className="dk-card">
          <div className="dk-card-row" style={{ marginBottom: 6 }}>
            <b style={{ color: 'var(--y)' }}>LILIM&apos;S DUNGEON AUDIT</b>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {evalScores.bonusMp > 0 && (
                <span className="dk-badge n">+{evalScores.bonusMp} MP Bonus</span>
              )}
              {evalScores.overall && <GradeBadge grade={evalScores.overall} />}
            </div>
          </div>
          <div className="dk-eval-bars">
            {evalRows.map((row) => {
              const v = row.value ?? 0;
              return (
                <div key={row.label} style={{ display: 'contents' }}>
                  <span>{row.label}</span>
                  <div className="dk-bar-track">
                    <div
                      className={`dk-bar-fill ${row.lewd ? 'lewd' : ''}`}
                      style={{ width: `${Math.min(100, v * 10)}%` }}
                    />
                  </div>
                  <b style={{ color: 'var(--w)', textAlign: 'right' }}>{v}/10</b>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dk-card" style={{ borderStyle: 'dashed', color: 'var(--y)' }}>
          {(state.prepMeta?.newTrapIds.length ?? 0) > 0
            ? `${state.prepMeta?.newTrapIds.length} new trap(s) & ${(state.prepMeta?.comboFloors.length ?? 0)} combo room(s) await Lilim's grading.`
            : 'All traps already have grades! Run Prep Briefing to generate hero profiles & Lilim eval bonus.'}
        </div>
      )}

      {/* Read-Only Active Realm & Guild Prep Summary */}
      {(activeRealms.length > 0 || gprepInfo.effectiveLv > 0 || state.crises.crusade.active) && (
        <div className="dk-card" style={{ borderColor: 'var(--o)', marginBottom: 8 }}>
          {state.crises.crusade.active && (
            <div style={{ color: 'var(--r)', fontWeight: 700, marginBottom: 4 }}>
              ✝ HOLY CRUSADE ACTIVE ({state.crises.crusade.wavesLeft} wave(s) left)
              {state.party.some((h) => h.epicKind === 'grandmaster')
                ? ' — GRAND MASTER ON FIELD!'
                : ''}
            </div>
          )}
          {activeRealms.map((sit) => {
            const def = REALM_SITUATIONS[sit.key];
            if (!def) return null;
            return (
              <div key={sit.key} className="dk-help-hint" style={{ marginBottom: 2 }}>
                <b style={{ color: sit.countered ? 'var(--g)' : 'var(--o)' }}>
                  {def.icon} {def.name}
                  {sit.countered ? ' [COUNTERED]' : ''}:
                </b>{' '}
                {def.summary}
              </div>
            );
          })}
          {gprepInfo.effectiveLv > 0 && (
            <div className="dk-help-hint" style={{ color: 'var(--y)', marginTop: 3 }}>
              <b>🎒 Guild Counter-Gear Lv.{gprepInfo.effectiveLv}</b>
              {gprepInfo.reason ? ` (${gprepInfo.reason})` : ''}:{' '}
              {gprepInfo.gearNames.length > 0 ? gprepInfo.gearNames.join(' · ') : 'Active'}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons for LLM Prep */}
      <div className="dk-acts" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="dk-btn pri"
          style={{ flex: 1 }}
          disabled={isBusy}
          onClick={onRunAiPrep}
        >
          {isBusy
            ? 'Summoning Lilim & Scouting...'
            : ready
              ? 'Re-run AI Grading & Briefing'
              : 'Request AI Trap Grading & Hero Briefing'}
        </button>
        <button
          type="button"
          className="dk-btn"
          disabled={isBusy}
          onClick={onBackToBuild}
        >
          ← Back to Build
        </button>
      </div>

      {/* Incoming Hero Roster */}
      <div style={{ color: 'var(--c)', fontWeight: 700, marginBottom: 6 }}>
        INCOMING ADVENTURER PARTY (3 HEROES)
      </div>

      {state.party.map((h) => {
        const bondDef = h.bondKey ? HERO_BONDS[h.bondKey] : null;
        const storyDef = h.storyKey ? HERO_STORIES[h.storyKey] : null;
        const partner =
          h.bondTargetSlot !== undefined
            ? state.party.find((p) => p.slot === h.bondTargetSlot)
            : undefined;
        return (
          <div
            key={h.slot}
            className="dk-hero-card"
            style={h.epic ? { borderColor: 'var(--r)', boxShadow: '0 0 8px rgba(255,80,80,0.2)' } : undefined}
          >
            <div className="dk-hero-top">
              <span className="dk-hero-name">
                #{h.slot} {h.name || `${h.raceLabel} ${h.classLabel}`}
                {h.epic && (
                  <span className="dk-badge r" style={{ marginLeft: 6 }}>
                    {h.epicLabel ?? 'EPIC'}
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {h.grit !== undefined && h.maxGrit !== undefined && (
                  <span
                    className="dk-badge y"
                    title="Grit Resolve (◆): lethal hits cost 2◆, captures cost 1◆ — hero endures as injured/severe while ◆ > 0."
                  >
                    {'◆'.repeat(h.grit)}
                    {'◇'.repeat(Math.max(0, h.maxGrit - h.grit))} ({h.grit}/{h.maxGrit})
                  </span>
                )}
                <GradeBadge grade={h.grade} />
                <span className="dk-badge">{h.gender === 'female' ? 'F' : 'M'}</span>
              </div>
            </div>

            <div className="dk-tag-row">
              <span className="dk-badge c">{h.raceLabel}</span>
              <span className="dk-badge y">{h.classLabel}</span>
              <span className="dk-badge">{h.age}</span>
              <span className="dk-badge">{h.looks}</span>
              <span className="dk-badge">{h.exp}</span>
              {h.intel > 0 && <span className="dk-badge m">INTEL EXPOSED (-{h.intel})</span>}
              {bondDef && (
                <span className="dk-badge c" title={`${bondDef.label}: ${bondDef.effectHint}`}>
                  {bondDef.icon} {bondDef.label}
                  {partner ? ` (with #${partner.slot})` : ''}
                </span>
              )}
              {storyDef && (
                <span className="dk-badge g" title={`${storyDef.label}: ${storyDef.effectHint}`}>
                  {storyDef.icon} {storyDef.label}
                </span>
              )}
            </div>

            {h.epic && (
              <div className="dk-help-hint" style={{ color: 'var(--r)', marginTop: 3 }}>
                {h.epicKind === 'grandmaster'
                  ? '✝ Sanctuary (d20+13 vs DC+2 -> +1 allies) · Aura +1 · Guarded · No Retreat'
                  : `💀 Memory (+3 on unchanged floors) · Adaptation (${h.adaptedTags?.join(', ') || 'none yet'}) · Aura +1 · Guarded · No Retreat`}
              </div>
            )}

            <div className="dk-help-hint" style={{ color: 'var(--g)', marginTop: 3 }}>
              Traits:{' '}
              {h.traits
                .map((tk) => TRAIT_MAP[tk]?.key ?? tk)
                .join(', ')}
            </div>
            <div className="dk-help-hint" style={{ color: 'var(--m)' }}>
              Kink Trigger: {h.kinkText || `${h.kinkKey} — ${h.kinkDesc}`}
            </div>
            {h.appearance && (
              <div className="dk-help-hint" style={{ marginTop: 3 }}>
                {h.appearance} · {h.outfit}
              </div>
            )}
            {h.weakness && (
              <div className="dk-help-hint" style={{ color: 'var(--y)' }}>
                Weakness: {h.weakness} {h.skill ? `· Skill: ${h.skill}` : ''}
              </div>
            )}
          </div>
        );
      })}

      {/* Start Raid Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <button
          type="button"
          className="dk-btn cta"
          disabled={isBusy || !ready}
          onClick={() => onStartRaid(false)}
        >
          <span>OPEN THE DUNGEON GATES (START WAVE {wave}) →</span>
          <span style={{ color: '#000' }}>
            {ready ? 'All Heroes Briefed' : 'Run AI Prep First'}
          </span>
        </button>

        {!ready && (
          <button
            type="button"
            className="dk-btn sm amber"
            disabled={isBusy}
            onClick={() => onStartRaid(true)}
            title="Start immediately offline/without AI by assigning C-rank fallback to ungraded traps"
          >
            Quick Start Without AI Briefing (Fallback Grade C for unrated &apos;?&apos;)
          </button>
        )}
      </div>
    </div>
  );
}
