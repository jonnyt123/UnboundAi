# Game Design Document — THREAD//NULL

## One-sentence premise

A top-down precision-action game where the player weaponizes movement by drawing temporary luminous filaments and closing loops around hostile anomalies to seal them before the signal field overwhelms them.

## Product identity

- **Title:** THREAD//NULL
- **Tagline:** Draw the cage. Break the signal.
- **Genre:** top-down arcade action / spatial survival
- **Perspective:** fixed top-down arena
- **Session:** finite five-sector run, designed for a focused first clear and score-chasing replays
- **Inputs:** keyboard and touch landscape

## Design pillars

1. **Movement is offense.** Positioning and route choice create the attack; there is no separate aim/shoot loop.
2. **Readable pressure.** Enemy intent, bullets, weave energy, shield, objectives, and chain state stay visually distinct under stress.
3. **Feedback density without clutter.** Successful cages synchronize particles, hit response, sound, score, combo, and brief camera reaction.
4. **Compact escalation.** Each sector adds pressure or a behavior without padding traversal or grinding.
5. **Replayable mastery.** Cleaner cages, multi-seals, fewer hits, faster clears, and sustained chains raise the result grade.

## Core loop

1. Navigate the signal arena and read enemy motion.
2. Hold **Weave** to spend energy and leave a filament behind the player.
3. Return near the weave start node to close the polygon.
4. Enemies inside the polygon are sealed, awarding score and extending the chain.
5. Multi-seals restore additional thread energy and shorten Burst cooldown, rewarding ambitious routes.
6. Manage shield, weave energy, Burst dash, and the timed chain window while the field becomes denser.
7. Reach the sector quota to advance; clear four sectors to reach the signal core.
8. In Sector 5, cage three perimeter locks, then cage the exposed core repeatedly to destroy it.
9. Receive a results grade and immediately replay or return to title.

## Rules

- Weave energy drains while drawing and regenerates quickly when not weaving.
- A valid loop requires enough sampled points, minimum path length, and minimum polygon area.
- Closing near the start node resolves the polygon once; closure tolerance is deliberately generous enough to feel responsive on touch.
- Successful seals extend a 5.5-second chain window. Keeping the chain alive increases score value up to ×12.
- Multi-seals advance the chain faster, grant bonus score, refill extra energy, and refund Burst cooldown.
- Empty loops no longer destroy the entire chain instantly; they shave one combo level and shorten the remaining window.
- Enemy contact/projectiles remove shield and briefly grant recovery invulnerability.
- Each sector begins with a short damage grace window to prevent unfair spawn/contact hits.
- Burst dash provides a short high-speed invulnerable escape with a faster recharge than the initial release.
- Reaching zero shield ends the run.
- Sector quotas advance the run; Sector 5 uses boss-lock and boss-core objectives instead of a standard quota.

## Opposition

- **Wisp:** drifting pressure unit; readable and forgiving.
- **Striker:** orbiting ranged pressure that punishes stationary routes.
- **Sentinel:** committed charge threat that is dangerous but strongly readable.
- **Signal Core:** central boss structure protected by three cageable locks, then multiple core damage windows.

Difficulty increases through composition, spawn cadence, projectile pressure, and speed. Early sectors intentionally leave more decision room; later sectors increase pressure without relying on health inflation.

## Progression

- Sector 1 teaches closing a safe loop.
- Sector 2 introduces chain routing and Striker pressure.
- Sector 3 adds Sentinel charges and tighter route planning.
- Sector 4 combines all threats at peak standard pressure.
- Sector 5 is the climax: dismantle three locks, then cage the core three times.

Between sectors there is a short breathing transition. Shield recovers by one pip, thread fully recharges, Burst resets, and the next sector opens with brief damage grace.

## Scoring

Score rewards:

- enemy seals;
- larger simultaneous captures;
- sustained chain multiplier;
- boss locks;
- boss core hits;
- sector-clear survival quality;
- clear speed;
- best chain achieved during the run.

The final grade evaluates the run through the resulting score, which now reflects speed, survival, multi-seals, boss execution, and chain mastery.

## Onboarding

The title screen exposes Start, How to Play, and Settings. During the first sector, short contextual prompts teach movement, Weave, loop closure, and then explicitly introduce chain rewards. Prompts disappear after their relevant state changes rather than remaining as permanent HUD panels.

## Win / loss / replay

- **Win:** destroy the final Signal Core and reach the victory results screen.
- **Loss:** shield reaches zero and the failure results screen appears.
- Both screens support immediate **Run Again** and **Return to Title**.

## Scope exclusions

No inventory, metagame currency, online account, multiplayer, dialogue tree, procedural campaign map, monetization, or backend progression. These systems would dilute the spatial-action pillar and reduce polish density.
