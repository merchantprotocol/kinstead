/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = (G.K = G.K || {});

  class RNG {
    constructor(seed) { this.s = seed >>> 0 || 1; }
    next() {
      let t = (this.s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(a) { return a[Math.floor(this.next() * a.length)]; }
    chance(p) { return this.next() < p; }
  }

  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  class Noise {
    constructor(seed) { this.seed = seed | 0; }
    value(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const s = this.seed;
      const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    fbm(x, y, oct = 4) {
      let f = 0, amp = 0.5, n = 0;
      for (let i = 0; i < oct; i++) { f += amp * this.value(x, y); n += amp; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; amp *= 0.5; }
      return f / n;
    }
    /* Worley: returns [d1, d2, cellId] */
    worley(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      let d1 = 9, d2 = 9, id = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = xi + i, cy = yi + j;
        const px = cx + 0.15 + 0.7 * hash2(cx, cy, this.seed + 11);
        const py = cy + 0.15 + 0.7 * hash2(cx, cy, this.seed + 23);
        const d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; id = hash2(cx, cy, this.seed + 31); } else if (d < d2) d2 = d;
      }
      return [d1, d2, id];
    }
  }

  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => B4[((y & 3) << 2) | (x & 3)];

  function hex(h) {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const ramp = (...cols) => cols.map(hex);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

  /* Pick ramp entry from 0..1 value with ordered dither of given strength */
  function rampPick(r, v, x, y, dither = 0.5) {
    const f = v * r.length + (bayer(x, y) - 0.5) * dither;
    return r[Math.max(0, Math.min(r.length - 1, Math.floor(f)))];
  }

  class PixelBuffer {
    constructor(w, h) { this.w = w; this.h = h; this.data = new Uint8ClampedArray(w * h * 4); }
    idx(x, y) { return (y * this.w + x) * 4; }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, c, a = 255) {
      if (!this.inside(x, y)) return;
      const i = this.idx(x, y);
      this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a;
    }
    get(x, y) { const i = this.idx(x, y); return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]; }
    alpha(x, y) { return this.inside(x, y) ? this.data[this.idx(x, y) + 3] : 0; }
    fill(c, a = 255) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c, a); }
    blit(src, ox, oy) {
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const i = src.idx(x, y);
        if (src.data[i + 3] > 0) this.set(ox + x, oy + y, [src.data[i], src.data[i + 1], src.data[i + 2]], src.data[i + 3]);
      }
    }
  }

  Object.assign(K, { RNG, Noise, hash2, bayer, hex, ramp, mix, rampPick, PixelBuffer });
})(typeof window !== 'undefined' ? window : globalThis);
