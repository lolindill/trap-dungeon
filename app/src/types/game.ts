export type TrapGrade = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
export type SlotGrade = TrapGrade | '?';
export type SynergyGrade = 'D' | 'C' | 'B' | 'A' | 'S' | '?' | '-';
export type HeroGrade = 'F' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'EPIC';
export type RollableHeroGrade = Exclude<HeroGrade, 'EPIC'>;
export type GameMode =
  | 'build'
  | 'prep'
  | 'raid'
  | 'result'
  | 'estate'
  | 'msettle'
  | 'exped'
  | 'debt'
  | 'over';
export type HeroStatus = 'pending' | 'alive' | 'dead' | 'captured' | 'retreated';
export type HeroCondition = '' | 'injured' | 'severe';
export type GenderPref = 'random' | 'female' | 'male';
export type RaceScope = 'all' | 'fantasy' | 'humanoid' | 'human';
export type LlmProvider = 'openai_compat' | 'gemini' | 'anthropic';
export type AiLanguage = 'th' | 'en';
export type DifficultyMode = 'casual' | 'normal' | 'hard';
export type RealmConfigMode = 'on' | 'half' | 'off';
export type TownPolicy = 'low' | 'normal' | 'high';
export type PrisonerConversion = 'guard' | 'servant' | 'pet' | 'dancer' | 'hired';
export type OfficerKey = 'vesper' | 'lilim' | 'eleonora';
export type EndingKey = 'romance' | 'romance_dowry' | 'liberation' | 'prosperity' | 'bankrupt';
export type GameOverKey = 'ruin' | 'famine' | 'riot' | 'core' | 'bankrupt';
export type RelicKey = 'shield' | 'chalice' | 'crown' | 'lens';
export type RankTrialKey = 'wipe3' | 'jobs5' | 'annex1' | 'epic';
export type WarRivalKey = 'paladin' | 'merchant' | 'witch';
export type ExpeditionLengthKey = 'short' | 'mid' | 'long' | 'grand' | 'abyss';
export type SaveSlotId = 1 | 2 | 3 | 4 | 5;

export interface TrapSlot {
  id: string;
  text: string;
  grade: SlotGrade;
  types: string[];
  mpInvested: number;
  blueprintId?: string;
}

export type FloorCombatSlot =
  | { kind: 'monster'; monsterId: string }
  | { kind: 'prisoner'; pid: number };

export interface FloorState {
  floor: number; // 1..7
  slots: TrapSlot[];
  synergy: SynergyGrade;
  combatSlots?: FloorCombatSlot[];
  labBuff?: boolean;
}

export interface RoomBlueprintSlot {
  name: string;
  detail: string;
  category: 'ero' | 'standard';
  grade: SlotGrade;
  types: string[];
}

export interface TrapBlueprint {
  id: string;
  name: string;
  detail: string;
  category: 'ero' | 'standard';
  grade: SlotGrade;
  types: string[];
  notes?: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  kind?: 'trap' | 'room';
  roomSlots?: RoomBlueprintSlot[];
  roomSynergy?: SynergyGrade;
  codexId?: string;
}

export interface Hero {
  slot: 1 | 2 | 3;
  grade: HeroGrade;
  status: HeroStatus;
  gender: 'female' | 'male';
  classKey: string;
  classLabel: string;
  raceKey: string;
  raceLabel: string;
  traits: string[];
  kinkKey: string;
  kinkDesc: string;
  age: string;
  body: string;
  looks: string;
  persona: string;
  origin: string;
  exp: 'virgin' | 'some' | 'many';
  marital: 'single' | 'engaged' | 'married' | 'widowed';
  intel: number;
  // Filled by LLM during Prep:
  name: string;
  appearance: string;
  outfit: string;
  personalityText: string;
  skill: string;
  weakness: string;
  kinkText: string;
  // Combat state during Raid:
  cond: HeroCondition;
  ailment: number;
  aroused: boolean;
  usedLuck: boolean;
  injIgnored: boolean;
  lastRollText: string;
  fallenFloor?: number;
  fallenWave?: number;
  // Phase 3 Grit, Bonds, Stories & EPIC traits:
  grit?: number;
  maxGrit?: number;
  bondKey?: string;
  bondTargetSlot?: 1 | 2 | 3;
  storyKey?: string;
  epic?: boolean;
  epicKind?: 'grandmaster' | 'nemesis';
  epicLabel?: string;
  secondType?: string;
  noRetreat?: boolean;
  guarded?: boolean;
  nemesisId?: string;
  nemesisSignatures?: string[];
  adaptedTags?: string[];
  aura?: number;
}

export interface EvalScores {
  effect?: number;
  novelty?: number;
  fun?: number;
  aesthetic?: number;
  lewd?: number;
  overall?: 'S' | 'A' | 'B' | 'C' | 'D';
  bonusMp: number;
}

export interface RaidAuditRow {
  slot: 1 | 2 | 3;
  heroName: string;
  die: number;
  mods: number;
  total: number;
  dc: number;
  margin: number;
  deathMargin: number;
  beat: string;
  fearPenalty: number;
  statusAfter: HeroStatus;
}

export type RaidOutcome = 'pass' | 'fall' | 'wipe' | 'retreat' | 'partial' | 'breach';

export interface PrisonerMarks {
  obey: number;
  pleasure: number;
  terror: number;
  shame: number;
}

export interface PrisonerBreeding {
  lineage: string;
  dueWave: number;
  xp: number;
  trait?: string;
}

export interface Prisoner {
  pid: number;
  name: string;
  grade: HeroGrade;
  raceLabel: string;
  classLabel: string;
  traits: string[];
  capturedWave: number;
  capturedFloor: number;
  resist: number;
  corr: number;
  // Phase 2/3 extended prisoner state:
  gender: 'female' | 'male';
  stamina: number;
  staminaMax: number;
  pleasure: number;
  terror: number;
  shame: number;
  marks: PrisonerMarks;
  cond: HeroCondition;
  job: string | null;
  converted: PrisonerConversion | null;
  assignedFloor: number | null;
  owner: 'V' | 'L' | null;
  title?: string;
  customName?: string;
  dying?: boolean;
  legend?: boolean;
  afflictions: string[];
  dressed?: boolean;
  branded?: boolean;
  cow?: boolean;
  crest?: boolean;
  broken?: boolean;
  renamed?: boolean;
  virgin?: boolean;
  breeding: PrisonerBreeding | null;
  moleRaidsLeft?: number;
  intel?: number;
}

export interface ChronicleEntry {
  id: string;
  kind:
    | 'opening'
    | 'prep'
    | 'raid'
    | 'system'
    | 'chat_user'
    | 'chat_ai'
    | 'error'
    | 'day'
    | 'debt'
    | 'crisis'
    | 'exped'
    | 'ending';
  title: string;
  text: string;
  bannerUrl?: string;
  wave?: number;
  floor?: number;
  timestamp: number;
}

export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface GameSettings {
  genderPref: GenderPref;
  raceScope: RaceScope;
  gore: boolean;
  autoScrollChronicle: boolean;
  aiLanguage: AiLanguage;
  difficulty: DifficultyMode;
  skipDay: boolean;
  upkeepEnabled: boolean;
  realmConfig: RealmConfigMode;
  showPendingGrades: boolean;
  autoNarrateMajorCrises?: boolean;
}

export interface PrepMetadata {
  wave: number;
  newTrapIds: string[]; // e.g. ["1-1", "2-1"]
  comboFloors: number[];
  gradedSummary: string;
  heroesReady: boolean;
}

export interface SettlementSummary {
  wave: number;
  outcome: RaidOutcome;
  items: { label: string; delta: number }[];
  totalDelta: number;
  pointsAfter: number;
  fameBefore: number;
  fameAfter: number;
  momentumBefore: number;
  momentumAfter: number;
  guildLv: number;
  capturedCount: number;
  killedCount: number;
}

export interface DayLogLine {
  text: string;
  star?: boolean;
  kind?: string;
  art?: string;
}

export interface TownState {
  lv: number; // 1..7
  pop: number;
  approval: number;
  order: number;
  housing: number;
  food: number;
  renown: number;
  policy: TownPolicy;
  guard: number;
  famine: number;
  riot: number;
  lastTax: number;
}

export interface EstatePerks {
  apBonus?: number;
  capBonus?: number;
  rest2Day?: boolean;
  interroDay?: boolean;
  prisonDay?: boolean;
  ransomUpDay?: number;
  taxNext?: number;
  firstDcOnce?: boolean;
  allDcNext?: boolean;
  aceDowngradeNext?: boolean;
  newTrapUpNext?: boolean;
  trapUpgradeCut?: boolean;
  prepIntelOnce?: boolean;
  maxIntelBonus?: number;
}

export interface EstateState {
  facilities: Record<string, number>;
  landmarks: { hq?: boolean; lab?: boolean; cmd?: boolean };
  vaultMp: number;
  activeLocation: string | null;
  activeCrisis: string | null;
  crisisCooldowns: Record<string, number>;
  lastCrises: string[];
  perks: EstatePerks;
  casualGraceUsed: boolean;
  nobreachStreak: number;
  upkeepArrears: number;
  trailingIncome: number[];
  exploreCountToday: number;
}

export interface DebtQuest {
  id: string;
  desc: string;
  rewardMp: number;
  type: string;
  target?: number;
  progress?: number;
}

export interface DebtState {
  amount: number;
  extraLoan: number;
  startWave: number;
  dueWave: number;
  cycleCount: number;
  step: number;
  lates: number;
  patience: number;
  reliefUsed: number;
  extCarry: number;
  minCut: number;
  noInterest: boolean;
  forgiveUsed: boolean;
  paidThisVisit: number;
  entertainedThisVisit: boolean;
  activeQuest: DebtQuest | null;
  offeredQuests: DebtQuest[];
  ended: EndingKey | null;
}

export interface OfficerProgress {
  aff: number;
  stage: number;
  cooldowns: Record<string, number>;
  usedOnce: Record<string, boolean>;
}

export interface OfficersState {
  vesper: OfficerProgress;
  lilim: OfficerProgress;
  eleonora: OfficerProgress;
  waveAffGain: Record<OfficerKey, number>;
}

export interface MonsterInstance {
  id: string;
  lineage: string;
  stars: 1 | 2 | 3;
  xp: number;
  kills: number;
  fed: number;
  deployedFloor: number | null;
  injuredUntilWave: number | null;
  tiredUntilWave: number | null;
  variantOf?: string | null;
}

export interface MonsterEgg {
  id: string;
  lineage: string;
  hatchWave: number;
  xp: number;
  trait?: string;
  variantOf?: string | null;
}

export interface ExpeditionCrewMember {
  pid: number;
  name: string;
  grade: HeroGrade;
  stamina: number;
  ailments: string[];
  lost?: boolean;
}

export interface ExpeditionNodeChoice {
  idx: 1 | 2 | 3;
  region: string;
  ambush: number;
}

export interface ExpeditionState {
  active: boolean;
  lengthKey: ExpeditionLengthKey | null;
  day: number;
  maxDays: number;
  ap: number;
  depth: number;
  maxDepth: number;
  region: string;
  crew: ExpeditionCrewMember[];
  lootMp: number;
  lootFood: number;
  lootPop: number;
  lootParts: number;
  lootEggs: number;
  lootShards: number;
  lootIntel: number;
  gear: number;
  drill: number;
  notoriety: number;
  choices: ExpeditionNodeChoice[];
  activeEncounter: { key: string; diff: number } | null;
  activeEvent: string | null;
  arrivedVisited: boolean;
  clearedLengths: ExpeditionLengthKey[];
  afterEffects: { key: string; wavesLeft: number }[];
  log: string[];
}

export interface ActiveRealmSituation {
  key: string;
  wavesLeft: number;
  countered?: boolean;
  fromWave?: number;
  toWave?: number;
  floors?: number[];
  targetFloor?: number;
  revengePrisonerName?: string;
}

export interface GuildPrepState {
  lv: number;
  topTags: string[];
  sameSigStreak: number;
  lastSig: string;
  reason?: string;
}

export interface RealmState {
  active: ActiveRealmSituation[];
  cooldowns: Record<string, number>;
  gprep: GuildPrepState;
  floorSigs?: Record<number, { sig: string; sinceWave: number }>;
}

export interface NemesisRecord {
  id: string;
  name: string;
  grade: HeroGrade;
  classKey: string;
  raceKey: string;
  gender: 'female' | 'male';
  traits: string[];
  signatures: string[];
  adaptedTags: string[];
  escapedWave: number;
}

export interface CrisisShowcaseCard {
  kind: 'crusade' | 'nemesis' | 'siege' | 'jailbreak' | 'relic';
  title: string;
  subtitle: string;
  body: string;
  assetKey: string;
  wave: number;
  resolved?: boolean;
  won?: boolean;
}

export interface CrisesState {
  wrath: number;
  cleanKillStreak: number;
  crusade: { active: boolean; wavesLeft: number; cooldown: number };
  nemesis: NemesisRecord[];
  siege: { active: boolean; day: number; wins: number; losses: number; cooldown: number; lastLog?: string };
  jailbreakPending: boolean;
  activeRaidMods: { key: string; value: number }[];
  pendingGameOver: GameOverKey | null;
  lastNemesisWave?: number;
  lastNoBreachStreak?: number;
  lastCrisisCard?: CrisisShowcaseCard | null;
}

export interface WarRivalState {
  scouted: boolean;
  wins: number;
  annexed: boolean;
  def: number;
}

export interface WarState {
  rivals: Record<WarRivalKey, WarRivalState>;
}

export interface WondersState {
  spire: boolean;
  temple: boolean;
  gold: boolean;
}

export interface RelicsState {
  owned: RelicKey[];
  shards: number;
}

export interface EndingsState {
  unlocked: Partial<Record<EndingKey | `go_${GameOverKey}`, number>>;
  endless: boolean;
  activeEnding: EndingKey | null;
  gameOver: GameOverKey | null;
  titles: string[];
}

export interface RankTrialsState {
  active: boolean;
  rank: number;
  currentTrial: RankTrialKey | null;
  progress: number;
  target: number;
  nextCheckWave: number;
  trialStartWave?: number;
  baselineAnnexed?: number;
  consecutiveWipes?: number;
  trialCursor?: number;
}

export interface SaveSlotMetadata {
  slotId: SaveSlotId;
  slotName: string;
  wave: number;
  day: number;
  points: number;
  debt: number;
  mode: GameMode;
  savedAt: number;
}

export interface SaveSlotRecord {
  meta: SaveSlotMetadata;
  state: GameState;
}

export type WaveStartSnapshot = Omit<GameState, 'waveStartSnapshot'>;

export interface GameState {
  schemaVersion: 2;
  version: string;
  mode: GameMode;
  points: number;
  wave: number;
  day: number;
  ap: number;
  apMax: number;
  dayClosed: boolean;
  entApPenalty: number;
  apUsed: Record<string, boolean>;
  dayLines: DayLogLine[];
  apGrowth: { wipes: number; conv: number; quests: number };
  floorCursor: number; // 0..7
  selectedFloor: number; // 1..7
  kills: number;
  famePoints: number; // 0..100
  fame: number; // 0..10
  momentum: number; // -5..+5
  fear: number; // 0..100
  lust: number; // 0..100
  guildPoints: number;
  guildActive: boolean;
  floors: FloorState[];
  party: Hero[];
  prisoners: Prisoner[];
  nextPid: number;
  evalScores: EvalScores | null;
  prepMeta: PrepMetadata | null;
  awaitingNarration: boolean;
  raidFirstRoom: boolean;
  lastRaidDetail: string;
  lastOutcome: RaidOutcome | null;
  lastAudit: RaidAuditRow[];
  lastSettlement: SettlementSummary | null;
  flash: string;
  chronicle: ChronicleEntry[];
  recentHeroSignatures: { hair: string; persona: string }[];
  settings: GameSettings;
  // Phase 2 & 3 slices:
  town: TownState;
  estate: EstateState;
  debt: DebtState;
  officers: OfficersState;
  monsters: MonsterInstance[];
  eggs: MonsterEgg[];
  expedition: ExpeditionState;
  realm: RealmState;
  crises: CrisesState;
  war: WarState;
  wonders: WondersState;
  relics: RelicsState;
  endings: EndingsState;
  rankTrials: RankTrialsState;
  waveStartSnapshot: WaveStartSnapshot | null;
}
