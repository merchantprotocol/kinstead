/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · ZoneBarriers: the walls of ice that close off a zone until the night it opens after. */
(function (G) {
  const K = G.K;

  class ZoneBarriers {
    static OPEN_TOAST = {
      iron_hills: 'Dawn: a thaw wave opens the Iron Hills (north-east). Iron rocks, an outcrop for a mine… and a figure in the ice.',
      other: 'Dawn: the frost on the bridge breaks. The Rime Troll waits on the far side.',
    };

    constructor(game) { this.g = game; this.barriers = {}; }
    /** every zone still closed gets its wall of ice */
    raiseClosed() {
      this.barriers = {};
      for (const [zone, b] of Object.entries(this.g.L.barriers)) if (!this.g.castle.zoneOpen(zone)) this.add(zone, b);
    }
    add(zone, b) {
      const g = this.g, w = b.x1 - b.x0, d = b.z1 - b.z0, x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2;
      const m = g.art.ice(w, 2.4, d, zone.length * 5);
      const nav = g.play.nav, prev = [];   // remember each tile's walkability: bridge decks stand on chasm terrain
      g.ground.rectTiles(x, z, w + 0.6, d + 0.6, 0, (i, j) => {
        const k = j * nav.w + i;
        prev.push([k, nav.walk[k]]);
        nav.walk[k] = 0;
      });
      g.place(m, x, z, 0);
      this.barriers[zone] = { m, x, z, w, d, prev };
    }
    open(zone) {
      const g = this.g, b = this.barriers[zone];
      if (!b) return;
      g.group.remove(b.m);
      delete this.barriers[zone];
      const nav = g.play.nav;
      for (const [k, v] of b.prev) if (!g.occ[k]) nav.walk[k] = v;
      g.puff(b.x, b.z);
      g.sound.play('crack');
      g.cui.toast(ZoneBarriers.OPEN_TOAST[zone] || ZoneBarriers.OPEN_TOAST.other);
    }
    openAll() { for (const zone of Object.keys(this.barriers)) this.open(zone); }
  }

  K.ZoneBarriers = ZoneBarriers;
})(typeof window !== 'undefined' ? window : globalThis);
