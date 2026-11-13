import { useState } from 'react';
import {
  PRISON_CONVERSIONS,
  PRISON_DETAIL_TABS,
  PRISON_JOBS,
  PRISON_PACTS,
  resolvePrisonAsset,
  type PrisonDetailTab,
} from '../data/prisonData';
import { getPrisonCapacity, isDayPhase } from '../engine/dayLoop';
import {
  assignPrisonerJob,
  auctionPrisoner,
  buildPrisonNarrateContext,
  calculateRansom,
  canAssignJob,
  canConvertPrisoner,
  canDispatchMole,
  canExecutePact,
  convertPrisoner,
  dispatchPrisonerMole,
  executePrisoner,
  executePrisonPact,
  getAllBuyerQuotes,
  getAvailableOfficersForPrison,
  getAvailablePairPartners,
  getConversionCap,
  getConversionCount,
  getExecutePreview,
  getFreeTrappedFloors,
  getHarshDeathChance,
  getInterrogateChance,
  getJobAptitudeStars,
  getJobMaxSlots,
  getJobUsedSlots,
  getJobYieldPreview,
  getPrisonerPronouns,
  getPrisonerTalents,
  getPrisonerTitle,
  getSaleRiskOdds,
  isActiveCaptive,
  isActiveMole,
  releasePrisoner,
  sellPrisoner,
  unassignPrisonerJob,
  type PrisonActionResult,
} from '../engine/prison';
import type { GameState, Prisoner } from '../types/game';
import { GradeBadge } from './GradeBadge';
import '../styles/prison.css';

export interface PrisonPanelProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
}

interface LastSceneFeedback {
  pid: number;
  title: string;
  summary: string;
  sceneContext: string;
  imageUrl?: string;
  isKeyMoment: boolean;
}

function getCaptiveStatusLabel(state: GameState, p: Prisoner): string {
  if (p.dying) return 'DYING';
  if (isActiveMole(p)) return `Mole (${p.moleRaidsLeft}R)`;
  if (p.converted === 'guard') return `Guard ${p.assignedFloor ?? '?'}F`;
  if (p.converted === 'servant') return 'Servant';
  if (p.converted === 'pet') return `Pet (${p.owner === 'L' ? 'Lilim' : 'Vesper'})`;
  if (p.converted === 'dancer') return 'Dancer';
  if (p.converted === 'hired') return `Hired (${p.job ?? 'idle'})`;
  if (p.job) return `Job: ${p.job}${p.assignedFloor ? ` ${p.assignedFloor}F` : ''}`;
  if (state.apUsed[`prison_${p.pid}`]) return 'Acted';
  return 'In Cell';
}

export function PrisonPanel({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
}: PrisonPanelProps) {
  const [selectedPid, setSelectedPid] = useState<number | null>(
    () => state.prisoners[0]?.pid ?? null
  );
  const [activeTab, setActiveTab] = useState<PrisonDetailTab>('care');
  const [pairPid, setPairPid] = useState<number | null>(null);
  const [officerPick, setOfficerPick] = useState<'V' | 'L'>('V');
  const [floorPick, setFloorPick] = useState<number | null>(null);
  const [hiredJobPick, setHiredJobPick] = useState<string>('square');
  const [lastScene, setLastScene] = useState<LastSceneFeedback | null>(null);

  const dayActive = isDayPhase(state);
  const apLocked = !dayActive || state.ap <= 0 || Boolean(state.estate.activeCrisis);
  const cap = getPrisonCapacity(state);
  const activeCount = state.prisoners.filter(isActiveCaptive).length;
  const activeCaptive =
    state.prisoners.find((p) => p.pid === selectedPid) ?? state.prisoners[0] ?? null;

  const commitAction = (res: PrisonActionResult, fallbackPid: number) => {
    if (res.state !== state) {
      onUpdateState(() => res.state);
    }
    if (res.ok) {
      setLastScene({
        pid: fallbackPid,
        title: res.title,
        summary: res.summary,
        sceneContext: res.sceneContext,
        imageUrl: res.imageUrl,
        isKeyMoment: res.isKeyMoment,
      });
    }
  };

  const renderApChip = (noAp = false) => {
    if (noAp) return <span className="ap-chip">0 AP</span>;
    if (apLocked) return <span className="ap-chip">🔒 DAY</span>;
    return <span className="ap-chip">1 AP</span>;
  };

  const availablePairs = activeCaptive
    ? getAvailablePairPartners(state, activeCaptive.pid)
    : [];
  const effectivePairPid =
    availablePairs.find((q) => q.pid === pairPid)?.pid ?? availablePairs[0]?.pid;

  const duoOfficers = getAvailableOfficersForPrison(state, 'duo');
  const giftOfficers = getAvailableOfficersForPrison(state, 'gift');
  const effectiveDuoOfficer = duoOfficers.includes(officerPick)
    ? officerPick
    : duoOfficers[0];
  const effectiveGiftOfficer = giftOfficers.includes(officerPick)
    ? officerPick
    : giftOfficers[0];

  const freeFloors = activeCaptive ? getFreeTrappedFloors(state, activeCaptive.pid) : [];
  const effectiveFloor =
    floorPick && freeFloors.includes(floorPick) ? floorPick : freeFloors[0];

  return (
    <div>
      <div className={`dk-lock-banner ${dayActive ? 'day-ready' : ''}`}>
        <span>
          {dayActive
            ? state.estate.activeCrisis
              ? '⚠ Active crisis — resolve before spending Prison AP.'
              : `⚡ DAY PHASE — ${state.ap}/${state.apMax} AP available for conditioning, jobs & conversions.`
            : '🔒 DAY — Inspect captives freely; AP actions & Fate unlock during Day phase.'}
        </span>
        <span className="dk-badge c">
          Cells: {activeCount}/{cap} (Total: {state.prisoners.length})
        </span>
      </div>

      {state.prisoners.length === 0 ? (
        <div className="dk-card" style={{ borderStyle: 'dashed', color: 'var(--o)' }}>
          No captives in holding yet. Capture adventurers during Night Raids to populate
          the Prison block.
        </div>
      ) : (
        <div className="dk-prison-split">
          {/* LEFT MASTER ROSTER */}
          <div className="dk-prison-roster">
            <div className="dk-prison-roster-head">
              <span>ROSTER</span>
              <span>{state.prisoners.length}</span>
            </div>
            {state.prisoners.map((p) => {
              const isSel = activeCaptive?.pid === p.pid;
              const stamPct = Math.round(
                (p.stamina / Math.max(1, p.staminaMax)) * 100
              );
              return (
                <button
                  key={p.pid}
                  type="button"
                  className={`dk-roster-item ${isSel ? 'sel' : ''} ${p.dying ? 'dying' : ''}`}
                  onClick={() => setSelectedPid(p.pid)}
                >
                  <div className="dk-roster-top">
                    <span className="dk-roster-name">{p.name}</span>
                    <GradeBadge grade={p.grade} />
                  </div>
                  <div className="dk-roster-meta">
                    <span
                      className={`dk-gender-badge ${p.gender === 'male' ? 'm' : 'f'}`}
                    >
                      {p.gender === 'male' ? '♂' : '♀'}
                    </span>
                    <span>{getCaptiveStatusLabel(state, p)}</span>
                  </div>
                  <div className="dk-mini-bar" title={`Stamina ${p.stamina}/${p.staminaMax}`}>
                    <div
                      className={`dk-mini-fill ${p.stamina < 30 ? 'low' : ''}`}
                      style={{ width: `${stamPct}%` }}
                    />
                  </div>
                  <div className="dk-mark-mini-row">
                    {p.marks.obey > 0 && (
                      <span className="dk-mark-pill obey">O{p.marks.obey}</span>
                    )}
                    {p.marks.pleasure > 0 && (
                      <span className="dk-mark-pill pleasure">P{p.marks.pleasure}</span>
                    )}
                    {p.marks.terror > 0 && (
                      <span className="dk-mark-pill terror">T{p.marks.terror}</span>
                    )}
                    {p.marks.shame > 0 && (
                      <span className="dk-mark-pill shame">S{p.marks.shame}</span>
                    )}
                    {p.marks.obey +
                      p.marks.pleasure +
                      p.marks.terror +
                      p.marks.shame ===
                      0 && <span className="dk-mark-pill">No Marks</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT DETAIL CARD */}
          {activeCaptive && (
            <div className="dk-prison-detail">
              <div className="dk-prison-head">
                <div>
                  <div className="dk-wrap">
                    <strong style={{ color: 'var(--w)', fontSize: 13 }}>
                      {activeCaptive.name}
                    </strong>
                    <GradeBadge grade={activeCaptive.grade} />
                    <span
                      className={`dk-gender-badge ${activeCaptive.gender === 'male' ? 'm' : 'f'}`}
                    >
                      {activeCaptive.gender === 'male' ? '♂ Male' : '♀ Female'}
                    </span>
                    {activeCaptive.cond && (
                      <span className="dk-badge r">{activeCaptive.cond}</span>
                    )}
                    {activeCaptive.dying && (
                      <span className="dk-badge r">DYING (Rest 0 AP)</span>
                    )}
                  </div>
                  <div className="dk-help-hint" style={{ marginTop: 2 }}>
                    {activeCaptive.raceLabel} {activeCaptive.classLabel} ·{' '}
                    <i>{getPrisonerTitle(activeCaptive)}</i> ·{' '}
                    {getCaptiveStatusLabel(state, activeCaptive)}
                  </div>
                </div>
                <span className="dk-badge y">
                  Ransom ~{calculateRansom(state, activeCaptive).amount} MP
                </span>
              </div>

              {/* Stat Bars */}
              <div className="dk-prison-stats">
                <div>
                  Stam <b>{activeCaptive.stamina}/{activeCaptive.staminaMax}</b>
                  <div className="dk-mini-bar">
                    <div
                      className={`dk-mini-fill ${activeCaptive.stamina < 30 ? 'low' : ''}`}
                      style={{
                        width: `${Math.round((activeCaptive.stamina / Math.max(1, activeCaptive.staminaMax)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  Resist <b>{activeCaptive.resist}%</b>
                  <div className="dk-mini-bar">
                    <div
                      className="dk-mini-fill amber"
                      style={{ width: `${activeCaptive.resist}%` }}
                    />
                  </div>
                </div>
                <div>
                  Corr <b>{activeCaptive.corr}</b>
                  <div className="dk-mini-bar">
                    <div
                      className="dk-mini-fill lust"
                      style={{ width: `${activeCaptive.corr}%` }}
                    />
                  </div>
                </div>
                <div>
                  Pleas <b>{activeCaptive.pleasure}</b>
                  <div className="dk-mini-bar">
                    <div
                      className="dk-mini-fill lust"
                      style={{ width: `${activeCaptive.pleasure}%` }}
                    />
                  </div>
                </div>
                <div>
                  Terror <b>{activeCaptive.terror}</b>
                  <div className="dk-mini-bar">
                    <div
                      className="dk-mini-fill fear"
                      style={{ width: `${activeCaptive.terror}%` }}
                    />
                  </div>
                </div>
                <div>
                  Shame <b>{activeCaptive.shame}</b>
                  <div className="dk-mini-bar">
                    <div
                      className="dk-mini-fill cyan"
                      style={{ width: `${activeCaptive.shame}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Marks, Talents, Flags */}
              <div className="dk-wrap" style={{ marginBottom: 8 }}>
                <span className="dk-badge n">Obey ★{activeCaptive.marks.obey}</span>
                <span className="dk-badge m">Pleas ★{activeCaptive.marks.pleasure}</span>
                <span className="dk-badge r">Terr ★{activeCaptive.marks.terror}</span>
                <span className="dk-badge y">Shame ★{activeCaptive.marks.shame}</span>
                {getPrisonerTalents(activeCaptive).map((t) => (
                  <span key={t.key} className="dk-badge c" title={t.effect}>
                    ★ {t.label}
                  </span>
                ))}
                {activeCaptive.branded && <span className="dk-badge r">Branded</span>}
                {activeCaptive.crest && <span className="dk-badge m">Crest</span>}
                {activeCaptive.cow && <span className="dk-badge y">Cow</span>}
                {activeCaptive.dressed && <span className="dk-badge c">Dressed</span>}
                {activeCaptive.renamed && <span className="dk-badge">Numbered</span>}
                {activeCaptive.broken && <span className="dk-badge r">Broken</span>}
                {activeCaptive.afflictions.map((afx) => (
                  <span key={afx} className="dk-badge r">
                    {afx}
                  </span>
                ))}
              </div>

              {/* Instant Sprite + Stat Feedback & 1-Click Narrate Scene Now */}
              {(() => {
                const showScene =
                  lastScene &&
                  (lastScene.pid === activeCaptive.pid ||
                    !state.prisoners.some((p) => p.pid === lastScene.pid));
                const pr = getPrisonerPronouns(activeCaptive.gender);
                const fallbackArt = resolvePrisonAsset('dk_pa_talk', activeCaptive.gender);
                const title = showScene
                  ? lastScene.title
                  : `${activeCaptive.name} — Cell Inspection`;
                const summary = showScene
                  ? lastScene.summary
                  : `Inspecting ${activeCaptive.name} (${pr.subject}/${pr.object}) in holding.`;
                const art = showScene ? lastScene.imageUrl : fallbackArt;
                const ctx = showScene
                  ? lastScene.sceneContext
                  : buildPrisonNarrateContext(
                      state,
                      activeCaptive,
                      'Cell Inspection',
                      `visited in the holding cell by the Master and Vesper`
                    );
                return (
                  <div
                    className={`dk-prison-feedback ${showScene && lastScene.isKeyMoment ? 'key' : ''}`}
                  >
                    {art && (
                      <img
                        src={art}
                        alt={title}
                        className="dk-prison-art"
                      />
                    )}
                    <div className="dk-prison-feedback-body">
                      <div style={{ fontSize: 11, color: 'var(--w)', fontWeight: 700 }}>
                        {showScene && lastScene.isKeyMoment ? '★ ' : ''}
                        {title}
                      </div>
                      <div className="dk-help-hint">{summary}</div>
                      {onNarrateScene && (
                        <div>
                          <button
                            type="button"
                            className={`dk-btn sm ${showScene && lastScene.isKeyMoment ? 'amber' : 'pri'}`}
                            disabled={isBusy}
                            onClick={() => onNarrateScene(title, ctx, art)}
                          >
                            ✨ Narrate Scene Now
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 6 Category Sub-Tabs */}
              <div className="dk-prison-tabs">
                {PRISON_DETAIL_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`dk-prison-tab ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-tabs 1..4: Pacts */}
              {(activeTab === 'care' ||
                activeTab === 'train' ||
                activeTab === 'shame' ||
                activeTab === 'dark') && (
                <>
                  {/* Contextual pickers for Officer (pduo/pgift) or Pair (ppair/pduel) */}
                  {(activeTab === 'care' ||
                    activeTab === 'train' ||
                    activeTab === 'shame' ||
                    activeTab === 'dark') &&
                    (availablePairs.length > 0 ||
                      duoOfficers.length > 0 ||
                      giftOfficers.length > 0) && (
                      <div className="dk-context-pickers">
                        {(activeTab === 'care' || activeTab === 'train') && (
                          <label>
                            Officer:{' '}
                            <select
                              className="dk-select"
                              value={officerPick}
                              onChange={(e) =>
                                setOfficerPick(e.target.value as 'V' | 'L')
                              }
                            >
                              <option value="V">Vesper</option>
                              <option value="L">Lilim</option>
                            </select>
                          </label>
                        )}
                        {(activeTab === 'shame' || activeTab === 'dark') &&
                          availablePairs.length > 0 && (
                            <label>
                              Partner:{' '}
                              <select
                                className="dk-select"
                                value={effectivePairPid ?? ''}
                                onChange={(e) => setPairPid(Number(e.target.value))}
                              >
                                {availablePairs.map((q) => (
                                  <option key={q.pid} value={q.pid}>
                                    {q.name} ({q.grade} · Res {q.resist}%)
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                      </div>
                    )}

                  <div className="dk-prison-act-grid">
                    {PRISON_PACTS.filter((p) => p.tab === activeTab).map((pact) => {
                      const guard = canExecutePact(state, activeCaptive, pact.id);
                      const disabled = isBusy || !guard.ok;
                      const harshDie = pact.harsh
                        ? Math.round(
                            getHarshDeathChance(state, activeCaptive, pact.id) * 100
                          )
                        : null;
                      const interroPct =
                        pact.id === 'pint'
                          ? Math.round(
                              getInterrogateChance(state, activeCaptive) * 100
                            )
                          : null;

                      return (
                        <button
                          key={pact.id}
                          type="button"
                          className={`dk-act-btn ${pact.harsh ? 'harsh' : ''}`}
                          disabled={disabled}
                          title={guard.ok ? pact.summary : guard.reason}
                          onClick={() => {
                            const officer =
                              pact.id === 'pduo'
                                ? effectiveDuoOfficer
                                : pact.id === 'pgift'
                                  ? effectiveGiftOfficer
                                  : undefined;
                            const res = executePrisonPact(
                              state,
                              activeCaptive.pid,
                              pact.id,
                              {
                                partnerPid: effectivePairPid,
                                officer,
                              }
                            );
                            commitAction(res, activeCaptive.pid);
                          }}
                        >
                          <div className="dk-row">
                            <span>
                              {pact.harsh ? '⚠ ' : ''}
                              {pact.label}
                            </span>
                            {renderApChip(Boolean(pact.noAp))}
                          </div>
                          <small>
                            {interroPct !== null
                              ? `${interroPct}% success · `
                              : ''}
                            {pact.summary}
                          </small>
                          {harshDie !== null && (
                            <span className="dk-hz-tag">
                              Death Risk: {harshDie}%
                              {activeCaptive.legend ? ' (Legend immune)' : ''}
                            </span>
                          )}
                          {!guard.ok && (
                            <small style={{ color: 'var(--r)' }}>
                              {guard.reason}
                            </small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Sub-tab 5: Jobs & Convert */}
              {activeTab === 'jobs' && (
                <div>
                  <div className="dk-context-pickers">
                    <span>
                      Current Job:{' '}
                      <b>{activeCaptive.job ?? 'None'}</b>
                    </span>
                    {activeCaptive.job && (
                      <button
                        type="button"
                        className="dk-btn sm"
                        disabled={isBusy}
                        onClick={() =>
                          commitAction(
                            unassignPrisonerJob(state, activeCaptive.pid),
                            activeCaptive.pid
                          )
                        }
                      >
                        Unassign (0 AP)
                      </button>
                    )}
                    {freeFloors.length > 0 && (
                      <label>
                        Floor:{' '}
                        <select
                          className="dk-select"
                          value={effectiveFloor ?? ''}
                          onChange={(e) => setFloorPick(Number(e.target.value))}
                        >
                          {freeFloors.map((fl) => (
                            <option key={fl} value={fl}>
                              {fl}F
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <div className="dk-sec-title">
                    ASSIGNABLE JOBS ({PRISON_JOBS.length} CFG.JOBS · Aptitude ★)
                  </div>
                  <div className="dk-job-list">
                    {PRISON_JOBS.map((job) => {
                      const stars = getJobAptitudeStars(activeCaptive, job.key);
                      const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
                      const used = getJobUsedSlots(state, job.key);
                      const maxSlots = getJobMaxSlots(state, job.key);
                      const check = canAssignJob(state, activeCaptive, job.key);
                      const preview = getJobYieldPreview(state, activeCaptive, job.key);
                      const isCurrent = activeCaptive.job === job.key;
                      return (
                        <div
                          key={job.key}
                          className={`dk-job-row ${isCurrent ? 'assigned' : ''} ${!check.ok && !isCurrent ? 'locked' : ''}`}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="dk-wrap">
                              <strong style={{ color: 'var(--w)', fontSize: 11 }}>
                                {job.label}
                              </strong>
                              <span className="dk-apt-stars">{starText}</span>
                              <span className="dk-badge">
                                {used}/{maxSlots}
                              </span>
                            </div>
                            <div className="dk-help-hint">
                              {preview.summary}
                              {!check.ok && !isCurrent ? ` · ${check.reason}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="dk-btn sm pri"
                            disabled={isBusy || !check.ok}
                            onClick={() =>
                              commitAction(
                                assignPrisonerJob(state, activeCaptive.pid, job.key, {
                                  floor: effectiveFloor,
                                }),
                                activeCaptive.pid
                              )
                            }
                          >
                            {isCurrent ? 'Active' : renderApChip(false)}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dk-sec-title">
                    5 CONVERSIONS & DOUBLE AGENT (MOLE)
                  </div>
                  <div className="dk-context-pickers">
                    <label>
                      Pet Owner:{' '}
                      <select
                        className="dk-select"
                        value={officerPick}
                        onChange={(e) => setOfficerPick(e.target.value as 'V' | 'L')}
                      >
                        <option value="V">Vesper</option>
                        <option value="L">Lilim</option>
                      </select>
                    </label>
                    <label>
                      Hired Job:{' '}
                      <select
                        className="dk-select"
                        value={hiredJobPick}
                        onChange={(e) => setHiredJobPick(e.target.value)}
                      >
                        {PRISON_JOBS.map((j) => (
                          <option key={j.key} value={j.key}>
                            {j.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="dk-prison-act-grid">
                    {PRISON_CONVERSIONS.map((conv) => {
                      const guard = canConvertPrisoner(
                        state,
                        activeCaptive,
                        conv.key,
                        conv.key === 'hired' ? { jobKey: hiredJobPick } : undefined
                      );
                      const count = getConversionCount(state, conv.key);
                      const convCap = getConversionCap(state, conv.key);
                      return (
                        <button
                          key={conv.key}
                          type="button"
                          className="dk-act-btn"
                          disabled={isBusy || !guard.ok}
                          onClick={() =>
                            commitAction(
                              convertPrisoner(state, activeCaptive.pid, conv.key, {
                                owner: officerPick,
                                floor: effectiveFloor,
                                jobKey: hiredJobPick,
                              }),
                              activeCaptive.pid
                            )
                          }
                        >
                          <div className="dk-row">
                            <span>
                              {conv.label} ({count}/{convCap})
                            </span>
                            {renderApChip(false)}
                          </div>
                          <small>{conv.reqSummary}</small>
                          <small>{conv.effectSummary}</small>
                          {!guard.ok && (
                            <small style={{ color: 'var(--r)' }}>{guard.reason}</small>
                          )}
                        </button>
                      );
                    })}

                    {(() => {
                      const moleGuard = canDispatchMole(state, activeCaptive);
                      return (
                        <button
                          type="button"
                          className="dk-act-btn"
                          disabled={isBusy || !moleGuard.ok}
                          onClick={() =>
                            commitAction(
                              dispatchPrisonerMole(state, activeCaptive.pid),
                              activeCaptive.pid
                            )
                          }
                        >
                          <div className="dk-row">
                            <span>🕵 Double Agent (Mole)</span>
                            {renderApChip(false)}
                          </div>
                          <small>Obey 3 · 2 raids: +2 Intel, -1 Scout (20% loss)</small>
                          {!moleGuard.ok && (
                            <small style={{ color: 'var(--r)' }}>
                              {moleGuard.reason}
                            </small>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Sub-tab 6: Fate */}
              {activeTab === 'fate' && (
                <div>
                  {(() => {
                    const ransom = calculateRansom(state, activeCaptive, {
                      forSale: true,
                    });
                    const quotes = getAllBuyerQuotes(state, activeCaptive);
                    const risks = getSaleRiskOdds(state, activeCaptive);
                    const exec = getExecutePreview(state, activeCaptive);
                    const hasMarket = (state.estate.facilities.market ?? 0) >= 1;
                    const auctionPrice = Math.floor(ransom.amount * 1.1);
                    const fateLocked = !dayActive || Boolean(state.estate.activeCrisis);

                    return (
                      <>
                        <div className="dk-help-hint" style={{ marginBottom: 6 }}>
                          Valuation: <b style={{ color: 'var(--y)' }}>{ransom.amount} MP</b>{' '}
                          ({ransom.breakdown})
                        </div>
                        <div className="dk-help-hint" style={{ marginBottom: 8 }}>
                          Sale Risks: Cut {Math.round(risks.cut * 100)}% (70%) · Stiff{' '}
                          {Math.round(risks.stiff * 100)}% (30%) · Escape{' '}
                          {Math.round(risks.escape * 100)}% · Bonus{' '}
                          {Math.round(risks.bonus * 100)}% (120%)
                        </div>

                        <div className="dk-sec-title">SELL TO BUYER (0 AP)</div>
                        <div className="dk-buyer-grid">
                          {quotes.map((q) => (
                            <button
                              key={q.buyerId}
                              type="button"
                              className={`dk-buyer-card ${q.isBest ? 'best' : ''}`}
                              disabled={isBusy || fateLocked}
                              onClick={() =>
                                commitAction(
                                  sellPrisoner(state, activeCaptive.pid, q.buyerId),
                                  activeCaptive.pid
                                )
                              }
                            >
                              <div className="dk-row">
                                <span style={{ color: 'var(--w)', fontWeight: 700 }}>
                                  {q.isBest ? '★ ' : ''}
                                  {q.label}
                                </span>
                                <span style={{ color: 'var(--n)', fontWeight: 700 }}>
                                  +{q.price} MP
                                </span>
                              </div>
                              <small>
                                {q.isHot ? '🔥 High demand (×1.3)' : 'Standard demand'}
                                {fateLocked ? ' · 🔒 DAY' : ''}
                              </small>
                            </button>
                          ))}
                        </div>

                        <div className="dk-sec-title">OTHER DISPOSAL ROUTES (0 AP)</div>
                        <div className="dk-prison-act-grid">
                          <button
                            type="button"
                            className="dk-act-btn"
                            disabled={isBusy || fateLocked || !hasMarket}
                            onClick={() =>
                              commitAction(
                                auctionPrisoner(state, activeCaptive.pid),
                                activeCaptive.pid
                              )
                            }
                          >
                            <div className="dk-row">
                              <span>⚖ Slave Market Auction</span>
                              <span className="ap-chip">
                                {fateLocked ? '🔒 DAY' : `+${auctionPrice} MP`}
                              </span>
                            </div>
                            <small>
                              {hasMarket
                                ? '1.1× Ransom with 0% sale risk'
                                : 'Requires Slave Market Lv.1'}
                            </small>
                          </button>

                          <button
                            type="button"
                            className="dk-act-btn harsh"
                            disabled={isBusy || fateLocked}
                            onClick={() =>
                              commitAction(
                                executePrisoner(state, activeCaptive.pid),
                                activeCaptive.pid
                              )
                            }
                          >
                            <div className="dk-row">
                              <span>⚔ Public Execution</span>
                              <span className="ap-chip">
                                {fateLocked ? '🔒 DAY' : `+${exec.mp} MP`}
                              </span>
                            </div>
                            <small>
                              +1 Kill · Fame +{exec.famePts} · Fear +{exec.fear}
                              {exec.order > 0 ? ` · Order +${exec.order}` : ''}
                              {!state.settings.gore ? ' (Non-gore tone)' : ''}
                            </small>
                          </button>

                          <button
                            type="button"
                            className="dk-act-btn"
                            disabled={isBusy || fateLocked}
                            onClick={() =>
                              commitAction(
                                releasePrisoner(state, activeCaptive.pid),
                                activeCaptive.pid
                              )
                            }
                          >
                            <div className="dk-row">
                              <span>🕊 Release Alive</span>
                              <span className="ap-chip">
                                {fateLocked ? '🔒 DAY' : '0 AP'}
                              </span>
                            </div>
                            <small>Momentum -1 · Fame -1 pt · Fear -3</small>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
