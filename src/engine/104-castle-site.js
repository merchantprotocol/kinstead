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
    constructor(game) { this.g = game; this.queue = []; this.t = 0; this.moved = {}; }   // moved: where regrown trees now stand (saved)
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
    cleared(e) { if (this.g.mp) this.g.mp.op({ k: 'node', id: e.id, st: 'felled' }); this.free(e); if (e.type === 'c_tree') this.queue.push({ e, at: this.play.t + rnd(60, 140) }); }
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
        if (L.plots.some((q) => Math.hypot(x - q.x, z - q.z) < 14) || Math.hypot(x - me.x, z - me.z) < 9) continue;   // never on anyone's plot
        if (d.terrain[k] === T.ROCK || d.terrain[k] === T.CHASM || d.terrain[k] === T.WATER || !this.nav.walk[k] || this.g.occ[k] || this.g.R.buildings.at(i, j)) continue;
        if (this.g.pieceAt(x, z, 1.5) || trees.some((q) => Math.hypot(q.x - x, q.z - z) < 1.9)) continue;
        return { x, z };
      }
      return null;
    }
    /** move a fallen tree's slot to a new place and let it stand again */
    regrow(e) {
      const p = this.spot(); if (!p) return false; const R = this.g.R, o = e.obj;
      o.x = p.x; o.z = p.z; this.moved[e.id] = [p.x, p.z]; e.x = p.x; e.z = p.z; e.y = this.nav.y(p.x, p.z);
      const st = this.play.nodeState(e); st.charges = st.max; st.respawnAt = 0; R.propState.delete(e.id);
      R.objectsChanged(false);   // the old and the new patch of forest both rebuild
      if (this.g.mp) this.g.mp.op({ k: 'node', id: e.id, st: 'moved', x: p.x, z: p.z });
      this.nav.blockProp(o); return true;
    }
    update(dt) {
      this.t -= dt; if (this.t > 0 || !this.queue.length) return; this.t = 2;
      const now = this.play.t; this.queue = this.queue.filter((q) => { if (now < q.at) return true; if (this.regrow(q.e)) return false; q.at = now + 20; return true; });
    }
  }

  /** A building being placed: where, which way it faces, whether the spot is acceptable. */
  /** the buildings placed with the ghost-and-steer flow: the blacksmith workshop and your own cottage */
  const KINDS = {
    blacksmith: { id: 'smithy', size: [12, 9], have: (g) => !!g.smithy, haveMsg: 'you already have a blacksmith' },
    cottage: { id: 'home', size: [10, 7], have: (g) => g.home.built, haveMsg: 'you already have a cottage' },
    market: { id: 'market', prefab: 'market_hall', size: [20, 14], have: (g) => !!g.marketHall, haveMsg: 'you already have a marketplace' },
    stable: { id: 'stable', prefab: 'stable', hall: true, have: (g) => !!g.halls.stable, haveMsg: 'you already have a stable' },
    bakery: { id: 'bakery', prefab: 'bakery', hall: true, have: (g) => !!g.halls.bakery, haveMsg: 'you already have a bakery' },
    butcher: { id: 'butcher', prefab: 'butcher', hall: true, have: (g) => !!g.halls.butcher, haveMsg: 'you already have a butcher shop' },
    library: { id: 'library', prefab: 'library', hall: true, have: (g) => !!g.halls.library, haveMsg: 'you already have a library' },
    bunkhouse: { id: 'bunkhouse', prefab: 'bunkhouse', hall: true, have: (g) => !!g.halls.bunkhouse, haveMsg: 'you already have a bunkhouse' },
  };
  const Hall = { BUILT: {
    stable: 'Stable built. Two horses came with it. Talk to the stablehand, or ride a horse from the stable.',
    bakery: 'Bakery built. The baker takes wheat from your market and bakes bread you can eat.',
    butcher: 'Butcher shop built. The butcher turns your spare cows and chickens into meat for the market.',
    library: 'Library built. The alchemist takes odds and ends from the market and brews potions. Find them in the market.',
    bunkhouse: 'Bunkhouse built. At dusk your workers walk in to sleep, and at dawn they walk out to work.',
  } };
  class BuildingSite {
    static get KINDS() { return KINDS; }
    constructor(game) { this.g = game; this.turns = 0; this.anchor = null; this.steering = false; this.ghost = null; this.key = ''; this.pad = null; this._type = null; }
    get play() { return this.g.play; }
    /** which building is being placed (or restored) */
    get type() { const P = this.g.cui.placing; return P && this.handles(P.type) ? P.type : this._type; }
    handles(type) { return !!KINDS[type]; }
    get active() { const P = this.g.cui.placing; return !!P && this.handles(P.type); }
    /** the building's spec at tile (ti,tj) turned `turns` quarter-turns (door faces south at 0, west at 1, north at 2, east at 3) */
    specAt(ti, tj, turns, id) {
      const kind = KINDS[this.type]; let s;
      if (this.type === 'cottage') { s = this.g.L.homeSpec(); s.x = 0; s.z = 0; }
      else if (kind.prefab) s = K.makeBuilding(kind.prefab, 0, 0, id || kind.id, 31);
      else { s = K.makeBuilding('smithy', 0, 0, id || 'smithy', 23); s.furniture = s.furniture.filter((f) => ['forge', 'anvil', 'grindstone', 'workbench', 'barrel', 'sack', 'crate', 'shield_rack', 'quench_tub', 'weapon_rack', 'material_pile', 'hanging_sign', 'counter'].includes(f.type)); }   // a workshop, not a shop
      if (turns) s = new K.BuildingEdit().rotate(s, turns); s.x = ti; s.z = tj; s.id = id || kind.id; if (this.type === 'cottage') s.noDoorLeaves = true; return s;
    }
    sizeFor(turns) { const kind = KINDS[this.type], [w, h] = kind.size || (() => { const f = K.BUILDING_PREFABS[kind.prefab].make().footprint; return [f.w, f.h]; })(); return turns % 2 ? [h, w] : [w, h]; }
    /** the top-left tile that centres the building on world point p */
    cornerFor(p, turns) { const [w, h] = this.sizeFor(turns); return [Math.round(p.x / TILE - w / 2), Math.round(p.z / TILE - h / 2)]; }
    /** why a building cannot go here, or null. Trees, rocks, fences and bumpy ground never count. */
    problem(ti, tj, turns) {
      const d = this.play.doc, R = this.g.R, [w, h] = this.sizeFor(turns);
      const kind = KINDS[this.type]; if (kind.have(this.g)) return kind.haveMsg;
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
      this.g.play.ui.tip(why ? `<b>Can’t build here</b> · ${why}` : `<b>${this.g.data.piece(this.type).name}</b> · press to set it down, hold and swing the mouse to turn it, let go to build`, sx, sy);
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
      this.g.play.ui.tip(`<b>${this.g.data.piece(this.type).name}</b> · let go to build it facing ${['south', 'west', 'north', 'east'][this.turns]}`, sx, sy);
    }
    up() {
      if (!this.steering || !this.anchor) { this.steering = false; return; }
      const a = this.anchor; this.steering = false; this.anchor = null; this.build(a);
    }
    /** R still turns it a quarter */
    turn() { this.turns = (this.turns + 1) % 4; }

    /* ---------- building it ---------- */
    build(p) {
      const g = this.g, c = g.castle, type = this.type, [ti, tj] = this.cornerFor(p, this.turns), turns = this.turns, why = this.problem(ti, tj, turns) || c.blocker(type);
      if (why) { g.cui.toast(why[0].toUpperCase() + why.slice(1) + '.'); g.sound.play('clank'); return false; }
      const [w, h] = this.sizeFor(turns), play = this.play, R = g.R; c.spend(c.buildCost(type));
      this.clearSite(ti, tj, w, h); this.level(ti, tj, w, h);
      const spec = this.specAt(ti, tj, turns, KINDS[type].id); play.doc.objects.push(spec);
      R.syncBuildings(true); play.nav.applyBuildings(R.buildings); play.bplay.dirty(); play.refreshProps(); g.home.door.apply();
      const me = play.me, aloft = !!g.ramparts && g.ramparts.onRamparts(me);   // up on the walls: a new building below never moves you
      if (!aloft && !play.nav.standable(me.x, me.z)) {
        const q = play.nav.nearestOk(...play.nav.tile(me.x, me.z), 10);
        if (q) { [me.x, me.z] = play.nav.centre(...q); me.path = null; }
      }
      this.adopt(type, spec, turns); g.xp.built(type); this.clearGhost(); g.cui.stopPlacing();
      const cx = (ti + w / 2) * TILE, cz = (tj + h / 2) * TILE; g.sound.play('whump'); g.shake(0.2); g.puff(cx, cz);
      if (type === 'cottage') { g.setRespawn('home', g.home.center.x - 0.25, g.home.center.z + 0.75); g.cui.toast('Your cottage is built. Sleep in the bed to wake here, keep out of the cold, and shut the door on the dark.'); }
      else if (KINDS[type].hall) g.cui.toast(Hall.BUILT[type] || 'Built.');
      else if (type === 'market') g.cui.toast('Marketplace built. Walk inside: wheat and bread, meat and eggs, weapons, raw materials. Your carts bring everything here, and the stalls out front fill up.');
      else g.cui.toast('Blacksmith built. Click the anvil to forge new weapons.');
      g.changed(); return true;
    }
    /** the building is up: hook it into the game (and tell everyone else) */
    adopt(type, spec, turns) {
      const g = this.g;
      if (type === 'cottage') { g.home.raise(spec); g.homeTurns = turns; g.home.door.apply(); if (g.mp) g.mp.announceHome(); }
      else if (KINDS[type].hall) { g.halls[type] = { spec, turns }; if (g.mp) g.mp.op({ k: 'bld+', id: type + ':' + g.mp.net.id, spec }); if (g.workers) g.workers.hallBuilt(type, spec, turns); }
      else if (type === 'market') { g.marketHall = spec; g.marketTurns = turns; if (g.mp) g.mp.op({ k: 'bld+', id: 'market:' + g.mp.net.id, spec }); const f = this.frontOf(spec, turns); g.addFreePiece('market', f.x, f.z, f.rot); }
      else { g.smithy = spec; g.smithyTurns = turns; if (g.mp) g.mp.op({ k: 'bld+', id: 'smithy:' + g.mp.net.id, spec }); g.forge = g.forge || new K.Forge(g); }
    }
    /** put a saved building back (no cost, no ceremony) */
    restore(type, ti, tj, turns) {
      const g = this.g, play = this.play, R = g.R; this._type = type; const spec = this.specAt(ti, tj, turns, KINDS[type].id); play.doc.objects.push(spec);
      R.syncBuildings(true); play.nav.applyBuildings(R.buildings); play.bplay.dirty(); play.refreshProps();
      if (type === 'cottage') { g.home.raise(spec); g.homeTurns = turns; g.home.door.apply(); } else if (KINDS[type].hall) { g.halls[type] = { spec, turns }; } else if (type === 'market') { g.marketHall = spec; g.marketTurns = turns; } else { g.smithy = spec; g.smithyTurns = turns; g.forge = g.forge || new K.Forge(g); }
      this._type = null;
    }
    /** just outside a building's front wall, facing out: where its street stalls go (the door faces south at 0, west at 1, north at 2, east at 3) */
    frontOf(spec, turns) {
      const W = spec.footprint.w, H = spec.footprint.h, cx = (spec.x + W / 2) * TILE, cz = (spec.z + H / 2) * TILE, half = (turns % 2 ? W : H) / 2 * TILE + 1.0;
      const dir = [[0, 1], [-1, 0], [0, -1], [1, 0]][turns % 4], rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][turns % 4];
      return { x: cx + dir[0] * half, z: cz + dir[1] * half, rot };
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

  /** Every other thing you place (gates, workshops, storehouse): press to set it down, hold and swing the mouse to turn
      it to face that way (in 15-degree steps), let go to build. A plain click builds it facing the way it was going to. */
  class PieceSteer {
    constructor(game) { this.g = game; this.stroke = null; }
    get placing() { const g = this.g, P = g.cui.placing; return P && !g.walls.handles(P.type) && !g.site.handles(P.type) ? P : null; }
    down(sx, sy) {
      const P = this.placing; if (!P) return false; this.g.cui.moveGhost(sx, sy); if (!P.at) return true;
      this.stroke = { x: P.at.x, z: P.at.z, rot: P.at.rot, turned: false }; return true;
    }
    drag(sx, sy) {
      const s = this.stroke, P = this.placing; if (!s || !P) return; const p = this.g.app.pickGround(sx, sy); if (!p) return;
      const dx = p.x - s.x, dz = p.z - s.z; if (Math.hypot(dx, dz) < 0.8) return;   // a small wobble does not turn it
      s.rot = Math.round(Math.atan2(dx, dz) / (Math.PI / 12)) * (Math.PI / 12); s.turned = true;
      const why = this.g.placementOk(P.type, s.x, s.z, s.rot); P.ghost.rotation.y = s.rot; P.ghost.position.set(s.x, this.g.play.nav.y(s.x, s.z), s.z); K.CastleArt.tintGhost(P.ghost, !why); P.at = { x: s.x, z: s.z, rot: s.rot, why };
      this.g.play.ui.tip(why ? `<b>Can’t build here</b> · ${why}` : `<b>${this.g.data.piece(P.type).name}</b> · let go to build it facing this way`, sx, sy);
    }
    up(sx, sy) {
      const s = this.stroke; this.stroke = null; if (!s) return; const g = this.g, P = g.cui.placing; if (!P || !P.at) return;
      g.buildAt(P.type, P.at.x, P.at.z, s.rot); g.cui.stopPlacing();
    }
  }

  Object.assign(K, { Forest, BuildingSite, PieceSteer });
})(typeof window !== 'undefined' ? window : globalThis);
