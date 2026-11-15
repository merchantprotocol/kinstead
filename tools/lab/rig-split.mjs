/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* RigSplitter: cut a reconstructed voxel figure (tools/lab/recon.mjs output) into the hero bones that KV.VoxelAnimator
   drives (hips > torso > head / armR > weapon / armL > shield / cape; hips > legR / legL) and write the model data file
   src/models/<id>.data.js. The rules are humanoid and driven by a few landmarks in the config's "rig" block (model voxel
   coordinates after centring; front +z, the figure's own right hand on -x):
     neck, belt, crotch      heights of the helm's lower edge, the belt, the fork of the legs
     shoulderX               |x| beyond which voxels between belt-12 and neck+6 belong to the arms
     sword: { hilt, tip, r } the blade's axis (voxels within r of it, from 5 voxels above the hilt to the tip) -> weapon
     shield: { c, n, depth, r } plate centre, outward normal, thickness kept behind the face, radius -> shield
     capeZ                   red voxels behind this z (and below the neck) -> cape
   Usage: node tools/lab/rig-split.mjs tools/lab/recon/<id>.json */
import fs from 'node:fs';
import path from 'node:path';
import { Lab } from './recon-kit.mjs';
import { DetailKit } from './details.mjs';

export class RigSplitter {
  static ORDER = ['hips', 'torso', 'head', 'armR', 'weapon', 'armL', 'shield', 'cape', 'legR', 'legL'];   // parents before children
  constructor(recon, rig, cfg = null) { this.r = recon; this.rig = rig; this.cfg = cfg; }

  /* centre the figure on x/z (the mean of the hip band), feet on y = 0 */
  centre() {
    const v = this.r.vox, band = this.rig.centreBand || [this.rig.crotch, this.rig.belt]; let sx = 0, sz = 0, n = 0, minY = 1e9;
    for (let i = 0; i < v.length; i += 4) { minY = Math.min(minY, v[i + 1]); if (v[i + 1] >= band[0] && v[i + 1] <= band[1]) { sx += v[i]; sz += v[i + 2]; n++; } }
    this.off = [Math.round(sx / n), minY, Math.round(sz / n)];
    this.vox = []; for (let i = 0; i < v.length; i += 4) this.vox.push([v[i] - this.off[0], v[i + 1] - this.off[1], v[i + 2] - this.off[2], v[i + 3]]);
    return this.off;
  }
  isRed(ci) { const l = Lab.fromRgb(this.r.palette[ci]); return l[1] > 22 && l[1] > l[2] * 0.9; }
  static segDist(p, a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    let t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + d[0] * t - p[0], a[1] + d[1] * t - p[1], a[2] + d[2] * t - p[2]);
  }
  bone([x, y, z, c, forced]) {
    if (forced) return forced;
    const R = this.rig, sw = R.sword, sh = R.shield;
    if (sw) {
      const u = [sw.tip[0] - sw.hilt[0], sw.tip[1] - sw.hilt[1], sw.tip[2] - sw.hilt[2]], L = Math.hypot(...u), top = sw.hilt.map((v, i) => v - (u[i] / L) * (sw.grip || 5));
      if (RigSplitter.segDist([x, y, z], top, sw.tip) <= sw.r && y < sw.hilt[1] + (sw.grip || 5)) return 'weapon';
    }
    if (sh) {
      const d = (x - sh.c[0]) * sh.n[0] + (y - sh.c[1]) * sh.n[1] + (z - sh.c[2]) * sh.n[2], rr = Math.hypot(x - sh.c[0] - d * sh.n[0], y - sh.c[1] - d * sh.n[1], z - sh.c[2] - d * sh.n[2]);
      if (d >= -sh.depth && d <= 4 && rr <= sh.r) return 'shield';
    }
    if (R.capeZ != null && z < R.capeZ && y < R.neck && this.isRed(c)) return 'cape';
    if (y >= R.neck && Math.abs(x - (R.headCX || 0)) <= R.headX) return 'head';
    if (Math.abs(x) >= R.shoulderX && y >= R.belt - (R.armDrop || 12) && y < R.neck + 8) return x < 0 ? 'armR' : 'armL';
    if (y >= R.belt) return 'torso';
    if (y >= R.crotch) return 'hips';
    return x < (R.forkX || 0) ? 'legR' : 'legL';
  }
  /* drop voxels buried 3+ deep (never seen, even when a joint bends) */
  hollow(list) {
    const S = new Set(list.map((v) => `${v[0]},${v[1]},${v[2]}`)), deep = (x, y, z) => { for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (!S.has(`${x + dx},${y + dy},${z + dz}`)) return false; return true; };
    return list.filter((v) => !deep(v[0], v[1], v[2]));
  }
  /* static pieces (buildings, props): one part, glowing palette entries flagged, point lights at the glow clusters */
  splitStatic() {
    const v = this.r.vox; let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < v.length; i += 4) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[i + k]); hi[k] = Math.max(hi[k], v[i + k]); }
    this.off = [Math.round((lo[0] + hi[0]) / 2), lo[1], Math.round((lo[2] + hi[2]) / 2)];
    this.vox = []; for (let i = 0; i < v.length; i += 4) this.vox.push([v[i] - this.off[0], v[i + 1] - this.off[1], v[i + 2] - this.off[2], v[i + 3]]);
    if (this.cfg && this.cfg.details) new DetailKit(this, this.cfg).apply();
    const g = this.cfg && this.cfg.glow; this.glow = [];
    if (g) this.r.palette.forEach((c, j) => { const l = Lab.fromRgb(c); if (l[0] >= g.L && l[2] >= g.b && l[1] >= (g.a || 0)) this.glow.push(j); });
    const cells = new Map();
    for (const [x, y, z, c] of this.vox) if (this.glow.includes(c)) { const k = [x, y, z].map((q) => Math.floor(q / 8)).join(','); const e = cells.get(k) || [0, 0, 0, 0]; e[0] += x; e[1] += y; e[2] += z; e[3]++; cells.set(k, e); }
    this.lights = [...cells.values()].filter((e) => e[3] >= 3).sort((a, b) => b[3] - a[3]).slice(0, 4).map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], Math.min(1, e[3] / 30)].map((q) => +q.toFixed(2)));
    this.parts = { main: this.hollow(this.vox.map((q) => q.slice(0, 4))) };
    return this.parts;
  }
  split() {
    if (this.cfg && this.cfg.kind === 'static') return this.splitStatic();
    this.centre(); if (this.cfg && this.cfg.details) new DetailKit(this, this.cfg).apply();
    const parts = {};
    for (const v of this.vox) { const b = this.bone(v); (parts[b] = parts[b] || []).push(v.slice(0, 4)); }
    for (const k in parts) parts[k] = this.hollow(parts[k]);
    this.parts = parts; return parts;
  }
  writeStatic(file, view) {
    const C = this.cfg, hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
    const data = { id: this.r.id, kind: 'static', ref: C.labRef || null, height: C.heightM, voxels: this.r.height, footprint: C.footprint || null, view, palette: this.r.palette.map(hex), glow: this.glow, lights: this.lights,
      parts: { main: { pivot: [0, 0, 0], parent: null, data: RigSplitter.pack(this.parts.main), n: this.parts.main.length } } };
    fs.writeFileSync(file, `/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* GENERATED by tools/lab/rig-split.mjs from tools/lab/recon/${this.r.id}.json (reconstruction of public/lab/${this.r.id}.png).
   Do not hand edit: re-run the pipeline (see ASSET-LAB.md). Voxels: base64 of int8 x, y, z + uint8 palette index. */
(function (G) { const K = (G.K = G.K || {}); K.ModelData = K.ModelData || {}; K.ModelData[${JSON.stringify(this.r.id)}] = ${JSON.stringify(data)}; })(typeof window !== 'undefined' ? window : globalThis);
`);
    return { file, counts: { main: this.parts.main.length, glowEntries: this.glow.length, lights: this.lights.length } };
  }
  /* parts -> base64 of Int8 x, y, z + Uint8 palette index per voxel */
  static pack(list) { const b = Buffer.alloc(list.length * 4); list.forEach((v, i) => { b.writeInt8(v[0], i * 4); b.writeInt8(v[1], i * 4 + 1); b.writeInt8(v[2], i * 4 + 2); b.writeUInt8(v[3], i * 4 + 3); }); return b.toString('base64'); }
  write(file) {
    const R = this.rig, hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
    /* the locked ref camera, from recon voxel space into model metres (mesher cubes span [v, v + 1], recon cubes [v - .5, v + .5]) */
    const size = ((this.cfg && this.cfg.heightM) || (R && R.heightM) || 1.56) / this.r.height, view = { ...this.r.view };
    if (view.lockVox) { view.lock = { target: view.lockVox.target.map((v, i) => +((v - this.off[i] + 0.5) * size).toFixed(4)), dist: +(view.lockVox.dist * size).toFixed(4) }; delete view.lockVox; }
    if (this.cfg && this.cfg.kind === 'static') return this.writeStatic(file, view);
    const pivots = R.pivots, data = {
      id: this.r.id, height: R.heightM || 1.56, voxels: this.r.height, view, palette: this.r.palette.map(hex),
      parts: Object.fromEntries(RigSplitter.ORDER.filter((n) => this.parts[n]).map((n) => [n, { pivot: pivots[n] || [0, 0, 0], parent: (R.parents || {})[n] || null, data: RigSplitter.pack(this.parts[n]), n: this.parts[n].length }])),
    };
    const body = `/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* GENERATED by tools/lab/rig-split.mjs from tools/lab/recon/${this.r.id}.json (reconstruction of public/lab/${this.r.id}.png).
   Do not hand edit: re-run the pipeline (see ASSET-LAB.md). Voxels per part: base64 of int8 x, y, z + uint8 palette index. */
(function (G) { const K = (G.K = G.K || {}); K.ModelData = K.ModelData || {}; K.ModelData[${JSON.stringify(this.r.id)}] = ${JSON.stringify(data)}; })(typeof window !== 'undefined' ? window : globalThis);
`;
    fs.writeFileSync(file, body); return { file, counts: Object.fromEntries(Object.entries(this.parts).map(([n, l]) => [n, l.length])) };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), recon = JSON.parse(fs.readFileSync(path.join(cfg.out, `${cfg.id}-recon.json`), 'utf8'));
  const s = new RigSplitter(recon, cfg.rig, cfg); s.split();
  console.log('offset', s.off, JSON.stringify(s.write(path.join('src/models', `${cfg.id}.data.js`)).counts));
}
