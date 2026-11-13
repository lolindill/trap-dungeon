import { CFG, TRAIT_MAP, TRAP_TYPES } from '../data/constants';
import { buildPrepListPayload, formatAllFloorsText } from '../engine/dungeon';
import { getGuildLevel, getGuildTierInfo } from '../engine/heroes';
import { buildRealmAndPartyPromptLine } from '../engine/realm';
import { buildPrisonRosterPromptContext } from '../engine/prison';
import type {
  AiLanguage,
  ChronicleEntry,
  DayLogLine,
  EndingKey,
  GameOverKey,
  GameState,
  Hero,
  RaidOutcome,
} from '../types/game';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const VALID_EXPRESSIONS =
  'standing, angry, bored, curious, embarrassed, joyful, lovestuck, proud, scared, smug, crying_with_eyes_closed';

export function getAiLanguage(state: GameState): AiLanguage {
  return state.settings?.aiLanguage ?? 'th';
}

function summarizeTraits(traits: string[]): string {
  return traits
    .map((key) => {
      const def = TRAIT_MAP[key];
      return def ? `${def.key} (${def.desc})` : key;
    })
    .join('; ');
}

function summarizeHeroLine(h: Hero): string {
  const conds: string[] = [];
  if (h.cond) conds.push(h.cond);
  if (h.ailment > 0) conds.push('afflicted');
  if (h.aroused) conds.push('aroused');
  const statusStr = conds.length > 0 ? ` [${conds.join(', ')}]` : '';
  return [
    `#${h.slot} ${h.name || `${h.raceLabel} ${h.classLabel}`} (${h.grade}-rank, ${h.status}${statusStr})`,
    `Gender: ${h.gender}, Race: ${h.raceLabel}, Class: ${h.classLabel}, Age: ${h.age}, Build: ${h.body}, Looks: ${h.looks}, Persona: ${h.persona}, Origin: ${h.origin}, Exp: ${h.exp}, Marital: ${h.marital}`,
    `Traits: ${summarizeTraits(h.traits) || 'None'}`,
    `Secret Kink: ${h.kinkKey} — ${h.kinkDesc}`,
    h.appearance ? `Appearance: ${h.appearance}` : '',
    h.outfit ? `Outfit: ${h.outfit}` : '',
    h.skill ? `Skill: ${h.skill}` : '',
    h.weakness ? `Weakness: ${h.weakness}` : '',
    h.intel > 0 ? `INTEL EXPOSED: Weaknesses compromised (-1 roll penalty)` : '',
  ]
    .filter(Boolean)
    .join('\n  ');
}

export function buildSystemPrompt(state: GameState): string {
  const lang = getAiLanguage(state);
  const goreInstruction = state.settings.gore
    ? 'Gore is ENABLED: lethal traps and gruesome deaths may be described graphically when an adventurer dies.'
    : 'Gore is DISABLED: keep fatal outcomes dark and tense without graphic gore or mutilation.';

  const languageRules =
    lang === 'th'
      ? [
          '- Respond in vivid, natural, atmospheric Thai (ภาษาไทย). Address the player as "นายท่าน" (or appropriate dark-fantasy Thai honorifics matching each officer’s tone).',
          '- Officer Thai voice guidance: Vesper speaks formally, calmly, and strictly; Lilim speaks playfully, teasingly, and wickedly; Eleonora speaks proudly yet loyally.',
          '- Keep all structured system/XML tags (<img="...">, <trap>, <room>, <eval>, <hero>, <eval_blueprint>), tag attribute names, trap types, grade letters (S/A/B/C/D), and <hero> field keys (name:, race:, appearance:, outfit:, personality:, skill:, weakness:, kink:) strictly in English as specified.',
        ]
      : ['- Respond in vivid, atmospheric English.'];

  return [
    'You are the Game Master and narrator of "Ero Trap Dungeon Maker", a dark-fantasy tactical dungeon management RPG.',
    'The Master (player) is the Core Master rebuilding an ancient trap dungeon beneath the frontier.',
    '',
    'Key Officers (use distinct voices):',
    '- **Vesper** (Dungeon Butler / Chief Stewardess): stern, composed dark-elf strategist who keeps ledgers, tracks Guild threats, and judges efficiency.',
    '- **Lilim** (Succubus Architect / Tactician): wicked, theatrical trap connoisseur who grades the Master’s traps on style, lewdness, and cruelty, and scouts incoming heroes.',
    '- **Eleonora** (Stewardess): proud yet loyal fallen noble assistant assisting with captives and domain affairs.',
    '',
    'Formatting & Tagging Rules:',
    ...languageRules,
    `- You may embed up to 2 sprite tags per response using strictly: <img="vesper_EXPRESSION"> or <img="lilim_EXPRESSION"> or <img="eleonora_EXPRESSION"> where EXPRESSION is one of: ${VALID_EXPRESSIONS}. Never invent character names or invalid expressions.`,
    '- Never alter HP/MP/grades arbitrarily outside the exact structured tags requested by the prompt.',
    `- ${goreInstruction}`,
    `Current Dungeon Snapshot: Wave ${state.wave} | MP: ${state.points} | Fame: ${state.fame} | Fear: ${state.fear} | Lust: ${state.lust} | Momentum: ${state.momentum}.`,
  ].join('\n');
}

export function buildPrepMessages(state: GameState): ChatMessage[] {
  const wave = state.prepMeta?.wave ?? state.wave + 1;
  const prep = buildPrepListPayload(state.floors);
  const guildLv = getGuildLevel(state, wave);
  const tier = getGuildTierInfo(wave, guildLv);

  const requiredTags: string[] = [];
  for (const tid of prep.newTrapIds) {
    requiredTags.push(
      `<trap id="${tid}" grade="S|A|B|C|D" type="type1,type2"/>`
    );
  }
  for (const fl of prep.comboFloors) {
    requiredTags.push(`<room floor="${fl}" synergy="S|A|B|C|D"/>`);
  }
  requiredTags.push(
    `<eval effectiveness="1-10" novelty="1-10" fun="1-10" aesthetics="1-10" lewdness="1-10" overall="S|A|B|C|D"/>`
  );
  for (const h of state.party) {
    requiredTags.push(
      `<hero n="${h.slot}">\nname: ...\nrace: ${h.raceLabel}\nappearance: ...\noutfit: ...\npersonality: ...\nskill: ...\nweakness: ...\nkink: ...\n</hero>`
    );
  }

  const heroSeedsText = state.party.map(summarizeHeroLine).join('\n\n');
  const realmLine = buildRealmAndPartyPromptLine(state);
  const typeList = TRAP_TYPES.join(', ');

  const userPrompt = [
    `〔DK-PREP〕 Wave ${wave} Reconnaissance & Trap Audit`,
    `Guild Threat: Lv.${guildLv} (${tier.tag} — ${tier.desc}) | Momentum: ${state.momentum} | Fame: ${state.fame}`,
    ...(realmLine ? [realmLine] : []),
    '',
    'Current Dungeon Floors:',
    formatAllFloorsText(state.floors),
    '',
    prep.newTrapIds.length > 0
      ? `Newly Installed Traps Requiring Grading: ${prep.newTrapIds.join(', ')}`
      : 'Newly Installed Traps Requiring Grading: None (all current traps are already graded or pre-rated).',
    prep.comboFloors.length > 0
      ? `Multi-Trap Rooms Requiring Combo Synergy Grade: ${prep.comboFloors.map((f) => `${f}F`).join(', ')}`
      : 'Multi-Trap Rooms Requiring Combo Synergy Grade: None.',
    '',
    'Incoming Adventurer Seeds (invent unique fantasy names—no repeats/clichés—and match every seed attribute cleanly):',
    heroSeedsText,
    '',
    'Instructions:',
    '1. Open with a short, witty dialogue between Lilim and Vesper reviewing the dungeon layout and warning the Master about the incoming party.',
    `2. Grade each newly listed trap conservatively (D..S; per-wave quota allows at most ${CFG.GRADE_QUOTA.S} S-grade and ${CFG.GRADE_QUOTA.A} A-grades). Valid trap types: ${typeList}.`,
    '3. Rate the dungeon overall with <eval .../>. High lewdness/style delights Lilim; high effectiveness pleases Vesper.',
    '4. Output every required structured tag block below verbatim in valid format so the game engine parses it cleanly:',
    ...(getAiLanguage(state) === 'th'
      ? [
          '5. Language: Write all dialogue, commentary, and hero descriptive values (appearance, outfit, personality, skill, weakness, kink) in natural Thai (ภาษาไทย), while keeping the XML tags, attribute names, grades, trap types, <img="..."> tags, and <hero> keys (name:, race:, appearance:, outfit:, personality:, skill:, weakness:, kink:) in English.',
        ]
      : []),
    '',
    requiredTags.join('\n'),
  ].join('\n');

  return [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user', content: userPrompt },
  ];
}

const OUTCOME_DIRECTIVES: Record<RaidOutcome, string> = {
  pass: 'All surviving intruders cleared this room (cleanly or narrowly). Emphasize the physical/erotic toll, near-misses, trap mechanics firing, and escalating dread or arousal as they push deeper.',
  fall: 'At least one adventurer fell (killed or captured in the trap mechanisms) while survivors push on shaken, injured, or aroused. Highlight the fallen hero’s defeat matching their kink/weakness and the survivors’ panicked retreat deeper into the maze.',
  wipe: 'TOTAL PARTY WIPE! Every last adventurer perished or was subdued in this room. Narrate the decisive climax, Vesper’s cold ledger remark, and Lilim’s gloating triumph over the captured/fallen quarry.',
  retreat: 'ROUTED! Broken by fear, injury, or overwhelming humiliation, the surviving adventurers abandon the raid and flee out the dungeon entrance. Describe their chaotic flight and how they will spread terrified rumors in town.',
  partial: 'PARTIAL BREACH! Only crippled/depleted survivors staggered past the final defended floor into the Core Room, snatching partial mana before escaping. Express Vesper’s frustration and note weak points to patch.',
  breach: 'CORE BREACHED! The intact party battered past every defense straight into the Core Room, plundering 20% of reserves before withdrawing in triumph. Narrate the stinging setback and urgent warning from Vesper and Lilim.',
};

export function buildRaidMessages(
  state: GameState,
  outcome: RaidOutcome,
  floorLabel: string,
  detailText: string
): ChatMessage[] {
  const floorNum = Number(floorLabel.replace(/[^0-9]/g, '')) || state.floorCursor;
  const floor = state.floors[floorNum - 1];
  const floorDesc = floor && floor.slots.length > 0
    ? floor.slots
        .map((s, idx) => `#${idx + 1} [${s.grade}${s.types.length ? '/' + s.types.join(',') : ''}] ${s.text}`)
        .join('\n  ')
    : '(No traps on this floor — Core threshold reached)';

  const partyDesc = state.party.map(summarizeHeroLine).join('\n\n');
  const realmLine = buildRealmAndPartyPromptLine(state);

  const userPrompt = [
    `〔DK-RAID〕 Wave ${state.wave} — ${floorLabel} (${outcome.toUpperCase()})`,
    ...(realmLine ? [realmLine] : []),
    '',
    'Active Room Configuration:',
    `  ${floorDesc}`,
    floor && floor.slots.length >= 2 ? `  Room Synergy: ${floor.synergy}` : '',
    '',
    'Engine Resolution & Rolls (CANONICAL — obey every outcome, status, ailment, arousal, and capture exactly):',
    detailText,
    '',
    'Adventurer Profiles:',
    partyDesc,
    '',
    `Scene Directive (${outcome.toUpperCase()}):`,
    OUTCOME_DIRECTIVES[outcome],
    '',
    'Write 2–4 vivid, dramatic paragraphs of live-action raid narration (no stat tables or XML tags), referencing the specific traps triggered, hero personalities/kinks, and closing with a brief remark from Vesper or Lilim with at most one <img="character_expression"> tag.',
    getAiLanguage(state) === 'th'
      ? 'Write the entire narration and officer remark in vivid Thai (ภาษาไทย).'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user', content: userPrompt },
  ];
}

export function buildBlueprintEvalMessages(
  state: GameState,
  name: string,
  detail: string,
  category: 'ero' | 'standard'
): ChatMessage[] {
  const userPrompt = [
    '〔DK-BLUEPRINT-AUDIT〕 Evaluate this reusable Trap Blueprint for the Master’s Workshop.',
    `Blueprint Name: ${name}`,
    `Intended Category: ${category === 'ero' ? 'Lewd / Erotic Restraint & Temptation' : 'Lethal / Tactical Combat'}`,
    `Trap Mechanism & Flavor Description:\n${detail}`,
    '',
    `Valid Trap Types: ${TRAP_TYPES.join(', ')}`,
    getAiLanguage(state) === 'th'
      ? 'Reply in Thai (ภาษาไทย) in Lilim’s playful, discerning voice in 2–3 sentences evaluating its cunning, brutality, or erotic flair, then end with exactly ONE tag (with notes in Thai and types in English):'
      : 'Reply in Lilim’s playful, discerning voice in 2–3 sentences evaluating its cunning, brutality, or erotic flair, then end with exactly ONE tag:',
    '<eval_blueprint grade="S|A|B|C|D" types="type1,type2" notes="one-line tactical summary"/>',
  ].join('\n');

  return [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user', content: userPrompt },
  ];
}

export function buildOfficerChatMessages(
  state: GameState,
  userMessage: string,
  recentChronicle: ChronicleEntry[]
): ChatMessage[] {
  const lang = getAiLanguage(state);
  const recent = recentChronicle
    .slice(-6)
    .map((entry) => `[${entry.title}]\n${entry.text.slice(0, 600)}`)
    .join('\n\n---\n\n');

  const prisonCtx = buildPrisonRosterPromptContext(state);
  const contextBlock = [
    `Current Mode: ${state.mode.toUpperCase()} | Wave: ${state.wave} | MP: ${state.points} | Captured Prisoners: ${state.prisoners.length}`,
    'Installed Dungeon Layout:',
    formatAllFloorsText(state.floors),
    prisonCtx ? `\n${prisonCtx}` : '',
    recent ? `\nRecent Events:\n${recent}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const officerChatDirective =
    lang === 'th'
      ? 'Officer Desk Chat Rule: Reply to the Master in natural, expressive Thai (ภาษาไทย) in character as Vesper, Lilim, and/or Eleonora (even if dungeon context or game terms are in English). Include up to 2 <img="character_EXPRESSION"> tags.'
      : 'Officer Desk Chat Rule: Reply to the Master in character as Vesper, Lilim, and/or Eleonora. Include up to 2 <img="character_EXPRESSION"> tags.';

  return [
    {
      role: 'system',
      content: [
        buildSystemPrompt(state),
        '',
        officerChatDirective,
        '',
        'Current Dungeon Status Context:',
        contextBlock,
      ].join('\n'),
    },
    { role: 'user', content: userMessage },
  ];
}

export function selectDayJournalLines(lines: DayLogLine[], max = 12): DayLogLine[] {
  if (lines.length <= max) return [...lines];

  const starredIndices = new Set<number>();
  const nonStarredIndices: number[] = [];
  lines.forEach((line, idx) => {
    if (line.star) {
      if (starredIndices.size < max) starredIndices.add(idx);
    } else {
      nonStarredIndices.push(idx);
    }
  });

  const selected = new Set<number>(starredIndices);
  for (const idx of nonStarredIndices) {
    if (selected.size >= max) break;
    selected.add(idx);
  }

  return lines.filter((_, idx) => selected.has(idx));
}

function describeTownMood(state: GameState): string {
  const { food, order, approval } = state.town;
  const moods: string[] = [];
  if (food < 20) moods.push('hungry and anxious about rations');
  if (order < 30) moods.push('restless and simmering near revolt');
  else if (order >= 70) moods.push('orderly under strict watch');
  if (approval < 40) moods.push('grumbling and distrustful');
  else if (approval >= 70) moods.push('loyal and prosperous');
  return moods.length > 0 ? moods.join(', ') : 'calm and steady';
}

export function buildDayJournalMessages(
  state: GameState,
  lines: DayLogLine[],
  restMp = 0
): ChatMessage[] {
  const dayNum = state.day || state.wave;
  const batched = selectDayJournalLines(lines, 12);
  const formattedLines =
    batched.length > 0
      ? batched
          .map((l) => {
            const prefix = l.star ? '★ ' : '';
            const kindTag = l.kind === 'town_news' ? '[TOWN NEWS] ' : '';
            return `- ${prefix}${kindTag}${l.text}`;
          })
          .join('\n')
      : '- Quiet estate inspection and evening ledger review.';

  const restNote =
    restMp > 0
      ? `\nEvening Rest: The Master retired early, letting unspent hours recharge the Core's mana reserves.`
      : '';

  const lang = getAiLanguage(state);
  const langRule =
    lang === 'th'
      ? 'Write the entire Day Journal scene in vivid, atmospheric Thai (ภาษาไทย). Keep <img="character_EXPRESSION"> tags in English.'
      : 'Write the entire Day Journal scene in vivid, atmospheric English.';

  const prisonCtx = buildPrisonRosterPromptContext(state);
  const userPrompt = [
    `〔DK-DAY〕 Narrate Day ${dayNum} in the dungeon and its domain as one continuous scene moving through the journal entries below in order.`,
    `Vesper — who runs the domain and the prison — leads the Master through the day; Lilim only turns up for dungeon talk, when called, or when there is someone to mock.`,
    ...(prisonCtx ? ['', prisonCtx] : []),
    '',
    'Journal (fixed outcomes):',
    formattedLines + restNote,
    '',
    'Scene Rules (per 14_DK_SYS_DayJournal):',
    '- Play every entry live, in order. An ordinary entry gets at least one full paragraph of the act as it happens; every ★ entry gets a long scene of several paragraphs.',
    '- Move from one entry to the next with a short transition line — the transition may skip time, the entries themselves may not.',
    '- TOWN NEWS entries are short scenes of the townsfolk reacting.',
    '- Keep system numbers, stat formulas, and raw AP/MP figures out of the prose.',
    `- Town mood: ${describeTownMood(state)}.`,
    `- Include up to 2 <img="vesper_EXPRESSION"> or <img="lilim_EXPRESSION"> tags where natural.`,
    `- ${langRule}`,
  ].join('\n');

  return [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user', content: userPrompt },
  ];
}

export function buildSceneNarrationMessages(
  state: GameState,
  title: string,
  sceneContext: string
): ChatMessage[] {
  const lang = getAiLanguage(state);
  const langRule =
    lang === 'th'
      ? 'Write the scene in vivid, atmospheric Thai (ภาษาไทย) addressing the player as "นายท่าน". Keep <img="character_EXPRESSION"> tags in English.'
      : 'Write the scene in vivid, atmospheric English.';
  const prisonCtx = buildPrisonRosterPromptContext(state);

  const userPrompt = [
    `〔DK-SCENE〕 ${title}`,
    ...(prisonCtx ? ['', prisonCtx] : []),
    '',
    'Scene Premise & Fixed Outcomes:',
    sceneContext,
    '',
    'Instructions:',
    '- Play this specific moment out live with dialogue, sensory detail, and character reactions matching the fixed outcome above.',
    '- Keep raw system math, AP/MP formulas, and stat numbers out of the prose.',
    '- Include up to 2 <img="vesper_EXPRESSION">, <img="lilim_EXPRESSION">, or <img="eleonora_EXPRESSION"> tags where natural.',
    `- ${langRule}`,
  ].join('\n');

  return [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user', content: userPrompt },
  ];
}

const ENDING_BEATS: Record<EndingKey | `go_${GameOverKey}`, string> = {
  romance:
    'The debt to House Goldreich is paid in full, and Eleonora chooses to stay at Lostbell. Show the final settlement, Eleonora tearing up the contract as her haughty laugh dissolves into honest tears, her defiance of her father, and Vesper and Lilim reacting as Eleonora moves her ledger into the dungeon as partner and co-sovereign. The dungeon continues into Endless Rank Trials.',
  romance_dowry:
    'At Stage 5 (E10), Eleonora slams the remaining Goldreich ledger onto the table and declares the unpaid balance (<= 600 MP) her personal dowry. Show her trembling fan, the torn contract, Vesper and Lilim witnessing the proposal, and Eleonora joining Lostbell permanently. The dungeon continues into Endless Rank Trials.',
  liberation:
    'The Goldreich debt is paid in full while Eleonora leaves with theatrical poise. Show the final stamped ledger, an awkward farewell she secretly resists, Vesper and Lilim reclaiming full independence, and a sovereign Lostbell entering Endless Rank Trials.',
  prosperity:
    'Lostbell has reached Town Lv. 5 — a thriving capital built above an undefeated labyrinth. Show streets, merchants, shrine, and citizens flourishing under your rule while Vesper, Lilim, and Eleonora celebrate at a grand festival. Goldreich debt remains active as Endless Rank Trials unlock.',
  bankrupt:
    'Three late strikes reached: House Goldreich seizes Lostbell. Show bailiffs sealing the gates, Eleonora torn between triumph and guilt as overseer, Vesper and Lilim fuming, and Lostbell bound under Goldreich ledger foreclosure.',
  go_ruin:
    'After Wave collapse, the last townsfolk died or fled; the domain above is an empty ruin. Show silent streets, Vesper closing empty ledgers, Lilim falling quiet, and the Master alone beside the fading Core.',
  go_famine:
    'Three consecutive seasons of famine hollowed out the domain. Show empty granaries, gaunt townsfolk departing at dawn, captives weakened, and the dungeon turning cold.',
  go_riot:
    'Three waves of extreme unrest erupted into full revolt. Show torches at the manor gates, guards overwhelmed, and the Master dragged into the town square.',
  go_core:
    'With zero Core MP left to resist the breach, invading heroes shattered the Dungeon Core itself. Show the crystal cracking, mana draining out, Vesper and Lilim fading, and Lostbell collapsing.',
  go_bankrupt:
    'After three missed debt deadlines, House Goldreich bailiffs seal the Core and foreclose the entire domain under Eleonora’s contract.',
};

export function buildEndingNarrationMessages(
  state: GameState,
  kind: 'ending' | 'gameover',
  key: EndingKey | GameOverKey,
): ChatMessage[] {
  const lang = getAiLanguage(state);
  const langRule =
    lang === 'th'
      ? 'Write the finale in vivid, atmospheric Thai (ภาษาไทย) addressing the player as "นายท่าน". Keep <img="character_EXPRESSION"> tags in English.'
      : 'Write the finale in vivid, atmospheric English.';
  const beatKey =
    kind === 'gameover'
      ? (`go_${key}` as `go_${GameOverKey}`)
      : (key as EndingKey);
  const beatGuidance = ENDING_BEATS[beatKey] ?? ENDING_BEATS.liberation;

  const userPrompt = [
    `〔DK-END〕 Narrate the ${kind === 'gameover' ? 'GAME OVER FALL' : 'CANONICAL ENDING FINALE'} for Wave ${state.wave} (${beatKey}).`,
    '',
    'Fixed Outcome & Finale Beats:',
    beatGuidance,
    '',
    'Current Domain Snapshot:',
    `- Wave ${state.wave} · Town Lv.${state.town.lv} (Pop ${state.town.pop}, Food ${state.town.food}, Approval ${state.town.approval}, Order ${state.town.order})`,
    `- Remaining Debt: ${state.debt.amount + state.debt.extraLoan} MP (Late Strikes: ${state.debt.lates}/3)`,
    `- Officer Affinities: Vesper ${state.officers.vesper.aff}, Lilim ${state.officers.lilim.aff}, Eleonora ${state.officers.eleonora.aff}`,
    `- Endless Rank: ${state.rankTrials.rank} · Titles: ${state.endings.titles.join(', ') || 'None yet'}`,
    '',
    'Instructions:',
    '- Play this finale out slowly and dramatically with character dialogue from Eleonora, Vesper, and Lilim as appropriate.',
    '- Keep raw system math and UI formulas out of the prose.',
    `- Include up to 2 <img="vesper_EXPRESSION">, <img="lilim_EXPRESSION">, or <img="eleonora_EXPRESSION"> tags (valid: ${VALID_EXPRESSIONS}).`,
    `- ${langRule}`,
  ].join('\n');

  return [
    { role: 'system', content: buildSystemPrompt(state) },
    { role: 'user', content: userPrompt },
  ];
}
