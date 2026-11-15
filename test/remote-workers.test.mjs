/* Other players' townsfolk: you can talk to them, and their shopkeepers trade their owner's goods; their wolves stay foes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine');
const context = { Math, Map, Set, JSON, String, K: {} };
context.globalThis = context; vm.createContext(context);
for (const file of ['59-interact.js', '115-castle-mob-pool.js', '115-castle-remote-mobs.js', '115-castle-remote-workers.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context);
}
const { RemoteMobs, Interactions } = context.K;

class FakeView {
  constructor() { this.dir = { x: 1, z: 0 }; this.state = 'idle'; this.stateT = 1; }
  setVisible() {}
  setPosition() {}
  setState(s) { this.state = s; }
  setFacing() {}
  setTint() {}
  dispose() {}
}

/* Bo's game, seeing creatures that Ann's game runs; `shown` records the dialogs and trades that open */
class BoGame {
  constructor() {
    this.shown = [];
    this.traded = [];
    this.play = { t: 0, actors: [], target: null, hover: null, me: { x: 0, z: 0, view: new FakeView() } };
    this.play.ext = this;
    this.cui = { modal: (html) => this.shown.push(html), toast: (text) => this.shown.push(text) };
    this.workers = { trade: (owner, at) => this.traded.push({ owner, at: { x: at.x, z: at.z } }) };
    this.mp = { avatars: { by: new Map([['ann', { name: 'Ann' }]]) }, mayUse: () => false };
  }
  addActor(cfg) { const a = { ...cfg, type: cfg.role, view: new FakeView(), alive: true }; this.play.actors.push(a); return a; }
  /** Ann's creature appears near Bo; returns its actor */
  see(id, kind, name, x = 3, z = 4) {
    const mobs = new RemoteMobs(this, { send() {} });
    mobs.update('ann', [[id, kind, x, z, 0, 0, 'idle', 30, 30, name]]);
    mobs.pick();
    return mobs.find('ann', id).a;
  }
  actions(actor) { return Array.from(Interactions.actions(actor, this.play), (a) => a.id); }   // a plain array of this realm
  run(actor, id) { Interactions.actions(actor, this.play).find((a) => a.id === id).run(this.play, actor); }
}

// risk: multiplayer interaction. QA on prod: Bo clicked Ann's baker and nothing happened.
test("another player's shop worker can be talked to and traded with at the owner's shop", () => {
  const bo = new BoGame();
  const baker = bo.see('wk:bakery', 'person:witch', 'Baker', 7, -2);
  assert.deepEqual(bo.actions(baker), ['talk', 'trade'], 'a remote baker offers Talk then Trade');
  bo.run(baker, 'talk');
  assert.match(bo.shown[0], /Baker of Ann's town/, 'talking names the worker, their trade and whose town it is');
  bo.run(baker, 'trade');
  assert.deepEqual(bo.traded, [{ owner: 'ann', at: { x: 7, z: -2 } }], "trade opens Ann's market at the worker's position");
});

// risk: multiplayer interaction. Workers who don't keep a shop still talk, but offer no trade.
test("another player's farmer talks but has nothing to trade", () => {
  const bo = new BoGame();
  const farmer = bo.see('wk:farm', 'person:ranger', 'Farmer');
  assert.deepEqual(bo.actions(farmer), ['talk']);
  assert.equal(farmer.hostile, false, 'a townsperson is not a foe');
});

// risk: combat. Someone else's wolf must stay a foe you attack, never a talking townsperson.
test("another player's wolf offers no talk or trade and stays hostile", () => {
  const bo = new BoGame();
  const wolf = bo.see('w1', 'wolf', 'Wolf');
  assert.deepEqual(bo.actions(wolf).filter((id) => id === 'talk' || id === 'trade'), []);
  assert.equal(wolf.hostile, true);
});
