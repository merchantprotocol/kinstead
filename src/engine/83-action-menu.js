/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · ActionMenu: what you can do with a castle entity you clicked (the interaction registry asks this).
   One method per entity type; each action is { id, label, icon, run, range }. */
(function (G) {
  const K = G.K;

  class ActionMenu {
    /* entity type -> the method that lists its actions */
    static BY_TYPE = {
      c_keep: 'keepActions', c_ruin: 'ruinActions', c_site: 'siteActions', c_piece: 'pieceActions',
      c_rstore: 'remoteStoreActions', c_rpiece: 'remotePieceActions', c_rdoor: 'remoteDoorActions', c_rack: 'rackActions',
      c_door: 'doorActions', c_barrel: 'barrelActions', c_worker: 'workerActions', c_kin: 'kinActions',
    };
    /* a building's store you can open, as a second purse */
    static STORE_LABEL = {
      market: 'Open the marketplace', silo: 'Look in the silo', farm: 'Look in the farm', coop: 'Collect eggs', barn: 'Look in the cattle barn',
    };
    /* the workshop that forges a weapon */
    static FORGES = { smithy: 'craft_iron_sword', ember_forge: 'craft_ember_brand' };

    constructor(game) { this.g = game; }
    get c() { return this.g.castle; }
    cost(c) { return K.CostText.format(c); }
    /** every action for entity e, ending with Inspect */
    actionsFor(e) {
      const out = [], method = ActionMenu.BY_TYPE[e.type];
      if (method) this[method](e, out);
      out.push({ id: 'inspect', label: 'Inspect', icon: 'eye', run: (gm, x) => gm.inspect(x) });
      return out;
    }
    act(out, id, label, icon, run, extra) {
      const g = this.g;
      out.push(Object.assign({ id, label, icon, run: (gm, x) => { g.sound.unlock(); run(x); } }, extra || {}));
    }
    keepActions(e, out) {
      const g = this.g, c = this.c, d = g.data;
      if (!c.lit) this.act(out, 'light', 'Light the hearth', 'lantern', () => g.lightKeep(), { range: 0.6 });
      if (c.lit && c.amount('troll_heart') > 0 && c.hearthCap < 5) {
        this.act(out, 'bind', `Bind the troll’s heart · ${this.cost(d.keepUpgrade.cost)}`, 'heart', () => g.bindHeart(), { range: 0.6 });
      }
      if (c.lit && !c.weapons.has('stoneblade')) {
        const label = `Forge a Stoneblade · ${this.cost(d.recipe('craft_stoneblade').inputs)}`;
        this.act(out, 'craft', label, 'stoneblade', () => g.craft('craft_stoneblade'), { range: 0.6 });
      }
      const day = g.day;
      if (c.lit && day.kind === 'day' && day.length() != null && day.idx + 1 < day.phases.length) {
        this.act(out, 'bell', 'Ring the bell (dusk now)', 'bell', () => g.ringBell());
      }
      this.act(out, 'book', 'Open the Hearthbook', 'book', () => g.cui.toggleBook(true));
    }
    ruinActions(e, out) {
      const t = e.ruinType, cost = this.c.buildCost(t, { ruin: true }), why = this.c.blocker(t, { ruin: true });
      this.act(out, 'repair', `Repair: ${this.cost(cost)}${why ? ' (' + why + ')' : ''}`, 'hammer', () => this.g.repair(t), { range: e.r + 0.7 });
    }
    siteActions(e, out) {
      const why = this.c.blocker('mine');
      const label = `Build an Iron mine: ${this.cost(this.c.buildCost('mine'))}${why ? ' (' + why + ')' : ''}`;
      this.act(out, 'mine', label, 'pickaxe', () => this.g.buildAtSite(), { range: 1.6 });
    }
    pieceActions(e, out) {
      const g = this.g, c = this.c, p = e.piece;
      if (g.tools.tool.id === 'hammer' && c.canDemolish(p)) {   // hammer only, and it asks
        this.act(out, 'demolish', 'Take down…', 'hammer', () => g.demolisher.ask(p), { range: e.r + 0.8 });
      }
      if (p.type === 'coop' || p.type === 'barn') this.livestockActions(e, out);
      if (p.type === 'market') this.act(out, 'prices', 'Set the clerk’s prices', 'coin', () => g.workers.setPrices(), { range: e.r + 1.6 });
      const store = ActionMenu.STORE_LABEL[p.type];
      if (store) this.act(out, 'store', store, 'bag', () => g.purse.openLedger(p), { range: e.r + 1.2 });
      if (K.Breacher.GATES.has(p.type) && p.bridge) this.gateActions(p, out);
      if (c.upgradeInfo(p)) this.upgradeAction(e, out);
      this.forgeAction(e, out);
    }
    livestockActions(e, out) {
      const g = this.g, p = e.piece, st = g.economy.stock, kind = p.type === 'coop' ? 'chicken' : 'cow', sp = K.LIVESTOCK[kind], n = st.herd(p).length;
      const label = `Buy a ${kind} · ${sp.price} wheat (${n}/${sp.max}, you have ${g.economy.wheatHeld()} wheat)`;
      this.act(out, 'buy', label, 'bag', () => st.buy(p), { range: e.r + 1.2 });
      if (p.type === 'barn' && n) this.act(out, 'butcher', 'Butcher a cow for beef', 'sword', () => st.butcher(p), { range: e.r + 1.2 });
    }
    gateActions(p, out) {
      const open = p.bridge.open, wood = p.type === 'gate';
      const label = wood ? (open ? 'Shut the gate' : 'Open the gate') : (open ? 'Raise the drawbridge' : 'Lower the drawbridge');
      this.act(out, 'bridge', label, 'hand', () => p.bridge.toggle(), { range: wood ? 2.6 : 3.4 });
    }
    upgradeAction(e, out) {
      const c = this.c, p = e.piece, pb = c.upgradePayback(p), why = c.upgradeBlocker(p);
      const payback = pb != null ? ` · pays back in ${pb.toFixed(1)} min` : '';
      const label = `Upgrade to Level 2: ${this.cost(c.upgradeCost(p))}${payback}${why ? ' (' + why + ')' : ''}`;
      this.act(out, 'upgrade', label, 'hammer', () => this.g.upgrade(p), { range: e.r + 0.8 });
    }
    forgeAction(e, out) {
      const g = this.g, st = ActionMenu.FORGES[e.piece.type];
      if (!st || this.c.weapons.has(g.data.recipe(st).id.replace('craft_', ''))) return;
      const label = `Forge ${g.data.item(st.replace('craft_', '')).name} · ${this.cost(g.data.recipe(st).inputs)}`;
      this.act(out, 'craft', label, st === 'craft_iron_sword' ? 'sword' : 'brand', () => g.craft(st), { range: e.r + 0.8 });
    }
    remoteStoreActions(e, out) {
      this.act(out, 'take', `Take from the ${e.name.toLowerCase()}`, 'hand', () => this.g.mp.takeFrom(e.sid), { range: e.r + 0.8 });
    }
    remotePieceActions(e, out) {
      const g = this.g, rec = e.rec, mp = g.mp, mine = mp.mayUse(rec.p.owner);
      if (K.Breacher.GATES.has(rec.p.type)) {
        const label = rec.gate.open ? 'Shut the gate' : (mine ? 'Open the gate' : 'Try the gate (locked)');
        this.act(out, 'open', label, 'hand', () => mp.requestGate(rec), { range: 2.8 });
      }
      if (rec.p.type === 'market') this.act(out, 'trade', 'Trade with the clerk', 'coin', () => g.workers.trade(rec.p.owner), { range: 2.6 });
      if (!mine) this.act(out, 'break', 'Break it down', 'sword', () => mp.hit(rec), { range: 2.1 });
    }
    remoteDoorActions(e, out) {
      const rec = e.rec, mp = this.g.mp, mine = mp.mayUse(rec.owner), d = rec.door;
      if (d.broken) {
        if (!mine) this.act(out, 'install', 'Hang your own door (3 wood): take the castle', 'hammer', () => mp.installDoor(rec), { range: 2.4 });
        return;
      }
      const label = d.open ? 'Shut the door' : (mine ? 'Open the door' : 'Try the door (locked)');
      this.act(out, 'open', label, 'hand', () => mp.requestDoor(rec), { range: 2.4 });
      if (!mine) this.act(out, 'break', 'Break the door down', 'sword', () => mp.hit(rec, true), { range: 2.1 });
    }
    rackActions(e, out) {
      const rk = e.rack;
      this.act(out, 'bow', rk.owned ? 'Put the bow back' : 'Take the bow', 'sword', () => (rk.owned ? rk.putBack() : rk.take()), { range: 1.2 });
      this.act(out, 'fletch', 'Fletch 4 arrows (1 wood)', 'hand', () => rk.fletch(), { range: 1.2 });
    }
    doorActions(e, out) {
      const door = this.g.home.door;
      const label = door.broken ? 'Repair the door (3 wood)' : door.open ? 'Shut the door' : 'Open the door';
      this.act(out, 'door', label, 'hand', () => door.toggle(), { range: 1.3 });
    }
    barrelActions(e, out) {
      const g = this.g, rg = e.r + 0.8, st = e.store, home = g.home, resName = K.CastleData.resName(e.res);
      if (st.pile) this.act(out, 'take', `Pick up the ${e.name.toLowerCase()} (${st.amount})`, 'hand', () => g.stash.take(st), { range: rg });
      else if (e.res === 'bread') {
        const hp = K.BUILDING_DATA.FOOD.bread.hp;
        this.act(out, 'eat', `Eat a loaf (+${hp} strength · ${st.amount} left)`, 'hand', () => home.eatBread(st), { range: rg });
        this.act(out, 'take', 'Take a loaf', 'hand', () => home.takeBread(st), { range: rg });
      } else if (e.res === 'food') this.act(out, 'take', `Take some raw food (${st.amount} left)`, 'hand', () => home.takeFood(st), { range: rg });
      else if (e.res === 'arrow') this.act(out, 'take', `Take arrows (${st.amount} left)`, 'hand', () => home.takeArrows(st), { range: rg });
      else this.act(out, 'look', `${e.name}: ${st.amount} ${resName}`, 'eye', () => g.cui.toast(`${st.amount} ${resName} stored here.`), { range: rg });
      if (!st.pile && st.stock != null && st.stock > 0) {   // crates and barrels can be emptied into your purse and put down elsewhere
        this.act(out, 'pickup', `Pick up everything (${st.stock})`, 'hand', () => g.stash.take(st), { range: rg });
      }
    }
    workerActions(e, out) {
      this.act(out, 'talk', `Talk to the ${e.name.toLowerCase()}`, 'hand', () => this.g.workers.talk(e), { range: 2.4 });
    }
    kinActions(e, out) {
      const id = e.kinId;
      if (!this.c.kin.has(id) && id === 'emberwright') {
        this.act(out, 'touch', 'Touch her with the lantern', 'lantern', () => this.g.touchEmberwright(), { range: 1.4 });
      }
    }
  }

  K.ActionMenu = ActionMenu;
})(typeof window !== 'undefined' ? window : globalThis);
