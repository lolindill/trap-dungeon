# Ero Trap Dungeon Maker — Balance & Wiring Implementation Map

## Destination ✅ COMPLETED (2026-11-15)

Ship the council-synthesized gameplay/balance patch: wire the five dead systems (crisis `activeRaidMods`, expedition aftereffects, Double Agent mole, Lilim officer perks, estate raid modifiers) into the live engine under hard caps, reprice the faucet exploits (explore/rest arbitrage, auction dominance, force-evo cheese, vault black hole, shard dead-pool, debt cliff), and reprice the crisis "free money" choices in the same build the mods go live — with the full `vitest` suite green after every ticket.

## Notes

- **Execution Override:** This map carries implementation execution (`wayfinder:task`), matching the repo's `wayfinder/implementation` convention. Each wiring ticket ships its tests in the same change (council red line); run `npm.cmd run test` (`vitest run`) and `npm.cmd run build` (`tsc -b && vite build`) in `app/` before closing any ticket.
- **Source of truth:** Scrutiny audit (2026-11-15, this session) + 3-way council debate (Designer/Economist/Engineer) consensus, adopted by the owner (2026-11-15). Locked consensus items:
  - **Caps:** total external DC delta ≤ +4 per raid (firstRoom clamp ≤ +3, allFloors clamp ≤ +2, negative ≤ −4). Adopted verbatim from the Economist table.
  - **One-commit rule:** every modifier lands with its consumer + cap + reset in the same commit; no write-only state.
  - **Flag purge:** perk "Next"-flags (`firstDcOnce`, `allDcNext`, `prepIntelOnce`, `aceDowngradeNext`, `newTrapUpNext`) purge at `applyWaveSettlement` (`startNewDay` only resets day perks — dayLoop.ts:288-296).
  - **B5 triage:** the 9 `getEstateRaidModifiers` fields are wire-or-cut **per field**, default wire; cut only when mechanically redundant.
  - **No difficulty inflation** (raising DC_BASE/hero stats) as compensation for faucet nerfs — council red line.
  - **M2 rides B2:** crisis choice repricing ships in the same build the raidMods go live (free money without the real penalty becomes *unfair*, not just free).
  - **Mole minimal:** Batch 1 wires decrement + one bounded effect (+2 intel → hero mods); full branches (scout removal, discovery roll) are Batch 4 fog.
  - **Force-evo priced in trap-parts** (Designer proposal, Engineer-endorsed), not an MP bump — sinks the currency that already leaks across raid.ts:520, monsters.ts:193-197, expedition.ts:851-858.
- **Import graph constraint:** `raidMods` resolver must live where it causes no import cycle — `estate.ts`, `officers.ts`, `expedition.ts` do not import `raid.ts` or `dungeon.ts`, so a new `engine/raidMods.ts` importing them is safe for consumption by both `raid.ts` and `dungeon.ts`.
- **Phase-1 Preservation Rule:** Never break the existing `Build → Prep → Raid → Result` loop or the Trap Blueprint Shortcut workflow.

## Decisions so far

<!-- Index of closed tickets appended here as one-line summaries + links -->

- [Officer Quick-Action Delegate](tickets/22-officer-quick-action-delegate.md): Day quick talk/gift now pay the real `calcOfficerAffGain` (bath/manor/stage count; old test verified unchanged by execution) — 110/110 green @ `d1aa96c`
- [Force-Evo in Trap-Parts + Parts Currency](tickets/21-force-evo-trap-parts-currency.md): `state.parts` central pool kills the lootParts leak; force-evo now costs MP + 2×stars parts + 1 AP + Fed≥2 with 25% death; finalize capped 3×8MP — 113/113 green @ `2d860a7`
- [Explore vs Rest Rebalance](tickets/19-explore-rest-rebalance.md): stroll decays `max(3, 8−2×exploresToday)` (rest = strict floor), wagers EV ≈ +6 capped at +15 MP with real negative branches, free-MP lines dropped 2–4, intel repeats stack `maxIntelBonus` — 116/116 green @ `912a24e`
- [Auction Repricing](tickets/20-auction-repricing.md): auction EV 0.815× gross (0.85× clean, 10% fizzle 0.5×, 10 MP fee waived at Market Lv3/Eleonora S.3) — below buyer 0.872, hot-buyer ×1.3 keeps buyer niche; pdress ×1.2 prices both paths — 119/119 green @ `2060c83`
- [Raid-Mods Seam resolver](tickets/15-seam-raid-modifiers-resolver.md): `resolveRaidModifiers` in new `engine/raidMods.ts` finally reads activeRaidMods/estate mods/Lilim DC/aftereffects/mole-minimal under caps ±4/+3/+2/−4; wired into raid, dungeon, heroes, workflow, debt (ransomBonusMult); critRoomSave wired as injury-save — 142/142 green @ `cab9b35`
- [Shard Sink + Debt Formula](tickets/25-shard-sink-and-debt-formula.md): surplus shards smelt 3→1 into `state.parts` (sink, never MP); `minDue = max(schedule, ceil(0.15×avg trailingIncome))` (trailingIncome already existed); late strike ×1.05+60 keeps wipe/seizure; handover grants +3 Eleonora — 146/146 green @ `4d09ce6`
- [Job Settle Ledger from Preview Math](tickets/23-job-settle-ledger-from-preview.md): ledger calls shared `getJobSettleYield` (parity across all 24 jobs); stamina<30 halves output; 7 job risk rolls implemented (accident/sacrifice/rescue/betrayal); desc truth-scrubs for hostless passives — 163/163 green @ `d9aa887`
- [Crisis Repricing + estateData Fixes](tickets/17-crisis-repricing-and-estate-data-fixes.md): Bribes +35/−10 order/−5 approval, Export +30/−2 renown/−25 food, Caravan text states raid risk; data invariant locks "every +MP choice has a visible cost"; modText renders magnitudes; art keys torture→dk_fac_torture, reform→dk_fac_pens (spa kept) — 170/170 green @ `d2749a0`
- [Settlement Resolution Point](tickets/16-settlement-resolution-and-flag-purge.md): `applyWaveSettlement` purges consumed raidMods (dedupe-on-write), ticks expedition aftereffects, decrements the mole to idle, resets the five once-flags (trapUpgradeCut = stage perk, kept; maxIntelBonus stack survives) — 178/178 green @ `26a57f3`
- [Lilim Hook + Discount + Legacy-Save Clamp](tickets/18-officer-dc-hook-discount-and-save-clamp.md): Lilim DC path verified inside caps (zero fixes); `lilim:prepIntel` resolver gap fixed; trap-upgrade discount floor-rounded at dungeon cost site; buildCostMult wired to installs/landmarks/wonders (upgradeTown kept flat); aftereffects clamp ≤3/≤3 on load — 185/185 green @ `0f2cebd`
- [Vault Sinks](tickets/24-vault-sinks.md): draft-against-min-due (20% premium, ≤50% of minDue per visit, first-payment gate) + siphon KEPT at 25% (recorded) + sellsword contract (100 vault MP → `all_dc` +2 for one raid inside caps, expires via settlement purge) — 192/192 green @ `cacc636`

## Not yet specified

- **Mole full branches (Batch 4):** Guild-Scout removal from the next generated party, `MOLE_CFG.FIND_CHANCE` 20% discovery roll and its capture consequence — design deferred until the minimal mole (ticket 15/16) proves out.
- **Monster non-DC abilities (M6, Batch 4):** ambushers inflict ailment / seducers force arousal / reapers block the Sanctuary branch (raid.ts:153-168) — needs its own design pass against `resolveFloorEncounter`; revisit `FSLOT.DC_CAP` 3→5 only after abilities land.
- **Expanded vault & trap-parts sinks (Batch 4):** beyond the first passes in tickets 24 and 21 (e.g. auto-pay crisis costs from vault, trap repair/build consumes parts).
- **Lilim S4 ace-downgrade vs `hero_down` raidMod dedup:** both downgrade the top hero grade — verify the mod plumbing doesn't double-dip once both are live.
- **`popMana` cap 50 (estate.ts:1162):** late-game population growth is cosmetically capped for MP — reprice alongside the Batch 3 economy tickets if it still binds.

## Out of scope

- LLM narration quality/provider work; gallery/asset work beyond the three estateData art-key fixes folded into ticket 17.
- Difficulty inflation as a balance compensation mechanism — council red line; faucet pricing instead.
- New subsystems outside the audit's B1–B5/M1–M11 findings; audio/SFX; PWA/Electron/Tauri packaging.
- RisuAI chat DOM hacks or importing RisuAI save dumps.
