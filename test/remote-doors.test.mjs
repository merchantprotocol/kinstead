/* RemoteDoors: other settlers' doors follow the server's word on owner, health, broken and open. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine/115-castle-remote-doors.js');

function setup() {
  class Door { constructor() { this.ent = {}; this.applied = 0; this.open = false; this.broken = false; } apply() { this.applied++; } }
  const context = { K: { Door }, Object, Map };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const sounds = [];
  const game = { sound: { play: (s) => sounds.push(s) }, banners: { label: (id, name) => name || id } };
  const owners = { 4: 'Ann' };
  return { doors: new context.K.RemoteDoors(game, owners), sounds };
}

test('a new remote door is locked, named after its owner, and clickable', () => { // risk: access control
  const { doors } = setup();
  const rec = doors.add(4, {}, 'ann');
  assert.equal(rec.door.locked, true);
  assert.equal(rec.name, "Ann's door");
  assert.equal(doors.add(4, {}, 'x'), rec, 'adding the same slot twice keeps the first door');
  assert.equal(doors.entities()[0].type, 'c_rdoor');
});

test('a broken door stands open; mending shuts it unless the server says it is open', () => { // risk: siege state
  const { doors, sounds } = setup();
  const rec = doors.add(4, {}, 'ann');
  doors.doorMsg({ slot: 4, broken: true, hp: 0 });
  assert.deepEqual([rec.door.broken, rec.door.open, rec.hp], [true, true, 0]);
  assert.deepEqual(sounds, ['crack']);
  doors.doorMsg({ slot: 4, broken: false, owner: 'bo' });
  assert.deepEqual([rec.door.broken, rec.door.open, rec.owner], [false, false, 'bo'], 'captured: new owner, shut');
  doors.doorMsg({ slot: 9, broken: true });   // unknown slot is ignored
});

test('a resync redraws only doors whose broken state changed', () => { // risk: data accuracy
  const { doors } = setup();
  const rec = doors.add(4, {}, 'ann');
  const before = rec.door.applied;
  doors.apply({ 4: { owner: 'ann', hp: 2000, hpMax: 3000, broken: false } }, true);
  assert.equal(rec.door.applied, before);
  assert.equal(rec.hp, 2000);
  doors.apply({ 4: { owner: 'ann', hp: 0, hpMax: 3000, broken: true } }, true);
  assert.deepEqual([rec.door.broken, rec.door.open, rec.door.applied], [true, true, before + 1]);
});
