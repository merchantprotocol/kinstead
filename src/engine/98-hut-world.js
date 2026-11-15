/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the world around the hut. A big snowfield and forest with rocky hills to mine, whose edges you
   never see: the camera cannot zoom out far enough and the distance fades into fog. There are no walls,
   ruins, keeps or bridges. Everything that is in the world is something you can use.
     HutLayout        where things are (hut, hills, where wolves appear from)
     HutWorldBuilder  the terrain and the trees and boulders */
(function (G) {
  const K = G.K;
  const { TILE } = K, HQ = 0.25;

  /** The shared map: the same for everyone, whatever plot they have. A big snowfield with 30 homestead plots on a grid
      (slot 0 is the most central), hills to mine and, far from everything, the Iron Hills. */
  class WorldPlan {
    constructor() {
      this.size = { w: 560, h: 400 };                                   // tiles -> 280 x 200 m
      const wm = this.size.w * TILE, hm = this.size.h * TILE; this.metres = { w: wm, h: hm };
      const plots = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) plots.push({ x: 30 + c * 44, z: 30 + r * 35 });
      const mid = { x: wm / 2, z: hm / 2 }; plots.sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z));
      this.plots = plots.map((p, slot) => Object.assign(p, { slot }));
      const R = new K.RNG(4411), hills = [];
      for (let k = 0; k < 600 && hills.length < 22; k++) {
        const x = R.range(14, wm - 14), z = R.range(14, hm - 14), r = R.range(4, 7);
        if (this.plots.some((p) => Math.hypot(p.x - x, p.z - z) < r + 16) || hills.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + r + 8)) continue;
        hills.push({ x, z, r, h: r > 5.5 ? 3.5 : 3 });
      }
      for (const [x, z] of [[104, 12], [204, 12], [152, 190], [44, 186], [236, 186]]) hills.push({ x, z, r: 5, h: 3.5, iron: true });   // the Iron Hills: the only iron, far from every plot
      this.hills = hills;
      this.outside = [{ x: wm / 2, z: 6 }, { x: wm / 2, z: hm - 6 }, { x: 6, z: hm / 2 }, { x: wm - 6, z: hm / 2 }];
    }
    /** distance to the nearest plot centre */
    plotDist(x, z) { let d = 1e9; for (const p of this.plots) d = Math.min(d, Math.hypot(p.x - x, p.z - z)); return d; }
  }

  /** What one player sees as theirs: the shared plan plus their own plot (where their cottage, stores and fire are). */
  class HutLayout {
    constructor(plan = new WorldPlan(), slot = 0) {
      this.plan = plan; this.slot = slot; this.size = plan.size; this.plots = plan.plots;
      const p = plan.plots[slot] || plan.plots[0];
      this.keep = { x: p.x, z: p.z, r: 2.3 };                          // the hut (the game still calls it "keep" in places)
      this.hearth = { x: p.x - 1.6, z: p.z - 0.4 };                    // the fireplace: warmth and light
      this.home = { x: Math.round(p.x / TILE) - 5, z: Math.round(p.z / TILE) - 3, w: 10, h: 7 };   // the cottage's north-west tile and size (tiles)
      this.start = { x: p.x - 0.25, z: p.z + 0.75 };                  // you wake up inside
      this.ruins = {}; this.kin = {}; this.barriers = {}; this.outcrop = null; this.troll = null;
      this.hills = plan.hills; this.outside = plan.outside; this.frostEdges = {};
    }
    /** a cottage for another settler's plot (drawn only: their door, stores and furniture are theirs to run) */
    cottageAt(slot, id) {
      const p = this.plan.plots[slot], mine = this.homeSpec(), o = JSON.parse(JSON.stringify(mine)); o.id = id; o.x = Math.round(p.x / TILE) - 5; o.z = Math.round(p.z / TILE) - 3; o.noDoorLeaves = true; return K.BuildingSpec.normalize(o);   // their Door class draws the leaf
    }
    /** the cottage: the same kind of house the World Builder makes (timber, thatch, kitchen and bedroom) */
    homeSpec() {
      const h = this.home;
      const spec = K.BuildingSpec.normalize({
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
      spec.noDoorLeaves = true;   // the Door class draws the door leaf, open or shut, so there is only ever one
      return spec;
    }
    dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
    inIronHills() { return false; }
  }

  class HutWorldBuilder extends K.CastleWorldBuilder {
    constructor(layout = new HutLayout(), seed = 2207) { super(layout, seed); }   // the seed is the map: every player builds the same land
    heightAt(x, z) {
      const L = this.L, n = this.n, wu = L.size.w * TILE, hu = L.size.h * TILE;
      const rim = Math.min(x, z, wu - x, hu - z);
      if (rim < 3) return { h: 2.5 + Math.round(n.fbm(x * 0.4, z * 0.4, 3) * 5) * 0.5, rock: true };   // far beyond the fog: just a horizon
      for (const H of L.hills) { const d = Math.hypot(x - H.x, z - H.z); if (d < H.r) return { h: Math.round(H.h * Math.pow(1 - d / H.r, 0.85) * 4) / 4 + 0.25, rock: true }; }
      const dk = L.plan.plotDist(x, z); if (dk < 9) return { h: 0 };   // every plot is flat ground, so any player can build on theirs
      return { h: Math.max(0, Math.round((n.fbm(x * 0.06, z * 0.06, 3) - 0.45) * 2.0 * Math.min(1, (dk - 9) / 10) * 4) / 4) };
    }
    objects() {
      const L = this.L, R = this.R, n = this.n, wu = L.size.w * TILE, hu = L.size.h * TILE, plan = L.plan;
      this.prop('start', L.start.x, L.start.z, { hero: 'warden' });
      this.doc.objects.push(L.homeSpec());   // my house; other settlers' houses are added as they arrive
      /* a spatial hash, so "is anything within m metres?" stays quick with thousands of props */
      const cell = 2.5, grid = new Map(), cellOf = (v) => Math.floor(v / cell);
      const put = (x, z) => { const k = cellOf(x) + ',' + cellOf(z); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push([x, z]); };
      const near = (x, z, m) => { const r = Math.ceil(m / cell), cx = cellOf(x), cz = cellOf(z); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const a = grid.get((cx + dx) + ',' + (cz + dz)); if (a) for (const q of a) if (Math.hypot(q[0] - x, q[1] - z) < m) return true; } return false; };
      const put1 = (type, x, z, extra) => { this.prop(type, x, z, extra); put(x, z); };
      put(L.start.x, L.start.z);
      const k4 = (plan.size.w * plan.size.h) / (280 * 200);   // how much bigger than the first, small map this one is
      let trees = 0, tries = 0; const wantTrees = Math.round(760 * k4);
      while (trees < wantTrees && tries++ < wantTrees * 7) {
        const x = R.range(5, wu - 5), z = R.range(5, hu - 5); if (plan.plotDist(x, z) < 10) continue;
        const r = this.heightAt(x, z); if (r.rock) continue;
        const forest = Math.max(0.1, Math.min(1, (n.fbm(x * 0.05, z * 0.05, 2) - 0.36) * 3.2)); if (R.next() > forest) continue;
        if (near(x, z, 1.9)) continue;
        const dead = R.next() >= 0.88; put1(dead ? 'c:deadtree' : 'c:pine', x, z, { s: R.range(0.85, 1.25), name: dead ? 'Dead tree' : 'Snow pine' }); trees++;
      }
      for (let k = 0, got = 0; got < Math.round(34 * k4) && k < 900 * k4; k++) { const x = R.range(8, wu - 8), z = R.range(8, hu - 8); if (plan.plotDist(x, z) < 8 || this.heightAt(x, z).rock || near(x, z, 2.2)) continue; put1('c:boulder', x, z, { name: 'Boulder', rot: R.range(0, 6) }); got++; }
      for (const H of L.hills.filter((q) => q.iron)) for (let k = 0; k < 26; k++) { const a = this.R.range(0, 6.28), x = H.x + Math.cos(a) * (H.r + 1.2), z = H.z + Math.sin(a) * (H.r + 1.2); if (!this.heightAt(x, z).rock && !near(x, z, 1.6)) put1('c:iron', x, z, { name: 'Iron rock', rot: this.R.range(0, 6) }); }   // the only iron on the map
      for (let k = 0, got = 0; got < Math.round(24 * k4) && k < 600 * k4; k++) { const x = R.range(8, wu - 8), z = R.range(8, hu - 8); if (plan.plotDist(x, z) < 7 || this.heightAt(x, z).rock || near(x, z, 1.8)) continue; put1('rock', x, z, { s: R.range(0.8, 1.4) }); got++; }
    }
  }

  Object.assign(K, { WorldPlan, HutLayout, HutWorldBuilder });
})(typeof window !== 'undefined' ? window : globalThis);
