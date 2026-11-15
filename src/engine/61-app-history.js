/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* Bounded undo/redo and tile-stroke snapshots for the world editor. */
  class History {
    constructor(limit = 200) { this.undoS = []; this.redoS = []; this.limit = limit; }
    push(op) { this.undoS.push(op); if (this.undoS.length > this.limit) this.undoS.shift(); this.redoS.length = 0; }
    canUndo() { return this.undoS.length > 0; }
    canRedo() { return this.redoS.length > 0; }
    undo() { const op = this.undoS.pop(); if (op) this.redoS.push(op); return op; }
    redo() { const op = this.redoS.pop(); if (op) this.undoS.push(op); return op; }
    clear() { this.undoS.length = 0; this.redoS.length = 0; }
  }

  /* records the first-touch value of every tile a stroke changes */
  class TileStroke {
    constructor(doc) { this.doc = doc; this.old = new Map(); this.box = [1e9, 1e9, -1e9, -1e9]; }
    set(i, j, t, hq) {
      const d = this.doc; if (!d.inside(i, j)) return false;
      const k = d.idx(i, j), ot = d.terrain[k], oh = d.height[k];
      const nt = t == null ? ot : t, nh = hq == null ? oh : clamp(Math.round(hq), -128, 127);
      if (nt === ot && nh === oh) return false;
      if (!this.old.has(k)) this.old.set(k, [ot, oh]);
      d.terrain[k] = nt; d.height[k] = nh;
      const b = this.box; b[0] = Math.min(b[0], i); b[1] = Math.min(b[1], j); b[2] = Math.max(b[2], i + 1); b[3] = Math.max(b[3], j + 1);
      return true;
    }
    touched(k) { return this.old.has(k); }
    finish() {
      if (!this.old.size) return null;
      const n = this.old.size, idx = new Int32Array(n), ot = new Uint8Array(n), oh = new Int8Array(n), nt = new Uint8Array(n), nh = new Int8Array(n);
      let q = 0; for (const [k, [a, b]] of this.old) { idx[q] = k; ot[q] = a; oh[q] = b; nt[q] = this.doc.terrain[k]; nh[q] = this.doc.height[k]; q++; }
      return { idx, ot, oh, nt, nh, box: this.box.slice() };
    }
    static apply(doc, td, which) {
      const t = which === 'old' ? td.ot : td.nt, h = which === 'old' ? td.oh : td.nh;
      for (let q = 0; q < td.idx.length; q++) { doc.terrain[td.idx[q]] = t[q]; doc.height[td.idx[q]] = h[q]; }
    }
  }

  Object.assign(K, { History, TileStroke });
})(typeof window !== 'undefined' ? window : globalThis);
