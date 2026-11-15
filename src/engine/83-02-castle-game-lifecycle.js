/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameLifecycle extends K.CastleGameCore {
    enter() {
      const play = this.play, R = this.R;
      document.body.classList.add('castle');
      this.art = new CastleArt(R.bmats);
        this.group = new THREE.Group();
        this.group.name = 'castle';
        R.scene.add(this.group);
      this.floors = new K.PieceFloors(this);
      this.meshes = new Map();
        this.tracers = [];
        this.shakeT = 0;
        this.flareT = 0;
        this.nightK = this.day.isNight ? 1 : 0;
      this.lastCl = this.castle.cl();
        this.saveT = 0;
        this.prevBook = null;
      this.occ = new Uint8Array(play.nav.w * play.nav.h);
        this.gateTiles = new Set();
      // spawn by the Keep's door
      play.spawn = { x: this.L.start.x, z: this.L.start.z };
      { const rs = (this.net && this.net.welcome.respawn) || (this.saved && this.saved.extras && this.saved.extras.respawn);
      // you always wake where you last slept
        if (rs) { play.spawn = { x: rs.x, z: rs.z };
          this.respawn = rs;
          }
        play.me.x = play.spawn.x;
          play.me.z = play.spawn.z;
          play.me.y = play.nav.y(play.spawn.x, play.spawn.z);
        play.me.layer = 'ground';
          play.me.leg = null;
          }
      // your hut: the fire, the furniture, the barrels. No keep, ruins, outcrop or zone barriers.
      this.walls = new K.WallDrawer(this);
        // before any saved pieces come back: placing and blocking a piece asks it what it is
      this.gateTiles = new Set();
        this.smithy = null;
        this.marketHall = null;
        this.halls = {};
        this.forge = null;
        this.home = new K.Home(this);
      this.castle.extraHas = (t) => (
        (t === 'blacksmith' && !!this.smithy) || (t === 'cottage' && this.home.built) ||
        (t === 'market' && !!this.marketHall) || !!this.halls[t]
      );
      this.keepMesh = null;
        this.ruinEnts = {};
        this.outcropEnt = null;
      this.keepEnt = { id: 'c-home', type: 'c_keep', name: 'Your home', x: this.L.keep.x, z: this.L.keep.z, y: 0, r: 0.1, h: 2,
      goal: [this.home.doorPoint.x, this.home.doorPoint.z] };
      if (!this.castle.lit) this.castle.light();
      for (const p of this.castle.pieces) this.addPieceMesh(p);
      this.barriers = {};
      for (const [z, b] of Object.entries(this.L.barriers)) if (!this.castle.zoneOpen(z)) this.addBarrier(z, b);
      // glow, light, arrow
      this.glowMesh = this.art.glow();
        this.group.add(this.glowMesh);
        this.glowR = this.castle.glowRadius();
      this.arrow = this.art.arrow();
        this.group.add(this.arrow);
        this.ring = null;
      const pd = R.placeDynamics.bind(R);
        this.origPlace = pd;
        R.placeDynamics = () => { pd();
        this.pushLights();
        };
        R.placeDynamics();
      this.hemi = R.scene.children.find((o) => o.isHemisphereLight);
        this.base = { sun: R.sun.intensity, hemi: this.hemi ? this.hemi.intensity : 1,
      bg: R.scene.background.clone(), fog: R.scene.fog.color.clone() };
      // thawed ground already earned (resume): melt it at once
      if (this.castle.lit) this.meltTo(this.castle.glowRadius(), 0);
      if (this.castle.hearthCap >= 5) this.thawAll(0);
      this.kinActors = {};
        this.troll = null;
      this.restoreNodes();
      this.raid = null;
      this.cui = new K.CastleUI(this);
        this.vitals = new K.Vitals(this);
        this.wild = new K.Wild(this);
        this.calendar.on((ev) => this.onCalendar(ev));
      this.tools = new K.CastleTools(this);
        this.minimap = new K.Minimap(this);
        this.xp = this.xp || new K.Experience(this);
      this.weather = new K.Weather(this);
        this.towers = new K.Towers(this);
        this.economy = new K.Economy(this);
        this.workers = new K.Workers(this);
      this.wildGame = new K.WildGame(this);
        this.banners = new K.BannerBook(this, this.net);
        this.flags = new K.Flags(this);
      this.banners.on(() => this.applyLook());
        this.applyLook();
        this.forest = new K.Forest(this);
        this.brush = new K.GroundBrush(this);
      this.steer = new K.PieceSteer(this);
        this.purse = new K.Purse(this);
        this.stash = new K.Stash(this);
        this.site = new K.BuildingSite(this);
      this.sweep = new K.SweepAttack(this);
        this.demolisher = new K.Demolisher(this);
        this.play.refreshProps();
      this.buildingPanel = new K.BuildingPanel(this);
        // the details panel a click on a building opens (122-castle-inspector.js)
      this.ramparts = new K.Ramparts(this);
        // the walk along your stone walls, towers and gate (127-castle-ramparts.js)
      if (this.day.isNight) this.startRaid();
      play.app.rig.set({ dist: 11, pitch: 0.78 });
        play.app.rig.maxDist = 44;
        // you can never zoom out far enough to see the edge of the world
      this.persist = new K.Persist(this);
        if (this.saved && this.saved.extras) { try { this.persist.restore(this.saved.extras);
      } catch (err) { console.warn('could not restore the homestead', err);
        } }
      if (this.net) { try { this.mp = new K.Multiplayer(this, this.net);
        this.calendar.sync = () => this.mp.cycleState();
        this.mp.uploadMine();
      } catch (err) { console.warn('multiplayer failed to start; playing alone', err);
        this.mp = null;
      } }   // after your own save is back, so the shared world wins
      this.gatekeepers = new K.GateKeeper(this);
        this.gatekeepers.refresh();
      const arrival = this.saved ? 'Welcome back.' : [
        'You arrive with wood, stone and bread.',
        'Build your cottage first: hammer (5), then Buildings. Wolves hunt at night. Press E to eat.'
      ].join(' ');
      this.cui.toast(arrival);
      G.castle = this;
        // test hook (and the console's best friend)
    }
    exit() {
      if (this.entitySources) for (const id of this.entitySources.keys()) this.removeEntitySource(id);
      this.play.app.rig.maxDist = null;
        if (this.minimap) this.minimap.dispose();
        if (this.vitals) this.vitals.dispose();
        if (this.home) this.home.dispose();
      this.save();
        if (this.tools) this.tools.dispose();
        if (this.sweep) this.sweep.dispose();
        if (this.demolisher) this.demolisher.dispose();
      if (this.site) this.site.dispose();
        if (this.brush) this.brush.dispose();
        if (this.mp) this.mp.dispose();
      if (this.weather) this.weather.dispose();
        if (this.towers) this.towers.dispose();
        if (this.economy) this.economy.dispose();
      if (this.workers) this.workers.dispose();
        if (this.wildGame) this.wildGame.dispose();
        if (this.flags) this.flags.dispose();
      if (this.purse) this.purse.dispose();
        if (this.buildingPanel) this.buildingPanel.dispose();
      if (this.origPlace) this.R.placeDynamics = this.origPlace;
      this.R.scene.remove(this.group);
        this.cui && this.cui.dispose();
        document.body.classList.remove('castle');
    }
  }
  K.CastleGameLifecycle = CastleGameLifecycle;
})(typeof window !== 'undefined' ? window : globalThis);
