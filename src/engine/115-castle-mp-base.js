/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerBase {
    constructor(game, net) {
      this.g = game;
         this.net = net;
         this.world = new K.RemoteWorld(game, net);
         this.avatars = new K.Avatars(game, net);
         this.stores = new K.RemoteStores(game, net);
         this.mobs = new K.RemoteMobs(game, net);
         this.farms = new K.FarmSync(game, this);
         this.lastSave = -1e9;
         this.ver = net.welcome.ver || {};
         this.syncT = 8;
         this.mobT = 0;
         this.t = 0;
        this.chat = null;
      net.on('join', (m) => { this.avatars.add(m.p); game.cui.toast(`${m.p.name} joined.`); });
      net.on('house', (m) => this.onHouse(m));
         net.on('pvphit', (m) => this.onPvpHit(m));
        game.banners.on(() => { this.avatars.relook(); this.world.relabel(); });
      net.on('leave', (m) => { const r = this.avatars.by.get(m.id); if (r) game.cui.toast(`${r.name} left.`); this.avatars.remove(m.id); });
      net.on('resync', (m) => this.onResync(m));
        net.on('mobs', (m) => this.mobs.update(m.from, m.list || []));
      net.on('mobhurt', (m) => this.onMobHurt(m));
        net.on('leave', (m) => this.mobs.dropOwner(m.id));
      net.on('tick', (m) => this.avatars.ticks(m.p));
      net.on('op', (m) => this.onOp(m));
      net.on('farm', (m) => this.farms.updateOwner(m));
      net.on('gate', (m) => { this.world.gateState(m.id, m.open); this.mineGate(m.id, m.open); });
      net.on('door', (m) => this.onDoor(m));
        net.on('hp', (m) => this.onHp(m));
      net.on('locked', (m) => {
        const message = m.what === 'door'
          ? 'The door is locked. Only its owner and their team have the key.'
          : 'The gate is locked. Only its owner and their team have the key.';
        game.cui.toast(message);
      });
      net.on('teams', (m) => this.setTeams(m.list));
         net.on('invite', (m) => this.onInvite(m));
         net.on('invites', (m) => { this.invites = m.list || []; this.invitesChanged(); });
        net.on('declined', (m) => game.cui.toast(`${m.name} declined your invitation to ${m.teamName}.`));
      net.on('demand', (m) => this.onDemand(m));
         net.on('paid', (m) => this.onPaid(m));
        net.on('refused', (m) => game.cui.toast(`${m.name} refused to pay.`));
      net.on('fx', (m) => this.onFx(m));
         net.on('stores', (m) => this.onStores(m));
         net.on('store', (m) => this.onStore(m));
        net.on('stock', (m) => this.onStock(m));
      net.on('took', (m) => this.giveTaken(m.res, m.n));
        net.on('raided', (m) => game.cui.toast(`${m.by} raided your supplies (${m.n} ${K.CastleData.resName(m.res).toLowerCase()}).`));
      net.on('evicted', () => this.onEvicted());
        net.on('weather', (m) => game.weather && game.weather.setFromServer(m.weather));
      net.on('chat', (m) => { if (m.from === net.id) return; game.cui.toast(`${m.name}: ${m.text}`); this.avatars.say(m.from, m.text); });
      net.on('welcome', (m) => this.start(m));
      net.on('offline', () => game.cui.toast('Lost the connection. Reconnecting…'));
      this.teams = (net.welcome.teams || []);
         this.invites = (net.welcome.invites || []).slice();
         this.board = new K.InviteBoard(this);
         this.lastOpen = null;
         this.lastBroken = null;
        this.lastHit = 0;
      this.start(net.welcome, true);
         this.makeChatBox();
        this.board.render();
    }
    start(w, first) { if (w.clock) { this.net.clock = w.clock;
       this.net.offset = w.clock.now - Date.now();
       } if (this.g.weather && w.weather) this.g.weather.setFromServer(w.weather);
       if (!first) this.avatars.clear();
       for (const p of w.players || []) this.avatars.add(p);
       this.world.snapshot(w);
       this.farms.apply(w.world && w.world.farms);
       this.syncStores(w.stores || []);
       if (!this.g.resume) this.net.send({ t: 'save', data: null });
      }
    /** tell the server what you already have on your plot (a game from before multiplayer, or one saved on this device) */
    uploadMine() {
      const g = this.g, tiles = [], d = g.play.doc, h0 = g.persist.h0, t0 = g.persist.t0;
      if (g.home.built) this.announceHome();
      for (const p of g.castle.pieces) this.op({ k: 'piece+', id: this.pieceId(p), type: p.type, x: p.x, z: p.z, rot: p.rot || 0 });
      if (g.smithy) this.op({ k: 'bld+', id: 'smithy:' + this.net.id, spec: g.smithy });
      if (g.marketHall) this.op({ k: 'bld+', id: 'market:' + this.net.id, spec: g.marketHall });
      for (const [t, h] of Object.entries(g.halls || {})) this.op({ k: 'bld+', id: t + ':' + this.net.id, spec: h.spec });
      for (let k = 0; k < d.height.length; k++) if (d.height[k] !== h0[k] || d.terrain[k] !== t0[k]) { tiles.push([k % d.w,
         (k / d.w) | 0,
         d.height[k],
        d.terrain[k]]);
         if (tiles.length >= 400) { this.op({ k: 'tiles', list: tiles.splice(0) });
        } }
      if (tiles.length) this.op({ k: 'tiles', list: tiles });
      for (const e of g.forest.nodes) if (!g.forest.live(e)) this.op({ k: 'node', id: e.id, st: 'felled' });
      this.farms.publish();
    }
    /** [phase index, seconds into it, day number] from the server's clock */
    cycleState() { const c = this.net.clock,
       tot = c.day + c.night,
       el = Math.max(0,
       (this.net.now() - c.epoch) / 1000),
       n = Math.floor(el / tot) + 1,
      tin = el % tot;
       return tin < c.day ? [0, tin, n] : [1, tin - c.day, n];
      }
    /* ---------- your progress, kept on the server ---------- */
    saveRemote(snap, force) { const now = performance.now();
       if (!force && now - this.lastSave < 8000) return;
       this.lastSave = now;
       try { this.net.send({ t: 'save', data: JSON.stringify(snap) });
       } catch (e) { console.warn('could not send the save', e);
      } }
    /* ---------- pickups everyone sees ---------- */
    fx(o) { this.net.send({ t: 'fx', fx: o });
      }
    onFx(m) { const f = m.fx, e = this.g.tools.effects;
       if (f.k === 'pk+') e.pickups.spawn(f.kind, f.value, f.x, f.y, f.z, 1.2, !!f.exact, null, f.id);
       else if (f.k === 'pk-') e.pickups.drop(f.id);
      }
    /* ---------- supplies ---------- */
    op(o) { this.net.op(o);
      }
  }
  K.MultiplayerBase = MultiplayerBase;
})(typeof window !== 'undefined' ? window : globalThis);
