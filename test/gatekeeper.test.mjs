/* Gatekeeper access decisions: hostile exclusion, team access and day/night policy. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine/128-castle-gatekeeper.js');
const context = { Math, Map, Set, K: {} };
context.globalThis = context; vm.createContext(context);
vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Policy = context.K.GatePolicy;
const gate = { x: 0, z: 0 };
const player = (props = {}) => ({ x: 2, z: 0, alive: true, ...props });

test('gate policy accepts non-hostile local actors and teammates, but rejects hostile and non-team players', () => { // risk: access control
  const policy = new Policy();
  const game = { mp: { mayUse: (id) => id === 'ally' }, play: { actors: [] } };
  assert.equal(policy.friendly(player(), game), true, 'local player/worker is permitted');
  assert.equal(policy.friendly(player({ hostile: true }), game), false, 'hostile NPC is refused');
  assert.equal(policy.friendly(player({ remote: true, pid: 'ally' }), game), true, 'teammate is permitted');
  assert.equal(policy.friendly(player({ remote: true, pid: 'stranger' }), game), false, 'non-team player is refused');
});

test('gate policy closes at night but stays responsive during dusk warning', () => { // risk: security
  const policy = new Policy();
  assert.equal(policy.night({ day: { isNight: true }, isNightish: () => true }), true);
  assert.equal(policy.night({ day: { isNight: false }, isNightish: () => true }), false);
});

test('gatekeeper opens for a friendly arrival and shuts when a hostile approaches', () => { // risk: hostile exclusion
  const Keeper = context.K.GateKeeper;
  const actor = player();
  const calls = [];
  const gate = { uid: 1, type: 'gate', x: 0, z: 0, bridge: {
    open: false, occupied: () => false, apply() {},
  } };
  const tower = { uid: 2, type: 'stone_tower', hp: 100, x: 4, z: 0 };
  const game = {
    castle: { pieces: [gate, tower] }, play: { t: 0, actors: [actor] },
    day: { isNight: false }, isNightish: () => false, mp: { avatars: { by: new Map() }, gate: (_gate, open) => calls.push(open) },
  };
  const keeper = new Keeper(game);
  keeper.update(0.1);
  assert.equal(gate.gatekeeper, tower);
  assert.equal(tower.keeperGate, gate);
  assert.equal(gate.bridge.open, true, 'a friendly arrival opens the gate');
  actor.hostile = true;
  keeper.update(0.1);
  assert.equal(gate.bridge.open, false, 'a hostile arrival shuts the gate');
  assert.deepEqual(calls, [true, false], 'state changes are broadcast to the server');
});


test('gate policy opens for a nearby teammate avatar but not a non-team avatar', () => { // risk: multiplayer access control
  const policy = new Policy();
  const game = { mp: {
    mayUse: (id) => id === 'ally',
    avatars: { by: new Map([['ally', { a: player({ remote: true, pid: 'ally' }) }]]) },
  }, play: { actors: [] } };
  assert.equal(policy.nearbyFriendly(gate, game), true, 'teammate avatar is welcomed');
  game.mp.avatars.by.set('stranger', { a: player({ remote: true, pid: 'stranger' }) });
  game.mp.avatars.by.delete('ally');
  assert.equal(policy.nearbyFriendly(gate, game), false, 'unaffiliated avatar cannot trigger opening');
});
