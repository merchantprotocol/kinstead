/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* FarmSync publishes durable crops and herd counts. HerdSync renders client-owned wandering copies. */
(function (G) {
  const K = G.K;

  class HerdSync {
    constructor(game, multiplayer) {
      this.g = game;
      this.mp = multiplayer;
      this.herds = new Map();
      this.clock = 0;
      this.stock = {
        g: game,
        blocker: () => game.economy.stock.blocker(),
      };
    }

    apply(records) {
      const wanted = new Map();
      for (const herd of Object.values(records || {})) {
        if (!herd || herd.owner === this.mp.me || !herd.count) continue;
        wanted.set(herd.owner + ':' + herd.piece, herd);
      }
      for (const [id, herd] of this.herds) {
        const next = wanted.get(id);
        if (!next || next.count !== herd.count || next.kind !== herd.kind) {
          for (const animal of herd.animals) animal.dispose();
          this.herds.delete(id);
        } else wanted.delete(id);
      }
      for (const [id, herd] of wanted) this.spawn(id, herd);
    }

    spawn(id, herd) {
      const rec = this.mp.world.pieces.get(herd.piece), home = rec && rec.p;
      if (!home || home.type !== (herd.kind === 'cow' ? 'barn' : 'coop')) return;
      const animals = [];
      for (let i = 0; i < herd.count; i++) {
        const angle = i * 2.399963, radius = 1.8 + (i % 3) * 0.3;
        const x = home.x + Math.cos(angle) * radius, z = home.z + Math.sin(angle) * radius;
        const animal = new K.Beast(this.stock, herd.kind, home, x, z);
        animals.push(animal);
      }
      this.herds.set(id, { count: herd.count, kind: herd.kind, animals });
    }

    update(dt) {
      this.clock += dt;
      this.stock.clock = this.clock;
      for (const herd of this.herds.values()) for (const animal of herd.animals) animal.update(dt);
    }

    removePiece(pieceId) {
      for (const [id, herd] of this.herds) {
        if (!id.endsWith(':' + pieceId)) continue;
        for (const animal of herd.animals) animal.dispose();
        this.herds.delete(id);
      }
    }

    dispose() {
      for (const herd of this.herds.values()) for (const animal of herd.animals) animal.dispose();
      this.herds.clear();
    }
  }

  class FarmVisuals {
    constructor(game, multiplayer) {
      this.g = game;
      this.mp = multiplayer;
      this.groups = new Map();
    }

    apply(records) {
      for (const group of this.groups.values()) this.g.group.remove(group);
      this.groups.clear();
      for (const stock of Object.values(records || {})) {
        if (!stock || stock.owner === this.mp.me) continue;
        const piece = this.mp.world.pieces.get(stock.piece);
        if (!piece) continue;
        const kit = new K.VoxKit();
        this.buildPile(kit, piece.p.type, stock.goods || {});
        const group = new G.THREE.Group();
        for (const mesh of kit.meshes(this.g.R.bmats)) group.add(mesh);
        group.position.set(piece.p.x, this.g.play.nav.y(piece.p.x, piece.p.z), piece.p.z);
        group.rotation.y = piece.p.rot || 0;
        this.g.group.add(group);
        this.groups.set(stock.owner + ':' + stock.piece, group);
      }
    }

    buildPile(kit, type, goods) {
      const material = {
        wheat: 'hay', bread: 'bread', beef: 'food', egg: 'linen', milk: 'plaster',
        iron: 'iron', stone: 'ashlar', wood: 'bark', dirt: 'soot', gold: 'brass',
      };
      if (type === 'silo') {
        const fill = Math.min(1, (goods.wheat || 0) / 200);
        kit.box('hay', 0, 0.1, 0.78, 0.18, Math.max(0.05, 3 * fill), 0.04);
        return;
      }
      if (type === 'market') {
        const sections = [[-4, ['wheat', 'bread']], [-1, ['beef', 'egg', 'milk', 'food']], [1, ['arrow', 'gold']], [4, ['wood', 'stone', 'iron', 'dirt']]];
        for (const [cx, items] of sections) {
          let slot = 0;
          for (const good of items) {
            const stacks = Math.min(9, Math.ceil((goods[good] || 0) / 12));
            for (let i = 0; i < stacks; i++, slot++) {
              const on = slot < 6, x = cx - 0.55 + (slot % 3) * 0.55;
              const z = on ? -0.2 + Math.floor(slot / 3) * 0.32 : 0.65 + Math.floor((slot - 6) / 3) * 0.3;
              kit.box(material[good] || 'crate', x, on ? 0.78 : 0, z, 0.26, 0.2, 0.24, i * 0.4);
            }
          }
        }
        return;
      }
      let index = 0;
      for (const [good, amount] of Object.entries(goods)) {
        const stacks = Math.min(6, Math.ceil(amount / 12));
        for (let i = 0; i < stacks; i++, index++) {
          kit.box(material[good] || 'crate', -0.55 + (index % 3) * 0.45, 0, 1 + Math.floor(index / 3) * 0.4, 0.3, 0.22, 0.3);
        }
      }
    }
  }

  class FarmSync {
    constructor(game, multiplayer) {
      this.g = game;
      this.mp = multiplayer;
      this.economy = game.economy;
      this.economy.ownerId = multiplayer.me;
      for (const field of this.economy.fields.tiles.values()) field.owner = multiplayer.me;
      this.herds = new HerdSync(game, multiplayer);
      this.visuals = new FarmVisuals(game, multiplayer);
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

  Object.assign(K, { FarmSync, HerdSync });
})(typeof window !== 'undefined' ? window : globalThis);
