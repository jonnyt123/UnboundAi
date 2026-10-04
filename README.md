# THREAD//NULL

**Draw the cage. Break the signal.**

THREAD//NULL is a complete, compact top-down action game for modern browsers. You move through a hostile signal field, hold **Weave** to lay a luminous filament, and close that filament back on its start node to seal enemies inside the loop. Survive five escalating sectors, dismantle the final signal core, earn a grade, and replay for a cleaner score.

## Run locally

No runtime packages are required.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

For the production build and verification suite:

```bash
npm ci
npm install --global typescript@5.8.3
npm run verify
python3 -m pip install playwright==1.63.0
python3 -m playwright install chromium
npm run smoke
```

`npm run build` creates `dist/`, which is the Vercel deploy artifact.

## Controls

- Move: **WASD** or **Arrow Keys**
- Weave: **Space** (hold)
- Burst dash: **Shift**
- Pause: **P** or **Esc**
- Mobile: virtual movement pad, **WEAVE**, and **BURST** buttons; landscape orientation recommended

## Release surface

The game ships as static HTML/CSS/ES modules with a Canvas2D renderer and synthesized Web Audio. There are no remote runtime assets, API keys, accounts, databases, analytics, cookies, or server-side game dependencies.

See `docs/` for the game design, architecture, art/audio bibles, QA gates, decisions, provenance, and performance budgets.
