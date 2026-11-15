import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class Doors {
  onOpen(p, m) {
    if (m.slot != null) { const d = this.world.doors[m.slot];
    if (!d || (!d.broken && !this.mayUse(p,
    d.owner))) { this.send(this.wsOf(p),
    { t: 'locked',
    what: 'door',
    slot: m.slot });
    return;
    } this.broadcast({ t: 'door',
    slot: m.slot,
    open: !!m.open });
    return;
    }
    const pc = this.world.pieces[m.id]; if (!pc) return;   // no distance rule: a gate shuts itself behind its owner from wherever they are
    if (!this.mayUse(p, pc.owner)) { this.send(this.wsOf(p), { t: 'locked', what: 'gate', id: m.id }); return; }
    this.gates[m.id] = !!m.open; this.ver.g++; this.broadcast({ t: 'gate', id: m.id, open: !!m.open });
  }

  wsOf(p) { for (const [ws, q] of this.sockets) if (q === p) return ws; return null; }

  onHit(p, m) {
    const now = Date.now(); if (now - (this.lastHit[p.id] || 0) < 300) return; this.lastHit[p.id] = now;
    const dmg = ServerConfig.DMG[m.tool] || ServerConfig.DMG.default;
    if (m.slot != null) {
      const d = this.world.doors[m.slot], house = this.world.houses[m.slot]; if (!d || d.broken || this.mayUse(p, d.owner)) return;
      const c = this.cottage(m.slot); if (!this.near(p, c, 6)) return;
      d.hp = Math.max(0, d.hp - dmg); this.broadcast({ t: 'hp', slot: m.slot, hp: d.hp, max: d.hpMax });
      if (d.hp <= 0) { d.broken = true; d.owner = null; this.ver.g++; this.broadcast({ t: 'door', slot: m.slot, broken: true, open: true }); }
      this.dirty = true; return;
    }
    const pc = this.world.pieces[m.id]; if (!pc || this.mayUse(p, pc.owner) || !this.near(p, pc, 5)) return;
    if (pc.hp == null) { pc.hpMax = ServerConfig.HP[pc.type] || ServerConfig.HP.default; pc.hp = pc.hpMax; }
    const k = (ServerConfig.STONE.has(pc.type) ? (m.tool === 'pickaxe' || m.tool === 'warhammer' ? 2 : 0.6) : (m.tool === 'axe' ? 1.5 : 1));
    pc.hp = Math.max(0, pc.hp - Math.round(dmg * k));
    this.broadcast({ t: 'hp', id: pc.id, hp: pc.hp, max: pc.hpMax });
    if (pc.hp <= 0) { delete this.world.pieces[pc.id];
    delete this.gates[pc.id];
    this.ver.p++;
    this.broadcast({ t: 'op',
    from: pc.owner,
    op: { k: 'piece-',
    id: pc.id,
    broken: true } });
    }
    this.dirty = true;
  }

  cottage(slot) { const h = this.world.houses[slot]; return h && h.x != null ? h : ServerConfig.PLOTS[slot] || { x: 0, z: 0 }; }

  onInstall(p, m) {
    const d = this.world.doors[m.slot]; if (!d || !d.broken || !this.near(p, this.cottage(m.slot), 8)) return;
    const house = this.world.houses[m.slot], was = (house || {}).owner; d.owner = p.id; d.hp = d.hpMax; d.broken = false;
    if (house) { house.owner = p.id; house.name = p.name; }
    this.ver.p++;
    this.broadcast({ t: 'door',
    slot: m.slot,
    owner: p.id,
    hp: d.hp,
    max: d.hpMax,
    broken: false,
    open: false,
    captured: was && was !== p.id && !this.sameTeam(p.id,
    was) });
    if (was && was !== p.id && !this.sameTeam(p.id, was)) { this.evict(was); const [ws] = this.byId(was); if (ws) this.send(ws, { t: 'evicted' }); }
    if (house) this.broadcast({ t: 'house', slot: +m.slot, owner: p.id, name: p.name, x: house.x, z: house.z, spec: house.spec, door: d });
    this.dirty = true;
  }

  install(room) {
    for (const method of ['onOpen', 'wsOf', 'onHit', 'cottage', 'onInstall']) room[method] = this[method].bind(room);
  }
}
