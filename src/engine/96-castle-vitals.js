/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · staying alive. Your health slowly drops all the time and nothing heals it on its own.
   You recover by eating (the table, the pantry, food you cook at the hearth) and by sleeping in your bed:
   those are the house's own interactions from the building system, so this class only owns the drain
   and the warning. */
(function (G) {
  const K = G.K;
  const DRAIN_PER_SEC = 0.15;      // about one health every seven seconds

  class Vitals {
    constructor(game) { this.g = game; this.acc = 0; this.warned = false; }
    get play() { return this.g.play; }
    get player() { return this.play.player; }
    get weak() { return this.player.hp < this.player.stats().hpMax * 0.3; }
    update(dt) {
      const P = this.play; if (!P.me.alive) return;
      this.acc += dt * DRAIN_PER_SEC;
      if (this.acc >= 1) { this.acc -= 1; if (this.player.hurt(1)) P.defeat(); }
      if (this.weak && !this.warned) { this.warned = true; this.g.cui.toast('You are getting weak. Eat something and get some sleep.'); }
      else if (this.warned && this.player.hp > this.player.stats().hpMax * 0.5) this.warned = false;
    }
    dispose() {}
  }

  K.Vitals = Vitals;
})(typeof window !== 'undefined' ? window : globalThis);
