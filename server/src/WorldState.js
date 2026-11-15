import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class WorldState {
  claimed() { return Object.entries(this.world.houses).map(([slot, h]) => ({ id: h.owner, slot: +slot, name: h.name, x: h.x, z: h.z, spec: h.spec })); }

  applyOp(p, op) {
    if (!op || !op.k) return; const w = this.world;
    if (op.k === 'piece+') { const old = w.pieces[op.id];
    if (old && !this.mayUse(p,
    old.owner)) return false;
    const hpMax = ServerConfig.HP[op.type] || ServerConfig.HP.default;
    w.pieces[op.id] = { id: op.id,
    type: op.type,
    x: op.x,
    z: op.z,
    rot: op.rot,
    owner: p.id,
    hp: hpMax,
    hpMax };
    }
    else if (op.k === 'piece-') { const pc = w.pieces[op.id];
    if (pc && !this.mayUse(p,
    pc.owner)) return false;
    delete w.pieces[op.id];
    for (const [id, herd] of Object.entries((w.farms || {}).herds || {})) if (herd.piece === op.id) delete w.farms.herds[id];
    delete this.gates[op.id];
    }
    else if (op.k === 'tile') w.tiles[op.i + ',' + op.j] = [op.i, op.j, op.h, op.te];
    else if (op.k === 'tiles' && Array.isArray(op.list)) { for (const t of op.list.slice(0, 500)) w.tiles[t[0] + ',' + t[1]] = [t[0], t[1], t[2], t[3]]; }
    else if (op.k === 'node') w.nodes[op.id] = { id: op.id, st: op.st, x: op.x, z: op.z };
    else if (op.k === 'bld+') { const old = w.buildings[op.id];
    if (old && !this.mayUse(p,
    old.owner)) return false;
    w.buildings[op.id] = { id: op.id,
    spec: op.spec,
    owner: p.id };
    }
    else if (op.k === 'bld-') { const old = w.buildings[op.id]; if (old && !this.mayUse(p, old.owner)) return false; delete w.buildings[op.id]; }
    else return false;
    if (op.k === 'tile' || op.k === 'tiles' || op.k === 'node') this.ver.t++; else this.ver.p++;
    this.dirty = true;
  }

  install(room) {
    for (const method of ['claimed', 'applyOp']) room[method] = this[method].bind(room);
  }
}
