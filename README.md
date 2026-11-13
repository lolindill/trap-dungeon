# Ero Trap Dungeon Maker — Standalone

Standalone tactical defense & dark fantasy management RPG built with **React + TypeScript + Vite**, recreating the complete Phase 1–3 gameplay loop in a fast retro DOS/Galmuri dark interface without external chat wrappers or backend servers.

## Features (Phases 1–3)

- **Core Tactical Loop:** `Build → Prep → Raid → Result` across 7 floors × 5 slots with escalating MP costs, upgrades, 50% dismantle refunds, Floor DC, and Room Combo synergies.
- **Trap Blueprint Shortcuts & Original Codex:** 301 preset traps (`X.TP`) + 29 combo rooms (`X.TPC`), custom AI-rated blueprints, pinning, JSON export/import, and 1-click deployment.
- **Day Loop, Prison, Estate, Debt & Officers:** 5-tab console (`[1] Dungeon | [2] Prison | [3] Estate | [4] Debt | [5] Officers`), Dual Night/Day Stepper, 38 prison pacts, 24 jobs, Town Lv1–7 & 25 facilities, Goldreich 3-wave Debt cycle, and Vesper/Lilim/Eleonora stage progression.
- **Monsters, Expeditions, Realm Situations & Endings:** 28 monster lineages (`84` forms), Floor Guards (`0/2`) & `🔗 LINK` combos, `3 AP/day` Expedition mini-map (13 regions, 22 events), 25 Realm Situations + 4 Major Crises, 7-tab Always-Unlocked Gallery (446 visual assets), 5 Canonical Endings, Endless Rank Trials, and Wave-Start Rewind.
- **Direct Client-Side BYOK LLM & Offline Resilience:** Supports OpenAI-compatible / OpenRouter / Ollama, Google Gemini, and Anthropic Claude directly from the browser (`localStorage`), plus full offline fallback controls.

## Local Development

```powershell
Set-Location app
npm install
npm run dev
```

### Verification Commands

```powershell
Set-Location app
npm run test   # Vitest unit & asset-integrity suite
npm run build  # TypeScript check (tsc -b) + Vite production bundle
```

## Client-Side LLM Notes (GitHub Pages / HTTPS)

- **API Keys Stay Local:** All provider keys and save slots (`Slot 1..5`, Autosave) stay strictly in your browser's `localStorage`.
- **Cloud Providers:** Gemini, OpenAI, OpenRouter, and Anthropic work directly from HTTPS deployments (`anthropic-dangerous-direct-browser-access` is enabled in `app/src/llm/client.ts`).
- **Local Ollama on HTTPS:** When running the deployed HTTPS site against a local `http://localhost:11434/v1` Ollama server, ensure Ollama allows the site's origin (`OLLAMA_ORIGINS=*`) or run the app locally via `npm run dev`.

## Project Roadmap & Documentation

- Master Plan: [plan.md](plan.md)
- Phase 2–3 Design & Implementation Maps: [wayfinder/MAP.md](wayfinder/MAP.md), [wayfinder/implementation/MAP.md](wayfinder/implementation/MAP.md)
- Phase 4 Git Workspace & Deployment Map: [wayfinder/phase4/MAP.md](wayfinder/phase4/MAP.md)
