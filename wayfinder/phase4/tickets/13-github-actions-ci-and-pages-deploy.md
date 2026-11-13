---
summary: Add GitHub Actions CI quality gate and GitHub Pages auto-deploy workflows
labels: [wayfinder:task]
status: closed
assignee: antigravity
blocked-by: [11-git-workspace-and-hygiene](11-git-workspace-and-hygiene.md), [12-base-url-and-asset-portability](12-base-url-and-asset-portability.md)
---

# 13: GitHub Actions CI & GitHub Pages Auto-Deploy

**What to build:** Automate testing, TypeScript/Vite build verification, asset-manifest integrity checks, and GitHub Pages deployment on every push to `main` using official GitHub Actions workflows.

**Blocked by:** [11-git-workspace-and-hygiene](11-git-workspace-and-hygiene.md), [12-base-url-and-asset-portability](12-base-url-and-asset-portability.md)

**Status:** closed

## Acceptance Criteria

- [x] Create `.github/workflows/ci.yml` running on `push` (`main`) and `pull_request`:
  - Uses `actions/checkout@v4` and `actions/setup-node@v4` (Node 22, npm cache keyed to `app/package-lock.json`).
  - Runs `npm ci`, `npm run test` (`vitest run`), and `npm run build` (`tsc -b && vite build`) in `app/`.
  - Runs an asset-integrity check confirming every asset file referenced in `app/src/data/assetManifest.ts` exists on disk under `app/public/`.
- [x] Create `.github/workflows/deploy.yml` running on `push` (`main`) and `workflow_dispatch`:
  - Declares minimal permissions (`contents: read`, `pages: write`, `id-token: write`) and `"pages"` concurrency group.
  - Runs `npm ci`, `npm run test`, and `npm run build` with `VITE_BASE_PATH: "/${{ github.event.repository.name }}/"`.
  - Uploads `app/dist` with `actions/upload-pages-artifact@v3` and deploys with `actions/deploy-pages@v4`.

## Design References

- [wayfinder/phase4/MAP.md](../MAP.md)
- [app/package.json](../../../app/package.json)
