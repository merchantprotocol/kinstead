/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  class CastleHero extends K.PlayerState {
    constructor(items, castle) { super(items, { name: 'Hearthguard', outfit: 'warden' });
      this.castle = castle;
      this.hp = this.stats().hpMax;
      }
    stats() {
      if (!this.castle) return super.stats();
      const h = this.castle.heroStats(), L = this.xp ? this.xp.level : 1;
        // each level: +10 strength, +1 attack
      return { atk: h.atk + (L - 1), def: 0, hpMax: h.hpMax + 10 * (L - 1), speed: 1, level: L, cd: this.castle.data.swingSec };
    }
    gainXp() { return false;
      }
  }
  K.CastleHero = CastleHero;
})(typeof window !== 'undefined' ? window : globalThis);
