/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · work you can do on the world. A WorkTarget is "a thing that takes N swings": a tree, a boulder,
   a dirt tile, a rocky hillside tile. The Worker swings at one target at a time (every click is a swing, so
   clicking fast works faster; standing still keeps swinging on its own). The TerrainEditor is the only code
   that changes the ground. A shared `ctx` carries the collaborators: { game, play, effects, editor, ledger }.

     WorkTarget
       NodeTarget       a resource prop with charges (spec from the castle data)
         TreeTarget     needs the axe; shrinks with every swing, then crashes down into logs
         RockTarget     needs the pickaxe; boulders, rubble, iron: bursts into chunks
       TerrainTarget    one ground tile
         DigTarget      needs the shovel; one block down per DIG_HITS swings, throws dirt cubes
         MineTarget     needs the pickaxe; rocky hillsides only, throws stone chunks */
(function (G) {
  const K = G.K;
  const { TILE, T } = K;
  const BLOCK = 2, MIN_Q = -6, MAX_Q = 12;                       // a dug block is 2 quarter-units (0.5 m); holes bottom out 3 blocks down
  const SWING_MIN = 0.11, SWING_AUTO = 0.55, HITS_PER_CHARGE = 2, DIG_HITS = 3, MINE_HITS = 5;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /** Swings taken so far, per target key, so progress survives re-targeting and walking away. */
  class ProgressLedger {
    constructor() { this.m = new Map(); }
    get(key) { return this.m.get(key) || 0; }
    add(key, n = 1) { const v = this.get(key) + n; this.m.set(key, v); return v; }
    clear(key) { this.m.delete(key); }
  }

  /** The only code that changes the ground. Knows what may be dug, and how a dug tile is re-meshed and re-pathed. */
  class TerrainEditor {
    constructor(game) { this.g = game; }
    get doc() { return this.g.play.doc; }
    get nav() { return this.g.play.nav; }
    tileOf(p) { const [i, j] = this.doc.tileOf(p.x, p.z); return [i, j]; }
    inHill(x, z) { return (this.g.L.hills || []).some((h) => Math.hypot(x - h.x, z - h.z) < h.r); }
    /** rock you may mine: only the hills near the castle, never the ridge that guards the Iron Hills */
    isRockHill(i, j) {
      const d = this.doc; if (!d.inside(i, j)) return false; const k = j * d.w + i;
      return d.terrain[k] === T.ROCK && d.height[k] > 0 && this.inHill((i + 0.5) * TILE, (j + 0.5) * TILE);
    }
    canDig(i, j) {
      const d = this.doc, L = this.g.L; if (!d.inside(i, j)) return false;
      const k = j * d.w + i, t = d.terrain[k], x = (i + 0.5) * TILE, z = (j + 0.5) * TILE;
      if (t === T.CHASM || t === T.WATER || t === T.ROCK) return false;
      if (d.height[k] <= MIN_Q || !this.nav.walk[k] || this.g.home.near(x, z, 1.5)) return false;      // never under or beside the house              // a prop, a wall or a building is in the way
      const R = this.g.play.R; if (R.buildings && R.buildings.at && R.buildings.at(i, j)) return false;
      if (Math.hypot(x - L.keep.x, z - L.keep.z) < 3.6) return false;           // the Keep's footing stays
      for (const b of Object.values(L.barriers || {})) if (x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) return false;
      return true;
    }
    /** can one more block of dirt go on this tile? (free ground, not under a building, within the height limit) */
    canRaise(i, j) {
      const d = this.doc, L = this.g.L; if (!d.inside(i, j)) return false;
      const k = j * d.w + i, t = d.terrain[k]; if (t === T.CHASM || t === T.WATER || t === T.ROCK) return false;
      if (d.height[k] >= MAX_Q || !this.nav.walk[k] || this.nav.edge[k] || this.g.home.near((i + 0.5) * TILE, (j + 0.5) * TILE, 1.5)) return false;
      const R = this.g.play.R; if (R.buildings && R.buildings.at && R.buildings.at(i, j)) return false;
      return true;
    }
    /** put one block of dirt on a tile: the ground rises a cube and turns to dirt */
    raise(i, j) {
      const d = this.doc, k = j * d.w + i; d.height[k] = Math.min(MAX_Q, d.height[k] + BLOCK); d.terrain[k] = T.DIRT;
      this.nav.S[k] = this.nav.surface((i + 0.5) * TILE, (j + 0.5) * TILE, d.hy(i, j)); this.g.play.R.tilesChanged(i, j, i + 1, j + 1);
    }
    /** take one block off a tile; mined rock turns to dirt once it is level with the ground */
    lower(i, j, mining) {
      const d = this.doc, k = j * d.w + i, q = d.height[k], nq = mining ? Math.max(0, q - BLOCK) : Math.max(MIN_Q, q - BLOCK);
      d.height[k] = nq; if (!mining || nq <= 0) d.terrain[k] = T.DIRT;
      this.nav.S[k] = this.nav.surface((i + 0.5) * TILE, (j + 0.5) * TILE, d.hy(i, j));   // paths and hero height follow at once
      this.g.play.R.tilesChanged(i, j, i + 1, j + 1);                                      // the mesh and the paint follow next frame
    }
  }

  /** Base class: something that takes swings. */
  class WorkTarget {
    constructor(ctx) { this.ctx = ctx; }
    get requires() { return null; }                  // the tool id that works on this
    get key() { throw new Error('WorkTarget.key'); }
    get x() { throw new Error('WorkTarget.x'); }
    get z() { throw new Error('WorkTarget.z'); }
    get hitsNeeded() { return 1; }
    get alive() { return true; }
    get approach() { return 1.2; }                   // walk to within this, then start
    get reach() { return 1.6; }                      // keep swinging while within this
    /** the thing doAction() walks toward */
    get entity() { return { id: this.key, x: this.x, z: this.z, y: this.ctx.play.nav.y(this.x, this.z), h: 0.3, r: 0.25, name: 'ground' }; }
    get progress() { return this.ctx.ledger.get(this.key); }
    /** one swing; returns true when this swing finished the job */
    strike() {
      const n = this.ctx.ledger.add(this.key); this.onStrike(n);
      if (n < this.hitsNeeded) return false;
      this.ctx.ledger.clear(this.key); this.complete(); return true;
    }
    onStrike(n) {}
    complete() {}
    /** the work target for a prop entity, or null when it is not a workable resource */
    static forEntity(ctx, e) { const C = WorkTarget.TYPES[e.type]; return C ? new C(ctx, e) : null; }
  }

  class NodeTarget extends WorkTarget {
    constructor(ctx, entity) { super(ctx); this.e = entity; }
    get key() { return this.e.id; }
    get x() { return this.e.x; }
    get z() { return this.e.z; }
    get entity() { return this.e; }
    get spec() { return this.ctx.game.nodeSpec(this.e); }
    get state() { return this.ctx.play.nodeState(this.e); }
    get alive() { return this.state.charges > 0; }
    get hitsNeeded() { return Math.max(2, (this.spec.charges || 1) * HITS_PER_CHARGE); }
    get approach() { return this.e.r + 0.55; }
    get reach() { return this.e.r + 0.95; }
    get resource() { return Object.keys(this.spec.yields)[0]; }
    get yieldEach() { return this.spec.yields[this.resource]; }
    get pieces() { return Math.min(5, this.spec.charges || 3); }
    get groundY() { return this.ctx.play.nav.y(this.e.x, this.e.z); }
    /** the node is used up: stump / rubble look, a respawn timer, saved state */
    deplete() {
      const st = this.state, n = this.spec; st.charges = 0; st.respawnAt = n.respawnSec ? this.ctx.play.t + n.respawnSec : Infinity;
      this.ctx.game.R.setPropState(this.e.id, 'depleted'); this.ctx.game.changed();
    }
  }
  class TreeTarget extends NodeTarget {
    get requires() { return 'axe'; }
    onStrike() {
      this.ctx.game.sound.play('thunk'); const fx = this.ctx.effects, e = this.e, y = this.groundY;
      fx.burst('wood', e.x + rnd(-0.1, 0.1), y + 0.8, e.z + rnd(-0.1, 0.1), 4, 2.4);
      fx.spawnPickup('wood', 1, e.x + rnd(-0.15, 0.15), y + 0.9, e.z + rnd(-0.15, 0.15), 2.8, true);   // a chunk of wood flies off: worth 1
    }
    complete() { const me = this.ctx.play.me, e = this.e; this.deplete(); this.ctx.effects.fellTree(e.x, e.z, me.x, me.z, () => {}); }   // it crashes down and is gone
  }
  class RockTarget extends NodeTarget {
    get requires() { return 'pickaxe'; }
    onStrike() {
      const fx = this.ctx.effects, e = this.e, y = this.groundY, r = this.resource; this.ctx.game.sound.play('clank');
      fx.burst(r, e.x + rnd(-0.1, 0.1), y + 0.4, e.z + rnd(-0.1, 0.1), 4, 2.4);
      fx.spawnPickup(r, 1, e.x + rnd(-0.15, 0.15), y + 0.5, e.z + rnd(-0.15, 0.15), 2.8, true);       // each swing chips off 1
    }
    complete() { const e = this.e; this.deplete(); this.ctx.game.sound.play('crack'); this.ctx.effects.burst(this.resource, e.x, this.groundY + 0.5, e.z, 10, 3.5); }   // the rock is gone
  }

  class TerrainTarget extends WorkTarget {
    constructor(ctx, i, j) { super(ctx); this.i = i; this.j = j; }
    get key() { return 'tile:' + this.i + ',' + this.j; }
    get x() { return (this.i + 0.5) * TILE; }
    get z() { return (this.j + 0.5) * TILE; }
    get approach() { return 1.35; }
    get reach() { return 1.75; }
    get surfaceY() { return this.ctx.editor.doc.hy(this.i, this.j); }
    /** shared swing: a sound, a puff, and one cube thrown out */
    throwCube(kind, value, speed, sound) {
      const fx = this.ctx.effects, y = this.surfaceY;
      this.ctx.game.sound.play(sound); fx.burst(kind, this.x, y + 0.15, this.z, 4, 2.2);
      fx.spawnPickup(kind, value, this.x + rnd(-0.1, 0.1), y + 0.3, this.z + rnd(-0.1, 0.1), speed, true);
    }
  }
  class DigTarget extends TerrainTarget {
    get requires() { return 'shovel'; }
    get alive() { return this.ctx.editor.canDig(this.i, this.j); }
    get hitsNeeded() { return DIG_HITS; }
    onStrike() { this.throwCube('dirt', 1, 2.8, 'gather'); }
    complete() { this.ctx.editor.lower(this.i, this.j, false); this.ctx.game.sound.play('thunk'); }
  }
  class MineTarget extends TerrainTarget {
    get requires() { return 'pickaxe'; }
    get alive() { return this.ctx.editor.isRockHill(this.i, this.j); }
    get hitsNeeded() { return MINE_HITS; }
    onStrike() { this.throwCube('stone', 1, 2.4, 'clank'); }
    complete() {
      this.ctx.editor.lower(this.i, this.j, true); this.ctx.game.sound.play('thunk');
    }
  }
  WorkTarget.TYPES = { c_tree: TreeTarget, c_boulder: RockTarget, c_rubble: RockTarget, c_iron: RockTarget };
  WorkTarget.TOOL_FOR = { c_tree: 'axe', c_boulder: 'pickaxe', c_rubble: 'pickaxe', c_iron: 'pickaxe' };   // which tool a resource type needs (cheap lookup for picking)

  /** Swings at one target. Every start() is a swing, so clicking fast is faster; it also keeps swinging by itself. */
  class Worker {
    constructor(ctx, belt) { this.ctx = ctx; this.belt = belt; this.target = null; this.nextAt = 0; this.lastHit = -9; this.idleAt = 0; }
    get play() { return this.ctx.play; }
    start(target) { this.target = target; this.strike(); }
    strike() {
      const t = this.target, P = this.play, now = P.t; if (!t || now - this.lastHit < SWING_MIN) return;
      this.lastHit = now; this.nextAt = now + SWING_AUTO; P.face(P.me, t); P.me.view.setState('action'); this.idleAt = now + 0.5;
      if (t.strike() && !t.alive) this.cancel();
    }
    /** can the hero keep working this target right now? */
    get valid() {
      const t = this.target, P = this.play, me = P.me;
      return !!t && me.alive && !me.path && !P.ch && t.alive && this.belt.current.accepts(t) && P.dist(me, t) <= t.reach;
    }
    cancel() { this.target = null; }
    update() {
      const P = this.play;
      if (this.target) { if (!this.valid) this.cancel(); else if (P.t >= this.nextAt) this.strike(); }
      if (!this.target && this.idleAt && P.t > this.idleAt) { this.idleAt = 0; const me = P.me; if (me.alive && me.view.state === 'action' && !P.ch) me.view.setState('idle'); }
    }
  }

  Object.assign(K, { ProgressLedger, TerrainEditor, WorkTarget, NodeTarget, TreeTarget, RockTarget, TerrainTarget, DigTarget, MineTarget, Worker });
})(typeof window !== 'undefined' ? window : globalThis);
