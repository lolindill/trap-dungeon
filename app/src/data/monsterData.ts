export type MonsterRoleTag = 'phys' | 'bind' | 'mind' | 'fire' | 'ice' | 'water';
export type MonsterEvoCond = 'kills' | 'fed';

export interface MonsterLineageDef {
  key: string;
  icon: string;
  tier: 1 | 2 | 3;
  names: readonly [string, string, string];
  descriptions: readonly [string, string, string];
  roleTag: MonsterRoleTag;
  evoCond: MonsterEvoCond;
  prefTag: string | null;
  canBreedMale: boolean;
}

export interface FloorLinkRule {
  tagA: string;
  tagB: string;
  label: string;
  desc: string;
}

export const MONSTER_CFG = {
  XP_THRESHOLDS: [10, 25] as const,
  HATCH_WAVES: 1,
  CAP_BASE: 3,
  CAP_PER_PEN: 2,
  BREED_EGG_HEADROOM: 2,
  DIE_BASE: 0.1,
  DIE_PER_ALIVE_HERO: 0.05,
  DIE_PER_STAR: 0.05,
  DIE_MIN: 0.02,
  XP_KILL: 3,
  XP_CAPTURE: 2,
  XP_FEED_BASE: 4,
  XP_FEED_MAX: 10,
  EGG_WEIGHTS: [4, 2, 1] as const,
  EGG_RARE_MULT: [1, 2, 3] as const,
  FORCE_EVO: {
    XP_PCT: 0.8,
    MP_PER_STAR: 50,
    DIE_CHANCE: 0.15,
  },
  BREED: {
    MAX_PER_WAVE: 2,
    P_BASE: 0.5,
    P_PER_STAR: 0.1,
    RESIST_DIV: 400,
    P_MIN: 0.2,
    VARIANT_CHANCE: 0.15,
    MIN_PRISONER_STAMINA: 30,
  },
  OVERCROWD: {
    DIE_CHANCE: 0.2,
  },
  FSLOT: {
    MAX_PER_FLOOR: 2,
    DC_CAP: 3,
    FIGHTER_MIN_STAMINA: 40,
    FIGHTER_HIT: 10,
    FIGHTER_CLEAR_HIT: 10,
    BETRAY_RESIST_FROM: 60,
    BETRAY_DIV: 250,
    LAB_MAX_FLOORS: 2,
  },
  LINK: {
    MAX_ACTIVE: 3,
    FLOOR_CAP: 2,
    RAID_CAP: 3,
    DODGE_CHANCE: 0.35,
  },
  UPKEEP: {
    V: 0.008,
    TRAP: 30,
    FAC: 40,
    FLOOR: 20,
    PRI: 3,
    HIRE: 2,
    MOB: 2,
    FREE_TO: 5,
    HALF_TO: 10,
    CAP_RATIO: 0.25,
    MIN_CAP: 10,
    ARREAR_MAX: 3,
    DEFAULT_AVG_INCOME: 200,
  },
} as const;

/**
 * Exact combat narration behavior clauses from Lua X.OCC_ACT.
 */
export const MONSTER_OCC_ACT: Record<MonsterRoleTag, string> = {
  phys: 'lunges from hiding to maul and knock heroes into the traps',
  bind: 'grabs, coils around and pins heroes so the traps can work on them',
  mind: 'lures, whispers and bewitches heroes into the traps',
  fire: 'breathes fire to herd heroes into the traps',
  ice: "freezes the floor and the heroes' limbs",
  water: 'drags heroes under the water',
};

/**
 * All 28 monster lineages × 3 star forms = 84 unit forms (v1.12.2 + v1.14.1).
 */
export const MONSTER_LINEAGES: readonly MonsterLineageDef[] = [
  // Tier 1 (9)
  {
    key: 'beast',
    icon: '🐺',
    tier: 1,
    names: ['Dungeon Wolf', 'Shadow Wolf', 'Hellhound'],
    descriptions: [
      'a pack of dungeon wolves',
      'a pack of shadow wolves',
      'a hellhound wreathed in black fire',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'slime',
    icon: '🫧',
    tier: 1,
    names: ['Clinging Slime', 'Slime Colony', 'Slime Queen'],
    descriptions: [
      'a clinging slime',
      'a writhing slime colony',
      'the Slime Queen, a towering mass of living ooze',
    ],
    roleTag: 'bind',
    evoCond: 'fed',
    prefTag: 'bind',
    canBreedMale: false,
  },
  {
    key: 'tentacle',
    icon: '🐙',
    tier: 1,
    names: ['Grasping Tentacles', 'Tentacle Grove', 'Abyssal Tentacle'],
    descriptions: [
      'a nest of grasping tentacles',
      'a sprawling tentacle grove',
      'an abyssal tentacle horror',
    ],
    roleTag: 'bind',
    evoCond: 'fed',
    prefTag: 'bind',
    canBreedMale: false,
  },
  {
    key: 'mimic',
    icon: '📦',
    tier: 1,
    names: ['Mimic', 'Greater Mimic', 'Mimic King'],
    descriptions: [
      'a mimic disguised as a treasure chest',
      'a greater mimic lurking among the loot',
      'the Mimic King, a vault-sized maw of false treasure',
    ],
    roleTag: 'bind',
    evoCond: 'fed',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'plant',
    icon: '🌺',
    tier: 1,
    names: ['Mandrake', 'Alraune', 'Alraune Queen'],
    descriptions: [
      'a shrieking mandrake',
      'an adult alraune, a woman-shaped flower with clinging vines',
      'the Alraune Queen, an adult plant-woman crowned with a giant blossom',
    ],
    roleTag: 'bind',
    evoCond: 'fed',
    prefTag: 'bind',
    canBreedMale: true,
  },
  {
    key: 'orc',
    icon: '👹',
    tier: 1,
    names: ['Orc Warrior', 'Orc Berserker', 'Orc Warlord'],
    descriptions: [
      'an orc warrior',
      'a frenzied orc berserker',
      'an orc warlord in bone armour',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'lizard',
    icon: '🦎',
    tier: 1,
    names: ['Lizardman', 'Lizardman Warrior', 'Dragonewt'],
    descriptions: [
      'an adult lizardman with a spear',
      'a scaled adult lizardman warrior',
      'an adult dragonewt with wings and a greatsword',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'bug',
    icon: '🐝',
    tier: 1,
    names: ['Killer Bees', 'Soldier Bees', 'Queen Bee'],
    descriptions: [
      'a swarm of killer bees',
      'an army of soldier bees',
      'the Queen Bee, an adult insect-woman ruling her hive',
    ],
    roleTag: 'bind',
    evoCond: 'fed',
    prefTag: 'bind',
    canBreedMale: false,
  },
  {
    key: 'mush',
    icon: '🍄',
    tier: 1,
    names: ['Spore Mushroom', 'Mushroom-Folk', 'Mycelium Lord'],
    descriptions: [
      'a puffing spore mushroom',
      'a shambling mushroom-folk',
      'the Mycelium Lord spreading its threads',
    ],
    roleTag: 'mind',
    evoCond: 'fed',
    prefTag: 'mind',
    canBreedMale: false,
  },
  // Tier 2 (14)
  {
    key: 'golem',
    icon: '🗿',
    tier: 2,
    names: ['Clay Golem', 'Iron Golem', 'Mithril Golem'],
    descriptions: [
      'a lumbering clay golem',
      'an iron golem with rune-lit seams',
      'a gleaming mithril golem',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'harpy',
    icon: '🪶',
    tier: 2,
    names: ['Harpy', 'Harpy Huntress', 'Harpy Queen'],
    descriptions: [
      'an adult harpy with taloned feet',
      'an adult harpy huntress diving from the dark',
      'the Harpy Queen, an adult winged woman with storm-grey plumage',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: true,
  },
  {
    key: 'lamia',
    icon: '🐍',
    tier: 2,
    names: ['Lamia', 'Lamia Dancer', 'Lamia Queen'],
    descriptions: [
      "an adult lamia, a woman with a serpent's lower body",
      'an adult lamia dancer with a hypnotic sway',
      'the Lamia Queen, an adult serpent-woman with a jewelled crown',
    ],
    roleTag: 'mind',
    evoCond: 'fed',
    prefTag: 'mind',
    canBreedMale: true,
  },
  {
    key: 'spider',
    icon: '🕷',
    tier: 2,
    names: ['Giant Spider', 'Arachne', 'Arachne Queen'],
    descriptions: [
      'a giant cave spider',
      "an adult arachne, a woman with a spider's lower body",
      'the Arachne Queen, an adult spider-woman in a palace of silk',
    ],
    roleTag: 'bind',
    evoCond: 'fed',
    prefTag: 'bind',
    canBreedMale: true,
  },
  {
    key: 'minotaur',
    icon: '🐂',
    tier: 2,
    names: ['Minotaur', 'Minotaur Champion', 'Labyrinth King'],
    descriptions: [
      'an adult minotaur with a great axe',
      'an adult minotaur champion scarred from the arena',
      'the Labyrinth King, a colossal adult minotaur',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'chimera',
    icon: '🦁',
    tier: 2,
    names: ['Cockatrice', 'Basilisk', 'Chimera'],
    descriptions: [
      'a hissing cockatrice',
      'a basilisk with a petrifying gaze',
      'a three-headed chimera breathing fire',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'elemental',
    icon: '🔥',
    tier: 2,
    names: ["Will-o'-the-Wisp", 'Elemental Spirit', 'Elemental Lord'],
    descriptions: [
      "a flickering will-o'-the-wisp",
      'a raging elemental spirit',
      'an elemental lord of storm and flame',
    ],
    roleTag: 'mind',
    evoCond: 'kills',
    prefTag: 'fire',
    canBreedMale: false,
  },
  {
    key: 'were',
    icon: '🐺',
    tier: 2,
    names: ['Werewolf', 'Werewolf Warrior', 'Moon Lord'],
    descriptions: [
      'an adult werewolf',
      'an adult werewolf warrior',
      'the Moon Lord, a towering adult werewolf',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'fox',
    icon: '🦊',
    tier: 2,
    names: ['Fox-Fire', 'Fox Spirit', 'Nine-Tailed Fox'],
    descriptions: [
      'a flickering fox-fire',
      'a cunning fox spirit',
      'a nine-tailed fox, an adult fox-woman of great beauty',
    ],
    roleTag: 'mind',
    evoCond: 'fed',
    prefTag: 'mind',
    canBreedMale: true,
  },
  {
    key: 'oni',
    icon: '👹',
    tier: 2,
    names: ['Lesser Oni', 'Red Oni', 'Oni King'],
    descriptions: [
      'a horned lesser oni',
      'an adult red oni with an iron club',
      'the Oni King, a colossal adult oni',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'snow',
    icon: '❄',
    tier: 2,
    names: ['Snow Spirit', 'Snow Woman', 'Ice Queen'],
    descriptions: [
      'a drifting snow spirit',
      'an adult snow woman with a freezing breath',
      'the Ice Queen, an adult woman of living frost',
    ],
    roleTag: 'ice',
    evoCond: 'fed',
    prefTag: 'ice',
    canBreedMale: true,
  },
  {
    key: 'siren',
    icon: '🧜',
    tier: 2,
    names: ['Siren', 'Sea Diva', 'Abyssal Queen'],
    descriptions: [
      'an adult siren with a luring song',
      'an adult sea diva',
      'the Abyssal Queen, an adult mer-woman',
    ],
    roleTag: 'water',
    evoCond: 'fed',
    prefTag: 'water',
    canBreedMale: true,
  },
  {
    key: 'centaur',
    icon: '🐴',
    tier: 2,
    names: ['Centaur', 'Centaur Archer', 'Steppe King'],
    descriptions: [
      'an adult centaur',
      'an adult centaur horse-archer',
      'the Steppe King, an adult centaur chieftain',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'troll',
    icon: '🪨',
    tier: 2,
    names: ['Cave Troll', 'Stone Troll', 'Troll King'],
    descriptions: [
      'a cave troll',
      'a stone-hided troll',
      'the Troll King',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  // Tier 3 (5)
  {
    key: 'darkelf',
    icon: '🗡',
    tier: 3,
    names: ['Dark Elf Scout', 'Dark Elf Spellblade', 'Dark Elf High Priestess'],
    descriptions: [
      'an adult dark elf scout',
      'an adult dark elf spellblade',
      'an adult dark elf high priestess of the spider goddess',
    ],
    roleTag: 'mind',
    evoCond: 'kills',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'demon',
    icon: '😈',
    tier: 3,
    names: ['Imp', 'Temptation Demon', 'Demon Noble'],
    descriptions: [
      'a cackling imp',
      'an adult incubus-succubus demon of temptation',
      'a demon noble of the abyss',
    ],
    roleTag: 'mind',
    evoCond: 'fed',
    prefTag: 'mind',
    canBreedMale: true,
  },
  {
    key: 'vampire',
    icon: '🦇',
    tier: 3,
    names: ['Vampire Bats', 'Vampire', 'True Ancestor'],
    descriptions: [
      'a swarm of vampire bats',
      "an adult vampire in a noble's coat",
      'a True Ancestor, an ancient adult vampire lord',
    ],
    roleTag: 'mind',
    evoCond: 'fed',
    prefTag: null,
    canBreedMale: false,
  },
  {
    key: 'dragon',
    icon: '🐉',
    tier: 3,
    names: ['Drake', 'Wyvern', 'True Dragon'],
    descriptions: [
      'a fierce drake with ember-red scales',
      'a wyvern with a venomous tail',
      'a true dragon coiled atop its hoard',
    ],
    roleTag: 'phys',
    evoCond: 'kills',
    prefTag: 'fire',
    canBreedMale: false,
  },
  {
    key: 'mare',
    icon: '🌑',
    tier: 3,
    names: ['Shadow Steed', 'Nightmare', 'Dream-Demon Warhorse'],
    descriptions: [
      'a shadow steed',
      'a nightmare wreathed in dark flame',
      "the dream-demon's warhorse",
    ],
    roleTag: 'mind',
    evoCond: 'fed',
    prefTag: 'mind',
    canBreedMale: false,
  },
] as const;

export const MONSTER_LINEAGE_MAP: Record<string, MonsterLineageDef> = Object.fromEntries(
  MONSTER_LINEAGES.map((m) => [m.key, m])
);

/**
 * 12 Adjacent Floor Link pairs from Lua CFG.LINK.
 */
export const FLOOR_LINK_RULES: readonly FloorLinkRule[] = [
  { tagA: 'cloth', tagB: 'lewd', label: 'Exposed to Lust', desc: 'stripped bodies meet the lewd traps' },
  { tagA: 'bind', tagB: 'phys', label: 'Bound & Battered', desc: 'bound limbs take the blows' },
  { tagA: 'bind', tagB: 'lewd', label: 'Helpless Prey', desc: 'bound and helpless before the lewd traps' },
  { tagA: 'poison', tagB: 'mind', label: 'Venom Haze', desc: 'poison-dulled minds fall to the charms' },
  { tagA: 'mind', tagB: 'lewd', label: 'Charmed & Seduced', desc: 'charmed minds walk into the lewd traps' },
  { tagA: 'fire', tagB: 'cloth', label: 'Scorched Garments', desc: 'burned clothes tear away' },
  { tagA: 'phys', tagB: 'bind', label: 'Wounded & Snared', desc: 'wounded bodies are easier to bind' },
  { tagA: 'poison', tagB: 'bind', label: 'Numbed & Bound', desc: 'numbed bodies are easier to bind' },
  { tagA: 'lewd', tagB: 'bind', label: 'Aroused & Seized', desc: 'aroused bodies are seized' },
  { tagA: 'mind', tagB: 'bind', label: 'Dazed & Bound', desc: 'dazed minds are bound' },
  { tagA: 'fire', tagB: 'phys', label: 'Blaze Into Blades', desc: 'driven by flames into the blades' },
  { tagA: 'cloth', tagB: 'bind', label: 'Naked & Bound', desc: 'naked bodies are bound' },
] as const;

export function getMonsterLineage(key: string): MonsterLineageDef {
  return MONSTER_LINEAGE_MAP[key] ?? MONSTER_LINEAGE_MAP.orc ?? MONSTER_LINEAGES[0];
}

export function getMonsterDisplayName(m: {
  lineage: string;
  stars: 1 | 2 | 3;
  variantOf?: string | null;
}): string {
  const def = getMonsterLineage(m.lineage);
  const starIdx = Math.max(0, Math.min(2, m.stars - 1));
  const baseName = def.names[starIdx];
  const variantTag = m.variantOf
    ? ` [${getMonsterLineage(m.variantOf).names[0]} Blood]`
    : '';
  return `${def.icon} ${baseName}${variantTag} ★${m.stars}`;
}

export function getMonsterDescription(m: { lineage: string; stars: 1 | 2 | 3 }): string {
  const def = getMonsterLineage(m.lineage);
  const starIdx = Math.max(0, Math.min(2, m.stars - 1));
  return def.descriptions[starIdx];
}
