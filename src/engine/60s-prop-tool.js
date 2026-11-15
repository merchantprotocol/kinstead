/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;
  const SCATTER = ['pine', 'shrub', 'rock', 'rubble', 'deadtree'];

  /* click to place a prop; drag to scatter trees, shrubs, rocks and rubble */
  class PropTool extends K.Tool {
    constructor(app) { super(app); this.rot = 0; }
    get def() { return K.PropBuilder.PROPS[this.app.ui.prop]; }
    scatterable() { return SCATTER.includes(this.app.ui.prop); }
    hover(p) { this.app.overlay.brush(p, this.def.r * (this.app.ui.propS || 1)); }
    place(p) {
      const ui = this.app.ui, R = Math.random, scatter = this.scatterable();
      if (ui.prop === 'start') this.dropOldStart();
      const o = {
        id: this.doc.uid('p'), kind: 'prop', type: ui.prop, x: U.round3(p.x), z: U.round3(p.z),
        rot: U.round3(scatter ? R() * 6.28 : this.rot), s: U.round3((ui.propS || 1) * (scatter ? 0.85 + R() * 0.3 : 1)), seed: (R() * 99999) | 0,
      };
      this.doc.objects.push(o);
      return o;
    }
    /* a world has one player start */
    dropOldStart() {
      const n = this.doc.objects.length;
      this.doc.objects = this.doc.objects.filter((x) => x.type !== 'start');
      if (this.doc.objects.length < n) this.app.toast('Moved the player start (a world has one).');
    }
    down(e, p) {
      if (!p) return;
      this.before = JSON.stringify(this.doc.objects);
      const o = this.place(p);
      this.last = p;
      this.n = 1;
      this.lastId = o.id;
      this.app.renderer.objectsChanged();
    }
    move(e, p) {
      this.hover(p);
      if (!this.before || !p || !this.scatterable()) return;
      const spacing = this.def.r * 2.2 * (this.app.ui.propS || 1);
      if (Math.hypot(p.x - this.last.x, p.z - this.last.z) < spacing) return;
      const a = Math.random() * 6.28, jitter = spacing * 0.35;
      this.place({ x: p.x + Math.cos(a) * jitter, z: p.z + Math.sin(a) * jitter });
      this.last = p;
      this.n++;
      this.app.renderer.objectsChanged();
    }
    up() {
      if (!this.before) return;
      const name = this.def.name.toLowerCase(), label = this.n > 1 ? 'scatter ' + this.n + ' ' + name : 'place ' + name;
      this.app.pushOp({ label, objs: [this.before, JSON.stringify(this.doc.objects)] });
      this.before = null;
      if (this.n === 1) this.app.sel = this.lastId;
      this.app.panel();
    }
    cancel() {
      if (!this.before) return;
      this.doc.objects = JSON.parse(this.before);
      this.before = null;
      this.app.renderer.objectsChanged();
    }
    key(e) {
      if (e.key !== 'q' && e.key !== 'e') return false;
      this.rot += (e.key === 'e' ? 1 : -1) * Math.PI / 8;
      this.app.toast('Next prop faces ' + Math.round(this.rot * 180 / Math.PI) + '°');
      return true;
    }
    button(k, d) {
      const on = this.app.ui.prop === k ? 'on' : '';
      const icon = `<canvas data-icon="${k}" width="28" height="28"></canvas>`;
      return `<button data-p="${k}" class="${on}" title="${d.name}">${icon}${d.name.replace('The ', '')}</button>`;
    }
    options() {
      const ui = this.app.ui, groups = {}, scale = ui.propS || 1;
      for (const [k, d] of Object.entries(K.PropBuilder.PROPS)) (groups[d.group] = groups[d.group] || []).push([k, d]);
      let h = '<h2>Props</h2>';
      for (const [g, list] of Object.entries(groups)) h += `<h3>${g}</h3><div class="pl">${list.map(([k, d]) => this.button(k, d)).join('')}</div>`;
      h += `<div class="row" style="margin-top:10px"><span>Scale</span><input type="range" min="0.5" max="2" step="0.05" value="${scale}" data-k="ps">`
        + `<span class="val">${scale.toFixed(2)}</span></div>`;
      h += '<p class="help">Click to place. Drag to scatter trees, shrubs, rocks and rubble. <kbd>Q</kbd>/<kbd>E</kbd> turn the next prop. '
        + 'Props snap onto bridge decks.</p>';
      return h;
    }
    bind(root) {
      root.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { this.app.ui.prop = b.dataset.p; this.app.panel(); }));
      const s = root.querySelector('[data-k=ps]');
      s.oninput = () => { this.app.ui.propS = +s.value; s.nextElementSibling.textContent = (+s.value).toFixed(2); };
      new K.PropIconPainter(this.app.renderer).paintAll(root);
    }
  }
  K.PropTool = PropTool;
})(typeof window !== 'undefined' ? window : globalThis);
