import { CFG, CLASSES, KINKS, LOOK, RACES, TRAITS } from '../data/constants';
import { CRISIS_CFG, EPIC_CFG, GM_NAMES, GRIT_BY_GRADE } from '../data/realmData';
import type { GameState, Hero, HeroGrade, NemesisRecord } from '../types/game';
import { assignPartyBondsAndStories, hasActiveRealmSituation } from './realm';
import { clamp, pickOne, pickWeighted } from './rng';

export function heroGradeIndex(g: HeroGrade): number {
  if (g === 'EPIC') return CFG.HERO_GRADES.length;
  return CFG.HERO_GRADES.indexOf(g);
}

export function getGuildLevel(state: GameState, wave: number): number {
  if (wave <= CFG.GUILD.EARLY_W) return 0;
  const pt = state.guildActive ? state.guildPoints : CFG.GUILD.START;
  return clamp(Math.floor(pt / 10), 0, 10);
}

export function getGuildTierInfo(wave: number, guildLv: number): { tag: string; desc: string } {
  if (wave <= CFG.GUILD.EARLY_W) {
    return { tag: 'ROOKIE', desc: 'green, overconfident novices on their first real contract' };
  }
  for (const t of CFG.GUILD.TIER) {
    if (guildLv <= t.maxLv) return { tag: t.tag, desc: t.desc };
  }
  return { tag: 'HUNTER SQUAD', desc: 'the best hunters the Guild can field' };
}

export function getThreatMod(state: GameState, wave: number): number {
  if (wave <= CFG.GUILD.EARLY_W) return CFG.GUILD.EARLY_THREAT;
  const lv = getGuildLevel(state, wave);
  let t = CFG.GUILD.THREAT[lv] ?? 0;
  if (wave > CFG.GUILD.LATE_FROM) {
    t += Math.min(CFG.GUILD.LATE_MAX, Math.floor((wave - CFG.GUILD.LATE_FROM) / CFG.GUILD.LATE_STEP));
  }
  return Math.min(CFG.GUILD.THREAT_MAX, t);
}

function shiftByMomentum(grade: HeroGrade, momentum: number): HeroGrade {
  if (momentum === 0) return grade;
  let idx = heroGradeIndex(grade);
  if (idx < 0) idx = 2; // 'C'
  const p = Math.min(CFG.MOMENTUM.STEP * Math.abs(momentum), CFG.MOMENTUM.CAP);
  const d = momentum > 0 ? 1 : -1;
  if (Math.random() < p) idx += d;
  if (Math.abs(momentum) >= CFG.MOMENTUM.DOUBLE && Math.random() < p / 2) idx += d;
  return CFG.HERO_GRADES[clamp(idx, 0, CFG.HERO_GRADES.length - 1)];
}

export function pickHeroGrade(state: GameState, wave: number): HeroGrade {
  const lv = getGuildLevel(state, wave);
  const base = CFG.GUILD.GRADE[lv] ?? CFG.GUILD.GRADE[0];
  const weights: Record<HeroGrade, number> = {
    F: base.F ?? 0,
    D: base.D ?? 0,
    C: base.C ?? 0,
    B: base.B ?? 0,
    A: base.A ?? 0,
    S: base.S ?? 0,
    SS: base.SS ?? 0,
    SSS: base.SSS ?? 0,
    EPIC: 0,
  };

  if (wave > CFG.GUILD.EARLY_W) {
    const f = clamp(state.fame, 0, CFG.FAME.MAX);
    const addTargets: [HeroGrade, number][] = [
      ['S', Math.floor((CFG.FAME.S * f) / 2)],
      ['A', Math.floor((CFG.FAME.A * f) / 2)],
    ];
    for (const [targetGrade, needStart] of addTargets) {
      let need = needStart;
      for (const src of ['F', 'D', 'C', 'B'] as HeroGrade[]) {
        if (need <= 0) break;
        const take = Math.min(weights[src], need);
        weights[src] -= take;
        weights[targetGrade] += take;
        need -= take;
      }
    }
    weights.SS += CFG.FAME.SS * Math.max(0, f - CFG.FAME.SS_FROM + 1);
    if (f >= CFG.FAME.SSS_FROM) {
      weights.SSS += CFG.FAME.SSS * (f - CFG.FAME.SSS_FROM + 1);
    }
  }

  const pick = pickWeighted(CFG.HERO_GRADES, (g) => weights[g]);
  const mom = wave <= CFG.GUILD.EARLY_W && state.momentum > 0 ? 0 : state.momentum;
  if (pick === 'F') {
    if (mom > 0 && Math.random() < Math.min(0.6, 0.15 * mom)) return 'D';
    return 'F';
  }
  return shiftByMomentum(pick, mom);
}

function allowedRaceCats(scope: GameState['settings']['raceScope']): Set<'h' | 'f' | 'm'> {
  if (scope === 'human') return new Set();
  if (scope === 'humanoid') return new Set(['h']);
  if (scope === 'fantasy') return new Set(['h', 'f']);
  return new Set(['h', 'f', 'm']);
}

function pickPartyRaces(state: GameState, wave: number, count: number) {
  const cats = allowedRaceCats(state.settings.raceScope);
  if (cats.size === 0) {
    const human = RACES[0];
    return Array.from({ length: count }, () => human);
  }
  const tierWeights =
    wave <= 3 ? [3, 1, 0] : wave <= 9 ? [3, 2, 0.5] : [3, 2, 1];
  if (wave % 10 === 0) tierWeights[2] *= 2;

  const pool = RACES.filter((r) => cats.has(r.cat));
  return Array.from({ length: count }, () =>
    pickWeighted(pool, (r) => tierWeights[r.tier - 1] ?? 1)
  );
}

function pickTraits(
  state: GameState,
  grade: HeroGrade,
  classBias: string[],
  raceBias: string[]
): string[] {
  const bias = new Set([...classBias, ...raceBias]);
  const needed = heroGradeIndex(grade) >= 5 ? 2 : 1; // S, SS, SSS get 2 traits
  const picked: string[] = [];
  const used = new Set<string>();

  while (picked.length < needed) {
    const chosen = pickWeighted(TRAITS, (t) => {
      if (used.has(t.key)) return 0;
      return (
        t.weight *
        (bias.has(t.key) ? 2 : 1) *
        (1 + (t.fearScale * state.fear) / 50) *
        (1 + (t.lustScale * state.lust) / 50)
      );
    });
    used.add(chosen.key);
    picked.push(chosen.key);
  }
  return picked;
}

function pickGender(pref: GameState['settings']['genderPref']): 'female' | 'male' {
  if (pref === 'female' || pref === 'male') return pref;
  return Math.random() < 0.5 ? 'female' : 'male';
}

function rollExp(traits: string[], ageLabel: string): Hero['exp'] {
  if (traits.includes('pure')) return 'virgin';
  const mult: Record<Hero['exp'], number> = { virgin: 1, some: 1, many: 1 };
  if (traits.includes('cleric') || traits.includes('ascetic')) mult.virgin = 2;
  if (traits.includes('lewd')) {
    mult.virgin = 0.3;
    mult.many = 2;
  }
  if (traits.includes('masochist')) mult.many *= 1.5;
  if (ageLabel.includes('30') || ageLabel.includes('40')) {
    mult.many *= 1.5;
    mult.virgin *= 0.6;
  }
  const list: { key: Hero['exp']; w: number }[] = [
    { key: 'virgin', w: 25 * mult.virgin },
    { key: 'some', w: 45 * mult.some },
    { key: 'many', w: 30 * mult.many },
  ];
  return pickWeighted(list, (x) => x.w).key;
}

function rollMarital(traits: string[], ageLabel: string): Hero['marital'] {
  const mult: Record<Hero['marital'], number> = { single: 1, engaged: 1, married: 1, widowed: 1 };
  if (ageLabel.includes('30') || ageLabel.includes('40')) mult.married = 2;
  if (traits.includes('noble')) mult.engaged = 2;
  const list: { key: Hero['marital']; w: number }[] = [
    { key: 'single', w: 68 * mult.single },
    { key: 'engaged', w: 9 * mult.engaged },
    { key: 'married', w: 18 * mult.married },
    { key: 'widowed', w: 5 * mult.widowed },
  ];
  return pickWeighted(list, (x) => x.w).key;
}

export function promoteHeroToEpic(
  base: Hero,
  kind: 'grandmaster' | 'nemesis',
  nemesis?: NemesisRecord
): Hero {
  const secondTypes = ['I', 'A', 'W'];
  const secType = secondTypes[(base.slot + (nemesis?.escapedWave ?? 0)) % secondTypes.length];
  if (kind === 'grandmaster') {
    const gmName = pickOne([...GM_NAMES]);
    return {
      ...base,
      grade: 'EPIC',
      classKey: 'paladin',
      classLabel: base.gender === 'male' ? 'Grand Paladin' : 'Grand Lady Paladin',
      traits: Array.from(new Set(['faithful', 'brave', ...base.traits])).slice(0, 3),
      name: gmName,
      epic: true,
      epicKind: 'grandmaster',
      epicLabel: 'CRUSADE GRAND MASTER',
      aura: EPIC_CFG.AURA,
      noRetreat: true,
      guarded: true,
      secondType: secType,
      grit: GRIT_BY_GRADE.EPIC,
      maxGrit: GRIT_BY_GRADE.EPIC,
    };
  }
  const n = nemesis;
  return {
    ...base,
    grade: 'EPIC',
    classKey: n?.classKey ?? base.classKey,
    raceKey: n?.raceKey ?? base.raceKey,
    gender: n?.gender ?? base.gender,
    traits: n?.traits?.length ? [...n.traits] : [...base.traits],
    name: n?.name ?? base.name,
    epic: true,
    epicKind: 'nemesis',
    epicLabel: 'LEGENDARY NEMESIS',
    nemesisId: n?.id,
    nemesisSignatures: n?.signatures ? [...n.signatures] : [],
    adaptedTags: n?.adaptedTags ? [...n.adaptedTags] : [],
    aura: EPIC_CFG.AURA,
    noRetreat: true,
    guarded: true,
    secondType: secType,
    grit: GRIT_BY_GRADE.EPIC,
    maxGrit: GRIT_BY_GRADE.EPIC,
  };
}

export function generateParty(
  state: GameState,
  wave: number,
  rng: () => number = Math.random
): {
  party: Hero[];
  recentHeroSignatures: { hair: string; persona: string }[];
  triggeredNemesisId?: string;
} {
  const races = pickPartyRaces(state, wave, 3);
  const usedClasses = new Set<string>();
  const recentHair = new Set(state.recentHeroSignatures.map((r) => r.hair));
  const recentPersona = new Set(state.recentHeroSignatures.map((r) => r.persona));
  const nextSignatures = [...state.recentHeroSignatures];

  const crusadeActive = state.crises.crusade.active;
  const academyActive = Boolean(hasActiveRealmSituation(state, 'academy', wave));

  let grades: HeroGrade[] = [
    pickHeroGrade(state, wave),
    pickHeroGrade(state, wave),
    pickHeroGrade(state, wave),
  ];

  // Crusade waves send elite SS/SSS crusaders
  if (crusadeActive) {
    grades = grades.map((_, idx) => (idx === 0 || rng() < 0.5 ? 'SSS' : 'SS'));
  } else if (wave % 10 === 0) {
    // Hunt Captain promotion every 10th wave (matching Lua line 5585)
    let topIdx = 0;
    for (let i = 1; i < 3; i++) {
      if (heroGradeIndex(grades[i]) > heroGradeIndex(grades[topIdx])) topIdx = i;
    }
    const bossGrade: HeroGrade = wave >= 20 && rng() < 0.5 ? 'SSS' : 'SS';
    if (heroGradeIndex(grades[topIdx]) < heroGradeIndex(bossGrade)) {
      grades[topIdx] = bossGrade;
    }
  }

  // Realm: Academy drops non-EPIC hero grades by 1 tier
  if (academyActive && !crusadeActive) {
    grades = grades.map((g) => {
      if (g === 'EPIC') return g;
      const idx = heroGradeIndex(g);
      return idx > 0 ? CFG.HERO_GRADES[idx - 1] : g;
    });
  }

  let party: Hero[] = ([1, 2, 3] as const).map((slot, idx) => {
    const grade = grades[idx];
    const gender = pickGender(state.settings.genderPref);
    const race = races[idx];
    const classPool = crusadeActive
      ? CLASSES.filter((c) => c.key === 'paladin' || c.key === 'cleric' || c.key === 'knight')
      : CLASSES.filter((c) => !usedClasses.has(c.key));
    const cls = pickOne(classPool.length > 0 ? classPool : CLASSES, rng);
    usedClasses.add(cls.key);

    const traits = pickTraits(state, grade, cls.biasTraits, race.biasTraits);
    const kink = pickOne(KINKS, rng);

    const ageObj = pickWeighted(LOOK.AGE, (a) => a.weight);
    const htKey = String(clamp(race.heightOffset + (Math.floor(rng() * 3) - 1), -1, 2));
    const buildKey =
      race.buildPref && rng() >= 0.35 ? race.buildPref : pickOne(LOOK.BUILDS, rng);
    const buildDesc = (gender === 'male' ? LOOK.BUILD_M : LOOK.BUILD_F)[buildKey] ?? 'athletic';

    const bodyParts = [LOOK.HEIGHT[htKey], buildDesc];
    if (gender === 'male') {
      bodyParts.push(race.key === 'dwarf' ? 'a braided beard' : pickOne(LOOK.BEARD, rng));
    } else {
      const bustObj = pickWeighted(LOOK.BUST, (b) => {
        let w = b.weight;
        if ((buildKey === 'voluptuous' || buildKey === 'curvy') && b.size === 'big') w *= 1.6;
        if ((buildKey === 'lithe' || buildKey === 'slender' || buildKey === 'athletic') && b.size === 'small') w *= 1.4;
        return w;
      });
      bodyParts.push(bustObj.label, pickOne(LOOK.HIPS, rng));
    }

    const skinPool = LOOK.SKIN[race.skinGroup] ?? LOOK.SKIN.any;
    const hairColor = pickWeighted(LOOK.HAIR_C, (c) => (recentHair.has(c) ? 0.3 : 1));
    const hairStyle = pickOne(gender === 'male' ? LOOK.HAIR_M : LOOK.HAIR_F, rng);
    const eye = rng() < 0.03 ? 'heterochromatic' : pickOne(LOOK.EYES, rng);
    const mark = pickOne(LOOK.MARK, rng);
    const looks = `${pickOne(skinPool, rng)} skin, ${hairColor} hair in ${hairStyle}, ${eye} eyes, ${mark}${
      race.feature ? `, ${race.feature}` : ''
    }`;

    const bannedPersonas = new Set<string>();
    for (const tr of traits) {
      for (const b of LOOK.PERSONA_BAN[tr] ?? []) bannedPersonas.add(b);
    }
    const persona = pickWeighted(LOOK.PERSONA, (p) => {
      if (bannedPersonas.has(p)) return 0;
      return recentPersona.has(p) ? 0.3 : 1;
    });
    const origin = pickOne(LOOK.ORIGIN, rng);
    const exp = rollExp(traits, ageObj.label);
    const marital = rollMarital(traits, ageObj.label);

    nextSignatures.push({ hair: hairColor, persona });

    const maxGrit = GRIT_BY_GRADE[grade];
    return {
      slot,
      grade,
      status: 'pending',
      gender,
      classKey: cls.key,
      classLabel: gender === 'male' ? cls.labelM : cls.labelF,
      raceKey: race.key,
      raceLabel: race.label,
      traits,
      kinkKey: kink.key,
      kinkDesc: kink.desc,
      age: `${ageObj.label}, adult`,
      body: bodyParts.join(', '),
      looks,
      persona,
      origin,
      exp,
      marital,
      intel: 0,
      name: `Hero #${slot}`,
      appearance: '',
      outfit: cls.outfit,
      personalityText: '',
      skill: '',
      weakness: '',
      kinkText: '',
      cond: '',
      ailment: 0,
      aroused: false,
      usedLuck: false,
      injIgnored: false,
      lastRollText: '',
      ...(maxGrit ? { grit: maxGrit, maxGrit } : {}),
    };
  });

  let triggeredNemesisId: string | undefined;
  if (crusadeActive && state.crises.crusade.wavesLeft <= 1) {
    party[0] = promoteHeroToEpic(party[0], 'grandmaster');
  } else if (!crusadeActive && wave >= CRISIS_CFG.WRATH_FROM && state.crises.nemesis.length > 0) {
    const since = Math.max(0, wave - (state.crises.lastNemesisWave ?? wave - 1));
    const nemChance = Math.min(
      EPIC_CFG.NEM_MAX,
      EPIC_CFG.NEM_BASE +
        EPIC_CFG.NEM_STEP * Math.max(0, since - 1) +
        (state.crises.nemesis.length > 0 ? EPIC_CFG.NEM_EXIST : 0)
    );
    if (rng() < nemChance) {
      const nem = pickOne(state.crises.nemesis, rng);
      triggeredNemesisId = nem.id;
      party[0] = promoteHeroToEpic(party[0], 'nemesis', nem);
    }
  }

  party = assignPartyBondsAndStories(party, wave, rng);

  while (nextSignatures.length > 9) nextSignatures.shift();

  return { party, recentHeroSignatures: nextSignatures, ...(triggeredNemesisId ? { triggeredNemesisId } : {}) };
}
