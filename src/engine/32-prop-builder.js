/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { GeometryBuilderW: GeometryBuilder, M4, UNIT, tileUV } = K;
  const { TILE, HQ, T, WorldDoc } = K;
  class PropBuilder {
    constructor(doc) {
      this.doc = doc; this.rng = new K.RNG(1); this.xf = null;
      for (const k of PropBuilder.KEYS) this[k] = new GeometryBuilder();
      this.box = new THREE.BoxGeometry(1, 1, 1);
    }
    put(b, geo, m, uv) { if (this.xf) m = this.xf.clone().multiply(m); b.add(geo, m, uv); }
    block(x, y, z, w, h, d, ry = 0, tile, rx = 0, rz = 0) {
      const t = tile === undefined ? this.rng.int(0, 15) : tile;
      this.put(this.stone, this.box, M4(x, y + h / 2, z, rx, ry, rz, w, h, d), tileUV(t));
    }
    cap(x, y, z, w, d, ry = 0, th = 0.08) { this.put(this.snow, this.box, M4(x, y + th / 2, z, 0, ry, 0, w, th, d), tileUV(this.rng.int(0, 3), 1)); }
    /* ruined wall along a segment; prof(t) -> number of block rows; follows the ground under each block */
    wall(x0, z0, x1, z1, prof, depth = 0.42) {
      const R = this.rng, len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) return;
      const dx = (x1 - x0) / len, dz = (z1 - z0) / len, ang = Math.atan2(-dz, dx), rowH = 0.3, doc = this.doc;
      for (let row = 0; row < 7; row++) {
        let s = row % 2 ? -0.18 : 0;
        while (s < len) {
          const w = Math.min(len - Math.max(0, s), R.range(0.34, 0.6)); const a = Math.max(0, s), mid = a + w / 2, t = mid / len;
          const n = prof(t);
          if (w > 0.06 && row < n) {
            const jx = R.range(-0.03, 0.03), cx = x0 + dx * mid - dz * jx, cz = z0 + dz * mid + dx * jx, g = doc.tileY(cx, cz);
            const bh = rowH * R.range(0.9, 1.05), y = g + row * rowH;
            this.block(cx, y, cz, w - 0.03, bh, depth * R.range(0.92, 1.06), ang + R.range(-0.05, 0.05));
            const topRow = row === n - 1 || (row === Math.floor(n) - 1);
            if (topRow && R.chance(0.82)) this.cap(cx, y + bh, cz, w + 0.02, depth + 0.07, ang + R.range(-0.04, 0.04), R.range(0.06, 0.11));
          } else if (row === n && R.chance(0.15)) {
            const side = R.chance(0.5) ? 1 : -1, cx = x0 + dx * mid - dz * side * 0.55, cz = z0 + dz * mid + dx * side * 0.55;
            this.block(cx, doc.tileY(cx, cz), cz, 0.42, 0.26, 0.36, R.range(0, 3), undefined, R.range(-0.2, 0.2), R.range(-0.2, 0.2));
          } else R.next();
          s += w;
        }
      }
    }
    pillar(x, z, rows, y0 = 0) {
      for (let r = 0; r < rows; r++) this.block(x + this.rng.range(-0.02, 0.02), y0 + r * 0.32, z, 0.56, 0.31, 0.56, this.rng.range(-0.08, 0.08));
      this.cap(x, y0 + rows * 0.32, z, 0.6, 0.6, 0, 0.12);
    }
    rubble(cx, cz, n, rad, y0 = 0) {
      const R = this.rng;
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2), d = Math.sqrt(R.next()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const s = R.range(0.16, 0.36), y = y0 + (1 - d / rad) * rad * 0.42 - s * 0.3;
        this.block(x, y, z, s * R.range(1, 1.5), s * 0.8, s, R.range(0, 3), undefined, R.range(-0.5, 0.5), R.range(-0.5, 0.5));
        if (R.chance(0.35)) this.cap(x, y + s * 0.8, z, s * 1.1, s * 0.9, R.range(0, 3), 0.05);
      }
    }
    crateAt(x, y, z, s = 0.5, ry = 0, snow = true) {
      this.put(this.crate, this.box, M4(x, y + s / 2, z, 0, ry, 0, s, s, s));
      if (snow) this.cap(x, y + s, z, s * 0.9, s * 0.85, ry + 0.05, 0.06);
    }
    pineAt(x, y, z, H) {
      const R = this.rng;
      this.put(this.bark, UNIT.trunk, M4(x, y + H * 0.17, z, 0, 0, 0, 0.1 * H / 3, H * 0.35, 0.1 * H / 3));
      const tiers = 4 + (H > 4 ? 1 : 0), R0 = H * 0.3;
      for (let i = 0; i < tiers; i++) {
        const f = i / tiers, r = R0 * (1 - f * 0.78), th = H * 0.34 * (1 - f * 0.35);
        const yy = y + H * 0.2 + f * H * 0.68 + th / 2;
        this.put(this.pine, UNIT.cone, M4(x + R.range(-0.03, 0.03), yy, z, R.range(-0.04, 0.04), R.range(0, 6), R.range(-0.04, 0.04), r, th, r), (u, v) => [u * 2 + i * 0.37, v]);
      }
    }
    deadTree(x, y, z) {
      const R = this.rng;
      const seg = (p0, p1, r0, r1) => {
        const d = new V3().subVectors(p1, p0), L = d.length();
        const g = new THREE.CylinderGeometry(r1, r0, L, 6);
        const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
        const m = new THREE.Matrix4().compose(new V3().addVectors(p0, p1).multiplyScalar(0.5), q, new V3(1, 1, 1));
        this.put(this.bark, g, m, (u, v) => [u, v * L * 2]); g.dispose();
      };
      const pts = [new V3(x, y - 0.1, z), new V3(x + 0.08, y + 0.9, z - 0.05), new V3(x - 0.06, y + 1.7, z + 0.04), new V3(x + 0.12, y + 2.4, z)];
      for (let i = 0; i < 3; i++) seg(pts[i], pts[i + 1], 0.2 - i * 0.05, 0.15 - i * 0.05);
      const branch = (p, dir, len, r, depth) => {
        const e = p.clone().addScaledVector(dir, len); seg(p, e, r, r * 0.55);
        if (depth > 0) for (let k = 0; k < 2; k++) {
          const nd = dir.clone().add(new V3(R.range(-0.7, 0.7), R.range(0.1, 0.6), R.range(-0.7, 0.7))).normalize();
          branch(e, nd, len * 0.6, r * 0.55, depth - 1);
        }
      };
      [[1.0, -0.6, 0.55, 0.3], [1.5, 0.7, 0.5, -0.2], [2.0, -0.5, 0.7, 0.4], [2.3, 0.4, 0.8, 0.5], [1.2, 0.2, 0.4, 0.9]].forEach(([h, dx, dy, dz]) => {
        branch(new V3(x + 0.02, y + h, z), new V3(dx, dy, dz).normalize(), R.range(0.6, 0.95), 0.07, 2);
      });
    }
    fernAt(x, y, z, s = 0.42) {
      const R = this.rng, pl = new THREE.PlaneGeometry(s, s); pl.translate(0, s / 2 - 0.03, 0);
      const ry = R.range(0, Math.PI);
      this.put(this.fern, pl, M4(x, y, z, 0, ry, 0)); this.put(this.fern, pl, M4(x, y, z, 0, ry + Math.PI / 2, 0)); pl.dispose();
    }
    boulderAt(x, y, z, r) {
      const R = this.rng;
      this.put(this.boulder, UNIT.ico, M4(x, y + r * 0.35, z, R.range(0, 3), R.range(0, 3), R.range(0, 3), r * R.range(0.9, 1.3), r * R.range(0.6, 0.8), r * R.range(0.9, 1.2)), (u, v) => [u * 0.5, v * 0.5]);
    }

    /* ---------- World-document objects ---------- */
    static wallProf(o, segIdx) {
      const base = o.hs && o.hs[segIdx] != null ? o.hs[segIdx] : o.h == null ? 2.4 : o.h, amp = o.ruin == null ? 2.0 : o.ruin, seed = (o.seed | 0) + segIdx * 7;
      const gaps = (o.gaps || []).filter((g) => g[0] === segIdx);
      return (t) => {
        for (const g of gaps) if (t > g[1] && t < g[2]) return 0;
        return Math.max(0, Math.min(7, Math.round(base + (K.hash2((t * 9) | 0, 0, seed) - 0.5) * amp + Math.sin(t * 7 + seed) * amp * 0.4)));
      };
    }
    buildWall(o) {
      this.xf = null; this.rng = new K.RNG(o.seed | 0 || 1);
      const P = WorldDoc.wallPts(o), n = P.length - 1;
      for (let k = 0; k < n; k++) this.wall(P[k][0], P[k][1], P[k + 1][0], P[k + 1][1], PropBuilder.wallProf(o, k), o.depth || 0.42);
      if (o.pillars !== false) {
        const corners = o.closed ? P.slice(0, n) : P;
        corners.forEach((p, k) => { const rows = Math.max(2, Math.round((o.h == null ? 2.4 : o.h) + 1.5 + this.rng.range(-1, 2))); this.pillar(p[0], p[1], rows, this.doc.tileY(p[0], p[1])); });
      }
    }
    buildBridge(o) {
      const doc = this.doc, [ax, az] = o.a, [bx, bz] = o.b, L = Math.hypot(bx - ax, bz - az); if (L < 0.5) return;
      const ang = Math.atan2(-(bz - az), bx - ax), bw = o.w || 1.6, ca = Math.cos(ang), sa = Math.sin(ang);
      const R = (this.rng = new K.RNG(o.seed | 0 || 7));
      this.xf = M4(ax, 0, az, 0, ang, 0);
      const deck = (s) => WorldDoc.deckY(doc, o, s / L);
      const world = (s, n) => [ax + ca * s + sa * n, az - sa * s + ca * n];    // local (s along, n across) -> world x,z
      const floorAt = (s) => { let m = 99; for (const n of [-bw / 2, 0, bw / 2]) { const [x, z] = world(s, n); m = Math.min(m, doc.tileY(x, z)); } return m; };
      // deck + stone under-course
      const steps = Math.max(1, Math.round(L / 0.5)), sw = L / steps;
      for (let k = 0; k < steps; k++) {
        const s = (k + 0.5) * sw, y = deck(s);
        this.put(this.deck, this.box, M4(s, y - 0.15, 0, 0, 0, 0, sw, 0.3, bw));
        this.block(s, y - 0.42, 0, sw, 0.14, bw + 0.08, 0, 5);
      }
      // piers where the ground falls away, arches between landings and piers
      const npier = L > 3.2 ? Math.max(1, Math.round(L / 5.5)) : 0, piers = [];
      for (let k = 1; k <= npier; k++) piers.push((L * k) / (npier + 1));
      piers.forEach((ps) => {
        const fy = floorAt(ps), top = deck(ps) - 0.45; if (fy > top - 0.3) return;
        for (let y = fy - 0.1; y < top; y += 0.32) for (const [ox, oz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]])
          this.block(ps + ox + R.range(-0.02, 0.02), y, oz * (bw / 1.6), 0.52, Math.min(0.31, top - y + 0.01), 0.52, R.range(-0.04, 0.04));
      });
      const stops = [0.5, ...piers.flatMap((p) => [p - 0.55, p + 0.55]), L - 0.5];
      for (let k = 0; k + 1 < stops.length; k += 2) {
        const a = stops[k], b = stops[k + 1]; if (b - a < 0.6) continue;
        const cx = (a + b) / 2, r = (b - a) / 2;
        for (let q = 0; q <= 8; q++) {
          const an = Math.PI * (q / 8), s = cx - Math.cos(an) * r, top = deck(s) - 0.42;
          const y = Math.max(floorAt(s), top - r + Math.sin(an) * r - 0.1);
          for (let yy = y; yy < top - 0.05; yy += 0.3) this.block(s, yy, 0, 0.34, Math.min(0.3, top - yy), bw - 0.1, 0, undefined, 0, 0, Math.cos(an) * 0.5);
        }
      }
      // posts + wooden rails (a couple broken)
      const brokenA = R.int(1, 6), brokenB = R.int(1, 6);
      for (const side of [-1, 1]) {
        let prev = null, idx = 0;
        const np = Math.max(2, Math.round(L / 0.9) + 1);
        for (let k = 0; k < np; k++) {
          const s = 0.25 + (k / (np - 1)) * (L - 0.5), y = deck(s), z = side * (bw / 2 - 0.1);
          this.block(s, y, z, 0.2, 0.62, 0.2, 0, 2); this.cap(s, y + 0.62, z, 0.24, 0.24, 0, 0.07);
          if (prev && !(side === 1 && idx === brokenA) && !(side === -1 && idx === brokenB)) {
            const ms = (prev[0] + s) / 2, my = (prev[1] + y) / 2, len = s - prev[0], sl = Math.atan2(y - prev[1], len);
            this.put(this.wood, this.box, M4(ms, my + 0.48, z, 0, 0, sl, len, 0.07, 0.07));
            this.put(this.wood, this.box, M4(ms, my + 0.24, z, 0, 0, sl, len, 0.06, 0.06));
          }
          prev = [s, y]; idx++;
        }
      }
      this.xf = null;
    }
    buildProp(o, state) {
      const def = PropBuilder.PROPS[o.type]; if (!def || !def.build) return;
      const y = this.doc.groundY(o.x, o.z), s = o.s || 1;
      this.rng = new K.RNG(o.seed | 0 || 3);
      this.xf = M4(o.x, y, o.z, 0, o.rot || 0, 0, s, s, s);
      def.build(this, o, state || null);
      this.xf = null;
    }
    /* small round-ish clump from flat-shaded icosahedra (herbs, ore lumps) */
    clump(mat, x, y, z, r) { this.put(this[mat], UNIT.ico, M4(x, y + r * 0.5, z, this.rng.range(0, 3), this.rng.range(0, 3), 0, r, r * 0.8, r)); }
    static roleOf(o) {
      const def = PropBuilder.PROPS[o.type] || {};
      if (def.start) return 'player';
      if (!def.sprite) return null;
      return o.role || def.role || (def.group === 'Monsters' ? 'enemy' : 'npc');
    }
    static spriteOf(o) { const def = PropBuilder.PROPS[o.type] || {}; if (!def.sprite) return null; return (def.start ? o.hero : o.look) || def.sprite; }
  }
  PropBuilder.KEYS = ['stone', 'snow', 'wood', 'crate', 'bark', 'iron', 'deck', 'pine', 'boulder', 'fern', 'hole', 'ore', 'leaf'];
  /* prop catalogue: build() emits static geometry in local space; dyn describes fire/light/cloth/sprite parts */
  PropBuilder.PROPS = {
    campfire: { name: 'Campfire', group: 'Light', r: 0.6, build(pb) {
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; pb.block(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4, 0.2, 0.13, 0.17, a, i % 16); }
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; pb.put(pb.bark, UNIT.stick, M4(Math.cos(a) * 0.14, 0.17, Math.sin(a) * 0.14, Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0)); }
    }, dyn: { fire: [0, 0.1, 0, 1.0], light: [0, 0.6, 0, 1], embers: [0, 0.3, 0] } },
    torch: { name: 'Torch brazier', group: 'Light', r: 0.35, build(pb) {
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; pb.put(pb.iron, pb.box, M4(Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.14, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25, 0.05, 0.6, 0.05)); }
      pb.put(pb.iron, UNIT.bowl, M4(0, 0.66, 0));
    }, dyn: { fire: [0, 0.74, 0, 0.62], light: [0, 1.0, 0, 0.6], embers: [0, 0.8, 0] } },
    banner: { name: 'Banner', group: 'Ruins', r: 0.35, build(pb) {
      pb.put(pb.wood, UNIT.pole, M4(0, 1.2, 0)); pb.put(pb.wood, pb.box, M4(0.25, 2.3, 0, 0, 0, 0, 0.62, 0.05, 0.05));
    }, dyn: { banner: [0.27, 2.27, 0] } },
    pine: { name: 'Pine', group: 'Nature', r: 0.7, build(pb) { pb.pineAt(0, -0.05, 0, 3.2 * pb.rng.range(0.85, 1.2)); } },
    deadtree: { name: 'Dead tree', group: 'Nature', r: 0.5, build(pb) { pb.deadTree(0, 0, 0); } },
    shrub: { name: 'Shrub', group: 'Nature', r: 0.35, build(pb) { const R = pb.rng; pb.fernAt(0, 0, 0, R.range(0.36, 0.5)); for (let i = 0; i < 2; i++) pb.fernAt(R.range(-0.3, 0.3), 0, R.range(-0.3, 0.3), R.range(0.3, 0.42)); } },
    rock: { name: 'Rock', group: 'Nature', r: 0.45, build(pb) { pb.boulderAt(0, 0, 0, 0.42); } },
    rubble: { name: 'Rubble pile', group: 'Ruins', r: 0.6, build(pb) { pb.rubble(0, 0, 10, 0.55); } },
    crate: { name: 'Crate', group: 'Ruins', r: 0.35, build(pb) { pb.crateAt(0, 0, 0, 0.52, 0); } },
    crates: { name: 'Crate stack', group: 'Ruins', r: 0.6, build(pb) { pb.crateAt(0, 0, 0, 0.55, 0.2); pb.crateAt(0.55, 0, -0.15, 0.45, -0.3); pb.crateAt(0.1, 0.55, 0, 0.42, 0.5); } },
    pillar: { name: 'Pillar', group: 'Ruins', r: 0.4, build(pb) { pb.pillar(0, 0, 4 + pb.rng.int(0, 2)); } },
    log: { name: 'Log bench', group: 'Ruins', r: 0.6, build(pb) {
      pb.put(pb.bark, UNIT.log, M4(0, 0.15, 0, 0, 0, Math.PI / 2)); pb.cap(0, 0.27, 0, 0.9, 0.16, 0, 0.05);
    } },
    'start': { name: 'Player start', group: 'Characters', r: 0.45, sprite: 'warden', start: true, build(pb) {
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pb.block(Math.cos(a) * 0.5, -0.06, Math.sin(a) * 0.5, 0.16, 0.12, 0.12, -a, 5 + (i % 3)); }
    } },
    'sprite:warden': { name: 'The Warden', group: 'Characters', r: 0.4, sprite: 'warden' },
    'npc:merchant': { name: 'Merchant', group: 'Characters', r: 0.45, sprite: 'witch', role: 'merchant', build(pb) { pb.crateAt(0.42, 0, -0.2, 0.36, 0.3); pb.crateAt(-0.45, 0, -0.15, 0.3, -0.2); } },
    'sprite:witch': { name: 'Rime Witch', group: 'Characters', r: 0.4, sprite: 'witch', dyn: { staff: true } },
    'sprite:ghoulA': { name: 'Frost Ghoul', group: 'Monsters', r: 0.4, sprite: 'ghoulA' },
    'sprite:ghoulB': { name: 'Pale Ghoul', group: 'Monsters', r: 0.4, sprite: 'ghoulB' },
    'sprite:troll': { name: 'Rime Troll', group: 'Monsters', r: 0.7, sprite: 'troll' },
    /* resource nodes: play mode looks up `interact` in the interaction registry; build(pb, o, state) draws the depleted look */
    'res:ore': { name: 'Ore vein', group: 'Resources', r: 0.55, h: 0.9, interact: 'ore', build(pb, o, st) {
      if (st === 'depleted') { pb.rubble(0, 0, 6, 0.4); return; }
      pb.boulderAt(0, 0, 0, 0.52); pb.boulderAt(0.38, 0, 0.2, 0.3); pb.boulderAt(-0.3, 0, 0.25, 0.24);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + pb.rng.range(-0.3, 0.3); pb.clump('ore', Math.cos(a) * 0.42, 0.1 + pb.rng.range(0, 0.2), Math.sin(a) * 0.36, pb.rng.range(0.11, 0.16)); }
      pb.clump('ore', 0.05, 0.38, 0.12, 0.14); pb.clump('ore', -0.16, 0.33, -0.1, 0.12);
      pb.cap(-0.05, 0.42, -0.05, 0.36, 0.3, 0.4, 0.06);
    } },
    'res:pine': { name: 'Choppable pine', group: 'Resources', r: 0.6, h: 3, interact: 'tree', build(pb, o, st) {
      pb.put(pb.bark, UNIT.log, M4(0.55, 0.13, 0.35, 0, 0.4, Math.PI / 2, 0.9, 0.7, 0.9)); pb.put(pb.bark, UNIT.log, M4(0.62, 0.13, 0.62, 0, 0.5, Math.PI / 2, 0.9, 0.7, 0.9));
      if (st === 'depleted') { pb.put(pb.bark, UNIT.trunk, M4(0, 0.13, 0, 0, 0, 0, 0.13, 0.26, 0.13)); pb.cap(0, 0.26, 0, 0.26, 0.26, 0, 0.05); return; }
      pb.pineAt(0, -0.05, 0, 2.9 * pb.rng.range(0.92, 1.08));
    } },
    'res:herb': { name: 'Herb patch', group: 'Resources', r: 0.4, h: 0.5, interact: 'herb', build(pb, o, st) {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pb.block(Math.cos(a) * 0.42, -0.05, Math.sin(a) * 0.42, 0.12, 0.1, 0.1, -a, 9 + (i % 4)); }
      if (st === 'depleted') { pb.fernAt(0, 0, 0, 0.16); return; }
      pb.fernAt(0, 0, 0, 0.38); pb.fernAt(0.18, 0, 0.12, 0.3); pb.fernAt(-0.17, 0, -0.08, 0.32);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; pb.clump('leaf', Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 0.09); }
    } },
    'res:fish': { name: 'Ice-fishing hole', group: 'Resources', r: 0.5, h: 0.4, interact: 'fish', build(pb, o, st) {
      const disc = new THREE.CylinderGeometry(0.36, 0.36, 0.04, 12);
      pb.put(st === 'depleted' ? pb.snow : pb.hole, disc, M4(0, 0.0, 0)); disc.dispose();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; pb.cap(Math.cos(a) * 0.43, -0.02, Math.sin(a) * 0.43, 0.2, 0.12, -a, 0.08); }
      pb.put(pb.bark, UNIT.stick, M4(0.5, 0.22, -0.32, 0.25, 0, 0.55)); pb.crateAt(-0.55, 0, 0.3, 0.26, 0.4);
    } },
  };
  WorldDoc.wallPts = (o) => (o.closed ? o.pts.concat([o.pts[0]]) : o.pts);

  K.PropBuilder = PropBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
