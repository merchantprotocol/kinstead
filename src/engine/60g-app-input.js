/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  class BuilderAppInput extends K.BuilderAppUI {
    bindInput() {
      const el = this.renderer3.domElement; let cam = null, space = false;
      const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('pointerdown', (e) => {
        el.focus(); const [sx, sy] = pos(e); try { el.setPointerCapture(e.pointerId); } catch (_) {}
        if (e.button === 2 || e.button === 1 || space) { cam = { x: sx, y: sy, sx, sy, btn: e.button, moved: false, pan: e.button === 1 || space || (e.button === 2 && e.shiftKey), tx: this.rig.goal.tx, tz: this.rig.goal.tz }; return; }
        if (e.button !== 0) return;
        if (this.play.active) { this.play.pointerDown(e, sx, sy); return; }
        const p = this.pickGround(sx, sy); this.hoverP = p; this.tool.down(e, p, sx, sy);
      });
      el.addEventListener('pointermove', (e) => {
        const [sx, sy] = pos(e);
        if (cam) {
          const dx = sx - cam.x, dy = sy - cam.y;
          if (Math.hypot(sx - cam.sx, sy - cam.sy) > 5) cam.moved = true;
          if (cam.pan) this.panBy(dx, dy, cam); else { this.rig.goal.yaw -= dx * 0.005; this.rig.goal.pitch += dy * 0.004; this.rig.clamp(); cam.x = sx; cam.y = sy; }
          return;
        }
        if (this.play.active) { if (e.buttons & 1) this.play.dragMove(sx, sy); else if (!e.buttons) this.play.pointerMove(e, sx, sy); return; }
        const p = this.pickGround(sx, sy); this.hoverP = p; this.tool.move(e, p, sx, sy); this.showHover(p);
      });
      const end = (e) => { if (cam) { const c = cam; cam = null; if (this.play.active && c.btn === 2 && !c.moved && !c.pan) this.play.rightClick(c.sx, c.sy); return; } const [sx, sy] = pos(e); if (this.play.active) { this.play.pointerUp(e, sx, sy); return; } this.tool.up(e, this.pickGround(sx, sy), sx, sy); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', () => { cam = null; this.play.down = null; this.tool.cancel(); });
      el.addEventListener('dblclick', () => { if (!this.play.active) this.tool.dbl(); });
      el.addEventListener('pointerleave', () => { if (this.play.active) { this.play.ui.tip(null); return; } this.overlay.brush(null); this.overlay.hoverObj(null); });
      el.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.goal.dist *= Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0012)); this.rig.clamp(); }, { passive: false });
      window.addEventListener('keydown', (e) => {
        const tag = e.target.tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        const open = document.querySelector('.mdl.show');
        if (open) { if (e.key === 'Escape') { if (open.id === 'askModal' && this.askDone) this.askDone(false); else open.classList.remove('show'); } return; }
        if (mod && k === 's') { e.preventDefault(); this.quickSave(); return; }
        if (this.play.active) {
          if (k === 'g' && !mod) { this.setPlay(false); return; }
          if (this.play.key(e)) e.preventDefault();
          if (e.key === 'Tab') e.preventDefault();
          return;
        }
        if (k === 'g' && !mod && !e.altKey) { this.setPlay(true); return; }
        if (e.key === ' ') { space = true; e.preventDefault(); return; }
        if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
        if (mod && k === 'y') { e.preventDefault(); this.redo(); return; }
        if (this.tool.key(e)) { e.preventDefault(); return; }
        if (e.key === 'Delete' || (e.key === 'Backspace' && this.toolName === 'select')) { if (this.sel) { e.preventDefault(); this.deleteSel(); } return; }
        if (e.key === 'Escape') { this.tool.cancel(); this.select(null); this.panel(); return; }
        if (e.key === 'Tab') { e.preventDefault(); this.setView(this.view === 'top' ? 'orbit' : 'top'); return; }
        if (e.key === 'Home') { this.frameAll(false); return; }
        if (k === 'f' && !mod) { const o = this.sel && this.doc.obj(this.sel), p = o ? (o.kind === 'building' ? [(o.x+o.footprint.w/2)*TILE,(o.z+o.footprint.h/2)*TILE] : o.kind === 'prop' ? [o.x, o.z] : o.kind === 'bridge' ? [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2] : o.pts[0]) : this.hoverP ? [this.hoverP.x, this.hoverP.z] : null; if (p) this.rig.set({ tx: p[0], tz: p[1], dist: Math.min(this.rig.goal.dist, 14) }); return; }
        if (e.key.startsWith('Arrow')) { const s = this.rig.goal.dist * 0.06, c = Math.cos(this.rig.goal.yaw), sn = Math.sin(this.rig.goal.yaw), fx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, fz = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; this.rig.goal.tx += (fx * c + fz * sn) * s; this.rig.goal.tz += (-fx * sn + fz * c) * s; this.rig.clamp(); e.preventDefault(); return; }
        if (mod || e.altKey) return;
        const map = { v: 'select', t: 'paint', h: 'height', c: 'carve', w: 'wall', r: 'room', b: 'building', j: 'bridge', u: 'furniture', p: 'prop' }; if (map[k]) this.setTool(map[k]);
      });
      window.addEventListener('keyup', (e) => { if (e.key === ' ') space = false; });
    }
    panBy(dx, dy, from) {
      const g = this.rig.goal, s = g.dist * 0.0016 * (this.view === 'top' ? 1.4 : 1), c = Math.cos(g.yaw), sn = Math.sin(g.yaw);
      g.tx = from.tx - (dx * c + dy * sn) * s; g.tz = from.tz - (-dx * sn + dy * c) * s / (this.view === 'top' ? 1 : Math.max(0.5, Math.sin(g.pitch))); this.rig.clamp();
    }
    /* ray-march the tile heightfield (and bridge decks) under the cursor */
    pickGround(sx, sy) {
      const r = this.renderer3.domElement.getBoundingClientRect(), doc = this.doc; if (!doc) return null;
      const ndc = new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
      const o = ray.ray.origin, d = ray.ray.direction; let prev = null;
      for (let t = 0; t < 400; t += 0.05) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y < -30) break;
        const inside = x >= 0 && z >= 0 && x < doc.wu && z < doc.hu;
        if (inside && y <= doc.groundY(x, z)) {
          // refine between prev and here
          let a = prev == null ? t : prev, b = t; for (let q = 0; q < 8; q++) { const m = (a + b) / 2; const mx = o.x + d.x * m, my = o.y + d.y * m, mz = o.z + d.z * m; if (my <= doc.groundY(mx, mz)) b = m; else a = m; }
          const px = o.x + d.x * b, pz = o.z + d.z * b; return { x: px, z: pz, y: doc.groundY(px, pz) };
        }
        prev = t; if (t > 40) t += 0.05;
      }
      // fall back to the y=0 plane (lets you aim outside the world while dragging)
      if (d.y < 0) { const t = -o.y / d.y, x = o.x + d.x * t, z = o.z + d.z * t; if (x >= 0 && z >= 0 && x < doc.wu && z < doc.hu) return { x, z, y: 0 }; }
      return null;
    }
    showHover(p) {
      if (!p) { $('sHover').textContent = '—'; return; }
      const [i, j] = this.doc.tileOf(p.x, p.z), t = TERRAINS[this.doc.type(i, j)];
      $('sHover').innerHTML = `tile <b>${i}, ${j}</b> · ${t ? t.name : '?'} · height <b>${this.doc.hy(i, j)}</b>`;
    }
  }
  K.BuilderAppInput = BuilderAppInput;
})(typeof window !== 'undefined' ? window : globalThis);
