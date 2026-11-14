/* Play-mode navigation (src/engine/58-nav.js): the A* the player walks with when you click something. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

class NavSandbox {
  constructor() {
    this.ctx = vm.createContext({ console, Math, performance: { now: () => 0 } });
    this.ctx.window = this.ctx; this.ctx.self = this.ctx; this.ctx.globalThis = this.ctx;
    for (const f of ['engine/11-core.js', 'engine/13-textures.js', 'engine/20-world.js', 'engine/58-nav.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), this.ctx, { filename: f });
  }
  get K() { return this.ctx.K; }
  /* a flat open field with a solid block of tiles (like the Keep's walls) */
  field(w, h, block) {
    const K = this.K, doc = new K.WorldDoc(w, h);
    const nav = new K.NavGrid(doc);
    if (block) for (let j = block.j0; j <= block.j1; j++) for (let i = block.i0; i <= block.i1; i++) nav.walk[j * w + i] = 0;
    return nav;
  }
}
const box = new NavSandbox();

// risk: core loop blocked. The Keep's approach point lies on a tile corner (26, 27.5); its nearest tile centres
// are TILE/sqrt2 = 0.354 away, more than the 0.3 approach range, so "Light the hearth" said "You can't reach".
test('a range goal on a tile corner is reachable when the range is smaller than half a tile diagonal', () => {
  const nav = box.field(128, 96, { i0: 44, i1: 51, j0: 44, j1: 51 });
  const path = nav.find(27.75, 27.75, 26, 27.5, { range: 0.3 });
  assert.ok(path && path.length, 'a path to the Keep approach point');
  const [x, z] = path[path.length - 1];
  assert.ok(Math.hypot(x - 26, z - 27.5) <= 0.3, `stops within the 0.3 range (stopped ${Math.hypot(x - 26, z - 27.5).toFixed(3)} away)`);
});

// risk: walking through walls. A goal inside a sealed block stays unreachable.
test('a goal deep inside solid tiles is still unreachable', () => {
  const nav = box.field(64, 64, { i0: 20, i1: 40, j0: 20, j1: 40 });
  assert.equal(nav.find(5, 5, 15, 15, { range: 0.6 }), null);
});

// risk: actions fire from too far away. A normal range still ends near the goal.
test('a normal range goal ends within that range', () => {
  const nav = box.field(64, 64);
  const path = nav.find(2.25, 2.25, 12.1, 9.3, { range: 1.2 });
  const [x, z] = path[path.length - 1];
  assert.ok(Math.hypot(x - 12.1, z - 9.3) <= 1.2);
});
