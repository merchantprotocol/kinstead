/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · other people. 20 to 30 settlers share one map, each with their own plot to build on.
   The realtime server (server/, a Cloudflare Durable Object) hands every player a plot, relays where everyone is,
   and keeps the shared edits to the land (walls, gates, buildings, dug ground, felled trees) so whoever joins sees
   the same world. Wolves and bears are simulated by each player's own game and are only ever after their owner.
   With no server reachable (or none configured) the game simply runs alone on plot 0.
     Identity     who this browser is (an id it keeps, and the name you chose)
     NameGate     asks for your name the first time
     Net          the WebSocket: join, send, receive, reconnect
     RemoteWorld  applies everyone else's edits to your map
     Avatars      the other players, walking about, with name plates and speech
     Multiplayer  ties it to the running game, and sends your own position and edits */
(function (G) {
  const K = G.K, TILE = K.TILE;
  const store = { get: (k) => { try { return G.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { G.localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const TINTS = [0x6e8fd0, 0xd08a6e, 0x7fc28a, 0xc27fc0, 0xd0c06e, 0x6ec2c2, 0xb07a52, 0x9a9ad8];

  class Identity {
    static get cid() { let c = store.get('kinstead.cid'); if (!c) { c = (G.crypto && G.crypto.randomUUID ? G.crypto.randomUUID() : 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36)); store.set('kinstead.cid', c); } return c; }
    static get name() { return store.get('kinstead.name') || ''; }
    static set name(v) { store.set('kinstead.name', v); }
  }

  class NameGate {
    /** the first visit asks what to call you; afterwards it just returns the saved name */
    static ask() {
      const saved = Identity.name; if (saved) return Promise.resolve(saved);
      return new Promise((resolve) => {
        const root = document.createElement('div'); root.id = 'cNameGate';
        root.innerHTML = '<div class="ng"><h2>Who goes there?</h2><p>Other settlers will see this name above your head.</p><input maxlength="20" placeholder="Your name" autocomplete="off"><button>Enter the frozen lands</button></div>';
        document.body.appendChild(root); const input = root.querySelector('input'), go = () => { const v = (input.value || '').trim().slice(0, 20) || 'Settler ' + Math.floor(Math.random() * 900 + 100); Identity.name = v; root.remove(); resolve(v); };
        root.querySelector('button').addEventListener('click', go); input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }); setTimeout(() => input.focus(), 50);
      });
    }
  }

  class Net {
    /** the realtime server: ?server=wss://… in the address, else what was saved, else the built-in default ('' = play alone) */
    static url() {
      let u = ''; try { u = new URLSearchParams(G.location.search).get('server') || ''; } catch (e) { /* no location */ }
      if (u === 'off') return ''; if (u) { store.set('kinstead.server', u); return u; }
      return store.get('kinstead.server') || Net.DEFAULT;
    }
    /** connect and get a plot. Resolves to a Net, or null (play alone). */
    static async join(map = 'main') {
      const base = Net.url(); if (!base) return null;
      const name = await NameGate.ask(), net = new Net(base.replace(/\/+$/, '') + '/ws/' + map, Identity.cid, name);
      const t0 = performance.now();
      try { await net.open(); } catch (e) { console.warn('multiplayer unavailable, playing alone:', e && e.message || e, Math.round(performance.now() - t0) + ' ms', base); return null; }
      return net;
    }
    constructor(url, cid, name) { this.url = url; this.cid = cid; this.name = name; this.ws = null; this.handlers = {}; this.id = null; this.slot = 0; this.welcome = null; this.ready = false; this.closed = false; this.lastPos = 0; }
    /** messages that arrive before anything is listening (the game is still loading) are kept and handed over, so nobody misses a join */
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); const b = this.backlog && this.backlog[type]; if (b) { delete this.backlog[type]; for (const m of b) { try { fn(m); } catch (e) { console.warn('net handler', type, e); } } } }
    emit(type, m) {
      const hs = this.handlers[type]; if (!hs || !hs.length) { this.backlog = this.backlog || {}; const q = (this.backlog[type] = this.backlog[type] || []); q.push(m); if (q.length > 60) q.shift(); return; }
      for (const f of hs) { try { f(m); } catch (e) { console.warn('net handler', type, e); } }
    }
    open() {
      return new Promise((resolve, reject) => {
        let done = false; const fail = (why) => { if (!done) { done = true; reject(new Error(why)); } }, timer = setTimeout(() => fail('timed out'), 15000);   // a busy or slow machine may take a while to answer
        const ws = (this.ws = new WebSocket(this.url));
        ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid: this.cid, name: this.name, mv: 2 }));   // mv 2: send me batched creature deltas ('mobz')
        ws.onerror = () => fail('connection failed');
        ws.onclose = () => { fail('closed'); this.onClosed(); };
        ws.onmessage = (e) => {
          let m; try { m = JSON.parse(e.data); } catch (err) { return; }
          if (m.t === 'welcome') { this.id = m.id; this.slot = m.slot; this.welcome = m; this.clock = m.clock; this.offset = m.clock.now - Date.now(); clearTimeout(timer); if (!done) { done = true; this.ready = true; resolve(this); } else { this.ready = true; this.emit('welcome', m); this.flush(); } return; }
          if (m.t === 'full') { fail('the map is full'); return; }
          this.emit(m.t, m);
        };
      });
    }
    onClosed() { this.ready = false; if (this.closed || !this.welcome) return; this.emit('offline', {}); clearTimeout(this.rt); this.rt = setTimeout(() => this.open().catch(() => this.onClosed()), 3000); }
    /** the server's time, in ms */
    now() { return Date.now() + (this.offset || 0); }
    /** sent now, or (for anything that changes the world) kept and sent the moment the connection is back, so no change is lost */
    send(m) {
      if (this.ready && this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); return; }
      if (['pos', 'fx', 'mobs', 'sync', 'ping'].includes(m.t)) return; (this.queue = this.queue || []).push(m); if (this.queue.length > 600) this.queue.shift();
    }
    flush() { const q = this.queue || []; this.queue = []; for (const m of q) this.send(m); }
    op(o) { this.send({ t: 'op', op: o }); }
    close() { this.closed = true; try { this.ws.close(); } catch (e) { /* already closed */ } }
  }
  Net.DEFAULT = 'wss://kinstead-rooms.merchantprotocol.workers.dev';   // set to the deployed realtime server, e.g. wss://kinstead-rooms.<account>.workers.dev (or pass ?server=…)

  /** other people's edits, applied to your map */
  class RemoteWorld {
    constructor(game, net) { this.g = game; this.net = net; this.pieces = new Map(); this.byId = null; this.cottages = new Set(); this.doors = new Map(); this.owners = {}; this.objDirty = false; this.propsDirty = false; this.houseAt = {}; }   // doors: slot -> { door, owner, hp, max }
    get play() { return this.g.play; }
    /** a burst of other people's changes (a player joining sends dozens) is applied once per frame, not once per change */
    flush() {
      if (this.objDirty) { this.objDirty = false; this.play.R.objectsChanged(false); }
      if (this.propsDirty) { this.propsDirty = false; this.play.refreshProps(); }
    }
    node(id) { if (!this.byId) { this.byId = new Map(); for (const e of this.play.baseProps) this.byId.set(e.id, e); } return this.byId.get(id) || null; }
    /** everything the server holds, applied in one go (join, or coming back after a dropped connection) */
    snapshot(m) {
      const w = m.world || {}, me = this.net.id;
      for (const c of m.claimed || []) { this.owners[c.id] = c.name; this.owners[c.slot] = c.name; if (c.slot !== this.g.L.slot && c.spec) this.cottage(c.slot, c.spec, c.id); }
      for (const b of Object.values(w.buildings || {})) if (b.owner !== me) this.building(b.id, b.spec);
      for (const p of Object.values(w.pieces || {})) if (p.owner !== me) this.addPiece(p);
      let box = null; for (const t of Object.values(w.tiles || {})) { this.setTile(t[0], t[1], t[2], t[3], false); box = this.grow(box, t[0], t[1]); }
      if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
      for (const [slot, d] of Object.entries(w.doors || {})) { const rec = this.doors.get(+slot); if (rec) { rec.owner = d.owner; rec.hp = d.hp; rec.max = d.hpMax; rec.door.broken = !!d.broken; rec.door.open = !!d.broken; rec.door.apply(); } }
      for (const [id, open] of Object.entries(m.gates || {})) this.gateState(id, !!open);
      for (const n of Object.values(w.nodes || {})) this.nodeOp(n, true);
      this.objDirty = true; this.propsDirty = true;
    }
    /** the server's full picture (a periodic check, or after a dropped connection): add what is missing, remove what is gone */
    reconcile(m) {
      const me = this.net.id, g = this.g;
      if (m.world) {
        const pcs = m.world.pieces || {};
        for (const p of Object.values(pcs)) if (p.owner !== me && !this.pieces.has(p.id)) this.addPiece(p);
        for (const id of [...this.pieces.keys()]) if (!pcs[id]) this.removePiece(id);
        for (const c of m.claimed || []) { this.owners[c.id] = c.name; this.owners[c.slot] = c.name; if (c.slot !== g.L.slot && c.spec) this.cottage(c.slot, c.spec, c.id); }
        for (const b of Object.values(m.world.buildings || {})) if (b.owner !== me) this.building(b.id, b.spec);
        for (const [slot, d] of Object.entries(m.world.doors || {})) { const rec = this.doors.get(+slot); if (rec) { rec.owner = d.owner; rec.hp = d.hp; rec.max = d.hpMax; if (rec.door.broken !== !!d.broken) { rec.door.broken = !!d.broken; rec.door.open = !!d.broken; rec.door.apply(); } } }
        for (const [id, open] of Object.entries(m.gates || {})) this.gateState(id, !!open);
        this.propsDirty = true;
        return Object.keys(pcs);
      }
      return null;
    }
    grow(b, i, j) { return b ? [Math.min(b[0], i), Math.min(b[1], j), Math.max(b[2], i), Math.max(b[3], j)] : [i, j, i, j]; }
    apply(op, from) {
      if (op.k === 'piece+') this.addPiece(Object.assign({ owner: from }, op)); else if (op.k === 'piece-') this.removePiece(op.id);
      else if (op.k === 'tile') this.setTile(op.i, op.j, op.h, op.te, true);
      else if (op.k === 'tiles') { let box = null; for (const t of op.list) { this.setTile(t[0], t[1], t[2], t[3], false); box = this.grow(box, t[0], t[1]); } if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1); } else if (op.k === 'node') { this.nodeOp(op, false); this.objDirty = true; }
      else if (op.k === 'bld+') this.building(op.id, op.spec); else if (op.k === 'bld-') this.removeBuilding(op.id);
      if (op.k === 'piece+' || op.k === 'piece-') this.propsDirty = true;
    }
    /** a settler's cottage on their plot */
    cottage(slot, given, owner) {
      const id = 'home:' + slot; if (this.cottages.has(id) || slot === this.g.L.slot || !given) return; this.cottages.add(id);
      const spec = Object.assign({}, given, { id }); this.building(id, spec); if (owner) this.houseAt[owner] = { x: (spec.x + spec.footprint.w / 2) * TILE, z: (spec.z + spec.footprint.h / 2) * TILE }; if (owner) this.g.flags.flag('rh' + slot, (spec.x + spec.footprint.w) * TILE + 0.35, spec.z * TILE - 0.3, owner, 3.6);
      const obj = this.play.doc.obj(id); if (obj) { this.remoteDoor(slot, obj, null); this.g.play.refreshProps(); }
    }
    building(id, spec) {
      const g = this.g, doc = this.play.doc; if (doc.obj(id)) return; const s = K.BuildingSpec.normalize(Object.assign({}, spec, { id })); if (/^home:/.test(id)) s.noDoorLeaves = true; doc.objects.push(s);
      const shop = /^(market|bakery|butcher|library|stable):(.+)$/.exec(id);
      if (shop) g.addEntitySource(new K.ShopShelfSet(g, shop[1], s, shop[2], s.shopTurns || 0));
      g.R.syncBuildings(true); this.play.nav.applyBuildings(g.R.buildings); this.play.bplay.dirty(); this.play.refreshProps();
    }
    removeBuilding(id) { const doc = this.play.doc, i = doc.objects.findIndex((o) => o.id === id); this.g.removeEntitySource(id); if (i < 0) return; doc.objects.splice(i, 1); this.g.R.syncBuildings(true); this.play.nav.applyBuildings(this.g.R.buildings); this.play.refreshProps(); }
    addPiece(p) {
      const g = this.g; if (this.pieces.has(p.id) || !g.data.piece(p.type)) return;
      const m = g.art.piece(p.type, { level: 1 }); g.place(m, p.x, p.z, p.rot); const [w, d] = K.CastleArt.size(p.type), rec = { p, mesh: m, w, d, hp: p.hp, hpMax: p.hpMax, gate: null };
      if (K.Breacher.GATES.has(p.type)) { const o = { x: p.x, z: p.z, rot: p.rot || 0, type: p.type, uid: 'r' + p.id }; rec.gate = p.type === 'gate' ? new K.WoodGate(g, o) : new K.Drawbridge(g, o); rec.gate.remote = true; rec.gate.apply(); const lx = p.type === 'gate' ? 1.05 : 2.25; g.flags.flag('rg' + p.id, p.x + lx * Math.cos(p.rot || 0), p.z - lx * Math.sin(p.rot || 0), p.owner, p.type === 'gate' ? 2.6 : 3.8); }   // their gate: shut to you unless you hold the key
      else g.blockRect(p.x, p.z, g.walls.handles(p.type) ? w + 0.04 : w, d, p.rot, false);
      this.pieces.set(p.id, rec); if (p.type === 'fire_pot') g.R.placeDynamics();
    }
    removePiece(id) {
      const r = this.pieces.get(id); if (!r) return; this.g.group.remove(r.mesh); this.pieces.delete(id); if (r.gate) { r.gate.dispose(); this.g.flags.unflag('rg' + id); }
      const g = this.g, p = r.p; g.unblockRect(p.x, p.z, K.Breacher.GATES.has(p.type) ? r.w : g.walls.handles(p.type) ? r.w + 0.04 : r.w, r.d, p.rot);
      for (const q of g.castle.pieces) if (Math.hypot(q.x - p.x, q.z - p.z) < 6) g.blockPiece(q);
      for (const o of this.pieces.values()) if (!o.gate && Math.hypot(o.p.x - p.x, o.p.z - p.z) < 6) g.blockRect(o.p.x, o.p.z, g.walls.handles(o.p.type) ? o.w + 0.04 : o.w, o.d, o.p.rot, false);
    }
    /** a settler's gate opened or shut (the server only says so if the key was right) */
    gateState(id, open) { const r = this.pieces.get(id); if (r && r.gate && r.gate.open !== open) { r.gate.open = open; r.gate.apply(); } }
    /** a house door: drawn and blocked like your own, but opened only by the server's word */
    remoteDoor(slot, spec, owner) {
      if (this.doors.has(slot)) return this.doors.get(slot); const g = this.g;
      const door = new K.Door({ g, spec }); door.locked = true; door.remote = true; door.apply();
      const rec = { slot, door, owner, hp: 3000, max: 3000, name: (this.owners[slot] || 'Settler') + "'s door" }; door.ent = Object.assign({}, door.ent, { id: 'rd:' + slot, type: 'c_rdoor', rec, name: rec.name }); this.doors.set(slot, rec); return rec;
    }
    doorMsg(m) {
      const rec = this.doors.get(m.slot), g = this.g; if (!rec) return; const d = rec.door;
      if (m.hp != null) { rec.hp = m.hp; rec.max = m.max || rec.max; }
      if (m.owner !== undefined && m.owner) rec.owner = m.owner;
      if (m.broken === true) { d.broken = true; d.open = true; g.sound.play('crack'); }
      if (m.broken === false) { d.broken = false; if (m.open === undefined) d.open = false; }
      if (m.open !== undefined) d.open = !!m.open;
      d.apply();
    }
    /** things on other people's plots you can click: their walls and gates, and their doors */
    /** names of other people's things follow their banner (their team's name, once they have one) */
    relabel() { for (const r of this.pieces.values()) if (r.ent) r.ent.name = this.labelOf(r); for (const r of this.doors.values()) r.door.ent.name = `${this.g.banners.label(r.owner, this.owners[r.slot])}'s door`; }
    labelOf(r) { return `${this.g.banners.label(r.p.owner, this.owners[r.p.owner])}'s ${this.g.data.piece(r.p.type).name.toLowerCase()}`; }
    entities() {
      const out = [], y = (x, z) => this.play.nav.y(x, z);
      for (const [id, r] of this.pieces) {
        if (!r.ent) { const p = r.p, own = this.owners[p.owner] || 'a settler'; r.ent = { id: 'rp:' + id, type: 'c_rpiece', rec: r, x: p.x, z: p.z, y: y(p.x, p.z), r: K.Breacher.GATES.has(p.type) ? Math.max(r.w, r.d) / 2 : Math.max(0.5, Math.min(r.w, r.d) / 2 + 0.2), h: 1.8, name: this.labelOf(r) }; }
        out.push(r.ent);
      }
      for (const r of this.doors.values()) out.push(r.door.ent);
      return out;
    }
    setTile(i, j, h, te, redraw) {
      const d = this.play.doc, nav = this.play.nav; if (!d.inside(i, j)) return; const k = j * d.w + i; if (d.height[k] === h && d.terrain[k] === te) return;
      d.height[k] = h; d.terrain[k] = te; nav.S[k] = nav.surface((i + 0.5) * TILE, (j + 0.5) * TILE, d.hy(i, j)); if (redraw) this.play.R.tilesChanged(i, j, i + 1, j + 1);
    }
    nodeOp(n, quiet) {
      const e = this.node(n.id); if (!e) return; const g = this.g, st = this.play.nodeState(e);
      if (n.st === 'felled') { if (st.charges <= 0) return; st.charges = 0; st.respawnAt = Infinity; g.R.setPropState(e.id, 'depleted'); g.forest.free(e); g.tools.effects.burst(e.type === 'c_tree' ? 'wood' : 'stone', e.x, e.y + 0.6, e.z, 5, 2); }
      else if (n.st === 'moved') { g.forest.free(e); e.obj.x = n.x; e.obj.z = n.z; e.x = n.x; e.z = n.z; e.y = this.play.nav.y(n.x, n.z); st.charges = st.max; st.respawnAt = 0; g.R.propState.delete(e.id); g.forest.moved[e.id] = [n.x, n.z]; this.play.nav.blockProp(e.obj); }
    }
  }

  /** the other players: walking about, with a name above their head */
  class Avatars {
    constructor(game, net) {
      this.g = game; this.net = net; this.by = new Map(); this.root = document.createElement('div'); this.root.id = 'cPlates'; game.cui.root.appendChild(this.root);
    }
    get play() { return this.g.play; }
    add(p) {
      if (this.by.has(p.id)) return this.by.get(p.id); const g = this.g;
      const a = g.addActor({ id: 'pl:' + p.id, role: 'remote', spriteId: 'warden', name: p.name, x: p.x || 0, z: p.z || 0, hpMax: 100, atk: 0, def: 0, speed: 3, cd: 1, reach: 1, r: 0.4, scale: 1, level: 1, info: { xp: 0, loot: [] } });
      a.remote = true; a.pid = p.id; a.hostile = false;
      const rec = { a, tx: p.x || 0, tz: p.z || 0, ty: p.y || 0, f: p.f || 0, s: p.s || 'idle', name: p.name, el: document.createElement('div'), say: null, sayT: 0 };
      rec.el.className = 'plate'; rec.el.innerHTML = `<i class="tm"></i><b>${esc(p.name)}</b><span></span>`; this.root.appendChild(rec.el); rec.id = p.id; this.look(rec);
      a.brain = { update: (dt) => this.step(rec, dt) }; this.by.set(p.id, rec); return rec;
    }
    /** their colour, logo and team name, on their clothes and over their head */
    look(r) { const b = this.g.banners.get(r.id), tm = r.el.querySelector('.tm'); { const c = K.BANNER_COLORS[b.color % 12]; if (r.a.view.setTeam) r.a.view.setTeam(c); else r.a.view.setTint(c); } if (tm) tm.innerHTML = `<img src="${K.Emblems.url(b.logo)}" alt="">${esc(b.name)}`; tm.style.background = '#' + K.BANNER_COLORS[b.color % 12].toString(16).padStart(6, '0'); }
    relook() { for (const r of this.by.values()) this.look(r); }
    remove(id) { const r = this.by.get(id); if (!r) return; this.g.removeActor(r.a); r.el.remove(); this.by.delete(id); }
    clear() { for (const id of [...this.by.keys()]) this.remove(id); }
    /** the server's batch: where everyone is now */
    ticks(list) {
      for (const [id, x, z, y, f, s] of list) { if (id === this.net.id) continue; const r = this.by.get(id); if (!r) continue; r.tx = x; r.tz = z; r.ty = y; r.f = f; r.s = s; }
    }
    step(r, dt) {
      const a = r.a, k = Math.min(1, dt * 9), dx = r.tx - a.x, dz = r.tz - a.z, d = Math.hypot(dx, dz);
      if (d > 30) { a.x = r.tx; a.z = r.tz; } else { a.x += dx * k; a.z += dz * k; }
      a.y += (r.ty - a.y) * k; if (d > 0.04) a.view.setFacing(dx, dz); else a.view.setFacing(Math.cos(r.f), Math.sin(r.f));
      const moving = d > 0.12, want = r.s === 'attack' || r.s === 'action' ? r.s : moving ? (d > 0.9 ? 'run' : 'walk') : 'idle';
      if (a.view.state !== want && !(a.view.state === 'attack' && a.view.stateT < 0.45)) a.view.setState(want);
    }
    say(id, text) { const r = this.by.get(id); if (!r) return; r.say = text; r.sayT = 6; r.el.querySelector('span').textContent = text; r.el.classList.add('talking'); }
    update(dt) {
      for (const r of this.by.values()) {
        const [x, y, front] = this.play.toScreen(r.a.x, r.a.y + (r.a.view.h || 1.6) + 0.35, r.a.z);
        const display = front ? '' : 'none', transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;   // DOM writes only on change: 30 plates every frame add up
        if (r.display !== display) { r.display = display; r.el.style.display = display; }
        if (front && r.transform !== transform) { r.transform = transform; r.el.style.transform = transform; }
        if (r.sayT > 0 && (r.sayT -= dt) <= 0) { r.el.classList.remove('talking'); r.el.querySelector('span').textContent = ''; }
      }
    }
    dispose() { this.clear(); this.root.remove(); }
  }

  /** everyone's supplies around their houses, drawn the same for all; anyone may take from them */
  class RemoteStores {
    constructor(game, net) { this.g = game; this.net = net; this.by = new Map(); this.fake = { g: game, center: { x: 0, z: 0 }, reblock() {}, stores: [] }; }
    upsert(s) {
      if (s.owner === this.net.id) return; const old = this.by.get(s.id); if (old) { this.setStock(s.id, s.stock); return; }
      const cls = s.kind === 'pile' ? K.Pile : s.kind === 'crate' ? K.Crate : K.Barrel;
      const view = new cls(this.fake, { id: s.id, kind: s.kind, name: s.name, res: s.res, dx: s.x, dz: s.z, own: s.stock, stack: s.stack }); view.ent.type = 'c_rstore'; view.ent.sid = s.id; view.ent.name = s.name;
      this.by.set(s.id, { s, view }); view.sync(); this.dirty = true;
    }
    setStock(id, stock) { const r = this.by.get(id); if (!r) return; r.view.stock = stock; if (r.view.refresh && stock > 0) r.view.refresh(); r.view.sync(); this.dirty = true; }
    gone(id) { const r = this.by.get(id); if (!r) return; const g = this.g, v = r.view; g.unblockRect(v.x, v.z, 0.5, 0.5, 0); v.dispose(); this.by.delete(id); this.dirty = true; }
    flush() { if (this.dirty) { this.dirty = false; this.g.play.refreshProps(); } }
    dropOwner(owner) { for (const [id, r] of [...this.by]) if (r.s.owner === owner) this.gone(id); }
    entities() { const out = []; for (const r of this.by.values()) if (r.view.present) out.push(r.view.ent); return out; }
  }

  /** invitations to join a team: little notices beside the world map, each with Accept and Decline */
  class InviteBoard {
    constructor(mp) {
      this.mp = mp; const root = (this.root = document.createElement('div')); root.id = 'cInvites'; mp.g.cui.root.appendChild(root);
      root.addEventListener('pointerdown', (e) => e.stopPropagation());
      root.addEventListener('click', (e) => { const a = e.target.closest('[data-acc]'), d = e.target.closest('[data-dec]'); if (a) mp.acceptInvite(a.dataset.acc); else if (d) mp.declineInvite(d.dataset.dec); else if (e.target.closest('[data-more]')) mp.g.purse.openTab('team'); });
    }
    static card(inv) {
      const b = inv.banner || {}, col = '#' + K.BANNER_COLORS[(b.color || 0) % 12].toString(16).padStart(6, '0');
      return `<div class="inv"><i class="em" style="background:${col}"><img src="${K.Emblems.url(b.logo || 0)}" alt=""></i><div class="t"><b>${esc(inv.name)}</b> invites you to join <b>${esc(inv.teamName)}</b></div><div class="ab"><button data-acc="${esc(inv.team)}" class="ok">Accept</button><button data-dec="${esc(inv.team)}">Decline</button></div></div>`;
    }
    render() {
      const list = this.mp.invites, show = list.slice(-3);
      this.root.innerHTML = show.map((i) => InviteBoard.card(i)).join('') + (list.length > 3 ? `<button class="more" data-more>${list.length - 3} more in your Team tab</button>` : '');
      this.root.hidden = !list.length;
    }
    dispose() { this.root.remove(); }
  }

  class Multiplayer {
    constructor(game, net) {
      this.g = game; this.net = net; this.world = new RemoteWorld(game, net); this.avatars = new Avatars(game, net); this.stores = new RemoteStores(game, net); this.mobs = new K.RemoteMobs(game, net); this.caster = new K.MobCaster(game, net); this.farms = new K.FarmSync(game, this); this.lastSave = -1e9; this.ver = net.welcome.ver || {}; this.syncT = 8; this.t = 0; this.chat = null;
      net.on('join', (m) => { this.avatars.add(m.p); game.cui.toast(`${m.p.name} joined.`); });
      net.on('house', (m) => this.onHouse(m)); net.on('pvphit', (m) => this.onPvpHit(m)); game.banners.on(() => { this.avatars.relook(); this.world.relabel(); });
      net.on('leave', (m) => { const r = this.avatars.by.get(m.id); if (r) game.cui.toast(`${r.name} left.`); this.avatars.remove(m.id); });
      net.on('resync', (m) => this.onResync(m)); net.on('mobs', (m) => this.mobs.update(m.from, m.list || [])); net.on('mobz', (m) => this.mobs.batch(m));
      net.on('mobhurt', (m) => this.onMobHurt(m)); net.on('leave', (m) => this.mobs.dropOwner(m.id));
      net.on('tick', (m) => this.avatars.ticks(m.p));
      net.on('op', (m) => this.onOp(m));
      net.on('farm', (m) => this.farms.updateOwner(m));
      net.on('gate', (m) => { this.world.gateState(m.id, m.open); this.mineGate(m.id, m.open); });
      net.on('door', (m) => this.onDoor(m)); net.on('hp', (m) => this.onHp(m));
      net.on('locked', (m) => game.cui.toast(m.what === 'door' ? 'The door is locked. Only its owner and their team have the key.' : 'The gate is locked. Only its owner and their team have the key.'));
      net.on('teams', (m) => this.setTeams(m.list)); net.on('invite', (m) => this.onInvite(m)); net.on('invites', (m) => { this.invites = m.list || []; this.invitesChanged(); }); net.on('declined', (m) => game.cui.toast(`${m.name} declined your invitation to ${m.teamName}.`));
      net.on('demand', (m) => this.onDemand(m)); net.on('paid', (m) => this.onPaid(m)); net.on('refused', (m) => game.cui.toast(`${m.name} refused to pay.`));
      net.on('fx', (m) => this.onFx(m)); net.on('stores', (m) => this.onStores(m)); net.on('store', (m) => this.onStore(m)); net.on('stock', (m) => this.onStock(m));
      net.on('took', (m) => this.giveTaken(m.res, m.n)); net.on('raided', (m) => game.cui.toast(`${m.by} raided your supplies (${m.n} ${K.CastleData.resName(m.res).toLowerCase()}).`));
      net.on('evicted', () => this.onEvicted()); net.on('weather', (m) => game.weather && game.weather.setFromServer(m.weather));
      net.on('chat', (m) => { if (m.from === net.id) return; game.cui.toast(`${m.name}: ${m.text}`); this.avatars.say(m.from, m.text); });
      net.on('welcome', (m) => this.start(m));
      net.on('offline', () => game.cui.toast('Lost the connection. Reconnecting…'));
      this.teams = (net.welcome.teams || []); this.invites = (net.welcome.invites || []).slice(); this.board = new InviteBoard(this); this.lastOpen = null; this.lastBroken = null; this.lastHit = 0;
      this.start(net.welcome, true); this.makeChatBox(); this.board.render();
    }
    start(w, first) { this.caster.reset(); if (w.clock) { this.net.clock = w.clock; this.net.offset = w.clock.now - Date.now(); } if (this.g.weather && w.weather) this.g.weather.setFromServer(w.weather); if (!first) this.avatars.clear(); for (const p of w.players || []) this.avatars.add(p); this.world.snapshot(w); this.farms.apply(w.world && w.world.farms); this.syncStores(w.stores || []); if (!this.g.resume) this.net.send({ t: 'save', data: null }); }
    /** tell the server what you already have on your plot (a game from before multiplayer, or one saved on this device) */
    uploadMine() {
      const g = this.g, tiles = [], d = g.play.doc, h0 = g.persist.h0, t0 = g.persist.t0;
      if (g.home.built) this.announceHome();
      for (const p of g.castle.pieces) this.op({ k: 'piece+', id: this.pieceId(p), type: p.type, x: p.x, z: p.z, rot: p.rot || 0 });
      if (g.smithy) this.op({ k: 'bld+', id: 'smithy:' + this.net.id, spec: g.smithy });
      if (g.marketHall) this.op({ k: 'bld+', id: 'market:' + this.net.id, spec: g.marketHall });
      for (const [t, h] of Object.entries(g.halls || {})) this.op({ k: 'bld+', id: t + ':' + this.net.id, spec: h.spec });
      for (let k = 0; k < d.height.length; k++) if (d.height[k] !== h0[k] || d.terrain[k] !== t0[k]) { tiles.push([k % d.w, (k / d.w) | 0, d.height[k], d.terrain[k]]); if (tiles.length >= 400) { this.op({ k: 'tiles', list: tiles.splice(0) }); } }
      if (tiles.length) this.op({ k: 'tiles', list: tiles });
      for (const e of g.forest.nodes) if (!g.forest.live(e)) this.op({ k: 'node', id: e.id, st: 'felled' });
      this.farms.publish();
    }
    /** [phase index, seconds into it, day number] from the server's clock */
    cycleState() { const c = this.net.clock, tot = c.day + c.night, el = Math.max(0, (this.net.now() - c.epoch) / 1000), n = Math.floor(el / tot) + 1, tin = el % tot; return tin < c.day ? [0, tin, n] : [1, tin - c.day, n]; }
    /* ---------- your progress, kept on the server ---------- */
    saveRemote(snap, force) { const now = performance.now(); if (!force && now - this.lastSave < 8000) return; this.lastSave = now; try { this.net.send({ t: 'save', data: JSON.stringify(snap) }); } catch (e) { console.warn('could not send the save', e); } }
    /* ---------- pickups everyone sees ---------- */
    fx(o) { this.net.send({ t: 'fx', fx: o }); }
    onFx(m) { const f = m.fx, e = this.g.tools.effects; if (f.k === 'pk+') e.pickups.spawn(f.kind, f.value, f.x, f.y, f.z, 1.2, !!f.exact, null, f.id); else if (f.k === 'pk-') e.pickups.drop(f.id); }
    /* ---------- supplies ---------- */
    own(s) { return s.stock != null && s.present; }
    pub(s) { return { id: s.id, kind: s.kind, name: s.name, res: s.res, x: +s.x.toFixed(2), z: +s.z.toFixed(2), stack: s.stack || 1, stock: s.stock }; }
    publishStores() { this.net.send({ t: 'stores', list: this.g.home.stores.filter((s) => this.own(s)).map((s) => this.pub(s)) }); }
    storeAdd(s) { if (this.own(s)) this.net.send({ t: 'store', id: s.id, kind: s.kind, name: s.name, res: s.res, x: +s.x.toFixed(2), z: +s.z.toFixed(2), stack: s.stack || 1, stock: s.stock }); }
    storeGone(s) { this.net.send({ t: 'store', id: s.id, gone: true }); }
    stockDelta(s, d) { if (d) this.net.send({ t: 'stock', id: s.id, d }); }
    /** on joining: take the server's word for what is in your barrels (raiders may have been), then show everyone else's */
    syncStores(list) {
      const me = this.me, mine = list.filter((s) => s.owner === me), home = this.g.home;
      if (!mine.length) this.publishStores(); else this.reconcileMine(mine);
      for (const s of list) if (s.owner !== me) this.stores.upsert(s);
    }
    reconcileMine(mine) {
      const home = this.g.home, by = new Map(mine.map((s) => [s.id.slice(this.me.length + 1), s]));
      for (const st of home.stores.slice()) {
        if (st.stock == null) continue; const sv = by.get(st.id); by.delete(st.id);
        if (sv) { st.stock = sv.stock; if (st.refresh && st.stock > 0) st.refresh(); st.sync(); } else if (st.pile) { st.stock = 0; st.sync(); } else this.storeAdd(st);
      }
      for (const sv of by.values()) if (sv.kind === 'pile' && sv.stock > 0) home.dropPile(sv.res, sv.x, sv.z, sv.stock, null, sv.id.slice(this.me.length + 1), true);
    }
    onStores(m) { if (m.mine) return; this.stores.dropOwner(m.owner); for (const s of m.list) this.stores.upsert(s); }
    onStore(m) { if (m.gone) { this.stores.gone(m.id); return; } this.stores.upsert(m.s); }
    onStock(m) {
      const mineId = m.id.startsWith(this.me + ':') ? m.id.slice(this.me.length + 1) : null;
      if (mineId) { const st = this.g.home.stores.find((q) => q.id === mineId); if (st && st.stock !== m.stock) { st.stock = m.stock; if (st.refresh && st.stock > 0) st.refresh(); st.sync(); } return; }
      this.stores.setStock(m.id, m.stock);
    }
    takeFrom(id) { this.net.send({ t: 'take', id, n: 10 }); }
    giveTaken(res, n) {
      const g = this.g; if (res === 'bread') { g.play.player.addItem('bread', n); } else g.castle.add(res, n);
      g.changed(); g.sound.play('gather'); g.play.float(g.play.me, `+${n} ${K.CastleData.resName(res).toLowerCase()}`, 'loot');
    }
    /* ---------- houses and keys ---------- */
    /** do you hold the key to this building (so you may sleep there)? */
    keyFor(id) {
      const m = /^home:(\d+)$/.exec(id); if (m) { const r = this.world.doors.get(+m[1]); return !!r && !r.door.broken && !!r.owner && this.mayUse(r.owner); }
      const s = /^(?:smithy|market|stable|bakery|butcher|library):(.+)$/.exec(id); if (s) return this.mayUse(s[1]); return false;
    }
    slotOf(id) { if (id === 'home') return this.g.L.slot; const m = /^home:(\d+)$/.exec(id); return m ? +m[1] : null; }
    setRespawn(slot, x, z) { this.net.send({ t: 'respawn', slot, x: +x.toFixed(2), z: +z.toFixed(2) }); }

    get me() { return this.net.id; }
    /** every few seconds: ask the server whether we have missed anything */
    onResync(m) {
      const g = this.g, me = this.me;
      if (m.players) { const ids = new Set(m.players.map((p) => p.id)); for (const p of m.players) this.avatars.add(p); for (const id of [...this.avatars.by.keys()]) if (!ids.has(id)) this.avatars.remove(id); }
      if (m.teams) this.setTeams(m.teams);
      const serverPieces = this.world.reconcile(m);
      if (m.world && m.world.farms) this.farms.apply(m.world.farms);
      if (serverPieces) {   // anything of mine the server never heard about goes up again
        const have = new Set(serverPieces); for (const p of g.castle.pieces) if (!have.has(this.pieceId(p))) this.op({ k: 'piece+', id: this.pieceId(p), type: p.type, x: p.x, z: p.z, rot: p.rot || 0 });
        if (g.home.built && !(m.claimed || []).some((c) => c.slot === g.L.slot)) this.announceHome();
        if (g.smithy && !Object.keys((m.world || {}).buildings || {}).includes('smithy:' + me)) this.op({ k: 'bld+', id: 'smithy:' + me, spec: g.smithy });
        if (g.marketHall && !Object.keys((m.world || {}).buildings || {}).includes('market:' + me)) this.op({ k: 'bld+', id: 'market:' + me, spec: g.marketHall });
        for (const [t, h] of Object.entries(g.halls || {})) if (!Object.keys((m.world || {}).buildings || {}).includes(t + ':' + me)) this.op({ k: 'bld+', id: t + ':' + me, spec: h.spec });
      }
      if (m.stores) {
        const others = m.stores.filter((s) => s.owner !== me), ids = new Set(others.map((s) => s.id));
        for (const s of others) this.stores.upsert(s); for (const id of [...this.stores.by.keys()]) if (!ids.has(id)) this.stores.gone(id);
        const mine = new Set(m.stores.filter((s) => s.owner === me).map((s) => s.id.slice(me.length + 1))); for (const st of g.home.stores) if (this.own(st) && !mine.has(st.id)) this.storeAdd(st);
      }
      if (m.tiles) { let box = null; for (const t of Object.values(m.tiles)) { this.world.setTile(t[0], t[1], t[2], t[3], false); box = this.world.grow(box, t[0], t[1]); } if (box) g.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1); }
      if (m.nodes) { for (const n of Object.values(m.nodes)) this.world.nodeOp(n, true); this.world.objDirty = true; }
      this.ver = m.ver || this.ver;
    }
    /** the creatures this game runs, told to everyone else a few times a second (only what changed) */
    castMobs() { this.caster.cast(); }
    /** you struck someone else's creature: its owner's game takes the blow */
    mobHit(b) { this.net.send({ t: 'mobhit', to: b.mob.owner, id: b.mob.id, tool: this.g.tools.tool.id }); }
    /** one of your creatures bit another player */
    mobBite(a, b) { this.net.send({ t: 'mobbite', to: b.pid, mob: a.id, name: a.name, dmg: Math.round(a.atk || 5) }); }
    onMobHurt(m) {
      const g = this.g, a = g.play.actors.find((x) => x.id === m.id && !x.remote); if (!a || !a.alive || !a.hostile) return;
      a.hp -= m.dmg; a.aggro = true; a.lastFight = g.play.t; g.play.float(a, String(m.dmg), 'dealt'); if (a.view.flash) a.view.flash('hit'); if (a.hp <= 0) g.play.kill(a);
    }
    /** you built your cottage: everyone gets to see it, and its door is yours */
    announceHome() { const g = this.g; if (g.home.built) this.net.send({ t: 'op', op: { k: 'bld+', id: 'home:' + g.L.slot, spec: g.home.spec, slot: g.L.slot } }); }
    /** someone else built their cottage */
    onHouse(m) {
      if (m.slot === this.g.L.slot) return; this.world.owners[m.owner] = m.name; this.world.owners[m.slot] = m.name; this.world.cottage(m.slot, m.spec, m.owner);
      const rec = this.world.doors.get(m.slot); if (rec && m.door) { rec.owner = m.door.owner; rec.hp = m.door.hp; rec.max = m.door.hpMax; }
      this.g.cui.toast(`${m.name} built a cottage.`);
    }
    /** who is on your team (including you), with their colours */
    teamRoster() {
      const tid = this.teamId(this.me); if (!tid) return []; const t = this.teams.find((x) => x.id === tid);
      return (t ? t.members : []).map((id) => ({ id, name: id === this.me ? 'You' : (this.avatars.by.get(id) || {}).name || this.world.owners[id] || 'a settler', color: this.g.banners.get(id).color }));
    }
    teamId(id) { for (const t of this.teams) if (t.members.includes(id)) return t.id; return null; }
    /** do you hold the key for something this settler owns? (yours, or your team's) */
    mayUse(owner) { return !owner || owner === this.me || (!!this.teamId(this.me) && this.teamId(this.me) === this.teamId(owner)); }
    setTeams(list) { this.teams = list; for (const [id, r] of this.avatars.by) r.el.classList.toggle('ally', this.mayUse(id)); }
    onOp(m) {
      const op = m.op;
      if (op.k === 'piece-' && op.broken && m.from === this.me) {   // one of mine was broken down by someone else
        const p = this.g.castle.pieces.find((q) => this.pieceId(q) === op.id); if (p) { this.quiet = true; this.g.demolishPiece(p, { refund: false }); this.quiet = false; this.g.cui.toast('One of your walls was broken down!'); } return;
      }
      this.world.apply(op, m.from);
      if (op.k === 'piece-') this.farms.herds.removePiece(op.id);
    }
    mineGate(id, open) { const p = this.g.castle.pieces.find((q) => q.bridge && this.pieceId(q) === id); if (p && p.bridge.open !== open) { p.bridge.open = open; p.bridge.apply(); } }
    gate(p, open) { this.net.send({ t: 'open', id: this.pieceId(p), open }); }
    requestGate(rec) { this.net.send({ t: 'open', id: rec.p.id, open: !rec.gate.open }); }
    requestDoor(rec) { this.net.send({ t: 'open', slot: rec.slot, open: !rec.door.open }); }
    pvp(target) { this.net.send({ t: 'pvp', to: target, tool: this.g.tools.tool.id, auto: !!this.g.sweep.lastSwingAuto }); }
    /** another player's blow lands on you */
    onPvpHit(m) {
      const g = this.g, me = g.play.me; if (!me.alive) return; g.play.float(me, '-' + m.dmg, 'hurt'); me.view.flash && me.view.flash('hit'); g.sound.play('hit');
      if (g.play.player.hurt(m.dmg)) g.play.defeat();
      g.xp.taken(); if (m.mob) { const mr = this.mobs.find(m.from, m.mob); if (mr) g.sweep.defend(mr.a); return; }   // a creature bit you: fight it like your own
      const r = this.avatars.by.get(m.from); if (r && !m.auto) g.sweep.defend(r.a, true);   // one blow back for a blow struck on purpose; a blow struck back is never answered automatically, so it cannot spiral
    }
    /** if you are shut inside someone else's house or fence you may walk out: the door or gate opens for you (only you), then shuts behind you. You cannot come back in. */
    exits() {
      const g = this.g, me = g.play.me, b = g.R.buildings.at(Math.floor(me.x / TILE), Math.floor(me.z / TILE)), here = b ? b.spec.id : null;
      for (const rec of this.world.doors.values()) {
        const d = rec.door; if (this.mayUse(rec.owner) || d.broken || d.open) { if (d.localOpen) { d.localOpen = false; d.apply(); } continue; }
        const dist = Math.hypot(me.x - d.ent.x, me.z - d.ent.z);
        if (!d.localOpen && here === 'home:' + rec.slot && dist < 1.9) { d.localOpen = true; d.apply(); } else if (d.localOpen && dist > 2.8) { d.localOpen = false; d.apply(); }
      }
      for (const r of this.world.pieces.values()) {
        const gt = r.gate; if (!gt) continue; const p = r.p;
        if (this.mayUse(p.owner) || gt.open) { if (gt.localOpen) { gt.localOpen = false; gt.apply(); } continue; }
        const dist = Math.hypot(me.x - p.x, me.z - p.z), h = this.world.houseAt[p.owner], nx = Math.sin(p.rot || 0), nz = Math.cos(p.rot || 0);
        const mine = (me.x - p.x) * nx + (me.z - p.z) * nz, theirs = h ? (h.x - p.x) * nx + (h.z - p.z) * nz : 0;
        const inside = !!h && mine * theirs > 0;   // you are on the side where their house is
        if (!gt.localOpen && inside && dist < 2.2) { gt.localOpen = true; gt.apply(); } else if (gt.localOpen && dist > 3.2) { gt.localOpen = false; gt.apply(); }
      }
    }
    /** a swing at someone else's wall, gate or door: the server decides if it lands */
    hit(rec, door) {
      const g = this.g, now = g.play.t; if (now - this.lastHit < 0.35) return; this.lastHit = now; const me = g.play.me;
      g.play.face(me, door ? rec.door.ent : rec.p); me.view.setState('attack'); g.sound.play('thunk');
      this.net.send(door ? { t: 'hit', slot: rec.slot, tool: g.tools.tool.id } : { t: 'hit', id: rec.p.id, tool: g.tools.tool.id });
    }
    installDoor(rec) {
      const g = this.g, c = g.castle; if (!c.spend({ wood: 3 })) { g.cui.toast('You need 3 wood to hang a door.'); return; }
      this.net.send({ t: 'install', slot: rec.slot }); g.changed();
    }
    onHp(m) {
      const g = this.g;
      if (m.id) {
        const r = this.world.pieces.get(m.id), mine = g.castle.pieces.find((q) => this.pieceId(q) === m.id), old = r ? r.hp : mine ? mine.hp : m.hp;
        if (r) r.hp = m.hp; if (mine) mine.hp = m.hp; const at = r ? r.p : mine; if (at && old > m.hp) g.play.float({ x: at.x, z: at.z, y: g.play.nav.y(at.x, at.z), h: 1 }, '-' + (old - m.hp), 'hurt');
      } else if (m.slot != null) {
        const d = m.slot === g.L.slot ? g.home.door : (this.world.doors.get(m.slot) || {}).door; if (!d) return; const old = d.hp || m.hp; d.hp = m.hp; const rec = this.world.doors.get(m.slot); if (rec) rec.hp = m.hp;
        if (old > m.hp) g.play.float(d.ent, '-' + (old - m.hp), 'hurt');
      }
    }
    onDoor(m) {
      const g = this.g;
      if (m.slot === g.L.slot) {   // my own door
        const d = g.home.door; if (m.broken === true) { d.broken = true; d.open = true; d.apply(); g.cui.toast('Your door was broken down!'); g.sound.play('crack'); }
        else if (m.open !== undefined && !m.broken) { d.open = !!m.open; d.apply(); }
        return;
      }
      this.world.doorMsg(m); if (m.captured) { const rec = this.world.doors.get(m.slot); g.cui.toast(`${(this.avatars.by.get(m.owner) || {}).name || 'A settler'} captured ${this.world.owners[m.slot] || 'a'}'s castle!`); }
    }
    onEvicted() {
      const g = this.g; try { G.localStorage.setItem('kinstead.evict', '1'); } catch (e) { /* private mode */ }
      g.cui.modal('<h2>Your castle was taken</h2><p>Someone broke your door and hung their own. You keep what you carry, and you will wake on a fresh plot.</p>', [{ label: 'Start again', pri: true, run: () => G.location.reload() }]);
    }
    /* ---------- other people: teams and tribute ---------- */
    playerMenu(a) {
      const g = this.g, id = a.id.replace(/^pl:/, ''), mine = this.teamId(this.me), buttons = [];
      if (this.mayUse(id)) buttons.push({ label: 'Leave my team', run: () => this.net.send({ t: 'team', a: 'leave' }) }); else buttons.push({ label: 'Invite to my team', run: () => { this.net.send({ t: 'team', a: 'invite', to: id }); g.cui.toast(`Invited ${a.name}.`); } });
      buttons.push({ label: 'Demand tribute…', run: () => this.demandStep1(id, a.name) }); buttons.push({ label: 'Close', pri: true });
      g.cui.modal(`<h2>${esc(a.name)}</h2><p>${this.mayUse(id) ? 'On your team: you share every key.' : 'A stranger. Left-click attacks them; right-click opens this. Invite them to share keys, or demand tribute if they are close.'}</p>`, buttons);
    }
    demandStep1(id, name) { const g = this.g, res = ['wood', 'stone', 'iron', 'food', 'gold']; g.cui.modal(`<h2>Demand tribute from ${esc(name)}</h2><p>What do you want?</p>`, res.map((r) => ({ label: K.CastleData.resName(r), run: () => this.demandStep2(id, name, r) })).concat([{ label: 'Never mind', pri: true }])); }
    demandStep2(id, name, res) { const g = this.g; g.cui.modal(`<h2>How much ${esc(K.CastleData.resName(res).toLowerCase())}?</h2>`, [10, 25, 50, 100].map((n) => ({ label: String(n), run: () => { this.net.send({ t: 'demand', to: id, res, n }); g.cui.toast(`You demand ${n} ${K.CastleData.resName(res).toLowerCase()} from ${name}.`); } })).concat([{ label: 'Never mind', pri: true }])); }
    onDemand(m) {
      const g = this.g, c = g.castle, nm = K.CastleData.resName(m.res).toLowerCase(), have = c.amount(m.res) >= m.n;
      g.cui.modal(`<h2>${esc(m.name)} demands tribute</h2><p>They want <b>${m.n} ${nm}</b>. You have ${c.amount(m.res)}. Pay and they leave you be, or refuse.</p>`, [
        { label: have ? `Pay ${m.n} ${nm}` : 'Cannot afford', run: () => { if (c.spend({ [m.res]: m.n })) { this.net.send({ t: 'pay', to: m.from, res: m.res, n: m.n }); g.changed(); g.cui.toast(`You paid ${m.name}.`); } else { this.net.send({ t: 'refuse', to: m.from }); } } },
        { label: 'Refuse', pri: true, run: () => this.net.send({ t: 'refuse', to: m.from }) }]);
    }
    onPaid(m) { const g = this.g, got = g.castle.add(m.res, m.n); g.changed(); g.cui.toast(`${m.name} paid you ${m.n} ${K.CastleData.resName(m.res).toLowerCase()}${got < m.n ? ' (your store was full for the rest)' : ''}.`); }
    /** an invitation arrived: it waits beside the world map (and in your Team tab) until you answer */
    onInvite(m) { this.invites = this.invites.filter((x) => x.team !== m.team); this.invites.push(m); this.invitesChanged(); this.g.cui.toast(`${m.name} invites you to join ${m.teamName}.`); this.g.sound.play('fanfare'); }
    invitesChanged() { this.board.render(); this.g.purse.refreshTeam(); }
    acceptInvite(team) { const inv = this.invites.find((x) => x.team === team); this.net.send({ t: 'team', a: 'accept', team }); this.invites = this.invites.filter((x) => x.team !== team); this.invitesChanged(); if (inv) this.g.cui.toast(`You joined ${inv.teamName}. You share their keys and fly their banner.`); }
    declineInvite(team) { this.net.send({ t: 'team', a: 'decline', team }); this.invites = this.invites.filter((x) => x.team !== team); this.invitesChanged(); }
    /** the game reports its own changes here */
    op(o) { this.net.op(o); }
    pieceId(p) { return this.net.id + ':' + p.uid; }
    update(dt) {
      this.t += dt; this.avatars.update(dt); this.world.flush(); this.stores.flush(); this.farms.update(dt); this.exits();
      if ((this.syncT -= dt) <= 0) { this.syncT = 12; this.net.send({ t: 'sync', v: this.ver }); }   // catch up on anything missed
      this.caster.update(dt); this.mobs.tick(dt);
      for (const r of this.world.doors.values()) r.door.update(dt);
      for (const r of this.world.pieces.values()) if (r.gate) r.gate.update(dt);
      const d = this.g.home.door; if (this.lastOpen !== d.open) { if (this.lastOpen !== null) this.net.send({ t: 'open', slot: this.g.L.slot, open: d.open }); this.lastOpen = d.open; }
      if (this.lastBroken !== d.broken) { if (this.lastBroken !== null) this.net.send({ t: 'doorstate', broken: d.broken }); this.lastBroken = d.broken; }
      if (this.t >= 0.1) {
        this.t = 0; const me = this.g.play.me, d = me.view.dir;
        this.net.send({ t: 'pos', x: +me.x.toFixed(2), z: +me.z.toFixed(2), y: +(me.y || 0).toFixed(2), f: +Math.atan2(d.z, d.x).toFixed(2), s: me.view.state, tool: this.g.tools.tool.id, hp: Math.round(this.g.play.player.hp) });
      }
    }
    /** Enter opens a chat line; Enter sends it, Esc closes */
    makeChatBox() {
      const el = (this.chat = document.createElement('div')); el.id = 'cChat'; el.hidden = true; el.innerHTML = '<input maxlength="140" placeholder="Say something…" autocomplete="off">'; this.g.cui.root.appendChild(el);
      const input = el.querySelector('input'); el.addEventListener('pointerdown', (e) => e.stopPropagation());
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.closeChat(); else if (e.key === 'Enter') { const t = input.value.trim(); if (t) { this.net.send({ t: 'chat', text: t }); this.g.cui.toast(`You: ${t}`); } this.closeChat(); } });
    }
    closeChat() { this.chat.hidden = true; this.chat.querySelector('input').value = ''; }
    key(e) { if (e.key === 'Enter' && this.chat.hidden) { this.chat.hidden = false; setTimeout(() => this.chat.querySelector('input').focus(), 0); return true; } return false; }
    get chatOpen() { return !this.chat.hidden; }
    dispose() { this.net.close(); this.avatars.dispose(); this.mobs.dispose(); this.farms.dispose(); this.chat.remove(); this.board.dispose(); }
  }

  Object.assign(K, { Identity, NameGate, Net, RemoteWorld, RemoteStores, Avatars, InviteBoard, Multiplayer });
})(typeof window !== 'undefined' ? window : globalThis);
