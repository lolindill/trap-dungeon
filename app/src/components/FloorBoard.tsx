import { useMemo, useState } from 'react';
import { CFG } from '../data/constants';
import { getMonsterDisplayName, MONSTER_CFG } from '../data/monsterData';
import { codexTrapToBlueprint, type CodexTrapEntry } from '../data/trapCodex';
import {
  assignMonsterToFloor,
  assignPrisonerFighterToFloor,
  buildCodexSuggestFillBlueprint,
  createRoomBlueprintFromFloor,
  getEligibleFloorFighters,
  getEligibleFloorMonsters,
  getFighterFloorDC,
  getFloorCombatBonus,
  getFloorCombatSlots,
  getFloorDC,
  getFloorLinks,
  getInstallCost,
  getNextGrade,
  getRoomInstallCost,
  getTotalTrapCount,
  getUpgradeCost,
  isMonsterPrefMatch,
  previewPendingTrap,
  removeFloorCombatSlot,
  rollCodexSuggestions,
  toggleFloorLabBuff,
  type CodexSuggestMode,
} from '../engine/dungeon';
import { disposeMonster, getMonsterSellPrice, isMonsterHurt } from '../engine/monsters';
import { REALM_COUNTERMEASURES, REALM_SITUATIONS } from '../data/realmData';
import { applyRealmCountermeasure, canCounterRealmSituation, getActiveRealmSituations } from '../engine/realm';
import '../styles/codex.css';
import '../styles/monsters.css';
import type { GameState, TrapBlueprint, TrapSlot } from '../types/game';
import { GradeBadge } from './GradeBadge';

export interface FloorBoardProps {
  state: GameState;
  blueprints: TrapBlueprint[];
  onSelectFloor: (floorNum: number) => void;
  onInstallCustom: (floorNum: number, text: string) => boolean;
  onInstallBlueprint: (floorNum: number, bp: TrapBlueprint) => void;
  onSaveAsBlueprint: (slot: TrapSlot) => void;
  onUpgradeTrap: (floorNum: number, slotIdx: number) => void;
  onRenameTrap: (floorNum: number, slotIdx: number, newText: string) => void;
  onRemoveTrap: (floorNum: number, slotIdx: number) => void;
  onOpenWorkshop: () => void;
  onFinishBuild: () => void;
  onSaveRoomShortcut?: (bp: TrapBlueprint) => void;
  onTogglePendingGrades?: () => void;
  onUpdateState?: (updater: (prev: GameState) => GameState) => void;
}

export function FloorBoard({
  state,
  blueprints,
  onSelectFloor,
  onInstallCustom,
  onInstallBlueprint,
  onSaveAsBlueprint,
  onUpgradeTrap,
  onRenameTrap,
  onRemoveTrap,
  onOpenWorkshop,
  onFinishBuild,
  onSaveRoomShortcut,
  onTogglePendingGrades,
  onUpdateState,
}: FloorBoardProps) {
  const [customText, setCustomText] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [guardMonsterPick, setGuardMonsterPick] = useState('');
  const [guardFighterPick, setGuardFighterPick] = useState('');

  // '?' Tag/Grade Preview toggle (supports controlled prop or local fallback)
  const [localShowPending, setLocalShowPending] = useState<boolean>(
    state.settings?.showPendingGrades ?? false
  );
  const showPendingGrades = onTogglePendingGrades
    ? (state.settings?.showPendingGrades ?? localShowPending)
    : localShowPending;

  // Build-mode Codex Suggest state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestMode, setSuggestMode] = useState<CodexSuggestMode>('mix');
  const [suggestPicks, setSuggestPicks] = useState<CodexTrapEntry[]>([]);
  const [suggestPartnerIds, setSuggestPartnerIds] = useState<string[]>([]);

  const selectedFloor = state.floors[state.selectedFloor - 1] ?? state.floors[0];
  const installCost = getInstallCost(selectedFloor.slots.length);
  const canAffordSlot = installCost !== null && state.points >= installCost;
  const totalTraps = getTotalTrapCount(state.floors);

  const pinnedBlueprints = blueprints.filter((b) => b.pinned);
  const quickShortcuts =
    pinnedBlueprints.length > 0 ? pinnedBlueprints.slice(0, 6) : blueprints.slice(0, 5);

  const fillPreview = useMemo(
    () => buildCodexSuggestFillBlueprint(selectedFloor, state.points, suggestMode),
    [selectedFloor, state.points, suggestMode]
  );

  const handleTogglePending = () => {
    if (onTogglePendingGrades) {
      onTogglePendingGrades();
    } else {
      setLocalShowPending((prev) => !prev);
    }
  };

  const runCodexRoll = (mode: CodexSuggestMode = suggestMode) => {
    const rolled = rollCodexSuggestions(selectedFloor, mode, 3);
    setSuggestPicks(rolled.picks);
    setSuggestPartnerIds(rolled.comboPartnerIds);
    setSuggestOpen(true);
  };

  const handleSuggestButton = () => {
    runCodexRoll(suggestMode);
  };

  const handleFillFloorFromCodex = () => {
    const res = buildCodexSuggestFillBlueprint(selectedFloor, state.points, suggestMode);
    if (!res.blueprint) return;
    onInstallBlueprint(selectedFloor.floor, res.blueprint);
    setSuggestOpen(false);
  };

  const handleSaveRoomShortcut = () => {
    const roomBp = createRoomBlueprintFromFloor(selectedFloor);
    if (!roomBp) return;
    if (onSaveRoomShortcut) {
      onSaveRoomShortcut(roomBp);
      return;
    }
    const packedSlot: TrapSlot = {
      id: '__room_prefill__',
      text: roomBp.name,
      grade: roomBp.grade,
      types: roomBp.types,
      mpInvested: 0,
      blueprintId: JSON.stringify(roomBp),
    };
    onSaveAsBlueprint(packedSlot);
  };

  const activeLinks = useMemo(() => getFloorLinks(state), [state]);
  const floorCombatSlots = getFloorCombatSlots(selectedFloor);
  const floorCombatInfo = getFloorCombatBonus(state, selectedFloor);
  const eligibleGuardMonsters = useMemo(() => getEligibleFloorMonsters(state), [state]);
  const eligibleGuardFighters = useMemo(() => getEligibleFloorFighters(state), [state]);
  const pickedMonsterId = eligibleGuardMonsters.some((m) => m.id === guardMonsterPick)
    ? guardMonsterPick
    : (eligibleGuardMonsters[0]?.id ?? '');
  const pickedFighterPid = eligibleGuardFighters.some((p) => String(p.pid) === guardFighterPick)
    ? guardFighterPick
    : (eligibleGuardFighters[0] ? String(eligibleGuardFighters[0].pid) : '');

  const handleInstallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    const ok = onInstallCustom(selectedFloor.floor, customText);
    if (ok) setCustomText('');
  };

  const activeRealmSituations = getActiveRealmSituations(state, state.wave + 1);

  return (
    <div>
      {/* Realm Situations Banner (Build phase — 1 AP countermeasures locked to Day) */}
      {activeRealmSituations.length > 0 && (
        <div
          className="dk-card"
          style={{
            borderColor: 'var(--o)',
            background: 'rgba(255, 160, 40, 0.08)',
            marginBottom: 8,
          }}
        >
          <div className="dk-card-row" style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--o)' }}>
              ⚠ REALM SITUATIONS (Wave {state.wave + 1})
            </strong>
            <span className="dk-badge">
              Mode: {state.settings.realmConfig.toUpperCase()}
            </span>
          </div>
          {activeRealmSituations.map((sit) => {
            const def = REALM_SITUATIONS[sit.key];
            const ctr = REALM_COUNTERMEASURES[sit.key];
            if (!def) return null;
            const check = ctr ? canCounterRealmSituation(state, sit.key) : null;
            const extra =
              sit.key === 'overload' && sit.floors?.length
                ? ` · Floors ${sit.floors.map((f) => `${f}F`).join(', ')}`
                : sit.key === 'spy' && sit.targetFloor
                  ? ` · Exposed: ${sit.targetFloor}F`
                  : sit.key === 'revenge' && sit.revengePrisonerName
                    ? ` · Target: ${sit.revengePrisonerName}`
                    : '';
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
                    {def.icon} {def.name} ({sit.wavesLeft}w left){extra}
                    {sit.countered && ' · ✅ COUNTERED'}
                  </div>
                  <div className="dk-help-hint">
                    {def.summary} · Counter: {def.counterHint}
                  </div>
                </div>
                {ctr && !sit.countered && (
                  <button
                    type="button"
                    className={`dk-btn sm ${ctr.dayOnly ? '' : 'amber'}`}
                    disabled={ctr.dayOnly || !check?.ok || !onUpdateState}
                    title={
                      ctr.dayOnly
                        ? '🔒 DAY ONLY — Spend 1 AP in Estate/Day phase to counter'
                        : check?.reason ?? def.counterHint
                    }
                    onClick={() =>
                      onUpdateState?.((prev) => applyRealmCountermeasure(prev, sit.key).state)
                    }
                  >
                    {ctr.dayOnly
                      ? `🔒 DAY · ${ctr.label} (1 AP)`
                      : `${ctr.label} (${
                          ctr.costKind === 'intel'
                            ? `${ctr.costAmount} Intel`
                            : ctr.costKind === 'mp'
                              ? `${ctr.costAmount} MP`
                              : '1 Prisoner'
                        })`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 7-Floor Selector Strip */}
      <div className="dk-chips">
        {state.floors.map((fl, idx) => {
          const isSel = fl.floor === selectedFloor.floor;
          const dc = getFloorDC(fl, state);
          const guards = (fl.combatSlots ?? []).length;
          const outLink = activeLinks.find((l) => l.fromFloor === fl.floor);
          return (
            <div key={fl.floor} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                className={`dk-chip ${isSel ? 'sel' : ''}`}
                onClick={() => {
                  setEditingIdx(null);
                  setSuggestOpen(false);
                  onSelectFloor(fl.floor);
                }}
              >
                <span>{fl.floor}F</span>
                <small>
                  {fl.slots.length}/{CFG.SLOTS} · DC{dc}
                  {guards > 0 ? ` · 🛡${guards}` : ''}
                </small>
              </button>
              {idx < state.floors.length - 1 && outLink && (
                <span
                  className="dk-link-pill"
                  title={`${outLink.fromFloor}F → ${outLink.toFloor}F ${outLink.label} (penalty -${outLink.penalty})`}
                >
                  🔗-{outLink.penalty}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Cross-Floor Links Strip */}
      <div className="dk-link-strip">
        <strong style={{ color: 'var(--c)' }}>
          🔗 LINK ({activeLinks.length}/{MONSTER_CFG.LINK.MAX_ACTIVE})
        </strong>
        {activeLinks.length === 0 ? (
          <span className="dk-help-hint">
            No adjacent floor links active (trap combos or captive fighter link adjacent floors, max 3).
          </span>
        ) : (
          activeLinks.map((lk) => (
            <span
              key={`${lk.fromFloor}-${lk.toFloor}`}
              className="dk-link-chip"
              title={`Caught heroes on ${lk.fromFloor}F suffer -${lk.penalty} roll penalty on ${lk.toFloor}F`}
            >
              {lk.fromFloor}F→{lk.toFloor}F -{lk.penalty} ({lk.label})
            </span>
          ))
        )}
      </div>

      {/* Selected Room Header */}
      <div className="dk-floor-head">
        <div>
          <strong style={{ color: 'var(--y)' }}>FLOOR {selectedFloor.floor}</strong>{' '}
          <span className="dk-help-hint">
            ({selectedFloor.slots.length}/{CFG.SLOTS} slots ·{' '}
            {floorCombatSlots.length}/{MONSTER_CFG.FSLOT.MAX_PER_FLOOR} guards)
          </span>
          {selectedFloor.slots.length >= 2 && (
            <span style={{ marginLeft: 8 }}>
              Synergy: <GradeBadge grade={selectedFloor.synergy} />
            </span>
          )}
        </div>

        <div className="dk-floor-tools">
          <button
            type="button"
            className={`dk-btn sm ${showPendingGrades ? 'active' : ''}`}
            onClick={handleTogglePending}
            title="Reveal or hide curated grade & tag previews on unrated (?) traps"
          >
            ? Preview: {showPendingGrades ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            className={`dk-btn sm ${suggestOpen ? 'active' : ''}`}
            disabled={installCost === null}
            onClick={handleSuggestButton}
            title="Roll 3 Original Codex recommendations (prioritizing X.TPC combo partners) or auto-fill empty slots"
          >
            🎲 Suggest
          </button>

          {selectedFloor.slots.length >= 2 && (
            <button
              type="button"
              className="dk-btn sm amber"
              onClick={handleSaveRoomShortcut}
              title="Save this floor's traps and synergy as a reusable Room Blueprint Shortcut"
            >
              Save Floor as Room Shortcut
            </button>
          )}

          <span
            className="dk-dc-badge"
            title={
              floorCombatInfo.bonus > 0
                ? `Includes +${floorCombatInfo.bonus} Floor Guard DC bonus`
                : undefined
            }
          >
            DC {getFloorDC(selectedFloor, state)}
          </span>
        </div>
      </div>

      {/* Codex Suggest Tray */}
      {suggestOpen && (
        <div className="dk-suggest-box">
          <div className="dk-suggest-head">
            <div>
              <b style={{ color: 'var(--c)' }}>🎲 CODEX SUGGESTIONS FOR {selectedFloor.floor}F</b>{' '}
              <span className="dk-help-hint">
                (Combo partners prioritized · zero AI wait)
              </span>
            </div>
            <div className="dk-acts">
              {(['mix', 'ero', 'standard'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`dk-btn sm ${suggestMode === m ? 'active' : ''}`}
                  onClick={() => {
                    setSuggestMode(m);
                    runCodexRoll(m);
                  }}
                >
                  {m === 'mix' ? 'Mix' : m === 'ero' ? 'Ero' : 'Std'}
                </button>
              ))}
              <button
                type="button"
                className="dk-btn sm"
                onClick={() => runCodexRoll(suggestMode)}
              >
                🎲 Reroll
              </button>
              <button
                type="button"
                className="dk-btn sm pri"
                disabled={!fillPreview.blueprint}
                onClick={handleFillFloorFromCodex}
                title="Deploy Codex combo/presets into empty slots on this floor within available MP"
              >
                {fillPreview.blueprint
                  ? `⚡ Fill ${fillPreview.trapCount} Slot${fillPreview.trapCount > 1 ? 's' : ''} (-${fillPreview.totalCost} MP)`
                  : 'Need MP / Slots'}
              </button>
              <button
                type="button"
                className="dk-btn sm"
                onClick={() => setSuggestOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="dk-suggest-grid">
            {suggestPicks.map((entry) => {
              const isPartner = suggestPartnerIds.includes(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`dk-suggest-card ${isPartner ? 'partner' : ''}`}
                >
                  <div>
                    <div className="dk-card-row">
                      <b style={{ color: 'var(--w)', fontSize: 12 }}>
                        {isPartner && <span style={{ color: 'var(--y)' }}>♦ </span>}
                        {entry.name}
                      </b>
                      <GradeBadge grade={entry.grade} />
                    </div>
                    <div className="dk-help-hint" style={{ marginTop: 2 }}>
                      {isPartner && <b style={{ color: 'var(--y)' }}>COMBO PARTNER · </b>}
                      {entry.subcategory} · {entry.types.join(', ')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 3 }}>
                      {entry.detail}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dk-btn sm pri"
                    disabled={!canAffordSlot}
                    onClick={() => {
                      onInstallBlueprint(selectedFloor.floor, codexTrapToBlueprint(entry));
                      setSuggestOpen(false);
                    }}
                  >
                    {installCost !== null
                      ? `Deploy to ${selectedFloor.floor}F (-${installCost} MP)`
                      : 'Floor Full'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Installed Trap Slots */}
      {selectedFloor.slots.length === 0 ? (
        <div className="dk-card" style={{ borderStyle: 'dashed', color: 'var(--o)' }}>
          This floor is empty — invaders will pass straight through unless you install a trap, click 🎲 Suggest, or deploy a Shortcut below.
        </div>
      ) : (
        selectedFloor.slots.map((slot, idx) => {
          const nextGrade = getNextGrade(slot.grade);
          const upgCost = getUpgradeCost(slot.grade);
          const refund = Math.floor(slot.mpInvested * CFG.REFUND_RATE);
          const canUpg = nextGrade !== null && upgCost !== null && state.points >= upgCost;
          const isEditing = editingIdx === idx;
          const pendingPreview =
            slot.grade === '?' && showPendingGrades ? previewPendingTrap(slot) : null;
          const displayTypes =
            slot.grade === '?'
              ? pendingPreview
                ? pendingPreview.types
                : []
              : slot.types;

          return (
            <div key={slot.id} className="dk-card">
              <div className="dk-card-row">
                <div className="dk-trap-text">
                  <b style={{ color: 'var(--c)' }}>#{idx + 1}</b>{' '}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        className="dk-input"
                        value={editValue}
                        maxLength={CFG.NAME_MAXLEN}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                      <button
                        type="button"
                        className="dk-btn sm pri"
                        onClick={() => {
                          if (editValue.trim()) {
                            onRenameTrap(selectedFloor.floor, idx, editValue);
                          }
                          setEditingIdx(null);
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="dk-btn sm"
                        onClick={() => setEditingIdx(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span>{slot.text}</span>
                  )}
                </div>
                <div>
                  <GradeBadge grade={slot.grade} />
                  {pendingPreview && (
                    <span className="dk-preview-badge" title="Curated preview (actual grade finalized in Prep)">
                      Est: <GradeBadge grade={pendingPreview.grade} label={pendingPreview.grade} />
                    </span>
                  )}
                </div>
              </div>

              <div className="dk-trap-meta">
                Invested: {slot.mpInvested} MP · Refund: +{refund} MP
                {displayTypes.length > 0 &&
                  ` · ${pendingPreview ? 'Preview ' : ''}Types: ${displayTypes.join(', ')}`}
                {slot.blueprintId && ' · Blueprint Shortcut'}
              </div>

              <div className="dk-acts">
                {nextGrade && upgCost !== null ? (
                  <button
                    type="button"
                    className="dk-btn sm up"
                    disabled={!canUpg}
                    onClick={() => onUpgradeTrap(selectedFloor.floor, idx)}
                  >
                    Upgrade → {nextGrade} (-{upgCost} MP)
                  </button>
                ) : slot.grade === '?' ? (
                  <span className="dk-help-hint">Graded during Prep</span>
                ) : (
                  <span className="dk-badge y">MAX RANK</span>
                )}

                <button
                  type="button"
                  className="dk-btn sm"
                  onClick={() => {
                    setEditingIdx(idx);
                    setEditValue(slot.text);
                  }}
                >
                  Rename
                </button>

                <button
                  type="button"
                  className="dk-btn sm amber"
                  onClick={() => onSaveAsBlueprint(slot)}
                  title="Save this trap into your reusable Trap Shortcut library"
                >
                  Save Shortcut
                </button>

                <button
                  type="button"
                  className="dk-btn sm del"
                  onClick={() => onRemoveTrap(selectedFloor.floor, idx)}
                >
                  Dismantle (+{refund} MP)
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Inline Floor Guards (0/2) */}
      <div className="dk-guard-box">
        <div className="dk-guard-head">
          <div>
            <strong style={{ color: 'var(--c)', fontSize: 12 }}>
              🛡 FLOOR GUARDS ({floorCombatSlots.length}/{MONSTER_CFG.FSLOT.MAX_PER_FLOOR})
            </strong>{' '}
            <span className="dk-badge c">
              DC +{floorCombatInfo.bonus}/{MONSTER_CFG.FSLOT.DC_CAP}
            </span>
            {floorCombatInfo.hasPrefBonus && (
              <span className="dk-pref-badge" style={{ marginLeft: 4 }}>
                🏠 PREF +1
              </span>
            )}
            {state.estate.landmarks.cmd && floorCombatInfo.guardCount > 0 && (
              <span className="dk-badge y" style={{ marginLeft: 4 }}>
                👑 Cmd +1
              </span>
            )}
          </div>

          {state.estate.landmarks.lab && onUpdateState && (
            <button
              type="button"
              className={`dk-btn sm ${selectedFloor.labBuff ? 'active' : ''}`}
              onClick={() =>
                onUpdateState((prev) => toggleFloorLabBuff(prev, selectedFloor.floor).state)
              }
              title="Toggle Mage Lab +1 DC buff on this floor (max 2 floors)"
            >
              🧪 Lab {selectedFloor.labBuff ? 'ON (+1)' : 'OFF'}
            </button>
          )}
        </div>

        {selectedFloor.slots.length === 0 ? (
          <div className="dk-help-hint">
            Install at least 1 trap on {selectedFloor.floor}F to assign Floor Guards.
          </div>
        ) : (
          <>
            {floorCombatSlots.length === 0 ? (
              <div className="dk-help-hint">
                No guards assigned to {selectedFloor.floor}F yet. Assign Monsters or Captive Fighters below (cap +{MONSTER_CFG.FSLOT.DC_CAP} DC).
              </div>
            ) : (
              floorCombatSlots.map((slot, slotIdx) => {
                if (slot.kind === 'monster') {
                  const mon = state.monsters.find((m) => m.id === slot.monsterId);
                  if (!mon) return null;
                  const pref = isMonsterPrefMatch(selectedFloor, mon.lineage);
                  const hurt = isMonsterHurt(state, mon);
                  const sellPrice = getMonsterSellPrice(mon);
                  return (
                    <div key={`guard-m-${mon.id}`} className="dk-guard-slot">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <strong style={{ color: 'var(--y)', fontSize: 12 }}>
                          🐾 {getMonsterDisplayName(mon)} ({'★'.repeat(mon.stars)})
                        </strong>
                        <span className="dk-badge c">+{mon.stars} DC</span>
                        {pref && <span className="dk-pref-badge">🏠 PREF +1</span>}
                        {hurt && (
                          <span className="dk-badge r" title="Injured/Tired guards grant 0 DC until healed">
                            🩹 Hurt/Tired (0 DC)
                          </span>
                        )}
                      </div>
                      {onUpdateState && (
                        <div className="dk-acts" style={{ gap: 4 }}>
                          <button
                            type="button"
                            className="dk-btn sm"
                            onClick={() =>
                              onUpdateState((prev) =>
                                removeFloorCombatSlot(prev, selectedFloor.floor, slotIdx).state
                              )
                            }
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            className="dk-btn sm"
                            onClick={() =>
                              onUpdateState((prev) => disposeMonster(prev, mon.id, 'sell').state)
                            }
                            title={`Sell monster (+${sellPrice} MP)`}
                          >
                            💰 +{sellPrice}
                          </button>
                          <button
                            type="button"
                            className="dk-btn sm del"
                            onClick={() =>
                              onUpdateState((prev) => disposeMonster(prev, mon.id, 'butcher').state)
                            }
                            title="Butcher (+1 Parts, +10 Food)"
                          >
                            🔪 Butcher
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                if (slot.kind === 'prisoner') {
                  const p = state.prisoners.find((x) => x.pid === slot.pid);
                  if (!p) return null;
                  const fDc = getFighterFloorDC(p);
                  const betrayRisk = p.resist >= MONSTER_CFG.FSLOT.BETRAY_RESIST_FROM;
                  const lowStam = p.stamina < MONSTER_CFG.FSLOT.FIGHTER_MIN_STAMINA;
                  return (
                    <div key={`guard-f-${p.pid}`} className="dk-guard-slot">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <strong style={{ color: 'var(--w)', fontSize: 12 }}>
                          ⚔ {p.name} ({p.grade} · Stam {p.stamina})
                        </strong>
                        <span className="dk-badge c">+{fDc} DC</span>
                        {betrayRisk && (
                          <span
                            className="dk-betray-badge"
                            title={`Resist ${p.resist} >= 60: risk of betraying the dungeon during raids!`}
                          >
                            ⚠ BETRAYAL (Res {p.resist})
                          </span>
                        )}
                        {lowStam && (
                          <span className="dk-badge r">Exhausted (&lt;40 Stam · 0 DC)</span>
                        )}
                      </div>
                      {onUpdateState && (
                        <button
                          type="button"
                          className="dk-btn sm"
                          onClick={() =>
                            onUpdateState((prev) =>
                              removeFloorCombatSlot(prev, selectedFloor.floor, slotIdx).state
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                }
                return null;
              })
            )}

            {onUpdateState && floorCombatSlots.length < MONSTER_CFG.FSLOT.MAX_PER_FLOOR && (
              <div className="dk-guard-picker">
                {eligibleGuardMonsters.length > 0 && (
                  <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={pickedMonsterId}
                      onChange={(e) => setGuardMonsterPick(e.target.value)}
                    >
                      {eligibleGuardMonsters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {getMonsterDisplayName(m)} (★{m.stars}
                          {isMonsterPrefMatch(selectedFloor, m.lineage) ? ' 🏠PREF' : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dk-btn sm pri"
                      disabled={!pickedMonsterId}
                      onClick={() =>
                        onUpdateState((prev) =>
                          assignMonsterToFloor(prev, selectedFloor.floor, pickedMonsterId).state
                        )
                      }
                    >
                      + Monster
                    </button>
                  </div>
                )}

                {eligibleGuardFighters.length > 0 && (
                  <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={pickedFighterPid}
                      onChange={(e) => setGuardFighterPick(e.target.value)}
                    >
                      {eligibleGuardFighters.map((p) => (
                        <option key={p.pid} value={String(p.pid)}>
                          {p.name} ({p.grade} · Stam {p.stamina}
                          {p.resist >= MONSTER_CFG.FSLOT.BETRAY_RESIST_FROM ? ' ⚠BETRAYAL' : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dk-btn sm amber"
                      disabled={!pickedFighterPid}
                      onClick={() =>
                        onUpdateState((prev) =>
                          assignPrisonerFighterToFloor(
                            prev,
                            selectedFloor.floor,
                            Number(pickedFighterPid)
                          ).state
                        )
                      }
                    >
                      + Fighter
                    </button>
                  </div>
                )}

                {eligibleGuardMonsters.length === 0 && eligibleGuardFighters.length === 0 && (
                  <span className="dk-help-hint">
                    No healthy undeployed monsters or stamina &ge; 40 unassigned captives available.
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Trap Shortcut Quick-Deploy Tray */}
      <div className="dk-shortcut-box">
        <div className="dk-shortcut-head">
          <div>
            <b style={{ color: 'var(--y)' }}>⚡ QUICK DEPLOY SHORTCUTS</b>{' '}
            <span className="dk-help-hint">
              {installCost !== null
                ? `(1 click → ${selectedFloor.floor}F for ${installCost} MP · pre-rated skips AI re-grading)`
                : '(Floor Full)'}
            </span>
          </div>
          <button
            type="button"
            className="dk-btn sm amber"
            onClick={onOpenWorkshop}
          >
            All Shortcuts &amp; Codex ({blueprints.length})
          </button>
        </div>

        <div className="dk-shortcut-grid">
          {quickShortcuts.map((bp) => {
            const isRoom = bp.kind === 'room' && (bp.roomSlots?.length ?? 0) > 0;
            const roomCost = isRoom
              ? getRoomInstallCost(selectedFloor.slots.length, bp.roomSlots!.length)
              : null;
            const canDeployBp = isRoom
              ? roomCost !== null && state.points >= roomCost
              : canAffordSlot;
            const badgeGrade = isRoom ? (bp.roomSynergy ?? bp.grade) : bp.grade;

            return (
              <button
                key={bp.id}
                type="button"
                className="dk-shortcut-chip"
                disabled={!canDeployBp}
                title={
                  isRoom
                    ? `Room (${bp.roomSlots!.length} traps · ${roomCost !== null ? `${roomCost} MP` : 'Not enough slots'}): ${bp.detail}`
                    : bp.detail
                }
                onClick={() => onInstallBlueprint(selectedFloor.floor, bp)}
              >
                <GradeBadge grade={badgeGrade} label={isRoom ? `R:${badgeGrade}` : badgeGrade} />
                <span>{bp.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Trap Builder Form */}
      <form onSubmit={handleInstallSubmit} className="dk-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <b style={{ color: 'var(--c)' }}>+ CRAFT CUSTOM TRAP FOR {selectedFloor.floor}F</b>
          <span style={{ color: canAffordSlot ? 'var(--y)' : 'var(--r)', fontSize: 12 }}>
            {installCost !== null
              ? `Cost: ${installCost} MP`
              : `Room Full (Max ${CFG.SLOTS})`}
          </span>
        </div>
        <textarea
          className="dk-textarea"
          value={customText}
          maxLength={CFG.NAME_MAXLEN}
          placeholder="Describe trigger, hazard, restraint, or erotic effect... (max 200 chars; graded '?' -> S..D in Prep)"
          onChange={(e) => setCustomText(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
          <span className="dk-help-hint">
            {customText.length}/{CFG.NAME_MAXLEN} chars · New custom traps get graded by Lilim in Prep
          </span>
          <button
            type="submit"
            className="dk-btn pri"
            disabled={!canAffordSlot || !customText.trim()}
          >
            Build Trap {installCost !== null ? `(-${installCost} MP)` : ''}
          </button>
        </div>
      </form>

      {/* Primary Action CTA: Finish Build */}
      <button
        type="button"
        className="dk-btn cta"
        onClick={onFinishBuild}
      >
        <span>
          FINISH BUILD &amp; SCOUT WAVE {state.wave + 1} →
        </span>
        <span className="dk-help-hint" style={{ color: '#000' }}>
          {totalTraps === 0
            ? 'Warning: 0 traps installed (heroes will breach unless fortified)'
            : `${totalTraps} trap(s) armed · Roll incoming party & summon Lilim`}
        </span>
      </button>
    </div>
  );
}
