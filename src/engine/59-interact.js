/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · interaction registry + game data (bestiary, dialogue, shop stock).

   Anything clickable in play mode is an "entity" with a `type`. The registry maps a type to a spec:
     {
       name?(entity) -> string,         label in menus and tooltips
       cursor(entity, game) -> icon id, hover cursor (see K.Icons)
       color: 0xRRGGBB,                 hover ring colour
       actions(entity, game) -> [ { id, label, icon, range?, danger?, run(game, entity) } ],
       inspect?(entity, game) -> { title, sub, body, rows: [[label, value]] },
       node?: { charges, respawn }      resource-style entities get a charge counter
     }
   An action with `range` makes the player walk into range first; `run` then gets the game API
   (see PlayMode: player, toast, float, channel, engage, openDialogue, openTrade, inspect, gather, takeLoot).

   New kinds of thing plug in without touching play-mode code:
     1. give a prop in PropBuilder.PROPS an `interact: '<type>'` key, and
     2. K.Interactions.register('<type>', spec).
   Example (a bed that restores HP):
     K.Interactions.register('bed', { cursor: () => 'hand', color: 0xffe08a, actions: () => [
       { id: 'sleep', label: 'Sleep', icon: 'hand', range: 1.1, run: (game) => game.channel({ label: 'Sleeping…', time: 3,
         onDone: () => { game.player.healFull(); game.toast('You wake rested.'); } }) } ] }); */
(function (G) {
  const K = G.K;

  class InteractionRegistry {
    constructor() { this.types = new Map(); }
    register(type, spec) { this.types.set(type, spec); return this; }
    has(type) { return this.types.has(type); }
    get(type) { return this.types.get(type) || null; }
    actions(entity, game) { const s = this.get(entity.type); return s ? (s.actions(entity, game) || []).filter((a) => !a.when || a.when(entity, game)) : []; }
    cursor(entity, game) { const s = this.get(entity.type); return (s && s.cursor && s.cursor(entity, game)) || 'hand'; }
    color(entity) { const s = this.get(entity.type); return (s && s.color) || 0xffffff; }
    inspect(entity, game) { const s = this.get(entity.type); return s && s.inspect ? s.inspect(entity, game) : { title: entity.name, body: '' }; }
  }

  /* ---------- data ---------- */
  const BESTIARY = {
    ghoulA: { name: 'Frost Ghoul', level: 2, hp: 30, atk: 5, def: 1, speed: 1.7, cd: 1.35, reach: 0.8, xp: 14, coins: [2, 7], loot: [['dust', 1, 2, 1], ['bone', 1, 1, 0.6]], desc: 'A starved corpse the frost will not let rest. Slow, but it does not tire.' },
    ghoulB: { name: 'Pale Ghoul', level: 3, hp: 38, atk: 6, def: 2, speed: 1.8, cd: 1.3, reach: 0.8, xp: 18, coins: [3, 9], loot: [['dust', 1, 3, 1], ['bone', 1, 2, 0.7]], desc: 'Paler, older and meaner than its kin.' },
    troll: { name: 'Rime Troll', level: 6, hp: 95, atk: 10, def: 4, speed: 1.4, cd: 1.9, reach: 1.05, xp: 60, coins: [15, 30], loot: [['tusk', 1, 1, 1], ['bone', 2, 4, 1], ['iron', 1, 2, 0.5]], desc: 'Bridge-keeper, toll-taker, bone-breaker. Hits like a falling cliff.' },
    warden: { name: 'The Warden', level: 8, hp: 120, atk: 12, def: 6, speed: 2.1, cd: 1.2, reach: 0.85, xp: 70, coins: [10, 20], loot: [['bread', 1, 2, 1]], desc: 'An armoured knight sworn to the crossing.' },
    witch: { name: 'Rime Witch', level: 7, hp: 80, atk: 11, def: 3, speed: 2.0, cd: 1.4, reach: 0.9, xp: 60, coins: [10, 25], loot: [['herb', 2, 4, 1]], desc: 'Keeper of the wards. Her staff hums with cold light.' },
  };
  const ROLE_NAMES = { enemy: 'Enemy', npc: 'Friendly', merchant: 'Merchant', player: 'You' };

  const SHOP = [['iron_sword', 45], ['shield', 32], ['helm', 48], ['mail', 70], ['cloak', 28], ['boots', 12], ['charm', 55], ['potion', 18], ['bread', 4], ['pickaxe', 22], ['axe', 20], ['rod', 15]];

  /* dialogue trees: nodes of lines + choices; `give` hands items once (by `once` key), `trade` opens the shop */
  const DIALOGUE = {
    merchant: { start: 'hi', nodes: {
      hi: { text: ['Coin for goods, goods for coin. Simple as snow.', 'What will it be, traveller?'], choices: [{ label: 'Show me your wares.', trade: true }, { label: 'Any news from the pass?', next: 'news' }, { label: 'Goodbye.', end: true }] },
      news: { text: ['A troll has taken the bridge again. Bad for trade.', 'Bring me its tusk and I will pay you well for it.'], choices: [{ label: 'Show me your wares.', trade: true }, { label: 'Goodbye.', end: true }] },
    } },
    witch: { start: 'hi', nodes: {
      hi: { text: ['The rime is thick tonight, traveller.', 'Mind the ghouls by the old wall. They hate warmth, and anyone who has it.'], choices: [{ label: 'Who are you?', next: 'who' }, { label: 'Do you have anything for me?', next: 'gift', once: 'witch-gift', alt: 'gift2' }, { label: 'Farewell.', end: true }] },
      who: { text: ['I keep the wards on this crossing.', 'Without them the chasm would have swallowed the bridge long ago.'], choices: [{ label: 'Any advice?', next: 'advice' }, { label: 'Farewell.', end: true }] },
      advice: { text: ['Ghouls are slow. Strike, step back, strike again.', 'Trolls are not slow. Eat before you fight one.'], choices: [{ label: 'Thank you.', end: true }] },
      gift: { text: ['Take this draught. Drink it when the cold gets into your bones.'], give: [['potion', 1]], choices: [{ label: 'Thank you.', end: true }] },
      gift2: { text: ['I have given you what I can spare.'], choices: [{ label: 'Farewell.', end: true }] },
    } },
    warden: { start: 'hi', nodes: {
      hi: { text: ['Halt. State your business at the crossing.'], choices: [{ label: 'Just passing through.', next: 'pass' }, { label: 'I want to help.', next: 'help' }, { label: 'Never mind.', end: true }] },
      pass: { text: ['Then pass quickly, and keep to the path. The ice lies about how thick it is.'], choices: [{ label: 'Understood.', end: true }] },
      help: { text: ['Ore from the veins keeps our blades sharp, and pine keeps the fires lit.', 'Bring what you gather to the merchant. She pays fair.'], choices: [{ label: 'I will.', end: true }] },
    } },
    generic: { start: 'hi', nodes: { hi: { text: ['Cold night.'], choices: [{ label: 'It is.', end: true }] } } },
  };

  const DEFAULT_KIT = { coins: 30, bag: [['iron_sword', 1], ['axe', 1], ['pickaxe', 1], ['rod', 1], ['bread', 3]], equip: ['dress', 'hood', 'boots'] };

  /* ---------- default interaction specs ---------- */
  const reg = new InteractionRegistry();
  const INSPECT = { id: 'inspect', label: 'Inspect', icon: 'eye', run: (game, e) => game.inspect(e) };
  const actorCard = (e) => {
    const a = e.actor, b = a.info;
    return { title: a.name, sub: `Level ${a.level} · ${ROLE_NAMES[a.role] || a.role}${a.hostile && a.role !== 'enemy' ? ' (hostile)' : ''}`, body: b.desc || '', portrait: a.spriteId,
      rows: [['HP', `${Math.max(0, Math.ceil(a.hp))} / ${a.hpMax}`], ['Attack', a.atk], ['Defence', a.def]], hp: a.hp / a.hpMax };
  };
  const attack = { id: 'attack', label: 'Attack', icon: 'sword', danger: true, run: (game, e) => game.engage(e) };
  reg.register('enemy', { color: 0xff6a5a, cursor: () => 'sword', name: (e) => e.actor.name,
    actions: () => [Object.assign({}, attack, { danger: false }), INSPECT], inspect: actorCard });
  reg.register('npc', { color: 0x8fe0a0, cursor: (e) => (e.actor.hostile ? 'sword' : 'bubble'), name: (e) => e.actor.name,
    actions: (e) => (e.actor.hostile ? [attack, INSPECT] : [{ id: 'talk', label: 'Talk', icon: 'bubble', range: 1.35, run: (game, x) => game.openDialogue(x) }, INSPECT, attack]), inspect: actorCard });
  reg.register('merchant', { color: 0xffd27a, cursor: (e) => (e.actor.hostile ? 'sword' : 'coin'), name: (e) => e.actor.name,
    actions: (e) => (e.actor.hostile ? [attack, INSPECT] : [{ id: 'trade', label: 'Trade', icon: 'coin', range: 1.35, run: (game, x) => game.openTrade(x) }, { id: 'talk', label: 'Talk', icon: 'bubble', range: 1.35, run: (game, x) => game.openDialogue(x) }, INSPECT, attack]), inspect: actorCard });
  reg.register('loot', { color: 0xffd27a, cursor: () => 'bag', name: () => 'Loot',
    actions: () => [{ id: 'take', label: 'Take all', icon: 'bag', range: 0.8, run: (game, e) => game.takeLoot(e) }],
    inspect: (e) => ({ title: 'Loot', body: e.items.map(([id, n]) => n + ' × ' + id).join(', ') }) });

  /* resource nodes: Mine / Chop / Gather / Fish, with a tool check, charges and respawn */
  const gatherSpec = (o) => ({
    color: 0x9fd8ff, cursor: (e, game) => (game.nodeState(e).charges > 0 ? o.cursor : 'no'), node: { charges: o.charges, respawn: o.respawn },
    actions: (e) => [{ id: o.verb.toLowerCase(), label: o.verb, icon: o.cursor, range: e.r + 0.55, run: (game, x) => game.gather(x, o) }, INSPECT],
    inspect: (e, game) => {
      const n = game.nodeState(e), it = game.items.get(o.item);
      return { title: e.name, sub: 'Resource', body: o.desc, icon: o.item,
        rows: [['Action', o.verb], ['Needs', o.tool ? game.items.get(o.toolItem).name : 'nothing'], ['Yields', it.name], ['Left', n.charges > 0 ? `${n.charges} / ${n.max}` : 'depleted — regrows soon']] };
    },
  });
  reg.register('ore', gatherSpec({ verb: 'Mine', ing: 'Mining', cursor: 'pickaxe', tool: 'mine', toolItem: 'pickaxe', item: 'iron', xp: 6, charges: 3, time: 2.2, respawn: 30, desc: 'Rust-red iron glints in the rime-rock.' }));
  reg.register('tree', gatherSpec({ verb: 'Chop', ing: 'Chopping', cursor: 'axe', tool: 'chop', toolItem: 'axe', item: 'wood', xp: 5, charges: 3, time: 2.0, respawn: 35, desc: 'A straight pine, good for firewood and planks.' }));
  reg.register('herb', gatherSpec({ verb: 'Gather', ing: 'Gathering', cursor: 'herb', tool: null, item: 'herb', xp: 3, charges: 2, time: 1.4, respawn: 25, desc: 'Frostleaf grows where the snow is thinnest.' }));
  reg.register('fish', gatherSpec({ verb: 'Fish', ing: 'Fishing', cursor: 'rod', tool: 'fish', toolItem: 'rod', item: 'fish', xp: 5, charges: 3, time: 2.8, respawn: 30, desc: 'Black water under the ice. Something moves down there.' }));

  Object.assign(K, { InteractionRegistry, Interactions: reg, BESTIARY, DIALOGUE, SHOP, DEFAULT_KIT, ROLE_NAMES });
})(typeof window !== 'undefined' ? window : globalThis);
