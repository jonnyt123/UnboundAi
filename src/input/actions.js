// @ts-check
import { normalize } from '../core/math.js';

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.touchVector = { x: 0, y: 0 };
    this.touchWeave = false;
    this.dashQueued = false;
    this.pauseQueued = false;
    this.enabled = false;
    this._stickPointer = null;
    this._stickOrigin = { x: 0, y: 0 };
    this._bindKeyboard();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift','p','escape'].includes(key)) {
        if (this.enabled) event.preventDefault();
      }
      if ((key === 'p' || key === 'escape') && !event.repeat) this.pauseQueued = true;
      if (key === 'shift' && !event.repeat) this.dashQueued = true;
      this.keys.add(key);
    }, { passive: false });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindTouch() {
    const zone = document.getElementById('stickZone');
    const knob = document.getElementById('stickKnob');
    const weave = document.getElementById('weaveButton');
    const dash = document.getElementById('dashButton');
    if (!zone || !knob || !weave || !dash) return;

    const updateStick = (/** @type {PointerEvent} */ event) => {
      const dx = event.clientX - this._stickOrigin.x;
      const dy = event.clientY - this._stickOrigin.y;
      const max = 42;
      const len = Math.hypot(dx, dy);
      const scale = len > max ? max / len : 1;
      const x = dx * scale;
      const y = dy * scale;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      this.touchVector = { x: x / max, y: y / max };
    };
    const resetStick = () => {
      this._stickPointer = null;
      this.touchVector = { x: 0, y: 0 };
      knob.style.transform = 'translate(0px, 0px)';
    };
    zone.addEventListener('pointerdown', (event) => {
      if (!this.enabled || this._stickPointer !== null) return;
      this._stickPointer = event.pointerId;
      const rect = zone.getBoundingClientRect();
      this._stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      zone.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    zone.addEventListener('pointermove', (event) => { if (event.pointerId === this._stickPointer) updateStick(event); });
    zone.addEventListener('pointerup', (event) => { if (event.pointerId === this._stickPointer) resetStick(); });
    zone.addEventListener('pointercancel', (event) => { if (event.pointerId === this._stickPointer) resetStick(); });

    const setWeave = (/** @type {boolean} */ active) => {
      this.touchWeave = active;
      weave.classList.toggle('active', active);
    };
    weave.addEventListener('pointerdown', (event) => { event.preventDefault(); setWeave(true); weave.setPointerCapture(event.pointerId); });
    weave.addEventListener('pointerup', () => setWeave(false));
    weave.addEventListener('pointercancel', () => setWeave(false));
    dash.addEventListener('pointerdown', (event) => { event.preventDefault(); if (this.enabled) this.dashQueued = true; });
  }

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.touchVector = { x: 0, y: 0 };
      this.touchWeave = false;
    }
  }

  consume() {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    x += this.touchVector.x;
    y += this.touchVector.y;
    const dir = normalize(x, y);
    const result = {
      x: dir.x,
      y: dir.y,
      weave: this.keys.has(' ') || this.touchWeave,
      dash: this.dashQueued,
      pause: this.pauseQueued,
    };
    this.dashQueued = false;
    this.pauseQueued = false;
    return result;
  }
}
