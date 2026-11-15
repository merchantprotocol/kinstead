/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const Tool = K.Tool;

  /* polyline wall (ruin) tool */
  class WallTool extends K.Tool {
    constructor(app) { super(app); this.pts = []; }
    snap(p) { return [r3(Math.round(p.x * 4) / 4), r3(Math.round(p.z * 4) / 4)]; }
    down(e, p) {
      if (!p) return;
      const q = this.snap(p);
      if (this.pts.length > 2 && Math.hypot(q[0] - this.pts[0][0], q[1] - this.pts[0][1]) < 0.4) { this.finish(true); return; }
      this.pts.push(q); this.hover(p); this.app.panel();
    }
    dbl() { this.finish(false); }
    hover(p) { this.app.overlay.poly(this.pts.concat(p ? [this.snap(p)] : []), false); this.app.overlay.brush(p, 0.15); }
    key(e) {
      if (e.key === 'Enter') { this.finish(false); return true; }
      if (e.key === 'Backspace' && this.pts.length) { this.pts.pop(); this.hover(this.app.hoverP); this.app.panel(); return true; }
      return false;
    }
    finish(closed) {
      const pts = this.pts.filter((p, k, a) => k === 0 || Math.hypot(p[0] - a[k - 1][0], p[1] - a[k - 1][1]) > 0.1);
      this.pts = []; this.app.overlay.poly([], false);
      if (pts.length < 2) { this.app.panel(); return; }
      const ui = this.app.ui;
      this.app.commitObjects(closed ? 'add wall loop' : 'add wall', (d) => {
        const o = { id: d.uid('w'), kind: 'wall', pts, closed, h: ui.wallH, ruin: ui.ruin, seed: (Math.random() * 99999) | 0, pillars: ui.pillars };
        d.objects.push(o); this.app.sel = o.id;
      });
      this.app.panel();
    }
    cancel() { this.pts = []; this.app.overlay.poly([], false); }
    options() {
      const ui = this.app.ui;
      return `<h2>Wall / ruin</h2><p class="help">Click to drop corner points; double-click or <kbd>Enter</kbd> to finish, click the first point to close a loop. <kbd>Backspace</kbd> removes the last point, <kbd>Esc</kbd> cancels.${this.pts.length ? ` <b>${this.pts.length} point(s)</b>` : ''}</p>${EditorWallControls.wallRows(ui)}`;
    }
    bind(root) { EditorWallControls.bindRows(root, this.app.ui, () => {}); }
  }
  class EditorWallControls {
    static wallRows(o, prefix = '') { return `<div class="row"><span>Height</span><input type="range" min="0.5" max="6" step="0.1" value="${o.wallH ?? o.h ?? 2.4}" data-w="h"><span class="val">${(+(o.wallH ?? o.h ?? 2.4)).toFixed(1)}</span></div>
    <div class="row"><span>Ruin</span><input type="range" min="0" max="4" step="0.1" value="${o.ruin ?? 2}" data-w="ruin"><span class="val">${(+(o.ruin ?? 2)).toFixed(1)}</span></div>
    <div class="row"><span>Pillars</span><input type="checkbox" data-w="pillars" ${o.pillars !== false ? 'checked' : ''}></div>`; }
    static bindRows(root, target, done, live) {
    root.querySelectorAll('[data-w]').forEach((el) => {
      const k = el.dataset.w, key = k === 'h' && 'wallH' in target ? 'wallH' : k;
      const f = () => { const v = el.type === 'checkbox' ? el.checked : +el.value; if (el.nextElementSibling) el.nextElementSibling.textContent = (+v).toFixed(1); if (live) live(k, v); else target[key] = v; };
      el.oninput = f; el.onchange = () => { f(); done(); };
    });
  }
  }
  class RoomTool extends K.Tool {
    down(e, p) { if (p) this.a = [Math.round(p.x / TILE) * TILE, Math.round(p.z / TILE) * TILE]; }
    move(e, p) { this.hover(p); }
    hover(p) {
      this.app.overlay.brush(p, 0.15);
      if (this.a && p) { const b = [Math.round(p.x / TILE) * TILE, Math.round(p.z / TILE) * TILE], a = this.a; this.app.overlay.poly([[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]], false); }
    }
    up(e, p) {
      const a = this.a; this.a = null; this.app.overlay.poly([], false); if (!a || !p) return;
      const b = [Math.round(p.x / TILE) * TILE, Math.round(p.z / TILE) * TILE];
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
      if (x1 - x0 < 1.5 || z1 - z0 < 1.5) { this.app.toast('Drag out a room at least 3 × 3 tiles.'); return; }
      const ui = this.app.ui, doc = this.doc, st = new K.TileStroke(doc);
      if (ui.floor) for (let j = Math.round(z0 / TILE); j < Math.round(z1 / TILE); j++) for (let i = Math.round(x0 / TILE); i < Math.round(x1 / TILE); i++) if (doc.type(i, j) !== T.CHASM) st.set(i, j, T.SLATE, null);
      const td = st.finish(); if (td) this.app.renderer.tilesChanged(...td.box);
      const before = JSON.stringify(doc.objects);
      const o = { id: doc.uid('w'), kind: 'wall', closed: true, pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], h: ui.wallH, hs: [ui.wallH + 0.8, ui.wallH - 0.3, Math.max(0.6, ui.wallH - 1.4), ui.wallH], ruin: ui.ruin, pillars: ui.pillars, seed: (Math.random() * 99999) | 0, gaps: [[2, 0.4, 0.62]] };
      doc.objects.push(o); this.app.sel = o.id;
      this.app.pushOp({ label: 'add room', tiles: td, objs: [before, JSON.stringify(doc.objects)] }); this.app.renderer.objectsChanged(); this.app.panel();
    }
    cancel() { this.a = null; this.app.overlay.poly([], false); }
    options() {
      const ui = this.app.ui;
      return `<h2>Ruined room</h2><p class="help">Drag a rectangle. You get four ruined walls (low front wall so the inside reads from the camera), corner pillars, a door gap and a slate floor.</p>${EditorWallControls.wallRows(ui)}<div class="row"><span>Slate floor</span><input type="checkbox" data-k="floor" ${ui.floor ? 'checked' : ''}></div>`;
    }
    bind(root) { EditorWallControls.bindRows(root, this.app.ui, () => {}); root.querySelector('[data-k=floor]').onchange = (e) => (this.app.ui.floor = e.target.checked); }
  }

  class BridgeTool extends K.Tool {
    down(e, p) {
      if (!p) return;
      const q = [r3(Math.round(p.x * 4) / 4), r3(Math.round(p.z * 4) / 4)];
      if (!this.a) { this.a = q; this.app.panel(); return; }
      const a = this.a; this.a = null; this.app.overlay.poly([], false);
      if (Math.hypot(q[0] - a[0], q[1] - a[1]) < 1.5) { this.app.toast('Bridges need at least 1.5 units between ends.'); this.app.panel(); return; }
      this.app.commitObjects('add bridge', (d) => { const o = { id: d.uid('b'), kind: 'bridge', a, b: q, w: this.app.ui.bridgeW, seed: (Math.random() * 99999) | 0 }; d.objects.push(o); this.app.sel = o.id; });
      this.app.panel();
    }
    hover(p) { this.app.overlay.brush(p, 0.2); if (this.a && p) this.app.overlay.poly([this.a, [p.x, p.z]], false, true); }
    cancel() { this.a = null; this.app.overlay.poly([], false); }
    options() {
      const ui = this.app.ui;
      return `<h2>Bridge</h2><p class="help">${this.a ? '<b>Now click the far end.</b> Esc cancels.' : 'Click one end, then the other. Stand the ends on the cliff tops either side of a chasm; the deck arches between them, stone piers drop to the floor and rails get posts and snow caps.'}</p>
        <div class="row"><span>Width</span><input type="range" min="1" max="3" step="0.1" value="${ui.bridgeW}" data-k="bw"><span class="val">${ui.bridgeW.toFixed(1)}</span></div>`;
    }
    bind(root) { const s = root.querySelector('[data-k=bw]'); s.oninput = () => { this.app.ui.bridgeW = +s.value; s.nextElementSibling.textContent = (+s.value).toFixed(1); }; }
  }

  class PropTool extends K.Tool {
    constructor(app) { super(app); this.rot = 0; }
    get def() { return PropBuilder.PROPS[this.app.ui.prop]; }
    scatterable() { return ['pine', 'shrub', 'rock', 'rubble', 'deadtree'].includes(this.app.ui.prop); }
    hover(p) { this.app.overlay.brush(p, this.def.r * (this.app.ui.propS || 1)); }
    place(p) {
      const ui = this.app.ui, R = Math.random, sc = this.scatterable();
      if (ui.prop === 'start') { const n = this.doc.objects.length; this.doc.objects = this.doc.objects.filter((x) => x.type !== 'start'); if (this.doc.objects.length < n) this.app.toast('Moved the player start (a world has one).'); }
      const o = { id: this.doc.uid('p'), kind: 'prop', type: ui.prop, x: r3(p.x), z: r3(p.z), rot: r3(sc ? R() * 6.28 : this.rot), s: r3((ui.propS || 1) * (sc ? 0.85 + R() * 0.3 : 1)), seed: (R() * 99999) | 0 };
      this.doc.objects.push(o); return o;
    }
    down(e, p) {
      if (!p) return;
      this.before = JSON.stringify(this.doc.objects); const o = this.place(p); this.last = p; this.n = 1; this.lastId = o.id;
      this.app.renderer.objectsChanged();
    }
    move(e, p) {
      this.hover(p); if (!this.before || !p || !this.scatterable()) return;
      const sp = this.def.r * 2.2 * (this.app.ui.propS || 1);
      if (Math.hypot(p.x - this.last.x, p.z - this.last.z) < sp) return;
      const a = Math.random() * 6.28, j = sp * 0.35; this.place({ x: p.x + Math.cos(a) * j, z: p.z + Math.sin(a) * j }); this.last = p; this.n++;
      this.app.renderer.objectsChanged();
    }
    up() {
      if (!this.before) return;
      this.app.pushOp({ label: this.n > 1 ? 'scatter ' + this.n + ' ' + this.def.name.toLowerCase() : 'place ' + this.def.name.toLowerCase(), objs: [this.before, JSON.stringify(this.doc.objects)] });
      this.before = null; if (this.n === 1) { this.app.sel = this.lastId; } this.app.panel();
    }
    cancel() { if (this.before) { this.doc.objects = JSON.parse(this.before); this.before = null; this.app.renderer.objectsChanged(); } }
    key(e) { if (e.key === 'q' || e.key === 'e') { this.rot += (e.key === 'e' ? 1 : -1) * Math.PI / 8; this.app.toast('Next prop faces ' + Math.round(this.rot * 180 / Math.PI) + '°'); return true; } return false; }
    options() {
      const ui = this.app.ui, groups = {};
      for (const [k, d] of Object.entries(PropBuilder.PROPS)) (groups[d.group] = groups[d.group] || []).push([k, d]);
      let h = '<h2>Props</h2>';
      for (const [g, list] of Object.entries(groups)) h += `<h3>${g}</h3><div class="pl">${list.map(([k, d]) => `<button data-p="${k}" class="${ui.prop === k ? 'on' : ''}" title="${d.name}"><canvas data-icon="${k}" width="28" height="28"></canvas>${d.name.replace('The ', '')}</button>`).join('')}</div>`;
      h += `<div class="row" style="margin-top:10px"><span>Scale</span><input type="range" min="0.5" max="2" step="0.05" value="${ui.propS || 1}" data-k="ps"><span class="val">${(ui.propS || 1).toFixed(2)}</span></div>`;
      h += `<p class="help">Click to place. Drag to scatter trees, shrubs, rocks and rubble. <kbd>Q</kbd>/<kbd>E</kbd> turn the next prop. Props snap onto bridge decks.</p>`;
      return h;
    }
    bind(root) {
      root.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { this.app.ui.prop = b.dataset.p; this.app.panel(); }));
      const s = root.querySelector('[data-k=ps]'); s.oninput = () => { this.app.ui.propS = +s.value; s.nextElementSibling.textContent = (+s.value).toFixed(2); };
      new K.PropIconPainter(this.app.renderer).paintAll(root);
    }
  }

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
      const o = this.doc.obj(this.drag.id); if (!o) return;
      const snap = (v) => (e.shiftKey ? v : Math.round(v * 4) / 4);
      if (this.drag.handle != null) {
        const q = [r3(snap(p.x)), r3(snap(p.z))];
        if (o.kind === 'bridge') o[this.drag.handle === 0 ? 'a' : 'b'] = q; else if (o.kind === 'wall') o.pts[this.drag.handle] = q;
      } else {
        const dx = p.x - this.drag.p0.x, dz = p.z - this.drag.p0.z, O = this.drag.orig;
        if (o.kind === 'prop') { o.x = r3(O.x + dx); o.z = r3(O.z + dz); }
        else if (o.kind === 'building') { const b = new K.BuildingEdit().moved(O, Math.round(dx / TILE), Math.round(dz / TILE)); if (!new K.BuildingEdit().placementProblems(this.doc, b).length) Object.assign(o, b); }
        else { const sdx = snap(dx), sdz = snap(dz); if (o.kind === 'bridge') { o.a = [r3(O.a[0] + sdx), r3(O.a[1] + sdz)]; o.b = [r3(O.b[0] + sdx), r3(O.b[1] + sdz)]; } else o.pts = O.pts.map(([x, z]) => [r3(x + sdx), r3(z + sdz)]); }
      }
      this.drag.moved = true; app.renderer.objectsChanged(); app.overlay.selection();
    }
    up() {
      if (this.pan) { this.pan = null; return; }
      if (this.drag && this.drag.moved) this.app.pushOp({ label: 'move', objs: [this.drag.before, JSON.stringify(this.doc.objects)] });
      this.drag = null; this.app.panel();
    }
    cancel() { if (this.drag && this.drag.moved) { this.doc.objects = JSON.parse(this.drag.before); this.app.renderer.objectsChanged(); } this.drag = null; this.pan = null; }
    hover(p) { this.app.overlay.brush(null); const hit = p && this.app.selection.pick(p); this.app.overlay.hoverObj(hit ? hit.id : null); }
    toggleGap(o, p) {
      const P = WorldDoc.wallPts(o); let best = null;
      for (let k = 0; k < P.length - 1; k++) {
        const [ax, az] = P[k], [bx, bz] = P[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / L2, 0, 1), d = Math.hypot(p.x - ax - dx * t, p.z - az - dz * t);
        if (!best || d < best.d) best = { k, t, d, L: Math.sqrt(L2) };
      }
      if (!best || best.d > 0.8) return;
      this.app.commitObjects('toggle door', (d) => {
        const w = d.obj(o.id); w.gaps = w.gaps || [];
        const hit = w.gaps.findIndex((g) => g[0] === best.k && best.t >= g[1] - 0.02 && best.t <= g[2] + 0.02);
        if (hit >= 0) w.gaps.splice(hit, 1); else { const half = 0.5 / best.L; w.gaps.push([best.k, r3(clamp(best.t - half, 0, 1)), r3(clamp(best.t + half, 0, 1))]); }
      });
    }
    key(e) {
      const app = this.app, o = app.sel && this.doc.obj(app.sel); if (!o) return false;
      if (e.key === 'q' || e.key === 'e') { app.selection.rotateSel((e.key === 'e' ? 1 : -1) * Math.PI / 12); return true; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { app.selection.duplicateSel(); return true; }
      return false;
    }
    options() { return this.app.inspector.render(); }
    bind(root) { this.app.inspector.bind(root); }
  }


Object.assign(K, { WallTool, RoomTool, BridgeTool, PropTool, SelectTool, EditorWallControls });
})(typeof window !== 'undefined' ? window : globalThis);
