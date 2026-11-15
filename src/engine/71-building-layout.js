/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Building tile layout: rooms, wall edges, openings, and walkability. */
(function (G) {
  const K = G.K;
  /* ---------- layout: rooms per tile, wall edges, openings, walkability ---------- */
  class BuildingLayout {
    constructor(b, catalog) {
      this.b = b; this.W = b.footprint.w; this.H = b.footprint.h; this.catalog = catalog || K.FURNITURE || {};
      const W = this.W, H = this.H;
      this.cell = new Int16Array(W * H).fill(-1);
      this.rooms = b.rooms.slice();
      let open = -1;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (!K.Footprint.inside(b.footprint, i, j)) continue;
        let r = -1; for (let k = this.rooms.length - 1; k >= 0; k--) { const rm = this.rooms[k]; if (i >= rm.x && i < rm.x + rm.w && j >= rm.z && j < rm.z + rm.h) { r = k; break; } }
        if (r < 0) { if (open < 0) { open = this.rooms.length; this.rooms.push({ id: 'open', type: 'hall', x: 0, z: 0, w: 0, h: 0, implicit: true }); } r = open; }
        this.cell[j * W + i] = r;
      }
      // edges: v[(j)*(W+1)+i] = west edge of tile (i,j); hz[j*W+i] = north edge of tile (i,j). 0 none, 1 exterior, 2 interior
      this.v = new Uint8Array((W + 1) * H); this.hz = new Uint8Array(W * (H + 1));
      this.vOpen = new Uint8Array(this.v.length); this.hOpen = new Uint8Array(this.hz.length);   // 0 none, 1 door, 2 window
      for (let j = 0; j < H; j++) for (let i = 0; i <= W; i++) { const a = this.room(i - 1, j), c = this.room(i, j); this.v[j * (W + 1) + i] = a === c ? 0 : a < 0 || c < 0 ? 1 : 2; }
      for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) { const a = this.room(i, j - 1), c = this.room(i, j); this.hz[j * W + i] = a === c ? 0 : a < 0 || c < 0 ? 1 : 2; }
      this.doors = []; this.windows = [];
      const interior = b.doors.filter((d) => d.kind === 'interior');
      for (const d of b.doors) this.openEdges(d, 1);
      for (const w of b.windows) this.openEdges(w, 2);
      if (!interior.length) this.autoDoorways();
      this.solid = new Uint8Array(W * H); this.items = new Array(W * H).fill(null);
      for (const f of b.furniture) {
        const def = this.catalog[f.type]; if (!def) continue;
        for (const [i, j] of K.FurnitureFootprint.tiles(def, f)) {
          if (i < 0 || j < 0 || i >= W || j >= H) continue;
          if (def.solid !== false && def.layer !== 'floor') this.solid[j * W + i] = 1;
          if (def.interact || !this.items[j * W + i]) this.items[j * W + i] = f;
        }
      }
    }
    room(i, j) { return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : this.cell[j * this.W + i]; }
    roomAt(i, j) { const r = this.room(i, j); return r < 0 ? null : this.rooms[r]; }
    /* edge between tile (i,j) and its neighbour on `side`: { kind, open, arr, idx } */
    edge(i, j, side) {
      const W = this.W;
      if (side === 'w') return this.edgeRef('v', j * (W + 1) + i);
      if (side === 'e') return this.edgeRef('v', j * (W + 1) + i + 1);
      if (side === 'n') return this.edgeRef('h', j * W + i);
      return this.edgeRef('h', (j + 1) * W + i);
    }
    edgeRef(axis, idx) { const k = axis === 'v' ? this.v : this.hz, o = axis === 'v' ? this.vOpen : this.hOpen; if (idx < 0 || idx >= k.length) return null; return { kind: k[idx], open: o[idx], axis, idx }; }
    setOpen(e, val) { if (!e || !e.kind) return false; (e.axis === 'v' ? this.vOpen : this.hOpen)[e.idx] = val; return true; }
    openEdges(d, val) {
      const along = d.side === 'n' || d.side === 's' ? [1, 0] : [0, 1], rec = { x: d.x, z: d.z, side: d.side, w: d.w, kind: d.kind, tiles: [] };
      for (let k = 0; k < d.w; k++) {
        const i = d.x + along[0] * k, j = d.z + along[1] * k;
        if (this.setOpen(this.edge(i, j, d.side), val)) rec.tiles.push([i, j]);
      }
      if (!rec.tiles.length) return;
      (val === 1 ? this.doors : this.windows).push(rec);
    }
    /* one 2-wide doorway in the middle of the longest shared wall between each pair of rooms */
    autoDoorways() {
      const runs = new Map(), W = this.W, H = this.H;
      const note = (a, c, axis, line, s) => { const key = Math.min(a, c) + ':' + Math.max(a, c); if (!runs.has(key)) runs.set(key, []); runs.get(key).push([axis, line, s]); };
      for (let j = 0; j < H; j++) for (let i = 1; i < W; i++) { const a = this.room(i - 1, j), c = this.room(i, j); if (a >= 0 && c >= 0 && a !== c) note(a, c, 'v', i, j); }
      for (let j = 1; j < H; j++) for (let i = 0; i < W; i++) { const a = this.room(i, j - 1), c = this.room(i, j); if (a >= 0 && c >= 0 && a !== c) note(a, c, 'h', j, i); }
      for (const list of runs.values()) {
        let best = null, cur = null;
        list.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1]) || p[1] - q[1] || p[2] - q[2]);
        for (const e of list) {
          if (cur && cur.axis === e[0] && cur.line === e[1] && cur.s1 === e[2]) cur.s1++;
          else { cur = { axis: e[0], line: e[1], s0: e[2], s1: e[2] + 1 }; }
          if (!best || cur.s1 - cur.s0 > best.s1 - best.s0) best = Object.assign({}, cur);
        }
        if (!best || best.s1 - best.s0 < 2) continue;
        const mid = Math.floor((best.s0 + best.s1) / 2) - 1;
        const d = best.axis === 'v' ? { x: best.line, z: mid, side: 'w', w: 2, kind: 'interior' } : { x: mid, z: best.line, side: 'n', w: 2, kind: 'interior' };
        this.openEdges(d, 1);
      }
    }
    /* walls as straight runs: { axis:'v'|'h', line, s0, s1, kind:1|2, normal:[nx,nz] (exterior: outward), openings:[{s0,s1,type:'door'|'window'}] } */
    segments() {
      const out = [], W = this.W, H = this.H;
      const scan = (axis, nLines, nSteps, kindAt, openAt, normalAt) => {
        for (let line = 0; line <= nLines; line++) {
          let seg = null;
          for (let s = 0; s <= nSteps; s++) {
            const k = s < nSteps ? kindAt(line, s) : 0, nm = k === 1 ? normalAt(line, s) : [0, 0];
            if (seg && (k !== seg.kind || nm[0] !== seg.normal[0] || nm[1] !== seg.normal[1])) { out.push(seg); seg = null; }
            if (!k) continue;
            if (!seg) seg = { axis, line, s0: s, s1: s, kind: k, normal: nm, openings: [] };
            seg.s1 = s + 1;
            const op = openAt(line, s);
            if (op) { const t = op === 1 ? 'door' : 'window', last = seg.openings[seg.openings.length - 1]; if (last && last.type === t && last.s1 === s) last.s1 = s + 1; else seg.openings.push({ s0: s, s1: s + 1, type: t }); }
          }
        }
      };
      scan('v', W, H, (i, j) => this.v[j * (W + 1) + i], (i, j) => this.vOpen[j * (W + 1) + i], (i, j) => (this.room(i - 1, j) < 0 ? [-1, 0] : [1, 0]));
      scan('h', H, W, (j, i) => this.hz[j * W + i], (j, i) => this.hOpen[j * W + i], (j, i) => (this.room(i, j - 1) < 0 ? [0, -1] : [0, 1]));
      return out;
    }
    /* can an actor step between 4-neighbour local tiles (either may be outside the footprint)? */
    canStep(i0, j0, i1, j1) {
      const di = i1 - i0, dj = j1 - j0; if (Math.abs(di) + Math.abs(dj) !== 1) return false;
      const side = di === 1 ? 'e' : di === -1 ? 'w' : dj === 1 ? 's' : 'n';
      const inA = this.room(i0, j0) >= 0, inB = this.room(i1, j1) >= 0;
      if (!inA && !inB) return true;
      if (inB && this.solid[j1 * this.W + i1]) return false;
      const e = inA ? this.edge(i0, j0, side) : this.edge(i1, j1, { n: 's', s: 'n', e: 'w', w: 'e' }[side]);
      return !e || !e.kind || e.open === 1;
    }
    walkable(i, j) { const r = this.room(i, j); return r < 0 || !this.solid[j * this.W + i]; }
  }

  K.BuildingLayout = BuildingLayout;
})(typeof window !== 'undefined' ? window : globalThis);
