import type { HeroGrade, RollableHeroGrade, SynergyGrade, TrapGrade } from '../types/game';

export const CFG = {
  VERSION: '1.15.2-standalone',
  FLOORS: 7,
  SLOTS: 5,
  INSTALL_COST: [50, 120, 220, 360, 540] as const,
  PENDING: '?' as const,
  FALLBACK_GRADE: 'C' as TrapGrade,
  NEW_TRAP_MAX: 'S' as TrapGrade,
  TRAP_GRADES: ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as TrapGrade[],
  TRAP_BONUS: { D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6, SSS: 7 } as Record<TrapGrade, number>,
  NEXT_GRADE: {
    D: 'C',
    C: 'B',
    B: 'A',
    A: 'S',
    S: 'SS',
    SS: 'SSS',
  } as Partial<Record<TrapGrade, TrapGrade>>,
  UPGRADE_COST: {
    D: 80,
    C: 120,
    B: 180,
    A: 260,
    S: 400,
    SS: 600,
  } as Partial<Record<TrapGrade, number>>,
  SYNERGY_BONUS: { D: -1, C: 0, B: 1, A: 2, S: 3 } as Record<Exclude<SynergyGrade, '?' | '-'>, number>,
  GRADE_QUOTA: { S: 1, A: 2 },
  REFUND_RATE: 0.5,
  FLOOR_CAP: 20,
  DC_BASE: 6,
  HERO_GRADES: ['F', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as RollableHeroGrade[],
  HERO_BONUS: { F: -2, D: 0, C: 2, B: 4, A: 6, S: 9, SS: 12, SSS: 15, EPIC: 18 } as Record<HeroGrade, number>,
  HERO_REWARD: { F: 12, D: 20, C: 40, B: 70, A: 110, S: 160, SS: 220, SSS: 300, EPIC: 450 } as Record<HeroGrade, number>,
  HERO_PENALTY: { F: 20, D: 30, C: 50, B: 80, A: 120, S: 170, SS: 230, SSS: 300, EPIC: 450 } as Record<HeroGrade, number>,
  RANSOM: { F: 5, D: 14, C: 28, B: 49, A: 77, S: 112, SS: 154, SSS: 210, EPIC: 300 } as Record<HeroGrade, number>,
  BREACH_PLUNDER: 0.2,
  PARTIAL_PEN: 0.5,
  DEATH_MARGIN: 4,
  EASY_MARGIN: 8,
  CLEAN_MARGIN: 3,
  INJURY: { '': 0, injured: 2, severe: 4 } as Record<string, number>,
  AILMENT_PENALTY: 2,
  AILMENT_MARGIN: 5,
  AILMENT_CHANCE: 0.25,
  START_POINTS: 110,
  INCOME: 70,
  DEFENSE_BONUS: 60,
  EVAL_BONUS: { S: 80, A: 50, B: 20, C: 0, D: 0 } as Record<string, number>,
  TEAM: { 3: 1, 2: 0, 1: -2 } as Record<number, number>,
  RETREAT: { SOLO: 0.2, SOLO_INJ: 0.1, SOLO_SEV: 0.25, GROUP_SEV: 0.08, ELITE: -0.15, MAX: 0.9, BONUS: 20 },
  FAME: {
    MAX: 10,
    POINT_MAX: 100,
    S: 3,
    A: 4,
    SS_FROM: 4,
    SS: 3,
    SSS_FROM: 7,
    SSS: 2,
    HERO: { F: 1, D: 1, C: 1, B: 2, A: 2, S: 3, SS: 3, SSS: 4, EPIC: 5 } as Record<HeroGrade, number>,
    OUTCOME: { wipe: 8, retreat: 3, partial: -5, breach: -12 } as Record<string, number>,
  },
  MOMENTUM: {
    MAX: 5,
    STEP: 0.15,
    CAP: 0.6,
    DOUBLE: 4,
    OUTCOME: { wipe: 2, retreat: 1, partial: -1, breach: -2 } as Record<string, number>,
  },
  FEAR: {
    KILL: 2,
    WIPE: 3,
    PEN_STEP: 25,
    PEN_MAX: 2,
    ELITE: 1,
    RET: 0.0015,
    EXORCIST_FROM: 50,
  },
  LUST: {
    EVAL_FROM: 4,
    EVAL_MULT: 2,
    CAPTURE: 1,
    DEATH_STEP: 25,
    AROUSE_FROM: 30,
    AROUSE_DIV: 200,
    AROUSE_MARGIN: 4,
    LEWD_HEAVY: 50,
  },
  DECAY: 0.85,
  GUILD: {
    START: 25,
    WAVE: 5,
    OUT: { wipe: 12, retreat: 6, partial: -4, breach: -10 } as Record<string, number>,
    FLOOR_STEP: 5,
    FLOOR_MAX: 60,
    CAP: [
      [6, 50],
      [9, 70],
      [12, 85],
      [Infinity, 100],
    ] as const,
    EARLY_W: 3,
    EARLY_THREAT: -1,
    LATE_FROM: 13,
    LATE_STEP: 3,
    LATE_MAX: 5,
    THREAT_MAX: 12,
    THREAT: [0, 0, 1, 1, 2, 3, 3, 4, 5, 6, 7],
    GRADE: [
      { F: 30, D: 40, C: 25, B: 5 },
      { F: 15, D: 30, C: 40, B: 15 },
      { D: 25, C: 45, B: 25, A: 5 },
      { D: 15, C: 40, B: 35, A: 10 },
      { D: 10, C: 30, B: 40, A: 18, S: 2 },
      { D: 5, C: 25, B: 40, A: 25, S: 5 },
      { D: 5, C: 20, B: 38, A: 30, S: 7 },
      { C: 15, B: 35, A: 38, S: 12 },
      { C: 10, B: 30, A: 40, S: 16, SS: 4 },
      { C: 5, B: 22, A: 42, S: 22, SS: 7, SSS: 2 },
      { B: 17, A: 40, S: 27, SS: 10, SSS: 6 },
    ] as unknown as Record<HeroGrade, number>[],
    TIER: [
      { maxLv: 2, tag: 'SEASONED', desc: 'seasoned adventurers who have cleared a few dungeons' },
      { maxLv: 5, tag: 'VETERAN', desc: 'veteran adventurers the Guild trusts with hard contracts' },
      { maxLv: 8, tag: 'ELITE', desc: 'an elite Guild party sent specifically to crack this dungeon' },
      { maxLv: 10, tag: 'HUNTER SQUAD', desc: 'a Guild hunter squad — the best they have, sent to end this dungeon' },
    ],
  },
  PRISON_RESIST: { F: 25, D: 30, C: 40, B: 50, A: 60, S: 70, SS: 80, SSS: 90, EPIC: 100 } as Record<HeroGrade, number>,
  PRISON_CAP_INJ: { '': 0, injured: -10, severe: -20 } as Record<string, number>,
  NAME_MAXLEN: 200,
};

export interface ClassDef {
  key: string;
  labelF: string;
  labelM: string;
  biasTraits: string[];
  outfit: string;
}

export const CLASSES: ClassDef[] = [
  { key: 'warrior', labelF: 'warrior', labelM: 'warrior', biasTraits: ['brute', 'reckless'], outfit: 'battered plate and a greatsword' },
  { key: 'knight', labelF: 'knight', labelM: 'knight', biasTraits: ['leader', 'noble'], outfit: 'polished full plate and a house tabard' },
  { key: 'paladin', labelF: 'paladin', labelM: 'paladin', biasTraits: ['cleric', 'pure'], outfit: 'white-and-gold holy armor' },
  { key: 'priest', labelF: 'priestess', labelM: 'priest', biasTraits: ['healer', 'cleric'], outfit: 'long vestments and prayer beads' },
  { key: 'nun', labelF: 'nun', labelM: 'monk-friar', biasTraits: ['pure', 'ascetic'], outfit: 'habit, veil and rosary' },
  { key: 'mage', labelF: 'mage', labelM: 'mage', biasTraits: ['mage', 'cautious'], outfit: 'robes, a staff and a spell-belt' },
  { key: 'warlock', labelF: 'warlock', labelM: 'warlock', biasTraits: ['cursed', 'arrogant'], outfit: 'dark leathers and sigil tattoos' },
  { key: 'rogue', labelF: 'rogue', labelM: 'rogue', biasTraits: ['disarmer', 'greedy'], outfit: 'tight leathers bristling with knives' },
  { key: 'ranger', labelF: 'ranger', labelM: 'ranger', biasTraits: ['scout', 'nimble'], outfit: 'hooded cloak, bow and light mail' },
  { key: 'monk', labelF: 'martial artist', labelM: 'martial artist', biasTraits: ['stoic', 'tough'], outfit: 'hand wraps, loose trousers and a bare midriff' },
  { key: 'bard', labelF: 'bard', labelM: 'bard', biasTraits: ['cheerful', 'lucky'], outfit: 'flamboyant silks and a lute' },
  { key: 'alchemist', labelF: 'alchemist', labelM: 'alchemist', biasTraits: ['antidote', 'cautious'], outfit: 'apron, goggles and a potion bandolier' },
  { key: 'summoner', labelF: 'summoner', labelM: 'summoner', biasTraits: ['mage', 'tactician'], outfit: 'layered robes and a chained grimoire' },
  { key: 'exorcist', labelF: 'exorcist', labelM: 'exorcist', biasTraits: ['exorcist', 'vengeful'], outfit: 'long black coat and holy-water vials' },
  { key: 'samurai', labelF: 'swordswoman', labelM: 'swordsman', biasTraits: ['veteran', 'stoic'], outfit: 'lacquered armor and a katana' },
  { key: 'berserker', labelF: 'berserker', labelM: 'berserker', biasTraits: ['berserker', 'reckless'], outfit: 'furs, war paint and little else' },
  { key: 'hunter', labelF: 'bounty hunter', labelM: 'bounty hunter', biasTraits: ['scout', 'greedy'], outfit: 'duster coat, crossbow and a trophy belt' },
  { key: 'dancer', labelF: 'blade dancer', labelM: 'blade dancer', biasTraits: ['nimble', 'exhibitionist'], outfit: 'sheer silks and ankle bells' },
  { key: 'princess', labelF: 'princess knight', labelM: 'prince knight', biasTraits: ['noble', 'arrogant', 'rich'], outfit: 'ornate ceremonial armor and a circlet' },
  { key: 'miko', labelF: 'shrine maiden', labelM: 'shrine priest', biasTraits: ['pure', 'cleric'], outfit: 'red-and-white shrine robes and a gohei' },
  { key: 'artificer', labelF: 'artificer', labelM: 'artificer', biasTraits: ['disarmer', 'tactician'], outfit: 'goggles and a clockwork gauntlet' },
  { key: 'gunslinger', labelF: 'gunslinger', labelM: 'gunslinger', biasTraits: ['scout', 'reckless'], outfit: 'a long coat and twin flintlocks' },
  { key: 'ninja', labelF: 'kunoichi', labelM: 'ninja', biasTraits: ['nimble', 'disarmer'], outfit: 'shinobi garb and kunai' },
  { key: 'tamer', labelF: 'beast tamer', labelM: 'beast tamer', biasTraits: ['scout', 'cheerful'], outfit: 'leathers, a whip and a beast companion' },
  { key: 'spellblade', labelF: 'spellblade', labelM: 'spellblade', biasTraits: ['mage', 'veteran'], outfit: 'a rune-etched sword and half-plate' },
  { key: 'dragoon', labelF: 'dragoon', labelM: 'dragoon', biasTraits: ['reckless', 'leader'], outfit: 'a winged helm and a long lance' },
  { key: 'darkknight', labelF: 'dark knight', labelM: 'dark knight', biasTraits: ['cursed', 'tough'], outfit: 'black plate and a greatsword' },
  { key: 'valkyrie', labelF: 'valkyrie', labelM: 'einherjar', biasTraits: ['noble', 'leader'], outfit: 'a winged helm, spear and shield' },
  { key: 'inquisitor', labelF: 'inquisitor', labelM: 'inquisitor', biasTraits: ['exorcist', 'vengeful'], outfit: 'a red coat and a holy brand' },
  { key: 'pirate', labelF: 'pirate', labelM: 'pirate', biasTraits: ['greedy', 'reckless'], outfit: 'a tricorn hat and a cutlass' },
  { key: 'gladiator', labelF: 'gladiator', labelM: 'gladiator', biasTraits: ['brute', 'exhibitionist'], outfit: 'scant armor, a net and a trident' },
];

export interface TraitDef {
  key: string;
  weight: number;
  fearScale: number;
  lustScale: number;
  desc: string;
}

export const TRAITS: TraitDef[] = [
  { key: 'cautious', weight: 10, fearScale: 0, lustScale: 0, desc: 'careful; reads rooms first and is quick to call a retreat' },
  { key: 'reckless', weight: 8, fearScale: 0, lustScale: 0, desc: 'charges in headfirst; strong, dies easily, never backs down' },
  { key: 'coward', weight: 7, fearScale: 0, lustScale: 0, desc: 'jumpy and easily terrified; first to run' },
  { key: 'stoic', weight: 6, fearScale: 1, lustScale: 0, desc: 'unshakable; shrugs off fear and pain' },
  { key: 'arrogant', weight: 7, fearScale: 0, lustScale: 0, desc: 'underestimates the dungeon at first, then gets serious' },
  { key: 'scout', weight: 8, fearScale: 0, lustScale: 0, desc: 'expert at spotting the first trap' },
  { key: 'disarmer', weight: 7, fearScale: 0, lustScale: 0, desc: 'takes apart lone traps with ease' },
  { key: 'brute', weight: 8, fearScale: 0, lustScale: 0, desc: 'smashes crude traps, flounders against clever ones' },
  { key: 'nimble', weight: 8, fearScale: 0, lustScale: 0, desc: 'slips through close calls unhurt' },
  { key: 'ironhide', weight: 6, fearScale: 0, lustScale: 0, desc: 'shrugs off the first wound' },
  { key: 'mage', weight: 8, fearScale: 0, lustScale: 0, desc: 'sees through combined traps, dispels lingering effects' },
  { key: 'lucky', weight: 5, fearScale: 0, lustScale: 0, desc: 'absurd luck saves them from one disaster' },
  { key: 'leader', weight: 6, fearScale: 0, lustScale: 0, desc: 'rallies the party while standing' },
  { key: 'healer', weight: 6, fearScale: 0, lustScale: 0, desc: 'patches up the worst wound after each room' },
  { key: 'greedy', weight: 7, fearScale: 0, lustScale: 0, desc: 'pushes deeper for treasure, hates to retreat' },
  { key: 'cleric', weight: 4, fearScale: 1, lustScale: 0, desc: 'holy faith; immune to dread and steadies the party' },
  { key: 'exorcist', weight: 3, fearScale: 1, lustScale: 0, desc: 'demon hunter; dread only fuels them' },
  { key: 'ascetic', weight: 4, fearScale: 0, lustScale: 1, desc: 'iron self-control; immune to the lewd aura' },
  { key: 'lewd', weight: 5, fearScale: 0, lustScale: 0.5, desc: 'weak to pleasure; easily aroused and distracted' },
  { key: 'masochist', weight: 4, fearScale: 0, lustScale: 0, desc: 'pain only spurs them on' },
  { key: 'noble', weight: 5, fearScale: 0, lustScale: 0, desc: 'highborn and proud; worth a fortune as a captive' },
  { key: 'pure', weight: 4, fearScale: 0, lustScale: 0, desc: 'untouched and devout; hard to corrupt, priceless once fallen' },
  { key: 'tough', weight: 6, fearScale: 0, lustScale: 0, desc: 'tireless body; endures far more than most' },
  { key: 'tactician', weight: 5, fearScale: 0, lustScale: 0, desc: 'reads each room; from the second room on, the whole party fights smarter' },
  { key: 'berserker', weight: 5, fearScale: 0, lustScale: 0, desc: 'wounds only make them fiercer' },
  { key: 'antidote', weight: 5, fearScale: 0, lustScale: 0, desc: 'immune to poisons, afflictions and the lewd aura' },
  { key: 'exhibitionist', weight: 4, fearScale: 0, lustScale: 0.5, desc: 'secretly thrilled to be seen; distracted in lewd rooms' },
  { key: 'submissive', weight: 4, fearScale: 0, lustScale: 0.3, desc: 'a hidden urge to obey; would rather be caught than die' },
  { key: 'sadist', weight: 4, fearScale: 0, lustScale: 0, desc: 'enjoys cruelty; fights harder in the deadliest rooms' },
  { key: 'cheerful', weight: 5, fearScale: 0, lustScale: 0, desc: 'laughs off dread' },
  { key: 'vengeful', weight: 4, fearScale: 0, lustScale: 0, desc: 'came to free captured comrades' },
  { key: 'rich', weight: 4, fearScale: 0, lustScale: 0, desc: 'from a wealthy house; worth a fortune' },
  { key: 'cursed', weight: 4, fearScale: 0, lustScale: 0.3, desc: 'carries a lust curse that saps their focus' },
  { key: 'veteran', weight: 5, fearScale: 0, lustScale: 0, desc: 'hard to kill; knows when to yield' },
];

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.key, t]));

export interface RaceDef {
  key: string;
  label: string;
  tier: 1 | 2 | 3;
  cat: 'h' | 'f' | 'm'; // humanoid, fantasy, monster
  biasTraits: string[];
  feature: string;
  heightOffset: number;
  buildPref: string | null;
  skinGroup: string;
}

export const RACES: RaceDef[] = [
  { key: 'human', label: 'human', tier: 1, cat: 'h', biasTraits: [], feature: '', heightOffset: 0, buildPref: null, skinGroup: 'any' },
  { key: 'halfelf', label: 'half-elf', tier: 1, cat: 'h', biasTraits: ['nimble'], feature: 'slightly pointed ears', heightOffset: 0, buildPref: null, skinGroup: 'any' },
  { key: 'highelf', label: 'high elf', tier: 1, cat: 'h', biasTraits: ['mage', 'arrogant'], feature: 'long pointed ears', heightOffset: 1, buildPref: 'lithe', skinGroup: 'pale' },
  { key: 'woodelf', label: 'wood elf', tier: 1, cat: 'h', biasTraits: ['scout', 'nimble'], feature: 'long pointed ears and leaf ornaments', heightOffset: 0, buildPref: 'athletic', skinGroup: 'tan' },
  { key: 'dwarf', label: 'dwarf', tier: 1, cat: 'h', biasTraits: ['tough', 'antidote'], feature: 'braided hair and broad shoulders, short but sturdy and clearly adult', heightOffset: -1, buildPref: 'sturdy', skinGroup: 'any' },
  { key: 'catkin', label: 'cat-folk', tier: 1, cat: 'f', biasTraits: ['nimble', 'lucky'], feature: 'cat ears and a cat tail', heightOffset: 0, buildPref: 'lithe', skinGroup: 'any' },
  { key: 'wolfkin', label: 'wolf-folk', tier: 1, cat: 'f', biasTraits: ['scout', 'tough'], feature: 'wolf ears, a bushy tail and sharp canines', heightOffset: 1, buildPref: 'athletic', skinGroup: 'any' },
  { key: 'drow', label: 'drow', tier: 2, cat: 'f', biasTraits: ['cursed', 'cautious'], feature: 'long ears, white hair and red eyes', heightOffset: 0, buildPref: 'lithe', skinGroup: 'drow' },
  { key: 'halforc', label: 'half-orc', tier: 2, cat: 'f', biasTraits: ['brute', 'reckless'], feature: 'small tusks', heightOffset: 1, buildPref: 'muscular', skinGroup: 'orc' },
  { key: 'orc', label: 'orc', tier: 2, cat: 'f', biasTraits: ['brute', 'tough'], feature: 'prominent tusks', heightOffset: 2, buildPref: 'muscular', skinGroup: 'orc' },
  { key: 'tiefling', label: 'tiefling', tier: 2, cat: 'f', biasTraits: ['cursed', 'arrogant'], feature: 'curling horns and a thin tail', heightOffset: 0, buildPref: null, skinGroup: 'tiefling' },
  { key: 'foxkin', label: 'fox-folk', tier: 2, cat: 'f', biasTraits: ['lucky', 'cautious'], feature: 'fox ears and one to three fluffy tails', heightOffset: 0, buildPref: 'lithe', skinGroup: 'any' },
  { key: 'bunnykin', label: 'rabbit-folk', tier: 2, cat: 'f', biasTraits: ['nimble', 'cheerful'], feature: 'long rabbit ears and a cotton tail', heightOffset: 0, buildPref: 'curvy', skinGroup: 'any' },
  { key: 'dhampir', label: 'dhampir', tier: 2, cat: 'h', biasTraits: ['stoic', 'cursed'], feature: 'pale skin, red eyes and small fangs', heightOffset: 0, buildPref: 'lithe', skinGroup: 'pale' },
  { key: 'amazon', label: 'amazon', tier: 2, cat: 'h', biasTraits: ['brute', 'veteran'], feature: 'tribal tattoos', heightOffset: 2, buildPref: 'muscular', skinGroup: 'tan' },
  { key: 'aasimar', label: 'aasimar', tier: 3, cat: 'h', biasTraits: ['pure', 'cleric'], feature: 'softly glowing eyes and faint halo markings', heightOffset: 1, buildPref: null, skinGroup: 'pale' },
  { key: 'dragonkin', label: 'dragon-blooded', tier: 3, cat: 'f', biasTraits: ['tough', 'reckless'], feature: 'horns, patches of scales on cheeks and arms, and a tail', heightOffset: 2, buildPref: 'athletic', skinGroup: 'any' },
  { key: 'cowkin', label: 'cow-folk', tier: 3, cat: 'f', biasTraits: ['tough', 'lewd'], feature: 'small horns, cow ears and a tufted tail', heightOffset: 1, buildPref: 'voluptuous', skinGroup: 'any' },
  { key: 'cambion', label: 'cambion', tier: 3, cat: 'f', biasTraits: ['lewd', 'cursed'], feature: 'small bat wings and horn-like markings', heightOffset: 0, buildPref: null, skinGroup: 'tiefling' },
  { key: 'lamia', label: 'lamia', tier: 2, cat: 'm', biasTraits: ['cautious', 'lewd'], feature: 'a long snake tail from the waist down, scales', heightOffset: 1, buildPref: null, skinGroup: 'any' },
  { key: 'harpy', label: 'harpy', tier: 2, cat: 'm', biasTraits: ['scout', 'nimble'], feature: 'feathered wings instead of arms and bird legs', heightOffset: 0, buildPref: 'lithe', skinGroup: 'any' },
  { key: 'centaur', label: 'centaur', tier: 2, cat: 'm', biasTraits: ['scout', 'veteran'], feature: 'a horse body from the waist down', heightOffset: 2, buildPref: 'athletic', skinGroup: 'any' },
  { key: 'minotaur', label: 'minotaur', tier: 2, cat: 'm', biasTraits: ['brute', 'tough'], feature: 'great horns, bovine ears and hoofed legs', heightOffset: 2, buildPref: 'hulking', skinGroup: 'any' },
  { key: 'oni', label: 'oni', tier: 2, cat: 'm', biasTraits: ['brute', 'reckless'], feature: 'forehead horns', heightOffset: 2, buildPref: 'muscular', skinGroup: 'oni' },
  { key: 'lizardfolk', label: 'lizardfolk', tier: 2, cat: 'm', biasTraits: ['tough', 'antidote'], feature: 'scaled skin, a tail and reptilian eyes', heightOffset: 0, buildPref: 'athletic', skinGroup: 'scale' },
  { key: 'werewolf', label: 'werewolf', tier: 2, cat: 'm', biasTraits: ['berserker', 'scout'], feature: 'wolf ears and tail, furred limbs and claws', heightOffset: 2, buildPref: 'muscular', skinGroup: 'any' },
  { key: 'arachne', label: 'arachne', tier: 3, cat: 'm', biasTraits: ['disarmer', 'cautious'], feature: 'a spider body from the waist down and extra eyes', heightOffset: 1, buildPref: null, skinGroup: 'any' },
  { key: 'slime', label: 'slime-folk', tier: 3, cat: 'm', biasTraits: ['lewd', 'tough'], feature: 'a translucent, shape-shifting gel body', heightOffset: 0, buildPref: 'voluptuous', skinGroup: 'slime' },
  { key: 'alraune', label: 'alraune', tier: 3, cat: 'm', biasTraits: ['antidote', 'lewd'], feature: 'a lower body of petals and vines, flower-petal hair', heightOffset: 0, buildPref: 'lithe', skinGroup: 'plant' },
  { key: 'dragonfolk', label: 'dragonfolk', tier: 3, cat: 'm', biasTraits: ['tough', 'arrogant'], feature: 'great wings, horns, scaled limbs and a tail', heightOffset: 2, buildPref: null, skinGroup: 'scale' },
  { key: 'mermaid', label: 'merfolk', tier: 3, cat: 'm', biasTraits: ['nimble', 'lucky'], feature: 'fish tail in water, scale-flecked legs on land', heightOffset: 0, buildPref: 'lithe', skinGroup: 'sea' },
];

export const KINKS: { key: string; desc: string }[] = [
  { key: 'bondage', desc: 'being tied up and helpless' },
  { key: 'exhibition', desc: 'being exposed and watched' },
  { key: 'pain', desc: 'pain and rough handling' },
  { key: 'service', desc: 'serving and pleasing on command' },
  { key: 'tentacle', desc: 'tentacles and slimes' },
  { key: 'lactation', desc: 'being milked' },
  { key: 'drugs', desc: 'aphrodisiacs and drugged heat' },
  { key: 'public', desc: 'public use and humiliation' },
  { key: 'praise', desc: 'praise and gentle words' },
  { key: 'degradation', desc: 'degradation and name-calling' },
  { key: 'edging', desc: 'being edged and denied' },
  { key: 'toys', desc: 'toys and contraptions' },
  { key: 'group', desc: 'being shared by many' },
  { key: 'petplay', desc: 'collars, leashes and pet play' },
  { key: 'vampire', desc: 'being bitten and fed on' },
  { key: 'succubus', desc: "a succubus's draining touch" },
  { key: 'breeding', desc: 'being bred' },
  { key: 'uniform', desc: 'dress-up and uniforms' },
  { key: 'feet', desc: 'feet and worship of them' },
  { key: 'scent', desc: 'scent and musk' },
  { key: 'chastity', desc: 'chastity and denial' },
  { key: 'hypnosis', desc: 'hypnosis and mind games' },
  { key: 'rough', desc: 'being handled roughly' },
  { key: 'worship', desc: 'worshipping a master' },
];

export const LOOK = {
  AGE: [
    { label: 'early 20s', weight: 3 },
    { label: 'late 20s', weight: 4 },
    { label: '30s', weight: 3 },
    { label: '40s, seasoned', weight: 1 },
  ],
  HEIGHT: { '-1': 'on the short side', '0': 'average height', '1': 'tall', '2': 'very tall' } as Record<string, string>,
  BUILD_F: {
    lithe: 'lithe',
    slender: 'slender',
    athletic: 'athletic and toned',
    muscular: 'muscular',
    curvy: 'curvy',
    voluptuous: 'voluptuous',
    plump: 'soft and plump',
    sturdy: 'sturdy',
    hulking: 'towering and broad',
  } as Record<string, string>,
  BUILD_M: {
    lithe: 'lean',
    slender: 'wiry',
    athletic: 'athletic',
    muscular: 'muscular',
    curvy: 'stocky',
    voluptuous: 'hulking',
    plump: 'heavyset',
    sturdy: 'stocky',
    hulking: 'hulking',
  } as Record<string, string>,
  BUILDS: ['lithe', 'slender', 'athletic', 'muscular', 'curvy', 'voluptuous', 'plump'],
  BUST: [
    { label: 'small breasts', weight: 25, size: 'small' },
    { label: 'medium breasts', weight: 35, size: 'mid' },
    { label: 'large breasts', weight: 28, size: 'big' },
    { label: 'huge breasts', weight: 12, size: 'big' },
  ],
  HIPS: ['slim hips', 'average hips', 'wide hips', 'thick hips and a full rear'],
  BEARD: ['clean-shaven', 'stubble', 'a short beard', 'a thick beard'],
  SKIN: {
    any: ['pale', 'fair', 'olive', 'tan', 'brown', 'dark brown'],
    pale: ['pale', 'porcelain'],
    tan: ['sun-tanned', 'bronze'],
    drow: ['ash-grey', 'lilac-grey', 'dusky violet'],
    orc: ['grey-green', 'olive-green', 'moss-green'],
    tiefling: ['crimson', 'plum', 'lavender', 'ashen'],
    sea: ['sea-teal', 'pale aqua'],
    oni: ['red', 'blue', 'pale'],
    scale: ['emerald-scaled', 'bronze-scaled', 'onyx-scaled', 'ivory-scaled'],
    slime: ['translucent pink', 'translucent blue', 'translucent green'],
    plant: ['leaf-green', 'rose-tinted'],
  } as Record<string, string[]>,
  HAIR_C: ['black', 'dark brown', 'chestnut', 'honey blonde', 'platinum blonde', 'silver', 'white', 'crimson', 'copper', 'pink', 'lavender', 'navy', 'teal', 'emerald', 'two-tone', 'ombre'],
  HAIR_F: ['a short bob', 'a pixie cut', 'a high ponytail', 'twin tails', 'a long braid', 'hime-cut straight hair', 'long wavy hair', 'an elegant updo', 'side-swept bangs', 'messy shoulder-length hair', 'long straight hair to the waist', 'twin buns', 'a side ponytail', 'drill curls'],
  HAIR_M: ['a buzz cut', 'short messy hair', 'a slicked-back cut', 'a long ponytail', 'shoulder-length hair', 'a topknot', 'a shaved undercut', 'wavy hair', 'braided hair', 'a wild mane'],
  EYES: ['amber', 'emerald', 'sapphire', 'violet', 'crimson', 'gold', 'grey', 'hazel', 'ice-blue', 'black', 'rose', 'teal'],
  MARK: ['a scar across the cheek', 'freckles', 'a tribal tattoo', 'ear piercings', 'a beauty mark', 'round glasses', 'an eyepatch', 'an old burn scar', 'tan lines', 'defined muscle lines', 'a sweet perfume', 'a signature pendant', 'a navel piercing', 'a brand of their order'],
  PERSONA: [
    'tsundere', 'kuudere, cool and aloof', 'shy and quiet', 'airheaded and naive', 'hot-blooded', 'righteous and dutiful',
    'cynical mercenary', 'zealous believer', 'bookish and timid', 'flirtatious', 'reckless gambler', 'battle maniac',
    'taciturn veteran', 'naive rookie', 'haughty noble', 'caring big-sister/brother type', 'mischievous prankster',
    'melancholic', 'boastful show-off', 'calculating', 'gentle and nurturing', 'vengeance-driven', 'cowardly braggart', 'free-spirited',
  ],
  PERSONA_BAN: {
    coward: ['battle maniac', 'hot-blooded'],
    stoic: ['hot-blooded', 'mischievous prankster'],
    reckless: ['calculating', 'bookish and timid'],
    cautious: ['reckless gambler', 'battle maniac'],
    arrogant: ['shy and quiet', 'bookish and timid'],
    pure: ['flirtatious'],
    cheerful: ['melancholic'],
  } as Record<string, string[]>,
  ORIGIN: [
    'fallen noble house', 'temple orphan', 'mercenary company', 'top of the magic academy', 'exiled royal',
    'village hero', 'former thief', 'fresh guild recruit', 'pilgrim from a far land', 'paying off a debt',
    'sworn to revenge', 'searching for a lost fiancé(e)', 'legend collector', 'former slave', 'deserter from a knightly order', 'noble in disguise',
  ],
};

export interface BeatDef {
  outcomeLabel: string;
  how: { text: string; cond?: 'c' | 't' | 's' }[];
}

export const BEATS: Record<string, BeatDef> = {
  luck: {
    outcomeLabel: 'PASSED by sheer luck on a natural 20',
    how: [
      { text: 'the trap misfires or its timing breaks their way' },
      { text: 'trips at exactly the wrong moment, which turns out to be the right one' },
      { text: 'the gimmick hesitates on them for no reason anyone can explain' },
    ],
  },
  easy: {
    outcomeLabel: 'PASSED with ease',
    how: [
      { text: 'turns the gimmick against itself' },
      { text: 'plays along with the gimmick flawlessly, as if it were a game' },
      { text: 'breaks or disarms the mechanism outright' },
      { text: 'counters it with their Skill without breaking a sweat' },
      { text: 'makes a show of it, mocking the trap as they pass' },
      { text: 'solves it before the room has finished springing' },
      { text: 'uses one trap of the room to jam the other', cond: 'c' },
      { text: 'lets a teammate go first, then copies the safe route', cond: 't' },
    ],
  },
  clean: {
    outcomeLabel: 'PASSED',
    how: [
      { text: 'reads the mechanism and works through it step by step' },
      { text: "follows the gimmick's rule correctly after a moment's thought" },
      { text: 'uses their Skill to get past' },
      { text: 'dodges or outmaneuvers it' },
      { text: 'spots a flaw in the design and slips through' },
      { text: 'notices one small detail, and it saves them' },
      { text: 'takes it slow and careful, inch by inch' },
      { text: 'covers a teammate while getting through', cond: 't' },
      { text: 'pushes through alone with grim focus', cond: 's' },
    ],
  },
  narrow: {
    outcomeLabel: 'PASSED by a hair',
    how: [
      { text: 'partly sets it off and scrapes through' },
      { text: 'fumbles the gimmick but recovers at the last moment' },
      { text: 'pays a small, embarrassing price (torn gear, a lost item) but makes it' },
      { text: 'is caught, stuck or exposed for a humiliating moment before tearing free' },
      { text: 'survives only by sacrificing something they cared about' },
      { text: 'gets through only thanks to a teammate', cond: 't' },
      { text: 'dodges one trap straight into the other, then barely escapes', cond: 'c' },
      { text: 'has no one to help and claws through on their own', cond: 's' },
    ],
  },
  captured: {
    outcomeLabel: 'CAPTURED',
    how: [
      { text: 'fails the gimmick and ends up trapped or pinned' },
      { text: 'their Weakness gives the trap an opening' },
      { text: 'is pinned in a shameful position and cannot break free' },
      { text: 'the gimmick drains their strength until they collapse' },
      { text: 'panics, makes it worse, and ends up bound' },
      { text: 'one trap sets them up for the other', cond: 'c' },
      { text: 'gets caught while saving a teammate', cond: 't' },
      { text: 'has no one left to pull them out', cond: 's' },
    ],
  },
  dead: {
    outcomeLabel: 'KILLED',
    how: [
      { text: "the room's full force falls on them" },
      { text: 'their Weakness proves fatal' },
      { text: "the gimmick's worst outcome plays out" },
      { text: 'a small mistake early on snowballs into a gruesome end' },
      { text: 'fights the gimmick head-on and loses' },
      { text: "the room's last surprise catches them off guard" },
      { text: 'the combination closes on them from both sides', cond: 'c' },
      { text: 'is left behind by the others and the room finishes the job', cond: 't' },
    ],
  },
  blunder: {
    outcomeLabel: 'CAPTURED after a natural 1',
    how: [
      { text: 'an absurd blunder of their own making' },
      { text: 'trips over their own feet straight into the worst spot' },
      { text: 'insists they know the answer — and is completely wrong' },
      { text: 'gets distracted by something stupid at the worst moment' },
    ],
  },
};

export const TRAP_TYPES = [
  'lewd',
  'fire',
  'poison',
  'mind',
  'bind',
  'phys',
  'cloth',
  'ice',
  'elec',
  'water',
  'pit',
  'parasite',
  'mutate',
  'curse',
] as const;

export const OPENING_TEXT = `Blue mana pulses through a seven-floor labyrinth. Deep below, a Dungeon Core beats like a slow heart, waiting for its new master.

Above ground, word of a newly awakened labyrinth is already spreading toward the Hero Guild. Beside the Control Room's scrying crystals, Lilim flips open a fresh ledger with a wicked grin while Vesper adjusts her cuffs and checks the Core's mana reserves.

Use **Build** to install traps on your floors—or craft and save reusable **Trap Shortcuts** in your Blueprint Library for instant deployment!`;
