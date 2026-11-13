import { useEffect, useRef, useState } from 'react';
import { resolveSceneAsset } from './data/assetManifest';
import { BlueprintWorkshopModal } from './components/BlueprintWorkshopModal';
import { ChroniclePanel } from './components/ChroniclePanel';
import { DayPanel } from './components/DayPanel';
import { DebtPanel } from './components/DebtPanel';
import { EndingGameOverModal } from './components/EndingGameOverModal';
import { EstatePanel } from './components/EstatePanel';
import { ExpeditionPanel } from './components/ExpeditionPanel';
import { FloorBoard } from './components/FloorBoard';
import { GalleryModal } from './components/GalleryModal';
import { HeaderBar } from './components/HeaderBar';
import { NavTabs } from './components/NavTabs';
import { OfficersPanel } from './components/OfficersPanel';
import { PrepPanel } from './components/PrepPanel';
import { PrisonPanel } from './components/PrisonPanel';
import { RaidPanel } from './components/RaidPanel';
import { SettingsModal } from './components/SettingsModal';
import { SettlementPanel } from './components/SettlementPanel';
import {
  closeDayAndRest,
  finishDebtPhase,
  finishExpeditionPhase,
  finishManagementSettle,
  formatDeterministicDayJournal,
  getPrimaryTabForMode,
  isDayPhase,
  performQuickOfficerAction,
  performQuickPrisonAction,
  performQuickTownAction,
  resolveTabShortcutKey,
  type NavTabId,
} from './engine/dayLoop';
import {
  getInstallCost,
  installBlueprintToFloor,
  installCustomTrap,
  removeTrapFromFloor,
  renameTrapOnFloor,
  upgradeTrapOnFloor,
} from './engine/dungeon';
import { advanceRaidStep } from './engine/raid';
import {
  ENDING_DEFS,
  ensureRankTrialsInitialized,
  formatDeterministicEndingSummary,
  GAMEOVER_DEFS,
  rewindGameOverToWaveStart,
} from './engine/endings';
import {
  createInitialGameState,
  loadBlueprints,
  loadFromSlot,
  loadLlmConfig,
  loadSavedState,
  persistBlueprints,
  persistGameState,
  persistLlmConfig,
} from './engine/saveLoad';
import { applyPrepReply, parseSingleBlueprintEval } from './engine/tagParser';
import {
  appendChronicleEntry,
  cancelPrepBackToBuild,
  finishBuildPhase,
  finishResultPhase,
  pickPhaseBanner,
  startInvasionPhase,
} from './engine/workflow';
import { callLlm } from './llm/client';
import {
  buildBlueprintEvalMessages,
  buildDayJournalMessages,
  buildEndingNarrationMessages,
  buildOfficerChatMessages,
  buildPrepMessages,
  buildRaidMessages,
  buildSceneNarrationMessages,
} from './llm/promptBuilder';
import type {
  EndingKey,
  GameMode,
  GameOverKey,
  GameSettings,
  GameState,
  LlmConfig,
  OfficerKey,
  SaveSlotId,
  TrapBlueprint,
  TrapSlot,
} from './types/game';

const MODE_HEADINGS: Record<GameMode, string> = {
  build: 'DUNGEON ARCHITECT BOARD',
  prep: 'RECON & EVALUATION BRIEFING',
  raid: 'LIVE INVASION TRACKER',
  result: 'WAVE SETTLEMENT LEDGER',
  estate: 'DAY ESTATE & MANAGEMENT',
  msettle: 'MANAGEMENT SETTLEMENT & CRISIS',
  exped: 'EXPEDITION TRANSIT',
  debt: 'ELEONORA DEBT COLLECTION DESK',
  over: 'GAME OVER SUMMARY',
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => loadSavedState());
  const [blueprints, setBlueprints] = useState<TrapBlueprint[]>(() => loadBlueprints());
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => loadLlmConfig());

  const [isBusy, setIsBusy] = useState(false);
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [endingModalMode, setEndingModalMode] = useState<'ending' | 'gameover' | null>(null);
  const [modalEndingKey, setModalEndingKey] = useState<EndingKey | null>(null);
  const [endingNarrationText, setEndingNarrationText] = useState<string | null>(null);
  const seenUnlockedRef = useRef<Set<string>>(
    new Set(Object.keys(gameState.endings.unlocked)),
  );
  const [workshopPrefill, setWorkshopPrefill] = useState<TrapSlot | null>(null);
  const [activeTab, setActiveTab] = useState<NavTabId>(() =>
    getPrimaryTabForMode(gameState.mode)
  );

  // Auto-open Game Over modal when mode switches to 'over'
  useEffect(() => {
    if (gameState.mode === 'over') {
      setEndingNarrationText(null);
      setEndingModalMode('gameover');
    } else if (endingModalMode === 'gameover') {
      setEndingModalMode(null);
    }
  }, [gameState.mode, endingModalMode]);

  // Auto-open Ending modal once when a new non-bankrupt ending unlocks
  useEffect(() => {
    const keys = Object.keys(gameState.endings.unlocked);
    const newlyUnlocked = keys.find(
      (k) => !seenUnlockedRef.current.has(k) && !k.startsWith('go_') && k !== 'bankrupt',
    ) as EndingKey | undefined;
    keys.forEach((k) => seenUnlockedRef.current.add(k));
    if (newlyUnlocked) {
      setModalEndingKey(newlyUnlocked);
      setEndingNarrationText(null);
      setEndingModalMode('ending');
    }
  }, [gameState.endings.unlocked]);

  // Auto-focus Left Pane sub-tab whenever phase/mode changes
  useEffect(() => {
    setActiveTab(getPrimaryTabForMode(gameState.mode));
  }, [gameState.mode]);

  useEffect(() => {
    persistGameState(gameState);
  }, [gameState]);

  useEffect(() => {
    persistBlueprints(blueprints);
  }, [blueprints]);

  useEffect(() => {
    persistLlmConfig(llmConfig);
  }, [llmConfig]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWorkshop(false);
        setShowSettings(false);
        setShowGallery(false);
        setEndingModalMode(null);
        return;
      }
      if (showWorkshop || showSettings || showGallery || endingModalMode) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tab = resolveTabShortcutKey(e.key, target);
      if (tab) {
        e.preventDefault();
        setActiveTab(tab);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showWorkshop, showSettings, showGallery]);

  const currentFloorState =
    gameState.floors[gameState.selectedFloor - 1] ?? gameState.floors[0];
  const currentFloorInstallCost = getInstallCost(currentFloorState.slots.length);

  // --- Build Actions ---
  const handleSelectFloor = (floorNum: number) => {
    setGameState((prev) => ({ ...prev, selectedFloor: floorNum }));
  };

  const handleInstallCustom = (floorNum: number, text: string): boolean => {
    const res = installCustomTrap(gameState, floorNum, text);
    setGameState(res.state);
    return res.ok;
  };

  const handleInstallBlueprint = (floorNum: number, bp: TrapBlueprint) => {
    const res = installBlueprintToFloor(gameState, floorNum, bp);
    setGameState(res.state);
  };

  const handleSaveAsBlueprint = (slot: TrapSlot) => {
    setWorkshopPrefill(slot);
    setShowWorkshop(true);
  };

  const handleUpgradeTrap = (floorNum: number, slotIdx: number) => {
    setGameState((prev) => upgradeTrapOnFloor(prev, floorNum, slotIdx).state);
  };

  const handleRenameTrap = (floorNum: number, slotIdx: number, newText: string) => {
    setGameState((prev) => renameTrapOnFloor(prev, floorNum, slotIdx, newText).state);
  };

  const handleRemoveTrap = (floorNum: number, slotIdx: number) => {
    setGameState((prev) => removeTrapFromFloor(prev, floorNum, slotIdx).state);
  };

  const handleFinishBuild = () => {
    setGameState((prev) => finishBuildPhase(prev));
  };

  // --- Blueprint Workshop Actions ---
  const handleSaveBlueprint = (bp: TrapBlueprint) => {
    setBlueprints((prev) => {
      const idx = prev.findIndex((item) => item.id === bp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = bp;
        return next;
      }
      return [bp, ...prev];
    });
  };

  const handleDeleteBlueprint = (id: string) => {
    setBlueprints((prev) => prev.filter((b) => b.id !== id));
  };

  const handleTogglePin = (id: string) => {
    setBlueprints((prev) =>
      prev.map((b) => (b.id === id ? { ...b, pinned: !b.pinned, updatedAt: Date.now() } : b))
    );
  };

  const handleImportBlueprints = (incoming: TrapBlueprint[]) => {
    setBlueprints((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const item of incoming) {
        if (!existingIds.has(item.id)) merged.push(item);
      }
      return merged;
    });
  };

  const handleEvaluateBlueprintWithAi = async (
    name: string,
    detail: string,
    category: 'ero' | 'standard'
  ) => {
    try {
      const reply = await callLlm(
        llmConfig,
        buildBlueprintEvalMessages(gameState, name, detail, category)
      );
      return parseSingleBlueprintEval(reply);
    } catch (err) {
      return {
        types: [] as string[],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  // --- Prep & Raid LLM Workflows ---
  const handleRunAiPrep = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const messages = buildPrepMessages(gameState);
      const reply = await callLlm(llmConfig, messages);
      setGameState((prev) => {
        const parsed = applyPrepReply(prev, reply);
        const wave = prev.prepMeta?.wave ?? prev.wave + 1;
        return appendChronicleEntry(parsed.state, {
          kind: 'prep',
          title: `Wave ${wave} Reconnaissance & Lilim Audit`,
          text: reply,
          bannerUrl: pickPhaseBanner('prep', wave),
          wave,
        });
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setGameState((prev) =>
        appendChronicleEntry(
          { ...prev, flash: `AI Prep failed: ${errMsg}` },
          {
            kind: 'error',
            title: 'AI Prep Request Failed',
            text: `${errMsg}\n\nOpen "Settings / Set LLM API" to configure your API key/model, or click "Quick Start Without AI Briefing" to proceed immediately.`,
          }
        )
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartRaid = (allowDefault = false) => {
    setGameState((prev) => {
      const next = startInvasionPhase(prev, allowDefault);
      if (next.mode !== 'raid') return prev;
      return appendChronicleEntry(next, {
        kind: 'system',
        title: `Wave ${next.wave} — The Gates Open`,
        text: `The heavy stone gates shudder open. ${next.party
          .map((h) => `${h.name || `#${h.slot} ${h.raceLabel} ${h.classLabel}`} (${h.grade})`)
          .join(', ')} step into the torchlit entrance hall.`,
        bannerUrl:
          next.wave % 10 === 0
            ? pickPhaseBanner('boss', next.wave)
            : pickPhaseBanner('pass', next.wave),
        wave: next.wave,
      });
    });
  };

  const handleBackToBuild = () => {
    setGameState((prev) => cancelPrepBackToBuild(prev));
  };

  const handleAdvanceFloor = async (narrateWithAi: boolean) => {
    if (isBusy) return;
    const step = advanceRaidStep(gameState);

    if (!narrateWithAi) {
      setGameState(
        appendChronicleEntry(step.state, {
          kind: 'raid',
          title: `Wave ${step.state.wave} · ${step.floorLabel} — ${step.outcome.toUpperCase()}`,
          text: step.detailText,
          bannerUrl: pickPhaseBanner(step.outcome, step.state.wave),
          wave: step.state.wave,
          floor: step.state.floorCursor || undefined,
        })
      );
      if (
        gameState.settings.autoNarrateMajorCrises &&
        step.state.crises.lastCrisisCard &&
        step.state.crises.lastCrisisCard !== gameState.crises.lastCrisisCard
      ) {
        const c = step.state.crises.lastCrisisCard;
        void handleNarrateScene(c.title, `${c.subtitle}\n${c.body}`, resolveSceneAsset(c.assetKey));
      }
      return;
    }

    // Apply deterministic state first so user sees dice/HP outcomes immediately
    setGameState(step.state);
    setIsBusy(true);
    try {
      const messages = buildRaidMessages(
        step.state,
        step.outcome,
        step.floorLabel,
        step.detailText
      );
      const reply = await callLlm(llmConfig, messages);
      setGameState((prev) =>
        appendChronicleEntry(prev, {
          kind: 'raid',
          title: `Wave ${step.state.wave} · ${step.floorLabel} — ${step.outcome.toUpperCase()}`,
          text: `${reply}\n\n[Dice Log · ${step.floorLabel}]\n${step.detailText}`,
          bannerUrl: pickPhaseBanner(step.outcome, step.state.wave),
          wave: step.state.wave,
          floor: step.state.floorCursor || undefined,
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setGameState((prev) =>
        appendChronicleEntry(
          { ...prev, flash: `Encounter resolved, AI narration failed: ${errMsg}` },
          {
            kind: 'raid',
            title: `Wave ${step.state.wave} · ${step.floorLabel} — ${step.outcome.toUpperCase()} (System Fallback)`,
            text: `${step.detailText}\n\n[Narration Error: ${errMsg}]`,
            bannerUrl: pickPhaseBanner(step.outcome, step.state.wave),
            wave: step.state.wave,
            floor: step.state.floorCursor || undefined,
          }
        )
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleNextWave = () => {
    setGameState((prev) => finishResultPhase(prev));
  };

  // --- Day Loop & Sub-Tab Actions ---
  const handleQuickTownAction = (action: 'patrol' | 'petitions' | 'forage' | 'market') => {
    setGameState((prev) => performQuickTownAction(prev, action).state);
  };

  const handleQuickPrisonAction = (pid: number, action: 'interrogate' | 'rest') => {
    setGameState((prev) => performQuickPrisonAction(prev, pid, action).state);
  };

  const handleQuickOfficerAction = (officer: OfficerKey, mode: 'time' | 'gift') => {
    setGameState((prev) => performQuickOfficerAction(prev, officer, mode).state);
  };

  const handleEndDayQuickSettle = () => {
    if (isBusy) return;
    setGameState((prev) => {
      const closed = closeDayAndRest(prev);
      const summary = formatDeterministicDayJournal(
        prev,
        closed.journalLines,
        closed.restMp
      );
      return appendChronicleEntry(closed.state, {
        kind: 'day',
        title: `Day ${prev.day || prev.wave} Evening Ledger (Quick Settle)`,
        text: summary,
        bannerUrl: pickPhaseBanner('day', prev.wave),
        wave: prev.wave,
      });
    });
  };

  const handleEndDayAiJournal = async () => {
    if (isBusy) return;
    const snapshotBeforeClose = gameState;
    const closed = closeDayAndRest(snapshotBeforeClose);
    const dayNum = snapshotBeforeClose.day || snapshotBeforeClose.wave;

    // Apply deterministic state close immediately
    setGameState(closed.state);
    setIsBusy(true);
    try {
      const messages = buildDayJournalMessages(
        snapshotBeforeClose,
        closed.journalLines,
        closed.restMp
      );
      const reply = await callLlm(llmConfig, messages);
      setGameState((prev) =>
        appendChronicleEntry(prev, {
          kind: 'day',
          title: `Day ${dayNum} Evening Journal`,
          text: reply,
          bannerUrl: pickPhaseBanner('day', snapshotBeforeClose.wave),
          wave: snapshotBeforeClose.wave,
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fallback = formatDeterministicDayJournal(
        snapshotBeforeClose,
        closed.journalLines,
        closed.restMp
      );
      setGameState((prev) =>
        appendChronicleEntry(
          { ...prev, flash: `Day settled; AI Journal unavailable (${errMsg}).` },
          {
            kind: 'day',
            title: `Day ${dayNum} Evening Ledger (Offline Fallback)`,
            text: `${fallback}\n\n[AI Journal Fallback: ${errMsg}]`,
            bannerUrl: pickPhaseBanner('day', snapshotBeforeClose.wave),
            wave: snapshotBeforeClose.wave,
          }
        )
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleFinishMSettle = () => {
    setGameState((prev) => finishManagementSettle(prev));
  };

  const handleFinishExped = () => {
    setGameState((prev) => finishExpeditionPhase(prev));
  };

  const handleFinishDebt = () => {
    setGameState((prev) => finishDebtPhase(prev));
  };

  const handleTogglePendingGrades = () => {
    setGameState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        showPendingGrades: !prev.settings.showPendingGrades,
      },
    }));
  };

  const handleNarrateScene = async (
    title: string,
    sceneContext: string,
    imageUrl?: string
  ) => {
    if (isBusy) return;
    setIsBusy(true);
    const snapshot = gameState;
    try {
      const messages = buildSceneNarrationMessages(snapshot, title, sceneContext);
      const reply = await callLlm(llmConfig, messages);
      setGameState((prev) =>
        appendChronicleEntry(prev, {
          kind: snapshot.mode === 'debt' ? 'debt' : 'day',
          title,
          text: reply,
          bannerUrl: imageUrl,
          wave: snapshot.wave,
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setGameState((prev) =>
        appendChronicleEntry(
          { ...prev, flash: `Scene logged locally (AI narration unavailable: ${errMsg}).` },
          {
            kind: snapshot.mode === 'debt' ? 'debt' : 'day',
            title: `${title} (System Summary)`,
            text: `${sceneContext}\n\n[AI Narration Fallback: ${errMsg}]`,
            bannerUrl: imageUrl,
            wave: snapshot.wave,
          }
        )
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleOfficerChat = async (userText: string) => {
    if (isBusy) return;
    const withUser = appendChronicleEntry(gameState, {
      kind: 'chat_user',
      title: 'Master',
      text: userText,
      wave: gameState.wave,
    });
    setGameState(withUser);
    setIsBusy(true);
    try {
      const messages = buildOfficerChatMessages(withUser, userText, withUser.chronicle);
      const reply = await callLlm(llmConfig, messages);
      setGameState((prev) =>
        appendChronicleEntry(prev, {
          kind: 'chat_ai',
          title: 'Officers Desk',
          text: reply,
          wave: prev.wave,
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setGameState((prev) =>
        appendChronicleEntry(prev, {
          kind: 'error',
          title: 'Officer Chat Failed',
          text: errMsg,
        })
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateSettings = (settings: GameSettings) => {
    setGameState((prev) => ({ ...prev, settings }));
  };

  const handleResetGame = () => {
    seenUnlockedRef.current = new Set();
    setEndingModalMode(null);
    setModalEndingKey(null);
    setEndingNarrationText(null);
    setGameState(createInitialGameState());
  };

  const handleNewGameConfirm = () => {
    if (window.confirm('Start a brand-new Dungeon Core run? (Trap Shortcuts & LLM API settings are kept.)')) {
      handleResetGame();
    }
  };

  const hasLlmConfigured =
    Boolean(llmConfig.apiKey.trim()) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(llmConfig.baseUrl);

  const handleNarrateEnding = async (
    kind: 'ending' | 'gameover',
    key: EndingKey | GameOverKey,
  ) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      let text: string;
      if (hasLlmConfigured) {
        const messages = buildEndingNarrationMessages(gameState, kind, key);
        text = await callLlm(llmConfig, messages);
      } else {
        text = formatDeterministicEndingSummary(gameState, kind, key);
      }
      const artKey =
        kind === 'gameover'
          ? GAMEOVER_DEFS[key as GameOverKey].artKey
          : ENDING_DEFS[key as EndingKey].artKey;
      const title =
        kind === 'gameover'
          ? `Game Over Fall · ${GAMEOVER_DEFS[key as GameOverKey].title}`
          : `Ending Finale · ${ENDING_DEFS[key as EndingKey].title}`;
      setEndingNarrationText(text);
      setGameState((prev) =>
        appendChronicleEntry(prev, {
          wave: prev.wave,
          kind: 'ending',
          title,
          text,
          bannerUrl: resolveSceneAsset(artKey),
        }),
      );
    } catch (err) {
      const fallback = formatDeterministicEndingSummary(gameState, kind, key);
      const errNote = err instanceof Error ? err.message : String(err);
      setEndingNarrationText(`${fallback}\n\n[LLM Offline Fallback — ${errNote}]`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleContinueEndless = () => {
    setGameState((prev) => ensureRankTrialsInitialized(prev));
    setEndingModalMode(null);
  };

  const handleRewindWaveStart = () => {
    const rewound = rewindGameOverToWaveStart(gameState);
    if (!rewound) {
      setGameState((prev) => ({
        ...prev,
        flash: 'No wave-start snapshot available to rewind. Try loading a Save Slot or starting a New Run.',
      }));
      return;
    }
    setEndingModalMode(null);
    setEndingNarrationText(null);
    setGameState(rewound);
  };

  const handleLoadSaveSlot = (slotId: SaveSlotId) => {
    const loaded = loadFromSlot(slotId);
    if (!loaded) return;
    seenUnlockedRef.current = new Set(Object.keys(loaded.endings.unlocked));
    setEndingModalMode(null);
    setEndingNarrationText(null);
    setGameState({
      ...loaded,
      flash: `Loaded Slot ${slotId} (Wave ${loaded.wave} · ${loaded.mode.toUpperCase()}).`,
    });
  };

  return (
    <div className="dk-app">
      <HeaderBar
        state={gameState}
        llmConfig={llmConfig}
        blueprintCount={blueprints.length}
        onOpenWorkshop={() => {
          setWorkshopPrefill(null);
          setShowWorkshop(true);
        }}
        onOpenGallery={() => setShowGallery(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenEndingModal={() => {
          setEndingNarrationText(null);
          if (gameState.mode === 'over') {
            setEndingModalMode('gameover');
          } else {
            setModalEndingKey(gameState.endings.activeEnding ?? 'prosperity');
            setEndingModalMode('ending');
          }
        }}
        onNewGame={handleNewGameConfirm}
      />

      <main className="dk-workspace">
        {/* Left Pane: Persistent Top Sub-Tabs + Active Subsystem */}
        <section className="dk-pane">
          <div className="dk-pane-head">
            <span>{MODE_HEADINGS[gameState.mode]}</span>
            <span>
              {isDayPhase(gameState)
                ? `${gameState.ap}/${gameState.apMax} AP · `
                : 'AP LOCKED · '}
              {gameState.points} MP
            </span>
          </div>

          <NavTabs
            state={gameState}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />

          <div className="dk-pane-body">
            {gameState.flash && <div className="dk-flash">{gameState.flash}</div>}

            {gameState.mode === 'over' && (
              <div
                className="dk-floor-head"
                style={{
                  borderLeftColor: 'var(--r)',
                  background: 'rgba(185, 28, 28, 0.14)',
                  marginBottom: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div>
                  <strong>
                    💀 GAME OVER ·{' '}
                    {GAMEOVER_DEFS[gameState.endings.gameOver ?? 'core'].title}
                  </strong>
                  <div className="dk-help-hint" style={{ color: 'var(--w)' }}>
                    Inspect Chronicle logs below or reopen Recovery to Rewind Wave Start / Load Slot 1–5.
                  </div>
                </div>
                <button
                  type="button"
                  className="dk-btn cta sm"
                  onClick={() => setEndingModalMode('gameover')}
                >
                  Open Recovery / Rewind
                </button>
              </div>
            )}

            {activeTab === 'dungeon' && gameState.mode === 'build' && (
              <FloorBoard
                state={gameState}
                blueprints={blueprints}
                onSelectFloor={handleSelectFloor}
                onInstallCustom={handleInstallCustom}
                onInstallBlueprint={handleInstallBlueprint}
                onSaveAsBlueprint={handleSaveAsBlueprint}
                onUpgradeTrap={handleUpgradeTrap}
                onRenameTrap={handleRenameTrap}
                onRemoveTrap={handleRemoveTrap}
                onTogglePendingGrades={handleTogglePendingGrades}
                onUpdateState={setGameState}
                onOpenWorkshop={() => {
                  setWorkshopPrefill(null);
                  setShowWorkshop(true);
                }}
                onFinishBuild={handleFinishBuild}
              />
            )}

            {activeTab === 'dungeon' && gameState.mode === 'prep' && (
              <PrepPanel
                state={gameState}
                isBusy={isBusy}
                onRunAiPrep={handleRunAiPrep}
                onStartRaid={handleStartRaid}
                onBackToBuild={handleBackToBuild}
              />
            )}

            {activeTab === 'dungeon' && gameState.mode === 'raid' && (
              <RaidPanel
                state={gameState}
                isBusy={isBusy}
                onAdvanceFloor={handleAdvanceFloor}
              />
            )}

            {activeTab === 'dungeon' && gameState.mode === 'result' && (
              <SettlementPanel
                state={gameState}
                isBusy={isBusy}
                onNarrateScene={handleNarrateScene}
                onNextWave={handleNextWave}
              />
            )}

            {activeTab === 'dungeon' &&
              gameState.mode !== 'build' &&
              gameState.mode !== 'prep' &&
              gameState.mode !== 'raid' &&
              gameState.mode !== 'result' && (
                <DayPanel
                  tab="dungeon_inspect"
                  state={gameState}
                  isBusy={isBusy}
                  onSelectFloor={handleSelectFloor}
                  onQuickTownAction={handleQuickTownAction}
                  onQuickPrisonAction={handleQuickPrisonAction}
                  onQuickOfficerAction={handleQuickOfficerAction}
                  onEndDayAiJournal={handleEndDayAiJournal}
                  onEndDayQuickSettle={handleEndDayQuickSettle}
                  onFinishMSettle={handleFinishMSettle}
                  onFinishExped={handleFinishExped}
                  onFinishDebt={handleFinishDebt}
                />
              )}

            {activeTab === 'prison' && (
              <PrisonPanel
                state={gameState}
                isBusy={isBusy}
                onUpdateState={setGameState}
                onNarrateScene={handleNarrateScene}
              />
            )}

            {activeTab === 'estate' && gameState.mode !== 'exped' && (
              <EstatePanel
                state={gameState}
                isBusy={isBusy}
                onUpdateState={setGameState}
                onNarrateScene={handleNarrateScene}
                onFinishMSettle={handleFinishMSettle}
                onEndDayAiJournal={handleEndDayAiJournal}
                onEndDayQuickSettle={handleEndDayQuickSettle}
              />
            )}

            {activeTab === 'estate' && gameState.mode === 'exped' && (
              <ExpeditionPanel
                state={gameState}
                isBusy={isBusy}
                onUpdateState={setGameState}
                onNarrateScene={handleNarrateScene}
                onFinishExped={handleFinishExped}
              />
            )}

            {activeTab === 'debt' && (
              <DebtPanel
                state={gameState}
                isBusy={isBusy}
                onUpdateState={setGameState}
                onNarrateScene={handleNarrateScene}
                onFinishDebt={handleFinishDebt}
              />
            )}

            {activeTab === 'officers' && (
              <OfficersPanel
                state={gameState}
                isBusy={isBusy}
                onUpdateState={setGameState}
                onNarrateScene={handleNarrateScene}
              />
            )}
          </div>
        </section>

        {/* Right Pane: Chronicle & Officer Chat */}
        <ChroniclePanel
          entries={gameState.chronicle}
          autoScroll={gameState.settings.autoScrollChronicle}
          isBusy={isBusy}
          dayLogCount={gameState.dayLines.length}
          onSendChat={handleOfficerChat}
        />
      </main>

      {showWorkshop && (
        <BlueprintWorkshopModal
          blueprints={blueprints}
          selectedFloor={gameState.selectedFloor}
          selectedFloorCost={currentFloorInstallCost}
          selectedFloorSlotCount={currentFloorState.slots.length}
          currentMp={gameState.points}
          isBuildMode={gameState.mode === 'build'}
          prefillSlot={workshopPrefill}
          onClose={() => {
            setShowWorkshop(false);
            setWorkshopPrefill(null);
          }}
          onSaveBlueprint={handleSaveBlueprint}
          onDeleteBlueprint={handleDeleteBlueprint}
          onTogglePin={handleTogglePin}
          onDeployBlueprint={(bp) => {
            handleInstallBlueprint(gameState.selectedFloor, bp);
          }}
          onEvaluateWithAi={handleEvaluateBlueprintWithAi}
          onImportBlueprints={handleImportBlueprints}
        />
      )}

      {showSettings && (
        <SettingsModal
          llmConfig={llmConfig}
          gameState={gameState}
          onUpdateLlm={setLlmConfig}
          onUpdateSettings={handleUpdateSettings}
          onImportSave={(loaded) => setGameState(loaded)}
          onResetGame={handleResetGame}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showGallery && <GalleryModal onClose={() => setShowGallery(false)} />}

      {endingModalMode && (
        <EndingGameOverModal
          state={gameState}
          mode={endingModalMode}
          endingKey={modalEndingKey}
          gameOverKey={gameState.endings.gameOver}
          llmConfigured={hasLlmConfigured}
          narrationText={endingNarrationText}
          narrating={isBusy}
          onNarrate={handleNarrateEnding}
          onContinueEndless={handleContinueEndless}
          onRewindWaveStart={handleRewindWaveStart}
          onLoadSlot={handleLoadSaveSlot}
          onNewRun={handleNewGameConfirm}
          onClose={() => setEndingModalMode(null)}
        />
      )}
    </div>
  );
}
