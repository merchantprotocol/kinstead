/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Regenerates the prebuilt worlds: seed-generated .world.json files, top-down thumbnails and
   worlds/index.json. Hand-built worlds (no seed) are kept as they are; only their thumbnail is redrawn.
   Run: npm run worlds */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EngineContext } from './lib/engine-context.mjs';
import { PngEncoder } from './lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* the catalogue of prebuilt worlds, in menu order */
const CATALOGUE = [
  { id: 'frostcliff-crossing', name: 'Frostcliff Crossing', description: 'The hand-built example: a camp by the rift bridge, a witch, ghouls and a troll on the far side.' },
  { id: 'rimewood-rift', name: 'Rimewood Rift', seed: 7, size: [64, 48], description: 'A small generated world (seed 7): pine woods split by a frozen chasm.' },
  { id: 'hollowmere-reach', name: 'Hollowmere Reach', seed: 90210, size: [128, 96], description: 'A medium generated world (seed 90210): a long rift with several crossings to explore.' },
];

class ThumbnailPainter {
  static WIDTH = 256;
  constructor(K) { this.K = K; this.png = new PngEncoder(); }
  /* top-down ground painted with the game's own GroundPainter, plus markers for props and creatures */
  paint(doc) {
    const K = this.K, ppu = Math.max(1, Math.round(ThumbnailPainter.WIDTH / doc.wu));
    const tp = K.TILE * ppu, W = Math.round(doc.w * tp), H = Math.round(doc.h * tp);
    const out = new K.PixelBuffer(W, H), spark = new K.PixelBuffer(W, H);
    new K.GroundPainter(7).paint(doc, out, spark, 0, 0, 0, 0, doc.w, doc.h, ppu);
    for (const o of doc.objects) {
      if (o.kind !== 'prop') continue;
      const c = this.markerColour(o.type); if (!c) continue;
      const r = /^(pine|deadtree)$/.test(o.type) ? Math.max(1, ppu * 0.35) : Math.max(1, ppu * 0.25);
      this.dot(out, o.x * ppu, o.z * ppu, r, c);
    }
    return this.png.encode(W, H, out.data);
  }
  markerColour(type) {
    if (type === 'pine') return [34, 66, 52];
    if (type === 'deadtree') return [92, 74, 60];
    if (type === 'campfire' || type === 'torch') return [255, 170, 60];
    if (type === 'start') return [80, 200, 255];
    if (type === 'sprite') return [200, 60, 60];
    return null;
  }
  dot(buf, cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) buf.set(x, y, c);
  }
}

class WorldMaker {
  constructor(root, engine) { this.root = root; this.K = engine.K; this.thumbs = new ThumbnailPainter(engine.K); }
  file(id) { return path.join(this.root, 'worlds', id + '.world.json'); }
  /* a generated world: Frostcliff generator + a Player start by the camp + a camera on the hero crossing */
  generate(entry) {
    const K = this.K, doc = new K.WorldGenerator(entry.seed).generate(entry.size[0], entry.size[1], entry.name);
    this.addStart(doc);
    const b = doc.objects.find((o) => o.kind === 'bridge');
    doc.camera = b ? { tx: b.a[0] + 0.7, ty: 0.7, tz: b.a[1] + 0.4, yaw: -0.1, pitch: 0.6, dist: 11.5 } : { tx: doc.wu / 2, ty: 0, tz: doc.hu / 2, yaw: -0.2, pitch: 0.7, dist: 21 };
    return doc;
  }
  addStart(doc) {
    const fire = doc.objects.find((o) => o.kind === 'prop' && o.type === 'campfire');
    const cx = fire ? fire.x : doc.wu / 2, cz = fire ? fire.z : doc.hu / 2, blocked = new Set([4, 5]); // chasm, water
    for (const [dx, dz] of [[1.2, 0.6], [-1.2, 0.6], [0.6, 1.2], [0.6, -1.2], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const x = cx + dx, z = cz + dz, [i, j] = doc.tileOf(x, z);
      if (i < 0 || j < 0 || i >= doc.w || j >= doc.h || blocked.has(doc.type(i, j))) continue;
      doc.objects.push({ id: doc.uid('p'), kind: 'prop', type: 'start', x: +x.toFixed(2), z: +z.toFixed(2), rot: 0, s: 1, seed: 1, hero: 'warden' });
      return;
    }
  }
  run() {
    const manifest = [];
    for (const entry of CATALOGUE) {
      let doc;
      if (entry.seed != null) {
        doc = this.generate(entry);
        fs.writeFileSync(this.file(entry.id), JSON.stringify(doc.toJSON()) + '\n');
      } else {
        const o = JSON.parse(fs.readFileSync(this.file(entry.id), 'utf8'));
        if (o.name !== entry.name) { o.name = entry.name; fs.writeFileSync(this.file(entry.id), JSON.stringify(o) + '\n'); }
        doc = this.K.WorldDoc.fromJSON(o);
      }
      const thumb = `worlds/thumbs/${entry.id}.png`;
      fs.mkdirSync(path.join(this.root, 'worlds/thumbs'), { recursive: true });
      fs.writeFileSync(path.join(this.root, thumb), this.thumbs.paint(doc));
      manifest.push({ id: entry.id, name: entry.name, description: entry.description, file: `worlds/${entry.id}.world.json`, thumbnail: thumb, size: { w: doc.w, h: doc.h }, ...(entry.seed != null ? { seed: entry.seed } : {}) });
      console.log(`world ${entry.id}: ${doc.w}x${doc.h}, ${doc.objects.length} objects`);
    }
    fs.writeFileSync(path.join(this.root, 'worlds/index.json'), JSON.stringify({ worlds: manifest }, null, 2) + '\n');
  }
}

new WorldMaker(ROOT, new EngineContext(path.join(ROOT, 'src/engine'))).run();
