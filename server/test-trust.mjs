import assert from 'node:assert/strict';
import { GameRoom } from './src/index.js';

class FakeSocket {
  messages = [];
  send(value) { this.messages.push(JSON.parse(value)); }
  close() {}
}
class RoomHarness {
  constructor() {
    const storage = { get: async () => undefined, put: () => {}, delete: () => {} };
    this.room = new GameRoom({ storage, blockConcurrencyWhile: (fn) => fn() }, {});
    this.room.startTimer = () => {};
    this.room.broadcast = (message, except) => { for (const [ws, p] of this.room.sockets) if (p.joined && ws !== except) ws.send(JSON.stringify(message)); };
  }
  player(id, x = 0, z = 0) {
    const ws = new FakeSocket(), p = { id, cid: id, name: id, slot: 0, x, z, joined: true };
    this.room.sockets.set(ws, p);
    return { ws, p };
  }
}

// risk: permissions — another player cannot overwrite or delete an owned structure.
{
  const h = new RoomHarness(), { p: owner } = h.player('owner01'), { p: intruder } = h.player('intruder');
  h.room.applyOp(owner, { k: 'piece+', id: 'wall', type: 'palisade', x: 1, z: 2 });
  assert.notEqual(h.room.applyOp(owner, { k: 'piece+', id: 'wall', type: 'gate', x: 9, z: 9 }), false);
  assert.equal(h.room.world.pieces.wall.owner, owner.id);
  assert.equal(h.room.world.pieces.wall.type, 'gate');
  h.room.world.pieces.wall = { id: 'wall', type: 'palisade', owner: owner.id };
  assert.equal(h.room.applyOp(intruder, { k: 'piece+', id: 'wall', type: 'gate', x: 9, z: 9 }), false);
  assert.equal(h.room.world.pieces.wall.owner, owner.id);
  h.room.world.buildings.b = { id: 'b', owner: owner.id };
  assert.equal(h.room.applyOp(intruder, { k: 'bld+', id: 'b', spec: {} }), false);
  assert.equal(h.room.applyOp(intruder, { k: 'bld-', id: 'b' }), false);
  assert.equal(h.room.world.buildings.b.owner, owner.id);
}
// risk: permissions/abuse — mob damage is neither sent to teammates nor remotely spoofable.
{
  const h = new RoomHarness(), { ws: senderWs, p: sender } = h.player('sender01', 0, 0), { ws: targetWs, p: target } = h.player('target01', 100, 100);
  h.room.teams.t = { id: 't', members: [sender.id, target.id] };
  await h.room.onMessage(senderWs, sender, { t: 'mobbite', to: target.id, dmg: 40 });
  assert.equal(targetWs.messages.length, 0);
  h.room.teams = {};
  await h.room.onMessage(senderWs, sender, { t: 'mobbite', to: target.id, dmg: 40 });
  assert.equal(targetWs.messages.length, 0);
  target.x = 5; target.z = 5;
  await h.room.onMessage(senderWs, sender, { t: 'mobbite', to: target.id, dmg: 400 });
  assert.equal(targetWs.messages.at(-1).dmg, 40);
}
// risk: data integrity — owner resync cannot restore stock lost to a raid; each delta is bounded.
{
  const h = new RoomHarness(), { p: owner } = h.player('owner02'), { p: raider } = h.player('raider01', 1, 1);
  h.room.stores['owner02:barrel'] = { id: 'owner02:barrel', owner: owner.id, stock: 50, x: 1, z: 1, res: 'wood' };
  h.room.onTake(raider, { id: 'owner02:barrel', n: 8 });
  assert.equal(h.room.stores['owner02:barrel'].stock, 42);
  h.room.onStores(owner, { list: [{ id: 'barrel', stock: 50, res: 'wood', x: 1, z: 1 }] });
  assert.equal(h.room.stores['owner02:barrel'].stock, 42);
  h.room.onStore(owner, { id: 'barrel', stock: 50, res: 'wood', x: 1, z: 1 });
  assert.equal(h.room.stores['owner02:barrel'].stock, 42);
  h.room.onStock(owner, { id: 'barrel', d: 50000 });
  assert.equal(h.room.stores['owner02:barrel'].stock, 1041);
}
// risk: identity/synchronization — captures update the shared owner record and fresh joins spawn on their plot.
{
  const h = new RoomHarness(), { p: captor } = h.player('captor01', 30, 30);
  await new Promise((resolve) => setTimeout(resolve, 0));
  h.room.world.houses[0] = { owner: 'former01', name: 'Former', x: 30, z: 30, spec: {} };
  h.room.world.doors[0] = { owner: null, broken: true, hp: 0, hpMax: 100 };
  h.room.onInstall(captor, { slot: 0 });
  assert.equal(h.room.claimed()[0].id, captor.id);
  assert.equal(h.room.claimed()[0].name, captor.name);
  const observer = h.player('observer');
  const newcomer = h.player('newuser1');
  await h.room.onMessage(newcomer.ws, newcomer.p, { t: 'hello', cid: 'newuser1-cid', name: 'New' });
  const join = observer.ws.messages.find((m) => m.t === 'join' && m.p.id === 'newuser1');
  assert.ok(join);
  assert.notDeepEqual([join.p.x, join.p.z], [0, 0]);
  const replacement = h.player('replacement');
  await h.room.onMessage(replacement.ws, replacement.p, { t: 'hello', cid: 'newuser1-cid', name: 'New' });
  const events = observer.ws.messages.slice(join ? observer.ws.messages.indexOf(join) : 0);
  assert.ok(events.some((m) => m.t === 'leave' && m.id === 'newuser1'));
  assert.ok(events.some((m) => m.t === 'join' && m.p.id === 'newuser1'));
}
console.log('trust/sync assertions passed');
