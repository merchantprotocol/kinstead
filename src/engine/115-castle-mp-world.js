/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerWorld extends K.MultiplayerMobs {
    onResync(m) {
      const g = this.g, me = this.me;
      if (m.players) { const ids = new Set(m.players.map((p) => p.id));
         for (const p of m.players) this.avatars.add(p);
         for (const id of [...this.avatars.by.keys()]) if (!ids.has(id)) this.avatars.remove(id);
        }
      if (m.teams) this.setTeams(m.teams);
      const serverPieces = this.world.reconcile(m);
      if (m.world && m.world.farms) this.farms.apply(m.world.farms);
      if (serverPieces) {   // anything of mine the server never heard about goes up again
        const have = new Set(serverPieces);
          for (const p of g.castle.pieces) if (!have.has(this.pieceId(p))) this.op({ k: 'piece+',
             id: this.pieceId(p),
             type: p.type,
             x: p.x,
             z: p.z,
            rot: p.rot || 0 });
        if (g.home.built && !(m.claimed || []).some((c) => c.slot === g.L.slot)) this.announceHome();
        if (g.smithy && !Object.keys((m.world || {}).buildings || {}).includes('smithy:' + me)) this.op({ k: 'bld+', id: 'smithy:' + me, spec: g.smithy });
        if (g.marketHall && !Object.keys((m.world || {}).buildings || {}).includes('market:' + me)) this.op({ k: 'bld+',
           id: 'market:' + me,
          spec: g.marketHall });
        for (const [t,
           h] of Object.entries(g.halls || {})) if (!Object.keys((m.world || {}).buildings || {}).includes(t + ':' + me)) this.op({ k: 'bld+',
           id: t + ':' + me,
          spec: h.spec });
      }
      if (m.stores) {
        const others = m.stores.filter((s) => s.owner !== me), ids = new Set(others.map((s) => s.id));
        for (const s of others) this.stores.upsert(s);
          for (const id of [...this.stores.by.keys()]) if (!ids.has(id)) this.stores.gone(id);
        const mine = new Set(m.stores.filter((s) => s.owner === me).map((s) => s.id.slice(me.length + 1)));
          for (const st of g.home.stores) if (this.own(st) && !mine.has(st.id)) this.storeAdd(st);
      }
      if (m.tiles) { let box = null;
         for (const t of Object.values(m.tiles)) { this.world.setTile(t[0], t[1], t[2], t[3], false);
         box = this.world.grow(box, t[0], t[1]);
         } if (box) g.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
        }
      if (m.nodes) { for (const n of Object.values(m.nodes)) this.world.nodeOp(n, true);
         this.world.objDirty = true;
        }
      this.ver = m.ver || this.ver;
    }
    /** the creatures this game runs, told to everyone else a few times a second */
    announceHome() { const g = this.g;
       if (g.home.built) this.net.send({ t: 'op', op: { k: 'bld+', id: 'home:' + g.L.slot, spec: g.home.spec, slot: g.L.slot } });
      }
    /** someone else built their cottage */
    onHouse(m) {
      if (m.slot === this.g.L.slot) return;
         this.world.owners[m.owner] = m.name;
         this.world.owners[m.slot] = m.name;
        this.world.cottage(m.slot, m.spec, m.owner);
      const rec = this.world.doors.get(m.slot);
         if (rec && m.door) { rec.owner = m.door.owner;
         rec.hp = m.door.hp;
         rec.max = m.door.hpMax;
        }
      this.g.cui.toast(`${m.name} built a cottage.`);
    }
    /** who is on your team (including you), with their colours */
    onOp(m) {
      const op = m.op;
      if (op.k === 'piece-' && op.broken && m.from === this.me) {   // one of mine was broken down by someone else
        const p = this.g.castle.pieces.find((q) => this.pieceId(q) === op.id);
           if (p) { this.quiet = true;
           this.g.demolishPiece(p, { refund: false });
           this.quiet = false;
           this.g.cui.toast('One of your walls was broken down!');
          } return;
      }
      this.world.apply(op, m.from);
      if (op.k === 'piece-') this.farms.herds.removePiece(op.id);
    }
    mineGate(id, open) { const p = this.g.castle.pieces.find((q) => q.bridge && this.pieceId(q) === id);
       if (p && p.bridge.open !== open) { p.bridge.open = open;
       p.bridge.apply();
      } }
    gate(p, open) { this.net.send({ t: 'open', id: this.pieceId(p), open });
      }
    requestGate(rec) { this.net.send({ t: 'open', id: rec.p.id, open: !rec.gate.open });
      }
    requestDoor(rec) { this.net.send({ t: 'open', slot: rec.slot, open: !rec.door.open });
      }
    pieceId(p) { return this.net.id + ':' + p.uid;
      }
  }
  K.MultiplayerWorld = MultiplayerWorld;
})(typeof window !== 'undefined' ? window : globalThis);
