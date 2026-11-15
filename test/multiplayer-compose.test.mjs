/* Multiplayer is a thin root that owns one handler per concern; these drive it through a fake socket. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const engine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine');
const FILES = [
  '115-castle-net.js', '115-castle-mp-presence-sync.js', '115-castle-mp-world-sync.js', '115-castle-mp-store-sync.js',
  '115-castle-mp-mob-sync.js', '115-castle-mp-locked-exits.js', '115-castle-mp-door-gate-sync.js',
  '115-castle-mp-combat-sync.js', '115-castle-mp-team-sync.js', '115-castle-mp-tribute-sync.js',
  '115-castle-mp-chat-sync.js', '115-castle-mp.js',
];

class FakeElement {
  constructor() { this.hidden = false; this.children = []; this.input = { value: '', addEventListener() {}, focus() {} }; }
  querySelector() { return this.input; }
  addEventListener() {}
  appendChild(child) { this.children.push(child); }
  remove() { this.removed = true; }
}

class FakeNet {
  constructor(welcome) { this.id = 'me'; this.welcome = welcome; this.handlers = new Map(); this.sent = []; this.ops = []; }
  on(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
  emit(type, message) { for (const fn of this.handlers.get(type) || []) fn(Object.assign({ t: type }, message)); }
  send(message) { this.sent.push(JSON.parse(JSON.stringify(message))); }
  op(o) { this.ops.push(o); }
  close() { this.closed = true; }
  now() { return Date.now(); }
}

class FakeAvatars {
  constructor() { this.by = new Map(); }
  add(p) { this.by.set(p.id, { name: p.name, a: { id: 'pl:' + p.id }, el: { classList: { toggle() {} } } }); }
  remove(id) { this.by.delete(id); }
  clear() { this.by.clear(); }
  say() {} relook() {} update() {} dispose() {} ticks() {}
}

class FakeRemoteStores {
  constructor() { this.by = new Map(); this.stock = {}; }
  upsert(s) { this.by.set(s.id, s); }
  gone(id) { this.by.delete(id); }
  dropOwner() {} flush() {}
  setStock(id, stock) { this.stock[id] = stock; }
}

function load() {
  const K = {
    CastleData: { resName: (r) => r[0].toUpperCase() + r.slice(1) },
    TILE: 0.5,
    RemoteWorld: class { constructor() { this.doors = new Map(); this.pieces = new Map(); this.owners = {}; this.houseAt = {}; }
      snapshot() {} relabel() {} flush() {} apply() {} reconcile() { return null; } },
    Avatars: FakeAvatars,
    RemoteStores: FakeRemoteStores,
    RemoteMobs: class { update() {} dropOwner() {} dispose() {} find() { return null; } },
    FarmSync: class { apply() {} update() {} dispose() {} publish() {} updateOwner() {} },
    InviteBoard: class { constructor(owner) { this.owner = owner; this.renders = 0; } render() { this.renders++; } dispose() {} },
  };
  const context = { K, Math, Map, Set, Date, JSON, Object, String, console, setTimeout,
    performance: { now: () => 1e6 }, document: { createElement: () => new FakeElement() } };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of FILES) vm.runInContext(fs.readFileSync(path.join(engine, file), 'utf8'), context);
  return K;
}

function makeGame(resources = {}) {
  const toasts = [], modals = [];
  const castle = {
    pieces: [], have: Object.assign({}, resources),
    amount(r) { return this.have[r] || 0; },
    spend(cost) { for (const [r, n] of Object.entries(cost)) if (this.amount(r) < n) return false;
      for (const [r, n] of Object.entries(cost)) this.have[r] -= n; return true; },
    add(r, n) { this.have[r] = this.amount(r) + n; return n; },
  };
  const game = {
    toasts, modals, castle, resume: true, L: { slot: 1 },
    cui: { root: new FakeElement(), toast: (t) => toasts.push(t), modal: (html, buttons) => modals.push({ html, buttons }) },
    banners: { on() {}, get: () => ({ color: 0 }) },
    sound: { play() {} }, purse: { refreshTeam() {} }, changed() {},
    home: { stores: [], door: { open: false, broken: false } },
    play: { me: { x: 0, z: 0 }, actors: [] },
  };
  return game;
}

function setup(welcome = {}, resources) {
  const K = load();
  const net = new FakeNet(Object.assign({ players: [], teams: [], invites: [] }, welcome));
  const game = makeGame(resources);
  const mp = new K.Multiplayer(game, net);
  net.sent.length = 0;
  return { K, net, game, mp };
}

test('the root is composed, not a chain of subclasses', () => { // risk: regression to the forbidden layer chain
  const { K, mp } = setup();
  assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(K.Multiplayer.prototype)), null, 'Multiplayer extends nothing');
  for (const handler of [mp.presence, mp.worldSync, mp.storeSync, mp.mobSync, mp.doors, mp.combat, mp.teams, mp.tribute, mp.chat]) {
    assert.equal(handler.mp, mp, 'each handler is owned by the root');
  }
});

test('every server message the old Multiplayer handled still has a listener', () => { // risk: dropped sync after refactor
  const { net } = setup();
  const types = ['join', 'house', 'pvphit', 'leave', 'resync', 'mobs', 'mobhurt', 'tick', 'op', 'farm', 'gate', 'door', 'hp',
    'locked', 'teams', 'invite', 'invites', 'declined', 'demand', 'paid', 'refused', 'fx', 'stores', 'store', 'stock', 'took',
    'raided', 'evicted', 'weather', 'chat', 'welcome', 'offline'];
  for (const type of types) assert.ok(net.handlers.has(type), `no listener for '${type}'`);
  assert.equal(net.handlers.get('leave').length, 2, 'leave drops the avatar and that player\'s creatures');
});

test('keys follow teams: you and teammates may use, strangers may not', () => { // risk: permissions
  const { net, mp } = setup();
  assert.equal(mp.mayUse('stranger'), false);
  assert.equal(mp.mayUse('me'), true);
  assert.equal(mp.mayUse(null), true, 'unowned things are open');
  net.emit('teams', { list: [{ id: 'red', members: ['me', 'ally'] }] });
  assert.equal(mp.mayUse('ally'), true);
  assert.equal(mp.mayUse('stranger'), false);
  assert.equal(mp.teamId('ally'), 'red');
  mp.world.doors.set(7, { owner: 'stranger', door: { broken: false } });
  mp.world.doors.set(8, { owner: 'ally', door: { broken: false } });
  assert.equal(mp.keyFor('home:7'), false, 'cannot sleep in a stranger\'s cottage');
  assert.equal(mp.keyFor('home:8'), true);
  assert.equal(mp.keyFor('smithy:ally'), true);
  assert.equal(mp.keyFor('smithy:stranger'), false);
});

test('an invitation waits, is replaced by a newer one from the same team, and accepting sends it once', () => { // risk: team join
  const { net, mp } = setup();
  net.emit('invite', { team: 'red', name: 'Ann', teamName: 'Reds' });
  net.emit('invite', { team: 'red', name: 'Ann', teamName: 'Reds' });
  assert.equal(mp.invites.length, 1);
  mp.acceptInvite('red');
  assert.deepEqual(net.sent, [{ t: 'team', a: 'accept', team: 'red' }]);
  assert.equal(mp.invites.length, 0);
  net.emit('invite', { team: 'blue', name: 'Bo', teamName: 'Blues' });
  mp.declineInvite('blue');
  assert.deepEqual(net.sent.at(-1), { t: 'team', a: 'decline', team: 'blue' });
  assert.equal(mp.invites.length, 0);
});

test('paying tribute spends exactly what was asked, and refusing when you cannot afford it', () => { // risk: money
  const rich = setup({}, { gold: 30 });
  rich.net.emit('demand', { from: 'bandit', name: 'Bandit', res: 'gold', n: 25 });
  rich.game.modals[0].buttons[0].run();
  assert.equal(rich.game.castle.amount('gold'), 5);
  assert.deepEqual(rich.net.sent, [{ t: 'pay', to: 'bandit', res: 'gold', n: 25 }]);

  const poor = setup({}, { gold: 10 });
  poor.net.emit('demand', { from: 'bandit', name: 'Bandit', res: 'gold', n: 25 });
  assert.equal(poor.game.modals[0].buttons[0].label, 'Cannot afford');
  poor.game.modals[0].buttons[0].run();
  assert.equal(poor.game.castle.amount('gold'), 10, 'nothing is taken');
  assert.deepEqual(poor.net.sent, [{ t: 'refuse', to: 'bandit' }]);

  poor.net.emit('paid', { name: 'Bandit', res: 'gold', n: 7 });
  assert.equal(poor.game.castle.amount('gold'), 17);
});

test('stock changes: yours update your barrel, others update the remote view', () => { // risk: data accuracy
  const { net, game, mp } = setup();
  const barrel = { id: 'b1', stock: 4, present: true, synced: 0, sync() { this.synced++; } };
  game.home.stores.push(barrel);
  net.emit('stock', { id: 'me:b1', stock: 1 });
  assert.equal(barrel.stock, 1);
  assert.equal(barrel.synced, 1);
  net.emit('stock', { id: 'ann:b9', stock: 6 });
  assert.equal(mp.stores.stock['ann:b9'], 6);
  assert.equal(barrel.stock, 1, 'another player\'s barrel never touches yours');
});

test('a raid taken from someone else\'s barrel lands in your stores', () => { // risk: money
  const { net, game } = setup();
  game.play.float = () => {};
  net.emit('took', { res: 'wood', n: 10 });
  assert.equal(game.castle.amount('wood'), 10);
});

test('joining with no barrels on the server publishes yours; joining with some takes the server\'s count', () => { // risk: data accuracy
  const K = load();
  const game = makeGame();
  game.home.stores.push({ id: 'b1', kind: 'barrel', name: 'Barrel', res: 'wood', x: 1, z: 2, stock: 9, present: true, sync() {} });
  const fresh = new FakeNet({ players: [], stores: [] });
  new K.Multiplayer(game, fresh);
  assert.equal(fresh.sent[0].t, 'stores');
  assert.equal(fresh.sent[0].list[0].stock, 9);

  const raided = new FakeNet({ players: [], stores: [{ id: 'me:b1', owner: 'me', stock: 3 }] });
  new K.Multiplayer(game, raided);
  assert.equal(game.home.stores[0].stock, 3);
});
