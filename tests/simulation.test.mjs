import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/core/simulation.js';

const box = (x0, y0, x1, y1) => [
  {x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1},{x:x0,y:y0},
];

const enemy = (id, type, x, y) => ({
  id, type, x, y, vx:0, vy:0,
  radius:type === 'sentinel' ? 20 : type === 'striker' ? 17 : 14,
  phase:0, shotCooldown:1000, chargeCooldown:1000, chargeMs:0,
});

test('a valid closed loop seals only enemies inside the polygon', () => {
  const sim = new GameSimulation({ seed: 1 });
  sim.phase = 'playing';
  sim.enemies = [
    enemy(1, 'wisp', 300, 300),
    enemy(2, 'striker', 800, 300),
  ];
  const result = sim.resolveLoop(box(200, 200, 500, 500));
  assert.equal(result.sealed, 1);
  assert.equal(sim.enemies.length, 1);
  assert.equal(sim.enemies[0].id, 2);
  assert.equal(sim.totalSealed, 1);
  assert.ok(sim.score >= 140);
});

test('multi-seals accelerate the chain and refund burst cooldown', () => {
  const sim = new GameSimulation({ seed: 11 });
  sim.phase = 'playing';
  sim.player.dashCooldownMs = 1200;
  sim.enemies = [
    enemy(1, 'wisp', 300, 300),
    enemy(2, 'striker', 360, 340),
  ];
  const result = sim.resolveLoop(box(200, 200, 500, 500));
  assert.equal(result.sealed, 2);
  assert.equal(sim.combo, 3);
  assert.ok(sim.chainTimerMs > 0);
  assert.ok(sim.player.dashCooldownMs < 1200);
  assert.ok(sim.score > 500);
});

test('chain expires when the player stops sealing targets', () => {
  const sim = new GameSimulation({ seed: 12 });
  sim.phase = 'playing';
  sim._advanceChain(2);
  assert.equal(sim.combo, 3);
  sim._updateChain(5600);
  assert.equal(sim.combo, 1);
  assert.equal(sim.chainTimerMs, 0);
});

test('sector completion enters a shorter timed intermission then advances', () => {
  const sim = new GameSimulation({ seed: 2 });
  sim.startRun();
  sim.enemies = [enemy(99, 'wisp', 300, 300)];
  sim.sectorSealed = 3;
  sim.resolveLoop(box(200, 200, 500, 500));
  assert.equal(sim.phase, 'intermission');
  sim.update(1700, {x:0,y:0,weave:false,dash:false,pause:false});
  assert.equal(sim.sector, 2);
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.player.dashCooldownMs, 0);
});

test('sector grace prevents cheap contact damage', () => {
  const sim = new GameSimulation({ seed: 21 });
  sim.startRun();
  sim.enemies = [enemy(1, 'wisp', sim.player.x, sim.player.y)];
  const shield = sim.player.shield;
  sim._resolveDamage();
  assert.equal(sim.player.shield, shield);
  sim.sectorGraceMs = 0;
  sim.player.invulnerableMs = 0;
  sim._resolveDamage();
  assert.equal(sim.player.shield, shield - 1);
});

test('pause freezes simulation time and resume restores play', () => {
  const sim = new GameSimulation({ seed: 3 });
  sim.startRun();
  sim.update(16, {x:0,y:0,weave:false,dash:false,pause:true});
  assert.equal(sim.phase, 'paused');
  const time = sim.runTimeMs;
  sim.update(1000, {x:1,y:0,weave:false,dash:false,pause:false});
  assert.equal(sim.runTimeMs, time);
  sim.resume();
  sim.update(16, {x:0,y:0,weave:false,dash:false,pause:false});
  assert.equal(sim.phase, 'playing');
  assert.ok(sim.runTimeMs > time);
});

test('boss locks must fall before core damage, then victory is reachable', () => {
  const sim = new GameSimulation({ seed: 4 });
  sim.startRun();
  sim.sectorIndex = 4;
  sim.sector = 5;
  sim.enemies = [];
  sim._spawnBoss();
  assert.ok(sim.boss);
  const boss = sim.boss;
  const broad = box(boss.x - 190, boss.y - 160, boss.x + 190, boss.y + 160);
  sim.resolveLoop(broad);
  assert.equal(boss.locks.every(lock => !lock.active), true);
  const hpAfterLocks = boss.hp;
  sim.resolveLoop(broad);
  assert.ok(boss.hp < hpAfterLocks);
  boss.hitCooldownMs = 0; sim.resolveLoop(broad);
  boss.hitCooldownMs = 0; sim.resolveLoop(broad);
  assert.equal(sim.phase, 'victory');
  assert.equal(sim.result?.victory, true);
});

test('damage reaches a deterministic failure state and retry can restart', () => {
  const sim = new GameSimulation({ seed: 5 });
  sim.startRun();
  sim.debugFailure();
  assert.equal(sim.phase, 'gameover');
  assert.equal(sim.result?.victory, false);
  sim.startRun();
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.player.shield, sim.player.maxShield);
});
