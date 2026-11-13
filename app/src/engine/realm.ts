import { CFG } from '../data/constants';
import {
  CRISIS_CFG,
  EPIC_CFG,
  GPREP_GEAR_LABELS,
  GPREP_TABLE,
  HERO_BONDS,
  HERO_BOND_ORDER,
  HERO_STORIES,
  HERO_STORY_ORDER,
  REALM_CFG,
  REALM_COUNTERMEASURES,
  REALM_ORDER,
  REALM_SITUATIONS,
  RELIC_DEFS,
  RELIC_ORDER,
} from '../data/realmData';
import type {
  ActiveRealmSituation,
  FloorState,
  GameState,
  Hero,
  HeroGrade,
  NemesisRecord,
  RaidOutcome,
  RealmState,
  RelicKey,
} from '../types/game';
import { clamp, pickOne } from './rng';

function normTag(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === 'erotic' || t === 'sexual' || t === 'seduce' || t === 'tentacle' || t === 'pleasure') {
    return 'lewd';
  }
  if (t === 'restraint' || t === 'chain' || t === 'rope') return 'bind';
  if (t === 'psychic' || t === 'illusion' || t === 'fear' || t === 'mental') return 'mind';
  if (t === 'electric' || t === 'shock' || t === 'lightning') return 'elec';
  if (t === 'frost' || t === 'cold') return 'ice';
  if (t === 'blade' || t === 'spike' || t === 'crush' || t === 'physical') return 'phys';
  if (t === 'acid' || t === 'venom') return 'poison';
  return t;
}

export function getFloorTrapTags(floor: FloorState): Set<string> {
  const out = new Set<string>();
  for (const s of floor.slots) {
    for (const raw of s.types) {
      const nt = normTag(raw);
      if (nt) out.add(nt);
    }
    const lower = s.text.toLowerCase();
    if (/fire|flame|lava|burn/.test(lower)) out.add('fire');
    if (/poison|venom|acid|toxic/.test(lower)) out.add('poison');
    if (/pit|hole|fall|drop/.test(lower)) out.add('pit');
    if (/lewd|ero|lust|aphrodis|succub|tentacle|pleasure|cum/.test(lower)) out.add('lewd');
    if (/elec|shock|volt|lightning/.test(lower)) out.add('elec');
    if (/ice|frost|freeze|cold/.test(lower)) out.add('ice');
    if (/bind|rope|chain|shackle|bondage/.test(lower)) out.add('bind');
    if (/water|drown|flood|aqua/.test(lower)) out.add('water');
    if (/mind|hypno|illusion|psychic/.test(lower)) out.add('mind');
    if (/curse|hex|blight/.test(lower)) out.add('curse');
    if (/parasite|worm|egg|breed/.test(lower)) out.add('parasite');
    if (/mutate|slime|transform/.test(lower)) out.add('mutate');
    if (/cloth|strip|melt/.test(lower)) out.add('cloth');
    if (/spike|blade|axe|arrow|smash|saw|phys/.test(lower)) out.add('phys');
  }
  return out;
}

export function getFloorSignature(floor: FloorState): string {
  if (floor.slots.length === 0) return '';
  return floor.slots
    .map((s) => `${s.text.trim()}:${s.grade}:${[...s.types].sort().join(',')}`)
    .sort()
    .join('|');
}

export function getDungeonTagSummary(floors: FloorState[]): {
  counts: Record<string, number>;
  rankedTags: { tag: string; count: number }[];
  sig: string;
} {
  const counts: Record<string, number> = {};
  let totalTextLen = 0;
  for (const floor of floors) {
    for (const s of floor.slots) {
      totalTextLen += s.text.length;
      const tags = new Set<string>();
      for (const t of s.types) tags.add(normTag(t));
      for (const t of tags) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
  }
  const rankedTags = Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)));
  const top1 = rankedTags[0]?.tag ?? '';
  const top2 = rankedTags[1]?.tag ?? '';
  const sig = `${top1},${top2}:${totalTextLen}`;
  return { counts, rankedTags, sig };
}

export function updateFloorSignatures(state: GameState, completedWave: number): RealmState {
  const prev = state.realm.floorSigs ?? {};
  const next: Record<number, { sig: string; sinceWave: number }> = {};
  for (const floor of state.floors) {
    const sig = getFloorSignature(floor);
    const old = prev[floor.floor];
    if (old && old.sig === sig && sig !== '') {
      next[floor.floor] = old;
    } else {
      next[floor.floor] = { sig, sinceWave: completedWave };
    }
  }
  return {
    ...state.realm,
    floorSigs: next,
  };
}

export function isFloorStale(state: GameState, floorNum: number, wave: number, minWaves = 3): boolean {
  const rec = state.realm.floorSigs?.[floorNum];
  if (!rec || !rec.sig) return false;
  return wave - rec.sinceWave >= minWaves;
}

export function isRealmOn(state: GameState): boolean {
  return state.settings.realmConfig !== 'off';
}

export function isRealmHalf(state: GameState): boolean {
  return state.settings.realmConfig === 'half' || state.settings.difficulty === 'casual';
}

export function getActiveRealmSituations(state: GameState, targetWave?: number): ActiveRealmSituation[] {
  if (!isRealmOn(state)) return [];
  return state.realm.active.filter((c) => {
    if (c.wavesLeft <= 0) return false;
    if (targetWave !== undefined && c.fromWave !== undefined && c.toWave !== undefined) {
      return targetWave >= c.fromWave && targetWave <= c.toWave;
    }
    return true;
  });
}

export function hasActiveRealmSituation(state: GameState, key: string, targetWave?: number): ActiveRealmSituation | undefined {
  return getActiveRealmSituations(state, targetWave).find((c) => c.key === key);
}

export function canRollRealmSituation(state: GameState, key: string): boolean {
  if (key === 'tamer') {
    return state.floors.some((f) => (f.combatSlots ?? []).some((cs) => cs.kind === 'monster'));
  }
  if (key === 'plague') {
    return state.monsters.length > 0;
  }
  if (key === 'revenge') {
    return state.prisoners.length > 0;
  }
  if (key === 'riot') {
    return state.prisoners.filter((p) => p.resist >= CRISIS_CFG.JAIL_RES).length >= CRISIS_CFG.JAIL_NUM;
  }
  return true;
}

/**
 * Rolls Realm Situations at the end of `completedWave` for `nextWave = completedWave + 1`.
 * Keeps unexpired multi-wave cards (decrementing `wavesLeft`) and fills up to target count.
 */
export function rollRealmSituationsForNextWave(
  state: GameState,
  completedWave: number,
  rng: () => number = Math.random
): { state: GameState; rolled: ActiveRealmSituation[] } {
  const nextWave = completedWave + 1;
  const sigRealm = updateFloorSignatures(state, completedWave);

  if (!isRealmOn(state) || nextWave < REALM_CFG.FROM) {
    return {
      state: { ...state, realm: { ...sigRealm, active: [] } },
      rolled: [],
    };
  }

  // Advance / prune existing cards from previous wave
  const kept: ActiveRealmSituation[] = [];
  for (const c of state.realm.active) {
    if (c.toWave !== undefined) {
      if (c.toWave >= nextWave) {
        kept.push({ ...c, wavesLeft: c.toWave - nextWave + 1 });
      }
    } else if (c.wavesLeft > 1) {
      kept.push({ ...c, wavesLeft: c.wavesLeft - 1 });
    }
  }

  // Re-validate dynamic prerequisites on kept cards
  const validKept = kept.filter((c) => {
    if (c.key === 'plague' && state.monsters.length === 0) return false;
    if (c.key === 'riot' && state.prisoners.filter((p) => p.resist >= CRISIS_CFG.JAIL_RES).length < CRISIS_CFG.JAIL_NUM) {
      return false;
    }
    if (c.key === 'revenge' && c.revengePrisonerName && !state.prisoners.some((p) => p.name === c.revengePrisonerName)) {
      return false;
    }
    return true;
  });

  let want = 0;
  if (nextWave >= REALM_CFG.FROM3) {
    want = 2 + (rng() < REALM_CFG.P3 ? 1 : 0);
  } else if (nextWave >= REALM_CFG.FROM2) {
    want = 1 + (rng() < REALM_CFG.P2 ? 1 : 0);
  } else {
    want = rng() < REALM_CFG.P1 ? 1 : 0;
  }

  const nextCooldowns = { ...sigRealm.cooldowns };
  const rolled: ActiveRealmSituation[] = [];
  const active = [...validKept];

  while (active.length < want) {
    const pool = REALM_ORDER.filter((k) => {
      if (active.some((c) => c.key === k)) return false;
      const lastSeen = nextCooldowns[k] ?? -99;
      if (nextWave - lastSeen < REALM_CFG.COOL) return false;
      return canRollRealmSituation(state, k);
    });
    if (pool.length === 0) break;

    const k = pickOne(pool, rng);
    const def = REALM_SITUATIONS[k];
    const card: ActiveRealmSituation = {
      key: k,
      wavesLeft: def.waves,
      fromWave: nextWave,
      toWave: nextWave + def.waves - 1,
      countered: false,
    };

    if (k === 'overload') {
      const trapFloors = state.floors.filter((f) => f.slots.length > 0).map((f) => f.floor);
      const picked: number[] = [];
      const avail = [...trapFloors];
      for (let i = 0; i < 2 && avail.length > 0; i++) {
        const idx = Math.floor(rng() * avail.length);
        picked.push(avail.splice(idx, 1)[0]);
      }
      card.floors = picked.length > 0 ? picked : [1];
    } else if (k === 'spy') {
      const trapFloors = state.floors.filter((f) => f.slots.length > 0).map((f) => f.floor);
      card.targetFloor = trapFloors.length > 0 ? pickOne(trapFloors, rng) : 1;
    } else if (k === 'revenge') {
      if (state.prisoners.length > 0) {
        card.revengePrisonerName = pickOne(state.prisoners, rng).name;
      }
    }

    active.push(card);
    rolled.push(card);
    nextCooldowns[k] = nextWave;
  }

  return {
    state: {
      ...state,
      realm: {
        ...sigRealm,
        active,
        cooldowns: nextCooldowns,
      },
    },
    rolled,
  };
}

export function canCounterRealmSituation(
  state: GameState,
  situationKey: string
): { ok: boolean; reason?: string } {
  const card = state.realm.active.find((c) => c.key === situationKey && c.wavesLeft > 0 && !c.countered);
  if (!card) return { ok: false, reason: 'No active uncountered situation.' };
  const def = REALM_COUNTERMEASURES[situationKey];
  if (!def) return { ok: false, reason: 'No countermeasure available for this situation.' };

  if (state.mode !== 'estate' && state.mode !== 'build') {
    return { ok: false, reason: 'Countermeasures are only available in Build or Day phase.' };
  }
  if (def.dayOnly && state.mode !== 'estate') {
    return { ok: false, reason: '🔒 DAY ONLY — requires 1 AP in Town & Estate phase.' };
  }
  if (def.requiresShrine && (state.estate.facilities.shrine ?? 0) < 1) {
    return { ok: false, reason: 'Requires Dark Shrine Lv1+.' };
  }
  if (def.costKind === 'ap') {
    if (state.dayClosed || state.ap < def.costAmount) {
      return { ok: false, reason: 'Not enough AP (requires 1 AP).' };
    }
  } else if (def.costKind === 'intel') {
    if (state.expedition.lootIntel < def.costAmount) {
      return { ok: false, reason: `Requires ${def.costAmount} Intel.` };
    }
  } else if (def.costKind === 'mp') {
    if (state.points < def.costAmount) {
      return { ok: false, reason: `Requires ${def.costAmount} MP.` };
    }
  } else if (def.costKind === 'pri') {
    const elig = state.prisoners.filter((p) => !p.legend);
    if (elig.length === 0) {
      return { ok: false, reason: 'Requires a non-legend prisoner to send as tribute.' };
    }
  }
  return { ok: true };
}

export function applyRealmCountermeasure(
  state: GameState,
  situationKey: string,
  prisonerPid?: number
): { state: GameState; ok: boolean; message: string } {
  const check = canCounterRealmSituation(state, situationKey);
  if (!check.ok) {
    return { state, ok: false, message: check.reason ?? 'Cannot apply countermeasure.' };
  }
  const def = REALM_COUNTERMEASURES[situationKey];
  const sit = REALM_SITUATIONS[situationKey];
  if (!def || !sit) return { state, ok: false, message: 'Unknown situation.' };

  let next = { ...state };
  if (def.costKind === 'intel') {
    next.expedition = {
      ...next.expedition,
      lootIntel: next.expedition.lootIntel - def.costAmount,
    };
  } else if (def.costKind === 'mp') {
    next.points = next.points - def.costAmount;
  } else if (def.costKind === 'ap') {
    next.ap = Math.max(0, next.ap - def.costAmount);
    next.apUsed = { ...next.apUsed, [`rlm_${situationKey}`]: true };
  } else if (def.costKind === 'pri') {
    const elig = next.prisoners.filter((p) => !p.legend);
    const chosen = (prisonerPid !== undefined ? elig.find((p) => p.pid === prisonerPid) : undefined) ?? elig[0];
    if (!chosen) return { state, ok: false, message: 'No eligible prisoner.' };
    next.prisoners = next.prisoners.filter((p) => p.pid !== chosen.pid);
    // Remove prisoner from any floor combat slot
    next.floors = next.floors.map((f) => ({
      ...f,
      combatSlots: (f.combatSlots ?? []).filter((cs) => !(cs.kind === 'prisoner' && cs.pid === chosen.pid)),
    }));
  }

  next.realm = {
    ...next.realm,
    active: next.realm.active.map((c) => (c.key === situationKey ? { ...c, countered: true } : c)),
  };

  const msg = `✅ Countered ${sit.icon} ${sit.name}: ${def.label}`;
  if (next.mode === 'estate') {
    next.dayLines = [...next.dayLines, { text: `${sit.icon} ${msg}` }];
  }
  next.flash = msg;
  return { state: next, ok: true, message: msg };
}

/**
 * Updates Guild Counter-Gear Prep Lv (0..5) after raid end.
 */
export function updateGuildPrepOnRaidEnd(state: GameState, outcome: RaidOutcome): GameState {
  const { rankedTags, sig } = getDungeonTagSummary(state.floors);
  const topTags = rankedTags.slice(0, 3).map((x) => x.tag);
  const prev = state.realm.gprep;

  let delta = 0;
  const reasons: string[] = [];

  if (outcome === 'wipe') {
    delta += 1;
    reasons.push('party wiped (+1)');
  } else if (outcome === 'breach') {
    delta -= 1;
    reasons.push('dungeon breached (-1)');
  }

  let sameSigStreak = prev.sameSigStreak;
  if (prev.lastSig && prev.lastSig === sig) {
    sameSigStreak += 1;
    if (sameSigStreak >= 2) {
      delta += 1;
      reasons.push(`layout unchanged ${sameSigStreak + 1} waves (+1)`);
    }
  } else {
    if (prev.lastSig) {
      delta -= 1;
      reasons.push('dungeon layout changed (-1)');
    }
    sameSigStreak = 0;
  }

  const nextLv = clamp(prev.lv + delta, 0, REALM_CFG.GPREP_MAX);
  return {
    ...state,
    realm: {
      ...state.realm,
      gprep: {
        lv: nextLv,
        topTags,
        sameSigStreak,
        lastSig: sig,
        reason: reasons.join(' · '),
      },
    },
  };
}

export function getGuildPrepInfo(
  state: GameState,
  targetWave = state.wave
): {
  effectiveLv: number;
  rawLv: number;
  counters: Record<string, number>;
  gearNames: string[];
  reason?: string;
} {
  const rawLv = state.realm.gprep.lv;
  const effectiveLv = Math.max(0, rawLv - (state.wonders.spire ? 1 : 0));
  if (targetWave < REALM_CFG.GPREP_FROM || effectiveLv <= 0) {
    return { effectiveLv, rawLv, counters: {}, gearNames: [], reason: state.realm.gprep.reason };
  }
  const table = GPREP_TABLE[effectiveLv] ?? [];
  const { rankedTags } = getDungeonTagSummary(state.floors);
  const counters: Record<string, number> = {};
  const gearNames: string[] = [];
  for (let i = 0; i < table.length; i++) {
    const t = rankedTags[i];
    if (t && t.count >= 1) {
      counters[t.tag] = table[i];
      gearNames.push(`${GPREP_GEAR_LABELS[t.tag] ?? t.tag} +${table[i]}`);
    }
  }
  return {
    effectiveLv,
    rawLv,
    counters,
    gearNames,
    reason: state.realm.gprep.reason,
  };
}

export function getBondChance(wave: number): number {
  if (wave >= 25) return 0.8;
  if (wave >= 15) return 0.6;
  if (wave >= 5) return 0.3;
  return 0;
}

function gradeRank(g: HeroGrade): number {
  if (g === 'EPIC') return CFG.HERO_GRADES.length;
  return CFG.HERO_GRADES.indexOf(g);
}

/**
 * Assigns up to 1 Party Bond (7 types) and 1 B+ Hero Story (8 types) during party generation.
 */
export function assignPartyBondsAndStories(
  party: Hero[],
  targetWave: number,
  rng: () => number = Math.random
): Hero[] {
  const next = party.map((h) => ({ ...h }));
  const nonEpic = next.filter((h) => !h.epic && h.grade !== 'EPIC');

  if (nonEpic.length >= 2 && rng() < getBondChance(targetWave)) {
    const idxA = Math.floor(rng() * nonEpic.length);
    const a = nonEpic[idxA];
    const others = nonEpic.filter((_, i) => i !== idxA);
    const b = pickOne(others, rng);
    const pool = HERO_BOND_ORDER.filter(
      (k) => !((k === 'lovers' || k === 'fiance') && (a.marital === 'married' || b.marital === 'married'))
    );
    if (pool.length > 0) {
      const bondKey = pickOne(pool, rng);
      a.bondKey = bondKey;
      a.bondTargetSlot = b.slot;
      b.bondKey = bondKey;
      b.bondTargetSlot = a.slot;
      // Use bondRole via deterministic convention: slot A is role 'a' (initiator), slot B is 'b'
      // Represented cleanly by lower slot = 'a' or explicit bondRole field
    }
  }

  const storyCands = next.filter((h) => gradeRank(h.grade) >= gradeRank('B'));
  const storyP = targetWave >= 15 ? 0.45 : 0.25;
  if (storyCands.length > 0 && rng() < storyP) {
    const chosen = pickOne(storyCands, rng);
    const pool = HERO_STORY_ORDER.filter((k) => k !== 'oracle' || targetWave >= 20);
    chosen.storyKey = pickOne(pool, rng);
  }

  return next;
}

export interface HeroMetaModResult {
  realmMod: number;
  bondMod: number;
  prepMod: number;
  nemesisMod: number;
  epicAuraMod: number;
  totalMod: number;
  labels: string[];
}

/**
 * Computes all Phase 3 modifiers acting on `hero` on `floor`:
 * Realm Situations (±3 cap), Bond + Story (±3 cap), Guild Counter-Gear (+2 cap),
 * TOTAL_CAP (+5 positive sum across realm + max(0, bond) + prep),
 * plus EPIC aura (+1 allies) & Nemesis Memory (+3 on unchanged floor).
 */
export function computeHeroSituationAndMetaMods(
  state: GameState,
  hero: Hero,
  floor: FloorState,
  aliveHeroes: Hero[],
  allParty: Hero[]
): HeroMetaModResult {
  const targetWave = state.mode === 'prep' ? state.wave + 1 : state.wave;
  const activeSituations = getActiveRealmSituations(state, targetWave);
  const tags = getFloorTrapTags(floor);
  const aliveSet = new Set(aliveHeroes.map((h) => h.slot));
  const anyFallen = allParty.some((p) => p.slot !== hero.slot && p.status !== 'pending' && !aliveSet.has(p.slot));
  const labels: string[] = [];

  // Identify deterministic designated slots for targeting situations
  const bestHero = [...allParty].sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || a.slot - b.slot)[0];
  const femaleHero = allParty.find((h) => h.gender === 'female') ?? allParty[0];

  // 1. Realm Situation Modifiers
  let realmMod = 0;
  const half = isRealmHalf(state);
  const combatSlots = floor.combatSlots ?? [];
  const hasCombatSlot = combatSlots.length > 0;
  const monsterSlots = combatSlots.filter((cs) => cs.kind === 'monster');

  for (const sit of activeSituations) {
    const def = REALM_SITUATIONS[sit.key];
    const ic = def?.icon ?? '⚠';
    let add = 0;
    if (sit.key === 'iseg' && bestHero && hero.slot === bestHero.slot) {
      add = sit.countered ? 1 : 2;
    } else if (sit.key === 'chosen' && allParty[0] && hero.slot === allParty[0].slot) {
      const damp = (state.estate.facilities.shrine ?? 0) >= 2 || (state.estate.facilities.torture ?? 0) >= 2;
      add = damp ? 1 : 2;
    } else if (sit.key === 'leak' && !sit.countered && isFloorStale(state, floor.floor, targetWave, 3)) {
      add = 2;
    } else if (sit.key === 'academy') {
      add = Math.min(2, Math.max(0, aliveHeroes.length - 1));
    } else if (
      sit.key === 'disarm' &&
      (hero.classKey === 'rogue' ||
        hero.classKey === 'ranger' ||
        hero.traits.includes('disarmer') ||
        hero.traits.includes('scout')) &&
      !hasCombatSlot
    ) {
      add = 2;
    } else if (sit.key === 'tamer' && monsterSlots.length > 0) {
      const hasStar1 = monsterSlots.some((cs) => {
        if (cs.kind !== 'monster') return false;
        const m = state.monsters.find((mm) => mm.id === cs.monsterId);
        return !m || m.stars <= 1;
      });
      add = hasStar1 ? 2 : 1;
    } else if (sit.key === 'festival') {
      add = 1;
    } else if (sit.key === 'overload' && !sit.countered && (sit.floors ?? []).includes(floor.floor)) {
      add = 2;
    } else if (sit.key === 'saint' && (tags.has('lewd') || tags.has('mind'))) {
      const hasHighCorr = state.prisoners.some((p) => p.corr >= 60);
      add = hasHighCorr ? 1 : 2;
    } else if (sit.key === 'revenge' && hero.slot === (allParty[allParty.length - 1]?.slot ?? hero.slot)) {
      const targetPris = sit.revengePrisonerName
        ? state.prisoners.find((p) => p.name === sit.revengePrisonerName)
        : undefined;
      const deployedGuard = targetPris && (targetPris.assignedFloor !== null || targetPris.job === 'guard');
      add = deployedGuard ? -2 : 2;
    } else if ((sit.key === 'alliance' || sit.key === 'mass') && !sit.countered) {
      add = 1;
    } else if (sit.key === 'princess' && bestHero) {
      if (hero.slot === bestHero.slot) add = 2;
      else if (aliveSet.has(bestHero.slot)) add = 1;
    } else if (sit.key === 'regress' && hero.slot === (allParty[0]?.slot ?? hero.slot)) {
      if (isFloorStale(state, floor.floor, targetWave, 2)) add = 3;
    } else if (sit.key === 'charm' && (tags.has('lewd') || tags.has('bind'))) {
      add = (state.estate.facilities.lewdmart ?? 0) >= 2 ? 1 : 2;
    } else if (sit.key === 'purify' && !sit.countered && (tags.has('lewd') || tags.has('mind') || tags.has('mutate'))) {
      add = 2;
    } else if (sit.key === 'spy' && !sit.countered && sit.targetFloor === floor.floor) {
      add = 2;
    } else if (sit.key === 'plague' && !sit.countered && monsterSlots.length > 0) {
      add = 1;
    } else if (sit.key === 'riot' && floor.floor >= 5) {
      add = 1;
    } else if (sit.key === 'exile' && bestHero) {
      add = hero.slot === bestHero.slot ? 3 : -1;
    } else if (sit.key === 'knightess' && femaleHero && hero.slot === femaleHero.slot) {
      if (tags.has('lewd') || tags.has('mind')) add = 2;
    } else if (sit.key === 'broadcast') {
      add = 1;
    } else if (sit.key === 'gacha') {
      const gachaTags = ['fire', 'poison', 'pit', 'lewd', 'elec', 'ice', 'bind', 'water', 'mind'];
      const chosenTag = gachaTags[(hero.slot + targetWave) % gachaTags.length];
      if (tags.has(chosenTag)) add = sit.countered ? 1 : 2;
    }

    if (add !== 0) {
      realmMod += add;
      labels.push(`${ic}${add > 0 ? `+${add}` : add}`);
    }
  }

  if (half && realmMod > 0) {
    realmMod = Math.ceil(realmMod / 2);
  }
  realmMod = clamp(realmMod, -REALM_CFG.CAP, REALM_CFG.CAP);

  // 2. Hero Bond & Story Modifiers
  let bondMod = 0;
  if (hero.bondKey && hero.bondTargetSlot !== undefined) {
    const partnerAlive = aliveSet.has(hero.bondTargetSlot);
    const isRoleA = hero.slot < hero.bondTargetSlot;
    const ic = HERO_BONDS[hero.bondKey]?.icon ?? '🔗';
    let bAdd = 0;
    if (hero.bondKey === 'lovers') bAdd = partnerAlive ? 1 : 2;
    else if (hero.bondKey === 'siblings') bAdd = partnerAlive ? 1 : isRoleA ? 2 : -1;
    else if (hero.bondKey === 'mentor') bAdd = !isRoleA ? (partnerAlive ? 1 : -2) : 0;
    else if (hero.bondKey === 'friends') bAdd = partnerAlive ? (hero.ailment > 0 ? 1 : 0) : 1;
    else if (hero.bondKey === 'rivals') bAdd = partnerAlive ? 1 : -1;
    else if (hero.bondKey === 'knight') bAdd = !isRoleA ? (partnerAlive ? 1 : 0) : partnerAlive ? 0 : 2;
    else if (hero.bondKey === 'fiance') bAdd = partnerAlive ? 1 : -2;
    if (bAdd !== 0) {
      bondMod += bAdd;
      labels.push(`${ic}${bAdd > 0 ? `+${bAdd}` : bAdd}`);
    }
  } else if (anyFallen && !hero.epic) {
    bondMod -= 1;
    labels.push('😰-1');
  }

  if (hero.storyKey) {
    const ic = HERO_STORIES[hero.storyKey]?.icon ?? '📖';
    let sAdd = 0;
    if (hero.storyKey === 'revenge' || hero.storyKey === 'honor' || hero.storyKey === 'oracle') {
      sAdd = 1;
    } else if (hero.storyKey === 'family' && state.prisoners.length > 0 && floor.floor >= 4) {
      sAdd = 2;
    } else if ((hero.storyKey === 'merc' || hero.storyKey === 'promise') && (hero.cond === 'injured' || hero.cond === 'severe')) {
      sAdd = 1;
    } else if (hero.storyKey === 'last') {
      sAdd = floor.floor <= 3 ? 1 : floor.floor >= 5 ? -1 : 0;
    } else if (hero.storyKey === 'curse' && (tags.has('curse') || tags.has('mutate') || tags.has('parasite'))) {
      sAdd = 2;
    }
    if (sAdd !== 0) {
      bondMod += sAdd;
      labels.push(`${ic}${sAdd > 0 ? `+${sAdd}` : sAdd}`);
    }
  }
  bondMod = clamp(bondMod, -REALM_CFG.BOND_CAP, REALM_CFG.BOND_CAP);

  // 3. Guild Counter-Gear Prep
  const prepInfo = getGuildPrepInfo(state, targetWave);
  let prepMod = 0;
  for (const [t, val] of Object.entries(prepInfo.counters)) {
    if (tags.has(t)) prepMod = Math.max(prepMod, val);
  }
  prepMod = Math.min(REALM_CFG.PREP_CAP, prepMod);
  if (prepMod > 0) labels.push(`🎒+${prepMod}`);

  // 4. TOTAL_CAP = 5 trimming (prep first, then positive bond, then realm)
  let posBond = Math.max(0, bondMod);
  let over = realmMod + posBond + prepMod - REALM_CFG.TOTAL_CAP;
  if (over > 0) {
    const cutPrep = Math.min(prepMod, over);
    prepMod -= cutPrep;
    over -= cutPrep;
  }
  if (over > 0) {
    const cutBond = Math.min(posBond, over);
    bondMod -= cutBond;
    over -= cutBond;
  }
  if (over > 0) {
    realmMod -= over;
  }

  // 5. EPIC Aura (+1 to non-EPIC living allies while an EPIC hero is alive) & Nemesis Memory (+3)
  let epicAuraMod = 0;
  if (!hero.epic && aliveHeroes.some((a) => a.slot !== hero.slot && a.epic)) {
    epicAuraMod = EPIC_CFG.AURA;
    labels.push(`✨+${epicAuraMod}`);
  }

  let nemesisMod = 0;
  if (hero.epicKind === 'nemesis' && hero.nemesisSignatures && floor.slots.length > 0) {
    const floorSig = getFloorSignature(floor);
    if (floorSig && hero.nemesisSignatures.includes(floorSig)) {
      nemesisMod = 3;
      labels.push('🧠Mem+3');
    }
  }

  const totalMod = realmMod + bondMod + prepMod + epicAuraMod + nemesisMod;
  return {
    realmMod,
    bondMod,
    prepMod,
    nemesisMod,
    epicAuraMod,
    totalMod,
    labels,
  };
}

/**
 * Grants an unowned Relic (or +100 MP fallback if all 4 are owned).
 */
export function grantUnownedRelic(
  state: GameState,
  sourceLabel: string,
  rng: () => number = Math.random
): { state: GameState; granted: RelicKey | null; fallbackMp: number } {
  const unowned = RELIC_ORDER.filter((k) => !state.relics.owned.includes(k));
  if (unowned.length === 0) {
    const next = {
      ...state,
      points: state.points + 100,
    };
    return { state: next, granted: null, fallbackMp: 100 };
  }
  const picked = pickOne(unowned, rng);
  const def = RELIC_DEFS[picked];
  const next: GameState = {
    ...state,
    relics: {
      ...state.relics,
      owned: [...state.relics.owned, picked],
    },
    crises: {
      ...state.crises,
      lastCrisisCard: {
        kind: 'relic',
        title: `Relic Obtained: ${def.icon} ${def.name}`,
        subtitle: sourceLabel,
        body: def.effectDesc,
        assetKey: 'dk_cr_legend',
        wave: state.wave,
        resolved: true,
        won: true,
      },
    },
  };
  return { state: next, granted: picked, fallbackMp: 0 };
}

/**
 * Adds a Hero Bond & Story context summary for LLM prompts (`Realm & party (fixed): ...`).
 */
export function buildRealmAndPartyPromptLine(state: GameState): string | null {
  const targetWave = state.mode === 'prep' ? state.wave + 1 : state.wave;
  const parts: string[] = [];

  for (const c of getActiveRealmSituations(state, targetWave)) {
    const def = REALM_SITUATIONS[c.key];
    if (def) parts.push(def.promptTag + (c.countered ? ' (countered)' : ''));
  }

  const seenBonds = new Set<string>();
  for (const h of state.party) {
    if (h.bondKey && h.bondTargetSlot !== undefined) {
      const pairKey = [h.slot, h.bondTargetSlot].sort().join('-');
      if (!seenBonds.has(pairKey)) {
        seenBonds.add(pairKey);
        const partner = state.party.find((p) => p.slot === h.bondTargetSlot);
        const bDef = HERO_BONDS[h.bondKey];
        if (partner && bDef) {
          parts.push(`${h.name || `Hero ${h.slot}`} and ${partner.name || `Hero ${partner.slot}`} are ${bDef.promptDesc}`);
        }
      }
    }
    if (h.storyKey) {
      const sDef = HERO_STORIES[h.storyKey];
      if (sDef) parts.push(`${h.name || `Hero ${h.slot}`} ${sDef.promptDesc}`);
    }
    if (h.epic) {
      parts.push(
        `${h.name || 'Champion'} (${h.epicKind === 'grandmaster' ? 'Crusade Grand Master' : 'Returning Legendary Nemesis'}) commands an unyielding EPIC aura`
      );
    }
  }

  if (state.crises.crusade.active) {
    parts.push(`Holy Crusade active (${state.crises.crusade.wavesLeft} waves remaining)`);
  }

  if (parts.length === 0) return null;
  return `Realm & party (fixed): ${parts.join('; ')}.`;
}

/**
 * Creates a NemesisRecord when an A+ non-EPIC hero escapes (retreat or breach).
 */
export function buildNemesisFromHero(state: GameState, hero: Hero, wave: number): NemesisRecord {
  const signatures = state.floors
    .filter((f) => f.slots.length > 0)
    .map((f) => getFloorSignature(f))
    .filter(Boolean);
  return {
    id: `nem_${wave}_${hero.slot}_${Math.floor(Math.random() * 10000)}`,
    name: hero.name || `Avenger #${hero.slot}`,
    grade: hero.grade,
    classKey: hero.classKey,
    raceKey: hero.raceKey,
    gender: hero.gender,
    traits: [...hero.traits],
    signatures,
    adaptedTags: [],
    escapedWave: wave,
  };
}

export interface ThreatPillSummary {
  wrath: number;
  showWrath: boolean;
  crusadeActive: boolean;
  crusadeWavesLeft: number;
  nemesisCount: number;
  hasEpicInParty: boolean;
  gprepLv: number;
  gprepEffectiveLv: number;
  relicsCount: number;
}

export function getActiveThreatSummary(state: GameState): ThreatPillSummary {
  const gprep = getGuildPrepInfo(state);
  return {
    wrath: state.crises.wrath,
    showWrath: state.crises.wrath >= 15 || state.crises.crusade.active || state.wave >= CRISIS_CFG.WRATH_FROM,
    crusadeActive: state.crises.crusade.active,
    crusadeWavesLeft: state.crises.crusade.wavesLeft,
    nemesisCount: state.crises.nemesis.length,
    hasEpicInParty: state.party.some((h) => Boolean(h.epic)),
    gprepLv: gprep.rawLv,
    gprepEffectiveLv: gprep.effectiveLv,
    relicsCount: state.relics.owned.length,
  };
}
