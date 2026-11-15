/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const ROLE_COLORS = { enemy: [1, 0.42, 0.35], npc: [0.56, 0.88, 0.63], merchant: [1, 0.82, 0.48], player: [0.5, 0.8, 1] };

  /* ---------- overlay (drawn crisp, after the post pipeline) ---------- */
  class EditorOverlay {
    constructor(app) {
      this.app = app;
      this.scene = new THREE.Scene();
      this.ring = this.track(new THREE.LineLoop(new THREE.BufferGeometry(), this.lineMaterial(0xffffff, 0.9)));
      this.line = this.track(new THREE.Line(new THREE.BufferGeometry(), this.lineMaterial(0xffe08a)));
      this.sel = this.track(new THREE.LineSegments(new THREE.BufferGeometry(), this.lineMaterial(0x7fd3ff)));
      this.hov = this.track(new THREE.LineSegments(new THREE.BufferGeometry(), this.lineMaterial(0xffffff, 0.55)));
      const handleMaterial = new THREE.PointsMaterial({ color: 0xffe08a, size: 9, sizeAttenuation: false, depthTest: false });
      this.handles = this.track(new THREE.Points(new THREE.BufferGeometry(), handleMaterial));
      const roleMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false });
      this.rolesL = this.track(new THREE.LineSegments(new THREE.BufferGeometry(), roleMaterial));
    }
    lineMaterial(color, opacity = 1) {
      return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    }
    track(object) {
      object.frustumCulled = false;
      this.scene.add(object);
      return object;
    }
    get doc() { return this.app.doc; }
    /* coloured rings under character markers: red enemy, green friendly, gold merchant, blue player start */
    roles() {
      const doc = this.doc;
      if (!doc) return;
      const PB = K.PropBuilder, items = doc.objects.filter((o) => o.kind === 'prop' && PB.roleOf(o));
      const sig = JSON.stringify(items.map((o) => [o.x, o.z, o.role, o.type, o.s]));
      if (sig === this.roleSig) return;
      this.roleSig = sig;
      const pos = [], col = [];
      for (const o of items) this.roleRing(o, pos, col);
      this.rolesL.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.rolesL.geometry = g;
      this.rolesL.visible = pos.length > 0;
    }
    roleRing(o, pos, col) {
      const PB = K.PropBuilder, doc = this.doc, n = 20;
      const c = ROLE_COLORS[PB.roleOf(o)] || [1, 1, 1], r = ((PB.PROPS[o.type] || {}).r || 0.4) * (o.s || 1) * 0.9;
      for (let k = 0; k < n; k++) {
        for (const q of [k, k + 1]) {
          const a = (q / n) * Math.PI * 2, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
          pos.push(x, doc.groundY(x, z) + 0.05, z);
          col.push(...c);
        }
      }
    }
    setPts(obj, pts) {
      obj.geometry.dispose();
      obj.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      obj.visible = pts.length > 0;
    }
    circle(x, z, r, n = 48, lift = 0.06) {
      const out = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        out.push(px, this.doc.groundY(px, pz) + lift, pz);
      }
      return out;
    }
    brush(p, r) {
      if (!p || !r) { this.ring.visible = false; return; }
      this.setPts(this.ring, this.circle(p.x, p.z, r));
    }
    /* a ground-hugging polyline (straight: corners only) */
    poly(pts, closed, straight) {
      const out = [], lift = (x, z) => out.push(x, this.doc.groundY(x, z) + 0.08, z);
      for (let k = 0; k < pts.length; k++) {
        const [x, z] = pts[k];
        lift(x, z);
        if (k + 1 >= pts.length || straight) continue;
        const [bx, bz] = pts[k + 1], n = Math.ceil(Math.hypot(bx - x, bz - z) / 0.25);
        for (let q = 1; q < n; q++) lift(x + (bx - x) * q / n, z + (bz - z) * q / n);
      }
      this.setPts(this.line, out);
    }
    outline(o) {
      const segs = [];
      const push = (pts, loop) => {
        for (let k = 0; k + 1 < pts.length + (loop ? 1 : 0); k++) segs.push(...pts[k], ...pts[(k + 1) % pts.length]);
      };
      if (o.kind === 'building') this.buildingOutline(o).forEach((rect) => push(rect, true));
      else if (o.kind === 'prop') push(this.propOutline(o), true);
      else if (o.kind === 'bridge') push(this.bridgeOutline(o), true);
      else if (o.kind === 'wall') push(this.wallOutline(o), false);
      return segs;
    }
    buildingOutline(o) {
      const T = K.TILE;
      return K.Footprint.rects(o.footprint).map((r) => {
        const x = (o.x + r.x) * T, z = (o.z + r.z) * T, w = r.w * T, h = r.h * T, y = this.doc.groundY(x + 0.01, z + 0.01) + 0.12;
        return [[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]];
      });
    }
    propOutline(o) {
      const def = K.PropBuilder.PROPS[o.type] || { r: 0.4 }, c = this.circle(o.x, o.z, def.r * (o.s || 1), 32, 0.08), out = [];
      for (let k = 0; k < c.length; k += 3) out.push([c[k], c[k + 1], c[k + 2]]);
      return out;
    }
    bridgeOutline(o) {
      const WD = K.WorldDoc, [ax, az] = o.a, [bx, bz] = o.b, L = Math.hypot(bx - ax, bz - az) || 1, half = (o.w || 1.6) / 2;
      const nx = -(bz - az) / L * half, nz = (bx - ax) / L * half, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const y0 = WD.deckY(this.doc, o, 0) + 0.1, y1 = WD.deckY(this.doc, o, 1) + 0.1, ym = WD.deckY(this.doc, o, 0.5) + 0.1;
      return [
        [ax + nx, y0, az + nz], [mx + nx, ym, mz + nz], [bx + nx, y1, bz + nz],
        [bx - nx, y1, bz - nz], [mx - nx, ym, mz - nz], [ax - nx, y0, az - nz],
      ];
    }
    wallOutline(o) {
      const P = K.WorldDoc.wallPts(o), out = [];
      for (let k = 0; k + 1 < P.length; k++) {
        const [x, z] = P[k], [bx, bz] = P[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - x, bz - z) / 0.3));
        for (let q = 0; q <= n; q++) {
          const px = x + (bx - x) * q / n, pz = z + (bz - z) * q / n;
          out.push([px, this.doc.tileY(px, pz) + 0.12, pz]);
        }
      }
      return out;
    }
    selection() {
      const o = this.app.sel && this.doc.obj(this.app.sel), hp = [];
      this.setPts(this.sel, o ? this.outline(o) : []);
      if (o) this.app.selection.handles(o).forEach(([x, z]) => hp.push(x, this.doc.groundY(x, z) + 0.12, z));
      this.setPts(this.handles, hp);
    }
    hoverObj(id) {
      if (id === this.hoverId) return;
      this.hoverId = id;
      const o = id && id !== this.app.sel && this.doc.obj(id);
      this.setPts(this.hov, o ? this.outline(o) : []);
    }
    clear() {
      [this.ring, this.line, this.sel, this.hov, this.handles, this.rolesL].forEach((m) => (m.visible = false));
      this.hoverId = null;
      this.roleSig = null;
    }
  }
  K.EditorOverlay = EditorOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
