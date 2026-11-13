import { useState } from 'react';
import { resolveNpcImage } from '../data/assetManifest';
import { CFG } from '../data/constants';
import {
  calcRestMp,
  getDebtDueInWaves,
  getEstimatedDebtDueMin,
  getOfficerNextThreshold,
  getPrisonCapacity,
  getTotalDebt,
  isDayPhase,
  isDebtDue,
  type NavTabId,
} from '../engine/dayLoop';
import { getFloorDC } from '../engine/dungeon';
import type { GameState, OfficerKey } from '../types/game';
import { GradeBadge } from './GradeBadge';

interface DayPanelProps {
  tab: Exclude<NavTabId, 'dungeon'> | 'dungeon_inspect';
  state: GameState;
  isBusy: boolean;
  onSelectFloor: (floorNum: number) => void;
  onQuickTownAction: (action: 'patrol' | 'petitions' | 'forage' | 'market') => void;
  onQuickPrisonAction: (pid: number, action: 'interrogate' | 'rest') => void;
  onQuickOfficerAction: (officer: OfficerKey, mode: 'time' | 'gift') => void;
  onEndDayAiJournal: () => void;
  onEndDayQuickSettle: () => void;
  onFinishMSettle: () => void;
  onFinishExped: () => void;
  onFinishDebt: () => void;
}

const OFFICER_META: { key: OfficerKey; name: string; role: string }[] = [
  { key: 'vesper', name: 'Vesper', role: 'Chief Butler & Warden' },
  { key: 'lilim', name: 'Lilim', role: 'Trap Architect & Succubus' },
  { key: 'eleonora', name: 'Eleonora', role: 'Goldreich Debt Collector' },
];

export function DayPanel({
  tab,
  state,
  isBusy,
  onSelectFloor,
  onQuickTownAction,
  onQuickPrisonAction,
  onQuickOfficerAction,
  onEndDayAiJournal,
  onEndDayQuickSettle,
  onFinishMSettle,
  onFinishExped,
  onFinishDebt,
}: DayPanelProps) {
  const [selectedPid, setSelectedPid] = useState<number | null>(
    () => state.prisoners[0]?.pid ?? null
  );
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerKey>('vesper');

  const dayActive = isDayPhase(state);
  const apDisabled = !dayActive || state.ap <= 0 || Boolean(state.estate.activeCrisis);
  const apChip = dayActive ? (
    <span className="ap-chip">1 AP</span>
  ) : (
    <span className="ap-chip">🔒 DAY</span>
  );
  const restMp = calcRestMp(state);

  if (tab === 'dungeon_inspect') {
    const selectedFloor = state.floors[state.selectedFloor - 1] ?? state.floors[0];
    return (
      <div>
        <div className="dk-lock-banner">
          <span>
            🔒 Floor inspection mode — editing unlocks in <b>1. BUILD</b> phase.
          </span>
          <span className="dk-badge">Mode: {state.mode.toUpperCase()}</span>
        </div>

        <div className="dk-chips">
          {state.floors.map((fl) => (
            <button
              key={fl.floor}
              type="button"
              className={`dk-chip ${fl.floor === selectedFloor.floor ? 'sel' : ''}`}
              onClick={() => onSelectFloor(fl.floor)}
            >
              <span>{fl.floor}F</span>
              <small>
                {fl.slots.length}/{CFG.SLOTS} · DC{getFloorDC(fl)}
              </small>
            </button>
          ))}
        </div>

        <div className="dk-card accent">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <span>
              <strong style={{ color: 'var(--y)' }}>FLOOR {selectedFloor.floor}</strong>{' '}
              <span className="dk-help-hint">
                ({selectedFloor.slots.length}/{CFG.SLOTS} traps)
              </span>
              {selectedFloor.slots.length >= 2 && (
                <span style={{ marginLeft: 8 }}>
                  Synergy: <GradeBadge grade={selectedFloor.synergy} />
                </span>
              )}
            </span>
            <span className="dk-dc-badge">DC {getFloorDC(selectedFloor)}</span>
          </div>

          {selectedFloor.slots.length === 0 ? (
            <div className="dk-help-hint">No traps installed on this floor.</div>
          ) : (
            selectedFloor.slots.map((slot, idx) => (
              <div key={slot.id} className="dk-ledger-row" style={{ alignItems: 'center' }}>
                <span>
                  <b style={{ color: 'var(--c)' }}>#{idx + 1}</b> {slot.text}
                </span>
                <GradeBadge grade={slot.grade} />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (tab === 'prison') {
    const cap = getPrisonCapacity(state);
    const activeCaptive =
      state.prisoners.find((p) => p.pid === selectedPid) ?? state.prisoners[0] ?? null;

    return (
      <div>
        <div className={`dk-lock-banner ${dayActive ? 'day-ready' : ''}`}>
          <span>
            {dayActive
              ? `⚡ DAY PHASE ACTIVE — ${state.ap}/${state.apMax} AP available for Prison actions.`
              : '🔒 DAY — Inspect holding cells freely; AP conditioning unlocks during Day (AP) phase.'}
          </span>
          <span className="dk-badge c">
            Cells: {state.prisoners.length}/{cap}
          </span>
        </div>

        {state.prisoners.length === 0 ? (
          <div className="dk-card" style={{ borderStyle: 'dashed', color: 'var(--o)' }}>
            No captives in holding yet. Capture adventurers during Night Raids to populate the Prison block.
          </div>
        ) : (
          <>
            <div className="dk-card">
              <div style={{ color: 'var(--m)', fontWeight: 700, marginBottom: 6 }}>
                CAPTIVE HOLDING ROSTER ({state.prisoners.length}/{cap})
              </div>
              <div className="dk-wrap">
                {state.prisoners.map((p) => {
                  const isSel = activeCaptive?.pid === p.pid;
                  return (
                    <button
                      key={p.pid}
                      type="button"
                      className={`dk-btn sm ${isSel ? 'active' : ''}`}
                      onClick={() => setSelectedPid(p.pid)}
                    >
                      <span>#{p.pid} {p.name}</span>
                      <GradeBadge grade={p.grade} />
                    </button>
                  );
                })}
              </div>
            </div>

            {activeCaptive && (
              <div className="dk-card teal">
                <div className="dk-row" style={{ marginBottom: 6 }}>
                  <div>
                    <strong style={{ color: 'var(--w)' }}>{activeCaptive.name}</strong>{' '}
                    <GradeBadge grade={activeCaptive.grade} />{' '}
                    <span className="dk-badge c">
                      {activeCaptive.gender === 'male' ? '♂ Male' : '♀ Female'}
                    </span>
                    <div className="dk-help-hint">
                      {activeCaptive.raceLabel} {activeCaptive.classLabel} ·{' '}
                      {activeCaptive.converted
                        ? `Converted: ${activeCaptive.converted}`
                        : activeCaptive.job
                          ? `Job: ${activeCaptive.job}`
                          : 'Unassigned'}
                    </div>
                  </div>
                </div>

                <div className="dk-stat-grid" style={{ fontSize: 11, marginBottom: 8 }}>
                  <div>
                    Stamina: <b>{activeCaptive.stamina}/{activeCaptive.staminaMax}</b>
                    <div className="dk-mini-bar">
                      <div
                        className={`dk-mini-fill ${activeCaptive.stamina < 35 ? 'low' : ''}`}
                        style={{
                          width: `${Math.round((activeCaptive.stamina / activeCaptive.staminaMax) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    Resist: <b>{activeCaptive.resist}%</b>
                    <div className="dk-mini-bar">
                      <div
                        className="dk-mini-fill amber"
                        style={{ width: `${activeCaptive.resist}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    Pleasure: <b>{activeCaptive.pleasure}</b>
                    <div className="dk-mini-bar">
                      <div
                        className="dk-mini-fill lust"
                        style={{ width: `${activeCaptive.pleasure}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    Corruption: <b>{activeCaptive.corr}</b>
                    <div className="dk-mini-bar">
                      <div
                        className="dk-mini-fill lust"
                        style={{ width: `${activeCaptive.corr}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="dk-wrap" style={{ marginBottom: 8 }}>
                  <span className="dk-badge n">Obey ★{activeCaptive.marks.obey}</span>
                  <span className="dk-badge m">Pleas ★{activeCaptive.marks.pleasure}</span>
                  <span className="dk-badge r">Terr ★{activeCaptive.marks.terror}</span>
                  <span className="dk-badge y">Shame ★{activeCaptive.marks.shame}</span>
                </div>

                <div className="dk-act-grid">
                  <button
                    type="button"
                    className="dk-act-btn"
                    disabled={apDisabled || Boolean(state.apUsed[`prison_${activeCaptive.pid}`])}
                    onClick={() => onQuickPrisonAction(activeCaptive.pid, 'interrogate')}
                  >
                    <div className="dk-row">
                      <span>Interrogate / Condition</span>
                      {apChip}
                    </div>
                    <small>-5 Resist, +5 Corr, -10 Stam</small>
                  </button>

                  <button
                    type="button"
                    className="dk-act-btn"
                    onClick={() => onQuickPrisonAction(activeCaptive.pid, 'rest')}
                  >
                    <div className="dk-row">
                      <span>Rest Recovery (prest)</span>
                      <span className="ap-chip" style={{ color: 'var(--n)' }}>
                        0 AP
                      </span>
                    </div>
                    <small>Restore stamina to {activeCaptive.staminaMax} (Free)</small>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (tab === 'estate') {
    const facCount = Object.values(state.estate.facilities).filter((lv) => lv > 0).length;
    const expedReady = state.expedition.active;
    const debtDueNow = isDebtDue(state);

    return (
      <div>
        {state.mode === 'msettle' && (
          <div className="dk-card alert" style={{ marginBottom: 8 }}>
            <div className="dk-row" style={{ marginBottom: 4 }}>
              <strong style={{ color: 'var(--y)' }}>MANAGEMENT SETTLEMENT (M.SETTLE)</strong>
              <span className="dk-badge c">WAVE {state.wave}</span>
            </div>
            <div className="dk-help-hint" style={{ marginBottom: 8 }}>
              Day {state.day || state.wave} actions settled.{' '}
              {expedReady
                ? 'Active Expedition awaits transit resolution next.'
                : debtDueNow
                  ? `Eleonora Goldreich Debt Visit is due on Wave ${state.wave}!`
                  : `No debt collection this wave — Wave ${state.wave + 1} Build is next.`}
            </div>
            <button type="button" className="dk-btn cta" onClick={onFinishMSettle}>
              <span>
                {expedReady
                  ? 'PROCEED TO EXPEDITION PHASE →'
                  : debtDueNow
                    ? 'OPEN ELEONORA DEBT COLLECTION →'
                    : `PROCEED TO WAVE ${state.wave + 1} BUILD →`}
              </span>
              <span style={{ color: '#000' }}>{state.points} MP</span>
            </button>
          </div>
        )}

        {state.mode === 'exped' && (
          <div className="dk-card teal" style={{ marginBottom: 8 }}>
            <div className="dk-row" style={{ marginBottom: 4 }}>
              <strong style={{ color: 'var(--c)' }}>EXPEDITION TRANSIT</strong>
              <span className="dk-badge c">
                Depth {state.expedition.depth}/{state.expedition.maxDepth || 1}
              </span>
            </div>
            <div className="dk-help-hint" style={{ marginBottom: 8 }}>
              Crew: {state.expedition.crew.length} · Loot: {state.expedition.lootMp} MP,{' '}
              {state.expedition.lootFood} Food
            </div>
            <button type="button" className="dk-btn cta" onClick={onFinishExped}>
              <span>
                {debtDueNow
                  ? 'FINISH EXPEDITION → DEBT COLLECTION →'
                  : `FINISH EXPEDITION → WAVE ${state.wave + 1} BUILD →`}
              </span>
              <span style={{ color: '#000' }}>{state.points} MP</span>
            </button>
          </div>
        )}

        <div className={`dk-lock-banner ${dayActive ? 'day-ready' : ''}`}>
          <span>
            {dayActive
              ? `⚡ DAY ${state.day || state.wave} ACTIVE — ${state.ap}/${state.apMax} AP · Rest Bonus: +${restMp} MP${state.estate.perks.rest2Day ? ' (Vesper V5 ×2!)' : ''}`
              : '🔒 DAY — Town AP actions unlock during Day (AP) phase.'}
          </span>
        </div>

        <div className="dk-card accent">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <span>
              <strong style={{ color: 'var(--y)' }}>DOMAIN LV.{state.town.lv}</strong>{' '}
              <span className="dk-help-hint">
                Pop {state.town.pop} · Facilities {facCount}
              </span>
            </span>
            <span className="dk-badge c">Policy: {state.town.policy.toUpperCase()}</span>
          </div>

          <div className="dk-stat-grid" style={{ fontSize: 11 }}>
            <div>
              Food: <b style={{ color: state.town.food < 20 ? 'var(--r)' : 'var(--n)' }}>{state.town.food}</b>
              <div className="dk-mini-bar">
                <div
                  className={`dk-mini-fill ${state.town.food < 20 ? 'low' : ''}`}
                  style={{ width: `${state.town.food}%` }}
                />
              </div>
            </div>
            <div>
              Order: <b style={{ color: state.town.order < 30 ? 'var(--r)' : 'var(--c)' }}>{state.town.order}</b>
              <div className="dk-mini-bar">
                <div
                  className={`dk-mini-fill ${state.town.order < 30 ? 'low' : ''}`}
                  style={{ width: `${state.town.order}%` }}
                />
              </div>
            </div>
            <div>
              Approval: <b>{state.town.approval}</b>
              <div className="dk-mini-bar">
                <div className="dk-mini-fill amber" style={{ width: `${state.town.approval}%` }} />
              </div>
            </div>
            <div>
              Housing / Renown: <b>{state.town.housing} / {state.town.renown}</b>
              <div className="dk-mini-bar">
                <div className="dk-mini-fill" style={{ width: `${state.town.housing}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="dk-act-grid" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className="dk-act-btn"
            disabled={apDisabled || Boolean(state.apUsed.town_patrol)}
            onClick={() => onQuickTownAction('patrol')}
          >
            <div className="dk-row">
              <span>Guard Patrol</span>
              {apChip}
            </div>
            <small>+6 Order, suppresses riots</small>
          </button>
          <button
            type="button"
            className="dk-act-btn"
            disabled={apDisabled || Boolean(state.apUsed.town_petitions)}
            onClick={() => onQuickTownAction('petitions')}
          >
            <div className="dk-row">
              <span>Hear Petitions</span>
              {apChip}
            </div>
            <small>+5 Approval, town morale</small>
          </button>
          <button
            type="button"
            className="dk-act-btn"
            disabled={apDisabled || Boolean(state.apUsed.town_forage)}
            onClick={() => onQuickTownAction('forage')}
          >
            <div className="dk-row">
              <span>Granary Supply Run</span>
              {apChip}
            </div>
            <small>+8 Food reserves</small>
          </button>
          <button
            type="button"
            className="dk-act-btn"
            disabled={apDisabled || Boolean(state.apUsed.town_market)}
            onClick={() => onQuickTownAction('market')}
          >
            <div className="dk-row">
              <span>Market Trade Run</span>
              {apChip}
            </div>
            <small>+25 MP, +1 Renown</small>
          </button>
        </div>

        <div className="dk-card">
          <div className="dk-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--c)' }}>
              DAY LOG QUEUE ({state.dayLines.length})
            </strong>
            <span className="dk-help-hint">Batched up to 12 entries</span>
          </div>
          {state.dayLines.length === 0 ? (
            <div className="dk-help-hint">
              No Day AP actions queued yet. Spend AP or close the day below to convert unused AP into Rest MP (+10 MP/AP).
            </div>
          ) : (
            state.dayLines.map((line, i) => (
              <div key={i} className="dk-help-hint" style={{ color: 'var(--w)' }}>
                • {line.star ? '★ ' : ''}{line.text}
              </div>
            ))
          )}
        </div>

        {state.mode === 'estate' && (
          <div className="dk-act-grid">
            <button
              type="button"
              className="dk-btn pri"
              disabled={isBusy}
              onClick={onEndDayAiJournal}
            >
              End Day + AI Journal (+{restMp} MP)
            </button>
            <button
              type="button"
              className="dk-btn amber"
              disabled={isBusy}
              onClick={onEndDayQuickSettle}
            >
              Quick Settle (No API Call, +{restMp} MP)
            </button>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'debt') {
    const totalDebt = getTotalDebt(state);
    const dueNow = state.mode === 'debt' || isDebtDue(state);
    const dueIn = getDebtDueInWaves(state);
    const minDue = getEstimatedDebtDueMin(state);
    const elePortrait = resolveNpcImage('eleonora', 'curious');

    return (
      <div>
        <div className={`dk-lock-banner ${state.mode === 'debt' ? 'day-ready' : ''}`}>
          <span>
            {state.mode === 'debt'
              ? '⚡ COLLECTION DAY — Eleonora Goldreich is auditing this 3-wave installment.'
              : `🔒 Collection visits occur every 3 waves (Next due: Wave ${state.debt.dueWave} · in ${dueIn}W).`}
          </span>
        </div>

        <div className={`dk-card ${dueNow ? 'alert' : 'accent'}`}>
          <div className="dk-row" style={{ marginBottom: 8 }}>
            <div className="dk-wrap">
              {elePortrait && (
                <img
                  src={elePortrait}
                  alt="Eleonora"
                  className="dk-officer-portrait"
                  style={{ width: 42, height: 48 }}
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
                  Patience: <b>{state.debt.patience}/100</b> · Late Strikes:{' '}
                  <b style={{ color: state.debt.lates > 0 ? 'var(--r)' : 'var(--n)' }}>
                    {state.debt.lates}/3
                  </b>
                </div>
              </div>
            </div>
          </div>

          <div className="dk-ledger-row">
            <span>Remaining Principal Debt</span>
            <b style={{ color: totalDebt > 0 ? 'var(--r)' : 'var(--n)' }}>
              {state.debt.amount} MP
            </b>
          </div>
          {state.debt.extraLoan > 0 && (
            <div className="dk-ledger-row">
              <span>Extra Loans</span>
              <b style={{ color: 'var(--y)' }}>{state.debt.extraLoan} MP</b>
            </div>
          )}
          <div className="dk-ledger-row" style={{ borderBottom: 0 }}>
            <span>Estimated Min Due (Due Wave {state.debt.dueWave})</span>
            <b style={{ color: 'var(--y)' }}>{minDue} MP</b>
          </div>
        </div>

        {state.mode === 'debt' && (
          <button type="button" className="dk-btn cta" onClick={onFinishDebt}>
            <span>SETTLE INSTALLMENT &amp; PROCEED TO WAVE {state.wave + 1} BUILD →</span>
            <span style={{ color: '#000' }}>Next Due W{Math.max(state.wave, state.debt.dueWave) + 3}</span>
          </button>
        )}
      </div>
    );
  }

  // Officers tab
  const currentMeta = OFFICER_META.find((o) => o.key === selectedOfficer) ?? OFFICER_META[0];
  const offProg = state.officers[selectedOfficer];
  const nextThreshold = getOfficerNextThreshold(selectedOfficer, offProg.stage);
  const usedToday = Boolean(state.apUsed[`officer_${selectedOfficer}`]);

  return (
    <div>
      <div className={`dk-lock-banner ${dayActive ? 'day-ready' : ''}`}>
        <span>
          {dayActive
            ? `⚡ DAY PHASE ACTIVE — ${state.ap}/${state.apMax} AP available for Officer interactions.`
            : '🔒 DAY — Inspect Officer affinity & stages freely; AP hangouts/gifts unlock in Day (AP).'}
        </span>
      </div>

      <div className="dk-officer-row" style={{ marginBottom: 8 }}>
        {OFFICER_META.map((o) => {
          const prog = state.officers[o.key];
          const sprite = resolveNpcImage(o.key, 'standing');
          return (
            <button
              key={o.key}
              type="button"
              className={`dk-officer-card ${selectedOfficer === o.key ? 'sel' : ''}`}
              onClick={() => setSelectedOfficer(o.key)}
            >
              {sprite && (
                <img src={sprite} alt={o.name} className="dk-officer-portrait" />
              )}
              <strong>{o.name}</strong>
              <span className="dk-help-hint">
                S{prog.stage} · Aff {prog.aff}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dk-card teal">
        <div className="dk-row" style={{ marginBottom: 4 }}>
          <div>
            <strong style={{ color: 'var(--y)' }}>{currentMeta.name.toUpperCase()}</strong>{' '}
            <span className="dk-help-hint">· {currentMeta.role}</span>
          </div>
          <span className="dk-badge m">Stage {offProg.stage}</span>
        </div>

        <div style={{ fontSize: 11, marginBottom: 8 }}>
          Affinity: <b>{offProg.aff}</b>
          {nextThreshold !== null ? ` / ${nextThreshold} (Next Stage)` : ' (Max Stage)'}
          <div className="dk-mini-bar" style={{ marginTop: 3 }}>
            <div
              className="dk-mini-fill lust"
              style={{
                width: `${
                  nextThreshold
                    ? Math.min(100, Math.round((offProg.aff / nextThreshold) * 100))
                    : 100
                }%`,
              }}
            />
          </div>
        </div>

        <div className="dk-act-grid">
          <button
            type="button"
            className="dk-act-btn"
            disabled={apDisabled || usedToday}
            onClick={() => onQuickOfficerAction(selectedOfficer, 'time')}
          >
            <div className="dk-row">
              <span>Spend Time</span>
              {apChip}
            </div>
            <small>+3 Affinity · Queued to Day Log</small>
          </button>

          <button
            type="button"
            className="dk-act-btn"
            disabled={apDisabled || usedToday || state.points < 40}
            onClick={() => onQuickOfficerAction(selectedOfficer, 'gift')}
          >
            <div className="dk-row">
              <span>Give Gift (40 MP)</span>
              {apChip}
            </div>
            <small>+4 Affinity · Queued to Day Log</small>
          </button>
        </div>
      </div>
    </div>
  );
}
