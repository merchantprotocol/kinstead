/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the little world map in the bottom-left corner. It shows the whole land (snow, hills, dug and
   built ground, trees), your home, your walls, you, wolves and raiders, so you always know where you are.
   The land is drawn once and redrawn only when the terrain changes; the dots update a few times a second. */
(function (G) {
  const K = G.K;
  const { T } = K;
  const COLORS = { [T.SNOW]: [226, 233, 244], [T.ROCK]: [112, 118, 132], [T.DIRT]: [96, 70, 50], [T.PATH]: [120, 118, 126], [T.ICE]: [140, 190, 220], [T.CHASM]: [38, 48, 62], [T.WATER]: [34, 74, 108], [T.SLATE]: [70, 80, 96] };

  class Minimap {
    constructor(game) {
      this.g = game; this.t = 0; this.version = -1;
      const doc = game.play.doc; this.w = doc.w; this.h = doc.h;
      this.root = document.createElement('div'); this.root.id = 'cMap'; this.root.className = 'cp';
      this.canvas = document.createElement('canvas'); this.canvas.width = this.w; this.canvas.height = this.h; this.root.appendChild(this.canvas);
      game.cui.root.appendChild(this.root);
      this.land = document.createElement('canvas'); this.land.width = this.w; this.land.height = this.h; this.ctx = this.canvas.getContext('2d'); this.draw();
    }
    get play() { return this.g.play; }
    /** the ground, shaded by height */
    paintLand() {
      const d = this.play.doc, c = this.land.getContext('2d'), img = c.createImageData(this.w, this.h), px = img.data;
      for (let k = 0; k < this.w * this.h; k++) {
        const col = COLORS[d.terrain[k]] || COLORS[T.SNOW], shade = 1 - Math.max(-0.3, Math.min(0.35, d.height[k] * 0.25 * 0.07)) , o = k * 4;
        px[o] = col[0] * shade; px[o + 1] = col[1] * shade; px[o + 2] = col[2] * shade; px[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }
    draw() {
      const g = this.g, P = this.play, c = this.ctx, T2 = K.TILE, ed = g.tools && g.tools.editor;
      if (this.version !== (ed ? ed.version : 0)) { this.version = ed ? ed.version : 0; this.paintLand(); }
      c.imageSmoothingEnabled = false; c.drawImage(this.land, 0, 0);
      c.fillStyle = '#2d5a44'; for (const e of P.props) if (e.type === 'c_tree' && P.nodeState(e).charges > 0) c.fillRect(e.x / T2 | 0, e.z / T2 | 0, 1, 1);   // trees
      c.fillStyle = '#7a5a34'; for (const p of g.castle.pieces) c.fillRect((p.x / T2 | 0) - 0, (p.z / T2 | 0) - 0, 1, 1);                                   // walls and gates
      for (const home of P.doc.buildings()) { c.fillStyle = '#f2c14e'; c.fillRect(home.x - 1, home.z - 1, home.footprint.w + 2, home.footprint.h + 2); c.fillStyle = home.id === 'home' ? '#8a5a1a' : '#6b5a7a'; c.fillRect(home.x, home.z, home.footprint.w, home.footprint.h); }   // your house and anything you add to it
      for (const a of P.actors) { if (a === P.me || !a.alive || !a.hostile) continue; c.fillStyle = a.thief ? '#ff9a3a' : '#e0453a'; c.fillRect((a.x / T2 | 0) - 1, (a.z / T2 | 0) - 1, 3, 3); }
      for (const a of P.actors) if (a.remote) { c.fillStyle = '#5ab0ff'; c.fillRect((a.x / T2 | 0) - 2, (a.z / T2 | 0) - 2, 5, 5); }   // other settlers
      const me = P.me, mx = me.x / T2, mz = me.z / T2; c.fillStyle = '#0a1020'; c.beginPath(); c.arc(mx, mz, 5, 0, 6.3); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(mx, mz, 3.2, 0, 6.3); c.fill();   // you
    }
    update(dt) { this.t -= dt; if (this.t > 0) return; this.t = 0.25; this.draw(); }
    dispose() { this.root.remove(); }
  }

  K.Minimap = Minimap;
})(typeof window !== 'undefined' ? window : globalThis);
