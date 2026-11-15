/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Multiplayer: ties the running game to the realtime server. It owns the remote views of the world (RemoteWorld,
   Avatars, RemoteStores, RemoteMobs, FarmSync) and one handler per concern, each listening for its own messages:
     PresenceSync  joins, leaves, your position     WorldSync    shared land edits, resync, pickups, weather
     StoreSync     barrels and piles, raiding        MobSync      creatures each game runs
     DoorGateSync  doors, gates, keys, sieges        CombatSync   blows between players, eviction
     TeamSync      teams, keys and invitations       TributeSync  the player menu and tribute
     ChatSync      the chat line
   The rest of the game talks to `game.mp`; the one-line methods below pass each call to the handler that owns it. */
(function (G) {
  const K = G.K;

  class Multiplayer {
    constructor(game, net) {
      this.g = game;
      this.net = net;
      this.quiet = false;
      this.lastSave = -1e9;
      this.world = new K.RemoteWorld(game, net);
      this.avatars = new K.Avatars(game, net);
      this.stores = new K.RemoteStores(game, net);
      this.mobs = new K.RemoteMobs(game, net);
      this.farms = new K.FarmSync(game, this);
      this.presence = new K.PresenceSync(this);
      this.worldSync = new K.WorldSync(this);
      this.storeSync = new K.StoreSync(this);
      this.mobSync = new K.MobSync(this);
      this.doors = new K.DoorGateSync(this);
      this.combat = new K.CombatSync(this);
      this.teams = new K.TeamSync(this);
      this.tribute = new K.TributeSync(this);
      this.chat = new K.ChatSync(this);
      game.banners.on(() => this.relook());
      net.on('welcome', (m) => this.start(m, false));
      this.start(net.welcome, true);
      this.teams.board.render();
    }

    get me() {
      return this.net.id;
    }

    /** a (re)connection: take the server's clock, weather, players, land, farms and supplies */
    start(welcome, first) {
      if (welcome.clock) {
        this.net.clock = welcome.clock;
        this.net.offset = welcome.clock.now - Date.now();
      }
      this.worldSync.onWeather(welcome.weather);
      if (first) for (const player of welcome.players || []) this.avatars.add(player);
      else this.presence.reset(welcome.players);
      this.world.snapshot(welcome);
      this.farms.apply(welcome.world && welcome.world.farms);
      this.storeSync.syncStores(welcome.stores || []);
      if (!this.g.resume) this.net.send({ t: 'save', data: null });
    }

    relook() {
      this.avatars.relook();
      this.world.relabel();
    }

    update(dt) {
      this.avatars.update(dt);
      this.world.flush();
      this.stores.flush();
      this.farms.update(dt);
      this.worldSync.update(dt);
      this.mobSync.update(dt);
      this.doors.update(dt);
      this.presence.update(dt);
    }

    /** [phase index, seconds into it, day number] from the server's clock */
    cycleState() {
      const clock = this.net.clock;
      const total = clock.day + clock.night;
      const elapsed = Math.max(0, (this.net.now() - clock.epoch) / 1000);
      const day = Math.floor(elapsed / total) + 1;
      const into = elapsed % total;
      return into < clock.day ? [0, into, day] : [1, into - clock.day, day];
    }

    /** your progress, kept on the server (at most every 8 s unless forced) */
    saveRemote(snapshot, force) {
      const now = performance.now();
      if (!force && now - this.lastSave < 8000) return;
      this.lastSave = now;
      try {
        this.net.send({ t: 'save', data: JSON.stringify(snapshot) });
      } catch (e) {
        console.warn('could not send the save', e);
      }
    }

    op(o) {
      this.net.op(o);
    }

    pieceId(piece) {
      return this.net.id + ':' + piece.uid;
    }

    get invites() {
      return this.teams.invites;
    }

    get chatOpen() {
      return this.chat.isOpen;
    }

    uploadMine() { this.worldSync.uploadMine(); }
    announceHome() { this.worldSync.announceHome(); }
    fx(effect) { this.worldSync.fx(effect); }
    storeAdd(store) { this.storeSync.storeAdd(store); }
    storeGone(store) { this.storeSync.storeGone(store); }
    stockDelta(store, delta) { this.storeSync.stockDelta(store, delta); }
    takeFrom(id) { this.storeSync.takeFrom(id); }
    mobHit(target) { this.mobSync.mobHit(target); }
    mobBite(attacker, target) { this.mobSync.mobBite(attacker, target); }
    gate(piece, open) { this.doors.gate(piece, open); }
    requestGate(rec) { this.doors.requestGate(rec); }
    requestDoor(rec) { this.doors.requestDoor(rec); }
    hit(rec, door) { this.doors.hit(rec, door); }
    installDoor(rec) { this.doors.installDoor(rec); }
    keyFor(id) { return this.doors.keyFor(id); }
    slotOf(id) { return this.doors.slotOf(id); }
    setRespawn(slot, x, z) { this.doors.setRespawn(slot, x, z); }
    pvp(target) { this.combat.pvp(target); }
    teamRoster() { return this.teams.teamRoster(); }
    teamId(id) { return this.teams.teamId(id); }
    mayUse(owner) { return this.teams.mayUse(owner); }
    acceptInvite(team) { this.teams.acceptInvite(team); }
    declineInvite(team) { this.teams.declineInvite(team); }
    playerMenu(actor) { this.tribute.playerMenu(actor); }
    key(event) { return this.chat.key(event); }

    dispose() {
      this.net.close();
      this.avatars.dispose();
      this.mobs.dispose();
      this.farms.dispose();
      this.chat.dispose();
      this.teams.dispose();
    }
  }

  K.Multiplayer = Multiplayer;
})(typeof window !== 'undefined' ? window : globalThis);
