/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · taking down what you built. This only ever happens on purpose: you must have the hammer out,
   click the wall (or gate, or building), and answer a pop-up that asks "Take down this wall?". Nothing else
   can do it: no other tool, no sweep, no drag, no automatic anything. The refund is half the cost, dropped
   as pickups. The rules live in Castle.demolish / CastleGame.demolishPiece; this class is the click, the
   red outline, and the question. */
(function (G) {
  const K = G.K;

  class Demolisher {
    constructor(game) { this.g = game; this.shown = false; this.selling = false; this.dragging = false; }
    /** sell mode (the Sell row in the build drawer): walls go at a click or a drag, buildings ask first; what you get back goes straight into your purse */
    setSelling(on) {
      on = !!on; if (on === this.selling) return; this.selling = on; const g = this.g; if (on) g.cui.stopPlacing();
      g.cui.toast(on ? 'Selling: click or drag along walls to sell them. Buildings ask first. Esc to stop.' : 'Stopped selling.'); if (!on) this.hide(); if (g.tools && g.tools.drawer) g.tools.drawer.update();
    }
    isWall(p) { return Demolisher.WALLS.has(p.type); }
    /** sell one piece now: it comes down and half its cost lands in your purse */
    sell(p) {
      const g = this.g, c = g.castle; if (!c.canDemolish(p)) { g.cui.toast('That stays standing.'); return false; }
      const back = c.refundFor(p); if (!g.demolishPiece(p, { refund: false })) return false;
      const got = []; for (const [r, n] of Object.entries(back)) { c.add(r, n); got.push(`+${n} ${K.CastleData.resName(r)}`); }
      if (got.length) g.play.float(g.play.me, got.join(' '), 'loot'); g.sound.play('gather'); g.changed(); return true;
    }
    /** in sell mode: a wheat field square under the cursor is ploughed back to snow */
    sellField(sx, sy) {
      const g = this.g, e = g.economy, pt = this.ground(sx, sy); if (!e || !pt) return false; const [i, j] = g.play.doc.tileOf(pt.x, pt.z);
      if (!e.fields.has(i, j)) return false; e.fields.remove(i, j); g.changed(); return true;
    }
    get play() { return this.g.play; }
    /** only with the hammer in hand, and not while you are placing something */
    get active() { return (this.g.tools.tool.id === 'hammer' || this.selling) && !this.g.cui.placing && this.g.cui.$('cModal').hidden; }
    ground(sx, sy) { return this.g.app.pickGround(sx, sy); }
    pieceUnder(sx, sy) { const p = this.ground(sx, sy); return p ? this.g.pieceAt(p.x, p.z) : null; }

    /* wired through CastleGame.pointerDown: a press on one of your pieces (hammer out) asks; anywhere else it is an ordinary click */
    down(sx, sy) {
      if (!this.active) return false;
      const piece = this.pieceUnder(sx, sy);
      if (this.selling) { if (!piece) return this.sellField(sx, sy) ? (this.dragging = true) : false; if (this.isWall(piece)) { this.sell(piece); this.dragging = true; } else this.ask(piece, true); return true; }
      if (!piece) return false;
      this.ask(piece); return true;
    }
    /** in sell mode a drag sells every wall (and field square) it passes over; buildings are never sold by a drag */
    drag(sx, sy) { if (!this.selling || !this.dragging || !this.active) return; const piece = this.pieceUnder(sx, sy); if (piece) { if (this.isWall(piece)) this.sell(piece); } else this.sellField(sx, sy); }
    up() { this.dragging = false; }

    /** the pop-up. Enter and Esc both mean "keep it". */
    ask(piece, sell = false) {
      const g = this.g, c = g.castle; if (!sell && (!g.tools.tool || g.tools.tool.id !== 'hammer')) return;     // hammer only (or sell mode), however this was reached
      if (!c.canDemolish(piece)) { g.cui.toast('That stays standing.'); return; }
      const name = g.data.piece(piece.type).name.toLowerCase(), back = Object.entries(c.refundFor(piece)).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ') || 'nothing';
      if (sell) { g.cui.modal(`<h2>Sell this ${name}?</h2><p>It comes down and you get ${back} back in your purse.</p>`, [{ label: 'Keep it', pri: true }, { label: 'Sell it', run: () => this.sell(piece) }]); return; }
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
      ov.set(ov.hov, pts); ov.hov.material.color.setHex(!this.g.castle.canDemolish(piece) ? 0x8a98ab : this.selling ? 0xffd27a : 0xff5a4a); this.shown = true;
      return K.Icons.cursor('demolish', 'pointer');
    }
    hide() { if (this.shown) { this.play.ov.hov.visible = false; this.shown = false; } }
    dispose() { this.hide(); }
  }

  Demolisher.WALLS = new Set(['palisade', 'stone_wall', 'dirt_wall', 'fence']);
  K.Demolisher = Demolisher;
})(typeof window !== 'undefined' ? window : globalThis);
