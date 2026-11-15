/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · PlayerRelations: you and the other settlers. Whose keys you hold, hitting another player, their menu. */
(function (G) {
  const K = G.K;

  class PlayerRelations {
    static OWN_BUILDINGS = new Set(['home', 'smithy', 'market']);

    constructor(game) { this.g = game; }
    /** do you hold the key to this building? (your own house and workshop always; others' only through a key, yours or your team's) */
    keyFor(id) {
      const g = this.g;
      if (PlayerRelations.OWN_BUILDINGS.has(id) || g.halls[id]) return true;
      return g.mp ? g.mp.keyFor(id) : false;
    }
    /** you hit another player (or someone else's creature), or your creature bit one: tell the server, it works out the damage */
    pvpHit(a, b) {
      const g = this.g, mp = g.mp;
      if (!mp) return;
      if (a === g.play.me) {
        if (b.mob) mp.mobHit(b);
        else mp.pvp(b.pid);
        g.xp.dealt();
        g.sound.play('hit');
      } else if (!a.remote && !b.mob && b.pid) mp.mobBite(a, b);
    }
    playerMenu(e) { if (this.g.mp) this.g.mp.playerMenu(e); }
  }

  K.PlayerRelations = PlayerRelations;
})(typeof window !== 'undefined' ? window : globalThis);
