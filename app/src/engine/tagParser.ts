import { CFG, TRAP_TYPES } from '../data/constants';
import type { EvalScores, GameState, Hero, SynergyGrade, TrapGrade } from '../types/game';
import { isSynergyGrade, isTrapGrade, normalizeSynergy } from './dungeon';
import { clamp } from './rng';

export interface ParsedTrapTag {
  floor: number;
  slot: number;
  grade: TrapGrade;
  types: string[];
}

export interface ParsedRoomTag {
  floor: number;
  synergy: Exclude<SynergyGrade, '?' | '-'>;
}

export interface ParsedHeroTag {
  slot?: number;
  name?: string;
  race?: string;
  appearance?: string;
  outfit?: string;
  personality?: string;
  skill?: string;
  weakness?: string;
  kink?: string;
}

export type RichTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'img'; character: string; keyword: string; rawTag: string };

const KNOWN_TYPES = new Set<string>(TRAP_TYPES);

function capNewTrapGrade(g: string): TrapGrade | null {
  const up = g.trim().toUpperCase();
  if (up === 'SS' || up === 'SSS') return CFG.NEW_TRAP_MAX;
  return isTrapGrade(up) ? up : null;
}

function parseAttributes(attrStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').trim();
  }
  return out;
}

export function parseTrapTags(text: string): ParsedTrapTag[] {
  const res: ParsedTrapTag[] = [];
  const re = /<trap\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const attrs = parseAttributes(m[1]);
    let floor = 0;
    let slot = 0;
    if (attrs.id) {
      const idMatch = attrs.id.match(/(\d+)\s*-\s*(\d+)/);
      if (idMatch) {
        floor = Number(idMatch[1]);
        slot = Number(idMatch[2]);
      }
    }
    if (!floor && attrs.floor) floor = Number(attrs.floor);
    if (!slot && attrs.slot) slot = Number(attrs.slot);
    const grade = attrs.grade ? capNewTrapGrade(attrs.grade) : null;
    const rawTypes = (attrs.type ?? '')
      .toLowerCase()
      .split(/[\s,|/]+/)
      .map((t) => t.trim())
      .filter((t) => KNOWN_TYPES.has(t));
    if (floor >= 1 && slot >= 1 && grade) {
      res.push({ floor, slot, grade, types: rawTypes.slice(0, 2) });
    }
  }
  return res;
}

export function parseRoomTags(text: string): ParsedRoomTag[] {
  const res: ParsedRoomTag[] = [];
  const re = /<room\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const attrs = parseAttributes(m[1]);
    const floor = Number(attrs.floor ?? 0);
    const synRaw = (attrs.synergy ?? attrs.combo ?? attrs.grade ?? '').trim().toUpperCase();
    const capped = synRaw === 'SS' || synRaw === 'SSS' ? 'S' : synRaw;
    if (floor >= 1 && isSynergyGrade(capped)) {
      res.push({ floor, synergy: capped });
    }
  }
  return res;
}

export function parseEvalTag(text: string): EvalScores | null {
  const m = text.match(/<eval\b([^>]*)\/?>/i);
  if (!m) return null;
  const attrs = parseAttributes(m[1]);
  const toScore = (v?: string): number | undefined => {
    if (!v) return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) return undefined;
    return clamp(Math.round(n), 0, 10);
  };
  const effect = toScore(attrs.effectiveness ?? attrs.effect);
  const novelty = toScore(attrs.novelty);
  const fun = toScore(attrs.fun);
  const aesthetic = toScore(attrs.aesthetics ?? attrs.aesthetic);
  const lewd = toScore(attrs.lewdness ?? attrs.lewd);

  let overall = (attrs.overall ?? '').toUpperCase().match(/^[SABCD]/)?.[0] as
    | EvalScores['overall']
    | undefined;
  if (!overall) {
    const nums = [effect, novelty, fun, aesthetic, lewd].filter(
      (n): n is number => n !== undefined
    );
    if (nums.length > 0) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      overall = avg >= 9 ? 'S' : avg >= 7.5 ? 'A' : avg >= 6 ? 'B' : avg >= 4 ? 'C' : 'D';
    }
  }
  return {
    effect,
    novelty,
    fun,
    aesthetic,
    lewd,
    overall,
    bonusMp: overall ? (CFG.EVAL_BONUS[overall] ?? 0) : 0,
  };
}

export function parseHeroTags(text: string): ParsedHeroTag[] {
  const res: ParsedHeroTag[] = [];
  const re = /<hero\b([^>]*)>([\s\S]*?)<\/hero>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const attrs = parseAttributes(m[1]);
    const body = m[2].replace(/：/g, ':').replace(/\s+\/\s+/g, '\n').replace(/\s+\|\s+/g, '\n');
    const parsed: ParsedHeroTag = {
      slot: attrs.slot ? Number(attrs.slot) : undefined,
    };
    for (const rawLine of body.split('\n')) {
      const lineMatch = rawLine.match(/^\s*[-*]*\s*([^:]+):\s*(.+?)\s*$/);
      if (!lineMatch) continue;
      const key = lineMatch[1].replace(/\*/g, '').trim().toLowerCase();
      const val = lineMatch[2].replace(/\*/g, '').trim();
      if (!val || val === '…' || val === '...') continue;
      if (key === 'name') parsed.name = val;
      else if (key === 'race') parsed.race = val;
      else if (key === 'appearance') parsed.appearance = val;
      else if (key === 'outfit') parsed.outfit = val;
      else if (key === 'personality') parsed.personality = val;
      else if (key === 'skill') parsed.skill = val;
      else if (key === 'weakness') parsed.weakness = val;
      else if (key === 'kink') parsed.kink = val;
    }
    res.push(parsed);
  }
  return res;
}

export function applyPrepReply(state: GameState, replyText: string): {
  state: GameState;
  gradedNotes: string[];
  heroCount: number;
} {
  const trapTags = parseTrapTags(replyText);
  const roomTags = parseRoomTags(replyText);
  const evalScores = parseEvalTag(replyText);
  const heroTags = parseHeroTags(replyText);

  const newTrapSet = new Set(state.prepMeta?.newTrapIds ?? []);
  const comboSet = new Set(state.prepMeta?.comboFloors ?? []);
  const quotaUsed = { S: 0, A: 0 };
  const gradedNotes: string[] = [];

  let nextFloors = state.floors.map((f) => ({ ...f, slots: f.slots.map((s) => ({ ...s })) }));

  for (const tag of trapTags) {
    const floor = nextFloors[tag.floor - 1];
    const slot = floor?.slots[tag.slot - 1];
    if (!floor || !slot) continue;
    if (!newTrapSet.has(`${tag.floor}-${tag.slot}`)) continue;

    let grade = tag.grade;
    if (grade === 'S') {
      if (quotaUsed.S >= CFG.GRADE_QUOTA.S) grade = 'A';
      else quotaUsed.S += 1;
    }
    if (grade === 'A') {
      if (quotaUsed.A >= CFG.GRADE_QUOTA.A) grade = 'B';
      else quotaUsed.A += 1;
    }
    slot.grade = grade;
    if (tag.types.length > 0) slot.types = tag.types;
    gradedNotes.push(`${tag.floor}F-${tag.slot}: ${grade}`);
  }

  for (const rTag of roomTags) {
    const floor = nextFloors[rTag.floor - 1];
    if (!floor || floor.slots.length < 2) continue;
    if (!comboSet.has(rTag.floor) && floor.synergy !== '?') continue;
    floor.synergy = normalizeSynergy(floor.slots, rTag.synergy);
    gradedNotes.push(`${rTag.floor}F combo: ${rTag.synergy}`);
  }

  const nextParty: Hero[] = state.party.map((h) => ({ ...h }));
  const usedSlots = new Set<number>();

  for (const ht of heroTags) {
    let targetIdx = ht.slot && ht.slot >= 1 && ht.slot <= 3 && !usedSlots.has(ht.slot)
      ? ht.slot - 1
      : nextParty.findIndex((h) => !usedSlots.has(h.slot));
    if (targetIdx < 0 || !nextParty[targetIdx]) continue;
    const h = nextParty[targetIdx];
    usedSlots.add(h.slot);
    if (ht.name) h.name = ht.name;
    if (ht.appearance) h.appearance = ht.appearance;
    if (ht.outfit) h.outfit = ht.outfit;
    if (ht.personality) h.personalityText = ht.personality;
    if (ht.skill) h.skill = ht.skill;
    if (ht.weakness) h.weakness = ht.weakness;
    if (ht.kink) h.kinkText = ht.kink;
  }

  const heroesReady = heroTags.length > 0 || Boolean(state.prepMeta?.heroesReady);

  return {
    state: {
      ...state,
      floors: nextFloors,
      party: nextParty,
      evalScores: evalScores ?? state.evalScores,
      prepMeta: state.prepMeta
        ? {
            ...state.prepMeta,
            gradedSummary: gradedNotes.join(' · '),
            heroesReady,
          }
        : null,
      flash:
        heroTags.length > 0 || gradedNotes.length > 0
          ? `Prep evaluated: ${gradedNotes.join(' · ') || 'Heroes briefed'}`
          : 'Received reply (no structured tags found — you can retry or start with defaults)',
    },
    gradedNotes,
    heroCount: heroTags.length,
  };
}

export function stripSystemTagsForDisplay(text: string): string {
  return text
    .replace(/<trap\b[^>]*\/?>/gi, '')
    .replace(/<room\b[^>]*\/?>/gi, '')
    .replace(/<eval_blueprint\b[^>]*\/?>/gi, '')
    .replace(/<eval\b[^>]*\/?>/gi, '')
    .replace(/<hero\b[^>]*>[\s\S]*?<\/hero>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitRichSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  const re = /<img\s*=\s*"([^"_]+)_([^"]+)"\s*\/?>/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const slice = text.slice(lastIndex, m.index);
      if (slice.trim()) segments.push({ kind: 'text', text: slice });
    }
    segments.push({
      kind: 'img',
      character: m[1].trim(),
      keyword: m[2].trim(),
      rawTag: m[0],
    });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest.trim()) segments.push({ kind: 'text', text: rest });
  }
  return segments;
}

export function parseSingleBlueprintEval(text: string): {
  grade?: TrapGrade;
  types: string[];
  notes?: string;
} {
  const bpMatch = text.match(/<eval_blueprint\b([^>]*)\/?>/i);
  if (bpMatch) {
    const attrs = bpMatch[1];
    const gMatch = attrs.match(/grade\s*=\s*"([^"]+)"/i);
    const tMatch = attrs.match(/types?\s*=\s*"([^"]+)"/i);
    const nMatch = attrs.match(/notes?\s*=\s*"([^"]+)"/i);
    const grade = gMatch ? capNewTrapGrade(gMatch[1]) ?? undefined : undefined;
    const types = tMatch
      ? tMatch[1]
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const stripped = text.replace(/<eval_blueprint\b[^>]*\/?>/gi, '').trim();
    const notes = nMatch?.[1]?.trim() || stripped || undefined;
    return { grade, types, notes };
  }

  const traps = parseTrapTags(text);
  const first = traps[0];
  const cleanText = text.replace(/<trap\b[^>]*\/?>/gi, '').trim();
  if (first) {
    return { grade: first.grade, types: first.types, notes: cleanText || undefined };
  }
  const gradeMatch = text.match(/\bgrade\s*[:=]\s*([DCBAS])\b/i);
  const grade = gradeMatch ? capNewTrapGrade(gradeMatch[1]) ?? undefined : undefined;
  return { grade, types: [], notes: cleanText || undefined };
}
