/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the castle's tool controller. Thin on purpose: it turns pointer and key input into WorkTargets
   and hands them to the Worker, and owns the collaborators (Toolbelt, Effects, TerrainEditor, ProgressLedger).
   Rules live in the classes in 86-88; this file only wires them to CastleGame and PlayMode.

   Hooks CastleGame calls:   click(sx, sy)  engage(target|entity)  key(e)  update(dt)  dispose()
   Hooks PlayMode calls:     claims(sx, sy)  hoverCursor(entity, sx, sy) */
(function (G) {
  const K = G.K;

  /** The outline drawn on the tile you are about to work. */
  class TileHighlight {
    constructor(overlay) { this.ov = overlay; this.shown = false; }
    show(target, doc) {
      const x0 = target.i * K.TILE, z0 = target.j * K.TILE, s = K.TILE, y = doc.hy(target.i, target.j) + 0.06;
      this.ov.set(this.ov.hov, [x0, y, z0, x0 + s, y, z0, x0 + s, y, z0 + s, x0, y, z0 + s]);
      this.ov.hov.material.color.setHex(target.requires === 'pickaxe' ? 0xff9a3a : 0xffe08a); this.shown = true;
    }
    hide() { if (this.shown) { this.ov.hov.visible = false; this.shown = false; } }
  }

  class CastleTools {
    constructor(game) {
      this.g = game; const play = game.play;
      this.editor = new K.TerrainEditor(game); this.ledger = new K.ProgressLedger();
      this.effects = new K.Effects(game.group, this.effectsEnv());
      this.ctx = { game, play, effects: this.effects, editor: this.editor, ledger: this.ledger };
      this.belt = new K.Toolbelt([new K.SwordTool(), new K.AxeTool(), new K.PickaxeTool(), new K.ShovelTool(), new K.HammerTool()], (tool) => this.onSelect(tool), game.cui.root);   // inside #castleui so the panel styles apply
      this.drawer = new K.BuildDrawer(game.cui);
      this.archery = new K.Archery(game);
      this.arms = new K.WeaponDrawer(game.cui, this.belt); this.belt.onWeaponsChanged = () => this.arms.update(); this.belt.onWeaponSlot = (was) => { if (was) this.arms.toggle(); else this.arms.show(); };   // clicking the weapon slot opens the weapon drawer
      this.belt.onModeSlot = (tool, was) => { const b = this.g.brush; if (b) { if (was) b.drawer.toggle(); else b.drawer.show(); } };   // click the shovel to open its modes
      this.worker = new K.Worker(this.ctx, this.belt); this.hl = new TileHighlight(play.ov); this.fullAt = -9;
    }
    get play() { return this.g.play; }
    get tool() { return this.belt.current; }

    /** what Effects needs from the game, in one place */
    effectsEnv() {
      const g = this.g, play = g.play;
      return {
        floorY: (x, z) => play.nav.y(x, z), hero: () => play.me, time: () => play.t,
        sound: (n) => g.sound.play(n), shake: (s) => { g.shakeT = Math.max(g.shakeT || 0, s); },
        canTake: (kind) => kind === 'furn' || (kind === 'bread' && play.player.canAdd('bread', 1)) || g.castle.amount(kind) < (g.castle.caps()[kind] || 0),
        notifyFull: (kind) => { if (play.t - this.fullAt < 2) return; this.fullAt = play.t; g.cui.toast(`Your ${K.CastleData.resName(kind)} store is full.`); g.cui.flashRes(kind); },
        grant: (p) => {
          if (p.kind === 'bread') { play.player.addItem('bread', p.value); play.float(play.me, '+1 bread', 'loot'); g.sound.play('gather'); return; }   // loaves go in your bag
          if (p.payload && p.payload.restore) { p.payload.restore(); g.sound.play('thunk'); return; }   // a stolen piece of furniture coming home
          const c = g.castle, got = Math.round(p.exact || p.kind === 'dirt' ? c.add(p.kind, p.value) : c.gather(p.kind, p.value));
          if (got > 0) { play.float(play.me, `+${got}`, 'loot', K.CastleUI.ICON[p.kind]); g.cui.bump(p.kind); g.sound.play('gather'); g.changed(); }
        },
      };
    }
    onSelect(tool) {
      if (tool.id !== 'shovel' && this.g.brush) this.g.brush.drawer.close();
      const hammer = tool.id === 'hammer'; this.drawer.setOpen(hammer); if (tool.kind !== 'weapon') this.arms.close();
      if (!hammer) { this.g.cui.stopPlacing(); if (this.g.demolisher) this.g.demolisher.hide(); }
      this.worker.cancel(); this.hl.hide(); this.g.sound.play('clank'); this.g.cui.toast(tool.hint);
      this.play.app.renderer3.domElement.style.cursor = '';
    }

    /* ---------- input ---------- */
    toggleHammer() { this.belt.select(this.tool.id === 'hammer' ? 'sword' : 'hammer'); }
    key(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const P = this.play; if (P.ui.isOpen('ctx') || P.ui.isOpen('dlg')) return false;      // digits pick menu entries then
      const t = this.belt.byKey(e.key); if (!t) return false;
      if (t.kind === 'weapon' && this.tool === t) { this.arms.toggle(); return true; }
      if (t.modes && this.tool === t && this.g.brush) { this.g.brush.drawer.toggle(); return true; }   // press the weapon key again: the weapon drawer
      this.belt.select(t.id); return true;
    }
    /** may the mouse hit this entity with the tool in hand? Resources are invisible to the wrong tool, so a click just walks. */
    canInteract(e) {
      const need = K.WorkTarget.TOOL_FOR[e.type]; if (!need) return true;
      return this.tool.id === need && this.play.nodeState(e).charges > 0;
    }
    /** a left-click. true = handled here (the click does not also walk). */
    click(sx, sy) {
      if (this.g.cui.click(sx, sy)) return true;
      const P = this.play; if (!P.me.alive) return false;
      if (this.tool.ranged && this.archery.click(sx, sy)) return true;   // bow: shoot, do not walk
      const e = P.pick(sx, sy);
      if (e && e.remote && this.g.mp) { this.g.mp.playerMenu(e); return true; }   // click another settler: team and tribute
      if (e && this.g.sweep.clickFoe(e, this.tool)) return true;   // sword + a foe in reach: swing now, as fast as you click
      if (e) { const t = K.WorkTarget.forEntity(this.ctx, e); if (!t) return false; this.engage(t); return true; }
      const p = P.app.pickGround(sx, sy); if (!p) return false;
      const [i, j] = this.editor.tileOf(p);
      if (this.tool.doubleClick && !this.isDouble(sx, sy)) return false;   // a single click walks; the dig starts on the second click of a double-click
      const t = this.tool.groundTarget(i, j, this.ctx); if (!t) return false;
      this.engage(t); return true;
    }
    /** is this the second click of a double-click (close in time and place to the last ground click)? Records the click either way. */
    isDouble(sx, sy) {
      const now = performance.now(), l = this.lastGround, dbl = !!l && now - l.t < 420 && Math.hypot(sx - l.sx, sy - l.sy) < 30;
      this.lastGround = dbl ? null : { t: now, sx, sy }; return dbl;
    }
    /** start work on a target, or say which tool it needs. Also the entry point for the right-click menu. */
    engage(target) {
      if (target instanceof Object && !(target instanceof K.WorkTarget)) target = K.WorkTarget.forEntity(this.ctx, target);
      if (!target) return;
      const cui = this.g.cui; this.g.sound.unlock();
      if (!target.alive) { cui.toast('This is used up.'); return; }
      if (!this.tool.accepts(target)) return;   // not this tool's job: the click is simply not for this
      this.play.doAction(target.entity, { id: 'work', label: this.tool.verb, range: target.approach, run: () => this.worker.start(target) }, false);
    }
    /** pressing here is a tool click, not the start of a hold-to-walk */
    claims(sx, sy) {
      if (this.tool.doubleClick) return false;   // holding the button on the ground still walks
      const p = this.play.app.pickGround(sx, sy); if (!p) return false;
      const [i, j] = this.editor.tileOf(p); return !!this.tool.groundTarget(i, j, this.ctx);
    }
    /** the cursor for what is under the pointer, or null to keep the default */
    hoverCursor(ent, sx, sy) {
      const Ic = K.Icons;
      if (this.tool.ranged) return ent && this.g.sweep.isFoe(ent) ? Ic.cursor('bow', 'pointer') : null;
      if (this.g.demolisher.active && !ent) { const dc = this.g.demolisher.hover(sx, sy); if (dc) return dc; }
      if (ent) {
        const t = K.WorkTarget.forEntity(this.ctx, ent); if (!t) return null;
        return Ic.cursor(this.tool.accepts(t) && t.alive ? this.tool.id : 'pointer', 'pointer');
      }
      const p = this.play.app.pickGround(sx, sy); if (!p) { this.hl.hide(); return null; }
      const [i, j] = this.editor.tileOf(p), t = this.tool.groundTarget(i, j, this.ctx);
      if (t) this.hl.show(t, this.editor.doc); else this.hl.hide();
      return t && !this.tool.doubleClick ? Ic.cursor(this.tool.id, 'pointer') : null;   // a double-click tool keeps the walking cursor: a single click only walks
    }

    update(dt) { this.pills(); this.worker.update(dt); this.archery.update(dt); this.effects.update(dt); this.arms.update(); }
    /** a small count on each work tool: how much of what it gathers you hold (axe: wood, pickaxe: stone, shovel: dirt) */
    pills() { const c = this.g.castle, b = this.belt; b.setBadge('axe', c.amount('wood'), 'wood'); b.setBadge('pickaxe', c.amount('stone'), 'stone'); b.setBadge('shovel', c.amount('dirt'), 'dirt'); }
    dispose() { this.worker.cancel(); this.hl.hide(); this.arms.dispose(); this.archery.dispose(); this.effects.dispose(); this.drawer.dispose(); this.belt.dispose(); }
  }

  K.CastleTools = CastleTools;
})(typeof window !== 'undefined' ? window : globalThis);
