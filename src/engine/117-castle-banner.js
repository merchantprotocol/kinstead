/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · banners. Everyone flies a banner: a colour, a logo and a name (the team's name, once you are on a team).
   Click yourself to choose them. Your character wears the colour, your cottage and gates fly a flag with your logo, and
   everything of yours reads as yours when someone hovers or clicks it. When you invite someone, they take on your
   team's banner (whatever they flew before is replaced).
     Emblems       the twelve logos, drawn as little pictures
     BannerBook    whose banner is what (yours, and everyone else's), and who is told when it changes
     BannerEditor  the screen you get when you click yourself
     Flags         the flags that stand by cottages and gates */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const COLORS = [0xc0392b, 0xe67e22, 0xf1c40f, 0x27ae60, 0x16a085, 0x2980b9, 0x8e44ad, 0xd35400, 0x7f8c8d, 0x2c3e50, 0xe84393, 0xecf0f1];
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const EMBLEMS = [
    ['Star', '<polygon points="32,6 39,25 59,25 43,37 49,57 32,45 15,57 21,37 5,25 25,25"/>'], ['Crown', '<path d="M8 50V22l14 14 10-18 10 18 14-14v28z"/>'],
    ['Flame', '<path d="M32 4c5 10 17 16 17 31a17 17 0 0 1-34 0c0-9 4-13 9-17 0 6 3 9 6 10-2-8-1-16 2-24z"/>'], ['Sword', '<path d="M30 3h4v34h12v6H34v16h-4V43H18v-6h12z"/>'],
    ['Paw', '<ellipse cx="32" cy="43" rx="15" ry="12"/><circle cx="12" cy="27" r="6.5"/><circle cx="24" cy="14" r="6.5"/><circle cx="40" cy="14" r="6.5"/><circle cx="52" cy="27" r="6.5"/>'],
    ['Moon', '<path d="M42 6a26 26 0 1 0 16 36A21 21 0 0 1 42 6z"/>'], ['Pine', '<path d="M32 3L13 30h9L9 46h19v15h8V46h19L42 30h9z"/>'],
    ['Skull', '<path fill-rule="evenodd" d="M32 5C18 5 9 15 9 27c0 8 4 13 11 16v10h6v-6h4v6h4v-6h4v6h6V43c7-3 11-8 11-16C55 15 46 5 32 5zM22 24a6 6 0 1 0 .01 0zM42 24a6 6 0 1 0 .01 0z"/>'],
    ['Gem', '<path d="M32 4L58 32 32 60 6 32z"/>'], ['Tower', '<path fill-rule="evenodd" d="M12 58V20h7v-8h7v8h5v-8h7v8h5v-8h7v8h7v38H38V42a6 6 0 0 0-12 0v16z"/>'],
    ['Eye', '<path fill-rule="evenodd" d="M3 32C13 15 24 9 32 9s19 6 29 23C51 49 40 55 32 55S13 49 3 32zm29-11a11 11 0 1 0 .01 0z"/>'], ['Bolt', '<path d="M38 3L11 37h15l-6 24 29-35H34z"/>'],
  ];
  class Emblems {
    static svg(logo, fill = '#ffffff') { const e = EMBLEMS[((logo | 0) % 12 + 12) % 12]; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="${fill}" stroke="#000" stroke-opacity=".45" stroke-width="2.4" stroke-linejoin="round">${e[1]}</g></svg>`; }
    static url(logo, fill) { return 'data:image/svg+xml,' + encodeURIComponent(Emblems.svg(logo, fill)); }
    static name(logo) { return EMBLEMS[((logo | 0) % 12 + 12) % 12][0]; }
    /** a texture of the logo, filled in as the picture loads */
    static texture(logo) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const tex = new THREE.CanvasTexture(cv), img = new Image();
      img.onload = () => { cv.getContext('2d').drawImage(img, 0, 0, 128, 128); tex.needsUpdate = true; }; img.src = Emblems.url(logo, '#ffffff'); return tex;
    }
  }
  Emblems.COUNT = 12;

  /** whose banner is what. The server's word for everyone; yours is also kept here when playing alone. */
  class BannerBook {
    constructor(game, net) {
      this.g = game; this.net = net; this.by = {}; this.listeners = [];
      if (net && net.welcome && net.welcome.banners) this.by = Object.assign({}, net.welcome.banners);
      let local = null; try { local = JSON.parse(G.localStorage.getItem('kinstead.banner') || 'null'); } catch (e) { /* none yet */ }
      this.local = local;
      if (net) net.on('banners', (m) => this.set(m.map));
      if (net && local && !(this.by[net.id] && this.by[net.id].team)) this.send(local);   // a banner chosen alone carries over (unless a team already decides it)
    }
    get meId() { return this.net ? this.net.id : 'me'; }
    on(fn) { this.listeners.push(fn); }
    static fallback(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return { name: '', color: h % 12, logo: h % 12, team: null }; }
    get(id) { if (id === this.meId && !this.net) return Object.assign({ team: null }, this.local || BannerBook.fallback('me')); return this.by[id] || BannerBook.fallback(id); }
    mine() { return this.get(this.meId); }
    hexOf(id) { return COLORS[this.get(id).color % 12]; }
    /** the line to show for someone's things: their team's name, else theirs */
    label(id, fallbackName) { const b = this.get(id); return b.name || fallbackName || 'a settler'; }
    set(map) { Object.assign(this.by, map); for (const f of this.listeners) { try { f(); } catch (e) { console.warn('banner listener', e); } } }
    send(b) { if (this.net) this.net.send({ t: 'banner', b }); }
    /** you chose a banner */
    choose(b) {
      try { G.localStorage.setItem('kinstead.banner', JSON.stringify(b)); } catch (e) { /* private mode */ } this.local = b;
      if (this.net) { this.by[this.meId] = Object.assign({ team: (this.by[this.meId] || {}).team || null }, b); this.send(b); }
      this.set({});
    }
  }

  class BannerEditor {
    constructor(game) {
      this.g = game; const root = (this.root = document.createElement('div')); root.id = 'cBanner'; root.hidden = true; game.cui.root.appendChild(root);
      root.addEventListener('pointerdown', (e) => e.stopPropagation()); root.addEventListener('click', (e) => this.onClick(e));
      root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.close(); }); this.draft = null;
    }
    get isOpen() { return !this.root.hidden; }
    open() { const b = this.g.banners.mine(); this.draft = { name: b.name || '', color: b.color, logo: b.logo, onTeam: !!b.team }; this.root.hidden = false; this.render(); }
    close() { this.root.hidden = true; }
    render() {
      const d = this.draft, c = hex(COLORS[d.color]);
      this.root.innerHTML = `<div class="bn"><h2>Your banner</h2><p>${d.onTeam ? 'You fly your team’s banner. Changing it changes it for the whole team.' : 'Pick a colour and a logo, and name your team. People you invite will fly it too.'}</p>
        <div class="bn-prev" style="background:${c}"><img src="${Emblems.url(d.logo)}" alt=""><b>${esc(d.name || 'Your team')}</b></div>
        <h4>Colour</h4><div class="sw">${COLORS.map((x, i) => `<button class="${i === d.color ? 'on' : ''}" data-c="${i}" style="background:${hex(x)}" aria-label="colour ${i + 1}"></button>`).join('')}</div>
        <h4>Logo</h4><div class="lg">${EMBLEMS.map((e, i) => `<button class="${i === d.logo ? 'on' : ''}" data-l="${i}" title="${e[0]}" style="background:${c}"><img src="${Emblems.url(i)}" alt="${e[0]}"></button>`).join('')}</div>
        <h4>Team name</h4><input maxlength="24" placeholder="Name your team" value="${esc(d.name)}">
        <div class="bn-act"><button data-save class="pri">Save</button><button data-close>Cancel</button></div></div>`;
      const input = this.root.querySelector('input'); input.addEventListener('input', () => { d.name = input.value; const b = this.root.querySelector('.bn-prev b'); if (b) b.textContent = d.name || 'Your team'; });
    }
    onClick(e) {
      const d = this.draft, t = e.target.closest('button'); if (!t) { if (e.target === this.root) this.close(); return; }
      if (t.dataset.c != null) { d.color = +t.dataset.c; this.render(); } else if (t.dataset.l != null) { d.logo = +t.dataset.l; this.render(); }
      else if (t.hasAttribute('data-save')) { this.g.banners.choose({ name: d.name.trim().slice(0, 24), color: d.color, logo: d.logo }); this.close(); this.g.cui.toast('Banner saved.'); }
      else if (t.hasAttribute('data-close')) this.close();
    }
    dispose() { this.root.remove(); }
  }

  /** a pole with a flag in the owner's colour and logo, standing by a cottage or a gate */
  class Flags {
    constructor(game) { this.g = game; this.by = new Map(); this.logoTex = new Map(); game.banners.on(() => this.refresh()); }
    tex(logo) { let t = this.logoTex.get(logo); if (!t) { t = Emblems.texture(logo); this.logoTex.set(logo, t); } return t; }
    flag(key, x, z, owner, height = 3.2) {
      this.unflag(key); const g = this.g, grp = new THREE.Group(), y = g.play.nav.y(x, z);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, 0.07), new THREE.MeshLambertMaterial({ color: 0x4a3418 })); pole.position.y = height / 2; grp.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.62), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })); cloth.position.set(0.5, height - 0.4, 0); grp.add(cloth);
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false })); mark.position.set(0.5, height - 0.4, 0.01); grp.add(mark);
      grp.position.set(x, y, z); g.group.add(grp); const rec = { grp, cloth, mark, owner, t: Math.random() * 6 }; this.by.set(key, rec); this.skin(rec); return rec;
    }
    skin(r) { const b = this.g.banners.get(r.owner); r.cloth.material.color.setHex(COLORS[b.color % 12]); r.mark.material.map = this.tex(b.logo); r.mark.material.needsUpdate = true; }
    unflag(key) { const r = this.by.get(key); if (!r) return; this.g.group.remove(r.grp); r.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.by.delete(key); }
    refresh() { for (const r of this.by.values()) this.skin(r); }
    update(dt) { for (const r of this.by.values()) { r.t += dt; r.grp.children[1].rotation.y = r.grp.children[2].rotation.y = Math.sin(r.t * 2) * 0.12; } }   // the flag stirs in the wind
    dispose() { for (const k of [...this.by.keys()]) this.unflag(k); for (const t of this.logoTex.values()) t.dispose(); }
  }

  Object.assign(K, { Emblems, BannerBook, BannerEditor, Flags, BANNER_COLORS: COLORS });
})(typeof window !== 'undefined' ? window : globalThis);
