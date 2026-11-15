/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* RemoteDoors: other settlers' house doors: drawn and blocked like your own, but opened only on the server's word. */
(function (G) {
  const K = G.K;

  class RemoteDoors {
    /** owners is RemoteWorld's shared slot/id -> name table */
    constructor(game, owners) {
      this.g = game;
      this.owners = owners;
      this.by = new Map();   // slot -> { slot, door, owner, hp, max, name }
    }

    add(slot, spec, owner) {
      if (this.by.has(slot)) return this.by.get(slot);
      const door = new K.Door({ g: this.g, spec });
      door.locked = true;
      door.remote = true;
      door.apply();
      const rec = { slot, door, owner, hp: 3000, max: 3000, name: (this.owners[slot] || 'Settler') + "'s door" };
      door.ent = Object.assign({}, door.ent, { id: 'rd:' + slot, type: 'c_rdoor', rec, name: rec.name });
      this.by.set(slot, rec);
      return rec;
    }

    /** door owners, health and broken state; with onlyChanges, a door is redrawn only when it broke or was mended */
    apply(doors, onlyChanges) {
      for (const [slot, state] of Object.entries(doors || {})) {
        const rec = this.by.get(+slot);
        if (!rec) continue;
        rec.owner = state.owner;
        rec.hp = state.hp;
        rec.max = state.hpMax;
        const broken = !!state.broken;
        if (onlyChanges && rec.door.broken === broken) continue;
        rec.door.broken = broken;
        rec.door.open = broken;
        rec.door.apply();
      }
    }

    /** one door changed: hit, broken, mended, opened, or taken by a new owner */
    doorMsg(m) {
      const rec = this.by.get(m.slot);
      if (!rec) return;
      const door = rec.door;
      if (m.hp != null) {
        rec.hp = m.hp;
        rec.max = m.max || rec.max;
      }
      if (m.owner) rec.owner = m.owner;
      if (m.broken === true) {
        door.broken = true;
        door.open = true;
        this.g.sound.play('crack');
      }
      if (m.broken === false) {
        door.broken = false;
        if (m.open === undefined) door.open = false;
      }
      if (m.open !== undefined) door.open = !!m.open;
      door.apply();
    }

    relabel() {
      for (const rec of this.by.values()) {
        rec.door.ent.name = `${this.g.banners.label(rec.owner, this.owners[rec.slot])}'s door`;
      }
    }

    entities() {
      return [...this.by.values()].map((rec) => rec.door.ent);
    }
  }

  K.RemoteDoors = RemoteDoors;
})(typeof window !== 'undefined' ? window : globalThis);
