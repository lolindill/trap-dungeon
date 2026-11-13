import { CFG } from '../data/constants';
import { CRISIS_CFG } from '../data/realmData';
import {
  APTITUDE_MULT,
  BUYERS,
  EXEC_CFG,
  HARSH_CFG,
  MARK_LABELS,
  MARK_THRESHOLDS,
  MOLE_CFG,
  PRISON_CONVERSIONS,
  PRISON_JOB_MAP,
  PRISON_JOBS,
  PRISON_PACT_MAP,
  resolveJobAsset,
  resolveMarkAsset,
  resolvePactAsset,
  resolvePrisonAsset,
  SERVANT_MP_BY_GRADE,
  type BuyerKey,
  type PactStatKey,
} from '../data/prisonData';
import type {
  DayLogLine,
  GameState,
  HeroGrade,
  OfficerKey,
  Prisoner,
  PrisonerConversion,
  PrisonerMarks,
} from '../types/game';
import { appendDayLogLine, getOfficerStageForAff, isDayPhase, spendDayAp } from './dayLoop';
import { clamp, randInt } from './rng';

export interface Pronouns {
  subject: 'he' | 'she';
  object: 'him' | 'her';
  possessive: 'his' | 'her';
  reflexive: 'himself' | 'herself';
  Subject: 'He' | 'She';
  Possessive: 'His' | 'Her';
}

export interface PrisonActionResult {
  ok: boolean;
  state: GameState;
  title: string;
  summary: string;
  sceneContext: string;
  imageUrl?: string;
  isKeyMoment: boolean;
  died?: boolean;
  upgradedMarks?: string[];
}

const FEAR_VERBS = new Set(['ptort', 'pwhip', 'pthreat', 'pint', 'pconfess', 'pxfear']);

const GRADE_INDEX: Record<HeroGrade, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SS: 6,
  SSS: 7,
  EPIC: 8,
};

const FACILITY_LABELS: Record<string, string> = {
  inn: 'Tavern & Inn',
  market: 'Slave Market',
  brothel: 'Pleasure Quarter',
  smithy: 'Smithy',
  spy: 'Spy Guild',
  shrine: 'Dark Shrine',
  manor: "Lord's Manor",
  annex: 'Prison Annex',
  housing: 'Housing',
  farmland: 'Farmland',
  bath: 'Public Bath',
  watch: 'Watchtower',
  trade: 'Trading Post',
  workshop: 'Arcane Workshop',
  trainhall: 'Training Hall',
  dairy: 'Dairy',
  arena: 'Arena',
  beastpen: 'Beast Pen',
  torture: 'Torture Chamber',
  gibbet: 'Gibbet',
  pens: 'Slave Pens',
  grail: 'Blood Grail',
  lewdmart: 'Lewd Market',
  reform: 'Reformatory',
  spa: 'Regen Spa',
};

function facLv(state: GameState, key: string): number {
  return state.estate.facilities[key] ?? 0;
}

function facName(key: string): string {
  return FACILITY_LABELS[key] ?? key;
}

function officerKeyFromCode(code: 'V' | 'L'): OfficerKey {
  return code === 'V' ? 'vesper' : 'lilim';
}

function officerNameFromCode(code: 'V' | 'L'): string {
  return code === 'V' ? 'Vesper' : 'Lilim';
}

export function isActiveCaptive(p: Prisoner): boolean {
  return p.converted === null && !(p.moleRaidsLeft && p.moleRaidsLeft > 0);
}

export function isConvertedMinion(p: Prisoner): boolean {
  return p.converted !== null;
}

export function isActiveMole(p: Prisoner): boolean {
  return (p.moleRaidsLeft ?? 0) > 0;
}

export function getPrisonerPronouns(gender: 'female' | 'male'): Pronouns {
  if (gender === 'male') {
    return {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      reflexive: 'himself',
      Subject: 'He',
      Possessive: 'His',
    };
  }
  return {
    subject: 'she',
    object: 'her',
    possessive: 'her',
    reflexive: 'herself',
    Subject: 'She',
    Possessive: 'Her',
  };
}

export function getPrisonerTitle(p: Prisoner): string {
  const cls = p.classLabel || 'captive';
  if (p.shame >= 90 || p.terror >= 90) return `broken ${cls}`;
  if (p.resist >= 80) return `defiant ${cls}`;
  if (p.pleasure >= 80 || p.corr >= 80) return `pleasure-trained ${cls}`;
  if ((p.marks.obey ?? 0) >= 3) return `tamed ${cls}`;
  if (p.terror >= 70) return `terrified ${cls}`;
  if (p.shame >= 70) return `humiliated ${cls}`;
  if (p.resist >= 40) return `unbroken ${cls}`;
  return `submissive ${cls}`;
}

export function getPrisonerTalents(
  p: Prisoner
): { key: string; label: string; effect: string }[] {
  const out: { key: string; label: string; effect: string }[] = [];
  if (p.marks.obey >= 2) {
    out.push({ key: 'loyal', label: 'Loyal', effect: 'Job yield +20%' });
  }
  if (p.marks.pleasure >= 3) {
    out.push({
      key: 'lewd',
      label: 'Lewd',
      effect: 'Brothel/Tavern/Tasting/Lure +50%',
    });
  }
  if (p.marks.terror >= 2) {
    out.push({ key: 'coward', label: 'Coward', effect: 'Bait -1 extra / Arena -50%' });
  }
  if (p.marks.shame >= 3) {
    out.push({ key: 'exhib', label: 'Exhibitionist', effect: 'Square/Bath +30%' });
  }
  return out;
}

export function getMarkCut(state: GameState): number {
  return 5 * facLv(state, 'trainhall');
}

export function checkPrisonerMarks(
  state: GameState,
  p: Prisoner
): {
  prisoner: Prisoner;
  upgraded: { key: keyof PrisonerMarks; level: number; label: string }[];
} {
  const cut = getMarkCut(state);
  const nextMarks: PrisonerMarks = { ...p.marks };
  const upgraded: { key: keyof PrisonerMarks; level: number; label: string }[] = [];

  const keys: (keyof PrisonerMarks)[] = ['obey', 'pleasure', 'terror', 'shame'];
  for (const key of keys) {
    const thresholds = MARK_THRESHOLDS[key];
    let targetLv = 0;
    for (let i = 0; i < thresholds.length; i++) {
      const th = thresholds[i];
      if (key === 'obey') {
        const limit = th + cut + (p.traits.includes('submissive') ? 10 : 0);
        if (p.resist <= limit) targetLv = i + 1;
      } else {
        if (p[key] >= th - cut) targetLv = i + 1;
      }
    }
    if (targetLv > (nextMarks[key] ?? 0)) {
      nextMarks[key] = targetLv;
      upgraded.push({
        key,
        level: targetLv,
        label: `${MARK_LABELS[key]} Lv.${targetLv}`,
      });
    }
  }

  return {
    prisoner: upgraded.length > 0 ? { ...p, marks: nextMarks } : p,
    upgraded,
  };
}

export function getInterrogateChance(state: GameState, p: Prisoner): number {
  const perkBonus =
    (state.estate.perks.prisonDay ? 0.1 : 0) + (state.estate.perks.interroDay ? 0.1 : 0);
  const raw =
    0.35 +
    (100 - p.resist) * 0.005 +
    (state.officers.vesper.stage >= 1 ? 0.15 : 0) +
    0.15 * facLv(state, 'spy') +
    0.1 * facLv(state, 'torture') +
    perkBonus;
  return clamp(raw, 0.1, 0.95);
}

export function getTrainMultiplier(state: GameState): number {
  return 1 + 0.2 * facLv(state, 'trainhall');
}

export function getResistMultiplier(state: GameState, pactId: string): number {
  return (
    getTrainMultiplier(state) +
    (FEAR_VERBS.has(pactId) ? 0.25 * facLv(state, 'torture') : 0)
  );
}

export function getHarshDeathChance(
  _state: GameState,
  p: Prisoner,
  pactId: string
): number {
  const pact = PRISON_PACT_MAP[pactId];
  if (!pact?.harsh || p.legend) return 0;
  let die = pact.harsh.baseDie * (p.cond === 'severe' ? HARSH_CFG.SEVERE_MULT : 1);
  const postStamina = p.stamina - pact.staminaCost;
  if (postStamina < HARSH_CFG.LOW2_THRESHOLD) {
    die += HARSH_CFG.LOW2_BONUS;
  } else if (postStamina < HARSH_CFG.LOW1_THRESHOLD) {
    die += HARSH_CFG.LOW1_BONUS;
  }
  if (pactId === 'pxfear' && p.afflictions.includes('hydro')) {
    die += 0.02;
  }
  return Math.min(0.95, die);
}

export function getAvailableOfficersForPrison(
  state: GameState,
  mode: 'duo' | 'gift'
): ('V' | 'L')[] {
  const out: ('V' | 'L')[] = [];
  for (const code of ['V', 'L'] as const) {
    const oKey = officerKeyFromCode(code);
    if (mode === 'duo' && state.officers[oKey].stage < 2) continue;
    if (state.apUsed[`officer_${oKey}`] || state.apUsed[`who_${code}`]) continue;
    out.push(code);
  }
  return out;
}

export function getAvailablePairPartners(state: GameState, pid: number): Prisoner[] {
  return state.prisoners.filter(
    (q) =>
      q.pid !== pid &&
      isActiveCaptive(q) &&
      !q.dying &&
      !state.apUsed[`prison_${q.pid}`]
  );
}

export function canExecutePact(
  state: GameState,
  p: Prisoner,
  pactId: string
): { ok: true } | { ok: false; reason: string } {
  const pact = PRISON_PACT_MAP[pactId];
  if (!pact) return { ok: false, reason: 'Unknown action.' };
  if (!isActiveCaptive(p)) {
    return { ok: false, reason: 'Only cell captives can undergo conditioning.' };
  }
  if (!isDayPhase(state)) {
    return { ok: false, reason: 'Locked: Available during Day (AP) phase.' };
  }
  if (state.estate.activeCrisis) {
    return { ok: false, reason: 'Resolve active crisis before acting.' };
  }
  if (p.dying && pactId !== 'prest') {
    return { ok: false, reason: 'Dying captive — Rest (0 AP) to >= 20 Stamina first.' };
  }

  const req = pact.req;
  if (req?.facility) {
    const needLv = req.facilityLv ?? 1;
    if (facLv(state, req.facility) < needLv) {
      return {
        ok: false,
        reason: `Requires ${facName(req.facility)}${needLv > 1 ? ` Lv.${needLv}` : ''}.`,
      };
    }
  }
  if (req?.mark) {
    const [mk, lv] = req.mark;
    if ((p.marks[mk] ?? 0) < lv) {
      return { ok: false, reason: `Requires ${MARK_LABELS[mk]} Mark Lv.${lv}.` };
    }
  }
  if (req?.notFlag && p[req.notFlag]) {
    return { ok: false, reason: `Already applied (${req.notFlag}).` };
  }
  if (req?.needsCureTarget) {
    const hasParasite = p.afflictions.includes('parasite');
    const hasCurableCurse =
      p.afflictions.includes('curse') && facLv(state, 'shrine') >= 2;
    if (!hasParasite && !hasCurableCurse) {
      return {
        ok: false,
        reason: p.afflictions.includes('curse')
          ? 'Curse purification requires Dark Shrine Lv.2.'
          : 'No parasite or curse to purify.',
      };
    }
  }
  if (req?.minPrisoners) {
    const activeCount = state.prisoners.filter(isActiveCaptive).length;
    if (activeCount < req.minPrisoners) {
      return { ok: false, reason: `Requires ${req.minPrisoners}+ active captives.` };
    }
  }
  if (req?.needsPair && getAvailablePairPartners(state, p.pid).length === 0) {
    return { ok: false, reason: 'No second idle captive available today.' };
  }
  if (req?.oncePerDay && state.apUsed.pdisplay_day) {
    return { ok: false, reason: 'Town Square Display already used today.' };
  }
  if (req?.needsOfficerDuo) {
    if (state.officers.vesper.stage < 2 && state.officers.lilim.stage < 2) {
      return { ok: false, reason: 'Requires Vesper or Lilim Stage 2+.' };
    }
    if (getAvailableOfficersForPrison(state, 'duo').length === 0) {
      return { ok: false, reason: 'No Stage 2+ officer free today.' };
    }
  }
  if (req?.needsOfficerGift && getAvailableOfficersForPrison(state, 'gift').length === 0) {
    return { ok: false, reason: 'Both Vesper & Lilim already interacted today.' };
  }
  if (pact.staminaCost > 0 && p.stamina <= 0) {
    return { ok: false, reason: 'Stamina 0 — Feed or Rest first.' };
  }
  if (state.points < pact.mpCost) {
    return { ok: false, reason: `Need ${pact.mpCost} MP.` };
  }

  if (!pact.noAp) {
    if (state.ap <= 0) {
      return { ok: false, reason: '0 AP left today.' };
    }
    if (state.apUsed[`prison_${p.pid}`]) {
      return { ok: false, reason: `${p.name} already acted today.` };
    }
  }

  return { ok: true };
}

function applyPactStatsToPrisoner(
  state: GameState,
  target: Prisoner,
  pactId: string,
  effOverride?: Partial<Record<PactStatKey, [number, number]>>
): { updated: Prisoner; deltas: string[] } {
  const pact = PRISON_PACT_MAP[pactId];
  const effects = effOverride ?? pact.effects;
  const multBase =
    getTrainMultiplier(state) *
    (pact.luaGroup === 'train' && state.estate.perks.prisonDay ? 1.1 : 1);
  const resMult = getResistMultiplier(state, pactId);

  const next: Prisoner = { ...target, marks: { ...target.marks } };
  const deltas: string[] = [];

  for (const [statKey, range] of Object.entries(effects) as [
    PactStatKey,
    [number, number],
  ][]) {
    const [minV, maxV] = range;
    let val = maxV > minV ? randInt(minV, maxV) : minV;
    let m2 = multBase;

    if (statKey === 'pleasure' || statKey === 'shame') {
      if (next.traits.includes('pure')) m2 *= 0.5;
      if (next.traits.includes('lewd') || next.traits.includes('masochist')) m2 *= 1.5;
    }
    if (statKey === 'shame' && next.traits.includes('exhibitionist')) {
      m2 *= 1.5;
    }
    if (statKey === 'pleasure' && pactId === 'pdrug' && next.traits.includes('antidote')) {
      m2 *= 0.5;
    }
    if (statKey === 'pleasure' && next.traits.includes('cursed')) {
      m2 *= 1.3;
    }
    if (statKey === 'terror' && next.traits.includes('berserker')) {
      m2 *= 0.5;
    }

    if (val > 0) {
      val = Math.round(val * m2);
    } else if (statKey === 'resist' && val < 0) {
      val = -Math.round(-val * resMult);
      if (pactId === 'pwhip' && next.traits.includes('sadist')) {
        val = Math.trunc(val / 1.5);
      }
    }

    next[statKey] = clamp((next[statKey] ?? 0) + val, 0, 100);
    const label =
      statKey === 'corr'
        ? 'Corr'
        : statKey.charAt(0).toUpperCase() + statKey.slice(1);
    deltas.push(`${label} ${val >= 0 ? `+${val}` : val}`);
  }

  // Tough reduces positive stamina cost by 20%
  const rawStaminaCost = pact.staminaCost;
  const effStaminaCost =
    rawStaminaCost > 0 && next.traits.includes('tough')
      ? Math.floor(rawStaminaCost * 0.8)
      : rawStaminaCost;

  next.stamina = clamp(next.stamina - effStaminaCost, 0, next.staminaMax);
  if (next.dying && next.stamina >= 20) {
    next.dying = false;
  }

  return { updated: next, deltas };
}

export function executePrisonPact(
  state: GameState,
  pid: number,
  pactId: string,
  opts?: { partnerPid?: number; officer?: 'V' | 'L' }
): PrisonActionResult {
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Action Unavailable',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const pact = PRISON_PACT_MAP[pactId];
  const guard = canExecutePact(state, prisoner, pactId);
  if (!pact || !guard.ok) {
    const reason = guard.ok ? 'Unknown action.' : guard.reason;
    return {
      ok: false,
      state: { ...state, flash: `${prisoner.name} · ${pact?.label ?? pactId} — ${reason}` },
      title: pact?.label ?? pactId,
      summary: reason,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  // Rest (0 AP)
  if (pact.noAp && pactId === 'prest') {
    const nextPrisoners = [...state.prisoners];
    nextPrisoners[idx] = {
      ...prisoner,
      stamina: prisoner.staminaMax,
      dying: false,
    };
    const pronouns = getPrisonerPronouns(prisoner.gender);
    const line: DayLogLine = {
      text: `${prisoner.name}: Rest & recovery (0 AP, Stamina ${prisoner.staminaMax}/${prisoner.staminaMax}).`,
      kind: 'prison',
      art: resolvePactAsset('prest', prisoner.gender),
    };
    const nextState = appendDayLogLine(
      {
        ...state,
        prisoners: nextPrisoners,
        flash: `${prisoner.name} rested cleanly (0 AP · Stamina ${prisoner.staminaMax}/${prisoner.staminaMax}).`,
      },
      line
    );
    const imageUrl = resolvePactAsset('prest', prisoner.gender);
    return {
      ok: true,
      state: nextState,
      title: `${prisoner.name} — Rest & Recover`,
      summary: `Stamina restored to ${prisoner.staminaMax}/${prisoner.staminaMax} (0 AP).`,
      sceneContext: `${prisoner.name} (${prisoner.gender}, ${pronouns.subject}/${pronouns.object}, ${prisoner.raceLabel} ${prisoner.classLabel}) is ${pact.resultProse}.`,
      imageUrl,
      isKeyMoment: false,
    };
  }

  // Resolve optional pair partner or officer
  let partner: Prisoner | null = null;
  if (pact.req?.needsPair) {
    const cands = getAvailablePairPartners(state, pid);
    partner =
      (opts?.partnerPid ? cands.find((c) => c.pid === opts.partnerPid) : cands[0]) ??
      null;
    if (!partner) {
      return {
        ok: false,
        state: { ...state, flash: 'No second idle captive available.' },
        title: pact.label,
        summary: 'No second idle captive available.',
        sceneContext: '',
        isKeyMoment: false,
      };
    }
  }

  let officerCode: 'V' | 'L' | undefined;
  if (pact.req?.needsOfficerDuo || pact.req?.needsOfficerGift) {
    const avail = getAvailableOfficersForPrison(
      state,
      pact.req.needsOfficerDuo ? 'duo' : 'gift'
    );
    officerCode =
      opts?.officer && avail.includes(opts.officer) ? opts.officer : avail[0];
    if (!officerCode) {
      return {
        ok: false,
        state: { ...state, flash: 'No officer available today.' },
        title: pact.label,
        summary: 'No officer available today.',
        sceneContext: '',
        isKeyMoment: false,
      };
    }
  }

  // Spend 1 AP via dayLoop helper
  const preLineText = `${prisoner.name}: ${pact.label}${partner ? ` + ${partner.name}` : ''}`;
  const spent = spendDayAp(state, `prison_${pid}`, {
    text: preLineText,
    kind: 'prison',
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      title: pact.label,
      summary: spent.state.flash,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  let working: GameState = {
    ...spent.state,
    points: spent.state.points - pact.mpCost,
    apUsed: {
      ...spent.state.apUsed,
      ...(partner ? { [`prison_${partner.pid}`]: true } : {}),
      ...(pact.req?.oncePerDay ? { pdisplay_day: true } : {}),
      ...(officerCode
        ? {
            [`who_${officerCode}`]: true,
            [`officer_${officerKeyFromCode(officerCode)}`]: true,
          }
        : {}),
    },
  };

  // Determine effective stat payload
  let effOverride: Partial<Record<PactStatKey, [number, number]>> | undefined;
  if (pactId === 'pduo' && officerCode) {
    effOverride =
      officerCode === 'V'
        ? { terror: [8, 8], pleasure: [8, 8] }
        : { pleasure: [12, 12] };
  }

  const applied = applyPactStatsToPrisoner(working, prisoner, pactId, effOverride);
  let nextPrisoner = applied.updated;
  const deltas = [...applied.deltas];
  const extras: string[] = [];
  let interroSuccess: boolean | undefined;
  let died = false;

  // Pact-specific mechanics
  if (pactId === 'pint') {
    const chance = getInterrogateChance(working, prisoner);
    interroSuccess = Math.random() < chance;
    const resDelta = interroSuccess ? -5 : -3;
    nextPrisoner.resist = clamp(nextPrisoner.resist + resDelta, 0, 100);
    deltas.push(`Resist ${resDelta}`);
    if (interroSuccess) {
      nextPrisoner.intel = (nextPrisoner.intel ?? 0) + 1;
      extras.push('+1 Intel');
    } else {
      extras.push('No Intel');
    }
  } else if (pactId === 'ptort') {
    const resDrop = 10 + randInt(1, 10);
    const resScaled = Math.round(resDrop * getResistMultiplier(working, 'ptort'));
    nextPrisoner.resist = clamp(nextPrisoner.resist - resScaled, 0, 100);
    deltas.push(`Resist -${resScaled}`);
    working = { ...working, fear: clamp(working.fear + 3, 0, 100) };
    extras.push('Fear +3');
    if (nextPrisoner.traits.includes('masochist')) {
      nextPrisoner.corr = clamp(nextPrisoner.corr + 10, 0, 100);
      deltas.push('Corr +10 (Masochist)');
    } else if (Math.random() < 0.25) {
      if (nextPrisoner.cond === 'severe' && !nextPrisoner.legend) {
        died = true;
        working = {
          ...working,
          kills: working.kills + 1,
          fear: clamp(working.fear + 4, 0, 100),
        };
        extras.push('Fatal injury (+4 Fear)');
      } else {
        nextPrisoner.cond = nextPrisoner.cond === 'injured' ? 'severe' : 'injured';
        extras.push(`Condition: ${nextPrisoner.cond}`);
      }
    }
  } else if (pactId === 'ptalk' && Math.random() < 0.15) {
    nextPrisoner.intel = (nextPrisoner.intel ?? 0) + 1;
    extras.push('+1 Intel');
  } else if (pactId === 'pdress') {
    nextPrisoner.dressed = true;
    extras.push('Next Sale +20%');
  } else if (pactId === 'pcure') {
    const cured: string[] = [];
    nextPrisoner.afflictions = nextPrisoner.afflictions.filter((a) => {
      if (a === 'parasite') {
        cured.push('Parasite');
        return false;
      }
      if (a === 'curse' && facLv(working, 'shrine') >= 2) {
        cured.push('Curse');
        return false;
      }
      return true;
    });
    extras.push(`Cured: ${cured.join(', ')}`);
  } else if (pactId === 'pmilk') {
    working = {
      ...working,
      points: working.points + 5,
      town: { ...working.town, food: clamp(working.town.food + 3, 0, 100) },
    };
    extras.push('Food +3', '+5 MP');
  } else if (pactId === 'pdisplay') {
    working = {
      ...working,
      lust: clamp(working.lust + 6, 0, 100),
      town: {
        ...working.town,
        approval: clamp(working.town.approval + 2, 0, 100),
        renown: clamp(working.town.renown - 2, 0, 100),
      },
    };
    extras.push('Approval +2', 'Renown -2', 'Lust +6');
  } else if (pactId === 'ppublic') {
    working = {
      ...working,
      town: {
        ...working.town,
        order: clamp(working.town.order + 2, 0, 100),
        approval: clamp(working.town.approval + 1, 0, 100),
      },
    };
    extras.push('Order +2', 'Approval +1');
  } else if (pactId === 'pwalk') {
    working = {
      ...working,
      lust: clamp(working.lust + 3, 0, 100),
      town: { ...working.town, renown: clamp(working.town.renown - 1, 0, 100) },
    };
    extras.push('Renown -1', 'Lust +3');
  } else if (pactId === 'pwork') {
    const earned = Math.floor(calculateRansom(working, nextPrisoner, { forSale: true }).amount * 0.15);
    working = {
      ...working,
      points: working.points + earned,
      lust: clamp(working.lust + 3, 0, 100),
    };
    extras.push(`+${earned} MP`, 'Lust +3');
  } else if ((pactId === 'pduo' || pactId === 'pgift') && officerCode) {
    const oKey = officerKeyFromCode(officerCode);
    const gain = pactId === 'pduo' ? 1 : 2;
    const prevOff = working.officers[oKey];
    const nextAff = prevOff.aff + gain;
    const nextStage = Math.max(prevOff.stage, getOfficerStageForAff(oKey, nextAff));
    working = {
      ...working,
      officers: {
        ...working.officers,
        [oKey]: { ...prevOff, aff: nextAff, stage: nextStage },
      },
    };
    extras.push(`${officerNameFromCode(officerCode)} Aff +${gain}`);
  } else if (pactId === 'pbrand') {
    nextPrisoner.branded = true;
    working = { ...working, fear: clamp(working.fear + 2, 0, 100) };
    extras.push('Branded (+5% Ransom)', 'Fear +2');
  } else if (pactId === 'pstarve') {
    working = {
      ...working,
      town: { ...working.town, food: clamp(working.town.food + 1, 0, 100) },
    };
    extras.push('Food +1');
  } else if (pactId === 'ptent') {
    working = { ...working, lust: clamp(working.lust + 4, 0, 100) };
    extras.push('Lust +4');
  } else if (pactId === 'pslime') {
    working = {
      ...working,
      lust: clamp(working.lust + 2, 0, 100),
      town: { ...working.town, approval: clamp(working.town.approval + 1, 0, 100) },
    };
    extras.push('Lust +2', 'Approval +1');
  } else if (pactId === 'pcrest') {
    nextPrisoner.crest = true;
    extras.push('Lewd Crest (+20% LewdMart)');
  } else if (pactId === 'phypno') {
    if (Math.random() < 0.3) {
      nextPrisoner.intel = (nextPrisoner.intel ?? 0) + 1;
      extras.push('+1 Intel');
    }
    if (nextPrisoner.resist <= 0 && !nextPrisoner.broken) {
      nextPrisoner.broken = true;
      extras.push('Mind Broken (-30% Ransom)');
    }
  } else if (pactId === 'pcow') {
    nextPrisoner.cow = true;
    working = {
      ...working,
      town: { ...working.town, food: clamp(working.town.food + 2, 0, 100) },
    };
    extras.push('Cow Conversion', 'Food +2');
  } else if (pactId === 'pconfess') {
    if (Math.random() < 0.4) {
      nextPrisoner.intel = (nextPrisoner.intel ?? 0) + 1;
      extras.push('+1 Intel');
    } else {
      extras.push('No confession');
    }
  } else if (pactId === 'prename') {
    nextPrisoner.renamed = true;
    nextPrisoner.marks.obey = Math.max(nextPrisoner.marks.obey, 2);
    extras.push('Name Stripped (0% Sale Escape)');
  } else if (pactId === 'pduel') {
    working = {
      ...working,
      points: working.points + 10,
      town: { ...working.town, renown: clamp(working.town.renown + 1, 0, 100) },
    };
    extras.push('+10 MP', 'Renown +1');
  }

  // Exhaustion death check for pwhip / ptool
  if (
    !died &&
    (pactId === 'pwhip' || pactId === 'ptool') &&
    nextPrisoner.stamina < 10 &&
    !nextPrisoner.legend &&
    Math.random() < 0.25
  ) {
    died = true;
    working = {
      ...working,
      kills: working.kills + 1,
      fear: clamp(working.fear + 4, 0, 100),
    };
    extras.push('Collapsed from exhaustion');
  }

  // Harsh pact death & injury check
  if (!died && pact.harsh) {
    if (pact.harsh.mpGain) {
      working = { ...working, points: working.points + pact.harsh.mpGain };
      extras.push(`+${pact.harsh.mpGain} MP`);
    }
    if (pact.harsh.foodGain) {
      working = {
        ...working,
        town: {
          ...working.town,
          food: clamp(working.town.food + pact.harsh.foodGain, 0, 100),
        },
      };
      extras.push(`Food +${pact.harsh.foodGain}`);
    }
    if (nextPrisoner.legend && nextPrisoner.stamina <= 0) {
      nextPrisoner.stamina = 1;
    }
    const dieChance = getHarshDeathChance(working, prisoner, pactId);
    if (!nextPrisoner.legend && Math.random() < dieChance) {
      died = true;
      working = {
        ...working,
        kills: working.kills + 1,
        fear: clamp(working.fear + HARSH_CFG.DEATH_FEAR, 0, 100),
      };
      extras.push(`Fatal (${Math.round(dieChance * 100)}% risk)`);
    } else if (Math.random() < HARSH_CFG.INJ_CHANCE) {
      nextPrisoner.cond =
        nextPrisoner.cond === 'injured' || nextPrisoner.cond === 'severe'
          ? 'severe'
          : 'injured';
      extras.push(`Condition: ${nextPrisoner.cond}`);
    }
  }

  // Apply partner update if paired
  let updatedPartner: Prisoner | null = null;
  if (partner) {
    const partnerApplied = applyPactStatsToPrisoner(working, partner, pactId, effOverride);
    const partnerMarked = checkPrisonerMarks(working, partnerApplied.updated);
    updatedPartner = partnerMarked.prisoner;
  }

  // Mark checks for primary prisoner
  let upgradedLabels: string[] = [];
  let firstUpgradedMarkKey: keyof PrisonerMarks | undefined;
  if (!died) {
    const markRes = checkPrisonerMarks(working, nextPrisoner);
    nextPrisoner = markRes.prisoner;
    upgradedLabels = markRes.upgraded.map((u) => u.label);
    firstUpgradedMarkKey = markRes.upgraded[0]?.key;
    if (upgradedLabels.length > 0) {
      extras.push(`Marks: ${upgradedLabels.join(', ')}`);
    }
  }

  // Update prisoners array
  let nextPrisoners: Prisoner[];
  if (died) {
    nextPrisoners = working.prisoners.filter((p) => p.pid !== pid);
  } else {
    nextPrisoners = working.prisoners.map((p) => (p.pid === pid ? nextPrisoner : p));
  }
  if (updatedPartner) {
    nextPrisoners = nextPrisoners.map((p) =>
      p.pid === updatedPartner!.pid ? updatedPartner! : p
    );
  }

  const imageUrl =
    died && pactId === 'ptort'
      ? resolvePrisonAsset('dk_pa_tort_death', prisoner.gender)
      : firstUpgradedMarkKey
        ? resolveMarkAsset(firstUpgradedMarkKey, prisoner.gender) ??
          resolvePactAsset(pactId, prisoner.gender, { duoOfficer: officerCode, interroSuccess })
        : resolvePactAsset(pactId, prisoner.gender, { duoOfficer: officerCode, interroSuccess });

  const isKeyMoment =
    died ||
    upgradedLabels.length > 0 ||
    pactId === 'pduo' ||
    pactId === 'ppublic' ||
    pactId === 'pdisplay';

  const summaryParts = [...deltas, ...extras];
  const fullSummary = `${summaryParts.join(' · ')}${died ? ' · DIED' : ` · Stam ${nextPrisoner.stamina}/${nextPrisoner.staminaMax}`}`;

  // Update the day log line we appended during spendDayAp with richer detail
  const updatedDayLines = [...working.dayLines];
  if (updatedDayLines.length > 0) {
    updatedDayLines[updatedDayLines.length - 1] = {
      text: `${prisoner.name} — ${pact.label}${partner ? ` + ${partner.name}` : ''}: ${fullSummary}`,
      star: isKeyMoment,
      kind: upgradedLabels.length > 0 ? 'mark' : 'prison',
      art: imageUrl,
    };
  }

  const pronouns = getPrisonerPronouns(prisoner.gender);
  const sceneProse = died
    ? `${pact.resultProse}; ${pronouns.possessive} body finally gives out and ${pronouns.subject} dies under the session.`
    : `${pact.resultProse}${upgradedLabels.length > 0 ? `; a new mark (${upgradedLabels.join(', ')}) takes hold` : ''}.`;

  const sceneContext = buildPrisonNarrateContext(
    working,
    died ? prisoner : nextPrisoner,
    `${pact.label}${partner ? ` with ${partner.name}` : ''}${officerCode ? ` (assisted by ${officerNameFromCode(officerCode)})` : ''}`,
    sceneProse
  );

  return {
    ok: true,
    state: {
      ...working,
      prisoners: nextPrisoners,
      dayLines: updatedDayLines,
      flash: `${prisoner.name} · ${pact.label}: ${fullSummary}`,
    },
    title: `${prisoner.name} — ${pact.label}`,
    summary: fullSummary,
    sceneContext,
    imageUrl,
    isKeyMoment,
    died,
    upgradedMarks: upgradedLabels,
  };
}

// ---------------------------------------------------------------------------
// Jobs (24 CFG.JOBS) & Aptitude
// ---------------------------------------------------------------------------

export function getJobAptitudeStars(p: Prisoner, jobKey: string): 1 | 2 | 3 {
  const job = PRISON_JOB_MAP[jobKey];
  if (!job || job.aptitude.length === 0) return 2;
  let sum = 0;
  for (const crit of job.aptitude) {
    const raw =
      crit.stat === 'stamina'
        ? clamp((p.stamina / Math.max(100, p.staminaMax)) * 100, 0, 100)
        : p[crit.stat];
    sum += (crit.dir > 0 ? raw : 100 - raw) / 100;
  }
  const avg = sum / job.aptitude.length;
  if (avg >= 0.65) return 3;
  if (avg >= 0.4) return 2;
  return 1;
}

export function getJobMaxSlots(state: GameState, jobKey: string): number {
  const job = PRISON_JOB_MAP[jobKey];
  if (!job) return 0;
  if (job.location === 'floor') {
    return state.floors.filter((f) => f.slots.length > 0).length;
  }
  if (jobKey === 'trusty') {
    return 1 + facLv(state, 'annex');
  }
  if (job.facility) {
    const lv = facLv(state, job.facility);
    if (job.facilityLv && lv < job.facilityLv) return 0;
    return lv * job.baseSlots;
  }
  return job.baseSlots;
}

export function getJobUsedSlots(state: GameState, jobKey: string): number {
  return state.prisoners.filter((p) => p.job === jobKey).length;
}

export function getFreeTrappedFloors(
  state: GameState,
  excludePid?: number
): number[] {
  const taken = new Set<number>();
  for (const p of state.prisoners) {
    if (p.pid === excludePid) continue;
    if (p.assignedFloor && (p.converted === 'guard' || p.job === 'bait' || p.job === 'lure')) {
      taken.add(p.assignedFloor);
    }
  }
  return state.floors
    .filter((f) => f.slots.length > 0 && !taken.has(f.floor))
    .map((f) => f.floor);
}

export function canAssignJob(
  state: GameState,
  p: Prisoner,
  jobKey: string,
  opts?: { asHired?: boolean }
): { ok: true } | { ok: false; reason: string } {
  const job = PRISON_JOB_MAP[jobKey];
  if (!job) return { ok: false, reason: 'Unknown job.' };
  if (!isDayPhase(state)) {
    return { ok: false, reason: 'Locked: Assign jobs during Day (AP) phase.' };
  }
  if (state.estate.activeCrisis) {
    return { ok: false, reason: 'Resolve active crisis first.' };
  }
  if (isActiveMole(p)) {
    return { ok: false, reason: 'Currently deployed as Double Agent.' };
  }
  if (p.converted && p.converted !== 'hired') {
    return { ok: false, reason: `Converted ${p.converted} cannot take regular jobs.` };
  }
  if (p.job === jobKey && !opts?.asHired) {
    return { ok: false, reason: 'Already assigned to this job.' };
  }
  if (job.facility) {
    const needLv = job.facilityLv ?? 1;
    if (facLv(state, job.facility) < needLv) {
      return {
        ok: false,
        reason: `Requires ${facName(job.facility)}${needLv > 1 ? ` Lv.${needLv}` : ''}.`,
      };
    }
  }
  if (job.reqMark) {
    const [mk, lv] = job.reqMark;
    if ((p.marks[mk] ?? 0) < lv) {
      return { ok: false, reason: `Requires ${MARK_LABELS[mk]} Mark Lv.${lv}.` };
    }
  }
  if (job.location === 'floor' && getFreeTrappedFloors(state, p.pid).length === 0) {
    return { ok: false, reason: 'No free floor with installed traps.' };
  }
  const maxSlots = getJobMaxSlots(state, jobKey);
  const used = getJobUsedSlots(state, jobKey);
  if (used >= maxSlots) {
    return { ok: false, reason: `No open slots (${used}/${maxSlots}).` };
  }
  if (state.ap <= 0) {
    return { ok: false, reason: '0 AP left today.' };
  }
  const apKey = opts?.asHired ? `hire_${p.pid}` : `job_${p.pid}`;
  if (state.apUsed[apKey]) {
    return { ok: false, reason: `${p.name} already assigned today.` };
  }
  return { ok: true };
}

export function getJobYieldPreview(
  state: GameState,
  p: Prisoner,
  jobKey: string
): { mp: number; stats: string[]; summary: string } {
  const job = PRISON_JOB_MAP[jobKey];
  if (!job) return { mp: 0, stats: [], summary: '' };

  const stars = getJobAptitudeStars(p, jobKey);
  const aptMult = APTITUDE_MULT[stars];
  const hiredMult = p.converted === 'hired' ? 2 : 1;

  const baseMp =
    (job.outputs.mp ?? 0) +
    (job.outputs.mpRansomRatio
      ? Math.floor(
          calculateRansom(state, p, { forSale: true }).amount *
            job.outputs.mpRansomRatio
        )
      : 0);

  let talentBonus = 0;
  if (p.marks.obey >= 2) talentBonus += 0.2;
  if (
    p.marks.pleasure >= 3 &&
    (jobKey === 'brothel' || jobKey === 'tavern' || jobKey === 'tasting' || jobKey === 'lure')
  ) {
    talentBonus += 0.5;
  }
  if (p.marks.terror >= 2 && jobKey === 'arena') {
    talentBonus -= 0.5;
  }

  const mp = Math.max(0, Math.round(baseMp * aptMult * hiredMult * (1 + talentBonus)));
  const stats: string[] = [];
  const scaleStat = (n?: number) =>
    n ? Math.round(n * aptMult * hiredMult) : 0;

  const food = scaleStat(job.outputs.food);
  const approval = scaleStat(job.outputs.approval);
  const order = scaleStat(job.outputs.order);
  const renown = scaleStat(job.outputs.renown);
  const fear = scaleStat(job.outputs.fear);
  const lust = scaleStat(job.outputs.lust);

  if (mp > 0) stats.push(`+${mp} MP`);
  if (food) stats.push(`Food ${food >= 0 ? `+${food}` : food}`);
  if (approval) stats.push(`App ${approval >= 0 ? `+${approval}` : approval}`);
  if (order) stats.push(`Order ${order >= 0 ? `+${order}` : order}`);
  if (renown) stats.push(`Renown ${renown >= 0 ? `+${renown}` : renown}`);
  if (fear) stats.push(`Fear +${fear}`);
  if (lust) stats.push(`Lust +${lust}`);
  if (job.outputs.affVesper) stats.push(`Vesper Aff +${job.outputs.affVesper * hiredMult}`);
  if (p.converted === 'hired') stats.push('Salary -5 MP');

  return {
    mp,
    stats,
    summary: stats.length > 0 ? stats.join(' · ') : job.desc,
  };
}

export function assignPrisonerJob(
  state: GameState,
  pid: number,
  jobKey: string,
  opts?: { floor?: number }
): PrisonActionResult {
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Assign Job',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const job = PRISON_JOB_MAP[jobKey];
  const check = canAssignJob(state, prisoner, jobKey);
  if (!job || !check.ok) {
    const reason = check.ok ? 'Unknown job.' : check.reason;
    return {
      ok: false,
      state: { ...state, flash: `${prisoner.name} · ${job?.label ?? jobKey} — ${reason}` },
      title: 'Assign Job',
      summary: reason,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  let assignedFloor: number | null = null;
  if (job.location === 'floor') {
    const free = getFreeTrappedFloors(state, pid);
    assignedFloor =
      opts?.floor && free.includes(opts.floor) ? opts.floor : free[0] ?? null;
    if (!assignedFloor) {
      return {
        ok: false,
        state: { ...state, flash: 'No free trapped floor available.' },
        title: job.label,
        summary: 'No free trapped floor available.',
        sceneContext: '',
        isKeyMoment: false,
      };
    }
  }

  const imageUrl = resolveJobAsset(jobKey, prisoner.gender);
  const floorTag = assignedFloor ? ` (${assignedFloor}F)` : '';
  const summary = `Assigned to ${job.label}${floorTag} (${'★'.repeat(getJobAptitudeStars(prisoner, jobKey))})`;

  const spent = spendDayAp(state, `job_${pid}`, {
    text: `${prisoner.name} — Job: ${job.label}${floorTag}`,
    kind: 'job',
    art: imageUrl,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      title: job.label,
      summary: spent.state.flash,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  const nextPrisoners = [...spent.state.prisoners];
  nextPrisoners[idx] = {
    ...prisoner,
    job: jobKey,
    assignedFloor,
  };

  return {
    ok: true,
    state: {
      ...spent.state,
      prisoners: nextPrisoners,
      flash: `${prisoner.name}: ${summary} (-1 AP).`,
    },
    title: `${prisoner.name} — ${job.label}`,
    summary,
    sceneContext: buildPrisonNarrateContext(
      spent.state,
      nextPrisoners[idx],
      `Assigned to ${job.label}${floorTag}`,
      `put to work as ${job.label}${floorTag}: ${job.desc}`
    ),
    imageUrl,
    isKeyMoment: false,
  };
}

export function unassignPrisonerJob(
  state: GameState,
  pid: number
): PrisonActionResult {
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Unassign Job',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  if (!prisoner.job) {
    return {
      ok: false,
      state,
      title: 'Unassign Job',
      summary: 'Captive has no active job.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const nextPrisoners = [...state.prisoners];
  nextPrisoners[idx] = {
    ...prisoner,
    job: null,
    assignedFloor: prisoner.converted === 'guard' ? prisoner.assignedFloor : null,
  };
  return {
    ok: true,
    state: {
      ...state,
      prisoners: nextPrisoners,
      flash: `${prisoner.name} unassigned from job (0 AP).`,
    },
    title: `${prisoner.name} — Unassigned`,
    summary: 'Removed from job assignment (0 AP).',
    sceneContext: '',
    isKeyMoment: false,
  };
}

// ---------------------------------------------------------------------------
// 5 Conversions & Double Agent (Mole)
// ---------------------------------------------------------------------------

export function getConversionCount(
  state: GameState,
  kind: PrisonerConversion
): number {
  return state.prisoners.filter((p) => p.converted === kind).length;
}

export function getConversionCap(state: GameState, kind: PrisonerConversion): number {
  switch (kind) {
    case 'guard':
    case 'servant':
      return 3;
    case 'pet':
    case 'dancer':
      return 2;
    case 'hired':
      return 3 + facLv(state, 'manor');
  }
}

export function canConvertPrisoner(
  state: GameState,
  p: Prisoner,
  kind: PrisonerConversion,
  opts?: { jobKey?: string }
): { ok: true } | { ok: false; reason: string } {
  if (!isActiveCaptive(p)) {
    return { ok: false, reason: 'Already converted or deployed.' };
  }
  if (!isDayPhase(state)) {
    return { ok: false, reason: 'Locked: Conversions require Day (AP) phase.' };
  }
  if (state.estate.activeCrisis) {
    return { ok: false, reason: 'Resolve active crisis first.' };
  }
  const cap = getConversionCap(state, kind);
  const count = getConversionCount(state, kind);
  if (count >= cap) {
    return { ok: false, reason: `Cap reached (${count}/${cap}).` };
  }

  if (kind === 'guard') {
    if (p.resist > 10) return { ok: false, reason: 'Requires Resist <= 10%.' };
    if (getFreeTrappedFloors(state, p.pid).length === 0) {
      return { ok: false, reason: 'Requires a free floor with installed traps.' };
    }
  } else if (kind === 'servant') {
    if (p.corr < 70) return { ok: false, reason: 'Requires Corruption >= 70.' };
  } else if (kind === 'pet') {
    if (p.marks.pleasure < 3 || p.marks.obey < 2) {
      return { ok: false, reason: 'Requires Pleasure Mark 3 + Obey Mark 2.' };
    }
  } else if (kind === 'dancer') {
    if (p.marks.shame < 3 || p.marks.pleasure < 2) {
      return { ok: false, reason: 'Requires Shame Mark 3 + Pleasure Mark 2.' };
    }
    if (facLv(state, 'brothel') < 1) {
      return { ok: false, reason: 'Requires Pleasure Quarter (Brothel).' };
    }
  } else if (kind === 'hired') {
    if (p.marks.obey < 3 && p.corr < 80) {
      return { ok: false, reason: 'Requires Obey Mark 3 or Corruption >= 80.' };
    }
    if (opts?.jobKey) {
      const jc = canAssignJob(state, p, opts.jobKey, { asHired: true });
      if (!jc.ok) return jc;
    }
  }

  if (state.ap <= 0) {
    return { ok: false, reason: '0 AP left today.' };
  }
  const apKey = kind === 'hired' ? `hire_${p.pid}` : `prison_${p.pid}`;
  if (state.apUsed[apKey]) {
    return { ok: false, reason: `${p.name} already acted today.` };
  }
  return { ok: true };
}

export function convertPrisoner(
  state: GameState,
  pid: number,
  kind: PrisonerConversion,
  opts?: { owner?: 'V' | 'L'; floor?: number; jobKey?: string }
): PrisonActionResult {
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Convert Captive',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const def = PRISON_CONVERSIONS.find((c) => c.key === kind)!;
  const check = canConvertPrisoner(state, prisoner, kind, { jobKey: opts?.jobKey });
  if (!check.ok) {
    return {
      ok: false,
      state: { ...state, flash: `${prisoner.name} · ${def.label} — ${check.reason}` },
      title: def.label,
      summary: check.reason,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  let assignedFloor: number | null = null;
  let jobKey: string | null = null;
  let owner: 'V' | 'L' | null = null;

  if (kind === 'guard') {
    const free = getFreeTrappedFloors(state, pid);
    assignedFloor =
      opts?.floor && free.includes(opts.floor) ? opts.floor : free[0] ?? null;
    if (!assignedFloor) {
      return {
        ok: false,
        state: { ...state, flash: 'No free trapped floor for Guard.' },
        title: def.label,
        summary: 'No free trapped floor.',
        sceneContext: '',
        isKeyMoment: false,
      };
    }
  } else if (kind === 'pet') {
    owner = opts?.owner ?? 'V';
  } else if (kind === 'hired') {
    const openJob =
      opts?.jobKey ??
      PRISON_JOBS.find((j) => canAssignJob(state, prisoner, j.key, { asHired: true }).ok)
        ?.key;
    if (!openJob) {
      return {
        ok: false,
        state: { ...state, flash: 'No open job slot available for Hired Staff.' },
        title: def.label,
        summary: 'No open job slot available.',
        sceneContext: '',
        isKeyMoment: false,
      };
    }
    jobKey = openJob;
    if (PRISON_JOB_MAP[openJob]?.location === 'floor') {
      assignedFloor = getFreeTrappedFloors(state, pid)[0] ?? null;
    }
  }

  const imageUrl = resolvePrisonAsset(def.assetKey, prisoner.gender);
  const roleDetail =
    kind === 'guard'
      ? `Floor Guard (${assignedFloor}F, +1 DC)`
      : kind === 'servant'
        ? `Dungeon Servant (+${SERVANT_MP_BY_GRADE[prisoner.grade]} MP/settle)`
        : kind === 'pet'
          ? `Pet of ${officerNameFromCode(owner!)}`
          : kind === 'dancer'
            ? 'Exclusive Brothel Dancer'
            : `Hired Staff (${PRISON_JOB_MAP[jobKey!]?.label ?? jobKey}, ×2 output)`;

  const apKey = kind === 'hired' ? `hire_${pid}` : `prison_${pid}`;
  const spent = spendDayAp(state, apKey, {
    text: `${prisoner.name} converted → ${roleDetail}`,
    star: true,
    kind,
    art: imageUrl,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      title: def.label,
      summary: spent.state.flash,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  const nextPrisoners = [...spent.state.prisoners];
  nextPrisoners[idx] = {
    ...prisoner,
    converted: kind,
    job: jobKey,
    assignedFloor,
    owner,
  };

  const nextState: GameState = {
    ...spent.state,
    prisoners: nextPrisoners,
    apGrowth: {
      ...spent.state.apGrowth,
      conv: spent.state.apGrowth.conv + 1,
    },
    flash: `${prisoner.name} converted to ${roleDetail} (-1 AP).`,
  };

  return {
    ok: true,
    state: nextState,
    title: `${prisoner.name} → ${def.label}`,
    summary: roleDetail,
    sceneContext: buildPrisonNarrateContext(
      nextState,
      nextPrisoners[idx],
      `Converted to ${roleDetail}`,
      `sworn into the dungeon as ${roleDetail}`
    ),
    imageUrl,
    isKeyMoment: true,
  };
}

export function canDispatchMole(
  state: GameState,
  p: Prisoner
): { ok: true } | { ok: false; reason: string } {
  if (!isActiveCaptive(p)) {
    return { ok: false, reason: 'Only cell captives can be dispatched as a mole.' };
  }
  if (!isDayPhase(state)) {
    return { ok: false, reason: 'Locked: Dispatch requires Day (AP) phase.' };
  }
  if (state.estate.activeCrisis) {
    return { ok: false, reason: 'Resolve active crisis first.' };
  }
  if (p.marks.obey < 3) {
    return { ok: false, reason: 'Requires Obey Mark Lv.3.' };
  }
  if (state.prisoners.some(isActiveMole)) {
    return { ok: false, reason: 'Only one Double Agent may be active at a time.' };
  }
  if (state.ap <= 0) {
    return { ok: false, reason: '0 AP left today.' };
  }
  if (state.apUsed[`prison_${p.pid}`]) {
    return { ok: false, reason: `${p.name} already acted today.` };
  }
  return { ok: true };
}

export function dispatchPrisonerMole(
  state: GameState,
  pid: number
): PrisonActionResult {
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Double Agent',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const check = canDispatchMole(state, prisoner);
  if (!check.ok) {
    return {
      ok: false,
      state: { ...state, flash: `${prisoner.name} · Double Agent — ${check.reason}` },
      title: 'Double Agent',
      summary: check.reason,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  const imageUrl =
    resolvePrisonAsset('dk_ex_spy_double', prisoner.gender) ??
    resolvePrisonAsset('dk_pa_free', prisoner.gender);
  const summary = `Infiltrating Guild for ${MOLE_CFG.RAIDS} raids (+${MOLE_CFG.INTEL} Intel, -1 Guild Scout, 20% discovery risk/raid)`;

  const spent = spendDayAp(state, `prison_${pid}`, {
    text: `${prisoner.name} dispatched as Double Agent (${MOLE_CFG.RAIDS} raids).`,
    star: true,
    kind: 'mole',
    art: imageUrl,
  });
  if (!spent.ok) {
    return {
      ok: false,
      state: spent.state,
      title: 'Double Agent',
      summary: spent.state.flash,
      sceneContext: '',
      isKeyMoment: false,
    };
  }

  const nextPrisoners = [...spent.state.prisoners];
  nextPrisoners[idx] = {
    ...prisoner,
    job: null,
    assignedFloor: null,
    moleRaidsLeft: MOLE_CFG.RAIDS,
  };

  const nextState: GameState = {
    ...spent.state,
    prisoners: nextPrisoners,
    flash: `${prisoner.name} sent back to the Guild as a Double Agent (-1 AP).`,
  };

  return {
    ok: true,
    state: nextState,
    title: `${prisoner.name} — Double Agent`,
    summary,
    sceneContext: buildPrisonNarrateContext(
      nextState,
      nextPrisoners[idx],
      'Dispatched as Double Agent',
      'released back to the Adventurer Guild as a conditioned double agent reporting every move'
    ),
    imageUrl,
    isKeyMoment: true,
  };
}

// ---------------------------------------------------------------------------
// Ransom, Buyers, Sale Risks & Fate Disposal
// ---------------------------------------------------------------------------

export function getHotBuyerForDay(day: number): BuyerKey {
  const idx = Math.abs(Math.floor(day)) % BUYERS.length;
  return BUYERS[idx].id;
}

export function getBuyerMultiplier(
  state: GameState,
  p: Prisoner,
  buyerId: BuyerKey
): number {
  let v = 1;
  let x = 0;

  if (buyerId === 'slaver') {
    v =
      1 +
      0.1 * (p.marks.obey ?? 0) -
      (p.resist > 60 ? 0.2 : 0) +
      (p.stamina >= 80 ? 0.1 : 0);
    x = (60 - p.resist) / 200 + p.stamina / 400 + p.terror / 500;
  } else if (buyerId === 'noble') {
    const highborn = p.traits.includes('noble') || p.traits.includes('pure');
    const unhurt = p.cond === '';
    v =
      0.8 +
      (highborn ? 0.4 : 0) +
      (unhurt ? 0.1 : 0) -
      (p.branded ? 0.3 : 0) -
      (p.corr >= 60 ? 0.3 : 0);
    x =
      (40 - p.corr) / 200 -
      (p.shame >= 70 ? 0.15 : 0) +
      (p.virgin ? 0.25 : 0);
  } else if (buyerId === 'brothel') {
    v =
      0.7 +
      p.pleasure / 200 +
      p.corr / 250 +
      0.1 * (p.marks.shame ?? 0) +
      (p.crest ? 0.2 : 0) -
      (p.terror >= 60 ? 0.2 : 0);
    x = p.pleasure / 250 + p.corr / 300 - (p.resist >= 70 ? 0.15 : 0);
  } else if (buyerId === 'arena') {
    const hurt = p.cond === 'injured' || p.cond === 'severe';
    v =
      0.7 +
      (p.stamina >= 80 ? 0.2 : 0) -
      (p.terror >= 60 ? 0.2 : 0) -
      (hurt ? 0.3 : 0);
    x = p.stamina / 250 + p.resist / 400 - p.terror / 300;
  }

  let mult = clamp(v * (1 + x), 0.5, 2.0);
  if (getHotBuyerForDay(state.day || state.wave) === buyerId) {
    mult *= 1.3;
  }
  return mult;
}

export function calculateRansom(
  state: GameState,
  p: Prisoner,
  opts?: { forSale?: boolean; buyerId?: BuyerKey }
): { amount: number; breakdown: string } {
  const base = CFG.RANSOM[p.grade] ?? CFG.RANSOM.C;
  const forSale = opts?.forSale !== false;
  let m = 1;
  const parts: string[] = [];

  const mul = (val: number, label: string) => {
    if (Math.abs(val - 1) > 0.0001) {
      m *= val;
      parts.push(`${label} ×${val.toFixed(2)}`);
    }
  };

  const markSum =
    (p.marks.obey ?? 0) +
    (p.marks.pleasure ?? 0) +
    (p.marks.terror ?? 0) +
    (p.marks.shame ?? 0);

  mul(1 + p.corr / 200, 'Corr');
  mul(1 + markSum * 0.08, 'Marks');
  if (p.pleasure >= 70) mul(1.15, 'Pleasure');
  if (p.stamina < 30) mul(0.7, 'Exhausted');
  if (p.terror >= 80) mul(0.9, 'Terrified');
  if (p.traits.includes('noble')) mul(1.5, 'Noble');
  if (p.traits.includes('rich')) mul(1.3, 'Rich');
  if (p.cond === 'severe') mul(0.8, 'Severe');
  if (p.dressed) mul(1.2, 'Dressed');
  if (p.broken) mul(0.7, 'Broken');
  if (p.branded) mul(1.05, 'Branded');
  if ((p.cow || p.crest) && facLv(state, 'lewdmart') >= 1) {
    mul(1.2, 'LewdMart');
  }
  if (p.virgin && !p.traits.includes('pure')) mul(1.1, 'Virgin');

  if (state.town.renown >= 80) mul(1.15, 'Renown 80+');
  else if (state.town.renown >= 60) mul(1.1, 'Renown 60+');

  const mktLv = facLv(state, 'market');
  if (mktLv > 0) mul(1 + 0.05 * mktLv, 'Market');

  if (forSale) {
    if (state.officers.vesper.stage >= 1) mul(1.1, 'Vesper S1');
    if (state.officers.vesper.aff > 0) {
      mul(1 + state.officers.vesper.aff * 0.001, 'Vesper Aff');
    }
    if ((state.estate.perks.ransomUpDay ?? 0) > 0) {
      mul(1 + state.estate.perks.ransomUpDay!, 'Banquet');
    }
  }

  if (opts?.buyerId) {
    const bMult = getBuyerMultiplier(state, p, opts.buyerId);
    mul(bMult, BUYERS.find((b) => b.id === opts.buyerId)?.shortLabel ?? opts.buyerId);
  }

  const amount = Math.max(1, Math.round(base * m));
  const breakdown = `${base} base${parts.length > 0 ? ` × ${parts.join(' × ')}` : ''}`;
  return { amount, breakdown };
}

export function getAllBuyerQuotes(
  state: GameState,
  p: Prisoner
): {
  buyerId: BuyerKey;
  label: string;
  shortLabel: string;
  price: number;
  isBest: boolean;
  isHot: boolean;
}[] {
  const hot = getHotBuyerForDay(state.day || state.wave);
  const raw = BUYERS.map((b) => ({
    buyerId: b.id,
    label: b.label,
    shortLabel: b.shortLabel,
    price: calculateRansom(state, p, { forSale: true, buyerId: b.id }).amount,
    isHot: b.id === hot,
  }));
  const maxPrice = Math.max(...raw.map((r) => r.price));
  return raw.map((r) => ({ ...r, isBest: r.price === maxPrice }));
}

export function getSaleRiskOdds(
  state: GameState,
  p: Prisoner
): { cut: number; stiff: number; escape: number; bonus: number } {
  let cut = 0.15;
  let stiff = 0.07;
  let escape = 0.05;
  const bonus = 0.08;

  if (state.town.order >= 70) {
    stiff /= 2;
    escape /= 2;
  }
  cut = Math.max(0, cut - 0.05 * facLv(state, 'market'));

  const k =
    state.officers.vesper.stage >= 4
      ? 0.5
      : state.officers.vesper.stage >= 3
        ? 0.75
        : 1;
  cut *= k;
  stiff *= k;
  escape *= k;

  if (p.marks.obey >= 2 || p.renamed) {
    escape = 0;
  }

  return { cut, stiff, escape, bonus };
}

export function getExecutePreview(
  state: GameState,
  p: Prisoner
): { mp: number; famePts: number; fear: number; order: number } {
  const baseRansom = CFG.RANSOM[p.grade] ?? CFG.RANSOM.C;
  const mp = Math.floor(baseRansom * EXEC_CFG.RATE);
  const famePts = (CFG.FAME.HERO[p.grade] ?? 1) * EXEC_CFG.FAME_MULT;
  const shrineMult = facLv(state, 'shrine') >= 3 ? 1.5 : 1;
  const baseFear = Math.floor(
    (EXEC_CFG.FEAR_BASE + EXEC_CFG.FEAR_PER_GRADE * (GRADE_INDEX[p.grade] ?? 1)) *
      shrineMult
  );
  const hasGibbet = facLv(state, 'gibbet') >= 1;
  return {
    mp,
    famePts,
    fear: baseFear + (hasGibbet ? 2 : 0),
    order: hasGibbet ? 3 : 0,
  };
}

function checkFateGuard(state: GameState): string | null {
  if (!isDayPhase(state)) {
    return 'Locked: Fate disposal is available during Day phase.';
  }
  if (state.estate.activeCrisis) {
    return 'Resolve active town crisis before disposing captives.';
  }
  return null;
}

export function sellPrisoner(
  state: GameState,
  pid: number,
  buyerId: BuyerKey
): PrisonActionResult {
  const guardErr = checkFateGuard(state);
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (guardErr || idx < 0) {
    const msg = guardErr ?? 'Captive not found.';
    return {
      ok: false,
      state: { ...state, flash: msg },
      title: 'Sell Captive',
      summary: msg,
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const price = calculateRansom(state, prisoner, { forSale: true, buyerId }).amount;
  const odds = getSaleRiskOdds(state, prisoner);
  const roll = Math.random();

  let received = price;
  let outcomeText = `Sold to ${BUYERS.find((b) => b.id === buyerId)?.label ?? buyerId} for +${price} MP`;
  let working = { ...state };

  if (roll < odds.escape) {
    received = 0;
    outcomeText = 'Escaped from escort wagon! 0 MP (Guild Alert +5)';
    if (working.guildActive) {
      working.guildPoints = clamp(working.guildPoints + 5, 0, 100);
    }
  } else if (roll < odds.escape + odds.stiff) {
    received = Math.floor(price * 0.3);
    outcomeText = `Buyer cheated payment! +${received} MP (Renown -1)`;
    working.town = {
      ...working.town,
      renown: clamp(working.town.renown - 1, 0, 100),
    };
  } else if (roll < odds.escape + odds.stiff + odds.cut) {
    received = Math.floor(price * 0.7);
    outcomeText = `Haggled down to +${received} MP (70%)`;
  } else if (roll < odds.escape + odds.stiff + odds.cut + odds.bonus) {
    received = Math.floor(price * 1.2);
    outcomeText = `Premium bonus from regular buyer! +${received} MP`;
  }

  const imageUrl = resolvePrisonAsset('dk_pa_sell', prisoner.gender);
  working = appendDayLogLine(
    {
      ...working,
      points: working.points + received,
      prisoners: working.prisoners.filter((p) => p.pid !== pid),
      flash: `${prisoner.name} — ${outcomeText}`,
    },
    {
      text: `${prisoner.name} sold: ${outcomeText}.`,
      kind: 'sell',
      art: imageUrl,
    }
  );

  return {
    ok: true,
    state: working,
    title: `${prisoner.name} — Sold`,
    summary: outcomeText,
    sceneContext: buildPrisonNarrateContext(working, prisoner, 'Sold Captive', outcomeText),
    imageUrl,
    isKeyMoment: true,
  };
}

export function auctionPrisoner(
  state: GameState,
  pid: number
): PrisonActionResult {
  const guardErr = checkFateGuard(state);
  if (guardErr) {
    return {
      ok: false,
      state: { ...state, flash: guardErr },
      title: 'Auction',
      summary: guardErr,
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  if (facLv(state, 'market') < 1) {
    const msg = 'Requires Slave Market Lv.1 to host an auction.';
    return {
      ok: false,
      state: { ...state, flash: msg },
      title: 'Auction',
      summary: msg,
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Auction',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const price = Math.floor(
    calculateRansom(state, prisoner, { forSale: true }).amount * 1.1
  );
  const imageUrl = resolvePrisonAsset('dk_pa_auction', prisoner.gender);
  const summary = `Auctioned with zero sale risk for +${price} MP`;

  const nextState = appendDayLogLine(
    {
      ...state,
      points: state.points + price,
      prisoners: state.prisoners.filter((p) => p.pid !== pid),
      flash: `${prisoner.name} auctioned for +${price} MP!`,
    },
    {
      text: `${prisoner.name} auctioned at the Slave Market (+${price} MP).`,
      star: true,
      kind: 'auction',
      art: imageUrl,
    }
  );

  return {
    ok: true,
    state: nextState,
    title: `${prisoner.name} — Auctioned`,
    summary,
    sceneContext: buildPrisonNarrateContext(
      nextState,
      prisoner,
      'Slave Market Auction',
      `sold on the auction block to the highest bidder for ${price} MP`
    ),
    imageUrl,
    isKeyMoment: true,
  };
}

export function executePrisoner(
  state: GameState,
  pid: number
): PrisonActionResult {
  const guardErr = checkFateGuard(state);
  if (guardErr) {
    return {
      ok: false,
      state: { ...state, flash: guardErr },
      title: 'Execute',
      summary: guardErr,
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Execute',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const preview = getExecutePreview(state, prisoner);
  const nextFamePts = clamp(state.famePoints + preview.famePts, 0, CFG.FAME.POINT_MAX);
  const imageUrl = resolvePrisonAsset('dk_pa_exec', prisoner.gender);
  const summary = `Executed (+${preview.mp} MP, Fame +${preview.famePts} pts, Fear +${preview.fear}${preview.order > 0 ? `, Order +${preview.order}` : ''})`;

  const nextState = appendDayLogLine(
    {
      ...state,
      points: state.points + preview.mp,
      kills: state.kills + 1,
      famePoints: nextFamePts,
      fame: Math.floor(nextFamePts / 10),
      fear: clamp(state.fear + preview.fear, 0, 100),
      crises:
        state.wave >= CRISIS_CFG.WRATH_FROM || state.crises.wrath > 0
          ? {
              ...state.crises,
              wrath: clamp(state.crises.wrath + CRISIS_CFG.WRATH_EXEC, 0, CRISIS_CFG.WRATH_MAX),
            }
          : state.crises,
      town:
        preview.order > 0
          ? { ...state.town, order: clamp(state.town.order + preview.order, 0, 100) }
          : state.town,
      prisoners: state.prisoners.filter((p) => p.pid !== pid),
      flash: `${prisoner.name} executed (+${preview.mp} MP, Fear +${preview.fear}).`,
    },
    {
      text: `${prisoner.name} — ${summary}.`,
      star: true,
      kind: 'exec',
      art: imageUrl,
    }
  );

  return {
    ok: true,
    state: nextState,
    title: `${prisoner.name} — Executed`,
    summary,
    sceneContext: buildPrisonNarrateContext(
      nextState,
      prisoner,
      'Public Execution',
      'executed cleanly in front of the domain, spreading dread'
    ),
    imageUrl,
    isKeyMoment: true,
    died: true,
  };
}

export function releasePrisoner(
  state: GameState,
  pid: number
): PrisonActionResult {
  const guardErr = checkFateGuard(state);
  if (guardErr) {
    return {
      ok: false,
      state: { ...state, flash: guardErr },
      title: 'Release',
      summary: guardErr,
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const idx = state.prisoners.findIndex((p) => p.pid === pid);
  if (idx < 0) {
    return {
      ok: false,
      state,
      title: 'Release',
      summary: 'Captive not found.',
      sceneContext: '',
      isKeyMoment: false,
    };
  }
  const prisoner = state.prisoners[idx];
  const nextFamePts = clamp(state.famePoints - 1, 0, CFG.FAME.POINT_MAX);
  const imageUrl = resolvePrisonAsset('dk_pa_free', prisoner.gender);
  const summary = 'Released alive (Momentum -1, Fame -1 pt, Fear -3)';

  const nextState = appendDayLogLine(
    {
      ...state,
      momentum: clamp(state.momentum - 1, -CFG.MOMENTUM.MAX, CFG.MOMENTUM.MAX),
      famePoints: nextFamePts,
      fame: Math.floor(nextFamePts / 10),
      fear: clamp(state.fear - 3, 0, 100),
      prisoners: state.prisoners.filter((p) => p.pid !== pid),
      flash: `${prisoner.name} released alive.`,
    },
    {
      text: `${prisoner.name} released alive (${summary}).`,
      kind: 'free',
      art: imageUrl,
    }
  );

  return {
    ok: true,
    state: nextState,
    title: `${prisoner.name} — Released`,
    summary,
    sceneContext: buildPrisonNarrateContext(
      nextState,
      prisoner,
      'Released Alive',
      'set free beyond the dungeon gates alive'
    ),
    imageUrl,
    isKeyMoment: false,
  };
}

// ---------------------------------------------------------------------------
// LLM Prompt Helpers (03_DK_SYS_Prisoners parity + M/F Pronouns)
// ---------------------------------------------------------------------------

function formatMarkCompact(marks: PrisonerMarks): string {
  const parts: string[] = [];
  if (marks.obey > 0) parts.push(`Obey${marks.obey}`);
  if (marks.pleasure > 0) parts.push(`Pleas${marks.pleasure}`);
  if (marks.terror > 0) parts.push(`Terr${marks.terror}`);
  if (marks.shame > 0) parts.push(`Shame${marks.shame}`);
  return parts.length > 0 ? parts.join('/') : 'none';
}

/**
 * Builds a compact, token-capped summary of active cell captives and turned minions
 * matching `_reference/lorebook/03_DK_SYS_Prisoners.md` rules with explicit M/F pronouns.
 */
export function buildPrisonRosterPromptContext(
  state: GameState,
  maxItems = 8
): string {
  const active = state.prisoners.filter(isActiveCaptive);
  const turned = state.prisoners.filter((p) => isConvertedMinion(p) || isActiveMole(p));

  if (active.length === 0 && turned.length === 0) return '';

  const lines: string[] = [];

  if (active.length > 0) {
    const shown = active.slice(-maxItems).reverse();
    const summaryList = shown
      .map((p) => {
        const pr = getPrisonerPronouns(p.gender);
        const roleTag = p.job ? `, job:${p.job}` : '';
        const flags = [
          p.branded ? 'branded' : '',
          p.crest ? 'crest' : '',
          p.cow ? 'cow' : '',
          p.renamed ? 'numbered' : '',
          p.dying ? 'dying' : '',
        ]
          .filter(Boolean)
          .join('/');
        return `${p.name} (${p.grade} ${p.gender} [${pr.subject}/${pr.object}], ${getPrisonerTitle(p)}, Res ${p.resist}%, Corr ${p.corr}%, Marks ${formatMarkCompact(p.marks)}${roleTag}${flags ? `, ${flags}` : ''})`;
      })
      .join('; ');
    const overflow = active.length > shown.length ? ` (and ${active.length - shown.length} earlier)` : '';
    lines.push(
      `[Prison block — ${active.length} captive hero(es) kept alive under Vesper's keys: ${summaryList}${overflow}]`
    );
  }

  if (turned.length > 0) {
    const shownTurned = turned.slice(-maxItems).reverse();
    const turnedList = shownTurned
      .map((p) => {
        const pr = getPrisonerPronouns(p.gender);
        if (isActiveMole(p)) {
          return `${p.name} (${p.grade} ${p.gender} [${pr.subject}/${pr.object}], Double Agent mole, ${p.moleRaidsLeft} raids left)`;
        }
        const detail =
          p.converted === 'guard'
            ? `Guard ${p.assignedFloor ?? '?'}F`
            : p.converted === 'pet'
              ? `Pet of ${p.owner === 'L' ? 'Lilim' : 'Vesper'}`
              : p.converted === 'hired'
                ? `Hired Staff (${p.job ?? 'idle'})`
                : p.converted;
        return `${p.name} (${p.grade} ${p.gender} [${pr.subject}/${pr.object}], ${detail})`;
      })
      .join('; ');
    lines.push(`[Turned heroes now serving the dungeon: ${turnedList}]`);
  }

  return lines.join('\n');
}

export function buildPrisonNarrateContext(
  state: GameState,
  p: Prisoner,
  actionTitle: string,
  outcomeProse: string
): string {
  const pr = getPrisonerPronouns(p.gender);
  const goreNote = state.settings.gore
    ? 'Graphic gore is ENABLED if violence/execution occurs.'
    : 'Graphic gore is DISABLED: keep harsh/fatal scenes dark and atmospheric without graphic mutilation.';
  return [
    `Prison Scene: ${actionTitle}`,
    `Captive: ${p.name} | Gender: ${p.gender} (MUST use ${pr.subject}/${pr.object}/${pr.possessive} pronouns) | Grade: ${p.grade} | Race/Class: ${p.raceLabel} ${p.classLabel}`,
    `State: ${getPrisonerTitle(p)} | Stamina ${p.stamina}/${p.staminaMax} | Resist ${p.resist}% | Pleasure ${p.pleasure} | Terror ${p.terror} | Shame ${p.shame} | Corr ${p.corr}`,
    `Marks: ${formatMarkCompact(p.marks)} | Traits: ${p.traits.join(', ') || 'none'}${p.afflictions.length > 0 ? ` | Afflictions: ${p.afflictions.join(', ')}` : ''}`,
    `Outcome to narrate: ${outcomeProse}`,
    `Tone rule: ${goreNote} Keep raw numeric UI percentages out of prose.`,
  ].join('\n');
}
