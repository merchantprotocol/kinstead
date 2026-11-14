/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · taking down what you built. This only ever happens on purpose: you must have the hammer out,
   click the wall (or gate, or building), and answer a pop-up that asks "Take down this wall?". Nothing else
   can do it: no other tool, no sweep, no drag, no automatic anything. The refund is half the cost, dropped
   as pickups. The rules live in Castle.demolish / CastleGame.demolishPiece; this class is the click, the
   red outline, and the question. */
(function (G) {
  const K = G.K;

  class Demolisher {
    constructor(game) { this.g = game; this.shown = false; }
    get play() { return this.g.play; }
    /** only with the hammer in hand, and not while you are placing something */
    get active() { return this.g.tools.tool.id === 'hammer' && !this.g.cui.placing && this.g.cui.$('cModal').hidden; }
    ground(sx, sy) { return this.g.app.pickGround(sx, sy); }
    pieceUnder(sx, sy) { const p = this.ground(sx, sy); return p ? this.g.pieceAt(p.x, p.z) : null; }

    /* wired through CastleGame.pointerDown: a press on one of your pieces (hammer out) asks; anywhere else it is an ordinary click */
    down(sx, sy) {
      if (!this.active) return false;
      const piece = this.pieceUnder(sx, sy); if (!piece) return false;
      this.ask(piece); return true;
    }
    drag() {}
    up() {}

    /** the pop-up. Enter and Esc both mean "keep it". */
    ask(piece) {
      const g = this.g, c = g.castle; if (!g.tools.tool || g.tools.tool.id !== 'hammer') return;     // hammer only, however this was reached
      if (!c.canDemolish(piece)) { g.cui.toast('That stays standing.'); return; }
      const name = g.data.piece(piece.type).name.toLowerCase(), back = Object.entries(c.refundFor(piece)).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ') || 'nothing';
      g.cui.modal(`<h2>Take down this ${name}?</h2><p>You get back ${back}.</p>`, [
        { label: 'Keep it', pri: true },
        { label: 'Take it down', run: () => { if (g.tools.tool.id === 'hammer') g.demolishPiece(piece); } },
      ]);
    }

    /** the cursor and a red outline over a piece you could take down; null elsewhere */
    hover(sx, sy) {
      const piece = this.pieceUnder(sx, sy); if (!piece) { this.hide(); return null; }
      const [w, d] = K.CastleArt.size(piece.type), c = Math.cos(piece.rot), s = Math.sin(piece.rot), y = this.play.nav.y(piece.x, piece.z) + 0.1, ov = this.play.ov, hw = w / 2 + 0.1, hd = d / 2 + 0.1, pts = [];
      for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) pts.push(piece.x + lx * c + lz * s, y, piece.z - lx * s + lz * c);
      ov.set(ov.hov, pts); ov.hov.material.color.setHex(this.g.castle.canDemolish(piece) ? 0xff5a4a : 0x8a98ab); this.shown = true;
      return K.Icons.cursor('demolish', 'pointer');
    }
    hide() { if (this.shown) { this.play.ov.hov.visible = false; this.shown = false; } }
    dispose() { this.hide(); }
  }

  K.Demolisher = Demolisher;
})(typeof window !== 'undefined' ? window : globalThis);
