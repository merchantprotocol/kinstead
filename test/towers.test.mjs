/* Bowman combat uses real Tower and WolfDifficulty behavior with a deterministic flight simulator. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class TowerHarness {
  constructor(towerType = 'stone_tower') {
    const mesh = class {
      constructor(geometry) { this.geometry = geometry; this.position = { set() {} }; }
      lookAt() {}
    };
    const context = {
      Math, Map, Set, console,
      THREE: { Mesh: mesh, BoxGeometry: class { dispose() {} }, MeshLambertMaterial: class {} },
      K: {},
    };
    context.globalThis = context; vm.createContext(context);
    for (const file of ['97-castle-wild.js', '118-castle-towers.js']) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/engine', file), 'utf8'), context, { filename: file });
    }
    this.K = context.K;
    this.kills = 0; this.shots = 0; this.damageShown = [];
    this.play = {
      t: 0, actors: [], me: {}, nav: { y: () => 0 },
      kill: (actor) => { actor.alive = false; this.kills++; },
      float: (_actor, damage) => this.damageShown.push(Number(damage)),
    };
    this.tower = new this.K.Towers({
      play: this.play,
      castle: { pieces: [{ uid: 1, type: towerType, x: 0, z: 0 }] },
      group: { add: () => { this.shots++; }, remove() {} },
      sound: { play() {} },
    });
  }
  wolf(x, hp) {
    const actor = { x, z: 0, hp, alive: true, hostile: true, wolf: true, view: {} };
    this.play.actors.push(actor); return actor;
  }
  simulate(seconds, step = 0.05) {
    for (let t = 0; t < seconds; t += step) {
      this.tower.update(step); this.play.t += step;
    }
  }
}

test('watchtower and stone-tower bowmen kill a day-one lone wolf within two seconds', () => { // risk: core defense
  for (const type of ['watchtower', 'stone_tower']) {
    const h = new TowerHarness(type);
    const wolf = h.wolf(10, new h.K.Difficulty({ n: 1 }).nextWolf(false).hp);
    h.simulate(2);
    assert.equal(wolf.alive, false, `${type} kills the day-one 29 HP wolf`);
    assert.ok(h.damageShown.includes(30), `${type} applies wolf-specific damage`);
    assert.ok(h.shots > 0, `${type} visibly spawns arrows`);
  }
});

test('a stone-tower bowman clears a day-one pack before it reaches the wall', () => { // risk: defense against raids
  const h = new TowerHarness();
  const difficulty = new h.K.Difficulty({ n: 1 });
  for (let i = 0; i < difficulty.packSize; i++) h.wolf(20, difficulty.nextWolf(true).hp);
  h.simulate(5.5);
  assert.equal(h.kills, 10, 'the first-night pack is down before the 20m approach is crossed');
  assert.ok(h.shots >= 10, 'the bowman fires a visible arrow for each wolf');
});
