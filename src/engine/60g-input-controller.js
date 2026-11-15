/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const TOOL_KEYS = { v: 'select', t: 'paint', h: 'height', c: 'carve', w: 'wall', r: 'room', b: 'building', j: 'bridge', u: 'furniture', p: 'prop' };

  /* mouse and keyboard on the editor canvas: camera drags, tool strokes, play-mode clicks and shortcuts */
  class InputController {
    constructor(app) { this.app = app; this.cam = null; this.space = false; }
    get el() { return this.app.renderer3.domElement; }
    bind() {
      this.bindPointer();
      window.addEventListener('keydown', (e) => this.keyDown(e));
      window.addEventListener('keyup', (e) => { if (e.key === ' ') this.space = false; });
    }
    pos(e) {
      const r = this.el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    bindPointer() {
      const el = this.el, app = this.app;
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('pointerdown', (e) => this.pointerDown(e));
      el.addEventListener('pointermove', (e) => this.pointerMove(e));
      el.addEventListener('pointerup', (e) => this.pointerUp(e));
      el.addEventListener('pointercancel', () => { this.cam = null; app.play.down = null; app.tool.cancel(); });
      el.addEventListener('dblclick', () => { if (!app.play.active) app.tool.dbl(); });
      el.addEventListener('pointerleave', () => this.pointerLeave());
      el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    }
    pointerDown(e) {
      const app = this.app, el = this.el;
      el.focus();
      const [sx, sy] = this.pos(e);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
      if (e.button === 2 || e.button === 1 || this.space) { this.startCameraDrag(e, sx, sy); return; }
      if (e.button !== 0) return;
      if (app.play.active) { app.play.pointerDown(e, sx, sy); return; }
      const p = app.pickGround(sx, sy);
      app.hoverP = p;
      app.tool.down(e, p, sx, sy);
    }
    startCameraDrag(e, sx, sy) {
      const pan = e.button === 1 || this.space || (e.button === 2 && e.shiftKey), goal = this.app.rig.goal;
      this.cam = { x: sx, y: sy, sx, sy, btn: e.button, moved: false, pan, tx: goal.tx, tz: goal.tz };
    }
    pointerMove(e) {
      const app = this.app, [sx, sy] = this.pos(e);
      if (this.cam) { this.dragCamera(sx, sy); return; }
      if (app.play.active) {
        if (e.buttons & 1) app.play.dragMove(sx, sy);
        else if (!e.buttons) app.play.pointerMove(e, sx, sy);
        return;
      }
      const p = app.pickGround(sx, sy);
      app.hoverP = p;
      app.tool.move(e, p, sx, sy);
      app.editorUI.showHover(p);
    }
    dragCamera(sx, sy) {
      const cam = this.cam, rig = this.app.rig, dx = sx - cam.x, dy = sy - cam.y;
      if (Math.hypot(sx - cam.sx, sy - cam.sy) > 5) cam.moved = true;
      if (cam.pan) { this.app.panBy(dx, dy, cam); return; }
      rig.goal.yaw -= dx * 0.005;
      rig.goal.pitch += dy * 0.004;
      rig.clamp();
      cam.x = sx;
      cam.y = sy;
    }
    pointerUp(e) {
      const app = this.app;
      if (this.cam) {
        const c = this.cam;
        this.cam = null;
        if (app.play.active && c.btn === 2 && !c.moved && !c.pan) app.play.rightClick(c.sx, c.sy);
        return;
      }
      const [sx, sy] = this.pos(e);
      if (app.play.active) { app.play.pointerUp(e, sx, sy); return; }
      app.tool.up(e, app.pickGround(sx, sy), sx, sy);
    }
    pointerLeave() {
      const app = this.app;
      if (app.play.active) { app.play.ui.tip(null); return; }
      app.overlay.brush(null);
      app.overlay.hoverObj(null);
    }
    wheel(e) {
      e.preventDefault();
      this.app.rig.goal.dist *= Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0012));
      this.app.rig.clamp();
    }
    keyDown(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const app = this.app, k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      const open = document.querySelector('.mdl.show');
      if (open) { if (e.key === 'Escape') app.editorUI.closeModal(open); return; }
      if (mod && k === 's') { e.preventDefault(); app.storage.quickSave(); return; }
      if (app.play.active) { this.playKey(e, k, mod); return; }
      if (k === 'g' && !mod && !e.altKey) { app.setPlay(true); return; }
      if (e.key === ' ') { this.space = true; e.preventDefault(); return; }
      if (this.historyKey(e, k, mod)) return;
      if (app.tool.key(e)) { e.preventDefault(); return; }
      if (this.editorKey(e, k, mod)) return;
      if (mod || e.altKey) return;
      if (TOOL_KEYS[k]) app.setTool(TOOL_KEYS[k]);
    }
    playKey(e, k, mod) {
      if (k === 'g' && !mod) { this.app.setPlay(false); return; }
      if (this.app.play.key(e)) e.preventDefault();
      if (e.key === 'Tab') e.preventDefault();
    }
    historyKey(e, k, mod) {
      if (!mod || (k !== 'z' && k !== 'y')) return false;
      e.preventDefault();
      if (k === 'z' && !e.shiftKey) this.app.edits.undo();
      else this.app.edits.redo();
      return true;
    }
    editorKey(e, k, mod) {
      const app = this.app;
      if (e.key === 'Delete' || (e.key === 'Backspace' && app.toolName === 'select')) {
        if (app.sel) { e.preventDefault(); app.selection.deleteSel(); }
        return true;
      }
      if (e.key === 'Escape') { app.tool.cancel(); app.select(null); app.panel(); return true; }
      if (e.key === 'Tab') { e.preventDefault(); app.setView(app.view === 'top' ? 'orbit' : 'top'); return true; }
      if (e.key === 'Home') { app.session.frameAll(false); return true; }
      if (k === 'f' && !mod) { this.focusTarget(); return true; }
      if (e.key.startsWith('Arrow')) { this.arrowPan(e.key); e.preventDefault(); return true; }
      return false;
    }
    focusTarget() {
      const app = this.app, o = app.sel && app.doc.obj(app.sel);
      const p = o ? this.centreOf(o) : app.hoverP ? [app.hoverP.x, app.hoverP.z] : null;
      if (p) app.rig.set({ tx: p[0], tz: p[1], dist: Math.min(app.rig.goal.dist, 14) });
    }
    centreOf(o) {
      const T = K.TILE;
      if (o.kind === 'building') return [(o.x + o.footprint.w / 2) * T, (o.z + o.footprint.h / 2) * T];
      if (o.kind === 'prop') return [o.x, o.z];
      if (o.kind === 'bridge') return [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
      return o.pts[0];
    }
    arrowPan(key) {
      const rig = this.app.rig, goal = rig.goal, step = goal.dist * 0.06, c = Math.cos(goal.yaw), s = Math.sin(goal.yaw);
      const fx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0, fz = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
      goal.tx += (fx * c + fz * s) * step;
      goal.tz += (-fx * s + fz * c) * step;
      rig.clamp();
    }
  }
  K.InputController = InputController;
})(typeof window !== 'undefined' ? window : globalThis);
