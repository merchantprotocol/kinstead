// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/**
 * The creatures and townsfolk each player's game runs, relayed to everyone else without flooding them.
 *
 * Every owner's latest list is kept here. Nothing is forwarded when it arrives: the room's timer calls flush()
 * a few times a second and each player gets ONE message holding only the owners near them (nearest first, up to
 * a mob budget), and of those only the entries that changed since the last flush.
 *
 * Wire formats
 *   in  (legacy)  { t:'mobs', list:[[id, kind, x, z, y, f, st, hp, hpMax, name], …] }         the owner's whole list
 *   in  (v2)      { t:'mobs', v:2, full?:1, u:[[id, x, z, y, f, st, hp]], n:[[id, kind, hpMax, name]], g:[id] }
 *   out (v2)      { t:'mobz', o:[[owner, full, rows, meta, gone], …], out:[owner] }
 *   out (legacy)  { t:'mobs', from, list }   one per owner, for clients that did not say hello with v:2
 */
export class MobRelay {
  static MAX_MOBS = 40;
  static FLUSH_EVERY = 2;          // room ticks (120 ms) per flush: ~4 Hz
  static RANGE = 90;               // metres from a player to an owner's creatures
  static BUDGET = 90;              // creatures sent to one player at most (the client shows ~60)
  static REFRESH_MS = 15000;       // a full list again now and then, so nothing goes stale
  static LEGACY_KEEPALIVE_MS = 1500;

  constructor(room) {
    this.room = room;
    this.owners = new Map();       // owner id -> OwnerMobs
    this.ticks = 0;
  }

  /** a 'mobs' message from a player's game */
  receive(player, message) {
    const owner = this.ownerFor(player.id);
    if (message.v === 2) owner.applyDelta(message);
    else owner.replace(Array.isArray(message.list) ? message.list : []);
  }

  ownerFor(id) {
    let owner = this.owners.get(id);
    if (!owner) {
      owner = new OwnerMobs(id);
      this.owners.set(id, owner);
    }
    return owner;
  }

  drop(id) {
    this.owners.delete(id);
    for (const viewer of this.room.sockets.values()) if (viewer.mobView) viewer.mobView.known.delete(id);
  }

  /** called by the room every tick; does real work every FLUSH_EVERY ticks */
  tick(online) {
    if (++this.ticks % MobRelay.FLUSH_EVERY) return;
    const now = Date.now();
    for (const [ws, player] of this.room.sockets) {
      if (!player.joined) continue;
      const view = player.mobView || (player.mobView = new MobView(player.mobsV2));
      const message = view.build(player, this.nearOwners(player), now);
      for (const out of message) this.room.send(ws, out);
    }
    for (const owner of this.owners.values()) owner.settle();
    if (!online.length) this.owners.clear();
  }

  /** the owners whose creatures are near this player, nearest first, until the budget is spent */
  nearOwners(player) {
    const ranked = [];
    for (const owner of this.owners.values()) {
      if (owner.id === player.id || !owner.mobs.size) continue;
      const d = owner.distanceTo(player.x, player.z);
      if (d <= MobRelay.RANGE) ranked.push([d, owner]);
    }
    ranked.sort((a, b) => a[0] - b[0]);
    const chosen = [];
    let spent = 0;
    for (const [, owner] of ranked) {
      if (spent >= MobRelay.BUDGET) break;
      chosen.push(owner);
      spent += owner.mobs.size;
    }
    return chosen;
  }

  install(room) {
    room.mobRelay = new MobRelay(room);
  }
}

/** one owner's creatures as the server last heard them, and what changed since the last flush */
class OwnerMobs {
  constructor(id) {
    this.id = id;
    this.mobs = new Map();         // mob id -> [id, x, z, y, f, st, hp]
    this.meta = new Map();         // mob id -> [id, kind, hpMax, name]
    this.changed = new Set();
    this.fresh = new Set();        // ids whose static facts are new since the last flush
    this.gone = new Set();
    this.box = null;
  }

  static num(v, step) {
    const n = +v;
    return Number.isFinite(n) ? Math.round(n / step) * step : 0;
  }

  static row(id, x, z, y, f, st, hp) {
    const q = OwnerMobs.num;
    return [id, +q(x, 0.1).toFixed(1), +q(z, 0.1).toFixed(1), +q(y, 0.1).toFixed(1), +q(f, 0.1).toFixed(1), String(st || 'idle').slice(0, 10), q(hp, 1)];
  }

  static metaRow(id, kind, hpMax, name) {
    return [id, String(kind || 'wolf').slice(0, 40), OwnerMobs.num(hpMax, 1) || 30, String(name || '').slice(0, 30)];
  }

  /** a legacy whole list: rows of [id, kind, x, z, y, f, st, hp, hpMax, name] */
  replace(list) {
    const seen = new Set();
    for (const entry of list.slice(0, MobRelay.MAX_MOBS)) {
      if (!Array.isArray(entry)) continue;
      const [id, kind, x, z, y, f, st, hp, hpMax, name] = entry;
      const key = String(id).slice(0, 40);
      seen.add(key);
      this.setMeta(OwnerMobs.metaRow(key, kind, hpMax, name));
      this.setRow(OwnerMobs.row(key, x, z, y, f, st, hp));
    }
    for (const key of [...this.mobs.keys()]) if (!seen.has(key)) this.remove(key);
    this.reshape();
  }

  /** a v2 delta: changed rows, static facts for new ids, ids that are gone (or, with full, a whole list) */
  applyDelta(message) {
    const rows = Array.isArray(message.u) ? message.u.slice(0, MobRelay.MAX_MOBS) : [];
    for (const meta of (Array.isArray(message.n) ? message.n : []).slice(0, MobRelay.MAX_MOBS)) {
      if (Array.isArray(meta)) this.setMeta(OwnerMobs.metaRow(String(meta[0]).slice(0, 40), meta[1], meta[2], meta[3]));
    }
    const seen = new Set();
    for (const entry of rows) {
      if (!Array.isArray(entry)) continue;
      const key = String(entry[0]).slice(0, 40);
      if (!this.meta.has(key)) continue;   // never told what it is: ignore until it is
      seen.add(key);
      this.setRow(OwnerMobs.row(key, entry[1], entry[2], entry[3], entry[4], entry[5], entry[6]));
    }
    for (const id of (Array.isArray(message.g) ? message.g : []).slice(0, MobRelay.MAX_MOBS)) this.remove(String(id).slice(0, 40));
    if (message.full) for (const key of [...this.mobs.keys()]) if (!seen.has(key)) this.remove(key);
    while (this.mobs.size > MobRelay.MAX_MOBS) this.remove(this.mobs.keys().next().value);
    this.reshape();
  }

  setMeta(meta) {
    const old = this.meta.get(meta[0]);
    if (old && old[1] === meta[1] && old[2] === meta[2] && old[3] === meta[3]) return;
    this.meta.set(meta[0], meta);
    this.fresh.add(meta[0]);
    if (this.mobs.has(meta[0])) this.changed.add(meta[0]);
  }

  setRow(row) {
    const old = this.mobs.get(row[0]);
    if (old && old.every((v, i) => v === row[i])) return;
    this.mobs.set(row[0], row);
    this.changed.add(row[0]);
    this.gone.delete(row[0]);
  }

  remove(id) {
    if (!this.mobs.delete(id)) return;
    this.meta.delete(id);
    this.changed.delete(id);
    this.fresh.delete(id);
    this.gone.add(id);
  }

  reshape() {
    let box = null;
    for (const [, x, z] of this.mobs.values()) {
      if (!box) box = [x, z, x, z];
      else box = [Math.min(box[0], x), Math.min(box[1], z), Math.max(box[2], x), Math.max(box[3], z)];
    }
    this.box = box;
  }

  distanceTo(x, z) {
    const b = this.box;
    if (!b) return Infinity;
    const dx = Math.max(b[0] - x, 0, x - b[2]), dz = Math.max(b[1] - z, 0, z - b[3]);
    return Math.hypot(dx, dz);
  }

  fullRows() { return [...this.mobs.values()]; }
  allMeta() { return [...this.mobs.keys()].map((id) => this.meta.get(id)).filter(Boolean); }
  changedRows() { return [...this.changed].map((id) => this.mobs.get(id)).filter(Boolean); }
  changedMeta() { return [...this.fresh].filter((id) => this.mobs.has(id)).map((id) => this.meta.get(id)).filter(Boolean); }
  hasNews() { return this.changed.size > 0 || this.gone.size > 0; }

  legacyList() {
    const out = [];
    for (const [id, x, z, y, f, st, hp] of this.mobs.values()) {
      const meta = this.meta.get(id) || [id, 'wolf', 30, ''];
      out.push([id, meta[1], x, z, y, f, st, hp, meta[2], meta[3]]);
    }
    return out;
  }

  /** the flush has gone out to everyone: start collecting the next changes */
  settle() {
    this.changed.clear();
    this.fresh.clear();
    this.gone.clear();
  }
}

/** what one player has been told about everyone else's creatures */
class MobView {
  constructor(v2) {
    this.v2 = !!v2;
    this.known = new Map();        // owner id -> ms when last sent in full (v2) or at all (legacy)
  }

  build(player, owners, now) {
    return this.v2 ? this.buildV2(owners, now) : this.buildLegacy(owners, now);
  }

  buildV2(owners, now) {
    const entries = [], near = new Set();
    for (const owner of owners) {
      near.add(owner.id);
      const last = this.known.get(owner.id);
      if (last === undefined || now - last > MobRelay.REFRESH_MS) {
        this.known.set(owner.id, now);
        entries.push([owner.id, 1, owner.fullRows(), owner.allMeta(), []]);
      } else if (owner.hasNews()) {
        entries.push([owner.id, 0, owner.changedRows(), owner.changedMeta(), [...owner.gone]]);
      }
    }
    const out = [];
    for (const id of [...this.known.keys()]) if (!near.has(id)) { this.known.delete(id); out.push(id); }
    if (!entries.length && !out.length) return [];
    const message = { t: 'mobz', o: entries };
    if (out.length) message.out = out;
    return [message];
  }

  /** an old client: whole lists, one message per owner, often enough that its 2.5 s timeout never fires */
  buildLegacy(owners, now) {
    const messages = [], near = new Set(owners.map((owner) => owner.id));
    for (const id of [...this.known.keys()]) if (!near.has(id)) this.known.delete(id);
    for (const owner of owners) {
      const last = this.known.get(owner.id);
      if (last !== undefined && !owner.hasNews() && now - last < MobRelay.LEGACY_KEEPALIVE_MS) continue;
      this.known.set(owner.id, now);
      messages.push({ t: 'mobs', from: owner.id, list: owner.legacyList() });
    }
    return messages;
  }
}
