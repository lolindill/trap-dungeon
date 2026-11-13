import { useState } from 'react';
import { resolveNpcImage, resolveSceneAsset } from '../data/assetManifest';
import { canSpendDayAp, isDayPhase } from '../engine/dayLoop';
import {
  calcPrisonerRansom,
  entertainEleonora,
  getDebtQuestProgress,
  getDebtSummary,
  getEleonoraVisitSceneContext,
  getExtraLoanInfo,
  handoverPrisonerForDebt,
  payDebt,
  requestDebtExtension,
  resolveDebtVisit,
  rollDebtQuests,
  startOrProgressGraceQuest,
  takeExtraLoan,
} from '../engine/debt';
import '../styles/estate.css';
import type { GameState } from '../types/game';
import { GradeBadge } from './GradeBadge';

export interface DebtPanelProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
  onFinishMSettle?: () => void;
  onFinishDebt?: () => void;
  onEndDayAiJournal?: () => void;
  onEndDayQuickSettle?: () => void;
}

export function DebtPanel({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
  onFinishDebt,
}: DebtPanelProps) {
  const [customPay, setCustomPay] = useState('100');
  const [handoverPid, setHandoverPid] = useState<number | null>(
    () => state.prisoners[0]?.pid ?? null
  );

  const summary = getDebtSummary(state);
  const loanInfo = getExtraLoanInfo(state);
  const dayActive = isDayPhase(state);
  const isDebtVisit = state.mode === 'debt';
  const loanApCheck = canSpendDayAp(state, 'loan');
  const elePortrait =
    resolveNpcImage('eleonora', summary.lates > 0 ? 'angry' : 'proud') ??
    resolveNpcImage('eleonora', 'standing');
  const visitArt = resolveSceneAsset(
    state.debt.cycleCount === 0 ? 'dk_debt_intro' : 'dk_base_debt'
  );

  const activeQuest = state.debt.activeQuest;
  const activeQuestStatus = activeQuest
    ? getDebtQuestProgress(state, activeQuest)
    : null;

  const selectedCaptive =
    state.prisoners.find((p) => p.pid === handoverPid) ?? state.prisoners[0] ?? null;

  const handleNarrateCollection = () => {
    if (!onNarrateScene) return;
    const ctx = getEleonoraVisitSceneContext(state);
    onNarrateScene(ctx.title, ctx.context, ctx.imageUrl);
  };

  const handleFinalizeVisit = () => {
    onUpdateState((prev) => resolveDebtVisit(prev).state);
    onFinishDebt?.();
  };

  return (
    <div>
      <div className={`dk-lock-banner ${isDebtVisit ? 'day-ready' : ''}`}>
        <span>
          {isDebtVisit
            ? '⚡ COLLECTION DAY — Eleonora Goldreich is auditing this 3-wave installment.'
            : state.debt.ended
              ? `✓ CONTRACT CONCLUDED (${state.debt.ended.toUpperCase()})`
              : `🔒 Collection visits occur every 3 waves (Next due: Wave ${summary.dueWave} · in ${summary.dueInWaves}W).`}
        </span>
        {onNarrateScene && (
          <button
            type="button"
            className="dk-btn sm pri"
            disabled={isBusy}
            onClick={handleNarrateCollection}
          >
            Narrate Scene Now
          </button>
        )}
      </div>

      {/* Main Eleonora & Ledger Card */}
      <div className={`dk-card ${isDebtVisit ? 'alert' : 'accent'}`}>
        {isDebtVisit && visitArt && (
          <img src={visitArt} alt="Eleonora Collection" className="dk-scene-banner" />
        )}
        <div className="dk-row" style={{ marginBottom: 8 }}>
          <div className="dk-wrap">
            {elePortrait && (
              <img
                src={elePortrait}
                alt="Eleonora"
                className="dk-officer-portrait"
                style={{ width: 46, height: 52 }}
              />
            )}
            <div>
              <div>
                <strong style={{ color: 'var(--y)' }}>ELEONORA GOLDREICH</strong>{' '}
                <span className="dk-badge m">
                  Stage {state.officers.eleonora.stage} · Aff {state.officers.eleonora.aff}
                </span>
              </div>
              <div className="dk-help-hint">
                Patience: <b>{summary.patience}/100</b> · Strikes:{' '}
                <b style={{ color: summary.lates > 0 ? 'var(--r)' : 'var(--n)' }}>
                  {summary.lates}/{summary.maxLates}
                </b>{' '}
                · Interest: <b>{summary.interestRatePct.toFixed(1)}%/wave</b>
              </div>
            </div>
          </div>
          <span className={`dk-badge ${summary.verdictPreview === 'late' ? 'r' : 'n'}`}>
            Verdict: {summary.verdictPreview.toUpperCase()}
          </span>
        </div>

        <div className="dk-ledger-row">
          <span>Principal Remaining</span>
          <b style={{ color: summary.principal > 0 ? 'var(--r)' : 'var(--n)' }}>
            {summary.principal} MP
          </b>
        </div>
        {summary.extraLoan > 0 && (
          <div className="dk-ledger-row">
            <span>Extra Loans (3%/wave)</span>
            <b style={{ color: 'var(--y)' }}>{summary.extraLoan} MP</b>
          </div>
        )}
        <div className="dk-ledger-row">
          <span>Total Debt / Relief Cap</span>
          <b>
            {summary.totalDebt} MP (Relief {summary.reliefUsed}/{summary.reliefCap})
          </b>
        </div>
        <div className="dk-ledger-row">
          <span>Installment Min Due (Base {summary.baseMin}{summary.extCarry > 0 ? ` + Carry ${summary.extCarry}` : ''})</span>
          <b style={{ color: 'var(--y)' }}>
            {summary.minDue} MP
            {summary.minCutPct > 0 ? ` (-${summary.minCutPct}%)` : ''}
            {summary.entCutMp > 0 ? ` (-${summary.entCutMp} Ent)` : ''}
          </b>
        </div>
        <div className="dk-ledger-row" style={{ borderBottom: 0 }}>
          <span>Paid This Visit / Remaining Due</span>
          <b style={{ color: summary.remainingDue === 0 ? 'var(--n)' : 'var(--w)' }}>
            {summary.paidThisVisit} MP / {summary.remainingDue} MP
          </b>
        </div>
      </div>

      {/* Payment / Prepay Controls */}
      {!state.debt.ended && summary.totalDebt > 0 && (
        <div className="dk-card">
          <div className="dk-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--c)' }}>
              {isDebtVisit ? 'INSTALLMENT PAYMENT' : 'PREPAY PRINCIPAL (DAY PHASE)'}
            </strong>
            <span className="dk-help-hint">Treasury: {state.points} MP</span>
          </div>
          <div className="dk-debt-pay-row">
            {isDebtVisit && summary.remainingDue > 0 && (
              <button
                type="button"
                className="dk-btn sm pri"
                disabled={isBusy || state.points <= 0}
                onClick={() =>
                  onUpdateState((prev) => payDebt(prev, summary.remainingDue).state)
                }
              >
                Pay Min Due ({Math.min(state.points, summary.remainingDue)} MP)
              </button>
            )}
            <button
              type="button"
              className="dk-btn sm"
              disabled={isBusy || (!isDebtVisit && !dayActive) || state.points < 100}
              onClick={() => onUpdateState((prev) => payDebt(prev, 100).state)}
            >
              Pay 100 MP
            </button>
            <button
              type="button"
              className="dk-btn sm"
              disabled={isBusy || (!isDebtVisit && !dayActive) || state.points < 500}
              onClick={() => onUpdateState((prev) => payDebt(prev, 500).state)}
            >
              Pay 500 MP
            </button>
            <input
              type="number"
              min={1}
              className="dk-debt-input"
              value={customPay}
              onChange={(e) => setCustomPay(e.target.value)}
            />
            <button
              type="button"
              className="dk-btn sm up"
              disabled={isBusy || (!isDebtVisit && !dayActive) || state.points <= 0}
              onClick={() => {
                const amt = Number(customPay);
                if (Number.isFinite(amt) && amt > 0) {
                  onUpdateState((prev) => payDebt(prev, amt).state);
                }
              }}
            >
              {isDebtVisit ? 'Pay Custom' : 'Prepay'}
            </button>
          </div>
          {!isDebtVisit && !dayActive && (
            <div className="dk-help-hint" style={{ marginTop: 4 }}>
              🔒 Prepay unlocks during Day (AP) phase.
            </div>
          )}
        </div>
      )}

      {/* Collection Visit Negotiation & Handover */}
      {isDebtVisit && !state.debt.ended && summary.totalDebt > 0 && (
        <div className="dk-card teal">
          <strong style={{ color: 'var(--c)', display: 'block', marginBottom: 6 }}>
            COLLECTION NEGOTIATION &amp; HANDOVER
          </strong>
          <div className="dk-act-grid" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !summary.canEntertain}
              onClick={() => onUpdateState((prev) => entertainEleonora(prev).state)}
            >
              <span>Entertain Eleonora</span>
              <small>Before MP pay · -25% Min Due on success (-1 AP next Day)</small>
            </button>

            <button
              type="button"
              className="dk-act-btn"
              disabled={isBusy || !summary.canExtend}
              onClick={() => onUpdateState((prev) => requestDebtExtension(prev).state)}
            >
              <span>Request Extension</span>
              <small>Need Pat &gt;= 30 &amp; 50% paid (+20% carry, -20 Pat)</small>
            </button>
          </div>

          {state.prisoners.length > 0 && (
            <div className="dk-row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <select
                className="dk-select"
                style={{ flex: 1, minWidth: 160 }}
                value={selectedCaptive?.pid ?? ''}
                onChange={(e) => setHandoverPid(Number(e.target.value))}
              >
                {state.prisoners.map((p) => {
                  const val = Math.floor(
                    calcPrisonerRansom(state, p, false) *
                      (state.officers.eleonora.stage >= 2 ? 1.3 : 1.2)
                  );
                  return (
                    <option key={p.pid} value={p.pid}>
                      #{p.pid} {p.name} ({p.grade}) — Credit {val} MP
                    </option>
                  );
                })}
              </select>
              {selectedCaptive && <GradeBadge grade={selectedCaptive.grade} />}
              <button
                type="button"
                className="dk-btn sm amber"
                disabled={isBusy || !selectedCaptive}
                onClick={() =>
                  selectedCaptive &&
                  onUpdateState(
                    (prev) => handoverPrisonerForDebt(prev, selectedCaptive.pid).state
                  )
                }
              >
                Handover Captive
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grace-Quest Negotiation */}
      {!state.debt.ended && summary.totalDebt > 0 && (
        <div className="dk-card">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <strong style={{ color: 'var(--m)' }}>GOLDREICH GRACE COMMISSIONS</strong>
            {isDebtVisit && !activeQuest && state.debt.offeredQuests.length === 0 && (
              <button
                type="button"
                className="dk-btn sm"
                disabled={isBusy}
                onClick={() => onUpdateState((prev) => rollDebtQuests(prev))}
              >
                Request Commissions
              </button>
            )}
          </div>

          {activeQuest && activeQuestStatus ? (
            <div>
              <div className="dk-row">
                <span>
                  <b>{activeQuest.desc}</b> (Reward: -{activeQuest.rewardMp} MP debt)
                </span>
                <span className={`dk-badge ${activeQuestStatus.complete ? 'n' : 'y'}`}>
                  {activeQuestStatus.current}/{activeQuestStatus.target}
                </span>
              </div>
              <div className="dk-mini-bar" style={{ margin: '5px 0 8px' }}>
                <div
                  className="dk-mini-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (activeQuestStatus.current / Math.max(1, activeQuestStatus.target)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              {activeQuestStatus.complete && (
                <button
                  type="button"
                  className="dk-btn sm up"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdateState((prev) => startOrProgressGraceQuest(prev, 'evaluate').state)
                  }
                >
                  Claim Commission Reward (-{activeQuest.rewardMp} MP)
                </button>
              )}
            </div>
          ) : state.debt.offeredQuests.length > 0 ? (
            <div className="dk-act-grid">
              {state.debt.offeredQuests.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  className="dk-act-btn"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdateState((prev) =>
                      startOrProgressGraceQuest(prev, 'accept', q.id).state
                    )
                  }
                >
                  <span>Accept: {q.desc}</span>
                  <small>Reward: -{q.rewardMp} MP debt (+2 Eleonora Aff)</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="dk-help-hint">
              No active commission. Eleonora offers 2 commissions on collection visits.
            </div>
          )}
        </div>
      )}

      {/* Additional Collateral Loan (Day AP) */}
      {!state.debt.ended && (
        <div className="dk-card">
          <div className="dk-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--y)' }}>EMERGENCY COLLATERAL LOAN (3%/WAVE)</strong>
            <span className="ap-chip">{loanApCheck.ok ? '1 AP' : '🔒 DAY'}</span>
          </div>
          <div className="dk-help-hint" style={{ marginBottom: 6 }}>
            Net Assets: {loanInfo.assets} MP · Limit: {loanInfo.limit} MP · Available:{' '}
            {loanInfo.available} MP
          </div>
          <div className="dk-wrap">
            {([50, 100, 200] as const).map((amt) => (
              <button
                key={amt}
                type="button"
                className="dk-btn sm amber"
                disabled={isBusy || !loanApCheck.ok || amt > loanInfo.available}
                onClick={() => onUpdateState((prev) => takeExtraLoan(prev, amt).state)}
              >
                Borrow +{amt} MP
              </button>
            ))}
          </div>
        </div>
      )}

      {isDebtVisit && (
        <button
          type="button"
          className="dk-btn cta"
          disabled={isBusy}
          onClick={handleFinalizeVisit}
        >
          <span>
            FINALIZE COLLECTION VISIT ({summary.verdictPreview.toUpperCase()}) → WAVE{' '}
            {state.wave + 1} BUILD
          </span>
          <span style={{ color: '#000' }}>
            Next Due W{Math.max(state.wave, state.debt.dueWave) + 3}
          </span>
        </button>
      )}
    </div>
  );
}
