# Repository agent rules

- Preserve the separation between deterministic simulation (`src/core`) and presentation (`src/render`, `src/audio`, `src/ui`).
- Rendering, audio, and UI may react to simulation events; they must not own scoring, damage, objectives, or progression rules.
- Keep the production runtime dependency-free unless a new dependency has a measured release advantage.
- Never add remote runtime code, third-party tracking, secrets, or licensed assets without updating `docs/ASSET_PROVENANCE.md` and `THIRD_PARTY_NOTICES.md`.
- Keep touch, keyboard, reduced-motion, high-contrast, quality-tier, pause/resume, failure, victory, and replay paths working.
- Debug/E2E hooks must stay restricted to localhost and `?e2e=1`.
- Run `npm run verify` after changes and `npm run smoke` after player-facing changes.
- Do not weaken tests or suppress type errors to make CI green.
