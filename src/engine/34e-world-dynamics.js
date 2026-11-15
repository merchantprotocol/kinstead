/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  /* the moving parts of a world: character sprite markers, fires, banners, embers and the light sources they give off.
     State (dyn, actors, fires, anim, lightSrc, embers) lives on the WorldRenderer (R) because play mode reads it. */
  class WorldDynamics {
    constructor(R) { this.R = R; }
    get doc() { return this.R.doc; }
    removeAll() { for (const id of [...this.R.dyn.keys()]) this.remove(id); }
    remove(id) {
      const R = this.R, d = R.dyn.get(id);
      if (!d) return;
      if (d.actor) this.disposeActor(d.actor);
      d.objs.forEach((m) => this.disposeMesh(m));
      R.dyn.delete(id);
      R.anim.delete(id);
      R.fires.delete(id);
      R.actors.delete(id);
    }
    disposeActor(a) {
      this.R.scene.remove(a.group);
      a.mesh.geometry.dispose();
      [a.map, a.gmap, a.mat, a.glowMat, a.mesh.customDepthMaterial].forEach((x) => x.dispose());
    }
    disposeMesh(m) {
      this.R.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (!m.material) return;
      [].concat(m.material).forEach((mm) => {
        if (mm.map && mm.map !== this.R.fireTex && mm.map.isClone) mm.map.dispose();
        mm.dispose();
      });
    }
    /** add, rebuild or drop dynamic parts to match the document (the renderer places them afterwards) */
    sync() {
      const R = this.R, seen = new Set();
      for (const o of this.doc.objects) {
        if (o.kind !== 'prop') continue;
        const def = K.PropBuilder.PROPS[o.type];
        if (!def || !(def.dyn || def.sprite)) continue;
        seen.add(o.id);
        const key = JSON.stringify([o.type, o.s, o.rot, o.flip, o.seed, o.hero, o.look]);
        const cur = R.dyn.get(o.id);
        if (cur && cur.key === key) continue;
        if (cur) this.remove(o.id);
        this.add(o, def, key);
      }
      for (const id of [...R.dyn.keys()]) if (!seen.has(id)) this.remove(id);
    }
    add(o, def, key) {
      const d = { key, objs: [], o, def }, dy = def.dyn || {};
      if (def.sprite) this.addActor(d, o);
      if (dy.fire) this.addFire(d, o, dy.fire);
      if (dy.banner) this.addBanner(d, o);
      this.R.dyn.set(o.id, d);
    }
    addActor(d, o) {
      const R = this.R, s = o.s || 1;
      const a = new K.SpriteActor(R.lib.get(K.PropBuilder.spriteOf(o)), R.bank, { x: 0, y: 0, z: 0, phase: (o.seed % 7) * 0.6, flip: !!o.flip });
      a.group.scale.setScalar(s);
      a.shadow.scale.setScalar(s);
      R.scene.add(a.group, a.shadow);
      d.objs.push(a.shadow);
      d.actor = a;
      R.actors.set(o.id, a);
    }
    addFire(d, o, [fx, fy, fz, fs]) {
      const R = this.R, s = o.s || 1, t = R.fireTex.clone();
      t.isClone = true;
      t.needsUpdate = true;
      t.repeat.set(0.25, 1);
      const material = new THREE.MeshBasicMaterial({
        map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.6, 2.2, 1.9),
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * fs * s, 0.93 * fs * s), material);
      m.geometry.translate(0, 0.93 * fs * s / 2 - 0.05, 0);
      m.renderOrder = 6;
      R.scene.add(m);
      d.objs.push(m);
      R.fires.set(o.id, { mesh: m, tex: t, ph: (o.seed % 13) * 0.31, off: [fx * s, fy * s, fz * s] });
    }
    addBanner(d, o) {
      const R = this.R, banner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), R.mats.banner), ph = (o.seed % 11) * 0.5;
      banner.geometry.translate(0, -0.5, 0);
      banner.castShadow = true;
      banner.scale.setScalar(o.s || 1);
      R.scene.add(banner);
      d.objs.push(banner);
      d.banner = banner;
      R.anim.set(o.id, (t) => {
        banner.rotation.y = (o.rot || 0) + Math.sin(t * 0.9 + ph) * 0.18;
        banner.rotation.x = Math.sin(t * 1.3 + ph) * 0.05;
      });
    }
    place() {
      const R = this.R, doc = this.doc, embers = [];
      R.lightSrc = [];
      for (const [id, d] of R.dyn) {
        const o = doc.obj(id);
        if (!o) continue;
        d.o = o;
        this.placeOne(id, d, o, embers);
      }
      this.setEmbers(embers);
    }
    placeOne(id, d, o, embers) {
      const R = this.R, y = this.doc.groundY(o.x, o.z), s = o.s || 1, rot = o.rot || 0, c = Math.cos(rot), sn = Math.sin(rot);
      const loc = (lx, ly, lz) => [o.x + (lx * c + lz * sn) * s, y + ly * s, o.z + (-lx * sn + lz * c) * s];
      if (d.actor) { d.actor.group.position.set(o.x, y, o.z); d.actor.shadow.position.set(o.x, y + 0.015, o.z); }
      const fire = R.fires.get(id);
      if (fire) fire.mesh.position.set(o.x + fire.off[0], y + fire.off[1], o.z + fire.off[2]);
      if (d.banner) d.banner.position.set(...loc(0.27, 2.27, 0));
      const dy = d.def.dyn || {};
      if (dy.light) {
        const [x, ly, z] = loc(dy.light[0], dy.light[1], dy.light[2]), k = dy.light[3];
        R.lightSrc.push({ x, y: ly, z, color: 0xff8a3c, base: 14 * k * s, dist: 9 * k * Math.sqrt(s), ph: (o.seed % 17) * 0.37, fire: true });
      }
      if (dy.embers) embers.push(loc(dy.embers[0], dy.embers[1], dy.embers[2]));
      if (dy.staff) R.lightSrc.push({ x: o.x - 0.25 * s, y: y + 1.4 * s, z: o.z + 0.2 * s, color: 0x8fe2ff, base: 3.5, dist: 4.5, ph: 0, staff: true });
    }
    setEmbers(points) {
      const R = this.R;
      if (R.embers) {
        R.scene.remove(R.embers.points);
        R.embers.points.geometry.dispose();
        R.embers.points.material.dispose();
        R.embers = null;
      }
      if (!points.length) return;
      R.embers = new K.EmberField(points);
      R.scene.add(R.embers.points);
    }
    /* the static sprite markers placed in the editor (hidden while play mode spawns live actors) */
    setActorsVisible(visible) { for (const a of this.R.actors.values()) { a.group.visible = visible; a.shadow.visible = visible; } }
    update(t, yaw, pitch, viewH) {
      const R = this.R, tilt = -Math.max(0, pitch - 0.8) * 0.9;
      for (const a of R.actors.values()) { a.update(t, yaw); a.group.rotation.order = 'YXZ'; a.group.rotation.x = tilt; }
      for (const f of R.fires.values()) { f.tex.offset.x = (Math.floor(t * 9 + f.ph) % 4) * 0.25; f.mesh.rotation.y = yaw; }
      for (const fn of R.anim.values()) fn(t);
      if (R.embers) R.embers.update(t, viewH);
    }
  }
  K.WorldDynamics = WorldDynamics;
})(typeof window !== 'undefined' ? window : globalThis);
