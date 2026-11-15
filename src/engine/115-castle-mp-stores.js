/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerStores extends K.MultiplayerBase {
    own(s) { return s.stock != null && s.present;
      }
    pub(s) { return { id: s.id, kind: s.kind, name: s.name, res: s.res, x: +s.x.toFixed(2), z: +s.z.toFixed(2), stack: s.stack || 1, stock: s.stock };
      }
    publishStores() { this.net.send({ t: 'stores', list: this.g.home.stores.filter((s) => this.own(s)).map((s) => this.pub(s)) });
      }
    storeAdd(s) { if (this.own(s)) this.net.send({ t: 'store',
       id: s.id,
       kind: s.kind,
       name: s.name,
       res: s.res,
       x: +s.x.toFixed(2),
       z: +s.z.toFixed(2),
       stack: s.stack || 1,
      stock: s.stock });
      }
    storeGone(s) { this.net.send({ t: 'store', id: s.id, gone: true });
      }
    stockDelta(s, d) { if (d) this.net.send({ t: 'stock', id: s.id, d });
      }
    /** on joining: take the server's word for what is in your barrels (raiders may have been), then show everyone else's */
    syncStores(list) {
      const me = this.me, mine = list.filter((s) => s.owner === me), home = this.g.home;
      if (!mine.length) this.publishStores();
        else this.reconcileMine(mine);
      for (const s of list) if (s.owner !== me) this.stores.upsert(s);
    }
    reconcileMine(mine) {
      const home = this.g.home, by = new Map(mine.map((s) => [s.id.slice(this.me.length + 1), s]));
      for (const st of home.stores.slice()) {
        if (st.stock == null) continue;
           const sv = by.get(st.id);
          by.delete(st.id);
        if (sv) { st.stock = sv.stock;
           if (st.refresh && st.stock > 0) st.refresh();
           st.sync();
           } else if (st.pile) { st.stock = 0;
           st.sync();
          } else this.storeAdd(st);
      }
      for (const sv of by.values()) if (sv.kind === 'pile' && sv.stock > 0) home.dropPile(sv.res,
         sv.x,
         sv.z,
         sv.stock,
         null,
         sv.id.slice(this.me.length + 1),
        true);
    }
    onStores(m) { if (m.mine) return;
       this.stores.dropOwner(m.owner);
       for (const s of m.list) this.stores.upsert(s);
      }
    onStore(m) { if (m.gone) { this.stores.gone(m.id);
       return;
       } this.stores.upsert(m.s);
      }
    onStock(m) {
      const mineId = m.id.startsWith(this.me + ':') ? m.id.slice(this.me.length + 1) : null;
      if (mineId) { const st = this.g.home.stores.find((q) => q.id === mineId);
         if (st && st.stock !== m.stock) { st.stock = m.stock;
         if (st.refresh && st.stock > 0) st.refresh();
         st.sync();
         } return;
        }
      this.stores.setStock(m.id, m.stock);
    }
    takeFrom(id) { this.net.send({ t: 'take', id, n: 10 });
      }
    giveTaken(res, n) {
      const g = this.g;
         if (res === 'bread') { g.play.player.addItem('bread', n);
        } else g.castle.add(res, n);
      g.changed();
         g.sound.play('gather');
        g.play.float(g.play.me, `+${n} ${K.CastleData.resName(res).toLowerCase()}`, 'loot');
    }
    /* ---------- houses and keys ---------- */
    /** do you hold the key to this building (so you may sleep there)? */
    keyFor(id) {
      const m = /^home:(\d+)$/.exec(id);
         if (m) { const r = this.world.doors.get(+m[1]);
         return !!r && !r.door.broken && !!r.owner && this.mayUse(r.owner);
        }
      const s = /^(?:smithy|market|stable|bakery|butcher|library):(.+)$/.exec(id);
         if (s) return this.mayUse(s[1]);
        return false;
    }
    slotOf(id) { if (id === 'home') return this.g.L.slot;
       const m = /^home:(\d+)$/.exec(id);
       return m ? +m[1] : null;
      }
    setRespawn(slot, x, z) { this.net.send({ t: 'respawn', slot, x: +x.toFixed(2), z: +z.toFixed(2) });
      }

    get me() { return this.net.id;
      }
    /** every few seconds: ask the server whether we have missed anything */
  }
  K.MultiplayerStores = MultiplayerStores;
})(typeof window !== 'undefined' ? window : globalThis);
