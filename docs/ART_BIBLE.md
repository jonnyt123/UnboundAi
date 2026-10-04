# Art Bible

## Direction

**Synthetic containment space**: a dark technical arena whose shapes feel like a compromised oscilloscope / security lattice rather than a physical room. The visual identity is recognizable from one screenshot: nearly black field, electric cyan player filament, hot magenta hostile signals, amber warning accents, and geometric containment loops.

## Shape language

- Player: compact bright diamond/core with a clean directional tail.
- Weave: thin cyan filament with brighter start node and closure flare.
- Wisps: rounded rotating signal knots.
- Strikers: sharper forward-weighted silhouettes.
- Sentinels: heavier radial bodies with projectile telegraph structure.
- Boss locks: triangular/orbital anchors around a central circular core.
- Arena: long lines, partial rings, and disciplined grid traces—not generic sci-fi panels.

## Palette

- Background: near-black blue graphite.
- Primary/player: electric cyan.
- Secondary/player success: cool white.
- Hostile: magenta/fuchsia.
- Hazard/warning: warm amber.
- Critical damage: saturated red.
- Neutral text: blue-white with lower-value cool gray.

Critical state is never communicated by color alone; silhouette, motion, text, and/or meter state also change.

## Material language

There are no textured sprites. Form comes from vector geometry, alpha falloff, line weight, additive-feeling layering, and restrained glow shadows. This keeps the output sharp across resolutions and avoids asset mismatch.

## Lighting / compositing

Canvas2D shadow blur is used selectively on high/medium quality. Low quality keeps silhouettes and particles but removes expensive decorative glow. Full-screen flashes are brief and low-opacity; gameplay information always remains readable.

## VFX language

- Seals: inward particle collapse + loop polygon flash.
- Damage: short red flash, knock/recovery readability, limited shake.
- Dash: directional afterimage/particle response.
- Sector clear: controlled center pulse/banner, not a persistent panel.
- Boss damage: stronger radial burst while preserving lock/core contrast.

Reduced Motion suppresses non-essential shake and lowers presentation movement intensity.

## Typography / iconography

Typography relies on a purposeful system sans/monospace stack so no remote font request is needed. Uppercase labels, tracked microcopy, slash notation, and concise technical vocabulary establish identity. Controls use text-first glyphs so meaning does not depend on decorative icons.

## UI composition

The playfield owns the screen. HUD clusters stay at edges, with center and lower-middle kept clear. Menus are cinematic full-screen overlays with narrow framed content, not a dashboard grid.

## Mobile

Landscape is the preferred mobile composition. Safe-area CSS variables protect notches/home indicators. Touch controls live in the lower corners and use translucent circles/buttons that preserve the center field.
