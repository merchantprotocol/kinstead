/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const { TILE, HQ, T, TERRAINS } = K;
  const U = K.BuilderAppUtils;
  const NOTE = 'font-size:11px;color:#6a7588';

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
    set size(v) { this.app.ui.size[this.kind] = U.clamp(Math.round(v), 1, 24); }
    hover(p) { this.app.overlay.brush(p, this.size * TILE); }
    tilesIn(p) {
      const r = this.size, out = [], [ci, cj] = this.doc.tileOf(p.x, p.z), rr = (r - 0.5) * (r - 0.5) + 0.3;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = ci + di, j = cj + dj;
          if (!this.doc.inside(i, j)) continue;
          const cx = (i + 0.5) * TILE - p.x, cz = (j + 0.5) * TILE - p.z;
          if ((cx * cx + cz * cz) / (TILE * TILE) <= rr) out.push([i, j, Math.sqrt(cx * cx + cz * cz) / (r * TILE)]);
        }
      }
      return out;
    }
    down(e, p) {
      if (!p) return;
      this.stroke = new K.TileStroke(this.doc);
      this.last = p;
      this.start = p;
      this.begin(e, p);
      this.dab(p);
    }
    move(e, p) {
      this.hover(p);
      if (!this.stroke || !p) return;
      const last = this.last, d = Math.hypot(p.x - last.x, p.z - last.z), step = Math.max(0.2, this.size * TILE * 0.4);
      const n = Math.ceil(d / step);
      for (let k = 1; k <= n; k++) this.dab({ x: last.x + (p.x - last.x) * k / n, z: last.z + (p.z - last.z) * k / n });
      this.last = p;
    }
    up() {
      if (!this.stroke) return;
      const td = this.stroke.finish();
      this.stroke = null;
      if (td) this.app.pushOp({ label: this.label(), tiles: td });
    }
    cancel() {
      if (!this.stroke) return;
      const td = this.stroke.finish();
      this.stroke = null;
      if (!td) return;
      K.TileStroke.apply(this.doc, td, 'old');
      this.app.renderer.tilesChanged(...td.box);
    }
    begin() {}
    dab(p) {
      let b = [1e9, 1e9, -1e9, -1e9], any = false;
      for (const [i, j, d] of this.tilesIn(p)) {
        if (!this.apply(i, j, d)) continue;
        any = true;
        b = [Math.min(b[0], i), Math.min(b[1], j), Math.max(b[2], i + 1), Math.max(b[3], j + 1)];
      }
      if (any) this.app.renderer.tilesChanged(...b);
    }
    key(e) {
      if (e.key !== '[' && e.key !== ']') return false;
      this.size = this.size + (e.key === ']' ? 1 : -1);
      this.app.panel();
      this.hover(this.app.hoverP);
      return true;
    }
    sizeRow() {
      return `<div class="row"><span>Brush size</span><input type="range" min="1" max="24" value="${this.size}" data-k="size">`
        + `<span class="val">${this.size}</span></div>`
        + '<p class="help"><kbd>[</kbd> <kbd>]</kbd> change size. Right-drag orbits, middle-drag or <kbd>Space</kbd>-drag pans.</p>';
    }
    bind(root) {
      const s = root.querySelector('[data-k=size]');
      if (s) s.oninput = () => { this.size = +s.value; s.nextElementSibling.textContent = this.size; };
    }
  }

  class PaintTool extends BrushTool {
    constructor(app) { super(app, 'paint'); }
    get paintable() { return TERRAINS.filter((t) => t.id !== T.CHASM); }
    label() { return 'paint ' + TERRAINS[this.app.ui.terrain].name.toLowerCase(); }
    apply(i, j) {
      const d = this.doc, k = d.idx(i, j);
      if (d.terrain[k] === T.CHASM) return false;   // painting never fills a chasm; use Carve → Fill
      return this.stroke.set(i, j, this.app.ui.terrain, null);
    }
    swatch(t, q) {
      const on = this.app.ui.terrain === t.id ? 'on' : '';
      return `<button data-t="${t.id}" class="${on}" title="${t.name} (${q + 1})"><i style="background:${t.sw}"></i>${t.name.split(' ')[0]}</button>`;
    }
    options() {
      return `<h2>Paint terrain</h2><div class="sw">${this.paintable.map((t, q) => this.swatch(t, q)).join('')}</div>${this.sizeRow()}`
        + '<p class="help">Number keys <kbd>1</kbd>–<kbd>7</kbd> pick a terrain. Edges blend with the diorama\'s dithered noise. '
        + 'Chasm floors stay put: use <b>Carve</b>.</p>';
    }
    bind(root) {
      super.bind(root);
      root.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { this.app.ui.terrain = +b.dataset.t; this.app.panel(); }));
    }
    key(e) {
      const ids = this.paintable.map((t) => t.id), n = +e.key;
      if (n >= 1 && n <= ids.length && !e.ctrlKey && !e.metaKey) { this.app.ui.terrain = ids[n - 1]; this.app.panel(); return true; }
      return super.key(e);
    }
  }

  class HeightTool extends BrushTool {
    constructor(app) { super(app, 'height'); }
    label() { return { raise: 'raise ground', lower: 'lower ground', level: 'level ground' }[this.app.ui.hmode]; }
    begin(e, p) {
      if (!e.altKey) return;
      this.app.ui.level = this.doc.tileY(p.x, p.z);
      this.app.panel();
      this.app.toast('Level picked: ' + this.app.ui.level);
      this.stroke = null;
    }
    dab(p) { if (this.stroke) super.dab(p); }
    apply(i, j) {
      const ui = this.app.ui, d = this.doc, k = d.idx(i, j);
      if (this.stroke.touched(k)) return false;
      const step = Math.round(ui.step / HQ), h = d.height[k];
      const nh = ui.hmode === 'raise' ? h + step : ui.hmode === 'lower' ? h - step : Math.round(ui.level / HQ);
      let nt = null;
      if (d.terrain[k] === T.CHASM && nh * HQ > -2) nt = T.SNOW;  // raised out of a chasm -> snow again
      if (ui.hmode === 'lower' && nh * HQ < -6 && d.terrain[k] !== T.CHASM) nt = T.CHASM;
      return this.stroke.set(i, j, nt, nh);
    }
    options() {
      const ui = this.app.ui;
      const modes = ['raise', 'lower', 'level'].map((m) => {
        const name = m[0].toUpperCase() + m.slice(1);
        return `<button class="b ${ui.hmode === m ? 'on' : ''}" data-m="${m}">${name}</button>`;
      });
      const steps = [0.25, 0.5, 0.75, 1.75].map((v) => `<option ${ui.step === v ? 'selected' : ''}>${v}</option>`).join('');
      return `<h2>Height</h2><div class="seg">${modes.join('')}</div>`
        + `<div class="row"><span>Step</span><select data-k="step">${steps}</select><span style="${NOTE}">units / stroke</span></div>`
        + `<div class="row"><span>Level</span><input type="number" step="0.25" value="${ui.level}" data-k="level">`
        + `<span style="${NOTE}"><kbd>Alt</kbd>+click picks</span></div>`
        + `${this.sizeRow()}<p class="help">Each stroke moves a tile once, so cliffs come out as clean block terraces. `
        + 'Faces at or above 1.5 use the dark rock strata, lower ones the snowy cliff strata with icicles.</p>';
    }
    bind(root) {
      super.bind(root);
      const ui = this.app.ui;
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
      const ui = this.app.ui, on = (m) => (ui.cmode === m ? 'on' : '');
      return `<h2>Chasm</h2><div class="seg"><button class="b ${on('carve')}" data-m="carve">Carve</button>`
        + `<button class="b ${on('fill')}" data-m="fill">Fill</button></div>`
        + `<div class="row"><span>Depth</span><input type="range" min="-16" max="-3" step="0.5" value="${ui.depth}" data-k="depth">`
        + `<span class="val">${ui.depth}</span></div>`
        + `${this.sizeRow()}<p class="help">Carve cuts a chasm with snowy ledges along the rim and a pine-forest floor far below. `
        + `Fill raises it back to the <b>Height → Level</b> value (${ui.level}).</p>`;
    }
    bind(root) {
      super.bind(root);
      const ui = this.app.ui;
      root.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { ui.cmode = b.dataset.m; this.app.panel(); }));
      const dp = root.querySelector('[data-k=depth]');
      dp.oninput = () => { ui.depth = +dp.value; dp.nextElementSibling.textContent = ui.depth; };
    }
  }

  Object.assign(K, { Tool, BrushTool, PaintTool, HeightTool, CarveTool });
})(typeof window !== 'undefined' ? window : globalThis);
