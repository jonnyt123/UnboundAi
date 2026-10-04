# Asset Provenance

## Runtime assets

THREAD//NULL ships no third-party or generated binary art/audio assets.

| Runtime element | Source | License / rights | Runtime path / implementation |
| --- | --- | --- | --- |
| Player/enemy/boss geometry | Original programmatic vector design created for this project | Project-original | `src/render/renderer.js` |
| Arena/grid/background effects | Original procedural Canvas2D design | Project-original | `src/render/renderer.js`, `styles.css` |
| Particles / flashes / loop VFX | Original procedural effects | Project-original | `src/render/renderer.js` |
| HUD/menu visual design | Original HTML/CSS implementation | Project-original | `index.html`, `styles.css` |
| Music | Original procedural Web Audio synthesis | Project-original | `src/audio/audio.js` |
| SFX/UI cues | Original procedural Web Audio synthesis | Project-original | `src/audio/audio.js` |
| Typography | User-device system fonts only; no font files are shipped | Platform-provided | `styles.css` |

## External references

Commercial 2025–2026 games were treated only as craftsmanship benchmarks. No protected character, logo, map, interface layout, mission, dialogue, music, sound, model, texture, animation, or other distinctive asset was imported or reproduced.

## Build tooling

Node.js, TypeScript, Playwright, Chromium, GitHub Actions, and Vercel are development/deployment tools and are not bundled into the game runtime.
