// @ts-check
import { PALETTE, WORLD } from '../config.js';
import { clamp, normalize } from '../core/math.js';

/** @typedef {{x:number,y:number,vx:number,vy:number,life:number,maxLife:number,size:number,color:string,drag:number}} Particle */
/** @typedef {{points:Array<{x:number,y:number}>,life:number,maxLife:number,sealed:number}} LoopFlash */
/** @typedef {import('../core/simulation.js').GameSimulation} GameSimulation */
/** @typedef {{x:number,y:number,depth:number,alpha:number,size:number,tint:string}} BackgroundNode */

export class GameRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('Canvas2D is not supported by this browser.');
    this.ctx = ctx;
    this.viewWidth = 1;
    this.viewHeight = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dpr = 1;
    this.quality = 'high';
    this.reducedMotion = false;
    this.cameraShake = true;
    this.highContrast = false;
    /** @type {Particle[]} */ this.particles = [];
    /** @type {LoopFlash[]} */ this.loopFlashes = [];
    this.shakeMs = 0;
    this.shakePower = 0;
    this.flash = { life: 0, color: '#ffffff' };
    this.time = 0;
    this.backgroundNodes = this._makeBackgroundNodes(118);
    this.frameCount = 0;
    this.fpsWindowStart = performance.now();
    this.fps = 60;
    /** @type {number[]} */ this.frameTimes = [];
    /** @type {number[]} */ this.renderCostTimes = [];
    this.lastRenderAt = performance.now();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    window.__THREAD_NULL_METRICS__ = { fps: 60, frameP95Ms: 16.7, renderP95Ms: 0, particles: 0, quality: this.quality };
  }

  /** @param {'low'|'medium'|'high'} quality @param {boolean} reducedMotion @param {boolean} cameraShake @param {boolean} highContrast */
  applySettings(quality, reducedMotion, cameraShake, highContrast) {
    this.quality = quality;
    this.reducedMotion = reducedMotion;
    this.cameraShake = cameraShake;
    this.highContrast = highContrast;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const deviceDpr = window.devicePixelRatio || 1;
    if (this.quality === 'high') this.dpr = Math.min(deviceDpr, 1.5);
    else if (this.quality === 'medium') this.dpr = Math.min(deviceDpr, 1.25) * .9;
    else this.dpr = Math.min(deviceDpr, 1) * .72;
    this.viewWidth = Math.max(1, rect.width);
    this.viewHeight = Math.max(1, rect.height);
    this.canvas.width = Math.max(1, Math.floor(this.viewWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewHeight * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scale = Math.min(this.viewWidth / WORLD.width, this.viewHeight / WORLD.height);
    this.offsetX = (this.viewWidth - WORLD.width * this.scale) / 2;
    this.offsetY = (this.viewHeight - WORLD.height * this.scale) / 2;
  }

  /** @param {Array<any>} events */
  handleEvents(events) {
    for (const event of events) {
      if (event.type === 'dash') {
        this._burst(event.x, event.y, PALETTE.cyan, 20, 205);
        this._shake(115, 2.7);
      } else if (event.type === 'enemySpawn') {
        this._burst(event.x, event.y, event.enemyType === 'sentinel' ? PALETTE.amber : PALETTE.magenta, 6, 90);
      } else if (event.type === 'enemySealed') {
        this._burst(event.x, event.y, event.enemyType === 'sentinel' ? PALETTE.amber : PALETTE.magenta, 24, 230);
      } else if (event.type === 'multiSeal') {
        this.flash = { life: 145, color: '#bfffff' };
        this._shake(145, 4.5 + Math.min(4, event.count));
      } else if (event.type === 'loopClosed') {
        this.loopFlashes.push({ points: event.points.map((/** @type {any} */ p) => ({ x: p.x, y: p.y })), life: 560, maxLife: 560, sealed: event.sealed });
        this.flash = { life: 105, color: event.sealed > 0 ? '#52efff' : '#ffffff' };
        this._shake(95, event.sealed > 0 ? 3 : 1.1);
      } else if (event.type === 'playerHit') {
        this._burst(event.x, event.y, PALETTE.danger, 32, 270);
        this._shake(330, 9.5);
        this.flash = { life: 190, color: PALETTE.danger };
      } else if (event.type === 'lockBreak') {
        this._burst(event.x, event.y, PALETTE.amber, 46, 310);
        this._shake(280, 6.5);
        this.flash = { life: 135, color: PALETTE.amber };
      } else if (event.type === 'bossHit') {
        this._burst(event.x, event.y, PALETTE.magenta, 58, 365);
        this._burst(event.x, event.y, PALETTE.cyan, 22, 270);
        this._shake(390, 11);
        this.flash = { life: 195, color: PALETTE.magenta };
      } else if (event.type === 'chainBreak') {
        this.flash = { life: 70, color: '#7b3157' };
      } else if (event.type === 'sectorStart') {
        this.flash = { life: 95, color: this._sectorTheme(event.sector).accent };
      } else if (event.type === 'sectorClear') {
        this.flash = { life: 280, color: PALETTE.cyan };
        this._shake(230, 4.2);
      } else if (event.type === 'victory') {
        this.flash = { life: 680, color: '#cfffff' };
        for (let i = 0; i < 10; i += 1) {
          this._burst(WORLD.width * (.17 + i * .073), WORLD.height * (.28 + Math.sin(i) * .08), i % 2 ? PALETTE.magenta : PALETTE.cyan, 24, 380);
        }
      }
    }
  }

  /** @param {GameSimulation} sim @param {number} dtMs */
  render(sim, dtMs) {
    const now = performance.now();
    const renderStart = now;
    this._trackPerf(now);
    this.time += Math.min(dtMs, 50);
    this.shakeMs = Math.max(0, this.shakeMs - dtMs);
    this.flash.life = Math.max(0, this.flash.life - dtMs);
    this._updateFx(dtMs);

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._drawBackdrop(ctx, sim);

    let sx = 0, sy = 0;
    if (this.cameraShake && !this.reducedMotion && this.shakeMs > 0) {
      const fade = this.shakeMs / Math.max(1, this.shakeMs + 80);
      sx = (Math.random() - .5) * this.shakePower * fade;
      sy = (Math.random() - .5) * this.shakePower * fade;
    }
    ctx.translate(this.offsetX + sx, this.offsetY + sy);
    ctx.scale(this.scale, this.scale);

    this._drawArena(ctx, sim);
    this._drawLoopFlashes(ctx);
    this._drawBoss(ctx, sim);
    this._drawBullets(ctx, sim);
    this._drawEnemies(ctx, sim);
    this._drawTrail(ctx, sim);
    this._drawPlayer(ctx, sim);
    this._drawParticles(ctx);
    this._drawArenaMask(ctx, sim);
    ctx.restore();

    if (this.flash.life > 0) this._drawFlash(ctx, this.flash.color, this.flash.life / 680);
    const renderCost = performance.now() - renderStart;
    if (renderCost >= 0 && renderCost < 1000) {
      this.renderCostTimes.push(renderCost);
      if (this.renderCostTimes.length > 240) this.renderCostTimes.shift();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawBackdrop(ctx, sim) {
    const theme = this._sectorTheme(sim.sector);
    const grad = ctx.createRadialGradient(this.viewWidth * .5, this.viewHeight * .42, 20, this.viewWidth * .5, this.viewHeight * .5, Math.max(this.viewWidth, this.viewHeight) * .78);
    grad.addColorStop(0, this.highContrast ? '#0b1d2a' : theme.backdrop);
    grad.addColorStop(.45, '#050a12');
    grad.addColorStop(1, '#020307');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    const drift = this.reducedMotion ? 0 : this.time * .000018;
    const starAlpha = this.highContrast ? .46 : .27;
    for (const node of this.backgroundNodes) {
      const x = ((node.x + drift * node.depth) % 1) * this.viewWidth;
      const y = ((node.y + drift * .38 * node.depth) % 1) * this.viewHeight;
      ctx.globalAlpha = starAlpha * node.alpha;
      ctx.fillStyle = node.tint;
      ctx.beginPath();
      ctx.arc(x, y, node.size * (0.8 + node.depth * .35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.quality !== 'low') {
      const bandDrift = this.reducedMotion ? 0 : (this.time * .012) % 180;
      ctx.save();
      ctx.globalAlpha = .08;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1;
      for (let y = -180 + bandDrift; y < this.viewHeight + 180; y += 180) {
        ctx.beginPath();
        ctx.moveTo(-40, y);
        ctx.lineTo(this.viewWidth + 40, y + 54);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (sim.phase === 'title') {
      const x = this.viewWidth * .5, y = this.viewHeight * .43;
      ctx.save();
      ctx.translate(x, y);
      const rotation = this.reducedMotion ? 0 : this.time * .000055;
      for (let ring = 0; ring < 5; ring += 1) {
        ctx.save();
        ctx.globalAlpha = .065 + ring * .012;
        ctx.rotate(rotation * (ring % 2 ? -1 : 1) * (ring + 1));
        ctx.strokeStyle = ring === 2 ? PALETTE.magenta : PALETTE.cyan;
        ctx.lineWidth = ring === 2 ? 1.4 : 1;
        const radius = 135 + ring * 67;
        ctx.beginPath();
        for (let i = 0; i < 16; i += 1) {
          const ang = (i / 16) * Math.PI * 2;
          const rr = radius * (i % 2 ? .94 : 1.045);
          const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr * .54;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = .16;
      ctx.strokeStyle = PALETTE.magenta;
      ctx.beginPath(); ctx.moveTo(-330, 0); ctx.lineTo(330, 0); ctx.stroke();
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawArena(ctx, sim) {
    const m = WORLD.margin;
    const theme = this._sectorTheme(sim.sector);
    ctx.save();
    ctx.beginPath();
    this._roundedRect(ctx, m, m, WORLD.width - m * 2, WORLD.height - m * 2, 24);
    ctx.clip();

    const arenaGrad = ctx.createLinearGradient(0, m, 0, WORLD.height - m);
    arenaGrad.addColorStop(0, theme.floorTop);
    arenaGrad.addColorStop(.58, '#07111d');
    arenaGrad.addColorStop(1, '#040a12');
    ctx.fillStyle = arenaGrad;
    ctx.fillRect(m, m, WORLD.width - m * 2, WORLD.height - m * 2);

    const gridAlpha = this.highContrast ? .21 : .105;
    ctx.strokeStyle = `rgba(66, 172, 203, ${gridAlpha})`;
    ctx.lineWidth = 1;
    const drift = this.reducedMotion ? 0 : (this.time * .018) % 64;
    for (let x = m - 64 + drift; x < WORLD.width - m + 64; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, WORLD.height - m); ctx.stroke();
    }
    for (let y = m - 64 + drift * .5; y < WORLD.height - m + 64; y += 64) {
      ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(WORLD.width - m, y); ctx.stroke();
    }

    const scanY = m + ((this.reducedMotion ? 0 : this.time * .055) % (WORLD.height - m * 2));
    const scan = ctx.createLinearGradient(0, scanY - 28, 0, scanY + 28);
    scan.addColorStop(0, 'rgba(114,246,255,0)');
    scan.addColorStop(.5, theme.scan);
    scan.addColorStop(1, 'rgba(114,246,255,0)');
    ctx.fillStyle = scan;
    ctx.fillRect(m, scanY - 28, WORLD.width - m * 2, 56);

    ctx.save();
    ctx.globalAlpha = .12 + sim.sector * .012;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([14, 20]);
    const centerX = WORLD.width * .5, centerY = WORLD.height * .46;
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 145 + ring * 110 + Math.sin(this.time * .0018 + ring) * 6;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius, radius * .46, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = .17;
    ctx.strokeStyle = PALETTE.magenta;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const py = m + 45 + i * 101;
      ctx.beginPath();
      ctx.moveTo(m + 24, py);
      ctx.lineTo(m + 145 + Math.sin(i * 2.3 + sim.sector) * 44, py);
      ctx.lineTo(m + 198, py + (i % 2 ? 18 : -18));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (sim.combo > 1) {
      const chain = clamp(sim.chainProgress, 0, 1);
      const aura = ctx.createRadialGradient(sim.player.x, sim.player.y, 20, sim.player.x, sim.player.y, 260 + sim.combo * 5);
      aura.addColorStop(0, `rgba(114,246,255,${.04 + chain * .04})`);
      aura.addColorStop(.62, `rgba(255,79,163,${.012 + chain * .025})`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(m, m, WORLD.width - 2 * m, WORLD.height - 2 * m);
    }

    if (sim.sector >= 4) {
      const pulse = .5 + Math.sin(this.time * .003) * .5;
      ctx.globalAlpha = .075 + pulse * .055;
      const hazard = ctx.createRadialGradient(WORLD.width * .5, WORLD.height * .26, 30, WORLD.width * .5, WORLD.height * .26, 430);
      hazard.addColorStop(0, PALETTE.magenta);
      hazard.addColorStop(1, 'rgba(255,79,163,0)');
      ctx.fillStyle = hazard;
      ctx.fillRect(m, m, WORLD.width - 2 * m, WORLD.height - 2 * m);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  _drawLoopFlashes(ctx) {
    for (const flash of this.loopFlashes) {
      if (flash.points.length < 3) continue;
      const t = flash.life / flash.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.7) * .38;
      ctx.beginPath();
      ctx.moveTo(flash.points[0].x, flash.points[0].y);
      for (let i = 1; i < flash.points.length; i += 1) ctx.lineTo(flash.points[i].x, flash.points[i].y);
      ctx.closePath();
      const minY = Math.min(...flash.points.map(p => p.y));
      const maxY = Math.max(...flash.points.map(p => p.y));
      const grad = ctx.createLinearGradient(0, minY, 0, maxY || minY + 1);
      grad.addColorStop(0, flash.sealed ? 'rgba(114,246,255,.74)' : 'rgba(255,255,255,.2)');
      grad.addColorStop(1, flash.sealed ? 'rgba(255,79,163,.22)' : 'rgba(114,246,255,.05)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.lineWidth = 4 + (1 - t) * 6;
      ctx.strokeStyle = flash.sealed ? PALETTE.cyan : '#b8d8df';
      ctx.shadowBlur = this._glow(5, 11, 16);
      ctx.shadowColor = ctx.strokeStyle;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawBoss(ctx, sim) {
    const boss = sim.boss;
    if (!boss) return;
    ctx.save();
    const pulse = .5 + Math.sin(this.time * .009) * .5;

    for (const lock of boss.locks) {
      if (!lock.active) continue;
      ctx.save();
      ctx.globalAlpha = .18 + pulse * .08;
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 10]);
      ctx.beginPath(); ctx.moveTo(boss.x, boss.y); ctx.lineTo(lock.x, lock.y); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(lock.x, lock.y);
      ctx.rotate(this.time * .0014 + lock.id);
      ctx.strokeStyle = PALETTE.amber;
      ctx.fillStyle = 'rgba(255,179,77,.13)';
      ctx.shadowColor = PALETTE.amber;
      ctx.shadowBlur = this._glow(5, 10, 15);
      ctx.lineWidth = 3;
      this._diamond(ctx, 0, 0, 17 + pulse * 3);
      ctx.fill(); ctx.stroke();
      ctx.rotate(-this.time * .003);
      ctx.globalAlpha = .46;
      this._diamond(ctx, 0, 0, 27);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(boss.x, boss.y);
    const unlocked = boss.locks.every((/** @type {any} */ lock) => !lock.active);
    ctx.save();
    ctx.rotate(this.time * .00034);
    ctx.shadowBlur = this._glow(7, 14, 20);
    ctx.shadowColor = unlocked ? PALETTE.magenta : PALETTE.cyan;
    ctx.strokeStyle = unlocked ? PALETTE.magenta : PALETTE.cyan;
    ctx.lineWidth = 3.2;
    ctx.globalAlpha = .76;
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const ang = (i / 12) * Math.PI * 2;
      const r = i % 2 ? 40 : 58;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-this.time * .0011);
    ctx.globalAlpha = .26;
    ctx.fillStyle = unlocked ? PALETTE.magenta : PALETTE.cyan;
    ctx.beginPath(); ctx.arc(0, 0, 37 + pulse * 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#03070d';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = unlocked ? '#fff' : PALETTE.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 14 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    if (unlocked) {
      ctx.save();
      ctx.globalAlpha = .22 + pulse * .12;
      ctx.strokeStyle = PALETTE.magenta;
      ctx.setLineDash([5, 8]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 82 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < boss.maxHp; i += 1) {
        const ang = -Math.PI / 2 + (i - 1) * .38;
        ctx.strokeStyle = i < boss.hp ? PALETTE.magenta : 'rgba(255,255,255,.13)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 69, ang - .11, ang + .11);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawBullets(ctx, sim) {
    for (const bullet of sim.bullets) {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      const dir = normalize(bullet.vx, bullet.vy);
      ctx.globalAlpha = .32;
      ctx.strokeStyle = PALETTE.magenta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-dir.x * 7, -dir.y * 7);
      ctx.lineTo(-dir.x * 22, -dir.y * 22);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.magenta;
      ctx.shadowColor = PALETTE.magenta;
      ctx.shadowBlur = this._glow(2, 6, 9);
      ctx.beginPath(); ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .25;
      ctx.beginPath(); ctx.arc(0, 0, bullet.radius * 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawEnemies(ctx, sim) {
    for (const enemy of sim.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const pulse = .5 + Math.sin(this.time * .008 + enemy.id) * .5;

      if (enemy.type === 'striker' && enemy.shotCooldown < 380) {
        const aim = normalize(sim.player.x - enemy.x, sim.player.y - enemy.y);
        ctx.save();
        ctx.globalAlpha = .12 + (1 - Math.max(0, enemy.shotCooldown) / 380) * .24;
        ctx.strokeStyle = PALETTE.magenta;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 8]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(aim.x * 155, aim.y * 155); ctx.stroke();
        ctx.restore();
      }
      if (enemy.type === 'sentinel' && enemy.chargeMs <= 0 && enemy.chargeCooldown < 470) {
        const aim = normalize(sim.player.x - enemy.x, sim.player.y - enemy.y);
        ctx.save();
        ctx.globalAlpha = .16 + (1 - Math.max(0, enemy.chargeCooldown) / 470) * .3;
        ctx.strokeStyle = PALETTE.amber;
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 7]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(aim.x * 210, aim.y * 210); ctx.stroke();
        ctx.restore();
      }

      const facing = Math.atan2(enemy.vy, enemy.vx);
      ctx.rotate(facing);
      if (enemy.type === 'wisp') {
        ctx.strokeStyle = PALETTE.magenta;
        ctx.fillStyle = 'rgba(255,79,163,.15)';
        ctx.shadowColor = PALETTE.magenta;
        ctx.shadowBlur = this._glow(3, 7, 10);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(18 + pulse * 2, 0); ctx.lineTo(-10, -11); ctx.lineTo(-5, 0); ctx.lineTo(-10, 11); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha = .24;
        ctx.beginPath(); ctx.arc(0, 0, 21 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = .32;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-25 - pulse * 9, 0); ctx.stroke();
      } else if (enemy.type === 'striker') {
        ctx.strokeStyle = '#ff7dbe';
        ctx.fillStyle = 'rgba(255,79,163,.12)';
        ctx.shadowColor = PALETTE.magenta;
        ctx.shadowBlur = this._glow(3, 7, 10);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const ang = i / 6 * Math.PI * 2;
          const r = i % 2 ? 12 : 20;
          const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = .28;
        ctx.rotate(-facing + this.time * .0015);
        ctx.beginPath(); ctx.arc(0, 0, 27 + pulse * 2, 0, Math.PI * 1.2); ctx.stroke();
        ctx.rotate(facing - this.time * .0015);
        ctx.fillStyle = '#fff'; ctx.globalAlpha = .78; ctx.fillRect(5, -2, 8, 4);
      } else {
        const charging = enemy.chargeMs > 0;
        ctx.strokeStyle = charging ? '#fff4d2' : PALETTE.amber;
        ctx.fillStyle = charging ? 'rgba(255,230,170,.2)' : 'rgba(255,179,77,.12)';
        ctx.shadowColor = PALETTE.amber;
        ctx.shadowBlur = charging ? this._glow(5, 11, 16) : this._glow(4, 8, 11);
        ctx.lineWidth = charging ? 3.7 : 2.4;
        this._diamond(ctx, 0, 0, 20 + (charging ? pulse * 5 : 0));
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha = charging ? .72 : .45;
        ctx.rotate(Math.PI / 4 + this.time * .0007);
        this._diamond(ctx, 0, 0, 29); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawTrail(ctx, sim) {
    const trail = sim.trail;
    if (trail.length < 2) return;
    const start = trail[0];
    const near = Math.hypot(sim.player.x - start.x, sim.player.y - start.y) < 52 && sim.trailLength > 185;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (near && trail.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i += 1) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.closePath();
      const fill = ctx.createRadialGradient(sim.player.x, sim.player.y, 10, sim.player.x, sim.player.y, 240);
      fill.addColorStop(0, 'rgba(114,246,255,.12)');
      fill.addColorStop(.65, 'rgba(114,246,255,.035)');
      fill.addColorStop(1, 'rgba(255,79,163,.025)');
      ctx.fillStyle = fill;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i += 1) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.lineWidth = 12;
    ctx.globalAlpha = .13 + sim.chainProgress * .05;
    ctx.strokeStyle = PALETTE.cyan;
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = this._glow(5, 10, 15);
    ctx.stroke();
    ctx.globalAlpha = .94;
    ctx.lineWidth = near ? 2.9 : 2.4;
    ctx.strokeStyle = this.highContrast || near ? '#ffffff' : PALETTE.cyan;
    ctx.stroke();

    const pulse = .5 + Math.sin(this.time * .015) * .5;
    ctx.globalAlpha = near ? 1 : .72;
    ctx.strokeStyle = near ? '#ffffff' : PALETTE.cyan;
    ctx.lineWidth = near ? 3.3 : 1.7;
    ctx.beginPath(); ctx.arc(start.x, start.y, 12 + pulse * (near ? 9 : 4), 0, Math.PI * 2); ctx.stroke();
    if (near) {
      ctx.globalAlpha = .28 + pulse * .2;
      ctx.beginPath(); ctx.arc(start.x, start.y, 27 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawPlayer(ctx, sim) {
    const p = sim.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    const hitBlink = p.invulnerableMs > 0 && Math.floor(p.invulnerableMs / 70) % 2 === 0;
    const dash = p.dashMs > 0;
    const pulse = .5 + Math.sin(this.time * .012) * .5;

    if (p.shield > 0) {
      ctx.save();
      ctx.globalAlpha = hitBlink ? .12 : .2 + p.shield * .025;
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 8]);
      ctx.rotate(-this.time * .001);
      ctx.beginPath(); ctx.arc(0, 0, 25 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (sim.sectorGraceMs > 0) {
      ctx.save();
      const grace = clamp(sim.sectorGraceMs / 900, 0, 1);
      ctx.globalAlpha = .22 * grace;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 34 + (1 - grace) * 15, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(p.angle);
    ctx.globalAlpha = hitBlink ? .32 : 1;

    if (dash) {
      ctx.save();
      ctx.globalAlpha = .25;
      ctx.strokeStyle = PALETTE.cyan;
      ctx.shadowBlur = this._glow(5, 12, 17);
      ctx.shadowColor = PALETTE.cyan;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath(); ctx.moveTo(-18 - i * 12, -7 + i * 3); ctx.lineTo(-64 - i * 17, 0); ctx.lineTo(-18 - i * 12, 7 - i * 3); ctx.stroke();
      }
      ctx.restore();
    }

    if (p.weaving) {
      ctx.save();
      ctx.globalAlpha = .18 + pulse * .08;
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath(); ctx.arc(-3, 0, 24 + pulse * 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = this._glow(5, 9, 13);
    ctx.fillStyle = '#e9feff';
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-7, -11); ctx.lineTo(-2, -3); ctx.lineTo(-12, 0); ctx.lineTo(-2, 3); ctx.lineTo(-7, 11); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETTE.magenta;
    ctx.shadowColor = PALETTE.magenta;
    ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-18 - (dash ? 14 : 5), 0); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  _drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = this._glow(0, 3, 5);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.4, p.size * alpha), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {GameSimulation} sim */
  _drawArenaMask(ctx, sim) {
    const m = WORLD.margin;
    const theme = this._sectorTheme(sim.sector);
    const pulse = .5 + Math.sin(this.time * .0032) * .5;
    ctx.save();
    ctx.strokeStyle = this.highContrast ? 'rgba(255,255,255,.5)' : theme.border;
    ctx.lineWidth = 2;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = this._glow(2, 5, 8);
    ctx.beginPath(); this._roundedRect(ctx, m, m, WORLD.width - 2 * m, WORLD.height - 2 * m, 24); ctx.stroke();

    ctx.globalAlpha = .35 + pulse * .15;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    const c = 42;
    for (const [x, y, sx, sy] of [
      [m, m, 1, 1],
      [WORLD.width - m, m, -1, 1],
      [m, WORLD.height - m, 1, -1],
      [WORLD.width - m, WORLD.height - m, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 8, y);
      ctx.lineTo(x + sx * c, y);
      ctx.moveTo(x, y + sy * 8);
      ctx.lineTo(x, y + sy * c);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx @param {string} color @param {number} strength */
  _drawFlash(ctx, color, strength) {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = Math.min(.19, strength * .17);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    ctx.restore();
  }

  /** @param {number} dtMs */
  _updateFx(dtMs) {
    const dt = Math.min(dtMs, 50) / 1000;
    for (const p of this.particles) {
      p.life -= dtMs;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag; p.vy *= drag;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const flash of this.loopFlashes) flash.life -= dtMs;
    this.loopFlashes = this.loopFlashes.filter((f) => f.life > 0);
  }

  /** @param {number} x @param {number} y @param {string} color @param {number} count @param {number} speed */
  _burst(x, y, color, count, speed) {
    const qualityMul = this.quality === 'low' ? .45 : this.quality === 'medium' ? .72 : 1;
    const motionMul = this.reducedMotion ? .35 : 1;
    const total = Math.max(3, Math.round(count * qualityMul * motionMul));
    for (let i = 0; i < total; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const s = speed * (.35 + Math.random() * .75);
      const life = 260 + Math.random() * 430;
      this.particles.push({ x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, life, maxLife: life, size: 1.4 + Math.random() * 2.9, color, drag: .94 });
    }
  }

  /** @param {number} ms @param {number} power */
  _shake(ms, power) {
    if (!this.cameraShake || this.reducedMotion) return;
    this.shakeMs = Math.max(this.shakeMs, ms);
    this.shakePower = Math.max(this.shakePower, power);
  }

  /** @param {number} now */
  _trackPerf(now) {
    const frame = now - this.lastRenderAt;
    this.lastRenderAt = now;
    if (frame > 0 && frame < 1000) {
      this.frameTimes.push(frame);
      if (this.frameTimes.length > 240) this.frameTimes.shift();
    }
    this.frameCount += 1;
    if (now - this.fpsWindowStart >= 1000) {
      this.fps = this.frameCount * 1000 / (now - this.fpsWindowStart);
      this.frameCount = 0;
      this.fpsWindowStart = now;
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * .95)] ?? 16.7;
      const renderSorted = [...this.renderCostTimes].sort((a, b) => a - b);
      const renderP95 = renderSorted[Math.floor(renderSorted.length * .95)] ?? 0;
      window.__THREAD_NULL_METRICS__ = { fps: Number(this.fps.toFixed(1)), frameP95Ms: Number(p95.toFixed(2)), renderP95Ms: Number(renderP95.toFixed(2)), particles: this.particles.length, quality: this.quality };
    }
  }

  /** @param {number} count @returns {BackgroundNode[]} */
  _makeBackgroundNodes(count) {
    let seed = 0x5f3759df;
    const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };
    return Array.from({ length: count }, (_, i) => ({
      x: next(), y: next(), depth: .25 + next() * .75, alpha: .25 + next() * .75,
      size: .35 + next() * 1.5, tint: i % 9 === 0 ? '#ff4fa3' : i % 5 === 0 ? '#ffb34d' : '#72f6ff',
    }));
  }

  /** @param {number} sector */
  _sectorTheme(sector) {
    if (sector === 2) return { accent: '#56e7ff', border: 'rgba(86,231,255,.38)', backdrop: '#0b1828', floorTop: '#07192a', scan: 'rgba(86,231,255,.08)' };
    if (sector === 3) return { accent: '#ffb34d', border: 'rgba(255,179,77,.34)', backdrop: '#171421', floorTop: '#151321', scan: 'rgba(255,179,77,.075)' };
    if (sector === 4) return { accent: '#ff5fbd', border: 'rgba(255,95,189,.38)', backdrop: '#1a0d1c', floorTop: '#180d1a', scan: 'rgba(255,95,189,.08)' };
    if (sector >= 5) return { accent: '#ff4fa3', border: 'rgba(255,79,163,.46)', backdrop: '#1c0817', floorTop: '#190914', scan: 'rgba(255,79,163,.095)' };
    return { accent: PALETTE.cyan, border: 'rgba(114,246,255,.36)', backdrop: '#0a1726', floorTop: '#081626', scan: 'rgba(114,246,255,.075)' };
  }

  /** @param {number} low @param {number} medium @param {number} high */
  _glow(low, medium, high) { return this.quality === 'low' ? low : this.quality === 'medium' ? medium : high; }

  /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
  _roundedRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r */
  _diamond(ctx, x, y, r) {
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  }
}
