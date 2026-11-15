import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class MessageRouter {
  async onMessage(ws, p, m) {
    if (m.t === 'hello') return this.join(ws, p, m);
    if (!p.joined) return;

    const routes = {
      pos: () => this.updatePosition(p, m),
      op: () => this.routeOp(ws, p, m),
      chat: () => this.routeChat(p, m),
      doorstate: () => this.routeDoorState(p, m),
      save: () => this.routeSave(p, m),
      respawn: () => this.routeRespawn(p, m),
      market: () => this.onMarket(p, m), buy: () => this.onBuy(p, m),
      stores: () => this.onStores(p, m), store: () => this.onStore(p, m),
      stock: () => this.onStock(p, m), take: () => this.onTake(p, m),
      fx: () => this.broadcast({ t: 'fx', from: p.id, fx: m.fx }, this.wsOf(p)),
      pvp: () => this.routePvp(p, m), sync: () => this.routeSync(ws, p, m),
      mobs: () => this.broadcast({ t: 'mobs', from: p.id, list: (m.list || []).slice(0, 40) }, ws),
      mobhit: () => this.routeMobHit(ws, p, m), mobbite: () => this.routeMobBite(p, m),
      banner: () => this.onBanner(p, m), team: () => this.onTeam(p, m),
      farm: () => this.farmSync.snapshot(p.id, m.farm),
      open: () => this.onOpen(p, m), hit: () => this.onHit(p, m), install: () => this.onInstall(p, m),
      demand: () => this.onTribute(p, m), pay: () => this.onTribute(p, m),
      refuse: () => this.onTribute(p, m), ping: () => this.send(ws, { t: 'pong', n: m.n }),
    };
    const route = routes[m.t];
    if (route) route();
  }

  async join(ws, p, m) {
    const cid = String(m.cid || '').slice(0, 64), name = String(m.name || 'Settler').slice(0, 24);
    if (!cid) return;
    for (const [other, q] of this.sockets) {
      if (q.cid !== cid || other === ws) continue;
      this.broadcast({ t: 'leave', id: q.id }, other);
      q.joined = false;
      try { other.close(4000, 'signed in elsewhere'); } catch (error) { /* gone */ }
      this.sockets.delete(other);
    }
    const slot = this.claim(cid, name);
    if (slot < 0) { this.send(ws, { t: 'full' }); return; }
    Object.assign(p, { cid, id: cid.slice(0, 8), name, slot, x: ServerConfig.PLOTS[slot].x, z: ServerConfig.PLOTS[slot].z, joined: true });
    const save = await this.state.storage.get('save:' + cid);
    const evicted = this.plots[cid].evicted;
    if (evicted) { delete this.plots[cid].evicted; this.state.storage.put('plots', this.plots); }
    this.send(ws, {
      t: 'welcome', id: p.id, slot, evicted: !!evicted, max: ServerConfig.MAX_PLAYERS,
      players: this.online().filter((q) => q !== p).map((q) => this.pub(q)), claimed: this.claimed(), world: this.world,
      teams: this.teamList(), gates: this.gates, ver: this.ver, save: save || null,
      invites: (this.invites[p.id] || []).filter((invite) => this.teams[invite.team]),
      banners: this.allBanners(), clock: this.clock(), weather: this.weather(), respawn: this.validRespawn(p),
      stores: Object.values(this.stores), markets: Object.values(this.markets), sales: this.takeSales(p.id),
    });
    this.broadcast({ t: 'join', p: this.pub(p) }, ws);
    this.pushBanners([p.id]);
    this.startTimer();
  }

  updatePosition(p, m) {
    p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; p.f = +m.f || 0;
    p.s = String(m.s || 'idle').slice(0, 12); p.tool = String(m.tool || '').slice(0, 14); p.hp = +m.hp || 0;
  }

  routeOp(ws, p, m) {
    if (m.op && m.op.k === 'bld+' && /^home:/.test(m.op.id || '')) return this.onHome(p, m.op);
    if (this.applyOp(p, m.op) !== false) this.broadcast({ t: 'op', from: p.id, op: m.op }, ws);
  }

  routeChat(p, m) {
    const text = String(m.text || '').slice(0, 160);
    if (text) this.broadcast({ t: 'chat', from: p.id, name: p.name, text });
  }

  routeDoorState(p, m) {
    const door = this.world.doors[p.slot];
    if (!door || door.owner !== p.id) return;
    door.broken = !!m.broken;
    if (!door.broken) door.hp = door.hpMax;
    this.broadcast({ t: 'door', slot: p.slot, broken: door.broken, open: door.broken ? true : undefined, hp: door.hp, max: door.hpMax }, null);
    this.dirty = true; this.ver.p++;
  }

  routeSave(p, m) {
    if (m.data === null) { this.state.storage.delete('save:' + p.cid); return; }
    const data = typeof m.data === 'string' ? m.data : '';
    if (data.length < 600000) this.state.storage.put('save:' + p.cid, data);
  }

  routeRespawn(p, m) {
    const slot = m.slot | 0;
    if (!this.mayRespawn(p, slot) || !this.near(p, this.cottage(slot), 14)) return;
    this.respawns[p.cid] = { slot, x: +m.x, z: +m.z };
    this.state.storage.put('respawns', this.respawns);
  }

  routePvp(p, m) {
    const [ws, target] = this.byId(m.to);
    if (!ws || target === p || this.sameTeam(p.id, target.id) || !this.near(p, target, 14)) return;
    const now = Date.now();
    if (now - (this.lastHit['pvp' + p.id] || 0) < 250) return;
    this.lastHit['pvp' + p.id] = now;
    this.send(ws, { t: 'pvphit', from: p.id, name: p.name, dmg: ServerConfig.DMG[m.tool] || ServerConfig.DMG.default, auto: !!m.auto });
  }

  routeSync(ws, p, m) {
    const versions = m.v || {};
    const out = { t: 'resync', ver: this.ver, players: this.online().filter((q) => q !== p).map((q) => this.pub(q)) };
    if (versions.p !== this.ver.p) {
      out.world = { pieces: this.world.pieces, buildings: this.world.buildings, doors: this.world.doors, farms: this.world.farms };
      out.claimed = this.claimed(); out.gates = this.gates; out.teams = this.teamList();
    }
    if (versions.s !== this.ver.s) out.stores = Object.values(this.stores);
    if (versions.t !== this.ver.t) { out.tiles = this.world.tiles; out.nodes = this.world.nodes; }
    this.send(ws, out);
  }

  routeMobHit(ws, p, m) {
    const [target] = this.byId(m.to);
    if (target && target !== ws) this.send(target, { t: 'mobhurt', id: m.id, dmg: ServerConfig.DMG[m.tool] || ServerConfig.DMG.default, from: p.id });
  }

  routeMobBite(p, m) {
    const [ws, target] = this.byId(m.to);
    if (!ws || target === p || this.sameTeam(p.id, target.id) || !this.near(p, target, 14)) return;
    this.send(ws, {
      t: 'pvphit', from: p.id, mob: String(m.mob || '').slice(0, 40),
      name: String(m.name || 'Wolf').slice(0, 30), dmg: Math.max(1, Math.min(40, m.dmg | 0)), auto: true,
    });
  }

  install(room) {
    for (const method of Object.getOwnPropertyNames(MessageRouter.prototype)) {
      if (method !== 'constructor' && method !== 'install') room[method] = this[method].bind(room);
    }
  }
}
