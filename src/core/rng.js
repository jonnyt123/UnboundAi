// @ts-check
export class SeededRng {
  /** @param {number} seed */
  constructor(seed = 0x4e554c4c) { this.state = seed >>> 0 || 1; }
  next() {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }
  /** @param {number} min @param {number} max */
  range(min, max) { return min + (max - min) * this.next(); }
  /** @template T @param {T[]} items */
  pick(items) { return items[Math.floor(this.next() * items.length)] ?? items[0]; }
}
