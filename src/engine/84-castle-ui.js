/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Castle mode UI: the HUD (stores, rates, caps, Castle Level, HP, the clock), the 3-line goal
   list, the Build radial (affordable pieces, payback lines, a gold coin on the best payback), placement,
   raid warning / result cards, the Hearthbook and the end card. DOM only; CastleGame owns the rules. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { Icons, CastleArt } = K;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- castle icons (16x16 pixel drawings, same style as the item icons) ---------- */
  const r = K.ramp, PAL = K.PAL;
  const stoneP = r('#1c1f27', '#3a3f4b', '#5d6370', '#868c98', '#b4b9c2'), emberP = r('#3a0e04', '#8a2a08', '#d0561a', '#ff9a3a', '#ffe08a'), heartP = r('#200a10', '#5a1a28', '#a83a3a', '#ff7a4a', '#ffd08a');
  const dirtP = r('#1c1208', '#3d2a18', '#5e4128', '#86603a', '#a9835a');
  const iceP = r('#1a3a5a', '#3f82aa', '#7fb6d6', '#cfe8f5'), woodP = PAL.wood, steelP = PAL.steel, goldP = PAL.gold;
  Object.assign(Icons.DRAW, {
    stone(c) { c.poly([[1, 13], [3, 8], [7, 7], [9, 10], [6, 14]], stoneP).poly([[7, 14], [9, 8], [13, 7], [15, 12], [13, 15]], stoneP).poly([[4, 8], [6, 3], [10, 2], [12, 6], [9, 8]], stoneP); },
    arrow(c) { c.line(2, 14, 13, 3, woodP[3], 1).poly([[13, 1], [15, 5], [10, 4]], steelP).poly([[1, 12], [4, 12], [3, 15], [1, 15]], iceP[3]); },
    food(c) { c.poly([[3, 9], [7, 5], [12, 6], [14, 10], [10, 12]], r('#3a1408', '#7a2a14', '#b04a26', '#e07a46', '#ffb482')).line(10, 11, 14, 14, woodP[3], 2).disc(14.5, 14.5, 1.6, goldP[3]); },
    dirt(c) { c.poly([[1, 13], [3, 8], [8, 6], [13, 8], [15, 13], [12, 15], [4, 15]], dirtP).px(5, 9, dirtP[4]).px(9, 8, dirtP[4]).px(11, 11, dirtP[1]).px(6, 12, dirtP[1]); },
    ember(c) { c.poly([[8, 1], [12, 7], [10, 15], [6, 15], [4, 8]], emberP).px(8, 5, emberP[5]).px(7, 9, emberP[5]); },
    heart(c) { c.disc(5.5, 6, 4, heartP).disc(10.5, 6, 4, heartP).poly([[2, 7], [14, 7], [8, 15]], heartP).px(6, 5, heartP[5]).line(8, 4, 8, 11, iceP[1]); },
    stoneblade(c) { c.poly([[5, 11], [11, 2], [14, 3], [8, 12]], stoneP).line(2, 14, 6, 10, woodP[3], 2).line(3, 9, 8, 13, PAL.leather ? PAL.leather[3] : woodP[2]); },
    brand(c) { c.line(3, 12, 12, 3, steelP[5], 2).line(4, 12, 12, 4, emberP[4]).px(13, 2, emberP[5]).line(2, 9, 6, 13, goldP[3]).line(1, 14, 3, 12, PAL.leather ? PAL.leather[3] : woodP[2], 2); },
    lantern(c) { c.rect(6, 1, 4, 2, steelP[3]).rect(4, 3, 8, 11, steelP[2]).rect(5, 4, 6, 9, emberP[3]).rect(6, 6, 4, 5, emberP[4]).px(8, 8, emberP[5]).rect(4, 14, 8, 1, steelP[3]); },
    hammer(c) { c.line(3, 14, 10, 7, woodP[4], 2); c.poly([[7, 3], [12, 1], [15, 6], [11, 8]], steelP); },
    bell(c) { c.poly([[8, 1], [12, 5], [13, 12], [3, 12], [4, 5]], goldP).rect(2, 12, 12, 2, goldP[2]).disc(8, 14.5, 1.3, goldP); },
    book(c) { c.poly([[2, 3], [8, 4], [14, 3], [14, 14], [8, 15], [2, 14]], r('#2a1206', '#5a2a10', '#8a4a1a', '#c08040')).line(8, 4, 8, 15, woodP[1]).rect(4, 6, 3, 1, goldP[3]).rect(10, 6, 3, 1, goldP[3]); },
    crown(c) { c.poly([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], goldP).px(8, 7, emberP[4]); },
  });

  const ICON = { wood: 'log', stone: 'stone', dirt: 'dirt', food: 'food', arrow: 'arrow', iron: 'ore', gold: 'coin', ember_shard: 'ember', troll_heart: 'heart', stoneblade: 'stoneblade', iron_sword: 'sword', ember_brand: 'brand' };
  const RES_ORDER = ['wood', 'stone', 'dirt', 'food', 'arrow', 'iron', 'gold', 'ember_shard'];
  const PIECE_ICON = { cottage: 'bed', fire_pot: 'ember', farm: 'hammer', field: 'food', silo: 'bag', coop: 'food', barn: 'food', market: 'coin', stable: 'hand', bakery: 'food', butcher: 'food', library: 'book', bunkhouse: 'bed', palisade: 'log', stone_wall: 'stone', stone_gate: 'stone', stone_tower: 'stone', gate: 'log', gatehouse: 'hammer', watchtower: 'eye', ember_brazier: 'ember', woodcutter: 'axe', quarry: 'pickaxe', mine: 'ore', great_hall: 'coin', chapel: 'ember', storehouse: 'bag', smithy: 'hammer', ember_forge: 'brand', barracks: 'shield', heartfire_hearth: 'heart' };
  const SHORT = {
    palisade: 'Blocks raiders; they must chop through it.', stone_wall: 'Blocks raiders. 2.5x a palisade’s HP.', gatehouse: 'The way in. Walls joined to it make the courtyard.',
    watchtower: 'Shoots raiders within 6 m for 4/s (6 with a hero on it).', ember_brazier: 'At night, burns frost creatures within 3 m.', storehouse: '+100 storage. Guards half your stores from raids.',
    smithy: 'Crafts the Iron sword. Upgrades cost 25% less.', ember_forge: 'Crafts the Ember brand. Kin weapons turn to ember.', barracks: 'Kin deal +20% at night. Opens a friend-guard slot.',
    great_hall: 'Feasts and taxes: gold. The Emberwright wants a seat.', chapel: 'Ember shards. Heroes wake 3 s faster.', mine: 'Iron, on the outcrop in the Iron Hills (outside the walls).',
    woodcutter: 'Wood while you do anything else.', quarry: 'Stone while you do anything else.', heartfire_hearth: 'Bind the troll’s heart: CL 5, the whole map thaws.',
  };

  /* the HD voxel art (public/art/<data id>.webp, listed in K.CASTLE_ART by the build). Any id without
     art, or an image that fails to load, falls back to the pixel icon. */
  class ArtLibrary {
    constructor(manifest, win) { this.base = (manifest && manifest.base) || 'art/'; this.ids = new Set((manifest && manifest.ids) || []); this.win = win; }
    url(id) {
      const inl = this.win && this.win.KINSTEAD_ART_INLINE; if (inl && inl[id]) return inl[id];
      return this.ids.has(id) ? this.base + id + '.webp' : null;
    }
    has(id) { return !!this.url(id); }
    /* px: rendered size; icon: the pixel-icon fallback */
    html(id, icon, px = 44, cls = '') {
      const u = this.url(id), fb = Icons.img(icon || 'hammer', Math.max(1, Math.round(px / 22)));
      if (!u) return `<span class="art ${cls} fb" style="width:${px}px;height:${px}px">${fb}</span>`;
      return `<span class="art ${cls}" style="width:${px}px;height:${px}px"><span class="afb" hidden>${fb}</span><img src="${u}" width="${px}" height="${px}" alt="" draggable="false" onerror="this.previousElementSibling.hidden=false;this.remove()"></span>`;
    }
  }

  class CastleUI {
    constructor(game) {
      this.art = new ArtLibrary(K.CASTLE_ART, G);
      this.g = game; this.c = game.castle; this.placing = null; this.bannerQ = []; this.hudT = 0;
      const root = (this.root = el('div', '', ''));
      root.id = 'castleui';
      root.innerHTML = `<div id="cLeft"><div id="cHud" class="cp"></div></div><div id="cGoals" class="cp"></div><div id="cClock" class="cp"></div><div id="cRaid" class="cp" hidden></div>
        <div id="cBar" class="cp"><button class="cb" data-a="book">${Icons.img('book', 1)} Hearthbook <kbd>H</kbd> <b id="cPct">0%</b></button><button class="cb" data-a="bell" title="Ring the Keep bell: dusk comes now">${Icons.img('bell', 1)} Ring bell</button><span class="hint">Click: walk · gather · repair · attack · Double-click: run</span></div>
        <div id="cRadial" hidden></div><div id="cPlace" class="cp" hidden></div><div id="cBanner" hidden></div><div id="cBook" class="cp" hidden></div><div id="cModal" hidden></div>`;
      document.body.appendChild(root);
      this.$ = (id) => root.querySelector('#' + id);
      this.buildDetails = new K.BuildDetailsDialog(this);
      this.$('cBar').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; this.g.sound.unlock(); const a = b.dataset.a; if (a === 'build') this.toggleRadial(); else if (a === 'book') this.toggleBook(); else if (a === 'bell') this.g.ringBell(); });
      this.$('cRadial').addEventListener('click', (event) => {
        const card = event.target.closest('[data-card]');
        if (card) this.pickCard(+card.dataset.card);
        else if (event.target.id === 'cRadial' || event.target.closest('[data-close]')) this.toggleRadial(false);
      });
      this.$('cBook').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.toggleBook(false); });
      this.$('cPlace').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.stopPlacing(); if (e.target.closest('[data-rot]')) this.rotate(); });
      this.render();
    }
    static prodLine(castle, type, opts = {}) {
      const d = castle.data.piece(type); if (!d || !d.produces) return '';
      return castle.payback.line(castle.buildCost(type, opts), d.produces);
    }
    dispose() { this.buildDetails.dispose(); this.stopPlacing(); this.root.remove(); }
    toast(m) { this.g.app.toast(m); }

    /* ---------- HUD ---------- */
    render() {
      const c = this.c, g = this.g, cl = c.cl(), row = c.row(), caps = c.caps(), rates = c.rates(), nx = c.nextLevel();
      const p = g.play.player, hp = p.hp, hpMax = p.stats().hpMax;

      const next = !c.lit ? 'Light the Keep’s hearth to begin' : nx ? (nx.capped ? (cl >= 4 ? esc(c.data.raw.castleLevel.capMessage) : '') : `Next: CL ${nx.cl} at ${nx.need} castle points (${nx.have}/${nx.need})`) : 'The castle burns at its brightest';
      const w = c.bestWeapon();
      const pct = Math.max(0, Math.min(100, 100 * hp / hpMax));
      this.$('cHud').innerHTML = `<div class="hp ${pct < 30 ? 'low' : ''}" title="Strength: eat to recover fast; rest in your house to recover slowly"><i style="width:${pct.toFixed(1)}%"></i><span>♥ ${Math.ceil(hp)}</span></div>${this.xpBar()}`;
      if (this.g.tools) this.g.tools.drawer.update();
      if (this.radialOpen) this.renderRadial();
      if (this.bookOpen) this.renderBook();
    }
    renderGoals() {
      const goals = this.c.currentGoals(3), warn = this.g.day.kind === 'day' && this.g.day.warned;
      this.$('cGoals').innerHTML = (warn ? '<div class="g warn">Dusk soon: man the walls</div>' : '') + (goals.length ? goals.map((o, i) => `<div class="g ${i === 0 ? 'cur' : ''}"><span>${this.c.data.raw.objectives.indexOf(this.c.data.raw.objectives.find((x) => x.id === o.id)) + 1}.</span> ${esc(o.goal)}</div>`).join('') : '<div class="g cur">Act 1 complete</div>');
    }
    renderClock() {
      const d = this.g.day, rem = d.remaining(), ph = d.phase, n = ph.id.replace(/\D/g, '');
      const k = rem == null ? 0.5 : 1 - rem / d.length();
      const txt = !this.c.lit ? 'Frozen' : d.isNight ? `Night ${n} · ${mmss(rem)} to dawn` : rem == null ? `Day ${n} · no more raids` : `Day ${n} · ${mmss(rem)} to dusk`;
      this.$('cClock').innerHTML = `<div class="arc ${d.isNight ? 'night' : ''}"><i style="left:${(k * 100).toFixed(1)}%"></i></div><span>${txt}</span>`;
      this.$('cClock').classList.toggle('amber', d.kind === 'day' && d.warned);
    }
    bump(r, passive) { const e = this.root.querySelector(`.res[data-r="${r}"]`); if (!e) return; e.classList.remove('bump'); void e.offsetWidth; e.classList.add(passive ? 'bump' : 'bump'); this.hudDirty = true; }
    flashRes(r) { const e = this.root.querySelector(`.res[data-r="${r}"]`); if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }
    frame(dt) {
      this.hudT -= dt; if (this.hudT <= 0 || this.hudDirty) { this.hudT = 0.25; this.hudDirty = false; this.render(); }
      if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) { this.$('cBanner').hidden = true; this.nextBanner(); } }
    }

    /* ---------- banners and cards ---------- */
    banner(title, text, icon) { this.bannerQ.push({ title, text, icon }); if (!(this.bannerT > 0)) this.nextBanner(); }
    nextBanner() {
      const b = this.bannerQ.shift(); if (!b) return; const e = this.$('cBanner');
      const ic = { fire: 'ember', cl: 'crown', kin: 'bubble', heart: 'heart' }[b.icon] || ICON[b.icon] || (Icons.DRAW[b.icon] ? b.icon : 'crown');
      e.innerHTML = `<div class="bn">${Icons.img(ic, 3)}<div><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></div></div>`; e.hidden = false; e.classList.remove('in'); void e.offsetWidth; e.classList.add('in');
      this.bannerT = 3.6;
    }
    /** the level and how far to the next one */
    xpBar() { const x = this.g.xp.progress(), pct = x.need ? Math.min(100, x.into / x.need * 100) : 100; return `<div class="xp" title="Level ${x.level} · ${x.need ? x.into + ' / ' + x.need + ' XP' : 'top level'}. You earn XP by building and by fighting."><i style="width:${pct.toFixed(1)}%"></i><span>Level ${x.level}</span></div>`; }
    modal(html, buttons) {
      const m = this.$('cModal'); m.innerHTML = `<div class="card">${html}<div class="acts">${buttons.map((b, i) => `<button class="cb ${b.pri ? 'pri' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`; m.hidden = false;
      m.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; m.hidden = true; const f = buttons[+b.dataset.i].run; if (f) f(); };
    }
    warn(phase) { this.banner('Dusk soon: man the walls', `${phase.id === 'night1' ? 'Frost raiders come from the north' : 'A bigger raid comes from two sides'} in 30 seconds. Towers, braziers, the glow and your heroes defend the Keep.`, 'bell'); this.render(); }
    raidStart(r) {
      const n = r.phase.replace(/\D/g, ''), sp = Object.entries(r.spec.spawns).map(([id, k]) => `${k} ${this.c.data.enemy(id).name.toLowerCase()}${k > 1 ? 's' : ''}`).join(', ');
      this.banner(`Night ${n}: the frost comes`, `${sp} walk at the Keep. Raiders frost producers outside the walls. Hold until dawn.`, 'bell');
      this.$('cRaid').hidden = false; this.raidTick(r);
    }
    raidTick(r) {
      this.raidT = (this.raidT || 0) - 1; if (this.raidT > 0) return; this.raidT = 10;
      const hpMax = this.c.keepHpMax(), left = r.queue.length + r.alive;
      this.$('cRaid').innerHTML = `<b>Night ${r.phase.replace(/\D/g, '')}</b><span>${mmss(this.g.day.remaining())} to dawn</span><div class="khp"><i style="width:${(100 * r.keepHp / hpMax).toFixed(1)}%"></i><span>Keep ${Math.ceil(r.keepHp)} / ${hpMax}</span></div><span>${left} raider${left === 1 ? '' : 's'} left</span>`;
    }
    raidResult(o) {
      this.$('cRaid').hidden = true;
      const n = o.night.id.replace(/\D/g, ''), list = (obj) => Object.entries(obj || {}).map(([r, k]) => `<span class="chip">${Icons.img(ICON[r], 1)}${o.lost ? '−' : '+'}${k}</span>`).join('') || '<span class="none">nothing</span>';
      const opened = { night1: 'A thaw wave opens the <b>Iron Hills</b> to the north-east.', night2: 'The frost on the <b>troll’s bridge</b> breaks.' }[o.night.id] || '';
      const html = o.lost
        ? `<h2>The fire guttered</h2><p>The Keep fell to the frost on Night ${n}, but the fire never goes out. The frost took 10% of your unguarded stores. No building is ever lost.</p><h3>Lost</h3><div class="chips">${list(o.loss)}</div><h3>Dropped by raiders</h3><div class="chips">${Object.entries(o.drops).map(([r, k]) => `<span class="chip">${Icons.img(ICON[r], 1)}+${k}</span>`).join('') || '<span class="none">nothing</span>'}</div><p>${opened} The next day is 90 seconds long, so you can try again.</p>`
        : `<h2>The castle held!</h2><p>Dawn on Night ${n}: the frost recedes and broken walls rebuild for free. ${o.killed} raiders fell${o.frosted ? `; ${o.frosted} producer${o.frosted > 1 ? 's were' : ' was'} frosted (back to work 60 s after dawn)` : ''}.</p><h3>Spoils</h3><div class="chips">${list(o.drops)}</div><p>${opened}</p>`;
      this.modal(html, [{ label: 'Greet the dawn', pri: true }]);
      this.g.play.ui.closeAll();
    }
    bookTick(key, pct) {
      const [sec, id] = key.split(':'), name = this.nameOf(sec, id);
      this.toast(`Hearthbook ✓ ${name} · ${pct}% complete`);
      const b = this.root.querySelector('[data-a=book]'); b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); this.g.sound.play('pop');
      this.justTicked = key;
    }
    nameOf(sec, id) {
      const d = this.c.data;
      if (sec === 'Upgrades') return (d.piece(id.replace('_lv2', '')) || {}).name + ' · Level 2';
      if (sec === 'Kin') return d.hero(id).name;
      if (sec === 'Arms') return d.item(id).name;
      if (sec === 'Frost pushed back') return { night1: 'Held Night 1', night2: 'Held Night 2', rime_troll: 'Broke the Rime Troll' }[id];
      return (d.piece(id) || { name: id }).name + (sec === 'Ruins restored' ? ' (restored)' : '');
    }
    /* which art a Hearthbook row shows (kin and nights have none) */
    artIdOf(sec, id) {
      if (sec === 'Kin' || sec === 'Frost pushed back') return null;
      if (sec === 'Upgrades') return /_lv2$/.test(id) ? id : id + '_lv2';
      return this.art.has(id) ? id : null;
    }
    toggleBook(on) {
      this.bookOpen = on != null ? on : !this.bookOpen; this.$('cBook').hidden = !this.bookOpen;
      if (this.bookOpen) { this.toggleRadial(false); this.renderBook(); }
    }
    renderBook() {
      const hb = this.c.hearthbook();
      this.$('cBook').innerHTML = `<header><h2>${Icons.img('book', 2)} The Hearthbook</h2><div class="pct"><b>${hb.pct}%</b><small>${hb.done} of ${hb.total}</small></div><button class="cb" data-close>Close <kbd>H</kbd></button></header>
        <div class="pbar"><i style="width:${hb.pct}%"></i></div>
        <div class="secs">${hb.sections.map((s) => `<section><h3>${esc(s.section)}</h3>${s.rows.map((rw) => { const k = s.section + ':' + rw.id; const aid = this.artIdOf(s.section, rw.id); return `<div class="tk ${rw.done ? 'on' : ''} ${this.justTicked === k ? 'new' : ''}"><i>${rw.done ? '✓' : ''}</i>${aid ? this.art.html(aid, ICON[aid] || PIECE_ICON[aid], 26, 'th') : ''}${esc(this.nameOf(s.section, rw.id))}</div>`; }).join('')}</section>`).join('')}</div>`;
      this.justTicked = null;
    }
    endCard() {
      const c = this.c, hb = c.hearthbook(), rates = c.rates(), inc = Object.entries(rates).map(([r, n]) => `<span class="chip">${Icons.img(ICON[r], 1)}+${n}/min</span>`).join('');
      this.modal(`<div class="end"><div class="hero">${this.art.html('heartfire_hearth', 'heart', 150)}</div><p class="kick">Act 1 complete</p><h1>The Heartfire burns</h1><p>The troll’s warm heart beats in the Keep’s hearth. The snow melts back from every stone and the whole hill thaws.</p>
        <div class="stats"><div><b>${mmss(this.g.playTime)}</b><small>time</small></div><div><b>${hb.pct}%</b><small>Hearthbook</small></div><div><b>${c.cl()}</b><small>Castle Level</small></div><div><b>${c.kin.size}/3</b><small>kin</small></div></div>
        <h3>Income per minute</h3><div class="chips">${inc}</div>
        ${c.weapons.size ? `<h3>Arms forged</h3><div class="arms">${[...c.weapons].map((w) => `<span>${this.art.html(w, ICON[w], 54)}<small>${esc(c.data.item(w).name)}</small></span>`).join('')}</div>` : ''}
        <p class="tease">Far to the north, past the last pines, something on a frozen throne opens its eyes. <b>The frozen king</b> has felt your fire…</p></div>`,
      [{ label: 'Keep building', pri: true }, { label: 'Back to the menu', run: () => { G.KINSTEAD_NO_UNLOAD_PROMPT = true; this.g.save(); location.assign('index.html'); } }]);
    }

    /* ---------- the Build radial ---------- */
    toggleRadial(on) {
      this.radialOpen = on != null ? on : !this.radialOpen; this.$('cRadial').hidden = !this.radialOpen;
      if (this.radialOpen) { this.stopPlacing(); this.toggleBook(false); this.g.play.ui.closeAll(); this.radialHtml = ''; const rd = this.$('cRadial'); rd.classList.add('opening'); clearTimeout(this.openT); this.openT = setTimeout(() => rd.classList.remove('opening'), 400); this.renderRadial(); this.g.sound.play('pop'); }
    }
    cards() {
      const c = this.c, d = c.data, out = [], locked = [];
      for (const id of d.pieceIds().concat([d.keepUpgrade.id])) {
        if (id === 'keep') continue;
        const ruin = c.ruinOpen(id), p = d.piece(id), why = c.blocker(id, { ruin });
        if (id === d.keepUpgrade.id && !c.amount('troll_heart')) { if (c.cl() >= 4 && c.hearthCap < 5) locked.push({ name: p.name, why: 'needs the troll’s heart' }); continue; }
        if (why) { if (!/already/.test(why)) locked.push({ name: p.name, why }); continue; }
        const cost = c.buildCost(id, { ruin }), pb = p.produces ? c.paybackFor(id, { ruin }) : null;
        out.push({ kind: ruin ? 'ruin' : id === 'mine' ? 'site' : id === d.keepUpgrade.id ? 'heart' : 'place', id, name: ruin ? `Restore the ${p.name}` : p.name, cost, pb,
          line: p.produces ? c.payback.line(cost, p.produces) : (SHORT[id] || ''), sub: ruin ? 'ruin · half cost' : p.category, icon: PIECE_ICON[id], art: id });
      }
      for (const pc of c.pieces) {
        const up = c.upgradeInfo(pc); if (!up) continue; const why = c.upgradeBlocker(pc);
        const name = `${d.piece(pc.type).name} → Level 2`; if (why) { locked.push({ name, why }); continue; }
        const pb = c.upgradePayback(pc), cost = c.upgradeCost(pc), gain = up.produces ? Object.entries(up.produces).map(([r, n]) => `+${n - (c.producesOf(pc)[r] || 0)} ${K.CastleData.resName(r)}/min more`).join(' · ') : pc.type === 'storehouse' ? 'storage to +250, guards 70%' : '2 friend-guard slots';
        out.push({ kind: 'upgrade', piece: pc, id: pc.type, name, cost, pb, line: pb != null ? `${gain} · pays for itself in ${pb.toFixed(1)} min${c.has('smithy') ? ' (Smithy −25%)' : ''}` : gain, sub: 'upgrade', icon: 'hammer', art: pc.type + '_lv2' });
      }
      for (const rcp of d.raw.recipes) {
        const it = Object.keys(rcp.outputs)[0]; if (c.weapons.has(it)) continue; const why = c.craftBlocker(rcp.id);
        if (why) { if (c.stationReady(rcp.station)) locked.push({ name: d.item(it).name, why }); continue; }
        out.push({ kind: 'craft', rid: rcp.id, id: it, name: `Forge the ${d.item(it).name}`, cost: rcp.inputs, pb: null, line: `Attack ${d.item(it).atk}${it === 'ember_brand' ? ' · burns frost' : ''} · at the ${rcp.station === 'keep' ? 'Keep’s workbench' : d.piece(rcp.station).name}`, sub: 'weapon', icon: ICON[it], art: it });
      }
      // dedupe repeated upgrade cards for several copies of the same piece type
      const seen = new Set(); const cards = out.filter((x) => { const k = x.kind + ':' + x.id; if (x.kind === 'upgrade' && seen.has(k)) return false; seen.add(k); return true; });
      let best = null; for (const x of cards) if (x.pb != null && (!best || x.pb < best.pb)) best = x; if (best) best.best = true;
      return { out: cards, locked };
    }
    renderRadial() {
      const { out, locked } = this.cards(); this.cardList = out;
      const n = out.length, R = n <= 1 ? 0 : Math.min(330, Math.max(190, n * 34)), W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2 - 10;
      const chip = (cost) => Object.entries(cost).map(([r, k]) => `<span class="chip ${this.c.amount(r) >= k ? '' : 'bad'}">${Icons.img(ICON[r], 1)}${k}</span>`).join('');
      const cards = out.map((x, i) => {
        const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2, rx = R * 1.35, x0 = cx + Math.cos(a) * rx, y0 = cy + Math.sin(a) * R;
        return `<button class="bc ${x.best ? 'best' : ''} k-${x.kind}" data-card="${i}" style="left:${x0.toFixed(0)}px;top:${y0.toFixed(0)}px">${x.best ? `<span class="coin" title="Best payback">${Icons.img('coin', 2)}</span>` : ''}
          <div class="hd">${this.art.html(x.art || x.id, x.icon, 46)}<div><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></div></div><div class="cost">${chip(x.cost)}</div><p>${esc(x.line)}</p></button>`;
      }).join('');
      const html = `<div class="hub" style="left:${cx}px;top:${cy}px"><b>Build</b><small>${n ? n + ' you can afford' : 'nothing affordable yet'}</small><button class="cb" data-close>Close <kbd>B</kbd></button></div>${cards}
        ${locked.length ? `<div class="locked"><b>Not yet:</b> ${locked.slice(0, 7).map((l) => `${esc(l.name)}${l.why ? ` <i>(${esc(l.why)})</i>` : ''}`).join(' · ')}${locked.length > 7 ? ' · …' : ''}</div>` : ''}`;
      if (html === this.radialHtml) return;   // the HUD re-renders every 0.25 s: do not rebuild (and re-animate) identical cards
      this.radialHtml = html; this.$('cRadial').innerHTML = html;
    }
    pickCard(i) {
      const x = this.cardList && this.cardList[i];
      if (x) this.activateCard(x);
    }
    activateCard(x) {
      if (!x) return;
      const g = this.g, play = g.play;
      this.toggleRadial(false);
      if (x.kind === 'upgrade') {
        g.upgrade(x.piece);
        return;
      }
      if (x.kind === 'place') {
        this.startPlacing(x.id);
        return;
      }
      const walk = (entity, actionId) => {
        const action = g.actionsFor(entity).find((item) => item.id === actionId);
        if (action) play.doAction(entity, action);
      };
      if (x.kind === 'ruin') {
        walk(g.ruinEnts[x.id], 'repair');
        return;
      }
      if (x.kind === 'site') {
        walk(g.outcropEnt, 'mine');
        return;
      }
      if (x.kind === 'heart') {
        walk(g.keepEnt, 'bind');
        return;
      }
      if (x.kind === 'craft') {
        const station = this.c.data.recipe(x.rid).station;
        if (station === 'keep') {
          walk(g.keepEnt, 'craft');
          return;
        }
        const piece = this.c.pieces.find((item) => item.type === station);
        if (piece) walk(g.pieceEnt(piece), 'craft');
      }
    }
    showBuildDetails(card) { this.buildDetails.open(card); }

    /* ---------- placement ---------- */
    startPlacing(type) {
      this.stopPlacing(); const g = this.g;
      this.placing = { type, ghost: g.art.ghost(type) }; g.group.add(this.placing.ghost); this.placing.ghost.visible = false;
      this.$('cPlace').hidden = false; if (g.site.handles(type)) { g.site.turns = 0; g.site.steering = false; }
      this.$('cPlace').innerHTML = `${this.art.html(type, PIECE_ICON[type], 30)} Place the <b>${esc(this.c.data.piece(type).name)}</b> anywhere you like. ${g.site.handles(type) ? 'Press to set it down, hold and swing the mouse to turn it, let go to build. It clears trees, rocks and fences for you.' : 'It faces the Keep.'} <button class="cb" data-rot>Turn <kbd>R</kbd></button><button class="cb" data-close>Done <kbd>Esc</kbd></button>`;
    }
    stopPlacing() { if (!this.placing) return; if (this.g.site) this.g.site.clearGhost(); this.g.group.remove(this.placing.ghost); this.placing = null; this.$('cPlace').hidden = true; this.g.play.ui.tip(null); }
    rotate() { if (this.g.site.active) { this.g.site.turn(); if (this.lastP) this.moveGhost(this.lastP.sx, this.lastP.sy); return; } this.g.rotExtra = ((this.g.rotExtra || 0) + Math.PI / 2) % (Math.PI * 2); if (this.lastP) this.moveGhost(this.lastP.sx, this.lastP.sy); }
    /* where a piece snaps for the pointer at p: walls to the square, gates to a wall run, stone towers to the tile grid; null = free */
    snapSpot(type, p) {
      const g = this.g;
      if (g.walls.handles(type)) return g.walls.edgeAt(type, p);
      if (K.Breacher.GATES.has(type)) return g.gateSpot(p);
      if (type === 'stone_tower' && g.ramparts) return g.ramparts.towerSpot(p);
      return null;
    }
    moveGhost(sx, sy) {
      this.lastP = { sx, sy }; if (this.g.site.active) { this.g.site.hover(sx, sy); return; }   // a building: the site draws it
      const P = this.placing, g = this.g, p = g.app.pickGround(sx, sy);
      if (!p) { P.ghost.visible = false; return; }
      const e = this.snapSpot(P.type, p);
      const x = e ? e.x : Math.round(p.x * 4) / 4, z = e ? e.z : Math.round(p.z * 4) / 4, rot = e ? e.rot : g.autoRot(x, z), why = g.placementOk(P.type, x, z, rot);
      P.ghost.visible = true; P.ghost.position.set(x, g.play.nav.y(x, z), z); P.ghost.rotation.y = rot; CastleArt.tintGhost(P.ghost, !why); P.at = { x, z, rot, why };
      g.play.ui.tip(why ? `<b>Can’t build here</b> · ${esc(why)}` : `<b>${esc(this.c.data.piece(P.type).name)}</b> · ${g.walls.handles(P.type) ? 'click to build, or drag to draw a wall' : 'press, hold and swing the mouse to turn it, let go to build'} (${esc(Object.entries(this.c.buildCost(P.type)).map(([r, n]) => n + ' ' + K.CastleData.resName(r)).join(', '))})`, sx, sy);
    }
    click(sx, sy) {
      if (!this.placing) return false; if (this.g.site.active) { this.g.site.hover(sx, sy); return true; }
      this.moveGhost(sx, sy); const P = this.placing; if (!P.at) return true;
      if (this.g.buildAt(P.type, P.at.x, P.at.z, P.at.rot)) {
        const again = ['palisade', 'stone_wall'].includes(P.type) && !this.c.blocker(P.type);
        if (!again) this.stopPlacing(); else this.moveGhost(sx, sy);
      }
      return true;
    }
    pointerMove(sx, sy) { if (!this.placing) return false; this.moveGhost(sx, sy); return true; }
    key(e) {
      const k = e.key.toLowerCase();
      if (this.buildDetails.handleKey(e)) return true;
      if (!this.$('cModal').hidden) { if (e.key === 'Escape' || e.key === 'Enter') { const b = this.$('cModal').querySelector('.cb.pri'); if (b) b.click(); } return true; }
      if (e.key === 'Escape') { if (this.g.demolisher && this.g.demolisher.selling) { this.g.demolisher.setSelling(false); return true; } if (this.placing) { this.stopPlacing(); return true; } if (this.radialOpen) { this.toggleRadial(false); return true; } if (this.bookOpen) { this.toggleBook(false); return true; } return false; }
      if (k === 'b') { this.g.tools.toggleHammer(); return true; }
      if (k === 'h') { this.toggleBook(); return true; }
      if (k === 'r' && this.placing) { this.rotate(); return true; }
      if (this.radialOpen && /^[1-9]$/.test(e.key)) { this.pickCard(+e.key - 1); return true; }
      return false;
    }
  }
  CastleUI.ICON = ICON; CastleUI.RES_ORDER = RES_ORDER; CastleUI.PIECE_ICON = PIECE_ICON; CastleUI.SHORT = SHORT;
  K.ArtLibrary = ArtLibrary;

  K.CastleUI = CastleUI;
  void THREE;
})(typeof window !== 'undefined' ? window : globalThis);
