/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · seeded generator: Frostcliff-style worlds at any size.
   The hero crossing uses the approved diorama's own composition (rooms, camp, bridge, cast), placed relative to its bridge. */
(function (G) {
  const K = G.K;
  const { TILE, HQ, T, WorldDoc } = K;

  class WorldGenerator {
    constructor(seed) { this.seed = seed >>> 0 || 1; this.R = new K.RNG(this.seed); this.n = new K.Noise(this.seed % 100000 + 4242); this.n2 = new K.Noise((this.seed * 7 + 911) % 100000); }
    generate(w, h, name) {
      const R = this.R, n = this.n, n2 = this.n2;
      const doc = new WorldDoc(w, h, { name: name || 'Frostcliff · seed ' + this.seed, seed: this.seed });
      const Wu = doc.wu, Hu = doc.hu; this.doc = doc;
      // ---- rift (main chasm, north-south) ----
      const p1 = R.range(0, 6), p2 = R.range(0, 6), p3 = R.range(0, 6), big = Wu >= 60;
      const cx = Wu * (Wu < 40 ? 0.62 : 0.6), meA = big ? Math.min(6, Wu * 0.05) : 0;
      this.center = (z) => cx + 0.8 * Math.sin(z * 0.33 + p1) + 0.35 * Math.sin(z * 1.05 + p2) + meA * Math.sin(z * 0.07 + p3);
      // bridges across the main rift: the hero crossing first, then more every ~20 units on big maps
      const heroZ = Math.round(Hu * 0.5 / TILE) * TILE;
      this.crossings = [heroZ];
      for (let z = heroZ - R.range(14, 18); z > 5; z -= R.range(15, 20)) this.crossings.push(Math.round(z / TILE) * TILE);
      for (let z = heroZ + R.range(14, 18); z < Hu - 5; z += R.range(15, 20)) this.crossings.push(Math.round(z / TILE) * TILE);
      this.landing = (z) => { const c = this.center(z); return [c - 2.3, c + 2.3]; };
      this.edges = (z) => {
        const c = this.center(z), wd = 2.45 + 0.35 * Math.sin(z * 0.6);
        let xw = c - wd + (n.fbm(3.1, z * 1.7, 3) - 0.5) * 1.1, xe = c + wd + (n.fbm(9.7, z * 1.7, 3) - 0.5) * 1.1;
        for (const bz of this.crossings) {
          const d = Math.abs(z - bz); if (d < 1.6) { const t = 1 - d / 1.6, [lw, le] = this.landing(bz); xw += (lw - xw) * t; xe += (le - xe) * t; }
        }
        return [xw, xe];
      };
      this.wallEdge = (z) => this.center(z) + 5.3 + 0.9 * Math.sin(z * 0.62 + 0.8) + 0.45 * Math.sin(z * 1.7) + (n2.fbm(1, z * 0.9, 2) - 0.5) * 0.8;
      // second rift running east on big maps
      this.rift2 = null;
      if (Wu >= 60) {
        const zr = Hu * R.range(0.68, 0.78), q = R.range(0, 6);
        this.rift2 = { zc: (x) => zr + 1.2 * Math.sin(x * 0.21 + q) + 0.4 * Math.sin(x * 0.9 + q * 2), hw: (x) => 2.1 + 0.3 * Math.sin(x * 0.5 + q) };
        const bx = Math.round(((this.center(zr) + 9 + Wu) / 2) / TILE) * TILE; this.rift2.bx = bx;
      }
      // ---- heights ----
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = (i + 0.5) * TILE, z = (j + 0.5) * TILE;
        const r = this.heightAt(x, z);
        doc.height[j * w + i] = Math.max(-128, Math.min(127, Math.round(r.h / HQ)));
        doc.terrain[j * w + i] = r.chasm ? T.CHASM : T.SNOW;
      }
      // ---- composition ----
      this.objects = doc.objects; this.paths = []; this.ponds = []; this.rooms = []; this.keep = [];
      this.heroCrossing(heroZ);
      this.crossings.slice(1).forEach((z) => this.sideCrossing(z));
      if (this.rift2) this.rift2Crossing();
      this.extraSites();
      this.paintTerrain();
      this.scatter();
      return doc;
    }
    /* height (world units) at (x,z) + whether it is rift */
    heightAt(x, z) {
      const n = this.n, n2 = this.n2, doc = this.doc, Wu = doc.wu, Hu = doc.hu;
      const [xw, xe] = this.edges(z);
      const ledge = (d) => {
        const nn = n.fbm(x * 0.9, z * 0.9, 2);
        if (d < 0.45 && nn > 0.52) return -2.5;
        if (d < 0.9 && nn > 0.45) return -4.75 - (nn > 0.6 ? 0 : 0.75);
        return -8.5 + (n2.fbm(x * 0.4, z * 0.4, 2) - 0.5) * 0.8;
      };
      if (x > xw && x < xe) return { h: Math.round(ledge(Math.min(x - xw, xe - x)) * 4) / 4, chasm: true };
      if (this.rift2 && x > xe) {
        const zc = this.rift2.zc(x), hw = this.rift2.hw(x), bx = this.rift2.bx;
        let zn = zc - hw + (n.fbm(x * 1.7, 5.3, 3) - 0.5) * 1.0, zs = zc + hw + (n.fbm(x * 1.7, 8.1, 3) - 0.5) * 1.0;
        const d = Math.abs(x - bx); if (d < 1.6) { const t = 1 - d / 1.6; zn += (zc - 2.1 - zn) * t; zs += (zc + 2.1 - zs) * t; }
        if (z > zn && z < zs && x > xe + 0.4) return { h: Math.round(ledge(Math.min(z - zn, zs - z)) * 4) / 4, chasm: true };
      }
      let h = 0;
      if (x >= xe) {
        const we = this.wallEdge(z), rw = (Wu > 40 ? 3.5 : 5) + n2.fbm(z * 0.2, 3.3, 2) * (Wu > 40 ? 3 : 5);
        let e = x - we; if (e > rw) e = 2 * rw - e;   // ridge: up, then back down to an eastern bench
        if (e < 0) h = 0.5;
        else { const nn = n2.fbm(x * 0.5, z * 0.5, 3); h = e < 0.7 ? 1.75 : e < 1.8 ? 3.5 : 5.25 + Math.round(nn * 2) * 1.0; return { h, chasm: false }; }
      } else if (x < 3) h = 0.25 + (x < 1.2 ? 0.5 : 0);
      // mountains rising to the north so the horizon is rock, not void
      const bz = 3.2 + (Hu > 40 ? 1.5 : 0);
      if (z < bz) {
        const b = (bz - z) * 0.9 + n.fbm(x * 0.3, z * 0.3, 3) * 2.5 - 0.5;
        if (b > h) return { h: Math.round(b / 1.5) * 1.5, chasm: false };
      }
      return { h: Math.round(h * 4) / 4, chasm: false };
    }
    inWorld(x, z, m = 0.3) { return x > m && z > m && x < this.doc.wu - m && z < this.doc.hu - m; }
    add(o) { o.id = this.doc.uid(o.kind[0]); if (o.seed == null) o.seed = this.R.int(1, 99999); this.objects.push(o); return o; }
    prop(type, x, z, extra = {}) {
      if (!this.inWorld(x, z)) return null;
      return this.add(Object.assign({ kind: 'prop', type, x: +x.toFixed(3), z: +z.toFixed(3), rot: 0, s: 1 }, extra));
    }
    room(x0, z0, x1, z1, hs, gaps, seed) {
      if (!this.inWorld(x0, z0, 0.6) || !this.inWorld(x1, z1, 0.6)) return null;
      this.rooms.push([x0, z0, x1, z1]);
      return this.add({ kind: 'wall', closed: true, pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], h: hs[0], hs, ruin: 2.1, gaps, seed });
    }
    /* the approved diorama's composition, placed at this crossing (offsets are measured from its west landing) */
    heroCrossing(zb) {
      const [lw, le] = this.landing(zb), A = (dx, dz) => [lw + dx, zb + dz], E = (dx, dz) => [le + dx, zb + dz];
      this.add({ kind: 'bridge', a: [+(lw - 0.6).toFixed(3), zb], b: [+(le + 0.6).toFixed(3), zb], w: 1.6, seed: 31 });
      // rooms
      const ra = [A(-13.4, -7.4), A(-7.2, -1.8)], rb = [A(-7.8, 2.4), A(-2, 6.6)];
      this.room(ra[0][0], ra[0][1], ra[1][0], ra[1][1], [3.4, 2.0, 1.0, 2.4], [[1, 0.35, 0.6], [2, 0.45, 0.7], [3, 0.28, 0.45]], 1);
      this.room(rb[0][0], rb[0][1], rb[1][0], rb[1][1], [2.4, 1.6, 0.8, 2.0], [[0, 0.42, 0.62], [1, 0.5, 0.8]], 5);
      const lone = [A(-3, -7.8), A(-1, -6.6)]; this.add({ kind: 'wall', pts: lone, h: 2.2, ruin: 2.4, seed: 9, pillars: false });
      const ew = [E(1.2, -7), E(1.4, -3.6)]; this.add({ kind: 'wall', pts: ew, h: 1.6, ruin: 2.0, seed: 10, pillars: false, depth: 0.4 });
      // paths
      const west = [[-22.6, 6.4], [-16.6, 5.8], [-13.1, 4.6], [-10.6, 3.2], [-8.1, 2], [-5.6, 1], [-3.1, 0.3], [0, 0]].map(([x, z]) => A(x, z));
      while (west[0][0] > 0) west.unshift([west[0][0] - 6, west[0][1] + 0.4]);
      this.paths.push(west);
      const east = [[0, 0], [1.4, 0.4], [2, 2], [1.8, 5], [1.2, 11], [1.4, 17]].map(([x, z]) => E(x, z));
      this.paths.push(east); this.eastTrail = east;
      // ice ponds
      [[-10.4, 0.6, 1.3, 0.75, 0.3], [-4, -5.1, 1.5, 0.95, -0.4], [-17.6, -3, 1.6, 1.0, 0.5]].forEach(([dx, dz, rx, rz, a]) => { const [x, z] = A(dx, dz); this.ponds.push([x, z, rx, rz, a]); });
      { const [x, z] = E(3.4, 4.2); this.ponds.push([x, z, 0.9, 0.6, 0.2]); }
      // camp
      const [fx, fz] = A(-5.2, -2.4);
      this.prop('campfire', fx, fz); this.prop('log', fx - 0.95, fz + 0.75, { rot: 0.4 });
      this.prop('crates', ...A(-6.7, -3.7)); this.prop('crate', ...A(-2.6, 4.9), { rot: 0.1, s: 1.05 }); this.prop('crate', ...A(-3.2, 5.2), { rot: -0.2, s: 0.96 });
      this.prop('crate', ...E(1.9, -1.9), { rot: 0.3, s: 0.96 }); this.prop('crate', ...E(2.2, -2.5), { rot: -0.1, s: 0.86 });
      this.prop('torch', ...A(-1.1, 1.35)); this.prop('torch', ...E(0.9, -1.35));
      this.prop('banner', ...A(-6.55, -5.1));
      this.prop('deadtree', ...A(-12.2, 0.4));
      [[2.3, 6.2, 14, 0.7], [6.4, 2.6, 12, 0.6], [11.7, 12.3, 10, 0.55], [13.3, 6.9, 9, 0.5], [7.6, 11.0, 8, 0.45], [4.1, 7.6, 7, 0.4], [12.9, 15.0, 6, 0.4], [1.0, 4.3, 7, 0.45]]
        .forEach(([x, z, , r]) => this.prop('rubble', ...A(x - 14.6, z - 9), { s: +(r / 0.55).toFixed(2), rot: this.R.range(0, 6) }));
      [[20.9, 11.6, 0.55], [19.7, 5.6, 0.4]].forEach(([x, z, r]) => this.prop('rubble', ...E(x - 19.2, z - 9), { s: +(r / 0.55).toFixed(2) }));
      [[22.2, 3.0, 0.5], [21.6, 10.4, 0.4], [-2.2, 9.6, 0.6], [5.8, 14.8, 0.45], [14.2, 13.8, 0.5], [14.0, 3.4, 0.4]].forEach(([x, z, r]) => this.prop('rock', ...(x > 17 ? E(x - 19.2, z - 9) : A(x - 14.6, z - 9)), { s: +(r / 0.42).toFixed(2), rot: this.R.range(0, 6) }));
      // cast: heroes by the camp end of the bridge, the undead + troll on the deck
      this.prop('sprite:warden', ...A(-2.05, 0.35), { seed: 7 }); this.prop('sprite:witch', ...A(-3.45, 1.25), { seed: 9 });
      this.prop('sprite:ghoulA', ...A(0.65, 0.25), { seed: 1 }); this.prop('sprite:ghoulB', ...A(1.65, -0.3), { seed: 3 }); this.prop('sprite:troll', ...A(3.75, 0.1), { seed: 2 });
      // diorama hand-placed pines near the scene
      [[-1.2, 0.4, 3.4], [-0.2, -1.4, 3.8], [0.6, 0.9, 2.6], [-2.4, 2.8, 3.2], [-0.6, 3.6, 2.2], [3.0, -1.6, 3.0], [5.6, -1.0, 2.6], [9.2, -0.8, 3.4], [12.6, -0.4, 2.8],
        [-1.0, 17.4, 3.6], [1.0, 18.6, 3.0], [3.8, 17.6, 2.5], [-3.6, 13.2, 3.4], [6.6, 18.0, 2.2],
        [23.5, 1.6, 3.0], [24.4, 5.4, 3.6], [23.9, 9.4, 2.6], [25.0, 13.8, 3.4], [24.1, 17.9, 3.2], [26.6, 3.2, 3.8], [26.0, 11.4, 3.0], [27.4, 7.6, 3.4], [22.4, 18.6, 2.4], [19.6, 18.2, 2.6], [20.8, 15.4, 2.2]]
        .forEach(([x, z, H]) => { const p = x > 17 ? E(x - 19.2, z - 9) : A(x - 14.6, z - 9); this.pine(p[0], p[1], H); });
      this.keep.push([lw - 15, zb - 9, le + 4, zb + 8]);
    }
    pine(x, z, H) { if (!this.inWorld(x, z, 0.4)) return; this.prop('pine', x, z, { s: +(H / 3.2).toFixed(2), rot: this.R.range(0, 6) }); }
    sideCrossing(zb) {
      const R = this.R, [lw, le] = this.landing(zb);
      this.add({ kind: 'bridge', a: [+(lw - 0.6).toFixed(3), zb], b: [+(le + 0.6).toFixed(3), zb], w: 1.6 });
      this.prop('torch', lw - 1.1, zb + (R.chance(0.5) ? 1.35 : -1.35)); this.prop('torch', le + 0.9, zb - 1.35);
      const cast = R.pick([['sprite:ghoulA', 'sprite:ghoulB'], ['sprite:troll'], ['sprite:ghoulB', 'sprite:ghoulA', 'sprite:ghoulB']]);
      cast.forEach((t, k) => this.prop(t, lw + 0.8 + k * 1.1, zb + R.range(-0.4, 0.4)));
      // a spur path west to the main trail and a little ruin by the landing
      const sp = [[lw, zb]]; let x = lw, z = zb;
      for (let k = 0; k < 4; k++) { x -= R.range(2.5, 4); z += R.range(-1.4, 1.4); sp.push([x, z]); }
      this.paths.push(sp.reverse()); this.trailW = (this.trailW || []).concat([sp[0]]);
      const rx = lw - R.range(7, 10), rz = zb + (R.chance(0.5) ? R.range(2, 4) : -R.range(6, 8));
      this.ruinAt(rx, rz, R.range(4.2, 6), R.range(3.6, 5));
      if (this.eastTrail) this.paths.push([[le, zb], [le + 1.6, zb + 0.4], [le + 2.2, zb + (zb < this.crossings[0] ? 2 : -2)]]);
      this.keep.push([lw - 12, zb - 5, le + 3, zb + 5]);
    }
    rift2Crossing() {
      const r = this.rift2, bx = r.bx, zc = r.zc(bx), R = this.R;
      this.add({ kind: 'bridge', a: [bx, +(zc - 2.7).toFixed(3)], b: [bx, +(zc + 2.7).toFixed(3)], w: 1.6 });
      this.prop('torch', bx + 1.3, zc - 3.6); this.prop('torch', bx - 1.3, zc + 3.6);
      this.prop('sprite:troll', bx, zc + 0.6, { flip: true });
      this.paths.push([[bx, zc - 2.6], [bx + 0.6, zc - 6], [bx - 1, zc - 10], [bx - 4, zc - 14]]);
      this.paths.push([[bx, zc + 2.6], [bx - 0.6, zc + 6], [bx + 1.5, zc + 9]]);
      this.keep.push([bx - 3, zc - 6, bx + 3, zc + 6]);
    }
    ruinAt(x, z, w, d) {
      const R = this.R, hs = [R.range(1.6, 3.4), R.range(1.2, 2.6), R.range(0.6, 1.4), R.range(1.2, 2.6)];
      const door = R.int(0, 3), gaps = [[door, 0.38, 0.62]]; if (R.chance(0.5)) gaps.push([(door + 2) % 4, R.range(0.2, 0.5), R.range(0.6, 0.8)]);
      if (!this.room(x, z, x + w, z + d, hs, gaps, R.int(1, 9999))) return;
      this.prop('rubble', x + R.range(0.6, w - 0.6), z + R.range(0.6, d - 0.6), { rot: R.range(0, 6) });
      this.prop('rubble', x + (R.chance(0.5) ? -0.5 : w + 0.5), z + R.range(0, d), { s: 0.8 });
      if (R.chance(0.7)) this.prop('crates', x + w - 0.9, z + 0.8, { rot: R.range(-0.4, 0.4) });
      if (R.chance(0.5)) this.prop('banner', x + R.range(0.8, w - 0.8), z - 0.6);
      if (R.chance(0.5)) this.prop(R.pick(['sprite:ghoulA', 'sprite:ghoulB']), x + w / 2, z + d / 2);
      this.keep.push([x - 1, z - 1, x + w + 1, z + d + 1]);
    }
    campAt(x, z) {
      const R = this.R;
      this.prop('campfire', x, z); this.prop('log', x - 0.95, z + 0.75, { rot: R.range(0, 1) });
      if (R.chance(0.7)) this.prop('crates', x - 1.6, z - 1.1, { rot: R.range(-0.4, 0.4) });
      if (R.chance(0.6)) this.prop('banner', x + 1.2, z - 1.2);
      if (R.chance(0.5)) this.prop(R.pick(['sprite:warden', 'sprite:witch']), x + 1.0, z + 0.6);
      this.keep.push([x - 2.5, z - 2.5, x + 2.5, z + 2.5]);
    }
    extraSites() {
      const R = this.R, doc = this.doc, Wu = doc.wu, Hu = doc.hu, area = Wu * Hu;
      const free = (x, z, r) => this.keep.every(([a, b, c, d]) => x + r < a || x - r > c || z + r < b || z - r > d);
      const westOK = (x, z) => { const [xw] = this.edges(z); return x < xw - 3 && doc.tileY(x, z) > -0.1 && doc.tileY(x, z) < 1; };
      const eastOK = (x, z) => { const [, xe] = this.edges(z); return x > xe + 3 && doc.tileY(x, z) >= 0 && doc.tileY(x, z) < 1 && (!this.rift2 || Math.abs(z - this.rift2.zc(x)) > 5); };
      const nRuins = Math.floor(area / 900), nCamps = Math.floor(area / 1400);
      for (let k = 0, tries = 0; k < nRuins && tries < 200; tries++) {
        const x = R.range(2, Wu - 8), z = R.range(6, Hu - 8);
        if (!free(x + 2.5, z + 2, 5) || !(westOK(x, z) || eastOK(x, z)) || !(westOK(x + 6, z + 5) || eastOK(x + 6, z + 5))) continue;
        this.ruinAt(x, z, R.range(4, 6.2), R.range(3.4, 5)); k++;
      }
      for (let k = 0, tries = 0; k < nCamps && tries < 200; tries++) {
        const x = R.range(3, Wu - 3), z = R.range(6, Hu - 3);
        if (!free(x, z, 4) || !(westOK(x, z) || eastOK(x, z))) continue;
        this.campAt(x, z); k++;
        // trail from the camp to the nearest path point
        let best = null, bd = 1e9; for (const p of this.paths) for (const q of p) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; best = q; } }
        if (best && bd < 40) { const mx = (x + best[0]) / 2 + R.range(-2, 2), mz = (z + best[1]) / 2 + R.range(-2, 2); this.paths.push([[x + 1.2, z + 1.2], [mx, mz], best]); }
      }
      // west north-south trail linking side crossings
      if (this.trailW && this.trailW.length) {
        const pts = this.trailW.concat([this.paths[0][Math.max(0, this.paths[0].length - 4)]]).sort((a, b) => a[1] - b[1]);
        if (pts.length > 1) this.paths.push(pts);
      }
      const nPonds = Math.max(0, Math.floor(area / 700));
      for (let k = 0, tries = 0; k < nPonds && tries < 100; tries++) {
        const x = R.range(3, Wu - 3), z = R.range(6, Hu - 3);
        if (!free(x, z, 2) || !(westOK(x, z) || eastOK(x, z))) continue;
        this.ponds.push([x, z, R.range(1, 2.2), R.range(0.7, 1.3), R.range(-1, 1)]); k++;
      }
    }
    distPl(x, z, pl) {
      let best = 1e9;
      for (let i = 0; i < pl.length - 1; i++) {
        const [ax, az] = pl[i], [bx, bz] = pl[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        let t = ((x - ax) * dx + (z - az) * dz) / l2; t = Math.max(0, Math.min(1, t));
        best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
      }
      return best;
    }
    pathD(x, z) { let d = 1e9; for (const p of this.paths) d = Math.min(d, this.distPl(x, z, p)); return d; }
    pondM(x, z) {
      let m = -1;
      for (const [cx, cz, rx, rz, a] of this.ponds) {
        const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dz = z - cz;
        if (Math.abs(dx) > rx + 1.5 || Math.abs(dz) > rx + 1.5) continue;
        const u = (dx * c + dz * s) / rx, v = (-dx * s + dz * c) / rz;
        m = Math.max(m, 1 - Math.sqrt(u * u + v * v) - (this.n.fbm(x * 2, z * 2, 2) - 0.5) * 0.45);
      }
      return m;
    }
    paintTerrain() {
      const doc = this.doc, n = this.n;
      for (let j = 0; j < doc.h; j++) for (let i = 0; i < doc.w; i++) {
        const k = j * doc.w + i; if (doc.terrain[k] === T.CHASM) continue;
        const x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, y = doc.height[k] * HQ;
        if (y >= 1.5) continue;
        const pw = 0.62 + (n.fbm(x * 1.3, z * 1.3, 2) - 0.5) * 0.5;
        if (this.pathD(x, z) < pw) doc.terrain[k] = T.PATH;
        if (this.pondM(x, z) > 0.12) doc.terrain[k] = T.ICE;
        for (const [x0, z0, x1, z1] of this.rooms) if (x > x0 + 0.2 && x < x1 - 0.2 && z > z0 + 0.2 && z < z1 - 0.2) doc.terrain[k] = T.SLATE;
      }
    }
    scatter() {
      const R = this.R, doc = this.doc, n = this.n, Wu = doc.wu, Hu = doc.hu;
      const nearKeep = (x, z, m) => this.keep.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m);
      const busy = (x, z) => { const t = doc.type(...doc.tileOf(x, z)); return t === T.PATH || t === T.ICE || t === T.SLATE; };
      // chasm forest
      for (let k = 0, N = Math.floor(Hu * 2.2 * (this.rift2 ? 1.5 : 1)); k < N; k++) {
        const z = R.range(0.5, Hu - 0.5), [xw, xe] = this.edges(z); let x = R.range(xw + 0.5, xe - 0.5), zz = z;
        if (this.rift2 && R.chance(0.35)) { x = R.range(xe + 1, Wu - 0.5); zz = this.rift2.zc(x) + R.range(-1.5, 1.5); }
        if (doc.tileY(x, zz) > -7) continue;
        if (this.objects.some((o) => o.kind === 'bridge' && this.distPl(x, zz, [o.a, o.b]) < 1.0)) continue;
        this.prop('pine', x, zz, { s: +(R.range(2.6, 5.2) / 3.2).toFixed(2), rot: R.range(0, 6) });
      }
      // boulders on the rift lips
      for (let z = 1; z < Hu - 1; z += R.range(0.6, 1.1)) {
        if (this.crossings.some((c) => Math.abs(z - c) < 1.4)) continue;
        const [xw, xe] = this.edges(z), side = R.chance(0.5), x = side ? xw - R.range(0.1, 0.6) : xe + R.range(0.1, 0.6);
        if (R.chance(0.55)) this.prop('rock', x, z, { s: +(R.range(0.18, 0.42) / 0.42).toFixed(2), rot: R.range(0, 6) });
      }
      for (let k = 0, N = Math.floor(Hu * 0.9); k < N; k++) { const z = R.range(0.5, Hu - 0.5), [xw, xe] = this.edges(z), x = R.range(xw + 0.3, xe - 0.3); if (doc.tileY(x, z) < -7) this.prop('rock', x, z, { s: +(R.range(0.3, 0.7) / 0.42).toFixed(2), rot: R.range(0, 6) }); }
      // ferns along paths
      for (const pl of this.paths) {
        for (let i = 0; i < pl.length - 1; i++) {
          const [ax, az] = pl[i], [bx, bz] = pl[i + 1], len = Math.hypot(bx - ax, bz - az); if (len < 0.1) continue;
          for (let k = 0, N = Math.round(len * 1.6); k < N; k++) {
            const t = R.next(), x0 = ax + (bx - ax) * t, z0 = az + (bz - az) * t, nx = -(bz - az) / len, nz = (bx - ax) / len, sd = R.chance(0.5) ? 1 : -1, d = R.range(0.75, 1.25);
            const x = x0 + nx * d * sd, z = z0 + nz * d * sd;
            if (!this.inWorld(x, z, 0.4) || busy(x, z) || doc.tileY(x, z) < -0.1 || doc.tileY(x, z) > 1) continue;
            const [xw, xe] = this.edges(z); if (x > xw - 0.3 && x < xe + 0.3) continue;
            this.prop('shrub', x, z, { s: +R.range(0.75, 1.1).toFixed(2), rot: R.range(0, 6) });
          }
        }
      }
      // pine forests on the plateau + the northern backdrop
      for (let k = 0, N = Math.floor(Wu * Hu * 0.09); k < N; k++) {
        const x = R.range(0.5, Wu - 0.5), z = R.range(0.5, Hu - 0.5), y = doc.tileY(x, z);
        if (y < -0.1 || busy(x, z) || nearKeep(x, z, 0.5)) continue;
        if (this.pathD(x, z) < 1.6) continue;
        const f = n.fbm(x * 0.09 + 3, z * 0.09, 3), north = z < 5.5;
        if (!(north && R.chance(0.6)) && !(f > 0.56 && R.chance(0.8)) && !R.chance(0.05)) continue;
        this.prop('pine', x, z, { s: +(R.range(2.4, 4.4) / 3.2).toFixed(2), rot: R.range(0, 6) });
      }
      for (let k = 0, N = Math.floor(Wu * Hu * 0.006); k < N; k++) {
        const x = R.range(1, Wu - 1), z = R.range(4, Hu - 1), y = doc.tileY(x, z);
        if (y < -0.1 || busy(x, z) || nearKeep(x, z, 0.5) || this.pathD(x, z) < 1) continue;
        this.prop(R.chance(0.35) ? 'deadtree' : R.chance(0.5) ? 'rock' : 'shrub', x, z, { rot: R.range(0, 6), s: +R.range(0.8, 1.2).toFixed(2) });
      }
    }
  }
  K.WorldGenerator = WorldGenerator;
})(typeof window !== 'undefined' ? window : globalThis);
