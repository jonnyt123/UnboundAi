# Art Bible

## Direction

**Synthetic containment space**: a dark technical arena that feels like a compromised signal-analysis chamber rather than a physical room. The identity must read instantly from one screenshot: black-blue field, electric cyan player filament, hot magenta hostile signals, amber charge/lock warnings, segmented technical framing, and geometric containment loops.

The visual target is now **layered signal-space**, not a flat neon grid. Every sector retains the same product identity while changing field mood, border accent, scan energy, and threat density.

## Sector visual progression

- **Sector 1 — Entry Vector:** cyan-dominant, coolest background, cleanest grid and lowest visual pressure.
- **Sector 2 — Cross Talk:** brighter aqua/blue field modulation and stronger moving signal bands.
- **Sector 3 — Dead Channel:** amber contamination enters the floor, warning rails, and Sentinel telegraphs.
- **Sector 4 — Redline:** magenta contamination, denser radial interference, and stronger boundary pulses.
- **Sector 5 — Null Core:** hostile magenta dominates the field; boss locks visibly tether to the core with amber signal beams until broken.

Sector changes alter atmosphere, not gameplay readability. Player cyan, hostile magenta, warning amber, and damage red keep stable semantic meaning.

## Shape language

- Player: compact bright directional core with a cyan shield orbit, magenta exhaust, and stronger dash afterimage.
- Weave: cyan filament with a bright start node, pre-closure interior wash, and closure halo.
- Wisps: pointed drifting signal knots with a breathing perimeter ring.
- Strikers: angular six-point bodies with rotating shell detail and a visible aim-line charge before firing.
- Sentinels: double-diamond bodies with amber charge lane telegraphs and higher-intensity charge state.
- Boss locks: amber double-diamond anchors visibly tethered to the central core.
- Boss core: layered rotating shell, exposed magenta interference ring, and discrete remaining-hit arcs.
- Arena: segmented corner brackets, moving scan band, disciplined grid traces, elliptical containment rings, side-channel signal fragments.

## Palette

- Background: near-black blue graphite.
- Primary/player: electric cyan.
- Success/closure: cool white + cyan.
- Hostile: magenta/fuchsia.
- Hazard/warning: warm amber.
- Critical damage: saturated red.
- Neutral text: blue-white with lower-value cool gray.
- Sector accent: limited atmospheric variation that never overrides gameplay semantic colors.

Critical state is never communicated by color alone; silhouette, motion, text, line style, and/or meter state also change.

## Material language

No textured sprites are required. Form comes from vector geometry, gradients, alpha falloff, line weight, moving scan planes, segmented technical framing, controlled additive-style glow, and procedural particle response. This keeps the presentation sharp across resolutions and avoids mixed-source asset quality.

## Lighting / compositing

Canvas2D shadow blur remains selective on high/medium quality. Low quality preserves silhouettes, telegraphs, semantic color, loop previews, and impact readability while reducing decorative glow and particle count.

The screen frame uses a restrained scanline/vignette treatment. Full-screen flashes remain brief and low-opacity. Gameplay information must never disappear inside bloom.

## VFX language

- Weave active: thin glow sheath around the line and faint player charge aura.
- Closure-ready state: subtle polygon interior wash, brighter start-node rings, and a stronger white/cyan line.
- Seal: inward particle collapse + polygon flash.
- Multi-seal: stronger white/cyan flash, increased camera impulse, and centered textual callout.
- Chain loss: restrained muted pulse rather than a punishing full-screen effect.
- Damage: red burst, shield blink, knock response, and concise callout.
- Dash: multiple directional line echoes plus a sharper particle burst.
- Sector clear/start: short accent flash and cinematic center banner.
- Boss lock break: amber burst + beam disappearance.
- Boss damage: magenta/cyan layered burst and core breach callout.

Reduced Motion suppresses non-essential shake and effectively disables decorative animation duration while keeping core state readability.

## HUD / interface hierarchy

The HUD now has three distinct read zones:

1. **Left:** sector, objective, run time, and field pressure.
2. **Center:** shield, Thread energy, and Burst readiness.
3. **Right:** live chain multiplier, score, and chain-window bar.

The chain bar changes intensity at higher multipliers. Burst readiness gets its own subtle ready glow. Combat callouts appear briefly below the HUD and never become persistent center-screen cards.

Menus retain full-screen cinematic composition with narrow technical frames instead of dashboard-like cards. Title telemetry and perimeter frame marks add depth without increasing interaction count.

## Mobile

Landscape remains the preferred mobile composition. Safe-area CSS variables protect notches/home indicators. Touch controls are translucent instrumentation rather than opaque gamepad art, preserving the central playfield. The left stick gains subtle crosshair/radial structure while WEAVE and BURST retain strong semantic color separation.
