import { useEffect, useState } from 'react';
import { resolveSceneAsset } from '../data/assetManifest';
import {
  computeRankTrialProgress,
  ENDING_DEFS,
  formatDeterministicEndingSummary,
  GAMEOVER_DEFS,
  RANK_TRIALS,
} from '../engine/endings';
import { loadSaveSlots, SAVE_SLOT_IDS } from '../engine/saveLoad';
import type {
  EndingKey,
  GameOverKey,
  GameState,
  SaveSlotId,
  SaveSlotRecord,
} from '../types/game';

interface EndingGameOverModalProps {
  state: GameState;
  mode: 'ending' | 'gameover';
  endingKey: EndingKey | null;
  gameOverKey: GameOverKey | null;
  llmConfigured: boolean;
  narrationText: string | null;
  narrating: boolean;
  onNarrate: (kind: 'ending' | 'gameover', key: EndingKey | GameOverKey) => void;
  onContinueEndless: () => void;
  onRewindWaveStart: () => void;
  onLoadSlot: (slotId: SaveSlotId) => void;
  onNewRun: () => void;
  onClose: () => void;
}

export function EndingGameOverModal({
  state,
  mode,
  endingKey,
  gameOverKey,
  llmConfigured,
  narrationText,
  narrating,
  onNarrate,
  onContinueEndless,
  onRewindWaveStart,
  onLoadSlot,
  onNewRun,
  onClose,
}: EndingGameOverModalProps) {
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [slots, setSlots] = useState<Record<SaveSlotId, SaveSlotRecord | null>>(() =>
    loadSaveSlots(),
  );

  useEffect(() => {
    if (showSlotPicker) {
      setSlots(loadSaveSlots());
    }
  }, [showSlotPicker]);

  const activeEndKey: EndingKey = endingKey ?? state.endings.activeEnding ?? 'liberation';
  const activeGoKey: GameOverKey = gameOverKey ?? state.endings.gameOver ?? 'core';

  const isGameOver = mode === 'gameover';
  const endDef = ENDING_DEFS[activeEndKey];
  const goDef = GAMEOVER_DEFS[activeGoKey];

  const artKey = isGameOver ? goDef.artKey : endDef.artKey;
  const artUrl = resolveSceneAsset(artKey);

  const canRewind = Boolean(state.waveStartSnapshot);
  const rt = state.rankTrials;
  const trialDef = RANK_TRIALS.find((t) => t.key === rt.currentTrial) ?? null;
  const liveProgress = trialDef ? computeRankTrialProgress(state, rt) : 0;

  const unlockedEndingKeys = Object.keys(state.endings.unlocked).filter(
    (k) => !k.startsWith('go_'),
  ) as EndingKey[];

  const displayProse =
    narrationText ??
    formatDeterministicEndingSummary(
      state,
      isGameOver ? 'gameover' : 'ending',
      isGameOver ? activeGoKey : activeEndKey,
    );

  return (
    <div
      className="dk-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={isGameOver ? 'Game Over Recovery' : 'Canonical Ending Finale'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dk-modal" style={{ maxWidth: 820, width: '94vw' }}>
        <div
          className="dk-modal-head"
          style={{
            background: isGameOver
              ? 'linear-gradient(90deg, rgba(160,30,45,0.28), rgba(20,10,16,0.9))'
              : 'linear-gradient(90deg, rgba(212,167,69,0.24), rgba(20,16,28,0.9))',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>
              {isGameOver
                ? `💀 GAME OVER · ${goDef.title}`
                : `👑 ENDING UNLOCKED · ${endDef.title}`}
            </h3>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {isGameOver ? `${goDef.koTitle} · Wave ${state.wave}` : `${endDef.koTitle} · ${endDef.subtitle}`}
            </div>
          </div>
          <button type="button" className="dk-btn sm" onClick={onClose}>
            {isGameOver ? 'Inspect Log' : '✕'}
          </button>
        </div>

        <div className="dk-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: artUrl ? '260px 1fr' : '1fr', gap: 14 }}>
            {artUrl && (
              <div
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: '#0d0b14',
                }}
              >
                <img
                  src={artUrl}
                  alt={isGameOver ? goDef.title : endDef.title}
                  style={{ width: '100%', height: 196, objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '6px 8px', fontSize: 11, opacity: 0.78 }}>
                  CG Key: <code>{artKey}</code>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isGameOver ? (
                <>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(180,35,50,0.14)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Cause of Fall:</strong> {goDef.cause}
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      <strong>Countermeasure Tip:</strong> {goDef.hint}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                    <span className="dk-chip">
                      🛡 Vault Core Guard: Vault {state.estate.vaultMp}/50 MP{' '}
                      {state.estate.vaultMp >= 50 ? '(Armed)' : '(Depleted)'}
                    </span>
                    <span className="dk-chip">
                      ✨ Casual Grace:{' '}
                      {state.settings.difficulty === 'casual'
                        ? state.estate.casualGraceUsed
                          ? 'Used This Run'
                          : 'Available'
                        : 'Casual Only'}
                    </span>
                    <span className="dk-chip">
                      ⏮ Wave-Start Autosave: {canRewind ? `Wave ${state.waveStartSnapshot?.wave} Ready` : 'Unavailable'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(212,167,69,0.12)',
                      border: '1px solid rgba(212,167,69,0.38)',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <div>{endDef.summary}</div>
                    <div style={{ marginTop: 6, color: '#f3d27a', fontWeight: 600 }}>
                      {endDef.rewardNote}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                    <span className="dk-chip">
                      💰 Debt:{' '}
                      {state.debt.ended
                        ? `Settled (${state.debt.ended})`
                        : `${state.debt.amount + state.debt.extraLoan} MP Active`}
                    </span>
                    <span className="dk-chip">🏰 Town Lv.{state.town.lv}</span>
                    <span className="dk-chip">💖 Eleonora Aff {state.officers.eleonora.aff}</span>
                    <span className="dk-chip">
                      👑 Unlocked Endings ({unlockedEndingKeys.length}/5):{' '}
                      {unlockedEndingKeys.join(', ') || activeEndKey}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Endless Rank Trials Status Card (when active or ending mode) */}
          {(!isGameOver || state.endings.endless) && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(139,92,246,0.10)',
                border: '1px solid rgba(139,92,246,0.34)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>
                  ⚔ Endless Rank Trials · Demon Rank {rt.rank}
                  {state.endings.titles.length > 0 ? ` (${state.endings.titles[state.endings.titles.length - 1]})` : ''}
                </strong>
                {trialDef && (
                  <span className="dk-chip">
                    Progress {liveProgress}/{trialDef.target} · Due Wave {rt.nextCheckWave}
                  </span>
                )}
              </div>
              {trialDef ? (
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  Active Trial: <strong>{trialDef.title}</strong> ({trialDef.koTitle}) — {trialDef.description}
                </div>
              ) : (
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  Continue into Endless Mode to activate Rank Trials (`wipe3`, `jobs5`, `annex1`, `epic`) cycling every 5 waves.
                </div>
              )}
            </div>
          )}

          {/* Finale / Fall Narration Box */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(10,12,20,0.65)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {displayProse}
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="dk-btn"
              disabled={narrating}
              onClick={() => onNarrate(isGameOver ? 'gameover' : 'ending', isGameOver ? activeGoKey : activeEndKey)}
            >
              {narrating
                ? 'Narrating [DK-END]...'
                : isGameOver
                  ? llmConfigured
                    ? '📜 Narrate Fall [DK-END]'
                    : '📜 Chronicle Fall Summary'
                  : llmConfigured
                    ? '✨ Narrate Finale [DK-END]'
                    : '✨ Record Finale Summary'}
            </button>

            {isGameOver ? (
              <>
                <button
                  type="button"
                  className="dk-btn cta"
                  disabled={!canRewind}
                  onClick={onRewindWaveStart}
                  title={
                    canRewind
                      ? `Restore Wave ${state.waveStartSnapshot?.wave} start snapshot`
                      : 'No wave-start snapshot available'
                  }
                >
                  ⏮ Rewind Wave Start
                </button>
                <button
                  type="button"
                  className="dk-btn"
                  onClick={() => setShowSlotPicker((v) => !v)}
                >
                  💾 Load Slot 1–5
                </button>
                <button type="button" className="dk-btn" onClick={onNewRun}>
                  🔄 New Run
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="dk-btn cta"
                  onClick={onContinueEndless}
                >
                  ♾ Continue into Endless Mode
                </button>
                <button type="button" className="dk-btn" onClick={onNewRun}>
                  🔄 New Run
                </button>
              </>
            )}
          </div>

          {/* Inline Load Slot 1-5 picker */}
          {isGameOver && showSlotPicker && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                gap: 8,
              }}
            >
              {SAVE_SLOT_IDS.map((slotId) => {
                const rec = slots[slotId];
                return (
                  <button
                    key={slotId}
                    type="button"
                    className="dk-btn sm"
                    disabled={!rec}
                    onClick={() => {
                      if (rec) {
                        onLoadSlot(slotId);
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      textAlign: 'left',
                      padding: '8px 10px',
                    }}
                  >
                    <strong>Slot {slotId}</strong>
                    {rec ? (
                      <span style={{ fontSize: 11, opacity: 0.85 }}>
                        W{rec.meta.wave} · {rec.meta.mode.toUpperCase()} · {rec.meta.points} MP
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, opacity: 0.5 }}>Empty</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
