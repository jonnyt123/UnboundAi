# Decisions

## Concept selection

Several directions were considered privately against finish probability, feel, browser performance, asset burden, testability, replay value, and presentation headroom. The chosen concept is **THREAD//NULL**, a top-down loop-capture action game.

It won because its core verb is immediately visual and tactile, creates meaningful geometry without requiring a large authored map, scales cleanly from tutorial to boss, is deterministic enough to test, and lets premium presentation come from synchronized motion/light/audio instead of a large external asset library.

Rejected risk classes included a 3D humanoid action game (animation/asset burden), vehicle game (physics/tuning/content burden), stealth game (AI/navigation/content burden), and narrative exploration game (large authored environment/dialogue burden).

## Rendering stack

Initial research evaluated a Phaser/Vite path. The execution environment could not reliably reach npm, and the game does not require a scene graph or tilemap stack. The shipped runtime therefore uses native Canvas2D + ES modules + Web Audio with no runtime packages.

This was not a scope reduction: the game still has deterministic simulation, rich particles/lighting-style glow, camera response, touch/keyboard input, procedural audio, menus/settings, results, accessibility options, and production verification. It removes package/CDN failure risk and reduces boot cost.

## No backend

Supabase and Render were inspected because they are connected, but no authoritative online progression, multiplayer, user account, queue, or server workload exists in the selected product. Adding a backend would create security/deployment state without player value, so the game stays local-first and static.

## Vercel target

Vercel is the preferred production host because the output is a static `dist/` directory. No framework conversion or server function is justified.

## Asset policy

All runtime visual and audio assets are procedural. This eliminates uncertain licensing, download stalls, and visual-source inconsistency. It also means the shipped game is not an asset-store demo and has no copied commercial-game content.

## Mobile policy

Desktop and mobile landscape are supported. Mobile portrait shows a concise rotate prompt because the spatial game needs lateral room for readable loop drawing and unobstructed touch controls.
