/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* BuildingPieceSection: the panel for one placed building, put together from its sections. */
(function (G) {
  const K = G.K;

  class BuildingPieceSection {
    constructor(game, panel) {
      this.g = game;
      this.c = game.castle;
      this.panel = panel;
      this.status = new K.BuildingStatusSection(game);
      this.holdings = new K.BuildingHoldingsSection(game);
      this.orders = new K.LivestockOrderSection(game, panel);
      this.options = new K.BuildingOptionsSection(game);
      this.upgrade = new K.BuildingUpgradeSection(game, panel);
      this.takeDown = new K.TakeDownSection(game, panel);
    }

    /** the sections that answer clicks, asked in turn */
    get clickable() {
      return [this.orders, this.options, this.upgrade, this.takeDown];
    }

    /** { title, icon, body } for a building entity (yours or another player's), or null if it has no definition */
    render(entity) {
      const remote = entity.type === 'c_rpiece';
      const piece = remote ? entity.rec.p : entity.piece;
      const definition = this.g.data.piece(piece.type);
      if (!definition) return null;
      const production = remote ? null : this.c.producesOf(piece);
      const available = this.options.available(entity);
      this.panel.selected = { e: entity, p: piece, remote, available };
      const summary = definition.effect || K.CastleUI.SHORT[piece.type] || 'A castle building.';
      const body = [
        `<p>${K.PanelText.escape(summary)}</p>`,
        this.status.render(piece, remote, production),
        this.holdings.render(piece, remote),
        this.orders.render(piece, remote),
        this.options.render(available),
        this.upgrade.render(piece, remote, production),
        this.takeDown.render(piece, remote),
      ].join('');
      const icon = this.g.cui.art.html(piece.type, K.CastleUI.PIECE_ICON[piece.type], 84);
      return { title: definition.name, icon, body };
    }

    handle(event, selected) {
      return this.clickable.some((section) => section.handle(event, selected));
    }
  }

  K.BuildingPieceSection = BuildingPieceSection;
})(typeof window !== 'undefined' ? window : globalThis);
