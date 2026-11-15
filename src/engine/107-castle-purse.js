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
  const ORDER = ['wood', 'stone', 'dirt', 'iron', 'food', 'arrow', 'gold', 'ember_shard', 'wheat', 'egg', 'milk', 'beef', 'bread', 'potion_heal', 'potion_speed', 'potion_strength', 'potion_warmth'];
  const NAME = { wood: 'Wood', stone: 'Stone', dirt: 'Dirt', iron: 'Iron', food: 'Food', arrow: 'Arrows', gold: 'Gold', ember_shard: 'Ember shard', wheat: 'Wheat', egg: 'Eggs', milk: 'Milk', beef: 'Meat', bread: 'Bread', potion_heal: 'Healing potion', potion_speed: 'Speed potion', potion_strength: 'Strength potion', potion_warmth: 'Warmth potion' };

  /** painted pictures, 64x64 */
  class GoodsArt {
    static get SVG() {
      const log = (x, y) => `<rect x="${x}" y="${y}" width="40" height="13" rx="6" fill="#8a5a32" stroke="#4a2c14" stroke-width="2"/><ellipse cx="${x + 36}" cy="${y + 6.5}" rx="5" ry="6" fill="#d9a766" stroke="#4a2c14" stroke-width="1.5"/><circle cx="${x + 36}" cy="${y + 6.5}" r="2" fill="none" stroke="#8a5a32"/>`;
      return {
        wood: log(8, 34) + log(14, 21) + log(4, 47),
        stone: '<rect x="8" y="38" width="22" height="14" rx="2" fill="#aeb7c6" stroke="#4b5568" stroke-width="2"/><rect x="32" y="38" width="22" height="14" rx="2" fill="#98a2b4" stroke="#4b5568" stroke-width="2"/><rect x="18" y="22" width="22" height="14" rx="2" fill="#c3cbd8" stroke="#4b5568" stroke-width="2"/>',
        dirt: '<path d="M8 50c-2-14 8-28 24-28s28 12 24 28z" fill="#7b5636" stroke="#3d2a18" stroke-width="2.5"/><circle cx="24" cy="40" r="3" fill="#5a3d24"/><circle cx="38" cy="34" r="3.5" fill="#9a7048"/><circle cx="44" cy="44" r="2.5" fill="#5a3d24"/>',
        iron: '<path d="M10 44l8-18h30l6 18z" fill="#7d8798" stroke="#2c3442" stroke-width="2.5"/><path d="M18 26h30l-4 8H14z" fill="#b6bfce" opacity=".8"/>',
        wheat: '<path d="M32 58V20" stroke="#8a6a2a" stroke-width="3"/><g fill="#e8c25a" stroke="#8a6a2a" stroke-width="1.6"><ellipse cx="32" cy="14" rx="4" ry="7"/><ellipse cx="25" cy="24" rx="4" ry="7" transform="rotate(-30 25 24)"/><ellipse cx="39" cy="24" rx="4" ry="7" transform="rotate(30 39 24)"/><ellipse cx="25" cy="36" rx="4" ry="7" transform="rotate(-30 25 36)"/><ellipse cx="39" cy="36" rx="4" ry="7" transform="rotate(30 39 36)"/></g>',
        bread: '<path d="M10 40c0-14 10-22 22-22s22 8 22 22v6H10z" fill="#d89a4a" stroke="#6a3a1a" stroke-width="2.5"/><path d="M20 30l4 6M30 27l3 7M40 29l3 6" stroke="#8a5222" stroke-width="2.5" stroke-linecap="round"/>',
        potion_heal: '<path d="M26 8h12v8l10 14v20a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V30l10-14z" fill="#f7d8e0" stroke="#3a2a4a" stroke-width="2.5"/><path d="M18 38h28v12a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#e0405a"/><rect x="24" y="4" width="16" height="6" rx="2" fill="#8a5a32"/>', potion_speed: '<path d="M26 8h12v8l10 14v20a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V30l10-14z" fill="#e8f4ff" stroke="#3a2a4a" stroke-width="2.5"/><path d="M18 38h28v12a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#3aa0e8"/><rect x="24" y="4" width="16" height="6" rx="2" fill="#8a5a32"/>', potion_strength: '<path d="M26 8h12v8l10 14v20a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V30l10-14z" fill="#fff0d8" stroke="#3a2a4a" stroke-width="2.5"/><path d="M18 38h28v12a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#e8822a"/><rect x="24" y="4" width="16" height="6" rx="2" fill="#8a5a32"/>', potion_warmth: '<path d="M26 8h12v8l10 14v20a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V30l10-14z" fill="#ffe8d8" stroke="#3a2a4a" stroke-width="2.5"/><path d="M18 38h28v12a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#f0c040"/><rect x="24" y="4" width="16" height="6" rx="2" fill="#8a5a32"/>',
        egg: '<ellipse cx="32" cy="36" rx="15" ry="19" fill="#f6ead2" stroke="#8a6a4a" stroke-width="2.5"/><ellipse cx="26" cy="28" rx="4" ry="6" fill="#fff" opacity=".7"/>',
        milk: '<path d="M22 14h20v8l6 10v22a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V32l6-10z" fill="#fafafa" stroke="#5a6a7a" stroke-width="2.5"/><path d="M16 40h32" stroke="#7aa0c8" stroke-width="5"/>',
        beef: '<path d="M14 34c0-12 14-20 28-16 10 3 12 14 6 22-6 9-22 12-30 6-3-3-4-7-4-12z" fill="#c8464a" stroke="#6a1e22" stroke-width="2.5"/><circle cx="40" cy="30" r="5" fill="#f2e6d6" stroke="#6a1e22" stroke-width="2"/>',
        food: '<path d="M32 54C14 52 10 30 32 26c22 4 18 26 0 28z" fill="#f1e7f5" stroke="#5a3a6a" stroke-width="2.5"/><path d="M20 38c4 6 20 6 24 0" fill="#b86acb" opacity=".85"/><path d="M32 26c-8-8-6-14-2-16M32 26c4-8 10-10 14-8" stroke="#3f8a4a" stroke-width="3" fill="none" stroke-linecap="round"/>',
        meat: '<path d="M14 40c0-14 16-20 28-14s8 22-6 24-22-2-22-10z" fill="#d5575a" stroke="#6a1f26" stroke-width="2.5"/><circle cx="40" cy="38" r="5" fill="#f4d9c8" stroke="#6a1f26" stroke-width="2"/>',
        arrow: '<g stroke-linecap="round"><path d="M10 54L52 12" stroke="#8a5a32" stroke-width="3"/><path d="M52 12l-10 2 8 8z" fill="#aeb7c6" stroke="#4b5568" stroke-width="1.5"/><path d="M10 54l-2-8m2 8l8-2M16 48l-2-8m2 8l8-2" stroke="#f3f6ff" stroke-width="2.5"/></g>',
        gold: '<circle cx="32" cy="32" r="20" fill="#f2c14e" stroke="#7a5a12" stroke-width="3"/><circle cx="32" cy="32" r="12" fill="none" stroke="#b98a22" stroke-width="2.5"/>',
        ember_shard: '<path d="M32 8l14 22-14 26-14-26z" fill="#ff8a3a" stroke="#7a2a0a" stroke-width="2.5"/><path d="M32 8l6 22-6 26" fill="#ffc35c" opacity=".7"/>',
        roast: '<path d="M12 40c0-14 18-20 30-12s6 22-8 24-22-2-22-12z" fill="#9a5a2a" stroke="#4a2a10" stroke-width="2.5"/><path d="M20 36c6-6 16-6 20 0" stroke="#d9a060" stroke-width="3" fill="none"/><rect x="40" y="18" width="14" height="6" rx="3" transform="rotate(35 40 18)" fill="#f4e3c8" stroke="#6a4a2a" stroke-width="2"/>',
        stew: '<path d="M10 30h44c0 14-8 24-22 24S10 44 10 30z" fill="#6a4a3a" stroke="#2a1a10" stroke-width="2.5"/><ellipse cx="32" cy="30" rx="22" ry="6" fill="#c9783a" stroke="#2a1a10" stroke-width="2"/><circle cx="26" cy="29" r="3" fill="#e8c27a"/><circle cx="38" cy="31" r="3" fill="#8a4a2a"/><path d="M24 18c-2-4 2-6 0-10M34 20c-2-4 2-6 0-10" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>',
        bread: '<path d="M8 40c0-14 10-22 24-22s24 8 24 22c0 6-4 8-10 8H18c-6 0-10-2-10-8z" fill="#d99a4a" stroke="#6a3a10" stroke-width="2.5"/><path d="M20 26l4 10M32 24l4 12M44 28l2 8" stroke="#f3cf8a" stroke-width="3" stroke-linecap="round"/>',
        fish: '<path d="M8 32c10-14 30-14 40 0-10 14-30 14-40 0z" fill="#8fb4d0" stroke="#2a4a62" stroke-width="2.5"/><path d="M48 32l10-9v18z" fill="#6a94b4" stroke="#2a4a62" stroke-width="2"/><circle cx="20" cy="29" r="2.5" fill="#102030"/>',
        bag: '<path d="M18 26h28l6 26H12z" fill="#9b7a4a" stroke="#4a3418" stroke-width="2.5"/><path d="M22 26c0-8 4-12 10-12s10 4 10 12" fill="none" stroke="#4a3418" stroke-width="3"/>',
      };
    }
    static url(id) { const body = GoodsArt.SVG[id] || GoodsArt.SVG.bag; return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`); }
  }

  const ITEM_ART = { turnip: 'food', raw_meat: 'meat', cooked_meat: 'roast', stew: 'stew', omelette: 'roast', bread: 'bread', cooked_fish: 'fish', raw_fish: 'fish' };
  const itemArt = (id) => GoodsArt.url(ITEM_ART[id] || 'bag');

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
      for (const [id, n] of seen) { const d = p.items.get(id) || { name: id }; out.push({ key: 'item:' + id, kind: 'item', id, n, name: d.name, art: itemArt(id) }); }
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
      for (const [id, n] of Object.entries(v.items)) if (n > 0) out.push({ key: 'item:' + id, kind: 'item', id, n, name: (this.g.play.player.items.get(id) || { name: id }).name, art: itemArt(id) });
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
      this.p = purse; this.g = purse.g; this.mode = null; this.there = null; this.forge = null; this.tab = 'items'; this.draft = null; this.me = new PurseHoldings(this.g);
      const root = this.root = document.createElement('div'); root.id = 'cPurse'; root.hidden = true; this.g.cui.root.appendChild(root);
      root.addEventListener('click', (e) => this.onClick(e)); root.addEventListener('dragstart', (e) => this.onDrag(e)); root.addEventListener('dragover', (e) => { if (e.target.closest('.pp')) e.preventDefault(); }); root.addEventListener('drop', (e) => this.onDrop(e)); root.addEventListener('dragend', (e) => this.onDragEnd(e)); root.addEventListener('contextmenu', (e) => this.onContext(e));
      root.addEventListener('pointerdown', (e) => e.stopPropagation()); root.addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') e.stopPropagation(); });
    }
    get isOpen() { return !this.root.hidden; }
    open(there, forge) { this.there = there || null; this.forge = forge || null; this.root.hidden = false; this.render(); }
    close() { this.root.hidden = true; this.there = null; this.forge = null; }
    tile(s, side) {
      return `<button class="pt${s.held ? ' held' : ''}" draggable="true" data-side="${side}" data-key="${esc(s.key)}" title="${esc(s.name)}"><img src="${s.art}" width="52" height="52" alt="${esc(s.name)}"><b>${s.n > 1 ? s.n : ''}</b><i>${esc(s.name)}</i></button>`;
    }
    panel(title, side, body, icon) { return `<section class="pp" data-panel="${side}"><div class="hd"><img src="${GoodsArt.url(icon)}" width="40" height="40" alt=""><h3>${esc(title)}</h3></div><div class="pb">${body}</div></section>`; }
    grid(h, side) { const l = h.list(); return `<div class="pg">${l.length ? l.map((s) => this.tile(s, side)).join('') : '<span class="empty">Empty</span>'}</div>`; }
    /** the forge's side: weapons to make (their materials as pictures), then what is ready */
    forgeBody() {
      const f = this.forge, recipes = f.recipes().map((r) => {
        const cost = Object.entries(r.cost).map(([res, n]) => `<span class="cs ${f.has(res) >= n ? '' : 'poor'}"><img src="${f.glyph(res)}" width="22" height="22" alt="${NAME[res] || res}">${n}</span>`).join('');
        const ok = !r.have && Object.entries(r.cost).every(([res, n]) => f.has(res) >= n);
        return `<button class="pt rc${ok ? '' : ' dim'}" data-recipe="${r.id}" title="${esc(r.name)}${r.have ? ' (you have it)' : ''}"><img src="${r.art}" width="52" height="52" alt=""><div class="cost">${cost}</div><i>${esc(r.name)}${r.have ? ' ✓' : ''}</i></button>`;
      }).join('');
      const mats = f.pending ? `<div class="mats">${Object.entries(f.pending).map(([res, n]) => `<span class="cs"><img src="${f.glyph(res)}" width="26" height="26" alt="">${n}</span>`).join('')}<em>${f.busy}</em></div>` : '';
      return `<h4>${f.verb}</h4><div class="pg">${recipes}</div>${mats}<h4>Ready</h4>${this.grid(new TrayHoldings(f), 'there')}`;
    }
    /** the Team tab: your banner (colour, logo, team name) and who is on your team */
    teamBody() {
      const g = this.g, E = K.Emblems, COL = K.BANNER_COLORS, hex = (n) => '#' + n.toString(16).padStart(6, '0'), b = g.banners.mine();
      const d = this.draft || (this.draft = { name: b.name || '', color: b.color, logo: b.logo }), c = hex(COL[d.color % 12]), mp = g.mp, roster = mp ? mp.teamRoster() : [];
      return `<div class="tmb"><p class="tn">${b.team ? 'You fly your team’s banner. Changing it changes it for everyone on the team.' : 'Pick a colour and a logo, and name your team. Anyone you invite flies it too.'}</p>
        <div class="bn-prev" style="background:${c}"><img src="${E.url(d.logo)}" alt=""><b>${esc(d.name || 'Your team')}</b></div>
        <h4>Colour</h4><div class="sw">${COL.map((x, i) => `<button class="${i === d.color ? 'on' : ''}" data-c="${i}" style="background:${hex(x)}" aria-label="colour ${i + 1}"></button>`).join('')}</div>
        <h4>Logo</h4><div class="lg">${K.BANNER_EMBLEMS.map((e, i) => `<button class="${i === d.logo ? 'on' : ''}" data-l="${i}" title="${e[0]}" style="background:${c}"><img src="${E.url(i)}" alt="${e[0]}"></button>`).join('')}</div>
        <h4>Team name</h4><input maxlength="24" placeholder="Name your team" value="${esc(d.name)}">
        <div class="tm-act"><button data-saveb class="pri">Save banner</button>${b.team ? '<button data-leave>Leave team</button>' : ''}</div>
        ${mp && mp.invites.length ? `<h4>Invitations</h4><div class="invs">${mp.invites.map((inv) => K.InviteBoard.card(inv)).join('')}</div>` : (mp ? '<h4>Invitations</h4><p class="tn">No invitations right now.</p>' : '')}
        ${roster.length ? `<h4>On your team</h4><div class="roster">${roster.map((r) => `<span><i style="background:${hex(COL[r.color % 12])}"></i>${esc(r.name)}</span>`).join('')}</div>` : ''}
        <p class="tn">${mp ? 'Right-click a player to invite them to your team or demand tribute. Left-click attacks anyone who is not on your team.' : 'Alone on the map for now.'}</p></div>`;
    }
    render() {
      const solo = !this.there && !this.forge, tabs = solo ? `<div class="tabs"><button data-tab="items" class="${this.tab === 'items' ? 'on' : ''}">Purse</button><button data-tab="team" class="${this.tab === 'team' ? 'on' : ''}">Team</button></div>` : '';
      const mine = this.panel(this.me.title, 'me', tabs + (solo && this.tab === 'team' ? this.teamBody() : this.grid(this.me, 'me')), 'bag');
      const there = this.forge ? this.panel(this.forge.title, 'there', this.forgeBody(), this.forge.icon) : this.there ? this.panel(this.there.title, 'there', this.grid(this.there, 'there'), /ward/i.test(this.there.title) ? 'bag' : 'wood') : '';
      this.root.innerHTML = `<div class="pw ${there ? 'two' : ''}">${mine}${there}${this.tab === 'team' && !there ? '' : '<div class="hint">' + (there ? 'Click moves a stack · Shift-click one · Right-click half · Drag onto the ground to put it down' : 'Click food to eat it · Click a weapon to hold it · Drag onto the ground to put it down') + '</div>'}<button class="cb x" data-close>Close <kbd>Esc</kbd></button></div>`;
      const nm = this.root.querySelector('.tmb input'); if (nm) nm.addEventListener('input', () => { if (this.draft) this.draft.name = nm.value; const pv = this.root.querySelector('.bn-prev b'); if (pv) pv.textContent = nm.value || 'Your team'; });   // typing updates the preview without redrawing
    }
    holdings(side) { return side === 'me' ? this.me : this.forge ? new TrayHoldings(this.forge) : this.there; }
    onClick(e) {
      if (e.target === this.root || e.target.closest('[data-close]')) { this.close(); return; }
      const ia = e.target.closest('[data-acc]'), id_ = e.target.closest('[data-dec]'); if (ia && this.g.mp) { this.g.mp.acceptInvite(ia.dataset.acc); return; } if (id_ && this.g.mp) { this.g.mp.declineInvite(id_.dataset.dec); return; }
      const tb = e.target.closest('[data-tab]'); if (tb) { this.tab = tb.dataset.tab; this.draft = null; this.render(); return; }
      const d = this.draft, g = this.g;
      if (d) {
        const sw = e.target.closest('[data-c]'), lg = e.target.closest('[data-l]');
        if (sw) { d.color = +sw.dataset.c; this.render(); return; } if (lg) { d.logo = +lg.dataset.l; this.render(); return; }
        if (e.target.closest('[data-saveb]')) { g.banners.choose({ name: d.name.trim().slice(0, 24), color: d.color, logo: d.logo }); g.cui.toast('Banner saved.'); this.draft = null; this.render(); return; }
        if (e.target.closest('[data-leave]')) { if (g.mp) g.mp.net.send({ t: 'team', a: 'leave' }); return; }
      }
      const rc = e.target.closest('[data-recipe]'); if (rc) { this.forge.make(rc.dataset.recipe); return; }
      const t = e.target.closest('.pt[data-key]'); if (!t) return; this.move(t.dataset.side, t.dataset.key, e.shiftKey ? 1 : 0);   // click: all; shift-click: one
    }
    /** right-click a stack: half of it */
    onContext(e) { const t = e.target.closest('.pt[data-key]'); if (!t) return; e.preventDefault(); e.stopPropagation(); const s = this.holdings(t.dataset.side).find(t.dataset.key); if (s) this.move(t.dataset.side, t.dataset.key, Math.ceil(s.n / 2)); }
    onDrag(e) { const t = e.target.closest('.pt[data-key]'); if (t) e.dataTransfer.setData('text/plain', t.dataset.side + '|' + t.dataset.key); }
    /** a stack let go over the world (not over a panel): put it down there as a pile */
    onDragEnd(e) {
      if (e.dataTransfer.dropEffect !== 'none') return; const t = e.target.closest && e.target.closest('.pt[data-key]'); if (!t || t.dataset.side !== 'me') return;
      const g = this.g, s = this.me.find(t.dataset.key); if (!s || s.kind !== 'res') return;
      const r = g.app.renderer3.domElement.getBoundingClientRect(), p = g.app.pickGround(e.clientX - r.left, e.clientY - r.top); if (!p) return;
      g.stash.dropAt(s.id, p); this.render();
    }
    onDrop(e) { const to = e.target.closest('.pp'); if (!to) return; e.preventDefault(); const [side, key] = (e.dataTransfer.getData('text/plain') || '|').split('|'); if (side && side !== to.dataset.panel) this.move(side, key); }
    /** move a whole stack from one purse to the other (a lone purse: a weapon click equips it) */
    move(side, key, amount = 0) {
      const g = this.g, from = this.holdings(side), s0 = from.find(key); if (!s0) return; const s = Object.assign({}, s0, { n: amount > 0 ? Math.min(amount, s0.n) : s0.n });   // amount 0: the whole stack
      if (!this.there && !this.forge) { if (s.kind === 'weapon') { g.tools.belt.equip(s.weapon); this.render(); } else if (s.kind === 'item' && K.BUILDING_DATA.FOOD[s.id]) { g.vitals.eat(s.id); this.render(); } else if (s.kind === 'res' && g.workers && g.workers.use(s.id)) this.render(); return; }   // click food to eat it, a potion to drink it   // click food to eat it
      if (this.forge && side === 'me') { g.cui.toast(`Click something under ${this.forge.verb} to have it made.`); return; }
      const to = this.holdings(side === 'me' ? 'there' : 'me'), why = side === 'me' && from.keep ? from.keep(s) : null; if (why) { g.cui.toast(why); return; }
      if (this.forge && side === 'there' && s.kind === 'weapon' && g.tools.belt.weapons.some((w) => w.id === s.id)) { g.cui.toast('You already have one.'); return; }
      const got = to.give(s); if (got <= 0) { g.cui.toast(side === 'there' ? 'It will not fit in your purse.' : 'No room.'); return; }
      from.take(s, got); g.sound.play('gather'); this.render();
    }
    dispose() { this.root.remove(); }
  }

  /** the kitchen hearth: a workshop whose recipes come from your bag (raw meat, turnips, flour) and whose finished dishes wait in its purse */
  class Hearth {
    constructor(game) { this.g = game; this.tray = []; this.pending = null; }
    get title() { return 'Kitchen hearth'; }
    get icon() { return 'roast'; }
    get verb() { return 'Cook'; }
    get busy() { return 'cooking…'; }
    has(id) { return this.g.play.player.count(id); }
    glyph(id) { return itemArt(id); }
    name(id) { return (this.g.play.player.items.get(id) || { name: id }).name; }
    recipes() { return K.BUILDING_DATA.RECIPES.filter((r) => r.station === 'hearth').map((r) => ({ id: r.id, name: r.name, cost: r.in, art: itemArt(Object.keys(r.out)[0]), have: false })); }
    /** a meal your cook made: it waits on the hearth with the rest */
    addMeal(id) { const t = this.tray.find((q) => q.id === id); if (t) t.n += 1; else this.tray.push({ kind: 'item', id, n: 1, name: this.name(id), art: itemArt(id) }); this.g.purse.update(); }
    make(id) {
      const g = this.g, p = g.play.player, r = K.BUILDING_DATA.RECIPES.find((x) => x.id === id && x.station === 'hearth'); if (!r || this.pending) return;
      if (!Object.entries(r.in).every(([it, n]) => p.count(it) >= n)) { g.cui.toast('You are missing something for that.'); g.sound.play('clank'); return; }
      for (const [it, n] of Object.entries(r.in)) p.removeItem(it, n);
      this.pending = r.in; g.purse.update();
      setTimeout(() => { this.pending = null; for (const [it, n] of Object.entries(r.out)) this.tray.push({ kind: 'item', id: it, n, name: this.name(it), art: itemArt(it) }); g.sound.play('fanfare'); g.purse.update(); }, 600);
    }
  }

  class Purse {
    constructor(game) { this.g = game; this.hearth = new Hearth(game); if (game.banners) game.banners.on(() => { if (this.win && this.win.isOpen && this.win.tab === 'team' && !this.win.there && !this.win.forge) { this.win.draft = null; this.win.render(); } }); this.win = new PurseWindow(this); this.vaults = new Map(); this.hook(); }
    get isOpen() { return this.win.isOpen; }
    toggle() { if (this.isOpen) this.win.close(); else this.openPurse(); }
    close() { this.win.close(); }
    update() { if (this.isOpen) this.win.render(); }
    openPurse() { this.win.tab = 'items'; this.win.open(null); }
    /** redraw the Team tab if it is showing (invites or banners changed) */
    refreshTeam() { if (this.win.isOpen && this.win.tab === 'team' && !this.win.there && !this.win.forge) this.win.render(); }
    openTab(tab) { if (this.isOpen && this.win.tab === tab && !this.win.there && !this.win.forge) { this.win.close(); return; } this.win.tab = tab; this.win.draft = null; this.win.open(null); }
    vault(id) { if (!this.vaults.has(id)) this.vaults.set(id, new Vault()); return this.vaults.get(id); }
    openVault(e) { this.win.open(new VaultHoldings(this.g, this.vault(e.id), e.name || 'Chest')); }
    openForge(forge) { this.win.open(null, forge); }
    openLedger(p) { const g = this.g, title = { market: 'Marketplace', silo: 'Grain silo', farm: 'Farm', coop: 'Chicken coop', barn: 'Cattle barn' }[p.type] || 'Store'; this.win.open(new VaultHoldings(g, g.economy.vaultFor(p), title)); }
    openHearth() { this.win.open(null, this.hearth); }
    /** chests and wardrobes (the building system's own furniture) open the two-purse screen */
    hook() {
      const reg = K.Interactions, purse = this;
      const wrap = (type, label, drop, open) => { const orig = reg.get(type) || {}, base = orig.baseActions || orig.actions; reg.register(type, Object.assign({}, orig, { baseActions: base, actions: (e, game) => [{ id: 'open_purse', label: `${label} ${String(e.name || 'furniture').toLowerCase()}`, icon: 'bag', range: e.range, run: () => (open ? open(e) : purse.openVault(e)) }].concat((base ? base(e, game) : []).filter((a) => a.id !== drop)) })); };   // baseActions: re-entering the game must not stack wrappers
      const sh = K.FURNITURE.shelf; if (sh && !sh.interact) sh.interact = { type: 'storage', label: 'Shelf', actions: [{ id: 'open', label: 'Open storage' }] };   // shelves hold things too
      wrap('storage', 'Open the', 'open');
      for (const t of ['wardrobe', 'eat', 'weapon_rack', 'armor_stand', 'read']) wrap(t, 'Look at the', null);
      wrap('cook', 'Cook at the', null, () => purse.openHearth());
    }
    dispose() { this.win.dispose(); }
  }

  Object.assign(K, { Hearth, GoodsArt, Holdings, PurseHoldings, VaultHoldings, TrayHoldings, PurseWindow, Purse });
})(typeof window !== 'undefined' ? window : globalThis);
