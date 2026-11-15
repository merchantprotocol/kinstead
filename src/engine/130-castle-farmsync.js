/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* FarmSync publishes owner-scoped crops, herd counts, and stock changes. */
(function (G) {
  const K = G.K;
  class FarmSync {
    constructor(game, multiplayer) {
      this.g = game;
      this.mp = multiplayer;
      this.economy = game.economy;
      this.economy.ownerId = multiplayer.me;
      for (const field of this.economy.fields.tiles.values()) field.owner = multiplayer.me;
      this.herds = new K.HerdSync(game, multiplayer);
      this.visuals = new K.FarmVisuals(game, multiplayer);
      this.state = { fields: {}, herds: {}, goods: {} };
      this.publishT = 8;
      this.stopListening = this.economy.onChange((kind) => {
        if (kind === 'fields' || kind === 'herds') this.publish();
      });
    }

    publish() {
      const fields = [...this.economy.fields.tiles.values()]
        .filter((t) => t.owner === this.mp.me)
        .map((t) => [t.i, t.j, Math.round(t.age)]);
      const herds = [], goods = [];
      for (const piece of this.g.castle.pieces) {
        const id = this.mp.pieceId(piece);
        if (piece.type === 'coop' || piece.type === 'barn') {
          const count = this.economy.stock.herd(piece).length;
          if (count) herds.push([id, piece.type === 'barn' ? 'cow' : 'chicken', count]);
        }
        if (['coop', 'barn', 'farm', 'market', 'silo'].includes(piece.type)) {
          const ledger = this.economy.ledgers.get(piece.uid);
          if (ledger && Object.keys(ledger.goods).length) goods.push([id, ledger.goods]);
        }
      }
      this.mp.net.send({ t: 'farm', farm: { fields, herds, goods } });
    }

    apply(farms) {
      if (!farms) return;
      this.state = {
        fields: farms.fields || {},
        herds: farms.herds || {},
        goods: farms.goods || {},
      };
      const fields = this.economy.fields;
      const byOwner = new Map();
      for (const field of Object.values(farms.fields || {})) {
        if (!field) continue;
        const list = byOwner.get(field.owner) || [];
        list.push(field);
        byOwner.set(field.owner, list);
      }
      const owned = byOwner.get(this.mp.me);
      if (owned && owned.length) {
        for (const [key, field] of [...fields.tiles]) {
          if (field.owner === this.mp.me) fields.remove(field.i, field.j);
        }
        for (const field of owned) fields.add(field.i, field.j, field.age, this.mp.me);
      } else {
        for (const field of fields.tiles.values()) if (!field.owner) field.owner = this.mp.me;
      }
      for (const [key, field] of [...fields.tiles]) {
        if (field.owner && field.owner !== this.mp.me) fields.remove(field.i, field.j);
      }
      let box = null;
      for (const [owner, list] of byOwner) {
        if (owner === this.mp.me) continue;
        for (const field of list) {
          fields.add(field.i, field.j, field.age, owner);
          const tile = field.j * this.g.play.doc.w + field.i;
          this.g.play.doc.terrain[tile] = K.T.DIRT;
          box = box ? [Math.min(box[0], field.i), Math.min(box[1], field.j), Math.max(box[2], field.i), Math.max(box[3], field.j)] : [field.i, field.j, field.i, field.j];
        }
      }
      if (box) this.g.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
      this.herds.apply(farms.herds);
      this.visuals.apply(farms.goods);
    }

    updateOwner(message) {
      if (!message || !message.owner) return;
      for (const key of ['fields', 'herds', 'goods']) {
        for (const [id, record] of Object.entries(this.state[key])) {
          if (record.owner === message.owner) delete this.state[key][id];
        }
        for (const record of message[key] || []) {
          const id = key === 'fields' ? record.owner + ':' + record.i + ',' + record.j : record.owner + ':' + record.piece;
          this.state[key][id] = record;
        }
      }
      this.apply(this.state);
    }

    update(dt) { this.herds.update(dt); this.publishT -= dt; if (this.publishT <= 0) { this.publishT = 8; this.publish(); } }
    dispose() { this.stopListening(); this.herds.dispose(); this.visuals.apply({}); }
  }

  Object.assign(K, { FarmSync });
})(typeof window !== 'undefined' ? window : globalThis);
