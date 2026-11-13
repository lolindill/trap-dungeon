import { useEffect, useMemo, useState } from 'react';
import { CFG, TRAP_TYPES } from '../data/constants';
import {
  CODEX_COMBOS,
  CODEX_SUBCATEGORIES,
  CODEX_TRAPS,
  codexComboToBlueprint,
  codexTrapToBlueprint,
  getCombosForCodexTrap,
  type CodexComboEntry,
  type CodexTrapEntry,
} from '../data/trapCodex';
import { getRoomInstallCost, inferSlotCountFromNextCost } from '../engine/dungeon';
import { uid } from '../engine/rng';
import { downloadJsonFile, migrateBlueprints } from '../engine/saveLoad';
import '../styles/codex.css';
import type {
  RoomBlueprintSlot,
  SlotGrade,
  SynergyGrade,
  TrapBlueprint,
  TrapGrade,
  TrapSlot,
} from '../types/game';
import { GradeBadge } from './GradeBadge';

export interface BlueprintWorkshopModalProps {
  blueprints: TrapBlueprint[];
  selectedFloor: number;
  selectedFloorCost: number | null;
  currentMp: number;
  isBuildMode: boolean;
  prefillSlot?: TrapSlot | null;
  selectedFloorSlotCount?: number;
  onClose: () => void;
  onSaveBlueprint: (bp: TrapBlueprint) => void;
  onDeleteBlueprint: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDeployBlueprint: (bp: TrapBlueprint) => void;
  onEvaluateWithAi: (
    name: string,
    detail: string,
    category: 'ero' | 'standard'
  ) => Promise<{ grade?: TrapGrade; types: string[]; notes?: string; error?: string }>;
  onImportBlueprints: (incoming: TrapBlueprint[]) => void;
}

const MANUAL_GRADES: SlotGrade[] = ['?', 'D', 'C', 'B', 'A', 'S'];
const ROOM_SYNERGY_GRADES: SynergyGrade[] = ['?', 'D', 'C', 'B', 'A', 'S'];
const CODEX_PAGE_SIZE = 24;

type WorkshopTab = 'shortcuts' | 'codex';
type CodexScope = 'all' | 'presets' | 'combos' | 'ero' | 'standard';

export function BlueprintWorkshopModal({
  blueprints,
  selectedFloor,
  selectedFloorCost,
  currentMp,
  isBuildMode,
  prefillSlot,
  selectedFloorSlotCount,
  onClose,
  onSaveBlueprint,
  onDeleteBlueprint,
  onTogglePin,
  onDeployBlueprint,
  onEvaluateWithAi,
  onImportBlueprints,
}: BlueprintWorkshopModalProps) {
  const [activeTab, setActiveTab] = useState<WorkshopTab>('shortcuts');

  // My Shortcuts form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<'trap' | 'room'>('trap');
  const [editingRoomSlots, setEditingRoomSlots] = useState<RoomBlueprintSlot[]>([]);
  const [editingRoomSynergy, setEditingRoomSynergy] = useState<SynergyGrade>('?');
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [category, setCategory] = useState<'ero' | 'standard'>('ero');
  const [grade, setGrade] = useState<SlotGrade>('?');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [pinned, setPinned] = useState(true);

  const [filter, setFilter] = useState<'all' | 'pinned' | 'ero' | 'standard' | 'room'>('all');
  const [search, setSearch] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Original Codex tab state
  const [codexScope, setCodexScope] = useState<CodexScope>('all');
  const [codexSubcat, setCodexSubcat] = useState<string>('all');
  const [codexTag, setCodexTag] = useState<string>('all');
  const [codexSearch, setCodexSearch] = useState('');
  const [deployAsPending, setDeployAsPending] = useState(false);
  const [codexPage, setCodexPage] = useState(1);

  const occupiedSlots =
    selectedFloorSlotCount ?? inferSlotCountFromNextCost(selectedFloorCost);

  useEffect(() => {
    if (!prefillSlot) return;
    setActiveTab('shortcuts');

    if (prefillSlot.id === '__room_prefill__' && prefillSlot.blueprintId) {
      try {
        const parsed = JSON.parse(prefillSlot.blueprintId) as TrapBlueprint;
        if (parsed && parsed.kind === 'room' && Array.isArray(parsed.roomSlots)) {
          setEditingId(null);
          setEditingKind('room');
          setEditingRoomSlots(parsed.roomSlots);
          setEditingRoomSynergy(parsed.roomSynergy ?? '?');
          setName(parsed.name);
          setDetail(parsed.detail);
          setCategory(parsed.category);
          setGrade(parsed.grade);
          setSelectedTypes(parsed.types);
          setNotes(parsed.notes ?? '');
          setPinned(true);
          setStatusMsg(
            `Loaded ${parsed.roomSlots.length}-trap Room Shortcut from floor — customize name & save!`
          );
          return;
        }
      } catch {
        // Fallback to single-slot prefill below
      }
    }

    setEditingId(null);
    setEditingKind('trap');
    setEditingRoomSlots([]);
    setEditingRoomSynergy('?');
    setName(prefillSlot.text.split(' — ')[0].slice(0, 48));
    setDetail(prefillSlot.text);
    setCategory(
      prefillSlot.types.some(
        (t) => t === 'lewd' || t === 'erotic' || t === 'cloth' || t === 'parasite'
      )
        ? 'ero'
        : 'standard'
    );
    setGrade(prefillSlot.grade);
    setSelectedTypes(prefillSlot.types);
    setNotes('Saved from dungeon floor.');
    setPinned(true);
    setStatusMsg('Loaded trap from floor slot — customize & save as reusable shortcut!');
  }, [prefillSlot]);

  const resetForm = () => {
    setEditingId(null);
    setEditingKind('trap');
    setEditingRoomSlots([]);
    setEditingRoomSynergy('?');
    setName('');
    setDetail('');
    setCategory('ero');
    setGrade('?');
    setSelectedTypes([]);
    setNotes('');
    setPinned(true);
  };

  const loadForEdit = (bp: TrapBlueprint) => {
    setActiveTab('shortcuts');
    setEditingId(bp.id);
    setEditingKind(bp.kind === 'room' ? 'room' : 'trap');
    setEditingRoomSlots(bp.roomSlots ? [...bp.roomSlots] : []);
    setEditingRoomSynergy(bp.roomSynergy ?? '?');
    setName(bp.name);
    setDetail(bp.detail);
    setCategory(bp.category);
    setGrade(bp.grade);
    setSelectedTypes(bp.types);
    setNotes(bp.notes ?? '');
    setPinned(Boolean(bp.pinned));
    setStatusMsg(`Editing shortcut "${bp.name}"`);
  };

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t)
        : prev.length < 3
          ? [...prev, t]
          : [...prev.slice(1), t]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!detail.trim() && editingKind !== 'room')) return;
    const now = Date.now();
    const existing = editingId ? blueprints.find((b) => b.id === editingId) : undefined;
    const isRoom = editingKind === 'room' && editingRoomSlots.length >= 2;
    const next: TrapBlueprint = {
      id: existing?.id ?? uid(isRoom ? 'bp_room' : 'bp'),
      kind: isRoom ? 'room' : 'trap',
      name: name.trim().slice(0, 60),
      detail:
        detail.trim().slice(0, CFG.NAME_MAXLEN) ||
        editingRoomSlots.map((s) => s.name).join(' + ').slice(0, CFG.NAME_MAXLEN),
      category,
      grade: isRoom ? (editingRoomSynergy === '-' ? '?' : editingRoomSynergy) : grade,
      types: selectedTypes,
      notes: notes.trim() || undefined,
      pinned,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(isRoom
        ? {
            roomSlots: editingRoomSlots,
            roomSynergy: editingRoomSynergy,
          }
        : {}),
      ...(existing?.codexId ? { codexId: existing.codexId } : {}),
    };
    onSaveBlueprint(next);
    setStatusMsg(
      isRoom
        ? `Saved Room Shortcut "${next.name}" (${editingRoomSlots.length} traps, Synergy ${editingRoomSynergy}).`
        : `Saved Trap Shortcut "${next.name}" (${next.grade === '?' ? 'Unrated' : `Pre-rated ${next.grade}`}).`
    );
    resetForm();
  };

  const handleAiAudit = async () => {
    if (!detail.trim() || aiBusy) return;
    setAiBusy(true);
    setStatusMsg('Summoning Lilim to evaluate trap blueprint...');
    const res = await onEvaluateWithAi(
      name.trim() || 'Unnamed Trap',
      detail.trim(),
      category
    );
    setAiBusy(false);
    if (res.error) {
      setStatusMsg(`AI audit failed: ${res.error}`);
      return;
    }
    if (res.grade) setGrade(res.grade);
    if (res.types.length > 0) setSelectedTypes(res.types.slice(0, 3));
    if (res.notes) setNotes(res.notes);
    setStatusMsg(
      `Lilim rated this blueprint ${res.grade ?? '?'}${res.types.length ? ` [${res.types.join(', ')}]` : ''}! Save it to lock in this rating.`
    );
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          setStatusMsg('Invalid JSON: expected an array of trap blueprints.');
          return;
        }
        const valid = migrateBlueprints(parsed);
        onImportBlueprints(valid);
        setStatusMsg(`Imported ${valid.length} blueprint(s).`);
      } catch {
        setStatusMsg('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filtered = blueprints.filter((bp) => {
    if (filter === 'pinned' && !bp.pinned) return false;
    if (filter === 'ero' && bp.category !== 'ero') return false;
    if (filter === 'standard' && bp.category !== 'standard') return false;
    if (filter === 'room' && bp.kind !== 'room') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        bp.name.toLowerCase().includes(q) ||
        bp.detail.toLowerCase().includes(q) ||
        bp.types.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const canDeploySingle =
    isBuildMode && selectedFloorCost !== null && currentMp >= selectedFloorCost;

  const getRoomDeployMeta = (slotCount: number) => {
    const cost = getRoomInstallCost(occupiedSlots, slotCount);
    const freeSlots = CFG.SLOTS - occupiedSlots;
    const canDeploy = isBuildMode && cost !== null && currentMp >= cost;
    let label: string;
    if (!isBuildMode) {
      label = 'Deploy Room (Build Mode Only)';
    } else if (cost === null) {
      label = `${selectedFloor}F Needs ${slotCount} Free (${freeSlots} free)`;
    } else if (currentMp < cost) {
      label = `Deploy Room (-${cost} MP · Need MP)`;
    } else {
      label = `Deploy Room to ${selectedFloor}F (-${cost} MP)`;
    }
    return { cost, canDeploy, label };
  };

  // --- Original Codex Filtering ---
  const availableSubcategories = useMemo(() => {
    if (codexScope === 'ero') return [...CODEX_SUBCATEGORIES.ero];
    if (codexScope === 'standard') return [...CODEX_SUBCATEGORIES.standard];
    return [...CODEX_SUBCATEGORIES.ero, ...CODEX_SUBCATEGORIES.standard];
  }, [codexScope]);

  const savedCodexIds = useMemo(
    () => new Set(blueprints.map((b) => b.codexId).filter(Boolean) as string[]),
    [blueprints]
  );

  type CodexItem =
    | { kind: 'combo'; combo: CodexComboEntry }
    | { kind: 'preset'; trap: CodexTrapEntry };

  const filteredCodexItems = useMemo<CodexItem[]>(() => {
    const q = codexSearch.trim().toLowerCase();
    const out: CodexItem[] = [];

    if (codexScope !== 'presets' && codexSubcat === 'all') {
      for (const combo of CODEX_COMBOS) {
        if (codexScope === 'ero' && combo.category !== 'ero') continue;
        if (codexScope === 'standard' && combo.category !== 'standard') continue;
        if (codexTag !== 'all' && !combo.types.includes(codexTag)) continue;
        if (q) {
          const hit =
            combo.id.toLowerCase().includes(q) ||
            combo.name.toLowerCase().includes(q) ||
            combo.detail.toLowerCase().includes(q) ||
            combo.types.some((t) => t.toLowerCase().includes(q));
          if (!hit) continue;
        }
        out.push({ kind: 'combo', combo });
      }
    }

    if (codexScope !== 'combos') {
      for (const trap of CODEX_TRAPS) {
        if (codexScope === 'ero' && trap.category !== 'ero') continue;
        if (codexScope === 'standard' && trap.category !== 'standard') continue;
        if (codexSubcat !== 'all' && trap.subcategory !== codexSubcat) continue;
        if (codexTag !== 'all' && !trap.types.includes(codexTag)) continue;
        if (q) {
          const hit =
            trap.id.toLowerCase().includes(q) ||
            trap.name.toLowerCase().includes(q) ||
            trap.detail.toLowerCase().includes(q) ||
            trap.counters.toLowerCase().includes(q) ||
            trap.subcategory.toLowerCase().includes(q) ||
            trap.types.some((t) => t.toLowerCase().includes(q));
          if (!hit) continue;
        }
        out.push({ kind: 'preset', trap });
      }
    }

    return out;
  }, [codexScope, codexSubcat, codexTag, codexSearch]);

  const totalCodexPages = Math.max(1, Math.ceil(filteredCodexItems.length / CODEX_PAGE_SIZE));
  const safeCodexPage = Math.min(codexPage, totalCodexPages);
  const pagedCodexItems = filteredCodexItems.slice(
    (safeCodexPage - 1) * CODEX_PAGE_SIZE,
    safeCodexPage * CODEX_PAGE_SIZE
  );

  const handleSaveCodexPresetCopy = (entry: CodexTrapEntry) => {
    const already = savedCodexIds.has(entry.id);
    const bp = codexTrapToBlueprint(entry, {
      deployAsPending,
      customId: already ? uid(`codex_${entry.id}`) : `codex_${entry.id}`,
      pinned: true,
    });
    onSaveBlueprint(bp);
    setStatusMsg(`Saved "${entry.name}" (${entry.id}) to My Shortcuts!`);
  };

  const handleSaveCodexComboCopy = (combo: CodexComboEntry) => {
    const already = savedCodexIds.has(combo.id);
    const bp = codexComboToBlueprint(combo, {
      deployAsPending,
      customId: already ? uid(`codex_${combo.id}`) : `codex_${combo.id}`,
      pinned: true,
    });
    onSaveBlueprint(bp);
    setStatusMsg(`Saved Room Combo "${combo.name}" (${combo.id}) to My Shortcuts!`);
  };

  return (
    <div className="dk-modal-bg" onClick={onClose}>
      <div className="dk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dk-modal-head">
          <span>TRAP BLUEPRINT SHORTCUT WORKSHOP</span>
          <button type="button" className="dk-btn sm" onClick={onClose}>
            Close [ESC]
          </button>
        </div>

        <div className="dk-modal-body">
          {/* Top-Level Workshop Tabs */}
          <div className="dk-workshop-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'shortcuts'}
              className={`dk-workshop-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              My Shortcuts ({blueprints.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'codex'}
              className={`dk-workshop-tab ${activeTab === 'codex' ? 'active' : ''}`}
              onClick={() => setActiveTab('codex')}
            >
              Original Codex ({CODEX_TRAPS.length} + {CODEX_COMBOS.length})
            </button>
          </div>

          {statusMsg && <div className="dk-flash">{statusMsg}</div>}

          {activeTab === 'shortcuts' ? (
            <>
              {/* Create / Edit Shortcut Form */}
              <form onSubmit={handleSave} className="dk-card" style={{ borderColor: 'var(--c)' }}>
                <div className="dk-card-row" style={{ marginBottom: 8 }}>
                  <b style={{ color: 'var(--y)' }}>
                    {editingKind === 'room'
                      ? editingId
                        ? 'EDIT ROOM SHORTCUT'
                        : '+ SAVE FLOOR AS ROOM SHORTCUT'
                      : editingId
                        ? 'EDIT TRAP SHORTCUT'
                        : '+ CREATE NEW TRAP SHORTCUT'}
                  </b>
                  {(editingId || editingKind === 'room') && (
                    <button type="button" className="dk-btn sm" onClick={resetForm}>
                      New Blank
                    </button>
                  )}
                </div>

                <div className="dk-grid-2" style={{ marginBottom: 8 }}>
                  <div>
                    <div className="dk-help-hint" style={{ marginBottom: 3 }}>
                      {editingKind === 'room' ? 'Room Shortcut Name' : 'Shortcut Name'}
                    </div>
                    <input
                      className="dk-input"
                      value={name}
                      maxLength={60}
                      placeholder="e.g. Honey-Sap Slime Pit"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div className="dk-help-hint" style={{ marginBottom: 3 }}>Category</div>
                      <select
                        className="dk-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as 'ero' | 'standard')}
                      >
                        <option value="ero">Erotic / Restraint</option>
                        <option value="standard">Standard / Lethal</option>
                      </select>
                    </div>

                    <div>
                      <div className="dk-help-hint" style={{ marginBottom: 3 }}>
                        {editingKind === 'room' ? 'Room Synergy' : 'Pre-Rated Grade'}
                      </div>
                      {editingKind === 'room' ? (
                        <select
                          className="dk-select"
                          value={editingRoomSynergy}
                          onChange={(e) => setEditingRoomSynergy(e.target.value as SynergyGrade)}
                        >
                          {ROOM_SYNERGY_GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g === '?' ? '? (Evaluate in Prep)' : `Synergy ${g}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          className="dk-select"
                          value={grade}
                          onChange={(e) => setGrade(e.target.value as SlotGrade)}
                        >
                          {MANUAL_GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g === '?' ? '? (Grade later in Prep)' : `${g} (Skip AI re-grade)`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {editingKind === 'room' && editingRoomSlots.length > 0 ? (
                  <div className="dk-room-slots-list" style={{ marginBottom: 8 }}>
                    <div className="dk-help-hint">
                      Room Traps ({editingRoomSlots.length} slots):
                    </div>
                    {editingRoomSlots.map((rs, idx) => (
                      <div key={`${rs.name}-${idx}`} className="dk-room-slot-row">
                        <span>
                          <b>#{idx + 1}</b> {rs.name} — {rs.detail}
                        </span>
                        <GradeBadge grade={rs.grade} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span className="dk-help-hint">Trap Mechanism &amp; Detail</span>
                      <span className="dk-help-hint">
                        {detail.length}/{CFG.NAME_MAXLEN}
                      </span>
                    </div>
                    <textarea
                      className="dk-textarea"
                      value={detail}
                      maxLength={CFG.NAME_MAXLEN}
                      placeholder="Write the full mechanism once — save it here and 1-click deploy to any floor later!"
                      onChange={(e) => setDetail(e.target.value)}
                    />
                  </div>
                )}

                <div style={{ marginBottom: 8 }}>
                  <div className="dk-help-hint" style={{ marginBottom: 4 }}>
                    Trap Tags (up to 3)
                  </div>
                  <div className="dk-acts">
                    {TRAP_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`dk-btn sm ${selectedTypes.includes(t) ? 'active' : ''}`}
                        onClick={() => toggleType(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="dk-grid-2" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <input
                    className="dk-input"
                    value={notes}
                    placeholder="Optional tactical / Lilim note..."
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={(e) => setPinned(e.target.checked)}
                    />
                    <span>Pin to Build Mode Quick-Deploy Bar</span>
                  </label>
                </div>

                <div className="dk-acts">
                  {editingKind !== 'room' && (
                    <button
                      type="button"
                      className="dk-btn amber"
                      disabled={aiBusy || !detail.trim()}
                      onClick={handleAiAudit}
                    >
                      {aiBusy ? 'Lilim Auditing...' : 'Ask Lilim AI to Rate & Tag'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="dk-btn pri"
                    disabled={!name.trim() || (editingKind !== 'room' && !detail.trim())}
                  >
                    {editingKind === 'room'
                      ? editingId
                        ? 'Update Room Shortcut'
                        : 'Save Room Shortcut'
                      : editingId
                        ? 'Update Shortcut'
                        : 'Save Trap Shortcut'}
                  </button>
                </div>
              </form>

              <hr className="dk-divider" />

              {/* Filter & Import/Export Toolbar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <input
                  className="dk-input"
                  style={{ flex: '1 1 200px' }}
                  value={search}
                  placeholder="Search shortcuts by name, detail, or tag..."
                  onChange={(e) => setSearch(e.target.value)}
                />
                {(['all', 'pinned', 'ero', 'standard', 'room'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`dk-btn sm ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
                <button
                  type="button"
                  className="dk-btn sm"
                  onClick={() => downloadJsonFile('etdm-trap-blueprints.json', blueprints)}
                >
                  Export JSON
                </button>
                <label className="dk-btn sm" style={{ cursor: 'pointer' }}>
                  Import JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                  />
                </label>
              </div>

              {/* Saved Blueprints List */}
              {filtered.length === 0 ? (
                <div className="dk-card" style={{ color: 'var(--o)' }}>
                  No shortcuts match this filter.
                </div>
              ) : (
                filtered.map((bp) => {
                  const isRoom = bp.kind === 'room' && (bp.roomSlots?.length ?? 0) > 0;
                  const roomMeta = isRoom ? getRoomDeployMeta(bp.roomSlots!.length) : null;

                  return (
                    <div key={bp.id} className="dk-card">
                      <div className="dk-card-row">
                        <div>
                          <b style={{ color: 'var(--w)' }}>
                            {bp.pinned ? '★ ' : ''}
                            {bp.name}
                          </b>{' '}
                          {isRoom && (
                            <span className="dk-badge room" style={{ marginRight: 4 }}>
                              ROOM ({bp.roomSlots!.length} traps)
                            </span>
                          )}
                          <span className={`dk-badge ${bp.category === 'ero' ? 'm' : 'c'}`}>
                            {bp.category === 'ero' ? 'ERO' : 'STD'}
                          </span>
                          {bp.types.map((t) => (
                            <span key={t} className="dk-badge" style={{ marginLeft: 4 }}>
                              {t}
                            </span>
                          ))}
                        </div>
                        <GradeBadge
                          grade={isRoom ? (bp.roomSynergy ?? bp.grade) : bp.grade}
                          label={isRoom ? `Syn ${bp.roomSynergy ?? bp.grade}` : undefined}
                        />
                      </div>

                      <div style={{ color: 'var(--g)', marginTop: 4 }}>{bp.detail}</div>

                      {isRoom && bp.roomSlots && (
                        <div className="dk-room-slots-list">
                          {bp.roomSlots.map((rs, idx) => (
                            <div key={`${bp.id}-slot-${idx}`} className="dk-room-slot-row">
                              <span>
                                <b>#{idx + 1}</b> {rs.name}
                              </span>
                              <GradeBadge grade={rs.grade} />
                            </div>
                          ))}
                        </div>
                      )}

                      {bp.notes && (
                        <div className="dk-help-hint" style={{ color: 'var(--y)', marginTop: 3 }}>
                          Note: {bp.notes}
                        </div>
                      )}

                      <div className="dk-acts" style={{ marginTop: 8 }}>
                        {isRoom && roomMeta ? (
                          <button
                            type="button"
                            className="dk-btn sm pri"
                            disabled={!roomMeta.canDeploy}
                            onClick={() => onDeployBlueprint(bp)}
                          >
                            {roomMeta.label}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="dk-btn sm pri"
                            disabled={!canDeploySingle}
                            onClick={() => onDeployBlueprint(bp)}
                          >
                            {!isBuildMode
                              ? 'Deploy (Build Mode Only)'
                              : selectedFloorCost === null
                                ? `${selectedFloor}F Full`
                                : `Deploy to ${selectedFloor}F (-${selectedFloorCost} MP)`}
                          </button>
                        )}
                        <button
                          type="button"
                          className={`dk-btn sm ${bp.pinned ? 'active' : ''}`}
                          onClick={() => onTogglePin(bp.id)}
                        >
                          {bp.pinned ? 'Pinned ★' : 'Pin'}
                        </button>
                        <button
                          type="button"
                          className="dk-btn sm"
                          onClick={() => loadForEdit(bp)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dk-btn sm del"
                          onClick={() => onDeleteBlueprint(bp.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            /* ORIGINAL CODEX (301 + 29) TAB */
            <>
              <div className="dk-codex-toolbar">
                <div className="dk-codex-row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <b style={{ color: 'var(--y)' }}>ORIGINAL DUNGEON KEEPER CODEX</b>{' '}
                    <span className="dk-help-hint">
                      ({CODEX_TRAPS.length} presets + {CODEX_COMBOS.length} room combos · offline ready)
                    </span>
                  </div>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}
                    title="When unchecked, Codex traps deploy with curated grades (D/C/B) and zero AI delay. When checked, they deploy as '?' for Lilim AI grading in Prep."
                  >
                    <input
                      type="checkbox"
                      checked={deployAsPending}
                      onChange={(e) => setDeployAsPending(e.target.checked)}
                    />
                    <span>Deploy as &apos;?&apos; (AI grade in Prep)</span>
                  </label>
                </div>

                <div className="dk-codex-row">
                  <input
                    className="dk-input"
                    style={{ flex: '1 1 210px' }}
                    value={codexSearch}
                    placeholder="Search Codex by ID (E001, TPC01), name, effect, counter, or tag..."
                    onChange={(e) => {
                      setCodexSearch(e.target.value);
                      setCodexPage(1);
                    }}
                  />
                  <select
                    className="dk-select"
                    style={{ flex: '0 1 200px' }}
                    value={codexSubcat}
                    disabled={codexScope === 'combos'}
                    onChange={(e) => {
                      setCodexSubcat(e.target.value);
                      setCodexPage(1);
                    }}
                  >
                    <option value="all">All Subcategories ({availableSubcategories.length})</option>
                    {availableSubcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dk-codex-row">
                  {(
                    [
                      ['all', `All (${CODEX_TRAPS.length + CODEX_COMBOS.length})`],
                      ['presets', `Presets (${CODEX_TRAPS.length})`],
                      ['combos', `Combos (${CODEX_COMBOS.length})`],
                      ['ero', 'Ero'],
                      ['standard', 'Standard'],
                    ] as const
                  ).map(([scopeKey, label]) => (
                    <button
                      key={scopeKey}
                      type="button"
                      className={`dk-btn sm ${codexScope === scopeKey ? 'active' : ''}`}
                      onClick={() => {
                        setCodexScope(scopeKey);
                        setCodexSubcat('all');
                        setCodexPage(1);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="dk-codex-tags">
                  <button
                    type="button"
                    className={`dk-btn sm ${codexTag === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setCodexTag('all');
                      setCodexPage(1);
                    }}
                  >
                    All Tags
                  </button>
                  {TRAP_TYPES.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`dk-btn sm ${codexTag === tag ? 'active' : ''}`}
                      onClick={() => {
                        setCodexTag(codexTag === tag ? 'all' : tag);
                        setCodexPage(1);
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dk-help-hint" style={{ marginBottom: 6 }}>
                Showing {pagedCodexItems.length} of {filteredCodexItems.length} matching entries
                {totalCodexPages > 1 ? ` (Page ${safeCodexPage}/${totalCodexPages})` : ''}
              </div>

              {pagedCodexItems.length === 0 ? (
                <div className="dk-card" style={{ color: 'var(--o)' }}>
                  No Original Codex entries match this search or filter.
                </div>
              ) : (
                pagedCodexItems.map((item) => {
                  if (item.kind === 'combo') {
                    const { combo } = item;
                    const roomMeta = getRoomDeployMeta(combo.roomSlots.length);
                    const synGrade = deployAsPending ? '?' : combo.roomSynergy;
                    const isSaved = savedCodexIds.has(combo.id);

                    return (
                      <div key={combo.id} className="dk-codex-card combo">
                        <div className="dk-card-row">
                          <div>
                            <span className="dk-codex-id">{combo.id}</span>
                            <b style={{ color: 'var(--y)' }}>{combo.name}</b>{' '}
                            <span className="dk-badge room">
                              ROOM ({combo.roomSlots.length} traps)
                            </span>{' '}
                            <span className={`dk-badge ${combo.category === 'ero' ? 'm' : 'c'}`}>
                              {combo.comboCategory.toUpperCase()}
                            </span>
                            {combo.types.map((t) => (
                              <span key={t} className="dk-badge" style={{ marginLeft: 4 }}>
                                {t}
                              </span>
                            ))}
                          </div>
                          <GradeBadge grade={synGrade} label={`Syn ${synGrade}`} />
                        </div>

                        <div style={{ color: 'var(--w)', marginTop: 4 }}>{combo.detail}</div>

                        <div className="dk-room-slots-list">
                          {combo.roomSlots.map((rs, idx) => (
                            <div key={`${combo.id}-${idx}`} className="dk-room-slot-row">
                              <span>
                                <b>#{idx + 1}</b> {rs.name} — {rs.detail}
                              </span>
                              <GradeBadge grade={deployAsPending ? '?' : rs.grade} />
                            </div>
                          ))}
                        </div>

                        <div className="dk-acts" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="dk-btn sm pri"
                            disabled={!roomMeta.canDeploy}
                            onClick={() =>
                              onDeployBlueprint(codexComboToBlueprint(combo, { deployAsPending }))
                            }
                          >
                            {roomMeta.label}
                          </button>
                          <button
                            type="button"
                            className="dk-btn sm amber"
                            onClick={() => handleSaveCodexComboCopy(combo)}
                          >
                            {isSaved ? 'Save Another Copy' : 'Save Copy to My Shortcuts'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const { trap } = item;
                  const linkedCombos = getCombosForCodexTrap(trap.id);
                  const displayGrade = deployAsPending ? '?' : trap.grade;
                  const isSaved = savedCodexIds.has(trap.id);

                  return (
                    <div key={trap.id} className="dk-codex-card">
                      <div className="dk-card-row">
                        <div>
                          <span className="dk-codex-id">{trap.id}</span>
                          <b style={{ color: 'var(--w)' }}>{trap.name}</b>{' '}
                          <span className={`dk-badge ${trap.category === 'ero' ? 'm' : 'c'}`}>
                            {trap.category === 'ero' ? 'ERO' : 'STD'}
                          </span>{' '}
                          <span className="dk-badge">{trap.subcategory}</span>
                          {trap.types.map((t) => (
                            <span key={t} className="dk-badge" style={{ marginLeft: 4 }}>
                              {t}
                            </span>
                          ))}
                        </div>
                        <GradeBadge grade={displayGrade} />
                      </div>

                      <div style={{ color: 'var(--g)', marginTop: 4 }}>{trap.detail}</div>
                      <div className="dk-codex-counters">
                        <b>Counters:</b> {trap.counters}
                      </div>
                      {linkedCombos.length > 0 && (
                        <div className="dk-codex-combo-link">
                          ♦ <b>Combo Partner:</b>{' '}
                          {linkedCombos
                            .map((c) => `${c.id} (${c.memberNames.join(' + ')})`)
                            .join(' · ')}
                        </div>
                      )}

                      <div className="dk-acts" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="dk-btn sm pri"
                          disabled={!canDeploySingle}
                          onClick={() =>
                            onDeployBlueprint(codexTrapToBlueprint(trap, { deployAsPending }))
                          }
                        >
                          {!isBuildMode
                            ? 'Deploy (Build Mode Only)'
                            : selectedFloorCost === null
                              ? `${selectedFloor}F Full`
                              : `Deploy to ${selectedFloor}F (-${selectedFloorCost} MP)`}
                        </button>
                        <button
                          type="button"
                          className="dk-btn sm amber"
                          onClick={() => handleSaveCodexPresetCopy(trap)}
                        >
                          {isSaved ? 'Save Another Copy' : 'Save Copy to My Shortcuts'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {totalCodexPages > 1 && (
                <div className="dk-pagination">
                  <button
                    type="button"
                    className="dk-btn sm"
                    disabled={safeCodexPage <= 1}
                    onClick={() => setCodexPage((p) => Math.max(1, p - 1))}
                  >
                    ◀ Prev
                  </button>
                  <span className="dk-help-hint">
                    Page {safeCodexPage} of {totalCodexPages}
                  </span>
                  <button
                    type="button"
                    className="dk-btn sm"
                    disabled={safeCodexPage >= totalCodexPages}
                    onClick={() => setCodexPage((p) => Math.min(totalCodexPages, p + 1))}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
