/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Detail views for placed castle pieces and the resource bar. */
(function (G) {
  const K = G.K;

  class BuildingPanel {
    constructor(game) {
      this.g = game;
      this.c = game.castle;
      this.selected = null;
      this.root = document.createElement('div');
      this.root.id = 'cInspector';
      this.root.hidden = true;
      document.body.appendChild(this.root);
      this.pieces = new K.BuildingPieceSection(game, this);
      this.materials = new K.BuildingMaterialSection(game, this);
      this.click = (event) => this.onClick(event);
      this.root.addEventListener('click', this.click);
      this.key = (event) => {
        if (event.key === 'Escape' && !this.root.hidden) this.close();
      };
      document.addEventListener('keydown', this.key);
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
      if (event.target.closest('[data-close]')) return this.close();
      if (this.handleOrder(event)) return;
      if (this.handleBuildingAction(event)) return;
      const material = event.target.closest('[data-material]');
      if (material) return this.material(material.dataset.material);
      if (event.target.closest('[data-upgrade]')) this.upgradeSelected();
      if (event.target.closest('[data-takedown]')) this.confirmDemolition();
    }

    handleOrder(event) {
      const toggle = event.target.closest('[data-order-toggle]');
      const target = event.target.closest('[data-order-target]');
      const selected = this.selected;
      if ((!toggle && !target) || !selected || selected.remote) return false;
      const orders = this.g.economy.stock.orders;
      const order = orders.get(selected.p);
      const change = toggle
        ? { enabled: !order.enabled }
        : { target: +target.dataset.orderTarget };
      orders.configure(selected.p, change);
      this.piece(selected.e);
      this.g.changed();
      return true;
    }

    handleBuildingAction(event) {
      const button = event.target.closest('[data-building-action]');
      if (!button || !this.selected) return false;
      const action = this.selected.available.find(
        (item) => item.id === button.dataset.buildingAction
      );
      if (action) this.g.play.doAction(this.selected.e, action, false);
      return true;
    }

    upgradeSelected() {
      const selected = this.selected;
      if (!selected || selected.remote) return;
      this.g.upgrade(selected.p);
      this.piece(selected.e);
    }

    confirmDemolition() {
      const selected = this.selected;
      if (!selected || selected.remote) return;
      const refund = this.c.refundFor(selected.p);
      const text = Object.entries(refund)
        .map(([resource, amount]) => `${amount} ${K.CastleData.resName(resource)}`)
        .join(', ') || 'nothing';
      const title = K.PanelText.escape(this.g.data.piece(selected.p.type).name);
      this.g.cui.modal(
        `<h2>Take down ${title}?</h2><p>Refund: ${K.PanelText.escape(text)}. This cannot be undone.</p>`,
        [
          { label: 'Keep it', pri: true },
          {
            label: 'Yes, take it down',
            run: () => {
              if (this.g.demolishPiece(selected.p)) this.close();
            }
          }
        ]
      );
    }

    dispose() {
      document.removeEventListener('keydown', this.key);
      this.root.remove();
    }
  }

  K.BuildingPanel = BuildingPanel;
})(typeof window !== 'undefined' ? window : globalThis);
