/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CastleSaveGame: the castle's save. Reads the slot (or the server's copy) when the game starts, strips the
   land from a castle that was taken, and writes snapshots to this browser and the server. */
(function (G) {
  const K = G.K;

  class CastleSaveGame {
    constructor(game, opts) {
      this.g = game;
      this.slot = new K.CastleSave(opts.storage || K.CastleSave.defaultStorage());
      this.resume = !!opts.resume;
      this.saved = this.read(opts.net);
    }
    /** the saved game to resume from, or null for a fresh start */
    read(net) {
      let saved = this.resume ? this.slot.read() : null;
      if (net && net.welcome.save && this.resume) {   // the server's copy wins: a refresh never loses progress
        try { saved = JSON.parse(net.welcome.save); } catch (e) { console.warn('the saved game on the server could not be read', e); }
      }
      if (!this.resume) this.slot.clear();
      if (this.wasEvicted(net)) saved = this.evictedSave(saved);   // your castle was taken: you keep what you carry, not the land
      return saved;
    }
    wasEvicted(net) {
      const flagged = !!(G.localStorage && G.localStorage.getItem('kinstead.evict'));
      const evicted = !!(net && net.welcome.evicted) || flagged;
      if (evicted) {
        try { G.localStorage.removeItem('kinstead.evict'); } catch (e) { /* ignore */ }
      }
      return evicted;
    }
    /** a saved game after your castle was taken: resources, strength and weapons stay; pieces, buildings, stores and ground do not */
    evictedSave(sv) {
      if (!sv) return null;
      const keep = sv.extras || {};
      sv.castle.pieces = [];
      sv.hero = null;
      sv.nodes = {};
      sv.extras = { weapons: keep.weapons, held: keep.held, xp: keep.xp };
      return sv;
    }
    /** the castle and the clock as saved (a save made at night wakes at the start of that night) */
    restoreWorld() {
      const g = this.g, s = this.saved;
      g.castle = K.Castle.fromJSON(g.data, s.castle);
      const d = Object.assign({}, s.day);
      if (g.day.phases[d.idx] && g.day.phases[d.idx].kind === 'night') d.t = 0;
      g.day = new K.DayCycle(g.data, d);
      g.playTime = s.playTime || 0;
    }
    /** you start with a little of everything and a blade */
    startFresh() {
      const c = this.g.castle;
      c.add('wood', 70);
      c.add('stone', 35);
      c.add('dirt', 4);
      c.add('arrow', 12);
      c.weapons.add('stoneblade');
      this.g.freshStart = true;
    }
    snapshot() {
      const g = this.g, play = g.play, me = play.me;
      return {
        castle: g.castle.toJSON(), day: g.day.toJSON(), hero: me ? [+me.x.toFixed(2), +me.z.toFixed(2)] : null,
        nodes: g.mp ? {} : this.nodes(), playTime: +g.playTime.toFixed(1), ended: !!g.dayEvents.endShown, extras: this.safeExtras(),
      };
    }
    /** half-cut trees and spent rocks, with how long until they regrow */
    nodes() {
      const play = this.g.play, nodes = {};
      for (const [id, n] of play.nodes || []) {
        if (n.charges >= n.max) continue;
        const respawnIn = n.respawnAt === Infinity ? -1 : Math.max(0, (n.respawnAt || 0) - play.t);
        nodes[id] = { charges: n.charges, max: n.max, respawnIn };
      }
      return nodes;
    }
    /** the homestead extras (piles, chests, terrain...); a problem here must never stop the main save */
    safeExtras() {
      try { return this.g.persist ? this.g.persist.capture() : null; } catch (err) { console.warn('could not capture the homestead', err); return null; }
    }
    /** to this browser, and (on a server) to the server */
    save(force) {
      const g = this.g;
      if (!g.castle.lit) return false;
      const snap = this.snapshot();
      if (g.mp) g.mp.saveRemote(snap, !!force);
      return this.slot.write(snap);
    }
  }

  K.CastleSaveGame = CastleSaveGame;
})(typeof window !== 'undefined' ? window : globalThis);
