/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* TakeDownSection: "Take down": the refund you'd get, and a confirmation before the building goes. */
(function (G) {
  const K = G.K;

  class TakeDownSection {
    constructor(game, panel) {
      this.g = game;
      this.c = game.castle;
      this.panel = panel;
    }

    refundText(piece) {
      return K.PanelText.amounts(this.c.refundFor(piece), 'nothing');
    }

    render(piece, remote) {
      if (remote || !this.c.canDemolish(piece)) return '';
      return `<section class="ci-danger"><h3>Take down</h3><p>Refund: ${K.PanelText.escape(this.refundText(piece))}</p>` +
        '<button data-takedown>Take down…</button></section>';
    }

    handle(event, selected) {
      if (!event.target.closest('[data-takedown]')) return false;
      if (selected && !selected.remote) this.confirm(selected);
      return true;
    }

    confirm(selected) {
      const title = K.PanelText.escape(this.g.data.piece(selected.p.type).name);
      const refund = K.PanelText.escape(this.refundText(selected.p));
      this.g.cui.modal(`<h2>Take down ${title}?</h2><p>Refund: ${refund}. This cannot be undone.</p>`, [
        { label: 'Keep it', pri: true },
        { label: 'Yes, take it down', run: () => this.takeDown(selected) },
      ]);
    }

    takeDown(selected) {
      if (this.g.demolishPiece(selected.p)) this.panel.close();
    }
  }

  K.TakeDownSection = TakeDownSection;
})(typeof window !== 'undefined' ? window : globalThis);
