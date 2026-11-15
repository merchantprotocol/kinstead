/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const $ = (id) => document.getElementById(id);

  /* ---------- overlay (drawn crisp, after the post pipeline) ---------- */
  class EditorOverlay {
    constructor(app) {
      this.app = app; this.scene = new THREE.Scene();
      const lm = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false });
      this.ring = new THREE.LineLoop(new THREE.BufferGeometry(), lm(0xffffff, 0.9)); this.ring.frustumCulled = false;
      this.line = new THREE.Line(new THREE.BufferGeometry(), lm(0xffe08a)); this.line.frustumCulled = false;
      this.sel = new THREE.LineSegments(new THREE.BufferGeometry(), lm(0x7fd3ff)); this.sel.frustumCulled = false;
      this.hov = new THREE.LineSegments(new THREE.BufferGeometry(), lm(0xffffff, 0.55)); this.hov.frustumCulled = false;
      this.handles = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffe08a, size: 9, sizeAttenuation: false, depthTest: false })); this.handles.frustumCulled = false;
      this.rolesL = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false })); this.rolesL.frustumCulled = false;
      this.scene.add(this.ring, this.line, this.sel, this.hov, this.handles, this.rolesL);
    }
    /* coloured rings under character markers: red enemy, green friendly, gold merchant, blue player start */
    roles() {
      const doc = this.doc; if (!doc) return; const C = { enemy: [1, 0.42, 0.35], npc: [0.56, 0.88, 0.63], merchant: [1, 0.82, 0.48], player: [0.5, 0.8, 1] };
      const items = doc.objects.filter((o) => o.kind === 'prop' && PropBuilder.roleOf(o)), sig = JSON.stringify(items.map((o) => [o.x, o.z, o.role, o.type, o.s]));
      if (sig === this.roleSig) return; this.roleSig = sig;
      const pos = [], col = [];
      for (const o of items) {
        const c = C[PropBuilder.roleOf(o)] || [1, 1, 1], r = ((PropBuilder.PROPS[o.type] || {}).r || 0.4) * (o.s || 1) * 0.9, n = 20;
        for (let k = 0; k < n; k++) for (const q of [k, k + 1]) { const a = (q / n) * Math.PI * 2, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r; pos.push(x, doc.groundY(x, z) + 0.05, z); col.push(...c); }
      }
      this.rolesL.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.rolesL.geometry = g; this.rolesL.visible = pos.length > 0;
    }
    get doc() { return this.app.doc; }
    setPts(obj, pts) { obj.geometry.dispose(); obj.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); obj.visible = pts.length > 0; }
    circle(x, z, r, n = 48, lift = 0.06) { const out = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; out.push(px, this.doc.groundY(px, pz) + lift, pz); } return out; }
    brush(p, r) { if (!p || !r) { this.ring.visible = false; return; } this.setPts(this.ring, this.circle(p.x, p.z, r)); }
    poly(pts, closed, straight) {
      const out = [];
      for (let k = 0; k < pts.length; k++) {
        const [x, z] = pts[k]; out.push(x, this.doc.groundY(x, z) + 0.08, z);
        if (k + 1 < pts.length && !straight) { const [bx, bz] = pts[k + 1]; const L = Math.hypot(bx - x, bz - z), n = Math.ceil(L / 0.25); for (let q = 1; q < n; q++) { const t = q / n, px = x + (bx - x) * t, pz = z + (bz - z) * t; out.push(px, this.doc.groundY(px, pz) + 0.08, pz); } }
      }
      this.setPts(this.line, out);
    }
    outline(o) {
      const segs = [], push = (pts, loop) => { for (let k = 0; k + 1 < pts.length + (loop ? 1 : 0); k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; segs.push(...a, ...b); } };
      if (o.kind === 'building') { for (const r of K.Footprint.rects(o.footprint)) { const x=(o.x+r.x)*TILE,z=(o.z+r.z)*TILE,w=r.w*TILE,h=r.h*TILE,y=this.doc.groundY(x+.01,z+.01)+.12; push([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],true); } }
      else if (o.kind === 'prop') { const def = PropBuilder.PROPS[o.type] || { r: 0.4 }; const c = this.circle(o.x, o.z, def.r * (o.s || 1), 32, 0.08); const P = []; for (let k = 0; k < c.length; k += 3) P.push([c[k], c[k + 1], c[k + 2]]); push(P, true); }
      else if (o.kind === 'bridge') {
        const [ax, az] = o.a, [bx, bz] = o.b, L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * (o.w || 1.6) / 2, nz = (bx - ax) / L * (o.w || 1.6) / 2;
        const y0 = WorldDoc.deckY(this.doc, o, 0) + 0.1, y1 = WorldDoc.deckY(this.doc, o, 1) + 0.1, ym = WorldDoc.deckY(this.doc, o, 0.5) + 0.1;
        push([[ax + nx, y0, az + nz], [(ax + bx) / 2 + nx, ym, (az + bz) / 2 + nz], [bx + nx, y1, bz + nz], [bx - nx, y1, bz - nz], [(ax + bx) / 2 - nx, ym, (az + bz) / 2 - nz], [ax - nx, y0, az - nz]], true);
      } else if (o.kind === 'wall') {
        const P = WorldDoc.wallPts(o), out = [];
        for (let k = 0; k + 1 < P.length; k++) { const [x, z] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - x, bz - z), n = Math.max(1, Math.ceil(L / 0.3)); for (let q = 0; q <= n; q++) { const t = q / n, px = x + (bx - x) * t, pz = z + (bz - z) * t; out.push([px, this.doc.tileY(px, pz) + 0.12, pz]); } }
        push(out, false);
      }
      return segs;
    }
    selection() {
      const o = this.app.sel && this.doc.obj(this.app.sel);
      this.setPts(this.sel, o ? this.outline(o) : []);
      const hp = []; if (o) this.app.selection.handles(o).forEach(([x, z]) => hp.push(x, this.doc.groundY(x, z) + 0.12, z));
      this.setPts(this.handles, hp);
    }
    hoverObj(id) { if (id === this.hoverId) return; this.hoverId = id; const o = id && id !== this.app.sel && this.doc.obj(id); this.setPts(this.hov, o ? this.outline(o) : []); }
    clear() { [this.ring, this.line, this.sel, this.hov, this.handles, this.rolesL].forEach((m) => (m.visible = false)); this.hoverId = null; this.roleSig = null; }
  }


K.EditorOverlay = EditorOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
