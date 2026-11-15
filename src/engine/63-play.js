/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · play mode: the same world and renderer, with a player you click around.
   Click ground = walk (A* on the tile grid), double-click = run, click yourself = character HUD,
   click an NPC / enemy / resource = context menu from the interaction registry. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { PropBuilder, Icons } = K;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));

  /* a character in play: model state + an ActorView. Entities expose type/name/x/z/y/r/h; actors are their own `actor`. */
  class PlayActor {
    constructor(game, cfg) {
      Object.assign(this, cfg);
      this.actor = this; this.type = cfg.role; this.hp = this.hpMax; this.alive = true; this.path = null; this.cdT = 0; this.repathT = 0;
      this.home = { x: cfg.x, z: cfg.z }; this.y = game.nav.y(cfg.x, cfg.z); this.r = cfg.r || 0.3;
      this.hostile = cfg.role === 'enemy'; this.aggro = false; this.wanderT = rnd(1, 5); this.deadT = 0;
      this.view = new (K.ActorViews ? K.ActorViews.classFor(cfg.spriteId) : K.SpriteActorView)(game.R, cfg.spriteId, { scale: cfg.scale || 1, phase: Math.random() * 7 });
      this.view.setFacing((cfg.flip ? -1 : 1) * this.view.native, 0); this.view.setPosition(this.x, this.y, this.z);
    }
    get h() { return this.view.h; }
  }

  /* path dots, click marker and hover / target rings, drawn crisp in the editor overlay scene */
  class PlayOverlay {
    constructor(game) {
      this.g = game; const S = game.app.overlay.scene;
      const lm = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false });
      const pr = game.app.renderer3.getPixelRatio();
      this.dotsBg = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x1a1206, size: 10 * pr, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.5 }));
      this.dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffe08a, size: 6 * pr, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.95 }));
      this.marker = new THREE.LineLoop(new THREE.BufferGeometry(), lm(0xffe08a)); this.hov = new THREE.LineLoop(new THREE.BufferGeometry(), lm(0xffffff, 0.85)); this.tgt = new THREE.LineLoop(new THREE.BufferGeometry(), lm(0xff6a5a, 0.95));
      this.me = new THREE.LineLoop(new THREE.BufferGeometry(), lm(0x7fd3ff, 0.75));
      this.objs = [this.dotsBg, this.dots, this.marker, this.hov, this.tgt, this.me]; this.objs.forEach((o) => { o.frustumCulled = false; o.visible = false; S.add(o); });
      this.markT = 9;
    }
    circle(x, z, r, n = 28) { const out = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; out.push(px, this.g.nav.y(px, pz) + 0.05, pz); } return out; }
    set(o, pts) { o.geometry.dispose(); o.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); o.visible = pts.length > 0; }
    path(from, pts) {
      if (!this.showPath) { if (this.dots.visible) { this.dots.visible = false; this.dotsBg.visible = false; } return; }   // no breadcrumb line: the click ring is the only marker
      const out = []; let [ax, az] = from;
      for (const [bx, bz] of pts || []) { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(L / 0.3)); for (let k = 1; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; out.push(x, this.g.nav.y(x, z) + 0.06, z); } ax = bx; az = bz; }
      this.set(this.dots, out); this.dotsBg.geometry.dispose(); this.dotsBg.geometry = this.dots.geometry.clone(); this.dotsBg.visible = this.dots.visible;
    }
    mark(x, z, bad) { this.mk = [x, z]; this.markT = 0; this.marker.material.color.setHex(bad ? 0xff6a5a : 0xffe08a); }
    ring(o, e, color) { if (!e) { o.visible = false; return; } this.set(o, this.circle(e.x, e.z, Math.max(0.3, e.r + 0.08))); o.material.color.setHex(color); }
    update(dt) {
      this.me.visible = false;   // no ring under the hero
      this.markT += dt;
      if (this.mk && this.markT < 0.7) { const k = this.markT / 0.7; this.set(this.marker, this.circle(this.mk[0], this.mk[1], 0.38 - 0.22 * k, 20)); this.marker.material.opacity = 1 - k * k; }
      else this.marker.visible = false;
    }
    dispose() { this.objs.forEach((o) => { this.g.app.overlay.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }); }
  }

  class PlayMode {
    constructor(app) {
      this.app = app; this.reg = K.Interactions; this.items = new K.ItemCatalog(); this.active = false; this.player = null; this.flags = new Set();
      this.ext = null;   // an optional game mode layered on play (K.CastleGame): it gets enter/exit/update/input hooks
      this.bplay = new K.BuildingPlay(this);   // buildings: furniture, interiors, horses, clock, saved progress
    }
    get R() { return this.app.renderer; }
    get doc() { return this.app.doc; }
    /* a new world gets a new character */
    reset() { this.player = null; this.flags = new Set(); }
    newPlayer(outfit) {
      const p = new K.PlayerState(this.items, { outfit, name: 'You' }), kit = K.DEFAULT_KIT;
      kit.equip.forEach((id) => { p.addItem(id, 1); p.equip(id); }); kit.bag.forEach(([id, n]) => p.addItem(id, n)); p.coins = kit.coins; p.healFull();
      return p;
    }

    /* ---------- enter / exit ---------- */
    enter() {
      if (this.active) return; const app = this.app, doc = this.doc, t0 = performance.now();
      app.tool.cancel(); app.overlay.clear(); app.select(null);
      this.R.syncBuildings();
      this.nav = new K.NavGrid(doc, { buildings: this.R.buildings }); this.navMs = Math.round(performance.now() - t0);
      const saved = doc.game && doc.game.player ? doc.game : null;
      const start = doc.objects.find((o) => o.kind === 'prop' && (PropBuilder.PROPS[o.type] || {}).start);
      let sx, sz; this.noStart = !start;
      if (start) { sx = start.x; sz = start.z; } else { sx = app.rig.goal.tx; sz = app.rig.goal.tz; }
      if (!this.nav.standable(sx, sz)) { const q = this.nav.nearestOk(...this.nav.tile(sx, sz), 8); if (q) [sx, sz] = this.nav.centre(...q); }
      this.spawn = { x: sx, z: sz };
      if (!this.player && saved) { this.player = new K.PlayerState(this.items, { name: 'You' }).load(saved.player); this.flags = new Set(saved.flags || []); }
      if (!this.player) this.player = this.ext && this.ext.makePlayer ? this.ext.makePlayer() : this.newPlayer(start && start.hero ? start.hero : 'warden');
      // resume where the saved game left off (the start prop stays the respawn point)
      if (saved && saved.pos && this.nav.standable(saved.pos[0], saved.pos[1])) { sx = saved.pos[0]; sz = saved.pos[1]; }
      this.unsub = this.player.on((what) => this.onPlayer(what));
      this.actors = []; this.loot = []; this.nodes = new Map(); this.pending = []; this.t = 0; this.ch = null; this.intent = null; this.target = null; this.hover = null; this.defeatT = 0;
      this.me = new PlayActor(this, { id: '@player', role: 'player', spriteId: this.player.outfit, name: 'You', level: this.player.level, hpMax: 1, x: sx, z: sz, r: 0.3 });
      this.actors.push(this.me);
      for (const o of doc.objects) {
        if (o.kind !== 'prop') continue; const def = PropBuilder.PROPS[o.type]; if (!def) continue;
        if (def.sprite && !def.start) this.actors.push(this.makeNpc(o, def));
      }
      this.baseProps = doc.objects.filter((o) => o.kind === 'prop' && (PropBuilder.PROPS[o.type] || {}).interact && this.reg.has(PropBuilder.PROPS[o.type].interact)).map((o) => this.propEntity(o));
      this.R.setStaticActorsVisible(false);
      this.ov = new PlayOverlay(this);
      if (!this.ui) this.ui = new K.PlayUI(this);
      this.bplay.enter(doc.game); this.bplay.restoreNodes(saved); this.refreshProps();
      this.savedCam = Object.assign({}, app.rig.goal); this.savedView = app.view;
      if (app.view === 'top') app.setView('orbit');
      app.rig.set({ tx: sx, tz: sz, ty: this.me.y, dist: 13, pitch: 0.74 }, true);
      this.active = true; document.body.classList.add('playing'); this.ui.show(true); this.ui.bar(); this.syncMe();
      app.renderer3.domElement.style.cursor = Icons.cursor('boot', 'pointer');
      if (this.ext) { this.ext.enter(); return; }
      app.toast(this.noStart ? 'Playing. No Player start in this world, so you start at the camera (add one from Props → Characters).' : 'Playing. Click to walk, double-click to run, click yourself for gear.');
    }
    exit() {
      if (!this.active) return; const app = this.app;
      if (this.ext) this.ext.exit();
      this.doc.game = this.snapshot(); this.bplay.exit();
      this.actors.forEach((a) => a.view.dispose()); this.loot.forEach((l) => l.view.dispose()); this.actors = []; this.loot = [];
      this.R.clearPropStates(); this.R.setStaticActorsVisible(true);
      this.ov.dispose(); this.ui.show(false); if (this.unsub) this.unsub();
      this.active = false; document.body.classList.remove('playing');
      app.rig.set(this.savedCam); if (this.savedView === 'top') app.setView('top');
      app.renderer3.domElement.style.cursor = app.tool.cursor();
    }
    makeNpc(o, def) {
      const role = PropBuilder.roleOf(o), info = K.BESTIARY[PropBuilder.spriteOf(o)] || K.BESTIARY[def.sprite] || K.BESTIARY.ghoulA, s = o.s || 1;
      return new PlayActor(this, { id: o.id, obj: o, role, spriteId: PropBuilder.spriteOf(o), info, name: o.name || (role === 'merchant' ? 'Merchant' : info.name),
        level: info.level, hpMax: info.hp, atk: info.atk, def: info.def, speed: info.speed, cd: info.cd, reach: info.reach * Math.max(1, s), x: o.x, z: o.z, r: Math.min(0.75, def.r * s), scale: s, flip: o.flip });
    }
    propEntity(o) {
      const def = PropBuilder.PROPS[o.type], s = o.s || 1;
      return { id: o.id, obj: o, type: def.interact, name: o.name || def.name, x: o.x, z: o.z, y: this.nav.y(o.x, o.z), r: def.r * s, h: (def.h || 1) * s };
    }

    /* ---------- the game API used by interaction handlers ---------- */
    toast(m) { this.app.toast(m); }
    float(e, text, cls, icon) { this.ui.float(e.x, e.y + (e.h || 1) * 0.9, e.z, text, cls, icon); }
    dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
    face(a, b) { a.view.setFacing(b.x - a.x, b.z - a.z); }
    inCombat() { return this.actors.some((a) => a.aggro && a.alive) || !!this.target; }
    sellPrice(id) { return Math.max(1, Math.floor((this.items.get(id).value || 1) * 0.5)); }
    nodeState(e) {
      let n = this.nodes.get(e.id); const spec = this.reg.get(e.type) || {};
      if (!n) { const max = (spec.node && spec.node.charges) || 1; n = { charges: max, max, respawnAt: 0 }; this.nodes.set(e.id, n); }
      return n;
    }
    channel({ label, time, onDone, anim = 'action', fade = false }) {
      this.me.path = null; this.ov.path([0, 0], []); this.ch = { label, time, t: 0, onDone, fade }; this.me.view.setState(anim);
    }
    cancelChannel() { if (this.ch) { this.ch = null; if (this.me.alive) this.me.view.setState('idle'); } }
    gather(e, o) {
      const n = this.nodeState(e), it = this.items.get(o.item);
      if (n.charges <= 0) { this.toast(`This ${e.name.toLowerCase()} is spent. It will regrow soon.`); return; }
      if (o.tool && !this.player.hasTool(o.tool)) { this.toast(`You need a ${this.items.get(o.toolItem).name.toLowerCase()} to ${o.verb.toLowerCase()} here.`); this.float(this.me, 'Need ' + this.items.get(o.toolItem).name, 'miss', o.cursor); return; }
      if (!this.player.canAdd(o.item, 1)) { this.toast('Your bag is full.'); return; }
      this.face(this.me, e);
      this.channel({ label: (o.ing || o.verb + 'ing') + '…', time: o.time, onDone: () => {
        this.player.addItem(o.item, 1); this.float(this.me, '+1 ' + it.name, 'loot', it.icon); this.gainXp(o.xp);
        if (o.item === 'iron' && Math.random() < 0.3 && this.player.addItem('coal', 1) === 0) this.float(this.me, '+1 Coal', 'loot', 'coal');
        n.charges--;
        if (n.charges <= 0) { n.respawnAt = this.t + ((this.reg.get(e.type).node || {}).respawn || 30); this.R.setPropState(e.id, 'depleted'); this.toast(`The ${e.name.toLowerCase()} is spent. It will regrow in a while.`); this.me.view.setState('idle'); }
        else this.gather(e, o);   // keep working until it runs out (any click stops)
      } });
    }
    engage(e) {
      if (!e.alive) return; this.target = e; this.intent = null; this.cancelChannel();
      if (!e.hostile) { e.hostile = true; this.toast(`${e.name} turns on you!`); }
      e.aggro = true;
    }
    inspect(e) { const [sx, sy] = this.toScreen(e.x, e.y + (e.h || 1), e.z); this.ui.openCard(e, this.reg.inspect(e, this), sx, sy); }
    openDialogue(a) {
      const tree = K.DIALOGUE[a.role === 'merchant' ? 'merchant' : a.spriteId] || K.DIALOGUE.generic;
      this.talking = a; a.path = null; this.face(a, this.me); this.face(this.me, a); a.view.setState('idle');
      this.ui.close('trade'); this.showNode(a, tree, tree.start);
    }
    showNode(a, tree, key) {
      let node = tree.nodes[key]; if (!node) { this.ui.close('dlg'); return; }
      node = Object.assign({}, node, { tree, choices: node.choices.map((c) => (c.once && this.flags.has(c.once) && c.alt ? Object.assign({}, c, { next: c.alt, once: null }) : c)) });
      if (node.give && !this.flags.has('gave:' + key + ':' + a.id)) {
        this.flags.add('gave:' + key + ':' + a.id);
        for (const [id, n] of node.give) { const left = this.player.addItem(id, n); if (left < n) this.float(this.me, '+' + (n - left) + ' ' + this.items.get(id).name, 'loot', this.items.get(id).icon); }
      }
      this.ui.openDialogue(a, node);
    }
    dialogueChoice(a, c) {
      if (c.once) this.flags.add(c.once);
      if (c.trade) { this.ui.close('dlg'); this.openTrade(a); return; }
      if (c.end) { this.ui.close('dlg'); return; }
      this.showNode(a, this.ui.dlg.node.tree, c.next);
    }
    openTrade(a) { this.talking = a; a.path = null; this.face(a, this.me); this.face(this.me, a); this.ui.close('dlg'); this.ui.openTrade(a); }
    endConversation() { if (!this.ui.isOpen('dlg') && !this.ui.isOpen('trade')) this.talking = null; }
    buy(id) {
      const row = K.SHOP.find((r) => r[0] === id); if (!row) return;
      if (this.player.coins < row[1]) { this.toast('Not enough coin.'); return; }
      if (!this.player.canAdd(id, 1)) { this.toast('Your bag is full.'); return; }
      this.player.spendCoins(row[1]); this.player.addItem(id, 1); this.toast(`Bought ${this.items.get(id).name} for ${row[1]} coins.`);
    }
    sell(index) {
      const s = this.player.bag[index]; if (!s) return; const it = this.items.get(s.id), price = this.sellPrice(s.id);
      this.player.takeFromBag(index, 1); this.player.addCoins(price); this.toast(`Sold ${it.name} for ${price} coins.`);
    }
    takeLoot(e) {
      const got = [];
      const keep = [];
      for (const [id, n] of e.items) { const left = this.player.addItem(id, n); if (left < n) got.push((n - left) + ' ' + this.items.get(id).name); if (left > 0) keep.push([id, left]); }
      e.items = keep;
      if (e.coins) { this.player.addCoins(e.coins); got.push(e.coins + ' coins'); e.coins = 0; }
      if (got.length) { this.float(this.me, '+' + got.join(', '), 'loot', 'bag'); this.toast('Looted ' + got.join(', ') + '.'); }
      if (!e.items.length) this.removeLoot(e); else this.toast('Your bag is full; some loot is left on the ground.');
    }
    removeLoot(e) { e.view.dispose(); this.loot = this.loot.filter((l) => l !== e); if (this.hover === e) this.hover = null; }
    gainXp(n) { if (this.ext) return; if (this.player.gainXp(n)) { this.float(this.me, 'Level ' + this.player.level + '!', 'heal'); this.toast(`Level up! You are now level ${this.player.level}.`); } }
    onPlayer(what) {
      if (what === 'outfit') this.me.view.setSprite(this.player.outfit);
      if (what === 'hp' || what === 'xp' || what === 'level' || what === 'coins' || what === 'bag' || what === 'equip' || what === 'use' || what === 'load') {
        this.ui.bar(); this.ui.renderHud(); this.ui.renderTrade();
      }
      if (what === 'use') this.me.view.flash('heal');
      if (what !== 'hp' && what !== 'xp') this.bplay.dirty();
    }
    /* clickable things: resource props + furniture inside buildings */
    refreshProps() { this.props = (this.baseProps || []).concat(this.bplay.entities(), this.ext && this.ext.entities ? this.ext.entities() : []); if (this.hover && this.hover.furniture && !this.props.some((p) => p.id === this.hover.id)) this.hover = null; }
    snapshot() { return this.bplay.snapshot(); }

    /* ---------- commands ---------- */
    walkTo(x, z, run, up = false) {
      this.cancelChannel(); this.intent = null; this.target = null;
      const path = this.findMe(x, z, up);
      if (!path) {
        this.ov.mark(x, z, true);
        this.toast(up ? 'No stair up to there: join the wall to a stone tower.' : "You can't get there from here.");
        this.float({ x, z, y: this.nav.y(x, z), h: 0.3 }, '✕', 'miss');
        return false;
      }
      const end = path[path.length - 1] || [x, z];
      this.me.path = path; this.me.run = run; this.ov.mark(end[0], end[1]); this.ov.path([this.me.x, this.me.z], path);
      return true;
    }
    /* the hero's path to (x, z): on the ground, or (up) on the ramparts; stairs join the two (127-castle-ramparts.js) */
    findMe(x, z, up = false) {
      const ramp = this.ramparts();
      if (ramp && (up || ramp.onRamparts(this.me))) return ramp.route(this.me, x, z, up);
      return this.nav.find(this.me.x, this.me.z, x, z);
    }
    /* the walkable point under the cursor: a rampart top first (it stands in front of the ground), then open ground */
    pickWalk(sx, sy) {
      const ramp = this.ramparts(), r = ramp && ramp.pick(sx, sy);
      if (r) return { x: r.x, z: r.z, up: true };
      const p = this.app.pickGround(sx, sy);
      return p && this.nav.standable(p.x, p.z) ? { x: p.x, z: p.z, up: false } : null;
    }
    /* a click on a wall top walks you up there, unless the hammer is out (it takes walls down) or something else is in front */
    rampartClick(sx, sy, e) {
      const ramp = this.ramparts(), tools = this.ext && this.ext.tools;
      if (!ramp || (tools && tools.tool.id === 'hammer')) return null;
      if (e && !(e.type === 'c_piece' && K.Ramparts.handles(e.piece.type))) return null;
      return ramp.pick(sx, sy);
    }
    /* walk into range (if the action has one), then run it */
    doAction(e, act, run) {
      this.ui.close('ctx'); this.cancelChannel(); this.target = null; this.intent = null;
      if (!act.range) { act.run(this, e); return; }
      // furniture: walk to the tile in front of it (never "in range" through a wall)
      if (e.furniture && this.bplay.near(e)) { this.me.path = null; this.face(this.me, e); act.run(this, e); return; }
      if (e.furniture) {
        const approach = this.bplay.approach(e);
        if (!approach) { this.toast(`You can't reach ${e.name}.`); return; }
        this.me.path = approach.path; this.me.run = !!run;
        this.intent = { e, act, tgt: approach.tgt, rng: 0, retry: 2, repathT: 0.4 };
        this.ov.path([this.me.x, this.me.z], approach.path); return;
      }
      let tgt = e.goal ? { x: e.goal[0], z: e.goal[1] } : e, rng = e.goal ? 0.3 : act.range;
      if (this.dist(this.me, tgt) <= rng) { this.me.path = null; this.face(this.me, e); act.run(this, e); return; }
      let path = this.nav.find(this.me.x, this.me.z, tgt.x, tgt.z, { range: rng });
      if (!path && e.goal) { tgt = e; rng = act.range; path = this.nav.find(this.me.x, this.me.z, e.x, e.z, { range: rng }); }
      if (!path) { this.toast(`You can't reach ${e.name}.`); this.ov.mark(e.x, e.z, true); return; }
      this.me.path = path; this.me.run = !!run; this.intent = { e, act, tgt, rng, retry: 2, repathT: 0.4 }; this.ov.path([this.me.x, this.me.z], path);
    }

    /* ---------- input ---------- */
    pointerDown(e, sx, sy) { this.down = { sx, sy, cx: sx, cy: sy, t: performance.now(), held: false, moved: false }; this.holdT = 0; this.stroke = !!(this.ext && this.ext.pointerDown && this.ext.pointerDown(sx, sy)); }   // a game mode may claim the press (drawing a wall)
    /* button held and the pointer moved: remember where, for hold-to-walk */
    dragMove(sx, sy) { const d = this.down; if (!d) return; if (this.stroke) { this.ext.pointerDrag(sx, sy); return; } d.cx = sx; d.cy = sy; if (Math.hypot(sx - d.sx, sy - d.sy) > 6) d.moved = true; }
    pointerUp(e, sx, sy) {
      const d = this.down; this.down = null;
      if (this.stroke) { this.stroke = false; this.ext.pointerUp(sx, sy); return; }
      if (!d || d.held || Math.hypot(sx - d.sx, sy - d.sy) > 6) return;   // a hold-walk or a drag is not a click
      this.click(sx, sy);
    }
    /* Diablo-style hold-to-walk: keep the left button down on open ground and the hero follows the cursor */
    holdWalk(dt) {
      const d = this.down; if (!d || !this.me.alive) return;
      if (this.stroke || (this.ext && this.ext.cui && this.ext.cui.placing)) return;
      if (performance.now() - d.t < 230 && !d.held) return;
      this.holdT -= dt; if (this.holdT > 0) return; this.holdT = 0.1;
      if (!d.held && (this.pick(d.sx, d.sy) || (this.ext && this.ext.tools && this.ext.tools.claims(d.sx, d.sy)))) d.cancel = true;   // pressed on a thing or a tool target: a click, not a walk   // pressed on a thing: that is a click, not a walk
      if (d.cancel) return;
      const p = this.pickWalk(d.cx, d.cy); if (!p) return;
      if (Math.hypot(p.x - this.me.x, p.z - this.me.z) < 0.35) return;
      d.held = true; this.holdGo(p.x, p.z, p.up);
    }
    holdGo(x, z, up = false) {
      const path = this.findMe(x, z, up); if (!path) return;
      this.cancelChannel(); this.intent = null; this.target = null; this.ui.close('ctx'); this.ui.close('card');
      this.me.path = path; this.me.run = true; this.ov.mark(x, z);
    }
    /* right-click (no drag): the "more…" menu for the thing under the cursor */
    rightClick(sx, sy) {
      if (!this.me.alive) return;
      this.ui.close('ctx'); this.ui.close('card'); this.ui.tip(null);
      const e = this.pick(sx, sy); if (!e || e === this.me) { if (this.ext && this.ext.rightClick) this.ext.rightClick(sx, sy); return; }   // empty ground: a game mode may use it (drop a pile)
      if (e.remote && this.ext && this.ext.playerMenu) { this.ext.playerMenu(e); return; }   // right-click another player: invite, demand tribute
      const acts = this.reg.actions(e, this); if (acts.length) this.ui.openMenu(e, acts, sx, sy);
    }
    click(sx, sy) {
      if (this.ext && this.ext.click(sx, sy)) return;
      if (!this.me.alive) return;
      const now = performance.now(), last = this.lastClick, dbl = last && now - last.t < 340 && Math.hypot(sx - last.sx, sy - last.sy) < 26;
      this.lastClick = dbl ? null : { t: now, sx, sy };
      this.ui.close('ctx'); this.ui.close('card'); this.ui.tip(null);
      let e = this.pick(sx, sy);
      if (e === this.me) { this.ui.toggleHud(); return; }
      const up = this.rampartClick(sx, sy, e);
      if (up) e = null;
      if (up && dbl && this.me.path) { this.me.run = true; return; }
      if (up) { this.walkTo(up.x, up.z, dbl, true); return; }
      if (e) {
        const acts = this.reg.actions(e, this);
        if (acts.length) { this.doAction(e, acts[0], dbl); return; }   // Diablo: one click does the main action (walk over, then chop / mine / attack / talk)
        return;
      }
      const p = this.app.pickGround(sx, sy); if (!p) return;
      if (dbl && this.me.path) { this.me.run = true; return; }   // second click of a double-click: same target, now running
      this.walkTo(p.x, p.z, dbl);
    }
    /* the pointer moved: default hover, then the game mode may restyle the cursor (the castle tools do) */
    pointerMove(e, sx, sy) {
      this.hoverDefault(e, sx, sy);
      if (this.ext && this.ext.tools && !this.ext.cui.placing) { const c = this.ext.tools.hoverCursor(this.hover, sx, sy); if (c) this.app.renderer3.domElement.style.cursor = c; }
    }
    hoverDefault(e, sx, sy) {
      if (this.ext && this.ext.pointerMove(sx, sy)) return;
      const ent = this.pick(sx, sy), el = this.app.renderer3.domElement;
      if (ent !== this.hover) {
        if (this.hover && this.hover.view && this.hover.view.setHighlight) this.hover.view.setHighlight(null);
        this.hover = ent;
        if (ent && ent.view && ent.view.setHighlight && ent !== this.me) ent.view.setHighlight(0x6f7280);
        this.ov.ring(this.ov.hov, ent && ent !== this.me ? ent : null, ent ? this.reg.color(ent) : 0xffffff);
      }
      if (ent === this.me) { el.style.cursor = Icons.cursor('bag', 'pointer'); this.ui.tip('<b>You</b> · click for gear and bag', sx, sy); return; }
      if (ent) {
        const acts = this.reg.actions(ent, this), spec = this.reg.get(ent.type), nm = spec && spec.name ? spec.name(ent) : ent.name;
        el.style.cursor = Icons.cursor(this.reg.cursor(ent, this), 'pointer');
        const spent = spec && spec.node && this.nodeState(ent).charges <= 0;
        this.ui.tip(`<b>${nm.replace(/</g, '&lt;')}</b>${ent.actor ? ' · Lv ' + ent.level : ''}${spent ? ' · spent, regrowing' : acts[0] ? ' · ' + acts[0].label : ''}`, sx, sy);
        return;
      }
      this.ui.tip(null);
      const p = this.app.pickGround(sx, sy);
      el.style.cursor = Icons.cursor(p && this.nav.standable(p.x, p.z) ? 'boot' : 'no', 'pointer');
    }
    key(e) {
      const k = e.key.toLowerCase();
      if (this.ext && this.ext.key(e)) return true;
      if (e.key === 'Escape') { this.ui.closeTop(); this.ui.tip(null); return true; }
      if (k === 'c' || k === 'i') { this.ui.toggleHud(); return true; }
      if (k === 'm' && this.bplay.mounted) { this.bplay.dismount(); return true; }
      if (/^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (this.ui.isOpen('ctx')) return this.ui.pickMenu(i); if (this.ui.isOpen('dlg')) return this.ui.pickChoice(i); }
      return false;
    }
    /* topmost entity under the cursor (actors win ties with props) */
    pick(sx, sy) {
      const cam = this.app.camera, r = this.app.renderer3.domElement.getBoundingClientRect(), W = r.width, H = r.height, cp = cam.position;
      let best = null, bd = 1e9;
      for (const a of this.actors) {
        if (!a.view.visible || (!a.alive && a !== this.me) ) continue;
        const q = a.view.screenRect(cam, W, H); if (!q.front) continue;
        if (sx >= q.x0 - 3 && sx <= q.x1 + 3 && sy >= q.y0 - 3 && sy <= q.y1 + 3) { const d = Math.hypot(cp.x - a.x, cp.y - a.y, cp.z - a.z) - 0.6; if (d < bd) { bd = d; best = a; } }
      }
      const v = new V3(), right = new V3().setFromMatrixColumn(cam.matrixWorld, 0);
      for (const e of this.props.concat(this.loot)) {
        if (e.furniture && e.buildingId !== this.bplay.inside) continue;
        if (this.ext && this.ext.pickable && !this.ext.pickable(e)) continue;   // the game mode can make things unclickable (a tree is not clickable unless you hold an axe)
        v.set(e.x, e.y, e.z).project(cam); if (v.z > 1) continue; const bx = (v.x + 1) / 2 * W, by = (1 - v.y) / 2 * H;
        v.set(e.x, e.y + e.h, e.z).project(cam); const ty = (1 - v.y) / 2 * H;
        v.set(e.x + right.x * e.r, e.y, e.z + right.z * e.r).project(cam); const hw = Math.max(10, Math.abs((v.x + 1) / 2 * W - bx));
        const top = this.ext && this.ext.pickHeight ? Math.max(Math.min(ty, by), by - this.ext.pickHeight(e) * hw) : Math.min(ty, by);   // tall resources only answer near their base, so a far tree behind the spot you clicked is not picked
        if (sx >= bx - hw && sx <= bx + hw && sy >= top - 4 && sy <= by + hw * 0.5) { const d = Math.hypot(cp.x - e.x, cp.y - e.y, cp.z - e.z); if (d < bd) { bd = d; best = e; } }
      }
      return best;
    }
    toScreen(x, y, z) {
      const v = new V3(x, y, z).project(this.app.camera), r = this.app.renderer3.domElement.getBoundingClientRect();
      return [(v.x + 1) / 2 * r.width + r.left, (1 - v.y) / 2 * r.height + r.top, v.z < 1];
    }

    /* ---------- simulation ---------- */
    syncMe() { const s = this.player.stats(); Object.assign(this.me, { hpMax: s.hpMax, hp: this.player.hp, atk: s.atk, def: s.def, level: s.level, speed: 2.3 * s.speed * this.bplay.speedMul, cd: s.cd || 0.9, reach: 0.85 }); }
    update(dt) {
      if (!this.active) return; this.t += dt; this.syncMe();
      const me = this.me;
      // pending hits land a beat after the swing starts
      this.pending = this.pending.filter((h) => { h.t -= dt; if (h.t > 0) return true; this.resolveHit(h.a, h.b, h.reach); return false; });
      if (!me.alive) { this.defeatT -= dt; if (this.defeatT <= 0) this.respawnPlayer(); }
      else { this.holdWalk(dt); this.updatePlayer(dt); }
      for (const a of this.actors) if (a !== me) { if (a.brain) a.brain.update(dt); else this.updateNpc(a, dt); }
      if (this.ext) this.ext.update(dt);
      for (const [id, n] of this.nodes) if (n.respawnAt && this.t >= n.respawnAt) { n.respawnAt = 0; n.charges = n.max; this.R.setPropState(id, null); }
      this.loot = this.loot.filter((l) => { if (this.t > l.until) { l.view.dispose(); return false; } return true; });
      if (this.talking && this.dist(me, this.talking) > 3.2) { this.ui.close('dlg'); this.ui.close('trade'); this.talking = null; }
      // regen out of combat
      if (!(this.ext && this.ext.noRegen) && me.alive && !this.inCombat() && this.player.hp < this.player.stats().hpMax) { this.regenT = (this.regenT || 0) + dt; if (this.regenT > 1.5) { this.regenT = 0; this.player.heal(1); } } else this.regenT = 0;
      // camera follows the player
      const g = this.app.rig.goal; g.tx = me.x; g.tz = me.z; g.ty = me.y * 0.9; this.app.rig.clamp();
      this.bplay.update(dt);
      // views
      const yaw = this.R.cameraYaw(this.app.camera), tilt = -Math.max(0, this.app.rig.cur.pitch - 0.8) * 0.9;
      for (const a of this.actors) { a.view.setPosition(a.x, a.y + (a === me ? this.bplay.riderLift : 0), a.z); a.view.update(this.t, dt, yaw, tilt); }
      for (const l of this.loot) l.view.update(this.t, dt, yaw);
      this.ov.update(dt); this.ov.ring(this.ov.tgt, this.target && this.target.alive ? this.target : null, 0xff6a5a);
      if (this.hover && (this.hover.alive === false || (this.hover.view && this.hover.view.visible === false))) { this.hover = null; this.ov.ring(this.ov.hov, null); }
    }
    /* walk an actor along its path; returns true while moving */
    move(a, dt, speed) {
      if (!a.path || !a.path.length) { a.path = null; return false; }
      const ramp = a === this.me ? this.ramparts() : null;
      if (ramp) ramp.adopt(a);   // up on the walls: a plain ground path goes down a tower first
      if (!a.path || !a.path.length) { a.path = null; return false; }
      const walker = ramp && ramp.walker;
      let step = speed * dt;
      while (step > 0 && a.path.length) {
        const wp = a.path[0], [tx, tz] = wp, dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
        if (d > 1e-4) a.view.setFacing(dx, dz);
        if (walker) walker.begin(a, wp, d);
        if (d <= step) {
          a.x = tx; a.z = tz; step -= d; a.path.shift();
          if (walker) walker.arrive(a, wp);
        } else {
          a.x += dx / d * step; a.z += dz / d * step;
          if (walker) walker.along(a, wp, d - step);
          step = 0;
        }
      }
      this.settle(a, dt, walker);
      if (!a.path.length) a.path = null;
      return true;
    }
    /* ease the actor's height to what it stands on: its rampart walk up top, else the ground (a stair leg sets its own) */
    settle(a, dt, walker) {
      if (a.layer === 'stair') return;
      const up = walker ? walker.rest(a) : null, gy = up != null ? up : this.nav.y(a.x, a.z);
      a.y += (gy - a.y) * Math.min(1, dt * 14);
      if (Math.abs(gy - a.y) > 0.6) a.y = gy;
    }
    /* the castle's ramparts (123-127-castle-ramp*.js), when this game mode has them */
    ramparts() { return this.ext && this.ext.ramparts ? this.ext.ramparts : null; }
    updatePlayer(dt) {
      const me = this.me; me.cdT -= dt;
      if (this.ch) { this.ch.t += dt; if (this.ch.t >= this.ch.time) { const c = this.ch; this.ch = null; c.onDone(); } return; }
      const t = this.target;
      if (t) {
        if (!t.alive) { this.target = null; }
        else {
          const reach = 0.55 + t.r, d = this.dist(me, t);
          if (d > reach) {
            me.repathT -= dt;
            if (!me.path || me.repathT <= 0) { me.repathT = 0.35; const p = this.nav.find(me.x, me.z, t.x, t.z, { range: reach * 0.85 }); if (p) { me.path = p; if (d > 2.5) me.run = true; } else { this.toast(`You can't reach ${t.name}.`); this.target = null; } }
          } else { me.path = null; this.face(me, t); if (me.cdT <= 0) this.swing(me, t); }
        }
      }
      const moving = this.move(me, dt, me.speed * (me.run ? 1.9 : 1) * (this.ext && this.ext.workers ? this.ext.workers.speedMul : 1));
      if (moving) { if (me.view.state !== 'attack' && me.view.state !== 'hurt') me.view.setState(me.run ? 'run' : 'walk'); if (!this.pathT || (this.pathT -= dt) <= 0) { this.pathT = 0.1; this.ov.path([me.x, me.z], me.path); } }
      else { if (me.view.state === 'walk' || me.view.state === 'run') me.view.setState('idle'); me.run = me.run && !!this.intent; this.ov.path([0, 0], []); }
      const it = this.intent;
      if (it) {
        const e = it.e, gone = (e.actor && !e.alive) || (e.type === 'loot' && !this.loot.includes(e));
        if (gone) this.intent = null;
        else if (e.furniture ? this.bplay.near(e) : this.dist(me, it.tgt || e) <= (it.rng != null ? it.rng : it.act.range) + 0.05) { this.intent = null; me.path = null; this.face(me, e); if (me.view.state === 'walk' || me.view.state === 'run') me.view.setState('idle'); it.act.run(this, e); }
        else if (e.actor && (it.repathT -= dt) <= 0) { it.repathT = 0.4; const p = this.nav.find(me.x, me.z, e.x, e.z, { range: it.act.range }); if (p) me.path = p; }
        else if (!moving) { if (it.retry-- > 0) { const q = it.tgt || e, p = this.nav.find(me.x, me.z, q.x, q.z, { range: it.rng != null ? it.rng : it.act.range }); if (p && p.length) me.path = p; else this.intent = null; } else this.intent = null; }
      }
    }
    updateNpc(a, dt) {
      const me = this.me; a.cdT -= dt;
      if (!a.alive) {
        a.deadT += dt;
        if (a.deadT > 0.9 && !a.dropped) { a.dropped = true; a.view.setVisible(false); this.dropLoot(a); }
        if (a.deadT > (a.role === 'enemy' ? 45 : 60)) this.respawnNpc(a);
        return;
      }
      if (this.talking === a) { a.path = null; if (a.view.state === 'walk') a.view.setState('idle'); return; }
      const d = this.dist(a, me);
      if (a.hostile && !a.aggro && a.role === 'enemy' && me.alive && d < 2.1) { a.aggro = true; this.float(a, '!', 'hurt'); }
      if (a.aggro && (!me.alive || this.dist(a, a.home) > 10)) {
        a.aggro = false; a.path = this.nav.find(a.x, a.z, a.home.x, a.home.z); a.hp = a.hpMax; if (a.role !== 'enemy') a.hostile = a.hostile && me.alive;
      }
      if (a.aggro) {
        const reach = a.reach + me.r * 0.5;
        if (d > reach) { a.repathT -= dt; if (!a.path || a.repathT <= 0) { a.repathT = 0.45; a.path = this.nav.find(a.x, a.z, me.x, me.z, { range: reach * 0.85 }); } }
        else { a.path = null; this.face(a, me); if (a.cdT <= 0) this.swing(a, me); }
        const moving = this.move(a, dt, a.speed * 1.25);
        if (moving) { if (a.view.state !== 'attack' && a.view.state !== 'hurt') a.view.setState('run'); } else if (a.view.state === 'run' || a.view.state === 'walk') a.view.setState('idle');
        return;
      }
      // idle wander near home (merchants stay put)
      const moving = this.move(a, dt, a.speed * 0.45);
      if (moving) { if (a.view.state !== 'hurt') a.view.setState('walk'); return; }
      if (a.view.state === 'walk' || a.view.state === 'run') a.view.setState('idle');
      if (a.role === 'merchant') return;
      if ((a.wanderT -= dt) <= 0) {
        a.wanderT = rnd(4, 9); const an = Math.random() * Math.PI * 2, r = rnd(0.4, 1.3);
        const tx = a.home.x + Math.cos(an) * r, tz = a.home.z + Math.sin(an) * r;
        if (this.nav.standable(tx, tz) && this.dist({ x: tx, z: tz }, me) > 0.8) { const p = this.nav.find(a.x, a.z, tx, tz, { maxNodes: 400 }); if (p && p.length <= 4) a.path = p; }
      }
    }
    swing(a, b) { if (a === this.me && this.ext && this.ext.sweep) { this.ext.sweep.swing(b, true); return; }   // the hero's auto swing is the big arc (it stops when you stop clicking)
      a.cdT = a.cd; a.view.setState('attack'); this.face(a, b); this.pending.push({ t: 0.2, a, b }); }
    resolveHit(a, b, reach) {
      if (!a.alive || !b.alive || this.dist(a, b) > (reach || a.reach) + b.r + 0.6) return;
      if (b.remote) { if (this.ext && this.ext.pvpHit) this.ext.pvpHit(a, b); return; }   // another player: the server decides what a blow does
      if (!this.ext && Math.random() < 0.08) { this.float(b, 'miss', 'miss'); return; }
      const dmg = this.ext ? this.ext.damage(a, b) : Math.max(1, Math.round(a.atk * rnd(0.7, 1.3) - b.def * 0.5));
      a.lastFight = b.lastFight = this.t; b.view.flash('hit'); if (b.view.state !== 'attack') b.view.setState('hurt');
      if (b === this.me) {
        this.float(b, '-' + dmg, 'hurt'); if (this.ext && this.ext.onHurt) this.ext.onHurt(a, dmg);
        if (this.player.hurt(dmg)) this.defeat();
      } else {
        b.hp -= dmg; this.float(b, String(dmg), 'dealt');
        if (this.ext) this.ext.onHit(a, b, dmg);
        if (!b.aggro) { b.aggro = true; b.hostile = true; }
        if (b.hp <= 0) this.kill(b);
      }
    }
    kill(a) {
      a.alive = false; a.hp = 0; a.deadT = 0; a.dropped = false; a.aggro = false; a.path = null; a.view.setState('dead');
      if (this.target === a) this.target = null; if (this.hover === a) this.hover = null;
      this.toast(`${a.name} is defeated.`); this.gainXp(a.info.xp || 10);
      if (this.ext) this.ext.onKill(a);
    }
    dropLoot(a) {
      const items = []; for (const [id, lo, hi, p] of a.info.loot || []) if (Math.random() < p) items.push([id, irnd(lo, hi)]);
      const coins = a.info.coins ? irnd(a.info.coins[0], a.info.coins[1]) : 0; if (!items.length && !coins) return;
      const view = new K.IconBillboard(this.R, 'bag', 0.42), y = this.nav.y(a.x, a.z);
      view.setPosition(a.x, y, a.z);
      this.loot.push({ id: 'loot' + Math.floor(Math.random() * 1e9), type: 'loot', name: 'Loot', x: a.x, z: a.z, y, r: 0.25, h: 0.45, items, coins, view, until: this.t + 180 });
    }
    respawnNpc(a) {
      a.alive = true; a.hp = a.hpMax; a.x = a.home.x; a.z = a.home.z; a.y = this.nav.y(a.x, a.z); a.hostile = a.role === 'enemy'; a.aggro = false; a.deadT = 0;
      a.view.setState('idle'); a.view.setVisible(true);
    }
    defeat() {
      const me = this.me; me.alive = false; me.path = null; this.target = null; this.intent = null; this.ch = null; this.defeatT = this.ext ? this.ext.wakeSec() : 2.6;
      if (this.bplay.mounted) this.bplay.dismount({ quiet: true });
      me.view.setState('dead'); this.ui.closeAll(); this.toast(this.ext ? 'You fall… you will wake by the Keep. Nothing is lost.' : 'You were defeated… you will wake at the start.');
      for (const a of this.actors) if (a !== me) a.aggro = false;
    }
    respawnPlayer() {
      const me = this.me; me.x = this.spawn.x; me.z = this.spawn.z; me.y = this.nav.y(me.x, me.z); me.layer = 'ground'; me.leg = null; me.alive = true;
      this.player.healFull(); me.view.setState('idle'); this.app.rig.set({ tx: me.x, tz: me.z }, true); this.toast(this.ext ? 'You wake by the Keep.' : 'You wake at the start, a little wiser.');
    }
  }

  K.PlayMode = PlayMode;
})(typeof window !== 'undefined' ? window : globalThis);
