import { useState } from 'react';
import { resolveSceneAsset } from '../data/assetManifest';
import {
  EXPLORE_LOCATIONS,
  FACILITIES,
  SETTLEMENT_CRISIS_MAP,
  TOWN_ACTIONS,
  TOWN_POLICY_MODS,
  type FacilityCategory,
} from '../data/estateData';
import {
  LANDMARK_DEFS,
  LANDMARK_ORDER,
  REALM_COUNTERMEASURES,
  REALM_SITUATIONS,
  RELIC_DEFS,
  RELIC_ORDER,
  WAR_CFG,
  WAR_RIVALS,
  WAR_RIVAL_ORDER,
  WONDER_DEFS,
  WONDER_ORDER,
} from '../data/realmData';
import { calcRestMp, isDayPhase, isDebtDue } from '../engine/dayLoop';
import {
  applyManagementSettle,
  buildLandmark,
  buildOrUpgradeFacility,
  buildWonder,
  calcPopCap,
  calcSiegeDefense,
  calcTownTax,
  calcWarPower,
  computeManagementSettle,
  exploreTown,
  getActiveExploreEvent,
  getEstateRaidModifiers,
  getFacilityUpgradeState,
  getNextTownLevelInfo,
  getTownTitle,
  isExploreLocationUnlocked,
  isWarOpen,
  performTownAction,
  performWarAction,
  resolveExploreEvent,
  resolvePrisonJailbreak,
  resolveRoyalSiegeDay,
  resolveSettlementCrisis,
  setTownPolicy,
  upgradeTown,
} from '../engine/estate';
import {
  applyRealmCountermeasure,
  canCounterRealmSituation,
  getActiveRealmSituations,
} from '../engine/realm';
import '../styles/estate.css';
import type { GameState, TownPolicy } from '../types/game';
import { ExpeditionLauncherView } from './ExpeditionLauncherView';
import { MonsterPenView } from './MonsterPenView';

export interface EstatePanelProps {
  state: GameState;
  isBusy: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNarrateScene?: (title: string, sceneContext: string, imageUrl?: string) => void;
  onFinishMSettle?: () => void;
  onFinishDebt?: () => void;
  onEndDayAiJournal?: () => void;
  onEndDayQuickSettle?: () => void;
}

type EstateSubTab = 'town' | 'explore' | 'pen' | 'exped' | 'war' | 'msettle';

export function EstatePanel({
  state,
  isBusy,
  onUpdateState,
  onNarrateScene,
  onFinishMSettle,
  onEndDayAiJournal,
  onEndDayQuickSettle,
}: EstatePanelProps) {
  const [subTab, setSubTab] = useState<EstateSubTab>(() =>
    state.mode === 'msettle' || state.estate.activeCrisis ? 'msettle' : 'town'
  );
  const [facFilter, setFacFilter] = useState<'all' | FacilityCategory>('all');
  const [mSettledWave, setMSettledWave] = useState<number | null>(null);

  const dayActive = isDayPhase(state);
  const hasCrisis = Boolean(state.estate.activeCrisis);
  const hasMajorBlockingCrisis =
    hasCrisis || state.crises.jailbreakPending || state.crises.siege.active;
  const apLocked = !dayActive || state.ap <= 0 || hasCrisis;
  const apBadgeText = !dayActive
    ? '🔒 DAY'
    : hasCrisis
      ? '🔒 CRISIS'
      : state.ap <= 0
        ? '🔒 0 AP'
        : '1 AP';

  const activeRealms = getActiveRealmSituations(state, state.wave + 1);
  const warOpen = isWarOpen(state);
  const warPow = calcWarPower(state);
  const siegeDef = calcSiegeDefense(state);

  const restMp = calcRestMp(state);
  const popCap = calcPopCap(state);
  const estTax = calcTownTax(state);
  const townTitle = getTownTitle(state);
  const upgradeInfo = getNextTownLevelInfo(state);
  const raidMods = getEstateRaidModifiers(state);
  const activeExplore = getActiveExploreEvent(state);
  const activeCrisisDef = state.estate.activeCrisis
    ? SETTLEMENT_CRISIS_MAP[state.estate.activeCrisis] ?? null
    : null;
  const ledger = computeManagementSettle(state);
  const townThumb = resolveSceneAsset(upgradeInfo.currentDef.artKey);

  const effectiveTab: EstateSubTab =
    state.mode === 'msettle' && subTab === 'town' ? 'msettle' : subTab;

  const maybeAutoNarrate = (nextState: GameState) => {
    const card = nextState.crises.lastCrisisCard;
    if (
      state.settings.autoNarrateMajorCrises &&
      card &&
      card !== state.crises.lastCrisisCard &&
      onNarrateScene
    ) {
      onNarrateScene(card.title, `${card.subtitle}\n${card.body}`, resolveSceneAsset(card.assetKey));
    }
  };

  const filteredFacilities =
    facFilter === 'all'
      ? FACILITIES
      : FACILITIES.filter((f) => f.category === facFilter);

  const builtCount = Object.values(state.estate.facilities).filter((lv) => lv > 0).length;
  const debtDueNow = isDebtDue(state);

  const handleApplySettle = () => {
    onUpdateState((prev) => {
      const res = applyManagementSettle(prev, { allowRiot: true });
      if (
        prev.settings.autoNarrateMajorCrises &&
        res.state.crises.lastCrisisCard &&
        res.state.crises.lastCrisisCard !== prev.crises.lastCrisisCard &&
        onNarrateScene
      ) {
        const c = res.state.crises.lastCrisisCard;
        onNarrateScene(c.title, `${c.subtitle}\n${c.body}`, resolveSceneAsset(c.assetKey));
      }
      return res.state;
    });
    setMSettledWave(state.wave);
  };

  return (
    <div>
      <div className={`dk-lock-banner ${dayActive ? 'day-ready' : ''}`}>
        <span>
          {dayActive
            ? `⚡ DAY ${state.day || state.wave} ACTIVE — ${state.ap}/${state.apMax} AP · Rest Bonus: +${restMp} MP${state.estate.perks.rest2Day ? ' (Vesper V5 x2!)' : ''}`
            : `🔒 DAY — AP actions unlock in Day (AP) phase (Current: ${state.mode.toUpperCase()}).`}
        </span>
        <span className="dk-badge y">Vault: {state.estate.vaultMp}/{150 * state.town.lv} MP</span>
      </div>

      {/* Inner Estate Sub-navigation */}
      <div className="dk-subnav">
        <button
          type="button"
          className={`dk-subnav-btn ${effectiveTab === 'town' ? 'active' : ''}`}
          onClick={() => setSubTab('town')}
        >
          Town &amp; Facilities ({builtCount}/25)
        </button>
        <button
          type="button"
          className={`dk-subnav-btn ${effectiveTab === 'explore' ? 'active' : ''}`}
          onClick={() => setSubTab('explore')}
        >
          Explore Town (1 AP) {activeExplore ? '· !' : ''}
        </button>
        <button
          type="button"
          className={`dk-subnav-btn ${effectiveTab === 'pen' ? 'active' : ''}`}
          onClick={() => setSubTab('pen')}
        >
          Beast Pen ({state.monsters.length}) {state.eggs.length > 0 ? `· ${state.eggs.length}🥚` : ''}
        </button>
        <button
          type="button"
          className={`dk-subnav-btn ${effectiveTab === 'exped' ? 'active' : ''}`}
          onClick={() => setSubTab('exped')}
        >
          Expedition {state.expedition.active ? '· ACTIVE' : ''}
        </button>
        <button
          type="button"
          className={`dk-subnav-btn ${effectiveTab === 'war' ? 'active' : ''}`}
          onClick={() => setSubTab('war')}
        >
          War &amp; Wonders {!warOpen ? '🔒' : ''}
        </button>
        <button
          type="button"
          className={`dk-subnav-btn ${effectiveTab === 'msettle' ? 'active' : ''}`}
          onClick={() => setSubTab('msettle')}
        >
          M.Settle &amp; Crises {hasMajorBlockingCrisis ? '· ! CRISIS' : ''}
        </button>
      </div>

      {/* Blocking Crisis Banner if present on another sub-tab */}
      {hasMajorBlockingCrisis && effectiveTab !== 'msettle' && (
        <div className="dk-crisis-card">
          <div className="dk-row">
            <strong style={{ color: 'var(--r)' }}>
              ACTIVE CRISIS:{' '}
              {activeCrisisDef?.title ??
                (state.crises.siege.active ? '3-Day Royal Siege Bo3' : 'Prison Jailbreak Plot')}
            </strong>
            <button
              type="button"
              className="dk-btn sm del"
              onClick={() => setSubTab('msettle')}
            >
              Resolve Crisis →
            </button>
          </div>
        </div>
      )}

      {effectiveTab === 'town' && (
        <>
          {/* Town Overview & Lv 1-5 Progression */}
          <div className="dk-card accent">
            <div className="dk-est-hero" style={{ marginBottom: 8 }}>
              {townThumb && (
                <img src={townThumb} alt={upgradeInfo.currentDef.name} className="dk-est-thumb" />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dk-row" style={{ marginBottom: 4 }}>
                  <span>
                    <strong style={{ color: 'var(--y)' }}>
                      LV.{state.town.lv} {upgradeInfo.currentDef.name.toUpperCase()}
                    </strong>{' '}
                    <span className="dk-badge c">Rank {townTitle.grade}</span>
                  </span>
                  <span className="dk-badge n">Tax ~{estTax} MP</span>
                </div>
                <div className="dk-help-hint" style={{ marginBottom: 6 }}>
                  {townTitle.title} · Pop {state.town.pop}/{popCap} · Fac Levels{' '}
                  {upgradeInfo.totalFacilityLevels} · Guards {state.town.guard}
                </div>
                <div className="dk-wrap">
                  <span className="dk-help-hint">Tax Policy:</span>
                  {(['low', 'normal', 'high'] as TownPolicy[]).map((pol) => (
                    <button
                      key={pol}
                      type="button"
                      className={`dk-btn sm ${state.town.policy === pol ? 'active' : ''}`}
                      onClick={() => onUpdateState((prev) => setTownPolicy(prev, pol))}
                    >
                      {TOWN_POLICY_MODS[pol].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="dk-stat-grid" style={{ fontSize: 11, marginBottom: 8 }}>
              <div>
                Food: <b style={{ color: state.town.food < 20 ? 'var(--r)' : 'var(--n)' }}>{state.town.food}/100</b>
                <div className="dk-mini-bar">
                  <div
                    className={`dk-mini-fill ${state.town.food < 20 ? 'low' : ''}`}
                    style={{ width: `${state.town.food}%` }}
                  />
                </div>
              </div>
              <div>
                Order: <b style={{ color: state.town.order < 30 ? 'var(--r)' : 'var(--c)' }}>{state.town.order}/100</b>
                <div className="dk-mini-bar">
                  <div
                    className={`dk-mini-fill ${state.town.order < 30 ? 'low' : ''}`}
                    style={{ width: `${state.town.order}%` }}
                  />
                </div>
              </div>
              <div>
                Approval: <b>{state.town.approval}/100</b>
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

            {upgradeInfo.nextDef && (
              <div className="dk-row" style={{ borderTop: '1px dashed var(--d)', paddingTop: 6 }}>
                <div className="dk-help-hint">
                  Next: <b>Lv.{upgradeInfo.nextDef.lv} {upgradeInfo.nextDef.name}</b> ·{' '}
                  {upgradeInfo.nextDef.upgradeCost} MP · {upgradeInfo.nextDef.reqFacLevels} Fac ·{' '}
                  {upgradeInfo.nextDef.reqPop} Pop
                  {upgradeInfo.blockers.length > 0 && (
                    <span style={{ color: 'var(--r)' }}> ({upgradeInfo.blockers[0]})</span>
                  )}
                </div>
                <button
                  type="button"
                  className="dk-btn sm up"
                  disabled={isBusy || !upgradeInfo.canUpgrade}
                  onClick={() => onUpdateState((prev) => upgradeTown(prev).state)}
                >
                  Upgrade Town ({upgradeInfo.nextDef.upgradeCost} MP)
                </button>
              </div>
            )}
          </div>

          {raidMods.notes.length > 0 && (
            <div className="dk-card teal" style={{ fontSize: 11 }}>
              <strong style={{ color: 'var(--c)' }}>ESTATE RAID MODIFIERS: </strong>
              {raidMods.notes.join(' · ')}
            </div>
          )}

          {/* Town AP Actions */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--c)' }}>DOMAIN ACTIONS</strong>
              <span className="ap-chip">{apBadgeText}</span>
            </div>
            <div className="dk-act-grid">
              {TOWN_ACTIONS.map((act) => {
                const used = Boolean(state.apUsed[`town_${act.key}`]);
                const needFacOk = !act.needFac || (state.estate.facilities[act.needFac] ?? 0) >= 1;
                const cost =
                  act.key === 'punish' && (state.estate.facilities.shrine ?? 0) >= 1
                    ? 0
                    : act.mpCost;
                const affordOk =
                  state.points >= cost && (!act.foodCost || state.town.food >= act.foodCost);
                return (
                  <button
                    key={act.key}
                    type="button"
                    className="dk-act-btn"
                    disabled={isBusy || apLocked || used || !needFacOk || !affordOk}
                    onClick={() => onUpdateState((prev) => performTownAction(prev, act.key).state)}
                  >
                    <div className="dk-row">
                      <span>{act.label}</span>
                      <span className="ap-chip">{used ? 'DONE' : apBadgeText}</span>
                    </div>
                    <small>
                      {cost > 0 ? `${cost} MP · ` : ''}
                      {act.summary}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Realm Situations & Day Countermeasures */}
          {activeRealms.length > 0 && (
            <div className="dk-card" style={{ borderColor: 'var(--o)' }}>
              <div className="dk-row" style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--o)' }}>
                  ⚠ REALM SITUATIONS (Wave {state.wave + 1})
                </strong>
                <span className="dk-badge">{dayActive ? 'DAY COUNTERS UNLOCKED' : '🔒 DAY'}</span>
              </div>
              {activeRealms.map((sit) => {
                const def = REALM_SITUATIONS[sit.key];
                const ctr = REALM_COUNTERMEASURES[sit.key];
                if (!def) return null;
                const check = ctr ? canCounterRealmSituation(state, sit.key) : null;
                return (
                  <div
                    key={sit.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: sit.countered ? 'var(--g)' : 'var(--w)' }}>
                        {def.icon} {def.name} ({sit.wavesLeft}w left){sit.countered && ' · ✅ COUNTERED'}
                      </div>
                      <div className="dk-help-hint">
                        {def.summary} · {def.counterHint}
                      </div>
                    </div>
                    {ctr && !sit.countered && (
                      <button
                        type="button"
                        className="dk-btn sm amber"
                        disabled={isBusy || !check?.ok}
                        title={check?.reason ?? def.counterHint}
                        onClick={() =>
                          onUpdateState((prev) => applyRealmCountermeasure(prev, sit.key).state)
                        }
                      >
                        {ctr.label} (
                        {ctr.costKind === 'ap'
                          ? `${ctr.costAmount} AP`
                          : ctr.costKind === 'intel'
                            ? `${ctr.costAmount} Intel`
                            : ctr.costKind === 'mp'
                              ? `${ctr.costAmount} MP`
                              : '1 Prisoner'}
                        )
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Town Lv 6-7 Royal & Demon Capital Landmarks */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--c)' }}>
                TOWN LANDMARKS (Lv.6–7: HQ · LAB · CMD)
              </strong>
              {upgradeInfo.currentDef.upkeep > 0 && (
                <span className="dk-badge y">
                  Lv.{state.town.lv} Upkeep: {upgradeInfo.currentDef.upkeep} MP/settle
                </span>
              )}
            </div>
            <div className="dk-fac-grid">
              {LANDMARK_ORDER.map((key) => {
                const def = LANDMARK_DEFS[key];
                const built = Boolean(state.estate.landmarks[key]);
                const unlocked = state.town.lv >= def.reqTownLv;
                const art = resolveSceneAsset(def.assetKey);
                return (
                  <div key={key} className={`dk-fac-card ${built ? 'built' : ''}`}>
                    <div className="dk-fac-head">
                      {art && <img src={art} alt={def.name} className="dk-fac-icon" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dk-row">
                          <strong style={{ color: 'var(--w)', fontSize: 12 }}>
                            {def.icon} {def.name}
                          </strong>
                          <span className={`dk-badge ${built ? 'n' : ''}`}>
                            {built ? 'BUILT' : `Lv.${def.reqTownLv}+`}
                          </span>
                        </div>
                        <div className="dk-help-hint" style={{ fontSize: 10 }}>
                          {def.effectDesc}
                        </div>
                      </div>
                    </div>
                    {!built && (
                      <div className="dk-row">
                        <span className="dk-help-hint" style={{ fontSize: 10 }}>
                          {unlocked ? `${def.cost} MP` : `Requires Town Lv.${def.reqTownLv}`}
                        </span>
                        <button
                          type="button"
                          className="dk-btn sm up"
                          disabled={
                            isBusy || !dayActive || !unlocked || state.points < def.cost
                          }
                          onClick={() => onUpdateState((prev) => buildLandmark(prev, key).state)}
                        >
                          Build ({def.cost} MP)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 25 Facilities */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--y)' }}>FACILITIES (25)</strong>
              <div className="dk-wrap">
                {(['all', 'economy', 'security', 'dark'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`dk-btn sm ${facFilter === cat ? 'active' : ''}`}
                    onClick={() => setFacFilter(cat)}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="dk-fac-grid">
              {filteredFacilities.map((fac) => {
                const upg = getFacilityUpgradeState(state, fac.key);
                const art = resolveSceneAsset(fac.artKey);
                return (
                  <div key={fac.key} className={`dk-fac-card ${upg.currentLv > 0 ? 'built' : ''}`}>
                    <div className="dk-fac-head">
                      {art && <img src={art} alt={fac.name} className="dk-fac-icon" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dk-row">
                          <strong style={{ color: 'var(--w)', fontSize: 12 }}>{fac.name}</strong>
                          <span className={`dk-badge ${upg.currentLv > 0 ? 'n' : ''}`}>
                            Lv.{upg.currentLv}/3
                          </span>
                        </div>
                        <div className="dk-help-hint" style={{ fontSize: 10 }}>
                          {fac.summary}
                        </div>
                      </div>
                    </div>
                    <div className="dk-row">
                      <span className="dk-help-hint" style={{ fontSize: 10 }}>
                        {upg.reason ?? `Upgrade cost: ${upg.cost} MP`}
                      </span>
                      <button
                        type="button"
                        className="dk-btn sm up"
                        disabled={isBusy || !upg.canBuild}
                        onClick={() =>
                          onUpdateState((prev) => buildOrUpgradeFacility(prev, fac.key).state)
                        }
                      >
                        {upg.currentLv === 0 ? 'Build' : upg.currentLv >= 3 ? 'MAX' : 'Upgrade'}
                        {upg.cost !== null && upg.currentLv < 3 ? ` (${upg.cost})` : ''}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {effectiveTab === 'explore' && (
        <div className="dk-card teal">
          <div className="dk-row" style={{ marginBottom: 6 }}>
            <strong style={{ color: 'var(--c)' }}>EXPLORE TOWN (9 LOCATIONS · 20 EVENTS)</strong>
            <span className="ap-chip">{apBadgeText}</span>
          </div>
          <div className="dk-help-hint" style={{ marginBottom: 8 }}>
            Select an unlocked location to spend 1 AP and trigger a town encounter.
          </div>

          <div className="dk-loc-strip">
            {EXPLORE_LOCATIONS.map((loc) => {
              const unlocked = isExploreLocationUnlocked(state, loc);
              return (
                <button
                  key={loc.id}
                  type="button"
                  className="dk-loc-pill"
                  disabled={isBusy || apLocked || !unlocked || Boolean(activeExplore)}
                  onClick={() => onUpdateState((prev) => exploreTown(prev, loc.id).state)}
                >
                  <span>{loc.label}</span>
                  <span className="ap-chip">{unlocked ? apBadgeText : '🔒 BUILD'}</span>
                </button>
              );
            })}
          </div>

          {activeExplore ? (
            <div className="dk-card accent">
              {resolveSceneAsset(activeExplore.artKey) && (
                <img
                  src={resolveSceneAsset(activeExplore.artKey)}
                  alt={activeExplore.title}
                  className="dk-scene-banner"
                />
              )}
              <div className="dk-row" style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--y)' }}>{activeExplore.title}</strong>
                {onNarrateScene && (
                  <button
                    type="button"
                    className="dk-btn sm pri"
                    disabled={isBusy}
                    onClick={() =>
                      onNarrateScene(
                        `Explore: ${activeExplore.title}`,
                        `Location: ${activeExplore.loc}\nPrompt: ${activeExplore.prompt}\nDay ${state.day || state.wave}, Town Lv.${state.town.lv}`,
                        resolveSceneAsset(activeExplore.artKey)
                      )
                    }
                  >
                    Narrate Scene Now
                  </button>
                )}
              </div>
              <p style={{ margin: '4px 0 8px', color: 'var(--w)' }}>{activeExplore.prompt}</p>
              <div className="dk-act-grid">
                {activeExplore.choices.map((ch, idx) => {
                  const canAfford = !ch.cost || state.points >= ch.cost;
                  const prisOk =
                    !ch.requiresPrisoners || state.prisoners.length >= ch.requiresPrisoners;
                  return (
                    <button
                      key={ch.label}
                      type="button"
                      className="dk-act-btn"
                      disabled={isBusy || !canAfford || !prisOk}
                      onClick={() =>
                        onUpdateState((prev) => resolveExploreEvent(prev, idx as 0 | 1).state)
                      }
                    >
                      <span>{ch.label}</span>
                      <small>{ch.outcomeText}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="dk-help-hint">
              No active explore event pending. Pick any unlocked location above.
            </div>
          )}
        </div>
      )}

      {effectiveTab === 'pen' && (
        <MonsterPenView
          state={state}
          isBusy={isBusy}
          onUpdateState={onUpdateState}
          onNarrateScene={
            onNarrateScene
              ? (label) => {
                  const recent = state.dayLines
                    .filter((l) => l.kind === 'monster')
                    .slice(-3)
                    .map((l) => l.text)
                    .join('\n');
                  onNarrateScene(
                    label ?? 'Beast Pen & Breeding',
                    recent || `${label ?? 'Beast Pen'} activity (${state.monsters.length} monsters, ${state.eggs.length} eggs).`
                  );
                }
              : undefined
          }
        />
      )}

      {effectiveTab === 'exped' && (
        <ExpeditionLauncherView
          state={state}
          isBusy={isBusy}
          onUpdateState={onUpdateState}
          onNarrateScene={onNarrateScene}
        />
      )}

      {effectiveTab === 'war' && (
        <>
          {/* War & Territory Rivals */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--c)' }}>
                ⚔ WAR &amp; TERRITORIES (Military Power: {warPow})
              </strong>
              <span className="dk-badge">
                {warOpen ? apBadgeText : `🔒 W${WAR_CFG.FROM_W}+ & Lv.${WAR_CFG.FROM_LV}+`}
              </span>
            </div>
            <div className="dk-help-hint" style={{ marginBottom: 8 }}>
              Scout (1 AP), Raid Bo3 (2 AP), and Annex Bo3 (2 AP, requires 2+ Raid wins). Annexed rivals yield passive MP/settle and domain bonuses.
            </div>
            <div className="dk-fac-grid">
              {WAR_RIVAL_ORDER.map((rk) => {
                const def = WAR_RIVALS[rk];
                const r = state.war.rivals[rk];
                const annexArt = r.annexed ? resolveSceneAsset('dk_war_annex') : undefined;
                return (
                  <div key={rk} className={`dk-fac-card ${r.annexed ? 'built' : ''}`}>
                    <div className="dk-fac-head">
                      {annexArt && <img src={annexArt} alt={def.name} className="dk-fac-icon" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dk-row">
                          <strong style={{ color: 'var(--w)', fontSize: 12 }}>
                            {def.icon} {def.name}
                          </strong>
                          <span className={`dk-badge ${r.annexed ? 'n' : ''}`}>
                            {r.annexed ? 'ANNEXED' : `Wins ${r.wins}/2`}
                          </span>
                        </div>
                        <div className="dk-help-hint" style={{ fontSize: 10 }}>
                          Defense: {r.scouted ? r.def : '? (Scout to reveal)'} · Annex bonus: {def.annexBonusDesc}
                        </div>
                      </div>
                    </div>
                    {!r.annexed && (
                      <div className="dk-acts" style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="dk-btn sm"
                          disabled={isBusy || !warOpen || apLocked || r.scouted}
                          onClick={() =>
                            onUpdateState((prev) => performWarAction(prev, 'scout', rk).state)
                          }
                        >
                          {r.scouted ? 'Scouted' : 'Scout (1 AP)'}
                        </button>
                        <button
                          type="button"
                          className="dk-btn sm amber"
                          disabled={isBusy || !warOpen || apLocked || state.ap < 2}
                          onClick={() =>
                            onUpdateState((prev) => performWarAction(prev, 'raid', rk).state)
                          }
                        >
                          Raid (2 AP)
                        </button>
                        <button
                          type="button"
                          className="dk-btn sm up"
                          disabled={isBusy || !warOpen || apLocked || state.ap < 2 || r.wins < 2}
                          onClick={() =>
                            onUpdateState((prev) => performWarAction(prev, 'annex', rk).state)
                          }
                        >
                          Annex (2 AP)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 Great Wonders */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--y)' }}>🏛 GREAT WONDERS (3)</strong>
              <span className="ap-chip">{apBadgeText}</span>
            </div>
            <div className="dk-fac-grid">
              {WONDER_ORDER.map((wk) => {
                const def = WONDER_DEFS[wk];
                const built = state.wonders[wk];
                return (
                  <div key={wk} className={`dk-fac-card ${built ? 'built' : ''}`}>
                    <div className="dk-row">
                      <strong style={{ color: 'var(--w)', fontSize: 12 }}>
                        {def.icon} {def.name}
                      </strong>
                      <span className={`dk-badge ${built ? 'n' : ''}`}>
                        {built ? 'COMPLETE' : `${def.cost} MP`}
                      </span>
                    </div>
                    <div className="dk-help-hint" style={{ fontSize: 10, margin: '4px 0' }}>
                      {def.effectDesc}
                    </div>
                    {!built && (
                      <button
                        type="button"
                        className="dk-btn sm up"
                        disabled={isBusy || apLocked || state.points < def.cost}
                        onClick={() => onUpdateState((prev) => buildWonder(prev, wk).state)}
                      >
                        Construct ({def.cost} MP · 1 AP)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4 Relics Showcase */}
          <div className="dk-card">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--m)' }}>
                ✨ ANCIENT RELICS ({state.relics.owned.length}/4)
              </strong>
              <span className="dk-badge">Relic Shards: {state.relics.shards}/3</span>
            </div>
            <div className="dk-fac-grid">
              {RELIC_ORDER.map((rk) => {
                const def = RELIC_DEFS[rk];
                const owned = state.relics.owned.includes(rk);
                return (
                  <div key={rk} className={`dk-fac-card ${owned ? 'built' : ''}`}>
                    <div className="dk-row">
                      <strong style={{ color: 'var(--w)', fontSize: 12 }}>
                        {def.icon} {def.name}
                      </strong>
                      <span className={`dk-badge ${owned ? 'n' : ''}`}>
                        {owned ? 'OWNED' : 'UNOWNED'}
                      </span>
                    </div>
                    <div className="dk-help-hint" style={{ fontSize: 10 }}>
                      {def.effectDesc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {effectiveTab === 'msettle' && (
        <>
          {/* Blocking 3-Day Royal Siege Bo3 Card */}
          {state.crises.siege.active && (
            <div className="dk-crisis-card">
              {resolveSceneAsset('dk_cr_siege') && (
                <img
                  src={resolveSceneAsset('dk_cr_siege')}
                  alt="Royal Siege"
                  className="dk-scene-banner"
                />
              )}
              <div className="dk-row" style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--r)' }}>
                  🏰 3-DAY ROYAL SIEGE Bo3 — DAY {Math.min(3, state.crises.siege.day + 1)}/3 ({state.crises.siege.wins}W-{state.crises.siege.losses}L)
                </strong>
                {onNarrateScene && (
                  <button
                    type="button"
                    className="dk-btn sm pri"
                    disabled={isBusy}
                    onClick={() =>
                      onNarrateScene(
                        '3-Day Royal Siege Bo3',
                        `Wave ${state.wave} Royal Siege (${state.crises.siege.wins}W-${state.crises.siege.losses}L). Siege Defense: ${siegeDef}. ${state.crises.siege.lastLog ?? ''}`,
                        resolveSceneAsset('dk_cr_siege')
                      )
                    }
                  >
                    Narrate Scene Now
                  </button>
                )}
              </div>
              <p className="dk-help-hint" style={{ color: 'var(--w)' }}>
                Siege Defense: <b>{siegeDef}</b> vs Attack DC {20 + Math.floor(state.wave / 2) + (state.crises.siege.day + 1) * 2}.{' '}
                {state.crises.siege.lastLog}
              </p>
              <button
                type="button"
                className="dk-btn del"
                disabled={isBusy}
                onClick={() =>
                  onUpdateState((prev) => {
                    const res = resolveRoyalSiegeDay(prev);
                    maybeAutoNarrate(res.state);
                    return res.state;
                  })
                }
              >
                Fight Siege Day {state.crises.siege.day + 1}/3
              </button>
            </div>
          )}

          {/* Blocking Prison Jailbreak Card */}
          {state.crises.jailbreakPending && (
            <div className="dk-crisis-card">
              {resolveSceneAsset('dk_cr_jailbreak') && (
                <img
                  src={resolveSceneAsset('dk_cr_jailbreak')}
                  alt="Prison Jailbreak"
                  className="dk-scene-banner"
                />
              )}
              <div className="dk-row" style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--r)' }}>🔓 PRISON JAILBREAK PLOT!</strong>
                {onNarrateScene && (
                  <button
                    type="button"
                    className="dk-btn sm pri"
                    disabled={isBusy}
                    onClick={() =>
                      onNarrateScene(
                        'Prison Jailbreak Plot',
                        `High-resistance prisoners conspire to escape on Wave ${state.wave}! Watch Lv.${state.estate.facilities.watch ?? 0}, Guards ${state.town.guard}, Fear ${state.fear}.`,
                        resolveSceneAsset('dk_cr_jailbreak')
                      )
                    }
                  >
                    Narrate Scene Now
                  </button>
                )}
              </div>
              <p className="dk-help-hint" style={{ color: 'var(--w)' }}>
                High-resistance captives (Resist 60+) attempt a breakout! Failing releases instigators as Legendary Nemeses.
              </p>
              <button
                type="button"
                className="dk-btn del"
                disabled={isBusy}
                onClick={() =>
                  onUpdateState((prev) => {
                    const res = resolvePrisonJailbreak(prev);
                    maybeAutoNarrate(res.state);
                    return res.state;
                  })
                }
              >
                Suppress Prison Jailbreak
              </button>
            </div>
          )}

          {/* Last Resolved Major Crisis / Relic Card */}
          {state.crises.lastCrisisCard &&
            !state.crises.siege.active &&
            !state.crises.jailbreakPending && (
              <div className="dk-card">
                {resolveSceneAsset(state.crises.lastCrisisCard.assetKey) && (
                  <img
                    src={resolveSceneAsset(state.crises.lastCrisisCard.assetKey)}
                    alt={state.crises.lastCrisisCard.title}
                    className="dk-scene-banner"
                  />
                )}
                <div className="dk-row" style={{ marginBottom: 4 }}>
                  <strong style={{ color: 'var(--y)' }}>
                    {state.crises.lastCrisisCard.title}
                  </strong>
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
                <div className="dk-help-hint" style={{ color: 'var(--w)', marginTop: 2 }}>
                  {state.crises.lastCrisisCard.body}
                </div>
              </div>
            )}

          {activeCrisisDef && (
            <div className="dk-crisis-card">
              {resolveSceneAsset(activeCrisisDef.artKey) && (
                <img
                  src={resolveSceneAsset(activeCrisisDef.artKey)}
                  alt={activeCrisisDef.title}
                  className="dk-scene-banner"
                />
              )}
              <div className="dk-row" style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--r)' }}>
                  SETTLEMENT CRISIS: {activeCrisisDef.title.toUpperCase()}
                </strong>
                {onNarrateScene && (
                  <button
                    type="button"
                    className="dk-btn sm pri"
                    disabled={isBusy}
                    onClick={() =>
                      onNarrateScene(
                        `Town Crisis: ${activeCrisisDef.title}`,
                        `${activeCrisisDef.text}\nDomain Lv.${state.town.lv}, Pop ${state.town.pop}, Food ${state.town.food}, Order ${state.town.order}, Approval ${state.town.approval}`,
                        resolveSceneAsset(activeCrisisDef.artKey)
                      )
                    }
                  >
                    Narrate Scene Now
                  </button>
                )}
              </div>
              <p style={{ margin: '4px 0 8px', color: 'var(--w)' }}>{activeCrisisDef.text}</p>
              <div className="dk-act-grid">
                {activeCrisisDef.choices.map((ch, idx) => (
                  <button
                    key={ch.label}
                    type="button"
                    className="dk-act-btn"
                    disabled={isBusy || state.points < ch.mpCost}
                    onClick={() =>
                      onUpdateState(
                        (prev) => resolveSettlementCrisis(prev, idx as 0 | 1).state
                      )
                    }
                  >
                    <span>{ch.label}</span>
                    <small>{ch.raidMod ? ch.raidMod.label : 'Immediate town effect'}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dk-card accent">
            <div className="dk-row" style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--y)' }}>M.SETTLE DETERMINISTIC LEDGER</strong>
              <span className="dk-badge c">WAVE {state.wave}</span>
            </div>
            {ledger.lines.map((row) => (
              <div key={row.label} className="dk-ledger-row">
                <span>{row.label}</span>
                <b>{row.deltaText}</b>
              </div>
            ))}
            <div className="dk-ledger-row" style={{ borderBottom: 0, marginTop: 4 }}>
              <strong>Projected Net Treasury Delta</strong>
              <strong className={ledger.netMpDelta >= 0 ? 'dk-pos' : 'dk-neg'}>
                {ledger.netMpDelta >= 0 ? `+${ledger.netMpDelta}` : ledger.netMpDelta} MP (→{' '}
                {ledger.pointsAfter} MP)
              </strong>
            </div>

            {state.mode === 'msettle' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mSettledWave !== state.wave && !activeCrisisDef && (
                  <button
                    type="button"
                    className="dk-btn pri"
                    disabled={isBusy}
                    onClick={handleApplySettle}
                  >
                    Apply M.Settle Ledger &amp; Roll Crisis Check
                  </button>
                )}
                {onFinishMSettle && (
                  <button
                    type="button"
                    className="dk-btn cta"
                    disabled={isBusy || hasMajorBlockingCrisis}
                    onClick={onFinishMSettle}
                  >
                    <span>
                      {hasMajorBlockingCrisis
                        ? 'RESOLVE CRISIS ABOVE TO CONTINUE'
                        : state.expedition.active
                          ? 'PROCEED TO EXPEDITION PHASE →'
                          : debtDueNow
                            ? 'OPEN ELEONORA DEBT COLLECTION →'
                            : `PROCEED TO WAVE ${state.wave + 1} BUILD →`}
                    </span>
                    <span style={{ color: '#000' }}>{state.points} MP</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Day Log & Close Day Footer */}
      <div className="dk-card">
        <div className="dk-row" style={{ marginBottom: 4 }}>
          <strong style={{ color: 'var(--c)' }}>DAY LOG QUEUE ({state.dayLines.length})</strong>
          <span className="dk-help-hint">Batched up to 12 entries</span>
        </div>
        {state.dayLines.length === 0 ? (
          <div className="dk-help-hint">
            No Day AP actions queued yet. Unused AP converts to +{restMp} Rest MP.
          </div>
        ) : (
          state.dayLines.map((line, i) => (
            <div key={i} className="dk-help-hint" style={{ color: 'var(--w)' }}>
              • {line.star ? '★ ' : ''}
              {line.text}
            </div>
          ))
        )}
      </div>

      {state.mode === 'estate' && (onEndDayAiJournal || onEndDayQuickSettle) && (
        <div className="dk-act-grid">
          {onEndDayAiJournal && (
            <button
              type="button"
              className="dk-btn pri"
              disabled={isBusy || hasCrisis}
              onClick={onEndDayAiJournal}
            >
              End Day + AI Journal (+{restMp} MP)
            </button>
          )}
          {onEndDayQuickSettle && (
            <button
              type="button"
              className="dk-btn amber"
              disabled={isBusy || hasCrisis}
              onClick={onEndDayQuickSettle}
            >
              Quick Settle (No API, +{restMp} MP)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
