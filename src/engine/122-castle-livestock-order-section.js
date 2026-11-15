/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* LivestockOrderSection: "Buy regularly": keep a coop or barn topped up to a target, paid in wheat. */
(function (G) {
  const K = G.K;

  class LivestockOrderSection {
    constructor(game, panel) {
      this.g = game;
      this.panel = panel;
    }

    static keepsAnimals(piece) {
      return piece.type === 'coop' || piece.type === 'barn';
    }

    get orders() {
      return this.g.economy.stock.orders;
    }

    render(piece, remote) {
      if (remote || !LivestockOrderSection.keepsAnimals(piece)) return '';
      const order = this.orders.get(piece);
      const kind = piece.type === 'coop' ? 'chicken' : 'cow';
      const livestock = K.LIVESTOCK[kind];
      const status = K.PanelText.escape(this.status(piece, order, livestock.price));
      const lower = `<button data-order-target="${order.target - 1}" ${order.target <= 1 ? 'disabled' : ''}>−</button>`;
      const raise = `<button data-order-target="${order.target + 1}" ${order.target >= livestock.max ? 'disabled' : ''}>+</button>`;
      const toggle = `<button data-order-toggle>${order.enabled ? 'Turn off' : 'Turn on'} · ${livestock.price} wheat each</button>`;
      return `<section class="ci-action"><h3>Buy regularly</h3><p>Keep ${kind}s at ${order.target} · ${status}</p>` +
        `${lower}${raise}${toggle}</section>`;
    }

    status(piece, order, price) {
      if (this.g.economy.stock.herd(piece).length >= order.target) return 'Target reached';
      if (this.g.economy.wheatHeld() < price) return 'Paused: not enough wheat';
      return `Next purchase in ${Math.max(0, Math.ceil(order.remaining))}s`;
    }

    /** a click on − / + / on-off; true when it was ours */
    handle(event, selected) {
      const toggle = event.target.closest('[data-order-toggle]');
      const target = event.target.closest('[data-order-target]');
      if ((!toggle && !target) || !selected || selected.remote) return false;
      const change = toggle
        ? { enabled: !this.orders.get(selected.p).enabled }
        : { target: +target.dataset.orderTarget };
      this.orders.configure(selected.p, change);
      this.panel.piece(selected.e);
      this.g.changed();
      return true;
    }
  }

  K.LivestockOrderSection = LivestockOrderSection;
})(typeof window !== 'undefined' ? window : globalThis);
