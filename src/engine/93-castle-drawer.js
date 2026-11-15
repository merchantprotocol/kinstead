/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the drawer on the left. Always shows how much of each resource you have. With the hammer out it
   opens into a scrollable list of everything you can build (and a "Take down" mode); pick one to place it.
   It replaces the old Build button and the centre menu. DOM only: building is done by CastleUI.pickCard,
   taking down by the Demolisher. Parts are patched only when their HTML changed, and the list keeps its
   scroll position, because the HUD re-renders several times a second. */
(function (G) {
  const K = G.K;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GROUPS = [['terrain', 'Land'], ['defense', 'Walls'], ['farming', 'Farming'], ['trade', 'Trade'], ['producer', 'Workshops'], ['storage', 'Storage'], ['building', 'Buildings']];
const BUILDABLE = new Set(['dirt', 'palisade', 'gate', 'stone_wall', 'stone_gate', 'stone_tower', 'watchtower', 'fire_pot', 'farm', 'field', 'silo', 'coop', 'barn', 'market', 'stable', 'bakery', 'butcher', 'library', 'woodcutter', 'quarry', 'storehouse', 'cottage', 'blacksmith']);   // what you can place by the square

  /** Replace an element's HTML only if it changed; keep its scroll. */
  const patch = (el, html) => { if (el._h === html) return; const top = el.scrollTop; el._h = html; el.innerHTML = html; el.scrollTop = top; };

  class BuildDrawer {
    constructor(cui, hooks = {}) {
      this.cui = cui; this.g = cui.g; this.c = cui.c; this.hooks = hooks; this.open = false;
      this.entries = new Map();
      const root = (this.root = document.createElement('div')); root.id = 'cDrawer'; root.className = 'cp';
      root.innerHTML = `<div class="dw-res"></div><div class="dw-body"><div class="dw-list"></div></div>`;
      this.res = root.querySelector('.dw-res'); this.list = root.querySelector('.dw-list');
      root.addEventListener('click', (e) => this.onClick(e));
      (cui.root.querySelector('#cLeft') || cui.root).appendChild(root); this.update();
    }
    setOpen(on) { this.open = !!on; this.root.classList.toggle('open', this.open); this.update(); }
    dispose() { this.root.remove(); }

    /* ---------- rendering ---------- */
    update() {
      patch(this.res, this.resourcesHtml());
      if (this.open) patch(this.list, this.catalogHtml());
    }
    resourcesHtml() {
      const c = this.c, caps = c.caps(), rates = c.rates(), Ic = K.Icons, ICON = K.CastleUI.ICON;
      return K.CastleUI.RES_ORDER.map((r) => {
        const full = c.amount(r) >= caps[r], rate = rates[r] || 0;
        return `<div class="res ${full ? 'full' : ''}" data-r="${r}" title="${esc(K.CastleData.resName(r))}: ${c.amount(r)} of ${caps[r]}">${Ic.img(ICON[r], 1)}<b>${c.amount(r)}</b><small>/${caps[r]}</small>${rate ? `<i>+${rate}/min</i>` : ''}${full ? '<em>FULL</em>' : ''}</div>`;
      }).join('') + (c.amount('troll_heart') ? `<div class="res heart">${Ic.img('heart', 1)}<b>Troll’s heart</b></div>` : '');
    }
    chips(cost) { const ICON = K.CastleUI.ICON; return Object.entries(cost).map(([r, k]) => `<span class="chip ${this.c.amount(r) >= k ? '' : 'bad'}">${K.Icons.img(ICON[r], 1)}${k}</span>`).join(''); }
    row(x) {
      const key = `${x.kind}:${x.id}`;
      this.entries.set(key, x);
      return `<div class="dw-entry">
        <button class="dw-row ${x.state}" data-id="${esc(x.id)}" data-kind="${x.kind}" data-why="${esc(x.why || '')}">
          ${this.cui.art.html(x.art || x.id, x.icon, 40)}
          <div class="dw-t"><b>${esc(x.name)}</b><div class="cost">${this.chips(x.cost)}</div>
            <small>${esc(x.state === 'locked' ? x.why : x.line)}</small></div>
        </button>
        <button class="dw-info" data-detail="${esc(key)}" aria-label="Details for ${esc(x.name)}">i</button>
      </div>`;
    }
    catalogHtml() {
      this.entries.clear();
      const c = this.c, d = c.data, S = K.CastleUI, rows = [];
      for (const id of d.pieceIds()) {
        if (!BUILDABLE.has(id)) continue;
        const ruin = c.ruinOpen(id), p = d.piece(id), why = c.blocker(id, { ruin, ignoreCost: true }); if (why && /already/.test(why)) continue;
        const mine = (id === 'blacksmith' && this.g.smithy) || (id === 'cottage' && this.g.home.built) || (id === 'market' && this.g.marketHall) || this.g.halls[id] ? 'already built' : why, cost = c.buildCost(id, { ruin }), state = mine ? 'locked' : c.canAfford(cost) ? 'ok' : 'poor';
        rows.push({ id, kind: ruin ? 'ruin' : id === 'mine' ? 'site' : 'place', group: p.category, name: ruin ? `Restore the ${p.name}` : p.name, cost, state, why: mine, icon: S.PIECE_ICON[id], art: id, line: p.effect || '' });
      }
      const sel = this.g.demolisher && this.g.demolisher.selling, html = [`<button class="dw-row dw-sell ${sel ? 'on' : 'ok'}" data-sell="1">${this.cui.art.html('sell', 'coin', 40)}<div class="dw-t"><b>${sel ? 'Selling… (click to stop)' : 'Sell'}</b><small>Click or drag along walls to sell them at once. A building asks before it goes. Half the cost comes back to your purse.</small></div></button>`];
      for (const [g, label] of GROUPS) { const items = rows.filter((r) => r.group === g); if (items.length) html.push(`<h4>${label}</h4>${items.map((x) => this.row(x)).join('')}`); }
      const extra = this.cui.cards().out.filter((x) => x.kind === 'upgrade' || x.kind === 'craft');
      if (extra.length) html.push(`<h4>Upgrades & forge</h4>${extra.map((x) => this.row({ id: x.id, kind: x.kind, name: x.name, cost: x.cost, state: 'ok', icon: x.icon, art: x.art, line: x.line })).join('')}`);
      return html.join('');
    }

    /* ---------- picking ---------- */
    onClick(e) {
      const info = e.target.closest('[data-detail]');
      if (info) {
        this.cui.showBuildDetails(this.entries.get(info.dataset.detail));
        return;
      }
      const row = e.target.closest('.dw-row'); if (!row) return;
      if (row.dataset.sell) { this.g.sound.unlock(); this.g.demolisher.setSelling(!this.g.demolisher.selling); return; }
      if (this.g.demolisher && this.g.demolisher.selling) this.g.demolisher.setSelling(false);
      this.g.sound.unlock(); const cui = this.cui, { out } = cui.cards(), i = out.findIndex((x) => x.id === row.dataset.id && x.kind === row.dataset.kind);
      if (i < 0) { cui.toast(row.dataset.why ? row.dataset.why[0].toUpperCase() + row.dataset.why.slice(1) + '.' : 'You need more materials for that.'); this.g.sound.play('clank'); return; }
      cui.cardList = out; cui.pickCard(i);
    }
  }

  K.BuildDrawer = BuildDrawer;
})(typeof window !== 'undefined' ? window : globalThis);
