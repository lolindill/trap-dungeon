---
summary: Create root .gitignore, .gitattributes, and README.md to prepare C:\novel\trap_dun as a clean Git workspace
labels: [wayfinder:task]
status: closed
assignee: antigravity
---

# 11: Git Workspace Setup, Hygiene & Documentation

**What to build:** Prepare the root workspace (`C:\novel\trap_dun`) for Git tracking and public GitHub hosting with strict ignore rules for heavy binaries, build outputs, and raw RisuAI reference dumps, consistent LF line endings across Windows/Linux, and a clear project `README.md`.

**Blocked by:** None (can start immediately)

**Status:** closed

## Acceptance Criteria

- [x] Create root `.gitignore` excluding:
  - `app/node_modules/`, `app/dist/`, `app/tsconfig.tsbuildinfo`, `*.log`
  - `.env`, `.env.*`, `.DS_Store`, `Thumbs.db`
  - `CharX Embeded Jpeg.jpeg` (82.5 MB raw CharX binary)
  - `Ero Trap Dungeon Maker_all_chats_*.json`
  - `_reference/` (raw CharX Lua & lorebooks)
- [x] Create root `.gitattributes` enforcing `* text=auto eol=lf` for code/markdown/YAML and marking binary image/font formats (`*.webp`, `*.png`, `*.jpg`, `*.jpeg`, `*.woff2`) as `binary`.
- [x] Create root `README.md` documenting standalone features (Phases 1–3), live GitHub Pages URL pattern, local development (`npm run dev` / `test` / `build` inside `app/`), and client-side LLM setup (including Anthropic browser access, Ollama `OLLAMA_ORIGINS` / HTTPS mixed-content note, and offline fallback modes).
- [x] Verify no tracked candidate exceeds GitHub's file-size threshold (max asset in `app/public/assets/` is ~334 KB; total `app/public/` ~76.66 MB).

## Design References

- [wayfinder/phase4/MAP.md](../MAP.md)
- [plan.md](../../plan.md)
