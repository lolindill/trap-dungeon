import { useState } from 'react';
import { resolveSceneAsset } from '../data/assetManifest';
import {
  MONSTER_CFG,
  MONSTER_OCC_ACT,
  getMonsterDescription,
  getMonsterDisplayName,
  getMonsterLineage,
} from '../data/monsterData';
import { isDayPhase } from '../engine/dayLoop';
import {
  absorbMonster,
  breedMonster,
  calcBreedPrisonerChance,
  calcMonsterUpkeep,
  disposeMonster,
  evolveMonster,
  feedMonster,
  getBreedsRemaining,
  getEligibleBreedPrisoners,
  getEligibleFeedPrisoners,
  getMonsterPenCap,
  getMonsterSellPrice,
  isMonsterDeployed,
  isMonsterHurt,
  isUpkeepActive,
  type MonsterActionResult,
} from '../engine/monsters';
import '../styles/monsters.css';
import type { GameState, MonsterInstance } from '../types/game';

export interface MonsterPenViewProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (label?: string) => void;
}

type InlineActionMode = 'feed' | 'absorb' | 'breed';

interface PendingActionState {
  monsterId: string;
  mode: InlineActionMode;
}

interface LastPenScene {
  title: string;
  text: string;
  imageUrl?: string;
}

export function MonsterPenView({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
}: MonsterPenViewProps) {
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [lastScene, setLastScene] = useState<LastPenScene | null>(null);

  const penCap = getMonsterPenCap(state);
  const penLv = state.estate.facilities.beastpen ?? 0;
  const spaLv = state.estate.facilities.spa ?? 0;
  const upkeepOn = isUpkeepActive(state);
  const upkeepPreview = calcMonsterUpkeep(state);
  const breedsLeft = getBreedsRemaining(state);
  const isDay = isDayPhase(state);
  const hasAp = isDay && state.ap > 0;
  const overCap = Math.max(0, state.monsters.length - penCap);

  const pregnantPrisoners = state.prisoners.filter((p) => Boolean(p.breeding));
  const monsterLogs = state.dayLines.filter((l) => l.kind === 'monster').slice(-6).reverse();
  const penImg = resolveSceneAsset('dk_fac_beastpen');

  const deployedFloorByMonster = new Map<string, number>();
  for (const fl of state.floors) {
    for (const slot of fl.combatSlots ?? []) {
      if (slot.kind === 'monster' && slot.monsterId) {
        deployedFloorByMonster.set(slot.monsterId, fl.floor);
      }
    }
  }

  const runAction = (fn: (prev: GameState) => MonsterActionResult) => {
    if (isBusy) return;
    const box: { res?: MonsterActionResult } = {};
    onUpdateState((prev) => {
      const next = fn(prev);
      box.res = next;
      return next.state;
    });
    if (box.res) {
      setLastScene({
        title: box.res.title,
        text: box.res.sceneContext,
        imageUrl: box.res.imageUrl,
      });
      if (box.res.ok) {
        setPendingAction(null);
        setSelectedTarget('');
      }
    } else {
      setPendingAction(null);
      setSelectedTarget('');
    }
  };

  const openPanel = (monster: MonsterInstance, mode: InlineActionMode) => {
    if (pendingAction?.monsterId === monster.id && pendingAction.mode === mode) {
      setPendingAction(null);
      setSelectedTarget('');
      return;
    }

    let initialTarget = '';
    if (mode === 'feed') {
      const feedList = getEligibleFeedPrisoners(state);
      if (feedList.length > 0) initialTarget = String(feedList[0].pid);
    } else if (mode === 'absorb') {
      const targets = state.monsters.filter(
        (m) => m.id !== monster.id && !isMonsterDeployed(state, m)
      );
      if (targets.length > 0) initialTarget = targets[0].id;
    } else if (mode === 'breed') {
      const matePrisoners = getEligibleBreedPrisoners(state, monster.lineage);
      if (matePrisoners.length > 0) {
        initialTarget = `p:${matePrisoners[0].pid}`;
      } else {
        const mateMonsters = state.monsters.filter(
          (m) => m.id !== monster.id && m.stars >= 2 && !isMonsterHurt(state, m)
        );
        if (mateMonsters.length > 0) initialTarget = `m:${mateMonsters[0].id}`;
      }
    }

    setPendingAction({ monsterId: monster.id, mode });
    setSelectedTarget(initialTarget);
  };

  const handleConfirmInline = (monster: MonsterInstance) => {
    if (!pendingAction || pendingAction.monsterId !== monster.id || !selectedTarget) return;
    if (pendingAction.mode === 'feed') {
      const pid = Number(selectedTarget);
      runAction((prev) => feedMonster(prev, monster.id, pid));
    } else if (pendingAction.mode === 'absorb') {
      runAction((prev) => absorbMonster(prev, monster.id, selectedTarget));
    } else if (pendingAction.mode === 'breed') {
      if (selectedTarget.startsWith('p:')) {
        const pid = Number(selectedTarget.slice(2));
        runAction((prev) => breedMonster(prev, monster.id, { kind: 'prisoner', pid }));
      } else if (selectedTarget.startsWith('m:')) {
        const mateId = selectedTarget.slice(2);
        runAction((prev) => breedMonster(prev, monster.id, { kind: 'monster', partnerId: mateId }));
      }
    }
  };

  return (
    <div className="dk-pen-wrap">
      {/* Header Summary Banner */}
      <div className="dk-pen-summary">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {penImg && (
            <img
              src={penImg}
              alt="Beast Pen"
              className="dk-est-thumb"
              style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4 }}
            />
          )}
          <div>
            <div style={{ color: 'var(--y)', fontWeight: 700, fontSize: 13 }}>
              🐾 BEAST PEN &amp; EGGS (Pen Lv {penLv})
            </div>
            <div className="dk-pen-stats">
              <span>
                Roster:{' '}
                <strong style={{ color: overCap > 0 ? 'var(--r)' : 'var(--n)' }}>
                  {state.monsters.length}/{penCap}
                </strong>
              </span>
              <span>
                Eggs:{' '}
                <strong style={{ color: 'var(--c)' }}>
                  {state.eggs.length}/{penCap + MONSTER_CFG.BREED_EGG_HEADROOM}
                </strong>
              </span>
              <span>
                Breeds Left: <strong style={{ color: 'var(--m)' }}>{breedsLeft}/{MONSTER_CFG.BREED.MAX_PER_WAVE}</strong>
              </span>
              <span>
                Upkeep ({upkeepOn ? 'ON' : 'OFF'}):{' '}
                <strong style={{ color: upkeepOn ? 'var(--o)' : 'var(--d)' }}>
                  {upkeepPreview.total} MP
                </strong>
                {state.estate.upkeepArrears > 0 && (
                  <span style={{ color: 'var(--r)', marginLeft: 4 }}>
                    (Arrears Lv {state.estate.upkeepArrears})
                  </span>
                )}
              </span>
              {spaLv >= 3 && (
                <span className="dk-badge n" title="Spa Lv3 heals injured/tired monsters at M.Settle">
                  ♨ Spa Lv3 Fast-Heal
                </span>
              )}
            </div>
          </div>
        </div>

        {onNarrateScene && (
          <button
            type="button"
            className="dk-btn sm pri"
            disabled={isBusy}
            onClick={() => onNarrateScene(lastScene?.title ?? 'Beast Pen & Breeding')}
          >
            ✨ Narrate Scene Now
          </button>
        )}
      </div>

      {/* Overcrowding Warning */}
      {overCap > 0 && (
        <div className="dk-warn-banner">
          ⚠ <strong>Beast Pen Overcrowded ({state.monsters.length}/{penCap})!</strong>{' '}
          {overCap} excess monster(s) face <strong>20% fatal / 80% injury</strong> at M.Settle.
          Upgrade Beast Pen, deploy/sell/butcher excess beasts, or absorb ★1 fodder.
        </div>
      )}

      {/* Last Action Chronicle Card */}
      {lastScene && (
        <div className="dk-card" style={{ borderColor: 'var(--c)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong style={{ color: 'var(--c)', fontSize: 12 }}>{lastScene.title}</strong>
            {onNarrateScene && (
              <button
                type="button"
                className="dk-btn sm"
                disabled={isBusy}
                onClick={() => onNarrateScene(lastScene.title)}
              >
                📖 Narrate
              </button>
            )}
          </div>
          <div className="dk-help-hint" style={{ marginTop: 4 }}>{lastScene.text}</div>
        </div>
      )}

      {/* Incubating Eggs & Pregnant Prisoners */}
      {(state.eggs.length > 0 || pregnantPrisoners.length > 0) && (
        <div className="dk-card">
          <div style={{ color: 'var(--c)', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
            🥚 INCUBATING EGGS ({state.eggs.length}) &amp; GESTATION ({pregnantPrisoners.length})
          </div>
          <div className="dk-egg-list">
            {state.eggs.map((egg) => {
              const def = getMonsterLineage(egg.lineage);
              return (
                <div key={egg.id} className="dk-egg-chip">
                  <span>🥚 {def.names[0]}</span>
                  {egg.variantOf && <span className="dk-badge m">Variant</span>}
                  {egg.trait && <span className="dk-badge y">{egg.trait}</span>}
                  {egg.xp > 0 && <span className="dk-badge c">+{egg.xp} XP</span>}
                  <span className="dk-badge n">
                    Hatches W{egg.hatchWave}
                  </span>
                </div>
              );
            })}
            {pregnantPrisoners.map((p) => {
              const b = p.breeding!;
              const def = getMonsterLineage(b.lineage);
              return (
                <div key={`preg-${p.pid}`} className="dk-egg-chip" style={{ borderColor: 'var(--m)' }}>
                  <span>🤰 {p.name} ({p.grade})</span>
                  <span style={{ color: 'var(--m)' }}>{def.names[0]}</span>
                  {b.xp > 0 && <span className="dk-badge c">+{b.xp} XP</span>}
                  <span className="dk-badge y">Due W{b.dueWave}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monster Roster */}
      {state.monsters.length === 0 ? (
        <div className="dk-card">
          <div style={{ color: 'var(--y)', fontWeight: 700, marginBottom: 4 }}>No Monsters in Pen</div>
          <div className="dk-help-hint">
            Build or upgrade the <strong>Beast Pen</strong> facility in Estate, or obtain eggs from raids and expeditions.
          </div>
        </div>
      ) : (
        <div className="dk-pen-grid">
          {state.monsters.map((m) => {
            const def = getMonsterLineage(m.lineage);
            const displayName = getMonsterDisplayName(m);
            const desc = getMonsterDescription(m);
            const hurt = isMonsterHurt(state, m);
            const deployedFloor = deployedFloorByMonster.get(m.id);
            const xpNeed = m.stars < 3 ? (MONSTER_CFG.XP_THRESHOLDS[m.stars - 1] ?? 25) : null;
            const xpPct = xpNeed ? Math.min(100, Math.round((m.xp / xpNeed) * 100)) : 100;
            const evoMinXp = xpNeed ? Math.ceil(xpNeed * MONSTER_CFG.FORCE_EVO.XP_PCT) : 999;
            const evoCost = MONSTER_CFG.FORCE_EVO.MP_PER_STAR * m.stars;
            const canEvo = isDay && m.stars < 3 && m.xp >= evoMinXp && state.points >= evoCost;
            const canBreed =
              hasAp &&
              m.stars >= 2 &&
              !hurt &&
              breedsLeft > 0 &&
              state.eggs.length < penCap + MONSTER_CFG.BREED_EGG_HEADROOM;
            const sellPrice = getMonsterSellPrice(m);
            const isPanelOpen = pendingAction?.monsterId === m.id;

            const feedCandidates =
              isPanelOpen && pendingAction.mode === 'feed' ? getEligibleFeedPrisoners(state) : [];
            const absorbCandidates =
              isPanelOpen && pendingAction.mode === 'absorb'
                ? state.monsters.filter((other) => other.id !== m.id && !isMonsterDeployed(state, other))
                : [];
            const breedPrisoners =
              isPanelOpen && pendingAction.mode === 'breed'
                ? getEligibleBreedPrisoners(state, m.lineage)
                : [];
            const breedMonsters =
              isPanelOpen && pendingAction.mode === 'breed'
                ? state.monsters.filter(
                    (other) => other.id !== m.id && other.stars >= 2 && !isMonsterHurt(state, other)
                  )
                : [];

            return (
              <div
                key={m.id}
                className={`dk-pen-card ${m.variantOf ? 'is-variant' : ''} ${hurt ? 'is-hurt' : ''}`}
              >
                <div className="dk-pen-head">
                  <div>
                    <div className="dk-pen-title">
                      {displayName}{' '}
                      <span style={{ color: 'var(--c)', fontSize: 11 }}>{'★'.repeat(m.stars)}</span>
                    </div>
                    <div className="dk-help-hint" style={{ fontSize: 11 }}>
                      {def ? `${def.roleTag} · ${MONSTER_OCC_ACT[def.roleTag]}` : m.lineage}
                    </div>
                  </div>
                  <div className="dk-pen-meta">
                    {deployedFloor && <span className="dk-badge c">{deployedFloor}F Guard</span>}
                    {hurt && <span className="dk-badge r">Hurt/Tired</span>}
                    {m.variantOf && <span className="dk-badge m">Variant</span>}
                    {def.prefTag && <span className="dk-pref-badge">🏠 {def.prefTag}</span>}
                  </div>
                </div>

                {desc && (
                  <div className="dk-help-hint" style={{ fontSize: 11 }}>
                    {desc}
                  </div>
                )}

                <div className="dk-pen-xpbar">
                  <div className="dk-pen-xpfill" style={{ width: `${xpPct}%` }} />
                  <span className="dk-pen-xplabel">
                    {xpNeed ? `XP ${m.xp}/${xpNeed} (${xpPct}%)` : `MAX ★3 (XP ${m.xp})`} · Kills{' '}
                    {m.kills} · Fed {m.fed}/2
                  </span>
                </div>

                <div className="dk-acts" style={{ flexWrap: 'wrap', gap: 4 }}>
                  <button
                    type="button"
                    className={`dk-btn sm ${pendingAction?.monsterId === m.id && pendingAction.mode === 'feed' ? 'active' : ''}`}
                    disabled={isBusy || !hasAp}
                    onClick={() => openPanel(m, 'feed')}
                    title="Feed a captive (1 AP): +4..10 XP and +1 Fed (2 feeds evolve ★1→★2)"
                  >
                    🍖 Feed (1 AP)
                  </button>

                  <button
                    type="button"
                    className={`dk-btn sm ${pendingAction?.monsterId === m.id && pendingAction.mode === 'absorb' ? 'active' : ''}`}
                    disabled={isBusy || !hasAp || state.monsters.length < 2}
                    onClick={() => openPanel(m, 'absorb')}
                    title="Absorb another ★1/★2 monster (1 AP): transfers 100% XP + 3"
                  >
                    🧬 Absorb (1 AP)
                  </button>

                  {m.stars < 3 && (
                    <button
                      type="button"
                      className="dk-btn sm amber"
                      disabled={isBusy || !canEvo}
                      onClick={() => runAction((prev) => evolveMonster(prev, m.id))}
                      title={`Force Evolve (0 AP): needs ${evoMinXp} XP (80%) & ${evoCost} MP, 15% fatal risk`}
                    >
                      ⚡ Evolve ({evoCost} MP)
                    </button>
                  )}

                  {m.stars >= 2 && (
                    <button
                      type="button"
                      className={`dk-btn sm pri ${pendingAction?.monsterId === m.id && pendingAction.mode === 'breed' ? 'active' : ''}`}
                      disabled={isBusy || !canBreed}
                      onClick={() => openPanel(m, 'breed')}
                      title="Breed (1 AP, ★2+, max 2/wave): Captive (female 2w / male 1w) or Cross-species Monster (15% Variant)"
                    >
                      🥚 Breed (1 AP)
                    </button>
                  )}

                  <button
                    type="button"
                    className="dk-btn sm"
                    disabled={isBusy || (state.mode !== 'estate' && state.mode !== 'build')}
                    onClick={() => runAction((prev) => disposeMonster(prev, m.id, 'sell'))}
                    title={`Sell monster for +${sellPrice} MP`}
                  >
                    💰 Sell (+{sellPrice})
                  </button>

                  <button
                    type="button"
                    className="dk-btn sm del"
                    disabled={isBusy || (state.mode !== 'estate' && state.mode !== 'build')}
                    onClick={() => runAction((prev) => disposeMonster(prev, m.id, 'butcher'))}
                    title="Butcher monster for +1 Trap Parts and +10 Town Food"
                  >
                    🔪 Butcher
                  </button>
                </div>

                {/* Inline Picker Drawer */}
                {isPanelOpen && (
                  <div className="dk-pen-panel">
                    {pendingAction.mode === 'feed' && (
                      <>
                        <div style={{ color: 'var(--y)', fontWeight: 700 }}>
                          Select Captive to Feed (Consumes Captive, 1 AP):
                        </div>
                        {feedCandidates.length === 0 ? (
                          <div className="dk-help-hint">No eligible active non-breeding captives available.</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                              value={selectedTarget}
                              onChange={(e) => setSelectedTarget(e.target.value)}
                            >
                              {feedCandidates.map((p) => (
                                <option key={p.pid} value={String(p.pid)}>
                                  {p.name} ({p.grade} · Stam {p.stamina})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="dk-btn sm pri"
                              disabled={isBusy || !selectedTarget}
                              onClick={() => handleConfirmInline(m)}
                            >
                              Confirm Feed
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {pendingAction.mode === 'absorb' && (
                      <>
                        <div style={{ color: 'var(--y)', fontWeight: 700 }}>
                          Select Undeployed Monster to Absorb (1 AP):
                        </div>
                        {absorbCandidates.length === 0 ? (
                          <div className="dk-help-hint">No undeployed monsters available to absorb.</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                              value={selectedTarget}
                              onChange={(e) => setSelectedTarget(e.target.value)}
                            >
                              {absorbCandidates.map((other) => (
                                <option key={other.id} value={other.id}>
                                  {getMonsterDisplayName(other)} (★{other.stars} · XP {other.xp})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="dk-btn sm pri"
                              disabled={isBusy || !selectedTarget}
                              onClick={() => handleConfirmInline(m)}
                            >
                              Confirm Absorb
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {pendingAction.mode === 'breed' && (
                      <>
                        <div style={{ color: 'var(--m)', fontWeight: 700 }}>
                          Select Mate (1 AP · {breedsLeft} breed(s) left this wave):
                        </div>
                        {breedPrisoners.length === 0 && breedMonsters.length === 0 ? (
                          <div className="dk-help-hint">
                            No eligible captives (stamina &ge; 30, non-breeding{def?.canBreedMale ? '' : ', female'}) or healthy ★2+ monsters.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                              value={selectedTarget}
                              onChange={(e) => setSelectedTarget(e.target.value)}
                            >
                              {breedPrisoners.map((p) => {
                                const pct = Math.round(calcBreedPrisonerChance(m, p) * 100);
                                const tag = p.gender === 'male' ? 'Male → 1w Egg' : 'Female → 2w Birth';
                                return (
                                  <option key={`p:${p.pid}`} value={`p:${p.pid}`}>
                                    [Prisoner] {p.name} ({p.grade} · {tag} · {pct}% · Res {p.resist})
                                  </option>
                                );
                              })}
                              {breedMonsters.map((other) => (
                                <option key={`m:${other.id}`} value={`m:${other.id}`}>
                                  [Monster] {getMonsterDisplayName(other)} (★{other.stars} · 100% · 15% Variant)
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="dk-btn sm pri"
                              disabled={isBusy || !selectedTarget}
                              onClick={() => handleConfirmInline(m)}
                            >
                              Confirm Breed
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Beast Pen Day Log */}
      {monsterLogs.length > 0 && (
        <div className="dk-card">
          <div style={{ color: 'var(--c)', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
            📜 BEAST PEN LOG
          </div>
          {monsterLogs.map((entry, idx) => (
            <div key={idx} className="dk-help-hint" style={{ marginBottom: 2 }}>
              • {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
