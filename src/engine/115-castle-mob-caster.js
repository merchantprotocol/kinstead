/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · MobCaster: tells the realtime server about the creatures and townsfolk this game runs.
   Four times a second, and only what changed since the last time: rows of [id, x, z, y, facing, state, hp]
   rounded to 10 cm, the static facts [id, kind, hpMax, name] once per creature, and the ids that are gone.
   Every 10 s the whole list goes up again (full), so a restarted server or a missed message heals itself. */
(function (G) {
  const K = G.K;

  class MobCaster {
    static EVERY = 0.25;
    static FULL_EVERY = 10;
    static MAX = 40;

    constructor(game, net) {
      this.g = game;
      this.net = net;
      this.sent = new Map();   // id -> the row last sent, as a string
      this.t = 0;
      this.fullT = 0;
      this.hadMobs = false;
    }

    /** a new connection: the server knows nothing about us yet */
    reset() {
      this.sent.clear();
      this.fullT = 0;
    }

    update(dt) {
      this.fullT -= dt;
      if ((this.t -= dt) > 0) return;
      this.t = MobCaster.EVERY;
      if (!this.net.ready) return;   // not connected: keep what the server last heard, so the next send is right
      this.cast();
    }

    /** is this actor one of ours that other players should see? */
    shows(a, me) {
      const townsperson = !!a.worker || (a.role === 'npc' && String(a.id).startsWith('kin:'));
      if (a.remote || a === me) return false;
      return townsperson || (a.hostile && !!(a.wolf || a.bear || a.thief || a.gameKind));
    }

    kindOf(a) {
      const townsperson = !!a.worker || (a.role === 'npc' && String(a.id).startsWith('kin:'));
      if (townsperson) return 'person:' + a.spriteId;
      return a.gameKind || (a.bear ? 'bear' : a.wolf ? 'wolf' : 'raider');
    }

    rowOf(a) {
      const d = a.view.dir, r = (v) => Math.round(v * 10) / 10;
      return [a.id, r(a.x), r(a.z), r(a.y || 0), r(Math.atan2(d.z, d.x)), a.alive ? a.view.state : 'dead', Math.round(a.hp)];
    }

    cast() {
      const g = this.g, me = g.play.me, full = this.fullT <= 0, u = [], n = [], seen = new Set();
      for (const a of g.play.actors) {
        if (!this.shows(a, me)) continue;
        if (seen.size >= MobCaster.MAX) break;
        const row = this.rowOf(a), key = JSON.stringify(row), known = this.sent.has(a.id);
        seen.add(a.id);
        if (full || !known) n.push([a.id, this.kindOf(a), a.hpMax, a.name]);
        if (full || this.sent.get(a.id) !== key) u.push(row);
        this.sent.set(a.id, key);
      }
      const gone = [];
      for (const id of [...this.sent.keys()]) if (!seen.has(id)) { this.sent.delete(id); gone.push(id); }
      if (full) this.fullT = MobCaster.FULL_EVERY;
      if (!full && !u.length && !gone.length) return;
      if (full && !seen.size && !this.hadMobs) return;
      this.hadMobs = seen.size > 0;
      const message = { t: 'mobs', v: 2, u };
      if (n.length) message.n = n;
      if (gone.length) message.g = gone;
      if (full) message.full = 1;
      this.net.send(message);
    }
  }

  K.MobCaster = MobCaster;
})(typeof window !== 'undefined' ? window : globalThis);
