import { resolveSceneAsset } from '../data/assetManifest';
import {
  MONSTER_CFG,
  MONSTER_LINEAGES,
  getMonsterDisplayName,
  getMonsterLineage,
} from '../data/monsterData';
import type {
  FloorState,
  GameState,
  MonsterEgg,
  MonsterInstance,
  Prisoner,
} from '../types/game';
import { appendDayLogLine, canSpendDayAp, isDayPhase, spendDayAp } from './dayLoop';
import { heroGradeIndex } from './heroes';
import { clamp, uid } from './rng';

export interface MonsterActionResult {
  ok: boolean;
  state: GameState;
  message: string;
  title: string;
  sceneContext: string;
  imageUrl?: string;
  evolved?: boolean;
  died?: boolean;
}

export interface UpkeepBreakdown {
  active: boolean;
  total: number;
  rawTotal: number;
  trapPart: number;
  prisonerPart: number;
  hiredPart: number;
  mobPart: number;
  cap: number;
  freeReason: boolean;
  halfReason: boolean;
}

export interface UpkeepApplyResult {
  state: GameState;
  paid: number;
  shortfall: number;
  arrearsAfter: number;
  lostMonsters: MonsterInstance[];
  log: string | null;
}

export interface MonsterNightlyCycleResult {
  state: GameState;
  logs: string[];
  births: { prisonerName: string; lineage: string; count: number }[];
  hatched: MonsterInstance[];
  diedOvercrowding: MonsterInstance[];
  injuredOvercrowding: MonsterInstance[];
  upkeep: UpkeepApplyResult;
}

const TRAP_VAL_BONUS: Record<string, number> = {
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SS: 6,
  SSS: 7,
};

export function getMonsterPenCap(state: GameState): number {
  const penLv = state.estate.facilities.beastpen ?? 0;
  return MONSTER_CFG.CAP_BASE + MONSTER_CFG.CAP_PER_PEN * penLv;
}

export function isMonsterHurt(state: GameState, m: MonsterInstance): boolean {
  const w = state.wave;
  const injured = m.injuredUntilWave !== null && w < m.injuredUntilWave;
  const tired = m.tiredUntilWave !== null && w < m.tiredUntilWave;
  return injured || tired;
}

export function isMonsterDeployed(state: GameState, m: MonsterInstance): boolean {
  if (m.deployedFloor !== null) return true;
  return state.floors.some((f) =>
    (f.combatSlots ?? []).some((cs) => cs.kind === 'monster' && cs.monsterId === m.id)
  );
}

export function getBreedsUsedToday(state: GameState): number {
  return (state.apUsed.breed_use_1 ? 1 : 0) + (state.apUsed.breed_use_2 ? 1 : 0);
}

export function getBreedsRemaining(state: GameState): number {
  return Math.max(0, MONSTER_CFG.BREED.MAX_PER_WAVE - getBreedsUsedToday(state));
}

function recordBreedUse(apUsed: Record<string, boolean>): Record<string, boolean> {
  if (!apUsed.breed_use_1) return { ...apUsed, breed_use_1: true };
  return { ...apUsed, breed_use_2: true };
}

export function pickMonsterLineage(
  rare = false,
  rng: () => number = Math.random
): string {
  let total = 0;
  const weights = MONSTER_LINEAGES.map((def) => {
    const baseW = MONSTER_CFG.EGG_WEIGHTS[def.tier - 1] ?? 1;
    const mult = rare ? (MONSTER_CFG.EGG_RARE_MULT[def.tier - 1] ?? 1) : 1;
    const w = baseW * mult;
    total += w;
    return { key: def.key, w };
  });

  let roll = rng() * total;
  for (const item of weights) {
    roll -= item.w;
    if (roll <= 0) return item.key;
  }
  return 'beast';
}

export function createMonsterInstance(
  lineage: string,
  opts?: { stars?: 1 | 2 | 3; xp?: number; variantOf?: string | null }
): MonsterInstance {
  return {
    id: uid('mob'),
    lineage,
    stars: opts?.stars ?? 1,
    xp: opts?.xp ?? 0,
    kills: 0,
    fed: 0,
    deployedFloor: null,
    injuredUntilWave: null,
    tiredUntilWave: null,
    ...(opts?.variantOf ? { variantOf: opts.variantOf } : {}),
  };
}

export function createMonsterEgg(
  lineage: string,
  currentWave: number,
  opts?: { xp?: number; trait?: string; variantOf?: string | null; hatchWave?: number }
): MonsterEgg {
  return {
    id: uid('egg'),
    lineage,
    hatchWave: opts?.hatchWave ?? currentWave + MONSTER_CFG.HATCH_WAVES,
    xp: opts?.xp ?? 0,
    ...(opts?.trait ? { trait: opts.trait } : {}),
    ...(opts?.variantOf ? { variantOf: opts.variantOf } : {}),
  };
}

function stripMonsterFromFloors(floors: FloorState[], monsterId: string): FloorState[] {
  return floors.map((f) => {
    const cs = f.combatSlots ?? [];
    if (!cs.some((slot) => slot.kind === 'monster' && slot.monsterId === monsterId)) return f;
    return {
      ...f,
      combatSlots: cs.filter((slot) => !(slot.kind === 'monster' && slot.monsterId === monsterId)),
    };
  });
}

function stripPrisonerFromFloors(floors: FloorState[], pid: number): FloorState[] {
  return floors.map((f) => {
    const cs = f.combatSlots ?? [];
    if (!cs.some((slot) => slot.kind === 'prisoner' && slot.pid === pid)) return f;
    return {
      ...f,
      combatSlots: cs.filter((slot) => !(slot.kind === 'prisoner' && slot.pid === pid)),
    };
  });
}

export function killMonsterAndGrantParts(
  state: GameState,
  monsterId: string
): { state: GameState; dead: MonsterInstance | null } {
  const dead = state.monsters.find((m) => m.id === monsterId) ?? null;
  if (!dead) return { state, dead: null };

  return {
    dead,
    state: {
      ...state,
      monsters: state.monsters.filter((m) => m.id !== monsterId),
      floors: stripMonsterFromFloors(state.floors, monsterId),
      expedition: {
        ...state.expedition,
        lootParts: state.expedition.lootParts + 1,
      },
    },
  };
}

export function applyMonsterGrowth(m: MonsterInstance): {
  monster: MonsterInstance;
  evolvedFrom: 1 | 2 | null;
  logs: string[];
} {
  let next: MonsterInstance = { ...m };
  let evolvedFrom: 1 | 2 | null = null;
  const logs: string[] = [];

  while (next.stars < 3) {
    const need = MONSTER_CFG.XP_THRESHOLDS[next.stars - 1];
    if (need === undefined || next.xp < need) break;

    if (next.stars === 2) {
      const def = getMonsterLineage(next.lineage);
      if (def.evoCond === 'kills' && next.kills < 3) break;
      if (def.evoCond === 'fed' && next.fed < 2) break;
    }

    const oldName = getMonsterDisplayName(next);
    if (evolvedFrom === null) evolvedFrom = next.stars as 1 | 2;
    next = { ...next, stars: (next.stars + 1) as 1 | 2 | 3 };
    logs.push(`✨ ${oldName} evolved into ${getMonsterDisplayName(next)}!`);
  }

  return { monster: next, evolvedFrom, logs };
}

export function getEligibleFeedPrisoners(state: GameState): Prisoner[] {
  return state.prisoners.filter(
    (p) =>
      p.converted === null &&
      !(p.moleRaidsLeft && p.moleRaidsLeft > 0) &&
      p.job === null &&
      p.assignedFloor === null &&
      !p.legend
  );
}

export function getEligibleBreedPrisoners(
  state: GameState,
  monsterLineage: string
): Prisoner[] {
  const def = getMonsterLineage(monsterLineage);
  return state.prisoners.filter(
    (p) =>
      p.converted === null &&
      !(p.moleRaidsLeft && p.moleRaidsLeft > 0) &&
      !p.legend &&
      !p.dying &&
      !p.breeding &&
      p.stamina >= MONSTER_CFG.BREED.MIN_PRISONER_STAMINA &&
      (p.gender !== 'male' || def.canBreedMale)
  );
}

export function calcBreedPrisonerChance(monster: MonsterInstance, prisoner: Prisoner): number {
  const raw =
    MONSTER_CFG.BREED.P_BASE +
    MONSTER_CFG.BREED.P_PER_STAR * monster.stars -
    prisoner.resist / MONSTER_CFG.BREED.RESIST_DIV;
  return Math.max(MONSTER_CFG.BREED.P_MIN, Math.min(0.95, raw));
}

export function getMonsterSellPrice(m: MonsterInstance): number {
  const base = 30 * m.stars;
  return m.variantOf ? Math.floor(base * 1.5) : base;
}

function monsterFailResult(state: GameState, reason: string, title: string): MonsterActionResult {
  return {
    ok: false,
    state: { ...state, flash: reason },
    message: reason,
    title,
    sceneContext: '',
  };
}

/**
 * `mfeed_` (1 AP, Estate Day): Feed an unassigned non-legend prisoner to a monster.
 */
export function feedMonster(
  state: GameState,
  monsterId: string,
  prisonerPid: number
): MonsterActionResult {
  if (!isDayPhase(state)) {
    return monsterFailResult(state, 'Monster feeding requires Day (AP) phase.', 'Feed Monster');
  }
  const apCheck = canSpendDayAp(state, `mob_${monsterId}`);
  if (!apCheck.ok) {
    return monsterFailResult(state, apCheck.reason, 'Feed Monster');
  }

  const monster = state.monsters.find((m) => m.id === monsterId);
  if (!monster) {
    return monsterFailResult(state, 'Monster not found.', 'Feed Monster');
  }

  const prisoner = getEligibleFeedPrisoners(state).find((p) => p.pid === prisonerPid);
  if (!prisoner) {
    return monsterFailResult(
      state,
      'Prisoner is not eligible (must be idle, unassigned, non-legendary captive).',
      'Feed Monster'
    );
  }

  const xpGain = Math.min(
    MONSTER_CFG.XP_FEED_MAX,
    MONSTER_CFG.XP_FEED_BASE + heroGradeIndex(prisoner.grade)
  );
  const grown = applyMonsterGrowth({
    ...monster,
    xp: monster.xp + xpGain,
    fed: monster.fed + 1,
  });

  const beforeName = getMonsterDisplayName(monster);
  const afterName = getMonsterDisplayName(grown.monster);
  const evolved = grown.evolvedFrom !== null;
  const lineText = evolved
    ? `Fed ${prisoner.name} (${prisoner.grade}) to ${beforeName} (+${xpGain} XP) → Evolved into ${afterName}!`
    : `Fed ${prisoner.name} (${prisoner.grade}) to ${beforeName} (+${xpGain} XP, Fed ${grown.monster.fed}).`;

  const spent = spendDayAp(state, `mob_${monsterId}`, {
    text: lineText,
    star: evolved,
    kind: 'monster',
    art: 'dk_fl_monster',
  });
  if (!spent.ok) return monsterFailResult(state, spent.state.flash, 'Feed Monster');

  const nextState: GameState = {
    ...spent.state,
    prisoners: spent.state.prisoners.filter((p) => p.pid !== prisonerPid),
    floors: stripPrisonerFromFloors(spent.state.floors, prisonerPid),
    monsters: spent.state.monsters.map((m) => (m.id === monsterId ? grown.monster : m)),
    flash: lineText,
  };

  return {
    ok: true,
    state: nextState,
    message: lineText,
    title: `Beast Pen: Fed ${prisoner.name} to ${afterName}`,
    sceneContext: `In the dungeon's Beast Pen, captive ${prisoner.grade}-rank ${prisoner.raceLabel} ${prisoner.classLabel} ${prisoner.name} was fed to ${beforeName}. ${grown.logs.join(' ')}`,
    imageUrl: resolveSceneAsset('dk_fl_monster'),
    evolved,
  };
}

/**
 * `mabs_` (1 AP, Estate Day): Absorb an idle undeployed monster into another monster.
 */
export function absorbMonster(
  state: GameState,
  monsterId: string,
  targetMonsterId: string
): MonsterActionResult {
  if (!isDayPhase(state)) {
    return monsterFailResult(state, 'Monster absorption requires Day (AP) phase.', 'Absorb Monster');
  }
  if (monsterId === targetMonsterId) {
    return monsterFailResult(state, 'A monster cannot absorb itself.', 'Absorb Monster');
  }
  const apCheck = canSpendDayAp(state, `mob_${monsterId}`);
  if (!apCheck.ok) {
    return monsterFailResult(state, apCheck.reason, 'Absorb Monster');
  }

  const monster = state.monsters.find((m) => m.id === monsterId);
  const target = state.monsters.find((m) => m.id === targetMonsterId);
  if (!monster || !target) {
    return monsterFailResult(state, 'Monster not found.', 'Absorb Monster');
  }
  if (isMonsterDeployed(state, target)) {
    return monsterFailResult(
      state,
      'Remove the target monster from its floor before absorbing it.',
      'Absorb Monster'
    );
  }

  const xpGain = Math.floor(target.xp / 2) + 2;
  const grown = applyMonsterGrowth({
    ...monster,
    xp: monster.xp + xpGain,
    fed: monster.fed + 1,
  });

  const beforeName = getMonsterDisplayName(monster);
  const targetName = getMonsterDisplayName(target);
  const afterName = getMonsterDisplayName(grown.monster);
  const evolved = grown.evolvedFrom !== null;
  const lineText = evolved
    ? `${beforeName} absorbed ${targetName} (+${xpGain} XP) → Evolved into ${afterName}!`
    : `${beforeName} absorbed ${targetName} (+${xpGain} XP).`;

  const spent = spendDayAp(state, `mob_${monsterId}`, {
    text: lineText,
    star: evolved,
    kind: 'monster',
    art: 'dk_fl_monster',
  });
  if (!spent.ok) return monsterFailResult(state, spent.state.flash, 'Absorb Monster');

  const nextState: GameState = {
    ...spent.state,
    monsters: spent.state.monsters
      .filter((m) => m.id !== targetMonsterId)
      .map((m) => (m.id === monsterId ? grown.monster : m)),
    floors: stripMonsterFromFloors(spent.state.floors, targetMonsterId),
    flash: lineText,
  };

  return {
    ok: true,
    state: nextState,
    message: lineText,
    title: `Beast Pen: ${afterName} Absorbed ${targetName}`,
    sceneContext: `Inside the Beast Pen, ${beforeName} consumed ${targetName}, absorbing its essence for +${xpGain} XP. ${grown.logs.join(' ')}`,
    imageUrl: resolveSceneAsset('dk_fl_monster'),
    evolved,
  };
}

/**
 * `mevo_` (0 AP, Estate Day): Force Evolution when XP >= 80% threshold; costs 50 * stars MP, 15% fatal failure.
 */
export function evolveMonster(
  state: GameState,
  monsterId: string,
  rng: () => number = Math.random
): MonsterActionResult {
  if (!isDayPhase(state)) {
    return monsterFailResult(state, 'Force Evolution requires Day (AP) phase.', 'Force Evolution');
  }
  const monster = state.monsters.find((m) => m.id === monsterId);
  if (!monster) {
    return monsterFailResult(state, 'Monster not found.', 'Force Evolution');
  }
  if (monster.stars >= 3) {
    return monsterFailResult(state, 'Monster is already at max rank (★3).', 'Force Evolution');
  }

  const need = MONSTER_CFG.XP_THRESHOLDS[monster.stars - 1] ?? 999;
  const minXp = Math.ceil(need * MONSTER_CFG.FORCE_EVO.XP_PCT);
  if (monster.xp < minXp) {
    return monsterFailResult(
      state,
      `Requires at least ${minXp} XP (80% of ${need}) to Force Evolve.`,
      'Force Evolution'
    );
  }

  const cost = MONSTER_CFG.FORCE_EVO.MP_PER_STAR * monster.stars;
  if (state.points < cost) {
    return monsterFailResult(state, `Not enough MP (need ${cost} MP).`, 'Force Evolution');
  }

  const beforeName = getMonsterDisplayName(monster);
  const paidState: GameState = { ...state, points: state.points - cost };

  if (rng() < MONSTER_CFG.FORCE_EVO.DIE_CHANCE) {
    const killed = killMonsterAndGrantParts(paidState, monsterId);
    const lineText = `💀 Force Evolution failed! ${beforeName} perished (-${cost} MP, +1 Trap Parts).`;
    const nextState = appendDayLogLine(
      { ...killed.state, flash: lineText },
      { text: lineText, kind: 'monster', art: 'dk_fl_monster' }
    );
    return {
      ok: true,
      state: nextState,
      message: lineText,
      title: `Force Evolution Failed: ${beforeName}`,
      sceneContext: `An unstable Force Evolution ritual tore ${beforeName} apart in the Beast Pen (-${cost} MP, yielding +1 Trap Parts).`,
      imageUrl: resolveSceneAsset('dk_fl_monster'),
      died: true,
    };
  }

  const evolvedMon: MonsterInstance = {
    ...monster,
    stars: (monster.stars + 1) as 1 | 2 | 3,
    xp: Math.max(monster.xp, need),
  };
  const afterName = getMonsterDisplayName(evolvedMon);
  const lineText = `⚡ Force Evolution succeeded! ${beforeName} → ${afterName} (-${cost} MP).`;
  const nextState = appendDayLogLine(
    {
      ...paidState,
      monsters: paidState.monsters.map((m) => (m.id === monsterId ? evolvedMon : m)),
      flash: lineText,
    },
    { text: lineText, star: true, kind: 'monster', art: 'dk_fl_monster' }
  );

  return {
    ok: true,
    state: nextState,
    message: lineText,
    title: `Force Evolution: ${afterName}`,
    sceneContext: `Dark mana surged through the Beast Pen as ${beforeName} underwent forced metamorphosis into ${afterName}.`,
    imageUrl: resolveSceneAsset('dk_fl_monster'),
    evolved: true,
  };
}

export type BreedTarget =
  | { kind: 'prisoner'; pid: number }
  | { kind: 'monster'; partnerId: string };

/**
 * `mbrd_` (1 AP, max 2/wave, Estate Day): Breed an idle healthy monster with a prisoner or another monster.
 */
export function breedMonster(
  state: GameState,
  monsterId: string,
  target: BreedTarget,
  rng: () => number = Math.random
): MonsterActionResult {
  if (!isDayPhase(state)) {
    return monsterFailResult(state, 'Breeding requires Day (AP) phase.', 'Monster Breeding');
  }
  const apCheck = canSpendDayAp(state, `mbrd_${monsterId}`);
  if (!apCheck.ok) {
    return monsterFailResult(state, apCheck.reason, 'Monster Breeding');
  }
  if (getBreedsRemaining(state) <= 0) {
    return monsterFailResult(
      state,
      `Breeding limit reached (${MONSTER_CFG.BREED.MAX_PER_WAVE}/wave).`,
      'Monster Breeding'
    );
  }
  const penCap = getMonsterPenCap(state);
  if (state.monsters.length + state.eggs.length >= penCap + MONSTER_CFG.BREED_EGG_HEADROOM) {
    return monsterFailResult(
      state,
      `Pen & Incubator full (monsters + eggs must be < ${penCap + MONSTER_CFG.BREED_EGG_HEADROOM}).`,
      'Monster Breeding'
    );
  }

  const monster = state.monsters.find((m) => m.id === monsterId);
  if (!monster) {
    return monsterFailResult(state, 'Monster not found.', 'Monster Breeding');
  }
  if (isMonsterHurt(state, monster)) {
    return monsterFailResult(state, 'Injured or tired monsters cannot breed.', 'Monster Breeding');
  }
  if (isMonsterDeployed(state, monster)) {
    return monsterFailResult(state, 'Remove the monster from its floor before breeding.', 'Monster Breeding');
  }

  const mobName = getMonsterDisplayName(monster);

  if (target.kind === 'prisoner') {
    const prisoner = getEligibleBreedPrisoners(state, monster.lineage).find(
      (p) => p.pid === target.pid
    );
    if (!prisoner) {
      return monsterFailResult(
        state,
        'Prisoner ineligible for breeding (needs Stamina ≥ 30, not pregnant/legend/dying; male requires Female Humanoid monster).',
        'Monster Breeding'
      );
    }

    const prob = calcBreedPrisonerChance(monster, prisoner);
    const success = rng() < prob;
    const gi = heroGradeIndex(prisoner.grade);
    const inheritXp = gi >= 3 ? 5 : 0; // B+
    const inheritTrait = gi >= 5 && prisoner.traits.length > 0 ? prisoner.traits[0] : undefined; // S+

    let nextPrisoner: Prisoner;
    let nextEggs = state.eggs;
    let lineText: string;
    let sceneContext: string;

    if (success) {
      if (prisoner.gender === 'male') {
        const egg = createMonsterEgg(monster.lineage, state.wave, {
          xp: inheritXp,
          trait: inheritTrait,
        });
        nextEggs = [...nextEggs, egg];
        nextPrisoner = {
          ...prisoner,
          stamina: clamp(prisoner.stamina - 10, 0, prisoner.staminaMax),
          resist: clamp(prisoner.resist - 3, 0, 100),
        };
        lineText = `💕 ${prisoner.name} (♂) × ${mobName} bred! Egg laid (hatches W${egg.hatchWave}${inheritXp > 0 ? `, Bloodline +${inheritXp} XP` : ''}).`;
        sceneContext = `Male captive ${prisoner.name} was paired with humanoid monster ${mobName}, producing a fertilized egg due to hatch on Wave ${egg.hatchWave}.`;
      } else {
        const dueWave = state.wave + 2;
        nextPrisoner = {
          ...prisoner,
          breeding: {
            lineage: monster.lineage,
            dueWave,
            xp: inheritXp,
            ...(inheritTrait ? { trait: inheritTrait } : {}),
          },
          stamina: clamp(prisoner.stamina - 15, 0, prisoner.staminaMax),
          resist: clamp(prisoner.resist - 5, 0, 100),
          corr: clamp(prisoner.corr + 5, 0, 100),
        };
        lineText = `💕 ${prisoner.name} (♀) × ${mobName} bred! Delivery due on Wave ${dueWave}${inheritXp > 0 ? ` (Bloodline +${inheritXp} XP)` : ''}.`;
        sceneContext = `Female captive ${prisoner.name} was bred with ${mobName} in the Beast Pen; she now carries monster eggs due on Wave ${dueWave}.`;
      }
    } else {
      nextPrisoner = {
        ...prisoner,
        stamina: clamp(prisoner.stamina - 5, 0, prisoner.staminaMax),
      };
      lineText = `💔 Breeding attempt failed: ${prisoner.name} × ${mobName} (${prisoner.name} Stamina -5).`;
      sceneContext = `${prisoner.name} resisted ${mobName} in the Beast Pen and the breeding attempt failed.`;
    }

    const spent = spendDayAp(state, `mbrd_${monsterId}`, {
      text: lineText,
      star: success,
      kind: 'monster',
      art: 'dk_fl_monster',
    });
    if (!spent.ok) return monsterFailResult(state, spent.state.flash, 'Monster Breeding');

    const tiredWave = state.wave + 1;
    const nextState: GameState = {
      ...spent.state,
      apUsed: recordBreedUse(spent.state.apUsed),
      eggs: nextEggs,
      monsters: spent.state.monsters.map((m) =>
        m.id === monsterId ? { ...m, tiredUntilWave: tiredWave } : m
      ),
      prisoners: spent.state.prisoners.map((p) =>
        p.pid === prisoner.pid ? nextPrisoner : p
      ),
      flash: lineText,
    };

    return {
      ok: true,
      state: nextState,
      message: lineText,
      title: `Beast Pen Breeding: ${prisoner.name} × ${mobName}`,
      sceneContext,
      imageUrl: resolveSceneAsset('dk_fl_monster'),
    };
  }

  // Monster × Monster breeding
  const partner = state.monsters.find((o) => o.id === target.partnerId);
  if (!partner || partner.id === monster.id) {
    return monsterFailResult(state, 'Invalid partner monster.', 'Monster Breeding');
  }
  if (isMonsterHurt(state, partner) || isMonsterDeployed(state, partner)) {
    return monsterFailResult(
      state,
      'Partner monster must be idle and healthy.',
      'Monster Breeding'
    );
  }

  let eggXp = Math.floor((monster.xp + partner.xp) / 4);
  let eggLineage = monster.lineage;
  let variantOf: string | null = null;
  if (partner.lineage !== monster.lineage) {
    const isVariant = rng() < MONSTER_CFG.BREED.VARIANT_CHANCE;
    if (rng() < 0.5) {
      eggLineage = partner.lineage;
    }
    if (isVariant) {
      eggXp += 5;
      variantOf = eggLineage === partner.lineage ? monster.lineage : partner.lineage;
    }
  }

  const egg = createMonsterEgg(eggLineage, state.wave, { xp: eggXp, variantOf });
  const partnerName = getMonsterDisplayName(partner);
  const variantLabel = variantOf
    ? ` · ✨ Variant (${getMonsterLineage(variantOf).names[0]} Blood, +5 XP, 1.5× Value)`
    : '';
  const lineText = `💕 ${mobName} × ${partnerName} → ${getMonsterLineage(eggLineage).icon} Egg (hatches W${egg.hatchWave}, +${eggXp} XP)${variantLabel}.`;

  const spent = spendDayAp(state, `mbrd_${monsterId}`, {
    text: lineText,
    star: Boolean(variantOf),
    kind: 'monster',
    art: 'dk_fl_monster',
  });
  if (!spent.ok) return monsterFailResult(state, spent.state.flash, 'Monster Breeding');

  const tiredWave = state.wave + 1;
  const nextState: GameState = {
    ...spent.state,
    apUsed: recordBreedUse(spent.state.apUsed),
    eggs: [...spent.state.eggs, egg],
    monsters: spent.state.monsters.map((m) =>
      m.id === monsterId || m.id === partner.id ? { ...m, tiredUntilWave: tiredWave } : m
    ),
    flash: lineText,
  };

  return {
    ok: true,
    state: nextState,
    message: lineText,
    title: `Monster Cross-Breeding: ${mobName} × ${partnerName}`,
    sceneContext: `${mobName} and ${partnerName} mated in the Beast Pen, producing a ${getMonsterLineage(eggLineage).names[0]} egg (+${eggXp} XP${variantOf ? ` with ${getMonsterLineage(variantOf).names[0]} variant bloodline` : ''}).`,
    imageUrl: resolveSceneAsset('dk_fl_monster'),
  };
}

/**
 * `mdisp_` (0 AP, available in both `estate` and `build`): Sell or Butcher a monster.
 */
export function disposeMonster(
  state: GameState,
  monsterId: string,
  method: 'sell' | 'butcher'
): MonsterActionResult {
  if (state.mode !== 'estate' && state.mode !== 'build') {
    return monsterFailResult(
      state,
      'Monsters can only be disposed in Estate or Build mode.',
      'Dispose Monster'
    );
  }
  const monster = state.monsters.find((m) => m.id === monsterId);
  if (!monster) {
    return monsterFailResult(state, 'Monster not found.', 'Dispose Monster');
  }

  const mobName = getMonsterDisplayName(monster);
  const remainingMonsters = state.monsters.filter((m) => m.id !== monsterId);
  const cleanedFloors = stripMonsterFromFloors(state.floors, monsterId);

  if (method === 'sell') {
    const price = getMonsterSellPrice(monster);
    const lineText = `💰 Sold ${mobName} for +${price} MP.`;
    let nextState: GameState = {
      ...state,
      points: state.points + price,
      monsters: remainingMonsters,
      floors: cleanedFloors,
      flash: lineText,
    };
    if (state.mode === 'estate') {
      nextState = appendDayLogLine(nextState, {
        text: lineText,
        kind: 'monster',
        art: 'dk_fl_monster',
      });
    }
    return {
      ok: true,
      state: nextState,
      message: lineText,
      title: `Sold ${mobName}`,
      sceneContext: `Sold ${mobName} from the Beast Pen to slave/beast brokers for +${price} MP.`,
      imageUrl: resolveSceneAsset('dk_fl_monster'),
    };
  }

  // Butcher
  const lineText = `🔪 Butchered ${mobName} (+1 Trap Parts, +10 Town Food).`;
  let nextState: GameState = {
    ...state,
    monsters: remainingMonsters,
    floors: cleanedFloors,
    expedition: {
      ...state.expedition,
      lootParts: state.expedition.lootParts + 1,
    },
    town: {
      ...state.town,
      food: clamp(state.town.food + 10, 0, 100),
    },
    flash: lineText,
  };
  if (state.mode === 'estate') {
    nextState = appendDayLogLine(nextState, {
      text: lineText,
      kind: 'monster',
      art: 'dk_fl_monster',
    });
  }
  return {
    ok: true,
    state: nextState,
    message: lineText,
    title: `Butchered ${mobName}`,
    sceneContext: `Slaughtered ${mobName} in the Beast Pen, harvesting +1 Trap Parts and +10 Town Food.`,
    imageUrl: resolveSceneAsset('dk_fl_monster'),
  };
}

/**
 * Checks pregnant prisoners (`p.breeding`) whose `dueWave <= state.wave` and spawns 1–2 eggs each.
 */
export function processPrisonerBreedingBirths(
  state: GameState,
  rng: () => number = Math.random
): {
  state: GameState;
  births: { prisonerName: string; lineage: string; count: number }[];
  logs: string[];
} {
  const newEggs: MonsterEgg[] = [];
  const births: { prisonerName: string; lineage: string; count: number }[] = [];
  const logs: string[] = [];
  let changed = false;

  const nextPrisoners = state.prisoners.map((p) => {
    if (!p.breeding || state.wave < p.breeding.dueWave) return p;
    changed = true;
    const count = rng() < 0.5 ? 1 : 2;
    const def = getMonsterLineage(p.breeding.lineage);
    for (let i = 0; i < count; i++) {
      newEggs.push(
        createMonsterEgg(p.breeding.lineage, state.wave, {
          xp: p.breeding.xp,
          trait: p.breeding.trait,
        })
      );
    }
    births.push({ prisonerName: p.name, lineage: p.breeding.lineage, count });
    logs.push(
      `🥚 ${p.name} gave birth to ${count} ${def.icon} ${def.names[0]} egg(s)${p.breeding.xp > 0 ? ' (Bloodline)' : ''}!`
    );
    return { ...p, breeding: null };
  });

  if (!changed) return { state, births: [], logs: [] };
  return {
    state: {
      ...state,
      prisoners: nextPrisoners,
      eggs: [...state.eggs, ...newEggs],
    },
    births,
    logs,
  };
}

/**
 * Hatches ready eggs (`state.wave >= egg.hatchWave`) as long as `monsters.length < cap`.
 */
export function hatchMonsterEggs(state: GameState): {
  state: GameState;
  hatched: MonsterInstance[];
  queuedCount: number;
  logs: string[];
} {
  if (state.eggs.length === 0) {
    return { state, hatched: [], queuedCount: 0, logs: [] };
  }

  const cap = getMonsterPenCap(state);
  const nextMonsters = [...state.monsters];
  const keepEggs: MonsterEgg[] = [];
  const hatched: MonsterInstance[] = [];
  const logs: string[] = [];

  for (const egg of state.eggs) {
    if (state.wave >= egg.hatchWave && nextMonsters.length < cap) {
      const mob = createMonsterInstance(egg.lineage, {
        stars: 1,
        xp: egg.xp,
        variantOf: egg.variantOf ?? null,
      });
      nextMonsters.push(mob);
      hatched.push(mob);
      logs.push(
        `🐣 Hatched ${getMonsterDisplayName(mob)}${egg.xp > 0 ? ` (+${egg.xp} Bloodline XP)` : ''}!`
      );
    } else {
      keepEggs.push(egg);
    }
  }

  if (hatched.length === 0) {
    return { state, hatched: [], queuedCount: keepEggs.length, logs: [] };
  }

  return {
    state: {
      ...state,
      monsters: nextMonsters,
      eggs: keepEggs,
    },
    hatched,
    queuedCount: keepEggs.length,
    logs,
  };
}

/**
 * Estate Overcrowding (`X.mobCrowd`): for each monster over Pen cap, 20% dies (+1 parts) / 80% injured.
 */
export function resolveMonsterOvercrowding(
  state: GameState,
  rng: () => number = Math.random
): {
  state: GameState;
  died: MonsterInstance[];
  injured: MonsterInstance[];
  partsGained: number;
  logs: string[];
} {
  const cap = getMonsterPenCap(state);
  const over = state.monsters.length - cap;
  if (over <= 0) {
    return { state, died: [], injured: [], partsGained: 0, logs: [] };
  }

  let working = state;
  const died: MonsterInstance[] = [];
  const injured: MonsterInstance[] = [];
  const logs: string[] = [];
  let partsGained = 0;

  for (let i = 0; i < over; i++) {
    if (working.monsters.length === 0) break;
    const idx = Math.min(
      working.monsters.length - 1,
      Math.floor(rng() * working.monsters.length)
    );
    const picked = working.monsters[idx];
    const name = getMonsterDisplayName(picked);
    if (rng() < MONSTER_CFG.OVERCROWD.DIE_CHANCE) {
      const killed = killMonsterAndGrantParts(working, picked.id);
      working = killed.state;
      died.push(picked);
      partsGained += 1;
      logs.push(`🪦 Overcrowding brawl killed ${name} (+1 Trap Parts).`);
    } else {
      const hurtMob: MonsterInstance = { ...picked, injuredUntilWave: state.wave + 1 };
      working = {
        ...working,
        monsters: working.monsters.map((m) => (m.id === picked.id ? hurtMob : m)),
      };
      injured.push(hurtMob);
      logs.push(`🩹 Overcrowding brawl injured ${name} (resting until W${state.wave + 1}).`);
    }
  }

  return { state: working, died, injured, partsGained, logs };
}

/**
 * CFG.UPKEEP status check: driven by explicit `settings.upkeepEnabled` (which defaults ON in Hard, OFF in Normal/Casual).
 */
export function isUpkeepActive(state: GameState): boolean {
  return Boolean(state.settings.upkeepEnabled);
}

/**
 * Exact Lua `X.upCalc` formula for Dungeon/Estate/Monster upkeep.
 */
export function calcMonsterUpkeep(state: GameState): UpkeepBreakdown {
  const C = MONSTER_CFG.UPKEEP;
  const active = isUpkeepActive(state);

  let trapVal = 0;
  let activeFloorCount = 0;
  for (const f of state.floors) {
    if (f.slots.length > 0) activeFloorCount += 1;
    for (const s of f.slots) {
      trapVal += (TRAP_VAL_BONUS[s.grade] ?? 1) * C.TRAP;
    }
  }

  let facLevels = 0;
  for (const lv of Object.values(state.estate.facilities)) {
    facLevels += Math.max(0, lv);
  }
  const V = trapVal + facLevels * C.FAC + activeFloorCount * C.FLOOR;
  const trapPart = Math.floor(V * C.V + 0.5);

  let priRaw = 0;
  let hiredCount = 0;
  for (const p of state.prisoners) {
    priRaw += p.job ? C.PRI / 2 : C.PRI;
    if (p.converted === 'hired') hiredCount += 1;
  }
  const prisonerPart = Math.floor(priRaw + 0.5);
  const hiredPart = hiredCount * C.HIRE;

  let mobRaw = 0;
  for (const m of state.monsters) {
    mobRaw += m.stars * C.MOB;
  }
  const hasFoodFac =
    (state.estate.facilities.farmland ?? 0) > 0 ||
    (state.estate.facilities.granary ?? 0) > 0;
  const mobPart = Math.floor((hasFoodFac ? mobRaw * 0.75 : mobRaw) + 0.5);

  const rawTotal = trapPart + prisonerPart + hiredPart + mobPart;
  const freeReason = state.wave <= C.FREE_TO;
  const halfReason = !freeReason && state.wave <= C.HALF_TO;

  let scaled = rawTotal;
  if (freeReason) scaled = 0;
  else if (halfReason) scaled = Math.floor(scaled / 2);

  const hasTaxCard = state.realm.active.some((r) => r.key === 'tax' && !r.countered);
  if (hasTaxCard) {
    scaled = Math.floor(scaled * 1.5);
  }

  const inc = state.estate.trailingIncome;
  const avgIncome =
    inc.length > 0
      ? inc.reduce((sum, x) => sum + Math.max(0, x), 0) / inc.length
      : C.DEFAULT_AVG_INCOME;
  const cap = Math.max(C.MIN_CAP, Math.floor(avgIncome * C.CAP_RATIO));
  const total = Math.min(scaled, cap);

  return {
    active,
    total,
    rawTotal,
    trapPart,
    prisonerPart,
    hiredPart,
    mobPart,
    cap,
    freeReason,
    halfReason,
  };
}

/**
 * Applies `CFG.UPKEEP` payment and arrears escape/starve penalties.
 */
export function applyUpkeepCycle(
  state: GameState,
  rng: () => number = Math.random
): UpkeepApplyResult {
  if (!isUpkeepActive(state)) {
    return {
      state,
      paid: 0,
      shortfall: 0,
      arrearsAfter: state.estate.upkeepArrears,
      lostMonsters: [],
      log: null,
    };
  }

  const calc = calcMonsterUpkeep(state);
  if (calc.total <= 0) {
    return {
      state,
      paid: 0,
      shortfall: 0,
      arrearsAfter: state.estate.upkeepArrears,
      lostMonsters: [],
      log: calc.freeReason ? `🏦 Upkeep waived (Wave ≤ ${MONSTER_CFG.UPKEEP.FREE_TO}).` : null,
    };
  }

  const paid = Math.min(state.points, calc.total);
  const shortfall = calc.total - paid;
  let working: GameState = {
    ...state,
    points: state.points - paid,
  };

  let arrearsAfter = working.estate.upkeepArrears;
  const lostMonsters: MonsterInstance[] = [];
  let log = `🏦 Upkeep -${paid} MP (Traps/Fac ${calc.trapPart} · Prisoners ${calc.prisonerPart} · Hired ${calc.hiredPart} · Monsters ${calc.mobPart} · Cap ${calc.cap})`;

  if (shortfall > 0) {
    arrearsAfter = Math.min(MONSTER_CFG.UPKEEP.ARREAR_MAX, arrearsAfter + 1);
    log += ` · ⚠ Shortfall ${shortfall} MP → Arrears Lv.${arrearsAfter} (Prisoners +3 Resist)`;
    working = {
      ...working,
      prisoners: working.prisoners.map((p) => ({
        ...p,
        resist: clamp(p.resist + 3, 0, 100),
      })),
    };

    if (arrearsAfter >= 2) {
      const currentMonsters = [...working.monsters];
      for (const m of currentMonsters) {
        if (lostMonsters.length >= 2) break;
        const starveDie = arrearsAfter >= 3 && rng() < 0.1;
        const escapeRun = m.stars <= 1 && !isMonsterDeployed(working, m) && rng() < 0.2;
        if (starveDie || escapeRun) {
          const killed = killMonsterAndGrantParts(working, m.id);
          // Escaped/starved monsters from arrears do not grant trap parts
          working = {
            ...killed.state,
            expedition: {
              ...killed.state.expedition,
              lootParts: working.expedition.lootParts,
            },
          };
          lostMonsters.push(m);
        }
      }
      if (lostMonsters.length > 0) {
        log += ` · ${lostMonsters.length} monster(s) starved or escaped due to unpaid upkeep!`;
      }
    }
  } else if (arrearsAfter > 0) {
    arrearsAfter = 0;
    log += ' · Arrears cleared!';
  }

  working = {
    ...working,
    estate: {
      ...working.estate,
      upkeepArrears: arrearsAfter,
    },
  };

  return {
    state: working,
    paid,
    shortfall,
    arrearsAfter,
    lostMonsters,
    log,
  };
}

/**
 * Clean nightly orchestrator exported for M.Settle integration (`engine/estate.ts`):
 * 1. Prisoner breeding egg deliveries
 * 2. Hatch ready eggs up to Pen capacity
 * 3. Resolve Pen overcrowding (20% death / 80% injury)
 * 4. Regen Spa Lv.3 heals all injured monsters
 * 5. Apply CFG.UPKEEP cycle (when `settings.upkeepEnabled` is true)
 */
export function processMonsterNightlyCycle(
  state: GameState,
  rng: () => number = Math.random
): MonsterNightlyCycleResult {
  const logs: string[] = [];

  const birthRes = processPrisonerBreedingBirths(state, rng);
  let working = birthRes.state;
  logs.push(...birthRes.logs);

  const hatchRes = hatchMonsterEggs(working);
  working = hatchRes.state;
  logs.push(...hatchRes.logs);

  const crowdRes = resolveMonsterOvercrowding(working, rng);
  working = crowdRes.state;
  logs.push(...crowdRes.logs);

  if ((working.estate.facilities.spa ?? 0) >= 3) {
    const hadInjured = working.monsters.some((m) => m.injuredUntilWave !== null);
    if (hadInjured) {
      working = {
        ...working,
        monsters: working.monsters.map((m) => ({ ...m, injuredUntilWave: null })),
      };
      logs.push('♨ Regen Spa Lv.3 healed all injured monsters in the Beast Pen.');
    }
  }

  const upkeep = applyUpkeepCycle(working, rng);
  working = upkeep.state;
  if (upkeep.log) logs.push(upkeep.log);

  return {
    state: working,
    logs,
    births: birthRes.births,
    hatched: hatchRes.hatched,
    diedOvercrowding: crowdRes.died,
    injuredOvercrowding: crowdRes.injured,
    upkeep,
  };
}
