/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  class BuilderAppUI extends K.BuilderAppSelection {
    buildToolbar() {
      const L = [['select', '⬚', 'Select', 'V'], null, ['paint', '▦', 'Terrain', 'T'], ['height', '⛰', 'Height', 'H'], ['carve', '⌇', 'Chasm', 'C'], null, ['wall', '▤', 'Wall', 'W'], ['room', '▣', 'Room', 'R'], ['bridge', '⊟', 'Bridge', 'J'], ['prop', '✱', 'Props', 'P']];
      $('tools').innerHTML = L.map((t) => (t ? `<button data-tool="${t[0]}" title="${t[2]} (${t[3]})"><span class="ic">${t[1]}</span>${t[2]}<span class="k">${t[3]}</span></button>` : '<div class="grp"></div>')).join('');
      $('tools').querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => this.setTool(b.dataset.tool)));
    }
    setTool(name) {
      if (this.tool) this.tool.cancel(); this.toolName = name; this.tool = this.tools[name];
      $('tools').querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === name));
      this.renderer3.domElement.style.cursor = this.tool.cursor();
      this.overlay.brush(null); this.overlay.poly([], false); this.overlay.hoverObj(null);
      this.panel();
    }
    panel() { if (!this.tool || !this.doc) return; const root = $('insp'); root.innerHTML = this.tool.options(); this.tool.bind(root); }
    drawIcons(root) {
      root.querySelectorAll('canvas[data-icon]').forEach((c) => {
        const k = c.dataset.icon, def = PropBuilder.PROPS[k], ctx = c.getContext('2d');
        if (def.interact && K.Icons) { const ic = { ore: 'ore', tree: 'log', herb: 'herb', fish: 'fish' }[def.interact] || 'bag'; ctx.imageSmoothingEnabled = false; ctx.drawImage(K.Icons.base(ic), 0, 0, 28, 28); return; }
        if (def.sprite) { const sp = this.renderer.lib.get(def.sprite), f = sp.frames[0]; const tmp = this.renderer.bank.canvasOf(f); const s = Math.min(28 / f.w, 28 / f.h); c.width = Math.round(f.w * s); c.height = Math.round(f.h * s); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, c.width, c.height); return; }
        const pal = { campfire: ['#ff8f2e', '#5a1408'], torch: ['#ffc65a', '#30343e'], banner: ['#a8383a', '#47301c'], pine: ['#2a4733', '#c6d2e3'], deadtree: ['#4a382a', '#281d16'], shrub: ['#40633a', '#223a22'], rock: ['#4c4b52', '#2a2b31'], rubble: ['#605e64', '#dfe7f2'], crate: ['#765333', '#331f13'], crates: ['#765333', '#dfe7f2'], pillar: ['#78757a', '#dfe7f2'], log: ['#5c4836', '#dfe7f2'] }[k] || ['#888', '#444'];
        ctx.fillStyle = pal[1]; ctx.fillRect(6, 20, 16, 4); ctx.fillStyle = pal[0];
        if (k === 'pine') { ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(23, 22); ctx.lineTo(5, 22); ctx.fill(); }
        else if (k === 'campfire' || k === 'torch') { ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(20, 20); ctx.lineTo(8, 20); ctx.fill(); }
        else if (k === 'banner') { ctx.fillRect(9, 3, 2, 21); ctx.fillRect(11, 4, 9, 13); }
        else if (k === 'pillar') { ctx.fillRect(9, 4, 10, 18); }
        else ctx.fillRect(7, 9, 14, 12);
      });
    }
    status(t) { $('sInfo').textContent = t || ''; }
    toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), 2600); }
    setView(v) {
      this.view = v; $('bView').textContent = v === 'top' ? 'Orbit' : 'Top-down';
      const g = this.rig.goal;
      if (v === 'top') { this.savedOrbit = { yaw: g.yaw, pitch: g.pitch, dist: g.dist }; this.rig.set({ pitch: 1.53, yaw: 0, dist: Math.max(g.dist, 18) }); }
      else this.rig.set(this.savedOrbit || { pitch: 0.7, yaw: -0.2 });
    }
    serialize() { const d = this.doc; if (this.play.active) d.game = this.play.snapshot(); d.camera = { tx: r3(this.rig.goal.tx), ty: r3(this.rig.goal.ty), tz: r3(this.rig.goal.tz), yaw: r3(this.rig.goal.yaw), pitch: r3(this.rig.goal.pitch), dist: r3(this.rig.goal.dist) }; return d.toJSON(); }
    slug() { return (this.doc.name || 'world').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'world'; }
    download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    saveJSON(noDownload) {
      const txt = JSON.stringify(this.serialize());
      if (!noDownload) this.download(new Blob([txt], { type: 'application/json' }), this.slug() + '.world.json');
      this.toast(`Downloaded ${this.slug()}.world.json · ${(txt.length / 1024).toFixed(0)} KB`); this.dirtySince = false; this.updateDirty();
      return txt;
    }
    loadText(txt) {
      let doc;
      try { doc = WorldDoc.fromJSON(JSON.parse(txt)); } catch (e) { this.toast('Could not load: ' + e.message); return false; }
      this.setDoc(doc); this.toast(`Loaded "${doc.name}" · ${doc.w} × ${doc.h} tiles · ${doc.objects.length} objects`);
      return true;
    }
    async exportPNG(noDownload) {
      this.overlay.scene.visible = false; this.renderFrame(); this.overlay.scene.visible = true;
      const blob = await new Promise((res) => this.renderer3.domElement.toBlob(res, 'image/png'));
      if (!blob) { this.toast('PNG export failed.'); return null; }
      if (!noDownload) this.download(blob, this.slug() + '.png');
      this.toast(`Exported ${this.slug()}.png · ${(blob.size / 1024).toFixed(0)} KB`); return blob;
    }
    bindUI() {
      $('gSize').innerHTML = PRESETS.map((p, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${p[0]}</option>`).join('');
      $('nSize').innerHTML = $('gSize').innerHTML;
      $('bGen').onclick = async () => {
        const s = parseInt($('gSeed').value, 10); if (!isFinite(s)) return; const p = PRESETS[+$('gSize').value];
        if (this.dirtySince && !(await this.ask('Generate a new world?', 'Seed ' + s + ' replaces the world you are editing, which has unsaved changes. Save it first if you want to keep it.', 'Generate', true))) return;
        $('loading') || 0; this.toast('Generating…'); setTimeout(() => this.generate(s >>> 0, p[1], p[2]), 30);
      };
      $('gSeed').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('bGen').click(); e.stopPropagation(); });
      $('bNew').onclick = () => { $('modal').style.display = 'flex'; };
      $('nCancel').onclick = () => ($('modal').style.display = 'none');
      $('nOk').onclick = async () => {
        const p = PRESETS[+$('nSize').value]; $('modal').style.display = 'none';
        if (this.dirtySince && !(await this.ask('Start a new world?', 'The world you are editing has unsaved changes. Save it first if you want to keep it.', 'Start new', true))) return;
        this.newBlank(p[1], p[2], $('nName').value, +$('nBase').value);
      };
      $('bSave').onclick = () => this.saveJSON(); $('bPng').onclick = () => this.exportPNG(); $('bNoteDl').onclick = () => this.saveJSON();
      $('bSaveW').onclick = () => this.openSave(); $('bWorlds').onclick = () => this.openWorlds();
      $('bPlay').onclick = () => this.setPlay(!this.play.active);
      $('svCancel').onclick = () => $('saveModal').classList.remove('show');
      $('svOk').onclick = () => { $('saveModal').classList.remove('show'); this.saveWorld($('svName').value, false); };
      $('svCopy').onclick = () => { $('saveModal').classList.remove('show'); this.saveWorld($('svName').value, true); };
      $('svName').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('svOk').click(); if (e.key === 'Escape') $('svCancel').click(); });
      $('wlClose').onclick = () => $('worldsModal').classList.remove('show');
      $('wlOpenFile').onclick = () => { $('worldsModal').classList.remove('show'); $('file').click(); };
      $('wlDl').onclick = () => this.saveJSON();
      $('wlList').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'), r = e.target.closest('[data-id]'); if (b && r) this.worldsAction(r.dataset.id, b.dataset.a); });
      window.addEventListener('beforeunload', (e) => { if (this.dirtySince && !G.KINSTEAD_NO_UNLOAD_PROMPT) { e.preventDefault(); e.returnValue = ''; } });
      $('bOpen').onclick = () => $('file').click();
      $('file').onchange = async () => {
        const f = $('file').files[0]; $('file').value = ''; if (!f) return;
        if (this.dirtySince && !(await this.ask('Open this file?', 'The world you are editing has unsaved changes. They will be lost unless you save it first.', 'Open anyway', true))) return;
        f.text().then((t) => this.loadText(t));
      };
      $('bUndo').onclick = () => this.undo(); $('bRedo').onclick = () => this.redo();
      $('bView').onclick = () => this.setView(this.view === 'top' ? 'orbit' : 'top');
      $('bClose').onclick = () => { if (this.view === 'top') this.setView('orbit'); this.frameHero(false); };
      $('bFit').onclick = () => this.frameAll(false);
      $('tDof').onchange = (e) => (this.post.enabled.dof = e.target.checked);
      $('tBloom').onchange = (e) => (this.post.enabled.bloom = e.target.checked);
      $('tSnow').onchange = (e) => (this.renderer.snow.points.visible = e.target.checked);
      $('qual').onchange = (e) => { this.quality = +e.target.value; this.resize(); };
    }
  }
  K.BuilderAppUI = BuilderAppUI;
})(typeof window !== 'undefined' ? window : globalThis);
