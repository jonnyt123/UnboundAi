# Architecture

## Runtime shape

THREAD//NULL is a static, zero-runtime-dependency browser game built from native ES modules, Canvas2D, DOM/CSS, Web Audio, and localStorage.

```
Input adapters ──> GameSimulation ──> event stream ──┬─> CanvasRenderer
                                                    ├─> AudioDirector
                                                    └─> GameUI
                                   └───────────────> serializable view/state snapshot
```

## Boundaries

### Simulation (`src/core`)

Owns authoritative rules only: player resources, enemies, projectiles, weave geometry, collision, score/combo, sector state, boss state, pause/failure/victory, deterministic randomization, and debug state transitions.

Simulation objects are plain serializable data. No DOM, canvas, audio node, or browser renderer object enters saved or authoritative state.

### Input (`src/input`)

Maps physical keyboard/touch states onto an action snapshot (`move`, `weave`, `dash`, `pause`). Gameplay code never checks raw key codes.

### Rendering (`src/render`)

Consumes simulation snapshots/events and draws the world. It owns particles, flashes, camera shake, decorative grid motion, and quality-tier visual cost. Rendering cannot award score, apply damage, or advance objectives.

### Audio (`src/audio`)

Consumes gameplay/UI events and produces synthesized music/SFX through Web Audio buses. No audio sample downloads are required.

### UI (`src/ui`)

DOM controls own title, help, settings, pause, HUD, tutorial prompts, results, and mobile controls. UI invokes explicit simulation/input actions but does not replicate gameplay rules.

### Persistence (`src/core/storage.js`)

Settings and best-run progression are versioned separately. Malformed storage is caught and reset to safe defaults so corrupted local data cannot block boot.

## Timing

The main loop uses `requestAnimationFrame` for presentation and a fixed 60 Hz simulation accumulator for stable rule updates. Large frame gaps are bounded so returning from a background tab does not fast-forward the run catastrophically.

## Randomness

Gameplay randomness uses `SeededRng`. Tests instantiate known seeds; runtime creates an ordinary run seed. Deterministic generation makes logic defects reproducible.

## Debug / test contract

A narrow automation API is exposed only when both conditions are true:

1. hostname is `localhost` or `127.0.0.1`;
2. URL contains `?e2e=1`.

Production deployments therefore do not expose force-victory, force-failure, or scene-population helpers.

## Deployment

`npm run build` copies the static app to `dist/` and verifies asset references. `vercel.json` declares the production build/output and browser security headers. No serverless function, database, secret, or rewrites are required.

## Security model

There is no trusted remote progression or economic state. The browser is the complete local runtime. The project contains no API secrets, eval, dynamic remote code, telemetry endpoint, user account, or network payload ingestion.
