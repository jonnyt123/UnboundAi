// @ts-check
import { WORLD } from './config.js';
import { AudioDirector } from './audio/audio.js';
import { GameSimulation } from './core/simulation.js';
import { InputManager } from './input/actions.js';
import { GameRenderer } from './render/renderer.js';
import { GameUI } from './ui/ui.js';

const canvas = document.querySelector('#game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Game canvas not found.');

try {
  startGame(new GameRenderer(canvas));
} catch {
  const fallback = document.querySelector('#compatibilityPanel');
  if (fallback instanceof HTMLElement) fallback.hidden = false;
  canvas.hidden = true;
  const title = document.querySelector('#titleScreen');
  if (title instanceof HTMLElement) title.hidden = true;
}
window.__THREAD_NULL_READY__ = true;

/** @param {GameRenderer} renderer */
function startGame(renderer) {
  const simulation = new GameSimulation();
  const input = new InputManager();
  const audio = new AudioDirector();

  const ui = new GameUI({
    onStart: async () => {
      await audio.unlock();
      audio.startMusic();
      simulation.startRun();
      input.setEnabled(true);
    },
    onPause: () => simulation.pause(),
    onResume: async () => {
      await audio.resume();
      simulation.resume();
    },
    onReturnTitle: () => {
      simulation.returnToTitle();
      input.setEnabled(false);
      audio.setIntensity(0);
      audio.stopMusic();
    },
    onRetry: async () => {
      await audio.unlock();
      audio.startMusic();
      simulation.startRun();
      input.setEnabled(true);
    },
    onSettings: (next) => {
      audio.applySettings(next);
      renderer.applySettings(next.quality, next.reducedMotion, next.cameraShake, next.highContrast);
    },
  });

  let previous = performance.now();
  let accumulator = 0;
  /** @param {number} now */
  function frame(now) {
    const elapsed = Math.min(100, now - previous);
    previous = now;
    accumulator += elapsed;
    const action = input.consume();
    while (accumulator >= WORLD.fixedStepMs) {
      simulation.update(WORLD.fixedStepMs, action);
      accumulator -= WORLD.fixedStepMs;
    }
    const events = simulation.drainEvents();
    if (events.length) {
      renderer.handleEvents(events);
      for (const event of events) {
        audio.play(event.type);
        if (event.type === 'sectorStart') {
          audio.setIntensity(event.sector);
          ui.showSectorBanner(event.sector);
        } else if (event.type === 'pause') {
          void audio.suspend();
        } else if (event.type === 'resume') {
          void audio.resume();
        } else if (event.type === 'victory' || event.type === 'gameOver') {
          audio.stopMusic();
        }
      }
    }
    renderer.render(simulation, elapsed);
    ui.update(simulation);
    input.setEnabled(simulation.phase === 'playing' || simulation.phase === 'intermission');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function autoPause() {
    if (simulation.phase === 'playing' || simulation.phase === 'intermission') simulation.pause();
    void audio.suspend();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  window.addEventListener('blur', autoPause);

  if (['127.0.0.1', 'localhost', 'thread-null.test'].includes(location.hostname)) {
    const params = new URLSearchParams(location.search);
    if (params.get('e2e') === '1') {
      window.__THREAD_NULL_TEST__ = {
        start: () => { simulation.startRun(); input.setEnabled(true); },
        forceLoop: () => simulation.debugForceLoop(),
        dense: () => simulation.debugDenseState(),
        victory: () => simulation.debugVictory(),
        failure: () => simulation.debugFailure(),
        pause: () => simulation.pause(),
        resume: () => simulation.resume(),
        state: () => ({ phase: simulation.phase, score: simulation.score, sector: simulation.sector, enemies: simulation.enemies.length, bullets: simulation.bullets.length }),
      };
    }
  }
}
