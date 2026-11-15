/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · EntityDirectory: everything you can click in castle mode. Your home's things, your pieces, other settlers'
   walls, gates, doors and stores, and any registered source (shop shelves...). */
(function (G) {
  const K = G.K;

  class EntityDirectory {
    constructor(game) { this.g = game; this.sources = new Map(); }
    entities() {
      const g = this.g, out = g.home ? g.home.entities() : [];
      for (const p of g.castle.pieces) out.push(g.pieceEnt(p));
      if (g.mp) for (const e of g.mp.world.entities().concat(g.mp.stores.entities())) out.push(e);   // other settlers' walls, gates and doors
      for (const source of this.sources.values()) out.push(...source.entities());
      return out;
    }
    add(source) {
      if (this.sources.has(source.id)) this.remove(source.id);
      this.sources.set(source.id, source);
      return source;
    }
    remove(id) {
      const source = this.sources.get(id);
      if (!source) return false;
      this.sources.delete(id);
      source.dispose();
      return true;
    }
    disposeAll() { for (const id of [...this.sources.keys()]) this.remove(id); }
  }

  K.EntityDirectory = EntityDirectory;
})(typeof window !== 'undefined' ? window : globalThis);
