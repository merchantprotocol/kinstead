/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · taking down what you built. With the hammer's "Take down" mode on, click or drag across your
   own walls and buildings: each one comes down at once and half of what it cost drops as pickups to collect.
   Restored ruins stay standing. The rules live in Castle.demolish / CastleGame.demolishPiece; this class is
   only the pointer handling and the red outline. */
(function (G) {
  const K = G.K;

  class Demolisher {
    constructor(game) { this.g = game; this.active = false; this.stroke = false; this.shown = false; }
    get play() { return this.g.play; }
    setActive(on) { this.active = !!on; this.stroke = false; if (!on) this.hide(); }
    ground(sx, sy) { return this.g.app.pickGround(sx, sy); }
    pieceUnder(sx, sy) { const p = this.ground(sx, sy); return p ? this.g.pieceAt(p.x, p.z) : null; }

    /* press / drag / release, wired through CastleGame.pointerDown / pointerDrag / pointerUp */
    down(sx, sy) { if (!this.active) return false; this.stroke = true; this.tear(sx, sy); return true; }
    drag(sx, sy) { if (this.stroke) { this.tear(sx, sy); this.hover(sx, sy); } }
    up() { this.stroke = false; }
    tear(sx, sy) { const piece = this.pieceUnder(sx, sy); if (piece) this.g.demolishPiece(piece); }

    /** the cursor, and a red outline on whatever is under it; returns the cursor css */
    hover(sx, sy) {
      const piece = this.pieceUnder(sx, sy); if (!piece) { this.hide(); return K.Icons.cursor('demolish', 'pointer'); }
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
