/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · BakerRound: the baker's walk through the town economy. To the mill, where the miller hands over a sack (the
   wheat really comes out of your silo, market or farms); to the barn, where the cowherd hands over a pail (for show: bread
   is made from wheat alone, so no milk is taken); back to the bakery to knead and bake in sight; then two loaves to the
   clerk at the market. Without a mill the baker takes wheat straight from the silo or the market. */
(function (G) {
  const K = G.K;
  const at = K.WorkSpots.local;

  class BakerRound {
    constructor(workers) { this.w = workers; }
    /** queue one round for the baker; false if there is nothing to bake with or nowhere to sell */
    round(b, e) {
      b.cool = 12; const eco = b.eco, m = b.market; if (!m) return false;
      const l = eco.ledger(m); if (l.amount('bread') >= 60) return false;
      const mill = eco.of('storehouse')[0], fromMill = !!mill && eco.wheatHeld() - b.g.castle.amount('wheat') >= 3;
      if (!fromMill && l.amount('wheat') < 3) return false;
      const d = b.door; e.go(d.x, d.z);
      if (fromMill) this.atMill(b, e, mill); else this.atSilo(b, e);
      const barn = eco.of('barn')[0]; if (barn) this.atBarn(b, e, barn);
      e.go(d.x, d.z).carry(null); this.w.shop.queue(b, e, b.hall, 'bakery', 10);
      b.deliver(e, 'bread', 2, () => b.g.cui.toast('The baker brought 2 loaves of bread to the market.'), 'bread', 'Two fresh loaves!');
      return true;
    }
    atMill(b, e, mill) {
      const stand = at(mill, 1.0, 1.25);
      e.go(stand.x, stand.z).then(() => b.eco.takeWheat(3, false));
      b.meet(e, this.w.keepers.get(mill.uid), 'Three sacks’ worth for the ovens?', 'Here you are, ground this morning.', { prop: 'flour', toMe: true });
      e.pause(2.4).carry('flour');
    }
    atSilo(b, e) {
      const eco = b.eco, silo = eco.of('silo').find((s) => eco.ledger(s).amount('wheat') >= 3);
      if (silo) { const s = at(silo, 0, 1.4); e.go(s.x, s.z).work(1.2, 'lift', silo).then(() => eco.ledger(silo).take('wheat', 3) >= 3).carry('sack'); return; }
      const c = b.counter; e.go(c.x, c.z).work(1, 'lift', b.market).then(() => b.fetch({ wheat: 3 })).carry('sack');
    }
    atBarn(b, e, barn) {
      const stand = at(barn, -0.9, 1.5); e.go(stand.x, stand.z);
      b.meet(e, this.w.keepers.get(barn.uid), 'A pail of milk for the dough?', 'Take this one, still warm.', { prop: 'bucket', toMe: true });
      e.pause(2.4).carry('bucket');
    }
  }

  K.BakerRound = BakerRound;
})(typeof window !== 'undefined' ? window : globalThis);
