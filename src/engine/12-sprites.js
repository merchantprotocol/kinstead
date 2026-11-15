/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead 2D-HD diorama: pixel-sprite rasterizer + original character rigs.
   Each character is authored as layered primitives (ellipse, tapered capsule, bevelled polygon)
   with a hand-tuned palette ramp. Per-pixel pseudo-normals are quantized onto the ramp
   (light from upper-left-front), then selective outlines, contact lines and hand-placed
   detail pixels are applied. Emissive pixels go to a separate glow mask for bloom. */
(function (G) {
  const K = G.K;
  const { hash2, bayer, ramp, PixelBuffer } = K;
  const L = (() => { const v = [-0.52, -0.66, 0.54]; const m = Math.hypot(...v); return v.map((c) => c / m); })();

  const PAL = {
    steel: ramp('#10131c', '#262d3d', '#3f4a60', '#617089', '#8d9bb2', '#c4cfdd', '#f3f7fc'),
    mail: ramp('#10131c', '#22283a', '#353f55', '#4d5a72', '#6f7d95'),
    red: ramp('#1a070c', '#3a0d16', '#5c1420', '#82202a', '#a8383a', '#c95a4c'),
    redDark: ramp('#12050a', '#2a0910', '#420f18', '#5e1720'),
    fur: ramp('#141218', '#29252b', '#433c40', '#5f5552', '#7f7268', '#a59683', '#d2c6b2'),
    leather: ramp('#140c09', '#2c1c13', '#4a2f1d', '#6b4527', '#8c6034'),
    gold: ramp('#2a1806', '#6b4512', '#b07a22', '#e0b44a', '#fff0a8'),
    robe: ramp('#0a0d1c', '#151d36', '#22305a', '#33487e', '#4a66a2', '#6d8cc4'),
    robeLight: ramp('#0e1426', '#1f2d50', '#334a7c', '#4f6aa6', '#7895cc', '#a8c0e6'),
    whiteFur: ramp('#3a4458', '#6b7890', '#9eabc0', '#ccd6e4', '#eef3fa', '#ffffff'),
    skinPale: ramp('#2a1a20', '#5a3a40', '#8f6560', '#c09486', '#e6c3b0', '#fbe6d6'),
    hoodIn: ramp('#05060c', '#0b0e1a', '#131a2e'),
    hair: ramp('#4a5468', '#8d98ac', '#c8d2e2', '#f0f4fa'),
    wood: ramp('#120b07', '#2a1a10', '#45301c', '#62452a', '#82603a', '#a07e52'),
    crystal: ramp('#0b2a4a', '#1c5c8c', '#2f93c6', '#62c6ec', '#a8ecff', '#e8fdff', '#ffffff'),
    ghoul: ramp('#121619', '#262e33', '#3e4a50', '#5c6a6e', '#82918f', '#aebab2', '#d6dfd4'),
    ghoul2: ramp('#14141a', '#2a2a36', '#43445a', '#626680', '#8a8fa6', '#b5b9c8', '#dcdfe8'),
    rag: ramp('#0e0c10', '#1f1b24', '#332c3a', '#4a4152', '#625869'),
    rag2: ramp('#0f0d09', '#231d14', '#3a3020', '#54462e', '#6e5e40'),
    troll: ramp('#0b1216', '#172329', '#24363d', '#344c53', '#47646a', '#5f7e82', '#7f9d9e', '#a8c2bf'),
    trollBelly: ramp('#121a1c', '#24343a', '#3a5052', '#53696a', '#6f8584', '#90a5a1', '#b5c6bf'),
    bark: ramp('#0d0806', '#22150d', '#3a2616', '#563a22', '#74522f', '#93703f'),
    bone: ramp('#3a3226', '#7a6c55', '#b6a787', '#e2d6b8', '#fffbea'),
    snow: ramp('#6d7c98', '#a6b4cc', '#d2dcea', '#f2f6fb', '#ffffff'),
  };
  const C = (h) => K.hex(h);

  /* ---------- shapes ---------- */
  class Shape {
    /* returns null or [nx, ny, nz] at pixel centre */
    sample() { return null; }
  }
  class Ellipse extends Shape {
    constructor(cx, cy, rx, ry, flat = 1) { super(); Object.assign(this, { cx, cy, rx, ry, flat }); }
    sample(x, y) {
      const nx = (x - this.cx) / this.rx, ny = (y - this.cy) / this.ry, d = nx * nx + ny * ny;
      if (d > 1) return null;
      const nz = Math.sqrt(1 - d) * this.flat + (1 - this.flat) * 0.9;
      const m = Math.hypot(nx, ny, nz);
      return [nx / m, ny / m, nz / m];
    }
  }
  class Capsule extends Shape {
    constructor(x1, y1, x2, y2, r1, r2 = r1) { super(); Object.assign(this, { x1, y1, x2, y2, r1, r2 }); }
    sample(x, y) {
      const dx = this.x2 - this.x1, dy = this.y2 - this.y1, L2 = dx * dx + dy * dy || 1;
      let t = ((x - this.x1) * dx + (y - this.y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
      const px = this.x1 + dx * t, py = this.y1 + dy * t, r = this.r1 + (this.r2 - this.r1) * t;
      const ox = (x - px) / r, oy = (y - py) / r, d = ox * ox + oy * oy;
      if (d > 1) return null;
      return [ox, oy, Math.sqrt(1 - d)];
    }
  }
  class Poly extends Shape {
    constructor(pts, bevel = 1.5, tilt = [0, 0], round = 0) {
      super(); this.pts = pts; this.bevel = bevel; this.tilt = tilt; this.round = round;
      let cx = 0, cy = 0; pts.forEach((p) => { cx += p[0]; cy += p[1]; }); this.c = [cx / pts.length, cy / pts.length];
    }
    sample(x, y) {
      const p = this.pts; let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
      }
      if (!inside) return null;
      let best = 1e9, ex = 0, ey = 0;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
        const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy);
        if (d < best) {
          best = d; let nx = -dy, ny = dx; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
          const mx = (ax + bx) / 2 - this.c[0], my = (ay + by) / 2 - this.c[1];
          if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
          ex = nx; ey = ny;
        }
      }
      let nx = this.tilt[0], ny = this.tilt[1];
      if (this.round) { nx += ((x - this.c[0]) / this.round); ny += ((y - this.c[1]) / this.round); }
      if (best < this.bevel) { const w = 1 - best / this.bevel; nx += ex * w * 1.3; ny += ey * w * 1.3; }
      const m = Math.hypot(nx, ny, 1);
      return [nx / m, ny / m, 1 / m];
    }
  }

  /* ---------- rasterizer ---------- */
  class SpriteCanvas {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.part = new Int16Array(w * h).fill(-1);
      this.ri = new Int8Array(w * h);
      this.parts = [];
      this.out = new PixelBuffer(w, h);
      this.glow = new PixelBuffer(w, h);
    }
    add(shape, pal, o = {}) { this.parts.push(Object.assign({ shape, pal, dither: 0.4, bias: 0, sep: true, outline: true }, o)); return this; }
    rasterize() {
      const { w, h } = this;
      this.parts.forEach((pt, pi) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const n = pt.shape.sample(x + 0.5, y + 0.5);
          if (!n) continue;
          if (pt.clip && !pt.clip(x, y)) continue;
          let l = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
          let v = 0.36 + 0.52 * l + pt.bias;
          if (pt.tex) v = pt.tex(x, y, v, n);
          if (pt.noise) v += (hash2(x >> (pt.noiseCell || 0), y >> (pt.noiseCell || 0), pi * 7 + 3) - 0.5) * pt.noise;
          const N = pt.pal.length;
          let idx = 1 + Math.floor(Math.max(0, Math.min(0.999, v)) * (N - 1) + (bayer(x, y) - 0.5) * pt.dither);
          if (pt.fixed !== undefined) idx = pt.fixed;
          idx = Math.max(1, Math.min(N - 1, idx));
          if (pt.spec && l > pt.spec) idx = N - 1;
          const i = y * w + x;
          this.part[i] = pi; this.ri[i] = idx;
        }
      });
    }
    rasterizeAnd(detail) { this.rasterize(); this.finish(detail); return this; }
    finish(detail) {
      const { w, h } = this, P = this.parts;
      const col = new Array(w * h).fill(null);
      for (let i = 0; i < w * h; i++) if (this.part[i] >= 0) col[i] = P[this.part[i]].pal[this.ri[i]];
      // contact lines: darken the pixel of the part BEHIND along overlaps
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const dark = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = this.part[y * w + x]; if (a < 0 || !P[a].sep) continue;
        for (const [dx, dy] of dirs) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const b = this.part[Y * w + X];
          if (b >= 0 && b < a && P[b].sep && P[b].pal !== P[a].pal) dark[Y * w + X] = 1;
          else if (b >= 0 && b < a && P[b].sep && P[a].line) dark[Y * w + X] = 1;
        }
      }
      for (let i = 0; i < w * h; i++) if (dark[i]) { const pt = P[this.part[i]];
        col[i] = pt.pal[Math.min(this.ri[i] - 1,
        1) < 0 ? 0 : (this.ri[i] > 2 ? 1 : 0)];
        }
      // external selective outline
      const outCol = new Array(w * h).fill(null);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (this.part[y * w + x] >= 0) continue;
        let best = null, lit = false;
        for (const [dx, dy] of dirs) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const b = this.part[Y * w + X]; if (b < 0 || !P[b].outline) continue;
          if (best === null || b > best) { best = b; lit = dx > 0 || dy > 0; }
        }
        if (best !== null) { const pt = P[best]; outCol[y * w + x] = pt.outlineCol || pt.pal[lit && pt.pal.length > 4 ? 1 : 0]; }
      }
      for (let i = 0; i < w * h; i++) {
        const x = i % w, y = (i / w) | 0;
        if (col[i]) this.out.set(x, y, col[i]); else if (outCol[i]) this.out.set(x, y, outCol[i]);
        const pt = this.part[i] >= 0 ? P[this.part[i]] : null;
        if (pt && pt.emis) this.glow.set(x, y, col[i]);
      }
      if (detail) detail(this.api());
      return this;
    }
    api() {
      const self = this;
      return {
        px(x, y, c, glow = false) { self.out.set(x | 0, y | 0, c); if (glow) self.glow.set(x | 0, y | 0, c); },
        glow(x, y, c) { self.glow.set(x | 0, y | 0, c); },
        line(x0, y0, x1, y1, c, glow = false) {
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let i = 0; i <= n; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), c, glow);
        },
        has(x, y) { return self.out.alpha(x | 0, y | 0) > 0; },
        partAt(x, y) { return self.out.inside(x, y) ? self.part[y * self.w + x] : -1; },
        clear(x, y) { self.out.set(x, y, [0, 0, 0], 0); },
      };
    }
  }

  class SpriteShapeFactory {
    ell(...args) { return new Ellipse(...args); }
    cap(...args) { return new Capsule(...args); }
    poly(...args) { return new Poly(...args); }
  }
  Object.assign(K, { PAL, SpriteCanvas, SpriteShapeFactory });
})(typeof window !== 'undefined' ? window : globalThis);
