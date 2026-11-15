/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · HomesteadSetup: sets the castle world up when castle mode starts. The scene group and ground occupancy,
   your hut and its keep entity, your saved pieces, the zone barriers, and the homestead extras from the save. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class HomesteadSetup {
    constructor(game) { this.g = game; }
    /** the castle's scene group, piece meshes and ground occupancy */
    buildScene() {
      const g = this.g;
      g.art = new K.CastleArt(g.R.bmats);
      g.group = new THREE.Group();
      g.group.name = 'castle';
      g.R.scene.add(g.group);
      g.floors = new K.PieceFloors(g);
      g.meshes = new Map();
      g.occ = new Uint8Array(g.play.nav.w * g.play.nav.h);
      g.gateTiles = new Set();
    }
    /** your hut: the fire, the furniture, the barrels, your pieces. No keep, ruins, outcrop or zone barriers. */
    build() {
      const g = this.g;
      g.walls = new K.WallDrawer(g);   // before any saved pieces come back: placing and blocking a piece asks it what it is
      g.smithy = null;
      g.marketHall = null;
      g.halls = {};
      g.forge = null;
      g.home = new K.Home(g);
      g.castle.extraHas = (t) => this.hasExtra(t);
      g.keepMesh = null;
      g.ruinEnts = {};
      g.outcropEnt = null;
      const keep = g.L.keep, door = g.home.doorPoint;
      g.keepEnt = { id: 'c-home', type: 'c_keep', name: 'Your home', x: keep.x, z: keep.z, y: 0, r: 0.1, h: 2, goal: [door.x, door.z] };
      if (!g.castle.lit) g.castle.light();
      for (const p of g.castle.pieces) g.addPieceMesh(p);
      g.zones.raiseClosed();
    }
    /** buildings that live outside K.Castle's pieces (the blacksmith, your cottage, the market, the halls) */
    hasExtra(t) {
      const g = this.g;
      return (t === 'blacksmith' && !!g.smithy) || (t === 'cottage' && g.home.built) || (t === 'market' && !!g.marketHall) || !!g.halls[t];
    }
    /** the homestead extras from the save (piles, chests, terrain...); a problem here never stops the game */
    restoreExtras() {
      const g = this.g;
      g.persist = new K.Persist(g);
      if (!g.saved || !g.saved.extras) return;
      try { g.persist.restore(g.saved.extras); } catch (err) { console.warn('could not restore the homestead', err); }
    }
  }

  K.HomesteadSetup = HomesteadSetup;
})(typeof window !== 'undefined' ? window : globalThis);
