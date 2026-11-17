---
summary: Give the captured prisoner identity a runtime reader — surface persona/skill/weakness prose in the prison roster prompt context (scrutinize follow-on to ticket 26)
labels: [wayfinder:task]
status: open
blocked-by: [26-corrfeed-ledger-capture-identity-carry](26-corrfeed-ledger-capture-identity-carry.md)
---

# 33: Prisoner Identity Prompt Consumer (scrutinize follow-on)

**What to build:** Scrutinize (2026-11-18) found the four identity fields ticket 26 carries across the capture boundary — `Prisoner.persona/skill/weakness/kinkDesc` — have ZERO runtime readers (written in the capture literal at `raid.ts:1148-1151`, read nowhere; grep-verified across prompts/UI/ransom). The map thesis "capture boundary drops hero identity" is only half-shipped: the identity exists in state but never surfaces to the LLM or the player.

**Status:** open

## Spec

1. **`engine/prison.ts` `buildPrisonRosterPromptContext`:** extend the prisoner line (or add a compact identity clause) with `persona` / `skill` / `weakness` — prose fields, ruling-safe (tier words + prose only; NO raw meter ints added). Legacy prisoners without the fields render exactly as today (no diff on the line).
2. **Decide `kinkDesc`:** include only if it adds distinct value beyond the existing kink vocabulary references — or leave it out with a one-line reason recorded in the resolution.
3. **Optional second reader** if trivial: ransom/scene flavor may reference `skill`/`weakness`; do not invent new UI surfaces for this.

## Acceptance Criteria

- [ ] Roster prompt line carries the identity prose for captured prisoners; legacy prisoners (fields absent) render byte-identical to today
- [ ] No raw meter ints added to any prompt (LLM ruling + its recorded exception respected)
- [ ] `vitest run` + `tsc -b && vite build` green; a prompt-diff regression test pins the legacy no-diff case

## Notes

- Follow-on to the closed corruption map (tickets 26-32); filed in the same tracker for provenance. Claim (set `assignee`) per wayfinder convention before starting work.
