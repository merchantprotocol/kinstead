/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const { CH, TILE } = K;

  /* the chunk grid of the open world: which chunk owns what, what needs repainting or rebuilding, and the
     time-budgeted work loop that does it (nearest chunks first). State lives on the WorldRenderer (R). */
  class WorldChunks {
    constructor(R) { this.R = R; }
    get doc() { return this.R.doc; }
    reset(doc) {
      const R = this.R;
      R.chunks.forEach((c) => c.dispose());
      R.chunks = [];
      R.pool.cancelAll();
      R.ncx = Math.ceil(doc.w / CH);
      R.ncz = Math.ceil(doc.h / CH);
    }
    build() {
      const R = this.R;
      for (let cj = 0; cj < R.ncz; cj++) {
        for (let ci = 0; ci < R.ncx; ci++) {
          const c = new K.Chunk(R, ci, cj);
          c.queuePaint(c.i0, c.j0, c.i1, c.j1);
          R.chunks.push(c);
        }
      }
    }
    chunkAt(i, j) {
      const R = this.R, ci = Math.floor(i / CH), cj = Math.floor(j / CH);
      if (ci < 0 || cj < 0 || ci >= R.ncx || cj >= R.ncz) return null;
      return R.chunks[cj * R.ncx + ci];
    }
    anchorChunk(o) {
      const doc = this.doc;
      const p = o.kind === 'building' ? [o.x * TILE, o.z * TILE] : o.kind === 'prop' ? [o.x, o.z] : o.kind === 'bridge' ? o.a : o.pts[0];
      const [i, j] = doc.tileOf(p[0], p[1]);
      return this.chunkAt(Math.max(0, Math.min(doc.w - 1, i)), Math.max(0, Math.min(doc.h - 1, j)));
    }
    static objBox(o) {
      if (o.kind === 'building') { const b = K.BuildingGeo.worldBox(o); return [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1]; }
      if (o.kind === 'prop') return [o.x - 1, o.z - 1, o.x + 1, o.z + 1];
      const points = o.kind === 'bridge' ? [o.a, o.b] : o.pts;
      let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
      points.forEach(([x, z]) => { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); });
      return [a - 1.5, b - 1.5, c + 1.5, d + 1.5];
    }
    /* tiles changed in [i0,i1) x [j0,j1): repaint (with a 1-tile apron), rebuild terrain + props that sit there */
    tilesChanged(i0, j0, i1, j1) {
      const R = this.R, a0 = i0 - 1, b0 = j0 - 1, a1 = i1 + 1, b1 = j1 + 1;
      for (const c of R.chunks) {
        if (c.i1 <= a0 || c.i0 >= a1 || c.j1 <= b0 || c.j0 >= b1) continue;
        c.queuePaint(a0, b0, a1, b1);
        c.geoDirty = true;
      }
      const x0 = a0 * TILE, z0 = b0 * TILE, x1 = a1 * TILE, z1 = b1 * TILE;
      let buildingsDirty = false;
      for (const o of this.doc.objects) {
        const bb = WorldChunks.objBox(o);
        if (bb[2] < x0 || bb[0] > x1 || bb[3] < z0 || bb[1] > z1) continue;
        if (o.kind === 'building') { buildingsDirty = true; continue; }    // a building's base height follows the terrain under it
        const c = this.anchorChunk(o);
        if (c) c.propsDirty = true;
      }
      if (buildingsDirty) this.syncBuildings(true);
    }
    objectsChanged(force) {
      const R = this.R, per = new Map();
      for (const o of this.doc.objects) {
        const c = this.anchorChunk(o);
        if (!c) continue;
        if (!per.has(c)) per.set(c, []);
        per.get(c).push(o);
      }
      R.chunkObjs = per;
      this.syncBuildings(force);
      for (const c of R.chunks) {
        const sig = JSON.stringify((per.get(c) || []).filter((o) => o.kind !== 'building'));
        if (force || sig !== c.sig) { c.sig = sig; c.propsDirty = true; }
      }
    }
    /* rebuild building meshes when (and only when) a building's JSON changed; force after terrain edits under them */
    syncBuildings(force) {
      const R = this.R, doc = this.doc, list = doc.buildings();
      const sig = JSON.stringify(list.map((b) => [b, doc.objects.indexOf(b) >= 0]));
      if (!force && sig === R.buildingSig) return false;
      R.buildingSig = sig;
      const set = R.buildings, inside = set.inside && set.inside.spec.id, cam = set.inside && set.inside.camera;
      set.setBuildings(list, doc);
      doc.floorAt = list.length ? (i, j) => set.floorY(i, j) : null;
      const again = inside && set.get(inside);
      if (again) { set.inside = again; again.setInterior(true, { camera: cam, snap: true }); }
      if (R.onBuildings) R.onBuildings();
      return true;
    }
    /* per-object visual state (e.g. a depleted ore vein) -> rebuild that object's chunk */
    setPropState(id, state) {
      const R = this.R;
      if (state) R.propState.set(id, state); else R.propState.delete(id);
      const o = this.doc && this.doc.obj(id), c = o && this.anchorChunk(o);
      if (c) c.propsDirty = true;
    }
    clearPropStates() {
      const ids = [...this.R.propState.keys()];
      this.R.propState.clear();
      ids.forEach((id) => this.setPropState(id, null));
    }
    distance(c) {
      const tg = this.R.target;
      return Math.hypot((c.i0 + CH / 2) * TILE - tg.x, (c.j0 + CH / 2) * TILE - tg.z);
    }
    nearestFirst(chunks) { return chunks.slice().sort((a, b) => this.distance(a) - this.distance(b)); }
    /* do queued rebuild work within a time budget; nearest chunks first */
    work(budgetMs = 10, sync = false) {
      const R = this.R, t0 = performance.now(), order = this.nearestFirst(R.chunks), late = () => performance.now() - t0;
      let busy = false;
      for (const c of order) if (c.geoDirty) { c.buildTerrain(); busy = true; }
      for (const c of order) {
        if (!c.propsDirty) continue;
        c.buildProps(R.chunkObjs.get(c) || []);
        busy = true;
        if (late() > budgetMs * 2) break;
      }
      for (const c of order) {
        while (c.nDirty && late() < budgetMs) { if (c.paintStep(sync ? null : R.pool)) busy = true; else break; }
        c.flushTex();
        if (late() >= budgetMs) break;
      }
      R.pending = R.chunks.reduce((s, c) => s + (c.nDirty ? 1 : 0) + (c.inflight ? 1 : 0) + (c.propsDirty ? 1 : 0) + (c.geoDirty ? 1 : 0), 0);
      return busy;
    }
    /* keep the paint workers fed between frames (nearest chunks first) */
    pumpPaint() {
      const R = this.R;
      if (!R.pool.ok) return;
      for (const c of this.nearestFirst(R.chunks.filter((x) => x.nDirty))) {
        while (c.nDirty && R.pool.idle) if (!c.paintStep(R.pool)) break;
      }
    }
    finishAll() {
      const R = this.R;
      // bands still on worker threads are re-painted here (their late results are discarded by the version check)
      for (const c of R.chunks) {
        for (const b of c.flying) c.queuePaint(...b.rect);
        c.flying.clear();
        c.inflight = 0;
      }
      let n = 0;
      do { this.work(1e9, true); } while (R.chunks.some((c) => c.nDirty || c.propsDirty || c.geoDirty) && ++n < 50);
      R.chunks.forEach((c) => c.flushTex());
    }
    /* resolves once every chunk is painted and built (workers included) */
    ready(timeoutMs = 60000) {
      const R = this.R, t0 = performance.now();
      return new Promise((resolve) => {
        const tick = () => {
          this.work(30);
          R.chunks.forEach((c) => c.flushTex());
          if (R.pending === 0 || performance.now() - t0 > timeoutMs) resolve(performance.now() - t0);
          else setTimeout(tick, 15);
        };
        tick();
      });
    }
  }
  K.WorldChunks = WorldChunks;
})(typeof window !== 'undefined' ? window : globalThis);
