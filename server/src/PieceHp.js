// Copyright (c) 2026 Merchant Protocol. All rights reserved.
import castleData from '../../src/data/game-data-castle.json' with { type: 'json' };

/**
 * How much damage each kind of piece takes before it falls, on the server.
 * Walls and gates keep the server's tougher break-in values (ServerConfig.WALL_HP); every other piece uses the
 * game data's own HP (the same number the client shows), so a coop is 120/120 and not 900/120.
 */
export class PieceHp {
  static DEFAULT = 900;
  static WALL_HP = { palisade: 400, stone_wall: 900, gate: 700, stone_gate: 2500 };
  static MISSING = { stone_tower: 1200 };

  constructor(pieces) {
    this.table = Object.assign({}, PieceHp.MISSING);
    for (const [type, row] of Object.entries(pieces || {})) {
      const hp = row && Number(row.hp);
      if (Number.isFinite(hp) && hp > 0) this.table[type] = hp;   // 0 or text ('keepHP by CL'): not a breakable piece here
    }
    Object.assign(this.table, PieceHp.WALL_HP);
  }

  of(type) {
    return this.table[type] || PieceHp.DEFAULT;
  }

  /** pieces saved before this table existed (a coop stored at 900): bring each to its own maximum */
  normalize(pieces) {
    for (const piece of Object.values(pieces || {})) {
      if (!piece || piece.hp == null) continue;
      piece.hpMax = this.of(piece.type);
      piece.hp = Math.min(piece.hp, piece.hpMax);
    }
  }

  static shared = new PieceHp(castleData.castlePieces);
}
