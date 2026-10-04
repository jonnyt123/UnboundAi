# QA and Release Gates

## Automated gates

`npm run verify` must pass:

1. JavaScript syntax/lint guard;
2. TypeScript `checkJs` type analysis;
3. deterministic unit tests;
4. asset/provenance and runtime-size validation;
5. clean production build.

`npm run smoke` drives the actual `dist/` build in Chromium and verifies:

- title loads;
- Start enters gameplay;
- real keyboard movement path executes;
- a deterministic loop advances score;
- dense combat renders;
- pause works;
- Settings opens and an actual quality setting changes;
- resume works;
- victory/results works;
- retry works;
- failure/results works;
- return-to-title works;
- mobile landscape loads, starts, and exposes touch controls;
- no uncaught page or console errors occurred.

## Screenshot evidence

Smoke captures:

1. title;
2. early gameplay;
3. dense gameplay;
4. pause;
5. settings;
6. victory/results;
7. mobile landscape gameplay.

Each must be visually reviewed for missing geometry, UI collision, unreadable text, debug artifacts, center-screen obstruction, bad proportions, and inconsistent visual language.

## Logic tests

Unit tests cover polygon geometry, point-in-polygon, loop sealing, sector transitions, pause freezing, boss lock/core ordering, victory, failure, and retry.

## Manual break pass

Release review should also attempt rapid pause/resume, resize, focus loss, refresh around local settings, repeated retry, quality changes, simultaneous collision/closure moments, weave exhaustion, dash during pressure, and boss objectives out of order.

## Severity policy

- **BLOCKER:** boot/start/complete path unavailable, corrupt boot state, deployment unavailable.
- **CRITICAL:** common crash, controls fail, objective soft-lock, missing core audio/render path.
- **MAJOR:** obvious feedback/readability/performance/accessibility defect materially harming first play.
- **MINOR:** low-frequency cosmetic defect.

No known BLOCKER or CRITICAL issue may remain at production promotion.

## Latest measured evidence

Local release verification on 2026-10-04:

- lint: pass;
- strict JS typecheck: pass;
- unit tests: **8/8 pass**;
- asset/provenance gate: pass;
- clean production build: pass;
- browser golden-path smoke: pass;
- desktop screenshots: title, early play, loop seal, dense play, pause, settings, victory results captured and reviewed;
- mobile landscape smoke: pass;
- portrait rotate guidance: pass;
- resize handling: pass;
- focus-loss auto-pause: pass;
- uncaught browser/page errors during smoke: none;
- production-source runtime size before transport compression: roughly 105 KiB;
- Chromium 144 Linux headless, 1920×1080: render-work p95 **0.3 ms** across High/Medium/Low. Observed rAF cadence varied from 29–52 FPS across the three tier probes in this software/headless environment and is recorded as such rather than represented as a hardware-GPU 60 FPS result.

The local sandbox blocks browser navigation by administrator policy, so the smoke harness loads the exact production HTML/CSS/JS bytes into an in-memory page and only rewrites module import/export plumbing plus the localhost-only E2E gate. A deployed public URL must be checked independently after Vercel deployment.
