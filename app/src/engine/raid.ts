import { BEATS, CFG, KINK_TRAP_MAP, TRAP_ATTUNEMENT, TRAP_ERO_TYPES, TRAP_WEAR } from '../data/constants';
import { getMonsterDisplayName, getMonsterLineage, MONSTER_CFG, MONSTER_OCC_ACT } from '../data/monsterData';
import { CRISIS_CFG, EPIC_CFG, WAR_CFG } from '../data/realmData';
import type {
  FloorState,
  GameState,
  Hero,
  MonsterInstance,
  Prisoner,
  RaidAuditRow,
  RaidOutcome,
  TrapSlot,
} from '../types/game';
import {
  effectiveGrade,
  formatFloorRoomText,
  getFloorCombatBonus,
  getFloorCombatSlots,
  getFloorDC,
  getFloorLinks,
  getNextTrapFloor,
} from './dungeon';
import { getGuildLevel, getThreatMod, heroGradeIndex } from './heroes';
import { evaluateRankTrials, flagOrProtectGameOver } from './endings';
import { applyMonsterGrowth, isMonsterHurt } from './monsters';
import {
  buildNemesisFromHero,
  capNemesisRoster,
  computeHeroSituationAndMetaMods,
  getFloorTrapTags,
  grantUnownedRelic,
  hasActiveRealmSituation,
  rollRealmSituationsForNextWave,
  updateGuildPrepOnRaidEnd,
} from './realm';
import { tickExpeditionAftereffects } from './expedition';
import { isActiveMole } from './prison';
import { purgeConsumedRaidMods, resolveRaidModifiers } from './raidMods';
import { clamp, pickOne, pickWeighted, randInt } from './rng';

function fearPenalty(state: GameState, hero: Hero, partyHasCleric: boolean): number {
  if (
    hero.traits.includes('cleric') ||
    hero.traits.includes('stoic') ||
    hero.traits.includes('exorcist')
  ) {
    return 0;
  }
  let p = Math.min(Math.floor(state.fear / CFG.FEAR.PEN_STEP), CFG.FEAR.PEN_MAX);
  if (partyHasCleric && p > 0) p -= 1;
  if (heroGradeIndex(hero.grade) >= 5 && p > 0) p -= CFG.FEAR.ELITE;
  if (hero.traits.includes('coward')) p *= 2;
  return Math.max(0, p);
}

function pickHowFlavor(beatKey: string, hasCombo: boolean, hasTeam: boolean, solo: boolean): string {
  const beat = BEATS[beatKey] ?? BEATS.clean;
  const pool = beat.how.filter((item) => {
    if (!item.cond) return true;
    if (item.cond === 'c') return hasCombo;
    if (item.cond === 't') return hasTeam;
    if (item.cond === 's') return solo;
    return false;
  });
  return pickOne(pool.length > 0 ? pool : beat.how).text;
}

// --- Phase 5: faced-trap resolution & capture meter -------------------------

export interface FacedSlotInfo {
  index: number;
  label: string;
  kinkMatched: boolean;
}

export interface BeatCtx {
  die: number;
  margin: number;
  wasSevere: boolean;
  deathMargin: number;
  /** True when the hero faces a TRAP_ERO_TYPES slot (Phase 5 F1 gating). */
  eroGated: boolean;
}

function slotGradeBonus(grade: string): number {
  return grade === '?' ? 0 : CFG.TRAP_BONUS[grade as keyof typeof CFG.TRAP_BONUS] ?? 0;
}

export function slotKinkMatched(kinkKey: string, slotTypes: string[]): boolean {
  const kinkTypes = KINK_TRAP_MAP[kinkKey];
  return Boolean(kinkTypes && slotTypes.some((t) => kinkTypes.includes(t)));
}

function slotLabel(slot: TrapSlot): string {
  return slot.text.split(' — ')[0].slice(0, 24);
}

/**
 * Phase 5 F1: pure faced-slot weights. disarmer → one-hot on the
 * highest-grade ACTIVE slot; kink-matched slots (KINK_TRAP_MAP) → ×2; else
 * uniform. Ticket 29: spent/disarmed slots get weight 0 — they are out of the
 * fight and never faced. Ticket 30: a slot attuned to the hero's own kink also
 * draws ×2 via max(kinkWeight, attunedWeight) — the two bonuses NEVER stack
 * multiplicatively.
 */
export function facedSlotWeights(
  hero: Pick<Hero, 'kinkKey' | 'traits'>,
  floor: FloorState
): number[] {
  if (floor.slots.length === 0) return [];
  if (hero.traits.includes('disarmer')) {
    let best = -1;
    for (let i = 0; i < floor.slots.length; i += 1) {
      if (!isTrapActive(floor.slots[i])) continue;
      if (best < 0 || slotGradeBonus(floor.slots[i].grade) > slotGradeBonus(floor.slots[best].grade)) {
        best = i;
      }
    }
    return floor.slots.map((_, i) => (i === best ? 1 : 0));
  }
  return floor.slots.map((s) => {
    if (!isTrapActive(s)) return 0;
    const kinkWeight = slotKinkMatched(hero.kinkKey, s.types) ? 2 : 1;
    const attunedWeight = s.attunedKink === hero.kinkKey ? 2 : 1;
    return Math.max(kinkWeight, attunedWeight);
  });
}

/**
 * Phase 5 F1: pick the slot a hero FACES before the d20 roll. Replaces the old
 * post-roll flavor pick — the faced slot gates ero-capture, feeds the detail
 * text and the audit row. Ticket 29: spent/disarmed slots are skipped; when
 * every slot is spent/disarmed there is nothing to face (pickWeighted would
 * fall back to index 0, so guard explicitly).
 */
export function selectFacedSlot(
  hero: Pick<Hero, 'kinkKey' | 'traits'>,
  floor: FloorState
): FacedSlotInfo | null {
  if (floor.slots.length === 0) return null;
  const weights = facedSlotWeights(hero, floor);
  // Pick among ACTIVE indices only — pickWeighted's roll<=0 edge would
  // otherwise return a weight-0 (spent/disarmed) bucket at roll === 0.
  const candidates = weights.flatMap((w, i) => (w > 0 ? [i] : []));
  if (candidates.length === 0) return null;
  const index = pickWeighted(
    candidates,
    (i) => weights[i]
  );
  const slot = floor.slots[index];
  return {
    index,
    label: slotLabel(slot),
    kinkMatched: slotKinkMatched(hero.kinkKey, slot.types),
  };
}

/**
 * Phase 5: the pure beat ladder, extracted from resolveFloorEncounter so every
 * gate combination (ero-gating × severe × nat1/nat20 × deathMargin) is
 * deterministically unit-testable. Grit → meter resolution stays with the
 * caller (grit is the outermost shield — it consumes pips, never the meter).
 *
 * Ladder (locked in plan.md):
 *   pass (die≠1, margin≥0)              → easy / clean / narrow
 *   nat20                               → luck
 *   !eroGated && severe fail            → dead
 *   !eroGated && nat1                   → blunder
 *   !eroGated && −margin ≥ deathMargin  → dead
 *   else (all ero fails)                → captured
 */
export function decideBeat(ctx: BeatCtx): string {
  // A nat-1 only sinks a pass that was close: with a comfortable margin it is just a narrow squeak.
  if (ctx.margin >= 0 && (ctx.die !== 1 || ctx.margin >= CFG.EASY_MARGIN)) {
    if (ctx.die === 1) return 'narrow';
    return ctx.margin >= CFG.EASY_MARGIN
      ? 'easy'
      : ctx.margin >= CFG.CLEAN_MARGIN
        ? 'clean'
        : 'narrow';
  }
  if (ctx.die === 20) return 'luck';
  if (!ctx.eroGated) {
    if (ctx.wasSevere) return 'dead';
    if (ctx.die === 1) return 'blunder';
    if (-ctx.margin >= ctx.deathMargin) return 'dead';
  }
  return 'captured';
}

// --- Ticket 29: trap lifecycle write-path (slot status/wear/attunement) -----

/** Ticket 29 disarm counterplay: a disarmer passing with this margin cuts the faced slot. */
const TRAP_DISARM_MARGIN = 5;

const PASS_BEATS = new Set(['easy', 'clean', 'narrow', 'luck']);

function isPassBeat(beatKey: string): boolean {
  return PASS_BEATS.has(beatKey);
}

/**
 * Ticket 29: a slot is targetable while armed — an absent status means armed
 * (optional-fields-only schema). Spent/disarmed slots are skipped by
 * faced-selection and receive no further ledger writes.
 */
export function isTrapActive(slot: Pick<TrapSlot, 'status'>): boolean {
  return slot.status === undefined || slot.status === 'armed';
}

export interface TrapBeatCtx {
  beatKey: string;
  margin: number;
  kinkMatched: boolean;
  /** Set when THIS beat was absorbed by the faced slot: capture-meter STAGGER or real capture. */
  caughtBySlot?: 'staggered' | 'captured';
  heroKinkKey: string;
  isDisarmer: boolean;
}

/**
 * Ticket 29 Stage 2.5 — "one beat event, two ledgers": the same beat that
 * resolves the hero writes the faced slot's ledger. Pure: returns a new slot,
 * never mutates. Spent/disarmed slots receive no writes at all.
 *   - any beat: wear += PER_BEAT / PER_BEAT_KINK (kink-matched), capped at SPENT;
 *     wear reaching SPENT flips the slot to `spent`.
 *   - beat resolves STAGGERED/CAPTURED by this slot: attunement += PER_STAGGER /
 *     PER_CAPTURE (cap 100) and the slot remembers the hero's kink forever.
 *   - disarmer passes with margin >= 5: slot `disarmed` (a narrow-beat pass
 *     never disarms — margin gates it).
 */
export function applyTrapBeat(slot: TrapSlot, ctx: TrapBeatCtx): TrapSlot {
  if (!isTrapActive(slot)) return slot;
  const next: TrapSlot = { ...slot };
  next.wear = Math.min(
    TRAP_WEAR.SPENT,
    (next.wear ?? 0) + (ctx.kinkMatched ? TRAP_WEAR.PER_BEAT_KINK : TRAP_WEAR.PER_BEAT)
  );
  if (ctx.caughtBySlot) {
    const gain =
      ctx.caughtBySlot === 'captured' ? TRAP_ATTUNEMENT.PER_CAPTURE : TRAP_ATTUNEMENT.PER_STAGGER;
    next.attunement = Math.min(100, (next.attunement ?? 0) + gain);
    next.attunedKink = ctx.heroKinkKey;
  }
  if (ctx.isDisarmer && isPassBeat(ctx.beatKey) && ctx.margin >= TRAP_DISARM_MARGIN) {
    next.status = 'disarmed';
  } else if (next.wear >= TRAP_WEAR.SPENT) {
    next.status = 'spent';
  }
  return next;
}

/**
 * Ticket 29 settlement: the dungeon re-arms every slot between waves and wear
 * decays toward 0; attunement/attunedKink persist forever — nothing decays
 * them, so no ratchet guard is needed (scrutinize 2026-11-18 removed the
 * TIER-clamp expression: it was a mathematical no-op guarding a decay path
 * that does not exist; restore a real guard alongside any future attunement
 * decay). Slots with no ledger at all pass through untouched.
 */
export function settleTrapSlot(slot: TrapSlot): TrapSlot {
  if (
    slot.status === undefined &&
    slot.wear === undefined &&
    slot.attunement === undefined &&
    slot.attunedKink === undefined
  ) {
    return slot;
  }
  const attunement = slot.attunement ?? 0;
  return {
    ...slot,
    status: 'armed',
    wear: Math.max(0, (slot.wear ?? 0) - TRAP_WEAR.SETTLE_DECAY),
    attunement,
  };
}

function stripRaidLinkKeys(apUsed: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(apUsed)) {
    if (!k.startsWith('__lk_') && v) out[k] = true;
  }
  return out;
}

function getHeroRaidLinkPenUsed(apUsed: Record<string, boolean>, slot: number): number {
  let count = 0;
  for (let i = 1; i <= MONSTER_CFG.LINK.RAID_CAP; i += 1) {
    if (apUsed[`__lk_u_${slot}_${i}`]) count += 1;
  }
  return count;
}

function markHeroRaidLinkPen(apUsed: Record<string, boolean>, slot: number, add: number): void {
  let remaining = add;
  for (let i = 1; i <= MONSTER_CFG.LINK.RAID_CAP && remaining > 0; i += 1) {
    const key = `__lk_u_${slot}_${i}`;
    if (!apUsed[key]) {
      apUsed[key] = true;
      remaining -= 1;
    }
  }
}

export function resolveFloorEncounter(
  state: GameState,
  floor: FloorState,
  partyInput: Hero[],
  wave: number
): {
  dc: number;
  detailLines: string[];
  shortSummary: string[];
  party: Hero[];
  fell: Hero[];
  anyCondition: boolean;
  fearGain: number;
  audit: RaidAuditRow[];
  nextMonsters: MonsterInstance[];
  nextFloors: FloorState[];
  nextPrisoners: Prisoner[];
  nextParts: number;
  nextApUsed: Record<string, boolean>;
} {
  const party = partyInput.map((h) => ({ ...h }));
  const alive = party.filter((h) => h.status === 'alive');
  const hasLeader = alive.some((h) => h.traits.includes('leader'));
  const hasCleric = alive.some((h) => h.traits.includes('cleric'));
  const dc = getFloorDC(floor, state);
  const firstRoom = state.raidFirstRoom;
  const nextApUsed = firstRoom ? stripRaidLinkKeys(state.apUsed) : { ...state.apUsed };
  let nextMonsters = state.monsters.map((m) => ({ ...m }));
  let nextFloors = state.floors.map((fl) => ({
    ...fl,
    // Ticket 29: slots are mutated by the beat ledger below, so they get real
    // copies here (previously shared refs — no writer existed).
    slots: fl.slots.map((s) => ({ ...s })),
    combatSlots: (fl.combatSlots ?? []).map((s) => ({ ...s })),
  }));
  let nextPrisoners = state.prisoners.map((p) => ({ ...p }));
  let nextParts = state.parts;

  const combatInfo = getFloorCombatBonus(state, floor);
  const floorCombatSlots = getFloorCombatSlots(floor);
  const incomingLinks = getFloorLinks(state).filter((l) => l.toFloor === floor.floor);
  const activeMonstersOnFloor = floorCombatSlots
    .filter((s): s is Extract<typeof s, { kind: 'monster' }> => s.kind === 'monster')
    .map((s) => nextMonsters.find((m) => m.id === s.monsterId))
    .filter((m): m is MonsterInstance => Boolean(m) && !isMonsterHurt(state, m as MonsterInstance));
  const activeFightersOnFloor = floorCombatSlots
    .filter((s): s is Extract<typeof s, { kind: 'prisoner' }> => s.kind === 'prisoner')
    .map((s) => nextPrisoners.find((p) => p.pid === s.pid))
    .filter(
      (p): p is Prisoner =>
        p !== undefined && p.stamina >= MONSTER_CFG.FSLOT.FIGHTER_MIN_STAMINA
    );

  // Ticket 30: trait/aura reads go through the slot ledger too — spent and
  // disarmed slots contribute no bonus and their type aura is off, worn slots
  // read one grade lower (effectiveGrade).
  const highTrapIdx = floor.slots.reduce(
    (max, s) => Math.max(max, slotGradeBonus(effectiveGrade(s))),
    0
  );
  const floorTypes = new Set(
    floor.slots.flatMap((s) => (effectiveGrade(s) === '?' ? [] : s.types))
  );

  const detailLines: string[] = [];
  const shortSummary: string[] = [];
  const fell: Hero[] = [];
  const audit: RaidAuditRow[] = [];
  let anyCondition = false;
  let fearGain = 0;

  // Crusade Wave 3 Grand Master Sanctuary check
  let sanctuaryAllyBonus = 0;
  const gmHero = alive.find((h) => h.epicKind === 'grandmaster');
  if (gmHero) {
    const sancRoll = randInt(1, 20) + 13;
    const sancDc = dc + EPIC_CFG.SANCTUARY_DC_ADD;
    if (sancRoll >= sancDc) {
      sanctuaryAllyBonus = 1;
      detailLines.push(
        `- ✝ ${gmHero.name} raises Sanctuary (${sancRoll} vs DC ${sancDc}) — allies gain +1!`
      );
    } else {
      detailLines.push(
        `- ✝ ${gmHero.name}'s Sanctuary falters against the floor (${sancRoll} vs DC ${sancDc}).`
      );
    }
  }

  if (activeMonstersOnFloor.length > 0 || activeFightersOnFloor.length > 0) {
    const occParts: string[] = [];
    for (const m of activeMonstersOnFloor) {
      const def = getMonsterLineage(m.lineage);
      const act = def ? MONSTER_OCC_ACT[def.roleTag] : 'ambushes intruders';
      occParts.push(`${getMonsterDisplayName(m)} (${act})`);
    }
    for (const p of activeFightersOnFloor) {
      const hes = p.resist >= MONSTER_CFG.FSLOT.BETRAY_RESIST_FROM ? ' — hesitant/hostile' : '';
      occParts.push(`Captive Fighter ${p.name}${hes}`);
    }
    detailLines.push(`- Floor Guards (+${combatInfo.bonus} DC): ${occParts.join('; ')}`);
  }

  for (const h of alive) {
    let injury = CFG.INJURY[h.cond] ?? 0;
    if (h.traits.includes('stoic')) injury = Math.floor(injury / 2);
    if (h.traits.includes('masochist')) injury = 0;

    const ailmentPen =
      h.ailment > 0 && !h.traits.includes('mage') && !h.traits.includes('antidote')
        ? CFG.AILMENT_PENALTY
        : 0;
    const fPen = fearPenalty(state, h, hasCleric);

    let mods =
      (CFG.HERO_BONUS[h.grade] ?? 0) +
      getThreatMod(state, wave) +
      (CFG.TEAM[alive.length] ?? 0) -
      injury -
      ailmentPen -
      fPen -
      h.intel -
      (h.aroused ? 1 : 0) -
      // Phase 5 F2: staggered heroes are shaken — −1 mods in every remaining room.
      (h.staggered ? 1 : 0);

    if (hasLeader && !h.traits.includes('leader')) mods += 1;
    if (h.traits.includes('cautious') && firstRoom) mods += 1;
    if (h.traits.includes('reckless')) mods += 1;
    if (h.traits.includes('coward') && alive.length === 1) mods -= 1;
    if (h.traits.includes('arrogant')) mods += firstRoom ? -2 : 1;
    if (h.traits.includes('scout') && firstRoom) mods += 2;
    if (h.traits.includes('disarmer') && floor.slots.length === 1) mods += 2;
    if (h.traits.includes('brute')) mods += highTrapIdx <= 2 ? 2 : highTrapIdx >= 4 ? -1 : 0;
    if (h.traits.includes('mage') && floor.slots.length >= 2) mods += 1;
    if (h.traits.includes('greedy') && floor.floor >= 5) mods += 1;
    if (h.traits.includes('exorcist') && state.fear >= CFG.FEAR.EXORCIST_FROM) mods += 1;
    if (h.traits.includes('lewd')) mods -= state.lust >= CFG.LUST.LEWD_HEAVY ? 2 : 1;
    if (!firstRoom && alive.length >= 2 && alive.some((x) => x.traits.includes('tactician'))) {
      mods += 1;
    }
    if (h.traits.includes('berserker') && (h.cond === 'injured' || h.cond === 'severe')) {
      mods += 2;
    }
    if (h.traits.includes('exhibitionist') && state.lust >= 30) mods -= 1;
    if (h.traits.includes('sadist') && highTrapIdx >= 3) mods += 1;
    if (h.traits.includes('cheerful')) mods += Math.floor(fPen / 2);
    if (h.traits.includes('vengeful') && state.prisoners.length > 0) mods += 1;
    if (h.traits.includes('cursed')) mods -= 1;
    if (h.aroused && floorTypes.has('lewd')) mods -= 1;

    // Phase 3: Realm Situations, Hero Bonds & Stories, Guild Prep, EPIC Aura & Nemesis Memory
    const metaMods = computeHeroSituationAndMetaMods(state, h, floor, alive, party);
    mods += metaMods.totalMod;
    // Ticket 15 raid-mods seam: expedition aftereffects + mole intel hero mods
    // (applied after metaMods; audit notes reported once per room below).
    const raidMods = resolveRaidModifiers(state, {
      floorNum: floor.floor,
      isFirstRoom: firstRoom,
      hasMonsterOnFloor: activeMonstersOnFloor.length > 0,
      heroClassKey: h.classKey,
    });
    mods += raidMods.heroModDelta;
    if (h.slot === alive[0]?.slot && raidMods.notes.length > 0) {
      detailLines.push(`- ${raidMods.notes.join('; ')}`);
    }
    if (sanctuaryAllyBonus > 0 && h.slot !== gmHero?.slot) {
      mods += sanctuaryAllyBonus;
    }
    // Nemesis Adaptation against previously encountered trap tags
    const floorTagSet = getFloorTrapTags(floor);
    if (h.epicKind === 'nemesis' && h.adaptedTags && h.adaptedTags.length > 0) {
      const adaptHits = h.adaptedTags.filter((t) => floorTagSet.has(t)).length;
      if (adaptHits > 0) mods += Math.min(EPIC_CFG.ADAPT_MAX, adaptHits);
    }

    const lowerOrigin = (h.origin ?? '').toLowerCase();
    if (
      activeFightersOnFloor.length > 0 &&
      (lowerOrigin.includes('rescue') || lowerOrigin.includes('fianc'))
    ) {
      mods += 1;
    }

    const linkNotes: string[] = [];
    if (incomingLinks.length > 0) {
      let floorLinkPen = 0;
      let raidLinkPen = getHeroRaidLinkPenUsed(nextApUsed, h.slot);
      for (const link of incomingLinks) {
        if (!nextApUsed[`__lk_${h.slot}_${link.fromFloor}`]) continue;
        if (
          floorLinkPen >= MONSTER_CFG.LINK.FLOOR_CAP ||
          raidLinkPen >= MONSTER_CFG.LINK.RAID_CAP
        ) {
          break;
        }
        if (
          (h.traits.includes('mage') || h.traits.includes('scout')) &&
          Math.random() < MONSTER_CFG.LINK.DODGE_CHANCE
        ) {
          linkNotes.push(`dodged ${link.fromFloor}F link`);
          continue;
        }
        const pen = Math.min(
          link.penalty,
          MONSTER_CFG.LINK.FLOOR_CAP - floorLinkPen,
          MONSTER_CFG.LINK.RAID_CAP - raidLinkPen
        );
        if (pen > 0) {
          mods -= pen;
          floorLinkPen += pen;
          raidLinkPen += pen;
          markHeroRaidLinkPen(nextApUsed, h.slot, pen);
          linkNotes.push(`${link.fromFloor}F link -${pen}`);
        }
      }
    }

    // Phase 5 F1: face a slot BEFORE the roll — kink-weighted selection feeds
    // ero-gating, detail text and the audit row (replaces the old post-roll
    // flavor pick).
    const faced = selectFacedSlot(h, floor);
    const eroGated = Boolean(
      faced && floor.slots[faced.index].types.some((t) => TRAP_ERO_TYPES.includes(t))
    );
    // Ticket 30 KP targetability (defense-side): a TIER-attuned slot plays to
    // the kink it absorbed — a hero facing it whose kinkKey maps to the slot's
    // types (the F1 mapping) takes mods −1 (audit-noted).
    const attunementTargeted = Boolean(
      faced && faced.kinkMatched && (floor.slots[faced.index].attunement ?? 0) >= TRAP_ATTUNEMENT.TIER
    );
    if (attunementTargeted) {
      mods -= 1;
    }

    let die = randInt(1, 20);
    let rerolled = false;
    if (die === 1 && h.traits.includes('lucky') && !h.usedLuck) {
      h.usedLuck = true;
      die = randInt(1, 20);
      rerolled = true;
    }

    const activeConds: string[] = [];
    if (h.cond) activeConds.push(h.cond === 'severe' ? 'severely injured' : 'injured');
    if (h.ailment > 0) activeConds.push('afflicted');
    if (h.aroused) activeConds.push('aroused');

    const wasSevere = h.cond === 'severe';
    h.ailment = 0;

    const margin = die + mods - dc;
    const deathMargin =
      CFG.DEATH_MARGIN +
      (!h.traits.includes('ascetic') ? Math.floor(state.lust / CFG.LUST.DEATH_STEP) : 0) -
      (h.traits.includes('reckless') ? 1 : 0) +
      (h.traits.includes('veteran') ? 2 : 0) +
      (h.traits.includes('submissive') ? 1 : 0);

    // Phase 5: the ladder is now the pure decideBeat() — a failed roll in an
    // ero-gated slot funnels to `captured` (never dead), standard slots keep
    // the old death ladder verbatim.
    const beatKey = decideBeat({ die, margin, wasSevere, deathMargin, eroGated });
    // Ticket 29 slot ledger: set when THIS beat is absorbed by the faced slot
    // (capture-meter STAGGER or real capture) — drives the attunement write.
    let caughtBySlot: 'staggered' | 'captured' | null = null;
    let facedDisarmed = false;

    // Corruption seam (ticket 26): every beat resolved inside an ero-type slot
    // feeds the hero ledger — pass AND fail, exactly once per beat (a
    // kink-matched faced slot still counts once). This is corrFeed's ONLY
    // writer; the reset rides the settlement resolution point.
    if (eroGated) {
      h.corrFeed = (h.corrFeed ?? 0) + 1;
    }

    // Ticket 30 DoL exposure loop (dungeon-side): an ASCENDANT-attuned slot
    // feeds corrFeed even on a pass — heroes soak the trap's perfected gimmick
    // just by passing through. Second corrFeed writer, stacks with the
    // ero-beat writer above (kept intact).
    if (faced && (floor.slots[faced.index].attunement ?? 0) >= TRAP_ATTUNEMENT.ASCENDANT) {
      h.corrFeed = (h.corrFeed ?? 0) + 1;
    }

    const afterNotes: string[] = [];
    if (metaMods.labels.length > 0) {
      afterNotes.push(`mods[${metaMods.labels.join(' ')}]`);
    }
    if (attunementTargeted) {
      afterNotes.push(`attuned trap targets ${h.kinkKey} kink (mods −1)`);
    }
    if (beatKey === 'dead' || beatKey === 'captured' || beatKey === 'blunder') {
      const hasGrit = (h.grit ?? 0) > 0;
      if (hasGrit) {
        const cost = beatKey === 'dead' ? 2 : 1;
        h.grit = Math.max(0, (h.grit ?? 0) - cost);
        h.status = 'alive';
        h.fallenFloor = undefined;
        h.fallenWave = undefined;
        h.cond = wasSevere || h.cond === 'injured' ? 'severe' : 'injured';
        afterNotes.push(
          `ENDURES — ${h.grade} Grit (${h.grit}/${h.maxGrit ?? cost}◆ left), now ${h.cond.toUpperCase()}`
        );
        if (h.epicKind === 'nemesis') {
          const adapted = new Set(h.adaptedTags ?? []);
          for (const tag of floorTagSet) {
            if (adapted.size >= EPIC_CFG.ADAPT_MAX) break;
            adapted.add(tag);
          }
          h.adaptedTags = [...adapted];
        }
      } else if (beatKey !== 'dead' && !h.usedStagger) {
        // Phase 5 F2 capture meter: the FIRST would-be captured beat per hero
        // per raid converts to STAGGERED — the hero stays fully alive and
        // never enters `fell` (no monster XP, no fear gain). Death paths
        // bypass the meter; so does the core-guard capture at the Core Room.
        h.usedStagger = true;
        h.staggered = true;
        caughtBySlot = 'staggered';
        afterNotes.push('capture meter spent — STAGGERED, alive but shaken (mods −1)');
      } else {
        h.status = beatKey === 'dead' ? 'dead' : 'captured';
        if (h.status === 'captured') {
          caughtBySlot = 'captured';
          // Ticket 30 capture-seed plumbing: remember WHICH slot absorbed the
          // capture beat so the settlement seed can read that slot's
          // attunement/attunedKink (cleared at the settlement resolution
          // point).
          h.facedSlotIdx = faced?.index;
        }
        h.fallenFloor = floor.floor;
        h.fallenWave = wave;
        fell.push(h);
        if (h.status === 'dead') fearGain += CFG.FEAR.KILL;
      }
    } else if (beatKey === 'narrow') {
      if (raidMods.critRoomSaveChance > 0 && Math.random() < raidMods.critRoomSaveChance) {
        afterNotes.push('workshop critical-room save prevented injury');
      } else if (h.traits.includes('nimble')) {
        afterNotes.push('slipped through unhurt');
      } else if (h.traits.includes('ironhide') && !h.injIgnored) {
        h.injIgnored = true;
        afterNotes.push('ironhide ignored the first wound');
      } else {
        h.cond = h.cond === 'injured' || wasSevere ? 'severe' : 'injured';
        afterNotes.push(h.cond === 'severe' ? 'now SEVERELY INJURED' : 'now INJURED');
      }
      if (h.epicKind === 'nemesis') {
        const adapted = new Set(h.adaptedTags ?? []);
        for (const tag of floorTagSet) {
          if (adapted.size >= EPIC_CFG.ADAPT_MAX) break;
          adapted.add(tag);
        }
        h.adaptedTags = [...adapted];
      }
    } else if (
      floor.slots.length >= 2 &&
      beatKey !== 'luck' &&
      margin <= CFG.AILMENT_MARGIN &&
      Math.random() < CFG.AILMENT_CHANCE
    ) {
      if (h.guarded) {
        h.guarded = false;
        afterNotes.push('EPIC guarded resisted first ailment');
      } else {
        h.ailment = 1;
        afterNotes.push('now AFFLICTED');
      }
    }

    // Ticket 29 Stage 2.5 — one beat event, two ledgers: the same beat that
    // resolved the hero writes the faced slot's wear/attunement ledger into
    // nextFloors (pure applyTrapBeat; spent/disarmed slots receive nothing).
    // Guarded on the faced slot existing in the state's own floor copy —
    // encounter-only callers may pass a floor that is not registered.
    if (faced) {
      const ledgerFl = nextFloors.find((fl) => fl.floor === floor.floor);
      const slotBefore = ledgerFl ? ledgerFl.slots[faced.index] : undefined;
      if (ledgerFl && slotBefore) {
        const slotAfter = applyTrapBeat(slotBefore, {
          beatKey,
          margin,
          kinkMatched: faced.kinkMatched,
          caughtBySlot: caughtBySlot ?? undefined,
          heroKinkKey: h.kinkKey,
          isDisarmer: h.traits.includes('disarmer'),
        });
        ledgerFl.slots[faced.index] = slotAfter;
        if (slotAfter.status === 'disarmed' && slotBefore.status !== 'disarmed') {
          facedDisarmed = true;
          afterNotes.push(`DISARMED faced trap #${faced.index + 1}`);
        }
      }
    }

    if (
      h.status === 'alive' &&
      state.lust >= CFG.LUST.AROUSE_FROM &&
      margin <= CFG.LUST.AROUSE_MARGIN &&
      !h.aroused &&
      !h.traits.includes('ascetic') &&
      !h.traits.includes('antidote')
    ) {
      const arouseChance = (state.lust / CFG.LUST.AROUSE_DIV) * (h.traits.includes('lewd') ? 2 : 1);
      if (Math.random() < arouseChance) {
        if (h.guarded) {
          h.guarded = false;
          afterNotes.push('EPIC guarded resisted arousal');
        } else {
          h.aroused = true;
          afterNotes.push('now AROUSED');
        }
      }
    }

    if (
      h.status === 'alive' &&
      (beatKey === 'narrow' || h.staggered || h.ailment > 0 || h.aroused)
    ) {
      // Phase 5 F2: a staggered hero stumbles — the floor-link mark applies.
      nextApUsed[`__lk_${h.slot}_${floor.floor}`] = true;
    }

    if (linkNotes.length > 0) {
      afterNotes.unshift(...linkNotes);
    }

    if (rerolled) afterNotes.push('lucky: rerolled a natural 1');

    const beat = BEATS[beatKey];
    const how = pickHowFlavor(beatKey, floor.slots.length >= 2, alive.length >= 2, alive.length === 1);
    const facedText = faced
      ? ` · faced: #${faced.index + 1} ${faced.label}${faced.kinkMatched ? ' · kink' : ''}`
      : '';

    const condPrefix = activeConds.length > 0 ? ` [${activeConds.join(', ')}]` : '';
    const afterSuffix = afterNotes.length > 0 ? `, ${afterNotes.join(', ')}` : '';
    const signMargin = margin >= 0 ? `+${margin}` : `${margin}`;

    detailLines.push(
      `- ${h.name}${condPrefix}: ${beat.outcomeLabel} (margin ${signMargin})${afterSuffix}${facedText} · hint: ${how}`
    );
    shortSummary.push(`${h.name}: ${beat.outcomeLabel}`);
    h.lastRollText = `d20(${die})${mods >= 0 ? `+${mods}` : mods}=${die + mods} vs DC ${dc}`;
    anyCondition = anyCondition || activeConds.length > 0 || afterNotes.length > 0;

    audit.push({
      slot: h.slot,
      heroName: h.name,
      die,
      mods,
      total: die + mods,
      dc,
      margin,
      deathMargin,
      beat: beatKey,
      fearPenalty: fPen,
      statusAfter: h.status,
      faced: faced
        ? `#${faced.index + 1} ${faced.label}${faced.kinkMatched ? ' (kink)' : ''}${facedDisarmed ? ' [disarmed]' : ''}`
        : undefined,
    });
  }

  // Healer post-room patch
  const livingAfter = party.filter((h) => h.status === 'alive');
  const healer = livingAfter.find((h) => h.traits.includes('healer'));
  const wounded = [...livingAfter]
    .filter((h) => h.cond === 'severe' || h.cond === 'injured')
    .sort((a, b) => (CFG.INJURY[b.cond] ?? 0) - (CFG.INJURY[a.cond] ?? 0))[0];
  if (healer && wounded) {
    const oldCond = wounded.cond;
    wounded.cond = oldCond === 'severe' ? 'injured' : '';
    detailLines.push(
      `Healer ${healer.name} patches up ${wounded.name} (${oldCond} → ${wounded.cond || 'healthy'}).`
    );
  }

  // Post-room Monster XP, injury/death & Captive Fighter stamina/betrayal
  const killsInRoom = fell.filter((h) => h.status === 'dead').length;
  const capturesInRoom = fell.filter((h) => h.status === 'captured').length;
  const xpReward =
    killsInRoom * MONSTER_CFG.XP_KILL + capturesInRoom * MONSTER_CFG.XP_CAPTURE;

  for (const activeMon of activeMonstersOnFloor) {
    const idx = nextMonsters.findIndex((m) => m.id === activeMon.id);
    if (idx < 0) continue;
    let mon = { ...nextMonsters[idx] };
    if (xpReward > 0 || killsInRoom > 0) {
      mon.xp += xpReward;
      mon.kills += killsInRoom;
      const growth = applyMonsterGrowth(mon);
      mon = growth.monster;
      if (xpReward > 0) {
        detailLines.push(
          `- ${getMonsterDisplayName(mon)} gained +${xpReward} XP (${killsInRoom} kill, ${capturesInRoom} cap).`
        );
      }
      for (const gl of growth.logs) {
        detailLines.push(`- ${gl}`);
      }
    }

    if (livingAfter.length > 0) {
      const pDie = Math.max(
        MONSTER_CFG.DIE_MIN,
        MONSTER_CFG.DIE_BASE +
          MONSTER_CFG.DIE_PER_ALIVE_HERO * (livingAfter.length - 1) -
          MONSTER_CFG.DIE_PER_STAR * (mon.stars - 1)
      );
      if (Math.random() < pDie) {
        const lostName = getMonsterDisplayName(mon);
        nextMonsters = nextMonsters.filter((m) => m.id !== mon.id);
        nextFloors = nextFloors.map((fl) =>
          fl.floor === floor.floor
            ? {
                ...fl,
                combatSlots: (fl.combatSlots ?? []).filter(
                  (s) => !(s.kind === 'monster' && s.monsterId === mon.id)
                ),
              }
            : fl
        );
        nextParts += 1;
        detailLines.push(`- ${lostName} was SLAIN defending ${floor.floor}F (+1 Trap Parts).`);
        continue;
      }
      mon.injuredUntilWave = wave + 1;
      detailLines.push(
        `- ${getMonsterDisplayName(mon)} was INJURED in battle (recovers W${wave + 1}).`
      );
    }

    nextMonsters[idx] = mon;
  }

  for (const activeFighter of activeFightersOnFloor) {
    const fIdx = nextPrisoners.findIndex((p) => p.pid === activeFighter.pid);
    if (fIdx < 0) continue;
    const fighter = nextPrisoners[fIdx];
    if (
      livingAfter.length > 0 &&
      fighter.resist >= MONSTER_CFG.FSLOT.BETRAY_RESIST_FROM &&
      Math.random() < fighter.resist / MONSTER_CFG.FSLOT.BETRAY_DIV
    ) {
      nextPrisoners = nextPrisoners.filter((p) => p.pid !== fighter.pid);
      nextFloors = nextFloors.map((fl) =>
        fl.floor === floor.floor
          ? {
              ...fl,
              combatSlots: (fl.combatSlots ?? []).filter(
                (s) => !(s.kind === 'prisoner' && s.pid === fighter.pid)
              ),
            }
          : fl
      );
      detailLines.push(
        `- Captive Fighter ${fighter.name} (resist ${fighter.resist}) BETRAYED the dungeon and escaped with the party!`
      );
      continue;
    }

    const stamLoss =
      MONSTER_CFG.FSLOT.FIGHTER_HIT +
      (livingAfter.length > 0 ? MONSTER_CFG.FSLOT.FIGHTER_CLEAR_HIT : 0);
    nextPrisoners[fIdx] = {
      ...fighter,
      stamina: Math.max(0, fighter.stamina - stamLoss),
    };
  }

  return {
    dc,
    detailLines,
    shortSummary,
    party,
    fell,
    anyCondition,
    fearGain,
    audit,
    nextMonsters,
    nextFloors,
    nextPrisoners,
    nextParts,
    nextApUsed,
  };
}

export function calcRetreatChance(state: GameState, party: Hero[], fellCount: number): number {
  const alive = party.filter((h) => h.status === 'alive');
  if (alive.length === 0) return 0;
  if (alive.some((h) => h.noRetreat || h.epic)) return 0;

  let p = 0;
  const R = CFG.RETREAT;
  if (alive.length === 1) {
    p =
      R.SOLO +
      (alive[0].cond === 'severe' ? R.SOLO_SEV : alive[0].cond === 'injured' ? R.SOLO_INJ : 0);
  } else if (alive.some((h) => h.cond === 'severe')) {
    p = R.GROUP_SEV;
  }

  const traits = new Set(alive.flatMap((h) => h.traits));
  const elite = alive.some((h) => heroGradeIndex(h.grade) >= 5);
  const reason = p > 0 || fellCount > 0;
  if (elite) p += R.ELITE;
  if (reason) {
    if (traits.has('cautious')) p += 0.1;
    if (traits.has('coward')) p += 0.15;
    if (traits.has('reckless')) p -= 0.15;
    if (traits.has('greedy')) p -= 0.1;
    if (!traits.has('exorcist')) p += state.fear * CFG.FEAR.RET;
  }
  return clamp(p, 0, R.MAX);
}

export function advanceRaidStep(state: GameState): {
  state: GameState;
  outcome: RaidOutcome;
  floorLabel: string;
  detailText: string;
  isFinal: boolean;
} {
  const nextFloor = getNextTrapFloor(state.floors, state.floorCursor + 1);
  let party = state.party.map((h) => ({ ...h }));
  let outcome: RaidOutcome;
  let floorLabel = 'Core';
  let floorCursor = 7;
  let detailLines: string[] = [];
  let shortParts: string[] = [];
  let fearGain = 0;
  let audit: RaidAuditRow[] = [];
  let nextMonsters = state.monsters;
  let nextFloors = state.floors;
  let nextPrisoners = state.prisoners;
  let nextParts = state.parts;
  let nextApUsed = state.raidFirstRoom ? stripRaidLinkKeys(state.apUsed) : state.apUsed;

  if (!nextFloor) {
    const aliveCount = party.filter((h) => h.status === 'alive').length;
    outcome = aliveCount === 3 ? 'breach' : 'partial';
    detailLines = ['No traps remain; the survivors reach the Core.'];
  } else {
    const aliveBefore = party.filter((h) => h.status === 'alive').length;
    const res = resolveFloorEncounter(state, nextFloor, party, state.wave);
    party = res.party;
    floorCursor = nextFloor.floor;
    floorLabel = `${nextFloor.floor}F`;
    fearGain = res.fearGain;
    audit = res.audit;
    nextMonsters = res.nextMonsters;
    nextFloors = res.nextFloors;
    nextPrisoners = res.nextPrisoners;
    nextParts = res.nextParts;
    nextApUsed = res.nextApUsed;
    detailLines = [
      `Floor ${nextFloor.floor} room, DC ${res.dc}, party of ${aliveBefore}: ${formatFloorRoomText(nextFloor)}`,
      ...res.detailLines,
    ];
    shortParts = res.shortSummary;

    const aliveAfter = party.filter((h) => h.status === 'alive').length;
    if (aliveAfter === 0) {
      outcome = 'wipe';
    } else if (!getNextTrapFloor(nextFloors, nextFloor.floor + 1)) {
      outcome = aliveAfter === 3 ? 'breach' : 'partial';
    } else {
      const retreatP = calcRetreatChance(state, party, res.fell.length);
      if (retreatP > 0 && Math.random() < retreatP) {
        outcome = 'retreat';
        party = party.map((h) => {
          if (h.status === 'alive') {
            detailLines.push(`- ${h.name}: RETREATED alive from the dungeon.`);
            return { ...h, status: 'retreated' };
          }
          return h;
        });
      } else {
        outcome = res.fell.length > 0 ? 'fall' : 'pass';
      }
    }
  }

  if (outcome === 'partial' || outcome === 'breach') {
    // Ticket 15 raid-mods seam: core-room capture (estate coreCaptureBonus +
    // crisis `core_guard`). Survivors reaching the Core may be caught by the
    // guard instead of breaching; outcome downgrades only when captures happen.
    const coreMods = resolveRaidModifiers(state, {
      floorNum: 0,
      isFirstRoom: false,
      hasMonsterOnFloor: false,
    });
    let coreCaptured = 0;
    if (coreMods.coreCaptureBonus > 0) {
      for (const h of party) {
        if (h.status === 'alive' && Math.random() < coreMods.coreCaptureBonus) {
          h.status = 'captured';
          h.fallenFloor = state.floorCursor > 0 ? state.floorCursor : 7;
          h.fallenWave = state.wave;
          coreCaptured += 1;
          detailLines.push(`- ${h.name}: CAPTURED by the core guard at the Core Room!`);
        }
      }
    }
    if (coreCaptured > 0) {
      const aliveAtCore = party.filter((h) => h.status === 'alive').length;
      if (aliveAtCore === 0) {
        outcome = 'wipe';
        detailLines.push('- The core guard repels the raid — no one breaches the Core.');
      } else if (outcome === 'breach') {
        outcome = 'partial';
      }
    }
    for (const h of party) {
      if (h.status === 'alive') {
        detailLines.push(`- ${h.name}: BREACHED the Core Room alive.`);
      }
    }
  }

  const isFinal = outcome !== 'pass' && outcome !== 'fall';
  const detailText = detailLines.join('\n');

  let nextState: GameState = {
    ...state,
    party,
    monsters: nextMonsters,
    floors: nextFloors,
    prisoners: nextPrisoners,
    parts: nextParts,
    apUsed: isFinal ? stripRaidLinkKeys(nextApUsed) : nextApUsed,
    floorCursor,
    fear: clamp(state.fear + fearGain, 0, 100),
    raidFirstRoom: false,
    lastRaidDetail: detailText,
    lastOutcome: outcome,
    lastAudit: audit,
    flash: `${floorLabel}: ${shortParts.join(' · ') || outcome.toUpperCase()}`,
  };

  if (isFinal) {
    nextState = applyWaveSettlement(nextState, outcome);
  }

  return { state: nextState, outcome, floorLabel, detailText, isFinal };
}

export function applyWaveSettlement(state: GameState, outcome: RaidOutcome): GameState {
  const beforeMp = state.points;
  const items: { label: string; delta: number }[] = [];
  let delta = 0;
  let fameDelta = 0;
  let killsDelta = 0;
  let nextPid = state.nextPid;
  const newPrisoners: Prisoner[] = [];

  const addItem = (label: string, val: number) => {
    if (val === 0) return;
    delta += val;
    items.push({ label, delta: val });
  };

  const festivalActive = Boolean(hasActiveRealmSituation(state, 'festival', state.wave));
  const princessSit = hasActiveRealmSituation(state, 'princess', state.wave);
  const topSlot = [...state.party].sort((a, b) => heroGradeIndex(b.grade) - heroGradeIndex(a.grade) || a.slot - b.slot)[0]?.slot;

  let survivors = 0;
  for (const h of state.party) {
    if (h.status === 'dead' || h.status === 'captured') {
      const baseReward = CFG.HERO_REWARD[h.grade] ?? 0;
      addItem(
        `${h.status === 'dead' ? 'Killed' : 'Captured'} ${h.name} (${h.grade})`,
        baseReward
      );
      if (festivalActive && baseReward > 0) {
        addItem(`🍀 Goddess Festival bonus (${h.name})`, Math.floor(baseReward * 0.5));
      }
      if (princessSit && h.slot === topSlot && h.status === 'captured') {
        addItem(`👑 Captured Knight-Princess (${h.name})`, 300);
      }
      if (h.epicKind === 'nemesis') {
        addItem(`💀 Nemesis Slain/Captured Bonus (${h.name})`, EPIC_CFG.REWARD);
      }
      fameDelta += CFG.FAME.HERO[h.grade] ?? 1;
      if (h.status === 'dead') {
        killsDelta += 1;
      } else {
        let resist =
          (CFG.PRISON_RESIST[h.grade] ?? 40) + (CFG.PRISON_CAP_INJ[h.cond] ?? 0);
        if (h.traits.includes('noble')) resist += 15;
        if (h.traits.includes('pure')) resist += 25;
        if (h.traits.includes('masochist')) resist -= 20;
        if (h.traits.includes('ascetic')) resist += 10;
        const clampedResist = h.epic ? 100 : clamp(resist, 0, 100);
        // Corruption seam (ticket 26→27): matched-kink flag for the seed
        // formula — computed LOCALLY at the capture boundary, nothing stored
        // on hero or prisoner. facedSlotTypes is the capture floor's slot
        // types (the capture beat resolved against one of those slots).
        // Ticket 30: the attunement term needs the SPECIFIC faced slot, not
        // just the floor — resolveFloorEncounter plumbs the index through
        // Hero.facedSlotIdx when the capture beat lands; legacy captures
        // without it simply contribute no attunement term.
        const captureFloor = state.floors.find(
          (fl) => fl.floor === (h.fallenFloor ?? state.floorCursor)
        );
        const facedSlot =
          h.facedSlotIdx !== undefined ? captureFloor?.slots[h.facedSlotIdx] : undefined;
        const facedSlotTypes = (captureFloor?.slots ?? []).flatMap((s) => s.types);
        const matchedKink =
          (KINK_TRAP_MAP[h.kinkKey]?.some((t) => facedSlotTypes.includes(t)) ?? false) ||
          facedSlot?.attunedKink === h.kinkKey;
        // Corruption seam (ticket 27): debate seed formula replaces the old
        // 2-boolean seed (lewd?20 + aroused?15). +5 warm-but-bound baseline;
        // corrFeed pays out ×8 — read HERE, BEFORE the settlement reset below
        // wipes it (ticket 26 deliberately ordered the reset after this
        // prisoner build); kink targeting pays lewd +20 / aroused +15 /
        // matched faced slot +10. Ticket 30: a faced slot attuned to at least
        // TIER knows exactly how to hold this hero — +10. Clamped to 45 so
        // even a fully-pressured kink-matched capture lands at the
        // Wavering/Complicit border — continuity, never a free win.
        const corr = clamp(
          5 +
            (h.traits.includes('lewd') ? 20 : 0) +
            (h.aroused ? 15 : 0) +
            (h.corrFeed ?? 0) * 8 +
            (matchedKink ? 10 : 0) +
            ((facedSlot?.attunement ?? 0) >= TRAP_ATTUNEMENT.TIER ? 10 : 0),
          0,
          45
        );
        const staminaMax = h.traits.includes('tough') ? 120 : 100;
        const baseStamina = h.cond === 'severe' ? 60 : h.cond === 'injured' ? 80 : 100;
        newPrisoners.push({
          pid: nextPid++,
          name: h.name,
          grade: h.grade,
          raceLabel: h.raceLabel,
          classLabel: h.classLabel,
          traits: [...h.traits],
          // Corruption seam (ticket 26): carry hero identity through the
          // capture boundary (optional fields only — legacy prisoners
          // without them stay valid).
          kinkKey: h.kinkKey,
          kinkDesc: h.kinkDesc,
          persona: h.persona,
          skill: h.skill,
          weakness: h.weakness,
          capturedWave: state.wave,
          capturedFloor: h.fallenFloor ?? state.floorCursor,
          resist: clampedResist,
          corr,
          gender: h.gender,
          stamina: Math.min(baseStamina, staminaMax),
          staminaMax,
          pleasure: Math.floor(corr * 0.5),
          terror: Math.floor((100 - clampedResist) * 0.3),
          shame: 0,
          marks: { obey: 0, pleasure: 0, terror: 0, shame: 0 },
          cond: h.cond,
          job: null,
          converted: null,
          assignedFloor: null,
          owner: null,
          ...(h.epic ? { legend: true } : {}),
          afflictions: [],
          virgin: h.exp === 'virgin',
          breeding: null,
          intel: h.intel,
        });
      }
    } else if (outcome === 'breach' || outcome === 'partial') {
      survivors += 1;
      const pen = Math.round(
        (CFG.HERO_PENALTY[h.grade] ?? 0) * (outcome === 'partial' ? CFG.PARTIAL_PEN : 1)
      );
      addItem(`Breached by ${h.name} (${h.grade})`, -pen);
    }
  }

  addItem('Core mana harvest', CFG.INCOME);

  if (outcome === 'wipe' || outcome === 'retreat') {
    addItem('Successful defense bonus', CFG.DEFENSE_BONUS);
  }
  if (outcome === 'retreat') {
    addItem('Routed survivors bonus', CFG.RETREAT.BONUS);
  }
  if (state.evalScores?.bonusMp) {
    addItem(`Lilim review bonus (${state.evalScores.overall})`, state.evalScores.bonusMp);
  }

  // Hunt Captain wave bonus
  if (state.wave % 10 === 0) {
    const fallenBoss = state.party.find(
      (h) => (h.grade === 'SS' || h.grade === 'SSS') && (h.status === 'dead' || h.status === 'captured')
    );
    if (fallenBoss) {
      addItem(`Hunt Captain bounty (${fallenBoss.name})`, (CFG.HERO_REWARD[fallenBoss.grade] ?? 200) * 2);
      fameDelta += 15;
    }
  }

  let pointsAfter = Math.max(0, beforeMp + delta);
  if (outcome === 'breach' && pointsAfter > 0) {
    const plunder = Math.floor(pointsAfter * CFG.BREACH_PLUNDER);
    if (plunder > 0) {
      pointsAfter = Math.max(0, pointsAfter - plunder);
      items.push({ label: 'Core plundered (20%)', delta: -plunder });
    }
  }

  // Realm post-raid penalties & rewards (tax, bounty, broadcast)
  const taxSit = hasActiveRealmSituation(state, 'tax', state.wave);
  if (taxSit && !taxSit.countered && !state.settings.upkeepEnabled && pointsAfter > 0) {
    const tribute = Math.min(pointsAfter, 100);
    pointsAfter -= tribute;
    items.push({ label: '📜 Demon Army Tribute', delta: -tribute });
  }
  const bountySit = hasActiveRealmSituation(state, 'bounty', state.wave);
  if (bountySit && !bountySit.countered && (outcome === 'breach' || outcome === 'partial') && pointsAfter > 0) {
    const medFee = Math.min(pointsAfter, 120);
    pointsAfter -= medFee;
    items.push({ label: '🎯 Officer Bounty medical fee', delta: -medFee });
  }
  const broadcastSit = hasActiveRealmSituation(state, 'broadcast', state.wave);
  let extraFear = 0;
  let extraLust = 0;
  if (broadcastSit && (outcome === 'wipe' || outcome === 'retreat')) {
    fameDelta += 20;
    extraFear += 3;
    items.push({ label: '📺 Live Broadcast Victory (+2 Fame, +3 Fear)', delta: 0 });
  }

  // Realm: Tamer steals ★1 monsters (30% each) & Plague kills 10% monsters
  let nextMonsters = state.monsters.map((m) => ({ ...m }));
  // Ticket 29: the settlement resolution point also settles the slot ledger —
  // the dungeon re-arms every trap (status → armed), wear decays toward 0 and
  // attunement/attunedKink persist forever (ratchet floor at TIER).
  let nextFloors = state.floors.map((fl) => ({
    ...fl,
    slots: fl.slots.map(settleTrapSlot),
    combatSlots: (fl.combatSlots ?? []).map((cs) => ({ ...cs })),
  }));
  const tamerSit = hasActiveRealmSituation(state, 'tamer', state.wave);
  if (tamerSit && nextMonsters.length > 0) {
    const deployedIds = new Set(
      nextFloors.flatMap((fl) =>
        (fl.combatSlots ?? []).filter((cs) => cs.kind === 'monster').map((cs) => cs.monsterId)
      )
    );
    const stolen = new Set<string>();
    for (const m of nextMonsters) {
      if (deployedIds.has(m.id) && m.stars <= 1 && Math.random() < 0.3) {
        stolen.add(m.id);
        items.push({ label: `🐉 Tamer stole ${getMonsterDisplayName(m)}`, delta: 0 });
      }
    }
    if (stolen.size > 0) {
      nextMonsters = nextMonsters.filter((m) => !stolen.has(m.id));
      nextFloors = nextFloors.map((fl) => ({
        ...fl,
        combatSlots: (fl.combatSlots ?? []).filter(
          (cs) => !(cs.kind === 'monster' && stolen.has(cs.monsterId))
        ),
      }));
    }
  }
  const plagueSit = hasActiveRealmSituation(state, 'plague', state.wave);
  if (plagueSit && !plagueSit.countered && nextMonsters.length > 0) {
    const plagued = new Set<string>();
    for (const m of nextMonsters) {
      if (Math.random() < 0.1) {
        plagued.add(m.id);
        items.push({ label: `🦠 ${getMonsterDisplayName(m)} died of plague`, delta: 0 });
      }
    }
    if (plagued.size > 0) {
      nextMonsters = nextMonsters.filter((m) => !plagued.has(m.id));
      nextFloors = nextFloors.map((fl) => ({
        ...fl,
        combatSlots: (fl.combatSlots ?? []).filter(
          (cs) => !(cs.kind === 'monster' && plagued.has(cs.monsterId))
        ),
      }));
    }
  }

  // Relics, Wonders & Annexed Rival passive post-raid stats
  if (state.relics.owned.includes('chalice')) extraFear += 2;
  if (state.wonders.temple) {
    extraFear += 3;
    extraLust += 3;
  }
  if (state.war.rivals.paladin.annexed) extraFear += WAR_CFG.PAL_FEAR;

  const fameBefore = state.fame;
  const nextFamePts = clamp(
    state.famePoints +
      fameDelta +
      (CFG.FAME.OUTCOME[outcome] ?? 0) * (outcome === 'partial' ? Math.max(1, survivors) : 1),
    0,
    CFG.FAME.POINT_MAX
  );
  const fameAfter = Math.floor(nextFamePts / 10);

  const momBefore = state.momentum;
  const momAfter = clamp(
    state.momentum + (CFG.MOMENTUM.OUTCOME[outcome] ?? 0),
    -CFG.MOMENTUM.MAX,
    CFG.MOMENTUM.MAX
  );

  // Guild alert update from wave 3 onward
  let guildPoints = state.guildPoints;
  let guildActive = state.guildActive;
  if (state.wave >= CFG.GUILD.EARLY_W) {
    if (state.wave === CFG.GUILD.EARLY_W || !guildActive) {
      guildPoints = CFG.GUILD.START;
      guildActive = true;
    } else {
      const floorPt = clamp(
        (state.wave - CFG.GUILD.EARLY_W) * CFG.GUILD.FLOOR_STEP,
        0,
        CFG.GUILD.FLOOR_MAX
      );
      const capEntry = CFG.GUILD.CAP.find(([upto]) => state.wave <= upto);
      const capPt = capEntry ? capEntry[1] : 100;
      guildPoints = clamp(
        guildPoints + (CFG.GUILD.OUT[outcome] ?? 0) + CFG.GUILD.WAVE,
        floorPt,
        capPt
      );
    }
  }

  const fearNext = clamp(
    Math.floor((state.fear + (outcome === 'wipe' ? CFG.FEAR.WIPE : 0) + extraFear) * CFG.DECAY),
    0,
    100
  );
  const lustNext = clamp(
    Math.floor((state.lust + newPrisoners.length * CFG.LUST.CAPTURE + extraLust) * CFG.DECAY),
    0,
    100
  );

  // Phase 3: Wrath, Holy Crusade, Legendary Nemesis & Guild Prep / Realm Next Roll
  let nextCrises = {
    ...state.crises,
    nemesis: [...state.crises.nemesis],
    crusade: { ...state.crises.crusade },
    lastNoBreachStreak:
      outcome === 'breach' || outcome === 'partial'
        ? 0
        : (state.crises.lastNoBreachStreak ?? 0) + 1,
  };
  let nextEndings = {
    ...state.endings,
    titles: [...state.endings.titles],
  };

  // Nemesis encounter resolution
  const activeNemesis = state.party.find((h) => h.epicKind === 'nemesis');
  let postState: GameState = {
    ...state,
    mode: 'result',
    points: pointsAfter,
    kills: state.kills + killsDelta,
    famePoints: nextFamePts,
    fame: fameAfter,
    momentum: momAfter,
    fear: fearNext,
    lust: lustNext,
    guildPoints,
    guildActive,
    monsters: nextMonsters,
    floors: nextFloors,
    prisoners: [...state.prisoners, ...newPrisoners],
    nextPid,
    crises: nextCrises,
    endings: nextEndings,
    lastSettlement: {
      wave: state.wave,
      outcome,
      items,
      totalDelta: pointsAfter - beforeMp,
      pointsAfter,
      fameBefore,
      fameAfter,
      momentumBefore: momBefore,
      momentumAfter: momAfter,
      guildLv: getGuildLevel({ ...state, guildPoints, guildActive }, state.wave + 1),
      capturedCount: newPrisoners.length,
      killedCount: killsDelta,
    },
    flash: `Wave ${state.wave} ${outcome.toUpperCase()} · ${pointsAfter - beforeMp >= 0 ? '+' : ''}${pointsAfter - beforeMp} MP`,
  };

  if (activeNemesis) {
    if (activeNemesis.status === 'dead' || activeNemesis.status === 'captured') {
      postState.crises.nemesis = postState.crises.nemesis.filter(
        (n) => n.id !== activeNemesis.nemesisId
      );
      if (!postState.endings.titles.includes('Nemesis Bane')) {
        postState.endings.titles.push('Nemesis Bane');
      }
      const relicRes = grantUnownedRelic(postState, `Defeated Nemesis ${activeNemesis.name}`);
      postState = relicRes.state;
      items.push({
        label: relicRes.granted
          ? `🏆 Nemesis Trophy: Obtained Relic (${relicRes.granted})`
          : '🏆 Nemesis Trophy (+100 MP)',
        delta: relicRes.fallbackMp,
      });
    } else {
      postState.crises.nemesis = postState.crises.nemesis.map((n) =>
        n.id === activeNemesis.nemesisId
          ? {
              ...n,
              escapedWave: state.wave,
              adaptedTags: [...(activeNemesis.adaptedTags ?? [])],
            }
          : n
      );
    }
  } else if (
    state.wave >= CRISIS_CFG.WRATH_FROM &&
    (outcome === 'retreat' || outcome === 'breach')
  ) {
    const escapedElite = state.party.find(
      (h) =>
        (h.status === 'alive' || h.status === 'retreated') &&
        !h.epic &&
        heroGradeIndex(h.grade) >= heroGradeIndex('A')
    );
    if (escapedElite) {
      const nem = buildNemesisFromHero(postState, escapedElite, state.wave);
      postState.crises.nemesis = capNemesisRoster([...postState.crises.nemesis, nem], EPIC_CFG.NEM_CAP);
    }
  }

  // Crusade progression / victory
  if (postState.crises.crusade.active) {
    const remaining = postState.crises.crusade.wavesLeft - 1;
    if (remaining <= 0) {
      postState.crises.crusade = {
        ...postState.crises.crusade,
        active: false,
        wavesLeft: 0,
      };
      if (outcome === 'wipe' || outcome === 'retreat') {
        postState.famePoints = CFG.FAME.POINT_MAX;
        postState.fame = CFG.FAME.MAX;
        if (!postState.endings.titles.includes('Crusade Breaker')) {
          postState.endings.titles.push('Crusade Breaker');
        }
        const relicRes = grantUnownedRelic(postState, 'Holy Crusade Wave 3 Victory');
        postState = relicRes.state;
        items.push({
          label: relicRes.granted
            ? `✝ Crusade Shattered! Fame MAX & Relic (${relicRes.granted})`
            : '✝ Crusade Shattered! Fame MAX & +100 MP',
          delta: relicRes.fallbackMp,
        });
      }
    } else {
      postState.crises.crusade = {
        ...postState.crises.crusade,
        wavesLeft: remaining,
      };
    }
  } else if (state.wave >= CRISIS_CFG.WRATH_FROM || postState.crises.wrath > 0) {
    const kc = killsDelta + newPrisoners.length;
    const nextStreak =
      kc > 0 && (outcome === 'wipe' || outcome === 'retreat')
        ? postState.crises.cleanKillStreak + 1
        : 0;
    const wrathDelta =
      CRISIS_CFG.WRATH_KILL * kc +
      (nextStreak >= 3 ? CRISIS_CFG.WRATH_STREAK : 0) -
      (kc > 0 ? CRISIS_CFG.WRATH_FAIL_DECAY : CRISIS_CFG.WRATH_BREACH);
    const nextWrath = clamp(postState.crises.wrath + wrathDelta, 0, CRISIS_CFG.WRATH_MAX);
    postState.crises.cleanKillStreak = nextStreak;
    if (nextWrath >= CRISIS_CFG.WRATH_MAX && state.wave >= postState.crises.crusade.cooldown) {
      postState.crises.wrath = 0;
      postState.crises.crusade = {
        active: true,
        wavesLeft: CRISIS_CFG.CRUSADE_WAVES,
        cooldown: state.wave + CRISIS_CFG.CRUSADE_CD,
      };
      postState.crises.lastCrisisCard = {
        kind: 'crusade',
        title: 'Holy Crusade Declared!',
        subtitle: `Wave ${state.wave} — Wrath reached 100%`,
        body: 'The Church launches a 3-wave Holy Crusade led by SS/SSS Paladins and the Grand Master on Wave 3. Expeditions are suspended.',
        assetKey: 'dk_cr_crusade',
        wave: state.wave,
        resolved: false,
      };
      items.push({ label: '✝ Holy Crusade Triggered (3 waves)!', delta: 0 });
    } else {
      postState.crises.wrath = nextWrath;
    }
  }

  postState = updateGuildPrepOnRaidEnd(postState, outcome);
  postState = rollRealmSituationsForNextWave(postState, state.wave).state;

  // Check Core breach / Ruin collapse with Vault Core Guard & Casual Grace
  if (outcome === 'breach' && (beforeMp <= 0 || postState.points <= 0)) {
    const coreCheck = flagOrProtectGameOver(postState, 'core', { deferPending: true });
    postState = coreCheck.state;
    if (coreCheck.protectedBy === 'vault') {
      items.push({ label: '🛡 Vault Core Guard (-50 Vault MP → +50 Core MP)', delta: 50 });
    } else if (coreCheck.protectedBy === 'casual_grace') {
      items.push({ label: '✨ Casual Grace Rescue (1/run · +50 Core MP)', delta: 50 });
    }
  } else if (postState.town.pop <= 0) {
    const ruinCheck = flagOrProtectGameOver(postState, 'ruin', { deferPending: true });
    postState = ruinCheck.state;
    if (ruinCheck.protectedBy === 'casual_grace') {
      items.push({ label: '✨ Casual Grace Rescue (Town Pop rallied to 15)', delta: 0 });
    }
  }

  postState = evaluateRankTrials(postState, outcome);

  // --- Ticket 16: settlement resolution point ------------------------------
  // applyWaveSettlement is the single end-of-raid resolution spot. The raid's
  // DC/mods were consumed earlier in advanceRaidStep (resolveFloorEncounter +
  // the core-room capture branch), so everything promised "for the NEXT raid"
  // expires HERE, once per raid — consumed buffs can no longer leak into the
  // next wave (startNewDay only resets day perks by design).
  //   1. Expedition aftereffects tick — wavesLeft finally decrements per raid.
  //   2. Active double-agent mole decrement — 0 -> idle (job/floor-slot
  //      eligibility is restored automatically: isActiveMole goes false and
  //      isActiveCaptive true again; job/assignedFloor were already nulled at
  //      dispatch).
  //   3. One-shot activeRaidMods purge + normalize (seam contract).
  //   4. Lilim/expedition "next raid" perk flags reset. maxIntelBonus (L8,
  //      ticket 19 stack) and trapUpgradeCut (L3 standing stage perk — a
  //      workshop cost sink, not raid power) intentionally persist.
  const activeMole = postState.prisoners.find((p) => isActiveMole(p)) ?? null;
  const moleRaidsBefore = activeMole ? activeMole.moleRaidsLeft ?? 0 : 0;
  const tickedPrisoners = activeMole
    ? postState.prisoners.map((p) =>
        p.pid === activeMole.pid
          ? { ...p, moleRaidsLeft: Math.max(0, moleRaidsBefore - 1) }
          : p
      )
    : postState.prisoners;
  const settled = {
    ...postState,
    // Phase 5 F2: staggered converts back to plain alive at settlement with
    // cond no worse than injured (retreated staggered heroes included), and
    // both capture-meter flags reset HERE — the settlement resolution point —
    // not at hero creation (injIgnored/usedLuck are create-time resets and
    // the wrong pattern for a mid-raid meter). Corruption seam (ticket 26):
    // corrFeed is a per-raid ledger and clears the same way for ALL heroes
    // (captured, retreated, staggered-converted) after the settlement above
    // consumed it. Ticket 30: facedSlotIdx plumbing clears alongside.
    party: postState.party.map((h) => {
      if (
        !h.staggered &&
        !h.usedStagger &&
        h.corrFeed === undefined &&
        h.facedSlotIdx === undefined
      ) {
        return h;
      }
      const next = { ...h };
      if (next.staggered && next.cond === 'severe') next.cond = 'injured';
      delete next.staggered;
      delete next.usedStagger;
      delete next.corrFeed;
      delete next.facedSlotIdx;
      return next;
    }),
    expedition: tickExpeditionAftereffects(postState).expedition,
    prisoners: tickedPrisoners,
    crises: {
      ...postState.crises,
      activeRaidMods: purgeConsumedRaidMods(postState.crises.activeRaidMods),
    },
    estate: {
      ...postState.estate,
      perks: {
        ...postState.estate.perks,
        firstDcOnce: false,
        allDcNext: false,
        prepIntelOnce: false,
        aceDowngradeNext: false,
        newTrapUpNext: false,
      },
    },
  };
  postState = settled;
  if (activeMole && moleRaidsBefore <= 1) {
    items.push({
      label: `🕵️ Double Agent returned from the Guild (${activeMole.name})`,
      delta: 0,
    });
  }

  postState.lastSettlement = {
    ...postState.lastSettlement!,
    items,
    totalDelta: postState.points - beforeMp,
    pointsAfter: postState.points,
    fameAfter: postState.fame,
  };

  return postState;
}
