/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Building interiors in the World Builder: the Buildings and Furniture tools, entering and leaving a building's
   interior, and the inspector buttons for a selected building. The BuilderApp owns one of these and calls it
   explicitly from its toolbar, inspector, play toggle and document lifecycle. */
(function (G) {
  const K = G.K;

  class EditorInteriors {
    constructor(app) { this.app = app; this.id = null; }
    registerTools(tools) {
      tools.building = new K.BuildingTool(this.app);
      tools.furniture = new K.BuildingTool(this.app, true);
    }
    attach() {
      this.app.renderer.onBuildings = () => {
        if (!this.id || this.app.play.active) return;
        const building = this.app.renderer.buildings.get(this.id);
        if (building) building.setInterior(true, { camera: this.app.camera, snap: true });
      };
    }
    addToolbarButtons(root) {
      for (const [id, label] of [['building', '⌂ Buildings'], ['furniture', '▣ Furniture']]) {
        const button = document.createElement('button');
        button.dataset.tool = id;
        button.textContent = label;
        button.title = id === 'building' ? 'Buildings (B)' : 'Furniture (U)';
        root.appendChild(button);
      }
    }
    enter(id) {
      this.leave();
      this.id = id;
      const app = this.app, building = app.renderer.buildings.get(id);
      if (!building) return;
      building.setInterior(true, { camera: app.camera });
      const spec = building.spec, T = K.TILE;
      app.rig.set({ tx: (spec.x + spec.footprint.w / 2) * T, tz: (spec.z + spec.footprint.h / 2) * T, dist: 11, pitch: 1.05 });
      app.setTool('furniture');
    }
    leave() {
      const building = this.id && this.app.renderer.buildings.get(this.id);
      if (building) building.setInterior(false, { camera: this.app.camera });
      this.id = null;
    }
    panelHtml(o) {
      if (o.kind !== 'building') return '';
      return '<button class="b pri" data-interior>Enter interior / furniture</button><button class="b" data-turn>Rotate 90°</button>';
    }
    bindPanel(root) {
      const enter = root.querySelector('[data-interior]');
      if (enter) enter.onclick = () => this.enter(this.app.sel);
      const turn = root.querySelector('[data-turn]');
      if (turn) turn.onclick = () => this.app.selection.rotateSel(1);
    }
  }
  K.EditorInteriors = EditorInteriors;
})(typeof window !== 'undefined' ? window : globalThis);
