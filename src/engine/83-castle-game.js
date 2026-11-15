/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* CastleGame is the public composition root. Its behavior is implemented by the ordered OOP collaborators. */
(function (G) {
  const K = G.K;

  class CastleGame extends K.CastleGameSave {
    constructor(play, opts = {}) { super(play, opts); }
  }

  K.CastleGame = CastleGame;
  new K.CastleInteractionTypes().register();
})(typeof window !== 'undefined' ? window : globalThis);
