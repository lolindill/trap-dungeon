---
summary: Initialize Git repo, create public GitHub repository, push main, enable Pages, and verify live deployment
labels: [wayfinder:task]
status: ready-for-agent
assignee: antigravity
blocked-by: [11-git-workspace-and-hygiene](11-git-workspace-and-hygiene.md), [12-base-url-and-asset-portability](12-base-url-and-asset-portability.md), [13-github-actions-ci-and-pages-deploy](13-github-actions-ci-and-pages-deploy.md)
---

# 14: Repo Creation, Push, Pages Activation & Live E2E Verification

**What to build:** Initialize the local Git workspace on `main`, commit all clean source/assets/CI files, create the public GitHub repository under `lolindill`, push `main`, enable GitHub Pages (`workflow`), and verify the live deployed site end-to-end.

**Blocked by:** [11-git-workspace-and-hygiene](11-git-workspace-and-hygiene.md), [12-base-url-and-asset-portability](12-base-url-and-asset-portability.md), [13-github-actions-ci-and-pages-deploy](13-github-actions-ci-and-pages-deploy.md)

**Status:** ready-for-agent

## Acceptance Criteria

- [x] Run `git init -b main` in `C:\novel\trap_dun` and verify `git status` excludes `CharX Embeded Jpeg.jpeg`, `app/node_modules/`, `app/dist/`, and `_reference/`.
- [ ] Create initial clean commit on `main`.
- [ ] Create public GitHub repo via `gh repo create` under `lolindill` and push `main` to `origin`.
- [ ] Enable GitHub Pages (`build_type: workflow`) and confirm both CI and Deploy workflows pass green.
- [ ] Verify the live `https://lolindill.github.io/<repo>/` URL loads cleanly with 0 console errors, 0 broken `<img>` assets, working `Original Codex` / `GalleryModal`, and working `Build → Prep → Raid` offline loop.

## Design References

- [wayfinder/phase4/MAP.md](../MAP.md)
- [plan.md](../../plan.md)
