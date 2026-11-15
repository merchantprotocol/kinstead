// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/* Kinstead · realtime server. Players connect by WebSocket to /ws/<map>. One GameRoom (a Durable Object) per map:
     - assigns each player a plot (sticky per client id, so you come back to your homestead)
     - relays everyone's position a few times a second, as one batch
     - keeps the shared world edits (pieces, terrain, felled trees, buildings) and replays them to whoever joins
   Threats (wolves, bears) are simulated by each player's own game, so they are never a shared-state problem here. */

const MAX_PLAYERS = 30;           // plots on the map
const DOOR_HP = 3000;             // a house door takes a crew a good while
const HP = { palisade: 400, stone_wall: 900, gate: 700, stone_gate: 2500, default: 900 };   // structures other players can break
const DMG = { sword: 5, stoneblade: 5, ironsword: 9, spear: 7, warhammer: 18, longbow: 2, bow: 2, axe: 8, pickaxe: 8, shovel: 3, hammer: 4, default: 4 };
const PLOTS = (() => { const a = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) a.push({ x: 30 + c * 44, z: 30 + r * 35 }); a.sort((p, q) => Math.hypot(p.x - 140, p.z - 100) - Math.hypot(q.x - 140, q.z - 100)); return a; })();   // must match WorldPlan on the client
const STONE = new Set(['stone_wall', 'stone_gate']);
const RES = new Set(['wood', 'stone', 'dirt', 'iron', 'food', 'arrow', 'gold', 'bread']);
const TICK_MS = 120;              // position batches
const SAVE_MS = 5000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([a-z0-9_-]{1,40})$/i);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(request);
    }
    if (url.pathname === '/health') return new Response('ok');
    return new Response('Kinstead realtime', { status: 200 });
  },
};

export class GameRoom {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.sockets = new Map();                 // ws -> player
    this.plots = {};                          // clientId -> { slot, name }
    this.world = { pieces: {}, tiles: {}, nodes: {}, buildings: {}, houses: {}, doors: {} };   // houses: slot -> original settler; doors: slot -> { owner, hp, hpMax, broken }
    this.teams = {};                          // team id -> { id, name, members: [client ids] }
    this.gates = {};                          // piece id -> open (not saved: gates shut when the server restarts)
    this.lastHit = {};
    this.dirty = false; this.loaded = false; this.timer = null;
    state.blockConcurrencyWhile(async () => {
      this.plots = (await state.storage.get('plots')) || {};
      const w = await state.storage.get('world'); if (w) this.world = Object.assign(this.world, w);
      this.teams = (await state.storage.get('teams')) || {};
      this.loaded = true;
    });
  }

  async fetch(request) {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const player = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
    this.sockets.set(server, player);
    server.addEventListener('message', (e) => { try { this.onMessage(server, player, JSON.parse(e.data)); } catch (err) { /* ignore a bad message */ } });
    const gone = () => this.onClose(server, player);
    server.addEventListener('close', gone); server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* socket is closing */ } }
  broadcast(msg, except) { const s = JSON.stringify(msg); for (const [ws, p] of this.sockets) if (p.joined && ws !== except) { try { ws.send(s); } catch (e) { /* closing */ } } }
  online() { return [...this.sockets.values()].filter((p) => p.joined); }

  /** the lowest free plot, or the one this client had before */
  claim(cid, name) {
    const mine = this.plots[cid]; if (mine) { mine.name = name; return mine.slot; }
    const taken = new Set([...Object.values(this.plots).map((p) => p.slot), ...Object.keys(this.world.houses).map(Number)]);
    for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) { this.plots[cid] = { slot: s, name }; this.makeHouse(s, cid, name); this.state.storage.put('plots', this.plots); return s; }
    return -1;
  }
  /** a new house gets a door that is the settler's alone, until someone breaks it and puts up their own */
  makeHouse(slot, cid, name) { this.world.houses[slot] = { owner: cid.slice(0, 8), name }; this.world.doors[slot] = { owner: cid.slice(0, 8), hp: DOOR_HP, hpMax: DOOR_HP, broken: false }; this.dirty = true; }
  /** the settler whose house was taken gets a fresh plot the next time they come in */
  evict(ownerId) {
    const cid = Object.keys(this.plots).find((c) => c.slice(0, 8) === ownerId); if (!cid) return;
    const taken = new Set([...Object.values(this.plots).map((p) => p.slot), ...Object.keys(this.world.houses).map(Number)]);
    for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) { this.plots[cid] = { slot: s, name: this.plots[cid].name, evicted: true }; this.makeHouse(s, cid, this.plots[cid].name); this.state.storage.put('plots', this.plots); break; }
  }

  onMessage(ws, p, m) {
    if (m.t === 'hello') {
      const cid = String(m.cid || '').slice(0, 64), name = String(m.name || 'Settler').slice(0, 24); if (!cid) return;
      for (const [other, q] of this.sockets) if (q.cid === cid && other !== ws) { try { other.close(4000, 'signed in elsewhere'); } catch (e) { /* gone */ } this.sockets.delete(other); }
      const slot = this.claim(cid, name);
      if (slot < 0) { this.send(ws, { t: 'full' }); return; }
      Object.assign(p, { cid, id: cid.slice(0, 8), name, slot, joined: true });
      if (!this.world.houses[slot]) this.makeHouse(slot, cid, name);
      const ev = this.plots[cid].evicted; if (ev) { delete this.plots[cid].evicted; this.state.storage.put('plots', this.plots); }
      this.send(ws, { t: 'welcome', id: p.id, slot, evicted: !!ev, max: MAX_PLAYERS, players: this.online().filter((q) => q !== p).map((q) => this.pub(q)), claimed: this.claimed(), world: this.world, teams: this.teamList(), gates: this.gates });
      this.broadcast({ t: 'join', p: this.pub(p) }, ws); this.startTimer(); return;
    }
    if (!p.joined) return;
    if (m.t === 'pos') { p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; p.f = +m.f || 0; p.s = String(m.s || 'idle').slice(0, 12); p.tool = String(m.tool || '').slice(0, 14); p.hp = +m.hp || 0; return; }
    if (m.t === 'op') { if (this.applyOp(p, m.op) !== false) this.broadcast({ t: 'op', from: p.id, op: m.op }, ws); return; }
    if (m.t === 'chat') { const text = String(m.text || '').slice(0, 160); if (text) this.broadcast({ t: 'chat', from: p.id, name: p.name, text }); return; }
    if (m.t === 'doorstate') { const d = this.world.doors[p.slot]; if (!d || d.owner !== p.id) return; d.broken = !!m.broken; if (!d.broken) d.hp = d.hpMax; this.broadcast({ t: 'door', slot: p.slot, broken: d.broken, open: d.broken ? true : undefined, hp: d.hp, max: d.hpMax }, null); this.dirty = true; return; }
    if (m.t === 'team') { this.onTeam(p, m); return; }
    if (m.t === 'open') { this.onOpen(p, m); return; }
    if (m.t === 'hit') { this.onHit(p, m); return; }
    if (m.t === 'install') { this.onInstall(p, m); return; }
    if (m.t === 'demand' || m.t === 'pay' || m.t === 'refuse') { this.onTribute(p, m); return; }
    if (m.t === 'ping') this.send(ws, { t: 'pong', n: m.n });
  }

  pub(q) { return { id: q.id, name: q.name, slot: q.slot, team: this.teamOf(q.id), x: q.x, z: q.z, y: q.y, f: q.f, s: q.s, tool: q.tool }; }
  /** every plot that has a settler (online or not) so their cottage stands on the map */
  claimed() { return Object.entries(this.world.houses).map(([slot, h]) => ({ id: h.owner, slot: +slot, name: h.name })); }

  /** the world edits are kept as the latest state per thing, so the log never grows without bound */
  applyOp(p, op) {
    if (!op || !op.k) return; const w = this.world;
    if (op.k === 'piece+') { const hpMax = HP[op.type] || HP.default; w.pieces[op.id] = { id: op.id, type: op.type, x: op.x, z: op.z, rot: op.rot, owner: p.id, hp: hpMax, hpMax }; }
    else if (op.k === 'piece-') { const pc = w.pieces[op.id]; if (pc && !this.mayUse(p, pc.owner)) return false; delete w.pieces[op.id]; delete this.gates[op.id]; }
    else if (op.k === 'tile') w.tiles[op.i + ',' + op.j] = [op.i, op.j, op.h, op.te];
    else if (op.k === 'tiles' && Array.isArray(op.list)) { for (const t of op.list.slice(0, 500)) w.tiles[t[0] + ',' + t[1]] = [t[0], t[1], t[2], t[3]]; }
    else if (op.k === 'node') w.nodes[op.id] = { id: op.id, st: op.st, x: op.x, z: op.z };
    else if (op.k === 'bld+') w.buildings[op.id] = { id: op.id, spec: op.spec, owner: p.id };
    else if (op.k === 'bld-') delete w.buildings[op.id];
    else return false;
    this.dirty = true;
  }

  /* ---------- teams: the same team shares every key ---------- */
  teamOf(id) { for (const t of Object.values(this.teams)) if (t.members.includes(id)) return t.id; return null; }
  sameTeam(a, b) { const t = this.teamOf(a); return !!t && t === this.teamOf(b); }
  mayUse(p, owner) { return !owner || owner === p.id || this.sameTeam(p.id, owner); }
  teamList() { return Object.values(this.teams).map((t) => ({ id: t.id, name: t.name, members: t.members })); }
  saveTeams() { this.state.storage.put('teams', this.teams); this.broadcast({ t: 'teams', list: this.teamList() }); }
  byId(id) { for (const [ws, q] of this.sockets) if (q.joined && q.id === id) return [ws, q]; return [null, null]; }
  near(a, b, m) { return Math.hypot(a.x - b.x, a.z - b.z) <= m; }
  onTeam(p, m) {
    if (m.a === 'create') { if (this.teamOf(p.id)) return; const id = 't' + Math.random().toString(36).slice(2, 7); this.teams[id] = { id, name: String(m.name || p.name + "'s company").slice(0, 28), members: [p.id] }; this.saveTeams(); }
    else if (m.a === 'invite') {
      let tid = this.teamOf(p.id); if (!tid) { tid = 't' + Math.random().toString(36).slice(2, 7); this.teams[tid] = { id: tid, name: p.name + "'s company", members: [p.id] }; this.saveTeams(); }
      const [ws, q] = this.byId(m.to); if (ws && q !== p) this.send(ws, { t: 'invite', from: p.id, name: p.name, team: tid, teamName: this.teams[tid].name });
    } else if (m.a === 'accept') { const t = this.teams[m.team]; if (!t || this.teamOf(p.id)) return; t.members.push(p.id); this.saveTeams(); }
    else if (m.a === 'leave') { const tid = this.teamOf(p.id); if (!tid) return; const t = this.teams[tid]; t.members = t.members.filter((x) => x !== p.id); if (!t.members.length) delete this.teams[tid]; this.saveTeams(); }
  }
  /* ---------- keys: only the owner (or their team) may open a gate or door ---------- */
  onOpen(p, m) {
    if (m.slot != null) { const d = this.world.doors[m.slot]; if (!d || (!d.broken && !this.mayUse(p, d.owner))) { this.send(this.wsOf(p), { t: 'locked', what: 'door', slot: m.slot }); return; } this.broadcast({ t: 'door', slot: m.slot, open: !!m.open }); return; }
    const pc = this.world.pieces[m.id]; if (!pc || !this.near(p, pc, 8)) return;
    if (!this.mayUse(p, pc.owner)) { this.send(this.wsOf(p), { t: 'locked', what: 'gate', id: m.id }); return; }
    this.gates[m.id] = !!m.open; this.broadcast({ t: 'gate', id: m.id, open: !!m.open });
  }
  wsOf(p) { for (const [ws, q] of this.sockets) if (q === p) return ws; return null; }
  /* ---------- breaking in ---------- */
  onHit(p, m) {
    const now = Date.now(); if (now - (this.lastHit[p.id] || 0) < 300) return; this.lastHit[p.id] = now;
    const dmg = DMG[m.tool] || DMG.default;
    if (m.slot != null) {
      const d = this.world.doors[m.slot], house = this.world.houses[m.slot]; if (!d || d.broken || this.mayUse(p, d.owner)) return;
      const c = this.cottage(m.slot); if (!this.near(p, c, 6)) return;
      d.hp = Math.max(0, d.hp - dmg); this.broadcast({ t: 'hp', slot: m.slot, hp: d.hp, max: d.hpMax });
      if (d.hp <= 0) { d.broken = true; d.owner = null; this.broadcast({ t: 'door', slot: m.slot, broken: true, open: true }); }
      this.dirty = true; return;
    }
    const pc = this.world.pieces[m.id]; if (!pc || this.mayUse(p, pc.owner) || !this.near(p, pc, 5)) return;
    if (pc.hp == null) { pc.hpMax = HP[pc.type] || HP.default; pc.hp = pc.hpMax; }
    const k = (STONE.has(pc.type) ? (m.tool === 'pickaxe' || m.tool === 'warhammer' ? 2 : 0.6) : (m.tool === 'axe' ? 1.5 : 1)); pc.hp = Math.max(0, pc.hp - Math.round(dmg * k));
    this.broadcast({ t: 'hp', id: pc.id, hp: pc.hp, max: pc.hpMax });
    if (pc.hp <= 0) { delete this.world.pieces[pc.id]; delete this.gates[pc.id]; this.broadcast({ t: 'op', from: pc.owner, op: { k: 'piece-', id: pc.id, broken: true } }); }
    this.dirty = true;
  }
  /** where a house's door is: the centre of its plot (the same grid the client uses) */
  cottage(slot) { return PLOTS[slot] || { x: 0, z: 0 }; }
  /** put up your own door on a broken one: you hold its key now, and the old owner is out */
  onInstall(p, m) {
    const d = this.world.doors[m.slot]; if (!d || !d.broken || !this.near(p, this.cottage(m.slot), 8)) return;
    const was = (this.world.houses[m.slot] || {}).owner; d.owner = p.id; d.hp = d.hpMax; d.broken = false;
    this.broadcast({ t: 'door', slot: m.slot, owner: p.id, hp: d.hp, max: d.hpMax, broken: false, open: false, captured: was && was !== p.id && !this.sameTeam(p.id, was) });
    if (was && was !== p.id && !this.sameTeam(p.id, was)) { this.evict(was); const [ws] = this.byId(was); if (ws) this.send(ws, { t: 'evicted' }); }
    this.dirty = true;
  }
  /* ---------- tribute: a demand, paid or refused ---------- */
  onTribute(p, m) {
    const [ws, q] = this.byId(m.to); if (!ws || q === p || !this.near(p, q, 12)) return;
    if (m.t === 'demand') { const res = String(m.res), n = Math.max(1, Math.min(9999, m.n | 0)); if (!RES.has(res)) return; this.send(ws, { t: 'demand', from: p.id, name: p.name, res, n }); }
    else if (m.t === 'pay') { const res = String(m.res), n = Math.max(1, Math.min(9999, m.n | 0)); if (!RES.has(res)) return; this.send(ws, { t: 'paid', from: p.id, name: p.name, res, n }); }
    else this.send(ws, { t: 'refused', from: p.id, name: p.name });
  }

  startTimer() {
    if (this.timer) return;
    let last = Date.now();
    this.timer = setInterval(() => {
      const on = this.online();
      if (!on.length) { clearInterval(this.timer); this.timer = null; this.save(); return; }
      if (on.length > 1) { const batch = on.map((q) => [q.id, +q.x.toFixed(2), +q.z.toFixed(2), +q.y.toFixed(2), +q.f.toFixed(2), q.s, q.tool]); this.broadcast({ t: 'tick', p: batch }); }
      if (Date.now() - last > SAVE_MS) { last = Date.now(); this.save(); }
    }, TICK_MS);
  }
  save() { if (!this.dirty) return; this.dirty = false; this.state.storage.put('world', this.world); }
  onClose(ws, p) {
    if (!this.sockets.has(ws)) return; this.sockets.delete(ws);
    if (p.joined) this.broadcast({ t: 'leave', id: p.id });
    if (!this.online().length) this.save();
  }
}
