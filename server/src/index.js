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
const CYCLE = { day: 210, night: 100 };            // seconds: must match Calendar.PHASES on the client
const WEATHER_SEC = 150;                            // the weather changes at most this often
/** the weather for a period: the same answer for everyone, from the period number alone */
function weatherFor(period, seed) { let h = (period * 2654435761 + seed) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; const r = (h % 1000) / 1000; return r < 0.5 ? 'clear' : r < 0.8 ? 'flurries' : 'blizzard'; }
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
    this.epoch = Date.now(); this.seed = 7; this.respawns = {}; this.stores = {};   // stores: store id -> { id, owner, kind, name, res, x, z, stack, stock }
    this.lastPeriod = -1;
    this.dirty = false; this.loaded = false; this.timer = null;
    state.blockConcurrencyWhile(async () => {
      this.plots = (await state.storage.get('plots')) || {};
      const w = await state.storage.get('world'); if (w) this.world = Object.assign(this.world, w);
      this.teams = (await state.storage.get('teams')) || {};
      const e = await state.storage.get('epoch'); if (e) { this.epoch = e.epoch; this.seed = e.seed; } else { this.seed = Math.floor(Math.random() * 1e9); await state.storage.put('epoch', { epoch: this.epoch, seed: this.seed }); }
      this.respawns = (await state.storage.get('respawns')) || {}; this.stores = (await state.storage.get('stores')) || {};
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
    for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) { this.plots[cid] = { slot: s, name }; this.state.storage.put('plots', this.plots); return s; }   // a plot, nothing more: the house appears when its settler builds it
    return -1;
  }
  /** a settler built their cottage: it and its door (theirs alone, until someone breaks it and hangs their own) now exist for everyone */
  onHome(p, op) {
    if (op.id !== 'home:' + p.slot || !op.spec || !op.spec.footprint) return;
    const sp = op.spec, x = (sp.x + sp.footprint.w / 2) * 0.5, z = (sp.z + sp.footprint.h / 2) * 0.5, old = this.world.houses[p.slot];
    if (old && old.owner !== p.id && this.world.doors[p.slot] && this.world.doors[p.slot].owner !== p.id) return;   // someone else holds it now
    this.world.houses[p.slot] = { owner: p.id, name: p.name, x, z, spec: sp };
    if (!this.world.doors[p.slot]) this.world.doors[p.slot] = { owner: p.id, hp: DOOR_HP, hpMax: DOOR_HP, broken: false };
    this.dirty = true; this.broadcast({ t: 'house', slot: p.slot, owner: p.id, name: p.name, x, z, spec: sp, door: this.world.doors[p.slot] });
  }
  /** the settler whose house was taken gets a fresh plot the next time they come in */
  async evictSave(cid) {
    const raw = await this.state.storage.get('save:' + cid); if (!raw) return;
    try { const sv = JSON.parse(raw), keep = sv.extras || {}; sv.castle.pieces = []; sv.hero = null; sv.nodes = {}; sv.extras = { weapons: keep.weapons, held: keep.held, xp: keep.xp }; this.state.storage.put('save:' + cid, JSON.stringify(sv)); } catch (e) { /* unreadable save: leave it */ }
  }
  evict(ownerId) {
    const cid = Object.keys(this.plots).find((c) => c.slice(0, 8) === ownerId); if (!cid) return; this.evictSave(cid);
    const taken = new Set([...Object.values(this.plots).map((p) => p.slot), ...Object.keys(this.world.houses).map(Number)]);
    for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) { this.plots[cid] = { slot: s, name: this.plots[cid].name, evicted: true }; this.state.storage.put('plots', this.plots); break; }
  }

  async onMessage(ws, p, m) {
    if (m.t === 'hello') {
      const cid = String(m.cid || '').slice(0, 64), name = String(m.name || 'Settler').slice(0, 24); if (!cid) return;
      for (const [other, q] of this.sockets) if (q.cid === cid && other !== ws) { try { other.close(4000, 'signed in elsewhere'); } catch (e) { /* gone */ } this.sockets.delete(other); }
      const slot = this.claim(cid, name);
      if (slot < 0) { this.send(ws, { t: 'full' }); return; }
      Object.assign(p, { cid, id: cid.slice(0, 8), name, slot, joined: true });
      const save = await this.state.storage.get('save:' + cid);
      const ev = this.plots[cid].evicted; if (ev) { delete this.plots[cid].evicted; this.state.storage.put('plots', this.plots); }
      this.send(ws, { t: 'welcome', id: p.id, slot, evicted: !!ev, max: MAX_PLAYERS, players: this.online().filter((q) => q !== p).map((q) => this.pub(q)), claimed: this.claimed(), world: this.world, teams: this.teamList(), gates: this.gates, save: save || null, clock: this.clock(), weather: this.weather(), respawn: this.validRespawn(p), stores: Object.values(this.stores) });
      this.broadcast({ t: 'join', p: this.pub(p) }, ws); this.startTimer(); return;
    }
    if (!p.joined) return;
    if (m.t === 'pos') { p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; p.f = +m.f || 0; p.s = String(m.s || 'idle').slice(0, 12); p.tool = String(m.tool || '').slice(0, 14); p.hp = +m.hp || 0; return; }
    if (m.t === 'op' && m.op && m.op.k === 'bld+' && /^home:/.test(m.op.id || '')) { this.onHome(p, m.op); return; }
    if (m.t === 'op') { if (this.applyOp(p, m.op) !== false) this.broadcast({ t: 'op', from: p.id, op: m.op }, ws); return; }
    if (m.t === 'chat') { const text = String(m.text || '').slice(0, 160); if (text) this.broadcast({ t: 'chat', from: p.id, name: p.name, text }); return; }
    if (m.t === 'doorstate') { const d = this.world.doors[p.slot]; if (!d || d.owner !== p.id) return; d.broken = !!m.broken; if (!d.broken) d.hp = d.hpMax; this.broadcast({ t: 'door', slot: p.slot, broken: d.broken, open: d.broken ? true : undefined, hp: d.hp, max: d.hpMax }, null); this.dirty = true; return; }
    if (m.t === 'save') { if (m.data === null) { this.state.storage.delete('save:' + p.cid); return; } const str = typeof m.data === 'string' ? m.data : ''; if (str.length < 600000) this.state.storage.put('save:' + p.cid, str); return; }   // your progress, kept on the server
    if (m.t === 'respawn') { const slot = m.slot | 0; if (!this.mayRespawn(p, slot) || !this.near(p, this.cottage(slot), 14)) return; this.respawns[p.cid] = { slot, x: +m.x, z: +m.z }; this.state.storage.put('respawns', this.respawns); return; }
    if (m.t === 'stores') { this.onStores(p, m); return; }
    if (m.t === 'store') { this.onStore(p, m); return; }
    if (m.t === 'stock') { this.onStock(p, m); return; }
    if (m.t === 'take') { this.onTake(p, m); return; }
    if (m.t === 'fx') { this.broadcast({ t: 'fx', from: p.id, fx: m.fx }, this.wsOf(p)); return; }   // pickups: not kept, just shown to everyone
    if (m.t === 'team') { this.onTeam(p, m); return; }
    if (m.t === 'open') { this.onOpen(p, m); return; }
    if (m.t === 'hit') { this.onHit(p, m); return; }
    if (m.t === 'install') { this.onInstall(p, m); return; }
    if (m.t === 'demand' || m.t === 'pay' || m.t === 'refuse') { this.onTribute(p, m); return; }
    if (m.t === 'ping') this.send(ws, { t: 'pong', n: m.n });
  }

  pub(q) { return { id: q.id, name: q.name, slot: q.slot, team: this.teamOf(q.id), x: q.x, z: q.z, y: q.y, f: q.f, s: q.s, tool: q.tool }; }
  /** every plot that has a settler (online or not) so their cottage stands on the map */
  claimed() { return Object.entries(this.world.houses).map(([slot, h]) => ({ id: h.owner, slot: +slot, name: h.name, x: h.x, z: h.z, spec: h.spec })); }

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

  /* ---------- the clock and the weather belong to the server ---------- */
  clock() { return { epoch: this.epoch, now: Date.now(), day: CYCLE.day, night: CYCLE.night }; }
  weather() { const period = Math.floor((Date.now() - this.epoch) / 1000 / WEATHER_SEC); return { kind: weatherFor(period, this.seed), period, until: this.epoch + (period + 1) * WEATHER_SEC * 1000 }; }
  validRespawn(p) { const r = this.respawns[p.cid]; return r && this.mayRespawn(p, r.slot) ? r : null; }
  /** whether this settler may sleep in, and wake in, the house on this plot */
  mayRespawn(p, slot) { const d = this.world.doors[slot]; return !!d && !d.broken && !!d.owner && this.mayUse(p, d.owner); }
  /* ---------- supplies: everyone sees them, anyone may take ---------- */
  onStores(p, m) {
    for (const id of Object.keys(this.stores)) if (this.stores[id].owner === p.id) delete this.stores[id];
    for (const s of (m.list || []).slice(0, 80)) this.stores[p.id + ':' + s.id] = { id: p.id + ':' + s.id, owner: p.id, kind: s.kind, name: String(s.name || '').slice(0, 40), res: s.res, x: s.x, z: s.z, stack: s.stack || 1, stock: Math.max(0, s.stock | 0) };
    this.broadcast({ t: 'stores', owner: p.id, list: Object.values(this.stores).filter((q) => q.owner === p.id) }, this.wsOf(p)); this.storesDirty = true;
    this.send(this.wsOf(p), { t: 'stores', owner: p.id, mine: true, list: Object.values(this.stores).filter((q) => q.owner === p.id) });   // what the server holds for you (it may differ: raiders)
  }
  onStore(p, m) {   // one store appears (a pile you dropped) or goes
    const id = p.id + ':' + m.id;
    if (m.gone) { delete this.stores[id]; this.broadcast({ t: 'store', id, gone: true }); }
    else { this.stores[id] = { id, owner: p.id, kind: m.kind, name: String(m.name || '').slice(0, 40), res: m.res, x: m.x, z: m.z, stack: m.stack || 1, stock: Math.max(0, m.stock | 0) }; this.broadcast({ t: 'store', s: this.stores[id] }, this.wsOf(p)); }
    this.storesDirty = true;
  }
  onStock(p, m) {   // the owner added or removed some of their own
    const st = this.stores[p.id + ':' + m.id]; if (!st) return; st.stock = Math.max(0, st.stock + (m.d | 0)); this.broadcast({ t: 'stock', id: st.id, stock: st.stock }); this.storesDirty = true;
  }
  onTake(p, m) {
    const st = this.stores[m.id]; if (!st || !this.near(p, st, 6)) return; const n = Math.min(st.stock, Math.max(1, Math.min(10, m.n | 0))); if (n <= 0) return;
    st.stock -= n; this.send(this.wsOf(p), { t: 'took', id: st.id, res: st.res, n }); this.broadcast({ t: 'stock', id: st.id, stock: st.stock }); this.storesDirty = true;
    const [ws] = this.byId(st.owner); if (ws && st.owner !== p.id) this.send(ws, { t: 'raided', by: p.name, res: st.res, n });
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
  cottage(slot) { const h = this.world.houses[slot]; return h && h.x != null ? h : PLOTS[slot] || { x: 0, z: 0 }; }
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
      const w = this.weather(); if (w.period !== this.lastPeriod) { this.lastPeriod = w.period; this.broadcast({ t: 'weather', weather: w }); }
      if (this.storesDirty && Date.now() - last > SAVE_MS) { this.storesDirty = false; this.state.storage.put('stores', this.stores); }
      if (on.length > 1) { const batch = on.map((q) => [q.id, +q.x.toFixed(2), +q.z.toFixed(2), +q.y.toFixed(2), +q.f.toFixed(2), q.s, q.tool]); this.broadcast({ t: 'tick', p: batch }); }
      if (Date.now() - last > SAVE_MS) { last = Date.now(); this.save(); }
    }, TICK_MS);
  }
  save() { if (this.storesDirty) { this.storesDirty = false; this.state.storage.put('stores', this.stores); } if (!this.dirty) return; this.dirty = false; this.state.storage.put('world', this.world); }
  onClose(ws, p) {
    if (!this.sockets.has(ws)) return; this.sockets.delete(ws);
    if (p.joined) this.broadcast({ t: 'leave', id: p.id });
    if (!this.online().length) this.save();
  }
}
