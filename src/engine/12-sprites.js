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
      for (let i = 0; i < w * h; i++) if (dark[i]) { const pt = P[this.part[i]]; col[i] = pt.pal[Math.min(this.ri[i] - 1, 1) < 0 ? 0 : (this.ri[i] > 2 ? 1 : 0)]; }
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

  const S = { ell: (...a) => new Ellipse(...a), cap: (...a) => new Capsule(...a), poly: (...a) => new Poly(...a) };
  const furTex = (s = 0.3, seed = 1) => (x, y, v) => v + (hash2(x, (y + (x % 2)) >> 1, seed) - 0.5) * s;
  const jag = (base, amp, seed) => (x, y) => y < base + Math.floor(hash2(x, 0, seed) * amp);

  /* ---------- characters (all original Kinstead designs) ---------- */

  function warden(f) {
    const b = [0, 0, 1, 1][f];            // breath: upper body drop
    const s = [0, 1, 1, 0][f];            // cape / fur sway
    const c = new SpriteCanvas(32, 48);
    c.add(S.poly([[10, 17 + b], [22, 17 + b], [25, 40], [22 + s, 44], [16, 43], [10 + s, 44], [7.5, 40]], 1.5, [0.1, 0]), PAL.redDark, { bias: -0.05 });
    c.add(S.cap(13.6, 33, 12.8, 43, 2.3, 2.1), PAL.steel, { bias: -0.05, spec: 0.9 });
    c.add(S.cap(18.4, 33, 19.4, 43, 2.3, 2.1), PAL.steel, { bias: -0.12 });
    c.add(S.ell(12.2, 44.6, 3.2, 1.9), PAL.leather);
    c.add(S.ell(19.8, 44.6, 3.2, 1.9), PAL.leather, { bias: -0.08 });
    c.add(S.ell(16, 27 + b, 6.2, 8), PAL.mail, { tex: (x, y, v) => v - ((x + y) % 2) * 0.07 - (y % 2) * 0.05 });
    c.add(S.poly([[12, 21 + b], [20, 21 + b], [20.6, 38], [18.2, 36.6], [16, 39.4], [13.8, 36.6], [11.4, 38]], 1.6, [0, 0.05]), PAL.red,
      { tex: (x, y, v) => v + (x === 14 || x === 18 ? -0.08 : 0) });
    c.add(S.poly([[11.4, 30 + b], [20.6, 30 + b], [20.6, 32 + b], [11.4, 32 + b]], 0.8), PAL.leather);
    // mace arm (character's right = viewer's left)
    c.add(S.cap(10.4, 19 + b, 8.6, 25 + b, 2.5, 2.2), PAL.steel, { spec: 0.92 });
    c.add(S.cap(9.8, 33, 4.6, 14.5, 0.9), PAL.wood);
    c.add(S.ell(4.4, 13.2, 3.3, 3.1), PAL.steel, { spec: 0.85 });
    c.add(S.cap(8.6, 25 + b, 9.6, 29 + b, 2.2, 2.0), PAL.steel);
    c.add(S.ell(9.4, 29.6 + b, 2.3, 2.1), PAL.steel, { spec: 0.9 });
    // fur mantle
    c.add(S.ell(16, 18.8 + b, 8.8, 4.3), PAL.fur, { tex: furTex(0.34, 5 + s), clip: jag(20.5 + b, 3, 9 + s), dither: 0.2 });
    // great helm
    c.add(S.ell(16, 6 + b, 4.3, 2.6), PAL.steel, { spec: 0.9 });
    c.add(S.poly([[11.8, 5.6 + b], [20.2, 5.6 + b], [20.6, 14.4 + b], [11.4, 14.4 + b]], 2.2, [-0.05, 0], 0), PAL.steel, { spec: 0.93 });
    c.add(S.cap(17, 4.2 + b, 21.8, 1.8 + b + s * 0.5, 1.5, 0.6), PAL.red, { bias: 0.05 });
    // kite shield
    c.add(S.poly([[18.2, 19.6 + b], [28.2, 20 + b], [28.2, 29 + b], [23.2, 41 + b], [18.2, 29.5 + b]], 1.4, [0.12, -0.05]), PAL.steel, { spec: 0.9 });
    c.add(S.poly([[19.6, 21 + b], [26.8, 21.3 + b], [26.8, 28.7 + b], [23.2, 37.8 + b], [19.6, 29.2 + b]], 1.2, [0.12, -0.05]), PAL.red, { sep: false, outline: false });
    return c.rasterizeAnd((d) => {
      const st = PAL.steel, sv = PAL.whiteFur;
      // visor slit + breaths + eye glint
      d.line(12, 10 + b, 19, 10 + b, st[0]); d.line(12, 9 + b, 19, 9 + b, st[1]);
      d.px(16, 11 + b, st[0]); d.px(16, 12 + b, st[0]); d.px(14, 12 + b, st[1]); d.px(18, 12 + b, st[1]);
      d.px(14, 10 + b, C('#8fe7ff'), true); d.px(17, 10 + b, C('#5fc3e6'), true);
      d.line(12, 7 + b, 19, 7 + b, st[4]); [12, 15, 19].forEach((x) => d.px(x, 7 + b, st[6]));
      // shield emblem: pale four-point frost star + rivets
      const cx = 23, cy = 27 + b, pale = [sv[4], sv[3], sv[2]];
      for (let k = 0; k <= 4; k++) { d.px(cx, cy - k, pale[k > 2 ? 1 : 0]); d.px(cx, cy + k, pale[k > 2 ? 2 : 1]); }
      for (let k = 1; k <= 3; k++) { d.px(cx - k, cy, pale[k > 1 ? 1 : 0]); d.px(cx + k, cy, pale[k > 1 ? 2 : 1]); }
      d.px(cx - 1, cy - 1, pale[1]); d.px(cx + 1, cy + 1, pale[2]); d.px(cx + 1, cy - 1, pale[1]); d.px(cx - 1, cy + 1, pale[2]);
      [[20, 22], [26, 22], [26, 28], [20, 28]].forEach(([x, y]) => d.px(x, y + b, st[5]));
      // tabard emblem stripe + hem
      d.px(16, 24 + b, PAL.gold[3]); d.px(15, 25 + b, PAL.gold[2]); d.px(17, 25 + b, PAL.gold[2]); d.px(16, 26 + b, PAL.gold[2]); d.px(16, 25 + b, PAL.gold[4]);
      // belt buckle
      d.px(16, 31 + b, PAL.gold[3]); d.px(17, 31 + b, PAL.gold[2]);
      // mace flanges + spike
      d.line(2, 13, 6, 13, st[2]); d.px(4, 10, st[1]); d.px(4, 9, st[3]); d.px(1, 13, st[2]); d.px(7, 13, st[1]);
      d.px(3, 12, st[6]); d.px(3, 11, st[5]);
      // snow on helm top & mantle
      [[14, 4], [15, 4], [16, 4], [17, 3 + 1]].forEach(([x, y]) => d.has(x, y + b) && d.px(x, y + b, PAL.snow[3]));
      for (let x = 8; x < 24; x++) if (hash2(x, 3, 77) < 0.45) { const y = 15 + b + (x < 12 || x > 20 ? 1 : 0); if (d.has(x, y)) d.px(x, y, PAL.snow[x % 3 ? 2 : 3]); }
      // knee + gauntlet highlights
      d.px(12, 37, st[6]); d.px(18, 37, st[5]); d.px(8, 28 + b, st[6]);
    });
  }

  function witch(f) {
    const b = [0, 0, 1, 1][f], s = [0, 1, 1, 0][f], pulse = [0, 1, 2, 1][f];
    const c = new SpriteCanvas(32, 48);
    const fold = (x, y, v) => v + Math.sin(x * 1.35 + y * 0.08) * 0.09;
    c.add(S.cap(8.2, 46.5, 8.8, 9, 0.9, 1.0), PAL.wood, { tex: (x, y, v) => v + (y % 7 === 0 ? -0.15 : 0) });
    c.add(S.poly([[10.6, 18 + b], [21.4, 18 + b], [24.6 + s * 0.5, 43], [21, 46], [16, 45], [11, 46], [7.8 + s * 0.5, 43]], 1.6), PAL.robe, { tex: fold });
    c.add(S.poly([[8, 41.5], [24.2 + s * 0.5, 41.5], [24.8 + s * 0.5, 43.5], [21, 46.2], [16, 45.4], [11, 46.2], [7.4, 43.5]], 1.2, [0, -0.2]), PAL.whiteFur, { tex: furTex(0.3, 3 + s), dither: 0.2 });
    c.add(S.poly([[12, 27 + b], [20, 27 + b], [20.2, 29 + b], [11.8, 29 + b]], 0.7), PAL.robeLight, { bias: 0.15 });
    c.add(S.cap(18.5, 29 + b, 19 + s * 0.4, 36, 0.8), PAL.robeLight, { bias: 0.05 });
    // far arm raised with frost mote
    c.add(S.cap(21, 19.5 + b, 23.6, 25.5 + b, 2.2, 2.8), PAL.robe, { bias: -0.05 });
    c.add(S.ell(24, 27.2 + b, 1.6, 1.5), PAL.skinPale);
    // capelet
    c.add(S.ell(16, 19.6 + b, 7.4, 4.6), PAL.robeLight, { tex: (x, y, v) => v + Math.sin(x * 1.6) * 0.07, clip: jag(21 + b, 2, 4) });
    // staff arm
    c.add(S.cap(11, 19.5 + b, 9.4, 24 + b, 2.3, 2.8), PAL.robe);
    c.add(S.ell(8.8, 25 + b, 1.7, 1.6), PAL.skinPale);
    // hood
    c.add(S.cap(19, 6 + b, 23.5, 9.5 + b + s * 0.5, 2.4, 0.8), PAL.robe, { bias: -0.08 });
    c.add(S.ell(16, 11.4 + b, 6.2, 6.8), PAL.robe, { tex: (x, y, v) => v + Math.sin(x * 1.1) * 0.05 });
    c.add(S.ell(15.6, 13 + b, 3.7, 3.9), PAL.hoodIn, { fixed: 1, sep: false, outline: false });
    c.add(S.ell(15.5, 15 + b, 2.6, 1.9), PAL.skinPale, { sep: false, outline: false, bias: -0.12 });
    // crystal head of staff (emissive)
    const cy = 6 - (pulse > 1 ? 1 : 0);
    c.add(S.poly([[8.6, cy - 5], [11, cy], [8.6, cy + 4.5], [6.2, cy]], 1.1, [-0.2, -0.1]), PAL.crystal, { emis: true, spec: 0.7, bias: 0.1 });
    c.add(S.poly([[11.4, cy - 3], [12.8, cy - 0.5], [11.6, cy + 2], [10.4, cy - 0.5]], 0.8), PAL.crystal, { emis: true, bias: 0.15 });
    c.add(S.poly([[5.4, cy - 1.5], [6.4, cy + 0.5], [5.4, cy + 2.6], [4.4, cy + 0.5]], 0.8), PAL.crystal, { emis: true, bias: 0.05 });
    return c.rasterizeAnd((d) => {
      // face: glowing eyes under hood, mouth shadow, silver hair strands
      d.px(14, 13 + b, C('#a8f4ff'), true); d.px(17, 13 + b, C('#a8f4ff'), true);
      d.px(14, 12 + b, PAL.hoodIn[2]); d.px(17, 12 + b, PAL.hoodIn[2]);
      d.px(15, 16 + b, PAL.skinPale[2]);
      [[12, 13], [12, 14], [12, 15], [13, 16], [19, 13], [19, 14], [19, 15], [18, 16]].forEach(([x, y], i) => d.px(x, y + b, PAL.hair[i % 4 === 0 ? 3 : 2]));
      d.px(12, 16 + b, PAL.hair[1]); d.px(19, 16 + b, PAL.hair[1]);
      // hood rim highlight + frost brooch
      [[11, 8], [12, 6], [13, 5], [14, 5]].forEach(([x, y]) => d.px(x, y + b, PAL.robe[5]));
      d.px(16, 22 + b, PAL.crystal[5], true); d.px(15, 22 + b, PAL.crystal[3]); d.px(17, 22 + b, PAL.crystal[3]); d.px(16, 23 + b, PAL.crystal[2]);
      // staff claw prongs
      d.px(7, 10, PAL.wood[3]); d.px(10, 10, PAL.wood[2]); d.px(7, 9, PAL.wood[2]); d.px(10, 9, PAL.wood[1]);
      // core glints + floating motes
      d.px(8, cy - 1, PAL.crystal[6], true); d.px(8, cy, PAL.crystal[6], true); d.px(9, cy - 2, PAL.crystal[5], true);
      const m = [[13, 2], [4, 3], [12, 9], [3, 7]][f];
      d.px(m[0], m[1], C('#d8fbff'), true);
      d.px(24 + (f % 2), 24 + b - (f >> 1), C('#bff6ff'), true); d.px(25 - (f % 2), 22 + b, C('#7fdcff'), true);
      // rune stitches on robe
      for (let y = 31; y < 41; y += 3) d.px(16, y, PAL.robe[4]);
    });
  }

  function ghoul(f, variant = 0) {
    const b = [0, 1, 1, 0][f], a = [0, 0, 1, 1][f];
    const sk = variant ? PAL.ghoul2 : PAL.ghoul, rg = variant ? PAL.rag2 : PAL.rag;
    const c = new SpriteCanvas(36, 40);
    // far limbs (darker)
    c.add(S.cap(24.5, 25, 27, 31, 2.2, 1.8), sk, { bias: -0.16 });
    c.add(S.cap(27, 31, 25.4, 37.6, 1.7, 1.3), sk, { bias: -0.16 });
    c.add(S.ell(24.6, 38.2, 2.6, 1.1), sk, { bias: -0.2 });
    c.add(S.cap(17.5, 14.5 + b, 14.6 + a * 0.4, 23.5 + b, 1.9, 1.5), sk, { bias: -0.2 });
    c.add(S.cap(14.6 + a * 0.4, 23.5 + b, 13.2 + a, 33.5, 1.5, 1.2), sk, { bias: -0.2 });
    // hunched torso: capsule from hips to shoulders, plus hump
    c.add(S.cap(23, 24, 15.5, 15 + b, 4.6, 5.4), sk, { noise: 0.08,
      tex: (x, y, v) => v - (((x + y * 0.6) | 0) % 3 === 0 && y > 16 + b && y < 24 && x > 15 && x < 23 ? 0.2 : 0) });
    c.add(S.ell(19.6, 13.4 + b, 4.6, 3.6), sk, { noise: 0.08 });
    // ragged loincloth
    c.add(S.poly([[19.6, 21.5], [27, 21.5], [28.2, 28.6], [26, 27.4], [24.6, 30.4], [22.6, 27.8], [20.4, 29.6]], 1.1), rg, { noise: 0.14 });
    // near leg (crouched)
    c.add(S.cap(21.6, 25.2, 17.4, 30.6, 2.6, 2.1), sk, { bias: 0.02, noise: 0.06 });
    c.add(S.cap(17.4, 30.6, 19.2, 37.4, 1.9, 1.4), sk);
    c.add(S.ell(17.8, 38.2, 3.2, 1.2), sk, { bias: -0.06 });
    // skull head jutting forward, jaw hanging
    c.add(S.ell(9.2, 15.6 + b, 4.0, 3.4), sk, { noise: 0.05, spec: 0.94 });
    c.add(S.ell(8.2, 19.2 + b, 2.6, 1.7), sk, { bias: -0.1, line: true });
    // near arm, long, reaching to the ground
    c.add(S.cap(15, 15.8 + b, 10.8 - a * 0.5, 24.6 + b, 2.2, 1.7), sk, { bias: 0.06 });
    c.add(S.cap(10.8 - a * 0.5, 24.6 + b, 7.4 - a * 0.5, 33.6 + b * 0.5, 1.7, 1.3), sk, { bias: 0.06 });
    c.add(S.ell(7.0 - a * 0.5, 34.4 + b * 0.5, 1.9, 1.5), sk, { bias: 0.02 });
    return c.rasterizeAnd((d) => {
      const e = C('#7ff3ff'), e2 = C('#e6feff');
      // deep sockets with cyan eyes
      d.px(7, 15 + b, sk[0]); d.px(10, 15 + b, sk[0]);
      d.px(7, 16 + b, e2, true); d.px(10, 16 + b, e, true); d.px(6, 16 + b, C('#2b9cc0'), true);
      d.px(8, 17 + b, sk[1]);
      // gaping mouth + teeth
      d.line(6, 19 + b, 10, 19 + b, sk[0]); d.line(6, 20 + b, 9, 20 + b, sk[0]);
      [6, 8, 10].forEach((x) => d.px(x, 18 + b, PAL.bone[3])); [7, 9].forEach((x) => d.px(x, 21 + b, PAL.bone[2]));
      // claws on both hands
      const hx = Math.round(7 - a * 0.5), hy = Math.round(34.4 + b * 0.5);
      d.px(hx - 2, hy + 1, PAL.bone[3]); d.px(hx - 3, hy + 2, PAL.bone[2]); d.px(hx - 1, hy + 2, PAL.bone[3]); d.px(hx - 1, hy + 3, PAL.bone[1]); d.px(hx + 1, hy + 2, PAL.bone[2]);
      d.px(12 + a, 34, PAL.bone[1]); d.px(13 + a, 35, PAL.bone[1]); d.px(11 + a, 35, PAL.bone[1]);
      // vertebrae along the hump + frost crust
      [[16, 10], [19, 9], [22, 10], [24, 13], [25, 16]].forEach(([x, y]) => { d.px(x, y + b, sk[6]); d.px(x + 1, y + b, sk[3]); });
      [[17, 10], [18, 9], [20, 9], [21, 9], [23, 11], [14, 12]].forEach(([x, y]) => d.px(x, y + b, PAL.snow[3]));
      // stringy hair and hollow cheek
      d.line(10, 12 + b, 13, 19 + b, variant ? PAL.hair[1] : C('#2a2f33'));
      d.line(11, 12 + b, 14, 17 + b, variant ? PAL.hair[2] : C('#3b4247'));
      d.px(9, 12 + b, sk[6]); d.px(8, 13 + b, sk[5]); d.px(11, 17 + b, sk[2]);
    });
  }

  function troll(f) {
    const b = [0, 1, 2, 1][f], s = [0, 0, 1, 1][f];
    const c = new SpriteCanvas(64, 72);
    const sk = PAL.troll;
    const mott = (x, y, v) => v + (K.hash2(x >> 1, y >> 1, 41) - 0.5) * 0.14;
    // back arm & leg
    c.add(S.cap(44, 28 + b, 50, 40 + b, 5.2, 5.4), sk, { bias: -0.16, tex: mott });
    c.add(S.cap(50, 40 + b, 49.4, 52 + b, 5.4, 5.8), sk, { bias: -0.16, tex: mott });
    c.add(S.ell(49.4, 55 + b, 5.4, 5), sk, { bias: -0.14 });
    c.add(S.cap(40, 52, 43, 65, 6.2, 5.4), sk, { bias: -0.15, tex: mott });
    c.add(S.ell(44.5, 67.8, 7.2, 3.4), sk, { bias: -0.18 });
    // ice crags (behind body silhouette, poke above)
    const crag = (x0, y0, x1, y1, w) => {
      const dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy), px = (-dy / m) * w, py = (dx / m) * w;
      c.add(S.poly([[x0 - px, y0 - py], [x0 + dx * 0.55 - px * 0.8, y0 + dy * 0.55 - py * 0.8], [x1, y1], [x0 + dx * 0.6 + px * 0.9, y0 + dy * 0.6 + py * 0.9], [x0 + px, y0 + py]], 1.4, [-0.1, -0.1]), PAL.crystal, { spec: 0.75, outlineCol: C('#0a2238') });
    };
    crag(28, 26 + b, 25, 7 + b, 3.2); crag(37, 24 + b, 40.5, 4 + b, 3.6); crag(45, 28 + b, 54, 13 + b, 3.0);
    crag(32, 25 + b, 32.5, 12 + b, 2.4); crag(50, 34 + b, 58, 27 + b, 2.2); crag(22, 28 + b, 18, 17 + b, 2.0);
    // body
    c.add(S.ell(33, 38 + b, 17.5, 16.4), sk, { tex: mott, spec: 0.97 });
    c.add(S.ell(29, 46 + b, 12, 9.6), PAL.trollBelly, { tex: mott, bias: 0.04 });
    c.add(S.poly([[19.6, 50 + b], [42.6, 50 + b], [44.6, 58.5], [38.6, 57.4], [33, 60.6], [27.6, 57.4], [21.6, 58.6]], 1.4), PAL.fur, { tex: furTex(0.32, 8 + s), dither: 0.2, bias: -0.12, clip: (x, y) => y < 56 + Math.floor(K.hash2(x, 0, 12 + s) * 4) });
    c.add(S.poly([[19.6, 49.2 + b], [42.6, 49.2 + b], [42.6, 51.2 + b], [19.6, 51.2 + b]], 0.7), PAL.leather);
    c.add(S.cap(25, 54, 22.6, 65.5, 6.6, 6), sk, { tex: mott });
    c.add(S.ell(21, 67.8, 8, 3.5), sk, { bias: -0.04 });
    // club behind the fist
    c.add(S.cap(13.4, 44 + b, 7.5, 67, 3.0, 4.6), PAL.bark, { tex: (x, y, v) => v + (y % 6 === 0 ? -0.18 : 0) + (K.hash2(x, y >> 2, 3) - 0.5) * 0.12 });
    // head
    c.add(S.ell(17, 26.4 + b, 7.8, 7.2), sk, { tex: mott, spec: 0.95 });
    c.add(S.ell(15.4, 22.8 + b, 6.6, 2.6), sk, { bias: 0.1, line: true });
    c.add(S.ell(16.4, 31.4 + b, 6.8, 3.6), sk, { bias: -0.06, line: true });
    c.add(S.ell(11.2, 27 + b, 2.4, 2.1), sk, { bias: 0.05, line: true });
    // front arm
    c.add(S.cap(25, 31 + b, 16.6, 40 + b, 6.6, 6.0), sk, { tex: mott, spec: 0.96 });
    c.add(S.cap(16.6, 40 + b, 14.4, 45.5 + b, 6.0, 5.6), sk, { tex: mott });
    c.add(S.ell(13.8, 47.4 + b, 5.4, 5.0), sk, { bias: 0.04, line: true });
    return c.rasterizeAnd((d) => {
      const e = C('#ffe9a0'), e2 = C('#ffb84a');
      d.px(13, 25 + b, e, true); d.px(14, 25 + b, e2, true); d.px(19, 25 + b, e2, true); d.px(18, 25 + b, e, true);
      d.line(12, 24 + b, 15, 24 + b, sk[1]); d.line(17, 24 + b, 20, 24 + b, sk[1]);
      // tusks
      [[12, 30], [12, 29], [13, 28]].forEach(([x, y], i) => d.px(x, y + b, PAL.bone[3 + (i === 2 ? 1 : 0)]));
      [[20, 30], [20, 29], [19, 28]].forEach(([x, y], i) => d.px(x, y + b, PAL.bone[2 + (i === 2 ? 1 : 0)]));
      d.line(13, 32 + b, 19, 32 + b, sk[0]);
      // knuckles over club
      [[11, 45], [13, 44], [15, 44]].forEach(([x, y]) => d.px(x, y + b, sk[6]));
      // club bands + knots
      d.line(10, 54 + b, 12, 55 + b, PAL.leather[3]); d.line(9, 58, 12, 59, PAL.leather[2]);
      d.px(9, 62, PAL.bark[1]); d.px(11, 50 + b, PAL.bark[1]);
      // snow on head/shoulders
      for (let x = 10; x < 52; x++) {
        for (let y = 5; y < 40; y++) {
          if (d.has(x, y) && !d.has(x, y - 1)) { const p = d.partAt(x, y); if (p >= 0 && c.parts[p].pal === sk && K.hash2(x, y, 9) < 0.6) { d.px(x, y, PAL.snow[2]); if (K.hash2(x, y, 4) < 0.5) d.px(x, y + 1, PAL.snow[1]); } break; }
        }
      }
      // crag glints
      [[25, 9], [40, 6], [53, 15], [32, 14]].forEach(([x, y]) => d.px(x, y + b, PAL.crystal[6]));
      // warts / scars
      d.px(30, 34 + b, sk[1]); d.px(31, 34 + b, sk[2]); d.px(38, 40 + b, sk[1]); d.line(26, 38 + b, 29, 41 + b, sk[2]);
    });
  }

  SpriteCanvas.prototype.rasterizeAnd = function (detail) { this.rasterize(); this.finish(detail); return this; };

  class CharacterLibrary {
    constructor() {
      this.defs = [
        { id: 'warden', name: 'The Warden', role: 'hero · armored knight', frames: 4, build: warden, ppu: 32 },
        { id: 'witch', name: 'Rime Witch', role: 'hero · ice caster', frames: 4, build: witch, ppu: 32 },
        { id: 'ghoulA', name: 'Frost Ghoul', role: 'undead', frames: 4, build: (f) => ghoul(f, 0), ppu: 32 },
        { id: 'ghoulB', name: 'Frost Ghoul (pale)', role: 'undead', frames: 4, build: (f) => ghoul(f, 1), ppu: 32 },
        { id: 'troll', name: 'Rime Troll', role: 'brute', frames: 4, build: troll, ppu: 32 },
      ];
      this.cache = {};
    }
    get(id) {
      if (this.cache[id]) return this.cache[id];
      const def = this.defs.find((d) => d.id === id);
      const frames = [], glows = [];
      for (let f = 0; f < def.frames; f++) { const c = def.build(f); frames.push(c.out); glows.push(c.glow); }
      return (this.cache[id] = Object.assign({}, def, { frames, glows, w: frames[0].w, h: frames[0].h }));
    }
    all() { return this.defs.map((d) => this.get(d.id)); }
  }

  Object.assign(K, { PAL, SpriteCanvas, CharacterLibrary });
})(typeof window !== 'undefined' ? window : globalThis);
