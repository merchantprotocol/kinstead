/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const { TILE, T } = K;
  const U = K.BuilderAppUtils;

  /* polyline wall (ruin) tool */
  class WallTool extends K.Tool {
    constructor(app) { super(app); this.pts = []; }
    snap(p) { return [U.round3(Math.round(p.x * 4) / 4), U.round3(Math.round(p.z * 4) / 4)]; }
    down(e, p) {
      if (!p) return;
      const q = this.snap(p);
      if (this.pts.length > 2 && Math.hypot(q[0] - this.pts[0][0], q[1] - this.pts[0][1]) < 0.4) { this.finish(true); return; }
      this.pts.push(q);
      this.hover(p);
      this.app.panel();
    }
    dbl() { this.finish(false); }
    hover(p) {
      this.app.overlay.poly(this.pts.concat(p ? [this.snap(p)] : []), false);
      this.app.overlay.brush(p, 0.15);
    }
    key(e) {
      if (e.key === 'Enter') { this.finish(false); return true; }
      if (e.key !== 'Backspace' || !this.pts.length) return false;
      this.pts.pop();
      this.hover(this.app.hoverP);
      this.app.panel();
      return true;
    }
    finish(closed) {
      const pts = this.pts.filter((p, k, a) => k === 0 || Math.hypot(p[0] - a[k - 1][0], p[1] - a[k - 1][1]) > 0.1);
      this.pts = [];
      this.app.overlay.poly([], false);
      if (pts.length < 2) { this.app.panel(); return; }
      const ui = this.app.ui;
      this.app.commitObjects(closed ? 'add wall loop' : 'add wall', (d) => {
        const o = { id: d.uid('w'), kind: 'wall', pts, closed, h: ui.wallH, ruin: ui.ruin, seed: (Math.random() * 99999) | 0, pillars: ui.pillars };
        d.objects.push(o);
        this.app.sel = o.id;
      });
      this.app.panel();
    }
    cancel() { this.pts = []; this.app.overlay.poly([], false); }
    options() {
      const count = this.pts.length ? ` <b>${this.pts.length} point(s)</b>` : '';
      return '<h2>Wall / ruin</h2><p class="help">Click to drop corner points; double-click or <kbd>Enter</kbd> to finish, '
        + 'click the first point to close a loop. <kbd>Backspace</kbd> removes the last point, <kbd>Esc</kbd> cancels.'
        + `${count}</p>${EditorWallControls.wallRows(this.app.ui)}`;
    }
    bind(root) { EditorWallControls.bindRows(root, this.app.ui, () => {}); }
  }

  /* the height / ruin / pillars rows shared by the wall and room tools and the wall inspector */
  class EditorWallControls {
    static wallRows(o) {
      const h = +(o.wallH ?? o.h ?? 2.4), ruin = +(o.ruin ?? 2);
      return `<div class="row"><span>Height</span><input type="range" min="0.5" max="6" step="0.1" value="${h}" data-w="h">`
        + `<span class="val">${h.toFixed(1)}</span></div>`
        + `<div class="row"><span>Ruin</span><input type="range" min="0" max="4" step="0.1" value="${ruin}" data-w="ruin">`
        + `<span class="val">${ruin.toFixed(1)}</span></div>`
        + `<div class="row"><span>Pillars</span><input type="checkbox" data-w="pillars" ${o.pillars !== false ? 'checked' : ''}></div>`;
    }
    static bindRows(root, target, done, live) {
      root.querySelectorAll('[data-w]').forEach((el) => {
        const k = el.dataset.w, key = k === 'h' && 'wallH' in target ? 'wallH' : k;
        const apply = () => {
          const v = el.type === 'checkbox' ? el.checked : +el.value;
          if (el.nextElementSibling) el.nextElementSibling.textContent = (+v).toFixed(1);
          if (live) live(k, v); else target[key] = v;
        };
        el.oninput = apply;
        el.onchange = () => { apply(); done(); };
      });
    }
  }

  /* drag out a ruined room: four walls, pillars, a door gap and a slate floor */
  class RoomTool extends K.Tool {
    snap(p) { return [Math.round(p.x / TILE) * TILE, Math.round(p.z / TILE) * TILE]; }
    down(e, p) { if (p) this.a = this.snap(p); }
    move(e, p) { this.hover(p); }
    hover(p) {
      this.app.overlay.brush(p, 0.15);
      if (!this.a || !p) return;
      const b = this.snap(p), a = this.a;
      this.app.overlay.poly([[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]], false);
    }
    up(e, p) {
      const a = this.a;
      this.a = null;
      this.app.overlay.poly([], false);
      if (!a || !p) return;
      const b = this.snap(p);
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
      if (x1 - x0 < 1.5 || z1 - z0 < 1.5) { this.app.toast('Drag out a room at least 3 × 3 tiles.'); return; }
      const doc = this.doc, td = this.paintFloor(x0, z0, x1, z1);
      if (td) this.app.renderer.tilesChanged(...td.box);
      const before = JSON.stringify(doc.objects), o = this.room(x0, z0, x1, z1);
      doc.objects.push(o);
      this.app.sel = o.id;
      this.app.pushOp({ label: 'add room', tiles: td, objs: [before, JSON.stringify(doc.objects)] });
      this.app.renderer.objectsChanged();
      this.app.panel();
    }
    paintFloor(x0, z0, x1, z1) {
      const doc = this.doc, stroke = new K.TileStroke(doc);
      if (!this.app.ui.floor) return stroke.finish();
      for (let j = Math.round(z0 / TILE); j < Math.round(z1 / TILE); j++) {
        for (let i = Math.round(x0 / TILE); i < Math.round(x1 / TILE); i++) if (doc.type(i, j) !== T.CHASM) stroke.set(i, j, T.SLATE, null);
      }
      return stroke.finish();
    }
    room(x0, z0, x1, z1) {
      const ui = this.app.ui, h = ui.wallH;
      return {
        id: this.doc.uid('w'), kind: 'wall', closed: true, pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
        h, hs: [h + 0.8, h - 0.3, Math.max(0.6, h - 1.4), h], ruin: ui.ruin, pillars: ui.pillars,
        seed: (Math.random() * 99999) | 0, gaps: [[2, 0.4, 0.62]],
      };
    }
    cancel() { this.a = null; this.app.overlay.poly([], false); }
    options() {
      const ui = this.app.ui;
      return '<h2>Ruined room</h2><p class="help">Drag a rectangle. You get four ruined walls (low front wall so the inside reads '
        + 'from the camera), corner pillars, a door gap and a slate floor.</p>'
        + `${EditorWallControls.wallRows(ui)}<div class="row"><span>Slate floor</span>`
        + `<input type="checkbox" data-k="floor" ${ui.floor ? 'checked' : ''}></div>`;
    }
    bind(root) {
      EditorWallControls.bindRows(root, this.app.ui, () => {});
      root.querySelector('[data-k=floor]').onchange = (e) => (this.app.ui.floor = e.target.checked);
    }
  }

  /* click one end, then the other: an arched bridge between them */
  class BridgeTool extends K.Tool {
    down(e, p) {
      if (!p) return;
      const q = [U.round3(Math.round(p.x * 4) / 4), U.round3(Math.round(p.z * 4) / 4)];
      if (!this.a) { this.a = q; this.app.panel(); return; }
      const a = this.a;
      this.a = null;
      this.app.overlay.poly([], false);
      if (Math.hypot(q[0] - a[0], q[1] - a[1]) < 1.5) { this.app.toast('Bridges need at least 1.5 units between ends.'); this.app.panel(); return; }
      this.app.commitObjects('add bridge', (d) => {
        const o = { id: d.uid('b'), kind: 'bridge', a, b: q, w: this.app.ui.bridgeW, seed: (Math.random() * 99999) | 0 };
        d.objects.push(o);
        this.app.sel = o.id;
      });
      this.app.panel();
    }
    hover(p) {
      this.app.overlay.brush(p, 0.2);
      if (this.a && p) this.app.overlay.poly([this.a, [p.x, p.z]], false, true);
    }
    cancel() { this.a = null; this.app.overlay.poly([], false); }
    options() {
      const ui = this.app.ui;
      const help = this.a ? '<b>Now click the far end.</b> Esc cancels.'
        : 'Click one end, then the other. Stand the ends on the cliff tops either side of a chasm; the deck arches between them, '
          + 'stone piers drop to the floor and rails get posts and snow caps.';
      return `<h2>Bridge</h2><p class="help">${help}</p>`
        + `<div class="row"><span>Width</span><input type="range" min="1" max="3" step="0.1" value="${ui.bridgeW}" data-k="bw">`
        + `<span class="val">${ui.bridgeW.toFixed(1)}</span></div>`;
    }
    bind(root) {
      const s = root.querySelector('[data-k=bw]');
      s.oninput = () => { this.app.ui.bridgeW = +s.value; s.nextElementSibling.textContent = (+s.value).toFixed(1); };
    }
  }

  Object.assign(K, { WallTool, RoomTool, BridgeTool, EditorWallControls });
})(typeof window !== 'undefined' ? window : globalThis);
