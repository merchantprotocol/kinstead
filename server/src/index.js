// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/* Kinstead · realtime server. Players connect by WebSocket to /ws/<map>. One GameRoom (a Durable Object) per map:
     - assigns each player a plot (sticky per client id, so you come back to your homestead)
     - relays everyone's position a few times a second, as one batch
     - keeps the shared world edits (pieces, terrain, felled trees, buildings) and replays them to whoever joins
   Threats (wolves, bears) are simulated by each player's own game, so they are never a shared-state problem here. */

const MAX_PLAYERS = 30;           // plots on the map
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
    this.world = { pieces: {}, tiles: {}, nodes: {}, buildings: {} };
    this.dirty = false; this.loaded = false; this.timer = null;
    state.blockConcurrencyWhile(async () => {
      this.plots = (await state.storage.get('plots')) || {};
      const w = await state.storage.get('world'); if (w) this.world = Object.assign(this.world, w);
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
    const taken = new Set(Object.values(this.plots).map((p) => p.slot));
    for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.has(s)) { this.plots[cid] = { slot: s, name }; this.state.storage.put('plots', this.plots); return s; }
    return -1;
  }

  onMessage(ws, p, m) {
    if (m.t === 'hello') {
      const cid = String(m.cid || '').slice(0, 64), name = String(m.name || 'Settler').slice(0, 24); if (!cid) return;
      for (const [other, q] of this.sockets) if (q.cid === cid && other !== ws) { try { other.close(4000, 'signed in elsewhere'); } catch (e) { /* gone */ } this.sockets.delete(other); }
      const slot = this.claim(cid, name);
      if (slot < 0) { this.send(ws, { t: 'full' }); return; }
      Object.assign(p, { cid, id: cid.slice(0, 8), name, slot, joined: true });
      this.send(ws, { t: 'welcome', id: p.id, slot, max: MAX_PLAYERS, players: this.online().filter((q) => q !== p).map((q) => this.pub(q)), claimed: this.claimed(), world: this.world });
      this.broadcast({ t: 'join', p: this.pub(p) }, ws); this.startTimer(); return;
    }
    if (!p.joined) return;
    if (m.t === 'pos') { p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; p.f = +m.f || 0; p.s = String(m.s || 'idle').slice(0, 12); p.tool = String(m.tool || '').slice(0, 14); p.hp = +m.hp || 0; return; }
    if (m.t === 'op') { this.applyOp(p, m.op); this.broadcast({ t: 'op', from: p.id, op: m.op }, ws); return; }
    if (m.t === 'chat') { const text = String(m.text || '').slice(0, 160); if (text) this.broadcast({ t: 'chat', from: p.id, name: p.name, text }); return; }
    if (m.t === 'ping') this.send(ws, { t: 'pong', n: m.n });
  }

  pub(q) { return { id: q.id, name: q.name, slot: q.slot, x: q.x, z: q.z, y: q.y, f: q.f, s: q.s, tool: q.tool }; }
  /** every plot that has a settler (online or not) so their cottage stands on the map */
  claimed() { return Object.entries(this.plots).map(([cid, v]) => ({ id: cid.slice(0, 8), slot: v.slot, name: v.name })); }

  /** the world edits are kept as the latest state per thing, so the log never grows without bound */
  applyOp(p, op) {
    if (!op || !op.k) return; const w = this.world;
    if (op.k === 'piece+') w.pieces[op.id] = { id: op.id, type: op.type, x: op.x, z: op.z, rot: op.rot, owner: p.id };
    else if (op.k === 'piece-') delete w.pieces[op.id];
    else if (op.k === 'tile') w.tiles[op.i + ',' + op.j] = [op.i, op.j, op.h, op.te];
    else if (op.k === 'tiles' && Array.isArray(op.list)) { for (const t of op.list.slice(0, 500)) w.tiles[t[0] + ',' + t[1]] = [t[0], t[1], t[2], t[3]]; }
    else if (op.k === 'node') w.nodes[op.id] = { id: op.id, st: op.st, x: op.x, z: op.z };
    else if (op.k === 'bld+') w.buildings[op.id] = { id: op.id, spec: op.spec, owner: p.id };
    else if (op.k === 'bld-') delete w.buildings[op.id];
    else return;
    this.dirty = true;
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
