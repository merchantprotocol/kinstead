/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const U = K.BuilderAppUtils;

  /* what is selected, hit-testing objects and handles, and the rotate / duplicate / delete edits on the selection */
  class SelectionController {
    constructor(app) { this.app = app; }
    get doc() { return this.app.doc; }
    get selected() { return this.app.sel && this.doc.obj(this.app.sel); }
    select(id) {
      const app = this.app;
      app.sel = id;
      app.overlay.selection();
      app.overlay.hoverObj(null);
      if (app.toolName === 'select') app.panel();
    }
    pick(p) {
      let best = null, bestDistance = 1e9;
      for (const o of this.doc.objects) {
        const d = this.distanceTo(o, p);
        if (d < 0 && d < bestDistance + (o.kind === 'prop' ? 0.3 : 0)) { bestDistance = d; best = o; }
      }
      return best;
    }
    distanceTo(o, p) {
      if (o.kind === 'prop') {
        const def = K.PropBuilder.PROPS[o.type] || { r: 0.4 };
        const d = Math.hypot(o.x - p.x, o.z - p.z) - def.r * (o.s || 1) - 0.1;
        return def.sprite ? d - 0.2 : d;
      }
      if (o.kind === 'bridge') {
        const l = K.WorldDoc.bridgeLocal(o, p.x, p.z);
        return (l.s >= 0 && l.s <= l.L ? Math.abs(l.n) - (o.w || 1.6) / 2 : 9) + 0.15;
      }
      if (o.kind === 'building') return K.BuildingGeo.contains(o, ...this.doc.tileOf(p.x, p.z)) ? -0.5 : 9;
      const points = K.WorldDoc.wallPts(o);
      let d = 9;
      for (let k = 0; k + 1 < points.length; k++) d = Math.min(d, U.segmentDistance(p.x, p.z, points[k], points[k + 1]));
      return d - 0.35;
    }
    handles(o) {
      if (o.kind === 'bridge') return [o.a, o.b];
      return o.kind === 'wall' ? o.pts : [];
    }
    handleAt(o, sx, sy) {
      const handles = this.handles(o), v = new THREE.Vector3();
      const rect = this.app.renderer3.domElement.getBoundingClientRect();
      for (let k = 0; k < handles.length; k++) {
        const [x, z] = handles[k];
        v.set(x, this.doc.groundY(x, z) + 0.12, z).project(this.app.camera);
        const px = (v.x + 1) / 2 * rect.width, py = (1 - v.y) / 2 * rect.height;
        if (Math.hypot(px - sx, py - sy) < 9) return k;
      }
      return null;
    }
    rotateSel(da) {
      this.app.commitObjects('rotate', (d) => {
        const o = d.obj(this.app.sel);
        if (!o) return;
        if (o.kind === 'building') { this.rotateBuilding(d, o, da); return; }
        if (o.kind === 'prop') { o.rot = U.round3((o.rot || 0) + da); return; }
        const rotated = this.rotatePoints(o.kind === 'bridge' ? [o.a, o.b] : o.pts, da);
        if (o.kind === 'bridge') { o.a = rotated[0]; o.b = rotated[1]; } else o.pts = rotated;
      });
    }
    rotateBuilding(doc, o, da) {
      const edit = new K.BuildingEdit(), turned = edit.rotate(o, da > 0 ? 1 : -1);
      if (!edit.placementProblems(doc, turned).length) Object.assign(o, turned);
    }
    rotatePoints(points, da) {
      const cx = points.reduce((s, p) => s + p[0], 0) / points.length, cz = points.reduce((s, p) => s + p[1], 0) / points.length;
      const c = Math.cos(da), s = Math.sin(da);
      return points.map(([x, z]) => [U.round3(cx + (x - cx) * c - (z - cz) * s), U.round3(cz + (x - cx) * s + (z - cz) * c)]);
    }
    duplicateSel() {
      const o = this.selected;
      if (!o) return;
      this.app.commitObjects('duplicate', (d) => {
        const copy = JSON.parse(JSON.stringify(o));
        copy.id = d.uid(o.kind[0]);
        copy.seed = (Math.random() * 99999) | 0;
        if (!this.offsetCopy(d, copy)) { this.app.toast('No room to duplicate here.'); return; }
        d.objects.push(copy);
        this.app.sel = copy.id;
      });
      this.app.panel();
    }
    offsetCopy(doc, c) {
      if (c.kind === 'building') {
        c.x += c.footprint.w + 1;
        return !new K.BuildingEdit().placementProblems(doc, c).length;
      }
      if (c.kind === 'prop') { c.x = U.round3(c.x + 1); c.z = U.round3(c.z + 1); }
      else if (c.kind === 'bridge') { c.a = [c.a[0] + 1, c.a[1] + 1]; c.b = [c.b[0] + 1, c.b[1] + 1]; }
      else c.pts = c.pts.map(([x, z]) => [x + 1, z + 1]);
      return true;
    }
    deleteSel() {
      const app = this.app;
      if (!app.sel) return;
      const o = this.selected, name = o ? U.describe(o) : 'object';
      app.commitObjects('delete ' + name, (d) => { d.objects = d.objects.filter((x) => x.id !== app.sel); });
      app.sel = null;
      app.overlay.selection();
      app.panel();
    }
  }
  K.SelectionController = SelectionController;
})(typeof window !== 'undefined' ? window : globalThis);
