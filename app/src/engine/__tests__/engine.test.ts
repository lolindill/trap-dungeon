import { describe, expect, it, vi, afterEach } from 'vitest';
import { STARTER_BLUEPRINTS } from '../../data/starterBlueprints';
import { assetUrl, resolveNpcImage, resolveSceneAsset } from '../../data/assetManifest';
import {
  buildPrepListPayload,
  getFloorDC,
  getInstallCost,
  installBlueprintToFloor,
  installCustomTrap,
  removeTrapFromFloor,
  renameTrapOnFloor,
  upgradeTrapOnFloor,
} from '../dungeon';
import { generateParty, getGuildLevel } from '../heroes';
import { advanceRaidStep } from '../raid';
import { createInitialGameState } from '../saveLoad';
import {
  applyPrepReply,
  parseSingleBlueprintEval,
  splitRichSegments,
  stripSystemTagsForDisplay,
} from '../tagParser';
import {
  buildBlueprintEvalMessages,
  buildOfficerChatMessages,
  buildPrepMessages,
  buildRaidMessages,
  buildSystemPrompt,
} from '../../llm/promptBuilder';
import {
  cancelPrepBackToBuild,
  finishBuildPhase,
  finishSettlementToNextBuild,
  startInvasionPhase,
} from '../workflow';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assetManifest resolution', () => {
  it('resolves exact NPC expressions and underscores', () => {
    expect(resolveNpcImage('lilim', 'smug')).toBe('/assets/other/image/Lilim_smug.webp.webp');
    expect(resolveNpcImage('vesper', 'crying_with_eyes_closed')).toBe(
      '/assets/other/image/Vesper_crying with eyes closed.webp.webp'
    );
    expect(resolveSceneAsset('dk_base_raid_wipe')).toBe('/assets/other/image/dk_base_raid_wipe.webp.webp');
  });

  it('normalizes subpath BASE_URL idempotently via assetUrl', () => {
    expect(assetUrl('/assets/icon/image/main.png', '/')).toBe('/assets/icon/image/main.png');
    expect(assetUrl('/assets/icon/image/main.png', '/trap-dun/')).toBe('/trap-dun/assets/icon/image/main.png');
    expect(assetUrl('assets/other/image/dk_open_1.webp.webp', '/trap-dun')).toBe(
      '/trap-dun/assets/other/image/dk_open_1.webp.webp'
    );
    expect(assetUrl('/trap-dun/assets/icon/image/main.png', '/trap-dun/')).toBe(
      '/trap-dun/assets/icon/image/main.png'
    );
    expect(assetUrl('https://example.com/a.png', '/trap-dun/')).toBe('https://example.com/a.png');
  });
});

describe('dungeon building & Trap Blueprint Shortcuts', () => {
  it('installs custom traps with escalating slot costs and supports upgrade/rename/refund', () => {
    let state = createInitialGameState(); // 110 MP
    expect(getInstallCost(0)).toBe(50);
    expect(getInstallCost(1)).toBe(120);

    const r1 = installCustomTrap(state, 1, 'Oil-slick spike corridor');
    expect(r1.ok).toBe(true);
    state = r1.state;
    expect(state.points).toBe(60);
    expect(state.floors[0].slots[0].grade).toBe('?');

    // Rename trap
    const rRename = renameTrapOnFloor(state, 1, 0, 'Updated razor corridor');
    expect(rRename.ok).toBe(true);
    state = rRename.state;
    expect(state.floors[0].slots[0].text).toBe('Updated razor corridor');

    // Cannot upgrade an ungraded '?' trap yet
    const cannotUpgUnrated = upgradeTrapOnFloor(state, 1, 0);
    expect(cannotUpgUnrated.ok).toBe(false);

    // Dismantle refunds 50% (floor(50 * 0.5) = 25)
    const rRem = removeTrapFromFloor(state, 1, 0);
    expect(rRem.ok).toBe(true);
    expect(rRem.state.points).toBe(60 + 25);
  });

  it('installs pre-rated Trap Blueprint Shortcut without queuing it for LLM re-grading', () => {
    let state = { ...createInitialGameState(), points: 500 };
    const preRated = STARTER_BLUEPRINTS.find((b) => b.grade !== '?')!;
    expect(preRated).toBeDefined();

    const res = installBlueprintToFloor(state, 2, preRated);
    expect(res.ok).toBe(true);
    state = res.state;
    expect(state.floors[1].slots[0].grade).toBe(preRated.grade);
    expect(state.floors[1].slots[0].blueprintId).toBe(preRated.id);

    // Since only 1 trap is installed and it is pre-rated, newTrapIds and comboFloors are empty!
    const prepPayload = buildPrepListPayload(state.floors);
    expect(prepPayload.newTrapIds).toEqual([]);
    expect(prepPayload.comboFloors).toEqual([]);

    // Adding a second trap marks the room synergy as '?' for combo grading
    const res2 = installBlueprintToFloor(state, 2, STARTER_BLUEPRINTS[1]);
    expect(res2.ok).toBe(true);
    const prepPayload2 = buildPrepListPayload(res2.state.floors);
    expect(prepPayload2.comboFloors).toEqual([2]);
  });

  it('calculates Floor DC combining floor base, slot grades, and combo synergy', () => {
    let state = createInitialGameState();
    const bp = { ...STARTER_BLUEPRINTS[0], grade: 'B' as const };
    state = installBlueprintToFloor(state, 1, bp).state;
    const baseDc = getFloorDC(state.floors[0]);
    expect(baseDc).toBeGreaterThanOrEqual(8);
  });
});

describe('tagParser & prep quota enforcement', () => {
  it('enforces 1 S and 2 A quota on newly graded traps and parses heroes + eval', () => {
    let state = { ...createInitialGameState(), points: 500 };
    state = installCustomTrap(state, 1, 'Trap A').state;
    state = installCustomTrap(state, 1, 'Trap B').state;
    state = installCustomTrap(state, 2, 'Trap C').state;
    state = installCustomTrap(state, 3, 'Trap D').state;
    state = finishBuildPhase(state);

    const mockLlmReply = `
      "Fufufu, let's see what you built!" <img="lilim_smug">
      <trap id="1-1" grade="S" type="erotic,restraint"/>
      <trap id="1-2" grade="S" type="magic"/>
      <trap id="2-1" grade="A" type="physical"/>
      <trap id="3-1" grade="A" type="ailment"/>
      <room floor="1" synergy="A"/>
      <eval effectiveness="8" novelty="7" fun="9" aesthetics="8" lewdness="6" overall="S"/>
      <hero n="1">
      name: Rowan
      appearance: Tall scarred swordsman
      outfit: Dented breastplate
      personality: Stubborn
      skill: Shield Bash
      weakness: Overconfident
      kink: Bound helplessness
      </hero>
      <hero n="2">
      name: Lyra
      appearance: Silver-haired ranger
      outfit: Hooded leather
      personality: Suspicious
      skill: Wire Detection
      weakness: Claustrophobia
      kink: Aphrodisiac mist
      </hero>
      <hero n="3">
      name: Elena
      appearance: Young acolyte
      outfit: White vestments
      personality: Devout
      skill: Lesser Heal
      weakness: Easily flustered
      kink: Public humiliation
      </hero>
    `;

    const parsed = applyPrepReply(state, mockLlmReply);
    expect(parsed.heroCount).toBe(3);
    // First S gets S, second S capped to A
    expect(parsed.state.floors[0].slots[0].grade).toBe('S');
    expect(parsed.state.floors[0].slots[1].grade).toBe('A');
    // Only 1 A slot remains -> 2-1 gets A, 3-1 capped to B
    expect(parsed.state.floors[1].slots[0].grade).toBe('A');
    expect(parsed.state.floors[2].slots[0].grade).toBe('B');
    expect(parsed.state.floors[0].synergy).toBe('A');
    expect(parsed.state.evalScores?.overall).toBe('S');
    expect(parsed.state.evalScores?.bonusMp).toBe(80);
    expect(parsed.state.party[0].name).toBe('Rowan');
    expect(parsed.state.prepMeta?.heroesReady).toBe(true);

    const stripped = stripSystemTagsForDisplay(mockLlmReply);
    expect(stripped).not.toContain('<trap');
    expect(stripped).not.toContain('<hero');

    const segs = splitRichSegments(stripped);
    expect(segs.some((s) => s.kind === 'img' && s.character === 'lilim' && s.keyword === 'smug')).toBe(
      true
    );
  });

  it('parses blueprint audit tags cleanly', () => {
    const res = parseSingleBlueprintEval(
      'Deliciously wicked design! <eval_blueprint grade="A" types="erotic,restraint,ailment" notes="Great choke point snare"/>'
    );
    expect(res.grade).toBe('A');
    expect(res.types).toEqual(['erotic', 'restraint', 'ailment']);
    expect(res.notes).toBe('Great choke point snare');
  });
});

describe('workflow transitions, hero generation, and raid resolution', () => {
  it('supports Prep -> Back to Build restoring pending grades', () => {
    let state = createInitialGameState();
    state = installCustomTrap(state, 1, 'Pitfall').state;
    state = finishBuildPhase(state);
    expect(state.mode).toBe('prep');
    expect(state.party).toHaveLength(3);

    const reverted = cancelPrepBackToBuild(state);
    expect(reverted.mode).toBe('build');
    expect(reverted.party).toEqual([]);
    expect(reverted.floors[0].slots[0].grade).toBe('?');
  });

  it('respects genderPref settings when generating party', () => {
    const state = createInitialGameState();
    state.settings.genderPref = 'female';
    const { party } = generateParty(state, 1);
    expect(party).toHaveLength(3);
    expect(party.every((h) => h.gender === 'female')).toBe(true);
    expect(getGuildLevel(state, 1)).toBe(0);
  });

  it('completes a full Build -> Prep -> Raid -> Settlement -> Build wave loop', () => {
    let state = createInitialGameState();
    // Install high-grade pre-rated trap on floor 1
    const eliteBp = { ...STARTER_BLUEPRINTS[0], grade: 'SSS' as const };
    state = installBlueprintToFloor(state, 1, eliteBp).state;
    state = finishBuildPhase(state);

    // Apply prep eval with lewdness 8 (grants +8 lust on startInvasionPhase)
    state = applyPrepReply(
      state,
      `<eval effectiveness="8" novelty="8" fun="8" aesthetics="8" lewdness="8" overall="A"/>
       <hero n="1">\nname: Kael\n</hero><hero n="2">\nname:Mira\n</hero><hero n="3">\nname:Sera\n</hero>`
    ).state;

    state = startInvasionPhase(state);
    expect(state.mode).toBe('raid');
    expect(state.wave).toBe(1);
    expect(state.lust).toBe(8); // (8 - 4) * 2
    expect(state.party.every((h) => h.status === 'alive')).toBe(true);

    // Force die rolls to 1 -> total wipe against SSS floor
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const step = advanceRaidStep(state);
    expect(step.outcome).toBe('wipe');
    expect(step.isFinal).toBe(true);
    expect(step.state.mode).toBe('result');
    expect(step.state.lastSettlement?.items.length).toBeGreaterThan(0);

    const nextBuild = finishSettlementToNextBuild(step.state);
    expect(nextBuild.mode).toBe('build');
    expect(nextBuild.wave).toBe(1);
    expect(nextBuild.party).toEqual([]);
  });
});

describe('AI response language prompts', () => {
  it('defaults to Thai AI responses for officer chat and narration prompts', () => {
    const state = createInitialGameState();
    expect(state.settings.aiLanguage).toBe('th');

    const sys = buildSystemPrompt(state);
    expect(sys).toContain('Thai (ภาษาไทย)');

    const chatMsgs = buildOfficerChatMessages(state, 'สวัสดีครับ', state.chronicle);
    expect(chatMsgs).toHaveLength(2);
    expect(chatMsgs[0].role).toBe('system');
    expect(chatMsgs[0].content).toContain('ภาษาไทย');
    expect(chatMsgs[1]).toEqual({ role: 'user', content: 'สวัสดีครับ' });

    const prepMsgs = buildPrepMessages(finishBuildPhase(state));
    expect(prepMsgs[1].content).toContain('ภาษาไทย');

    const raidMsgs = buildRaidMessages(state, 'pass', '1F', 'All heroes passed');
    expect(raidMsgs[1].content).toContain('ภาษาไทย');

    const bpMsgs = buildBlueprintEvalMessages(state, 'Honey Snare', 'Sticky trap', 'ero');
    expect(bpMsgs[1].content).toContain('ภาษาไทย');
  });

  it('switches to English AI instructions when aiLanguage is set to en', () => {
    const state = createInitialGameState();
    state.settings.aiLanguage = 'en';

    const sys = buildSystemPrompt(state);
    expect(sys).toContain('Respond in vivid, atmospheric English.');
    expect(sys).not.toContain('ภาษาไทย');

    const chatMsgs = buildOfficerChatMessages(state, 'Status report', state.chronicle);
    expect(chatMsgs[0].content).not.toContain('ภาษาไทย');
  });
});
