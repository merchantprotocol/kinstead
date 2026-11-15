import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const K = { CASTLE_DATA: JSON.parse(readFileSync(new URL('../src/data/game-data-castle.json', import.meta.url), 'utf8')) };
const context = { K, globalThis: { K } };
vm.runInNewContext(readFileSync(new URL('../src/engine/119b-castle-food-demand.js', import.meta.url), 'utf8'), context);

class FoodFixture {
  constructor() {
    this.castle = { stores: { bread: 1, beef: 1 }, amount: (good) => Math.floor(this.castle.stores[good] || 0),
      rates: () => ({ food: 4 }) };
    this.workers = { roster: () => [{}, {}] };
    this.economy = { g: this, ledgers: new Map(), pieces: [], stock: { all: [] },
      changed() {}, of: () => [] };
    this.food = new K.FoodDemand(this.economy);
  }
}

test('rations consume preferred food for each resident and player once per minute', () => {
  // risk: data accuracy — household consumption must include every worker plus the hero and use food preference order.
  const game = new FoodFixture();
  game.castle.stores.wheat = 3;
  const result = game.food.consume();
  assert.equal(result.fed, 3);
  assert.equal(result.hungry, 0);
  assert.equal(game.castle.stores.bread, 0);
  assert.equal(game.castle.stores.beef, 0);
  assert.equal(game.castle.stores.wheat, 0);
});

test('empty stores progress from slow work to stopped work and recover when fed', () => {
  // risk: core business rule — empty rations must mark starvation, and stored food must clear it on recovery.
  const game = new FoodFixture();
  game.food.consume();
  game.food.consume();
  assert.equal(game.food.starving(), true);
  game.castle.stores.food = 3;
  game.food.consume();
  assert.equal(game.food.starving(), false);
  assert.equal(game.food.emptyFor, 0);
});

test('workers slow after one missed ration and stop with a hunger report after two', () => {
  // risk: core business rule — workers must not keep working through sustained starvation and must report hunger.
  vm.runInNewContext(readFileSync(new URL('../src/engine/120e-worker-job.js', import.meta.url), 'utf8'), context);
  vm.runInNewContext(readFileSync(new URL('../src/engine/120c-work-errands.js', import.meta.url), 'utf8'), context);
  const food = { emptyFor: 60, starving: () => food.emptyFor >= 120 };
  const g = { economy: { food }, play: {} };
  const w = { g, night: { bedtime: false }, say() {}, };
  const job = new K.WorkerJob(w, { speed: 2, name: 'Miller' });
  let idled = false;
  job.idle = () => { idled = true; };
  const errands = { a: { path: [1], speed: 2 } };
  job.next(errands, 1);
  assert.equal(errands.a.speed, 1);
  assert.equal(idled, true);
  food.emptyFor = 120;
  idled = false;
  job.next(errands, 1);
  assert.equal(errands.a.path, null);
  assert.equal(idled, false);
  assert.deepEqual(Array.from(job.report()), ['I am hungry. Please bring food.']);
  const actor = { path: [1], speed: 2, view: { state: 'walk', carry: 'bread', setState(state) { this.state = state; } } };
  const brain = new K.Errands(g, actor, job);
  brain.go(4, 5);
  brain.update(1);
  assert.equal(brain.steps.length, 0);
  assert.equal(actor.path, null);
  assert.equal(actor.view.carry, null);
  assert.equal(actor.hungryStopped, true);
});
