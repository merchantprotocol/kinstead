/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CastleActors: adds creatures and people to play mode and takes them out again cleanly. */
(function (G) {
  const K = G.K;

  class CastleActors {
    constructor(game) { this.g = game; }
    /** a new actor of the hero's own kind, made from cfg and added to play */
    add(cfg) {
      const play = this.g.play, Actor = play.me.constructor;
      const a = new Actor(play, Object.assign({ info: { xp: 0, loot: [] }, flip: false }, cfg));
      play.actors.push(a);
      return a;
    }
    remove(a) {
      const play = this.g.play, i = play.actors.indexOf(a);
      if (i >= 0) play.actors.splice(i, 1);
      a.view.dispose();
      if (play.target === a) play.target = null;
      if (play.hover === a) play.hover = null;
    }
  }

  K.CastleActors = CastleActors;
})(typeof window !== 'undefined' ? window : globalThis);
