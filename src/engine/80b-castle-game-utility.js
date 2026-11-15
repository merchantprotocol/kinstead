/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;

  class CastleGameUtility {
    static clamp(value, min, max) { return Math.max(min, Math.min(max, value));
      }
    static lerp(from, to, amount) { return from + (to - from) * amount;
      }
    static formatCost(cost) {
      return Object.entries(cost || {})
        .map(([resource, amount]) => `${amount} ${K.CastleData.resName(resource)}`)
        .join(', ') || 'free';
    }
  }

  K.CastleGameUtility = CastleGameUtility;
})(typeof window !== 'undefined' ? window : globalThis);
