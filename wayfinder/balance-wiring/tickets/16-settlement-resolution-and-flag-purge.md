---
summary: Make applyWaveSettlement the end-of-raid resolution point — purge consumed mods, tick aftereffects, decrement mole, reset Next-perk flags
labels: [wayfinder:task]
status: closed *(2026-11-15 — applyWaveSettlement now purges consumed mods, ticks aftereffects, decrements mole, resets once-flags)*
assignee: kevii/agent-w2-16
blocked-by: [15-seam-raid-modifiers-resolver](15-seam-raid-modifiers-resolver.md)
---

# 16: Settlement Resolution Point — purge, tick, decrement, flag reset (Batch 1)

**What to build:** The half of the seam nobody else flagged: `applyWaveSettlement` (raid.ts:719) becomes the single end-of-raid resolution point, because every "next raid" promise needs an expiry. Without this, ticket 15 ships permanent buffs.

**Blocked by:** [15-seam-raid-modifiers-resolver](15-seam-raid-modifiers-resolver.md)

**Status:** open

## Acceptance Criteria

- [ ] **One-shot mod purge:** `crises.activeRaidMods` entries consumed by the raid (`first_dc`, `trap_off`, `core_guard`, `hero_up`, `hero_down`, `hero_injured`, `intel`, `intel_zero`) are removed at settlement; array normalized (dedupe — estate.ts:1755-1757 currently spreads without dedupe)
- [ ] **Aftereffect tick:** `tickExpeditionAftereffects` (expedition.ts:675, test-only today) called per settlement so `wavesLeft` finally decrements
- [ ] **Mole decrement:** active mole's `moleRaidsLeft` −1 per raid; at 0 the mole returns to idle state (eligible for jobs/floor slots again, `isActiveMole` false)
- [ ] **Perk-flag purge decision + implementation:** reset `firstDcOnce`, `allDcNext`, `prepIntelOnce`, `aceDowngradeNext`, `newTrapUpNext` at settlement; decide `trapUpgradeCut` (L3, officers.ts:508 — stage perk vs one-shot) and record rationale
- [ ] Tests: `estateDebtOfficers.test.ts` block — trigger L6/L10, run one `applyWaveSettlement`, assert flags false; `prison.test.ts` near :318-322 — after one settlement `moleRaidsLeft === 1`, after two the mole is idle; `expedition.test.ts` — wavesLeft decrements via settlement (not just direct tick call)
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `26a57f3` (`balance(16): settlement resolution point — purge, tick, mole decrement, flag reset`) merged to main (two EOF test conflicts resolved keeping all describes; merge `002307d`, gate 178/178 + build green).

- **Purge site:** `applyWaveSettlement` (raid.ts, after `evaluateRankTrials`, before final `lastSettlement` recompute) — expedition tick + mole decrement + mod purge/normalize + perk-flag reset in one block. Ordering verified: raid resolution (incl. core-capture via `resolveRaidModifiers`) happens in `advanceRaidStep` BEFORE settlement, so purge is safe.
- **Helpers in raidMods.ts** (seam, avoids estate→raidMods edge): `CONSUMED_RAID_MOD_KEYS` (the 8 keys), `normalizeActiveRaidMods` (dedupe = same key AND value dropped, first kept; same-key-different-value kept — resolver sums, distinct crisis rolls legitimately stack), `purgeConsumedRaidMods`. Dedupe-on-write also added at the estate.ts write site.
- **Flags:** exactly the five once-flags reset; `maxIntelBonus` (ticket 19 stack) persists — `prepIntelOnce` flag purged, stack stays.
- **`trapUpgradeCut` (L3) decision: STAGE PERK, NOT purged** — consumed during Build-phase workshop upgrades (not raids), a cost-sink reducer that cannot inflate difficulty, same class as protected L8 `maxIntelBonus`.
- **Mole:** `moleRaidsLeft` −1 per settlement; at 0 eligibility predicates re-enable automatically (job/floor already nulled at dispatch); settlement item "🕵️ Double Agent returned from the Guild" added for feedback.
- Tests: seam-expiry assert (Lilim promise set → settle → `resolveRaidModifiers` sees nothing), flag purge + stacks persist, mole 2→1→0 + idle re-eligibility + return item, wavesLeft decrements via settlement + expired effect drops + retaliation `hero_up` purged.
- Note: a flag SET after settlement (same-Day officer interaction) correctly survives `startNewDay` and expires at that raid's settlement — intended "next raid" semantics.
