/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · plundering. One creature gnawing at one of your stores, swing by swing: each bite knocks one unit
   out, a little cube of it flies to the creature, and it carries what it took. When it has had its fill it leaves
   (and takes the food with it); if you kill it, every cube it took falls out for you to collect.
   Used by wolves at night (the smell of your food is what draws them to your house).
     Plunder   the gnawing, the carried cubes, and what happens when it is killed or leaves */
(function (G) {
  const K = G.K;
  const rnd = (a, b) => a + Math.random() * (b - a);

  class Plunder {
    /** limit: how many bites this creature takes before it is full */
    constructor(game, actor, limit) { this.g = game; this.a = actor; this.limit = limit; this.bites = 0; this.t = 0; this.amount = 0; this.res = null; this.loot = null; }
    get done() { return this.bites >= this.limit; }
    get carrying() { return this.amount > 0; }
    /** keep the carried cube over its head */
    follow() { if (this.loot) { const a = this.a; this.loot.mesh.position.set(a.x, a.y + 0.95, a.z); this.loot.mesh.rotation.y += 0.03; } }
    /** one tick of gnawing at the store st. true while it still has an appetite. */
    gnaw(dt, st) {
      const g = this.g, a = this.a; this.t += dt; if (this.t < 0.6) return !this.done; this.t = 0;
      if (this.done || st.amount < 1) return false;
      this.bites++; if (st.rob(1) < 1) return false;
      a.view.setState('attack'); g.sound.play('gather');
      const res = this.res = st.res, fx = g.tools.effects, y = g.play.nav.y(st.ent.x, st.ent.z) + 0.5;
      if (!this.loot) this.loot = new K.Loot(fx.group, fx.materials, res);
      fx.burst(res, st.ent.x, y, st.ent.z, 3, 2);
      fx.courier(res, { x: st.ent.x, y, z: st.ent.z }, a, () => { this.amount++; });   // the food flies out to it
      return !this.done;
    }
    /** it gets away with what it took */
    escape() { if (this.carrying) this.g.cui.toast('A wolf ran off with some of your food.'); this.release(); }
    release() { if (this.loot) { this.loot.dispose(); this.loot = null; } }
    /** killed: every cube it took drops where it fell */
    drop() {
      const g = this.g, a = this.a, fx = g.tools.effects, y = g.play.nav.y(a.x, a.z) + 0.6; this.release();
      for (let i = 0; i < this.amount; i++) fx.spawnPickup(this.res, 1, a.x + rnd(-0.3, 0.3), y, a.z + rnd(-0.3, 0.3), 2.4, true);
      this.amount = 0;
    }
  }

  K.Plunder = Plunder;
})(typeof window !== 'undefined' ? window : globalThis);
