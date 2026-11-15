/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameSave extends K.CastleGameInput {
    snapshot() {
      const me = this.play.me, nodes = {};
      for (const [id, n] of this.play.nodes || []) if (n.charges < n.max) nodes[id] = { charges: n.charges, max: n.max,
      respawnIn: n.respawnAt === Infinity ? -1 : Math.max(0, (n.respawnAt || 0) - this.play.t) };
      return { castle: this.castle.toJSON(), day: this.day.toJSON(), hero: me ? [+me.x.toFixed(2), +me.z.toFixed(2)] : null,
      nodes: this.mp ? {} : nodes, playTime: +this.playTime.toFixed(1), ended: !!this.endShown, extras: this.safeExtras() };
    }
    /** the homestead extras (piles, chests, terrain...); a problem here must never stop the main save */
    safeExtras() { try { return this.persist ? this.persist.capture() : null;
      } catch (err) { console.warn('could not capture the homestead', err);
    return null;
      } }
    save(force) { if (!this.castle.lit) return false;
      const snap = this.snapshot();
      if (this.mp) this.mp.saveRemote(snap, !!force);
    return this.slot.write(snap);
      }   // to this browser, and (on a server) to the server
    restoreNodes() {
      const s = this.saved;
        if (!s || !s.nodes) return;
      for (const [id, n] of Object.entries(s.nodes)) { if (!this.play.doc.obj(id)) continue;
      this.play.nodes.set(id, { charges: n.charges, max: n.max,
      respawnAt: n.respawnIn < 0 ? Infinity : n.respawnIn ? this.play.t + n.respawnIn : 0 });
        if (n.charges <= 0) this.R.setPropState(id, 'depleted');
        }
    }

    /* ---------- test / demo hooks ---------- */
    debugSkip(sec) { this.day.t = Math.min(this.day.t + sec, (this.day.length() || 1e9) - 0.01);
      }
    debugGive(o) { for (const [r, n] of Object.entries(o)) this.castle.add(r, n);
      this.changed();
      }
  }
  K.CastleGameSave = CastleGameSave;
})(typeof window !== 'undefined' ? window : globalThis);
