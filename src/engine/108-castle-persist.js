/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · remembering your homestead. The core save (stores, pieces, trees you felled, the clock) lives in
   CastleGame.snapshot; this class adds everything built on top of the land and puts it back on Continue:
   dropped piles, what is in the barrels, chests, tables and the forge's shelf, the weapons you own, the blacksmith,
   the ground you dug or raised, and trees that grew back somewhere new.
     Persist.capture()   a plain JSON object
     Persist.restore(x)  rebuild it all after the world and the game are up */
(function (G) {
  const K = G.K;

  /** Saves across the Redwood world change, both ways. Builds before it read `terrain` as [index, height, type] on the
      560-tile-wide map and know nothing else; this build writes dug ground as `ground` {w, h, list} (old builds ignore it)
      and keeps anything standing beyond the old map's edge under `far`, so an older build never tries to put it back. */
  class SaveCompat {
    /** dug ground from a save, as world tile indices of a map w tiles wide (old saves were always the 560 x 400 map) */
    static ground(x, w, h) {
      const src = x.ground && x.ground.list ? x.ground : x.terrain && x.terrain.length ? { w: SaveCompat.OLD.w, h: SaveCompat.OLD.h, list: x.terrain } : null;
      if (!src) return [];
      const out = [];
      for (const [k, hh, t] of src.list) { const i = k % src.w, j = (k - i) / src.w; if (i < w && j < h && j < src.h) out.push([j * w + i, hh, t]); }
      return out;
    }
    /** is tile (i, j) beyond the old map? */
    static far(i, j) { return i + 1 >= SaveCompat.OLD.w || j + 1 >= SaveCompat.OLD.h; }
    /** move buildings standing beyond the old map's edge out of the keys older builds read */
    static split(c) {
      const far = {};
      for (const key of ['home', 'smithy', 'market']) if (c[key] && SaveCompat.far(c[key].x, c[key].z)) { far[key] = c[key]; c[key] = null; }
      for (const [t, h] of Object.entries(c.halls || {})) if (SaveCompat.far(h.x, h.z)) { (far.halls = far.halls || {})[t] = h; delete c.halls[t]; }
      if (Object.keys(far).length) c.far = far;
      return c;
    }
    /** put them back (this build) */
    static merge(x) {
      const f = x.far; if (!f) return x;
      const y = Object.assign({}, x); for (const key of ['home', 'smithy', 'market']) if (f[key]) y[key] = f[key];
      if (f.halls) y.halls = Object.assign({}, x.halls || {}, f.halls);
      return y;
    }
  }
  SaveCompat.OLD = { w: 560, h: 400 };

  class Persist {
    constructor(game) {
      this.g = game; const d = game.play.doc;
      this.h0 = d.height.slice(); this.t0 = d.terrain.slice();   // the land as generated: dug and raised ground is saved as the difference
    }
    get play() { return this.g.play; }
    weaponIds(list) { return list.map((w) => w.id); }
    /** tiles dug or raised since the world was made: [index, height, type]. Compares four tiles at a time (a big world is 22M tiles) */
    changedGround() {
      const d = this.play.doc, out = [], n = d.height.length, H = d.height, T0 = d.terrain, h0 = this.h0, t0 = this.t0;
      const q = n % 4 === 0 && !H.byteOffset && !h0.byteOffset ? n / 4 : 0, a = q && new Uint32Array(H.buffer, 0, q), b = q && new Uint32Array(h0.buffer, 0, q), c = q && new Uint32Array(T0.buffer, 0, q), e = q && new Uint32Array(t0.buffer, 0, q);
      if (q) { for (let w = 0; w < q; w++) if (a[w] !== b[w] || c[w] !== e[w]) for (let k = w * 4; k < w * 4 + 4; k++) if (H[k] !== h0[k] || T0[k] !== t0[k]) out.push([k, H[k], T0[k]]); }
      else for (let k = 0; k < n; k++) if (H[k] !== h0[k] || T0[k] !== t0[k]) out.push([k, H[k], T0[k]]);
      return out;
    }
    capture() {
      const g = this.g, d = this.play.doc, terrain = this.changedGround();
      const vaults = {}; for (const [id, v] of g.purse.vaults) vaults[id] = { res: v.res, items: v.items, weapons: this.weaponIds(v.weapons) };
      const mp = !!g.mp;   // on a server the land, felled trees and supplies are the server's: your save keeps only what is yours
      return SaveCompat.split({
        respawn: g.respawn || null, terrain: [], ground: { w: d.w, h: d.h, list: mp ? [] : terrain }, vaults,   // terrain: [] so an older build restores no ground (it would misplace it)
        piles: mp ? [] : g.home.stores.filter((s) => s.pile && s.present).map((s) => ({ res: s.res, x: s.x, z: s.z, n: s.stock })),
        stores: mp ? [] : g.home.stores.filter((s) => !s.pile && s.stock != null).map((s) => [s.id, s.stock]),
        weapons: this.weaponIds(g.tools.belt.weapons), held: g.tools.tool.kind === 'weapon' ? g.tools.tool.id : null,
        tray: g.forge ? g.forge.tray.map((t) => (t.kind === 'weapon' ? { weapon: t.id } : { res: t.id, n: t.n })) : [],
        smithy: g.smithy ? { x: g.smithy.x, z: g.smithy.z, turns: g.smithyTurns || 0 } : null,
        halls: Object.fromEntries(Object.entries(g.halls || {}).map(([t, h]) => [t, { x: h.spec.x, z: h.spec.z, turns: h.turns || 0 }])),
        market: g.marketHall ? { x: g.marketHall.x, z: g.marketHall.z, turns: g.marketTurns || 0 } : null,
        home: g.home.built ? { x: g.home.spec.x, z: g.home.spec.z, turns: g.homeTurns || 0 } : null,
        bag: g.play.player.bag.filter((q) => q).map((q) => [q.id, q.n]),
        xp: g.xp.toJSON(), economy: g.economy ? g.economy.toJSON() : null, workers: g.workers ? g.workers.toJSON() : null, moved: mp ? {} : g.forest.moved, wolves: g.wild.difficulty.wolvesSpawned,
      });
    }
    restore(x) {
      const g = this.g, play = this.play, d = play.doc, nav = play.nav, T = K.TILE;
      x = SaveCompat.merge(x); const ground = SaveCompat.ground(x, d.w, d.h);
      if (ground.length) {
        for (const [k, h, t] of ground) { d.height[k] = h; d.terrain[k] = t; const i = k % d.w, j = (k - i) / d.w; nav.S[k] = nav.surface((i + 0.5) * T, (j + 0.5) * T, d.hy(i, j)); }
        play.R.tilesChanged(0, 0, d.w, d.h); if (g.tools.editor) g.tools.editor.version++;
      }
      // trees that grew back somewhere else, then free the ground of every felled tree and rock (and plan the regrowth)
      for (const e of g.forest.nodes) {
        const m = x.moved && x.moved[e.id]; if (m) { g.forest.free(e); e.obj.x = m[0]; e.obj.z = m[1]; e.x = m[0]; e.z = m[1]; e.y = nav.y(m[0], m[1]); g.forest.moved[e.id] = m; nav.blockProp(e.obj); }
        if (!g.forest.live(e)) g.forest.cleared(e);
      }
      play.R.objectsChanged(false);
      if (x.home) g.site.restore('cottage', x.home.x, x.home.z, x.home.turns);   // before anything that lives in the house
      if (x.smithy) g.site.restore('blacksmith', x.smithy.x, x.smithy.z, x.smithy.turns);
      if (x.market) g.site.restore('market', x.market.x, x.market.z, x.market.turns);
      for (const [t, h] of Object.entries(x.halls || {})) if (K.BUILDING_PREFABS[t]) g.site.restore(t, h.x, h.z, h.turns);
      if (x.bag) { const p = g.play.player; for (let i = 0; i < p.bag.length; i++) p.bag[i] = null; for (const [id, n] of x.bag) p.addItem(id, n); }   // what you carry: bread, meat, the lantern
      for (const id of x.weapons || []) { if (!g.tools.belt.weapons.some((w) => w.id === id)) { const w = K.Armory.make(id); if (w) g.tools.belt.addWeapon(w); } }
      if (x.weapons && x.weapons.includes('bow') && g.home.rack) { g.home.rack.owned = true; g.home.rack.bow.visible = false; }
      if (x.held) { const w = g.tools.belt.weapons.find((q) => q.id === x.held); if (w) g.tools.belt.equip(w); }
      for (const [id, n] of x.stores || []) { const s = g.home.stores.find((q) => q.id === id); if (s) { s.stock = n; s.sync(); } }
      if (!g.net) for (const p of x.piles || []) g.home.dropPile(p.res, p.x, p.z, p.n, null);   // on a server the piles come from the server
      for (const [id, v] of Object.entries(x.vaults || {})) { const vault = g.purse.vault(id); vault.res = v.res || {}; vault.items = v.items || {}; vault.weapons = (v.weapons || []).map((w) => K.Armory.make(w)).filter(Boolean); }
      if (x.tray && x.tray.length) { g.forge = g.forge || new K.Forge(g); g.forge.restoreTray(x.tray); }
      if (x.wolves) g.wild.difficulty.wolvesSpawned = x.wolves;
      if (x.xp) g.xp.restore(x.xp);
      if (x.economy && g.economy) g.economy.restore(x.economy);
      if (x.workers && g.workers) g.workers.restore(x.workers);
      if (x.respawn && !g.net) { g.respawn = x.respawn; g.play.spawn = { x: x.respawn.x, z: x.respawn.z }; }
    }
  }

  K.Persist = Persist; K.SaveCompat = SaveCompat;
})(typeof window !== 'undefined' ? window : globalThis);
