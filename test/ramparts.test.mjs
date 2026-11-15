/* Ramparts (src/engine/122-126): the player-only walk on top of stone walls, stone towers and the stone gate. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const ENGINE = ['11-core.js', '13-textures.js', '20-world.js', '58-nav.js', '82e-rampart-plan.js', '122-castle-rampart-layer.js',
  '123-castle-tower-stair.js', '124-castle-rampart-walker.js', '125-castle-rampart-cursor.js', '126-castle-ramparts.js'];
const SIZE = { stone_wall: [0.5, 0.5], stone_tower: [1.5, 1.5], stone_gate: [4, 1.5] };

/* the engine modules in a sandbox, with the castle's footprint sizes */
class Sandbox {
  constructor() {
    this.ctx = vm.createContext({ console, Math, performance: { now: () => 0 } });
    this.ctx.window = this.ctx; this.ctx.globalThis = this.ctx;
    vm.runInContext('(this.K = this.K || {}).CastleArt = { size: (t) => this.SIZE[t] || [2, 2] };', Object.assign(this.ctx, { SIZE }));
    for (const f of ENGINE) vm.runInContext(fs.readFileSync(path.join(SRC, 'engine', f), 'utf8'), this.ctx, { filename: f });
  }
  get K() { return this.ctx.K; }
}
const box = new Sandbox();
const K = box.K, T = K.TILE;

/* the parts of CastleGame the ramparts use: the ground grid, your pieces, footprint tiles; pieces block the ground
   like CastleGame.blockPiece (a stone gate with its bridge down leaves the 3 m opening open) */
class Castle {
  constructor(w = 64, h = 64) {
    this.nav = new K.NavGrid(new K.WorldDoc(w, h)); this.castle = { pieces: [] }; this.uid = 1;
    this.play = { nav: this.nav, me: { x: 1, z: 1, y: 0, layer: 'ground' } };
  }
  rectTiles(x, z, w, d, rot, fn) {
    const nav = this.nav, c = Math.cos(rot), s = Math.sin(rot), R = Math.hypot(w, d) / 2 + T;
    const [i0, j0] = nav.tile(x - R, z - R), [i1, j1] = nav.tile(x + R, z + R);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!nav.inside(i, j)) continue;
      const [px, pz] = nav.centre(i, j), dx = px - x, dz = pz - z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) fn(i, j, lx, lz);
    }
  }
  autoRot() { return 0; }
  add(type, x, z, rot = 0) {
    const p = { uid: this.uid++, type, x, z, rot, hp: 100 }; this.castle.pieces.push(p);
    const [w, d] = SIZE[type];
    this.rectTiles(x, z, w, d, rot, (i, j, lx) => { if (type !== 'stone_gate' || Math.abs(lx) > 1.5) this.nav.walk[j * this.nav.w + i] = 0; });
    return p;
  }
  wall(i, j) { return this.add('stone_wall', (i + 0.5) * T, (j + 0.5) * T); }
  tower(i, j) { return this.add('stone_tower', (i + 0.5) * T, (j + 0.5) * T); }
  /* a square curtain: towers on the corners at tiles (a, a) and (b, b), walls between; the south run has a stone gate */
  square(a = 10, b = 30, gate = true) {
    for (const [i, j] of [[a, a], [b, a], [a, b], [b, b]]) this.tower(i, j);
    for (let k = a + 2; k <= b - 2; k++) { this.wall(k, a); this.wall(a, k); this.wall(b, k); }
    const mid = Math.floor((a + b) / 2);   // gate tiles mid-3 .. mid+4 along x, centred on the tile edge, 3 deep
    for (let k = a + 2; k <= b - 2; k++) if (!gate || k < mid - 3 || k > mid + 4) this.wall(k, b);
    if (gate) this.add('stone_gate', (mid + 1) * T, (b + 0.5) * T, 0);
    return { inside: [(mid + 0.5) * T, (a + 5) * T], outside: [(mid + 0.5) * T, (b + 6) * T], gateTop: [(mid + 1) * T, (b + 0.5) * T] };
  }
  ramparts() { return new K.Ramparts(this); }
}
const onLayer = (r, q) => r.layer.has(q[0], q[1]);
const markerAt = (p, layer) => p.findIndex((q) => q[3] === layer);

// risk: raiders climbing walls. The walk lives only in the player's layer; the ground grid shared with every
// creature still has every wall tile blocked, so a closed ring of stone walls keeps them out.
test('wall tops are a player-only layer: the ground grid stays blocked and a closed ring keeps creatures out', () => {
  const c = new Castle(), at = c.square(10, 30, false), r = c.ramparts();
  const wallTile = [(15 + 0.5) * T, (10 + 0.5) * T];
  assert.equal(c.nav.standable(...wallTile), false, 'the wall tile is solid on the ground');
  assert.ok(Math.abs(r.layer.y(...wallTile) - (c.nav.y(...wallTile) - 0.02 + K.RampartPlan.WALK)) < 1e-5, 'and walkable on the ramparts at the walk height');
  assert.equal(c.nav.find(...at.outside, ...at.inside), null, 'no ground path into a closed ring');
});

// risk: stepping straight up a wall face. Without a stone tower there is no stair, so there is no way up.
test('with no stone tower there is no way up onto a wall', () => {
  const c = new Castle(); for (let i = 10; i < 20; i++) c.wall(i, 10);
  const r = c.ramparts(), me = c.play.me; me.x = 7.5; me.z = 7.5;
  assert.equal(r.stairs.length, 0);
  assert.equal(r.route(me, 7.5, 5.25, true), null);
});

// risk: core feature. From the courtyard the way up is a tower stair; after the stair every waypoint is on the walk.
test('the way up from the courtyard goes through a tower door and stair, then stays on the walk', () => {
  const c = new Castle(), at = c.square(), r = c.ramparts(), me = c.play.me;
  [me.x, me.z] = at.inside;
  const goal = [(20 + 0.5) * T, (10 + 0.5) * T], p = r.route(me, ...goal, true);
  assert.ok(p && p.layered, 'a layered path');
  const up = markerAt(p, 'upper'); assert.ok(up > 0, 'it climbs a stair to the walk');
  assert.ok(p.slice(0, up).some((q) => q.length === 3), 'stair legs carry their height');
  const firstStair = p.findIndex((q) => q.length > 2), door = p[firstStair - 1];
  assert.ok(c.nav.standable(door[0], door[1]), 'the stair starts at a ground door');
  assert.ok(p.slice(up + 1).every((q) => onLayer(r, q)), 'after the stair every waypoint is on the ramparts');
  const end = p[p.length - 1]; assert.ok(Math.hypot(end[0] - goal[0], end[1] - goal[1]) < 0.01);
});

// risk: the gate. You walk over the gate's battlements along the top while its opening stays a ground passage.
test('the walk crosses over the stone gate, and the gate opening is still a ground passage', () => {
  const c = new Castle(), at = c.square(), r = c.ramparts(), me = c.play.me;
  const west = [(14 + 0.5) * T, (30 + 0.5) * T], east = [(26 + 0.5) * T, (30 + 0.5) * T];
  Object.assign(me, { x: west[0], z: west[1], layer: 'upper', y: r.layer.y(...west) });
  const p = r.route(me, ...east, true);
  assert.ok(p, 'a walk from the west wall to the east wall');
  assert.ok(p.every((q) => onLayer(r, q)), 'it never leaves the ramparts');
  assert.ok(r.layer.has(...at.gateTop), 'the gate top is part of the walk');
  assert.ok(c.nav.find(...at.outside, ...at.inside), 'the ground path through the gate opening still exists');
});

// risk: getting stuck up top. Clicking the ground from the walk goes down a tower and walks on from its door.
test('from the walk to the ground: along the walk, down a stair, then only ground waypoints', () => {
  const c = new Castle(), at = c.square(), r = c.ramparts(), me = c.play.me, top = [(20 + 0.5) * T, (10 + 0.5) * T];
  Object.assign(me, { x: top[0], z: top[1], layer: 'upper', y: r.layer.y(...top) });
  const p = r.route(me, ...at.inside, false), down = markerAt(p, 'ground');
  assert.ok(down > 0, 'it comes down a stair');
  assert.ok(p.slice(down + 1).every((q) => q.length === 2 && c.nav.standable(q[0], q[1])), 'then walks the ground');
});

// risk: a new click half way up teleports you. The hero finishes the flight it is on, then goes on.
test('a new route half way up a stair finishes that flight first', () => {
  const c = new Castle(), at = c.square(), r = c.ramparts(), me = c.play.me, s = r.stairs[0], leg = s.up[3];
  Object.assign(me, { x: s.up[2][0], z: s.up[2][1], y: s.up[2][2], layer: 'stair', leg });
  const p = r.route(me, ...at.inside, false);
  assert.equal(p[0], leg, 'it starts with the step it was on');
  assert.equal(p[s.up.length - 4][3], 'upper', 'it reaches the deck');
  assert.ok(markerAt(p, 'ground') > 0, 'then comes back down to the ground');
});

// risk: height. A stair leg eases the height and switches layer on arrival; up top the height is the walk's.
test('the walker eases height along a stair leg and switches layer on arrival', () => {
  const c = new Castle(); c.square(); const r = c.ramparts(), s = r.stairs[0], top = s.up[s.up.length - 1], prev = s.up[s.up.length - 2];
  const a = { x: prev[0], z: prev[1], y: prev[2], layer: 'stair' }, d = Math.hypot(top[0] - a.x, top[1] - a.z);
  r.walker.begin(a, top, d); r.walker.along(a, top, d / 2);
  assert.ok(Math.abs(a.y - (prev[2] + top[2]) / 2) < 1e-6, 'half way along, half way up');
  r.walker.arrive(a, top);
  assert.equal(a.layer, 'upper'); assert.equal(a.y, top[2]);
  assert.equal(r.walker.rest(a), r.layer.y(a.x, a.z));
});

// risk: floating in the air. When the wall under you comes down you drop to the ground beside it.
test('when the wall under the hero is gone, the hero drops to standable ground', () => {
  const c = new Castle(); const walls = []; for (let i = 10; i < 20; i++) walls.push(c.wall(i, 10)); c.tower(8, 10);
  const r = c.ramparts(), me = c.play.me, p = walls[4];
  Object.assign(me, { x: p.x, z: p.z, layer: 'upper', y: r.layer.y(p.x, p.z) });
  p.hp = 0; c.nav.walk[10 * c.nav.w + 14] = 1;   // knocked down: the ground tile opens
  r.update(1);
  assert.equal(me.layer, 'ground'); assert.ok(c.nav.standable(me.x, me.z)); assert.equal(me.y, c.nav.y(me.x, me.z));
});
