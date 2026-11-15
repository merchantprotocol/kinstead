/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* BuildingPanel: the detail panel for a placed building or a material. It opens and closes; the sections
   (BuildingPieceSection and its parts, BuildingMaterialSection) render the content and answer their own buttons. */
(function (G) {
  const K = G.K;

  class BuildingPanel {
    constructor(game) {
      this.g = game;
      this.selected = null;
      this.root = document.createElement('div');
      this.root.id = 'cInspector';
      this.root.hidden = true;
      document.body.appendChild(this.root);
      this.pieces = new K.BuildingPieceSection(game, this);
      this.materials = new K.BuildingMaterialSection(game, this);
      this.click = (event) => this.onClick(event);
      this.root.addEventListener('click', this.click);
      this.key = (event) => this.onKey(event);
      document.addEventListener('keydown', this.key);
    }

    onKey(event) {
      if (event.key === 'Escape' && !this.root.hidden) this.close();
    }

    close() {
      this.root.hidden = true;
      this.selected = null;
    }

    open(title, icon, body) {
      const image = icon && String(icon).startsWith('<')
        ? icon
        : K.Icons.img(icon || 'eye', 3);
      const heading = `<header>${image}<h2>${K.PanelText.escape(title)}` +
        '<button data-close aria-label="Close">×</button></h2></header>';
      this.root.innerHTML = `<section class="ci-shell">${heading}<div class="ci-content">${body}</div></section>`;
      this.root.hidden = false;
    }

    piece(entity) {
      const view = this.pieces.render(entity);
      if (view) this.open(view.title, view.icon, view.body);
    }

    material(id) {
      const view = this.materials.render(id);
      this.open(view.title, view.icon, view.body);
    }

    onClick(event) {
      if (event.target.closest('[data-close]')) {
        this.close();
        return;
      }
      if (this.pieces.handle(event, this.selected)) return;
      const material = event.target.closest('[data-material]');
      if (material) this.material(material.dataset.material);
    }

    dispose() {
      document.removeEventListener('keydown', this.key);
      this.root.remove();
    }
  }

  K.BuildingPanel = BuildingPanel;
})(typeof window !== 'undefined' ? window : globalThis);
