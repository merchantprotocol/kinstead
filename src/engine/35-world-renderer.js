/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { CH, PPU } = K;
  const { TILE, HQ, T, WorldDoc, PropBuilder } = K;
  class WorldRenderer extends K.WorldRendererCore {
    ready(timeoutMs = 60000) {
      const t0 = performance.now();
      return new Promise((res) => { const tick = () => { this.work(30); this.chunks.forEach((c) => c.flushTex()); if (this.pending === 0 || performance.now() - t0 > timeoutMs) res(performance.now() - t0); else setTimeout(tick, 15); }; tick(); });
    }
    /* ---------- dynamic parts ---------- */
    removeDyn(id) {
      const d = this.dyn.get(id); if (!d) return;
      if (d.actor) { const a = d.actor; this.scene.remove(a.group); a.mesh.geometry.dispose(); a.map.dispose(); a.gmap.dispose(); a.mat.dispose(); a.glowMat.dispose(); a.mesh.customDepthMaterial.dispose(); }
      d.objs.forEach((m) => { this.scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) { [].concat(m.material).forEach((mm) => { if (mm.map && mm.map !== this.fireTex && mm.map.isClone) mm.map.dispose(); mm.dispose(); }); } });
      this.dyn.delete(id); this.anim.delete(id); this.fires.delete(id); this.actors.delete(id);
    }
    syncDynamics() {
      const seen = new Set();
      for (const o of this.doc.objects) {
        if (o.kind !== 'prop') continue; const def = PropBuilder.PROPS[o.type]; if (!def || !(def.dyn || def.sprite)) continue;
        seen.add(o.id);
        const key = JSON.stringify([o.type, o.s, o.rot, o.flip, o.seed, o.hero, o.look]);
        const cur = this.dyn.get(o.id);
        if (cur && cur.key === key) continue;
        if (cur) this.removeDyn(o.id);
        this.addDyn(o, def, key);
      }
      for (const id of [...this.dyn.keys()]) if (!seen.has(id)) this.removeDyn(id);
      this.placeDynamics();
    }
    addDyn(o, def, key) {
      const d = { key, objs: [], o }; const S = this.scene, s = o.s || 1;
      if (def.sprite) {
        const a = new K.SpriteActor(this.lib.get(PropBuilder.spriteOf(o)), this.bank, { x: 0, y: 0, z: 0, phase: (o.seed % 7) * 0.6, flip: !!o.flip });
        a.group.scale.setScalar(s); a.shadow.scale.setScalar(s);
        S.add(a.group, a.shadow); d.objs.push(a.shadow); d.actor = a; this.actors.set(o.id, a);
      }
      const dy = def.dyn || {};
      if (dy.fire) {
        const [fx, fy, fz, fs] = dy.fire, t = this.fireTex.clone(); t.isClone = true; t.needsUpdate = true; t.repeat.set(0.25, 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * fs * s, 0.93 * fs * s), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.6, 2.2, 1.9) }));
        m.geometry.translate(0, 0.93 * fs * s / 2 - 0.05, 0); m.renderOrder = 6; S.add(m); d.objs.push(m);
        this.fires.set(o.id, { mesh: m, tex: t, ph: (o.seed % 13) * 0.31, off: [fx * s, fy * s, fz * s] });
      }
      if (dy.banner) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), this.mats.banner); ban.geometry.translate(0, -0.5, 0); ban.castShadow = true;
        ban.scale.setScalar(s); S.add(ban); d.objs.push(ban); d.banner = ban;
        const ph = (o.seed % 11) * 0.5;
        this.anim.set(o.id, (t) => { ban.rotation.y = (o.rot || 0) + Math.sin(t * 0.9 + ph) * 0.18; ban.rotation.x = Math.sin(t * 1.3 + ph) * 0.05; });
      }
      d.def = def; this.dyn.set(o.id, d);
    }
    placeDynamics() {
      const doc = this.doc; this.lightSrc = []; const emb = [];
      for (const [id, d] of this.dyn) {
        const o = doc.obj(id); if (!o) continue; d.o = o;
        const y = doc.groundY(o.x, o.z), s = o.s || 1, rot = o.rot || 0, c = Math.cos(rot), sn = Math.sin(rot);
        const loc = (lx, ly, lz) => [o.x + (lx * c + lz * sn) * s, y + ly * s, o.z + (-lx * sn + lz * c) * s];
        if (d.actor) { d.actor.group.position.set(o.x, y, o.z); d.actor.shadow.position.set(o.x, y + 0.015, o.z); }
        const f = this.fires.get(id); if (f) { const [fx, fy, fz] = f.off; f.mesh.position.set(o.x + fx, y + fy, o.z + fz); }
        if (d.banner) { const p = loc(0.27, 2.27, 0); d.banner.position.set(p[0], p[1], p[2]); }
        const dy = d.def.dyn || {};
        if (dy.light) { const p = loc(dy.light[0], dy.light[1], dy.light[2]); this.lightSrc.push({ x: p[0], y: p[1], z: p[2], color: 0xff8a3c, base: 14 * dy.light[3] * s, dist: 9 * dy.light[3] * Math.sqrt(s), ph: (o.seed % 17) * 0.37, fire: true }); }
        if (dy.embers) emb.push(loc(dy.embers[0], dy.embers[1], dy.embers[2]));
        if (dy.staff) this.lightSrc.push({ x: o.x - 0.25 * s, y: y + 1.4 * s, z: o.z + 0.2 * s, color: 0x8fe2ff, base: 3.5, dist: 4.5, ph: 0, staff: true });
      }
      if (this.embers) { this.scene.remove(this.embers.points); this.embers.points.geometry.dispose(); this.embers.points.material.dispose(); this.embers = null; }
      if (emb.length) { this.embers = new K.EmberField(emb); this.scene.add(this.embers.points); }
    }
    update(t, camera, viewH, target, dist, pitch = 0.7) {
      this.target.copy(target);
      const yaw = this.cameraYaw(camera);
      const tilt = -Math.max(0, pitch - 0.8) * 0.9;
      for (const a of this.actors.values()) { a.update(t, yaw); a.group.rotation.order = 'YXZ'; a.group.rotation.x = tilt; }
      for (const f of this.fires.values()) { f.tex.offset.x = (Math.floor(t * 9 + f.ph) % 4) * 0.25; f.mesh.rotation.y = yaw; }
      for (const fn of this.anim.values()) fn(t);
      // light pool: nearest sources to the view target
      const src = this.lightSrc; for (const s of src) s.d = (s.x - target.x) ** 2 + (s.z - target.z) ** 2;
      src.sort((a, b) => a.d - b.d);
      this.lightPool.forEach((l, i) => {
        const s = src[i];
        if (!s) { l.intensity = 0; l.position.set(0, -60, 0); return; }
        l.position.set(s.x, s.y, s.z); l.color.setHex(s.color); l.distance = s.dist; l.decay = s.staff ? 1.5 : 1.4;
        l.intensity = s.staff ? 3.2 + Math.sin(t * 2.2) * 0.8 : s.base * (0.82 + 0.12 * Math.sin(t * 13 + s.ph) + 0.08 * Math.sin(t * 29 + s.ph * 3));
      });
      // sun + shadow frustum follow the view so big worlds keep crisp shadows
      const span = Math.max(14, dist * 1.25), sc = this.sun.shadow.camera;
      const tx = Math.round(target.x * 4) / 4, tz = Math.round(target.z * 4) / 4;
      this.sun.target.position.set(tx, 0, tz); this.sun.position.set(tx + this.sunOff.x, this.sunOff.y, tz + this.sunOff.z);
      if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span * 0.85; sc.bottom = -span * 0.85; sc.far = 90; sc.updateProjectionMatrix(); }
      this.scene.fog.near = dist + 9; this.scene.fog.far = dist + 49;
      this.sparkUni.uTime.value = t;
      this.fogLayers.forEach((f, i) => { f.t.offset.set(i * 0.37 + t * f.sp * 0.36, i * 0.21 + t * f.sp * 0.96); });
      this.snow.update(t, viewH, target); if (this.embers) this.embers.update(t, viewH);
    }
    cameraYaw(camera) { const d = new V3(); camera.getWorldDirection(d); return Math.atan2(-d.x, -d.z); }
  }
  K.WorldRenderer = WorldRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
