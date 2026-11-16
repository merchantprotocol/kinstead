/* The Redwood world (src/engine/21-redwood-config.js, 22-chunk-stream.js, 82k-redwood-forest.js, 98-hut-world.js,
   108-castle-persist.js): the 100x map, its forest, the nav grid through it, ground streaming and saves both ways. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ServerConfig } from '../server/src/ServerConfig.js';

const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'engine');

class RedwoodSandbox {
  constructor() {
    this.ctx = vm.createContext({ console, performance: { now: () => Date.now() } });
    this.ctx.window = this.ctx; this.ctx.globalThis = this.ctx;
    for (const f of ['11-core.js', '13-textures.js', '20-world.js', '21-redwood-config.js', '22-chunk-stream.js']) this.load(f);
    // the nav grid only needs each prop's footprint radius (the real PropBuilder needs THREE)
    this.K.PropBuilder = { PROPS: { 'c:pine': { r: 0.6 }, 'c:deadtree': { r: 0.5 }, 'c:boulder': { r: 0.6 }, 'c:iron': { r: 0.55 }, rock: { r: 0.5 }, start: { r: 0.3 } } };
    for (const f of ['58-nav.js', '81-castle-world.js', '82k-redwood-forest.js', '98-hut-world.js', '108-castle-persist.js']) this.load(f);
  }
  load(f) { vm.runInContext(fs.readFileSync(path.join(ENGINE, f), 'utf8'), this.ctx, { filename: f }); }
  get K() { return this.ctx.K; }
}
const box = new RedwoodSandbox(), K = box.K;
const layout = new K.HutLayout(new K.WorldPlan(), 0);
const doc = new K.HutWorldBuilder(layout).build();
const nav = new K.NavGrid(doc);
const forest = doc.redwoods, KIND = K.RedwoodForest.KIND;
const giants = [], mids = [];
for (let k = 0; k < forest.count; k++) { const t = { k, x: forest.x[k], z: forest.z[k], r: forest.r[k], h: forest.ht[k] }; if (forest.kind[k] === KIND.GIANT) giants.push(t); else if (forest.kind[k] === KIND.MID) mids.push(t); }

// risk: world scale. The map is 100x the area of the old 560 x 400 snowfield (10x per axis, one tunable).
test('the shared map is 5600 x 4000 tiles with the snowfield kept at its old coordinates', () => {
  assert.equal(K.REDWOOD.world.axis, 10);
  assert.equal(doc.w, 5600); assert.equal(doc.h, 4000);
  assert.deepEqual([layout.plan.core.w, layout.plan.core.h], [560, 400]);
  assert.equal(JSON.stringify(layout.plots.map((p) => [p.x, p.z])), JSON.stringify(ServerConfig.PLOTS.map((p) => [p.x, p.z])), 'plots match the realtime server\'s table');
  assert.ok(doc.terrain.includes(K.T.FOREST), 'forest floor beyond the snowfield');
});

// risk: save / multiplayer identity. Core prop ids must not shift: every choppable young redwood comes after all core props.
test('young redwoods are appended after every snowfield prop', () => {
  const firstYoung = doc.objects.findIndex((o) => o.type === 'c:youngred'), lastCore = doc.objects.map((o) => o.type !== 'c:youngred').lastIndexOf(true);
  assert.ok(firstYoung > 0, 'there are young redwoods to fell');
  assert.ok(lastCore < firstYoung, 'no core prop after the first young redwood');
  for (const o of doc.objects.slice(firstYoung)) assert.ok(o.x > layout.plan.coreMetres.w || o.z > layout.plan.coreMetres.h, 'young redwoods grow in the forest, outside the snowfield');
});

// risk: the forest itself. Giants are 60-90 m tall on 1.5-3 m bases; younger redwoods 20-40 m on 0.45-1.1 m.
test('redwood counts and sizes stay in their ranges', () => {
  assert.ok(giants.length > 5000, `a vast stand of giants (${giants.length})`);
  assert.ok(mids.length > giants.length, `younger redwoods outnumber the giants (${mids.length})`);
  for (const g of giants) { assert.ok(g.h >= 60 && g.h <= 90, `giant height ${g.h}`); assert.ok(g.r >= 1.5 - 1e-6 && g.r <= 3 + 1e-6, `giant base radius ${g.r}`); }
  for (const m of mids) { assert.ok(m.h >= 20 && m.h <= 40, `mid height ${m.h}`); assert.ok(m.r >= 0.45 - 1e-6 && m.r <= 1.1 + 1e-6, `mid base radius ${m.r}`); }
  const again = new K.RedwoodForest({ doc, plan: layout.plan, clear: () => true });   // deterministic: every player sees the same forest
  assert.equal(again.x[0], forest.x[0]); assert.equal(again.ht[17], forest.ht[17]);
  for (const g of giants) assert.ok(layout.plan.plotDist(g.x, g.z) >= K.REDWOOD.forest.coreClearM, 'no giant on anyone\'s plot');
});

// risk: wood economy. Giants are scenery: no harvestable prop sits on a giant, and giants are not doc objects at all.
test('giants are not choppable', () => {
  const harvest = new Set(['c:pine', 'c:deadtree', 'c:youngred']);
  assert.ok(!doc.objects.some((o) => o.kind === 'giant' || o.type === 'c:giant'));
  for (const o of doc.objects) if (harvest.has(o.type)) for (const g of giants) if (Math.abs(g.x - o.x) < 4 && Math.abs(g.z - o.z) < 4) assert.ok(Math.hypot(g.x - o.x, g.z - o.z) > g.r, `${o.type} ${o.id} stands inside a giant`);
  assert.equal(forest.stats().giants, giants.length);
});

// risk: walking through trees. A trunk blocks its tiles; a straight walk through it is refused and a path goes round.
test('a redwood trunk blocks walking', () => {
  const g = giants.find((t) => t.x > 400 && t.z > 300 && nav.standable(t.x - t.r - 3, t.z) && nav.standable(t.x + t.r + 3, t.z));
  assert.ok(g, 'a giant with open ground either side');
  assert.equal(nav.standable(g.x, g.z), false);
  assert.equal(nav.los(g.x - g.r - 3, g.z, g.x + g.r + 3, g.z), false, 'no straight walk through the trunk');
  const p = nav.find(g.x - g.r - 3, g.z, g.x + g.r + 3, g.z);
  assert.ok(p && p.length, 'a way round');
  let prev = [g.x - g.r - 3, g.z];
  for (const q of p) { for (let s = 0; s <= 20; s++) { const x = prev[0] + (q[0] - prev[0]) * s / 20, z = prev[1] + (q[1] - prev[1]) * s / 20; assert.ok(Math.hypot(x - g.x, z - g.z) >= g.r, 'the path stays out of the trunk'); } prev = q; }
});

// risk: raids. The homestead must still connect to a point raiders come from, through the bigger world.
test('the home plot still connects to a raid point by the nav grid', () => {
  const ok = layout.outside.filter((o) => nav.find(layout.start.x, layout.start.z, o.x, o.z, { range: 1.5 }));
  assert.ok(ok.length >= 1, 'at least one outside point is reachable');
});

// risk: path search memory. Windowed A* on a big map finds the same path as a whole-map search, without full-world arrays.
test('windowed A* matches a whole-map search and reuses its scratch memory', () => {
  const g = giants.find((t) => t.x > 600 && t.z > 400), a = [g.x - 30, g.z - 20], b = [g.x + 30, g.z + 25];
  const win = JSON.stringify(nav.find(a[0], a[1], b[0], b[1]));
  const keep = K.NavGrid.FULL_SEARCH_TILES; K.NavGrid.FULL_SEARCH_TILES = Infinity; nav.scratch = null;
  let whole; try { whole = JSON.stringify(nav.find(a[0], a[1], b[0], b[1])); } finally { K.NavGrid.FULL_SEARCH_TILES = keep; nav.scratch = null; }
  assert.ok(win !== 'null', 'a path'); assert.equal(win, whole);
  nav.find(a[0], a[1], b[0], b[1]); const sc = nav.scratch; nav.find(a[0] + 5, a[1], b[0], b[1] - 5);
  assert.equal(nav.scratch, sc, 'scratch reused'); assert.ok(sc.n < doc.w * doc.h / 100, `scratch is a window (${sc.n} tiles), not the world`);
});

// risk: memory blow-up. Streaming keeps the live chunk count bounded wherever the camera goes, and full detail near it.
test('chunk streaming keeps a bounded set of chunks around a moving camera', () => {
  const S = K.REDWOOD.stream, CH = 16, st = new K.ChunkStreamer({ ncx: Math.ceil(doc.wu / CH), ncz: Math.ceil(doc.hu / CH), chunkM: CH, nearM: S.nearM, farM: S.farM, hysteresisM: S.hysteresisM, budget: S.buildsPerFrame });
  const live = new Map(), reach = S.farM + S.hysteresisM + CH * 1.5, bound = Math.ceil(Math.PI * reach * reach / (CH * CH));
  let max = 0;
  const step = (x, z) => { const p = st.plan(x, z, live); for (const k of p.drop) live.delete(k); for (const r of p.relod) live.set(r.key, r.lod); for (const c of p.create) live.set(c.key, c.lod); max = Math.max(max, live.size); return p; };
  for (let t = 0; t <= 1; t += 0.002) step(100 + t * 2500, 80 + t * 1800);   // a walk right across the map
  assert.ok(max <= bound, `live chunks ${max} <= ${bound}`);
  assert.ok(max < (doc.w / 32) * (doc.h / 32) / 50, 'a small fraction of the world');
  for (let n = 0; n < 400; n++) step(2600, 1880);   // stand still until it settles
  for (const [k, lod] of live) { const ci = k % st.ncx, cj = (k - ci) / st.ncx, d = st.dist(ci, cj, 2600, 1880); assert.ok(d <= reach, 'nothing far behind is kept'); if (d <= S.nearM) assert.equal(lod, 0, 'full detail near the view'); }
  assert.ok(live.has(st.key(Math.floor(2600 / CH), Math.floor(1880 / CH))), 'the chunk under the camera is live');
});

// risk: save compatibility. Old saves (560-wide terrain diffs) land on the same tiles; new saves never feed an older build bad data.
test('saves load both ways across the map change', () => {
  const C = K.SaveCompat, J = (v) => JSON.parse(JSON.stringify(v)), oldSave = { terrain: [[120 * 560 + 300, 9, K.T.DIRT]] };
  assert.deepEqual(J(C.ground(oldSave, doc.w, doc.h)), [[120 * doc.w + 300, 9, K.T.DIRT]], 'old dug tile -> same (i, j) on the big map');
  const fresh = { ground: { w: doc.w, h: doc.h, list: [[3000 * doc.w + 4000, 4, K.T.DIRT]] }, terrain: [] };
  assert.deepEqual(J(C.ground(fresh, doc.w, doc.h)), fresh.ground.list);
  assert.deepEqual(J(C.ground(fresh, 560, 400)), [], 'an older map drops ground beyond its edge instead of misplacing it');
  const cap = C.split({ home: { x: 320, z: 200, turns: 0 }, smithy: { x: 2000, z: 1500, turns: 1 }, market: null, halls: { bakery: { x: 3000, z: 100, turns: 0 }, stable: { x: 40, z: 40, turns: 2 } } });
  assert.equal(cap.smithy, null, 'a workshop out in the forest is hidden from older builds');
  assert.deepEqual(J(Object.keys(cap.halls)), ['stable']);
  const back = J(C.merge(cap));
  assert.deepEqual(back.smithy, { x: 2000, z: 1500, turns: 1 }); assert.deepEqual(Object.keys(back.halls).sort(), ['bakery', 'stable']); assert.deepEqual(back.home, { x: 320, z: 200, turns: 0 });
});
