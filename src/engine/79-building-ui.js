/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Building editor integration. All changes use the builder's object history and serializer. */
(function (G) {
  const K = G.K, T = K.TILE;
  const U = K.BuilderAppUtils;

  /* the Buildings tool (place a prefab footprint) and, with furniture=true, the interior Furniture tool */
  class BuildingTool {
    constructor(app, furniture = false) {
      this.app = app;
      this.furniture = furniture;
      this.rot = 0;
      this.chosen = null;
      this.edit = new K.BuildingEdit();
    }
    get doc() { return this.app.doc; }
    get interior() { return this.doc.obj(this.app.interiors.id); }
    cursor() { return 'crosshair'; }
    cancel() { this.drag = null; }
    up() {}
    dbl() {}
    move(e, p) { this.hover(p); }
    candidate(p) {
      if (!p) return null;
      const [i, j] = this.doc.tileOf(p.x, p.z);
      let b = K.makeBuilding(this.app.ui.prefab || 'cottage', i, j, 'preview', this.doc.seed);
      for (let k = 0; k < this.rot; k++) b = this.edit.rotate(b);
      b.x = i;
      b.z = j;
      return b;
    }
    hover(p) {
      const overlay = this.app.overlay;
      overlay.brush(null);
      if (!p) { overlay.hov.visible = false; return; }
      const b = this.furniture ? this.interior : this.candidate(p);
      if (!b) return;
      if (!this.furniture) {
        overlay.poly([], false);
        overlay.setPts(overlay.hov, overlay.outline(b));
        return;
      }
      overlay.poly(this.furnitureFootprint(p), false);
    }
    furnitureFootprint(p) {
      const [i, j] = this.doc.tileOf(p.x, p.z), def = K.FURNITURE[this.app.ui.furniture || 'bed'];
      const [w, h] = K.FurnitureFootprint.size(def, this.rot), x = i * T, z = j * T;
      return [[x, z], [x + w * T, z], [x + w * T, z + h * T], [x, z + h * T], [x, z]];
    }
    down(e, p) {
      if (!p) return;
      if (this.furniture) this.placeFurniture(e, p);
      else this.placeBuilding(p);
    }
    placeBuilding(p) {
      const app = this.app, b = this.candidate(p), problems = this.edit.placementProblems(this.doc, b);
      if (problems.length) { app.toast(problems[0]); return; }
      app.commitObjects('place ' + b.prefab, (d) => {
        b.id = d.uid('b');
        d.objects.push(b);
        app.sel = b.id;
      });
      app.panel();
    }
    placeFurniture(e, p) {
      const app = this.app, b = this.interior;
      if (!b) { app.toast('Select a building, then Enter interior first.'); return; }
      const [i, j] = this.doc.tileOf(p.x, p.z), x = i - b.x, z = j - b.z;
      if (e.altKey) { this.pickUp(this.edit.furnitureAt(b, x, z)); return; }
      const f = this.chosen
        ? Object.assign({}, b.furniture.find((v) => v.id === this.chosen), { x, z, rot: this.rot })
        : { id: this.edit.nextFurnitureId(b), type: app.ui.furniture || 'bed', x, z, rot: this.rot };
      const problems = this.edit.furnitureProblems(b, f);
      if (problems.length) { app.toast(problems[0]); return; }
      app.commitObjects(this.chosen ? 'move furniture' : 'place furniture', () => {
        const n = b.furniture.findIndex((v) => v.id === f.id);
        if (n < 0) b.furniture.push(f); else b.furniture[n] = f;
      });
      this.chosen = null;
      app.panel();
    }
    /* Alt-click: choose an existing item to move */
    pickUp(item) {
      this.chosen = item && item.id;
      if (item) this.rot = item.rot || 0;
      this.app.panel();
    }
    key(e) {
      const k = e.key.toLowerCase();
      if (k === 'q' || k === 'e') {
        this.rot = (this.rot + (k === 'e' ? 1 : 3)) % 4;
        this.app.panel();
        this.hover(this.app.hoverP);
        return true;
      }
      if ((k === 'delete' || k === 'backspace') && this.chosen) { this.remove(); return true; }
      return false;
    }
    remove() {
      const b = this.interior;
      if (b && this.chosen) this.app.commitObjects('remove furniture', () => { b.furniture = b.furniture.filter((f) => f.id !== this.chosen); });
      this.chosen = null;
      this.app.panel();
    }
    options() { return this.furniture ? this.furnitureOptions() : this.buildingOptions(); }
    buildingOptions() {
      const current = this.app.ui.prefab || 'cottage';
      const opts = Object.entries(K.BUILDING_PREFABS)
        .map(([id, d]) => `<option value="${id}" ${current === id ? 'selected' : ''}>${U.escapeHtml(d.name)}</option>`).join('');
      return `<h2>Buildings</h2><select data-prefab>${opts}</select>`
        + '<p class="help">Click the footprint to place. Q/E rotates. Select a building to move, rotate, delete or enter its interior.</p>'
        + `<p>Rotation: ${this.rot * 90}°</p>`;
    }
    furnitureOptions() {
      const b = this.interior, current = this.app.ui.furniture || 'bed';
      const opts = Object.entries(K.FURNITURE).map(([id, d]) => {
        const label = `${U.escapeHtml(d.group || 'Decor')} · ${U.escapeHtml(d.name)}`;
        return `<option value="${id}" ${current === id ? 'selected' : ''}>${label}</option>`;
      }).join('');
      return `<h2>Interior furniture</h2><p>${b ? U.escapeHtml(b.prefab) : 'Select a building first.'}</p><select data-furniture>${opts}</select>`
        + '<p class="help">Click to place. Q/E rotates. Alt-click an existing item, then click its new location. Delete removes the selected item.</p>'
        + (this.chosen ? '<button class="b" data-remove>Remove selected furniture</button>' : '')
        + '<button class="b" data-exit>Leave interior</button>';
    }
    bind(root) {
      const app = this.app;
      const prefab = root.querySelector('[data-prefab]');
      if (prefab) prefab.onchange = () => { app.ui.prefab = prefab.value; };
      const furniture = root.querySelector('[data-furniture]');
      if (furniture) furniture.onchange = () => { app.ui.furniture = furniture.value; this.chosen = null; };
      const remove = root.querySelector('[data-remove]');
      if (remove) remove.onclick = () => this.remove();
      const exit = root.querySelector('[data-exit]');
      if (exit) exit.onclick = () => { app.interiors.leave(); app.setTool('select'); };
    }
  }
  K.BuildingTool = BuildingTool;
})(typeof window !== 'undefined' ? window : globalThis);
