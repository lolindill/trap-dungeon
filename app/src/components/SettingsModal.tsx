import { useState } from 'react';
import { calcMonsterUpkeep, isUpkeepActive } from '../engine/monsters';
import { getProviderPresetDefaults, testLlmConnection } from '../llm/client';
import {
  SAVE_SLOT_IDS,
  deleteSaveSlot,
  downloadJsonFile,
  loadFromSlot,
  loadSaveSlots,
  migrateGameState,
  renameSaveSlot,
  saveToSlot,
} from '../engine/saveLoad';
import type {
  DifficultyMode,
  GameSettings,
  GameState,
  LlmConfig,
  LlmProvider,
  RealmConfigMode,
  SaveSlotId,
  SaveSlotRecord,
} from '../types/game';

interface SettingsModalProps {
  llmConfig: LlmConfig;
  gameState: GameState;
  onUpdateLlm: (next: LlmConfig) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onImportSave: (state: GameState) => void;
  onResetGame: () => void;
  onClose: () => void;
}

const QUICK_PRESETS: { label: string; provider: LlmProvider; baseUrl: string; model: string }[] = [
  {
    label: 'OpenAI (gpt-4o-mini)',
    provider: 'openai_compat',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    label: 'OpenRouter',
    provider: 'openai_compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat-v3-0324',
  },
  {
    label: 'Google Gemini',
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  {
    label: 'Anthropic Claude',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-latest',
  },
  {
    label: 'Ollama Local',
    provider: 'openai_compat',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1:8b',
  },
];

function formatSavedTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export function SettingsModal({
  llmConfig,
  gameState,
  onUpdateLlm,
  onUpdateSettings,
  onImportSave,
  onResetGame,
  onClose,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<LlmConfig>(llmConfig);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const [slots, setSlots] = useState<Record<SaveSlotId, SaveSlotRecord | null>>(() =>
    loadSaveSlots()
  );
  const [editingSlotId, setEditingSlotId] = useState<SaveSlotId | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const refreshSlots = () => setSlots(loadSaveSlots());

  const handleProviderChange = (provider: LlmProvider) => {
    const defaults = getProviderPresetDefaults(provider);
    const next = { ...draft, provider, baseUrl: defaults.baseUrl, model: defaults.model };
    setDraft(next);
    onUpdateLlm(next);
  };

  const applyPreset = (p: (typeof QUICK_PRESETS)[number]) => {
    const next: LlmConfig = {
      ...draft,
      provider: p.provider,
      baseUrl: p.baseUrl,
      model: p.model,
    };
    setDraft(next);
    onUpdateLlm(next);
  };

  const updateField = <K extends keyof LlmConfig>(key: K, val: LlmConfig[K]) => {
    const next = { ...draft, [key]: val };
    setDraft(next);
    onUpdateLlm(next);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('Sending connection check...');
    const res = await testLlmConnection(draft, gameState.settings.aiLanguage ?? 'th');
    setTesting(false);
    if (res.ok) {
      setTestResult(`OK (${res.latencyMs}ms): "${res.reply}"`);
    } else {
      setTestResult(`ERROR (${res.latencyMs}ms): ${res.error}`);
    }
  };

  const handleSaveSlot = (slotId: SaveSlotId) => {
    const rec = saveToSlot(slotId, gameState);
    refreshSlots();
    setSaveMsg(
      `Saved "${rec.meta.slotName}" (Wave ${rec.meta.wave}, Day ${rec.meta.day}, ${rec.meta.points} MP, Debt ${rec.meta.debt} MP).`
    );
  };

  const handleLoadSlot = (slotId: SaveSlotId) => {
    const loaded = loadFromSlot(slotId);
    if (!loaded) {
      setSaveMsg(`Slot ${slotId} is empty.`);
      return;
    }
    onImportSave(loaded);
    setSaveMsg(
      `Loaded Slot ${slotId} (Wave ${loaded.wave}, Day ${loaded.day}, ${loaded.points} MP).`
    );
  };

  const handleStartRename = (slotId: SaveSlotId, currentName: string) => {
    setEditingSlotId(slotId);
    setRenameDraft(currentName);
  };

  const handleCommitRename = (slotId: SaveSlotId) => {
    const rec = renameSaveSlot(slotId, renameDraft);
    setEditingSlotId(null);
    refreshSlots();
    if (rec) {
      setSaveMsg(`Renamed Slot ${slotId} to "${rec.meta.slotName}".`);
    }
  };

  const handleDeleteSlot = (slotId: SaveSlotId) => {
    deleteSaveSlot(slotId);
    if (editingSlotId === slotId) setEditingSlotId(null);
    refreshSlots();
    setSaveMsg(`Deleted Slot ${slotId}.`);
  };

  const handleImportSaveFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !Array.isArray((parsed as { floors?: unknown }).floors)
        ) {
          setSaveMsg('Invalid save file: missing floors array.');
          return;
        }
        const migrated = migrateGameState(parsed);
        onImportSave(migrated);
        setSaveMsg(
          `Loaded save cleanly (schema v${migrated.schemaVersion}, Wave ${migrated.wave}, Day ${migrated.day}, ${migrated.points} MP, Debt ${migrated.debt.amount} MP).`
        );
      } catch {
        setSaveMsg('Failed to parse save JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="dk-modal-bg" onClick={onClose}>
      <div className="dk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dk-modal-head">
          <span>SYSTEM SETTINGS, LLM API &amp; SAVE MANAGER</span>
          <button type="button" className="dk-btn sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="dk-modal-body">
          {/* LLM Connection Section */}
          <div className="dk-card">
            <div style={{ color: 'var(--y)', fontWeight: 700, marginBottom: 6 }}>
              1. DIRECT LLM API CONNECTION (STORED LOCALLY IN BROWSER)
            </div>

            <div className="dk-acts" style={{ marginBottom: 8 }}>
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="dk-btn sm"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="dk-grid-2" style={{ marginBottom: 8 }}>
              <div>
                <div className="dk-help-hint">Provider Protocol</div>
                <select
                  className="dk-select"
                  value={draft.provider}
                  onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
                >
                  <option value="openai_compat">OpenAI-Compatible (/chat/completions)</option>
                  <option value="gemini">Google Gemini REST</option>
                  <option value="anthropic">Anthropic Claude Messages</option>
                </select>
              </div>

              <div>
                <div className="dk-help-hint">Model Name</div>
                <input
                  className="dk-input"
                  value={draft.model}
                  onChange={(e) => updateField('model', e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div className="dk-help-hint">Base URL</div>
              <input
                className="dk-input"
                value={draft.baseUrl}
                onChange={(e) => updateField('baseUrl', e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div className="dk-help-hint">API Key (leave blank only for local Ollama/LM Studio)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="dk-input"
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  placeholder="sk-..."
                  onChange={(e) => updateField('apiKey', e.target.value)}
                />
                <button
                  type="button"
                  className="dk-btn sm"
                  onClick={() => setShowKey((s) => !s)}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="dk-grid-2" style={{ marginBottom: 8 }}>
              <div>
                <div className="dk-help-hint">Temperature: {draft.temperature.toFixed(2)}</div>
                <input
                  type="range"
                  min={0.1}
                  max={1.4}
                  step={0.05}
                  value={draft.temperature}
                  style={{ width: '100%' }}
                  onChange={(e) => updateField('temperature', Number(e.target.value))}
                />
              </div>
              <div>
                <div className="dk-help-hint">Max Output Tokens: {draft.maxTokens}</div>
                <input
                  type="range"
                  min={512}
                  max={4096}
                  step={128}
                  value={draft.maxTokens}
                  style={{ width: '100%' }}
                  onChange={(e) => updateField('maxTokens', Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="dk-btn pri"
                disabled={testing}
                onClick={handleTest}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <span
                  style={{
                    color: testResult.startsWith('OK') ? 'var(--n)' : 'var(--r)',
                    fontSize: 12,
                  }}
                >
                  {testResult}
                </span>
              )}
            </div>
          </div>

          {/* Gameplay Preferences */}
          <div className="dk-card">
            <div style={{ color: 'var(--c)', fontWeight: 700, marginBottom: 8 }}>
              2. ADVENTURER POOL &amp; NARRATION PREFERENCES
            </div>
            <div style={{ marginBottom: 8 }}>
              <div className="dk-help-hint">AI Response Language (Chronicle &amp; Officer Chat)</div>
              <select
                className="dk-select"
                value={gameState.settings.aiLanguage ?? 'th'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...gameState.settings,
                    aiLanguage: e.target.value as GameSettings['aiLanguage'],
                  })
                }
              >
                <option value="th">Thai (ภาษาไทย)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="dk-grid-2" style={{ marginBottom: 8 }}>
              <div>
                <div className="dk-help-hint">Incoming Hero Gender Filter</div>
                <select
                  className="dk-select"
                  value={gameState.settings.genderPref}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...gameState.settings,
                      genderPref: e.target.value as GameSettings['genderPref'],
                    })
                  }
                >
                  <option value="random">Mixed (Female &amp; Male)</option>
                  <option value="female">Female Only</option>
                  <option value="male">Male Only</option>
                </select>
              </div>

              <div>
                <div className="dk-help-hint">Incoming Hero Race Scope</div>
                <select
                  className="dk-select"
                  value={gameState.settings.raceScope}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...gameState.settings,
                      raceScope: e.target.value as GameSettings['raceScope'],
                    })
                  }
                >
                  <option value="all">All Fantasy &amp; Humanoid Races</option>
                  <option value="fantasy">Fantasy Races</option>
                  <option value="humanoid">Humanoid Only</option>
                  <option value="human">Human Only</option>
                </select>
              </div>
            </div>

            <div className="dk-acts" style={{ gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={gameState.settings.gore}
                  onChange={(e) =>
                    onUpdateSettings({ ...gameState.settings, gore: e.target.checked })
                  }
                />
                <span>Allow Graphic Gore on Fatal Traps</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={gameState.settings.autoScrollChronicle}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...gameState.settings,
                      autoScrollChronicle: e.target.checked,
                    })
                  }
                />
                <span>Auto-Scroll Chronicle Feed</span>
              </label>

              <label
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                title="When enabled, Result skips the Day/Estate/Debt loop and returns straight to Build (Phase 1 Pure Defense mode)."
              >
                <input
                  type="checkbox"
                  checked={gameState.settings.skipDay}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...gameState.settings,
                      skipDay: e.target.checked,
                    })
                  }
                />
                <span>Skip Day / Pure Defense Mode (Phase 1 Loop)</span>
              </label>
            </div>

            <div className="dk-grid-2" style={{ marginTop: 10 }}>
              <div>
                <div className="dk-help-hint">Difficulty Mode</div>
                <select
                  className="dk-select"
                  value={gameState.settings.difficulty}
                  onChange={(e) => {
                    const nextDiff = e.target.value as DifficultyMode;
                    onUpdateSettings({
                      ...gameState.settings,
                      difficulty: nextDiff,
                      upkeepEnabled: nextDiff === 'hard',
                    });
                  }}
                >
                  <option value="casual">Casual (Upkeep default OFF)</option>
                  <option value="normal">Normal (Upkeep default OFF)</option>
                  <option value="hard">Hard (Upkeep default ON)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  title="Monster & Estate Upkeep (CFG.UPKEEP): Free <=W5, half W6-10, capped at 25% of 3-wave avg income. Arrears raise prisoner resist +3 and risk monster escape/starve."
                >
                  <input
                    type="checkbox"
                    checked={isUpkeepActive(gameState)}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...gameState.settings,
                        upkeepEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>
                    Monster &amp; Estate Upkeep ({calcMonsterUpkeep(gameState).total} MP est.)
                  </span>
                </label>
                <div className="dk-help-hint">
                  Default ON on Hard, OFF on Normal/Casual · Arrears Lv {gameState.estate.upkeepArrears}
                </div>
              </div>
            </div>

            <div className="dk-grid-2" style={{ marginTop: 10 }}>
              <div>
                <div className="dk-help-hint">Realm Situations Mode (W10+)</div>
                <select
                  className="dk-select"
                  value={gameState.settings.realmConfig}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...gameState.settings,
                      realmConfig: e.target.value as RealmConfigMode,
                    })
                  }
                >
                  <option value="on">Full (Standard 25 Situations)</option>
                  <option value="half">Casual Half (Positive hero bonuses halved)</option>
                  <option value="off">Off (Disable Realm Situations)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  title="Automatically trigger an AI Scene Narration whenever a Major Crisis (Crusade, Nemesis, Royal Siege, Jailbreak) or Relic reward resolves."
                >
                  <input
                    type="checkbox"
                    checked={Boolean(gameState.settings.autoNarrateMajorCrises)}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...gameState.settings,
                        autoNarrateMajorCrises: e.target.checked,
                      })
                    }
                  />
                  <span>Auto-Narrate Major Crises (AI)</span>
                </label>
                <div className="dk-help-hint">
                  Otherwise uses 1-click &quot;Narrate Scene Now&quot; on crisis cards
                </div>
              </div>
            </div>
          </div>

          {/* Save Slots 1..5 & JSON Backup */}
          <div className="dk-card">
            <div style={{ color: 'var(--y)', fontWeight: 700, marginBottom: 4 }}>
              3. SAVE SLOTS (1–5) &amp; .JSON RUN MANAGEMENT
            </div>
            <div className="dk-help-hint" style={{ marginBottom: 8 }}>
              Snapshot runs before Debt visits or Endings. LLM API settings stay stored separately.
            </div>

            {saveMsg && <div className="dk-flash">{saveMsg}</div>}

            <div className="dk-slot-list">
              {SAVE_SLOT_IDS.map((slotId) => {
                const rec = slots[slotId];
                const isEditing = editingSlotId === slotId;

                return (
                  <div
                    key={slotId}
                    className={`dk-slot-item ${rec ? 'filled' : ''}`}
                  >
                    <div className="dk-slot-head">
                      <div className="dk-slot-title">
                        <span className="dk-badge y">SLOT {slotId}</span>
                        {rec ? (
                          isEditing ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input
                                className="dk-input"
                                style={{ width: 170, padding: '2px 6px' }}
                                maxLength={40}
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitRename(slotId);
                                  if (e.key === 'Escape') setEditingSlotId(null);
                                }}
                              />
                              <button
                                type="button"
                                className="dk-btn sm pri"
                                onClick={() => handleCommitRename(slotId)}
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                className="dk-btn sm"
                                onClick={() => setEditingSlotId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span>{rec.meta.slotName}</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--o)', fontWeight: 400 }}>Empty Slot</span>
                        )}
                      </div>

                      <div className="dk-acts">
                        <button
                          type="button"
                          className="dk-btn sm amber"
                          onClick={() => handleSaveSlot(slotId)}
                        >
                          {rec ? 'Overwrite' : 'Save Here'}
                        </button>
                        {rec && (
                          <>
                            <button
                              type="button"
                              className="dk-btn sm pri"
                              onClick={() => handleLoadSlot(slotId)}
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              className="dk-btn sm"
                              onClick={() => handleStartRename(slotId, rec.meta.slotName)}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="dk-btn sm del"
                              onClick={() => handleDeleteSlot(slotId)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {rec && (
                      <div className="dk-slot-meta">
                        <span className="dk-badge c">Wave {rec.meta.wave}</span>
                        <span className="dk-badge">Day {rec.meta.day}</span>
                        <span className="dk-badge y">{rec.meta.points} MP</span>
                        <span className="dk-badge r">Debt {rec.meta.debt} MP</span>
                        <span className="dk-badge m">{rec.meta.mode.toUpperCase()}</span>
                        <span className="dk-help-hint">Saved {formatSavedTime(rec.meta.savedAt)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <hr className="dk-divider" />

            <div className="dk-acts">
              <button
                type="button"
                className="dk-btn pri"
                onClick={() =>
                  downloadJsonFile(`etdm-save-wave${gameState.wave}.json`, gameState)
                }
              >
                Export Run Save (.json)
              </button>

              <label className="dk-btn" style={{ cursor: 'pointer' }}>
                Import Run Save (.json)
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleImportSaveFile}
                />
              </label>

              <button
                type="button"
                className="dk-btn del"
                onClick={() => {
                  onResetGame();
                  setSaveMsg('Started a brand-new Dungeon Core run.');
                }}
              >
                Reset Run (Keep Blueprints &amp; API Key)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
