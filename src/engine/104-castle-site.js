/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the building site. Two jobs, kept in two classes:
     Forest         what happens to trees and boulders: a felled one stops blocking the ground at once, and trees
                    grow back later in a DIFFERENT random place, so the land you cleared stays yours.
     BuildingSite   dropping a building (the blacksmith). Press to set it down, keep the button held and swing the
                    mouse around it to turn it to face the way you want, let go to build. It is forgiving: trees,
                    boulders, your own fences and walls, uneven ground, all get cleared and levelled. Only another
                    building, the edge of the map, water and chasms stop you. */
(function (G) {
  const K = G.K, THREE = G.THREE, TILE = K.TILE, T = K.T;
  const rnd = (a, b) => a + Math.random() * (b - a);

  class Forest {
    constructor(game) { this.g = game; this.queue = []; this.t = 0; }
    get play() { return this.g.play; }
    get nav() { return this.g.play.nav; }
    get doc() { return this.g.play.doc; }
    live(e) { return this.play.nodeState(e).charges > 0; }
    /** every harvestable prop (tree, boulder, iron) of the world */
    get nodes() { return this.play.baseProps.filter((e) => K.WorkTarget.TOOL_FOR[e.type]); }
    baseWalk(k) { const t = this.doc.terrain[k]; return this.nav.deck[k] || (t !== T.CHASM && t !== T.WATER) ? 1 : 0; }
    /** a felled tree or broken rock stops blocking: its tiles are walkable and buildable again (unless something else stands there) */
    free(e) {
      const nav = this.nav, d = this.doc, o = e.obj, R = Math.ceil(e.r / TILE) + 2, [ci, cj] = d.tileOf(o.x, o.z), g = this.g, others = this.play.baseProps.filter((q) => q !== e && Math.hypot(q.x - e.x, q.z - e.z) < 4 && this.live(q));
      for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
        if (!d.inside(i, j)) continue; const k = j * d.w + i; if (g.occ[k] || g.R.buildings.at(i, j)) continue; nav.walk[k] = this.baseWalk(k);
      }
      for (const q of others) nav.blockProp(q.obj);
    }
    /** a tree or boulder is gone: free the ground, and (for a tree) plan its regrowth somewhere else */
    cleared(e) { this.free(e); if (e.type === 'c_tree') this.queue.push({ e, at: this.play.t + rnd(60, 140) }); }
    /** knock one down without a harvest (a building is going up on it) */
    wipe(e) {
      if (!this.live(e)) return; const st = this.play.nodeState(e); st.charges = 0; st.respawnAt = Infinity;
      this.g.R.setPropState(e.id, 'depleted'); this.g.tools.effects.burst(e.type === 'c_tree' ? 'wood' : 'stone', e.x, e.y + 0.6, e.z, 6, 2.4); this.cleared(e);
    }
    /** a spot where a new tree may stand: forest-ish, away from you and your home, clear of everything */
    spot() {
      const L = this.g.L, d = this.doc, me = this.play.me, wu = L.size.w * TILE, hu = L.size.h * TILE, trees = this.nodes.filter((q) => this.live(q));
      for (let n = 0; n < 60; n++) {
        const x = rnd(6, wu - 6), z = rnd(6, hu - 6), [i, j] = d.tileOf(x, z), k = j * d.w + i;
        if (Math.hypot(x - L.keep.x, z - L.keep.z) < 16 || Math.hypot(x - me.x, z - me.z) < 9) continue;
        if (d.terrain[k] === T.ROCK || d.terrain[k] === T.CHASM || d.terrain[k] === T.WATER || !this.nav.walk[k] || this.g.occ[k] || this.g.R.buildings.at(i, j)) continue;
        if (this.g.pieceAt(x, z, 1.5) || trees.some((q) => Math.hypot(q.x - x, q.z - z) < 1.9)) continue;
        return { x, z };
      }
      return null;
    }
    /** move a fallen tree's slot to a new place and let it stand again */
    regrow(e) {
      const p = this.spot(); if (!p) return false; const R = this.g.R, o = e.obj;
      o.x = p.x; o.z = p.z; e.x = p.x; e.z = p.z; e.y = this.nav.y(p.x, p.z);
      const st = this.play.nodeState(e); st.charges = st.max; st.respawnAt = 0; R.propState.delete(e.id);
      R.objectsChanged(false);   // the old and the new patch of forest both rebuild
      this.nav.blockProp(o); return true;
    }
    update(dt) {
      this.t -= dt; if (this.t > 0 || !this.queue.length) return; this.t = 2;
      const now = this.play.t; this.queue = this.queue.filter((q) => { if (now < q.at) return true; if (this.regrow(q.e)) return false; q.at = now + 20; return true; });
    }
  }

  /** A building being placed: where, which way it faces, whether the spot is acceptable. */
  class BuildingSite {
    static get TYPE() { return 'blacksmith'; }
    constructor(game) { this.g = game; this.turns = 0; this.anchor = null; this.steering = false; this.ghost = null; this.key = ''; this.pad = null; }
    get play() { return this.g.play; }
    handles(type) { return type === BuildingSite.TYPE; }
    get active() { const P = this.g.cui.placing; return !!P && this.handles(P.type); }
    /** the building's spec at tile (ti,tj) turned `turns` quarter-turns (door faces south at 0, west at 1, north at 2, east at 3) */
    specAt(ti, tj, turns, id) {
      let s = K.makeBuilding('smithy', 0, 0, id || 'smithy', 23); s.furniture = s.furniture.filter((f) => ['forge', 'anvil', 'grindstone', 'workbench', 'barrel', 'sack', 'crate'].includes(f.type));   // a workshop, not a shop
      if (turns) s = new K.BuildingEdit().rotate(s, turns); s.x = ti; s.z = tj; s.id = id || 'smithy'; return s;
    }
    sizeFor(turns) { return turns % 2 ? [9, 12] : [12, 9]; }
    /** the top-left tile that centres the building on world point p */
    cornerFor(p, turns) { const [w, h] = this.sizeFor(turns); return [Math.round(p.x / TILE - w / 2), Math.round(p.z / TILE - h / 2)]; }
    /** why a building cannot go here, or null. Trees, rocks, fences and bumpy ground never count. */
    problem(ti, tj, turns) {
      const d = this.play.doc, R = this.g.R, [w, h] = this.sizeFor(turns);
      if (this.g.smithy) return 'you already have a blacksmith';
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const ci = ti + i, cj = tj + j; if (ci < 1 || cj < 1 || ci >= d.w - 1 || cj >= d.h - 1) return 'that is off the map';
        const t = d.terrain[cj * d.w + ci]; if (t === T.CHASM || t === T.WATER) return 'there is water or a chasm there';
        if (R.buildings.at(ci, cj)) return 'another building is there';
      }
      return null;
    }

    /* ---------- the ghost: the real building, see-through ---------- */
    clearGhost() { if (this.ghost) { this.g.group.remove(this.ghost.group); this.ghost.mesh.dispose(); this.ghost.group.traverse((o) => { if (o.isMesh && o.material && o.userData.mine) o.material.dispose(); }); this.ghost = null; } this.key = ''; }
    showGhost(ti, tj, turns, ok) {
      const key = ti + ',' + tj + ',' + turns;
      if (key !== this.key) {
        this.clearGhost(); this.key = key;
        const spec = this.specAt(ti, tj, turns, 'ghost'), mesh = new K.BuildingMesh(K.BuildingSpec.normalize(spec), { mats: this.g.R.bmats, doc: this.play.doc, catalog: K.FURNITURE }), grp = new THREE.Group();
        grp.add(mesh.group);
        mesh.group.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.userData.mine = true; o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; o.castShadow = false; } });
        const [w, h] = this.sizeFor(turns), pad = new THREE.Mesh(new THREE.PlaneGeometry(w * TILE + 0.4, h * TILE + 0.4), new THREE.MeshBasicMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.3, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2; pad.position.set((ti + w / 2) * TILE, mesh.y0 + 0.06, (tj + h / 2) * TILE); pad.userData.mine = true; grp.add(pad); this.pad = pad;
        this.g.group.add(grp); this.ghost = { group: grp, mesh };
      }
      this.pad.material.color.setHex(ok ? 0x7fe08a : 0xff6a5a);
    }

    /* ---------- pointer ---------- */
    ground(sx, sy) { return this.g.app.pickGround(sx, sy); }
    /** the pointer moves with nothing held: the ghost follows it */
    hover(sx, sy) {
      const p = this.ground(sx, sy); if (!p) { if (this.ghost) this.ghost.group.visible = false; return; }
      const [ti, tj] = this.cornerFor(p, this.turns), why = this.problem(ti, tj, this.turns); this.showGhost(ti, tj, this.turns, !why); this.ghost.group.visible = true;
      this.g.play.ui.tip(why ? `<b>Can’t build here</b> · ${why}` : `<b>Blacksmith</b> · press to set it down, hold and swing the mouse to turn it, let go to build`, sx, sy);
    }
    /** press: set the building down here (it stays put while you steer) */
    down(sx, sy) {
      if (!this.active) return false; const p = this.ground(sx, sy); if (!p) return true;
      this.anchor = { x: p.x, z: p.z }; this.steering = true; this.hover(sx, sy); return true;
    }
    /** held and moving: swing the mouse around the building to face it that way */
    drag(sx, sy) {
      if (!this.steering || !this.anchor) return; const p = this.ground(sx, sy); if (!p) return;
      const dx = p.x - this.anchor.x, dz = p.z - this.anchor.z;
      if (Math.hypot(dx, dz) > 1.2) this.turns = Math.abs(dz) >= Math.abs(dx) ? (dz > 0 ? 0 : 2) : (dx < 0 ? 1 : 3);   // the door faces where the mouse went
      const [ti, tj] = this.cornerFor(this.anchor, this.turns), why = this.problem(ti, tj, this.turns); this.showGhost(ti, tj, this.turns, !why); this.ghost.group.visible = true;
      this.g.play.ui.tip(`<b>Blacksmith</b> · let go to build it facing ${['south', 'west', 'north', 'east'][this.turns]}`, sx, sy);
    }
    up() {
      if (!this.steering || !this.anchor) { this.steering = false; return; }
      const a = this.anchor; this.steering = false; this.anchor = null; this.build(a);
    }
    /** R still turns it a quarter */
    turn() { this.turns = (this.turns + 1) % 4; }

    /* ---------- building it ---------- */
    build(p) {
      const g = this.g, c = g.castle, [ti, tj] = this.cornerFor(p, this.turns), turns = this.turns, why = this.problem(ti, tj, turns) || c.blocker('blacksmith');
      if (why) { g.cui.toast(why[0].toUpperCase() + why.slice(1) + '.'); g.sound.play('clank'); return false; }
      const [w, h] = this.sizeFor(turns), play = this.play, R = g.R; c.spend(c.buildCost('blacksmith'));
      this.clearSite(ti, tj, w, h); this.level(ti, tj, w, h);
      const spec = this.specAt(ti, tj, turns, 'smithy'); play.doc.objects.push(spec);
      R.syncBuildings(true); play.nav.applyBuildings(R.buildings); play.bplay.dirty(); play.refreshProps(); g.home.door.apply();
      const me = play.me; if (!play.nav.standable(me.x, me.z)) { const q = play.nav.nearestOk(...play.nav.tile(me.x, me.z), 10); if (q) { [me.x, me.z] = play.nav.centre(...q); me.path = null; } }
      g.smithy = spec; g.forge = g.forge || new K.Forge(g); this.clearGhost(); g.cui.stopPlacing();
      const cx = (ti + w / 2) * TILE, cz = (tj + h / 2) * TILE; g.sound.play('whump'); g.shake(0.2); g.puff(cx, cz); g.cui.toast('Blacksmith built. Click the anvil to forge new weapons.'); g.changed(); return true;
    }
    /** wipe out whatever stands on the plot: trees, boulders, your fences and walls */
    clearSite(ti, tj, w, h) {
      const g = this.g, x0 = ti * TILE - 0.6, x1 = (ti + w) * TILE + 0.6, z0 = tj * TILE - 0.6, z1 = (tj + h) * TILE + 0.6;
      for (const e of g.forest.nodes) if (e.x > x0 && e.x < x1 && e.z > z0 && e.z < z1) g.forest.wipe(e);
      for (const p of g.castle.pieces.slice()) if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) g.demolishPiece(p, { refund: false });
      for (let j = tj; j < tj + h; j++) for (let i = ti; i < ti + w; i++) { const k = j * g.play.nav.w + i; if (g.occ[k] && !g.R.buildings.at(i, j)) { g.occ[k] = 0; if (g.forest.baseWalk(k)) g.play.nav.walk[k] = 1; } }
    }
    /** flatten the plot to its average height and turn it to dirt */
    level(ti, tj, w, h) {
      const d = this.play.doc, nav = this.play.nav; let sum = 0, n = 0;
      for (let j = tj; j < tj + h; j++) for (let i = ti; i < ti + w; i++) { sum += d.height[j * d.w + i]; n++; }
      const q = Math.round(sum / n);
      for (let j = tj; j < tj + h; j++) for (let i = ti; i < ti + w; i++) { const k = j * d.w + i; d.height[k] = q; if (d.terrain[k] === T.ROCK || d.terrain[k] === T.SNOW) d.terrain[k] = T.DIRT; nav.S[k] = nav.surface((i + 0.5) * TILE, (j + 0.5) * TILE, d.hy(i, j)); }
      this.play.R.tilesChanged(ti, tj, ti + w, tj + h); if (this.g.tools && this.g.tools.editor) this.g.tools.editor.version++;
    }
    dispose() { this.clearGhost(); }
  }

  Object.assign(K, { Forest, BuildingSite });
})(typeof window !== 'undefined' ? window : globalThis);
