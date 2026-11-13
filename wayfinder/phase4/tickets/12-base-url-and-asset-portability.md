---
summary: Make Vite base path and all /assets/ references portable for GitHub Pages subpath deployment
labels: [wayfinder:task]
status: closed
assignee: antigravity
---

# 12: Subpath `BASE_URL` & Asset Portability

**What to build:** Eliminate hardcoded root-relative `/assets/...` assumptions so the built Vite bundle works seamlessly both at `/` (local `vite` / `vite preview`) and at a GitHub Pages subpath (`https://lolindill.github.io/<repo>/`).

**Blocked by:** None (can start immediately)

**Status:** closed

## Acceptance Criteria

- [x] Update `app/vite.config.ts` to configure `base: process.env.VITE_BASE_PATH ?? '/'`.
- [x] Update `app/index.html` favicon link from `/assets/icon/image/main.png` to `./assets/icon/image/main.png` (and keep module script `/src/main.tsx` so Vite rewrites it with `base`).
- [x] Add an `assetUrl(path: string)` helper in `app/src/data/assetManifest.ts` using `import.meta.env.BASE_URL` so `resolveNpcImage()`, `resolveSceneAsset()`, and any legacy `/assets/...` strings resolve under the active `base` path.
- [x] Update hardcoded `/assets/...` references in `app/src/components/HeaderBar.tsx` (`main.png`), `app/src/engine/saveLoad.ts` (`dk_open_1.webp.webp`), and `app/src/components/ChroniclePanel.tsx` (`entry.bannerUrl` normalization via `assetUrl`) so both fresh runs and imported/saved Phase 1–3 `localStorage` states render images under a subpath.
- [x] Verify `npm.cmd run test` (`vitest run`) passes all tests and `VITE_BASE_PATH=/trap-dun-test/ npm.cmd run build` emits `./` or `/trap-dun-test/` prefixed script/CSS/asset URLs in `app/dist/index.html`.

## Design References

- [wayfinder/phase4/MAP.md](../MAP.md)
- [app/vite.config.ts](../../../app/vite.config.ts)
- [app/src/data/assetManifest.ts](../../../app/src/data/assetManifest.ts)
