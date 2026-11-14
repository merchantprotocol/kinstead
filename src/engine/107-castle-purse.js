/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the purse screens. Press I for what you carry. Open a chest, a wardrobe or the blacksmith's forge and a
   second purse appears beside yours. Everything is shown as pictures: click a thing, or drag it across, to move it
   between the two purses. At the forge you click a weapon to put its materials in (they are shown as pictures too),
   it is made, and it waits in the forge's purse for you to take.
     GoodsArt         the little pictures for resources and carried items
     Holdings         something that holds stacks: PurseHoldings (you), VaultHoldings (a chest, a wardrobe), TrayHoldings (the forge's finished goods)
     PurseWindow      the screen itself, with drag and click
     Purse            opens the screens (key I, and the chest / wardrobe / forge interactions) */
(function (G) {
  const K = G.K;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ORDER = ['wood', 'stone', 'dirt', 'iron', 'food', 'arrow', 'gold', 'ember_shard'];
  const NAME = { wood: 'Wood', stone: 'Stone', dirt: 'Dirt', iron: 'Iron', food: 'Food', arrow: 'Arrows', gold: 'Gold', ember_shard: 'Ember shard' };

  /** painted pictures, 64x64 */
  class GoodsArt {
    static get SVG() {
      const log = (x, y) => `<rect x="${x}" y="${y}" width="40" height="13" rx="6" fill="#8a5a32" stroke="#4a2c14" stroke-width="2"/><ellipse cx="${x + 36}" cy="${y + 6.5}" rx="5" ry="6" fill="#d9a766" stroke="#4a2c14" stroke-width="1.5"/><circle cx="${x + 36}" cy="${y + 6.5}" r="2" fill="none" stroke="#8a5a32"/>`;
      return {
        wood: log(8, 34) + log(14, 21) + log(4, 47),
        stone: '<rect x="8" y="38" width="22" height="14" rx="2" fill="#aeb7c6" stroke="#4b5568" stroke-width="2"/><rect x="32" y="38" width="22" height="14" rx="2" fill="#98a2b4" stroke="#4b5568" stroke-width="2"/><rect x="18" y="22" width="22" height="14" rx="2" fill="#c3cbd8" stroke="#4b5568" stroke-width="2"/>',
        dirt: '<path d="M8 50c-2-14 8-28 24-28s28 12 24 28z" fill="#7b5636" stroke="#3d2a18" stroke-width="2.5"/><circle cx="24" cy="40" r="3" fill="#5a3d24"/><circle cx="38" cy="34" r="3.5" fill="#9a7048"/><circle cx="44" cy="44" r="2.5" fill="#5a3d24"/>',
        iron: '<path d="M10 44l8-18h30l6 18z" fill="#7d8798" stroke="#2c3442" stroke-width="2.5"/><path d="M18 26h30l-4 8H14z" fill="#b6bfce" opacity=".8"/>',
        food: '<path d="M32 54C14 52 10 30 32 26c22 4 18 26 0 28z" fill="#f1e7f5" stroke="#5a3a6a" stroke-width="2.5"/><path d="M20 38c4 6 20 6 24 0" fill="#b86acb" opacity=".85"/><path d="M32 26c-8-8-6-14-2-16M32 26c4-8 10-10 14-8" stroke="#3f8a4a" stroke-width="3" fill="none" stroke-linecap="round"/>',
        meat: '<path d="M14 40c0-14 16-20 28-14s8 22-6 24-22-2-22-10z" fill="#d5575a" stroke="#6a1f26" stroke-width="2.5"/><circle cx="40" cy="38" r="5" fill="#f4d9c8" stroke="#6a1f26" stroke-width="2"/>',
        arrow: '<g stroke-linecap="round"><path d="M10 54L52 12" stroke="#8a5a32" stroke-width="3"/><path d="M52 12l-10 2 8 8z" fill="#aeb7c6" stroke="#4b5568" stroke-width="1.5"/><path d="M10 54l-2-8m2 8l8-2M16 48l-2-8m2 8l8-2" stroke="#f3f6ff" stroke-width="2.5"/></g>',
        gold: '<circle cx="32" cy="32" r="20" fill="#f2c14e" stroke="#7a5a12" stroke-width="3"/><circle cx="32" cy="32" r="12" fill="none" stroke="#b98a22" stroke-width="2.5"/>',
        ember_shard: '<path d="M32 8l14 22-14 26-14-26z" fill="#ff8a3a" stroke="#7a2a0a" stroke-width="2.5"/><path d="M32 8l6 22-6 26" fill="#ffc35c" opacity=".7"/>',
        bag: '<path d="M18 26h28l6 26H12z" fill="#9b7a4a" stroke="#4a3418" stroke-width="2.5"/><path d="M22 26c0-8 4-12 10-12s10 4 10 12" fill="none" stroke="#4a3418" stroke-width="3"/>',
      };
    }
    static url(id) { const body = GoodsArt.SVG[id] || GoodsArt.SVG.bag; return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`); }
  }

  /** a stack: { key, kind: 'res'|'item'|'weapon', id, n, name, art, weapon? } */
  class Holdings {
    list() { return []; }
    find(key) { return this.list().find((s) => s.key === key) || null; }
    give() { return 0; }     // returns how many were accepted
    take() {}                // remove what give() accepted
    get title() { return ''; }
  }

  class PurseHoldings extends Holdings {
    constructor(game) { super(); this.g = game; }
    get title() { return 'Your purse'; }
    list() {
      const g = this.g, c = g.castle, out = [];
      for (const r of ORDER) { const n = c.amount(r); if (n > 0) out.push({ key: 'res:' + r, kind: 'res', id: r, n, name: NAME[r] || r, art: GoodsArt.url(r) }); }
      for (const w of g.tools.belt.weapons) out.push({ key: 'weapon:' + w.id, kind: 'weapon', id: w.id, n: 1, name: w.name, art: K.Toolbelt.artUrl(w.art), weapon: w, held: g.tools.belt.tools.includes(w) });
      const seen = new Map(), p = g.play.player; for (const s of p.bag) if (s) seen.set(s.id, (seen.get(s.id) || 0) + s.n);
      for (const [id, n] of seen) { const d = p.items.get(id) || { name: id }; out.push({ key: 'item:' + id, kind: 'item', id, n, name: d.name, art: GoodsArt.url({ turnip: 'food', raw_meat: 'meat' }[id] || 'bag') }); }
      return out;
    }
    give(s) {
      const g = this.g, p = g.play.player;
      if (s.kind === 'res') { const got = g.castle.add(s.id, s.n); g.changed(); return got; }
      if (s.kind === 'weapon') { g.tools.belt.addWeapon(s.weapon); return 1; }
      let k = 0; while (k < s.n && p.canAdd(s.id, 1)) { p.addItem(s.id, 1); k++; } return k;
    }
    take(s, n) {
      const g = this.g;
      if (s.kind === 'res') { g.castle.spend({ [s.id]: n }); g.changed(); }
      else if (s.kind === 'weapon') g.tools.belt.removeWeapon(s.id);
      else g.play.player.removeItem(s.id, n);
    }
    /** why this stack may not leave your purse, or null */
    keep(s) { return s.kind === 'weapon' && this.g.tools.belt.weapons.length <= 1 ? 'Keep one weapon on you.' : null; }
  }

  /** what a chest or wardrobe holds: kept per piece of furniture */
  class Vault { constructor() { this.res = {}; this.items = {}; this.weapons = []; } }
  class VaultHoldings extends Holdings {
    constructor(game, vault, title) { super(); this.g = game; this.v = vault; this._title = title; }
    get title() { return this._title; }
    list() {
      const v = this.v, out = [];
      for (const [r, n] of Object.entries(v.res)) if (n > 0) out.push({ key: 'res:' + r, kind: 'res', id: r, n, name: NAME[r] || r, art: GoodsArt.url(r) });
      for (const w of v.weapons) out.push({ key: 'weapon:' + w.id, kind: 'weapon', id: w.id, n: 1, name: w.name, art: K.Toolbelt.artUrl(w.art), weapon: w });
      for (const [id, n] of Object.entries(v.items)) if (n > 0) out.push({ key: 'item:' + id, kind: 'item', id, n, name: (this.g.play.player.items.get(id) || { name: id }).name, art: GoodsArt.url({ turnip: 'food', raw_meat: 'meat' }[id] || 'bag') });
      return out;
    }
    give(s) { const v = this.v; if (s.kind === 'res') v.res[s.id] = (v.res[s.id] || 0) + s.n; else if (s.kind === 'item') v.items[s.id] = (v.items[s.id] || 0) + s.n; else v.weapons.push(s.weapon); return s.n; }
    take(s, n) { const v = this.v; if (s.kind === 'res') v.res[s.id] -= n; else if (s.kind === 'item') v.items[s.id] -= n; else v.weapons = v.weapons.filter((w) => w !== s.weapon); }
  }

  /** the forge's finished goods, waiting for you */
  class TrayHoldings extends Holdings {
    constructor(forge) { super(); this.f = forge; }
    get title() { return 'Ready'; }
    list() { return this.f.tray.map((t, i) => Object.assign({ key: 'tray:' + i, tray: t }, t)); }
    take(s) { this.f.tray = this.f.tray.filter((t) => t !== s.tray); }
  }

  class PurseWindow {
    constructor(purse) {
      this.p = purse; this.g = purse.g; this.mode = null; this.there = null; this.forge = null; this.me = new PurseHoldings(this.g);
      const root = this.root = document.createElement('div'); root.id = 'cPurse'; root.hidden = true; this.g.cui.root.appendChild(root);
      root.addEventListener('click', (e) => this.onClick(e)); root.addEventListener('dragstart', (e) => this.onDrag(e)); root.addEventListener('dragover', (e) => { if (e.target.closest('.pp')) e.preventDefault(); }); root.addEventListener('drop', (e) => this.onDrop(e));
      root.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    get isOpen() { return !this.root.hidden; }
    open(there, forge) { this.there = there || null; this.forge = forge || null; this.root.hidden = false; this.render(); }
    close() { this.root.hidden = true; this.there = null; this.forge = null; }
    tile(s, side) {
      return `<button class="pt${s.held ? ' held' : ''}" draggable="true" data-side="${side}" data-key="${esc(s.key)}" title="${esc(s.name)}"><img src="${s.art}" width="52" height="52" alt="${esc(s.name)}"><b>${s.n > 1 ? s.n : ''}</b><i>${esc(s.name)}</i></button>`;
    }
    panel(title, side, body) { return `<section class="pp" data-panel="${side}"><h3>${esc(title)}</h3>${body}</section>`; }
    grid(h, side) { const l = h.list(); return `<div class="pg">${l.length ? l.map((s) => this.tile(s, side)).join('') : '<span class="empty">Empty</span>'}</div>`; }
    /** the forge's side: weapons to make (their materials as pictures), then what is ready */
    forgeBody() {
      const f = this.forge, c = this.g.castle, recipes = f.recipes().map((r) => {
        const cost = Object.entries(r.cost).map(([res, n]) => `<span class="cs ${c.amount(res) >= n ? '' : 'poor'}"><img src="${GoodsArt.url(res)}" width="22" height="22" alt="${NAME[res] || res}">${n}</span>`).join('');
        const ok = !r.have && c.canAfford(r.cost);
        return `<button class="pt rc${ok ? '' : ' dim'}" data-recipe="${r.id}" title="${esc(r.name)}${r.have ? ' (you have it)' : ''}"><img src="${r.art}" width="52" height="52" alt=""><div class="cost">${cost}</div><i>${esc(r.name)}${r.have ? ' ✓' : ''}</i></button>`;
      }).join('');
      const mats = f.pending ? `<div class="mats">${Object.entries(f.pending).map(([res, n]) => `<span class="cs"><img src="${GoodsArt.url(res)}" width="26" height="26" alt="">${n}</span>`).join('')}<em>hammering…</em></div>` : '';
      return `<h4>Make</h4><div class="pg">${recipes}</div>${mats}<h4>Ready</h4>${this.grid(new TrayHoldings(f), 'there')}`;
    }
    render() {
      const mine = this.panel(this.me.title, 'me', this.grid(this.me, 'me'));
      const there = this.forge ? this.panel('Blacksmith', 'there', this.forgeBody()) : this.there ? this.panel(this.there.title, 'there', this.grid(this.there, 'there')) : '';
      this.root.innerHTML = `<div class="pw ${there ? 'two' : ''}">${mine}${there}<button class="cb x" data-close>Close <kbd>Esc</kbd></button></div>`;
    }
    holdings(side) { return side === 'me' ? this.me : this.forge ? new TrayHoldings(this.forge) : this.there; }
    onClick(e) {
      if (e.target === this.root || e.target.closest('[data-close]')) { this.close(); return; }
      const rc = e.target.closest('[data-recipe]'); if (rc) { this.forge.make(rc.dataset.recipe); return; }
      const t = e.target.closest('.pt[data-key]'); if (!t) return; this.move(t.dataset.side, t.dataset.key);
    }
    onDrag(e) { const t = e.target.closest('.pt[data-key]'); if (t) e.dataTransfer.setData('text/plain', t.dataset.side + '|' + t.dataset.key); }
    onDrop(e) { const to = e.target.closest('.pp'); if (!to) return; e.preventDefault(); const [side, key] = (e.dataTransfer.getData('text/plain') || '|').split('|'); if (side && side !== to.dataset.panel) this.move(side, key); }
    /** move a whole stack from one purse to the other (a lone purse: a weapon click equips it) */
    move(side, key) {
      const g = this.g, from = this.holdings(side), s = from.find(key); if (!s) return;
      if (!this.there && !this.forge) { if (s.kind === 'weapon') { g.tools.belt.equip(s.weapon); this.render(); } return; }
      if (this.forge && side === 'me') { g.cui.toast('Click a weapon under Make to have it forged.'); return; }
      const to = this.holdings(side === 'me' ? 'there' : 'me'), why = side === 'me' && from.keep ? from.keep(s) : null; if (why) { g.cui.toast(why); return; }
      if (this.forge && side === 'there' && s.kind === 'weapon' && g.tools.belt.weapons.some((w) => w.id === s.id)) { g.cui.toast('You already have one.'); return; }
      const got = to.give(s); if (got <= 0) { g.cui.toast(side === 'there' ? 'It will not fit in your purse.' : 'No room.'); return; }
      from.take(s, got); g.sound.play('gather'); this.render();
    }
    dispose() { this.root.remove(); }
  }

  class Purse {
    constructor(game) { this.g = game; this.win = new PurseWindow(this); this.vaults = new Map(); this.hook(); }
    get isOpen() { return this.win.isOpen; }
    toggle() { if (this.isOpen) this.win.close(); else this.openPurse(); }
    close() { this.win.close(); }
    update() { if (this.isOpen) this.win.render(); }
    openPurse() { this.win.open(null); }
    vault(id) { if (!this.vaults.has(id)) this.vaults.set(id, new Vault()); return this.vaults.get(id); }
    openVault(e) { this.win.open(new VaultHoldings(this.g, this.vault(e.id), e.name || 'Chest')); }
    openForge(forge) { this.win.open(null, forge); }
    /** chests and wardrobes (the building system's own furniture) open the two-purse screen */
    hook() {
      const reg = K.Interactions, purse = this;
      const wrap = (type, label, drop) => { const orig = reg.get(type) || {}, base = orig.baseActions || orig.actions; reg.register(type, Object.assign({}, orig, { baseActions: base, actions: (e, game) => [{ id: 'open_purse', label, icon: 'bag', range: e.range, run: () => purse.openVault(e) }].concat((base ? base(e, game) : []).filter((a) => a.id !== drop)) })); };   // baseActions: re-entering the game must not stack wrappers
      wrap('storage', 'Open the chest', 'open'); wrap('wardrobe', 'Open the wardrobe', null);
    }
    dispose() { this.win.dispose(); }
  }

  Object.assign(K, { GoodsArt, Holdings, PurseHoldings, VaultHoldings, TrayHoldings, PurseWindow, Purse });
})(typeof window !== 'undefined' ? window : globalThis);
