// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/** Durable, owner-scoped farm state shared by every player in a room. */
export class FarmSync {
  constructor(room) {
    this.room = room;
  }

  snapshot(owner, data) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.herds)) return false;
    const farms = this.room.world.farms || (this.room.world.farms = { fields: {}, herds: {}, goods: {} });
    farms.goods = farms.goods || {};
    for (const [id, field] of Object.entries(farms.fields)) {
      if (field.owner === owner) delete farms.fields[id];
    }
    for (const [id, herd] of Object.entries(farms.herds)) {
      if (herd.owner === owner) delete farms.herds[id];
    }
    for (const [id, stock] of Object.entries(farms.goods || {})) {
      if (stock.owner === owner) delete farms.goods[id];
    }
    for (const field of data.fields.slice(0, 4000)) {
      if (!Array.isArray(field) || field.length < 3) continue;
      const i = Number(field[0]), j = Number(field[1]), age = Number(field[2]);
      if (!Number.isInteger(i) || !Number.isInteger(j) || !Number.isFinite(age)) continue;
      if (Math.abs(i) > 2000 || Math.abs(j) > 2000) continue;
      const key = owner + ':' + i + ',' + j;
      farms.fields[key] = { owner, i, j, age: Math.max(0, Math.min(180, age)) };
    }
    for (const herd of data.herds.slice(0, 100)) {
      if (!Array.isArray(herd) || herd.length < 3) continue;
      const [piece, kind] = herd;
      const count = Number(herd[2]), building = this.room.world.pieces[piece];
      const expected = kind === 'cow' ? 'barn' : kind === 'chicken' ? 'coop' : null;
      const max = kind === 'cow' ? 8 : kind === 'chicken' ? 12 : 0;
      if (!expected || !Number.isInteger(count) || count < 0 || count > max) continue;
      if (!building || building.owner !== owner || building.type !== expected) continue;
      const key = owner + ':' + piece;
      if (count) farms.herds[key] = { owner, piece, kind, count };
    }
    for (const stock of (data.goods || []).slice(0, 100)) {
      if (!Array.isArray(stock) || stock.length < 2 || !stock[1] || typeof stock[1] !== 'object') continue;
      const [piece, goods] = stock, building = this.room.world.pieces[piece];
      if (!building || building.owner !== owner || !['barn', 'coop', 'farm', 'market', 'silo'].includes(building.type)) continue;
      const clean = {};
      for (const [good, raw] of Object.entries(goods).slice(0, 32)) {
        const amount = Number(raw);
        if (!/^[a-z_]{1,24}$/.test(good) || !Number.isFinite(amount) || amount <= 0) continue;
        clean[good] = Math.min(999, Math.floor(amount));
      }
      if (Object.keys(clean).length) farms.goods[owner + ':' + piece] = { owner, piece, goods: clean };
    }
    this.room.dirty = true;
    this.room.ver.p++;
    const message = {
      t: 'farm', owner,
      fields: Object.values(farms.fields).filter((field) => field.owner === owner),
      herds: Object.values(farms.herds).filter((herd) => herd.owner === owner),
      goods: Object.values(farms.goods).filter((stock) => stock.owner === owner),
    };
    this.room.broadcast(message);
    return message;
  }

  install(room) {
    room.farmSync = new FarmSync(room);
  }
}
