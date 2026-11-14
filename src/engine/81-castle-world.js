/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Castle mode world: a frozen castle hill (Keep + 3 ruins), a pine stand, boulders, the Iron
   Hills behind a rock ridge and a frozen pass, and the troll's bridge over a chasm to the east.
   1 world unit = 1 m (TILE 0.5). Plain data + WorldDoc (no DOM / THREE). The layout is the one source
   for where things are: CastleGame reads it for ruins, sites, kin, the troll and the frost edges. */
(function (G) {
  const K = G.K;
  const { TILE, HQ, T, WorldDoc } = K;

  class CastleLayout {
    constructor() {
      this.size = { w: 128, h: 96 };                       // tiles -> 64 x 48 m
      this.keep = { x: 26, z: 24, r: 2.3 };
      this.hearth = { x: 26, z: 26.6 };                    // the hearth door on the Keep's south face
      this.start = { x: 29.8, z: 29.6 };                   // beside the Gatehouse ruin: the opening camera sees the hero and the Keep
      this.ruins = {                                       // distances from the Keep per the data: 5, 8, 11 m
        gatehouse: { x: 26, z: 29, rot: 0 },
        great_hall: { x: 18.6, z: 26.9, rot: Math.PI / 2 },
        smithy: { x: 36.6, z: 27.2, rot: -Math.PI / 2 },
      };
      this.outcrop = { x: 43, z: 8.5 };                    // the Iron mine's site, in the Iron Hills
      this.kin = {
        pinewarden: { x: 18.6, z: 20.4 },                  // 8.5 m out at the pine stand
        emberwright: { x: 47.2, z: 5.6 },                  // the cold shrine in the Iron Hills
        rime_brute: { x: 26, z: 3.5 },                     // walks out of the frost (north edge)
      };
      this.troll = { x: 57.8, z: 25 };
      this.chasm = { x0: 51, x1: 54.6 };
      this.bridge = { a: [50.2, 25], b: [55.4, 25], w: 1.7 };
      this.ridgeX = 35.5; this.ridgeZ = 14.5; this.pass = { x0: 40.5, x1: 43.5 };
      this.barriers = {
        iron_hills: { x0: 40.5, x1: 43.5, z0: 14, z1: 15.5, opensAfter: 'night1' },
        troll_bridge: { x0: 51.2, x1: 52.6, z0: 23.6, z1: 26.4, opensAfter: 'night2' },   // on the deck, over the chasm: no way around it
      };
      // points out in the wilds where raiders come from: the Keep must always connect to one of them
      this.outside = [{ x: 26, z: 45 }, { x: 26, z: 4.5 }, { x: 3.6, z: 25 }];
      this.frostEdges = { north: { x0: 16, x1: 36, z: 3.2 }, south: { x0: 18, x1: 34, z: 46.2 }, west: { z0: 16, z1: 34, x: 2.5 } };
      this.nodes = {
        tree: [[16, 18.5], [14.2, 21], [17.2, 16.6], [13, 24.5], [15.6, 23.3], [12.8, 18], [20.6, 17.4], [11.4, 21.8], [14.4, 29.6], [12.6, 32], [15.8, 33.4], [11, 27.6], [19.6, 32.6], [13.4, 35.4]],
        boulder: [[23, 18.6], [31, 19.4], [31.6, 32.4], [21.4, 33.2], [33.8, 22.6], [29.4, 17.4]],
        rubble: [[24.4, 30.4], [27.8, 30.6], [18.6, 30], [16.4, 25.2], [36.4, 30.2], [38.8, 25.6]],
        iron_rock: [[39.2, 6.2], [44.6, 4.6], [46.4, 11], [39.8, 11]],
      };
    }
    dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
    inIronHills(x, z) { return x > this.ridgeX && z < this.ridgeZ && x < this.chasm.x0; }
  }

  class CastleWorldBuilder {
    constructor(layout = new CastleLayout(), seed = 1107) { this.L = layout; this.R = new K.RNG(seed); this.n = new K.Noise(seed); }
    build() {
      const L = this.L, doc = new WorldDoc(L.size.w, L.size.h, { name: 'The Frozen Castle', seed: 1107 });
      this.doc = doc;
      for (let j = 0; j < doc.h; j++) for (let i = 0; i < doc.w; i++) {
        const x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, r = this.heightAt(x, z), k = j * doc.w + i;
        doc.height[k] = Math.max(-128, Math.min(127, Math.round(r.h / HQ)));
        doc.terrain[k] = r.chasm ? T.CHASM : r.rock ? T.ROCK : T.SNOW;
      }
      this.objects();
      doc.camera = { tx: L.start.x, ty: 0, tz: L.start.z, yaw: -0.2, pitch: 0.74, dist: 13 };
      return doc;
    }
    heightAt(x, z) {
      const L = this.L, n = this.n, wu = L.size.w * TILE, hu = L.size.h * TILE;
      // chasm (troll's bridge), with stepped ledges
      if (x > L.chasm.x0 && x < L.chasm.x1) { const d = Math.min(x - L.chasm.x0, L.chasm.x1 - x), nn = n.fbm(x * 0.9, z * 0.9, 2); return { h: d < 0.5 && nn > 0.5 ? -2.5 : d < 1 ? -4.75 : -8.5, chasm: true }; }
      // the rock ridge around the Iron Hills (a pass in its south side, closed by the frost until Night 1)
      const ridgeW = x > L.ridgeX - 0.8 && x < L.ridgeX + 0.6 && z < L.ridgeZ + 0.5;
      const ridgeS = z > L.ridgeZ - 0.6 && z < L.ridgeZ + 0.8 && x > L.ridgeX - 0.8 && x < L.chasm.x0 && !(x > L.pass.x0 && x < L.pass.x1);
      if (ridgeW || ridgeS) return { h: 2.5 + Math.round(n.fbm(x * 0.7, z * 0.7, 2) * 3) * 0.5, rock: true };
      // mountains on the north and west rims so the horizon is rock, not void
      const rim = Math.min(z - 1.2, x - 1.2, wu - x - 1.2, hu - z - 1.2);
      if (rim < 0.6 && !(x > L.chasm.x0 - 1 && x < L.chasm.x1 + 1)) return { h: 2 + Math.round(n.fbm(x * 0.4, z * 0.4, 3) * 4) * 0.75, rock: true };
      // castle hill: flat inside 17 m of the Keep; gentle swells beyond
      const dk = Math.hypot(x - L.keep.x, z - L.keep.z);
      if (dk < 17) return { h: 0 };
      const swell = (n.fbm(x * 0.12, z * 0.12, 3) - 0.45) * 2.2 * Math.min(1, (dk - 17) / 6);
      return { h: Math.max(0, Math.round(swell * 4) / 4) * (L.inIronHills(x, z) ? 0.6 : 1) };
    }
    add(o) { o.id = this.doc.uid(o.kind[0]); if (o.seed == null) o.seed = this.R.int(1, 99999); this.doc.objects.push(o); return o; }
    prop(type, x, z, extra = {}) { return this.add(Object.assign({ kind: 'prop', type, x: +x.toFixed(3), z: +z.toFixed(3), rot: 0, s: 1 }, extra)); }
    objects() {
      const L = this.L, R = this.R;
      this.prop('start', L.start.x, L.start.z, { hero: 'warden' });
      for (const [x, z] of L.nodes.tree) this.prop('c:pine', x, z, { name: 'Snow pine' });
      for (const [x, z] of L.nodes.boulder) this.prop('c:boulder', x, z, { name: 'Boulder', rot: R.range(0, 6) });
      for (const [x, z] of L.nodes.rubble) this.prop('c:rubble', x, z, { name: 'Ruin rubble', rot: R.range(0, 6) });
      for (const [x, z] of L.nodes.iron_rock) this.prop('c:iron', x, z, { name: 'Iron rock', rot: R.range(0, 6) });
      this.add({ kind: 'bridge', a: L.bridge.a.slice(), b: L.bridge.b.slice(), w: L.bridge.w, seed: 31 });
      // decoration: an outer forest and a few dead trees, kept clear of the castle hill
      const near = (x, z, m) => this.doc.objects.some((o) => o.kind === 'prop' && Math.hypot(o.x - x, o.z - z) < m);
      let tries = 0;
      while (tries++ < 900) {
        const x = R.range(3, 62), z = R.range(3, 46), dk = Math.hypot(x - L.keep.x, z - L.keep.z);
        if (dk < 15.5 || (x > L.chasm.x0 - 1.4 && x < L.chasm.x1 + 1.4) || L.inIronHills(x, z) || Math.abs(x - L.ridgeX) < 1.5 || near(x, z, 1.6)) continue;
        if (x > L.chasm.x1 && Math.abs(z - L.troll.z) < 4) continue;
        const r = this.heightAt(x, z); if (r.rock || r.chasm) continue;
        this.prop(R.next() < 0.86 ? 'pine' : 'deadtree', x, z, { s: R.range(0.85, 1.25) });
      }
      for (let k = 0; k < 7; k++) { const x = R.range(37, 50), z = R.range(3, 13); if (!near(x, z, 1.8)) this.prop('rock', x, z, { s: R.range(0.8, 1.4) }); }
      this.prop('torch', L.bridge.a[0] - 0.8, L.bridge.a[1] - 1.3); this.prop('torch', L.bridge.b[0] + 0.8, L.bridge.b[1] + 1.3);
      this.prop('banner', L.keep.x + 2.6, L.keep.z + 2.2, { rot: 0.2 });
    }
  }

  Object.assign(K, { CastleLayout, CastleWorldBuilder });
})(typeof window !== 'undefined' ? window : globalThis);
