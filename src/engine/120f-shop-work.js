/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · ShopWork: the trade a cook, smith or shopkeeper plies inside their own building, in plain sight. They walk
   between the furniture of their trade (anvil and forge, oven and kneading table, cauldron and bookshelf…) and work each. */
(function (G) {
  const K = G.K;

  class ShopWork {
    constructor(stations) { this.stations = stations; }
    /** each trade's furniture, and the pose used at each */
    static get TRADES() {
      return {
        cook: { hearth: 'stir', pantry: 'lift', table: 'knead' },
        smith: { anvil: 'hammer', forge: 'stir', quench_tub: 'lift', grindstone: 'saw', workbench: 'hammer' },
        bakery: { kneading_table: 'knead', oven: 'stir', bread_rack: 'lift', flour_sack: 'lift' },
        butcher: { chopping_block: 'chop', meat_hooks: 'lift', counter: 'knead' },
        library: { cauldron: 'stir', alchemy_table: 'knead', bookshelf: 'read', potion_shelf: 'lift' },
        stable: { horse: 'brush', trough: 'lift', hay_bale: 'pitch', tack_rack: 'lift' },
      };
    }
    /** queue about `secs` seconds of work at the trade's stations in building spec; false if it has none */
    queue(job, e, spec, trade, secs = 8) {
      const poses = ShopWork.TRADES[trade], st = this.stations.of(spec, Object.keys(poses));
      if (!st.length) { e.pause(2, 'action'); return false; }
      let left = secs;
      while (left > 0) {
        const s = st[(job.loop++) % st.length], t = Math.min(left, 3 + Math.random() * 2.5);
        e.go(s.x, s.z).work(t, poses[s.type] || 'lift', s.face); left -= t;
      }
      return true;
    }
  }

  K.ShopWork = ShopWork;
})(typeof window !== 'undefined' ? window : globalThis);
