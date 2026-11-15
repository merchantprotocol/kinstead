/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* DoorGateSync: doors and gates on a shared map. Opening, locking, hitting, breaking, hanging a new door, and keys. */
(function (G) {
  const K = G.K;

  class DoorGateSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.exits = new K.LockedExits(multiplayer);
      this.lastOpen = null;
      this.lastBroken = null;
      this.lastHit = 0;
      this.net.on('gate', (m) => this.onGate(m));
      this.net.on('door', (m) => this.onDoor(m));
      this.net.on('hp', (m) => this.onHp(m));
      this.net.on('locked', (m) => this.onLocked(m));
    }

    get world() {
      return this.mp.world;
    }

    update(dt) {
      this.exits.update();
      for (const rec of this.world.doors.values()) rec.door.update(dt);
      for (const rec of this.world.pieces.values()) {
        if (rec.gate) rec.gate.update(dt);
      }
      this.reportHomeDoor();
    }

    /** your own door: tell everyone when it opens, shuts or is broken */
    reportHomeDoor() {
      const door = this.g.home.door;
      if (this.lastOpen !== door.open) {
        if (this.lastOpen !== null) this.net.send({ t: 'open', slot: this.g.L.slot, open: door.open });
        this.lastOpen = door.open;
      }
      if (this.lastBroken !== door.broken) {
        if (this.lastBroken !== null) this.net.send({ t: 'doorstate', broken: door.broken });
        this.lastBroken = door.broken;
      }
    }

    onGate(m) {
      this.world.gateState(m.id, m.open);
      this.mineGate(m.id, m.open);
    }

    mineGate(id, open) {
      const piece = this.g.castle.pieces.find((q) => q.bridge && this.mp.pieceId(q) === id);
      if (!piece || piece.bridge.open === open) return;
      piece.bridge.open = open;
      piece.bridge.apply();
    }

    onLocked(m) {
      const what = m.what === 'door' ? 'door' : 'gate';
      this.g.cui.toast(`The ${what} is locked. Only its owner and their team have the key.`);
    }

    gate(piece, open) {
      this.net.send({ t: 'open', id: this.mp.pieceId(piece), open });
    }

    requestGate(rec) {
      this.net.send({ t: 'open', id: rec.p.id, open: !rec.gate.open });
    }

    requestDoor(rec) {
      this.net.send({ t: 'open', slot: rec.slot, open: !rec.door.open });
    }

    /** a swing at someone else's wall, gate or door: the server decides if it lands */
    hit(rec, door) {
      const g = this.g;
      const now = g.play.t;
      if (now - this.lastHit < 0.35) return;
      this.lastHit = now;
      const me = g.play.me;
      g.play.face(me, door ? rec.door.ent : rec.p);
      me.view.setState('attack');
      g.sound.play('thunk');
      const tool = g.tools.tool.id;
      this.net.send(door ? { t: 'hit', slot: rec.slot, tool } : { t: 'hit', id: rec.p.id, tool });
    }

    installDoor(rec) {
      const g = this.g;
      if (!g.castle.spend({ wood: 3 })) {
        g.cui.toast('You need 3 wood to hang a door.');
        return;
      }
      this.net.send({ t: 'install', slot: rec.slot });
      g.changed();
    }

    onHp(m) {
      if (m.id) this.pieceHp(m);
      else if (m.slot != null) this.doorHp(m);
    }

    pieceHp(m) {
      const g = this.g;
      const rec = this.world.pieces.get(m.id);
      const mine = g.castle.pieces.find((q) => this.mp.pieceId(q) === m.id);
      const old = rec ? rec.hp : mine ? mine.hp : m.hp;
      if (rec) rec.hp = m.hp;
      if (mine) mine.hp = m.hp;
      const at = rec ? rec.p : mine;
      if (!at || old <= m.hp) return;
      g.play.float({ x: at.x, z: at.z, y: g.play.nav.y(at.x, at.z), h: 1 }, '-' + (old - m.hp), 'hurt');
    }

    doorHp(m) {
      const g = this.g;
      const rec = this.world.doors.get(m.slot);
      const door = m.slot === g.L.slot ? g.home.door : (rec || {}).door;
      if (!door) return;
      const old = door.hp || m.hp;
      door.hp = m.hp;
      if (rec) rec.hp = m.hp;
      if (old > m.hp) g.play.float(door.ent, '-' + (old - m.hp), 'hurt');
    }

    onDoor(m) {
      if (m.slot === this.g.L.slot) {
        this.ownDoor(m);
        return;
      }
      this.world.doorMsg(m);
      if (!m.captured) return;
      const taker = (this.mp.avatars.by.get(m.owner) || {}).name || 'A settler';
      this.g.cui.toast(`${taker} captured ${this.world.owners[m.slot] || 'a'}'s castle!`);
    }

    ownDoor(m) {
      const g = this.g;
      const door = g.home.door;
      if (m.broken === true) {
        door.broken = true;
        door.open = true;
        door.apply();
        g.cui.toast('Your door was broken down!');
        g.sound.play('crack');
      } else if (m.open !== undefined && !m.broken) {
        door.open = !!m.open;
        door.apply();
      }
    }

    /** do you hold the key to this building (so you may sleep there)? */
    keyFor(id) {
      const home = /^home:(\d+)$/.exec(id);
      if (home) {
        const rec = this.world.doors.get(+home[1]);
        return !!rec && !rec.door.broken && !!rec.owner && this.mp.mayUse(rec.owner);
      }
      const hall = /^(?:smithy|market|stable|bakery|butcher|library):(.+)$/.exec(id);
      return hall ? this.mp.mayUse(hall[1]) : false;
    }

    slotOf(id) {
      if (id === 'home') return this.g.L.slot;
      const home = /^home:(\d+)$/.exec(id);
      return home ? +home[1] : null;
    }

    setRespawn(slot, x, z) {
      this.net.send({ t: 'respawn', slot, x: +x.toFixed(2), z: +z.toFixed(2) });
    }
  }

  K.DoorGateSync = DoorGateSync;
})(typeof window !== 'undefined' ? window : globalThis);
