import type { RoomBlueprintSlot, TrapBlueprint } from '../types/game';

export interface CodexTrapEntry {
  id: string;
  category: 'ero' | 'standard';
  subcategory: string;
  name: string;
  detail: string;
  counters: string;
  grade: 'D' | 'C' | 'B';
  types: string[];
  comboIds: string[];
}

export interface CodexComboEntry {
  id: string;
  comboCategory: 'ero' | 'standard' | 'mixed';
  category: 'ero' | 'standard';
  name: string;
  detail: string;
  roomSynergy: 'B' | 'A';
  memberIds: string[];
  memberNames: string[];
  roomSlots: RoomBlueprintSlot[];
  types: string[];
}

export const CODEX_SUBCATEGORIES = {
  ero: [
  "Tentacles & Bio",
  "Slime & Liquid",
  "Machines & Devices",
  "Bondage & Restraints",
  "Clothing & Gear",
  "Drugs, Gas & Body",
  "Magic, Curses & Sigils",
  "Sensory & Pleasure",
  "Mind & Brainwashing",
  "Mimicry & Disguise",
  "Shame & Exposure",
  "Transformation & Warp",
  "Games & Condition Rooms"
],
  standard: [
  "Physical & Impact",
  "Pitfalls & Drops",
  "Piercing & Blades",
  "Fire & Explosion",
  "Frost, Water & Flood",
  "Poison, Gas & Blight",
  "Lightning & Shock",
  "Runes & Curses",
  "Illusion & Mind",
  "Space & Displacement",
  "Puzzles & Trials",
  "Split & Isolation",
  "Summons & Swarms",
  "Attrition & Gear Ruin",
  "Alarms & Escalation"
],
} as const;

export const CODEX_TRAPS: CodexTrapEntry[] = [
  {
    "id": "E001",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Tentacle Floor",
    "detail": "Tentacles erupt from flagstone cracks to coil around limbs and drain stamina each turn.",
    "counters": "Slashing/fire, Strength check, ally cuts free",
    "grade": "C",
    "types": [
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E002",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Blind-Spot Tentacles",
    "detail": "Tentacles concealed in ceiling corners ambush and snatch the rear guard from behind.",
    "counters": "Rear watch, scout detection",
    "grade": "C",
    "types": [
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E003",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Tentacle Pit",
    "detail": "A covered pit concealing a tentacle nest that binds anyone who falls in until hauled out.",
    "counters": "Trap detection, rope/levitation, drop a torch",
    "grade": "C",
    "types": [
      "lewd",
      "bind",
      "pit"
    ],
    "comboIds": [
      "TPC18"
    ]
  },
  {
    "id": "E004",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Tentacle Hot Spring",
    "detail": "Disguised as a steaming healing spring; stepping in lets submerged tentacles coil tight.",
    "counters": "Appraise, toss a stone first, stay out",
    "grade": "C",
    "types": [
      "lewd",
      "water",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E005",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Groping Corridor",
    "detail": "Hands and tentacles reach out from narrow walls to grope passersby and strip gear piece by piece.",
    "counters": "Full sprint, holy water, shield the walls",
    "grade": "C",
    "types": [
      "lewd",
      "cloth"
    ],
    "comboIds": [
      "TPC24"
    ]
  },
  {
    "id": "E006",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Parasitic Tentacles",
    "detail": "Finger-sized tentacles latch onto the body, raising sensitivity; too many immobilize you.",
    "counters": "Rip off immediately, purification items",
    "grade": "B",
    "types": [
      "lewd",
      "parasite",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E007",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Mutagenic Parasite Flower",
    "detail": "Inhaled pollen blooms flowers on the body whose sweet scent lures the next party in.",
    "counters": "Cover mouth, antidote, burn away",
    "grade": "B",
    "types": [
      "parasite",
      "mutate",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E008",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Drain Alraune",
    "detail": "A giant blossom's plant maiden reels victims in with vines to siphon vitality and essence.",
    "counters": "Fire, herbicide, ranged attacks",
    "grade": "B",
    "types": [
      "lewd",
      "bind",
      "parasite"
    ],
    "comboIds": []
  },
  {
    "id": "E009",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Vine Snare",
    "detail": "A vine loop catches the ankle and hoists the victim upside down in midair.",
    "counters": "Blade, fire",
    "grade": "D",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E010",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Spawning Broodbed",
    "detail": "Implants eggs into captives to breed dungeon monsters unless rescued quickly.",
    "counters": "Early rescue, purification tonic",
    "grade": "B",
    "types": [
      "parasite",
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E011",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Essence Leeches",
    "detail": "Pool leeches cling to bare skin, draining mana while leaving a strange, lingering heat.",
    "counters": "Salt, fire, pull off immediately",
    "grade": "D",
    "types": [
      "parasite",
      "water",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E012",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Aphrodisiac Spore Mushrooms",
    "detail": "Stepping on or slashing these caps bursts pink spores that inflict heat on everyone nearby.",
    "counters": "Mask, hold breath, wind magic",
    "grade": "C",
    "types": [
      "lewd",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "E013",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Predatory Pitcher Pod",
    "detail": "A giant carnivorous plant swallows victims whole into sweet nectar that slowly dissolves gear.",
    "counters": "Cut open from outside, fire, dagger inside",
    "grade": "B",
    "types": [
      "cloth",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E014",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Parasitic Lust-Worm",
    "detail": "Lies dormant inside the body until combat begins, detonating arousal and mind control.",
    "counters": "Dewormer, cleric purification",
    "grade": "B",
    "types": [
      "parasite",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E015",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Spider Silk Cocoon",
    "detail": "Wrapped tight in arachne silk; left too long, the webbing replaces torn clothing.",
    "counters": "Fire, blades, ally rescue",
    "grade": "C",
    "types": [
      "bind",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E016",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Goblin Ambush Nest",
    "detail": "Goblins hiding in the dark drag downed adventurers off into their den.",
    "counters": "Light, fire, stealth",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E017",
    "category": "ero",
    "subcategory": "Tentacles & Bio",
    "name": "Succubus Boudoir",
    "detail": "A lavish bedchamber where a resident succubus drains willpower and experience from entrants.",
    "counters": "Holy talisman, willpower",
    "grade": "B",
    "types": [
      "lewd",
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E018",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Cloth-Dissolving Slime",
    "detail": "Dissolves only cloth and leather without harming skin, slashing defense while raising shame.",
    "counters": "Metal armor, fire/frost, strike the core",
    "grade": "C",
    "types": [
      "cloth",
      "lewd"
    ],
    "comboIds": [
      "TPC16"
    ]
  },
  {
    "id": "E019",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Giant Slime Engulf",
    "detail": "Swallows a target whole and teases them inside until the suspended core is shattered.",
    "counters": "Direct core hit, shock, ally pulls out",
    "grade": "B",
    "types": [
      "lewd",
      "bind",
      "water"
    ],
    "comboIds": []
  },
  {
    "id": "E020",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Ceiling Drop Slime",
    "detail": "Drops onto the head to blind vision while enveloping the upper body.",
    "counters": "Check ceilings, torchlight",
    "grade": "D",
    "types": [
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E021",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Aphrodisiac Bog",
    "detail": "Waist-deep pink mire that slows movement and builds arousal with every wading step.",
    "counters": "Levitation, high boots, detour",
    "grade": "C",
    "types": [
      "lewd",
      "water",
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "E022",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Lotion Ramp",
    "detail": "A frictionless gel slope sends anyone who slips sliding straight into the next trap.",
    "counters": "Spiked boots, crawl, scatter sand",
    "grade": "C",
    "types": [
      "lewd",
      "pit"
    ],
    "comboIds": [
      "TPC18"
    ]
  },
  {
    "id": "E023",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Adhesive Gel Floor",
    "detail": "Traps footsteps on contact; struggling only spreads the sticky residue further.",
    "counters": "Solvent/oil, slip off boots, hold still",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC27"
    ]
  },
  {
    "id": "E024",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Dissolving Sprinkler",
    "detail": "Overhead nozzles drench the entire party in garment-melting slime at once.",
    "counters": "Shield/cloak cover, evade range",
    "grade": "B",
    "types": [
      "cloth",
      "water",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E025",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Slime Bodysuit",
    "detail": "Living slime coats the body like a second skin—boosting armor while pulsing with stimulation.",
    "counters": "Lightning, dry magic, dispel",
    "grade": "B",
    "types": [
      "lewd",
      "cloth",
      "mutate"
    ],
    "comboIds": []
  },
  {
    "id": "E026",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Mucus Storage Cocoon",
    "detail": "Seals fallen intruders inside a translucent slime cocoon for later retrieval.",
    "counters": "Ally slices open, rescue before timer",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E027",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "False Healing Spring",
    "detail": "A rosy spring that restores HP while quietly flooding the drinker with heat.",
    "counters": "Appraise, carry spare water",
    "grade": "D",
    "types": [
      "lewd",
      "water"
    ],
    "comboIds": []
  },
  {
    "id": "E028",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Translucent Mist Spray",
    "detail": "Turns outfits crystal-clear without ruining stats, leaving defense intact and dignity gone.",
    "counters": "Cloak, dye, mental resolve",
    "grade": "D",
    "types": [
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E029",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Potion Mimic Slime",
    "detail": "A healing vial in a chest that is actually a slime, seizing the drinker inside and out.",
    "counters": "Appraise, sniff test",
    "grade": "C",
    "types": [
      "lewd",
      "parasite"
    ],
    "comboIds": []
  },
  {
    "id": "E030",
    "category": "ero",
    "subcategory": "Slime & Liquid",
    "name": "Intoxicating Spring",
    "detail": "Crystal-clear spring water laced with potent spirits that dulls judgment for the next room.",
    "counters": "Appraise, one person taste-tests",
    "grade": "D",
    "types": [
      "poison",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E031",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Tickle Brush Waterwheel",
    "detail": "A spinning bristle wheel blocks the passage, tickling anyone passing through at rising speed.",
    "counters": "Jam gears, break axle, dash past",
    "grade": "C",
    "types": [
      "lewd",
      "phys",
      "bind"
    ],
    "comboIds": [
      "TPC19"
    ]
  },
  {
    "id": "E032",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Vibrating Stocks",
    "detail": "Locks limbs in place and vibrates nonstop, chipping away willpower every turn.",
    "counters": "Smash restraints, cut power source",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC20"
    ]
  },
  {
    "id": "E033",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Arcane Groping Hands",
    "detail": "Floating spectral hands caress intruders to break concentration and interrupt spellcasting.",
    "counters": "Dispel, shatter control crystal",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E034",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Wall Aperture Rig",
    "detail": "Hidden wall ports extend mechanical rigs whenever someone walks too close.",
    "counters": "Plug ports, walk away from walls",
    "grade": "D",
    "types": [
      "lewd",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "E035",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Rhythm Piston Machine",
    "detail": "An automated piston rig works relentlessly on bound captives at a steady mechanical tempo.",
    "counters": "Smash rig, cut power, outlast timer",
    "grade": "B",
    "types": [
      "bind",
      "lewd",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "E036",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Climax Pedal Cycle",
    "detail": "A locked door opens only by pedaling a stationary cycle whose saddle stimulates on every stroke.",
    "counters": "Ally pedals instead, smash lock",
    "grade": "C",
    "types": [
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E037",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Mana Milking Rig",
    "detail": "Suction cups latch on to extract milk and vital essence, converting it into dungeon MP.",
    "counters": "Cut hoses, sealing charm",
    "grade": "B",
    "types": [
      "lewd",
      "bind",
      "mutate"
    ],
    "comboIds": [
      "TPC17"
    ]
  },
  {
    "id": "E038",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Wooden Horse Frame",
    "detail": "Forces captives astride a sharp-edged frame weighted at the ankles for steady torment.",
    "counters": "Ally lifts off, cut chains",
    "grade": "B",
    "types": [
      "bind",
      "phys",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E039",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Warden Golem Clamp",
    "detail": "A patrol golem grapples intruders into a wall frame to administer automated punishment.",
    "counters": "Stealth, stun with lightning",
    "grade": "B",
    "types": [
      "bind",
      "phys",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E040",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Pink Ray Turret",
    "detail": "Wall turrets fire pulsing pink beams that stack arousal on anyone caught in the open.",
    "counters": "Take cover, reflect, destroy turret",
    "grade": "C",
    "types": [
      "lewd",
      "elec"
    ],
    "comboIds": []
  },
  {
    "id": "E041",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Vibrating Rest Bench",
    "detail": "Disguised as a safe rest bench; sitting down triggers hidden vibrators that deny recovery.",
    "counters": "Inspect before sitting",
    "grade": "D",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E042",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Suction Array",
    "detail": "Pressurized suction cups latch onto skin to spike sensitivity and pin movement.",
    "counters": "Break seal, blade",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E043",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Incubation Vat",
    "detail": "Submerges captives in a fluid tank that slowly reshapes them, triggering a rescue quest.",
    "counters": "Shatter glass, drain tank",
    "grade": "B",
    "types": [
      "mutate",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E044",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Brainwash Helmet",
    "detail": "Clamps onto the head and steadily builds obedience stacks until removed.",
    "counters": "Pull off quickly, Will check",
    "grade": "B",
    "types": [
      "mind",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E045",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Illusion Visor Rig",
    "detail": "Straps onto the head to trap the wearer inside vivid fabricated scenarios.",
    "counters": "See through with Int, ally unplugs",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E046",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Low-Frequency Pulse",
    "detail": "Delivers tingling micro-currents that both stimulate and paralyze muscles.",
    "counters": "Insulated gear, grounding",
    "grade": "C",
    "types": [
      "elec",
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E047",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Auto-Stripper Arm",
    "detail": "Mechanical arms strip armor piece by piece and lock it inside a keyed locker.",
    "counters": "Destroy arms, gear-lock spell, spares",
    "grade": "B",
    "types": [
      "cloth",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E048",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Tickle Torture Frame",
    "detail": "Pins hands and feet while feather arms tickle relentlessly, making spellcasting impossible.",
    "counters": "Break with Str, ally rescue, numb magic",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E049",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Chain-Reaction Vibro Tiles",
    "detail": "Standing still intensifies vibration; stepping away activates adjacent tiles in a chain.",
    "counters": "Levitation, leap across gaps",
    "grade": "C",
    "types": [
      "lewd",
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "E050",
    "category": "ero",
    "subcategory": "Machines & Devices",
    "name": "Restraint Canopy Bed",
    "detail": "Looks like a plush rest bed; lying down snaps cuffs shut and starts hidden mechanisms.",
    "counters": "Check bed, keep watch, lockpick",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E051",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Narrow Wall Wedging",
    "detail": "Fleeing a gas-filled room through a tight crawlspace leaves the victim stuck waist-deep between rooms.",
    "counters": "Oil/grease, smash wall, ally pulls",
    "grade": "B",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC15"
    ]
  },
  {
    "id": "E052",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Public Hall Pillory",
    "detail": "Locks neck and wrists in the center of the hall where passing monsters freely tease the captive.",
    "counters": "Pick lock, defeat key-bearing monster",
    "grade": "B",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC16"
    ]
  },
  {
    "id": "E053",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "X-Frame Restraint",
    "detail": "Spreads and locks all four limbs to an X-frame, priming the victim for follow-up devices.",
    "counters": "Lockpicking, Strength check",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC21"
    ]
  },
  {
    "id": "E054",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Inverted Ankle Snare",
    "detail": "Dangles victims upside down by the ankles, spilling gear and flipping skirts.",
    "counters": "Cut rope, Acrobatics check",
    "grade": "D",
    "types": [
      "bind",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E055",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Folded-Bind Rig",
    "detail": "Folds and locks the body in half, reducing evasion to zero.",
    "counters": "Ally rescue",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E056",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Balance Stance Trial",
    "detail": "Forces a one-legged pose; losing balance triggers the punishment rig below.",
    "counters": "Balance/Agility check",
    "grade": "D",
    "types": [
      "bind",
      "phys",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E057",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Cursed Tether Collar",
    "detail": "Chains a collar to a pillar; stepping past the leash limit yanks the wearer back.",
    "counters": "Dispel, unlock spell",
    "grade": "C",
    "types": [
      "curse",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E058",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Ball-and-Chain Shackles",
    "detail": "Heavy iron shackles slow movement to a crawl and prevent fleeing.",
    "counters": "Key, Strength drag",
    "grade": "D",
    "types": [
      "bind",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "E059",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Vacuum Latex Seal",
    "detail": "Seals the body inside airtight rubber, immobilizing limbs while dulling outer senses.",
    "counters": "Puncture film, secure airway",
    "grade": "B",
    "types": [
      "bind",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E060",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Dungeon Cell Chute",
    "detail": "A trapdoor pit dropping straight into the prison cells, capturing anyone who falls.",
    "counters": "Detect, rope, levitation",
    "grade": "B",
    "types": [
      "pit",
      "bind"
    ],
    "comboIds": [
      "TPC28"
    ]
  },
  {
    "id": "E061",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Sensory-Cutoff Pit",
    "detail": "Waist-deep trap hole that numbs the lower half while stacking stimuli to burst upon escape.",
    "counters": "Dispel before climb, escape early",
    "grade": "B",
    "types": [
      "pit",
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC29"
    ]
  },
  {
    "id": "E062",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Linked Pair Cuffs",
    "detail": "Handcuffs two adventurers together; when one trips a trap, both get dragged along.",
    "counters": "Break cuffs, move in sync",
    "grade": "C",
    "types": [
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E063",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Crystal Display Seal",
    "detail": "Encases victims awake inside clear crystal; shattering it unleashes all stored sensation.",
    "counters": "Dispel, solvent tonic",
    "grade": "B",
    "types": [
      "curse",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E064",
    "category": "ero",
    "subcategory": "Bondage & Restraints",
    "name": "Sticky Web Net",
    "detail": "Drops an adhesive net from the ceiling to pin targets on the spot.",
    "counters": "Blade/fire, Agility check",
    "grade": "D",
    "types": [
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E065",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Armor-Shredding Zone",
    "detail": "Within this zone, each hit tears away clothing proportional to HP lost.",
    "counters": "Evasion, repair skill, indestructible gear",
    "grade": "C",
    "types": [
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E066",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Cursed Bikini Armor",
    "detail": "Baits wearers with high stats, locks on, and shrinks further after every battle.",
    "counters": "Appraise, curse-removal shop",
    "grade": "B",
    "types": [
      "cloth",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E067",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Tentacle Living Armor",
    "detail": "Poses as high-tier armor, locks onto the wearer, and writhes unpredictably in battle.",
    "counters": "Appraise first, dispel, fire",
    "grade": "B",
    "types": [
      "cloth",
      "parasite",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E068",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Hidden Tentacle Lingerie",
    "detail": "Lurks beneath outer clothes, activating silently without allies noticing.",
    "counters": "Appraise, strip and inspect",
    "grade": "C",
    "types": [
      "cloth",
      "parasite",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E069",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Puppet Garments",
    "detail": "Enchanted clothing hijacks the wearer's legs and marches them straight into the next trap.",
    "counters": "Rip off clothes, willpower",
    "grade": "B",
    "types": [
      "cloth",
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E070",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Forced Costume Circle",
    "detail": "Magic circle swaps armor into maid or bunny outfits and recalculates stats to match.",
    "counters": "Gear-lock enchant, spare outfit",
    "grade": "C",
    "types": [
      "cloth",
      "curse",
      "lewd"
    ],
    "comboIds": [
      "TPC26"
    ]
  },
  {
    "id": "E071",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Outfit-Swap Curse",
    "detail": "Swaps attire among party members; ill-fitting gear imposes movement and defense penalties.",
    "counters": "Dispel, spend a turn changing",
    "grade": "D",
    "types": [
      "cloth",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E072",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Chastity Lock Curse",
    "detail": "Snaps on a locked chastity belt whose key is held by the boss, blocking relief.",
    "counters": "Defeat boss, dispel",
    "grade": "C",
    "types": [
      "curse",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E073",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Updraft Floor Vent",
    "detail": "Floor vents blast upward gusts that flip cloaks and skirts, staggering victims with shame.",
    "counters": "Heavy cloak, detour",
    "grade": "D",
    "types": [
      "cloth",
      "lewd"
    ],
    "comboIds": [
      "TPC26"
    ]
  },
  {
    "id": "E074",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Jingle Collar",
    "detail": "Rings loudly with every step or blush, ruining stealth and luring nearby monsters.",
    "counters": "Muffle bell, dispel",
    "grade": "D",
    "types": [
      "cloth",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E075",
    "category": "ero",
    "subcategory": "Clothing & Gear",
    "name": "Clinging Cursed Relic",
    "detail": "Looted gear refuses to unequip while stacking steady debuffs and arousal.",
    "counters": "Dispel, temple cleanse",
    "grade": "C",
    "types": [
      "curse",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E076",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Aphrodisiac Gas Chamber",
    "detail": "Doors lock as pink mist fills the room; failing Will checks each turn builds heat.",
    "counters": "Gas mask, wind magic, ventilate",
    "grade": "B",
    "types": [
      "poison",
      "lewd",
      "mind"
    ],
    "comboIds": [
      "TPC15"
    ]
  },
  {
    "id": "E077",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Sensitivity Multiplier",
    "detail": "Stacks a lasting sensitivity multiplier on each hit until the party leaves the dungeon.",
    "counters": "Suppressant tonic, rest",
    "grade": "B",
    "types": [
      "lewd",
      "curse"
    ],
    "comboIds": [
      "TPC24"
    ]
  },
  {
    "id": "E078",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Heat Curse",
    "detail": "Inflicts lingering feverish heat that chips away stamina until cleansed.",
    "counters": "Town purification, cure item",
    "grade": "C",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E079",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Swelling Potion Mist",
    "detail": "Causes parts of the body to swell, making tight armor pinch and lowering Agility.",
    "counters": "Antidote, wait out duration",
    "grade": "C",
    "types": [
      "mutate",
      "poison",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E080",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Lactation Elixir",
    "detail": "Alters body constitution to produce milk—deadly when paired with a milking rig.",
    "counters": "Cure potion",
    "grade": "C",
    "types": [
      "mutate",
      "poison",
      "lewd"
    ],
    "comboIds": [
      "TPC17"
    ]
  },
  {
    "id": "E081",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Paralysis Needle",
    "detail": "Concealed needles in handles or chairs inject fast-acting numbing toxin.",
    "counters": "Gloves, antidote",
    "grade": "C",
    "types": [
      "poison",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E082",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Sleeping Gas Vent",
    "detail": "Sweet fumes knock intruders unconscious so dungeon keepers can haul them to the cells.",
    "counters": "Night watch, mask",
    "grade": "B",
    "types": [
      "poison",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E083",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Drunken Haze",
    "detail": "Inflicts tipsy confusion, scrambling movement and steering victims into hazards.",
    "counters": "Hold breath, antidote",
    "grade": "C",
    "types": [
      "poison",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E084",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Pheromone Sprayer",
    "detail": "Coats a target in monster-attracting musk, drawing every beast on the floor.",
    "counters": "Wash clean, mask scent",
    "grade": "C",
    "types": [
      "lewd",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "E085",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Infatuation Dart",
    "detail": "Causes the victim to fall for the first figure they see and fight on their side.",
    "counters": "Blindfold, cure, look in mirror",
    "grade": "B",
    "types": [
      "mind",
      "lewd",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "E086",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Laughing Gas",
    "detail": "Uncontrollable giggling fits make stealth and spellcasting impossible.",
    "counters": "Hold breath, sedative",
    "grade": "C",
    "types": [
      "poison",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E087",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Truth Confession Mist",
    "detail": "Forces everyone inside to blurt out hidden desires and crushes, straining party trust.",
    "counters": "Silence spell, earplugs",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E088",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Beastkin Heat Inducer",
    "detail": "Forces demi-human heroes into sudden estrus cycles that lock actions every few turns.",
    "counters": "Suppressant, cold water",
    "grade": "C",
    "types": [
      "lewd",
      "poison",
      "mutate"
    ],
    "comboIds": []
  },
  {
    "id": "E089",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Pleasure Addiction",
    "detail": "Leaves lingering cravings after escape, compelling heroes to return to the dungeon.",
    "counters": "Purification therapy, ally watch",
    "grade": "B",
    "types": [
      "mind",
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E090",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Climax Level Drain",
    "detail": "Each peak drains EXP and levels from the victim.",
    "counters": "Avoid contact, ward charm",
    "grade": "B",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E091",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Mana Siphon Floor",
    "detail": "Drains MP with every step and peak; hitting 0 knocks the hero out back to entrance.",
    "counters": "Mana potions, raise max MP",
    "grade": "B",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E092",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Pain-to-Pleasure Field",
    "detail": "Converts incoming damage into intense pleasure—nonlethal, but overwhelms until collapse.",
    "counters": "Dodge hits, dispel field",
    "grade": "B",
    "types": [
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E093",
    "category": "ero",
    "subcategory": "Drugs, Gas & Body",
    "name": "Essence Drain Snare",
    "detail": "Saps male heroes' vigor and vitality, lowering combat stats.",
    "counters": "Willpower, sealing charm",
    "grade": "C",
    "types": [
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E094",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Womb Crest Brand",
    "detail": "Etches a glowing sigil on the lower belly that flares with heat and penalizes resistance.",
    "counters": "Holy water dispel, high Will",
    "grade": "B",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E095",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Evolving Submission Crest",
    "detail": "Darkens with each surrender until completion binds the hero permanently to the dungeon.",
    "counters": "Early dispel, sealing bandages",
    "grade": "B",
    "types": [
      "curse",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E096",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Sensitivity Talisman",
    "detail": "An adhesive talisman that continuously stimulates and permanently raises local sensitivity.",
    "counters": "Peel off talisman, dispel",
    "grade": "C",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E097",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Charm-Reflect Mirror",
    "detail": "Bounces any charm spell a hero casts straight back at themselves.",
    "counters": "Avoid casting charm skills",
    "grade": "D",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E098",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Hypnosis Sigil",
    "detail": "Stepping on the glyph glazes the eyes and inflicts instant obedience.",
    "counters": "Mental resist, ally slap",
    "grade": "B",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": [
      "TPC23"
    ]
  },
  {
    "id": "E099",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Common-Sense Warp Ward",
    "detail": "Inside the barrier, strip searches feel like polite etiquette while refusal feels shameful.",
    "counters": "Ally outside warns, awareness check",
    "grade": "B",
    "types": [
      "mind",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E100",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Perception Skew Ward",
    "detail": "Makes lethal traps look like cozy chairs, chests, or safe tiles.",
    "counters": "True Sight, appraisal",
    "grade": "C",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E101",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Affection Twist Hex",
    "detail": "Quietly builds warm fondness toward dungeon monsters and the Keeper.",
    "counters": "Dispel, party bonds",
    "grade": "C",
    "types": [
      "mind",
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E102",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Body-Command Hex",
    "detail": "Forces limbs to perform fixed lewd poses regardless of the victim's will.",
    "counters": "Will check each turn",
    "grade": "B",
    "types": [
      "curse",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E103",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Orgasm Denial Curse",
    "detail": "Blocks release while locking arousal near maximum, crippling accuracy and focus.",
    "counters": "Dispel, defeat floor boss",
    "grade": "B",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": [
      "TPC20"
    ]
  },
  {
    "id": "E104",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Memory Rewrite Rune",
    "detail": "Places an illusory hand on the brow to slowly alter memories and loyalties.",
    "counters": "Mind shield",
    "grade": "B",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E105",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Escape-Seal Barrier",
    "detail": "Locks all exits until the room's humiliating condition is fulfilled.",
    "counters": "Shatter ward, find core",
    "grade": "C",
    "types": [
      "curse",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E106",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Master-Servant Contract",
    "detail": "Signing this scroll triggers painful spasms whenever the signer tries to betray the Keeper.",
    "counters": "Contract-breaking ritual",
    "grade": "B",
    "types": [
      "curse",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E107",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Scales of Obedience",
    "detail": "Forces a wager of stats or mana; losing compels obedience for set turns.",
    "counters": "Refuse wager, hide strength",
    "grade": "C",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E108",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Mana-Kiss Gate",
    "detail": "A healing or exit circle that activates only when two entrants share a deep kiss.",
    "counters": "Substitute mana crystal, decode rune",
    "grade": "D",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E109",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Clumsy Exposure Jinx",
    "detail": "Triggers absurd wardrobe accidents, trips, and updrafts around the cursed target every turn.",
    "counters": "Luck buff, dispel",
    "grade": "D",
    "types": [
      "cloth",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E110",
    "category": "ero",
    "subcategory": "Magic, Curses & Sigils",
    "name": "Time-Freeze Zone",
    "detail": "Freezes bodies in stasis while unseen hands stack sensations that hit all at once on release.",
    "counters": "Time-ward gear, smash clockwork",
    "grade": "B",
    "types": [
      "curse",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E111",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Sensory-Cutoff Hood",
    "detail": "Blinds sight and muffles hearing, amplifying every remaining touch tenfold.",
    "counters": "Ally guidance, arcane sight",
    "grade": "C",
    "types": [
      "bind",
      "lewd",
      "mind"
    ],
    "comboIds": [
      "TPC19"
    ]
  },
  {
    "id": "E112",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Voo-Doll Empathy Link",
    "detail": "A hair-woven doll transmits every touch directly to the victim anywhere in the dungeon.",
    "counters": "Recover/burn doll, reflect curse",
    "grade": "B",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E113",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Sensory Swap Link",
    "detail": "Swaps nerve feedback between two heroes so each feels what happens to the other.",
    "counters": "Dispel, separate distance",
    "grade": "B",
    "types": [
      "curse",
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E114",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Delayed Sensation Bomb",
    "detail": "Numbs all feeling at first, then detonates all stored pleasure during the boss fight or exit.",
    "counters": "Timed dispel, purge in safe zone",
    "grade": "B",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E115",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Threshold Climax Door",
    "detail": "Sealed gate that unlocks only after enduring a set number of peaks.",
    "counters": "Faint to reset, raise max MP",
    "grade": "C",
    "types": [
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E116",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Focused Spot Training",
    "detail": "Repeatedly targets one zone until permanent hypersensitivity sets in.",
    "counters": "Avoid repeat triggers",
    "grade": "C",
    "types": [
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E117",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Corruption Meter Trap",
    "detail": "Accumulates lewdness stacks with every trigger; hitting cap unlocks a fallen route.",
    "counters": "Purge back in town",
    "grade": "C",
    "types": [
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E118",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Erogenous Shift",
    "detail": "Transfers hypersensitivity to palms or ears, penalizing every weapon swing or shield block.",
    "counters": "Gloves, dispel",
    "grade": "C",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E119",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Whispering Corridor",
    "detail": "Binaural whispers echo in the ears, scrambling tactical orders from allies.",
    "counters": "Earplugs, loud song/noise",
    "grade": "D",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E120",
    "category": "ero",
    "subcategory": "Sensory & Pleasure",
    "name": "Pleasure-to-Mana Converter",
    "detail": "Recharges MP whenever stimulated—tempting desperate casters to trigger it on purpose.",
    "counters": "Gauge discipline, restraint",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E121",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Hypno Pendant",
    "detail": "Gazing into this glittering jewel plants deep hypnotic suggestions.",
    "counters": "Blindfold, Will check",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E122",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Post-Hypnotic Trigger",
    "detail": "Plants a hidden trigger word—when the leader shouts 'Attack!', the victim turns traitor.",
    "counters": "Dispel ritual, change codewords",
    "grade": "B",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E123",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Charm Betrayal",
    "detail": "Charms one party member into stripping and tying up their own teammates.",
    "counters": "Mind cure, anti-charm trinket",
    "grade": "B",
    "types": [
      "mind",
      "bind",
      "lewd"
    ],
    "comboIds": [
      "TPC21"
    ]
  },
  {
    "id": "E124",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Marionette Strings",
    "detail": "Leaves the mind lucid while invisible threads force the body to grab allies.",
    "counters": "Cut threads, defeat puppeteer",
    "grade": "B",
    "types": [
      "mind",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E125",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Identity Mirage",
    "detail": "Disguises approaching monsters as beloved companions or lovers.",
    "counters": "True Sight, touch verification",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E126",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Memory-Wipe Loop",
    "detail": "Erases memory of triggering the trap so victims walk into it again while sensitivity stays.",
    "counters": "Leave notes, rely on allies",
    "grade": "B",
    "types": [
      "mind",
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E127",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Succubus Dream Chamber",
    "detail": "Sleeping in this cozy room launches a dream raid whose penalties carry into waking.",
    "counters": "Lucid dream check, night watch",
    "grade": "B",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": [
      "TPC25"
    ]
  },
  {
    "id": "E128",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Blissful Clear Illusion",
    "detail": "Traps minds in a sweet illusion of victory while their real bodies sit bound in the cell.",
    "counters": "Sense incongruity, outside shock",
    "grade": "B",
    "types": [
      "mind",
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E129",
    "category": "ero",
    "subcategory": "Mind & Brainwashing",
    "name": "Gradual Corruption Aura",
    "detail": "Chips away purity on every hit; at zero, the hero defects to the dungeon's side.",
    "counters": "Purification, prayer",
    "grade": "B",
    "types": [
      "curse",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E130",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Mimic Treasure Chest",
    "detail": "Opening the chest unleashes a slick tongue that drags the looter into its pocket maw.",
    "counters": "Poke before opening, detect magic",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E131",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Bed & Door Mimic",
    "detail": "Poses as an inviting bed or exit door, snapping shut the instant someone rests or opens it.",
    "counters": "Keep watch, knock on doors",
    "grade": "C",
    "types": [
      "bind",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E132",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Fake Save Circle",
    "detail": "Glows like a sanctuary checkpoint, ambushing anyone who lets their guard down to rest.",
    "counters": "Appraise, stay skeptical",
    "grade": "C",
    "types": [
      "mind",
      "bind"
    ],
    "comboIds": [
      "TPC25"
    ]
  },
  {
    "id": "E133",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Doppelganger Ally",
    "detail": "Clones a party member and slips into formation to sabotage from within.",
    "counters": "Passphrase, memory quiz",
    "grade": "B",
    "types": [
      "mind",
      "mutate"
    ],
    "comboIds": [
      "TPC13"
    ]
  },
  {
    "id": "E134",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Ideal-Lover Succubus",
    "detail": "Takes the exact shape of the target's desired partner to drain their essence.",
    "counters": "Mental check, ally wake-up",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E135",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Bait Captive",
    "detail": "A crying 'adventurer' begging for rescue is actually a lure mimic ready to grab rescuers.",
    "counters": "Verify identity, free from range",
    "grade": "C",
    "types": [
      "mind",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E136",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Trapped Glitter Loot",
    "detail": "Gleaming treasure that springs a trap the second bare fingers pick it up.",
    "counters": "Use tongs, appraise",
    "grade": "D",
    "types": [
      "bind",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E137",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "Statue Gallery",
    "detail": "Mixes real petrified victims with living ambush statues; touching the wrong one springs all.",
    "counters": "Detect, tread carefully",
    "grade": "C",
    "types": [
      "mind",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E138",
    "category": "ero",
    "subcategory": "Mimicry & Disguise",
    "name": "False Exit Arch",
    "detail": "An illuminated 'EXIT' archway that opens straight into a locked ambush room.",
    "counters": "Cross-check map, True Sight",
    "grade": "D",
    "types": [
      "mind",
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "E139",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Dungeon Stream Crystal",
    "detail": "Broadcasts the party live to monster viewers; higher tips escalate trap intensity.",
    "counters": "Smash crystal, play to crowd",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": [
      "TPC22"
    ]
  },
  {
    "id": "E140",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Peeping Scry Orb",
    "detail": "Secretly records embarrassing moments to leak to the Guild or fuel blackmail.",
    "counters": "Hunt and smash orb",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E141",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Town-Square Teleport Display",
    "detail": "Warps bound victims straight into the town plaza for public humiliation.",
    "counters": "Escape scroll",
    "grade": "B",
    "types": [
      "curse",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E142",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Two-Way Mirror Hall",
    "detail": "One-way mirrors hide rows of monster spectators whose cheers buff room traps.",
    "counters": "Smash mirrors, detect",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E143",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Public Status Board",
    "detail": "Projects each hero's private lewdness stats onto a giant glowing scoreboard.",
    "counters": "Destroy board",
    "grade": "D",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E144",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Front-of-Allies Trap",
    "detail": "Triggers specifically while teammates watch, shaking morale and party cohesion.",
    "counters": "Spread out, cover allies",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E145",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Humiliating Title Hex",
    "detail": "Stamps an embarrassing title onto the hero's status sheet for everyone to see.",
    "counters": "Overwrite title, dispel",
    "grade": "D",
    "types": [
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E146",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Backlit Curtain Booth",
    "detail": "Changing curtains are brightly backlit, projecting every silhouette clearly onto the hall.",
    "counters": "Extinguish lights",
    "grade": "D",
    "types": [
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E147",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Echoing Moan Hall",
    "detail": "Amplifies every gasp across the entire dungeon, drawing monsters straight to the room.",
    "counters": "Silence spell, gag",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E148",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Audience Vote Panel",
    "detail": "Monster spectators vote live on which trap and target fires next.",
    "counters": "Act unappealing to split votes",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": [
      "TPC22"
    ]
  },
  {
    "id": "E149",
    "category": "ero",
    "subcategory": "Shame & Exposure",
    "name": "Curtain-Drop Exit",
    "detail": "Completing the room condition drops the false wall, revealing a packed monster gallery.",
    "counters": "Check sequence, shadow magic",
    "grade": "C",
    "types": [
      "lewd",
      "cloth"
    ],
    "comboIds": []
  },
  {
    "id": "E150",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Petrify Showcase",
    "detail": "Turns victims into living stone statues displayed along the dungeon gallery.",
    "counters": "Gold needle, dispel",
    "grade": "B",
    "types": [
      "mutate",
      "curse",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E151",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Living Doll Shelf",
    "detail": "Shrinks and transforms captives into conscious porcelain dolls lined up on a shelf.",
    "counters": "Dispel, call true name",
    "grade": "B",
    "types": [
      "mutate",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E152",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Portrait Frame Seal",
    "detail": "Pulls victims inside oil paintings to hang as moving corridor decor.",
    "counters": "Smash frame",
    "grade": "C",
    "types": [
      "curse",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E153",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Wax Coating Trap",
    "detail": "Pours warm candle wax that hardens into a rigid glossy cast.",
    "counters": "Fire/heat",
    "grade": "C",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E154",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Gender-Swap Gas",
    "detail": "Flips the victim's sex, invalidating tailored armor and class gear.",
    "counters": "Reversal tonic, wait out",
    "grade": "C",
    "types": [
      "mutate",
      "poison",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E155",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Futanari Hex",
    "detail": "Grows new anatomy along with a brand-new sensitivity gauge to manage.",
    "counters": "Reversal tonic",
    "grade": "C",
    "types": [
      "mutate",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E156",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Living-Trap Conversion",
    "detail": "Turns captured heroes into living lure traps for the next invading party.",
    "counters": "Purify, rescue",
    "grade": "B",
    "types": [
      "mutate",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E157",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Monster-Girl Assimilation",
    "detail": "Gradually transforms victims into monster girls who switch sides to defend the dungeon.",
    "counters": "Early interrupt, holy relic",
    "grade": "B",
    "types": [
      "mutate",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E158",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Balloon Inflation",
    "detail": "Puffs the body up like a taut balloon, making movement and dodging clumsy.",
    "counters": "Wait out, release valve",
    "grade": "C",
    "types": [
      "mutate",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E159",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Shrink Hex",
    "detail": "Shrinks heroes to palm size, leaving them dwarfed by giant tiles and towering monsters.",
    "counters": "Growth elixir",
    "grade": "C",
    "types": [
      "mutate",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E160",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Naked Recall Warp",
    "detail": "Warps only the hero back to town square or entrance while leaving all equipment behind.",
    "counters": "Anti-warp charm, anchor spell",
    "grade": "B",
    "types": [
      "cloth",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E161",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Isolated Pocket Bind",
    "detail": "Bans one hero into a solo pocket cell and binds them, splitting the party.",
    "counters": "Link spell, allies",
    "grade": "B",
    "types": [
      "bind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E162",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Beast-Ear & Tail Hex",
    "detail": "Sprouts sensitive ears and a tail that twitch and betray instincts.",
    "counters": "Dispel, wait out",
    "grade": "C",
    "types": [
      "mutate",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E163",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Succubus Conversion",
    "detail": "Grants drain skills at the cost of a relentless hunger gauge that must be fed.",
    "counters": "Purify, sacred relic",
    "grade": "B",
    "types": [
      "mutate",
      "curse",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E164",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Slime-Body Curse",
    "detail": "Turns flesh gelatinous so rigid metal armor slips right off.",
    "counters": "Dispel, drying wind",
    "grade": "C",
    "types": [
      "mutate",
      "cloth",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E165",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Living-Item Hex",
    "detail": "Transforms victims into enchanted clothes or furniture used by dungeon denizens.",
    "counters": "Dispel, item appraisal",
    "grade": "B",
    "types": [
      "mutate",
      "curse",
      "cloth"
    ],
    "comboIds": []
  },
  {
    "id": "E166",
    "category": "ero",
    "subcategory": "Transformation & Warp",
    "name": "Body-Swap Prism",
    "detail": "Swaps bodies between party members—or with a nearby monster.",
    "counters": "Reuse swap prism",
    "grade": "C",
    "types": [
      "mutate",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E167",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "'Cannot Leave Unless...' Room",
    "detail": "Doors seal until entrants perform the carved lewd condition (kiss, hug, confess...).",
    "counters": "Smash wall, loophole wording",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": [
      "TPC23"
    ]
  },
  {
    "id": "E168",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Quiz Punishment Gate",
    "detail": "Every wrong trivia answer triggers an escalating humiliating penalty.",
    "counters": "Int check, hint item",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E169",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Reflex QTE Gauntlet",
    "detail": "Failing timed dodges triggers three escalating tiers of naughty punishment.",
    "counters": "Reflexes, Agility",
    "grade": "C",
    "types": [
      "phys",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E170",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Repetition Lock Door",
    "detail": "Sealed door demanding N repetitions of an embarrassing pose before unlocking.",
    "counters": "Break door, alternate route",
    "grade": "D",
    "types": [
      "bind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E171",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Strip Rock-Paper-Scissors",
    "detail": "Challenges intruders to RPS with a monster; every loss strips one piece of gear.",
    "counters": "Read tells, win to loot monster",
    "grade": "C",
    "types": [
      "cloth",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E172",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "King's Game Draw",
    "detail": "Draws lots to assign mandatory spicy commands to paired party members.",
    "counters": "Rig the draw",
    "grade": "C",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E173",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Lewd Board-Game Floor",
    "detail": "Turns the entire floor into a life-size board game where every square holds a dare.",
    "counters": "Luck, find shortcut",
    "grade": "B",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E174",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Endurance Challenge Booth",
    "detail": "Stay stone-faced through stimulation until the timer ends for loot—or fail into penalties.",
    "counters": "Willpower buff",
    "grade": "C",
    "types": [
      "lewd",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "E175",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Twisted Wish Fountain",
    "detail": "Grants spoken wishes while twisting every loophole into something lewd.",
    "counters": "Phrase wish airtight",
    "grade": "C",
    "types": [
      "curse",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E176",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Time-Loop Corridor",
    "detail": "Failing resets the party to the entrance while retaining all accumulated sensitivity.",
    "counters": "Find true exit condition",
    "grade": "B",
    "types": [
      "curse",
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "E177",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Lewd Monster House",
    "detail": "Locks the exits and swarms the room with lust-driven dungeon monsters.",
    "counters": "Escape scroll, AoE clear",
    "grade": "B",
    "types": [
      "lewd",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "E178",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Floor-Wide Lust Aura",
    "detail": "Saturates the whole floor in warm haze, steadily raising arousal the longer you linger.",
    "counters": "Rush through, ward barrier",
    "grade": "C",
    "types": [
      "lewd",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "E179",
    "category": "ero",
    "subcategory": "Games & Condition Rooms",
    "name": "Split-Fate Trigger",
    "detail": "Each trigger rolls one of two unpredictable outcomes at random.",
    "counters": "Luck",
    "grade": "D",
    "types": [
      "mind",
      "lewd"
    ],
    "comboIds": []
  },
  {
    "id": "N001",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Rolling Boulder",
    "detail": "Stepping on a plate releases a massive boulder down a sloped hall, crushing everyone in line.",
    "counters": "Duck into side alcoves, wedge track, check slope",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": [
      "TPC08"
    ]
  },
  {
    "id": "N002",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Collapsing Ceiling",
    "detail": "A tripwire yanks rotted support beams, dropping heavy masonry that blocks the passage.",
    "counters": "Spot cracked joists, cut tripwire",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N003",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Descending Ceiling",
    "detail": "Doors lock as the stone ceiling lowers one notch every turn to crush the room.",
    "counters": "Brace with poles/shields, find stop lever",
    "grade": "B",
    "types": [
      "phys",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N004",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Shoving Wall",
    "detail": "A spring-loaded wall panel slams intruders 3–5 tiles forward straight into the next trap.",
    "counters": "Brace with Strength, heavy armor, stay clear",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": [
      "TPC03"
    ]
  },
  {
    "id": "N005",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Springboard Tile",
    "detail": "Catapults lightweight heroes skyward for fall damage or launches them into another hazard.",
    "counters": "Heavy units immune, leap over",
    "grade": "D",
    "types": [
      "phys",
      "pit"
    ],
    "comboIds": [
      "TPC04"
    ]
  },
  {
    "id": "N006",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Ceiling Hammer",
    "detail": "A massive overhead stone block slams down for heavy damage and stun.",
    "counters": "Listen for wind-up click, dash in gap",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": [
      "TPC04"
    ]
  },
  {
    "id": "N007",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Log Pendulum",
    "detail": "A suspended timber log swings across the hall, hurling targets up to 10 tiles away.",
    "counters": "Spot ceiling ropes, drop prone",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N008",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Spinning Flail Pillar",
    "detail": "Rotating spiked flail arms sweep the whole area and knock lighter fighters flying.",
    "counters": "Step inside sweep gap, jam axle",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N009",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Falling Rocks",
    "detail": "Loose ceiling boulders crash down on a single intruder for massive impact.",
    "counters": "Helmet, watch falling dust",
    "grade": "D",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N010",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Giant Arcane Fist",
    "detail": "Spectral hands and feet erupt from the tiles to slam and grab targets.",
    "counters": "Read shadow telegraph, dispel",
    "grade": "B",
    "types": [
      "phys",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N011",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Slick Stone Floor",
    "detail": "Causes victims to slip and slide uncontrollably along their movement line.",
    "counters": "Scatter sand/ash, shuffle slowly",
    "grade": "D",
    "types": [
      "pit",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N012",
    "category": "standard",
    "subcategory": "Physical & Impact",
    "name": "Springy Jelly Floor",
    "detail": "Looks like stone until it wobbles and bounces anyone standing on it into the air.",
    "counters": "Poke with pole, spread weight",
    "grade": "D",
    "types": [
      "pit",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N013",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Covered Pitfall",
    "detail": "A disguised pit that deals fall damage and traps victims below.",
    "counters": "Probe with 3m pole, jam cover",
    "grade": "C",
    "types": [
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "N014",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Spike Pit",
    "detail": "Lined with iron spikes at the bottom, adding piercing damage to the fall.",
    "counters": "Detect, leap across, lay plank bridge",
    "grade": "C",
    "types": [
      "pit",
      "phys"
    ],
    "comboIds": [
      "TPC03"
    ]
  },
  {
    "id": "N015",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Locking Pitfall",
    "detail": "Snaps its lid shut and locks once a hero drops in, cutting them off from allies.",
    "counters": "Wedge lid, Strength, lockpick",
    "grade": "B",
    "types": [
      "pit",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N016",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Lower-Floor Chute",
    "detail": "The floor drops away to send victims tumbling to a lower floor, splitting the party.",
    "counters": "Rope party together, Feather Fall",
    "grade": "B",
    "types": [
      "pit"
    ],
    "comboIds": [
      "TPC28"
    ]
  },
  {
    "id": "N017",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Tilting Corridor",
    "detail": "The entire floor angles into a steep slide feeding into a pit or monster nest.",
    "counters": "Pitons/rope, climbing gear",
    "grade": "C",
    "types": [
      "pit",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N018",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Snapping Bridge",
    "detail": "Collapses the instant combined weight crosses its load limit.",
    "counters": "Cross one by one, flight",
    "grade": "C",
    "types": [
      "pit"
    ],
    "comboIds": [
      "TPC08"
    ]
  },
  {
    "id": "N019",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Crumbling Tiles",
    "detail": "Tiles give way moments after being stepped on, forcing non-stop movement.",
    "counters": "Read crack patterns, sprint",
    "grade": "C",
    "types": [
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "N020",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Quicksand Mire",
    "detail": "Slowly drags victims under toward suffocation—or ignites violently if filled with tar.",
    "counters": "Survival check, rope rescue, hold still",
    "grade": "B",
    "types": [
      "pit",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N021",
    "category": "standard",
    "subcategory": "Pitfalls & Drops",
    "name": "Serpent Pit",
    "detail": "A pit teeming with vipers, acid, or slime—surviving the fall is the easy part.",
    "counters": "Shine light first, fire, antivenom",
    "grade": "B",
    "types": [
      "pit",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N022",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Arrow Wall",
    "detail": "Volleys of arrows erupt simultaneously from concealed wall slits.",
    "counters": "Raise shields, plug slits, crouch",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": [
      "TPC06"
    ]
  },
  {
    "id": "N023",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Floor Spikes",
    "detail": "Iron spikes shoot upward through tile perforations to impale anyone standing above.",
    "counters": "Read reload cadence, leap over",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N024",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Closing Spike Walls",
    "detail": "Twin spiked walls grind inward turn by turn to skewer the party.",
    "counters": "Brace with beams, find release switch",
    "grade": "B",
    "types": [
      "phys",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N025",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Pendulum Blades",
    "detail": "Crescent scythes sweep across the corridor in a steady lethal rhythm.",
    "counters": "Time the beat, jam pivot, crawl under",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": [
      "TPC05"
    ]
  },
  {
    "id": "N026",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Wall Sawblades",
    "detail": "Spinning blades dart out of wall slots to slash anyone passing near.",
    "counters": "Hug opposite wall, wedge slot",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N027",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Ricochet Sawblade",
    "detail": "Bouncing saw discs ricochet wildly off walls in unpredictable paths.",
    "counters": "Tower shield, fight in open space",
    "grade": "B",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N028",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Rail Saw Track",
    "detail": "Twin-bladed saws race back and forth along recessed floor tracks.",
    "counters": "Cross while saw is away, jam groove",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N029",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Razor Wire Mesh",
    "detail": "Near-invisible monofilament wire mesh descends quietly across the corridor.",
    "counters": "Reveal with flour/light, probe with pole",
    "grade": "B",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N030",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Guillotine Threshold",
    "detail": "A hidden blade sweeps across the doorway at head height.",
    "counters": "Kneel through doorway, pin blade",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N031",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Iron Maiden",
    "detail": "Snaps shut around a target and drives spikes inward every turn they remain trapped.",
    "counters": "Break hinges, avoid getting shoved in",
    "grade": "B",
    "types": [
      "phys",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N032",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Wall Spear",
    "detail": "A single spear lunges out from the wall—ideal as an opener for follow-up traps.",
    "counters": "Shield, listen for click",
    "grade": "D",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N033",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Auto-Crossbow Turret",
    "detail": "A fixed repeating turret fires aimed bolts down long sightlines.",
    "counters": "Take cover, break LOS, smash turret",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": [
      "TPC27"
    ]
  },
  {
    "id": "N034",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Bear Trap",
    "detail": "Snaps shut on a leg to immobilize the victim, turning follow-up hits into criticals.",
    "counters": "Pry open with Str, probe ahead",
    "grade": "C",
    "types": [
      "bind",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N035",
    "category": "standard",
    "subcategory": "Piercing & Blades",
    "name": "Spiked Crusher Block",
    "detail": "A heavy spiked block charges down any row the moment an intruder lines up with it.",
    "counters": "Bait charge, pass during reset",
    "grade": "C",
    "types": [
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N036",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Flame Statue",
    "detail": "Stepping on a plate makes the stone idol belch a roaring cone of fire.",
    "counters": "Spot plate, plug nozzle, fire resist",
    "grade": "C",
    "types": [
      "fire"
    ],
    "comboIds": [
      "TPC01"
    ]
  },
  {
    "id": "N037",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Brimstone Floor",
    "detail": "Scorching sulfur vents sear anyone crossing, inflicting lingering burn.",
    "counters": "Freeze, detour",
    "grade": "D",
    "types": [
      "fire",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N038",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Wall Flamethrower",
    "detail": "Jets of pressurized flame sweep across the hall from wall vents.",
    "counters": "Wet cloak, plug nozzles",
    "grade": "C",
    "types": [
      "fire"
    ],
    "comboIds": []
  },
  {
    "id": "N039",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Blast Rune",
    "detail": "Halves HP in a fiery detonation while scorching pack supplies and rations.",
    "counters": "Detect magic, detonate from range",
    "grade": "B",
    "types": [
      "fire",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N040",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Powder Mummy",
    "detail": "Undead wrapped with gunpowder kegs that detonate violently if touched by fire.",
    "counters": "Avoid fire, melee carefully",
    "grade": "C",
    "types": [
      "fire",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N041",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Oil-Slick Floor",
    "detail": "Slick oil knocks heroes down and coats them, massively amplifying incoming fire damage.",
    "counters": "Scatter sand, keep sparks away",
    "grade": "B",
    "types": [
      "fire",
      "pit"
    ],
    "comboIds": [
      "TPC01"
    ]
  },
  {
    "id": "N042",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Lava Shift Floor",
    "detail": "Triggering the rune melts floor tiles into bubbling magma.",
    "counters": "Flight, frost magic",
    "grade": "B",
    "types": [
      "fire"
    ],
    "comboIds": []
  },
  {
    "id": "N043",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Molten Gold Rain",
    "detail": "Showers molten gold from above, burning targets and marking them with gleaming slag.",
    "counters": "Take cover, evade",
    "grade": "B",
    "types": [
      "fire"
    ],
    "comboIds": []
  },
  {
    "id": "N044",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Bouncing Bomb Launcher",
    "detail": "Launches hopping bombs that explode on contact.",
    "counters": "Spread out, shoot bombs early",
    "grade": "C",
    "types": [
      "fire",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N045",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Dust Explosion Chamber",
    "detail": "Airborne flour and coal dust ignites catastrophically at the slightest open torch flame.",
    "counters": "Arcane light, ventilate",
    "grade": "B",
    "types": [
      "fire",
      "poison"
    ],
    "comboIds": [
      "TPC07"
    ]
  },
  {
    "id": "N046",
    "category": "standard",
    "subcategory": "Fire & Explosion",
    "name": "Powder Keg Cluster",
    "detail": "Volatile barrels that detonate when struck—even stray enemy shots set them off.",
    "counters": "Disarm, snipe from safe distance",
    "grade": "D",
    "types": [
      "fire",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N047",
    "category": "standard",
    "subcategory": "Frost, Water & Flood",
    "name": "Flooding Lock Chamber",
    "detail": "Doors seal as water pours in rapidly, starting a strict drowning countdown.",
    "counters": "Water breathing, find drain, smash door",
    "grade": "B",
    "types": [
      "water",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N048",
    "category": "standard",
    "subcategory": "Frost, Water & Flood",
    "name": "Cryo Geyser",
    "detail": "Erupts freezing mist that encases anyone overhead in solid ice.",
    "counters": "Fire magic, read eruption cycle",
    "grade": "C",
    "types": [
      "ice",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N049",
    "category": "standard",
    "subcategory": "Frost, Water & Flood",
    "name": "Icicle Lance Volley",
    "detail": "Giant spears of ice rocket across the chamber, freezing an entire cluster.",
    "counters": "Take cover, spread out",
    "grade": "C",
    "types": [
      "ice"
    ],
    "comboIds": []
  },
  {
    "id": "N050",
    "category": "standard",
    "subcategory": "Frost, Water & Flood",
    "name": "Glacial Slide Floor",
    "detail": "Frictionless ice forces intruders to slide nonstop until slamming into a wall or trap.",
    "counters": "Crampons, melt with fire",
    "grade": "C",
    "types": [
      "ice",
      "pit"
    ],
    "comboIds": [
      "TPC06"
    ]
  },
  {
    "id": "N051",
    "category": "standard",
    "subcategory": "Frost, Water & Flood",
    "name": "Rapids Channel",
    "detail": "Raging currents sweep targets helplessly into adjacent rooms or deeper hazards.",
    "counters": "Rope line, Swim check",
    "grade": "C",
    "types": [
      "water",
      "pit"
    ],
    "comboIds": [
      "TPC02"
    ]
  },
  {
    "id": "N052",
    "category": "standard",
    "subcategory": "Frost, Water & Flood",
    "name": "Scalding Steam Vent",
    "detail": "Blasts light targets skyward while scalding anyone already airborne.",
    "counters": "Time cycles, plug vents",
    "grade": "D",
    "types": [
      "water",
      "fire"
    ],
    "comboIds": []
  },
  {
    "id": "N053",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Poison Needle Lock",
    "detail": "Picking the lock springs a concealed needle coated in fast-acting venom.",
    "counters": "Thieves' tools check, gloves, antivenom",
    "grade": "C",
    "types": [
      "poison",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N054",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Poison Dart Wall",
    "detail": "Pressure plates trigger volleys of venom-tipped darts from tiny wall bores.",
    "counters": "Locate and plug bores",
    "grade": "D",
    "types": [
      "poison",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N055",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Toxic Gas Vault",
    "detail": "Seals the room and fills it with choking poison fog that deals damage every turn.",
    "counters": "Mask, wind magic, smash vent",
    "grade": "B",
    "types": [
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N056",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Anesthetic Gas",
    "detail": "Puts the entire party to sleep for several turns, leaving them utterly defenseless.",
    "counters": "Hold breath, wake item, Wis check",
    "grade": "B",
    "types": [
      "poison",
      "mind"
    ],
    "comboIds": [
      "TPC11"
    ]
  },
  {
    "id": "N057",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Acid Shower",
    "detail": "Ceiling vents spray corrosive acid that burns flesh and eats away armor durability.",
    "counters": "Umbrella/tarp, wash off",
    "grade": "B",
    "types": [
      "poison",
      "cloth"
    ],
    "comboIds": [
      "TPC10"
    ]
  },
  {
    "id": "N058",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Spore Mold Patch",
    "detail": "Any touch or vibration bursts a cloud of toxic fungal spores causing disease.",
    "counters": "Burn with fire, mask, cure disease",
    "grade": "C",
    "types": [
      "poison",
      "parasite"
    ],
    "comboIds": []
  },
  {
    "id": "N059",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Contact-Toxin Treasure",
    "detail": "Touching the gleaming loot bare-handed transfers contact poison or parasites.",
    "counters": "Gloves, tongs, appraise",
    "grade": "D",
    "types": [
      "poison",
      "parasite"
    ],
    "comboIds": []
  },
  {
    "id": "N060",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Venom Spitter Bloom",
    "detail": "Fires seed pods that burst into clinging poison clouds on impact.",
    "counters": "Fire, destroy from range",
    "grade": "C",
    "types": [
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N061",
    "category": "standard",
    "subcategory": "Poison, Gas & Blight",
    "name": "Oxygen-Depletion Vault",
    "detail": "Hermetically seals the vault; torches gutter out as an asphyxiation timer begins.",
    "counters": "Air magic, break seal, act fast",
    "grade": "B",
    "types": [
      "poison",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N062",
    "category": "standard",
    "subcategory": "Lightning & Shock",
    "name": "Lightning Strike Rune",
    "detail": "Calls down a bolt of lightning—extra lethal against metal plate armor.",
    "counters": "Insulated gear, shed metal",
    "grade": "C",
    "types": [
      "elec"
    ],
    "comboIds": [
      "TPC10"
    ]
  },
  {
    "id": "N063",
    "category": "standard",
    "subcategory": "Lightning & Shock",
    "name": "Electrified Pool",
    "detail": "Sends lethal high-voltage current surging through everyone standing in the water.",
    "counters": "Cut power source, stay out of water",
    "grade": "B",
    "types": [
      "elec",
      "water"
    ],
    "comboIds": [
      "TPC02"
    ]
  },
  {
    "id": "N064",
    "category": "standard",
    "subcategory": "Lightning & Shock",
    "name": "Shock Cage",
    "detail": "Drops an iron cage around intruders and pulses continuous electricity through the bars.",
    "counters": "Insulated tools, shatter bars",
    "grade": "B",
    "types": [
      "elec",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N065",
    "category": "standard",
    "subcategory": "Lightning & Shock",
    "name": "Static Arc Emitter",
    "detail": "Wide-area discharge applies Charged status, amplifying all subsequent damage taken.",
    "counters": "Dodge discharge rhythm",
    "grade": "C",
    "types": [
      "elec"
    ],
    "comboIds": []
  },
  {
    "id": "N066",
    "category": "standard",
    "subcategory": "Lightning & Shock",
    "name": "Chain Lightning Pylon",
    "detail": "Arcs lightning bolts rapidly between closely grouped party members.",
    "counters": "Spread out",
    "grade": "C",
    "types": [
      "elec"
    ],
    "comboIds": []
  },
  {
    "id": "N067",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Glyph of Warding",
    "detail": "Inscribed runes on doors or tomes unleash stored hostile spells the instant they are opened.",
    "counters": "Detect magic, dispel, Arcana check",
    "grade": "C",
    "types": [
      "curse",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N068",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Maw of Annihilation",
    "detail": "A devil-face archway framing pitch blackness; anything shoved inside vanishes forever.",
    "counters": "Toss junk first, lore check",
    "grade": "B",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N069",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Curse Seal",
    "detail": "Places a hex on one item in the pack, locking it unusable.",
    "counters": "Remove Curse",
    "grade": "D",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N070",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Polymorph Trap",
    "detail": "Transforms the victim into a harmless object or critter for several turns.",
    "counters": "Dispel, wait out duration",
    "grade": "C",
    "types": [
      "mutate",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N071",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Anti-Magic Seal Ward",
    "detail": "Suppresses all spellcasting and teleportation items inside the chamber.",
    "counters": "Mundane weapons, shatter ward crystal",
    "grade": "B",
    "types": [
      "curse",
      "mind"
    ],
    "comboIds": [
      "TPC09"
    ]
  },
  {
    "id": "N072",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Cursed Killing Ground",
    "detail": "Grows stronger every time a creature dies atop the tainted flagstones.",
    "counters": "Purify, never fight on it",
    "grade": "C",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N073",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Room of Stillness",
    "detail": "Fires searing beams at anyone who moves faster than a cautious walk.",
    "counters": "Walk slowly (costs time)",
    "grade": "C",
    "types": [
      "curse",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N074",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Word of Power Sigil",
    "detail": "Detonates omnidirectional arcane shockwaves across the room.",
    "counters": "Magic resist, ranged mobility",
    "grade": "B",
    "types": [
      "curse",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N075",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Soul Siphon Pillar",
    "detail": "Continuously drains a percentage of current HP every turn in line of sight.",
    "counters": "Burst heal, break sightline",
    "grade": "B",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N076",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Ascent Burden Hex",
    "detail": "Punishes retreat—climbing upward or fleeing stacks crushing fatigue.",
    "counters": "Ascend slowly, endure penalty",
    "grade": "D",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N077",
    "category": "standard",
    "subcategory": "Runes & Curses",
    "name": "Shadow Snare",
    "detail": "Pins victims in place for 5 turns while leaving arms and speech free.",
    "counters": "Dispel, ranged ally cover",
    "grade": "C",
    "types": [
      "bind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N078",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Confusion Turntable",
    "detail": "Scrambles equilibrium so movement and attacks veer in random directions.",
    "counters": "Cure, ally holds steady",
    "grade": "C",
    "types": [
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N079",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Blinding Flash Rune",
    "detail": "Seering light erupts to blind intruders for several turns.",
    "counters": "Close eyes/blindfold, cure",
    "grade": "D",
    "types": [
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N080",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Status Shroud",
    "detail": "Hides HP bars and status readouts, forcing reckless or hesitant decisions.",
    "counters": "Count damage manually, detect",
    "grade": "D",
    "types": [
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N081",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Terror Shriek",
    "detail": "Unleashes a panic-inducing wail that drives fleeing heroes straight into other traps.",
    "counters": "Courage spell, morale",
    "grade": "C",
    "types": [
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N082",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Illusory Floor",
    "detail": "Projects solid stone over an open pitfall to fool rushing scouts.",
    "counters": "Probe with pole, True Sight",
    "grade": "C",
    "types": [
      "mind",
      "pit"
    ],
    "comboIds": [
      "TPC12",
      "TPC29"
    ]
  },
  {
    "id": "N083",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Mirage Staircase",
    "detail": "Looks like the stairwell down, but stepping on it triggers a nasty hex.",
    "counters": "Appraise, check map",
    "grade": "D",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N084",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Decoy Click Plate",
    "detail": "Emits a loud false click to waste time disarming nothing and breed paranoia.",
    "counters": "Experience, ignore",
    "grade": "D",
    "types": [
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N085",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Snuffing Gust",
    "detail": "Extinguishes all torches, spiking dread and boosting monster ambush odds.",
    "counters": "Spare light source, arcane light",
    "grade": "D",
    "types": [
      "mind"
    ],
    "comboIds": [
      "TPC07"
    ]
  },
  {
    "id": "N086",
    "category": "standard",
    "subcategory": "Illusion & Mind",
    "name": "Forged Explorer Note",
    "detail": "Planting fake 'safe path' tips from past adventurers leads parties straight into danger.",
    "counters": "Cross-check, distrust",
    "grade": "D",
    "types": [
      "mind"
    ],
    "comboIds": [
      "TPC12"
    ]
  },
  {
    "id": "N087",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Random Warp Pad",
    "detail": "Teleports victims to random isolated spots across the floor.",
    "counters": "Anti-warp charm, regroup",
    "grade": "C",
    "types": [
      "curse",
      "pit"
    ],
    "comboIds": [
      "TPC14"
    ]
  },
  {
    "id": "N088",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Entrance Recall Pad",
    "detail": "Teleports the party straight back to the dungeon entrance, erasing floor progress.",
    "counters": "Anchor spell, detect",
    "grade": "B",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N089",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Rotating Chamber",
    "detail": "Once doors close, the entire room rotates silently to scramble compass bearings.",
    "counters": "Compass, chalk wall marks",
    "grade": "C",
    "types": [
      "mind",
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "N090",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Endless Loop Corridor",
    "detail": "Loops travelers right back to the entrance until they solve the exact directional sequence.",
    "counters": "Deduce pattern (turn order)",
    "grade": "C",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N091",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Harpoon Chain Pull",
    "detail": "Barbed hooks shoot out and reel victims straight into the kill zone.",
    "counters": "Cut chains, heavy units resist",
    "grade": "C",
    "types": [
      "phys",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N092",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Void Pull Wall",
    "detail": "Periodically inhales lighter targets toward an instant-death rift.",
    "counters": "Large units, hug far side",
    "grade": "B",
    "types": [
      "curse",
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "N093",
    "category": "standard",
    "subcategory": "Space & Displacement",
    "name": "Tar Mire Floor",
    "detail": "Coats boots in thick tar, slowing everyone to a crawl inside kill zones.",
    "counters": "Fire (risky), detour",
    "grade": "C",
    "types": [
      "bind",
      "pit"
    ],
    "comboIds": [
      "TPC05"
    ]
  },
  {
    "id": "N094",
    "category": "standard",
    "subcategory": "Puzzles & Trials",
    "name": "Idol Weight Pedestal",
    "detail": "Lifting the treasure triggers a lethal chain reaction like a rolling boulder.",
    "counters": "Swap with equal-weight sandbag",
    "grade": "C",
    "types": [
      "mind",
      "phys"
    ],
    "comboIds": [
      "TPC08"
    ]
  },
  {
    "id": "N095",
    "category": "standard",
    "subcategory": "Puzzles & Trials",
    "name": "Letter Tile Gauntlet",
    "detail": "Only tiles spelling the riddle's answer hold weight; wrong letters collapse.",
    "counters": "Solve riddle, tap tiles first",
    "grade": "C",
    "types": [
      "mind",
      "pit"
    ],
    "comboIds": []
  },
  {
    "id": "N096",
    "category": "standard",
    "subcategory": "Puzzles & Trials",
    "name": "Invisible Bridge",
    "detail": "An unseen narrow bridge over an abyss that only rewards steady nerve or reveal tricks.",
    "counters": "Scatter sand, True Sight",
    "grade": "C",
    "types": [
      "pit",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N097",
    "category": "standard",
    "subcategory": "Puzzles & Trials",
    "name": "False Door",
    "detail": "Opening the fake door fires spears or collapses the frame while the real exit stays hidden.",
    "counters": "Search secret door, open at range",
    "grade": "D",
    "types": [
      "phys",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N098",
    "category": "standard",
    "subcategory": "Puzzles & Trials",
    "name": "Timed Trial Vault",
    "detail": "Doors lock as gas leaks in; pay items, blood, or solve the puzzle to escape.",
    "counters": "Decide fast, sacrifice loot",
    "grade": "B",
    "types": [
      "mind",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N099",
    "category": "standard",
    "subcategory": "Split & Isolation",
    "name": "Drop Net",
    "detail": "Releases a weighted rope net from above to entangle and halt intruders.",
    "counters": "Slash, Strength",
    "grade": "D",
    "types": [
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N100",
    "category": "standard",
    "subcategory": "Split & Isolation",
    "name": "Slamming Portcullis",
    "detail": "Drops heavy iron bars behind the vanguard, splitting the party in two.",
    "counters": "Lift with Str, find winch",
    "grade": "C",
    "types": [
      "bind",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N101",
    "category": "standard",
    "subcategory": "Split & Isolation",
    "name": "Monster House",
    "detail": "Doors slam shut as hidden monsters pour out from every wall alcove.",
    "counters": "AoE spells, escape scroll",
    "grade": "B",
    "types": [
      "phys",
      "mind"
    ],
    "comboIds": [
      "TPC09"
    ]
  },
  {
    "id": "N102",
    "category": "standard",
    "subcategory": "Split & Isolation",
    "name": "Solo Trial Gate",
    "detail": "A narrow gate admits only one adventurer into an isolated duel chamber.",
    "counters": "Send strongest duelist",
    "grade": "C",
    "types": [
      "bind",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N103",
    "category": "standard",
    "subcategory": "Split & Isolation",
    "name": "Revolving Partition",
    "detail": "Swings a hidden wall panel to whisk one hero into a separate corridor.",
    "counters": "Tie party with rope, wedge wall",
    "grade": "C",
    "types": [
      "bind",
      "mind"
    ],
    "comboIds": [
      "TPC13"
    ]
  },
  {
    "id": "N104",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Summoning Circle",
    "detail": "Materializes four hostile monsters surrounding whoever steps on the glyph.",
    "counters": "Detect, AoE cleave",
    "grade": "C",
    "types": [
      "curse",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N105",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Animated Hoard",
    "detail": "Animates every weapon, chest, and relic in the room into hostile mimics.",
    "counters": "Grab fast, dispel",
    "grade": "C",
    "types": [
      "curse",
      "mutate"
    ],
    "comboIds": []
  },
  {
    "id": "N106",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Hornet Nest Drop",
    "detail": "Drops a giant hive that unleashes swarming wasps stinging every turn.",
    "counters": "Smoke, fire",
    "grade": "D",
    "types": [
      "parasite",
      "poison"
    ],
    "comboIds": []
  },
  {
    "id": "N107",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Scarab Swarm Vent",
    "detail": "Wall chutes pour out flesh-eating scarabs that gnaw relentlessly.",
    "counters": "Fire, water, flee",
    "grade": "C",
    "types": [
      "parasite",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N108",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Translucent Jelly Cube",
    "detail": "A corridor-filling clear ooze engulfs anyone walking blindly forward.",
    "counters": "Toss pebble to test, fire",
    "grade": "C",
    "types": [
      "bind",
      "poison"
    ],
    "comboIds": [
      "TPC11"
    ]
  },
  {
    "id": "N109",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Man-Eating Flytrap",
    "detail": "Snaps shut on smaller targets to swallow them whole.",
    "counters": "Large units, burn it",
    "grade": "C",
    "types": [
      "phys",
      "bind"
    ],
    "comboIds": []
  },
  {
    "id": "N110",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Necro-Rise Circle",
    "detail": "Reanimates fallen intruders as undead thralls to attack their surviving friends.",
    "counters": "Holy water, secure bodies",
    "grade": "B",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N111",
    "category": "standard",
    "subcategory": "Summons & Swarms",
    "name": "Treasure Beetle Swarm",
    "detail": "Insects disguised as gold coins and gems bite greedy hands.",
    "counters": "Appraise, shake off",
    "grade": "D",
    "types": [
      "parasite",
      "mind"
    ],
    "comboIds": []
  },
  {
    "id": "N112",
    "category": "standard",
    "subcategory": "Attrition & Gear Ruin",
    "name": "Rust Mist Vent",
    "detail": "Corrodes weapons and armor, stripping enhancement bonuses on contact.",
    "counters": "Anti-rust oil, unequip metal",
    "grade": "C",
    "types": [
      "cloth",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N113",
    "category": "standard",
    "subcategory": "Attrition & Gear Ruin",
    "name": "Disarming Gale",
    "detail": "Blasts equipped weapons and armor flying into random corners of the room.",
    "counters": "Detect, carry backup weapon",
    "grade": "C",
    "types": [
      "cloth",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N114",
    "category": "standard",
    "subcategory": "Attrition & Gear Ruin",
    "name": "Tripwire Spill",
    "detail": "Trips runners and scatters potions and rations across the stones, shattering vials.",
    "counters": "Strap pack tight",
    "grade": "D",
    "types": [
      "phys",
      "cloth"
    ],
    "comboIds": []
  },
  {
    "id": "N115",
    "category": "standard",
    "subcategory": "Attrition & Gear Ruin",
    "name": "Blight Spoilage Ward",
    "detail": "Rots carried rations instantly and accelerates hunger.",
    "counters": "Spare food, preserve spell",
    "grade": "D",
    "types": [
      "poison",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N116",
    "category": "standard",
    "subcategory": "Attrition & Gear Ruin",
    "name": "Lodestone Ceiling",
    "detail": "Powerful ceiling magnets yank metal weapons and plate armor straight upward.",
    "counters": "Non-metal gear, grip tight",
    "grade": "C",
    "types": [
      "phys",
      "cloth"
    ],
    "comboIds": []
  },
  {
    "id": "N117",
    "category": "standard",
    "subcategory": "Alarms & Escalation",
    "name": "Alarm Chest",
    "detail": "Opening the chest blares sirens that lock exits and summon floor patrols.",
    "counters": "Detect, muffle bell, escape scroll",
    "grade": "C",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": [
      "TPC09"
    ]
  },
  {
    "id": "N118",
    "category": "standard",
    "subcategory": "Alarms & Escalation",
    "name": "Frenzy Totem",
    "detail": "Enrages every monster in the chamber, sharply boosting their attack power.",
    "counters": "Silence, isolate",
    "grade": "C",
    "types": [
      "mind",
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N119",
    "category": "standard",
    "subcategory": "Alarms & Escalation",
    "name": "Trap-Proliferation Rune",
    "detail": "Seeds additional hidden traps across the entire floor once triggered.",
    "counters": "Find Traps spell",
    "grade": "B",
    "types": [
      "curse",
      "mind"
    ],
    "comboIds": [
      "TPC14"
    ]
  },
  {
    "id": "N120",
    "category": "standard",
    "subcategory": "Alarms & Escalation",
    "name": "Chrono Crystal",
    "detail": "Accelerates reset timers on nearby traps so they fire twice as fast.",
    "counters": "Shatter crystal",
    "grade": "B",
    "types": [
      "curse"
    ],
    "comboIds": []
  },
  {
    "id": "N121",
    "category": "standard",
    "subcategory": "Alarms & Escalation",
    "name": "Rift Barrier",
    "detail": "Blocks the path with an arcane wall while amplifying all nearby trap damage.",
    "counters": "Focus-fire barrier first",
    "grade": "C",
    "types": [
      "curse",
      "phys"
    ],
    "comboIds": []
  },
  {
    "id": "N122",
    "category": "standard",
    "subcategory": "Alarms & Escalation",
    "name": "Lure Decoy",
    "detail": "Draws monster aggro or hero focus straight into the deadliest kill box.",
    "counters": "See through, ignore",
    "grade": "D",
    "types": [
      "mind"
    ],
    "comboIds": []
  }
];

export const CODEX_COMBOS: CodexComboEntry[] = [
  {
    "id": "TPC01",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Oil-Slick Floor + Flame Statue",
    "detail": "Oil-drenched victims take massive bonus fire damage as flames race across the entire floor.",
    "roomSynergy": "A",
    "memberIds": [
      "N041",
      "N036"
    ],
    "memberNames": [
      "Oil-Slick Floor",
      "Flame Statue"
    ],
    "roomSlots": [
      {
        "name": "Oil-Slick Floor",
        "detail": "Slick oil knocks heroes down and coats them, massively amplifying incoming fire damage.",
        "category": "standard",
        "grade": "B",
        "types": [
          "fire",
          "pit"
        ]
      },
      {
        "name": "Flame Statue",
        "detail": "Stepping on a plate makes the stone idol belch a roaring cone of fire.",
        "category": "standard",
        "grade": "C",
        "types": [
          "fire"
        ]
      }
    ],
    "types": [
      "fire",
      "pit"
    ]
  },
  {
    "id": "TPC02",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Rapids Channel + Electrified Pool",
    "detail": "Soaked party members are hit all at once by surging high-voltage arcs.",
    "roomSynergy": "A",
    "memberIds": [
      "N051",
      "N063"
    ],
    "memberNames": [
      "Rapids Channel",
      "Electrified Pool"
    ],
    "roomSlots": [
      {
        "name": "Rapids Channel",
        "detail": "Raging currents sweep targets helplessly into adjacent rooms or deeper hazards.",
        "category": "standard",
        "grade": "C",
        "types": [
          "water",
          "pit"
        ]
      },
      {
        "name": "Electrified Pool",
        "detail": "Sends lethal high-voltage current surging through everyone standing in the water.",
        "category": "standard",
        "grade": "B",
        "types": [
          "elec",
          "water"
        ]
      }
    ],
    "types": [
      "water",
      "pit",
      "elec"
    ]
  },
  {
    "id": "TPC03",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Shoving Wall + Spike Pit",
    "detail": "Shoves targets precisely onto the spike pit mouth in classic dungeon combo fashion.",
    "roomSynergy": "B",
    "memberIds": [
      "N004",
      "N014"
    ],
    "memberNames": [
      "Shoving Wall",
      "Spike Pit"
    ],
    "roomSlots": [
      {
        "name": "Shoving Wall",
        "detail": "A spring-loaded wall panel slams intruders 3–5 tiles forward straight into the next trap.",
        "category": "standard",
        "grade": "C",
        "types": [
          "phys"
        ]
      },
      {
        "name": "Spike Pit",
        "detail": "Lined with iron spikes at the bottom, adding piercing damage to the fall.",
        "category": "standard",
        "grade": "C",
        "types": [
          "pit",
          "phys"
        ]
      }
    ],
    "types": [
      "phys",
      "pit"
    ]
  },
  {
    "id": "TPC04",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Springboard Tile + Ceiling Hammer",
    "detail": "Catapults targets straight upward into a crushing ceiling hammer blow.",
    "roomSynergy": "B",
    "memberIds": [
      "N005",
      "N006"
    ],
    "memberNames": [
      "Springboard Tile",
      "Ceiling Hammer"
    ],
    "roomSlots": [
      {
        "name": "Springboard Tile",
        "detail": "Catapults lightweight heroes skyward for fall damage or launches them into another hazard.",
        "category": "standard",
        "grade": "D",
        "types": [
          "phys",
          "pit"
        ]
      },
      {
        "name": "Ceiling Hammer",
        "detail": "A massive overhead stone block slams down for heavy damage and stun.",
        "category": "standard",
        "grade": "C",
        "types": [
          "phys"
        ]
      }
    ],
    "types": [
      "phys",
      "pit"
    ]
  },
  {
    "id": "TPC05",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Tar Mire Floor + Pendulum Blades",
    "detail": "Tar-slowed footsteps cannot possibly dodge the sweeping pendulum rhythm.",
    "roomSynergy": "B",
    "memberIds": [
      "N093",
      "N025"
    ],
    "memberNames": [
      "Tar Mire Floor",
      "Pendulum Blades"
    ],
    "roomSlots": [
      {
        "name": "Tar Mire Floor",
        "detail": "Coats boots in thick tar, slowing everyone to a crawl inside kill zones.",
        "category": "standard",
        "grade": "C",
        "types": [
          "bind",
          "pit"
        ]
      },
      {
        "name": "Pendulum Blades",
        "detail": "Crescent scythes sweep across the corridor in a steady lethal rhythm.",
        "category": "standard",
        "grade": "C",
        "types": [
          "phys"
        ]
      }
    ],
    "types": [
      "bind",
      "pit",
      "phys"
    ]
  },
  {
    "id": "TPC06",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Glacial Slide Floor + Arrow Wall",
    "detail": "Unstoppable ice slides deliver intruders straight into the arrow firing line.",
    "roomSynergy": "B",
    "memberIds": [
      "N050",
      "N022"
    ],
    "memberNames": [
      "Glacial Slide Floor",
      "Arrow Wall"
    ],
    "roomSlots": [
      {
        "name": "Glacial Slide Floor",
        "detail": "Frictionless ice forces intruders to slide nonstop until slamming into a wall or trap.",
        "category": "standard",
        "grade": "C",
        "types": [
          "ice",
          "pit"
        ]
      },
      {
        "name": "Arrow Wall",
        "detail": "Volleys of arrows erupt simultaneously from concealed wall slits.",
        "category": "standard",
        "grade": "C",
        "types": [
          "phys"
        ]
      }
    ],
    "types": [
      "ice",
      "pit",
      "phys"
    ]
  },
  {
    "id": "TPC07",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Snuffing Gust + Dust Explosion Chamber",
    "detail": "Snuffing arcane light forces heroes to strike a torch—igniting the explosive dust cloud.",
    "roomSynergy": "A",
    "memberIds": [
      "N085",
      "N045"
    ],
    "memberNames": [
      "Snuffing Gust",
      "Dust Explosion Chamber"
    ],
    "roomSlots": [
      {
        "name": "Snuffing Gust",
        "detail": "Extinguishes all torches, spiking dread and boosting monster ambush odds.",
        "category": "standard",
        "grade": "D",
        "types": [
          "mind"
        ]
      },
      {
        "name": "Dust Explosion Chamber",
        "detail": "Airborne flour and coal dust ignites catastrophically at the slightest open torch flame.",
        "category": "standard",
        "grade": "B",
        "types": [
          "fire",
          "poison"
        ]
      }
    ],
    "types": [
      "mind",
      "fire",
      "poison"
    ]
  },
  {
    "id": "TPC08",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Idol Weight Pedestal + Rolling Boulder + Snapping Bridge",
    "detail": "Lifting the idol triggers a boulder chase ending on a collapsing bridge.",
    "roomSynergy": "A",
    "memberIds": [
      "N094",
      "N001",
      "N018"
    ],
    "memberNames": [
      "Idol Weight Pedestal",
      "Rolling Boulder",
      "Snapping Bridge"
    ],
    "roomSlots": [
      {
        "name": "Idol Weight Pedestal",
        "detail": "Lifting the treasure triggers a lethal chain reaction like a rolling boulder.",
        "category": "standard",
        "grade": "C",
        "types": [
          "mind",
          "phys"
        ]
      },
      {
        "name": "Rolling Boulder",
        "detail": "Stepping on a plate releases a massive boulder down a sloped hall, crushing everyone in line.",
        "category": "standard",
        "grade": "C",
        "types": [
          "phys"
        ]
      },
      {
        "name": "Snapping Bridge",
        "detail": "Collapses the instant combined weight crosses its load limit.",
        "category": "standard",
        "grade": "C",
        "types": [
          "pit"
        ]
      }
    ],
    "types": [
      "mind",
      "phys",
      "pit"
    ]
  },
  {
    "id": "TPC09",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Alarm Chest + Anti-Magic Seal Ward + Monster House",
    "detail": "Doors lock, spells fail, and monster swarms pour in from every corner.",
    "roomSynergy": "A",
    "memberIds": [
      "N117",
      "N071",
      "N101"
    ],
    "memberNames": [
      "Alarm Chest",
      "Anti-Magic Seal Ward",
      "Monster House"
    ],
    "roomSlots": [
      {
        "name": "Alarm Chest",
        "detail": "Opening the chest blares sirens that lock exits and summon floor patrols.",
        "category": "standard",
        "grade": "C",
        "types": [
          "mind",
          "curse"
        ]
      },
      {
        "name": "Anti-Magic Seal Ward",
        "detail": "Suppresses all spellcasting and teleportation items inside the chamber.",
        "category": "standard",
        "grade": "B",
        "types": [
          "curse",
          "mind"
        ]
      },
      {
        "name": "Monster House",
        "detail": "Doors slam shut as hidden monsters pour out from every wall alcove.",
        "category": "standard",
        "grade": "B",
        "types": [
          "phys",
          "mind"
        ]
      }
    ],
    "types": [
      "mind",
      "curse",
      "phys"
    ]
  },
  {
    "id": "TPC10",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Acid Shower + Lightning Strike Rune",
    "detail": "Corrosive acid strips away armor before lightning finishes the exposed target.",
    "roomSynergy": "A",
    "memberIds": [
      "N057",
      "N062"
    ],
    "memberNames": [
      "Acid Shower",
      "Lightning Strike Rune"
    ],
    "roomSlots": [
      {
        "name": "Acid Shower",
        "detail": "Ceiling vents spray corrosive acid that burns flesh and eats away armor durability.",
        "category": "standard",
        "grade": "B",
        "types": [
          "poison",
          "cloth"
        ]
      },
      {
        "name": "Lightning Strike Rune",
        "detail": "Calls down a bolt of lightning—extra lethal against metal plate armor.",
        "category": "standard",
        "grade": "C",
        "types": [
          "elec"
        ]
      }
    ],
    "types": [
      "poison",
      "cloth",
      "elec"
    ]
  },
  {
    "id": "TPC11",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Anesthetic Gas + Translucent Jelly Cube",
    "detail": "While sleep gas knocks the party out, the silent jelly cube engulfs them.",
    "roomSynergy": "B",
    "memberIds": [
      "N056",
      "N108"
    ],
    "memberNames": [
      "Anesthetic Gas",
      "Translucent Jelly Cube"
    ],
    "roomSlots": [
      {
        "name": "Anesthetic Gas",
        "detail": "Puts the entire party to sleep for several turns, leaving them utterly defenseless.",
        "category": "standard",
        "grade": "B",
        "types": [
          "poison",
          "mind"
        ]
      },
      {
        "name": "Translucent Jelly Cube",
        "detail": "A corridor-filling clear ooze engulfs anyone walking blindly forward.",
        "category": "standard",
        "grade": "C",
        "types": [
          "bind",
          "poison"
        ]
      }
    ],
    "types": [
      "poison",
      "mind",
      "bind"
    ]
  },
  {
    "id": "TPC12",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Forged Explorer Note + Illusory Floor",
    "detail": "'Safe path this way' leads directly across an illusory floor over a pit.",
    "roomSynergy": "B",
    "memberIds": [
      "N086",
      "N082"
    ],
    "memberNames": [
      "Forged Explorer Note",
      "Illusory Floor"
    ],
    "roomSlots": [
      {
        "name": "Forged Explorer Note",
        "detail": "Planting fake 'safe path' tips from past adventurers leads parties straight into danger.",
        "category": "standard",
        "grade": "D",
        "types": [
          "mind"
        ]
      },
      {
        "name": "Illusory Floor",
        "detail": "Projects solid stone over an open pitfall to fool rushing scouts.",
        "category": "standard",
        "grade": "C",
        "types": [
          "mind",
          "pit"
        ]
      }
    ],
    "types": [
      "mind",
      "pit"
    ]
  },
  {
    "id": "TPC13",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Revolving Partition + Doppelganger Ally",
    "detail": "The revolving wall splits the party just long enough for a doppelganger to slip in.",
    "roomSynergy": "B",
    "memberIds": [
      "N103",
      "E133"
    ],
    "memberNames": [
      "Revolving Partition",
      "Doppelganger Ally"
    ],
    "roomSlots": [
      {
        "name": "Revolving Partition",
        "detail": "Swings a hidden wall panel to whisk one hero into a separate corridor.",
        "category": "standard",
        "grade": "C",
        "types": [
          "bind",
          "mind"
        ]
      },
      {
        "name": "Doppelganger Ally",
        "detail": "Clones a party member and slips into formation to sabotage from within.",
        "category": "ero",
        "grade": "B",
        "types": [
          "mind",
          "mutate"
        ]
      }
    ],
    "types": [
      "bind",
      "mind",
      "mutate"
    ]
  },
  {
    "id": "TPC14",
    "comboCategory": "standard",
    "category": "standard",
    "name": "Random Warp Pad + Trap-Proliferation Rune",
    "detail": "Teleports a lone straggler straight into a proliferated minefield of traps.",
    "roomSynergy": "B",
    "memberIds": [
      "N087",
      "N119"
    ],
    "memberNames": [
      "Random Warp Pad",
      "Trap-Proliferation Rune"
    ],
    "roomSlots": [
      {
        "name": "Random Warp Pad",
        "detail": "Teleports victims to random isolated spots across the floor.",
        "category": "standard",
        "grade": "C",
        "types": [
          "curse",
          "pit"
        ]
      },
      {
        "name": "Trap-Proliferation Rune",
        "detail": "Seeds additional hidden traps across the entire floor once triggered.",
        "category": "standard",
        "grade": "B",
        "types": [
          "curse",
          "mind"
        ]
      }
    ],
    "types": [
      "curse",
      "pit",
      "mind"
    ]
  },
  {
    "id": "TPC15",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Aphrodisiac Gas Chamber + Narrow Wall Wedging",
    "detail": "Fleeing the pink gas through a narrow escape hole leaves the victim stuck waist-deep.",
    "roomSynergy": "A",
    "memberIds": [
      "E076",
      "E051"
    ],
    "memberNames": [
      "Aphrodisiac Gas Chamber",
      "Narrow Wall Wedging"
    ],
    "roomSlots": [
      {
        "name": "Aphrodisiac Gas Chamber",
        "detail": "Doors lock as pink mist fills the room; failing Will checks each turn builds heat.",
        "category": "ero",
        "grade": "B",
        "types": [
          "poison",
          "lewd",
          "mind"
        ]
      },
      {
        "name": "Narrow Wall Wedging",
        "detail": "Fleeing a gas-filled room through a tight crawlspace leaves the victim stuck waist-deep between rooms.",
        "category": "ero",
        "grade": "B",
        "types": [
          "bind",
          "lewd"
        ]
      }
    ],
    "types": [
      "poison",
      "lewd",
      "mind",
      "bind"
    ]
  },
  {
    "id": "TPC16",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Cloth-Dissolving Slime + Public Hall Pillory",
    "detail": "Stripped bare by slime and locked in the center hall pillory for public display.",
    "roomSynergy": "A",
    "memberIds": [
      "E018",
      "E052"
    ],
    "memberNames": [
      "Cloth-Dissolving Slime",
      "Public Hall Pillory"
    ],
    "roomSlots": [
      {
        "name": "Cloth-Dissolving Slime",
        "detail": "Dissolves only cloth and leather without harming skin, slashing defense while raising shame.",
        "category": "ero",
        "grade": "C",
        "types": [
          "cloth",
          "lewd"
        ]
      },
      {
        "name": "Public Hall Pillory",
        "detail": "Locks neck and wrists in the center of the hall where passing monsters freely tease the captive.",
        "category": "ero",
        "grade": "B",
        "types": [
          "bind",
          "lewd"
        ]
      }
    ],
    "types": [
      "cloth",
      "lewd",
      "bind"
    ]
  },
  {
    "id": "TPC17",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Lactation Elixir + Mana Milking Rig",
    "detail": "Alters constitution first so the milking rig drains maximum essence into dungeon MP.",
    "roomSynergy": "A",
    "memberIds": [
      "E080",
      "E037"
    ],
    "memberNames": [
      "Lactation Elixir",
      "Mana Milking Rig"
    ],
    "roomSlots": [
      {
        "name": "Lactation Elixir",
        "detail": "Alters body constitution to produce milk—deadly when paired with a milking rig.",
        "category": "ero",
        "grade": "C",
        "types": [
          "mutate",
          "poison",
          "lewd"
        ]
      },
      {
        "name": "Mana Milking Rig",
        "detail": "Suction cups latch on to extract milk and vital essence, converting it into dungeon MP.",
        "category": "ero",
        "grade": "B",
        "types": [
          "lewd",
          "bind",
          "mutate"
        ]
      }
    ],
    "types": [
      "mutate",
      "poison",
      "lewd",
      "bind"
    ]
  },
  {
    "id": "TPC18",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Lotion Ramp + Tentacle Pit",
    "detail": "A slick gel slide drops helpless intruders directly into a writhing tentacle nest.",
    "roomSynergy": "B",
    "memberIds": [
      "E022",
      "E003"
    ],
    "memberNames": [
      "Lotion Ramp",
      "Tentacle Pit"
    ],
    "roomSlots": [
      {
        "name": "Lotion Ramp",
        "detail": "A frictionless gel slope sends anyone who slips sliding straight into the next trap.",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "pit"
        ]
      },
      {
        "name": "Tentacle Pit",
        "detail": "A covered pit concealing a tentacle nest that binds anyone who falls in until hauled out.",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "bind",
          "pit"
        ]
      }
    ],
    "types": [
      "lewd",
      "pit",
      "bind"
    ]
  },
  {
    "id": "TPC19",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Sensory-Cutoff Hood + Tickle Brush Waterwheel",
    "detail": "Blind and deafened, captives are forced through the relentless tickle wheel.",
    "roomSynergy": "B",
    "memberIds": [
      "E111",
      "E031"
    ],
    "memberNames": [
      "Sensory-Cutoff Hood",
      "Tickle Brush Waterwheel"
    ],
    "roomSlots": [
      {
        "name": "Sensory-Cutoff Hood",
        "detail": "Blinds sight and muffles hearing, amplifying every remaining touch tenfold.",
        "category": "ero",
        "grade": "C",
        "types": [
          "bind",
          "lewd",
          "mind"
        ]
      },
      {
        "name": "Tickle Brush Waterwheel",
        "detail": "A spinning bristle wheel blocks the passage, tickling anyone passing through at rising speed.",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "phys",
          "bind"
        ]
      }
    ],
    "types": [
      "bind",
      "lewd",
      "mind",
      "phys"
    ]
  },
  {
    "id": "TPC20",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Orgasm Denial Curse + Vibrating Stocks",
    "detail": "Denies release while nonstop vibration erodes the captive's last shreds of will.",
    "roomSynergy": "A",
    "memberIds": [
      "E103",
      "E032"
    ],
    "memberNames": [
      "Orgasm Denial Curse",
      "Vibrating Stocks"
    ],
    "roomSlots": [
      {
        "name": "Orgasm Denial Curse",
        "detail": "Blocks release while locking arousal near maximum, crippling accuracy and focus.",
        "category": "ero",
        "grade": "B",
        "types": [
          "curse",
          "lewd"
        ]
      },
      {
        "name": "Vibrating Stocks",
        "detail": "Locks limbs in place and vibrates nonstop, chipping away willpower every turn.",
        "category": "ero",
        "grade": "C",
        "types": [
          "bind",
          "lewd"
        ]
      }
    ],
    "types": [
      "curse",
      "lewd",
      "bind"
    ]
  },
  {
    "id": "TPC21",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Charm Betrayal + X-Frame Restraint",
    "detail": "A charmed party member willingly straps their own teammates into X-frame restraints.",
    "roomSynergy": "A",
    "memberIds": [
      "E123",
      "E053"
    ],
    "memberNames": [
      "Charm Betrayal",
      "X-Frame Restraint"
    ],
    "roomSlots": [
      {
        "name": "Charm Betrayal",
        "detail": "Charms one party member into stripping and tying up their own teammates.",
        "category": "ero",
        "grade": "B",
        "types": [
          "mind",
          "bind",
          "lewd"
        ]
      },
      {
        "name": "X-Frame Restraint",
        "detail": "Spreads and locks all four limbs to an X-frame, priming the victim for follow-up devices.",
        "category": "ero",
        "grade": "C",
        "types": [
          "bind",
          "lewd"
        ]
      }
    ],
    "types": [
      "mind",
      "bind",
      "lewd"
    ]
  },
  {
    "id": "TPC22",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Dungeon Stream Crystal + Audience Vote Panel",
    "detail": "Monster viewers vote on the next trap while donation tips ramp up the intensity.",
    "roomSynergy": "B",
    "memberIds": [
      "E139",
      "E148"
    ],
    "memberNames": [
      "Dungeon Stream Crystal",
      "Audience Vote Panel"
    ],
    "roomSlots": [
      {
        "name": "Dungeon Stream Crystal",
        "detail": "Broadcasts the party live to monster viewers; higher tips escalate trap intensity.",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "mind"
        ]
      },
      {
        "name": "Audience Vote Panel",
        "detail": "Monster spectators vote live on which trap and target fires next.",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "mind"
        ]
      }
    ],
    "types": [
      "lewd",
      "mind"
    ]
  },
  {
    "id": "TPC23",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Hypnosis Sigil + 'Cannot Leave Unless...' Room",
    "detail": "Enters the condition-lock room already hypnotized into total obedience.",
    "roomSynergy": "A",
    "memberIds": [
      "E098",
      "E167"
    ],
    "memberNames": [
      "Hypnosis Sigil",
      "'Cannot Leave Unless...' Room"
    ],
    "roomSlots": [
      {
        "name": "Hypnosis Sigil",
        "detail": "Stepping on the glyph glazes the eyes and inflicts instant obedience.",
        "category": "ero",
        "grade": "B",
        "types": [
          "mind",
          "lewd"
        ]
      },
      {
        "name": "'Cannot Leave Unless...' Room",
        "detail": "Doors seal until entrants perform the carved lewd condition (kiss, hug, confess...).",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "mind"
        ]
      }
    ],
    "types": [
      "mind",
      "lewd"
    ]
  },
  {
    "id": "TPC24",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Sensitivity Multiplier + Groping Corridor",
    "detail": "Stacks sensitivity multipliers right before forcing a walk down the groping hall.",
    "roomSynergy": "B",
    "memberIds": [
      "E077",
      "E005"
    ],
    "memberNames": [
      "Sensitivity Multiplier",
      "Groping Corridor"
    ],
    "roomSlots": [
      {
        "name": "Sensitivity Multiplier",
        "detail": "Stacks a lasting sensitivity multiplier on each hit until the party leaves the dungeon.",
        "category": "ero",
        "grade": "B",
        "types": [
          "lewd",
          "curse"
        ]
      },
      {
        "name": "Groping Corridor",
        "detail": "Hands and tentacles reach out from narrow walls to grope passersby and strip gear piece by piece.",
        "category": "ero",
        "grade": "C",
        "types": [
          "lewd",
          "cloth"
        ]
      }
    ],
    "types": [
      "lewd",
      "curse",
      "cloth"
    ]
  },
  {
    "id": "TPC25",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Fake Save Circle + Succubus Dream Chamber",
    "detail": "Lowering guard at the fake sanctuary launches a lingering succubus dream raid.",
    "roomSynergy": "B",
    "memberIds": [
      "E132",
      "E127"
    ],
    "memberNames": [
      "Fake Save Circle",
      "Succubus Dream Chamber"
    ],
    "roomSlots": [
      {
        "name": "Fake Save Circle",
        "detail": "Glows like a sanctuary checkpoint, ambushing anyone who lets their guard down to rest.",
        "category": "ero",
        "grade": "C",
        "types": [
          "mind",
          "bind"
        ]
      },
      {
        "name": "Succubus Dream Chamber",
        "detail": "Sleeping in this cozy room launches a dream raid whose penalties carry into waking.",
        "category": "ero",
        "grade": "B",
        "types": [
          "mind",
          "lewd"
        ]
      }
    ],
    "types": [
      "mind",
      "bind",
      "lewd"
    ]
  },
  {
    "id": "TPC26",
    "comboCategory": "ero",
    "category": "ero",
    "name": "Forced Costume Circle + Updraft Floor Vent",
    "detail": "Swaps armor for flimsy bunny/maid skirts right over upward floor wind vents.",
    "roomSynergy": "B",
    "memberIds": [
      "E070",
      "E073"
    ],
    "memberNames": [
      "Forced Costume Circle",
      "Updraft Floor Vent"
    ],
    "roomSlots": [
      {
        "name": "Forced Costume Circle",
        "detail": "Magic circle swaps armor into maid or bunny outfits and recalculates stats to match.",
        "category": "ero",
        "grade": "C",
        "types": [
          "cloth",
          "curse",
          "lewd"
        ]
      },
      {
        "name": "Updraft Floor Vent",
        "detail": "Floor vents blast upward gusts that flip cloaks and skirts, staggering victims with shame.",
        "category": "ero",
        "grade": "D",
        "types": [
          "cloth",
          "lewd"
        ]
      }
    ],
    "types": [
      "cloth",
      "curse",
      "lewd"
    ]
  },
  {
    "id": "TPC27",
    "comboCategory": "mixed",
    "category": "ero",
    "name": "Adhesive Gel Floor + Auto-Crossbow Turret",
    "detail": "Adhesive floor glues victims in place while turret bolts—or pink ray blasts—rain down.",
    "roomSynergy": "B",
    "memberIds": [
      "E023",
      "N033"
    ],
    "memberNames": [
      "Adhesive Gel Floor",
      "Auto-Crossbow Turret"
    ],
    "roomSlots": [
      {
        "name": "Adhesive Gel Floor",
        "detail": "Traps footsteps on contact; struggling only spreads the sticky residue further.",
        "category": "ero",
        "grade": "C",
        "types": [
          "bind",
          "lewd"
        ]
      },
      {
        "name": "Auto-Crossbow Turret",
        "detail": "A fixed repeating turret fires aimed bolts down long sightlines.",
        "category": "standard",
        "grade": "C",
        "types": [
          "phys"
        ]
      }
    ],
    "types": [
      "bind",
      "lewd",
      "phys"
    ]
  },
  {
    "id": "TPC28",
    "comboCategory": "mixed",
    "category": "ero",
    "name": "Lower-Floor Chute + Dungeon Cell Chute",
    "detail": "Dropping through one chute lands directly onto a second trapdoor straight into the cells.",
    "roomSynergy": "A",
    "memberIds": [
      "N016",
      "E060"
    ],
    "memberNames": [
      "Lower-Floor Chute",
      "Dungeon Cell Chute"
    ],
    "roomSlots": [
      {
        "name": "Lower-Floor Chute",
        "detail": "The floor drops away to send victims tumbling to a lower floor, splitting the party.",
        "category": "standard",
        "grade": "B",
        "types": [
          "pit"
        ]
      },
      {
        "name": "Dungeon Cell Chute",
        "detail": "A trapdoor pit dropping straight into the prison cells, capturing anyone who falls.",
        "category": "ero",
        "grade": "B",
        "types": [
          "pit",
          "bind"
        ]
      }
    ],
    "types": [
      "pit",
      "bind"
    ]
  },
  {
    "id": "TPC29",
    "comboCategory": "mixed",
    "category": "ero",
    "name": "Illusory Floor + Sensory-Cutoff Pit",
    "detail": "Solid-looking stone gives way into a waist-deep sensory-cutoff pit.",
    "roomSynergy": "B",
    "memberIds": [
      "N082",
      "E061"
    ],
    "memberNames": [
      "Illusory Floor",
      "Sensory-Cutoff Pit"
    ],
    "roomSlots": [
      {
        "name": "Illusory Floor",
        "detail": "Projects solid stone over an open pitfall to fool rushing scouts.",
        "category": "standard",
        "grade": "C",
        "types": [
          "mind",
          "pit"
        ]
      },
      {
        "name": "Sensory-Cutoff Pit",
        "detail": "Waist-deep trap hole that numbs the lower half while stacking stimuli to burst upon escape.",
        "category": "ero",
        "grade": "B",
        "types": [
          "pit",
          "bind",
          "lewd"
        ]
      }
    ],
    "types": [
      "mind",
      "pit",
      "bind",
      "lewd"
    ]
  }
];

const CODEX_TRAP_MAP = new Map<string, CodexTrapEntry>(CODEX_TRAPS.map((t) => [t.id, t]));
const CODEX_COMBO_MAP = new Map<string, CodexComboEntry>(CODEX_COMBOS.map((c) => [c.id, c]));

export function getCodexTrapById(id: string): CodexTrapEntry | undefined {
  return CODEX_TRAP_MAP.get(id);
}

export function getCodexComboById(id: string): CodexComboEntry | undefined {
  return CODEX_COMBO_MAP.get(id);
}

export function getCombosForCodexTrap(codexId: string): CodexComboEntry[] {
  const entry = CODEX_TRAP_MAP.get(codexId);
  if (!entry) return [];
  return entry.comboIds
    .map((cid) => CODEX_COMBO_MAP.get(cid))
    .filter((c): c is CodexComboEntry => Boolean(c));
}

export function codexTrapToBlueprint(
  entry: CodexTrapEntry,
  opts?: { deployAsPending?: boolean; customId?: string; pinned?: boolean }
): TrapBlueprint {
  const now = Date.now();
  return {
    id: opts?.customId ?? `codex_${entry.id}`,
    codexId: entry.id,
    kind: 'trap',
    name: entry.name,
    detail: entry.detail,
    category: entry.category,
    grade: opts?.deployAsPending ? '?' : entry.grade,
    types: [...entry.types],
    notes: `[${entry.subcategory}] Counters: ${entry.counters}`,
    pinned: opts?.pinned ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function codexComboToBlueprint(
  combo: CodexComboEntry,
  opts?: { deployAsPending?: boolean; customId?: string; pinned?: boolean }
): TrapBlueprint {
  const now = Date.now();
  return {
    id: opts?.customId ?? `codex_${combo.id}`,
    codexId: combo.id,
    kind: 'room',
    name: combo.name,
    detail: combo.detail,
    category: combo.category,
    grade: opts?.deployAsPending ? '?' : combo.roomSynergy,
    types: [...combo.types],
    roomSlots: combo.roomSlots.map((slot) => ({
      ...slot,
      grade: opts?.deployAsPending ? '?' : slot.grade,
      types: [...slot.types],
    })),
    roomSynergy: opts?.deployAsPending ? '?' : combo.roomSynergy,
    notes: `Combo (${combo.comboCategory}): ${combo.memberNames.join(' + ')}`,
    pinned: opts?.pinned ?? false,
    createdAt: now,
    updatedAt: now,
  };
}
