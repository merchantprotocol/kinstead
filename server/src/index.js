// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/* Cloudflare Durable Object adapter for the realtime game room. */
import { ServerConfig } from './ServerConfig.js';
import { PlayerRegistry } from './PlayerRegistry.js';
import { WorldState } from './WorldState.js';
import { ClockWeather } from './ClockWeather.js';
import { Markets } from './Markets.js';
import { Stores } from './Stores.js';
import { Banners } from './Banners.js';
import { Teams } from './Teams.js';
import { Doors } from './Doors.js';
import { Tribute } from './Tribute.js';
import { MessageRouter } from './MessageRouter.js';
import { FarmSync } from './FarmSync.js';
import { MobRelay } from './MobRelay.js';
import { Resync } from './Resync.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/ws\/([a-z0-9_-]{1,40})$/i);
    if (match) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(match[1])).fetch(request);
    }
    if (url.pathname === '/health') return new Response('ok');
    return new Response('Kinstead realtime', { status: 200 });
  },
};

export class GameRoom {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.sockets = new Map(); this.plots = {};
    this.world = { pieces: {}, tiles: {}, nodes: {}, buildings: {}, houses: {}, doors: {}, farms: { fields: {}, herds: {}, goods: {} } };
    this.teams = {}; this.gates = {}; this.lastHit = {};
    this.epoch = Date.now(); this.seed = 7; this.respawns = {}; this.stores = {};
    this.markets = {}; this.sales = {}; this.storesDirty = false;
    this.lastPeriod = -1; this.ver = { p: 1, s: 1, t: 1, g: 1, f: 1 };
    this.banners = {}; this.invites = {}; this.dirty = false; this.loaded = false; this.timer = null;
    const services = [PlayerRegistry, WorldState, ClockWeather, Markets, Stores, Banners, Teams, Doors, Tribute, FarmSync, MobRelay, Resync, MessageRouter];
    for (const Service of services) new Service().install(this);
    state.blockConcurrencyWhile(async () => {
      this.plots = (await state.storage.get('plots')) || {};
      const world = await state.storage.get('world'); if (world) this.world = Object.assign(this.world, world);
      this.world.farms = Object.assign({ fields: {}, herds: {}, goods: {} }, this.world.farms || {});
      this.teams = (await state.storage.get('teams')) || {};
      const epoch = await state.storage.get('epoch');
      if (epoch) { this.epoch = epoch.epoch; this.seed = epoch.seed; }
      else { this.seed = Math.floor(Math.random() * 1e9); await state.storage.put('epoch', { epoch: this.epoch, seed: this.seed }); }
      this.banners = (await state.storage.get('banners')) || {}; this.invites = (await state.storage.get('invites')) || {};
      this.respawns = (await state.storage.get('respawns')) || {}; this.stores = (await state.storage.get('stores')) || {};
      this.markets = (await state.storage.get('markets')) || {}; this.sales = (await state.storage.get('sales')) || {};
      this.loaded = true;
    });
  }

  async fetch(request) {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair); server.accept();
    const player = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
    this.sockets.set(server, player);
    server.addEventListener('message', (event) => { try { this.onMessage(server,
    player,
    JSON.parse(event.data)); } catch (error) { /* ignore malformed messages */ } });
    const gone = () => this.onClose(server, player);
    server.addEventListener('close', gone); server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (error) { /* socket is closing */ } }
  broadcast(msg, except) {
    const serialized = JSON.stringify(msg);
    for (const [ws, player] of this.sockets) if (player.joined && ws !== except) { try { ws.send(serialized); } catch (error) { /* closing */ } }
  }
  online() { return [...this.sockets.values()].filter((player) => player.joined); }
  pub(player) { return { id: player.id,
  name: player.name,
  slot: player.slot,
  team: this.teamOf(player.id),
  x: player.x,
  z: player.z,
  y: player.y,
  f: player.f,
  s: player.s,
  tool: player.tool };
  }

  startTimer() {
    if (this.timer) return;
    let last = Date.now();
    this.timer = setInterval(() => {
      const online = this.online();
      if (!online.length) { clearInterval(this.timer); this.timer = null; this.save(); return; }
      const weather = this.weather();
      if (weather.period !== this.lastPeriod) { this.lastPeriod = weather.period; this.broadcast({ t: 'weather', weather }); }
      if (this.storesDirty && Date.now() - last > ServerConfig.SAVE_MS) { this.storesDirty = false; this.state.storage.put('stores', this.stores); }
      if (online.length > 1) {
        const batch = online.map((player) => [
          player.id, +player.x.toFixed(2), +player.z.toFixed(2), +player.y.toFixed(2),
          +player.f.toFixed(2), player.s, player.tool,
        ]);
        this.broadcast({ t: 'tick', p: batch });
      }
      this.mobRelay.tick(online);
      if (Date.now() - last > ServerConfig.SAVE_MS) { last = Date.now(); this.save(); }
    }, ServerConfig.TICK_MS);
  }
  save() {
    if (this.storesDirty) { this.storesDirty = false; this.state.storage.put('stores', this.stores); }
    if (!this.dirty) return; this.dirty = false; this.state.storage.put('world', this.world);
  }
  onClose(ws, player) {
    if (!this.sockets.has(ws)) return; this.sockets.delete(ws);
    if (player.joined) this.mobRelay.drop(player.id);
    if (player.joined) this.broadcast({ t: 'leave', id: player.id });
    if (!this.online().length) this.save();
  }
}
