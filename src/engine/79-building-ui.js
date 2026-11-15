/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Building editor integration. All changes use the builder's object history and serializer. */
(function (G) {
  const K = G.K, T = K.TILE, E = new K.BuildingEdit();

  class BuildingUiText {
    static escape(value) {
      const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(value).replace(/[&<>"']/g, (char) => entities[char]);
    }
  }

  class BuildingTool {
    constructor(app, furniture = false) {
      this.app = app; this.furniture = furniture; this.rot = 0; this.chosen = null;
    }
    get doc() { return this.app.doc; }
    cursor() { return 'crosshair'; }
    cancel() { this.drag = null; }
    up() {}
    dbl() {}
    candidate(point) {
      if (!point) return null;
      const [i, j] = this.doc.tileOf(point.x, point.z);
      let building = K.makeBuilding(this.app.ui.prefab || 'cottage', i, j, 'preview', this.doc.seed);
      for (let turn = 0; turn < this.rot; turn++) building = E.rotate(building);
      building.x = i; building.z = j;
      return building;
    }
    hover(point) {
      this.app.overlay.brush(null);
      if (!point) { this.app.overlay.hov.visible = false; return; }
      const building = this.furniture ? this.doc.obj(this.app.interiorId) : this.candidate(point);
      if (!building) return;
      if (!this.furniture) {
        this.app.overlay.poly([], false);
        this.app.overlay.setPts(this.app.overlay.hov, this.app.overlay.outline(building));
        return;
      }
      const [i, j] = this.doc.tileOf(point.x, point.z);
      const def = K.FURNITURE[this.app.ui.furniture || 'bed'];
      const [w, h] = K.FurnitureFootprint.size(def, this.rot);
      const x = i * T, z = j * T;
      this.app.overlay.poly([[x, z], [x + w * T, z], [x + w * T, z + h * T],
        [x, z + h * T], [x, z]], false);
    }
    move(_event, point) { this.hover(point); }
    down(event, point) {
      if (!point) return;
      const app = this.app;
      if (!this.furniture) return this.placeBuilding(point);
      const building = this.doc.obj(app.interiorId);
      if (!building) return app.toast('Select a building, then Enter interior first.');
      const [i, j] = this.doc.tileOf(point.x, point.z), x = i - building.x, z = j - building.z;
      const old = E.furnitureAt(building, x, z);
      if (event.altKey) {
        this.chosen = old && old.id;
        if (old) this.rot = old.rot || 0;
        app.panel();
        return;
      }
      const item = this.furnitureItem(building, x, z);
      const errors = E.furnitureProblems(building, item);
      if (errors.length) return app.toast(errors[0]);
      app.commitObjects(this.chosen ? 'move furniture' : 'place furniture', () => {
        const index = building.furniture.findIndex((entry) => entry.id === item.id);
        if (index < 0) building.furniture.push(item); else building.furniture[index] = item;
      });
      this.chosen = null; app.panel();
    }
    placeBuilding(point) {
      const building = this.candidate(point), errors = E.placementProblems(this.doc, building);
      if (errors.length) return this.app.toast(errors[0]);
      this.app.commitObjects('place ' + building.prefab, (doc) => {
        building.id = doc.uid('b'); doc.objects.push(building); this.app.sel = building.id;
      });
      this.app.panel();
    }
    furnitureItem(building, x, z) {
      if (!this.chosen) return { id: E.nextFurnitureId(building), type: this.app.ui.furniture || 'bed', x, z, rot: this.rot };
      const existing = building.furniture.find((entry) => entry.id === this.chosen);
      return Object.assign({}, existing, { x, z, rot: this.rot });
    }
    key(event) {
      const key = event.key.toLowerCase();
      if (key === 'q' || key === 'e') {
        this.rot = (this.rot + (key === 'e' ? 1 : 3)) % 4;
        this.app.panel(); this.hover(this.app.hoverP); return true;
      }
      if ((key === 'delete' || key === 'backspace') && this.chosen) { this.remove(); return true; }
      return false;
    }
    remove() {
      const building = this.doc.obj(this.app.interiorId);
      if (building && this.chosen) this.app.commitObjects('remove furniture', () => {
        building.furniture = building.furniture.filter((item) => item.id !== this.chosen);
      });
      this.chosen = null; this.app.panel();
    }
    options() {
      if (!this.furniture) return this.buildingOptions();
      const building = this.doc.obj(this.app.interiorId);
      const name = building ? BuildingUiText.escape(building.prefab) : 'Select a building first.';
      const options = Object.entries(K.FURNITURE).map(([id, item]) =>
        `<option value="${id}" ${(this.app.ui.furniture || 'bed') === id ? 'selected' : ''}>` +
        `${BuildingUiText.escape(item.group || 'Decor')} · ${BuildingUiText.escape(item.name)}</option>`).join('');
      const remove = this.chosen ? '<button class="b" data-remove>Remove selected furniture</button>' : '';
      return `<h2>Interior furniture</h2><p>${name}</p><select data-furniture>${options}</select>` +
        '<p class="help">Click to place. Q/E rotates. Alt-click an existing item, then click its new location. ' +
        'Delete removes the selected item.</p>' + remove +
        '<button class="b" data-exit>Leave interior</button>';
    }
    buildingOptions() {
      const options = Object.entries(K.BUILDING_PREFABS).map(([id, item]) =>
        `<option value="${id}" ${(this.app.ui.prefab || 'cottage') === id ? 'selected' : ''}>` +
        `${BuildingUiText.escape(item.name)}</option>`).join('');
      return '<h2>Buildings</h2><select data-prefab>' + options + '</select>' +
        '<p class="help">Click the footprint to place. Q/E rotates. Select a building to move, rotate, delete or enter its interior.</p>' +
        `<p>Rotation: ${this.rot * 90}°</p>`;
    }
    bind(root) {
      const prefab = root.querySelector('[data-prefab]');
      if (prefab) prefab.onchange = () => { this.app.ui.prefab = prefab.value; };
      const furniture = root.querySelector('[data-furniture]');
      if (furniture) furniture.onchange = () => { this.app.ui.furniture = furniture.value; this.chosen = null; };
      const remove = root.querySelector('[data-remove]');
      if (remove) remove.onclick = () => this.remove();
      const exit = root.querySelector('[data-exit]');
      if (exit) exit.onclick = () => { this.app.leaveInterior(); this.app.setTool('select'); };
    }
  }

  class BuildingBuilderApp extends K.BuilderApp {
    leaveInterior() {
      const building = this.renderer.buildings.get(this.interiorId);
      if (building) building.setInterior(false, { camera: this.camera });
      this.interiorId = null;
    }
    enterInterior(id) {
      this.leaveInterior(); this.interiorId = id;
      const building = this.renderer.buildings.get(id);
      if (!building) return;
      building.setInterior(true, { camera: this.camera });
      this.rig.set({ tx: (building.spec.x + building.spec.footprint.w / 2) * T,
        tz: (building.spec.z + building.spec.footprint.h / 2) * T, dist: 11, pitch: 1.05 });
      this.setTool('furniture');
    }
    start() {
      this.tools.building = new BuildingTool(this);
      this.tools.furniture = new BuildingTool(this, true);
      this.renderer.onBuildings = () => {
        if (!this.interiorId || this.play.active) return;
        const building = this.renderer.buildings.get(this.interiorId);
        if (building) building.setInterior(true, { camera: this.camera, snap: true });
      };
      return super.start();
    }
    buildToolbar() {
      super.buildToolbar();
      const root = document.getElementById('tools');
      for (const [id, label] of [['building', '⌂ Buildings'], ['furniture', '▣ Furniture']]) {
        const button = document.createElement('button');
        button.dataset.tool = id; button.textContent = label;
        button.title = id === 'building' ? 'Buildings (B)' : 'Furniture (U)';
        button.onclick = () => this.setTool(id); root.appendChild(button);
      }
    }
    selectionPanel() {
      let html = super.selectionPanel();
      const object = this.sel && this.doc.obj(this.sel);
      if (object && object.kind === 'building') html +=
        '<button class="b pri" data-interior>Enter interior / furniture</button>' +
        '<button class="b" data-turn>Rotate 90°</button>';
      return html;
    }
    bindSelectionPanel(root) {
      super.bindSelectionPanel(root);
      const interior = root.querySelector('[data-interior]');
      if (interior) interior.onclick = () => this.enterInterior(this.sel);
      const turn = root.querySelector('[data-turn]');
      if (turn) turn.onclick = () => this.rotateSel(1);
    }
    setPlay(on) { if (on) this.leaveInterior(); return super.setPlay(on); }
    setDoc(doc, label) { this.leaveInterior(); return super.setDoc(doc, label); }
  }

  class VillageWorldGenerator extends K.WorldGenerator {
    generate(w, h, name) {
      const doc = super.generate(w, h, name);
      if (w < 50 || h < 38) return doc;
      const specs = [K.makeBuilding('cottage', 2, 3, doc.uid('b'), doc.seed),
        K.makeBuilding('smithy', 2, 19, doc.uid('b'), doc.seed + 1),
        K.makeBuilding('stable', 22, 3, doc.uid('b'), doc.seed + 2)];
      this.clearVillageSite(doc, specs, w, h);
      doc.objects.push({ id: doc.uid('p'), kind: 'prop', type: 'res:ore', x: 8.75, z: 8.25, s: 1, seed: doc.seed },
        { id: doc.uid('p'), kind: 'prop', type: 'res:pine', x: 10.25, z: 8.25, s: 1, seed: doc.seed + 1 });
      doc.objects.push(...specs); doc.objects = doc.objects.filter((object) => object.type !== 'start');
      this.addVillageStart(doc, specs[0]);
      return doc;
    }
    clearVillageSite(doc, specs, width, height) {
      const boxes = specs.map((building) => [building.x - 1, building.z - 1,
        building.x + building.footprint.w + 2, building.z + building.footprint.h + 3]);
      doc.objects = doc.objects.filter((object) => !boxes.some((box) => this.overlapsSite(object, box)));
      for (const [x, z, x1, z1] of boxes) for (let j = z; j <= z1 && j < height; j++) {
        for (let i = x; i <= x1 && i < width; i++) this.setSnow(doc, i, j);
      }
      for (let j = 14; j <= 23; j++) for (let i = 15; i <= 21; i++) this.setSnow(doc, i, j);
    }
    overlapsSite(object, [x, z, x1, z1]) {
      let bounds;
      if (object.kind === 'prop') bounds = [object.x / T, object.z / T, object.x / T, object.z / T];
      else if (object.kind === 'bridge') bounds = [Math.min(object.a[0], object.b[0]) / T,
        Math.min(object.a[1], object.b[1]) / T, Math.max(object.a[0], object.b[0]) / T,
        Math.max(object.a[1], object.b[1]) / T];
      else bounds = [Math.min(...object.pts.map((point) => point[0])) / T,
        Math.min(...object.pts.map((point) => point[1])) / T,
        Math.max(...object.pts.map((point) => point[0])) / T,
        Math.max(...object.pts.map((point) => point[1])) / T];
      return bounds[0] <= x1 && bounds[2] >= x && bounds[1] <= z1 && bounds[3] >= z;
    }
    setSnow(doc, i, j) {
      const index = doc.idx(i, j); doc.terrain[index] = K.T.SNOW; doc.height[index] = 0;
    }
    addVillageStart(doc, building) {
      const door = building.doors.find((entry) => entry.kind === 'exterior') || building.doors[0];
      const direction = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[door.side];
      const x = building.x + door.x + direction[0] * 2, z = building.z + door.z + direction[1] * 2;
      doc.objects.push({ id: doc.uid('p'), kind: 'prop', type: 'start', hero: 'warden',
        x: (x + 0.5) * T, z: (z + 0.5) * T, s: 1, seed: doc.seed });
    }
  }

  Object.assign(K, { BuildingTool, BuilderApp: BuildingBuilderApp, WorldGenerator: VillageWorldGenerator });
})(window);
