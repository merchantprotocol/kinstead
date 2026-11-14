/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · actor views. Play mode only talks to the ActorView interface below, so the placeholder
   sprite markers can be swapped for final character art (more frames per state, a different
   renderer) by writing another class with the same methods.

   ActorView interface
     setPosition(x, y, z)       feet position in world units
     setFacing(dx, dz)          world-space direction the actor faces (left/right is derived from the camera)
     setState(name)             'idle' | 'walk' | 'run' | 'attack' | 'action' | 'hurt' | 'dead'
     setHighlight(color|null)   hover / target highlight
     flash(kind)                one-shot tint: 'hit' | 'heal'
     setVisible(bool)
     update(t, dt, camYaw, tilt)
     screenRect(camera, w, h)   {x0,y0,x1,y1} in CSS pixels (for picking and name plates)
     setSprite(id)              change outfit / art
     setTint(hex)               outfit colour (multiplies the sprite; 0xffffff = none)
     dispose()
*/
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const STATES = ['idle', 'walk', 'run', 'attack', 'action', 'hurt', 'dead'];
  const BASE_EMISSIVE = new THREE.Color(0.2, 0.22, 0.27);

  class SpriteActorView {
    constructor(renderer, spriteId, opts = {}) {
      this.R = renderer; this.scale = opts.scale || 1; this.phase = opts.phase || 0;
      this.pos = new V3(); this.face = 1; this.dir = new V3(1, 0, 0); this.state = 'idle'; this.stateT = 0;
      this.flashT = 0; this.flashKind = null; this.hl = null; this.visible = true; this.deadT = 0; this.tint = new THREE.Color(1, 1, 1);
      this.build(spriteId);
    }
    build(spriteId) {
      this.spriteId = spriteId; this.native = SpriteActorView.NATIVE[spriteId] || 1;
      const sp = this.R.lib.get(spriteId);
      this.a = new K.SpriteActor(sp, this.R.bank, { x: 0, y: 0, z: 0, phase: this.phase });
      this.h = (sp.h / sp.ppu) * this.scale; this.w = (sp.w / sp.ppu) * this.scale;
      this.a.group.scale.setScalar(this.scale); this.a.shadow.scale.setScalar(this.scale);
      this.R.scene.add(this.a.group, this.a.shadow);
      this.a.mat.color.copy(this.tint);
    }
    setTint(hex) { this.tint.set(hex == null ? 0xffffff : hex); this.a.mat.color.copy(this.tint); }
    setSprite(id) { if (id === this.spriteId) return; const vis = this.visible; this.disposeSprite(); this.build(id); this.setVisible(vis); }
    setPosition(x, y, z) { this.pos.set(x, y, z); }
    setFacing(dx, dz) { const L = Math.hypot(dx, dz); if (L > 1e-4) this.dir.set(dx / L, 0, dz / L); }
    setState(s) { if (!STATES.includes(s)) s = 'idle'; if (s === this.state && s !== 'attack' && s !== 'hurt') return; this.prev = this.state; this.state = s; this.stateT = 0; }
    setHighlight(c) { this.hl = c || null; }
    flash(kind = 'hit') { this.flashKind = kind; this.flashT = 0.22; }
    setVisible(v) { this.visible = v; this.a.group.visible = v; this.a.shadow.visible = v; }
    update(t, dt, camYaw, tilt) {
      this.stateT += dt; const a = this.a, g = a.group, st = this.state, T = this.stateT;
      // facing: compare the move direction with the camera's right vector
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw), side = this.dir.x * rx + this.dir.z * rz;
      if (Math.abs(side) > 0.05) this.face = side >= 0 ? 1 : -1;
      let fps = 6, bob = 0, lean = 0, lunge = 0, squash = 1, sink = 0;
      if (st === 'walk') { fps = 9; bob = Math.abs(Math.sin(t * 9 + this.phase)) * 0.045; lean = Math.sin(t * 9 + this.phase) * 0.035; }
      else if (st === 'run') { fps = 14; bob = Math.abs(Math.sin(t * 15 + this.phase)) * 0.08; lean = 0.13; }
      else if (st === 'attack') {
        fps = 12; const p = Math.min(1, T / 0.42);
        if (p < 0.35) { lean = -0.16 * (p / 0.35); lunge = -0.05 * (p / 0.35); }
        else if (p < 0.6) { const k = (p - 0.35) / 0.25; lean = -0.16 + 0.42 * k; lunge = -0.05 + 0.33 * k; squash = 1 - 0.06 * k; }
        else { const k = (p - 0.6) / 0.4; lean = 0.26 * (1 - k); lunge = 0.28 * (1 - k); squash = 0.94 + 0.06 * k; }
        if (T > 0.42) this.setState(this.prev === 'run' || this.prev === 'walk' ? 'idle' : this.prev || 'idle');
      } else if (st === 'action') {
        fps = 8; const c = (T % 0.75) / 0.75;
        if (c < 0.55) lean = -0.18 * (c / 0.55); else { const k = (c - 0.55) / 0.45; lean = -0.18 + 0.4 * Math.sin(k * Math.PI); }
        bob = c > 0.55 && c < 0.7 ? 0.03 : 0;
      } else if (st === 'hurt') { lean = -0.14 * Math.max(0, 1 - T / 0.25); lunge = -0.08 * Math.max(0, 1 - T / 0.25); if (T > 0.28) this.setState(this.prev && this.prev !== 'hurt' && this.prev !== 'attack' ? this.prev : 'idle'); }
      else if (st === 'dead') { const k = Math.min(1, T / 0.45); lean = -1.45 * k * k; sink = 0.12 * k; fps = 0; }
      if (fps) a.setFrame(Math.floor(t * fps + this.phase * 4));
      const sx = this.scale * this.face * this.native;
      g.scale.set(sx, this.scale * squash, this.scale);
      g.rotation.order = 'YXZ'; g.rotation.y = camYaw; g.rotation.x = tilt; g.rotation.z = -lean * this.face;
      g.position.set(this.pos.x + this.dir.x * lunge, this.pos.y + bob - sink, this.pos.z + this.dir.z * lunge);
      a.shadow.position.set(this.pos.x, this.pos.y + 0.015, this.pos.z);
      // tint: hit flash > highlight > normal
      const m = a.mat;
      if (this.flashT > 0) { this.flashT -= dt; if (this.flashKind === 'heal') m.emissive.setRGB(0.3, 1.1, 0.45); else m.emissive.setRGB(1.6, 0.28, 0.22); }
      else if (this.hl) m.emissive.set(this.hl);
      else m.emissive.copy(BASE_EMISSIVE).multiply(this.tint);
      if (st === 'dead') { this.deadT += dt; a.shadow.visible = this.visible && this.deadT < 0.4; }
      else this.deadT = 0;
    }
    /* projected box of the sprite plane */
    screenRect(camera, W, H) {
      const v = new V3(), p = this.pos, hw = this.w * 0.42, out = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, front: true };
      const pts = [[p.x, p.y, p.z], [p.x, p.y + this.h * 0.95, p.z]];
      for (const [x, y, z] of pts) {
        v.set(x, y, z).project(camera); if (v.z > 1) out.front = false;
        const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
        out.x0 = Math.min(out.x0, sx); out.x1 = Math.max(out.x1, sx); out.y0 = Math.min(out.y0, sy); out.y1 = Math.max(out.y1, sy);
      }
      // width from the projected distance of a horizontal offset at the feet
      const r = new V3().setFromMatrixColumn(camera.matrixWorld, 0); r.y = 0; r.normalize();
      v.set(p.x + r.x * hw, p.y, p.z + r.z * hw).project(camera); const sx2 = (v.x + 1) / 2 * W, cx = (out.x0 + out.x1) / 2, half = Math.max(10, Math.abs(sx2 - cx));
      out.x0 = cx - half; out.x1 = cx + half; return out;
    }
    disposeSprite() {
      const a = this.a; this.R.scene.remove(a.group, a.shadow);
      a.mesh.geometry.dispose(); a.map.dispose(); a.gmap.dispose(); a.mat.dispose(); a.glowMat.dispose(); a.mesh.customDepthMaterial.dispose();
      a.shadow.geometry.dispose(); if (a.shadow.material.map) a.shadow.material.map.dispose(); a.shadow.material.dispose();
    }
    dispose() { this.disposeSprite(); }
  }

  /* which way each sprite is drawn facing (1 = right, -1 = left); monsters are drawn facing left */
  SpriteActorView.NATIVE = { ghoulA: -1, ghoulB: -1, troll: -1 };

  /* a flat pixel-art billboard (loot bags and other little world items) built from an icon */
  class IconBillboard {
    constructor(renderer, iconId, size = 0.42) {
      this.R = renderer; const cv = K.Icons.base(iconId);
      this.tex = new THREE.CanvasTexture(cv); this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.colorSpace = THREE.SRGBColorSpace;
      this.mat = new THREE.MeshLambertMaterial({ map: this.tex, alphaTest: 0.5, emissive: new THREE.Color(0.25, 0.25, 0.3), emissiveMap: this.tex });
      const geo = new THREE.PlaneGeometry(size, size); geo.translate(0, size / 2, 0);
      const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 0.42, 0.91);
      this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.castShadow = true; this.size = size; this.pos = new V3();
      renderer.scene.add(this.mesh);
    }
    setPosition(x, y, z) { this.pos.set(x, y, z); }
    setHighlight(c) { this.mat.emissive.set(c || 0x40404c); }
    update(t, dt, camYaw) { this.mesh.rotation.order = 'YXZ'; this.mesh.rotation.y = camYaw; this.mesh.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(t * 3)) * 0.05, this.pos.z); }
    dispose() { this.R.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); this.tex.dispose(); }
  }

  Object.assign(K, { SpriteActorView, IconBillboard, ACTOR_STATES: STATES });
})(typeof window !== 'undefined' ? window : globalThis);
