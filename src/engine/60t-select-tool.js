/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;

  /* select, drag-move, drag handles, Alt+click wall door gaps; dragging empty ground pans */
  class SelectTool extends K.Tool {
    cursor() { return 'default'; }
    down(e, p, sx, sy) {
      if (!p) return;
      const app = this.app, doc = this.doc, cur = app.sel && doc.obj(app.sel);
      // handles of the current selection first
      if (cur) {
        const h = app.selection.handleAt(cur, sx, sy);
        if (h != null) { this.drag = { id: cur.id, handle: h, before: JSON.stringify(doc.objects), p0: p }; return; }
        if (e.altKey && cur.kind === 'wall') { this.toggleGap(cur, p); return; }
      }
      const hit = app.selection.pick(p);
      app.select(hit ? hit.id : null);
      if (hit) this.drag = { id: hit.id, handle: null, before: JSON.stringify(doc.objects), p0: p, orig: JSON.parse(JSON.stringify(hit)) };
      else this.pan = { sx, sy, tx: app.rig.goal.tx, tz: app.rig.goal.tz };
    }
    move(e, p, sx, sy) {
      const app = this.app;
      if (this.pan) { app.panBy(sx - this.pan.sx, sy - this.pan.sy, this.pan); return; }
      if (!this.drag || !p) { this.hover(p); return; }
      const o = this.doc.obj(this.drag.id);
      if (!o) return;
      const snap = (v) => (e.shiftKey ? v : Math.round(v * 4) / 4);
      if (this.drag.handle != null) this.dragHandle(o, [U.round3(snap(p.x)), U.round3(snap(p.z))]);
      else this.dragObject(o, p, snap);
      this.drag.moved = true;
      app.renderer.objectsChanged();
      app.overlay.selection();
    }
    dragHandle(o, q) {
      if (o.kind === 'bridge') o[this.drag.handle === 0 ? 'a' : 'b'] = q;
      else if (o.kind === 'wall') o.pts[this.drag.handle] = q;
    }
    dragObject(o, p, snap) {
      const dx = p.x - this.drag.p0.x, dz = p.z - this.drag.p0.z, O = this.drag.orig;
      if (o.kind === 'prop') { o.x = U.round3(O.x + dx); o.z = U.round3(O.z + dz); return; }
      if (o.kind === 'building') { this.moveBuilding(o, O, dx, dz); return; }
      const sdx = snap(dx), sdz = snap(dz), shift = ([x, z]) => [U.round3(x + sdx), U.round3(z + sdz)];
      if (o.kind === 'bridge') { o.a = shift(O.a); o.b = shift(O.b); } else o.pts = O.pts.map(shift);
    }
    moveBuilding(o, original, dx, dz) {
      const edit = new K.BuildingEdit(), moved = edit.moved(original, Math.round(dx / K.TILE), Math.round(dz / K.TILE));
      if (!edit.placementProblems(this.doc, moved).length) Object.assign(o, moved);
    }
    up() {
      if (this.pan) { this.pan = null; return; }
      if (this.drag && this.drag.moved) this.app.pushOp({ label: 'move', objs: [this.drag.before, JSON.stringify(this.doc.objects)] });
      this.drag = null;
      this.app.panel();
    }
    cancel() {
      if (this.drag && this.drag.moved) { this.doc.objects = JSON.parse(this.drag.before); this.app.renderer.objectsChanged(); }
      this.drag = null;
      this.pan = null;
    }
    hover(p) {
      this.app.overlay.brush(null);
      const hit = p && this.app.selection.pick(p);
      this.app.overlay.hoverObj(hit ? hit.id : null);
    }
    /* the wall segment point nearest p, if within reach */
    nearestOnWall(o, p) {
      const P = K.WorldDoc.wallPts(o);
      let best = null;
      for (let k = 0; k < P.length - 1; k++) {
        const [ax, az] = P[k], [bx, bz] = P[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = U.clamp(((p.x - ax) * dx + (p.z - az) * dz) / L2, 0, 1), d = Math.hypot(p.x - ax - dx * t, p.z - az - dz * t);
        if (!best || d < best.d) best = { k, t, d, L: Math.sqrt(L2) };
      }
      return best && best.d <= 0.8 ? best : null;
    }
    toggleGap(o, p) {
      const best = this.nearestOnWall(o, p);
      if (!best) return;
      this.app.commitObjects('toggle door', (d) => {
        const w = d.obj(o.id);
        w.gaps = w.gaps || [];
        const hit = w.gaps.findIndex((g) => g[0] === best.k && best.t >= g[1] - 0.02 && best.t <= g[2] + 0.02);
        if (hit >= 0) { w.gaps.splice(hit, 1); return; }
        const half = 0.5 / best.L;
        w.gaps.push([best.k, U.round3(U.clamp(best.t - half, 0, 1)), U.round3(U.clamp(best.t + half, 0, 1))]);
      });
    }
    key(e) {
      const app = this.app, o = app.sel && this.doc.obj(app.sel);
      if (!o) return false;
      if (e.key === 'q' || e.key === 'e') { app.selection.rotateSel((e.key === 'e' ? 1 : -1) * Math.PI / 12); return true; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { app.selection.duplicateSel(); return true; }
      return false;
    }
    options() { return this.app.inspector.render(); }
    bind(root) { this.app.inspector.bind(root); }
  }
  K.SelectTool = SelectTool;
})(typeof window !== 'undefined' ? window : globalThis);
