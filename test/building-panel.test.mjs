/* BuildingPanel composed from sections: what it lets you do to your own building vs someone else's. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const engine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/engine');
const FILES = ['122-castle-panel-text.js', '122-castle-status-section.js', '122-castle-livestock-order-section.js',
  '122-castle-holdings-section.js', '122-castle-options-section.js', '122-castle-upgrade-section.js',
  '122-castle-takedown-section.js', '122-castle-piece-section.js', '122-castle-material-section.js', '122-castle-inspector.js'];

class FakeElement {
  constructor() { this.hidden = false; this.innerHTML = ''; }
  appendChild() {} addEventListener() {} remove() {}
}

/** a click on a button carrying one data attribute */
function click(attr, value) {
  const dataset = {};
  if (value !== undefined) dataset[attr.replace(/^data-/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase())] = String(value);
  return { target: { closest: (selector) => (selector === `[${attr}]` ? { dataset } : null) } };
}

function setup() {
  const K = {
    CastleData: { resName: (r) => r },
    CastleUI: { SHORT: {}, PIECE_ICON: {}, ICON: {}, RES_ORDER: [] },
    Icons: { img: () => '<img>' },
    LIVESTOCK: { chicken: { price: 5, max: 12 }, cow: { price: 20, max: 6 } },
  };
  const context = { K, Math, Object, String, Number, Set, document: { createElement: () => new FakeElement(),
    body: new FakeElement(), addEventListener() {}, removeEventListener() {} } };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of FILES) vm.runInContext(fs.readFileSync(path.join(engine, file), 'utf8'), context);
  const calls = { configure: [], demolish: [], upgrade: [], modals: [], actions: [] };
  const order = { enabled: false, target: 3, remaining: 4 };
  const game = {
    data: { piece: (type) => ({ name: type, effect: 'Keeps hens.' }) },
    castle: {
      producesOf: () => null, refundFor: () => ({ wood: 2 }), canDemolish: () => true, upgradeInfo: () => null,
      upgradePayback: () => null, isFrosted: () => false, isFull: () => false,
    },
    economy: {
      ledger: () => ({ goods: { egg: 4 } }), wheatHeld: () => 100,
      stock: { herd: () => [1, 2], orders: { get: () => order, configure: (p, change) => calls.configure.push(change) } },
    },
    pieceHpMax: () => 50,
    actionsFor: () => [{ id: 'inspect' }, { id: 'feed', label: 'Feed' }],
    play: { doAction: (e, action) => calls.actions.push(action.id) },
    upgrade: (p) => calls.upgrade.push(p),
    demolishPiece: (p) => { calls.demolish.push(p); return true; },
    cui: { modal: (html, buttons) => calls.modals.push({ html, buttons }), art: { html: () => '<i></i>' } },
    changed() {},
  };
  game.mp = { world: { owners: { ann: 'Ann' } }, teamId: () => null };
  const panel = new K.BuildingPanel(game);
  return { panel, calls, game };
}

const mine = { type: 'c_piece', piece: { type: 'coop', hp: 40 } };
const theirs = { type: 'c_rpiece', rec: { p: { type: 'coop', hp: 40, owner: 'ann' } } };

test('your coop shows its stock, animals, order, options and take-down', () => { // risk: data accuracy
  const { panel } = setup();
  panel.piece(mine);
  const html = panel.root.innerHTML;
  assert.match(html, /4 egg/);
  assert.match(html, /2 hens/);
  assert.match(html, /data-order-toggle/);
  assert.match(html, /data-building-action="feed"/);
  assert.doesNotMatch(html, /data-building-action="inspect"/);
  assert.match(html, /data-takedown/);
});

test('another player\'s building cannot be ordered for, upgraded or taken down from your panel', () => { // risk: permissions
  const { panel, calls } = setup();
  panel.piece(theirs);
  const html = panel.root.innerHTML;
  assert.match(html, /Ann/);
  assert.doesNotMatch(html, /data-takedown|data-order-toggle|data-upgrade/);
  panel.onClick(click('data-order-toggle'));
  panel.onClick(click('data-takedown'));
  panel.onClick(click('data-upgrade'));
  assert.deepEqual([calls.configure.length, calls.modals.length, calls.upgrade.length], [0, 0, 0]);
});

test('livestock order buttons change the target and switch it on', () => { // risk: money (wheat spent on orders)
  const { panel, calls } = setup();
  panel.piece(mine);
  panel.onClick(click('data-order-target', 4));
  panel.onClick(click('data-order-toggle'));
  assert.equal(calls.configure[0].target, 4);
  assert.equal(calls.configure[1].enabled, true);
});

test('take down asks first, demolishes only on yes, then closes the panel', () => { // risk: irreversible action
  const { panel, calls } = setup();
  panel.piece(mine);
  panel.onClick(click('data-takedown'));
  assert.equal(calls.demolish.length, 0, 'nothing happens before confirming');
  const yes = calls.modals[0].buttons.find((b) => b.run);
  assert.match(calls.modals[0].html, /2 wood/);
  yes.run();
  assert.equal(calls.demolish.length, 1);
  assert.equal(panel.root.hidden, true);
});

test('an option button runs that building action', () => { // risk: wrong action dispatched
  const { panel, calls } = setup();
  panel.piece(mine);
  panel.onClick(click('data-building-action', 'feed'));
  assert.deepEqual(calls.actions, ['feed']);
});
