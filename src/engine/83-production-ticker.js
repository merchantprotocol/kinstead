/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · ProductionTicker: the castle's producers make their goods each frame, with a "+n" floating off the piece. */
(function (G) {
  const K = G.K;

  class ProductionTicker {
    constructor(game) { this.g = game; }
    update(dt) {
      const g = this.g, tk = g.castle.tick(dt);
      for (const t of tk.ticks) {
        if (Math.random() < 0.6) g.play.ui.float(t.piece.x, 2, t.piece.z, `+${t.n}`, 'loot', K.CastleUI.ICON[t.r]);
        g.cui.bump(t.r, true);
      }
    }
  }

  K.ProductionTicker = ProductionTicker;
})(typeof window !== 'undefined' ? window : globalThis);
