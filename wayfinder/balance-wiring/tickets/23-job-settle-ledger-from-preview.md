---
summary: Reconcile the job preview with the settle ledger — make the M.Settle ledger execute the aptitude/talent math the UI already sells
labels: [wayfinder:task]
status: closed *(2026-11-15 — settle ledger calls shared getJobSettleYield (parity all 24 jobs); stamina drain + 7 risk rolls live; scrubs recorded)*
assignee: kevii/agent-w1-23
---

# 23: Job Settle Ledger from Preview Math (M3, Batch 3 PR)

**What to build:** The contract bug: `getJobYieldPreview` (prison.ts:1049-1109) sells aptitude ★ multiplier, talent bonuses (Obey Mk2 +20%, Pleasure Mk3 +50%, Terror Mk2 arena −50%), and `mpRansomRatio` — while the settle ledger pays a flat hardcoded table (estate.ts:1037-1054: farm +3 food, bath/brothel +6 MP, default +4 MP, hired ×2). Optimizing off the UI is optimizing fiction. Job `staminaCost`, risk rolls (2-5% accident, bait rescue, decoy betrayal) and `prisonerDelta` are also unimplemented.

**Status:** open

## Acceptance Criteria

- [ ] M.Settle ledger calls the preview math (prison.ts:1061-1082) as the single source of truth for prisoner job MP/food output — hired ×2 preserved as the `hiredMult`
- [ ] Job `staminaCost` charged per settle (workers lose stamina; low-stamina output rule decided — e.g. <30 → half output) and rest/spa loop still viable
- [ ] Risk rolls decided: implement the job accident/rescue/betrayal chances **or** scrub the descs — one source of truth, recorded here (data: prisonData.ts:910, 927, 944, 961, 994, 1057, 1104)
- [ ] Job passives (bellows −5% upgrade, trapbench +15% grade, doll +15% training, trusty −1 resist, tortdemo −1 resist, decoy weakness reveal) — implement or scrub, per-item decision recorded
- [ ] `prisonerDelta` (prisonData.ts:65) — apply at settle or remove the field
- [ ] Dairy doc mismatch (promises +8 MP/+5 food, pays 4/2) resolved by the new ledger; headline yields sanity-checked against servant income table (estate.ts:52-62) so jobs don't trivially outpay conversion
- [ ] Tests: `estateDebtOfficers.test.ts` ledger block (:204-246) extended — aptitude 3★ worker outpays 1★ on the same job; stamina drain applied; `prison.test.ts` preview/settle parity assertion
- [ ] `vitest run` + `tsc -b && vite build` green

## Resolution

**RESOLVED 2026-11-15** — commit `d9aa887` (`balance(23): job settle ledger from preview math`) merged to main (one test-file conflict at EOF resolved keeping all describes; merge `b702813`, gate 163/163 + build green).

- **Source of truth:** new `getJobSettleYield()` (prison.ts) called by BOTH `getJobYieldPreview` and `computeManagementSettle` — aptitude ★, talent marks (Obey2 +20%, Pleas3 +50%, Terror2 arena −50%), `mpRansomRatio`, hired ×2 all flow to the ledger; parity asserted for all 24 jobs.
- **Stamina: implemented** — drained per settle before nightly regen; **stamina < 30 → ALL outputs ×0.5** (`JOB_LOW_STAMINA_THRESHOLD=30`), preview flags "Exhausted (1/2 output)"; rest/spa loop verified viable.
- **Risk rolls: implemented all 7** (`risk` field on PrisonJobDef): bellows 2% / trapbench 3% / tortdemo 3% / gibbetx 5% accidents (→ injured, stamina −15), altar sacrifice 3% (→ death), bait rescue 25% (→ freed), decoy betrayal 10% (→ flees); notes in `ledger.jobRiskNotes`, gated by `options.jobRisks`.
- **Implemented:** trusty/tortdemo −1 resist auras (stack), `prisonerDelta` all 5 keys (clamped 0–100), toilet housing +1, tavern 30% +1 intel.
- **Scrubbed (desc truth-scrubs, recorded):** bellows −5% upgrade, trapbench +15% grade, doll +15% training (no mechanic host), decoy weakness reveal (raid-side — natural home is raidMods.ts, noted), arena death-risk text, showcase private bids, breeder parasite text, toilet plague text.
- **Dairy parity:** now pays 8 MP + 5 food at 2★ (doc mismatch resolved); max 3★ hired dairy 22 MP ≤ SSS servant 30 MP — competitive, never trivially outpaying conversion (asserted).
- Zero UI edits needed (EstatePanel renders `ledger.lines` automatically); no hunks near debt.ts/vault/raidMods regions.
