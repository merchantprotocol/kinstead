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
      // bright timber deck: long boards in two tones, dark cross beams on top. Raised, the underside (local -y) faces
      // outwards, so that face carries the heavy iron bands, a cross strap and rows of studs.
      for (let i = 0; i < 10; i++) k.box(i % 2 ? 'woodMid' : 'woodLight', -W / 2 + 0.15 + i * 0.3, 0, L / 2, 0.29, 0.12, L);
      for (const z of [0.25, 0.9, 1.55, 2.3]) k.box('woodDark', 0, 0.12, z, W + 0.04, 0.05, 0.14);
      for (const s of [-1, 1]) k.box('woodDark', s * (W / 2), 0, L / 2, 0.1, 0.22, L);
      for (const z of [0.4, 1.3, 2.2]) {   // iron bands, both faces, studded on the outside
        k.box('ironDark', 0, -0.02, z, W, 0.02, 0.1); k.box('ironDark', 0, 0.17, z, W + 0.02, 0.02, 0.07);
        for (let i = 0; i < 8; i++) k.box('steel', -1.33 + i * 0.38, -0.035, z, 0.04, 0.015, 0.04);
      }
      for (const s of [-1, 1]) { const a = Math.atan2(L - 0.4, W - 0.3); k.box('ironDark', 0, -0.03, L / 2, Math.hypot(W - 0.3, L - 0.4), 0.02, 0.08, s * a); }   // the cross strap
      k.box('paintRed', 0, -0.025, 0.06, W - 0.1, 0.012, 0.1);                       // red-painted lip along the hinge edge
      for (const s of [-1, 1]) { k.box('ironDark', s * 0.9, 0.12, L - 0.05, 0.12, 0.06, 0.14); k.box('ironDark', s * 0.9, -0.08, L - 0.12, 0.1, 0.06, 0.1); }   // chain lugs
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
      const pass = this.open || this.localOpen;
      this.archTiles((i, j) => { const k = j * w + i; g.occ[k] = 1; nav.walk[k] = pass ? 1 : 0; if (pass) g.gateTiles.delete(i + ',' + j); else g.gateTiles.add(i + ',' + j); });
      if (pass) {
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
      const target = this.open || this.localOpen ? DOWN : UP; this.angle += (target - this.angle) * Math.min(1, dt * 3.2); this.mesh.rotation.x = this.angle;
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
        // a tall leaf (u = distance from the hinge): four boards rising from 1.45 m at the post to 1.6 m in the middle,
        // a dark Z-brace on both faces, black iron strap hinges with studs, and a ring pull at the meeting edge
        const k = new K.VoxKit(), X = (u) => -s * u;
        for (let i = 0; i < 4; i++) { const u = 0.2 + i * 0.2, h = 1.43 + i * 0.05; k.box(i % 2 ? 'woodMid' : 'woodLight', X(u), 0.02, 0, 0.195, h, 0.1); k.box('woodDark', X(u), 0.02 + h, 0, 0.195, 0.03, 0.1); }
        for (const z of [0.065, -0.065]) {
          for (const y of [0.32, 1.12]) k.box('woodDark', X(0.5), y, z, 0.78, 0.1, 0.03);
          k.box('woodDark', X(0.5), 0.72 - 0.05, z, Math.hypot(0.62, 0.72), 0.09, 0.03, 0, 0, Math.atan2(0.72, -s * 0.62));
        }
        for (const y of [0.33, 1.13]) {
          k.box('ironDark', X(0.32), y + 0.01, 0.087, 0.6, 0.08, 0.015);
          for (const u of [0.12, 0.3, 0.48]) k.box('steel', X(u), y + 0.03, 0.097, 0.035, 0.035, 0.01);
        }
        k.box('ironDark', X(0.03), 0.02, 0, 0.05, 1.42, 0.05);                            // the hinge pin
        k.geo('ironDark', new THREE.TorusGeometry(0.07, 0.014, 5, 10), X(0.78), 0.78, 0.1, 0, 0, 0); k.box('ironDark', X(0.78), 0.84, 0.065, 0.05, 0.05, 0.03);
        const leaf = new THREE.Group(); for (const m of k.meshes(game.R.bmats)) leaf.add(m); leaf.position.set(s * 0.9, 0, 0); this.mesh.add(leaf); this.leaves.push([s, leaf]);   // hinged on the end posts
      }
      this.mesh.position.set(piece.x, game.play.nav.y(piece.x, piece.z), piece.z); this.mesh.rotation.y = piece.rot; game.group.add(this.mesh);
    }
    get nav() { return this.g.play.nav; }
    tiles(fn) { const p = this.p; this.g.rectTiles(p.x, p.z, 2, 0.5, p.rot, fn); }
    apply() {
      const g = this.g, nav = this.nav, w = nav.w;
      const pass = this.open || this.localOpen;   // localOpen: it lets you out from the inside of someone else's fence, never in
      this.tiles((i, j) => { const k = j * w + i; g.occ[k] = 1; nav.walk[k] = pass ? 1 : 0; if (pass) g.gateTiles.delete(i + ',' + j); else g.gateTiles.add(i + ',' + j); });
    }
    occupied() { let busy = false; const nav = this.nav; this.tiles((i, j) => { for (const a of this.g.play.actors) if ((a.alive || a === this.g.play.me) && nav.tile(a.x, a.z).join() === i + ',' + j) busy = true; }); return busy; }
    toggle() {
      const g = this.g;
      if (this.open) { if (this.occupied()) { g.cui.toast('Something is in the gateway.'); return; } this.open = false; g.sound.play('thunk'); g.cui.toast('Gate shut.'); }
      else { this.open = true; this.away = 0; g.sound.play('clank'); g.cui.toast('Gate open.'); }
      this.apply(); if (g.mp && !this.remote) g.mp.gate(this.p, this.open);
    }
    update(dt) {
      const target = this.open || this.localOpen ? 1.5 : 0; this.angle += (target - this.angle) * Math.min(1, dt * 7);
      for (const [s, leaf] of this.leaves) leaf.rotation.y = s * this.angle;
      if (!this.open) this.away = 0;   // a gate that was shut starts counting afresh when it opens again
      if (this.open && !this.remote) { const g = this.g, near = (a) => a && Math.hypot(a.x - this.p.x, a.z - this.p.z) <= AUTO_CLOSE_DIST, team = g.mp ? [...g.mp.avatars.by.values()].some((r) => g.mp.mayUse(r.a && r.a.pid) && near(r.a)) : false; this.away = near(g.play.me) || team ? 0 : this.away + dt; /* it stays open while you or a teammate is at it */ if (this.away > 2 && !this.occupied()) { this.open = false; this.apply(); this.g.cui.toast('The gate swings shut.'); if (this.g.mp && !this.remote) this.g.mp.gate(this.p, false); } }
    }
    dispose() { this.g.group.remove(this.mesh); this.tiles((i, j) => this.g.gateTiles.delete(i + ',' + j)); }
  }

  K.WoodGate = WoodGate; K.Drawbridge = Drawbridge; K.STONE_GATE_SIZE = ARCH;
})(typeof window !== 'undefined' ? window : globalThis);
