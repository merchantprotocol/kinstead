// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/**
 * Answers a player's periodic 'sync' with only what they are behind on, and never the whole world too often.
 *
 * Versions: p = pieces, buildings and houses; g = gates and doors; f = farms; s = stores; t = dug tiles and felled trees.
 * A client that predates g/f has never seen them, so for it those fall back to p.
 * Every edit already reaches everyone live as it happens, so the sync is only a safety net: the world maps go to
 * one player at most once a minute per group (world, stores, land). When they are held back, the reply keeps that player's old versions so the next
 * sync asks again. Clients treat a resync 'world' as complete, so it is all-or-nothing.
 */
export class Resync {
  static WORLD_MS = 60000;

  constructor(room) {
    this.room = room;
    this.lastSent = new WeakMap();    // player -> { world, stores, land }: ms each group was last sent
  }

  /** may this group go to this player again yet? (marks it sent when it may) */
  due(player, group, now) {
    const sent = this.lastSent.get(player) || {};
    if (now - (sent[group] || 0) < Resync.WORLD_MS) return false;
    sent[group] = now;
    this.lastSent.set(player, sent);
    return true;
  }

  behind(versions, key) {
    const theirs = versions[key] === undefined ? versions.p : versions[key];
    return theirs !== this.room.ver[key];
  }

  /** the player was just handed the whole world (their welcome) */
  sent(player) {
    const now = Date.now();
    this.lastSent.set(player, { world: now, stores: now, land: now });
  }

  reply(player, versions) {
    const room = this.room, ver = Object.assign({}, room.ver), now = Date.now();
    const out = { t: 'resync', ver, players: room.online().filter((q) => q !== player).map((q) => room.pub(q)) };
    const stale = ['p', 'g', 'f'].some((key) => this.behind(versions, key));
    if (stale && this.due(player, 'world', now)) {
      // clients treat a resync world as complete: pieces always travel with doors and farms
      out.world = { pieces: room.world.pieces, buildings: room.world.buildings, doors: room.world.doors, farms: room.world.farms };
      out.claimed = room.claimed();
      out.gates = room.gates;
      out.teams = room.teamList();
    } else if (stale) {
      ver.p = versions.p;
      ver.g = versions.g;
      ver.f = versions.f;
    }
    if (versions.s !== room.ver.s) {
      if (this.due(player, 'stores', now)) out.stores = Object.values(room.stores);
      else ver.s = versions.s;
    }
    if (versions.t !== room.ver.t) {
      if (this.due(player, 'land', now)) {
        out.tiles = room.world.tiles;
        out.nodes = room.world.nodes;
      } else ver.t = versions.t;
    }
    return out;
  }

  install(room) {
    room.resync = new Resync(room);
  }
}
