/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · remembering your homestead. The core save (stores, pieces, trees you felled, the clock) lives in
   CastleGame.snapshot; this class adds everything built on top of the land and puts it back on Continue:
   dropped piles, what is in the barrels, chests, tables and the forge's shelf, the weapons you own, the blacksmith,
   the ground you dug or raised, and trees that grew back somewhere new.
     Persist.capture()   a plain JSON object
     Persist.restore(x)  rebuild it all after the world and the game are up */
(function (G) {
  const K = G.K;

  class Persist {
    constructor(game) {
      this.g = game; const d = game.play.doc;
      this.h0 = Int8Array.from(d.height); this.t0 = Uint8Array.from(d.terrain);   // the land as generated: dug and raised ground is saved as the difference
    }
    get play() { return this.g.play; }
    weaponIds(list) { return list.map((w) => w.id); }
    capture() {
      const g = this.g, d = this.play.doc, terrain = [];
      for (let k = 0; k < d.height.length; k++) if (d.height[k] !== this.h0[k] || d.terrain[k] !== this.t0[k]) terrain.push([k, d.height[k], d.terrain[k]]);
      const vaults = {}; for (const [id, v] of g.purse.vaults) vaults[id] = { res: v.res, items: v.items, weapons: this.weaponIds(v.weapons) };
      return {
        terrain, vaults,
        piles: g.home.stores.filter((s) => s.pile && s.present).map((s) => ({ res: s.res, x: s.x, z: s.z, n: s.stock })),
        stores: g.home.stores.filter((s) => !s.pile && s.stock != null).map((s) => [s.id, s.stock]),
        weapons: this.weaponIds(g.tools.belt.weapons), held: g.tools.tool.kind === 'weapon' ? g.tools.tool.id : null,
        tray: g.forge ? g.forge.tray.map((t) => (t.kind === 'weapon' ? { weapon: t.id } : { res: t.id, n: t.n })) : [],
        smithy: g.smithy ? { x: g.smithy.x, z: g.smithy.z, turns: g.smithyTurns || 0 } : null,
        moved: g.forest.moved, wolves: g.wild.difficulty.wolvesSpawned,
      };
    }
    restore(x) {
      const g = this.g, play = this.play, d = play.doc, nav = play.nav, T = K.TILE;
      if (x.terrain && x.terrain.length) {
        for (const [k, h, t] of x.terrain) { d.height[k] = h; d.terrain[k] = t; const i = k % d.w, j = (k - i) / d.w; nav.S[k] = nav.surface((i + 0.5) * T, (j + 0.5) * T, d.hy(i, j)); }
        play.R.tilesChanged(0, 0, d.w, d.h); if (g.tools.editor) g.tools.editor.version++;
      }
      // trees that grew back somewhere else, then free the ground of every felled tree and rock (and plan the regrowth)
      for (const e of g.forest.nodes) {
        const m = x.moved && x.moved[e.id]; if (m) { g.forest.free(e); e.obj.x = m[0]; e.obj.z = m[1]; e.x = m[0]; e.z = m[1]; e.y = nav.y(m[0], m[1]); g.forest.moved[e.id] = m; nav.blockProp(e.obj); }
        if (!g.forest.live(e)) g.forest.cleared(e);
      }
      play.R.objectsChanged(false);
      if (x.smithy) g.site.restore(x.smithy.x, x.smithy.z, x.smithy.turns);
      for (const id of x.weapons || []) { if (!g.tools.belt.weapons.some((w) => w.id === id)) { const w = K.Armory.make(id); if (w) g.tools.belt.addWeapon(w); } }
      if (x.weapons && x.weapons.includes('bow') && g.home.rack) { g.home.rack.owned = true; g.home.rack.bow.visible = false; }
      if (x.held) { const w = g.tools.belt.weapons.find((q) => q.id === x.held); if (w) g.tools.belt.equip(w); }
      for (const [id, n] of x.stores || []) { const s = g.home.stores.find((q) => q.id === id); if (s) { s.stock = n; s.sync(); } }
      for (const p of x.piles || []) g.home.dropPile(p.res, p.x, p.z, p.n, null);
      for (const [id, v] of Object.entries(x.vaults || {})) { const vault = g.purse.vault(id); vault.res = v.res || {}; vault.items = v.items || {}; vault.weapons = (v.weapons || []).map((w) => K.Armory.make(w)).filter(Boolean); }
      if (x.tray && x.tray.length) { g.forge = g.forge || new K.Forge(g); g.forge.restoreTray(x.tray); }
      if (x.wolves) g.wild.difficulty.wolvesSpawned = x.wolves;
    }
  }

  K.Persist = Persist;
})(typeof window !== 'undefined' ? window : globalThis);
