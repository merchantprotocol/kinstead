/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the weapon drawer. The first slot on your hotbar is your weapon. Click it and a drawer opens on
   the left, just like the build drawer, listing every weapon you own; click one and it replaces the weapon in
   that slot (and is in your hand at once). Work tools (axe, pickaxe, shovel, hammer) have their own slots and
   are not weapons. The Toolbelt owns which weapons you have and which is equipped; this class is only the
   drawer. Parts are patched only when their HTML changed. */
(function (G) {
  const K = G.K;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  class WeaponDrawer {
    constructor(cui, belt) {
      this.cui = cui; this.belt = belt; this.isOpen = false; this.html = '';
      const root = (this.root = document.createElement('div')); root.id = 'cArms'; root.className = 'cp';
      root.innerHTML = '<h3>Weapons</h3><div class="dw-list"></div>'; this.list = root.querySelector('.dw-list');
      root.addEventListener('click', (e) => this.onClick(e));
      (cui.root.querySelector('#cLeft') || cui.root).appendChild(root);
    }
    show() { this.isOpen = true; this.root.classList.add('open'); this.render(); }
    close() { this.isOpen = false; this.root.classList.remove('open'); }
    toggle() { if (this.isOpen) this.close(); else this.show(); }
    /** what a weapon does, in words a kid can read */
    stats(w) {
      const c = w.combat, ranged = w.ranged, dmg = Math.round(c.scale * 100), rate = (1 / c.gap).toFixed(1);
      return ranged ? `<span class="chip">Damage ${Math.round(((w.cfg || {}).damage || 0.85) * 100)}%</span><span class="chip">Range ${(w.cfg || {}).range || 26} m</span><span class="chip">Over walls</span>` : `<span class="chip">Damage ${dmg}%</span><span class="chip">${rate} swings/s</span><span class="chip">Wide sweep</span>`;
    }
    row(w) {
      const on = this.belt.tools.includes(w);
      return `<button class="dw-row ${on ? 'equipped' : 'ok'}" data-w="${esc(w.id)}"><img src="${K.Toolbelt.artUrl(w.art)}" width="40" height="40" alt="">
        <div class="dw-t"><b>${esc(w.name)}${on ? ' <em>equipped</em>' : ''}</b><div class="cost">${this.stats(w)}</div><small>${esc(w.blurb)}</small></div></button>`;
    }
    render() {
      const cats = ['Melee', 'Ranged'], html = cats.map((cat) => { const ws = this.belt.weapons.filter((w) => w.category === cat); return ws.length ? `<h4>${cat}</h4>${ws.map((w) => this.row(w)).join('')}` : ''; }).join('');
      if (html === this.html) return; this.html = html; this.list.innerHTML = html;
    }
    update() { if (this.isOpen) this.render(); }
    onClick(e) {
      const row = e.target.closest('[data-w]'); if (!row) return;
      const w = this.belt.weapons.find((x) => x.id === row.dataset.w); if (!w) return;
      this.belt.equip(w); this.close();                 // it replaces the weapon in your first slot, and is in your hand
    }
    dispose() { this.root.remove(); }
  }

  K.WeaponDrawer = WeaponDrawer;
})(typeof window !== 'undefined' ? window : globalThis);
