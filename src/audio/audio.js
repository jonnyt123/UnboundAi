// @ts-check

export class AudioDirector {
  constructor() {
    /** @type {AudioContext|null} */ this.ctx = null;
    /** @type {GainNode|null} */ this.master = null;
    /** @type {GainNode|null} */ this.musicBus = null;
    /** @type {GainNode|null} */ this.sfxBus = null;
    this.settings = { masterVolume: .8, musicVolume: .6, sfxVolume: .85 };
    this.musicTimer = 0;
    this.musicStep = 0;
    this.intensity = 0;
    this.running = false;
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -8;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.applySettings(this.settings);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  async suspend() {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  startMusic() {
    if (!this.ctx || this.running) return;
    this.running = true;
    this.musicStep = 0;
    this._musicTick();
    this.musicTimer = window.setInterval(() => this._musicTick(), 360);
  }

  stopMusic() {
    this.running = false;
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  /** @param {{masterVolume:number,musicVolume:number,sfxVolume:number}} settings */
  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.masterVolume, now, .02);
    this.musicBus.gain.setTargetAtTime(settings.musicVolume * .33, now, .02);
    this.sfxBus.gain.setTargetAtTime(settings.sfxVolume * .7, now, .02);
  }

  /** @param {number} sector */
  setIntensity(sector) { this.intensity = Math.max(0, Math.min(1, (sector - 1) / 4)); }

  _musicTick() {
    if (!this.ctx || !this.musicBus || !this.running || this.ctx.state !== 'running') return;
    const step = this.musicStep++;
    const base = [55, 55, 61.74, 49][Math.floor(step / 8) % 4];
    const notes = [1, 1.5, 2, 1.25, 1.5, 2.25, 2, 1.25];
    const freq = base * notes[step % notes.length];
    const now = this.ctx.currentTime;
    this._tone(freq, now, .21, .032 + this.intensity * .018, 'triangle', this.musicBus);
    if (step % 2 === 0) this._tone(base / 2, now, .30, .026, 'sine', this.musicBus);
    if (this.intensity > .42 && step % 2 === 1) this._noise(now, .035, .012 + this.intensity * .012, this.musicBus, 900);
  }

  /** @param {number} frequency @param {number} start @param {number} duration @param {number} gain @param {OscillatorType} type @param {AudioNode} destination */
  _tone(frequency, start, duration, gain, type, destination) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + .012);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(amp); amp.connect(destination);
    osc.start(start); osc.stop(start + duration + .03);
  }

  /** @param {number} start @param {number} duration @param {number} gain @param {AudioNode} destination @param {number} filterHz */
  _noise(start, duration, gain, destination, filterHz = 1400) {
    if (!this.ctx) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = filterHz; filter.Q.value = .8;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter); filter.connect(amp); amp.connect(destination);
    source.start(start); source.stop(start + duration + .01);
  }

  /** @param {string} type */
  play(type) {
    const bus = this.sfxBus;
    if (!this.ctx || !bus || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (type === 'weaveStart') {
      this._tone(330, now, .10, .08, 'sine', bus);
      this._tone(660, now + .035, .09, .035, 'triangle', bus);
    } else if (type === 'loopClosed') {
      this._tone(220, now, .11, .12, 'sawtooth', bus);
      this._tone(440, now + .04, .14, .09, 'triangle', bus);
      this._tone(880, now + .08, .16, .055, 'sine', bus);
    } else if (type === 'enemySealed') {
      this._tone(610, now, .08, .06, 'square', bus);
      this._noise(now, .05, .035, bus, 2100);
    } else if (type === 'multiSeal') {
      [540, 720, 960].forEach((f, i) => this._tone(f, now + i * .035, .14 + i * .02, .055, i === 2 ? 'sine' : 'triangle', bus));
      this._noise(now, .07, .028, bus, 2500);
    } else if (type === 'chainBreak') {
      this._tone(240, now, .09, .035, 'square', bus);
      this._tone(170, now + .045, .13, .028, 'triangle', bus);
    } else if (type === 'dash') {
      this._noise(now, .12, .08, bus, 1000);
      this._tone(145, now, .14, .06, 'sawtooth', bus);
    } else if (type === 'playerHit') {
      this._noise(now, .18, .14, bus, 430);
      this._tone(90, now, .24, .13, 'sawtooth', bus);
    } else if (type === 'lockBreak') {
      this._tone(120, now, .18, .11, 'square', bus);
      this._tone(480, now + .06, .22, .08, 'triangle', bus);
    } else if (type === 'bossHit') {
      this._noise(now, .22, .14, bus, 700);
      this._tone(72, now, .32, .16, 'sawtooth', bus);
      this._tone(288, now + .07, .21, .08, 'square', bus);
    } else if (type === 'sectorClear') {
      [293.66, 440, 587.33].forEach((f, i) => this._tone(f, now + i * .09, .22, .07, 'triangle', bus));
    } else if (type === 'victory') {
      [220, 330, 440, 660].forEach((f, i) => this._tone(f, now + i * .12, .45, .075, 'triangle', bus));
    } else if (type === 'gameOver') {
      [180, 145, 110, 82].forEach((f, i) => this._tone(f, now + i * .12, .28, .07, 'sawtooth', bus));
    } else if (type === 'enemyFire') {
      this._tone(240, now, .055, .023, 'square', bus);
    }
  }
}
