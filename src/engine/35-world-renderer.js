/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  /* Draws a WorldDoc. A thin root: it owns the scene and the shared render state that chunks, play mode and the
     castle game read (doc, chunks, mats, bank, lib, actors, lightSrc, propState…) and composes one collaborator per
     job: materials, lighting, atmosphere, the chunk grid, the dynamic props and the buildings. */
  class WorldRenderer {
    constructor(renderer) {
      this.renderer = renderer;
      this.scene = new THREE.Scene();
      this.painter = new K.GroundPainter(7);
      this.texPainter = new K.TexturePainter(7);
      this.bank = new K.TextureBank(renderer);
      this.lib = new K.CharacterLibrary();
      this.pool = new K.PaintPool();
      this.chunks = []; this.dyn = new Map(); this.lightSrc = []; this.anim = new Map(); this.fires = new Map();
      this.actors = new Map(); this.propState = new Map(); this.embers = null; this.spriteTex = {};
      this.target = new THREE.Vector3();
      this.materials = new K.WorldMaterials(this.texPainter, this.bank);
      this.mats = this.materials.mats;
      this.fireSheet = this.materials.fireSheet;
      this.fireTex = this.materials.fireTex;
      this.sparkUni = this.materials.sparkUni;
      this.lighting = new K.WorldLighting(this.scene);
      this.sun = this.lighting.sun;   // the castle day/night cycle and voxel shadows tune the sun directly
      this.atmosphere = new K.WorldAtmosphere(this.scene, this.bank);
      this.snow = this.atmosphere.snow;
      this.grid = new K.WorldChunks(this);
      this.dynamics = new K.WorldDynamics(this);
      // buildings: one BuildingSet for the whole world (meshes, interior lights, smoke, roof cut-away)
      this.bmats = new K.BuildingMaterials(this.bank);
      this.buildings = new K.BuildingSet({ mats: this.bmats, fireTex: this.fireTex, catalog: K.FURNITURE }).attach(this);
      this.buildingSig = null;
    }
    setDoc(doc) {
      this.grid.reset(doc);
      this.dynamics.removeAll();
      this.doc = doc;
      this.grid.build();
      this.atmosphere.buildFog(doc);
      this.objectsChanged(true);
      this.pumpPaint();
    }
    tilesChanged(i0, j0, i1, j1) { this.grid.tilesChanged(i0, j0, i1, j1); this.placeDynamics(); }
    // bridges change the ground for anything standing on them; just re-place all dynamics
    objectsChanged(force) { this.grid.objectsChanged(force); this.syncDynamics(); }
    syncBuildings(force) { return this.grid.syncBuildings(force); }
    chunkAt(i, j) { return this.grid.chunkAt(i, j); }
    anchorChunk(o) { return this.grid.anchorChunk(o); }
    work(budgetMs, sync) { return this.grid.work(budgetMs, sync); }
    pumpPaint() { this.grid.pumpPaint(); }
    finishAll() { this.grid.finishAll(); }
    ready(timeoutMs) { return this.grid.ready(timeoutMs); }
    setPropState(id, state) { this.grid.setPropState(id, state); }
    clearPropStates() { this.grid.clearPropStates(); }
    makeTopMaterial(tex, stex) { return this.materials.makeTopMaterial(tex, stex); }
    // placement goes through this.placeDynamics() so an instance-level hook (the castle game's lights) still runs
    syncDynamics() { this.dynamics.sync(); this.placeDynamics(); }
    placeDynamics() { this.dynamics.place(); }
    removeDyn(id) { this.dynamics.remove(id); }
    setStaticActorsVisible(visible) { this.dynamics.setActorsVisible(visible); }
    update(t, camera, viewH, target, dist, pitch = 0.7) {
      this.target.copy(target);
      this.buildings.frame(t, camera, viewH, this);
      this.dynamics.update(t, this.cameraYaw(camera), pitch, viewH);
      this.lighting.update(t, this.lightSrc, target, dist);
      this.sparkUni.uTime.value = t;
      this.atmosphere.update(t, viewH, target, dist);
    }
    cameraYaw(camera) {
      const d = new THREE.Vector3();
      camera.getWorldDirection(d);
      return Math.atan2(-d.x, -d.z);
    }
  }
  K.WorldRenderer = WorldRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
