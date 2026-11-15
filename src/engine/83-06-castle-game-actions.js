/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameActions extends K.CastleGamePieces {
    actionsFor(e) {
      const c = this.castle, out = [];
      const act = (id, label, icon, run, extra) => out.push(Object.assign({ id, label, icon, run: (gm, x) => { this.sound.unlock(); run(x); } }, extra || {}));
      if (e.type === 'c_keep') {
        if (!c.lit) act('light', 'Light the hearth', 'lantern', () => this.lightKeep(), { range: 0.6 });
        if (c.lit && c.amount('troll_heart') > 0 && c.hearthCap < 5) act('bind',
        `Bind the troll’s heart · ${K.CastleGameUtility.formatCost(this.data.keepUpgrade.cost)}`, 'heart', () => this.bindHeart(), { range: 0.6 });
        if (c.lit && !c.weapons.has('stoneblade')) act('craft',
        `Forge a Stoneblade · ${K.CastleGameUtility.formatCost(this.data.recipe('craft_stoneblade').inputs)}`, 'stoneblade',
        () => this.craft('craft_stoneblade'), { range: 0.6 });
        if (c.lit && this.day.kind === 'day' && this.day.length() != null && this.day.idx + 1 < this.day.phases.length) act('bell',
        'Ring the bell (dusk now)', 'bell', () => this.ringBell());
        act('book', 'Open the Hearthbook', 'book', () => this.cui.toggleBook(true));
      } else if (e.type === 'c_ruin') {
        const t = e.ruinType, cost = c.buildCost(t, { ruin: true }), why = c.blocker(t, { ruin: true });
        act('repair', `Repair: ${K.CastleGameUtility.formatCost(cost)}${why ? ' (' + why + ')' : ''}`, 'hammer', () => this.repair(t), { range: e.r + 0.7 });
      } else if (e.type === 'c_site') {
        const why = c.blocker('mine');
        act('mine', `Build an Iron mine: ${K.CastleGameUtility.formatCost(c.buildCost('mine'))}${why ? ' (' + why + ')' : ''}`, 'pickaxe',
        () => this.buildAtSite(), { range: 1.6 });
      } else if (e.type === 'c_piece') {
        const p = e.piece, up = c.upgradeInfo(p);
        if (this.tools.tool.id === 'hammer' && c.canDemolish(p)) act('demolish', 'Take down…', 'hammer', () => this.demolisher.ask(p), { range: e.r + 0.8 });
        // hammer only, and it asks
        if (p.type === 'coop' || p.type === 'barn') {
          const st = this.economy.stock, kind = p.type === 'coop' ? 'chicken' : 'cow', sp = K.LIVESTOCK[kind], n = st.herd(p).length;
          act('buy', `Buy a ${kind} · ${sp.price} wheat (${n}/${sp.max}, you have ${this.economy.wheatHeld()} wheat)`, 'bag', () => st.buy(p),
          { range: e.r + 1.2 });
          if (p.type === 'barn' && n) act('butcher', 'Butcher a cow for beef', 'sword', () => st.butcher(p), { range: e.r + 1.2 });
        }
        if (p.type === 'market') act('prices', 'Set the clerk’s prices', 'coin', () => this.workers.setPrices(), { range: e.r + 1.6 });
        if (['market', 'silo', 'farm', 'coop', 'barn'].includes(p.type)) {
          const names = {
            market: 'Open the marketplace', silo: 'Look in the silo', farm: 'Look in the farm',
            coop: 'Collect eggs', barn: 'Look in the cattle barn'
          };
          act('store', names[p.type], 'bag', () => this.purse.openLedger(p), { range: e.r + 1.2 });
        }
        // a building's store, as a second purse
        if (K.Breacher.GATES.has(p.type) && p.bridge) act('bridge',
        p.type === 'gate' ? (p.bridge.open ? 'Shut the gate' : 'Open the gate') : (p.bridge.open ? 'Raise the drawbridge' : 'Lower the drawbridge'),
        'hand', () => p.bridge.toggle(), { range: p.type === 'gate' ? 2.6 : 3.4 });
        if (up) {
          const pb = c.upgradePayback(p), why = c.upgradeBlocker(p);
          const payback = pb != null ? ` · pays back in ${pb.toFixed(1)} min` : '';
          const warning = why ? ' (' + why + ')' : '';
          const label = `Upgrade to Level 2: ${K.CastleGameUtility.formatCost(c.upgradeCost(p))}${payback}${warning}`;
          act('upgrade', label, 'hammer', () => this.upgrade(p), { range: e.r + 0.8 });
        }
        const st = { smithy: 'craft_iron_sword', ember_forge: 'craft_ember_brand' }[p.type];
        if (st && !c.weapons.has(this.data.recipe(st).id.replace('craft_', ''))) act('craft',
        `Forge ${this.data.item(st.replace('craft_', '')).name} · ${K.CastleGameUtility.formatCost(this.data.recipe(st).inputs)}`,
        st === 'craft_iron_sword' ? 'sword' : 'brand', () => this.craft(st), { range: e.r + 0.8 });
      } else if (e.type === 'c_rstore') {
        const v = e.rec || {}; act('take', `Take from the ${e.name.toLowerCase()}`, 'hand', () => this.mp.takeFrom(e.sid), { range: e.r + 0.8 });
      } else if (e.type === 'c_rpiece') {
        const rec = e.rec, mp = this.mp, gate = K.Breacher.GATES.has(rec.p.type), mine = mp.mayUse(rec.p.owner);
        if (gate) act('open', rec.gate.open ? 'Shut the gate' : (mine ? 'Open the gate' : 'Try the gate (locked)'), 'hand', () => mp.requestGate(rec),
        { range: 2.8 });
        if (rec.p.type === 'market') act('trade', 'Trade with the clerk', 'coin', () => this.workers.trade(rec.p.owner), { range: 2.6 });
        if (!mine) act('break', 'Break it down', 'sword', () => mp.hit(rec), { range: 2.1 });
      } else if (e.type === 'c_rdoor') {
        const rec = e.rec, mp = this.mp, mine = mp.mayUse(rec.owner), d = rec.door;
        if (d.broken) { if (!mine) act('install', 'Hang your own door (3 wood): take the castle', 'hammer', () => mp.installDoor(rec), { range: 2.4 }); }
        else { act('open', d.open ? 'Shut the door' : (mine ? 'Open the door' : 'Try the door (locked)'), 'hand', () => mp.requestDoor(rec),
        { range: 2.4 }); if (!mine) act('break', 'Break the door down', 'sword', () => mp.hit(rec, true), { range: 2.1 }); }
      } else if (e.type === 'c_rack') {
        const rk = e.rack; act('bow', rk.owned ? 'Put the bow back' : 'Take the bow', 'sword', () => (rk.owned ? rk.putBack() : rk.take()), { range: 1.2 });
        act('fletch', 'Fletch 4 arrows (1 wood)', 'hand', () => rk.fletch(), { range: 1.2 });
      } else if (e.type === 'c_door') {
        const door = this.home.door;
        act('door', door.broken ? 'Repair the door (3 wood)' : door.open ? 'Shut the door' : 'Open the door', 'hand', () => door.toggle(), { range: 1.3 });
      } else if (e.type === 'c_barrel') {
        const rg = e.r + 0.8, st = e.store;
        if (st.pile) act('take', `Pick up the ${e.name.toLowerCase()} (${st.amount})`, 'hand', () => this.stash.take(st), { range: rg }); else
        if (e.res === 'bread') { act('eat', `Eat a loaf (+${K.BUILDING_DATA.FOOD.bread.hp} strength · ${st.amount} left)`, 'hand',
        () => this.home.eatBread(st), { range: rg }); act('take', 'Take a loaf', 'hand', () => this.home.takeBread(st), { range: rg }); }
        else if (e.res === 'food') act('take', `Take some raw food (${st.amount} left)`, 'hand', () => this.home.takeFood(st), { range: rg });
        else if (e.res === 'arrow') act('take', `Take arrows (${st.amount} left)`, 'hand', () => this.home.takeArrows(st), { range: rg });
        else act('look', `${e.name}: ${st.amount} ${K.CastleData.resName(e.res)}`, 'eye',
        () => this.cui.toast(`${st.amount} ${K.CastleData.resName(e.res)} stored here.`), { range: rg });
        if (!st.pile && st.stock != null && st.stock > 0) act('pickup', `Pick up everything (${st.stock})`, 'hand', () => this.stash.take(st), { range: rg });
        // crates and barrels can be emptied into your purse and put down elsewhere
      } else if (e.type === 'c_worker') {
        act('talk', `Talk to the ${e.name.toLowerCase()}`, 'hand', () => this.workers.talk(e), { range: 2.4 });
      } else if (e.type === 'c_kin') {
        const id = e.kinId;
        if (!c.kin.has(id) && id === 'emberwright') act('touch', 'Touch her with the lantern', 'lantern', () => this.touchEmberwright(), { range: 1.4 });
      }
      out.push({ id: 'inspect', label: 'Inspect', icon: 'eye', run: (gm, x) => gm.inspect(x) });
      return out;
    }
    inspect(e) {
      const c = this.castle;
      if (e.type === 'c_piece') {
        const p = e.piece, d = this.data.piece(p.type), pr = c.producesOf(p), rows = [['Level', p.level]];
        if (pr) rows.push(['Makes', Object.entries(pr).map(([r, n]) => `+${n} ${K.CastleData.resName(r)}/min`).join(', ')]);
        if (c.isFrosted(p)) rows.push(['State', 'FROSTED (no production)']);
        else if (pr && c.isFull(p)) rows.push(['State', 'FULL: build a Storehouse or spend']);
        if (d.category === 'defense') rows.push(['HP', `${Math.ceil(p.hp)} / ${this.pieceHpMax(p)}`]);
        return { title: d.name, sub: d.category, body: d.effect, rows };
      }
      if (e.type === 'c_barrel') return { title: e.name, sub: 'Outside your home', body: 'Your stores. A raider can walk off with some of it.', rows: [] };
      if (e.type === 'c_keep') {
        const body = c.lit
          ? 'Your castle’s heart. Raiders walk at it. Its workbench forges the Stoneblade.'
          : 'Cold and roofless. Your ember lantern could light its hearth.';
        const keepHp = this.raid ? `${Math.ceil(this.raid.keepHp)} / ${c.keepHpMax()}` : c.keepHpMax();
        const rows = [['Keep HP', keepHp], ['Glow', c.glowRadius() + ' m']];
        return { title: 'The Keep', sub: `Castle Level ${c.cl()}`, body, rows };
      }
      if (e.type === 'c_ruin') return { title: e.name, sub: 'Ruin', body: this.data.piece(e.ruinType).effect, rows: [['Repair',
      K.CastleGameUtility.formatCost(c.buildCost(e.ruinType, { ruin: true }))]] };
      if (e.type === 'c_site') return { title: 'Iron outcrop', sub: 'Iron Hills',
      body: 'Rust-red rock: the one place an Iron mine can stand. It is outside the walls, so raiders can frost it.', rows: [] };
      if (e.type === 'c_kin') { const h = this.data.hero(e.kinId); return { title: h.name, sub: h.role,
      body: c.kin.has(e.kinId) ? h.perk : h.found + '. Joins when ' + h.joinsWhen + '.', rows: [] }; }
      const n = this.nodeSpec(e); if (n) { const st = this.play.nodeState(e); return { title: e.name, sub: 'Resource',
      body: `Yields ${Object.entries(n.yields).map(([r, v]) => v + ' ' + r).join(', ')} per action (+${c.row().gatherBonus} from Castle Level).`,
      rows: [['Left', st.charges > 0 ? `${st.charges} / ${st.max}` : 'spent']] }; }
      return { title: e.name, body: '' };
    }

    /* ---------- gathering ---------- */
    nodeSpec(e) { return this.data.node({ c_tree: 'tree', c_boulder: 'boulder', c_rubble: 'rubble', c_iron: 'iron_rock' }[e.type]); }
    gather(e) {
      const play = this.play, n = this.nodeSpec(e), st = play.nodeState(e); this.sound.unlock();
      if (st.charges <= 0) { this.cui.toast(`This ${e.name.toLowerCase()} is spent. ${n.respawnSec ? 'It regrows soon.' : 'It is gone.'}`); return; }
      const [r, base] = Object.entries(n.yields)[0];
      if (this.castle.amount(r) >= this.castle.caps()[r]) {
        const cap = this.castle.caps()[r];
        const message = `Your ${K.CastleData.resName(r)} store is full (${cap}). ` +
          'Spend it or build a Storehouse.';
        this.cui.toast(message); this.cui.flashRes(r); return;
      }
      play.face(play.me, e);
      play.channel({ label: { c_tree: 'Chopping…', c_iron: 'Mining…' }[e.type] || 'Gathering…', time: 1.5, onDone: () => {
        const got = Math.round(this.castle.gather(r, base));
        if (got > 0) { play.float(play.me, `+${got}`, 'loot', K.CastleUI.ICON[r]); this.cui.bump(r); this.sound.play('gather'); }
        st.charges--;
        if (e.type === 'c_tree' && st.charges > 0) this.R.setPropState(e.id, 'cut' + Math.min(4, st.max - st.charges));
        // the tree visibly shrinks with every swing
        if (st.charges <= 0) { st.respawnAt = n.respawnSec ? play.t + n.respawnSec : Infinity; this.R.setPropState(e.id, 'depleted');
        this.forest.cleared(e); play.me.view.setState('idle'); }
        else if (this.castle.amount(r) < this.castle.caps()[r]) this.gather(e); else { play.me.view.setState('idle');
        this.cui.toast(`${K.CastleData.resName(r)[0].toUpperCase() + K.CastleData.resName(r).slice(1)} is full.`); this.cui.flashRes(r); }
        this.changed();
      } });
    }

    /* ---------- building ---------- */
    lightKeep() {
      if (!this.castle.light()) return;
      const p = this.play; p.face(p.me, this.keepEnt); p.me.view.setState('action');
      p.player.removeItem('ember_lantern', 1);
      this.sound.play('whump'); this.redrawKeep(); this.pop(this.keepMesh, 0.6); this.flareT = 2.5; this.shake(0.25);
      this.meltTo(this.castle.glowRadius(), 1.4); this.glowR = 0.5;
      this.cui.banner('The hearth roars', 'CL 1 · the glow pushes the frost back 6 m', 'fire');
      this.changed();
    }
  }
  K.CastleGameActions = CastleGameActions;
})(typeof window !== 'undefined' ? window : globalThis);
