/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the stone gate: a stone archway with a big timber drawbridge.
   Raised, the bridge is the door: nothing walks through, and a bear will batter it (very strong, but it falls in
   the end). Click the gate to lower it: the bridge lays forward over whatever is in front of the gate, a deep
   pit included, and you can come and go. It raises itself again once you walk away.
   A pit three blocks deep in front of the gate keeps a bear off the bridge entirely.
     Drawbridge   one gate's moving bridge, its tiles, and its state (open or raised) */
(function (G) {
  const K = G.K, THREE = G.THREE, TILE = K.TILE;
  const ARCH = [4, 1.5], BRIDGE = [3, 2.6], HINGE = 0.75, UP = -Math.PI / 2 + 0.04, DOWN = 0;
  const AUTO_CLOSE_DIST = 7.5;

  class Drawbridge {
    constructor(game, piece) {
      this.g = game; this.p = piece; this.open = false; this.t = 0; this.angle = UP; this.away = 0; this.saved = null;
      const k = new K.VoxKit(), L = BRIDGE[1], W = BRIDGE[0];
      k.box('planks', 0, 0, L / 2, W, 0.12, L); for (const z of [0.25, 0.9, 1.55, 2.3]) k.box('timber', 0, 0.12, z, W + 0.04, 0.05, 0.14);
      for (const s of [-1, 1]) k.box('timber', s * (W / 2), 0, L / 2, 0.1, 0.22, L);
      for (const z of [0.4, 1.3, 2.2]) { k.box('iron', 0, -0.02, z, W, 0.02, 0.07); k.box('iron', 0, 0.17, z, W + 0.02, 0.02, 0.07); }   // iron bands, both faces
      for (const s of [-1, 1]) k.box('iron', s * 0.9, 0.12, L - 0.05, 0.12, 0.06, 0.14);
      this.mesh = new THREE.Group(); for (const m of k.meshes(game.R.bmats)) this.mesh.add(m);
      const c = Math.cos(piece.rot), s = Math.sin(piece.rot); this.mesh.position.set(piece.x + HINGE * s, game.play.nav.y(piece.x, piece.z) + 0.02, piece.z + HINGE * c); this.mesh.rotation.order = 'YXZ'; this.mesh.rotation.y = piece.rot; this.mesh.rotation.x = this.angle;
      game.group.add(this.mesh);
    }
    get nav() { return this.g.play.nav; }
    archTiles(fn) { const p = this.p; this.g.rectTiles(p.x, p.z, ARCH[0], ARCH[1], p.rot, fn); }
    /** the ground in front of the gate that the lowered bridge lies over */
    bridgeTiles(fn) { const p = this.p, c = Math.cos(p.rot), s = Math.sin(p.rot), d = HINGE + BRIDGE[1] / 2; this.g.rectTiles(p.x + d * s, p.z + d * c, BRIDGE[0], BRIDGE[1], p.rot, fn); }
    /** write the gate's state into the world's tiles (safe to call again at any time) */
    apply() {
      const g = this.g, nav = this.nav, w = nav.w;
      this.archTiles((i, j) => { const k = j * w + i; g.occ[k] = 1; nav.walk[k] = this.open ? 1 : 0; if (this.open) g.gateTiles.delete(i + ',' + j); else g.gateTiles.add(i + ',' + j); });
      if (this.open) {
        if (!this.saved) { this.saved = []; const floor = nav.y(this.p.x, this.p.z); this.bridgeTiles((i, j) => { const k = j * w + i; this.saved.push([k, nav.walk[k], nav.S[k], nav.deck[k]]); nav.walk[k] = 1; nav.S[k] = floor; nav.deck[k] = 1; }); }
      } else this.restore();
    }
    restore() { if (!this.saved) return; const nav = this.nav; for (const [k, wk, S, dk] of this.saved) { nav.walk[k] = wk; nav.S[k] = S; nav.deck[k] = dk; } this.saved = null; }
    /** someone is standing on the gate or its bridge */
    occupied() {
      let busy = false; const nav = this.nav, chk = (i, j) => { for (const a of this.g.play.actors) if ((a.alive || a === this.g.play.me) && nav.tile(a.x, a.z).join() === i + ',' + j) busy = true; };
      this.archTiles(chk); this.bridgeTiles(chk); return busy;
    }
    toggle() {
      const g = this.g;
      if (this.open) { if (this.occupied()) { g.cui.toast('Something is on the bridge.'); return; } this.open = false; g.sound.play('thunk'); g.cui.toast('Drawbridge raised.'); }
      else { this.open = true; this.away = 0; g.sound.play('whump'); g.cui.toast('Drawbridge lowered.'); }
      this.apply(); if (g.mp && !this.remote) g.mp.gate(this.p, this.open);
    }
    update(dt) {
      const target = this.open ? DOWN : UP; this.angle += (target - this.angle) * Math.min(1, dt * 3.2); this.mesh.rotation.x = this.angle;
      if (this.open && !this.remote) {
        const me = this.g.play.me, d = Math.hypot(me.x - this.p.x, me.z - this.p.z);
        this.away = d > AUTO_CLOSE_DIST ? this.away + dt : 0;
        if (this.away > 2 && !this.occupied()) { this.open = false; this.apply(); this.g.cui.toast('The drawbridge raises itself.'); if (this.g.mp && !this.remote) this.g.mp.gate(this.p, false); }   // never left open when you walk away
      }
    }
    dispose() { this.g.group.remove(this.mesh); this.restore(); this.archTiles((i, j) => this.g.gateTiles.delete(i + ',' + j)); }
  }

  /** The wooden gate: two planked leaves on the end posts. Shut, nobody walks through (you click it to open); open, anyone can.
      It shuts itself again once you walk away. Same API as Drawbridge so the game treats them alike. */
  class WoodGate {
    constructor(game, piece) {
      this.g = game; this.p = piece; this.open = false; this.angle = 0; this.away = 0;
      this.mesh = new THREE.Group(); this.leaves = [];
      for (const s of [-1, 1]) {
        const k = new K.VoxKit(); k.box('planks', -s * 0.5, 0.02, 0, 0.8, 0.98, 0.12); k.box('timber', -s * 0.5, 0.22, 0.07, 0.8, 0.09, 0.04); k.box('timber', -s * 0.5, 0.7, 0.07, 0.8, 0.09, 0.04); k.box('iron', -s * 0.9, 0.45, 0.08, 0.06, 0.12, 0.04);
        const leaf = new THREE.Group(); for (const m of k.meshes(game.R.bmats)) leaf.add(m); leaf.position.set(s * 0.9, 0, 0); this.mesh.add(leaf); this.leaves.push([s, leaf]);   // hinged on the end posts
      }
      this.mesh.position.set(piece.x, game.play.nav.y(piece.x, piece.z), piece.z); this.mesh.rotation.y = piece.rot; game.group.add(this.mesh);
    }
    get nav() { return this.g.play.nav; }
    tiles(fn) { const p = this.p; this.g.rectTiles(p.x, p.z, 2, 0.5, p.rot, fn); }
    apply() {
      const g = this.g, nav = this.nav, w = nav.w;
      this.tiles((i, j) => { const k = j * w + i; g.occ[k] = 1; nav.walk[k] = this.open ? 1 : 0; if (this.open) g.gateTiles.delete(i + ',' + j); else g.gateTiles.add(i + ',' + j); });
    }
    occupied() { let busy = false; const nav = this.nav; this.tiles((i, j) => { for (const a of this.g.play.actors) if ((a.alive || a === this.g.play.me) && nav.tile(a.x, a.z).join() === i + ',' + j) busy = true; }); return busy; }
    toggle() {
      const g = this.g;
      if (this.open) { if (this.occupied()) { g.cui.toast('Something is in the gateway.'); return; } this.open = false; g.sound.play('thunk'); g.cui.toast('Gate shut.'); }
      else { this.open = true; this.away = 0; g.sound.play('clank'); g.cui.toast('Gate open.'); }
      this.apply(); if (g.mp && !this.remote) g.mp.gate(this.p, this.open);
    }
    update(dt) {
      const target = this.open ? 1.5 : 0; this.angle += (target - this.angle) * Math.min(1, dt * 7);
      for (const [s, leaf] of this.leaves) leaf.rotation.y = s * this.angle;
      if (this.open && !this.remote) { const me = this.g.play.me, d = Math.hypot(me.x - this.p.x, me.z - this.p.z); this.away = d > AUTO_CLOSE_DIST ? this.away + dt : 0; if (this.away > 2 && !this.occupied()) { this.open = false; this.apply(); this.g.cui.toast('The gate swings shut.'); if (this.g.mp && !this.remote) this.g.mp.gate(this.p, false); } }
    }
    dispose() { this.g.group.remove(this.mesh); this.tiles((i, j) => this.g.gateTiles.delete(i + ',' + j)); }
  }

  K.WoodGate = WoodGate; K.Drawbridge = Drawbridge; K.STONE_GATE_SIZE = ARCH;
})(typeof window !== 'undefined' ? window : globalThis);
