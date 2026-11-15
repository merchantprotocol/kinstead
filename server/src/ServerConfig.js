// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/** Immutable server rules shared by the realtime domain services. */
export class ServerConfig {
  static MAX_PLAYERS = 30;
  static DOOR_HP = 3000;
  static DMG = { sword: 5, stoneblade: 5, ironsword: 9, spear: 7, warhammer: 18, longbow: 9, bow: 6, axe: 8, pickaxe: 8, shovel: 3, hammer: 4, default: 4 };
  static PLOTS = ServerConfig.buildPlots();
  static CYCLE = { day: 210, night: 100 };
  static WEATHER_SEC = 150;
  static STONE = new Set(['stone_wall', 'stone_gate']);
  static RES = new Set(['wood', 'stone', 'dirt', 'iron', 'food', 'arrow', 'gold', 'bread']);
  static TICK_MS = 120;
  static SAVE_MS = 5000;

  static buildPlots() {
    const plots = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) plots.push({ x: 30 + c * 44, z: 30 + r * 35 });
    return plots.sort((p, q) => Math.hypot(p.x - 140, p.z - 100) - Math.hypot(q.x - 140, q.z - 100));
  }

  static weatherFor(period, seed) {
    let h = (period * 2654435761 + seed) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
    const r = (h % 1000) / 1000;
    return r < 0.5 ? 'clear' : r < 0.8 ? 'flurries' : 'blizzard';
  }
}
