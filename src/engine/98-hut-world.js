/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the world around the hut. A big snowfield and forest with rocky hills to mine, whose edges you
   never see: the camera cannot zoom out far enough and the distance fades into fog. There are no walls,
   ruins, keeps or bridges. Everything that is in the world is something you can use.
     HutLayout        where things are (hut, hills, where wolves appear from)
     HutWorldBuilder  the terrain and the trees and boulders */
(function (G) {
  const K = G.K;
  const { TILE } = K, HQ = 0.25;

  class HutLayout {
    constructor() {
      this.size = { w: 280, h: 200 };                                  // tiles -> 140 x 100 m
      this.keep = { x: 70, z: 50, r: 2.3 };                           // the hut (the game still calls it "keep" in places)
      this.hearth = { x: 68.4, z: 49.6 };                             // the fireplace: warmth and light
      this.home = { x: 135, z: 97, w: 10, h: 7 };                    // the cottage's north-west tile and size (tiles)
      this.start = { x: 69.75, z: 50.75 };                           // you wake up inside
      this.ruins = {}; this.kin = {}; this.barriers = {}; this.outcrop = null; this.troll = null;
      this.hills = [{ x: 96, z: 36, r: 6, h: 3.5 }, { x: 42, z: 66, r: 5, h: 3 }, { x: 56, z: 22, r: 5, h: 3 }, { x: 104, z: 70, r: 6, h: 3.5 }, { x: 34, z: 34, r: 5, h: 3 }];
      this.outside = [{ x: 70, z: 12 }, { x: 70, z: 88 }, { x: 14, z: 50 }, { x: 126, z: 50 }];
      // where wolves and thieves walk in from: just beyond what the camera can show
      this.frostEdges = { north: { x0: 40, x1: 100, z: 9 }, south: { x0: 40, x1: 100, z: 91 }, west: { x: 10, z0: 30, z1: 70 } };
    }
    /** the cottage: the same kind of house the World Builder makes (timber, thatch, kitchen and bedroom) */
    homeSpec() {
      const h = this.home;
      return K.BuildingSpec.normalize({
        kind: 'building', id: 'home', prefab: 'cottage', x: h.x, z: h.z, seed: 11,
        footprint: { shape: 'rect', w: h.w, h: h.h }, walls: 'timber', roof: { style: 'gable', material: 'thatch' }, interiorFloor: 'planks', wallH: 2.1,
        rooms: [{ id: 'kitchen', type: 'kitchen', x: 0, z: 0, w: 5, h: 7 }, { id: 'bed', type: 'bedroom', x: 5, z: 0, w: 5, h: 7 }],
        doors: [{ x: 2, z: 6, side: 's', w: 2 }, { x: 5, z: 3, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 7, z: 6, side: 's', w: 2 }, { x: 9, z: 3, side: 'e', w: 1 }, { x: 6, z: 0, side: 'n', w: 1 }, { x: 0, z: 4, side: 'w', w: 1 }],
        furniture: [
          { type: 'hearth', x: 0, z: 1, rot: 1 }, { type: 'pantry', x: 2, z: 0, rot: 0 }, { type: 'table', x: 2, z: 3, rot: 0 }, { type: 'chair', x: 1, z: 4, rot: 1 },
          { type: 'shelf', x: 3, z: 6, rot: 0 }, { type: 'sack', x: 0, z: 6 }, { type: 'bed', x: 8, z: 0, rot: 0 }, { type: 'chest', x: 8, z: 3, rot: 0 }, { type: 'candle', x: 6, z: 0 },
          { type: 'rug', x: 6, z: 4, rot: 0 }, { type: 'chair', x: 8, z: 5, rot: 2 },
        ],
      });
    }
    dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
    inIronHills() { return false; }
  }

  class HutWorldBuilder extends K.CastleWorldBuilder {
    constructor(layout = new HutLayout(), seed = 2207) { super(layout, seed); }
    heightAt(x, z) {
      const L = this.L, n = this.n, wu = L.size.w * TILE, hu = L.size.h * TILE;
      const rim = Math.min(x, z, wu - x, hu - z);
      if (rim < 3) return { h: 2.5 + Math.round(n.fbm(x * 0.4, z * 0.4, 3) * 5) * 0.5, rock: true };   // far beyond the fog: just a horizon
      for (const H of L.hills) { const d = Math.hypot(x - H.x, z - H.z); if (d < H.r) return { h: Math.round(H.h * Math.pow(1 - d / H.r, 0.85) * 4) / 4 + 0.25, rock: true }; }
      const dk = Math.hypot(x - L.keep.x, z - L.keep.z); if (dk < 9) return { h: 0 };
      return { h: Math.max(0, Math.round((n.fbm(x * 0.06, z * 0.06, 3) - 0.45) * 2.0 * Math.min(1, (dk - 9) / 10) * 4) / 4) };
    }
    objects() {
      const L = this.L, R = this.R, n = this.n, wu = L.size.w * TILE, hu = L.size.h * TILE;
      this.prop('start', L.start.x, L.start.z, { hero: 'warden' });
      this.doc.objects.push(L.homeSpec());   // the house
      const near = (x, z, m) => this.doc.objects.some((o) => o.kind === 'prop' && Math.hypot(o.x - x, o.z - z) < m);
      let trees = 0, tries = 0;
      while (trees < 760 && tries++ < 5200) {
        const x = R.range(5, wu - 5), z = R.range(5, hu - 5), dk = Math.hypot(x - L.keep.x, z - L.keep.z); if (dk < 7.5) continue;
        const r = this.heightAt(x, z); if (r.rock) continue;
        const forest = Math.max(0.1, Math.min(1, (n.fbm(x * 0.05, z * 0.05, 2) - 0.36) * 3.2)); if (R.next() > forest) continue;
        if (near(x, z, 1.9)) continue;
        const dead = R.next() >= 0.88; this.prop(dead ? 'c:deadtree' : 'c:pine', x, z, { s: R.range(0.85, 1.25), name: dead ? 'Dead tree' : 'Snow pine' }); trees++;
      }
      for (let k = 0, got = 0; got < 34 && k < 900; k++) { const x = R.range(8, wu - 8), z = R.range(8, hu - 8); if (Math.hypot(x - L.keep.x, z - L.keep.z) < 8 || this.heightAt(x, z).rock || near(x, z, 2.2)) continue; this.prop('c:boulder', x, z, { name: 'Boulder', rot: R.range(0, 6) }); got++; }
      for (let k = 0, got = 0; got < 24 && k < 600; k++) { const x = R.range(8, wu - 8), z = R.range(8, hu - 8); if (Math.hypot(x - L.keep.x, z - L.keep.z) < 7 || this.heightAt(x, z).rock || near(x, z, 1.8)) continue; this.prop('rock', x, z, { s: R.range(0.8, 1.4) }); got++; }
    }
  }

  Object.assign(K, { HutLayout, HutWorldBuilder });
})(typeof window !== 'undefined' ? window : globalThis);
