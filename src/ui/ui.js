// @ts-check
import { DEFAULT_SETTINGS, SECTORS } from '../config.js';
import { loadProgress, loadSettings, saveProgress, saveSettings } from '../core/storage.js';

export class GameUI {
  /** @param {{onStart:()=>void,onPause:()=>void,onResume:()=>void,onReturnTitle:()=>void,onRetry:()=>void,onSettings:(settings:any)=>void}} callbacks */
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.app = must('#app');
    this.titleScreen = must('#titleScreen');
    this.hud = must('#hud');
    this.pausePanel = must('#pausePanel');
    this.settingsPanel = must('#settingsPanel');
    this.howPanel = must('#howPanel');
    this.resultPanel = must('#resultPanel');
    this.touchControls = must('#touchControls');
    this.rotateHint = must('#rotateHint');
    this.tutorialPrompt = must('#tutorialPrompt');
    this.sectorBanner = must('#sectorBanner');
    this.progress = loadProgress();
    this.settings = loadSettings();
    this.lastPhase = 'title';
    this._bind();
    this._applySettingsToControls();
    this._updateBest();
    this._updateTouchVisibility();
    this._updateRotateHint();
    window.addEventListener('resize', () => {
      this._updateTouchVisibility();
      this._updateRotateHint();
    });
  }

  _bind() {
    must('#startButton').addEventListener('click', () => this.callbacks.onStart());
    must('#howButton').addEventListener('click', () => this._openPanel(this.howPanel));
    must('#settingsButton').addEventListener('click', () => this._openPanel(this.settingsPanel));
    must('#pauseSettingsButton').addEventListener('click', () => {
      this.pausePanel.hidden = true;
      this._openPanel(this.settingsPanel, true);
    });
    must('#pauseButton').addEventListener('click', () => this.callbacks.onPause());
    must('#resumeButton').addEventListener('click', () => this.callbacks.onResume());
    must('#returnTitleButton').addEventListener('click', () => this.callbacks.onReturnTitle());
    must('#retryButton').addEventListener('click', () => this.callbacks.onRetry());
    must('#resultTitleButton').addEventListener('click', () => this.callbacks.onReturnTitle());
    document.querySelectorAll('[data-close-panel]').forEach((el) => el.addEventListener('click', () => this._closeTopPanel()));

    const controls = ['masterVolume','musicVolume','sfxVolume','qualitySelect','shakeToggle','motionToggle','contrastToggle','uiScale'];
    for (const id of controls) {
      const node = must(`#${id}`);
      node.addEventListener('input', () => this._readSettingsFromControls());
      node.addEventListener('change', () => this._readSettingsFromControls());
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.settingsPanel.hidden) {
        event.preventDefault(); this._closeTopPanel();
      } else if (event.key === 'Escape' && !this.howPanel.hidden) {
        event.preventDefault(); this._closeTopPanel();
      }
    });
  }

  /** @param {HTMLElement} panel @param {boolean} [fromPause] */
  _openPanel(panel, fromPause = false) {
    panel.dataset.fromPause = fromPause ? '1' : '0';
    panel.hidden = false;
    const first = panel.querySelector('button, input, select');
    if (first instanceof HTMLElement) first.focus();
  }

  _closeTopPanel() {
    for (const panel of [this.howPanel, this.settingsPanel]) {
      if (!panel.hidden) {
        const fromPause = panel.dataset.fromPause === '1';
        panel.hidden = true;
        panel.dataset.fromPause = '0';
        if (fromPause) this.pausePanel.hidden = false;
        return;
      }
    }
  }

  _applySettingsToControls() {
    setValue('#masterVolume', this.settings.masterVolume);
    setValue('#musicVolume', this.settings.musicVolume);
    setValue('#sfxVolume', this.settings.sfxVolume);
    setValue('#qualitySelect', this.settings.quality);
    setChecked('#shakeToggle', this.settings.cameraShake);
    setChecked('#motionToggle', this.settings.reducedMotion);
    setChecked('#contrastToggle', this.settings.highContrast);
    setValue('#uiScale', this.settings.uiScale);
    this._applySettingsClass();
    this.callbacks.onSettings(this.settings);
  }

  _readSettingsFromControls() {
    const quality = String(value('#qualitySelect'));
    this.settings = {
      ...DEFAULT_SETTINGS,
      masterVolume: Number(value('#masterVolume')),
      musicVolume: Number(value('#musicVolume')),
      sfxVolume: Number(value('#sfxVolume')),
      quality: /** @type {'low'|'medium'|'high'} */ (['low','medium','high'].includes(quality) ? quality : 'high'),
      cameraShake: checked('#shakeToggle'),
      reducedMotion: checked('#motionToggle'),
      highContrast: checked('#contrastToggle'),
      uiScale: Number(value('#uiScale')),
    };
    saveSettings(this.settings);
    this._applySettingsClass();
    this.callbacks.onSettings(this.settings);
  }

  _applySettingsClass() {
    this.app.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.app.classList.toggle('high-contrast', this.settings.highContrast);
    document.documentElement.style.setProperty('--ui-scale', String(this.settings.uiScale));
  }

  /** @param {any} sim */
  update(sim) {
    this.app.dataset.phase = sim.phase;
    if (sim.phase !== this.lastPhase) this._onPhaseChange(sim);
    this.lastPhase = sim.phase;
    const gameplayVisible = ['playing','intermission','paused'].includes(sim.phase);
    this.hud.hidden = !gameplayVisible;
    this.titleScreen.hidden = sim.phase !== 'title';
    this.pausePanel.hidden = sim.phase !== 'paused' || !this.settingsPanel.hidden;

    if (gameplayVisible) {
      text('#sectorValue', String(sim.sector).padStart(2, '0'));
      text('#objectiveValue', sim.objectiveText);
      text('#scoreValue', String(Math.max(0, Math.floor(sim.score))).padStart(6, '0'));
      text('#comboValue', sim.combo > 1 ? `×${sim.combo}` : '');
      const energy = must('#energyBar');
      const dash = must('#dashBar');
      if (energy instanceof HTMLElement) energy.style.transform = `scaleX(${Math.max(0, sim.player.energy / 100)})`;
      if (dash instanceof HTMLElement) dash.style.transform = `scaleX(${Math.max(0, 1 - sim.player.dashCooldownMs / 1850)})`;
      this._renderShield(sim.player.shield, sim.player.maxShield);
      this.tutorialPrompt.hidden = !sim.tutorialText;
      if (sim.tutorialText) this.tutorialPrompt.textContent = sim.tutorialText;
    } else this.tutorialPrompt.hidden = true;
    this._updateTouchVisibility();
  }

  /** @param {any} sim */
  _onPhaseChange(sim) {
    if (sim.phase === 'title') {
      this.resultPanel.hidden = true;
      this.pausePanel.hidden = true;
      this.settingsPanel.hidden = true;
      this.howPanel.hidden = true;
      this._updateBest();
    }
    if (sim.phase === 'gameover' || sim.phase === 'victory') this._showResult(sim.result);
  }

  /** @param {number} current @param {number} max */
  _renderShield(current, max) {
    const root = must('#shieldPips');
    if (root.children.length !== max) {
      root.innerHTML = '';
      for (let i = 0; i < max; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'shield-pip'; root.appendChild(pip);
      }
    }
    [...root.children].forEach((child, index) => child.classList.toggle('active', index < current));
    root.setAttribute('aria-label', `Shield integrity ${current} of ${max}`);
  }

  /** @param {any} result */
  _showResult(result) {
    if (!result) return;
    this.resultPanel.hidden = false;
    text('#resultKicker', result.victory ? 'PROTOCOL COMPLETE' : 'SIGNAL LOST');
    text('#resultGrade', result.grade);
    text('#resultTitle', result.victory ? 'SIGNAL COLLAPSED' : 'THREAD SEVERED');
    text('#resultCopy', result.victory ? 'The null core is silent. The lattice remembers your route.' : 'The breach held you. Re-enter with a cleaner line.');
    text('#resultScore', String(result.score).padStart(6, '0'));
    text('#resultTime', formatTime(result.timeMs));
    text('#resultSealed', String(result.sealed));
    text('#resultCombo', `×${result.bestCombo}`);
    this.progress.runs += 1;
    if (result.score > this.progress.bestScore) this.progress.bestScore = result.score;
    if (result.victory && (this.progress.bestTimeMs === 0 || result.timeMs < this.progress.bestTimeMs)) this.progress.bestTimeMs = result.timeMs;
    saveProgress(this.progress);
    this._updateBest();
    window.setTimeout(() => must('#retryButton').focus(), 80);
  }

  /** @param {number} sector */
  showSectorBanner(sector) {
    const config = SECTORS[sector - 1];
    if (!config) return;
    text('#sectorBannerTitle', sector === 5 ? 'NULL CORE' : `SECTOR ${String(sector).padStart(2,'0')}`);
    text('#sectorBannerSub', config.sub);
    const kicker = this.sectorBanner.querySelector('.sector-kicker');
    if (kicker) kicker.textContent = config.label;
    this.sectorBanner.hidden = false;
    this.sectorBanner.getAnimations().forEach((anim) => anim.cancel());
    // Force a new CSS animation instance without layout-sensitive timing logic.
    this.sectorBanner.style.animation = 'none';
    void this.sectorBanner.offsetWidth;
    this.sectorBanner.style.animation = '';
    window.setTimeout(() => { this.sectorBanner.hidden = true; }, 1550);
  }

  _updateBest() { text('#bestScoreLabel', `BEST SIGNAL: ${String(this.progress.bestScore).padStart(6, '0')}`); }

  _updateTouchVisibility() {
    const coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const gameplay = ['playing','intermission'].includes(this.app.dataset.phase || 'title');
    this.touchControls.hidden = !(coarse && gameplay);
  }

  _updateRotateHint() {
    const coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.rotateHint.hidden = !(coarse && window.innerHeight > window.innerWidth && window.innerWidth < 820);
  }
}

/** @param {string} selector */
function must(selector) {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`Missing UI element: ${selector}`);
  return node;
}
/** @param {string} selector @param {string} value */
function text(selector, value) { must(selector).textContent = value; }
/** @param {string} selector */
function value(selector) { const n = document.querySelector(selector); return n instanceof HTMLInputElement || n instanceof HTMLSelectElement ? n.value : ''; }
/** @param {string} selector @param {string|number} v */
function setValue(selector, v) { const n = document.querySelector(selector); if (n instanceof HTMLInputElement || n instanceof HTMLSelectElement) n.value = String(v); }
/** @param {string} selector */
function checked(selector) { const n = document.querySelector(selector); return n instanceof HTMLInputElement ? n.checked : false; }
/** @param {string} selector @param {boolean} v */
function setChecked(selector, v) { const n = document.querySelector(selector); if (n instanceof HTMLInputElement) n.checked = v; }
/** @param {number} ms */
function formatTime(ms) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }
