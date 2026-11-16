/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · navigation grid for play mode: walkability + step heights per tile, wall edges, A* and
   string-pulled paths. Chasms, water, walls and solid props block; bridge decks are walkable; a step
   between neighbouring tiles may rise or drop at most MAX_STEP world units. */
(function (G) {
  const K = G.K;
  const { TILE, T, WorldDoc, PropBuilder } = K;
  const MAX_STEP = 0.55;
  const E = 0, S = 1, W = 2, N = 3;                     // orthogonal edge bits
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  const NON_BLOCKING = new Set(['shrub', 'start', 'banner']);

  /* binary min-heap of tile indices keyed by f */
  class Heap {
    constructor() { this.a = []; this.f = []; }
    get size() { return this.a.length; }
    push(i, f) { const a = this.a, F = this.f; a.push(i); F.push(f); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (F[p] <= F[k]) break; [a[p], a[k]] = [a[k], a[p]]; [F[p], F[k]] = [F[k], F[p]]; k = p; } }
    pop() {
      const a = this.a, F = this.f, top = a[0], li = a.pop(), lf = F.pop();
      if (a.length) { a[0] = li; F[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && F[l] < F[m]) m = l; if (r < a.length && F[r] < F[m]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; [F[m], F[k]] = [F[k], F[m]]; k = m; } }
      return top;
    }
  }

  class NavGrid {
    /* opts.buildings: the renderer's K.BuildingSet (walls block tile edges, doors open them, furniture blocks tiles, floors set heights) */
    constructor(doc, opts = {}) { this.doc = doc; this.buildings = opts.buildings || null; this.build(); }
    build() {
      const doc = this.doc, w = (this.w = doc.w), h = (this.h = doc.h), n = w * h;
      this.S = new Float32Array(n); this.walk = new Uint8Array(n); this.edge = new Uint8Array(n); this.deck = new Uint8Array(n); this.free = new Uint8Array(n);
      this.bridges = doc.objects.filter((o) => o.kind === 'bridge');
      if (!(this.buildings && this.buildings.list && this.buildings.list.length) && !this.bridges.length) {   // plain ground (the common case, and a 22M-tile Redwood world): no per-tile surface search
        const S = this.S, walk = this.walk, H = doc.height, TT = doc.terrain, HQ = K.HQ;
        for (let k = 0; k < n; k++) { S[k] = H[k] * HQ; const t = TT[k]; walk[k] = t !== T.CHASM && t !== T.WATER ? 1 : 0; }
      } else for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i, x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, g = doc.hy(i, j), y = this.surface(x, z, g);
        this.S[k] = y; const onDeck = y > g + 0.02; this.deck[k] = onDeck ? 1 : 0;
        const t = doc.terrain[k]; this.walk[k] = onDeck || (t !== T.CHASM && t !== T.WATER) ? 1 : 0;
      }
      for (const o of doc.objects) {
        if (o.kind === 'prop') this.blockProp(o);
        else if (o.kind === 'wall') this.blockWall(o);
      }
      if (doc.redwoods) doc.redwoods.blockNav(this);   // the Redwood world's trunks and logs (not doc objects: see 82k-redwood-forest.js)
      if (this.buildings) this.applyBuildings(this.buildings);
    }
    /* building tiles: floor height + furniture walkability; every edge of a building tile follows BuildingSet.canStep.
       Doorways may climb onto the floor (the foundation step) whatever the height difference. */
    applyBuildings(set) {
      const w = this.w;
      for (const b of set.list) {
        const fy = b.y0 + K.BUILDING_FLOOR_Y;
        for (const [li, lj] of K.Footprint.tiles(b.spec.footprint)) {
          const i = b.spec.x + li, j = b.spec.z + lj; if (!this.inside(i, j)) continue;
          const k = j * w + i; this.S[k] = fy; this.deck[k] = 0; this.walk[k] = set.walkable(i, j) ? 1 : 0;
        }
        for (const [li, lj] of K.Footprint.tiles(b.spec.footprint)) {
          const i = b.spec.x + li, j = b.spec.z + lj; if (!this.inside(i, j)) continue;
          for (const [di, dj, bit, back] of [[1, 0, E, W], [-1, 0, W, E], [0, 1, S, N], [0, -1, N, S]]) {
            const ni = i + di, nj = j + dj; if (!this.inside(ni, nj)) continue;
            const k = j * w + i, nk = nj * w + ni;
            if (!set.canStep(i, j, ni, nj)) { this.edge[k] |= 1 << bit; this.edge[nk] |= 1 << back; }
            else if (set.at(ni, nj) !== b) { this.free[k] |= 1 << bit; this.free[nk] |= 1 << back; }   // a doorway: step up onto the floor
          }
        }
      }
    }
    /* ground or bridge deck at (x,z) (same rule as WorldDoc.groundY, with the bridge list cached) */
    surface(x, z, g) {
      if (this.buildings) { const fy = this.buildings.floorY(Math.floor(x / TILE), Math.floor(z / TILE)); if (fy != null) return fy; }
      let y = g == null ? this.doc.tileY(x, z) : g;
      for (const o of this.bridges) {
        const d = WorldDoc.bridgeLocal(o, x, z);
        if (d.s >= -0.05 && d.s <= d.L + 0.05 && Math.abs(d.n) < (o.w || 1.6) / 2 - 0.05) y = Math.max(y, WorldDoc.deckY(this.doc, o, d.s / d.L));
      }
      return y;
    }
    y(x, z) { return this.surface(x, z); }
    blockProp(o) {
      const def = PropBuilder.PROPS[o.type]; if (!def || def.sprite || NON_BLOCKING.has(o.type)) return;
      const r = def.r * (o.s || 1) * 0.6, [ci, cj] = this.doc.tileOf(o.x, o.z), R = Math.ceil(r / TILE) + 1;
      if (this.doc.inside(ci, cj)) this.walk[cj * this.w + ci] = 0;
      for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
        if (!this.doc.inside(i, j)) continue;
        if (Math.hypot((i + 0.5) * TILE - o.x, (j + 0.5) * TILE - o.z) < r) this.walk[j * this.w + i] = 0;
      }
    }
    /* walls block the tile edges they cross (where the ruin still has blocks) and tiles they run through */
    blockWall(o) {
      const P = WorldDoc.wallPts(o), w = this.w;
      for (let k = 0; k + 1 < P.length; k++) {
        const [ax, az] = P[k], [bx, bz] = P[k + 1], prof = PropBuilder.wallProf(o, k), L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const i0 = Math.floor(Math.min(ax, bx) / TILE) - 1, i1 = Math.floor(Math.max(ax, bx) / TILE) + 1, j0 = Math.floor(Math.min(az, bz) / TILE) - 1, j1 = Math.floor(Math.max(az, bz) / TILE) + 1;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          if (!this.doc.inside(i, j)) continue;
          const cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
          // tile centre inside the wall's thickness
          const t = Math.max(0, Math.min(1, ((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / (L * L))), d = Math.hypot(cx - ax - (bx - ax) * t, cz - az - (bz - az) * t);
          if (d < 0.2 && prof(t) > 0) this.walk[j * w + i] = 0;
          for (const [di, dj, bit, back] of [[1, 0, E, W], [0, 1, S, N]]) {
            const ni = i + di, nj = j + dj; if (!this.doc.inside(ni, nj)) continue;
            const u = NavGrid.cross(cx, cz, cx + di * TILE, cz + dj * TILE, ax, az, bx, bz);
            if (u >= 0 && prof(u) > 0) { this.edge[j * w + i] |= 1 << bit; this.edge[nj * w + ni] |= 1 << back; }
          }
        }
      }
      if (o.pillars !== false) for (const p of (o.closed ? P.slice(0, -1) : P)) {
        const [ci, cj] = this.doc.tileOf(p[0], p[1]);
        for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) if (this.doc.inside(i, j) && Math.hypot((i + 0.5) * TILE - p[0], (j + 0.5) * TILE - p[1]) < 0.42) this.walk[j * w + i] = 0;
      }
    }
    /* param along wall segment (c->d) where segment a->b crosses it, or -1 */
    static cross(ax, az, bx, bz, cx, cz, dx, dz) {
      const r1 = bx - ax, r2 = bz - az, s1 = dx - cx, s2 = dz - cz, den = r1 * s2 - r2 * s1; if (Math.abs(den) < 1e-9) return -1;
      const t = ((cx - ax) * s2 - (cz - az) * s1) / den, u = ((cx - ax) * r2 - (cz - az) * r1) / den;
      return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1;
    }
    inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
    ok(i, j) { return this.inside(i, j) && (this.walk[j * this.w + i] === 1 || (!!this.over && this.over(i, j))); }   // over: tiles a particular search may treat as open (a creature planning to break through)
    orth(i, j, di, dj) {
      const ni = i + di, nj = j + dj; if (!this.ok(ni, nj)) return false;
      const k = j * this.w + i, bit = di === 1 ? E : di === -1 ? W : dj === 1 ? S : N;
      if (this.edge[k] & (1 << bit)) return false;
      if (this.free[k] & (1 << bit)) return true;
      return Math.abs(this.S[nj * this.w + ni] - this.S[k]) <= (this.ms || MAX_STEP);   // ms: this search's own climbing limit (a bear steps further than a wolf)
    }
    /* can you step from tile (i,j) to its 8-neighbour (ni,nj)? diagonals need both L-shaped routes clear */
    step(i, j, ni, nj) {
      const di = ni - i, dj = nj - j; if (!di && !dj) return true;
      if (!di || !dj) return this.orth(i, j, di, dj);
      return this.ok(ni, nj) && this.orth(i, j, di, 0) && this.orth(i + di, j, 0, dj) && this.orth(i, j, 0, dj) && this.orth(i, j + dj, di, 0);
    }
    /* ox, oz: a grid that covers only part of the world (a RampartLayer window) counts its tiles from there */
    tile(x, z) { return [Math.floor(x / TILE) - (this.ox || 0), Math.floor(z / TILE) - (this.oz || 0)]; }
    centre(i, j) { return [(i + (this.ox || 0) + 0.5) * TILE, (j + (this.oz || 0) + 0.5) * TILE]; }
    standable(x, z) { const [i, j] = this.tile(x, z); return this.ok(i, j); }
    /* nearest walkable tile to (i,j) within rad tiles, optionally reachable from a component */
    nearestOk(i, j, rad = 3) {
      let best = null, bd = 1e9;
      for (let r = 0; r <= rad; r++) {
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const a = i + di, b = j + dj; if (!this.ok(a, b)) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [a, b]; }
        }
        if (best) return best;
      }
      return null;
    }
    /* straight walk from a to b stays on walkable tiles and only takes legal steps */
    los(ax, az, bx, bz) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.08));
      let [pi, pj] = this.tile(ax, az);
      for (let k = 1; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, [i, j] = this.tile(x, z);
        if (i === pi && j === pj) continue;
        if (Math.abs(i - pi) > 1 || Math.abs(j - pj) > 1 || !this.step(pi, pj, i, j)) return false;
        // keep a little clearance from blocked neighbours when cutting across tile corners
        pi = i; pj = j;
      }
      return true;
    }
    /* A* from (sx,sz) to the goal point; with range > 0 any tile whose centre is within range of the goal ends the search.
       Returns a smoothed list of [x,z] waypoints (not including the start), or null if unreachable. */
    /* opts: range, maxNodes, blocked(i,j), maxStep (metres a walker may climb or drop), over(i,j) (extra tiles to treat as open), extra(i,j,ni,nj) (added cost of a step) */
    find(sx, sz, gx, gz, opts = {}) {
      const pm = this.ms, po = this.over; this.ms = opts.maxStep || 0; this.over = opts.over || null;
      try { return this._find(sx, sz, gx, gz, opts); } finally { this.ms = pm; this.over = po; }
    }
    _find(sx, sz, gx, gz, opts = {}) {
      const range = opts.range || 0, w = this.w, maxN = opts.maxNodes || 80000;
      let [si, sj] = this.tile(sx, sz);
      if (!this.ok(si, sj)) { const q = this.nearestOk(si, sj, 2); if (!q) return null; [si, sj] = q; }
      let [ti, tj] = this.tile(gx, gz), exact = !range;
      if (!range && !this.ok(ti, tj)) { const q = this.nearestOk(ti, tj, 3); if (!q) return null; [ti, tj] = q; exact = false; }
      const goalC = range ? [gx, gz] : this.centre(ti, tj);
      // a range goal accepts tile centres within range; a goal on a tile corner has no centre closer than TILE/sqrt2,
      // so a range below that could never be met: the search stops on the nearest tiles, the last step closes in
      const reach = Math.max(range, TILE * 0.75);
      const ox = this.ox || 0, oz = this.oz || 0;
      const isGoal = range ? (i, j) => Math.hypot((i + ox + 0.5) * TILE - gx, (j + oz + 0.5) * TILE - gz) <= reach : (i, j) => i === ti && j === tj;
      const hf = (i, j) => Math.max(0, Math.hypot((i + ox + 0.5) * TILE - goalC[0], (j + oz + 0.5) * TILE - goalC[1]) - range) / TILE;
      // the search runs inside a window around start and goal (the whole map when it is small), on scratch memory reused
      // between searches: a 22M-tile world must never allocate full-world arrays per path
      let win = this.searchWindow(si, sj, ti, tj, range, NavGrid.MARGIN), found = -1;
      for (;;) {
        found = this.search(win, si, sj, isGoal, hf, maxN, opts);
        if (found >= 0 || win.full || !win.hitEdge || win.margin >= NavGrid.MAX_MARGIN) break;
        win = this.searchWindow(si, sj, ti, tj, range, win.margin * 4);   // boxed in by the window's edge: look wider once more
      }
      if (found < 0) return null;
      const sc = this.scratch, s = sj * w + si, tiles = [];
      for (let lk = found; lk >= 0; lk = sc.from[lk]) { const k = (win.y0 + ((lk / win.ww) | 0)) * w + win.x0 + (lk % win.ww); if (k === s) break; tiles.push(k); }
      tiles.reverse();
      const pts = tiles.map((k) => this.centre(k % w, (k / w) | 0));
      if (exact && pts.length && this.los(pts[pts.length - 1][0], pts[pts.length - 1][1], gx, gz)) pts[pts.length - 1] = [gx, gz];
      else if (exact && !pts.length) pts.push([gx, gz]);
      if (range) {
        // tile centres can be in range while the actual stop point is not: finish with a step toward the goal
        const [lx, lz] = pts.length ? pts[pts.length - 1] : [sx, sz], d = Math.hypot(gx - lx, gz - lz);
        if (d > range * 0.9) { const k = (d - range * 0.75) / d, px = lx + (gx - lx) * k, pz = lz + (gz - lz) * k; if (this.los(lx, lz, px, pz)) pts.push([px, pz]); }
      }
      return this.smooth([sx, sz], pts);
    }
    /** the box a search may use: start and goal plus a margin (in tiles), or the whole map when it is small */
    searchWindow(si, sj, ti, tj, range, margin) {
      if (this.w * this.h <= NavGrid.FULL_SEARCH_TILES) return { x0: 0, y0: 0, ww: this.w, wh: this.h, full: true, margin };
      const m = margin + Math.ceil(range / TILE);
      const x0 = Math.max(0, Math.min(si, ti) - m), y0 = Math.max(0, Math.min(sj, tj) - m), x1 = Math.min(this.w, Math.max(si, ti) + m + 1), y1 = Math.min(this.h, Math.max(sj, tj) + m + 1);
      return { x0, y0, ww: x1 - x0, wh: y1 - y0, full: x0 === 0 && y0 === 0 && x1 === this.w && y1 === this.h, margin };
    }
    /** scratch arrays for a window of n tiles, grown when needed and reused; a stamp marks which entries are this search's */
    scratchFor(n) {
      let sc = this.scratch;
      if (!sc || sc.n < n) sc = this.scratch = { n, g: new Float32Array(n), from: new Int32Array(n), seen: new Uint32Array(n), shut: new Uint32Array(n), gen: 0 };
      if (++sc.gen >= 0xffffffff) { sc.seen.fill(0); sc.shut.fill(0); sc.gen = 1; }
      return sc;
    }
    /** A* inside the window; returns the goal's window index, or -1 */
    search(win, si, sj, isGoal, hf, maxN, opts) {
      const w = this.w, ww = win.ww, x0 = win.x0, y0 = win.y0, x1 = x0 + ww, y1 = y0 + win.wh, sc = this.scratchFor(ww * win.wh), gen = sc.gen;
      const g = sc.g, from = sc.from, seen = sc.seen, shut = sc.shut, open = new Heap();
      const s = (sj - y0) * ww + (si - x0); g[s] = 0; from[s] = -1; seen[s] = gen; open.push(s, hf(si, sj));
      let count = 0; win.hitEdge = false;
      while (open.size && count++ < maxN) {
        const lk = open.pop(); if (shut[lk] === gen) continue; shut[lk] = gen;
        const i = x0 + (lk % ww), j = y0 + ((lk / ww) | 0), k = j * w + i;
        if (isGoal(i, j)) return lk;
        for (const [di, dj, c] of NB) {
          const ni = i + di, nj = j + dj; if (!this.inside(ni, nj)) continue;
          if (ni < x0 || nj < y0 || ni >= x1 || nj >= y1) { win.hitEdge = true; continue; }
          const nl = (nj - y0) * ww + (ni - x0); if (shut[nl] === gen) continue;
          if (!this.step(i, j, ni, nj)) continue;
          if (opts.blocked && opts.blocked(ni, nj)) continue;   // tiles this walker may not enter (a gate is shut to creatures, open to you)
          const nk = nj * w + ni, climb = Math.abs(this.S[nk] - this.S[k]) * 0.6, ng = g[lk] + c + climb + (opts.extra ? opts.extra(i, j, ni, nj) : 0);
          if (seen[nl] !== gen || ng < g[nl]) { seen[nl] = gen; g[nl] = ng; from[nl] = lk; open.push(nl, ng + hf(ni, nj)); }
        }
      }
      return -1;
    }
    /* string-pull: skip waypoints while the straight line stays legal */
    smooth(start, pts) {
      if (pts.length < 2) return pts;
      const out = []; let cur = start, k = 0;
      while (k < pts.length) {
        let far = k;
        for (let q = pts.length - 1; q > k; q--) if (this.los(cur[0], cur[1], pts[q][0], pts[q][1])) { far = q; break; }
        out.push(pts[far]); cur = pts[far]; k = far + 1;
      }
      return out;
    }
  }

  NavGrid.FULL_SEARCH_TILES = 1 << 20;   // maps up to ~1M tiles search the whole map (exactly as before); bigger ones search a window
  NavGrid.MARGIN = 96; NavGrid.MAX_MARGIN = 1536;   // tiles around start and goal (48 m), widened x4 when a search is boxed in
  Object.assign(K, { NavGrid, NAV_MAX_STEP: MAX_STEP });
})(typeof window !== 'undefined' ? window : globalThis);
