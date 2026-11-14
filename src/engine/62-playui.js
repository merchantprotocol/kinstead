/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · play-mode UI: character HUD (equipment, purse, bag), context menu, dialogue, trade,
   inspect card, bottom bar, name plates / HP bars / damage numbers, action progress. DOM only;
   game rules live in PlayMode and PlayerState. */
(function (G) {
  const K = G.K;
  const { Icons, SLOTS, SLOT_NAMES } = K;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.innerHTML = html; return e; };
  const SLOT_ICON = { main: 'sword', off: 'shield', head: 'hood', body: 'dress', cloak: 'cloak', boots: 'boots', trinket: 'charm' };

  class PlayUI {
    constructor(game) {
      this.g = game; this.plates = new Map(); this.floats = [];
      const root = (this.root = el('div', { id: 'playui' }));
      root.innerHTML = `
        <div id="plates"></div>
        <div id="hoverTip"></div>
        <div id="ctx" class="gp"></div>
        <div id="card" class="gp"></div>
        <div id="hud" class="gp"></div>
        <div id="dlg" class="gp"></div>
        <div id="trade" class="gp"></div>
        <div id="stn" class="gp"></div>
        <div id="fadeScreen"></div>
        <div id="pbar" class="gp"></div>
        <div id="dragGhost"></div>`;
      document.body.appendChild(root);
      this.$ = (id) => root.querySelector('#' + id);
      ['ctx', 'card', 'hud', 'dlg', 'trade', 'stn'].forEach((k) => (this.$(k).style.display = 'none'));
      this.bindHud(); this.bindBar(); this.bindStation(); this.show(false);
    }
    show(v) { this.root.style.display = v ? '' : 'none'; if (!v) { this.closeAll(); this.clearPlates(); } }
    isOpen(id) { return this.$(id).style.display !== 'none'; }
    closeAll() { ['ctx', 'card', 'hud', 'dlg', 'trade', 'stn'].forEach((k) => this.close(k)); }
    close(id) { const e = this.$(id); if (e.style.display === 'none') return; e.style.display = 'none'; if (id === 'dlg' || id === 'trade') this.g.endConversation(); }
    /* Esc: close the topmost window; true if something closed */
    closeTop() { for (const id of ['ctx', 'card', 'stn', 'trade', 'dlg', 'hud']) if (this.isOpen(id)) { this.close(id); return true; } return false; }
    place(e, sx, sy) {
      const r = e.getBoundingClientRect(), st = this.g.app.stage.getBoundingClientRect(), W = st.width || innerWidth, H = st.height || innerHeight;
      e.style.left = Math.max(8, Math.min(W - r.width - 8, sx)) + 'px'; e.style.top = Math.max(60, Math.min(H - r.height - 70, sy)) + 'px';
    }

    /* ---------- bottom bar ---------- */
    bindBar() {
      this.$('pbar').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'hud') this.toggleHud(); else if (b.dataset.a === 'stop') this.g.app.setPlay(false); else if (b.dataset.a === 'dismount') this.g.bplay.dismount();
      });
    }
    bar() {
      const p = this.g.player, s = p.stats(), x = this.$('pbar'), bp = this.g.bplay;
      x.innerHTML = `<div class="who">${Icons.img(p.outfit === 'witch' ? 'charm' : 'sword', 1)}<b>Lv ${p.level}</b></div>
        <div class="hpbar" title="Health"><i style="width:${(100 * p.hp / s.hpMax).toFixed(1)}%"></i><span>${Math.ceil(p.hp)} / ${s.hpMax} HP</span></div>
        <div class="xpbar" title="Experience"><i style="width:${(100 * p.xp / p.xpNext()).toFixed(1)}%"></i><span>${p.xp} / ${p.xpNext()} XP</span></div>
        <div class="purse" title="Coin purse">${Icons.img('coin', 1)}<b>${p.coins}</b></div>
        <div class="clock" title="Time of day (sleeping passes 8 hours)">${esc(bp.clock.text)}${bp.roomName ? ` · <b>${esc(bp.roomName)}</b>` : ''}</div>
        ${bp.mounted ? `<button class="gb" data-a="dismount" title="Get off your horse (M)">${Icons.img('saddle', 1)} Dismount <kbd>M</kbd></button>` : ''}
        <button class="gb" data-a="hud" title="Character, gear and bag (C)">${Icons.img('bag', 1)} Character <kbd>C</kbd></button>
        <span class="hint">Click: walk · Double-click: run · Click yourself: gear · Right-drag: orbit · Esc: close</span>
        <button class="gb" data-a="stop" title="Back to editing (G)">■ Edit world</button>`;
    }

    /* ---------- context menu ---------- */
    openMenu(e, acts, sx, sy) {
      const x = this.$('ctx'), g = this.g, reg = g.reg, name = (reg.get(e.type) && reg.get(e.type).name ? reg.get(e.type).name(e) : e.name);
      const sub = e.actor ? `Level ${e.actor.level} · ${K.ROLE_NAMES[e.actor.role] || ''}${e.actor.hostile && e.actor.role !== 'enemy' ? ' (hostile)' : ''}` : (reg.get(e.type) && reg.get(e.type).node ? 'Resource' : '');
      x.innerHTML = `<div class="hd"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>` +
        acts.map((a, i) => `<button data-i="${i}" class="${a.danger ? 'danger' : ''}">${Icons.img(a.icon || 'hand', 1)}<span>${esc(a.label)}</span><kbd>${i + 1}</kbd></button>`).join('');
      x.style.display = ''; this.menu = { e, acts }; this.place(x, sx + 18, sy - 20);
      x.onclick = (ev) => { const b = ev.target.closest('[data-i]'); if (b) this.pickMenu(+b.dataset.i); };
    }
    pickMenu(i) { const m = this.menu; if (!m || !m.acts[i]) return false; this.close('ctx'); this.g.doAction(m.e, m.acts[i]); return true; }

    /* ---------- inspect card ---------- */
    openCard(e, info, sx, sy) {
      const x = this.$('card');
      const pic = info.portrait ? `<canvas class="por" data-sprite="${info.portrait}"></canvas>` : info.icon ? Icons.img(info.icon, 3) : '';
      x.innerHTML = `<div class="hdr"><h3>${esc(info.title)}</h3><button class="x" data-x>×</button></div>
        <div class="cardbody">${pic}<div>${info.sub ? `<div class="sub">${esc(info.sub)}</div>` : ''}${info.hp != null ? `<div class="hpbar sm"><i style="width:${Math.max(0, info.hp) * 100}%"></i></div>` : ''}
        <p>${esc(info.body || '')}</p></div></div>
        ${(info.rows || []).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}`;
      this.drawPortraits(x); x.style.display = ''; this.place(x, sx + 18, sy - 40);
      x.querySelector('[data-x]').onclick = () => this.close('card');
    }
    drawPortraits(root, scale = 2) {
      root.querySelectorAll('canvas[data-sprite]').forEach((c) => {
        const sp = this.g.R.lib.get(c.dataset.sprite), f = sp.frames[0], src = this.g.R.bank.canvasOf(f);
        // crop to the opaque box so portraits are big
        let x0 = f.w, y0 = f.h, x1 = 0, y1 = 0; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.alpha(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        const w = x1 - x0 + 1, h = y1 - y0 + 1, s = Math.max(1, Math.floor(Math.min(+(c.dataset.max || 96) / w, +(c.dataset.max || 96) / h)));
        c.width = w * s; c.height = h * s; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(src, x0, y0, w, h, 0, 0, w * s, h * s);
      });
    }

    /* ---------- character HUD ---------- */
    toggleHud(force) { const open = force != null ? force : !this.isOpen('hud'); if (open) { this.$('hud').style.display = ''; this.renderHud(); } else this.close('hud'); }
    slotHtml(kind, key, id, n) {
      const it = id && this.g.items.get(id);
      const tip = it ? `${it.name}${this.g.items.describe(id) ? ' — ' + this.g.items.describe(id) : ''}` : kind === 'slot' ? SLOT_NAMES[key] + ' (empty)' : '';
      const ph = kind === 'slot' && !it ? `<img class="ico ph" src="${Icons.url(SLOT_ICON[key], 2)}" width="32" height="32" alt="">` : '';
      return `<div class="slot ${kind === 'slot' ? 'eq' : ''} ${it ? 'has' : ''}" data-${kind}="${key}" title="${esc(tip)}">${it ? Icons.img(it.icon, 2) : ph}${n > 1 ? `<b>${n}</b>` : ''}${kind === 'slot' ? `<small>${SLOT_NAMES[key].split(' ')[0]}</small>` : ''}</div>`;
    }
    renderHud() {
      if (!this.isOpen('hud')) return;
      const g = this.g, p = g.player, s = p.stats(), eq = (k) => this.slotHtml('slot', k, p.equipment[k], 1);
      this.$('hud').innerHTML = `<div class="hdr"><h3>${esc(p.name)} · Level ${p.level}</h3><button class="x" data-x title="Close (Esc)">×</button></div>
        <div class="doll"><div class="col">${eq('head')}${eq('main')}${eq('body')}</div>
          <div class="mid"><canvas class="por" data-sprite="${p.outfit}" data-max="112"></canvas>${eq('boots')}</div>
          <div class="col">${eq('trinket')}${eq('off')}${eq('cloak')}</div></div>
        <div class="stats"><div class="hpbar"><i style="width:${(100 * p.hp / s.hpMax).toFixed(1)}%"></i><span>${Math.ceil(p.hp)} / ${s.hpMax} HP</span></div>
          <div class="xpbar"><i style="width:${(100 * p.xp / p.xpNext()).toFixed(1)}%"></i><span>${p.xp} / ${p.xpNext()} XP</span></div>
          <div class="sts"><span>Attack <b>${s.atk}</b></span><span>Defence <b>${s.def}</b></span><span>Speed <b>${Math.round(s.speed * 100)}%</b></span></div></div>
        <div class="purse big">${Icons.img('coin', 2)}<b>${p.coins}</b><span>coins in your purse</span></div>
        <div class="bag">${p.bag.map((x, i) => this.slotHtml('inv', i, x && x.id, x ? x.n : 0)).join('')}</div>
        <p class="desc" id="hudDesc">Click an item to equip or use it; click worn gear to take it off. Or drag between slots.</p>`;
      this.drawPortraits(this.$('hud'));
    }
    bindHud() {
      const hud = this.$('hud');
      let drag = null;
      const at = (x, y) => [...hud.querySelectorAll('.slot')].find((q) => { const r = q.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) || null;
      hud.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest('[data-x]')) { this.close('hud'); return; }
        const s = ev.target.closest('.slot.has'); if (!s) return;
        drag = { from: s, x: ev.clientX, y: ev.clientY, started: false }; ev.preventDefault();
      });
      window.addEventListener('pointermove', (ev) => {
        if (drag) {
          if (!drag.started && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 4) {
            drag.started = true; const gh = this.$('dragGhost'), img = drag.from.querySelector('img'); gh.innerHTML = img ? img.outerHTML : ''; gh.style.display = 'block'; drag.from.classList.add('lift');
          }
          if (drag.started) { const gh = this.$('dragGhost'); gh.style.left = ev.clientX - 16 + 'px'; gh.style.top = ev.clientY - 16 + 'px'; const t = at(ev.clientX, ev.clientY); hud.querySelectorAll('.slot.over').forEach((q) => q.classList.remove('over')); if (t) t.classList.add('over'); }
        }
      });
      window.addEventListener('pointerup', (ev) => {
        if (!drag) return; const d = drag; drag = null; this.$('dragGhost').style.display = 'none'; hud.querySelectorAll('.slot.over,.slot.lift').forEach((q) => q.classList.remove('over', 'lift'));
        if (!d.started) { this.slotClick(d.from); return; }
        const t = at(ev.clientX, ev.clientY); this.dropOn(d.from, t);
      });
      hud.addEventListener('pointerover', (ev) => {
        const s = ev.target.closest('.slot'); const d = this.$('hud').querySelector('#hudDesc'); if (!s || !d) return;
        const p = this.g.player, id = s.dataset.slot ? p.equipment[s.dataset.slot] : (p.bag[+s.dataset.inv] || {}).id, it = id && this.g.items.get(id);
        if (it) d.innerHTML = `<b>${esc(it.name)}</b> ${this.g.items.describe(id) ? '· ' + esc(this.g.items.describe(id)) : ''}<br>${esc(it.desc || '')} <i>${it.slot ? (s.dataset.slot ? 'Click to take off.' : 'Click to equip.') : it.heal ? 'Click to eat / drink.' : ''}</i>`;
      });
    }
    slotClick(s) {
      const g = this.g, p = g.player;
      if (s.dataset.slot) { if (!p.unequip(s.dataset.slot)) g.toast('Your bag is full.'); }
      else { const r = p.useFromBag(+s.dataset.inv); if (r === 'full') g.toast('You are already at full health.'); }
    }
    dropOn(from, to) {
      const p = this.g.player; if (!to || to === from) return;
      if (from.dataset.inv != null && to.dataset.inv != null) p.moveBag(+from.dataset.inv, +to.dataset.inv);
      else if (from.dataset.inv != null && to.dataset.slot) {
        const it = this.g.items.get((p.bag[+from.dataset.inv] || {}).id);
        if (!it || it.slot !== to.dataset.slot) { this.g.toast(it ? `${it.name} doesn't go in the ${SLOT_NAMES[to.dataset.slot].toLowerCase()} slot.` : ''); return; }
        p.equipFromBag(+from.dataset.inv);
      } else if (from.dataset.slot && to.dataset.inv != null) { if (!p.unequip(from.dataset.slot, p.bag[+to.dataset.inv] ? null : +to.dataset.inv)) this.g.toast('Your bag is full.'); }
    }

    /* ---------- dialogue ---------- */
    openDialogue(a, node) {
      const x = this.$('dlg');
      x.innerHTML = `<canvas class="por" data-sprite="${a.spriteId}" data-max="88"></canvas><div class="dl"><h3>${esc(a.name)}</h3>
        ${node.text.map((t) => `<p>${esc(t)}</p>`).join('')}
        <div class="ch">${node.choices.map((c, i) => `<button data-i="${i}"><kbd>${i + 1}</kbd> ${esc(c.label)}</button>`).join('')}</div></div>
        <button class="x" data-x title="Close (Esc)">×</button>`;
      this.drawPortraits(x); x.style.display = ''; this.dlg = { a, node };
      x.onclick = (ev) => { if (ev.target.closest('[data-x]')) { this.close('dlg'); return; } const b = ev.target.closest('[data-i]'); if (b) this.pickChoice(+b.dataset.i); };
    }
    pickChoice(i) { const d = this.dlg; if (!d || !d.node.choices[i]) return false; this.g.dialogueChoice(d.a, d.node.choices[i]); return true; }

    /* ---------- trade ---------- */
    openTrade(a) { this.trade = a; this.$('trade').style.display = ''; this.renderTrade(); }
    renderTrade() {
      if (!this.isOpen('trade')) return;
      const g = this.g, p = g.player, a = this.trade, x = this.$('trade');
      const buy = K.SHOP.map(([id, price]) => { const it = g.items.get(id); return `<button class="ti ${p.coins < price ? 'poor' : ''}" data-buy="${id}" title="${esc(it.desc)}">${Icons.img(it.icon, 2)}<span>${esc(it.name)}<small>${esc(g.items.describe(id))}</small></span><b>${Icons.img('coin', 1)}${price}</b></button>`; }).join('');
      const sell = p.bag.map((s, i) => { if (!s) return ''; const it = g.items.get(s.id); return `<button class="ti" data-sell="${i}" title="${esc(it.desc)}">${Icons.img(it.icon, 2)}<span>${esc(it.name)}${s.n > 1 ? ' ×' + s.n : ''}</span><b>${Icons.img('coin', 1)}${g.sellPrice(s.id)}</b></button>`; }).join('') || '<p class="empty">Your bag is empty.</p>';
      x.innerHTML = `<div class="hdr"><h3>Trade with ${esc(a.name)}</h3><button class="x" data-x title="Close (Esc)">×</button></div>
        <div class="cols"><div><h4>Buy</h4><div class="tl">${buy}</div></div><div><h4>Sell</h4><div class="tl">${sell}</div></div></div>
        <div class="tfoot"><div class="purse big">${Icons.img('coin', 2)}<b>${p.coins}</b><span>coins</span></div><span class="hint">Click an item to buy or sell one.</span></div>`;
      x.onclick = (ev) => {
        if (ev.target.closest('[data-x]')) { this.close('trade'); return; }
        const b = ev.target.closest('[data-buy]'), s = ev.target.closest('[data-sell]');
        if (b) g.buy(b.dataset.buy); else if (s) g.sell(+s.dataset.sell);
      };
    }

    /* ---------- station window (furniture: crafting, cooking, wardrobe, racks, chests, food) ---------- */
    openStation() { const x = this.$('stn'); x.style.display = ''; }
    renderStation(m) {
      const x = this.$('stn'); if (!m) { this.close('stn'); return; }
      const chip = (c) => `<span class="chip ${c.have >= c.need ? 'ok' : 'no'}" title="${esc(c.name)}">${Icons.img(c.icon, 1)}${c.have}/${c.need} ${esc(c.name)}</span>`;
      const row = (r) => `<div class="srow ${r.available ? '' : 'off'} ${r.current ? 'cur' : ''}">
          <div class="sic">${Icons.img(r.icon || 'bag', 2)}${r.tint != null ? `<i class="sw" style="background:#${r.tint.toString(16).padStart(6, '0')}"></i>` : ''}</div>
          <div class="stx"><b>${esc(r.label)}${r.count > 1 ? ' ×' + r.count : ''}</b>${r.out ? `<small>→ ${r.out.map((o) => (o.n > 1 ? o.n + ' × ' : '') + esc(o.name)).join(', ')}</small>` : ''}${r.desc ? `<small>${esc(r.desc)}</small>` : ''}
            ${r.chips ? `<div class="chips">${r.chips.map(chip).join('')}</div>` : ''}${!r.available && r.reason ? `<small class="why">${esc(r.reason)}</small>` : ''}</div>
          <button class="gb" data-opt="${esc(r.id)}" ${r.available && !r.current ? '' : 'disabled'}>${r.current ? 'Wearing' : esc(r.verb)}</button></div>`;
      let body = '';
      if (!m.rows.length) body = `<p class="empty">${esc(m.empty)}</p>`;
      else if (m.rows.some((r) => r.group)) { const groups = {}; m.rows.forEach((r) => (groups[r.group] = groups[r.group] || []).push(r)); body = Object.entries(groups).map(([g, rs]) => `<h4>${esc(g)}</h4>${rs.map(row).join('')}`).join(''); }
      else body = m.rows.map(row).join('');
      x.innerHTML = `<div class="hdr"><h3>${esc(m.title)}${m.sub ? ` <small>${esc(m.sub)}</small>` : ''}</h3><button class="x" data-x title="Close (Esc)">×</button></div>
        ${m.tabs.length > 1 ? `<div class="tabs">${m.tabs.map((t) => `<button data-tab="${t.id}" class="${t.on ? 'on' : ''}">${esc(t.label)}</button>`).join('')}</div>` : ''}
        ${m.warn ? `<p class="warn">${esc(m.warn)}</p>` : ''}<div class="slist">${body}</div>${m.note ? `<p class="hint">${esc(m.note)}</p>` : ''}`;
    }
    bindStation() {
      this.$('stn').addEventListener('click', (ev) => {
        if (ev.target.closest('[data-x]')) { this.close('stn'); return; }
        const t = ev.target.closest('[data-tab]'); if (t) { this.g.bplay.stationTab(t.dataset.tab); return; }
        const o = ev.target.closest('[data-opt]'); if (o && !o.disabled) this.g.bplay.stationPick(o.dataset.opt);
      });
    }

    /* ---------- world-anchored bits: plates, floats, progress ---------- */
    float(x, y, z, text, cls = '', icon = null) {
      const e = el('div', { class: 'dmg ' + cls }, (icon ? Icons.img(icon, 1) : '') + esc(text)); this.$('plates').appendChild(e); e.style.opacity = '0';
      // floats at the same spot queue up instead of overprinting each other
      const key = Math.round(x * 2) + ',' + Math.round(z * 2), now = performance.now(), L = this.lastFloat;
      const n = L && L.key === key && now - L.at < 450 ? L.n + 1 : 0; this.lastFloat = { key, at: now, n };
      this.floats.push({ e, x, y, z, t: -0.32 * n, dx: (Math.random() - 0.5) * 16 });
    }
    clearPlates() { this.$('plates').innerHTML = ''; this.plates.clear(); this.floats = []; }
    frame(dt) {
      const g = this.g, P = this.$('plates'), seen = new Set();
      for (const a of g.actors) {
        if (!a.view.visible) continue;
        const showBar = a !== g.me ? a.alive && (a.hp < a.hpMax || g.target === a || a.aggro || (g.hover === a && a.hostile)) : g.inCombat();
        const showName = a !== g.me && (g.hover === a || g.target === a);
        if (!showBar && !showName) continue;
        const [sx, sy, ok] = g.toScreen(a.x, a.y + a.view.h * 0.98 + 0.12, a.z); if (!ok) continue;
        let p = this.plates.get(a.id); if (!p) { p = el('div', { class: 'plate' }); P.appendChild(p); this.plates.set(a.id, p); }
        const col = a.hostile ? 'hostile' : a.role;
        p.className = 'plate ' + col;
        p.innerHTML = `${showName ? `<div class="nm">${esc(a.name)} <small>Lv ${a.level}</small></div>` : ''}${showBar ? `<div class="bar"><i style="width:${Math.max(0, 100 * a.hp / a.hpMax)}%"></i></div>` : ''}`;
        p.style.left = sx + 'px'; p.style.top = sy + 'px'; seen.add(a.id);
      }
      for (const [id, p] of this.plates) if (!seen.has(id)) { p.remove(); this.plates.delete(id); }
      this.floats = this.floats.filter((f) => {
        f.t += dt; if (f.t < 0) return true; const [sx, sy, ok] = g.toScreen(f.x, f.y, f.z);
        if (f.t > 1.1 || !ok) { f.e.remove(); return false; }
        f.e.style.left = sx + f.dx * f.t + 'px'; f.e.style.top = sy - 34 * f.t + 'px'; f.e.style.opacity = String(Math.min(1, 2.2 - f.t * 2)); return true;
      });
      // action progress above the player
      let pr = P.querySelector('.prog'), ch = g.ch;
      if (ch) {
        if (!pr) { pr = el('div', { class: 'prog' }, '<span></span><div><i></i></div>'); P.appendChild(pr); }
        const [sx, sy] = g.toScreen(g.me.x, g.me.y + g.me.view.h + 0.3, g.me.z);
        pr.style.left = sx + 'px'; pr.style.top = sy + 'px'; pr.querySelector('span').textContent = ch.label; pr.querySelector('i').style.width = Math.min(100, 100 * ch.t / ch.time) + '%';
      } else if (pr) pr.remove();
      // sleeping: fade to black and back
      const fd = this.$('fadeScreen'), fo = ch && ch.fade ? Math.sin(Math.PI * Math.min(1, ch.t / ch.time)) : 0; fd.style.opacity = fo.toFixed(3); fd.style.display = fo > 0.001 ? 'block' : 'none';
    }
    tip(text, sx, sy) { const t = this.$('hoverTip'); if (!text) { t.style.display = 'none'; return; } t.innerHTML = text; t.style.display = 'block'; t.style.left = sx + 16 + 'px'; t.style.top = sy + 18 + 'px'; }
  }

  K.PlayUI = PlayUI;
})(typeof window !== 'undefined' ? window : globalThis);
