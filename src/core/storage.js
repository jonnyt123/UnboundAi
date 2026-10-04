// @ts-check
import { DEFAULT_SETTINGS } from '../config.js';

const SETTINGS_KEY = 'thread-null.settings.v1';
const PROGRESS_KEY = 'thread-null.progress.v1';

/** @typedef {{masterVolume:number,musicVolume:number,sfxVolume:number,quality:'low'|'medium'|'high',cameraShake:boolean,reducedMotion:boolean,highContrast:boolean,uiScale:number}} Settings */
/** @typedef {{version:1,bestScore:number,bestTimeMs:number,runs:number}} Progress */

/** @returns {Storage|null} */
function getStorage() {
  try { return window.localStorage; } catch { return null; }
}

/** @param {string|null} raw @returns {any} */
function safeParse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** @returns {Settings} */
export function loadSettings() {
  const storage = getStorage();
  if (!storage) return /** @type {Settings} */ ({ ...DEFAULT_SETTINGS });
  let raw = null;
  try { raw = storage.getItem(SETTINGS_KEY); } catch { return /** @type {Settings} */ ({ ...DEFAULT_SETTINGS }); }
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== 'object') return /** @type {Settings} */ ({ ...DEFAULT_SETTINGS });
  const quality = ['low', 'medium', 'high'].includes(parsed.quality) ? parsed.quality : DEFAULT_SETTINGS.quality;
  return /** @type {Settings} */ ({
    ...DEFAULT_SETTINGS,
    ...parsed,
    quality,
    masterVolume: clamp01(Number(parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume)),
    musicVolume: clamp01(Number(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume)),
    sfxVolume: clamp01(Number(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume)),
    uiScale: Math.max(0.9, Math.min(1.2, Number(parsed.uiScale ?? 1))),
  });
}

/** @param {Settings} settings */
export function saveSettings(settings) {
  const storage = getStorage();
  if (!storage) return;
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage can be unavailable */ }
}

/** @returns {Progress} */
export function loadProgress() {
  const storage = getStorage();
  if (!storage) return { version: 1, bestScore: 0, bestTimeMs: 0, runs: 0 };
  let raw = null;
  try { raw = storage.getItem(PROGRESS_KEY); } catch { return { version: 1, bestScore: 0, bestTimeMs: 0, runs: 0 }; }
  const parsed = safeParse(raw);
  if (!parsed || parsed.version !== 1) return { version: 1, bestScore: 0, bestTimeMs: 0, runs: 0 };
  return {
    version: 1,
    bestScore: finiteNonNegative(parsed.bestScore),
    bestTimeMs: finiteNonNegative(parsed.bestTimeMs),
    runs: finiteNonNegative(parsed.runs),
  };
}

/** @param {Progress} progress */
export function saveProgress(progress) {
  const storage = getStorage();
  if (!storage) return;
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* storage can be unavailable */ }
}

export function clearProgress() {
  const storage = getStorage();
  if (!storage) return;
  try { storage.removeItem(PROGRESS_KEY); } catch { /* noop */ }
}

/** @param {number} value */
function clamp01(value) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
/** @param {unknown} value */
function finiteNonNegative(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
