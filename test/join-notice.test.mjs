/* A full world (or a dead server) is said out loud with a retry, and a recycled plot leaves everyone's map. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine');
const context = { Math, Map, Set, JSON, String, Promise, Object, K: {} };
context.globalThis = context; vm.createContext(context);
for (const file of ['115-castle-join-notice.js', '115-castle-freed-plots.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context);
}
const { JoinNotice, FreedPlots } = context.K;

class FakeElement {
  constructor(doc) { this.doc = doc; this.children = {}; this.removed = false; }
  set innerHTML(html) {
    this.children.h2 = { textContent: '' };
    this.children.p = { textContent: '' };
    this.buttons = [...html.matchAll(/data-act="(\w+)"/g)].map((m) => ({
      dataset: { act: m[1] }, listeners: [], addEventListener(type, fn) { this.listeners.push(fn); }, click() { for (const fn of this.listeners) fn(); },
    }));
  }
  querySelector(sel) { return this.children[sel]; }
  querySelectorAll() { return this.buttons; }
  remove() { this.removed = true; }
}
class FakeDocument {
  constructor() { this.shown = []; this.body = { appendChild: (el) => this.shown.push(el) }; }
  createElement() { return new FakeElement(this); }
}

// risk: availability — a full world must tell the player, not drop them silently into a solo game.
test('a full world shows the friendly message and Retry resolves to retry', async () => {
  const doc = new FakeDocument(), notice = new JoinNotice(doc);
  const answer = notice.ask(Object.assign(new Error('the map is full'), { code: 'full', max: 30 }));
  const card = doc.shown[0];
  assert.equal(card.children.p.textContent, 'This world is full right now (30 settlers online). Try again in a moment.');
  card.buttons.find((b) => b.dataset.act === 'retry').click();
  assert.equal(await answer, 'retry');
  assert.equal(card.removed, true);
});

test('any other join failure is visible too, and Play alone is an explicit choice', async () => {
  const doc = new FakeDocument(), notice = new JoinNotice(doc);
  const answer = notice.ask(new Error('timed out'));
  const card = doc.shown[0];
  assert.match(card.children.p.textContent, /did not answer \(timed out\)/);
  card.buttons.find((b) => b.dataset.act === 'alone').click();
  assert.equal(await answer, 'alone');
});

// risk: synchronization — a recycled plot's cottage and door must leave the map, but never your own plot.
test('a freed plot removes that cottage, its door and its owner label', () => {
  const removed = [], unflagged = [], groupRemoved = [];
  const world = {
    doors: new Map([[4, { door: { leaf: 'leaf4' } }]]), cottages: new Set(['home:4', 'home:5']),
    owners: { 4: 'Ann', ann12345: 'Ann' }, houseAt: { ann12345: { x: 1, z: 1 } }, removeBuilding: (id) => removed.push(id),
  };
  const g = { L: { slot: 5 }, group: { remove: (o) => groupRemoved.push(o) }, flags: { unflag: (id) => unflagged.push(id) } };
  const freed = new FreedPlots({ world, g });
  freed.free({ slot: 4, owner: 'ann12345' });
  assert.deepEqual(removed, ['home:4']);
  assert.equal(world.doors.has(4), false);
  assert.equal(world.cottages.has('home:4'), false);
  assert.equal(world.owners[4], undefined);
  assert.equal(world.houseAt.ann12345, undefined);
  assert.deepEqual(groupRemoved, ['leaf4']);
  assert.deepEqual(unflagged, ['rh4']);
  freed.free({ slot: 5, owner: 'me' });
  assert.deepEqual(removed, ['home:4']);
});

test('a reconnect welcome that says evicted tells the player their plot was taken', () => {
  let evicted = 0;
  const handlers = {}, net = { on: (type, fn) => { handlers[type] = fn; } };
  new FreedPlots({ onEvicted: () => { evicted++; } }).listen(net);
  handlers.welcome({ evicted: false });
  handlers.welcome({ evicted: true });
  assert.equal(evicted, 1);
});
