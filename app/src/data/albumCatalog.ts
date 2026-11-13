import {
  NPC_ASSETS,
  SCENE_ASSETS,
  SCENE_ASSET_ALIASES,
  assetUrl,
  resolveSceneAsset,
  resolveSceneAssetKey,
} from './assetManifest';

export type AlbumCategory = 'P' | 'D' | 'T' | 'J' | 'N' | 'S' | 'X';

export interface AlbumSubcategoryDef {
  id: string;
  label: string;
}

export interface AlbumCategoryDef {
  id: AlbumCategory;
  shortLabel: string;
  label: string;
  subs: readonly AlbumSubcategoryDef[];
}

export interface AlbumEntry {
  id: string;
  key: string;
  resolvedKey: string;
  url: string;
  cat: AlbumCategory;
  sub: string;
  title: string;
  hint: string;
  isMaleVariant: boolean;
  baseKey: string;
  isAlias: boolean;
  source: 'scene' | 'npc';
}

export const ALBUM_CATEGORIES: readonly AlbumCategoryDef[] = [
  {
    id: 'P',
    shortLabel: 'P: Officers',
    label: 'Officers & Portraits',
    subs: [
      { id: 'V', label: 'Vesper' },
      { id: 'L', label: 'Lilim' },
      { id: 'E', label: 'Eleonora' },
      { id: 'sprites', label: 'Expression Sprites' },
    ],
  },
  {
    id: 'D',
    shortLabel: 'D: Debt',
    label: 'Goldreich Debt Collection',
    subs: [
      { id: 'visit', label: 'Collection Visit' },
      { id: 'payment', label: 'Payments & Extensions' },
      { id: 'quest', label: 'Quests & Ent.' },
      { id: 'seizure', label: 'Late & Seizure' },
    ],
  },
  {
    id: 'T',
    shortLabel: 'T: Estate',
    label: 'Estate, Crises & War',
    subs: [
      { id: 'act', label: 'Town Actions' },
      { id: 'fac', label: 'Facilities & Landmarks' },
      { id: 'evt', label: 'Town Events' },
      { id: 'sev', label: 'Settlement Crises' },
      { id: 'ex', label: 'Explore Locations' },
      { id: 'town', label: 'Domain Levels' },
      { id: 'cr', label: 'Major Crises' },
      { id: 'war', label: 'Rival War' },
    ],
  },
  {
    id: 'J',
    shortLabel: 'J: Prison',
    label: 'Prison, Training & Raid CG',
    subs: [
      { id: 'train', label: 'Train' },
      { id: 'shame', label: 'Shame' },
      { id: 'fear', label: 'Fear & Torture' },
      { id: 'soft', label: 'Soften' },
      { id: 'use', label: 'Exploit' },
      { id: 'dark', label: 'Dark Arts' },
      { id: 'fate', label: 'Disposition' },
      { id: 'job', label: 'Town Jobs' },
      { id: 'mark', label: 'Brands & Marks' },
      { id: 'pr', label: 'Conversions' },
      { id: 'raid', label: 'Raid & EPIC CG' },
    ],
  },
  {
    id: 'N',
    shortLabel: 'N: Endings',
    label: 'Endings, Game Overs & Rank',
    subs: [
      { id: 'end', label: 'Canonical Endings' },
      { id: 'go', label: 'Game Overs' },
      { id: 'rank', label: 'Rank Trials' },
    ],
  },
  {
    id: 'S',
    shortLabel: 'S: Cards',
    label: 'Openings, Phase Cards & Floors',
    subs: [
      { id: 'open', label: 'Opening' },
      { id: 'sd', label: 'Phase Cards' },
      { id: 'fl', label: 'Floor Combat' },
    ],
  },
  {
    id: 'X',
    shortLabel: 'X: Expedition',
    label: 'Expeditions & Regions',
    subs: [
      { id: 'road', label: 'Depart & Return' },
      { id: 'fight', label: 'Encounters' },
      { id: 'camp', label: 'Camp' },
      { id: 'arrive', label: 'Destinations' },
      { id: 'region', label: 'Regions' },
    ],
  },
] as const;

const SCENE_TITLE_OVERRIDES: Record<string, [string, string]> = {
  // Officers
  dk_pt_v: ['Vesper Portrait (Stage 0-1)', 'Default officer portrait'],
  dk_pt_v_2: ['Vesper Portrait (Stage 2)', 'Affinity Stage 2+'],
  dk_pt_v_3: ['Vesper Portrait (Stage 3)', 'Affinity Stage 3+'],
  dk_pt_v_4: ['Vesper Portrait (Stage 4)', 'Affinity Stage 4+'],
  dk_pt_l: ['Lilim Portrait (Stage 0-1)', 'Default officer portrait'],
  dk_pt_l_2: ['Lilim Portrait (Stage 2)', 'Affinity Stage 2+'],
  dk_pt_l_3: ['Lilim Portrait (Stage 3)', 'Affinity Stage 3+'],
  dk_pt_l_4: ['Lilim Portrait (Stage 4)', 'Affinity Stage 4+'],
  dk_pt_e: ['Eleonora Portrait (Stage 0-1)', 'Default officer portrait'],
  dk_pt_e_2: ['Eleonora Portrait (Stage 2)', 'Affinity Stage 2+'],
  dk_pt_e_3: ['Eleonora Portrait (Stage 3)', 'Affinity Stage 3+'],
  dk_pt_e_4: ['Eleonora Portrait (Stage 4)', 'Affinity Stage 4+'],
  dk_pt_e_5: ['Eleonora Portrait (Stage 5)', 'Affinity Stage 5'],
  dk_stage_e3: ['Eleonora Stage 3 Milestone (Alias)', 'Alias -> dk_int_e5'],
  // Endings & Game Overs
  dk_end_romance: ['Romance Ending', 'Debt cleared with Eleonora Aff >= 90'],
  dk_end_dowry: ['Dowry Romance Ending (E10)', 'Contract torn as dowry at Debt <= 600'],
  dk_end_liberation: ['Liberation Ending', 'Debt cleared with Eleonora Aff < 90'],
  dk_end_prosperity: ['Prosperity Ending', 'Town upgraded to Level 5 (Debt stays active)'],
  dk_end_bankrupt: ['Bankruptcy Ending', '3 Late Strikes foreclosure'],
  dk_go_ruin: ['Game Over: Ruin', 'Town population dropped to 0'],
  dk_go_famine: ['Game Over: Famine', '3 consecutive waves at 0 food'],
  dk_go_riot: ['Game Over: Guillotine Riot', '3 consecutive waves of low Order & Approval'],
  dk_go_core: ['Game Over: Core Shattered', 'Breach with 0 Core MP & < 50 Vault MP'],
  dk_go_bankrupt: ['Game Over: Bankrupt', '3 Late Strikes on Goldreich debt'],
  dk_rank_up: ['Demon Lord Rank Up', 'Cleared an Endless Rank Trial'],
  // Aliases
  dk_fl_fighter: ['Captive Fighter Floor (Alias)', 'Alias -> dk_fl_display'],
  dk_act_granary: ['Buy Grain Action (Alias)', 'Alias -> dk_fac_farmland'],
  dk_fac_torture: ['Torture Chamber (Alias)', 'Alias -> dk_fac_annex'],
  dk_war_raid: ['Rival War Raid (Alias)', 'Alias -> dk_exd_raid'],
  dk_exr_hotspring: ['Region: Hotspring (Alias)', 'Alias -> dk_exr_road'],
  dk_exr_market: ['Region: Market (Alias)', 'Alias -> dk_exd_village'],
  dk_base_load: ['Save Restored Card (Alias)', 'Alias -> dk_base_cont'],
};

const PA_SUB_MAP: Record<string, string> = {
  train: 'train',
  serve: 'train',
  care: 'train',
  tool: 'train',
  bind: 'train',
  drug: 'train',
  milk: 'train',
  show: 'shame',
  walk: 'shame',
  display: 'shame',
  pair: 'shame',
  public: 'shame',
  whip: 'fear',
  threat: 'fear',
  int_ok: 'fear',
  int_fail: 'fear',
  tort: 'fear',
  tort_death: 'fear',
  feed: 'soft',
  talk: 'soft',
  reward: 'soft',
  rest: 'soft',
  work: 'use',
  gift: 'use',
  dress: 'use',
  sell: 'fate',
  exec: 'fate',
  free: 'fate',
  auction: 'fate',
};

function formatKeyTitle(key: string): string {
  const clean = key
    .replace(/^dk_/, '')
    .replace(/_m$/, ' (Male)')
    .replace(/_/g, ' ');
  return clean.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function classifySceneKey(key: string): { cat: AlbumCategory; sub: string; hint: string } {
  const norm = key.trim().toLowerCase();
  const base = norm.endsWith('_m') ? norm.slice(0, -2) : norm;

  // P: Officers
  if (/^dk_(pt|stage|int|time|gift|duo)_([vle])/.test(base)) {
    const match = base.match(/^dk_(?:pt|stage|int|time|gift|duo)_([vle])/);
    const sub = match ? match[1].toUpperCase() : 'V';
    return { cat: 'P', sub, hint: 'Officer Portrait / Interaction' };
  }

  // D: Debt
  if (base.startsWith('dk_debt_')) {
    const tail = base.slice('dk_debt_'.length);
    if (tail === 'intro') return { cat: 'D', sub: 'visit', hint: 'Debt Collection Visit' };
    if (['ontime', 'extra', 'prepay', 'ext', 'forgive'].includes(tail)) {
      return { cat: 'D', sub: 'payment', hint: 'Debt Payment & Extension' };
    }
    if (['newquest', 'quest_ok', 'quest_fail', 'ent_ok', 'ent_fail'].includes(tail)) {
      return { cat: 'D', sub: 'quest', hint: 'Debt Quest & Entertainment' };
    }
    return { cat: 'D', sub: 'seizure', hint: 'Late Penalty & Seizure' };
  }

  // N: Endings / Game Overs / Rank Trials
  if (base.startsWith('dk_end_')) return { cat: 'N', sub: 'end', hint: 'Canonical Ending' };
  if (base.startsWith('dk_go_')) return { cat: 'N', sub: 'go', hint: 'Game Over' };
  if (base.startsWith('dk_rank_')) return { cat: 'N', sub: 'rank', hint: 'Endless Rank Trial' };

  // S: Cards & Floors
  if (base.startsWith('dk_open_')) return { cat: 'S', sub: 'open', hint: 'Opening Scene' };
  if (base.startsWith('dk_base_')) return { cat: 'S', sub: 'sd', hint: 'Phase Narration Card' };
  if (base.startsWith('dk_fl_')) return { cat: 'S', sub: 'fl', hint: 'Dungeon Floor Combat' };

  // X: Expedition
  if (base.startsWith('dk_exr_')) return { cat: 'X', sub: 'region', hint: 'Expedition Region' };
  if (base.startsWith('dk_exd_')) {
    const tail = base.slice('dk_exd_'.length);
    if (['depart', 'return', 'flee', 'lost'].includes(tail)) {
      return { cat: 'X', sub: 'road', hint: 'Expedition Transit' };
    }
    if (['battle', 'ambush'].includes(tail)) {
      return { cat: 'X', sub: 'fight', hint: 'Expedition Combat' };
    }
    if (tail === 'camp') return { cat: 'X', sub: 'camp', hint: 'Expedition Camp' };
    return { cat: 'X', sub: 'arrive', hint: 'Expedition Destination' };
  }

  // T: Estate, Crises & War
  if (base.startsWith('dk_act_')) return { cat: 'T', sub: 'act', hint: 'Estate Town Action' };
  if (base.startsWith('dk_fac_')) return { cat: 'T', sub: 'fac', hint: 'Facility / Landmark' };
  if (base.startsWith('dk_evt_')) return { cat: 'T', sub: 'evt', hint: 'Estate Event' };
  if (base.startsWith('dk_sev_')) return { cat: 'T', sub: 'sev', hint: 'Settlement Crisis' };
  if (base.startsWith('dk_ex_')) return { cat: 'T', sub: 'ex', hint: 'Explore Town Event' };
  if (base.startsWith('dk_town_')) return { cat: 'T', sub: 'town', hint: 'Domain Town Level' };
  if (base.startsWith('dk_cr_')) return { cat: 'T', sub: 'cr', hint: 'Major Crisis' };
  if (base.startsWith('dk_war_')) return { cat: 'T', sub: 'war', hint: 'Rival Territory War' };

  // J: Prison & Raid CG
  if (base.startsWith('dk_pa_')) {
    const tail = base.slice('dk_pa_'.length);
    return { cat: 'J', sub: PA_SUB_MAP[tail] ?? 'train', hint: 'Prison Action' };
  }
  if (base.startsWith('dk_dark_')) return { cat: 'J', sub: 'dark', hint: 'Dark Prison Action' };
  if (base.startsWith('dk_job_')) return { cat: 'J', sub: 'job', hint: 'Prison Town Job' };
  if (base.startsWith('dk_mark_')) return { cat: 'J', sub: 'mark', hint: 'Prisoner Mark' };
  if (base.startsWith('dk_pr_')) return { cat: 'J', sub: 'pr', hint: 'Prisoner Conversion' };
  if (base.startsWith('dk_raid_') || base.startsWith('dk_epic_')) {
    return { cat: 'J', sub: 'raid', hint: 'Raid & EPIC Capture CG' };
  }

  return { cat: 'S', sub: 'sd', hint: 'Scene Asset' };
}

function buildCatalog(): AlbumEntry[] {
  const entries: AlbumEntry[] = [];

  // 1. All 348 bundled SCENE_ASSETS
  for (const [key, url] of Object.entries(SCENE_ASSETS)) {
    const isMaleVariant = key.endsWith('_m');
    const baseKey = isMaleVariant ? key.slice(0, -2) : key;
    const { cat, sub, hint } = classifySceneKey(key);
    const override = SCENE_TITLE_OVERRIDES[key];

    entries.push({
      id: `scene:${key}`,
      key,
      resolvedKey: key,
      url: assetUrl(url),
      cat,
      sub,
      title: override?.[0] ?? formatKeyTitle(key),
      hint: override?.[1] ?? (isMaleVariant ? `Male Variant · ${hint}` : hint),
      isMaleVariant,
      baseKey,
      isAlias: false,
      source: 'scene',
    });
  }

  // 2. Explicit Alias / Expansion fallback keys so every Lua/data key is discoverable
  const explicitAliasKeys = [
    'dk_stage_e3',
    'dk_fl_fighter',
    'dk_act_granary',
    'dk_fac_torture',
    'dk_war_raid',
    'dk_exr_hotspring',
    'dk_exr_market',
    'dk_base_load',
  ];
  for (const aliasKey of explicitAliasKeys) {
    if (SCENE_ASSETS[aliasKey]) continue;
    const resolvedKey = resolveSceneAssetKey(aliasKey);
    const url = resolveSceneAsset(aliasKey);
    if (!resolvedKey || !url) continue;
    const { cat, sub, hint } = classifySceneKey(aliasKey);
    const override = SCENE_TITLE_OVERRIDES[aliasKey];
    entries.push({
      id: `alias:${aliasKey}`,
      key: aliasKey,
      resolvedKey,
      url,
      cat,
      sub,
      title: override?.[0] ?? `${formatKeyTitle(aliasKey)} (Alias)`,
      hint: override?.[1] ?? `Alias -> ${resolvedKey} (${hint})`,
      isMaleVariant: false,
      baseKey: aliasKey,
      isAlias: true,
      source: 'scene',
    });
  }

  // 3. Deduped NPC Expression Sprites under P -> sprites
  for (const officer of ['vesper', 'lilim', 'eleonora'] as const) {
    const seenUrls = new Set<string>();
    const map = NPC_ASSETS[officer];
    const officerTitle = officer[0].toUpperCase() + officer.slice(1);
    for (const [expr, url] of Object.entries(map)) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const cleanExpr = expr.replace(/_/g, ' ');
      entries.push({
        id: `npc:${officer}:${cleanExpr}`,
        key: `${officer}_${cleanExpr.replace(/\s+/g, '_')}`,
        resolvedKey: `${officer}_${cleanExpr}`,
        url: assetUrl(url),
        cat: 'P',
        sub: 'sprites',
        title: `${officerTitle}: ${cleanExpr.replace(/\b\w/g, (c) => c.toUpperCase())}`,
        hint: `${officerTitle} Portrait / CG Sprite`,
        isMaleVariant: false,
        baseKey: `${officer}_${cleanExpr}`,
        isAlias: false,
        source: 'npc',
      });
    }
  }

  return entries;
}

export const ALBUM_CATALOG: readonly AlbumEntry[] = buildCatalog();

export function getPairedVariantEntry(entry: AlbumEntry): AlbumEntry | undefined {
  if (entry.source !== 'scene' || entry.isAlias) return undefined;
  const targetKey = entry.isMaleVariant ? entry.baseKey : `${entry.baseKey}_m`;
  if (!SCENE_ASSETS[targetKey]) return undefined;
  return ALBUM_CATALOG.find((item) => item.key === targetKey && !item.isAlias);
}

export function getAlbumEntriesForCategory(
  cat: AlbumCategory,
  sub = 'all',
  variant: 'all' | 'base' | 'male' = 'all',
): AlbumEntry[] {
  return ALBUM_CATALOG.filter((entry) => {
    if (entry.cat !== cat) return false;
    if (sub !== 'all' && entry.sub !== sub) return false;
    if (variant === 'male' && !entry.isMaleVariant) return false;
    if (variant === 'base' && entry.isMaleVariant) return false;
    return true;
  });
}

export function getAllSceneAliasKeys(): string[] {
  return Object.keys(SCENE_ASSET_ALIASES);
}
