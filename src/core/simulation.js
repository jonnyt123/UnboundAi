// @ts-check
import { SECTORS, WORLD } from '../config.js';
import { SeededRng } from './rng.js';
import { clamp, circleHit, distance, normalize, pointInPolygon, polygonArea } from './math.js';

/** @typedef {{x:number,y:number}} Point */
/** @typedef {'wisp'|'striker'|'sentinel'} EnemyType */
/** @typedef {{id:number,type:EnemyType,x:number,y:number,vx:number,vy:number,radius:number,phase:number,shotCooldown:number,chargeCooldown:number,chargeMs:number}} Enemy */
/** @typedef {{id:number,x:number,y:number,vx:number,vy:number,radius:number,lifeMs:number}} Bullet */
/** @typedef {{type:string,[key:string]:any}} GameEvent */
/** @typedef {{x:number,y:number,weave:boolean,dash:boolean,pause:boolean}} ActionState */

const PLAYER_SPEED = 268;
const DASH_SPEED = 680;
const DASH_DURATION = 180;
const DASH_COOLDOWN = 1500;
const WEAVE_DRAIN = 20.5;
const WEAVE_REGEN = 22;
const WEAVE_POINT_SPACING = 10;
const LOOP_CLOSE_DISTANCE = 40;
const LOOP_MIN_LENGTH = 210;
const LOOP_MIN_AREA = 6800;
const LOOP_MIN_AGE_MS = 540;
const DAMAGE_INVULN = 1050;
const SECTOR_GRACE_MS = 900;
const CHAIN_WINDOW_MS = 5500;
const MAX_COMBO = 12;
const MAX_BULLETS = 72;

export class GameSimulation {
  /** @param {{seed?:number}} [options] */
  constructor(options = {}) {
    this.rng = new SeededRng(options.seed ?? 0x54485244);
    this.phase = 'title';
    this.sectorIndex = 0;
    this.sector = 1;
    this.score = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.chainTimerMs = 0;
    this.totalSealed = 0;
    this.runTimeMs = 0;
    this.sectorSealed = 0;
    this.transitionMs = 0;
    this.sectorGraceMs = 0;
    this.tutorialStage = 0;
    this.tutorialMs = 0;
    this.player = this._freshPlayer();
    /** @type {Enemy[]} */ this.enemies = [];
    /** @type {Bullet[]} */ this.bullets = [];
    /** @type {Point[]} */ this.trail = [];
    this.trailLength = 0;
    this.weaveAgeMs = 0;
    this.nextEntityId = 1;
    /** @type {GameEvent[]} */ this.events = [];
    this.boss = null;
    this.result = null;
  }

  _freshPlayer() {
    return {
      x: WORLD.width * 0.5,
      y: WORLD.height * 0.72,
      angle: -Math.PI / 2,
      shield: 4,
      maxShield: 4,
      energy: 100,
      dashCooldownMs: 0,
      dashMs: 0,
      invulnerableMs: 0,
      weaving: false,
      moveX: 0,
      moveY: -1,
    };
  }

  startRun() {
    this.rng = new SeededRng((Date.now() ^ 0x54485244) >>> 0);
    this.phase = 'playing';
    this.sectorIndex = 0;
    this.sector = 1;
    this.score = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.chainTimerMs = 0;
    this.totalSealed = 0;
    this.runTimeMs = 0;
    this.sectorSealed = 0;
    this.transitionMs = 0;
    this.sectorGraceMs = SECTOR_GRACE_MS;
    this.tutorialStage = 0;
    this.tutorialMs = 8500;
    this.player = this._freshPlayer();
    this.enemies = [];
    this.bullets = [];
    this.trail = [];
    this.trailLength = 0;
    this.weaveAgeMs = 0;
    this.boss = null;
    this.result = null;
    this.events = [];
    this._spawnSector();
    this._emit('sectorStart', { sector: 1, config: SECTORS[0] });
  }

  pause() {
    if (this.phase === 'playing' || this.phase === 'intermission') {
      this.previousPhase = this.phase;
      this.phase = 'paused';
      this._emit('pause', {});
    }
  }

  resume() {
    if (this.phase === 'paused') {
      this.phase = this.previousPhase === 'intermission' ? 'intermission' : 'playing';
      this._emit('resume', {});
    }
  }

  returnToTitle() {
    this.phase = 'title';
    this.enemies = [];
    this.bullets = [];
    this.trail = [];
    this.boss = null;
    this.result = null;
    this._emit('title', {});
  }

  /** @param {number} dtMs @param {ActionState} input */
  update(dtMs, input) {
    if (input.pause) {
      if (this.phase === 'paused') this.resume();
      else if (this.phase === 'playing' || this.phase === 'intermission') this.pause();
    }
    if (this.phase === 'paused' || this.phase === 'title' || this.phase === 'gameover' || this.phase === 'victory') return;

    const dt = Math.min(dtMs, 50) / 1000;
    this.runTimeMs += dtMs;
    if (this.tutorialMs > 0) this.tutorialMs = Math.max(0, this.tutorialMs - dtMs);

    if (this.phase === 'intermission') {
      this.transitionMs -= dtMs;
      this._decayTransient(dtMs);
      if (this.transitionMs <= 0) {
        this.sectorIndex += 1;
        this.sector = this.sectorIndex + 1;
        this.sectorSealed = 0;
        this.combo = 1;
        this.chainTimerMs = 0;
        this.sectorGraceMs = SECTOR_GRACE_MS;
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 1);
        this.player.energy = 100;
        this.player.dashCooldownMs = 0;
        this.player.invulnerableMs = SECTOR_GRACE_MS;
        this.player.x = WORLD.width * 0.5;
        this.player.y = WORLD.height * 0.72;
        this.enemies = [];
        this.bullets = [];
        this.trail = [];
        this._spawnSector();
        this.phase = 'playing';
        this._emit('sectorStart', { sector: this.sector, config: SECTORS[this.sectorIndex] });
      }
      return;
    }

    this.sectorGraceMs = Math.max(0, this.sectorGraceMs - dtMs);
    this._updateChain(dtMs);
    this._updatePlayer(dtMs, dt, input);
    this._updateEnemies(dtMs, dt);
    this._updateBullets(dtMs, dt);
    this._updateBoss(dtMs, dt);
    this._resolveDamage();
    this._maintainEnemyBudget();
  }

  /** @param {number} dtMs @param {number} dt @param {ActionState} input */
  _updatePlayer(dtMs, dt, input) {
    const p = this.player;
    p.invulnerableMs = Math.max(0, p.invulnerableMs - dtMs);
    p.dashCooldownMs = Math.max(0, p.dashCooldownMs - dtMs);
    p.dashMs = Math.max(0, p.dashMs - dtMs);

    if (input.dash && p.dashCooldownMs <= 0) {
      p.dashMs = DASH_DURATION;
      p.dashCooldownMs = DASH_COOLDOWN;
      p.invulnerableMs = Math.max(p.invulnerableMs, DASH_DURATION + 90);
      this._emit('dash', { x: p.x, y: p.y });
    }

    if (Math.hypot(input.x, input.y) > 0.01) {
      p.moveX = input.x;
      p.moveY = input.y;
      p.angle = Math.atan2(input.y, input.x);
    }
    const speed = p.dashMs > 0 ? DASH_SPEED : PLAYER_SPEED;
    p.x = clamp(p.x + input.x * speed * dt, WORLD.margin, WORLD.width - WORLD.margin);
    p.y = clamp(p.y + input.y * speed * dt, WORLD.margin, WORLD.height - WORLD.margin);

    const wantsWeave = input.weave && p.energy > 0.5 && p.dashMs <= 0;
    if (wantsWeave) {
      p.energy = Math.max(0, p.energy - WEAVE_DRAIN * dt);
      if (!p.weaving) this._beginWeave();
      this.weaveAgeMs += dtMs;
      this._sampleTrail();
      if (this._canCloseLoop()) this._closeLoop();
      if (p.energy <= 0) this._breakWeave('depleted');
    } else {
      p.energy = Math.min(100, p.energy + WEAVE_REGEN * dt);
      if (p.weaving) this._breakWeave('released');
    }
  }

  /** @param {number} dtMs */
  _updateChain(dtMs) {
    if (this.combo <= 1 || this.chainTimerMs <= 0) return;
    this.chainTimerMs = Math.max(0, this.chainTimerMs - dtMs);
    if (this.chainTimerMs === 0) {
      const lostCombo = this.combo;
      this.combo = 1;
      this._emit('chainBreak', { combo: lostCombo });
    }
  }

  /** @param {number} gain */
  _advanceChain(gain) {
    this.combo = Math.min(MAX_COMBO, this.combo + Math.max(1, gain));
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.chainTimerMs = CHAIN_WINDOW_MS;
  }

  _beginWeave() {
    const p = this.player;
    p.weaving = true;
    this.trail = [{ x: p.x, y: p.y }];
    this.trailLength = 0;
    this.weaveAgeMs = 0;
    this._emit('weaveStart', { x: p.x, y: p.y });
    if (this.tutorialStage === 0) {
      this.tutorialStage = 1;
      this.tutorialMs = 6500;
    }
  }

  _sampleTrail() {
    const p = this.player;
    const last = this.trail[this.trail.length - 1];
    if (!last) return;
    const d = distance(last.x, last.y, p.x, p.y);
    if (d >= WEAVE_POINT_SPACING) {
      this.trail.push({ x: p.x, y: p.y });
      this.trailLength += d;
      if (this.trail.length > 240) this._breakWeave('overflow');
    }
  }

  _canCloseLoop() {
    if (this.trail.length < 10 || this.trailLength < LOOP_MIN_LENGTH || this.weaveAgeMs < LOOP_MIN_AGE_MS) return false;
    const start = this.trail[0];
    const p = this.player;
    return distance(start.x, start.y, p.x, p.y) <= LOOP_CLOSE_DISTANCE;
  }

  _closeLoop() {
    const loop = [...this.trail, { ...this.trail[0] }];
    if (polygonArea(loop) < LOOP_MIN_AREA) return;
    this.resolveLoop(loop);
    this.player.weaving = false;
    this.player.energy = Math.max(0, this.player.energy - 5);
    this.trail = [];
    this.trailLength = 0;
    this.weaveAgeMs = 0;
    if (this.tutorialStage < 2) {
      this.tutorialStage = 2;
      this.tutorialMs = 5200;
    }
  }

  /** Public for deterministic tests and debug tooling. @param {Point[]} loop */
  resolveLoop(loop) {
    const area = polygonArea(loop);
    let sealedThisLoop = 0;
    const survivors = [];
    for (const enemy of this.enemies) {
      if (pointInPolygon(enemy, loop)) {
        sealedThisLoop += 1;
        this._sealEnemy(enemy);
      } else survivors.push(enemy);
    }
    this.enemies = survivors;

    let lockHits = 0;
    let bossHit = false;
    if (this.boss) {
      for (const lock of this.boss.locks) {
        if (lock.active && pointInPolygon(lock, loop)) {
          lock.active = false;
          lockHits += 1;
          this.score += 700 * Math.max(1, this.combo);
          this._emit('lockBreak', { x: lock.x, y: lock.y });
        }
      }
      const allLocksDown = this.boss.locks.every((lock) => !lock.active);
      if (allLocksDown && lockHits > 0) this.boss.exposeMs = 650;
      const coreEligible = allLocksDown && lockHits === 0 && pointInPolygon(this.boss, loop) && area > 16000;
      if (coreEligible && this.boss.hitCooldownMs <= 0) {
        this.boss.hp -= 1;
        this.boss.hitCooldownMs = 850;
        bossHit = true;
        this.score += 1650 * this.combo;
        this._advanceChain(1);
        this.player.dashCooldownMs = Math.max(0, this.player.dashCooldownMs - 320);
        this.player.energy = Math.min(100, this.player.energy + 18);
        this._emit('bossHit', { x: this.boss.x, y: this.boss.y, hp: this.boss.hp });
        if (this.boss.hp <= 0) this._win();
      }
    }

    if (sealedThisLoop > 0) {
      const comboBeforeReward = this.combo;
      const gain = 1 + Math.min(2, sealedThisLoop - 1);
      const multiBonus = sealedThisLoop > 1 ? sealedThisLoop * sealedThisLoop * 85 * Math.max(1, comboBeforeReward) : 0;
      this.score += multiBonus;
      this._advanceChain(gain);
      this.player.energy = Math.min(100, this.player.energy + sealedThisLoop * 4);
      this.player.dashCooldownMs = Math.max(0, this.player.dashCooldownMs - sealedThisLoop * 180);
      if (sealedThisLoop > 1) this._emit('multiSeal', { count: sealedThisLoop, bonus: multiBonus, combo: this.combo });
    } else if (lockHits > 0) {
      this._advanceChain(Math.min(2, lockHits));
      this.player.dashCooldownMs = Math.max(0, this.player.dashCooldownMs - lockHits * 220);
    } else if (!bossHit) {
      if (this.combo > 1) {
        this.combo = Math.max(1, this.combo - 1);
        this.chainTimerMs = Math.min(this.chainTimerMs, CHAIN_WINDOW_MS * 0.42);
      }
      this.score += Math.min(80, Math.floor(area / 1300));
    }

    this._emit('loopClosed', { points: loop, sealed: sealedThisLoop, lockHits, bossHit, area, combo: this.combo });
    this._checkSectorComplete();
    return { sealed: sealedThisLoop, lockHits, bossHit };
  }

  /** @param {Enemy} enemy */
  _sealEnemy(enemy) {
    this.sectorSealed += 1;
    this.totalSealed += 1;
    const base = enemy.type === 'sentinel' ? 280 : enemy.type === 'striker' ? 205 : 140;
    this.score += base * this.combo;
    this.player.energy = Math.min(100, this.player.energy + 11);
    this._emit('enemySealed', { x: enemy.x, y: enemy.y, enemyType: enemy.type, combo: this.combo });
  }

  /** @param {string} reason */
  _breakWeave(reason) {
    if (!this.player.weaving) return;
    this.player.weaving = false;
    if (this.trail.length > 2) this._emit('weaveBreak', { points: [...this.trail], reason });
    this.trail = [];
    this.trailLength = 0;
    this.weaveAgeMs = 0;
  }

  _checkSectorComplete() {
    if (this.sector >= 5 || this.phase !== 'playing') return;
    const config = SECTORS[this.sectorIndex];
    if (this.sectorSealed >= config.target) {
      const bonus = 700 + this.sector * 250 + this.player.shield * 100 + this.combo * 50;
      this.score += bonus;
      this.phase = 'intermission';
      this.transitionMs = 1650;
      this.bullets = [];
      this._breakWeave('sector');
      this._emit('sectorClear', { sector: this.sector, bonus, combo: this.combo });
    }
  }

  _spawnSector() {
    const config = SECTORS[this.sectorIndex];
    if (this.sector === 5) {
      this._spawnBoss();
      for (let i = 0; i < 3; i += 1) this._spawnEnemy(i % 2 ? 'striker' : 'wisp');
      return;
    }
    for (let i = 0; i < config.enemyBudget; i += 1) this._spawnEnemy(/** @type {EnemyType} */ (this.rng.pick(config.enemyMix)));
  }

  /** @param {EnemyType} type */
  _spawnEnemy(type) {
    let x = WORLD.width * 0.5, y = WORLD.height * 0.3;
    for (let tries = 0; tries < 12; tries += 1) {
      x = this.rng.range(WORLD.margin + 70, WORLD.width - WORLD.margin - 70);
      y = this.rng.range(WORLD.margin + 65, WORLD.height - WORLD.margin - 65);
      if (distance(x, y, this.player.x, this.player.y) > 245) break;
    }
    const radius = type === 'sentinel' ? 20 : type === 'striker' ? 17 : 14;
    this.enemies.push({
      id: this.nextEntityId++, type, x, y, vx: 0, vy: 0, radius,
      phase: this.rng.range(0, Math.PI * 2),
      shotCooldown: this.rng.range(900, 1850),
      chargeCooldown: this.rng.range(1200, 2300),
      chargeMs: 0,
    });
    this._emit('enemySpawn', { x, y, enemyType: type });
  }

  _spawnBoss() {
    this.boss = {
      x: WORLD.width * 0.5,
      y: WORLD.height * 0.28,
      radius: 54,
      hp: 3,
      maxHp: 3,
      angle: 0,
      pulseCooldownMs: 1150,
      addCooldownMs: 2600,
      hitCooldownMs: 0,
      exposeMs: 0,
      locks: [0, 1, 2].map((index) => ({ id: index, active: true, x: 0, y: 0, angle: index * (Math.PI * 2 / 3) })),
    };
    this._syncBossLocks();
    this._emit('bossSpawn', { x: this.boss.x, y: this.boss.y });
  }

  /** @param {number} dtMs @param {number} dt */
  _updateEnemies(dtMs, dt) {
    const p = this.player;
    const sectorScale = 0.92 + (this.sector - 1) * 0.085;
    for (const enemy of this.enemies) {
      enemy.phase += dt * (0.7 + enemy.id % 5 * 0.08);
      enemy.shotCooldown -= dtMs;
      enemy.chargeCooldown -= dtMs;
      enemy.chargeMs = Math.max(0, enemy.chargeMs - dtMs);
      const toPlayer = normalize(p.x - enemy.x, p.y - enemy.y);

      if (enemy.type === 'wisp') {
        const speed = 70 * sectorScale;
        const wobble = Math.sin(enemy.phase * 2.1) * 0.52;
        const side = { x: -toPlayer.y, y: toPlayer.x };
        enemy.vx = (toPlayer.x + side.x * wobble) * speed;
        enemy.vy = (toPlayer.y + side.y * wobble) * speed;
      } else if (enemy.type === 'striker') {
        const d = distance(enemy.x, enemy.y, p.x, p.y);
        const side = { x: -toPlayer.y, y: toPlayer.x };
        const radial = d > 255 ? 0.76 : d < 165 ? -0.68 : 0.04;
        const speed = 80 * sectorScale;
        enemy.vx = (toPlayer.x * radial + side.x * 0.86) * speed;
        enemy.vy = (toPlayer.y * radial + side.y * 0.86) * speed;
        if (enemy.shotCooldown <= 0) {
          this._fireBullet(enemy.x, enemy.y, toPlayer.x, toPlayer.y, 238 + this.sector * 12);
          enemy.shotCooldown = Math.max(760, 1740 - this.sector * 115) + this.rng.range(0, 420);
          this._emit('enemyFire', { x: enemy.x, y: enemy.y });
        }
      } else {
        if (enemy.chargeMs > 0) {
          // Preserve committed charge velocity for a readable attack arc.
        } else if (enemy.chargeCooldown <= 0) {
          enemy.vx = toPlayer.x * 315 * sectorScale;
          enemy.vy = toPlayer.y * 315 * sectorScale;
          enemy.chargeMs = 500;
          enemy.chargeCooldown = 2700 + this.rng.range(0, 600);
          this._emit('sentinelCharge', { x: enemy.x, y: enemy.y });
        } else {
          const center = normalize(WORLD.width * 0.5 - enemy.x, WORLD.height * 0.5 - enemy.y);
          const side = { x: -center.y, y: center.x };
          enemy.vx = (center.x * 0.18 + side.x) * 74 * sectorScale;
          enemy.vy = (center.y * 0.18 + side.y) * 74 * sectorScale;
        }
      }

      enemy.x = clamp(enemy.x + enemy.vx * dt, WORLD.margin + 10, WORLD.width - WORLD.margin - 10);
      enemy.y = clamp(enemy.y + enemy.vy * dt, WORLD.margin + 10, WORLD.height - WORLD.margin - 10);
    }
  }

  /** @param {number} dtMs @param {number} dt */
  _updateBullets(dtMs, dt) {
    const next = [];
    for (const bullet of this.bullets) {
      bullet.lifeMs -= dtMs;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.lifeMs > 0 && bullet.x > 0 && bullet.x < WORLD.width && bullet.y > 0 && bullet.y < WORLD.height) next.push(bullet);
    }
    this.bullets = next;
  }

  /** @param {number} dtMs @param {number} dt */
  _updateBoss(dtMs, dt) {
    if (!this.boss || this.phase !== 'playing') return;
    const boss = this.boss;
    boss.angle += dt * 0.34;
    boss.x = WORLD.width * 0.5 + Math.sin(boss.angle * 0.72) * 126;
    boss.y = WORLD.height * 0.27 + Math.cos(boss.angle * 0.93) * 32;
    boss.pulseCooldownMs -= dtMs;
    boss.addCooldownMs -= dtMs;
    boss.hitCooldownMs = Math.max(0, boss.hitCooldownMs - dtMs);
    boss.exposeMs = Math.max(0, boss.exposeMs - dtMs);
    this._syncBossLocks();

    if (boss.pulseCooldownMs <= 0) {
      const unlocked = boss.locks.every((lock) => !lock.active);
      const spokes = unlocked ? 7 : 5;
      for (let i = 0; i < spokes; i += 1) {
        const angle = (i / spokes) * Math.PI * 2 + boss.angle;
        this._fireBullet(boss.x, boss.y, Math.cos(angle), Math.sin(angle), unlocked ? 215 : 195);
      }
      boss.pulseCooldownMs = unlocked ? 920 : 1320;
      this._emit('bossPulse', { x: boss.x, y: boss.y });
    }
    if (boss.addCooldownMs <= 0 && this.enemies.length < 5) {
      this._spawnEnemy(this.rng.next() > 0.55 ? 'striker' : 'wisp');
      boss.addCooldownMs = 3000;
    }
  }

  _syncBossLocks() {
    if (!this.boss) return;
    for (const lock of this.boss.locks) {
      const angle = this.boss.angle * 1.8 + lock.angle;
      lock.x = this.boss.x + Math.cos(angle) * 105;
      lock.y = this.boss.y + Math.sin(angle) * 82;
    }
  }

  /** @param {number} x @param {number} y @param {number} dx @param {number} dy @param {number} speed */
  _fireBullet(x, y, dx, dy, speed) {
    const dir = normalize(dx, dy);
    if (this.bullets.length >= MAX_BULLETS) this.bullets.shift();
    this.bullets.push({ id: this.nextEntityId++, x, y, vx: dir.x * speed, vy: dir.y * speed, radius: 5, lifeMs: 4400 });
  }

  _resolveDamage() {
    const p = this.player;
    if (p.invulnerableMs > 0 || this.sectorGraceMs > 0) return;
    for (const enemy of this.enemies) {
      if (circleHit(enemy.x, enemy.y, enemy.radius + WORLD.playerRadius + 3, p.x, p.y)) {
        this._damagePlayer(enemy.x, enemy.y);
        return;
      }
    }
    for (let i = 0; i < this.bullets.length; i += 1) {
      const bullet = this.bullets[i];
      if (circleHit(bullet.x, bullet.y, bullet.radius + WORLD.playerRadius, p.x, p.y)) {
        this.bullets.splice(i, 1);
        this._damagePlayer(bullet.x, bullet.y);
        return;
      }
    }
    if (this.boss && circleHit(this.boss.x, this.boss.y, this.boss.radius + WORLD.playerRadius, p.x, p.y)) this._damagePlayer(this.boss.x, this.boss.y);
  }

  /** @param {number} sourceX @param {number} sourceY */
  _damagePlayer(sourceX, sourceY) {
    const p = this.player;
    if (p.invulnerableMs > 0 || this.sectorGraceMs > 0) return;
    p.shield -= 1;
    p.invulnerableMs = DAMAGE_INVULN;
    this.combo = 1;
    this.chainTimerMs = 0;
    this._breakWeave('hit');
    const away = normalize(p.x - sourceX, p.y - sourceY);
    p.x = clamp(p.x + away.x * 34, WORLD.margin, WORLD.width - WORLD.margin);
    p.y = clamp(p.y + away.y * 34, WORLD.margin, WORLD.height - WORLD.margin);
    this._emit('playerHit', { x: p.x, y: p.y, shield: p.shield });
    if (p.shield <= 0) this._lose();
  }

  _maintainEnemyBudget() {
    if (this.phase !== 'playing' || this.sector >= 5) return;
    const config = SECTORS[this.sectorIndex];
    const remainingNeeded = Math.max(0, config.target - this.sectorSealed);
    const minimumLive = Math.min(3 + Math.floor(this.sector / 2), remainingNeeded + 1);
    const respawnChance = 0.012 + this.sector * 0.0035;
    if (this.enemies.length < minimumLive && remainingNeeded > 0 && this.rng.next() < respawnChance) {
      this._spawnEnemy(/** @type {EnemyType} */ (this.rng.pick(config.enemyMix)));
    }
  }

  /** @param {number} dtMs */
  _decayTransient(dtMs) {
    this.player.invulnerableMs = Math.max(0, this.player.invulnerableMs - dtMs);
    this.player.dashCooldownMs = Math.max(0, this.player.dashCooldownMs - dtMs);
  }

  _lose() {
    this.phase = 'gameover';
    this._breakWeave('death');
    this.result = this._buildResult(false);
    this._emit('gameOver', { result: this.result });
  }

  _win() {
    this.phase = 'victory';
    this._breakWeave('victory');
    const timeBonus = Math.max(0, 12500 - Math.floor(this.runTimeMs / 1000) * 32);
    const chainBonus = this.bestCombo * 180;
    this.score += timeBonus + chainBonus;
    this.result = this._buildResult(true);
    this._emit('victory', { result: this.result, timeBonus, chainBonus });
  }

  /** @param {boolean} victory */
  _buildResult(victory) {
    const grade = !victory ? 'D' : this.score >= 18500 ? 'S' : this.score >= 13000 ? 'A' : this.score >= 9000 ? 'B' : 'C';
    return { victory, score: this.score, timeMs: this.runTimeMs, sealed: this.totalSealed, bestCombo: this.bestCombo, grade };
  }

  /** @param {string} type @param {Record<string, any>} payload */
  _emit(type, payload) { this.events.push({ type, ...payload }); }

  drainEvents() { const events = this.events; this.events = []; return events; }

  get chainProgress() {
    return this.combo > 1 ? clamp(this.chainTimerMs / CHAIN_WINDOW_MS, 0, 1) : 0;
  }

  get objectiveText() {
    if (this.sector < 5) return `SEAL ${Math.min(this.sectorSealed, SECTORS[this.sectorIndex].target)} / ${SECTORS[this.sectorIndex].target}`;
    if (!this.boss) return 'LOCATE NULL CORE';
    const locks = this.boss.locks.filter((lock) => lock.active).length;
    return locks > 0 ? `BREAK ${locks} CORE LOCK${locks === 1 ? '' : 'S'}` : `CAGE CORE ${this.boss.maxHp - this.boss.hp} / ${this.boss.maxHp}`;
  }

  get tutorialText() {
    if (this.sector !== 1 || this.tutorialMs <= 0) return '';
    if (this.tutorialStage === 0) return 'MOVE — WASD / ARROWS OR LEFT TOUCH STICK';
    if (this.tutorialStage === 1) return 'KEEP WEAVING — CURVE BACK THROUGH YOUR START NODE TO CLOSE THE LOOP';
    return 'GOOD — CHAIN FAST SEALS FOR SCORE, ENERGY, AND FASTER BURST RECHARGE';
  }

  debugForceLoop() {
    const cx = this.player.x, cy = this.player.y - 120, r = 175;
    const points = [];
    for (let i = 0; i <= 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return this.resolveLoop(points);
  }

  debugDenseState() {
    if (this.phase !== 'playing') this.startRun();
    this.enemies = [];
    for (let i = 0; i < 18; i += 1) this._spawnEnemy(i % 3 === 0 ? 'sentinel' : i % 2 === 0 ? 'striker' : 'wisp');
    for (let i = 0; i < 22; i += 1) {
      const a = (i / 22) * Math.PI * 2;
      this._fireBullet(WORLD.width * .5, WORLD.height * .4, Math.cos(a), Math.sin(a), 150 + (i % 4) * 12);
    }
  }

  debugVictory() {
    if (this.phase === 'title') this.startRun();
    this.sectorIndex = 4; this.sector = 5; this.enemies = []; this.bullets = []; this._spawnBoss();
    if (!this.boss) return;
    for (const lock of this.boss.locks) lock.active = false;
    this.boss.hp = 0;
    this.totalSealed = 31;
    this.score = Math.max(this.score, 14500);
    this.bestCombo = Math.max(this.bestCombo, 8);
    this._win();
  }

  debugFailure() {
    if (this.phase === 'title') this.startRun();
    this.sectorGraceMs = 0;
    this.player.invulnerableMs = 0;
    this.player.shield = 0;
    this._lose();
  }
}
