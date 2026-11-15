/* Multiplayer creatures at 30 players: the sender only sends what changed, the receiver only animates the nearest. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine');
const context = { Math, Map, Set, JSON, String, K: {} };
context.globalThis = context; vm.createContext(context);
for (const file of ['115-castle-mob-caster.js', '115-castle-mob-pool.js', '115-castle-remote-mobs.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context);
}
const { MobCaster, RemoteMobs } = context.K;

class FakeView {
  constructor() { this.dir = { x: 1, z: 0 }; this.state = 'idle'; this.stateT = 1; this.visible = true; this.disposed = false; }
  setVisible(v) { this.visible = v; }
  setPosition() {}
  setState(s) { this.state = s; }
  setFacing() {}
  setTint() {}
  dispose() { this.disposed = true; }
}

class FakeGame {
  constructor() {
    this.built = 0;
    this.play = { t: 0, actors: [], target: null, hover: null, me: { x: 0, z: 0, view: new FakeView() } };
  }
  addActor(cfg) { this.built++; const a = { ...cfg, view: new FakeView(), alive: true }; this.play.actors.push(a); return a; }
}

const wolf = (id, x, z) => ({ id, x, z, y: 0, hp: 30, hpMax: 30, name: 'Wolf', alive: true, hostile: true, wolf: true, view: new FakeView() });

test('the caster sends static facts once, then only changed rows, and says which creatures are gone', () => {
  // risk: 30-player load and sync accuracy — unchanged creatures must cost nothing, removed ones must disappear.
  const game = new FakeGame(), sent = [], net = { ready: true, send: (m) => sent.push(JSON.parse(JSON.stringify(m))) };
  const caster = new MobCaster(game, net), a = wolf('w1', 10, 10), b = wolf('w2', 12, 10);
  game.play.actors.push(game.play.me, a, b);
  caster.cast();
  assert.equal(sent[0].full, 1);
  assert.deepEqual(sent[0].n.map((n) => n[0]), ['w1', 'w2']);
  assert.deepEqual(sent[0].u[0], ['w1', 10, 10, 0, 0, 'idle', 30]);
  caster.cast();
  assert.equal(sent.length, 1, 'nothing changed: nothing sent');
  a.x = 10.04;
  caster.cast();
  assert.equal(sent.length, 1, 'a 4 cm shuffle rounds away');
  a.x = 11.2;
  caster.cast();
  assert.deepEqual(sent[1], { t: 'mobs', v: 2, u: [['w1', 11.2, 10, 0, 0, 'idle', 30]] });
  game.play.actors.splice(game.play.actors.indexOf(b), 1);
  caster.cast();
  assert.deepEqual(sent[2].g, ['w2']);
  net.ready = false;
  a.x = 20;
  caster.update(1);
  assert.equal(sent.length, 3, 'offline: nothing is marked sent');
  net.ready = true;
  caster.reset();
  caster.update(1);
  assert.equal(sent[3].full, 1, 'a new connection gets the whole list');
});

test('remote creatures: only the nearest 60 within 70 m get actors, and actors are recycled, not rebuilt', () => {
  // risk: client frame rate at 30 players — hundreds of remote creatures must not each become an animated actor.
  const game = new FakeGame(), mobs = new RemoteMobs(game, {});
  const o = [];
  for (let owner = 0; owner < 6; owner++) {
    const rows = [], meta = [];
    for (let i = 0; i < 15; i++) { rows.push(['m' + i, owner * 8 + i * 0.3, 5, 0, 0, 'walk', 30]); meta.push(['m' + i, 'wolf', 30, 'Wolf']); }
    o.push(['p' + owner, 1, rows, meta, []]);
  }
  o.push(['far', 1, [['x', 500, 500, 0, 0, 'idle', 30]], [['x', 'wolf', 30, 'Wolf']], []]);
  mobs.batch({ t: 'mobz', o });
  mobs.tick(0.5);
  assert.deepEqual({ ...mobs.counts() }, { known: 91, shown: 60 });
  assert.equal(game.play.actors.length, 60);
  assert.equal(mobs.find('far', 'x'), null, 'a creature 700 m away has no actor');
  const near = mobs.find('p0', 'm0');
  assert.ok(near && near.a, 'the nearest creature is on screen');

  game.play.me.x = 500; game.play.me.z = 500;
  mobs.tick(0.5);
  assert.deepEqual({ ...mobs.counts() }, { known: 91, shown: 1 });
  const builtBefore = game.built;
  game.play.me.x = 0; game.play.me.z = 0;
  mobs.tick(0.5);
  assert.equal(game.built, builtBefore, 'walking back reuses the hidden actors');

  mobs.batch({ t: 'mobz', o: [['p0', 0, [], [], ['m0']]], out: ['p1'] });
  assert.equal(mobs.find('p0', 'm0'), null, 'a creature its owner removed is gone');
  assert.equal([...mobs.by.values()].some((r) => r.owner === 'p1'), false, 'an owner out of range is dropped');
});

test('an older server: whole per-owner lists still work, and silence still means gone', () => {
  // risk: backward compatibility during the deploy window
  const game = new FakeGame(), mobs = new RemoteMobs(game, {});
  mobs.update('old', [['w', 'wolf', 3, 3, 0, 0, 'walk', 20, 30, 'Wolf']]);
  mobs.tick(0.5);
  assert.ok(mobs.find('old', 'w'));
  game.play.t = 3;
  mobs.tick(0.1);
  assert.equal(mobs.by.size, 0);
  assert.equal(game.play.actors.length, 0);
});
