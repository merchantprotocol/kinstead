/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Gatherer: chopping trees, breaking boulders, clearing rubble and mining iron. A node yields a little per
   swing, keeps going until it is spent or your store is full, and regrows later. */
(function (G) {
  const K = G.K;

  class Gatherer {
    static NODE_OF = { c_tree: 'tree', c_boulder: 'boulder', c_rubble: 'rubble', c_iron: 'iron_rock' };
    static LABEL = { c_tree: 'Chopping…', c_iron: 'Mining…' };

    constructor(game) { this.g = game; }
    nodeSpec(e) { return this.g.data.node(Gatherer.NODE_OF[e.type]); }
    gather(e) {
      const g = this.g, play = g.play, n = this.nodeSpec(e), st = play.nodeState(e);
      g.sound.unlock();
      if (st.charges <= 0) { g.cui.toast(`This ${e.name.toLowerCase()} is spent. ${n.respawnSec ? 'It regrows soon.' : 'It is gone.'}`); return; }
      const [r, base] = Object.entries(n.yields)[0];
      if (this.full(r)) {
        g.cui.toast(`Your ${K.CastleData.resName(r)} store is full (${g.castle.caps()[r]}). Spend it or build a Storehouse.`);
        g.cui.flashRes(r);
        return;
      }
      play.face(play.me, e);
      play.channel({ label: Gatherer.LABEL[e.type] || 'Gathering…', time: 1.5, onDone: () => this.swingDone(e, n, st, r, base) });
    }
    full(r) { return this.g.castle.amount(r) >= this.g.castle.caps()[r]; }
    swingDone(e, n, st, r, base) {
      const g = this.g, play = g.play, got = Math.round(g.castle.gather(r, base));
      if (got > 0) {
        play.float(play.me, `+${got}`, 'loot', K.CastleUI.ICON[r]);
        g.cui.bump(r);
        g.sound.play('gather');
      }
      st.charges--;
      if (e.type === 'c_tree' && st.charges > 0) g.R.setPropState(e.id, 'cut' + Math.min(4, st.max - st.charges));   // the tree visibly shrinks with every swing
      if (st.charges <= 0) this.spent(e, n, st);
      else if (!this.full(r)) this.gather(e);
      else {
        play.me.view.setState('idle');
        const name = K.CastleData.resName(r);
        g.cui.toast(`${name[0].toUpperCase() + name.slice(1)} is full.`);
        g.cui.flashRes(r);
      }
      g.changed();
    }
    spent(e, n, st) {
      const g = this.g, play = g.play;
      st.respawnAt = n.respawnSec ? play.t + n.respawnSec : Infinity;
      g.R.setPropState(e.id, 'depleted');
      g.forest.cleared(e);
      play.me.view.setState('idle');
    }
    /** a saved game's half-cut trees and spent rocks come back as they were */
    restoreNodes(saved) {
      if (!saved || !saved.nodes) return;
      const g = this.g, play = g.play;
      for (const [id, n] of Object.entries(saved.nodes)) {
        if (!play.doc.obj(id)) continue;
        const respawnAt = n.respawnIn < 0 ? Infinity : n.respawnIn ? play.t + n.respawnIn : 0;
        play.nodes.set(id, { charges: n.charges, max: n.max, respawnAt });
        if (n.charges <= 0) g.R.setPropState(id, 'depleted');
      }
    }
  }

  K.Gatherer = Gatherer;
})(typeof window !== 'undefined' ? window : globalThis);
