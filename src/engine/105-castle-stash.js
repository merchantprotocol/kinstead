/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · hoarding. With a tool in hand, right-click the ground to put down everything it gathers:
     axe -> a wood pile     pickaxe -> a stack of stone bricks     bow -> a crate of arrows
     shovel -> one block of dirt, exactly like building a dirt wall (a plain square, one per click)
   A pile is a Store, so raiders can steal from it and you can pick it back up by clicking it.
     Pile    one dropped heap (draws itself bigger the more is in it)
     Stash   the right-click: which tool drops what, and where it may go */
(function (G) {
  const K = G.K, THREE = G.THREE, TILE = K.TILE, T = K.T;
  const NAMES = { wood: 'Wood pile', stone: 'Stone bricks', arrow: 'Crate of arrows', food: 'Crate of food', iron: 'Iron ingots' };
  const DROPPABLE = ['wood', 'stone', 'food', 'arrow', 'iron'];

  class Pile extends K.Store {
    constructor(home, def) { super(home, def); this.pile = true; this.ent.pile = true; }
    draw() {
      const k = new K.VoxKit(), n = this.stock == null ? 0 : this.stock;
      if (this.res === 'wood') {            // logs, stacked in a pyramid
        const logs = Math.max(1, Math.min(15, Math.ceil(n / 3)));
        let left = logs; for (let row = 0; left > 0; row++) { const cnt = Math.min(left, 5 - row); if (cnt <= 0) break; for (let i = 0; i < cnt; i++) k.box(i % 2 ? 'bark' : 'wood', 0, row * 0.14, (i - (cnt - 1) / 2) * 0.15, 0.8, 0.14, 0.14, 0.05 * i); left -= cnt; }
        for (let i = 0; left > 0; i++, left--) k.box('wood', 0, 0.56, (i % 2 ? 1 : -1) * 0.06, 0.8, 0.14, 0.14);
      } else if (this.res === 'stone') {    // bricks, laid in courses
        const bricks = Math.max(1, Math.min(24, Math.ceil(n / 2))); for (let b = 0; b < bricks; b++) { const layer = Math.floor(b / 6), s = b % 6, along = layer % 2; k.box(s % 2 ? 'boulder' : 'ashlar', along ? ((s % 3) - 1) * 0.17 : ((s >> 1) - 0.5) * 0.3, layer * 0.11, along ? (s < 3 ? -0.09 : 0.09) : ((s % 2) - 0.5) * 0.16, along ? 0.16 : 0.28, 0.1, along ? 0.16 : 0.14); }
      } else if (this.res === 'iron') {     // ingots
        const bars = Math.max(1, Math.min(18, n)); for (let b = 0; b < bars; b++) { const layer = Math.floor(b / 6), s = b % 6; k.box('iron', ((s % 3) - 1) * 0.2, layer * 0.1, (s < 3 ? -0.1 : 0.1), 0.18, 0.09, 0.16); }
      } else { const d = K.FURNITURE.crate; d.build(k, {}, d); this.contents(k, this.res, 0.42); }   // arrows, food: a crate
      return k;
    }
    /** put more in: the heap grows */
    add(n) { this.put(n); this.refresh(); }
    refresh() {
      for (const c of this.mesh.children.slice()) { this.mesh.remove(c); if (c.geometry) c.geometry.dispose(); }
      for (const m of this.draw().meshes(this.home.g.R.bmats)) this.mesh.add(m);
    }
  }

  class Stash {
    constructor(game) { this.g = game; this.seq = 0; }
    get play() { return this.g.play; }
    /** what the tool in hand gathers (null: it has nothing to drop) */
    resourceOf(tool) { return { axe: 'wood', pickaxe: 'stone', shovel: 'dirt' }[tool.id] || (tool.ranged ? 'arrow' : null); }
    /** can a heap stand on this tile? */
    spotOk(i, j) {
      const g = this.g, d = this.play.doc, nav = this.play.nav, k = j * d.w + i; if (!d.inside(i, j)) return false;
      const t = d.terrain[k]; return t !== T.CHASM && t !== T.WATER && !!nav.walk[k] && !g.occ[k] && !g.R.buildings.at(i, j) && !g.home.inside((i + 0.5) * TILE, (j + 0.5) * TILE);
    }
    /** the right-click. true = handled. */
    rightClick(sx, sy) {
      const g = this.g, me = this.play.me, res = this.resourceOf(g.tools.tool); if (!res || !me.alive) return false;
      const p = g.app.pickGround(sx, sy); if (!p) return true;
      this.dropAt(res, p); return true;
    }
    /** put everything you have of a resource down at ground point p (dirt: one block, like a wall) */
    dropAt(res, p) {
      const g = this.g, me = this.play.me;
      if (res === 'dirt') { g.placeDirt(p.x, p.z, false); return; }   // the same single block as a dirt wall
      if (!DROPPABLE.includes(res)) { g.cui.toast('That cannot be put down.'); return; }
      if (Math.hypot(p.x - me.x, p.z - me.z) > 14) { g.cui.toast('That is too far away.'); return; }
      const c = g.castle, n = c.amount(res), what = K.CastleData.resName(res).toLowerCase(); if (n < 1) { g.cui.toast(`You have no ${what} to drop.`); return; }
      const [i, j] = this.play.doc.tileOf(p.x, p.z), x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, same = g.home.stores.find((s) => s.pile && s.present && s.res === res && Math.abs(s.x - x) < 0.3 && Math.abs(s.z - z) < 0.3);
      if (!same && !this.spotOk(i, j)) { g.cui.toast('There is no room to put it down there.'); g.sound.play('clank'); return; }
      c.spend({ [res]: n }); g.home.dropPile(res, x, z, n, same); g.sound.play('thunk'); g.changed();
    }
    /** pick a heap back up (what does not fit in your store stays) */
    take(store) {
      const g = this.g, c = g.castle, res = store.res, got = c.add(res, store.stock); if (got <= 0) { g.cui.toast(`Your ${K.CastleData.resName(res).toLowerCase()} store is full.`); return; }
      store.stock -= got; if (g.mp) g.mp.stockDelta(store, -got); g.play.float(g.play.me, `+${got}`, 'loot'); g.sound.play('gather'); g.changed(); if (store.stock > 0 && store.refresh) store.refresh();
    }
    name(res) { return NAMES[res]; }
  }

  Object.assign(K, { Pile, Stash });
})(typeof window !== 'undefined' ? window : globalThis);
