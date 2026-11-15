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
      try { await net.open(); } catch (e) { console.warn('multiplayer unavailable, playing alone:', e && e.message || e); return null; }
      return net;
    }
    constructor(url, cid, name) { this.url = url; this.cid = cid; this.name = name; this.ws = null; this.handlers = {}; this.id = null; this.slot = 0; this.welcome = null; this.ready = false; this.closed = false; this.lastPos = 0; }
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); }
    emit(type, m) { for (const f of this.handlers[type] || []) { try { f(m); } catch (e) { console.warn('net handler', type, e); } } }
    open() {
      return new Promise((resolve, reject) => {
        let done = false; const fail = (why) => { if (!done) { done = true; reject(new Error(why)); } }, timer = setTimeout(() => fail('timed out'), 6000);
        const ws = (this.ws = new WebSocket(this.url));
        ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid: this.cid, name: this.name }));
        ws.onerror = () => fail('connection failed');
        ws.onclose = () => { fail('closed'); this.onClosed(); };
        ws.onmessage = (e) => {
          let m; try { m = JSON.parse(e.data); } catch (err) { return; }
          if (m.t === 'welcome') { this.id = m.id; this.slot = m.slot; this.welcome = m; clearTimeout(timer); if (!done) { done = true; this.ready = true; resolve(this); } else { this.ready = true; this.emit('welcome', m); } return; }
          if (m.t === 'full') { fail('the map is full'); return; }
          this.emit(m.t, m);
        };
      });
    }
    onClosed() { this.ready = false; if (this.closed || !this.welcome) return; this.emit('offline', {}); clearTimeout(this.rt); this.rt = setTimeout(() => this.open().catch(() => this.onClosed()), 3000); }
    send(m) { if (this.ready && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
    op(o) { this.send({ t: 'op', op: o }); }
    close() { this.closed = true; try { this.ws.close(); } catch (e) { /* already closed */ } }
  }
  Net.DEFAULT = 'wss://kinstead-rooms.merchantprotocol.workers.dev';   // set to the deployed realtime server, e.g. wss://kinstead-rooms.<account>.workers.dev (or pass ?server=…)

  /** other people's edits, applied to your map */
  class RemoteWorld {
    constructor(game, net) { this.g = game; this.net = net; this.pieces = new Map(); this.byId = null; this.cottages = new Set(); }
    get play() { return this.g.play; }
    node(id) { if (!this.byId) { this.byId = new Map(); for (const e of this.play.baseProps) this.byId.set(e.id, e); } return this.byId.get(id) || null; }
    /** everything the server holds, applied in one go (join, or coming back after a dropped connection) */
    snapshot(m) {
      const w = m.world || {}, me = this.net.id;
      for (const c of m.claimed || []) if (c.id !== me) this.cottage(c.slot);
      for (const b of Object.values(w.buildings || {})) if (b.owner !== me) this.building(b.id, b.spec);
      for (const p of Object.values(w.pieces || {})) if (p.owner !== me) this.addPiece(p);
      let box = null; for (const t of Object.values(w.tiles || {})) { this.setTile(t[0], t[1], t[2], t[3], false); box = this.grow(box, t[0], t[1]); }
      if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
      for (const n of Object.values(w.nodes || {})) this.nodeOp(n, true);
      this.play.R.objectsChanged(false);
    }
    grow(b, i, j) { return b ? [Math.min(b[0], i), Math.min(b[1], j), Math.max(b[2], i), Math.max(b[3], j)] : [i, j, i, j]; }
    apply(op, from) {
      if (op.k === 'piece+') this.addPiece(Object.assign({ owner: from }, op)); else if (op.k === 'piece-') this.removePiece(op.id);
      else if (op.k === 'tile') this.setTile(op.i, op.j, op.h, op.te, true);
      else if (op.k === 'tiles') { let box = null; for (const t of op.list) { this.setTile(t[0], t[1], t[2], t[3], false); box = this.grow(box, t[0], t[1]); } if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1); } else if (op.k === 'node') { this.nodeOp(op, false); this.play.R.objectsChanged(false); }
      else if (op.k === 'bld+') this.building(op.id, op.spec); else if (op.k === 'bld-') this.removeBuilding(op.id);
    }
    /** a settler's cottage on their plot */
    cottage(slot) {
      const id = 'home:' + slot; if (this.cottages.has(id) || slot === this.g.L.slot) return; this.cottages.add(id);
      this.building(id, this.g.L.cottageAt(slot, id));
    }
    building(id, spec) {
      const g = this.g, doc = this.play.doc; if (doc.obj(id)) return; const s = K.BuildingSpec.normalize(Object.assign({}, spec, { id })); doc.objects.push(s);
      g.R.syncBuildings(true); this.play.nav.applyBuildings(g.R.buildings); this.play.bplay.dirty(); this.play.refreshProps();
    }
    removeBuilding(id) { const doc = this.play.doc, i = doc.objects.findIndex((o) => o.id === id); if (i < 0) return; doc.objects.splice(i, 1); this.g.R.syncBuildings(true); this.play.nav.applyBuildings(this.g.R.buildings); this.play.refreshProps(); }
    addPiece(p) {
      const g = this.g; if (this.pieces.has(p.id) || !g.data.piece(p.type)) return;
      const m = g.art.piece(p.type, { level: 1 }); g.place(m, p.x, p.z, p.rot); const [w, d] = K.CastleArt.size(p.type);
      g.blockRect(p.x, p.z, g.walls.handles(p.type) ? w + 0.04 : w, d, p.rot, false);   // solid to you, whatever it is (their gate is theirs to open)
      this.pieces.set(p.id, { p, mesh: m, w, d });
    }
    removePiece(id) {
      const r = this.pieces.get(id); if (!r) return; this.g.group.remove(r.mesh); this.pieces.delete(id);
      const g = this.g, p = r.p; g.unblockRect(p.x, p.z, g.walls.handles(p.type) ? r.w + 0.04 : r.w, r.d, p.rot);
      for (const q of g.castle.pieces) if (Math.hypot(q.x - p.x, q.z - p.z) < 6) g.blockPiece(q);
      for (const o of this.pieces.values()) if (Math.hypot(o.p.x - p.x, o.p.z - p.z) < 6) g.blockRect(o.p.x, o.p.z, g.walls.handles(o.p.type) ? o.w + 0.04 : o.w, o.d, o.p.rot, false);
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
      const a = g.addActor({ id: 'pl:' + p.id, role: 'npc', spriteId: 'warden', name: p.name, x: p.x || 0, z: p.z || 0, hpMax: 100, atk: 0, def: 0, speed: 3, cd: 1, reach: 1, r: 0.4, scale: 1, level: 1, info: { xp: 0, loot: [] } });
      a.remote = true; a.hostile = false; a.view.setTint(TINTS[hash(p.id) % TINTS.length]);
      const rec = { a, tx: p.x || 0, tz: p.z || 0, ty: p.y || 0, f: p.f || 0, s: p.s || 'idle', name: p.name, el: document.createElement('div'), say: null, sayT: 0 };
      rec.el.className = 'plate'; rec.el.innerHTML = `<b>${esc(p.name)}</b><span></span>`; this.root.appendChild(rec.el);
      a.brain = { update: (dt) => this.step(rec, dt) }; this.by.set(p.id, rec); return rec;
    }
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
        r.el.style.display = front ? '' : 'none'; r.el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
        if (r.sayT > 0 && (r.sayT -= dt) <= 0) { r.el.classList.remove('talking'); r.el.querySelector('span').textContent = ''; }
      }
    }
    dispose() { this.clear(); this.root.remove(); }
  }

  class Multiplayer {
    constructor(game, net) {
      this.g = game; this.net = net; this.world = new RemoteWorld(game, net); this.avatars = new Avatars(game, net); this.t = 0; this.chat = null;
      net.on('join', (m) => { this.avatars.add(m.p); this.world.cottage(m.p.slot); game.cui.toast(`${m.p.name} joined.`); });
      net.on('leave', (m) => { const r = this.avatars.by.get(m.id); if (r) game.cui.toast(`${r.name} left.`); this.avatars.remove(m.id); });
      net.on('tick', (m) => this.avatars.ticks(m.p));
      net.on('op', (m) => this.world.apply(m.op, m.from));
      net.on('chat', (m) => { if (m.from === net.id) return; game.cui.toast(`${m.name}: ${m.text}`); this.avatars.say(m.from, m.text); });
      net.on('welcome', (m) => this.start(m));
      net.on('offline', () => game.cui.toast('Lost the connection. Reconnecting…'));
      this.start(net.welcome); this.makeChatBox();
    }
    start(w) { this.avatars.clear(); for (const p of w.players || []) this.avatars.add(p); this.world.snapshot(w); }
    /** tell the server what you already have on your plot (a game from before multiplayer, or one saved on this device) */
    uploadMine() {
      const g = this.g, tiles = [], d = g.play.doc, h0 = g.persist.h0, t0 = g.persist.t0;
      for (const p of g.castle.pieces) this.op({ k: 'piece+', id: this.pieceId(p), type: p.type, x: p.x, z: p.z, rot: p.rot || 0 });
      if (g.smithy) this.op({ k: 'bld+', id: 'smithy:' + this.net.id, spec: g.smithy });
      for (let k = 0; k < d.height.length; k++) if (d.height[k] !== h0[k] || d.terrain[k] !== t0[k]) { tiles.push([k % d.w, (k / d.w) | 0, d.height[k], d.terrain[k]]); if (tiles.length >= 400) { this.op({ k: 'tiles', list: tiles.splice(0) }); } }
      if (tiles.length) this.op({ k: 'tiles', list: tiles });
      for (const e of g.forest.nodes) if (!g.forest.live(e)) this.op({ k: 'node', id: e.id, st: 'felled' });
    }
    /** the game reports its own changes here */
    op(o) { this.net.op(o); }
    pieceId(p) { return this.net.id + ':' + p.uid; }
    update(dt) {
      this.t += dt; this.avatars.update(dt);
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
    dispose() { this.net.close(); this.avatars.dispose(); this.chat.remove(); }
  }

  Object.assign(K, { Identity, NameGate, Net, RemoteWorld, Avatars, Multiplayer });
})(typeof window !== 'undefined' ? window : globalThis);
