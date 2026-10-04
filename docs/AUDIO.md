# Audio Direction

## Identity

The sound identity is an original procedural **electrical pulse / containment synth** language generated entirely with Web Audio oscillators, filters, envelopes, and noise. No external music or SFX files ship with the game.

## Buses

- Master
  - Music
  - SFX / UI

The settings screen persists independent master, music, and SFX values.

## Music

A sparse adaptive pulse bed begins only after a user gesture unlocks the AudioContext. Density and register react to run pressure/sector state rather than playing a long pre-rendered loop. The objective is forward motion without masking high-value action cues.

## Core cues

- Weave start / closure: short harmonic charge cues.
- Successful seal: layered rising transient and impact.
- Multi-seal: stronger pitch/energy response.
- Player hit: low harsh transient separated from success tones.
- Burst: short noise/sweep response.
- Sector clear: brief stinger.
- Boss lock/core hit: heavier layered pulse.
- Failure/victory: distinct resolving stingers.
- UI confirm/open/close: restrained, consistent micro-cues.

## Mixing

SFX peak above the music bed, especially damage, seal, and boss-state cues. Repeated enemy events vary pitch slightly to avoid identical-sample fatigue. Oscillator nodes are stopped/disconnected after envelopes complete to avoid node accumulation.

## Autoplay and focus

Audio initializes/resumes from a direct Start interaction. Gameplay remains fully understandable with audio muted; visual equivalents exist for damage, closure, objective completion, and boss state.
