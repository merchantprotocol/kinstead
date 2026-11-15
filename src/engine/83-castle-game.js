/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CastleGame: castle mode, layered on PlayMode (play.ext). This is the composition root: it owns the shared
   world state (the castle, the day, the scene group, piece meshes, ground occupancy) and wires the collaborators that do
   the work, each in its own file: PieceManager, PlacementRules, CastleBuilder, ActionMenu, RaidDirector, KinDirector,
   CombatRules, HearthGlow, CastleInput, CastleSaveGame and the rest. Other modules call the one-line delegations below.
   Rules live in K.Castle / K.DayCycle. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class CastleGame {
    static WELCOME = 'You arrive with wood, stone and bread. Build your cottage first: hammer (5), then Buildings. Wolves hunt at night. Press E to eat.';

    /* play: K.PlayMode; opts: { storage, resume, layout, net } */
    constructor(play, opts = {}) {
      this.play = play;
      this.data = new K.CastleData(K.CASTLE_DATA);
      this.L = opts.layout || new K.HutLayout();
      this.net = opts.net || null;
      this.survival = true;
      this.noRegen = true;
      this.noXp = true;
      this.sound = new K.CastleSound();
      this.castle = new K.Castle(this.data);
      this.day = new K.DayCycle(this.data);
      this.calendar = new K.Calendar(this);
      this.playTime = 0;
      this.saveGame = new K.CastleSaveGame(this, opts);
      if (this.saved) this.saveGame.restoreWorld();
      else this.saveGame.startFresh();
      this.day.phases = K.Calendar.PHASES;   // looping day and night
      this.swingSec = this.data.swingSec;
      this.compose();
    }
    /** the collaborators: each owns one responsibility and reaches shared state through this root */
    compose() {
      this.ground = new K.GroundOccupancy(this);
      this.pieceSet = new K.PieceManager(this);
      this.placement = new K.PlacementRules(this);
      this.builder = new K.CastleBuilder(this);
      this.menu = new K.ActionMenu(this);
      this.inspector = new K.InspectCard(this);
      this.gatherer = new K.Gatherer(this);
      this.combat = new K.CombatRules(this);
      this.actors = new K.CastleActors(this);
      this.kinDirector = new K.KinDirector(this);
      this.trollFight = new K.TrollFight(this);
      this.raids = new K.RaidDirector(this);
      this.structures = new K.StructureDamage(this);
      this.zones = new K.ZoneBarriers(this);
      this.dayEvents = new K.DayEvents(this);
      this.thaw = new K.ThawEffects(this);
      this.fx = new K.SceneFx(this);
      this.hearth = new K.HearthGlow(this);
      this.occlusion = new K.Occlusion(this);
      this.goalArrow = new K.GoalArrow(this);
      this.production = new K.ProductionTicker(this);
      this.input = new K.CastleInput(this);
      this.entityDir = new K.EntityDirectory(this);
      this.hero = new K.HeroOutfitter(this);
      this.relations = new K.PlayerRelations(this);
      this.homestead = new K.HomesteadSetup(this);
    }
    get app() { return this.play.app; }
    get R() { return this.play.R; }
    get ui() { return this.cui; }
    get saved() { return this.saveGame.saved; }
    get resume() { return this.saveGame.resume; }
    get raid() { return this.raids.raid; }
    get kinActors() { return this.kinDirector.actors; }
    get troll() { return this.trollFight.troll; }
    get shakeT() { return this.fx.shakeT; }
    set shakeT(v) { this.fx.shakeT = v; }   // the tools shake the camera by writing this directly
    /** true once enter() has finished (events can arrive before that, or after it failed) */
    get ready() { return !!(this.cui && this.tools && this.brush && this.hearth.glowMesh); }

    /* ---------- enter / exit ---------- */
    enter() {
      document.body.classList.add('castle');
      this.homestead.buildScene();
      this.hero.placeAtSpawn();
      this.homestead.build();
      this.hearth.attach();
      this.goalArrow.attach();
      if (this.castle.lit) this.thaw.meltTo(this.castle.glowRadius(), 0);   // thawed ground already earned (resume): melt it at once
      if (this.castle.hearthCap >= 5) this.thaw.thawAll(0);
      this.kinDirector.reset();
      this.trollFight.reset();
      this.raids.reset();
      this.restoreNodes();
      this.startSystems();
      if (this.day.isNight) this.startRaid();
      this.play.app.rig.set({ dist: 11, pitch: 0.78 });
      this.play.app.rig.maxDist = 44;   // you can never zoom out far enough to see the edge of the world
      this.homestead.restoreExtras();
      this.joinServer();
      this.gatekeepers = new K.GateKeeper(this);
      this.gatekeepers.refresh();
      this.cui.toast(this.saved ? 'Welcome back.' : CastleGame.WELCOME);
      G.castle = this;   // test hook (and the console's best friend)
    }
    /** the game's modules that need the scene (each in its own file) */
    startSystems() {
      this.cui = new K.CastleUI(this);
      this.vitals = new K.Vitals(this);
      this.wild = new K.Wild(this);
      this.calendar.on((ev) => this.dayEvents.onCalendar(ev));
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
      this.buildingPanel = new K.BuildingPanel(this);   // the details panel a click on a building opens (122-castle-inspector.js)
      this.ramparts = new K.Ramparts(this);   // the walk along your stone walls, towers and gate (127-castle-ramparts.js)
    }
    /** after your own save is back, so the shared world wins */
    joinServer() {
      if (!this.net) return;
      try {
        this.mp = new K.Multiplayer(this, this.net);
        this.calendar.sync = () => this.mp.cycleState();
        this.mp.uploadMine();
      } catch (err) {
        console.warn('multiplayer failed to start; playing alone', err);
        this.mp = null;
      }
    }
    exit() {
      this.entityDir.disposeAll();
      this.play.app.rig.maxDist = null;
      for (const s of [this.minimap, this.vitals, this.home]) if (s) s.dispose();
      this.save();
      for (const s of this.disposables()) if (s) s.dispose();
      this.hearth.detach();
      this.R.scene.remove(this.group);
      if (this.cui) this.cui.dispose();
      document.body.classList.remove('castle');
    }
    disposables() {
      return [this.tools, this.sweep, this.demolisher, this.site, this.brush, this.mp, this.weather, this.towers, this.economy, this.workers,
        this.wildGame, this.flags, this.purse, this.buildingPanel];
    }

    /* ---------- per frame ---------- */
    update(dt) {
      if (!this.ready) return;
      this.playTime += dt;
      this.production.update(dt);
      this.calendar.update(dt);   // day and night loop forever
      this.raids.update(dt);
      this.hearth.update(dt);
      this.kinDirector.check(dt);
      this.fx.update(dt);
      for (const s of this.worldSystems()) s.update(dt);
      for (const p of this.castle.pieces) if (p.bridge) p.bridge.update(dt);
      for (const s of this.heroSystems()) s.update(dt);
      this.occlusion.update(dt);
      this.thaw.update(dt);
      this.dayEvents.update(dt);
      if (this.dirty) this.refresh();
      this.cui.frame(dt);
      this.autosave(dt);
    }
    worldSystems() {
      return [this.goalArrow, this.minimap, this.weather, this.flags, this.towers, this.gatekeepers, this.economy, this.workers, this.wildGame,
        this.forest, this.mp].filter(Boolean);
    }
    heroSystems() { return [this.tools, this.sweep, this.home, this.vitals, this.wild, this.ramparts]; }
    /** something changed: the HUD, the props, the Hearthbook and the weapon in hand catch up */
    refresh() {
      this.dirty = false;
      this.cui.render();
      this.play.refreshProps();
      this.dayEvents.checkBook();
      this.equipBest(this.play.player);
    }
    autosave(dt) {
      this.saveT = (this.saveT || 0) + dt;
      if (this.saveT <= 10) return;
      this.saveT = 0;
      this.save();
    }
    changed() { this.dirty = true; }

    /* ---------- delegations: the hero (HeroOutfitter, PlayerRelations) ---------- */
    makePlayer() { return this.hero.makePlayer(); }
    equipBest(p) { this.hero.equipBest(p); }
    applyLook() { this.hero.applyLook(); }
    setRespawn(buildingId, x, z) { this.hero.setRespawn(buildingId, x, z); }
    keyFor(id) { return this.relations.keyFor(id); }
    pvpHit(a, b) { this.relations.pvpHit(a, b); }
    playerMenu(e) { this.relations.playerMenu(e); }

    /* ---------- delegations: ground and pieces (GroundOccupancy, PieceManager, PlacementRules) ---------- */
    rectTiles(x, z, w, d, rot, fn) { this.ground.rectTiles(x, z, w, d, rot, fn); }
    blockRect(x, z, w, d, rot, gate) { this.ground.blockRect(x, z, w, d, rot, gate); }
    unblockRect(x, z, w, d, rot) { this.ground.unblockRect(x, z, w, d, rot); }
    insideBuilding(x, z) { return this.ground.insideBuilding(x, z); }
    isSanctuary(x, z) { return this.ground.isSanctuary(x, z); }
    pieceEnt(p) { return this.pieceSet.pieceEnt(p); }
    pieceRadius(p) { return this.pieceSet.pieceRadius(p); }
    addPieceMesh(p) { return this.pieceSet.addPieceMesh(p); }
    blockPiece(p) { this.pieceSet.blockPiece(p); }
    pieceAt(x, z, pad) { return this.pieceSet.pieceAt(x, z, pad); }
    demolishPiece(p, opts) { return this.pieceSet.demolishPiece(p, opts); }
    redrawPiece(p) { return this.pieceSet.redrawPiece(p); }
    redrawKeep() { this.pieceSet.redrawKeep(); }
    setFrost(p, on) { this.pieceSet.setFrost(p, on); }
    placementOk(type, x, z, rot) { return this.placement.placementOk(type, x, z, rot); }
    autoRot(x, z) { return this.placement.autoRot(x, z); }
    dirtOk(x, z) { return this.placement.dirtOk(x, z); }
    gateSpot(p) { return this.placement.gateSpot(p); }

    /* ---------- delegations: building and gathering (CastleBuilder, Gatherer) ---------- */
    buildAt(type, x, z, rot, quiet) { return this.builder.buildAt(type, x, z, rot, quiet); }
    placeDirt(x, z, quiet) { return this.builder.placeDirt(x, z, quiet); }
    addFreePiece(type, x, z, rot) { return this.builder.addFreePiece(type, x, z, rot); }
    repair(type) { this.builder.repair(type); }
    buildAtSite() { this.builder.buildAtSite(); }
    upgrade(p) { this.builder.upgrade(p); }
    craft(rid) { this.builder.craft(rid); }
    lightKeep() { this.builder.lightKeep(); }
    bindHeart() { this.builder.bindHeart(); }
    nodeSpec(e) { return this.gatherer.nodeSpec(e); }
    gather(e) { this.gatherer.gather(e); }
    restoreNodes() { this.gatherer.restoreNodes(this.saved); }

    /* ---------- delegations: entities (EntityDirectory, ActionMenu, InspectCard, CastleActors) ---------- */
    entities() { return this.entityDir.entities(); }
    addEntitySource(source) { return this.entityDir.add(source); }
    removeEntitySource(id) { return this.entityDir.remove(id); }
    actionsFor(e) { return this.menu.actionsFor(e); }
    inspect(e) { return this.inspector.inspect(e); }
    addActor(cfg) { return this.actors.add(cfg); }
    removeActor(a) { this.actors.remove(a); }

    /* ---------- delegations: fighting (CombatRules, StructureDamage, KinDirector, TrollFight) ---------- */
    damage(a, b) { return this.combat.damage(a, b); }
    onHit(a, b) { this.combat.onHit(a, b); }
    onHurt(a) { this.combat.onHurt(a); }
    onKill(a) { this.combat.onKill(a); }
    wakeSec() { return this.combat.wakeSec(); }
    nearestEnemy(a, range) { return this.combat.nearestEnemy(a, range); }
    nearestAlly(a, range) { return this.combat.nearestAlly(a, range); }
    towerFor(a) { return this.combat.towerFor(a); }
    hurtAlly(k, n) { this.combat.hurtAlly(k, n); }
    hurtEnemy(a, n, src, show) { this.combat.hurtEnemy(a, n, src, show); }
    pieceHpMax(p) { return this.structures.pieceHpMax(p); }
    blockingPiece(x, z, r) { return this.structures.blockingPiece(x, z, r); }
    hurtStructure(s, n) { this.structures.hurtStructure(s, n); }
    hurtPiece(p, n) { this.structures.hurtPiece(p, n); }
    hurtKeep(n) { this.structures.hurtKeep(n); }
    onFrosted(p) { this.structures.onFrosted(p); }
    kinStats(id) { return this.kinDirector.stats(id); }
    touchEmberwright() { this.kinDirector.touchEmberwright(); }
    slamStart(s) { this.trollFight.slamStart(s); }
    slamRing(s, k) { this.trollFight.slamRing(s, k); }
    slamHit(s, dmg) { this.trollFight.slamHit(s, dmg); }

    /* ---------- delegations: night and day (RaidDirector, ZoneBarriers, DayEvents, ThawEffects) ---------- */
    keepGoal() { return this.raids.keepGoal(); }
    isNightish() { return this.raids.isNightish(); }
    startRaid() { this.raids.start(); }
    endNight(lost, ev) { this.raids.endNight(lost, ev); }
    openBarrier(zone) { this.zones.open(zone); }
    ringBell() { this.dayEvents.ringBell(); }
    ending() { this.dayEvents.ending(); }
    meltTo(r, dur) { this.thaw.meltTo(r, dur); }

    /* ---------- delegations: scene touches (SceneFx, Occlusion) ---------- */
    place(obj, x, z, rot) { return this.fx.place(obj, x, z, rot); }
    pop(obj, s0) { this.fx.pop(obj, s0); }
    puff(x, z) { this.fx.puff(x, z); }
    shake(s) { this.fx.shake(s); }
    tracer(a, b, color) { this.fx.tracer(a, b, color); }
    setFaded(m, on) { this.occlusion.setFaded(m, on); }

    /* ---------- delegations: input (CastleInput) ---------- */
    click(sx, sy) { return this.input.click(sx, sy); }
    pointerMove(sx, sy) { return this.input.pointerMove(sx, sy); }
    rightClick(sx, sy) { return this.input.rightClick(sx, sy); }
    pointerDown(sx, sy) { return this.input.pointerDown(sx, sy); }
    pointerDrag(sx, sy) { this.input.pointerDrag(sx, sy); }
    pointerUp(sx, sy) { this.input.pointerUp(sx, sy); }
    key(e) { return this.input.key(e); }
    pickHeight(e) { return this.input.pickHeight(e); }
    pickable(e) { return this.input.pickable(e); }

    /* ---------- delegations: the save (CastleSaveGame) ---------- */
    snapshot() { return this.saveGame.snapshot(); }
    save(force) { return this.saveGame.save(force); }

    /* ---------- test / demo hooks ---------- */
    debugSkip(sec) { this.day.t = Math.min(this.day.t + sec, (this.day.length() || 1e9) - 0.01); }
    debugGive(o) {
      for (const [r, n] of Object.entries(o)) this.castle.add(r, n);
      this.changed();
    }
  }

  K.CastleGame = CastleGame;
})(typeof window !== 'undefined' ? window : globalThis);
