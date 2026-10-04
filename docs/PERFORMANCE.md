# Performance

## Budgets

Primary desktop target:

- 60 FPS at 1280×720 simulation space / typical 1080p browser viewport.
- Frame-time p95 target below 16.7 ms on a reasonable current desktop browser where headless/browser scheduling permits representative measurement.
- No network-dependent runtime assets after initial HTML/CSS/JS delivery.
- Runtime source under 1 MiB before transport compression.

Mobile reduced target:

- stable presentation on modern landscape phones;
- DPR and particle/glow cost reduced by quality tier;
- consistent responsiveness is preferred over expensive post effects.

## Quality tiers

- **High:** higher DPR ceiling, full particle density, decorative shadow glow.
- **Medium:** lower DPR/particle budget and reduced expensive glow.
- **Low:** strongest DPR cap, lower particle budget, minimal decorative glow.

The quality selector changes actual Canvas rendering cost rather than only changing a label.

## Hotspots managed

- no sprite texture uploads or image decode stalls;
- no per-frame DOM creation;
- capped particle arrays;
- enemy/projectile collections pruned in-place by simulation lifecycle;
- fixed-step simulation bounds large frame gaps;
- no physics engine or general-purpose scene graph overhead;
- audio nodes are short lived and cleaned up;
- DPR is capped instead of blindly rendering at extreme device pixel ratios.

## Instrumentation

`CanvasRenderer` publishes a small runtime metrics snapshot (`fps`, approximate p95 frame time, particle count, and active quality) for QA. Production does not include a visible diagnostics overlay.

## Measured browser evidence

Final local browser verification used the production `dist/` bytes in Chromium 144 headless on Linux at a 1920×1080 viewport. This execution environment is software/headless scheduled, so `requestAnimationFrame` cadence is not treated as a hardware-GPU benchmark. The renderer also records synchronous render work separately.

- High: 52.0 observed rAF FPS, 24.4 ms frame p95, **0.3 ms render-work p95**.
- Medium: 52.2 observed rAF FPS, 36.6 ms frame p95, **0.4 ms render-work p95**.
- Low: 29.3 observed rAF FPS, 35.2 ms frame p95, **0.3 ms render-work p95**.

The 0.3–0.4 ms render-work p95 shows substantial draw headroom; the irregular headless rAF cadence is dominated by software/headless browser scheduling rather than Canvas work and is not used as a hardware-GPU FPS claim. A public deployment smoke is still required before claiming device-specific 60 FPS.

## Measurement policy

Performance claims in release notes must come from the production build in a browser. CI/build success alone is not treated as a performance measurement. The measured environment and result are recorded in `docs/QA.md`.
