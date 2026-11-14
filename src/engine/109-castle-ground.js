/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the shovel's modes. With the shovel out, click it again to open a drawer of ways to shape the ground:
     Dig     double-click a square to dig it (a single click walks)
     Level   press a square, then brush around: every square you touch becomes that square's height
     Raise   brush to lay a block of dirt on every square you touch
     Lower   brush to scoop a block off every square you touch
   Raising spends the dirt you carry; lowering gives it back to your purse. Brushing only works near you; a click
   far away simply walks.
     GroundDrawer   the drawer on the left (same look as the weapon drawer)
     GroundBrush    the strokes: which squares, what each one costs */
(function (G) {
  const K = G.K;
  const TILE = K.TILE, BLOCK = 2, REACH = 8;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MODES = [
    { id: 'dig', name: 'Dig', blurb: 'Double-click a square to dig it. A single click just walks.' },
    { id: 'level', name: 'Level', blurb: 'Press a square, then brush around: everything you touch becomes that height. Raising uses your dirt; lowering gives it back.' },
    { id: 'raise', name: 'Raise', blurb: 'Brush to lay a block of dirt on every square you touch.' },
    { id: 'lower', name: 'Lower', blurb: 'Brush to scoop a block off every square you touch. You keep the dirt.' },
  ];

  class GroundDrawer {
    constructor(brush) {
      this.b = brush; this.isOpen = false; this.html = ''; const cui = brush.g.cui;
      const root = (this.root = document.createElement('div')); root.id = 'cGround'; root.className = 'cp'; root.innerHTML = '<h3>Shovel</h3><div class="dw-list"></div>'; this.list = root.querySelector('.dw-list');
      root.addEventListener('click', (e) => { const r = e.target.closest('[data-m]'); if (!r) return; brush.setMode(r.dataset.m); this.close(); });
      (cui.root.querySelector('#cLeft') || cui.root).appendChild(root);
    }
    show() { this.isOpen = true; this.root.classList.add('open'); this.render(); }
    close() { this.isOpen = false; this.root.classList.remove('open'); }
    toggle() { if (this.isOpen) this.close(); else this.show(); }
    render() {
      const html = MODES.map((m) => `<button class="dw-row ${m.id === this.b.mode ? 'equipped' : 'ok'}" data-m="${m.id}"><img src="${K.Toolbelt.artUrl('shovel')}" width="36" height="36" alt=""><div class="dw-t"><b>${esc(m.name)}${m.id === this.b.mode ? ' <em>active</em>' : ''}</b><small>${esc(m.blurb)}</small></div></button>`).join('');
      if (html !== this.html) { this.html = html; this.list.innerHTML = html; }
    }
    dispose() { this.root.remove(); }
  }

  class GroundBrush {
    constructor(game) { this.g = game; this.stroke = null; this.drawer = new GroundDrawer(this); this.lastSound = -9; this.lastWarn = -9; }
    get play() { return this.g.play; }
    get shovel() { return this.g.tools.belt.byId('shovel'); }
    get mode() { return this.shovel.mode; }
    setMode(id) { const m = MODES.find((x) => x.id === id); if (!m) return; this.shovel.mode = id; this.g.cui.toast(`Shovel: ${m.name}. ${m.blurb}`); this.g.sound.play('clank'); }
    /** brushing is on: shovel out, not in dig mode, nothing else claiming the pointer */
    get active() { const g = this.g; return g.tools.tool.id === 'shovel' && this.mode !== 'dig' && !g.cui.placing && g.cui.$('cModal').hidden && !g.purse.isOpen; }
    get editor() { return this.g.tools.editor; }
    tile(sx, sy) { const p = this.g.app.pickGround(sx, sy); return p ? this.play.doc.tileOf(p.x, p.z) : null; }

    down(sx, sy) {
      if (!this.active) return false; const t = this.tile(sx, sy); if (!t) return false; const me = this.play.me;
      if (Math.hypot((t[0] + 0.5) * TILE - me.x, (t[1] + 0.5) * TILE - me.z) > REACH) return false;   // too far to brush: the click walks
      const d = this.play.doc, k = t[1] * d.w + t[0];
      this.stroke = { last: t, ref: d.height[k], n: 0 };
      if (this.mode === 'level') this.g.cui.toast('Leveling to this height. Brush around.');
      this.touch(t[0], t[1]); return true;
    }
    drag(sx, sy) {
      const s = this.stroke; if (!s) return; const t = this.tile(sx, sy); if (!t) return;
      for (let n = 0; n < 40 && (s.last[0] !== t[0] || s.last[1] !== t[1]); n++) {   // one square at a time, so a fast mouse leaves no gaps
        const di = t[0] - s.last[0], dj = t[1] - s.last[1];
        s.last = Math.abs(di) >= Math.abs(dj) ? [s.last[0] + Math.sign(di), s.last[1]] : [s.last[0], s.last[1] + Math.sign(dj)];
        this.touch(s.last[0], s.last[1]);
      }
    }
    up() { if (this.stroke) { this.stroke = null; this.g.changed(); } }

    /** brush one square */
    touch(i, j) {
      const s = this.stroke, d = this.play.doc, k = j * d.w + i; if (!d.inside(i, j)) return; let did = false;
      if (this.mode === 'raise') did = this.raiseOne(i, j);
      else if (this.mode === 'lower') did = this.lowerOne(i, j);
      else if (this.mode === 'level') for (let guard = 0; guard < 8; guard++) {
        const diff = s.ref - d.height[k]; if (Math.abs(diff) < BLOCK) break;   // already within a block of it
        if (!(diff > 0 ? this.raiseOne(i, j) : this.lowerOne(i, j))) break; did = true;
      }
      if (did) { s.n++; if (this.play.t - this.lastSound > 0.1) { this.lastSound = this.play.t; this.g.sound.play('thunk'); } }
    }
    occupied(i, j) {
      const c = TILE / 2, cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
      return this.play.actors.some((a) => (a.alive || a === this.play.me) && Math.abs(a.x - cx) < c + (a.r || 0.3) && Math.abs(a.z - cz) < c + (a.r || 0.3));   // never bury anyone
    }
    raiseOne(i, j) {
      const g = this.g, c = g.castle; if (this.occupied(i, j) || !this.editor.canRaise(i, j)) return false;
      if (c.amount('dirt') < 1) { if (this.play.t - this.lastWarn > 2) { this.lastWarn = this.play.t; g.cui.toast('You are out of dirt.'); g.sound.play('clank'); } return false; }
      c.spend({ dirt: 1 }); this.editor.raise(i, j); g.tools.effects.burst('dirt', (i + 0.5) * TILE, this.play.nav.y((i + 0.5) * TILE, (j + 0.5) * TILE) + 0.2, (j + 0.5) * TILE, 3, 1.6); return true;
    }
    lowerOne(i, j) {
      const g = this.g; if (!this.editor.canDig(i, j)) return false;
      this.editor.lower(i, j, false); g.castle.add('dirt', 1); g.tools.effects.burst('dirt', (i + 0.5) * TILE, this.play.nav.y((i + 0.5) * TILE, (j + 0.5) * TILE) + 0.2, (j + 0.5) * TILE, 3, 1.6); return true;
    }
    dispose() { this.drawer.dispose(); }
  }

  Object.assign(K, { GroundDrawer, GroundBrush, GROUND_MODES: MODES });
})(typeof window !== 'undefined' ? window : globalThis);
