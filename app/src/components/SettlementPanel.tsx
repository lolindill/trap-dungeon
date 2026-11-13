import { resolveSceneAsset } from '../data/assetManifest';
import { GAMEOVER_DEFS } from '../engine/endings';
import type { GameState } from '../types/game';
import { GradeBadge } from './GradeBadge';

interface SettlementPanelProps {
  state: GameState;
  isBusy?: boolean;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
  onNextWave: () => void;
}

const OUTCOME_COLORS: Record<string, string> = {
  wipe: 'var(--n)',
  retreat: 'var(--c)',
  fall: 'var(--y)',
  partial: 'var(--b)',
  breach: 'var(--r)',
};

export function SettlementPanel({ state, isBusy, onNarrateScene, onNextWave }: SettlementPanelProps) {
  const s = state.lastSettlement;
  if (!s) return null;

  const headlineColor = OUTCOME_COLORS[s.outcome] ?? 'var(--w)';

  return (
    <div>
      <div
        className="dk-floor-head"
        style={{ borderLeftColor: headlineColor }}
      >
        <div>
          <strong style={{ color: headlineColor, fontSize: 15 }}>
            WAVE {s.wave} — {s.outcome.toUpperCase()}
          </strong>
          <div className="dk-help-hint">
            Killed: {s.killedCount} · Captured: {s.capturedCount} · Guild Threat Next Wave: Lv.{s.guildLv}
          </div>
        </div>
        <span
          className="dk-dc-badge"
          style={{
            background: s.totalDelta >= 0 ? 'var(--n)' : 'var(--r)',
          }}
        >
          {s.totalDelta >= 0 ? `+${s.totalDelta}` : s.totalDelta} MP
        </span>
      </div>

      {/* Itemized MP Ledger */}
      <div className="dk-card">
        <div style={{ color: 'var(--c)', fontWeight: 700, marginBottom: 6 }}>
          MANA LEDGER BREAKDOWN
        </div>
        {s.items.map((item, idx) => (
          <div key={idx} className="dk-ledger-row">
            <span>{item.label}</span>
            <span className={item.delta >= 0 ? 'dk-pos' : 'dk-neg'}>
              {item.delta >= 0 ? `+${item.delta}` : item.delta} MP
            </span>
          </div>
        ))}
        <div
          className="dk-ledger-row"
          style={{ borderBottom: 0, marginTop: 6, color: 'var(--y)', fontWeight: 700 }}
        >
          <span>RESERVES AFTER SETTLEMENT</span>
          <span>{s.pointsAfter} MP</span>
        </div>
      </div>

      {/* Stat Shifts */}
      <div className="dk-card">
        <div style={{ color: 'var(--c)', fontWeight: 700, marginBottom: 6 }}>
          DUNGEON REPUTATION &amp; CAPTIVES
        </div>
        <div className="dk-ledger-row">
          <span>Fame</span>
          <b>
            {s.fameBefore} → {s.fameAfter}
          </b>
        </div>
        <div className="dk-ledger-row">
          <span>Momentum</span>
          <b>
            {s.momentumBefore >= 0 ? `+${s.momentumBefore}` : s.momentumBefore} →{' '}
            {s.momentumAfter >= 0 ? `+${s.momentumAfter}` : s.momentumAfter}
          </b>
        </div>
        <div className="dk-ledger-row" style={{ borderBottom: 0 }}>
          <span>Total Captives in Holding</span>
          <b style={{ color: 'var(--m)' }}>{state.prisoners.length}</b>
        </div>
      </div>

      {/* Newly Captured / Recent Prisoners Preview */}
      {state.prisoners.length > 0 && (
        <div className="dk-card">
          <div style={{ color: 'var(--m)', fontWeight: 700, marginBottom: 6 }}>
            CAPTIVE HOLDING ROSTER
          </div>
          {state.prisoners.slice(-5).map((p) => (
            <div key={p.pid} className="dk-ledger-row" style={{ alignItems: 'center' }}>
              <span>
                #{p.pid} <b>{p.name}</b> ({p.raceLabel} {p.classLabel}) · Resist {p.resist}%
              </span>
              <GradeBadge grade={p.grade} />
            </div>
          ))}
        </div>
      )}

      {/* Major Crisis / Relic Deterministic Art Card */}
      {state.crises.lastCrisisCard && state.crises.lastCrisisCard.wave === s.wave && (
        <div className="dk-crisis-card" style={{ marginBottom: 10 }}>
          {resolveSceneAsset(state.crises.lastCrisisCard.assetKey) && (
            <img
              src={resolveSceneAsset(state.crises.lastCrisisCard.assetKey)}
              alt={state.crises.lastCrisisCard.title}
              className="dk-scene-banner"
            />
          )}
          <div className="dk-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--y)' }}>{state.crises.lastCrisisCard.title}</strong>
            {onNarrateScene && (
              <button
                type="button"
                className="dk-btn sm pri"
                disabled={isBusy}
                onClick={() => {
                  const c = state.crises.lastCrisisCard!;
                  onNarrateScene(
                    c.title,
                    `${c.subtitle}\n${c.body}`,
                    resolveSceneAsset(c.assetKey)
                  );
                }}
              >
                Narrate Scene Now
              </button>
            )}
          </div>
          <div className="dk-help-hint" style={{ color: 'var(--c)' }}>
            {state.crises.lastCrisisCard.subtitle}
          </div>
          <div className="dk-help-hint" style={{ color: 'var(--w)' }}>
            {state.crises.lastCrisisCard.body}
          </div>
        </div>
      )}

      {state.crises.pendingGameOver && (
        <div
          className="dk-floor-head"
          style={{
            borderLeftColor: 'var(--r)',
            background: 'rgba(185, 28, 28, 0.14)',
            marginBottom: 10,
          }}
        >
          <strong>
            💀 COLLAPSE FLAGGED: {GAMEOVER_DEFS[state.crises.pendingGameOver].title}
          </strong>
          <div className="dk-help-hint" style={{ color: 'var(--w)', marginTop: 4 }}>
            {GAMEOVER_DEFS[state.crises.pendingGameOver].cause}
          </div>
        </div>
      )}

      <button
        type="button"
        className="dk-btn cta"
        onClick={onNextWave}
      >
        {state.crises.pendingGameOver ? (
          <>
            <span>CONFRONT GAME OVER &amp; RECOVERY →</span>
            <span style={{ color: '#000' }}>Rewind / Load Slot / Narrate Fall</span>
          </>
        ) : state.settings.skipDay ? (
          <>
            <span>PROCEED TO WAVE {s.wave + 1} BUILD PHASE →</span>
            <span style={{ color: '#000' }}>Skip Day · Fortify ({s.pointsAfter} MP)</span>
          </>
        ) : (
          <>
            <span>ENTER DAY {s.wave} ESTATE &amp; AP PHASE →</span>
            <span style={{ color: '#000' }}>Domain, Prison &amp; Officers ({s.pointsAfter} MP)</span>
          </>
        )}
      </button>
    </div>
  );
}
