/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CostText: a cost as words ("12 wood, 4 stone", or "free"). */
(function (G) {
  const K = G.K;

  class CostText {
    static format(cost) {
      return Object.entries(cost || {}).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ') || 'free';
    }
  }

  K.CostText = CostText;
})(typeof window !== 'undefined' ? window : globalThis);
