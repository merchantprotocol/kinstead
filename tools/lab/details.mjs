/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Fitted details on top of a reconstruction (docs/STRATEGY.md step 6): thin parts the prior melts (blades) are rebuilt as
   primitives whose parameters are solved against the reference silhouette at the locked camera, and small graphic marks
   (visor slits) are stamped as decals. Works on RigSplitter's centred voxel list ([x, y, z, paletteIndex]). */
import { Camera, RefImage, Score, VoxelGrid, V3 } from './recon-kit.mjs';
import { PngImage } from './png.mjs';

export class DetailKit {
  /* splitter: a RigSplitter after centre(); cfg: the recon config (ref path, details block) */
  constructor(splitter, cfg, log = console.log) { this.s = splitter; this.cfg = cfg; this.log = log; }
  ink(hex) {
    const pal = this.s.r.palette, rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    let j = pal.findIndex((c) => c[0] === rgb[0] && c[1] === rgb[1] && c[2] === rgb[2]); if (j < 0) { pal.push(rgb); j = pal.length - 1; } return j;
  }
  /* the locked ref camera in centred voxel coordinates, at w x h */
  camera(w, h) {
    const v = this.s.r.view, L = v.lockVox, off = this.s.off, c = new Camera(w, h, { yaw: v.yaw, pitch: v.pitch, fov: v.fov });
    return c.place(L.target.map((t, i) => t - off[i]), L.dist);
  }
  score(list, cam, mask) { const g = new VoxelGrid(); for (const [x, y, z, c] of list) g.set(x, y, z, c); return Score.iou(g.render(cam).mask(), mask); }

  /* a straight sword: blade hilt -> tip (flat side towards the camera), brass crossguard, leather grip, brass pommel */
  static sword(o, ink) {
    const u = V3.norm(V3.sub(o.tip, o.hilt)), L = Math.hypot(...V3.sub(o.tip, o.hilt)), w = V3.norm(V3.cross(u, o.view)), n = V3.cross(u, w), out = new Map();
    const put = (p, c) => out.set(p.map(Math.round).join(','), c);
    for (let t = 0; t <= L; t += 0.35) {
      const half = t > L - o.half * 2.2 ? o.half * (L - t) / (o.half * 2.2) : o.half;   // tapered point
      for (let s = -half; s <= half; s += 0.35) for (let k = -o.thick; k <= o.thick; k += 0.5) {
        const e = Math.abs(s) / Math.max(0.01, o.half), c = e > 0.7 ? ink.edge : Math.abs(s) < 0.45 && t < L * 0.8 ? ink.fuller : ink.blade;
        put(V3.add(V3.add(o.hilt, V3.scale(u, t)), V3.add(V3.scale(w, s), V3.scale(n, k))), c);
      }
    }
    for (let s = -o.guard; s <= o.guard; s += 0.35) for (let k = -0.6; k <= 0.6; k += 0.5) for (let t = -0.6; t <= 0.4; t += 0.5) put(V3.add(V3.add(o.hilt, V3.scale(w, s)), V3.add(V3.scale(n, k), V3.scale(u, t))), Math.abs(s) > o.guard - 1 ? ink.brassD : ink.brass);
    for (let t = 1; t <= o.grip; t += 0.35) put(V3.sub(o.hilt, V3.scale(u, t)), ink.grip);
    const pm = V3.sub(o.hilt, V3.scale(u, o.grip + 1)); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 1) put(V3.add(pm, [dx, dy, dz]), ink.brass);
    return [...out].map(([k, c]) => [...k.split(',').map(Number), c, 'weapon']);
  }
  /* swap the reconstructed blade for a fitted sword: drop the old blade voxels, then solve hilt/tip by IoU */
  fitSword(o) {
    const S = this.s, ref = new RefImage(PngImage.read(this.cfg.ref)), W = Math.round(ref.w / 2), H = Math.round(ref.h / 2), mask = ref.mask(W, H), cam = this.camera(W, H);
    const ink = { blade: this.ink(o.colours.blade), edge: this.ink(o.colours.edge), fuller: this.ink(o.colours.fuller), brass: this.ink(o.colours.brass), brassD: this.ink(o.colours.brassD), grip: this.ink(o.colours.grip) };
    const view = V3.norm(V3.sub(cam.eye, cam.target));
    const drop = (v) => S.constructor.segDist(v, o.hilt, o.tip) <= o.clear || (o.clearBox && v[0] <= o.clearBox[0] && v[1] <= o.clearBox[1]);
    const base = S.vox.filter((v) => !drop(v)), dropped = S.vox.length - base.length;
    let x = { hilt: [...o.hilt], tip: [...o.tip], half: o.half }, best = this.score(base.concat(DetailKit.sword({ ...o, ...x, view }, ink)), cam, mask);
    const s0 = best; let step = 1.5;
    for (let it = 0; it < 5; it++, step *= 0.6) for (const key of ['hilt', 'tip']) for (let a = 0; a < 3; a++) for (const d of [-1, 1]) {
      const y = { ...x, [key]: x[key].map((v, i) => (i === a ? v + d * step : v)) }, sc = this.score(base.concat(DetailKit.sword({ ...o, ...y, view }, ink)), cam, mask);
      if (sc > best) { best = sc; x = y; }
    }
    S.vox = base.concat(DetailKit.sword({ ...o, ...x, view }, ink));
    this.log(`sword: dropped ${dropped} melted blade voxels, fitted hilt ${x.hilt.map((v) => v.toFixed(1))} tip ${x.tip.map((v) => v.toFixed(1))}, IoU ${s0.toFixed(4)} -> ${best.toFixed(4)}`);
    return { ...x, iou: best };
  }
  /* stamp a bitmap on the front-most voxels along +z (rows[0] on top, centred on cx at the top row y0); carve = recess the ink 1 voxel */
  decal(o) {
    const S = this.s, ink = Object.fromEntries(Object.entries(o.inks).map(([ch, hex]) => [ch, this.ink(hex)])), at = new Map();
    for (const v of S.vox) at.set(`${v[0]},${v[1]},${v[2]}`, v);
    let n = 0; const W = o.rows[0].length;
    o.rows.forEach((row, r) => [...row].forEach((ch, i) => {
      if (!(ch in ink)) return; const x = o.cx - (W >> 1) + i, y = o.y0 - r; let front = null;
      for (const v of S.vox) if (v[0] === x && v[1] === y && v[1] >= (o.minY || -1e9) && (!front || v[2] > front[2])) front = v;
      if (!front) return;
      if (o.carve && at.has(`${x},${y},${front[2] - 1}`)) { at.get(`${x},${y},${front[2] - 1}`)[3] = ink[ch]; front[3] = -1; } else front[3] = ink[ch];
      n++;
    }));
    S.vox = S.vox.filter((v) => v[3] >= 0); this.log(`decal ${o.name}: ${n} voxels`); return n;
  }
  /* a great helm: rounded box below a dome, a crest ridge over the top and down the brow, a visor bitmap recessed into the
     front face. o: { cx, cz, yaw, hx, hz, y0, yd (dome starts), y1 (top), eyeY, visor rows, tones, ink }. The shape voxels are
     in the head's local frame (yaw about the head's centre). */
  static helm(o, ink) {
    const out = [], c = Math.cos(o.yaw), s = Math.sin(o.yaw), H = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const W = o.visor[0].length;
    for (let x = Math.floor(o.cx - o.hx - 3); x <= Math.ceil(o.cx + o.hx + 3); x++) for (let z = Math.floor(o.cz - o.hz - 3); z <= Math.ceil(o.cz + o.hz + 3); z++) for (let y = o.y0; y <= o.y1 + 1; y++) {
      const dx = x - o.cx, dz = z - o.cz, lx = c * dx - s * dz, lz = s * dx + c * dz;
      const box = (lx / (o.hx + 0.4)) ** 4 + (lz / (o.hz + 0.4)) ** 4 <= 1, dome = (lx / (o.hx + 0.4)) ** 2 + (lz / (o.hz + 0.4)) ** 2 + ((y - o.yd) / (o.y1 - o.yd + 0.4)) ** 2 <= 1;
      const crest = Math.abs(lx) <= 0.7 && (lx / (o.hx + 1.4)) ** 2 + (lz / (o.hz + 1.4)) ** 2 + ((y - o.yd) / (o.y1 - o.yd + 1.4)) ** 2 <= 1 && (y > o.yd || lz > 0);
      const brow = Math.abs(lx) <= 0.7 && lz > 0 && y >= o.eyeY + 1 && y <= o.yd + 1 && (lx / (o.hx + 0.4)) ** 4 + (lz / (o.hz + 1.4)) ** 4 <= 1;
      if (!((y <= o.yd ? box : dome) || crest || brow)) continue;
      const front = lz >= o.hz - 1.2 && y <= o.yd, col = Math.round(lx) + (W >> 1), row = o.eyeY - y;
      let k = ink.tones[Math.floor(H(x, y, z) * ink.tones.length)];
      if (crest || brow) k = ink.light; else if (y === o.yd || y === o.y0) k = ink.band; else if (front && ink.face != null) k = ink.face;
      if (lz >= o.hz - 2.6 && y <= o.yd && row >= 0 && row < o.visor.length && col >= 0 && col < W && o.visor[row][col] === 'X') {
        if ((lx / (o.hx + 0.4)) ** 4 + ((lz + 1) / (o.hz + 0.4)) ** 4 > 1) continue;   // carve the outermost layer: a recessed slit
        k = ink.black;
      }
      out.push([x, y, z, k, 'head']);
    }
    return out;
  }
  fitHelm(o) {
    const S = this.s, ref = new RefImage(PngImage.read(this.cfg.ref)), W = Math.round(ref.w / 2), Hh = Math.round(ref.h / 2), mask = ref.mask(W, Hh), cam = this.camera(W, Hh);
    const ink = { tones: o.tones.map((h) => this.ink(h)), light: this.ink(o.light), band: this.ink(o.band), black: this.ink(o.black), face: o.face ? this.ink(o.face) : null };
    const cut = o.cut || [o.hx + 1, o.hz + 1], base = S.vox.filter((v) => !(v[1] >= o.y0 && Math.abs(v[0] - o.cx) <= cut[0] && Math.abs(v[2] - o.cz) <= cut[1])), dropped = S.vox.length - base.length;
    const lim = o.limits || {}, inside = (q) => Object.entries(lim).every(([k, [a, b]]) => q[k] >= a && q[k] <= b);
    let x = { cx: o.cx, cz: o.cz, yaw: o.yaw || 0, hx: o.hx, hz: o.hz, y1: o.y1 }, best = this.score(base.concat(DetailKit.helm({ ...o, ...x }, ink)), cam, mask), s0 = best;
    const st = { cx: 1, cz: 1, yaw: 0.15, hx: 1, hz: 1, y1: 1 };
    for (let it = 0; it < 4; it++) { for (const k of Object.keys(st)) for (const d of [-1, 1]) { const y = { ...x, [k]: x[k] + d * st[k] }; if (!inside(y)) continue; const sc = this.score(base.concat(DetailKit.helm({ ...o, ...y }, ink)), cam, mask); if (sc > best) { best = sc; x = y; } } for (const k in st) st[k] *= 0.6; }
    S.vox = base.concat(DetailKit.helm({ ...o, ...x }, ink));
    this.log(`helm: replaced ${dropped} voxels, fitted ${JSON.stringify(Object.fromEntries(Object.entries(x).map(([k, v]) => [k, +v.toFixed(2)])))}, IoU ${s0.toFixed(4)} -> ${best.toFixed(4)}`);
    return x;
  }
  apply() {
    const D = this.cfg.details || {};
    if (D.helm) this.fitHelm(D.helm);
    if (D.sword) this.fitSword(D.sword);
    for (const d of D.decals || []) this.decal(d);
  }
}
