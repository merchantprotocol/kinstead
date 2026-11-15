/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class Multiplayer extends K.MultiplayerChat {}
  K.Multiplayer = Multiplayer;
})(typeof window !== 'undefined' ? window : globalThis);
