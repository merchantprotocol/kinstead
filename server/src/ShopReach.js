// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/** Decides whether a buyer stands close enough to an owner's shop to trade with it. */
export class ShopReach {
  static MARKET_RANGE = 12;
  static SHELF_RANGE = 6;
  static SHOP_SPREAD = 45;

  constructor(near) { this.near = near; }

  /** A plain market trade needs the buyer at the market; a shelf trade needs the buyer at a shelf on the owner's grounds. */
  allows(player, market, at) {
    const shelf = this.point(at);
    if (!shelf) return this.near(player, market, ShopReach.MARKET_RANGE);
    if (!this.near(shelf, market, ShopReach.SHOP_SPREAD)) return false;
    return this.near(player, shelf, ShopReach.SHELF_RANGE);
  }

  point(at) {
    if (!at || typeof at !== 'object') return null;
    const x = Number(at.x), z = Number(at.z);
    return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
  }
}
