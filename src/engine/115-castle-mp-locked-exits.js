/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* LockedExits: if you are shut inside someone else's house or fence, the door opens for you on the way out,
   then shuts behind you. You cannot come back in. Only your own game sees these doors open. */
(function (G) {
  const K = G.K;

  class LockedExits {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
    }

    update() {
      const me = this.g.play.me;
      this.updateDoors(me, this.buildingIdAt(me));
      this.updateGates(me);
    }

    buildingIdAt(me) {
      const tile = K.TILE;
      const building = this.g.R.buildings.at(Math.floor(me.x / tile), Math.floor(me.z / tile));
      return building ? building.spec.id : null;
    }

    /** open (or shut) one locked thing for you alone */
    setLocal(thing, open) {
      if (!!thing.localOpen === open) return;
      thing.localOpen = open;
      thing.apply();
    }

    updateDoors(me, here) {
      for (const rec of this.mp.world.doors.values()) {
        const door = rec.door;
        if (this.mp.mayUse(rec.owner) || door.broken || door.open) {
          this.setLocal(door, false);
          continue;
        }
        const dist = Math.hypot(me.x - door.ent.x, me.z - door.ent.z);
        if (!door.localOpen && here === 'home:' + rec.slot && dist < 1.9) this.setLocal(door, true);
        else if (door.localOpen && dist > 2.8) this.setLocal(door, false);
      }
    }

    updateGates(me) {
      for (const rec of this.mp.world.pieces.values()) {
        const gate = rec.gate;
        if (!gate) continue;
        const piece = rec.p;
        if (this.mp.mayUse(piece.owner) || gate.open) {
          this.setLocal(gate, false);
          continue;
        }
        const dist = Math.hypot(me.x - piece.x, me.z - piece.z);
        if (!gate.localOpen && this.insideOf(me, piece) && dist < 2.2) this.setLocal(gate, true);
        else if (gate.localOpen && dist > 3.2) this.setLocal(gate, false);
      }
    }

    /** are you on the side of this gate where its owner's house is? */
    insideOf(me, piece) {
      const house = this.mp.world.houseAt[piece.owner];
      if (!house) return false;
      const nx = Math.sin(piece.rot || 0);
      const nz = Math.cos(piece.rot || 0);
      const mine = (me.x - piece.x) * nx + (me.z - piece.z) * nz;
      const theirs = (house.x - piece.x) * nx + (house.z - piece.z) * nz;
      return mine * theirs > 0;
    }
  }

  K.LockedExits = LockedExits;
})(typeof window !== 'undefined' ? window : globalThis);
