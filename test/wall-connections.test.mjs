/* Local wall connectivity derives from piece positions; the mask is never persisted or sent. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine/82f-art-stone-wall.js');
const ctx = vm.createContext({ Math });
ctx.window = ctx; ctx.globalThis = ctx; ctx.K = { CastleArt: { register() {}, size: (type) => ({ gate: [2, 0.5], stone_gate: [4, 1.5], stone_tower: [1.5, 1.5] }[type] || [0.5, 0.5]) } };
vm.runInContext(fs.readFileSync(source, 'utf8'), ctx);
const mask = (type, pieces) => ctx.K.WallConnections.mask(pieces.find((p) => p.type === type), pieces);
const p = (type, x, z) => ({ type, x, z });

// risk: walls fail to join and gaps appear after placement/removal.
test('wall mask covers lone, straight, corner, T, cross and removal shapes', () => {
  assert.equal(mask('palisade', [p('palisade', 0, 0)]), 0);
  assert.equal(mask('palisade', [p('palisade', 0, 0), p('palisade', 0, -0.5)]), 1);
  assert.equal(mask('palisade', [p('palisade', 0, 0), p('palisade', 0.5, 0)]), 2);
  assert.equal(mask('stone_wall', [p('stone_wall', 0, 0), p('stone_wall', 0.5, 0), p('stone_wall', 0, -0.5)]), 3);
  assert.equal(mask('stone_wall', [p('stone_wall', 0, 0), p('stone_wall', 0.5, 0), p('stone_wall', 0, -0.5), p('stone_wall', -0.5, 0)]), 11);
  const pieces = [p('stone_wall', 0, 0), p('stone_wall', 0.5, 0), p('stone_wall', -0.5, 0), p('stone_wall', 0, -0.5), p('stone_wall', 0, 0.5)];
  assert.equal(ctx.K.WallConnections.mask(pieces[0], pieces), 15);
  pieces.pop();
  assert.equal(ctx.K.WallConnections.mask(pieces[0], pieces), 11);
});

// risk: placement order or orientation changes the connection calculation.
test('family rules join like walls and provide a stone cap at mixed wall joints', () => {
  assert.equal(mask('palisade', [p('palisade', 0, 0), p('stone_wall', 0, -0.5)]), 1);
  assert.equal(mask('stone_wall', [p('stone_wall', 0, 0), p('palisade', 0.5, 0)]), 2);
  assert.equal(mask('palisade', [p('palisade', 0, 0), p('stone_wall', 0.5, 0), p('stone_wall', 0, -0.5)]), 3);
});
