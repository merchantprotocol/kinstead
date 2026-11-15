/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* WorldSync: the shared land. Your edits go up as ops, everyone else's come down, and a periodic sync catches what was missed. */
(function (G) {
  const K = G.K;

  class WorldSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.ver = (this.net.welcome && this.net.welcome.ver) || {};
      this.syncT = 8;
      this.net.on('op', (m) => this.onOp(m));
      this.net.on('house', (m) => this.onHouse(m));
      this.net.on('resync', (m) => this.onResync(m));
      this.net.on('farm', (m) => this.mp.farms.updateOwner(m));
      this.net.on('fx', (m) => this.onFx(m));
      this.net.on('weather', (m) => this.onWeather(m.weather));
    }

    get world() {
      return this.mp.world;
    }

    /** every few seconds: ask the server whether we have missed anything */
    update(dt) {
      this.syncT -= dt;
      if (this.syncT > 0) return;
      this.syncT = 12;
      this.net.send({ t: 'sync', v: this.ver });
    }

    onWeather(weather) {
      if (this.g.weather && weather) this.g.weather.setFromServer(weather);
    }

    /** tell the server what you already have on your plot (a game from before multiplayer, or one saved on this device) */
    uploadMine() {
      const g = this.g;
      if (g.home.built) this.announceHome();
      for (const piece of g.castle.pieces) this.sendPiece(piece);
      for (const [id, spec] of this.ownBuildings()) this.mp.op({ k: 'bld+', id, spec });
      this.uploadTiles();
      for (const node of g.forest.nodes) {
        if (!g.forest.live(node)) this.mp.op({ k: 'node', id: node.id, st: 'felled' });
      }
      this.mp.farms.publish();
    }

    uploadTiles() {
      const g = this.g;
      const doc = g.play.doc;
      const h0 = g.persist.h0;
      const t0 = g.persist.t0;
      const tiles = [];
      for (let k = 0; k < doc.height.length; k++) {
        if (doc.height[k] === h0[k] && doc.terrain[k] === t0[k]) continue;
        tiles.push([k % doc.w, (k / doc.w) | 0, doc.height[k], doc.terrain[k]]);
        if (tiles.length >= 400) this.mp.op({ k: 'tiles', list: tiles.splice(0) });
      }
      if (tiles.length) this.mp.op({ k: 'tiles', list: tiles });
    }

    sendPiece(piece) {
      const id = this.mp.pieceId(piece);
      this.mp.op({ k: 'piece+', id, type: piece.type, x: piece.x, z: piece.z, rot: piece.rot || 0 });
    }

    /** [server id, spec] for every hall you own */
    ownBuildings() {
      const g = this.g;
      const me = this.mp.me;
      const list = [];
      if (g.smithy) list.push(['smithy:' + me, g.smithy]);
      if (g.marketHall) list.push(['market:' + me, g.marketHall]);
      for (const [type, hall] of Object.entries(g.halls || {})) list.push([type + ':' + me, hall.spec]);
      return list;
    }

    /** you built your cottage: everyone gets to see it, and its door is yours */
    announceHome() {
      const g = this.g;
      if (!g.home.built) return;
      const slot = g.L.slot;
      this.net.send({ t: 'op', op: { k: 'bld+', id: 'home:' + slot, spec: g.home.spec, slot } });
    }

    /** someone else built their cottage */
    onHouse(m) {
      if (m.slot === this.g.L.slot) return;
      this.world.owners[m.owner] = m.name;
      this.world.owners[m.slot] = m.name;
      this.world.cottage(m.slot, m.spec, m.owner);
      const rec = this.world.doors.get(m.slot);
      if (rec && m.door) {
        rec.owner = m.door.owner;
        rec.hp = m.door.hp;
        rec.max = m.door.hpMax;
      }
      this.g.cui.toast(`${m.name} built a cottage.`);
    }

    onOp(m) {
      const op = m.op;
      if (op.k === 'piece-' && op.broken && m.from === this.mp.me) {
        this.loseMine(op.id);
        return;
      }
      this.world.apply(op, m.from);
      if (op.k === 'piece-') this.mp.farms.herds.removePiece(op.id);
    }

    /** one of your walls was broken down by someone else */
    loseMine(id) {
      const piece = this.g.castle.pieces.find((q) => this.mp.pieceId(q) === id);
      if (!piece) return;
      this.mp.quiet = true;
      this.g.demolishPiece(piece, { refund: false });
      this.mp.quiet = false;
      this.g.cui.toast('One of your walls was broken down!');
    }

    onResync(m) {
      if (m.players) this.mp.presence.reconcile(m.players);
      if (m.teams) this.mp.teams.setTeams(m.teams);
      const serverPieces = this.world.reconcile(m);
      if (m.world && m.world.farms) this.mp.farms.apply(m.world.farms);
      if (serverPieces) this.republishMissing(m, new Set(serverPieces));
      if (m.stores) this.mp.storeSync.reconcileResync(m.stores);
      if (m.tiles) this.applyTiles(Object.values(m.tiles));
      if (m.nodes) this.applyNodes(Object.values(m.nodes));
      this.ver = m.ver || this.ver;
    }

    /** anything of mine the server never heard about goes up again */
    republishMissing(m, serverPieces) {
      const g = this.g;
      for (const piece of g.castle.pieces) {
        if (!serverPieces.has(this.mp.pieceId(piece))) this.sendPiece(piece);
      }
      const claimed = (m.claimed || []).some((c) => c.slot === g.L.slot);
      if (g.home.built && !claimed) this.announceHome();
      const known = Object.keys((m.world || {}).buildings || {});
      for (const [id, spec] of this.ownBuildings()) {
        if (!known.includes(id)) this.mp.op({ k: 'bld+', id, spec });
      }
    }

    applyTiles(tiles) {
      let box = null;
      for (const tile of tiles) {
        this.world.setTile(tile[0], tile[1], tile[2], tile[3], false);
        box = this.world.grow(box, tile[0], tile[1]);
      }
      if (box) this.g.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
    }

    applyNodes(nodes) {
      for (const node of nodes) this.world.nodeOp(node, true);
      this.world.objDirty = true;
    }

    /** pickups everyone sees */
    fx(effect) {
      this.net.send({ t: 'fx', fx: effect });
    }

    onFx(m) {
      const effect = m.fx;
      const pickups = this.g.tools.effects.pickups;
      if (effect.k === 'pk+') {
        pickups.spawn(effect.kind, effect.value, effect.x, effect.y, effect.z, 1.2, !!effect.exact, null, effect.id);
      } else if (effect.k === 'pk-') {
        pickups.drop(effect.id);
      }
    }
  }

  K.WorldSync = WorldSync;
})(typeof window !== 'undefined' ? window : globalThis);
