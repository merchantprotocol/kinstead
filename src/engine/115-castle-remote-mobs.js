/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · RemoteMobs: the creatures other players' games are running (their wolves, bears, raiders and townsfolk).
   You see them and you can fight them. Every creature the server tells us about is kept as a light record; only the
   nearest ones (within 70 m of you, at most 60) get an animated actor, so a busy 30-player map stays smooth.
   Messages:  'mobz'  the server's batch: [[owner, full, rows, meta, gone], …] and out:[owner] (now out of range)
              'mobs'  an older server: one owner's whole list of [id, kind, x, z, y, f, st, hp, hpMax, name] */
(function (G) {
  const K = G.K;

  class RemoteMobs {
    static RANGE = 70;
    static MAX_SHOWN = 60;
    static PICK_EVERY = 0.3;
    static LEGACY_TIMEOUT = 2.5;   // an older server re-sends every list, so silence means gone
    static TIMEOUT = 40;           // the batching server re-sends a whole list every 15 s at most

    constructor(game, net) {
      this.g = game;
      this.net = net;
      this.by = new Map();   // owner:id -> record
      this.pool = new K.MobActorPool(game);
      this.pickT = 0;
    }

    key(from, id) { return from + ':' + id; }

    /** an older server's per-owner list */
    update(from, list) {
      const seen = new Set();
      for (const [id, kind, x, z, y, f, st, hp, hpMax, name] of list) {
        const rec = this.record(from, id, kind, hpMax, name, true);
        this.place(rec, x, z, y, f, st, hp);
        seen.add(rec);
      }
      for (const rec of [...this.by.values()]) if (rec.owner === from && !seen.has(rec)) this.remove(rec);
    }

    /** the batching server's message */
    batch(m) {
      for (const owner of m.out || []) this.dropOwner(owner);
      for (const [owner, full, rows, meta, gone] of m.o || []) {
        for (const [id, kind, hpMax, name] of meta || []) this.record(owner, id, kind, hpMax, name, false);
        const seen = new Set();
        for (const [id, x, z, y, f, st, hp] of rows || []) {
          const rec = this.by.get(this.key(owner, id));
          if (!rec) continue;
          this.place(rec, x, z, y, f, st, hp);
          seen.add(rec);
        }
        for (const id of gone || []) { const rec = this.by.get(this.key(owner, id)); if (rec) this.remove(rec); }
        if (full) for (const rec of [...this.by.values()]) if (rec.owner === owner && !seen.has(rec)) this.remove(rec);
        if (!full) this.touchOwner(owner);
      }
    }

    record(owner, id, kind, hpMax, name, legacy) {
      const k = this.key(owner, id);
      let rec = this.by.get(k);
      if (!rec) {
        rec = { owner, id, kind, hpMax: hpMax || 30, name: name || kind, tx: 0, tz: 0, ty: 0, f: 0, st: 'idle', hp: hpMax || 30, seen: 0, legacy, a: null, d: Infinity };
        this.by.set(k, rec);
      }
      rec.legacy = legacy;
      rec.hpMax = hpMax || rec.hpMax;
      rec.name = name || rec.name;
      if (rec.kind !== kind) {   // a different creature under the same id: its actor no longer fits
        if (rec.a) this.hide(rec);
        rec.kind = kind;
      }
      return rec;
    }

    place(rec, x, z, y, f, st, hp) {
      rec.tx = x; rec.tz = z; rec.ty = y; rec.f = f; rec.st = st; rec.hp = hp;
      rec.seen = this.g.play.t;
      if (rec.a) { rec.a.hp = hp; rec.a.hpMax = rec.hpMax; }
    }

    /** a delta for this owner arrived: everything they own is still there */
    touchOwner(owner) { const now = this.g.play.t; for (const rec of this.by.values()) if (rec.owner === owner) rec.seen = now; }

    /** every frame: forget the silent, pick who gets an actor, and keep that choice for a few frames */
    tick(dt) {
      const now = this.g.play.t;
      for (const rec of [...this.by.values()]) {
        const limit = rec.legacy ? RemoteMobs.LEGACY_TIMEOUT : RemoteMobs.TIMEOUT;
        if (now - rec.seen > limit) this.remove(rec);
      }
      if ((this.pickT -= dt) > 0) return;
      this.pickT = RemoteMobs.PICK_EVERY;
      this.pick();
    }

    /** the nearest creatures to you, within range, get an actor; the rest are hidden and their actors recycled */
    pick() {
      const me = this.g.play.me, near = [];
      for (const rec of this.by.values()) {
        rec.d = Math.hypot(rec.tx - me.x, rec.tz - me.z);
        if (rec.d <= RemoteMobs.RANGE) near.push(rec);
      }
      near.sort((p, q) => p.d - q.d);
      const shown = new Set(near.slice(0, RemoteMobs.MAX_SHOWN));
      for (const rec of this.by.values()) if (rec.a && !shown.has(rec)) this.hide(rec);
      for (const rec of shown) if (!rec.a) this.show(rec);
    }

    show(rec) {
      const a = this.pool.acquire(rec);
      a.brain = { update: (dt) => this.step(rec, dt) };
      rec.a = a;
    }

    hide(rec) {
      this.pool.release(rec.a);
      rec.a = null;
    }

    step(rec, dt) {
      const a = rec.a;
      if (!a) return;
      const k = Math.min(1, dt * 9), dx = rec.tx - a.x, dz = rec.tz - a.z, d = Math.hypot(dx, dz);
      if (d > 20) { a.x = rec.tx; a.z = rec.tz; } else { a.x += dx * k; a.z += dz * k; }
      a.y += (rec.ty - a.y) * k;
      if (d > 0.04) a.view.setFacing(dx, dz); else a.view.setFacing(Math.cos(rec.f), Math.sin(rec.f));
      const want = rec.st === 'dead' ? 'dead' : rec.st === 'attack' ? 'attack' : d > 0.1 ? (d > 0.8 ? 'run' : 'walk') : 'idle';
      if (a.view.state !== want && !(a.view.state === 'attack' && a.view.stateT < 0.45)) a.view.setState(want);
      if (rec.st === 'dead') a.alive = false;
    }

    remove(rec) {
      if (rec.a) this.hide(rec);
      this.by.delete(this.key(rec.owner, rec.id));
    }

    dropOwner(owner) { for (const rec of [...this.by.values()]) if (rec.owner === owner) this.remove(rec); }

    /** the record for one of someone's creatures, when it is on screen (rec.a is its actor) */
    find(owner, id) { const rec = this.by.get(this.key(owner, id)); return rec && rec.a ? rec : null; }

    /** how many records and actors there are (for tests and the load check) */
    counts() { let shown = 0; for (const rec of this.by.values()) if (rec.a) shown++; return { known: this.by.size, shown }; }

    dispose() {
      for (const rec of [...this.by.values()]) this.remove(rec);
      this.pool.dispose();
    }
  }

  K.RemoteMobs = RemoteMobs;
})(typeof window !== 'undefined' ? window : globalThis);
