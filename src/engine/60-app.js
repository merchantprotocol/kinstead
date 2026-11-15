/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · editor: history, picking, tools, UI, IO. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /* ---------- tools ---------- */
  class Tool {
    constructor(app) { this.app = app; }
    get doc() { return this.app.doc; }
    down() {} move() {} up() {} key() { return false; } cancel() {} dbl() {}
    hover(p) { this.app.overlay.brush(p, 0); }
    options() { return ''; }
    bind() {}
    cursor() { return 'crosshair'; }
  }

  class BrushTool extends Tool {
    constructor(app, kind) { super(app); this.kind = kind; }
    get size() { return this.app.ui.size[this.kind]; }
    set size(v) { this.app.ui.size[this.kind] = clamp(Math.round(v), 1, 24); }
    hover(p) { this.app.overlay.brush(p, this.size * TILE); }
    tilesIn(p) {
      const r = this.size, out = [], [ci, cj] = this.doc.tileOf(p.x, p.z), rr = (r - 0.5) * (r - 0.5) + 0.3;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = ci + di, j = cj + dj; if (!this.doc.inside(i, j)) continue;
        const cx = (i + 0.5) * TILE - p.x, cz = (j + 0.5) * TILE - p.z;
        if ((cx * cx + cz * cz) / (TILE * TILE) <= rr) out.push([i, j, Math.sqrt(cx * cx + cz * cz) / (r * TILE)]);
      }
      return out;
    }
    down(e, p) { if (!p) return; this.stroke = new K.TileStroke(this.doc); this.last = p; this.start = p; this.begin(e, p); this.dab(p); }
    move(e, p) {
      this.hover(p); if (!this.stroke || !p) return;
      const d = Math.hypot(p.x - this.last.x, p.z - this.last.z), step = Math.max(0.2, this.size * TILE * 0.4);
      const n = Math.ceil(d / step);
      for (let k = 1; k <= n; k++) { const t = k / n; this.dab({ x: this.last.x + (p.x - this.last.x) * t, z: this.last.z + (p.z - this.last.z) * t }); }
      this.last = p;
    }
    up() { if (!this.stroke) return; const td = this.stroke.finish(); this.stroke = null; if (td) this.app.pushOp({ label: this.label(), tiles: td }); }
    cancel() { if (this.stroke) { const td = this.stroke.finish(); this.stroke = null; if (td) { K.TileStroke.apply(this.doc, td, 'old'); this.app.renderer.tilesChanged(...td.box); } } }
    begin() {}
    dab(p) {
      let b = [1e9, 1e9, -1e9, -1e9], any = false;
      for (const [i, j, d] of this.tilesIn(p)) if (this.apply(i, j, d)) { any = true; b = [Math.min(b[0], i), Math.min(b[1], j), Math.max(b[2], i + 1), Math.max(b[3], j + 1)]; }
      if (any) this.app.renderer.tilesChanged(...b);
    }
    key(e) {
      if (e.key === '[' || e.key === ']') { this.size = this.size + (e.key === ']' ? 1 : -1); this.app.panel(); this.hover(this.app.hoverP); return true; }
      return false;
    }
    sizeRow() { return `<div class="row"><span>Brush size</span><input type="range" min="1" max="24" value="${this.size}" data-k="size"><span class="val">${this.size}</span></div><p class="help"><kbd>[</kbd> <kbd>]</kbd> change size. Right-drag orbits, middle-drag or <kbd>Space</kbd>-drag pans.</p>`; }
    bind(root) { const s = root.querySelector('[data-k=size]'); if (s) s.oninput = () => { this.size = +s.value; s.nextElementSibling.textContent = this.size; }; }
  }

  class PaintTool extends BrushTool {
    constructor(app) { super(app, 'paint'); }
    label() { return 'paint ' + TERRAINS[this.app.ui.terrain].name.toLowerCase(); }
    apply(i, j) {
      const d = this.doc, k = d.idx(i, j); if (d.terrain[k] === T.CHASM) return false;   // painting never fills a chasm; use Carve → Fill
      return this.stroke.set(i, j, this.app.ui.terrain, null);
    }
    options() {
      const ui = this.app.ui;
      return `<h2>Paint terrain</h2><div class="sw">${TERRAINS.filter((t) => t.id !== T.CHASM).map((t, q) => `<button data-t="${t.id}" class="${ui.terrain === t.id ? 'on' : ''}" title="${t.name} (${q + 1})"><i style="background:${t.sw}"></i>${t.name.split(' ')[0]}</button>`).join('')}</div>${this.sizeRow()}<p class="help">Number keys <kbd>1</kbd>–<kbd>7</kbd> pick a terrain. Edges blend with the diorama's dithered noise. Chasm floors stay put: use <b>Carve</b>.</p>`;
    }
    bind(root) { super.bind(root); root.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { this.app.ui.terrain = +b.dataset.t; this.app.panel(); })); }
    key(e) {
      const ids = TERRAINS.filter((t) => t.id !== T.CHASM).map((t) => t.id), n = +e.key;
      if (n >= 1 && n <= ids.length && !e.ctrlKey && !e.metaKey) { this.app.ui.terrain = ids[n - 1]; this.app.panel(); return true; }
      return super.key(e);
    }
  }

  class HeightTool extends BrushTool {
    constructor(app) { super(app, 'height'); }
    label() { return { raise: 'raise ground', lower: 'lower ground', level: 'level ground' }[this.app.ui.hmode]; }
    begin(e, p) {
      if (e.altKey) { this.app.ui.level = this.doc.tileY(p.x, p.z); this.app.panel(); this.app.toast('Level picked: ' + this.app.ui.level); this.stroke = null; }
    }
    dab(p) { if (this.stroke) super.dab(p); }
    apply(i, j) {
      const ui = this.app.ui, d = this.doc, k = d.idx(i, j); if (this.stroke.touched(k)) return false;
      const step = Math.round(ui.step / HQ), h = d.height[k];
      let nh = ui.hmode === 'raise' ? h + step : ui.hmode === 'lower' ? h - step : Math.round(ui.level / HQ);
      let nt = null; if (d.terrain[k] === T.CHASM && nh * HQ > -2) nt = T.SNOW;  // raised out of a chasm -> snow again
      if (ui.hmode === 'lower' && nh * HQ < -6 && d.terrain[k] !== T.CHASM) nt = T.CHASM;
      return this.stroke.set(i, j, nt, nh);
    }
    options() {
      const ui = this.app.ui;
      return `<h2>Height</h2><div class="seg">${['raise', 'lower', 'level'].map((m) => `<button class="b ${ui.hmode === m ? 'on' : ''}" data-m="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
        <div class="row"><span>Step</span><select data-k="step">${[0.25, 0.5, 0.75, 1.75].map((v) => `<option ${ui.step === v ? 'selected' : ''}>${v}</option>`).join('')}</select><span style="font-size:11px;color:#6a7588">units / stroke</span></div>
        <div class="row"><span>Level</span><input type="number" step="0.25" value="${ui.level}" data-k="level"><span style="font-size:11px;color:#6a7588"><kbd>Alt</kbd>+click picks</span></div>
        ${this.sizeRow()}<p class="help">Each stroke moves a tile once, so cliffs come out as clean block terraces. Faces at or above 1.5 use the dark rock strata, lower ones the snowy cliff strata with icicles.</p>`;
    }
    bind(root) {
      super.bind(root); const ui = this.app.ui;
      root.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { ui.hmode = b.dataset.m; this.app.panel(); }));
      root.querySelector('[data-k=step]').onchange = (e) => (ui.step = +e.target.value);
      root.querySelector('[data-k=level]').onchange = (e) => (ui.level = Math.round(+e.target.value * 4) / 4);
    }
  }

  class CarveTool extends BrushTool {
    constructor(app) { super(app, 'carve'); this.noise = new K.Noise(77); }
    label() { return this.app.ui.cmode === 'fill' ? 'fill chasm' : 'carve chasm'; }
    apply(i, j, d) {
      const doc = this.doc, k = doc.idx(i, j), ui = this.app.ui;
      if (ui.cmode === 'fill') return this.stroke.set(i, j, doc.terrain[k] === T.CHASM ? T.SNOW : null, Math.round(ui.level / HQ));
      const x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, nn = this.noise.fbm(x * 0.9, z * 0.9, 2);
      let y;
      if (d > 0.72 && nn > 0.5) y = -2.5;
      else if (d > 0.5 && nn > 0.43) y = nn > 0.6 ? -4.75 : -5.5;
      else y = ui.depth + (this.noise.fbm(x * 0.4, z * 0.4, 2) - 0.5) * 0.8;
      const cur = doc.height[k] * HQ;
      if (doc.terrain[k] === T.CHASM && cur <= y) return false;      // never fill a deeper floor
      return this.stroke.set(i, j, T.CHASM, Math.round(y * 4));
    }
    options() {
      const ui = this.app.ui;
      return `<h2>Chasm</h2><div class="seg"><button class="b ${ui.cmode === 'carve' ? 'on' : ''}" data-m="carve">Carve</button><button class="b ${ui.cmode === 'fill' ? 'on' : ''}" data-m="fill">Fill</button></div>
        <div class="row"><span>Depth</span><input type="range" min="-16" max="-3" step="0.5" value="${ui.depth}" data-k="depth"><span class="val">${ui.depth}</span></div>
        ${this.sizeRow()}<p class="help">Carve cuts a chasm with snowy ledges along the rim and a pine-forest floor far below. Fill raises it back to the <b>Height → Level</b> value (${ui.level}).</p>`;
    }
    bind(root) {
      super.bind(root); const ui = this.app.ui;
      root.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { ui.cmode = b.dataset.m; this.app.panel(); }));
      const dp = root.querySelector('[data-k=depth]'); dp.oninput = () => { ui.depth = +dp.value; dp.nextElementSibling.textContent = ui.depth; };
    }
  }

  /* polyline wall (ruin) tool */
  class WallTool extends Tool {
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
      return `<h2>Wall / ruin</h2><p class="help">Click to drop corner points; double-click or <kbd>Enter</kbd> to finish, click the first point to close a loop. <kbd>Backspace</kbd> removes the last point, <kbd>Esc</kbd> cancels.${this.pts.length ? ` <b>${this.pts.length} point(s)</b>` : ''}</p>${wallRows(ui)}`;
    }
    bind(root) { bindWallRows(root, this.app.ui, () => {}); }
  }
  const wallRows = (o, prefix = '') => `<div class="row"><span>Height</span><input type="range" min="0.5" max="6" step="0.1" value="${o.wallH ?? o.h ?? 2.4}" data-w="h"><span class="val">${(+(o.wallH ?? o.h ?? 2.4)).toFixed(1)}</span></div>
    <div class="row"><span>Ruin</span><input type="range" min="0" max="4" step="0.1" value="${o.ruin ?? 2}" data-w="ruin"><span class="val">${(+(o.ruin ?? 2)).toFixed(1)}</span></div>
    <div class="row"><span>Pillars</span><input type="checkbox" data-w="pillars" ${o.pillars !== false ? 'checked' : ''}></div>`;
  const bindWallRows = (root, target, done, live) => {
    root.querySelectorAll('[data-w]').forEach((el) => {
      const k = el.dataset.w, key = k === 'h' && 'wallH' in target ? 'wallH' : k;
      const f = () => { const v = el.type === 'checkbox' ? el.checked : +el.value; if (el.nextElementSibling) el.nextElementSibling.textContent = (+v).toFixed(1); if (live) live(k, v); else target[key] = v; };
      el.oninput = f; el.onchange = () => { f(); done(); };
    });
  };

  class RoomTool extends Tool {
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
      return `<h2>Ruined room</h2><p class="help">Drag a rectangle. You get four ruined walls (low front wall so the inside reads from the camera), corner pillars, a door gap and a slate floor.</p>${wallRows(ui)}<div class="row"><span>Slate floor</span><input type="checkbox" data-k="floor" ${ui.floor ? 'checked' : ''}></div>`;
    }
    bind(root) { bindWallRows(root, this.app.ui, () => {}); root.querySelector('[data-k=floor]').onchange = (e) => (this.app.ui.floor = e.target.checked); }
  }

  class BridgeTool extends Tool {
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

  class PropTool extends Tool {
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
      this.app.drawIcons(root);
    }
  }

  class SelectTool extends Tool {
    cursor() { return 'default'; }
    down(e, p, sx, sy) {
      if (!p) return;
      const app = this.app, doc = this.doc, cur = app.sel && doc.obj(app.sel);
      // handles of the current selection first
      if (cur) {
        const h = app.handleAt(cur, sx, sy);
        if (h != null) { this.drag = { id: cur.id, handle: h, before: JSON.stringify(doc.objects), p0: p }; return; }
        if (e.altKey && cur.kind === 'wall') { this.toggleGap(cur, p); return; }
      }
      const hit = app.pick(p);
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
    hover(p) { this.app.overlay.brush(null); const hit = p && this.app.pick(p); this.app.overlay.hoverObj(hit ? hit.id : null); }
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
      if (e.key === 'q' || e.key === 'e') { app.rotateSel((e.key === 'e' ? 1 : -1) * Math.PI / 12); return true; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { app.duplicateSel(); return true; }
      return false;
    }
    options() { return this.app.selectionPanel(); }
    bind(root) { this.app.bindSelectionPanel(root); }
  }

  /* ---------- overlay (drawn crisp, after the post pipeline) ---------- */
  class Overlay {
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
      const hp = []; if (o) this.app.handles(o).forEach(([x, z]) => hp.push(x, this.doc.groundY(x, z) + 0.12, z));
      this.setPts(this.handles, hp);
    }
    hoverObj(id) { if (id === this.hoverId) return; this.hoverId = id; const o = id && id !== this.app.sel && this.doc.obj(id); this.setPts(this.hov, o ? this.outline(o) : []); }
    clear() { [this.ring, this.line, this.sel, this.hov, this.handles, this.rolesL].forEach((m) => (m.visible = false)); this.hoverId = null; this.roleSig = null; }
  }

  /* ---------- the app ---------- */
  class BuilderApp {
    constructor() {
      this.stage = $('stage');
      const r = (this.renderer3 = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
      this.quality = +$('qual').value;
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * (this.quality === 2 ? 1 : this.quality) / (this.quality === 2 ? 1 : 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.NoToneMapping;
      this.stage.appendChild(r.domElement); r.domElement.tabIndex = 0;
      this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 400);
      this.rig = new K.CameraRig(this.camera);
      this.post = new K.PostPipeline(r);
      this.renderer = new K.WorldRenderer(r);
      this.overlay = null;
      this.history = new K.History();
      this.ui = { size: { paint: 3, height: 3, carve: 4 }, terrain: T.PATH, hmode: 'raise', step: 0.5, level: 0, cmode: 'carve', depth: -8.5, wallH: 2.4, ruin: 2.0, pillars: true, floor: true, bridgeW: 1.6, prop: 'pine', propS: 1 };
      this.tools = { select: new SelectTool(this), paint: new PaintTool(this), height: new HeightTool(this), carve: new CarveTool(this), wall: new WallTool(this), room: new RoomTool(this), bridge: new BridgeTool(this), prop: new PropTool(this) };
      this.time = 0; this.last = performance.now(); this.fixedTime = null; this.frames = []; this.view = 'orbit';
      this.play = new K.PlayMode(this); this.store = null; this.savedId = null; this.dirtySince = false;
    }
    start() {
      this.overlay = new Overlay(this);
      this.buildToolbar(); this.bindUI(); this.bindInput();
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.setTool('select');
      this.generate(4242, 64, 48, true);
      this.storeReady = this.initStore();
      const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
      if (G.KINSTEAD_HOLD_LOADING) this.deferLoop = loop; else loop();   // the castle page draws nothing until its own world is ready: no wasted frames of the placeholder while it loads
      if (!G.KINSTEAD_HOLD_LOADING) { const l = $('loading'); if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 500); } }   // the castle page keeps the loading screen up until its own world is ready
      return this;
    }
    /** begin drawing frames (the castle page calls this once its world is in) */
    startLoop() { if (this.deferLoop) { const f = this.deferLoop; this.deferLoop = null; f(); } }
    get doc() { return this.renderer.doc; }
    /* ---- document lifecycle ---- */
    setDoc(doc, label) {
      if (this.play) { if (this.play.active) this.setPlay(false); this.play.reset(); }
      this.savedId = null;
      this.sel = null; this.history.clear(); this.renderer.setDoc(doc);
      this.rig.bounds = [0, 0, doc.wu, doc.hu];
      if (doc.camera) this.rig.set(doc.camera, true); else this.frameHero(true);
      if (this.overlay) this.overlay.clear();
      this.panel(); this.updateButtons(); this.status(label || ''); this.updateDirty();
    }
    generate(seed, w, h, quiet) {
      const t0 = performance.now();
      const doc = new K.WorldGenerator(seed).generate(w, h);
      this.setDoc(doc);
      if (!quiet) this.toast(`Generated seed ${seed} · ${w} × ${h} tiles · ${doc.objects.length} objects (${Math.round(performance.now() - t0)} ms)`);
      this.dirtySince = false; this.updateDirty();
    }
    newBlank(w, h, name, base) {
      const doc = new WorldDoc(w, h, { name, seed: 1 }); doc.terrain.fill(base | 0);
      this.setDoc(doc); this.rig.set({ tx: doc.wu / 2, tz: doc.hu / 2, ty: 0, dist: Math.max(16, doc.wu * 0.55), pitch: 0.75, yaw: -0.2 }, true);
      this.toast(`New blank world · ${w} × ${h} tiles`); this.dirtySince = false; this.updateDirty();
    }
    frameHero(snap) {
      const doc = this.doc, b = doc.objects.find((o) => o.kind === 'bridge');
      if (b) this.rig.set({ tx: b.a[0] + 0.7, ty: 0.7, tz: b.a[1] + 0.4, yaw: -0.1, pitch: 0.6, dist: 11.5 }, snap);
      else this.rig.set({ tx: doc.wu / 2, ty: 0, tz: doc.hu / 2, yaw: -0.2, pitch: 0.7, dist: 21 }, snap);
    }
    frameAll(snap) { const doc = this.doc; this.rig.set({ tx: doc.wu / 2, ty: 0, tz: doc.hu / 2 + doc.hu * 0.05, dist: Math.max(doc.wu, doc.hu * 1.4) * 1.25, pitch: this.view === 'top' ? 1.53 : 0.8, yaw: this.view === 'top' ? 0 : -0.2 }, snap); }
    /* ---- history ---- */
    pushOp(op) { this.history.push(op); this.updateButtons(); this.dirtySince = true; this.autosave(); }
    commitObjects(label, fn) {
      const before = JSON.stringify(this.doc.objects); fn(this.doc);
      const after = JSON.stringify(this.doc.objects); if (before === after) return;
      this.pushOp({ label, objs: [before, after] }); this.renderer.objectsChanged(); this.overlay.selection();
    }
    applyOp(op, which) {
      const doc = this.doc;
      if (op.tiles) { K.TileStroke.apply(doc, op.tiles, which); this.renderer.tilesChanged(...op.tiles.box); }
      if (op.objs) { doc.objects = JSON.parse(which === 'old' ? op.objs[0] : op.objs[1]); if (this.sel && !doc.obj(this.sel)) this.sel = null; this.renderer.objectsChanged(); }
      this.overlay.selection(); this.panel(); this.updateButtons();
    }
    undo() { this.tool.cancel(); const op = this.history.undo(); if (!op) return; this.applyOp(op, 'old'); this.toast('Undid ' + op.label); }
    redo() { this.tool.cancel(); const op = this.history.redo(); if (!op) return; this.applyOp(op, 'new'); this.toast('Redid ' + op.label); }
    updateButtons() { $('bUndo').disabled = !this.history.canUndo(); $('bRedo').disabled = !this.history.canRedo(); }
    autosave() {
      this.dirtySince = true; this.updateDirty(); clearTimeout(this.asT);
      this.asT = setTimeout(() => {
        const json = JSON.stringify(this.serialize());
        if (this.store) this.store.autosave(json).catch((e) => console.warn('autosave failed', e));
        try { localStorage.setItem('kinstead-world3d-autosave', json); } catch (e) { /* blocked (data: URL) or full: the "Not stored" note is already showing */ }
      }, 1500);
    }
    /* ---- saving: My worlds (IndexedDB), with an in-memory fallback ---- */
    async initStore() {
      let force = null; try { if (/[?&]memstore\b/.test(location.search) || G.KINSTEAD_MEMSTORE) force = 'Storage turned off for this page.'; } catch (e) { /* opaque origin */ }
      this.store = await K.WorldStore.create(force ? { forceMemory: force } : {});
      const note = $('storeNote');
      if (!this.store.persistent) { $('storeWhy').textContent = this.store.reason; note.classList.add('show'); note.title = this.store.reason; }
      this.store.onUpgrade = () => { note.classList.remove('show'); this.updateDirty(); this.toast('Storage is ready: worlds now save in this browser.'); };
      let saved = null;
      try { const a = await this.store.readAutosave(); if (a && a.json) saved = a.json; } catch (e) { /* none */ }
      if (!saved) try { saved = localStorage.getItem('kinstead-world3d-autosave'); } catch (e) { /* blocked */ }
      if (saved) { const b = $('bRecover'); b.style.display = ''; b.onclick = () => { if (this.loadText(saved)) b.style.display = 'none'; }; }
      this.updateDirty(); return this.store;
    }
    updateDirty() {
      const e = $('sDirty'); if (!e) return;
      e.textContent = this.dirtySince ? '● Unsaved changes' : this.savedId ? (this.store && this.store.persistent ? '✓ Saved in My worlds' : '✓ Saved for this session') : '';
      e.className = this.dirtySince ? '' : 'ok';
      document.title = (this.dirtySince ? '● ' : '') + (this.doc ? this.doc.name + ' · ' : '') + 'Kinstead World Builder';
    }
    thumb() {
      try {
        const src = this.renderer3.domElement, c = document.createElement('canvas'); c.width = 224; c.height = 126;
        const sw = src.width, sh = src.height, ar = 224 / 126; let w = sw, h = sw / ar; if (h > sh) { h = sh; w = sh * ar; }
        c.getContext('2d').drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, 224, 126); return c.toDataURL('image/jpeg', 0.72);
      } catch (e) { return null; }
    }
    whereHtml(saving) {
      if (!this.store) return 'Storage is starting…';
      if (!this.store.persistent) return `<span class="warn">⚠ <b>Not stored.</b> ${esc(this.store.reason)} Worlds here last only until this page closes. Use <b>Download</b> to keep a copy.</span>`;
      return saving ? (this.savedId ? 'Updates the saved copy in <b>My worlds</b> (kept in this browser).' : 'Kept in <b>My worlds</b> in this browser. Use Download for a file you can share.') : 'Saved in this browser. Use Download for a file you can share or back up.';
    }
    async openSave() {
      await this.storeReady;
      $('svName').value = this.doc.name; $('svCopy').style.display = this.savedId ? '' : 'none'; $('svWhere').innerHTML = this.whereHtml(true);
      $('saveModal').classList.add('show'); setTimeout(() => { $('svName').focus(); $('svName').select(); }, 20);
    }
    async saveWorld(name, asNew) {
      await this.storeReady; name = (name || this.doc.name || 'Untitled world').trim() || 'Untitled world';
      this.doc.name = name; const json = this.serialize();
      try {
        const meta = await this.store.save({ id: asNew ? null : this.savedId, name, json, thumb: this.thumb() });
        this.savedId = meta.id; this.dirtySince = false; this.updateDirty(); if (this.toolName === 'select' && !this.sel) this.panel();
        this.toast(this.store.persistent ? `Saved "${name}" to My worlds.` : `Saved "${name}" for this session only. Download it to keep it.`);
        return meta;
      } catch (e) {
        console.warn('save failed', e); this.toast('Could not save to My worlds (' + e.message + '). Downloading a copy instead.'); this.saveJSON(); return null;
      }
    }
    quickSave() { if (this.savedId && this.store) return this.saveWorld(this.doc.name); return this.openSave(); }
    ask(title, text, ok = 'OK', danger = false) {
      return new Promise((res) => {
        $('askTitle').textContent = title; $('askText').textContent = text; const y = $('askYes'); y.textContent = ok; y.className = 'b ' + (danger ? 'danger' : 'pri');
        const m = $('askModal'); m.classList.add('show');
        const done = (v) => { m.classList.remove('show'); this.askDone = null; res(v); };
        this.askDone = done; y.onclick = () => done(true); $('askNo').onclick = () => done(false);
      });
    }
    async openWorlds() { await this.storeReady; $('worldsModal').classList.add('show'); await this.renderWorlds(); }
    async renderWorlds(mode = {}) {
      const list = await this.store.list(), when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      $('wlWhere').innerHTML = (this.store.persistent ? `${list.length} world${list.length === 1 ? '' : 's'} saved in this browser. ` : '') + this.whereHtml(false).replace(/^Saved in this browser\. /, '');
      $('wlList').innerHTML = list.length ? list.map((m) => `<div class="wr ${m.id === this.savedId ? 'cur' : ''}" data-id="${m.id}">${m.thumb ? `<img src="${m.thumb}" alt="">` : '<div class="nothumb"></div>'}
        <div class="inf">${mode.rename === m.id ? `<div class="row" style="margin:0"><input type="text" data-k="nm" value="${esc(m.name)}" maxlength="80"><button class="b pri" data-a="rn-ok">Save</button><button class="b" data-a="rn-x">Cancel</button></div>` : `<b data-a="open" title="Open">${esc(m.name)}</b>`}
          <small>${m.w} × ${m.h} tiles · ${m.objects} objects · ${(m.bytes / 1024).toFixed(0)} KB · saved ${when(m.updated)}${m.id === this.savedId ? ' · <b style="display:inline;color:#2f5f86">open now</b>' : ''}</small></div>
        <div class="ba">${mode.del === m.id ? `<span class="conf">Delete "${esc(m.name)}" for good?<button class="b" data-a="del-x">Keep</button><button class="b danger" data-a="del-ok">Delete</button></span>` : `<button class="b pri" data-a="open">Open</button><button class="b" data-a="rename">Rename</button><button class="b" data-a="dup">Duplicate</button><button class="b" data-a="del">Delete</button>`}</div></div>`).join('')
        : '<div class="none">No saved worlds yet. Use <b>Save world</b> (Ctrl+S) to keep the one you are building.</div>';
      const inp = $('wlList').querySelector('[data-k=nm]'); if (inp) { inp.focus(); inp.select(); inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('wlList').querySelector('[data-a=rn-ok]').click(); if (e.key === 'Escape') this.renderWorlds(); }; }
    }
    async worldsAction(id, a) {
      const st = this.store;
      try {
        if (a === 'open') {
          if (this.dirtySince && id !== this.savedId && !(await this.ask('Open this world?', 'The world you are editing has unsaved changes. They will be lost unless you save it first.', 'Open anyway', true))) return;
          const txt = await st.load(id); if (this.loadText(txt)) { this.savedId = id; this.dirtySince = false; this.updateDirty(); $('worldsModal').classList.remove('show'); }
        } else if (a === 'rename') this.renderWorlds({ rename: id });
        else if (a === 'rn-x' || a === 'del-x') this.renderWorlds();
        else if (a === 'rn-ok') {
          const nm = ($('wlList').querySelector('[data-k=nm]').value || '').trim(); if (!nm) return;
          await st.rename(id, nm); if (id === this.savedId) { this.doc.name = nm; this.updateDirty(); if (this.toolName === 'select' && !this.sel) this.panel(); }
          this.toast(`Renamed to "${nm}".`); this.renderWorlds();
        } else if (a === 'dup') { const m = await st.duplicate(id); this.toast(`Duplicated as "${m.name}".`); this.renderWorlds(); }
        else if (a === 'del') this.renderWorlds({ del: id });
        else if (a === 'del-ok') {
          const m = await st.meta(id); await st.remove(id);
          if (id === this.savedId) { this.savedId = null; this.dirtySince = true; this.updateDirty(); }
          this.toast(`Deleted "${m ? m.name : 'world'}".`); this.renderWorlds();
        }
      } catch (e) { console.warn(e); this.toast('That did not work: ' + e.message); }
    }
    setPlay(on) {
      if (on === this.play.active) return;
      if (on) this.play.enter(); else this.play.exit();
      const b = $('bPlay'); b.textContent = on ? '■ Stop playing' : '▶ Play'; b.classList.toggle('on', on); b.title = on ? 'Back to editing (G)' : 'Play this world (G)';
      if (!on) this.panel();
    }
    /* ---- selection ---- */
    select(id) { this.sel = id; this.overlay.selection(); this.overlay.hoverObj(null); if (this.toolName === 'select') this.panel(); }
    pick(p) {
      const doc = this.doc; let best = null, bd = 1e9;
      for (const o of doc.objects) {
        let d;
        if (o.kind === 'prop') { const def = PropBuilder.PROPS[o.type] || { r: 0.4 }; d = Math.hypot(o.x - p.x, o.z - p.z) - def.r * (o.s || 1) - 0.1; if (def.sprite) d -= 0.2; }
        else if (o.kind === 'bridge') { const l = WorldDoc.bridgeLocal(o, p.x, p.z); d = l.s >= 0 && l.s <= l.L ? Math.abs(l.n) - (o.w || 1.6) / 2 : 9; d += 0.15; }
        else if (o.kind === 'building') d = K.BuildingGeo.contains(o, ...doc.tileOf(p.x, p.z)) ? -0.5 : 9;
        else { const P = WorldDoc.wallPts(o); d = 9; for (let k = 0; k + 1 < P.length; k++) d = Math.min(d, segD(p.x, p.z, P[k], P[k + 1])); d -= 0.35; }
        if (d < 0 && d < bd + (o.kind === 'prop' ? 0.3 : 0)) { bd = d; best = o; }
      }
      return best;
    }
    handles(o) { return o.kind === 'bridge' ? [o.a, o.b] : o.kind === 'wall' ? o.pts : []; }
    handleAt(o, sx, sy) {
      const H = this.handles(o), v = new V3();
      for (let k = 0; k < H.length; k++) { v.set(H[k][0], this.doc.groundY(H[k][0], H[k][1]) + 0.12, H[k][1]).project(this.camera); const r = this.renderer3.domElement.getBoundingClientRect(); const px = (v.x + 1) / 2 * r.width, py = (1 - v.y) / 2 * r.height; if (Math.hypot(px - sx, py - sy) < 9) return k; }
      return null;
    }
    rotateSel(da) {
      this.commitObjects('rotate', (d) => {
        const o = d.obj(this.sel); if (!o) return;
        if (o.kind === 'building') { const b = new K.BuildingEdit().rotate(o, da > 0 ? 1 : -1); if (!new K.BuildingEdit().placementProblems(d, b).length) Object.assign(o, b); return; }
        if (o.kind === 'prop') { o.rot = r3((o.rot || 0) + da); return; }
        const P = o.kind === 'bridge' ? [o.a, o.b] : o.pts, cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length, c = Math.cos(da), s = Math.sin(da);
        const R = P.map(([x, z]) => [r3(cx + (x - cx) * c - (z - cz) * s), r3(cz + (x - cx) * s + (z - cz) * c)]);
        if (o.kind === 'bridge') { o.a = R[0]; o.b = R[1]; } else o.pts = R;
      });
    }
    duplicateSel() {
      const o = this.sel && this.doc.obj(this.sel); if (!o) return;
      this.commitObjects('duplicate', (d) => {
        const c = JSON.parse(JSON.stringify(o)); c.id = d.uid(o.kind[0]); c.seed = (Math.random() * 99999) | 0;
        if (c.kind === 'building') { c.x += c.footprint.w + 1; if (new K.BuildingEdit().placementProblems(d, c).length) { this.toast('No room to duplicate here.'); return; } } else if (c.kind === 'prop') { c.x = r3(c.x + 1); c.z = r3(c.z + 1); } else if (c.kind === 'bridge') { c.a = [c.a[0] + 1, c.a[1] + 1]; c.b = [c.b[0] + 1, c.b[1] + 1]; } else c.pts = c.pts.map(([x, z]) => [x + 1, z + 1]);
        d.objects.push(c); this.sel = c.id;
      });
      this.panel();
    }
    deleteSel() {
      if (!this.sel) return;
      const o = this.doc.obj(this.sel), name = o ? describe(o) : 'object';
      this.commitObjects('delete ' + name, (d) => { d.objects = d.objects.filter((x) => x.id !== this.sel); });
      this.sel = null; this.overlay.selection(); this.panel();
    }
    selectionPanel() {
      const o = this.sel && this.doc.obj(this.sel);
      const help = `<p class="help">Click an object to select it; drag to move (hold <kbd>Shift</kbd> for free placement). Yellow handles move wall corners and bridge ends. <kbd>Q</kbd>/<kbd>E</kbd> rotate, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, <kbd>Del</kbd> deletes. Dragging empty ground pans.</p>`;
      if (!o) return `<h2>Select</h2>${help}<h3>World</h3><div class="row"><span>Name</span><input type="text" data-k="name" value="${esc(this.doc.name)}" style="flex:1;border:1px solid #c9d1dd;border-radius:7px;padding:4px 6px"></div><p class="help">${this.doc.w} × ${this.doc.h} tiles · ${this.doc.wu} × ${this.doc.hu} units · ${this.doc.objects.length} objects · seed ${this.doc.seed}</p>`;
      let h = `<h2>${esc(describe(o))}</h2>`;
      if (o.kind === 'prop') {
        const def = PropBuilder.PROPS[o.type] || {};
        h += `<div class="row"><span>Rotation</span><input type="range" min="-3.15" max="3.15" step="0.05" value="${o.rot || 0}" data-o="rot"><span class="val">${Math.round((o.rot || 0) * 57.3)}°</span></div>`;
        h += `<div class="row"><span>Scale</span><input type="range" min="0.3" max="2.5" step="0.05" value="${o.s || 1}" data-o="s"><span class="val">${(o.s || 1).toFixed(2)}</span></div>`;
        if (def.sprite) h += `<div class="row"><span>Face left</span><input type="checkbox" data-o="flip" ${o.flip ? 'checked' : ''}></div>`;
        if (def.start) h += `<div class="row"><span>Hero</span><select data-o="hero" data-str="1">${[['warden', 'The Warden'], ['witch', 'Rime Witch']].map(([k, n]) => `<option value="${k}" ${(o.hero || 'warden') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div><p class="help">Play mode starts the player here. One per world.</p>`;
        else if (def.sprite) {
          const role = PropBuilder.roleOf(o);
          h += `<div class="row"><span>Role</span><select data-o="role" data-str="1">${[['enemy', 'Enemy'], ['npc', 'Friendly NPC'], ['merchant', 'Merchant']].map(([k, n]) => `<option value="${k}" ${role === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
          h += `<div class="row"><span>Look</span><select data-o="look" data-str="1">${this.renderer.lib.defs.map((d) => `<option value="${d.id}" ${PropBuilder.spriteOf(o) === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></div>`;
          h += `<div class="row"><span>Name</span><input type="text" data-o="name" data-str="1" value="${esc(o.name || '')}" placeholder="${esc(role === 'merchant' ? 'Merchant' : (K.BESTIARY[def.sprite] || {}).name || def.name)}" style="flex:1;border:1px solid #c9d1dd;border-radius:7px;padding:4px 6px;min-width:0"></div>`;
          h += `<p class="help">Enemies fight, friendly NPCs talk, merchants talk and trade. Their ring shows the role while editing.</p>`;
        }
        if (def.interact) h += `<p class="help">Resource node: in play mode the player can ${({ ore: 'mine it', tree: 'chop it', herb: 'gather it', fish: 'fish here' })[def.interact] || 'use it'}. It runs out and regrows.</p>`;
        h += `<div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>`;
      } else if (o.kind === 'wall') {
        h += wallRows(o) + `<div class="row"><span>Closed loop</span><input type="checkbox" data-o="closed" ${o.closed ? 'checked' : ''}></div><div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div><p class="help"><kbd>Alt</kbd>+click on this wall toggles a door gap. ${(o.gaps || []).length} gap(s).</p>`;
      } else if (o.kind === 'bridge') {
        h += `<div class="row"><span>Width</span><input type="range" min="1" max="3" step="0.1" value="${o.w || 1.6}" data-o="w"><span class="val">${(o.w || 1.6).toFixed(1)}</span></div><div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>
          <p class="help">Length ${Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]).toFixed(1)} units. Drag the yellow end handles to re-land it.</p>`;
      }
      h += `<div class="row" style="margin-top:10px"><button class="b" data-a="dup">Duplicate</button><button class="b" data-a="del" style="background:#f2d7d7;color:#7a1f1f">Delete</button></div>` + help;
      return h;
    }
    bindSelectionPanel(root) {
      const o = this.sel && this.doc.obj(this.sel);
      const nm = root.querySelector('[data-k=name]'); if (nm) nm.onchange = () => { this.doc.name = nm.value || 'Untitled world'; this.autosave(); };
      if (!o) return;
      let before = null;
      const live = (k, v) => {
        if (before == null) before = JSON.stringify(this.doc.objects);
        const t = this.doc.obj(o.id); t[k] = typeof v === 'number' ? r3(v) : v; if (k === 'h' && t.hs) delete t.hs; if (v === '' && (k === 'name')) delete t[k];
        this.renderer.objectsChanged(); this.overlay.selection();
      };
      const done = () => { if (before != null) { this.pushOp({ label: 'edit ' + describe(o), objs: [before, JSON.stringify(this.doc.objects)] }); before = null; } };
      root.querySelectorAll('[data-o]').forEach((el) => {
        const k = el.dataset.o;
        el.oninput = () => {
          const v = el.type === 'checkbox' ? el.checked : el.dataset.str ? el.value.trim() : +el.value; live(k, v);
          if (el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = k === 'rot' ? Math.round(v * 57.3) + '°' : (+v).toFixed(k === 's' ? 2 : 1);
        };
        el.onchange = () => { el.oninput(); done(); };
      });
      bindWallRows(root, o, done, live);
      root.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'del') this.deleteSel(); else if (a === 'dup') this.duplicateSel();
        else if (a === 'reseed') this.commitObjects('reroll', (d) => { d.obj(o.id).seed = (Math.random() * 99999) | 0; });
      }));
    }
    /* ---- tools / UI ---- */
    buildToolbar() {
      const L = [['select', '⬚', 'Select', 'V'], null, ['paint', '▦', 'Terrain', 'T'], ['height', '⛰', 'Height', 'H'], ['carve', '⌇', 'Chasm', 'C'], null, ['wall', '▤', 'Wall', 'W'], ['room', '▣', 'Room', 'R'], ['bridge', '⊟', 'Bridge', 'J'], ['prop', '✱', 'Props', 'P']];
      $('tools').innerHTML = L.map((t) => (t ? `<button data-tool="${t[0]}" title="${t[2]} (${t[3]})"><span class="ic">${t[1]}</span>${t[2]}<span class="k">${t[3]}</span></button>` : '<div class="grp"></div>')).join('');
      $('tools').querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => this.setTool(b.dataset.tool)));
    }
    setTool(name) {
      if (this.tool) this.tool.cancel(); this.toolName = name; this.tool = this.tools[name];
      $('tools').querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === name));
      this.renderer3.domElement.style.cursor = this.tool.cursor();
      this.overlay.brush(null); this.overlay.poly([], false); this.overlay.hoverObj(null);
      this.panel();
    }
    panel() { if (!this.tool || !this.doc) return; const root = $('insp'); root.innerHTML = this.tool.options(); this.tool.bind(root); }
    drawIcons(root) {
      root.querySelectorAll('canvas[data-icon]').forEach((c) => {
        const k = c.dataset.icon, def = PropBuilder.PROPS[k], ctx = c.getContext('2d');
        if (def.interact && K.Icons) { const ic = { ore: 'ore', tree: 'log', herb: 'herb', fish: 'fish' }[def.interact] || 'bag'; ctx.imageSmoothingEnabled = false; ctx.drawImage(K.Icons.base(ic), 0, 0, 28, 28); return; }
        if (def.sprite) { const sp = this.renderer.lib.get(def.sprite), f = sp.frames[0]; const tmp = this.renderer.bank.canvasOf(f); const s = Math.min(28 / f.w, 28 / f.h); c.width = Math.round(f.w * s); c.height = Math.round(f.h * s); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, c.width, c.height); return; }
        const pal = { campfire: ['#ff8f2e', '#5a1408'], torch: ['#ffc65a', '#30343e'], banner: ['#a8383a', '#47301c'], pine: ['#2a4733', '#c6d2e3'], deadtree: ['#4a382a', '#281d16'], shrub: ['#40633a', '#223a22'], rock: ['#4c4b52', '#2a2b31'], rubble: ['#605e64', '#dfe7f2'], crate: ['#765333', '#331f13'], crates: ['#765333', '#dfe7f2'], pillar: ['#78757a', '#dfe7f2'], log: ['#5c4836', '#dfe7f2'] }[k] || ['#888', '#444'];
        ctx.fillStyle = pal[1]; ctx.fillRect(6, 20, 16, 4); ctx.fillStyle = pal[0];
        if (k === 'pine') { ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(23, 22); ctx.lineTo(5, 22); ctx.fill(); }
        else if (k === 'campfire' || k === 'torch') { ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(20, 20); ctx.lineTo(8, 20); ctx.fill(); }
        else if (k === 'banner') { ctx.fillRect(9, 3, 2, 21); ctx.fillRect(11, 4, 9, 13); }
        else if (k === 'pillar') { ctx.fillRect(9, 4, 10, 18); }
        else ctx.fillRect(7, 9, 14, 12);
      });
    }
    status(t) { $('sInfo').textContent = t || ''; }
    toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), 2600); }
    setView(v) {
      this.view = v; $('bView').textContent = v === 'top' ? 'Orbit' : 'Top-down';
      const g = this.rig.goal;
      if (v === 'top') { this.savedOrbit = { yaw: g.yaw, pitch: g.pitch, dist: g.dist }; this.rig.set({ pitch: 1.53, yaw: 0, dist: Math.max(g.dist, 18) }); }
      else this.rig.set(this.savedOrbit || { pitch: 0.7, yaw: -0.2 });
    }
    serialize() { const d = this.doc; if (this.play.active) d.game = this.play.snapshot(); d.camera = { tx: r3(this.rig.goal.tx), ty: r3(this.rig.goal.ty), tz: r3(this.rig.goal.tz), yaw: r3(this.rig.goal.yaw), pitch: r3(this.rig.goal.pitch), dist: r3(this.rig.goal.dist) }; return d.toJSON(); }
    slug() { return (this.doc.name || 'world').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'world'; }
    download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    saveJSON(noDownload) {
      const txt = JSON.stringify(this.serialize());
      if (!noDownload) this.download(new Blob([txt], { type: 'application/json' }), this.slug() + '.world.json');
      this.toast(`Downloaded ${this.slug()}.world.json · ${(txt.length / 1024).toFixed(0)} KB`); this.dirtySince = false; this.updateDirty();
      return txt;
    }
    loadText(txt) {
      let doc;
      try { doc = WorldDoc.fromJSON(JSON.parse(txt)); } catch (e) { this.toast('Could not load: ' + e.message); return false; }
      this.setDoc(doc); this.toast(`Loaded "${doc.name}" · ${doc.w} × ${doc.h} tiles · ${doc.objects.length} objects`);
      return true;
    }
    async exportPNG(noDownload) {
      this.overlay.scene.visible = false; this.renderFrame(); this.overlay.scene.visible = true;
      const blob = await new Promise((res) => this.renderer3.domElement.toBlob(res, 'image/png'));
      if (!blob) { this.toast('PNG export failed.'); return null; }
      if (!noDownload) this.download(blob, this.slug() + '.png');
      this.toast(`Exported ${this.slug()}.png · ${(blob.size / 1024).toFixed(0)} KB`); return blob;
    }
    bindUI() {
      $('gSize').innerHTML = PRESETS.map((p, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${p[0]}</option>`).join('');
      $('nSize').innerHTML = $('gSize').innerHTML;
      $('bGen').onclick = async () => {
        const s = parseInt($('gSeed').value, 10); if (!isFinite(s)) return; const p = PRESETS[+$('gSize').value];
        if (this.dirtySince && !(await this.ask('Generate a new world?', 'Seed ' + s + ' replaces the world you are editing, which has unsaved changes. Save it first if you want to keep it.', 'Generate', true))) return;
        $('loading') || 0; this.toast('Generating…'); setTimeout(() => this.generate(s >>> 0, p[1], p[2]), 30);
      };
      $('gSeed').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('bGen').click(); e.stopPropagation(); });
      $('bNew').onclick = () => { $('modal').style.display = 'flex'; };
      $('nCancel').onclick = () => ($('modal').style.display = 'none');
      $('nOk').onclick = async () => {
        const p = PRESETS[+$('nSize').value]; $('modal').style.display = 'none';
        if (this.dirtySince && !(await this.ask('Start a new world?', 'The world you are editing has unsaved changes. Save it first if you want to keep it.', 'Start new', true))) return;
        this.newBlank(p[1], p[2], $('nName').value, +$('nBase').value);
      };
      $('bSave').onclick = () => this.saveJSON(); $('bPng').onclick = () => this.exportPNG(); $('bNoteDl').onclick = () => this.saveJSON();
      $('bSaveW').onclick = () => this.openSave(); $('bWorlds').onclick = () => this.openWorlds();
      $('bPlay').onclick = () => this.setPlay(!this.play.active);
      $('svCancel').onclick = () => $('saveModal').classList.remove('show');
      $('svOk').onclick = () => { $('saveModal').classList.remove('show'); this.saveWorld($('svName').value, false); };
      $('svCopy').onclick = () => { $('saveModal').classList.remove('show'); this.saveWorld($('svName').value, true); };
      $('svName').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('svOk').click(); if (e.key === 'Escape') $('svCancel').click(); });
      $('wlClose').onclick = () => $('worldsModal').classList.remove('show');
      $('wlOpenFile').onclick = () => { $('worldsModal').classList.remove('show'); $('file').click(); };
      $('wlDl').onclick = () => this.saveJSON();
      $('wlList').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'), r = e.target.closest('[data-id]'); if (b && r) this.worldsAction(r.dataset.id, b.dataset.a); });
      window.addEventListener('beforeunload', (e) => { if (this.dirtySince && !G.KINSTEAD_NO_UNLOAD_PROMPT) { e.preventDefault(); e.returnValue = ''; } });
      $('bOpen').onclick = () => $('file').click();
      $('file').onchange = async () => {
        const f = $('file').files[0]; $('file').value = ''; if (!f) return;
        if (this.dirtySince && !(await this.ask('Open this file?', 'The world you are editing has unsaved changes. They will be lost unless you save it first.', 'Open anyway', true))) return;
        f.text().then((t) => this.loadText(t));
      };
      $('bUndo').onclick = () => this.undo(); $('bRedo').onclick = () => this.redo();
      $('bView').onclick = () => this.setView(this.view === 'top' ? 'orbit' : 'top');
      $('bClose').onclick = () => { if (this.view === 'top') this.setView('orbit'); this.frameHero(false); };
      $('bFit').onclick = () => this.frameAll(false);
      $('tDof').onchange = (e) => (this.post.enabled.dof = e.target.checked);
      $('tBloom').onchange = (e) => (this.post.enabled.bloom = e.target.checked);
      $('tSnow').onchange = (e) => (this.renderer.snow.points.visible = e.target.checked);
      $('qual').onchange = (e) => { this.quality = +e.target.value; this.resize(); };
    }
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
    resize() {
      const tb = $('top').offsetHeight || 46; $('tools').style.top = $('insp').style.top = (tb + 18) + 'px'; $('insp').style.maxHeight = `calc(100vh - ${tb + 80}px)`;
      const w = Math.round(this.stage.clientWidth) || 1600, h = Math.round(this.stage.clientHeight) || 900;
      this.applySize(w, h);
    }
    applySize(w, h) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), pr = this.quality === 2 ? dpr : Math.min(dpr, 1) * this.quality;
      this.renderer3.setPixelRatio(pr); this.renderer3.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.post.setSize(Math.round(w * pr), Math.round(h * pr));
    }
    renderFrame() {
      const dist = this.rig.cur.dist;
      this.post.focus = dist; this.post.band = Math.max(dist * 0.07, this.play.active ? 2.4 : 0); this.post.range = Math.max(dist * 0.22, this.play.active ? 4 : 0);   // in play, characters always stay sharp
      const tgt = new V3(this.rig.cur.tx, this.rig.cur.ty, this.rig.cur.tz);
      this.renderer.update(this.time, this.camera, this.post.h, tgt, dist, this.rig.cur.pitch);
      this.post.render(this.renderer.scene, this.camera, this.time);
      if (this.overlay.scene.visible) { const r = this.renderer3; r.autoClear = false; r.setRenderTarget(null); r.clearDepth(); r.render(this.overlay.scene, this.camera); r.autoClear = true; }
    }
    frame() {
      const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.time = this.fixedTime !== null ? this.fixedTime : this.time + dt;
      if (this.play.active) this.play.update(this.fixedTime !== null ? 1 / 60 : dt);
      this.rig.update(this.fixedTime !== null ? 1 : dt, this.time);
      this.renderer.work(this.renderer.pending > 0 ? 12 : 4);
      this.renderFrame();
      if (this.play.active) this.play.ui.frame(dt);
      else if (!this.roleT || now - this.roleT > 400) { this.roleT = now; this.overlay.roles(); }
      this.frames.push(now); while (this.frames.length && now - this.frames[0] > 1000) this.frames.shift();
      if (!this.fpsT || now - this.fpsT > 500) { this.fpsT = now; $('sFps').textContent = `${this.frames.length} fps${this.renderer.pending ? ' · painting ' + this.renderer.pending + ' chunk jobs' : ''}`; }
    }
    /* test hook: deterministic capture at a given size and time (same as the diorama's) */
    capture(w, h, t, view, sharp) {
      this.renderer.finishAll(); const q = this.quality; if (sharp) this.quality = 2;
      if (view === 'closeup') this.frameHero(true); else if (view === 'overview') { const b = this.doc.objects.find((o) => o.kind === 'bridge'); this.rig.set({ tx: b.a[0] - 1.8, ty: 0, tz: b.a[1] - 0.4, yaw: -0.2, pitch: 0.7, dist: 21 }, true); }
      this.applySize(w, h); this.fixedTime = t; this.overlay.scene.visible = false; this.frame(); this.overlay.scene.visible = true; this.fixedTime = null;
      const url = this.renderer3.domElement.toDataURL('image/jpeg', 0.9); this.quality = q; this.resize(); return url;
    }
  }
  const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const describe = (o) => (o.kind === 'prop' ? (PropBuilder.PROPS[o.type] || { name: o.type }).name : o.kind === 'building' ? (K.BUILDING_PREFABS[o.prefab] || {name:'Building'}).name : o.kind === 'bridge' ? 'Bridge' : o.closed ? 'Ruined room' : 'Wall');
  Object.assign(K, { BuilderApp });
})(typeof window !== 'undefined' ? window : globalThis);
