/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Asset Lab reconstruction: reference image + TripoSR prior -> coloured, palette-snapped voxels at the calibrated ref camera.
     node tools/lab/recon.mjs <config.json>          (configs live in tools/lab/recon/<id>.json)
   Steps (docs/STRATEGY.md): calibrate camera -> find the facing by symmetry -> voxelize prior -> lift the ref's visible
   pixels onto the prior's depth -> carve to the ref silhouette -> colour by projection -> CIELAB palette -> preview PNG +
   voxel JSON for the rig splitter (tools/lab/rig-split.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { PngImage } from './png.mjs';
import { V3, Camera, RefImage, Score, MeshPrior, VoxelGrid, Lab, PaletteFit } from './recon-kit.mjs';

export class Reconstruction {
  constructor(cfg, log = console.log) { this.cfg = { height: 93, palette: 28, pitch: 0.15, fit: 'height', ...cfg }; this.log = log; }

  load() {
    const c = this.cfg;
    this.ref = new RefImage(PngImage.read(c.ref)); this.box = this.ref.box();
    this.prior = new MeshPrior(JSON.parse(fs.readFileSync(c.prior, 'utf8')), { upAxis: c.upAxis || 'z', height: c.height });
    return this;
  }
  cam(w, h, yaw, pitch, fov, step = 5) { return new Camera(w, h, { yaw, pitch, fov, fit: this.cfg.fit }).frame(this.prior.points(step), this.box); }

  /* 1. relative azimuth / pitch / fov that best overlay the prior's silhouette on the ref (coarse grid, then coordinate descent) */
  calibrate() {
    const W = Math.round(this.ref.w / 4), H = Math.round(this.ref.h / 4), rm = this.ref.mask(W, H);
    const ev = (x, w = W, h = H, m = rm) => { this.prior.setYaw(x.a); return Score.iou(this.prior.render(this.cam(w, h, 0, x.p, x.f, 9)).mask(), m); };
    let best = { s: -1 };
    for (let a = 0; a < 360; a += 10) for (const p of [0, 0.15, 0.3, 0.45, 0.6]) { const x = { a: (a * Math.PI) / 180, p, f: 18 }, s = ev(x); if (s > best.s) best = { s, x }; }
    const W2 = W * 2, H2 = H * 2, rm2 = this.ref.mask(W2, H2); let x = best.x, s = ev(x, W2, H2, rm2); const st = { a: 0.08, p: 0.06, f: 8 };
    for (let it = 0; it < 8; it++) {
      for (const k of ['a', 'p', 'f']) for (const d of [-1, 1]) { const y = { ...x, [k]: x[k] + d * st[k] }; if (y.f < 4 || y.f > 60) continue; const t = ev(y, W2, H2, rm2); if (t > s) { s = t; x = y; } }
      for (const k in st) st[k] *= 0.6;
    }
    this.calib = { ...x, iou: s }; this.log(`calibrate: prior azimuth ${(x.a * 180 / Math.PI).toFixed(1)} deg, pitch ${x.p.toFixed(3)}, fov ${x.f.toFixed(1)}, prior IoU ${s.toFixed(3)}`);
    return this.calib;
  }

  /* 2. the facing: the yaw b that makes the upper body most mirror-symmetric in x, with the front (+z) towards the camera */
  facing() {
    const { a } = this.calib, [y0, y1] = this.cfg.symBand || [0.6, 1.0], H = this.cfg.height;
    this.prior.setYaw(a);
    const pts = [...this.prior.voxelize()].map(VoxelGrid.unk).filter((p) => p[1] >= y0 * H && p[1] <= y1 * H);
    let best = { s: -1 };
    for (let d = 0; d < 360; d += 1) {
      const b = (d * Math.PI) / 180, c = Math.cos(b), sn = Math.sin(b), vox = new Set(), R = [];
      for (const [x, y, z] of pts) { const q = [Math.round(c * x + sn * z), y, Math.round(-sn * x + c * z)]; R.push(q); vox.add(q.join(',')); }
      let cx = 0; for (const q of R) cx += q[0]; cx = Math.round(cx / Math.max(1, R.length));
      let hit = 0; for (const q of R) if (vox.has(`${2 * cx - q[0]},${q[1]},${q[2]}`)) hit++;
      const camZ = Math.cos(b) * Math.cos(this.calib.p);   // camera direction's z after rotating the world by b (camera yaw becomes b)
      const s = hit / Math.max(1, R.length); if (camZ > 0.05 && s > best.s) best = { s, b, d };
    }
    if (this.cfg.facingOffsetDeg) best.b += (this.cfg.facingOffsetDeg * Math.PI) / 180;
    this.yaw = best.b; this.prior.setYaw(a + best.b);
    this.log(`facing: world turned ${(best.b * 180 / Math.PI).toFixed(1)} deg (symmetry ${best.s.toFixed(3)}); ref camera yaw ${best.b.toFixed(3)} rad`);
    return best;
  }
  refCam(w = this.ref.w, h = this.ref.h) { return this.cam(w, h, this.yaw, this.calib.p, this.calib.f, 3); }

  /* 3-5. volume + lifted visible shell, carved to the ref silhouette */
  build() {
    const g = new VoxelGrid(), cam = this.refCam(), R = this.prior.render(cam), A = this.ref.png.data, W = this.ref.w, Hh = this.ref.h;
    for (const k of this.prior.voxelize()) g.v.set(k, null);
    const nVol = g.size;
    /* lift: each solid ref pixel to the prior's depth there (or the nearest depth within 8 px), half a voxel inside */
    let lifted = 0;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      if (A[(y * W + x) * 4 + 3] <= 200) continue;
      let d = R.depth[y * W + x];
      if (!isFinite(d)) { let bd = Infinity; for (let r = 1; r <= 8 && !isFinite(d); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue; const z = R.depth[yy * W + xx]; if (isFinite(z) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; d = z; } } }
      if (!isFinite(d)) continue;
      const p = cam.unproject(x + 0.5, y + 0.5, d + 0.5), k = VoxelGrid.k(Math.round(p[0]), Math.round(p[1]), Math.round(p[2]));
      if (!g.v.has(k)) { g.v.set(k, null); lifted++; }
    }
    /* carve: a voxel whose centre lands on transparent ref (no alpha > 40 within 1 px) cannot be part of the asset */
    let carved = 0;
    for (const k of [...g.v.keys()]) {
      const p = cam.project(VoxelGrid.unk(k)), x = Math.floor(p[0]), y = Math.floor(p[1]); let ok = false;
      for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < Hh && A[(yy * W + xx) * 4 + 3] > 40) ok = true; }
      if (!ok) { g.v.delete(k); carved++; }
    }
    if (this.cfg.floor != null) for (const k of [...g.v.keys()]) if (VoxelGrid.unk(k)[1] < this.cfg.floor) g.v.delete(k);
    this.grid = g; this.log(`build: ${nVol} prior voxels + ${lifted} lifted - ${carved} carved = ${g.size}`);
    return g;
  }

  /* 6-7. colour by projection (mean CIELAB of the ref pixels each visible voxel covers), palette, unseen voxels by prior colour */
  colour() {
    const g = this.grid, cam = this.refCam(), R = g.render(cam), A = this.ref.png.data, W = this.ref.w, Hh = this.ref.h, acc = new Map();
    /* colour only from pixels well inside the cutout: the glow halo tints the outer ~4 px orange */
    const core = this.ref.mask(W, Hh, this.cfg.colourAlpha || 250), er = this.cfg.edgeErode == null ? 4 : this.cfg.edgeErode, ok = new Uint8Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let good = core[y * W + x] === 1; for (let dy = -er; dy <= er && good; dy++) for (let dx = -er; dx <= er && good; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh || !core[yy * W + xx]) good = false; } ok[y * W + x] = good ? 1 : 0; }
    /* the baked rim glow also sits on opaque pixels near the outline: warm, bright pixels within glowBand px of the
       outline are lighting, not paint */
    const band = this.cfg.glowBand == null ? 14 : this.cfg.glowBand, near = new Uint8Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { if (!core[y * W + x]) continue; let n = false; for (let dy = -band; dy <= band && !n; dy += 2) for (let dx = -band; dx <= band && !n; dx += 2) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh || !core[yy * W + xx]) n = true; } near[y * W + x] = n ? 1 : 0; }
    /* near the outline, anything that is not red cloth (a* < 22) is read as glow-lit steel: keep its lightness (capped) and
       drop the warm tint. Inside, the ref's colours are taken as painted. */
    let glow = 0; const fix = new Map(), [gL, gA, gB] = this.cfg.glowTo || [64, 0, -1];
    for (let i = 0; i < W * Hh; i++) if (ok[i] && near[i]) { const l = Lab.fromRgb([A[i * 4], A[i * 4 + 1], A[i * 4 + 2]]); if (l[1] < 22 && (l[2] > 8 || l[0] > gL)) { fix.set(i, [Math.min(gL, l[0] * 0.85), gA, gB]); glow++; } }
    for (let i = 0; i < R.id.length; i++) {
      const id = R.id[i]; if (id < 0 || !ok[i]) continue;
      const lab = fix.get(i) || Lab.fromRgb([A[i * 4], A[i * 4 + 1], A[i * 4 + 2]]), k = R.keys[id], s = acc.get(k) || [0, 0, 0, 0];
      s[0] += lab[0]; s[1] += lab[1]; s[2] += lab[2]; s[3]++; acc.set(k, s);
    }
    const seen = new Map(); for (const [k, s] of acc) if (s[3] >= 3) seen.set(k, [s[0] / s[3], s[1] / s[3], s[2] / s[3]]);
    const pf = new PaletteFit(this.cfg.palette), C = pf.fit([...seen.values()]);
    const idx = new Map(); for (const [k, lab] of seen) idx.set(k, pf.nearest(C, lab));
    /* unseen voxels: first grow the seen colours 2 voxels into their neighbours (silhouette rims, recesses), then the rest by
       the prior's own colour matched to per-palette prototypes (mean prior colour of the seen voxels that took that entry) */
    for (let ring = 0; ring < (this.cfg.grow == null ? 6 : this.cfg.grow); ring++) {
      const add = [];
      for (const k of g.v.keys()) {
        if (idx.has(k)) continue; const [x, y, z] = VoxelGrid.unk(k), votes = new Map();
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const j = idx.get(VoxelGrid.k(x + dx, y + dy, z + dz)); if (j != null) votes.set(j, (votes.get(j) || 0) + 1); }
        if (votes.size) add.push([k, [...votes].sort((p, q) => q[1] - p[1])[0][0]]);
      }
      for (const [k, j] of add) idx.set(k, j);
    }
    const proto = C.map(() => [0, 0, 0, 0]);
    for (const [k] of seen) { const pc = this.prior.colourAt(VoxelGrid.unk(k)); if (!pc) continue; const l = Lab.fromRgb(pc), j = idx.get(k); proto[j][0] += l[0]; proto[j][1] += l[1]; proto[j][2] += l[2]; proto[j][3]++; }
    const P = proto.map((s) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : null));
    let unseen = 0;
    for (const k of g.v.keys()) {
      if (idx.has(k)) continue; unseen++;
      const pc = this.prior.colourAt(VoxelGrid.unk(k)); if (!pc) { idx.set(k, 0); continue; }
      const l = Lab.fromRgb(pc); let b = 0, bd = Infinity; P.forEach((q, j) => { if (q) { const d = Lab.dE(l, q); if (d < bd) { bd = d; b = j; } } }); idx.set(k, b);
    }
    this.palette = C.map((c) => Lab.toRgb(c)); this.idx = idx;
    this.log(`colour: ${glow} glow pixels de-lit, ${seen.size} seen voxels, ${unseen} unseen (prior colour prototypes), palette ${C.length}`);
    return idx;
  }

  /* flat-shaded preview at the ref camera (exposed-face shading by normal, like a quick studio light) and the grid as JSON */
  preview(file) {
    const cam = this.refCam(), R = this.grid.render(cam), out = new PngImage(cam.w, cam.h);
    for (let i = 0; i < R.id.length; i++) {
      const d = i * 4; if (R.id[i] < 0) { out.data[d] = 211; out.data[d + 1] = 213; out.data[d + 2] = 217; out.data[d + 3] = 255; continue; }
      const c = this.palette[this.idx.get(R.keys[R.id[i]])]; out.data[d] = c[0]; out.data[d + 1] = c[1]; out.data[d + 2] = c[2]; out.data[d + 3] = 255;
    }
    out.write(file); return file;
  }
  /* scorecard at the ref camera on the preview render: IoU (alpha > 200) and mean dE over the overlap */
  score() {
    const cam = this.refCam(), R = this.grid.render(cam), A = this.ref.png.data, rm = this.ref.mask(), mm = R.mask(); let de = 0, n = 0;
    for (let i = 0; i < mm.length; i++) if (mm[i] && rm[i]) { const c = this.palette[this.idx.get(R.keys[R.id[i]])]; de += Lab.dE(Lab.fromRgb(c), Lab.fromRgb([A[i * 4], A[i * 4 + 1], A[i * 4 + 2]])); n++; }
    return { iou: Score.iou(mm, rm), dE: de / Math.max(1, n) };
  }
  save(file) {
    const vox = []; for (const [k, j] of this.idx) { const [x, y, z] = VoxelGrid.unk(k); vox.push(x, y, z, j); }
    const out = { id: this.cfg.id, height: this.cfg.height, view: { yaw: +this.yaw.toFixed(4), pitch: +this.calib.p.toFixed(4), fov: +this.calib.f.toFixed(2), fit: this.cfg.fit }, palette: this.palette, vox };
    fs.writeFileSync(file, JSON.stringify(out)); return out;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfgFile = process.argv[2], cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')), out = cfg.out || path.dirname(cfgFile);
  const r = new Reconstruction(cfg).load(), t0 = Date.now(); r.calibrate(); r.facing(); r.build(); r.colour(); console.log(`took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log('score', JSON.stringify(r.score()));
  r.preview(path.join(out, `${cfg.id}-recon.png`)); r.save(path.join(out, `${cfg.id}-recon.json`));
}
