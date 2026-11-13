# Ero Trap Dungeon Maker — Phase 4 Wayfinder Map (Git Workspace & Deployment)

## Destination ✅ COMPLETED (2026-11-13)

Initialize `C:\novel\trap_dun` as a clean, self-contained **Git workspace**, make all Vite build and static asset paths subpath-portable, automate **Vitest + TypeScript + Vite build** CI checks, and deploy the standalone browser RPG to a **Public GitHub repository + GitHub Pages** via GitHub Actions.

## Locked Architecture & Hygiene Decisions

- **GitHub Hosting & Visibility:** Public GitHub repository under `lolindill` + **GitHub Pages** (`actions/deploy-pages@v4`) auto-deployed on every push to `main`.
- **Large Binary & Raw Reference Hygiene:**
  - Exclude `CharX Embeded Jpeg.jpeg` (~82.5 MB raw card binary), `Ero Trap Dungeon Maker_all_chats_*.json`, `_reference/` (~3.01 MB raw CharX Lua/Lorebooks), `app/node_modules/`, `app/dist/`, and `app/tsconfig.tsbuildinfo` via `.gitignore`.
  - Track `app/` (including `app/public/assets/` ~76.66 MB across 446 visual assets, max single file ~334 KB), `plan.md`, `wayfinder/`, `.github/`, `.gitignore`, `.gitattributes`, and `README.md`.
- **Subpath Portability (`import.meta.env.BASE_URL`):**
  - Parameterize `base` in `app/vite.config.ts` (`process.env.VITE_BASE_PATH ?? '/'`) so GitHub Pages project URLs (`https://lolindill.github.io/<repo>/`) resolve all 446 assets, favicon, header icon, and legacy `bannerUrl` entries without 404s, while local dev/test continues using `/`.
- **Client-Side BYOK LLM Safety:**
  - Zero API keys or secrets stored in Git; all provider keys stay in user browser `localStorage` (`LlmConfig`), alongside full offline fallback playability.

## Tickets

- **[11: Git Workspace Setup, Hygiene & Documentation](tickets/11-git-workspace-and-hygiene.md)** — `closed`: Created root `.gitignore`, `.gitattributes`, and `README.md`; verified clean tracked file inventory (`555` files, `78.44 MB` total, max file `326.26 KB`).
- **[12: Subpath `BASE_URL` & Asset Portability](tickets/12-base-url-and-asset-portability.md)** — `closed`: Parameterized `vite.config.ts` `base`, added `vite-env.d.ts` and `assetUrl()` in `assetManifest.ts`, updated `albumCatalog.ts`, `HeaderBar.tsx`, `saveLoad.ts`, `ChroniclePanel.tsx`, and `index.html`; verified `vitest run` (`109/109`) + subpath `vite build`.
- **[13: GitHub Actions CI & GitHub Pages Auto-Deploy](tickets/13-github-actions-ci-and-pages-deploy.md)** — `closed`: Created `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` with dynamic Pages `VITE_BASE_PATH`.
- **[14: Repo Creation, Push, Pages Activation & Live E2E Verification](tickets/14-repo-creation-live-deploy-and-verify.md)** — `closed`: Force-pushed clean root history `6d2cee5` (555 files / 78.44 MB, nested `app/.git` removed) to public [`lolindill/trap-dungeon`](https://github.com/lolindill/trap-dungeon); Pages `build_type: workflow` enabled; CI + Deploy green on first run; live E2E at https://lolindill.github.io/trap-dungeon/ verified — 0 console errors, 0 broken imgs, Original Codex (301+29), GalleryModal (446 assets), full offline `Build → Prep → Raid → Day 1` loop, localStorage saves writing.

## Out of scope

- Paid backend servers, proxy APIs, or committing user API keys.
- Audio/SFX chiptune polish or Electron/Tauri desktop wrappers (still deferred beyond Phase 4).
- Bundling `Galmuri9`/`Galmuri11` fonts locally (retains `cdn.jsdelivr.net` `@font-face` with system monospace fallback).
