/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* BuildingHoldingsSection: "What it holds": stored goods and, for coops and barns, the animals. */
(function (G) {
  const K = G.K;

  class BuildingHoldingsSection {
    constructor(game) {
      this.g = game;
    }

    render(piece, remote) {
      const rows = [];
      const stock = this.stock(piece, remote);
      if (Object.keys(stock).length) rows.push(K.PanelText.row('Stored', K.PanelText.amounts(stock)));
      if (!remote && K.LivestockOrderSection.keepsAnimals(piece)) rows.push(this.animalsRow(piece));
      return `<h3>What it holds</h3>${rows.join('') || '<p>Nothing is stored here yet.</p>'}`;
    }

    stock(piece, remote) {
      if (remote || !this.g.economy) return {};
      return this.g.economy.ledger(piece).goods;
    }

    animalsRow(piece) {
      const count = this.g.economy.stock.herd(piece).length;
      const kind = piece.type === 'coop' ? 'hen' : 'cow';
      return K.PanelText.row('Animals', `${count} ${kind}${count === 1 ? '' : 's'}`);
    }
  }

  K.BuildingHoldingsSection = BuildingHoldingsSection;
})(typeof window !== 'undefined' ? window : globalThis);
