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

test('gate policy accepts your hero and teammates, but rejects workers, hostiles and non-team players', () => { // risk: access control
  const policy = new Policy();
  const me = player();
  const game = { mp: { mayUse: (id) => id === 'ally' }, play: { actors: [me], me } };
  assert.equal(policy.friendly(me, game), true, 'your own hero is permitted');
  assert.equal(policy.friendly(player({ worker: 'mason' }), game), false, 'a worker does not open the gate');
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
    castle: { pieces: [gate, tower] }, play: { t: 0, actors: [actor], me: actor },
    day: { isNight: false }, isNightish: () => false, mp: { avatars: { by: new Map() }, gate: (_gate, open) => calls.push(open) },
  };
  const keeper = new Keeper(game);
  keeper.update(0.1);
  assert.equal(gate.gatekeeper, tower);
  assert.equal(tower.keeperGate, gate);
  assert.equal(gate.bridge.open, true, 'a friendly arrival opens the gate');
  game.play.actors.push(player({ x: -2, hostile: true, wolf: true }));
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

/* a castle with a gatekept gate for the scenarios below: your hero `me`, `actors` near the gate, remote `avatars` */
class GateScene {
  constructor() {
    this.gate = { uid: 1, type: 'stone_gate', x: 0, z: 0, bridge: { open: false, occupied: () => false, apply() {} } };
    this.tower = { uid: 2, type: 'stone_tower', hp: 100, x: 4, z: 0 };
    this.me = player({ x: 40, z: 40, layer: 'ground' });
    this.avatars = new Map();
    this.game = {
      castle: { pieces: [this.gate, this.tower] }, play: { t: 0, actors: [this.me], me: this.me }, day: { isNight: false },
      mp: { avatars: { by: this.avatars }, mayUse: (id) => id === 'ally', gate() {} },
    };
    this.keeper = new context.K.GateKeeper(this.game);
  }
  get open() { return this.gate.bridge.open; }
  avatar(pid, props = {}) { this.avatars.set(pid, { a: player({ remote: true, pid, ...props }) }); return this.avatars.get(pid).a; }
  run(seconds) { for (let t = 0; t < seconds; t += 0.25) { this.game.play.t += 0.25; this.keeper.update(0.25); } }
}

// risk: castle security. QA on prod: the gate stood open with no one near. Workers, kin and townsfolk idling at the
// gate are not players coming through, and neither is your hero up on the wall walk over the gate.
test('the gate closes, and stays closed, with only workers, kin, animals or your hero up on the walls near it', () => {
  const s = new GateScene();
  s.game.play.actors.push(player({ worker: 'mason' }), player({ x: -1, kin: 'emberwright' }), player({ z: 2, prey: true, hostile: true }));
  s.gate.bridge.open = true;
  s.run(3);
  assert.equal(s.open, false, 'an idle worker, kin or deer at the gate does not hold it open');
  Object.assign(s.me, { x: 0, z: 0.5, layer: 'upper' });
  s.run(3);
  assert.equal(s.open, false, 'your hero walking the ramparts over the gate does not open it');
  s.me.layer = 'ground';
  s.run(0.25);
  assert.equal(s.open, true, 'your hero at the gate on the ground opens it');
  Object.assign(s.me, { x: 40, z: 40 });
  s.run(3);
  assert.equal(s.open, false, 'once you have gone through it closes behind you');
});

// risk: locked out of your own castle. A stranger loitering at the gate must not keep the owner out; it opens for the
// owner or a teammate and shuts right behind them. Wolves, bears and raiders still keep it shut.
test('a stranger at the gate cannot lock the owner or a teammate out, but gets no free pass', () => {
  const s = new GateScene();
  s.avatar('stranger', { x: 3 });
  s.run(1);
  assert.equal(s.open, false, 'a stranger alone never opens it');
  Object.assign(s.me, { x: 2, z: 0 });
  s.run(0.25);
  assert.equal(s.open, true, 'the owner arriving is let in even with a stranger beside the gate');
  Object.assign(s.me, { x: 40, z: 40 });
  s.run(0.25);
  assert.equal(s.open, false, 'and it shuts straight behind the owner while the stranger waits');
  s.avatar('ally', { x: -2 });
  s.run(0.25);
  assert.equal(s.open, true, 'a teammate is let in past the stranger too');
  s.game.play.actors.push(player({ x: 1, hostile: true, wolf: true }));
  s.run(0.25);
  assert.equal(s.open, false, 'a wolf at the gate keeps it shut even for a teammate');
});
