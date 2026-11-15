/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Asset Lab reconstruction kit (node, offline). Turns a Grok reference image plus a coarse 3D prior (TripoSR mesh) into
   coloured voxels at the reference camera. See docs/STRATEGY.md for the plan and ASSET-LAB.md for how to run it.
   Camera maths mirror src/app/lab.js RefFramer exactly (perspective look-at, yaw/pitch/fov, framing fitted to the ref's
   opaque box), so a camera calibrated here is the camera the lab renders with. */

export class V3 {
  static sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  static add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  static scale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  static dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  static cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  static norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
}

/* a perspective camera looking at target from yaw/pitch, framed like the lab's RefFramer */
export class Camera {
  constructor(w, h, view) { this.w = w; this.h = h; this.view = { fov: 18, ...view }; this.aspect = w / h; }
  dir() { const { yaw, pitch } = this.view; return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]; }
  place(target, dist) {
    this.target = target; this.dist = dist; this.eye = V3.add(target, V3.scale(this.dir(), dist));
    this.f = V3.norm(V3.sub(target, this.eye)); this.r = V3.norm(V3.cross(this.f, [0, 1, 0])); this.u = V3.cross(this.r, this.f);
    this.th = Math.tan((this.view.fov * Math.PI) / 360); return this;
  }
  /* -> [ndcX, ndcY, depth] */
  ndc(p) { const d = V3.sub(p, this.eye), z = V3.dot(d, this.f); return [V3.dot(d, this.r) / z / (this.th * this.aspect), V3.dot(d, this.u) / z / this.th, z]; }
  /* -> [px, py, depth] in pixels (y down) */
  project(p) { const n = this.ndc(p); return [(n[0] + 1) * 0.5 * this.w, (1 - n[1]) * 0.5 * this.h, n[2]]; }
  /* inverse of project for a pixel centre and a camera depth */
  unproject(px, py, depth) {
    const nx = (px / this.w) * 2 - 1, ny = 1 - (py / this.h) * 2;
    const d = V3.add(V3.add(this.f, V3.scale(this.r, nx * this.th * this.aspect)), V3.scale(this.u, ny * this.th));
    return V3.add(this.eye, V3.scale(d, depth));
  }
  /* RefFramer.fit: put the points' screen box on refBox ([x0,y0,x1,y1] normalised, y down); view.fit 'height'|'width'|'both' */
  frame(points, refBox) {
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of points) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    let target = V3.scale(V3.add(lo, hi), 0.5), dist = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 3.5 + 1;
    const want = { cx: refBox[0] + refBox[2] - 1, cy: 1 - (refBox[1] + refBox[3]), h: (refBox[3] - refBox[1]) * 2, w: (refBox[2] - refBox[0]) * 2 };
    for (let it = 0; it < 12; it++) {
      this.place(target, dist);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of points) { const n = this.ndc(p); x0 = Math.min(x0, n[0]); x1 = Math.max(x1, n[0]); y0 = Math.min(y0, n[1]); y1 = Math.max(y1, n[1]); }
      const hk = (y1 - y0) / want.h, wk = (x1 - x0) / want.w, k = this.view.fit === 'height' ? hk : this.view.fit === 'width' ? wk : (hk + wk) / 2;
      dist *= k;
      const halfH = this.th * dist, halfW = halfH * this.aspect;
      target = V3.add(target, V3.add(V3.scale(this.r, ((x0 + x1) / 2 / k - want.cx) * halfW), V3.scale(this.u, ((y0 + y1) / 2 / k - want.cy) * halfH)));
    }
    return this.place(target, dist);
  }
}

/* z-buffered triangle rasterizer: depth + id per pixel */
export class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.depth = new Float32Array(w * h).fill(Infinity); this.id = new Int32Array(w * h).fill(-1); }
  tri(a, b, c, id) {
    const { w, h, depth } = this;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(area) < 1e-9) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2], i = y * w + x;
      if (z < depth[i]) { depth[i] = z; this.id[i] = id; }
    }
  }
  mask() { const m = new Uint8Array(this.w * this.h); for (let i = 0; i < m.length; i++) m[i] = this.id[i] >= 0 ? 1 : 0; return m; }
}

/* the reference image: alpha masks, colour lookups, opaque box (same thresholds as the lab) */
export class RefImage {
  constructor(png) { this.png = png; this.w = png.w; this.h = png.h; }
  /* the lab's RefImage.opaqueBox: alpha > 40 */
  box() {
    const { w, h } = this, d = this.png.data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h];
  }
  /* solid mask (alpha > thr) at w x h */
  mask(w = this.w, h = this.h, thr = 200) {
    const src = w === this.w && h === this.h ? this.png : this.png.resized(w, h), m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = src.data[i * 4 + 3] > thr ? 1 : 0; return m;
  }
}

export class Score {
  static iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return i / Math.max(1, u); }
}

/* sRGB <-> CIELAB (D65) */
export class Lab {
  static lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  static gam(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); }
  static fromRgb([r, g, b]) {
    const R = Lab.lin(r), G = Lab.lin(g), B = Lab.lin(b);
    const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  static toRgb([L, a, b]) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (t - 4 / 29) * 108 / 841);
    const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
    return [Lab.gam(3.2406 * x - 1.5372 * y - 0.4986 * z), Lab.gam(-0.9689 * x + 1.8758 * y + 0.0415 * z), Lab.gam(0.0557 * x - 0.204 * y + 1.057 * z)];
  }
  static dE(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
}

/* k-means in CIELAB with deterministic k-means++ seeding */
export class PaletteFit {
  constructor(k = 28, seed = 7) { this.k = k; this.seed = seed; }
  rand() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }
  fit(samples, iters = 25) {
    const C = [samples[Math.floor(this.rand() * samples.length)]];
    while (C.length < this.k) {
      const d = samples.map((s) => Math.min(...C.map((c) => Lab.dE(s, c))) ** 2), tot = d.reduce((a, b) => a + b, 0); let r = this.rand() * tot, i = 0;
      while ((r -= d[i]) > 0 && i < d.length - 1) i++; C.push(samples[i]);
    }
    for (let it = 0; it < iters; it++) {
      const acc = C.map(() => [0, 0, 0, 0]);
      for (const s of samples) { const j = this.nearest(C, s); acc[j][0] += s[0]; acc[j][1] += s[1]; acc[j][2] += s[2]; acc[j][3]++; }
      for (let j = 0; j < C.length; j++) if (acc[j][3]) C[j] = [acc[j][0] / acc[j][3], acc[j][1] / acc[j][3], acc[j][2] / acc[j][3]];
    }
    this.centres = C; return C;
  }
  nearest(C, s) { let b = 0, bd = Infinity; for (let j = 0; j < C.length; j++) { const d = Lab.dE(s, C[j]); if (d < bd) { bd = d; b = j; } } return b; }
}

/* a triangle mesh prior (TripoSR JSON: positions, indices, colors 0..1) moved into the model frame:
   y up, feet on y = 0, centred on x/z, `height` voxels tall, then rotated `yaw` about y */
export class MeshPrior {
  constructor(json, { upAxis = 'z', height = 93 } = {}) {
    const P = json.positions, n = P.length / 3, pos = new Float32Array(P.length);
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (upAxis === 'z') { pos[i * 3] = x; pos[i * 3 + 1] = z; pos[i * 3 + 2] = -y; } else { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; } }
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i * 3 + k]); hi[k] = Math.max(hi[k], pos[i * 3 + k]); }
    const s = height / (hi[1] - lo[1]);
    for (let i = 0; i < n; i++) { pos[i * 3] = (pos[i * 3] - (lo[0] + hi[0]) / 2) * s; pos[i * 3 + 1] = (pos[i * 3 + 1] - lo[1]) * s; pos[i * 3 + 2] = (pos[i * 3 + 2] - (lo[2] + hi[2]) / 2) * s; }
    this.base = pos; this.idx = Int32Array.from(json.indices); this.col = Float32Array.from(json.colors); this.n = n; this.setYaw(0);
  }
  setYaw(a, shift = [0, 0, 0]) {
    const c = Math.cos(a), s = Math.sin(a), b = this.base, p = (this.pos = this.pos || new Float32Array(b.length));
    for (let i = 0; i < this.n; i++) { const x = b[i * 3], z = b[i * 3 + 2]; p[i * 3] = c * x + s * z + shift[0]; p[i * 3 + 1] = b[i * 3 + 1] + shift[1]; p[i * 3 + 2] = -s * x + c * z + shift[2]; }
    this.yaw = a; return this;
  }
  vert(i) { return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]; }
  points(step = 7) { const o = []; for (let i = 0; i < this.n; i += step) o.push(this.vert(i)); return o; }
  render(cam) {
    const R = new Raster(cam.w, cam.h), pr = new Array(this.n);
    for (let i = 0; i < this.n; i++) pr[i] = cam.project(this.vert(i));
    for (let t = 0; t < this.idx.length; t += 3) R.tri(pr[this.idx[t]], pr[this.idx[t + 1]], pr[this.idx[t + 2]], t / 3);
    return R;
  }
  /* inside test by ray parity along +y, binned per (x, z) column: -> Set of "x,y,z" voxel keys (voxel centres at integers) */
  voxelize() {
    const cols = new Map(), I = this.idx, key = (x, z) => x * 4096 + z;
    for (let t = 0; t < I.length; t += 3) {
      const a = this.vert(I[t]), b = this.vert(I[t + 1]), c = this.vert(I[t + 2]);
      for (let x = Math.ceil(Math.min(a[0], b[0], c[0])); x <= Math.floor(Math.max(a[0], b[0], c[0])); x++) for (let z = Math.ceil(Math.min(a[2], b[2], c[2])); z <= Math.floor(Math.max(a[2], b[2], c[2])); z++) {
        const area = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]); if (Math.abs(area) < 1e-12) continue;
        const px = x + 1e-4, pz = z + 1.3e-4;
        const w0 = ((b[0] - px) * (c[2] - pz) - (b[2] - pz) * (c[0] - px)) / area, w1 = ((c[0] - px) * (a[2] - pz) - (c[2] - pz) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const y = w0 * a[1] + w1 * b[1] + w2 * c[1], k = key(x, z); if (!cols.has(k)) cols.set(k, []); cols.get(k).push(y);
      }
    }
    const out = new Set();
    for (const [k, ys] of cols) {
      const x = Math.round(k / 4096), z = k - x * 4096; ys.sort((p, q) => p - q);
      for (let i = 0; i + 1 < ys.length; i += 2) for (let y = Math.ceil(ys[i] - 0.5); y <= Math.floor(ys[i + 1] - 0.5); y++) out.add(`${x},${y},${z}`);
    }
    return out;
  }
  /* nearest-vertex colour (0..255 RGB) to a point, via a coarse spatial hash */
  colourAt(p) {
    if (!this.hash) { this.hash = new Map(); for (let i = 0; i < this.n; i++) { const k = this.cell(this.vert(i)); if (!this.hash.has(k)) this.hash.set(k, []); this.hash.get(k).push(i); } }
    let best = -1, bd = Infinity; const c = p.map((v) => Math.floor(v / 3));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const i of this.hash.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) || []) { const v = this.vert(i), d = (v[0] - p[0]) ** 2 + (v[1] - p[1]) ** 2 + (v[2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    return best < 0 ? null : [this.col[best * 3] * 255, this.col[best * 3 + 1] * 255, this.col[best * 3 + 2] * 255];
  }
  cell(p) { return `${Math.floor(p[0] / 3)},${Math.floor(p[1] / 3)},${Math.floor(p[2] / 3)}`; }
}

/* a sparse voxel grid of colours (RGB arrays) with cube rendering at a camera */
export class VoxelGrid {
  constructor() { this.v = new Map(); }
  static k(x, y, z) { return `${x},${y},${z}`; }
  static unk(k) { return k.split(',').map(Number); }
  has(x, y, z) { return this.v.has(VoxelGrid.k(x, y, z)); }
  set(x, y, z, c) { this.v.set(VoxelGrid.k(x, y, z), c); }
  get size() { return this.v.size; }
  points() { return [...this.v.keys()].map(VoxelGrid.unk); }
  /* exposed faces only, as two triangles each; id = index into keys() */
  render(cam) {
    const R = new Raster(cam.w, cam.h), keys = [...this.v.keys()], F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const toCam = V3.sub(cam.eye, cam.target);
    keys.forEach((k, id) => {
      const [x, y, z] = VoxelGrid.unk(k);
      for (const n of F) {
        if (this.has(x + n[0], y + n[1], z + n[2])) continue;
        const c = [x + n[0] * 0.5, y + n[1] * 0.5, z + n[2] * 0.5]; if (V3.dot(n, V3.sub(cam.eye, c)) <= 0) continue;
        const a = n[0] ? [0, 1, 0] : [1, 0, 0], b = V3.cross(n, a), q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => cam.project(V3.add(c, V3.add(V3.scale(a, s * 0.5), V3.scale(b, t * 0.5)))));
        R.tri(q[0], q[1], q[2], id); R.tri(q[0], q[2], q[3], id);
      }
    });
    R.keys = keys; void toCam; return R;
  }
}
