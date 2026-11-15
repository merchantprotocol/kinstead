/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  class BuilderAppSelection extends K.BuilderAppStorage {
    setPlay(on) {
      if (on === this.play.active) return;
      if (on) this.play.enter(); else this.play.exit();
      const b = $('bPlay'); b.textContent = on ? '■ Stop playing' : '▶ Play'; b.classList.toggle('on', on); b.title = on ? 'Back to editing (G)' : 'Play this world (G)';
      if (!on) this.panel();
    }
    /* ---- selection ---- */
    select(id) { this.sel = id; this.overlay.selection(); this.overlay.hoverObj(null); if (this.toolName === 'select') this.panel(); }
    pick(p) {
      const doc = this.doc; let best = null, bd = 1e9;
      for (const o of doc.objects) {
        let d;
        if (o.kind === 'prop') { const def = PropBuilder.PROPS[o.type] || { r: 0.4 }; d = Math.hypot(o.x - p.x, o.z - p.z) - def.r * (o.s || 1) - 0.1; if (def.sprite) d -= 0.2; }
        else if (o.kind === 'bridge') { const l = WorldDoc.bridgeLocal(o, p.x, p.z); d = l.s >= 0 && l.s <= l.L ? Math.abs(l.n) - (o.w || 1.6) / 2 : 9; d += 0.15; }
        else if (o.kind === 'building') d = K.BuildingGeo.contains(o, ...doc.tileOf(p.x, p.z)) ? -0.5 : 9;
        else { const P = WorldDoc.wallPts(o); d = 9; for (let k = 0; k + 1 < P.length; k++) d = Math.min(d, K.BuilderAppUtils.segmentDistance(p.x, p.z, P[k], P[k + 1])); d -= 0.35; }
        if (d < 0 && d < bd + (o.kind === 'prop' ? 0.3 : 0)) { bd = d; best = o; }
      }
      return best;
    }
    handles(o) { return o.kind === 'bridge' ? [o.a, o.b] : o.kind === 'wall' ? o.pts : []; }
    handleAt(o, sx, sy) {
      const H = this.handles(o), v = new V3();
      for (let k = 0; k < H.length; k++) { v.set(H[k][0], this.doc.groundY(H[k][0], H[k][1]) + 0.12, H[k][1]).project(this.camera); const r = this.renderer3.domElement.getBoundingClientRect(); const px = (v.x + 1) / 2 * r.width, py = (1 - v.y) / 2 * r.height; if (Math.hypot(px - sx, py - sy) < 9) return k; }
      return null;
    }
    rotateSel(da) {
      this.commitObjects('rotate', (d) => {
        const o = d.obj(this.sel); if (!o) return;
        if (o.kind === 'building') { const b = new K.BuildingEdit().rotate(o, da > 0 ? 1 : -1); if (!new K.BuildingEdit().placementProblems(d, b).length) Object.assign(o, b); return; }
        if (o.kind === 'prop') { o.rot = r3((o.rot || 0) + da); return; }
        const P = o.kind === 'bridge' ? [o.a, o.b] : o.pts, cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length, c = Math.cos(da), s = Math.sin(da);
        const R = P.map(([x, z]) => [r3(cx + (x - cx) * c - (z - cz) * s), r3(cz + (x - cx) * s + (z - cz) * c)]);
        if (o.kind === 'bridge') { o.a = R[0]; o.b = R[1]; } else o.pts = R;
      });
    }
    duplicateSel() {
      const o = this.sel && this.doc.obj(this.sel); if (!o) return;
      this.commitObjects('duplicate', (d) => {
        const c = JSON.parse(JSON.stringify(o)); c.id = d.uid(o.kind[0]); c.seed = (Math.random() * 99999) | 0;
        if (c.kind === 'building') { c.x += c.footprint.w + 1; if (new K.BuildingEdit().placementProblems(d, c).length) { this.toast('No room to duplicate here.'); return; } } else if (c.kind === 'prop') { c.x = r3(c.x + 1); c.z = r3(c.z + 1); } else if (c.kind === 'bridge') { c.a = [c.a[0] + 1, c.a[1] + 1]; c.b = [c.b[0] + 1, c.b[1] + 1]; } else c.pts = c.pts.map(([x, z]) => [x + 1, z + 1]);
        d.objects.push(c); this.sel = c.id;
      });
      this.panel();
    }
    deleteSel() {
      if (!this.sel) return;
      const o = this.doc.obj(this.sel), name = o ? K.BuilderAppUtils.describe(o) : 'object';
      this.commitObjects('delete ' + name, (d) => { d.objects = d.objects.filter((x) => x.id !== this.sel); });
      this.sel = null; this.overlay.selection(); this.panel();
    }
    selectionPanel() {
      const o = this.sel && this.doc.obj(this.sel);
      const help = `<p class="help">Click an object to select it; drag to move (hold <kbd>Shift</kbd> for free placement). Yellow handles move wall corners and bridge ends. <kbd>Q</kbd>/<kbd>E</kbd> rotate, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, <kbd>Del</kbd> deletes. Dragging empty ground pans.</p>`;
      if (!o) return `<h2>Select</h2>${help}<h3>World</h3><div class="row"><span>Name</span><input type="text" data-k="name" value="${K.BuilderAppUtils.escapeHtml(this.doc.name)}" style="flex:1;border:1px solid #c9d1dd;border-radius:7px;padding:4px 6px"></div><p class="help">${this.doc.w} × ${this.doc.h} tiles · ${this.doc.wu} × ${this.doc.hu} units · ${this.doc.objects.length} objects · seed ${this.doc.seed}</p>`;
      let h = `<h2>${K.BuilderAppUtils.escapeHtml(K.BuilderAppUtils.describe(o))}</h2>`;
      if (o.kind === 'prop') {
        const def = PropBuilder.PROPS[o.type] || {};
        h += `<div class="row"><span>Rotation</span><input type="range" min="-3.15" max="3.15" step="0.05" value="${o.rot || 0}" data-o="rot"><span class="val">${Math.round((o.rot || 0) * 57.3)}°</span></div>`;
        h += `<div class="row"><span>Scale</span><input type="range" min="0.3" max="2.5" step="0.05" value="${o.s || 1}" data-o="s"><span class="val">${(o.s || 1).toFixed(2)}</span></div>`;
        if (def.sprite) h += `<div class="row"><span>Face left</span><input type="checkbox" data-o="flip" ${o.flip ? 'checked' : ''}></div>`;
        if (def.start) h += `<div class="row"><span>Hero</span><select data-o="hero" data-str="1">${[['warden', 'The Warden'], ['witch', 'Rime Witch']].map(([k, n]) => `<option value="${k}" ${(o.hero || 'warden') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div><p class="help">Play mode starts the player here. One per world.</p>`;
        else if (def.sprite) {
          const role = PropBuilder.roleOf(o);
          h += `<div class="row"><span>Role</span><select data-o="role" data-str="1">${[['enemy', 'Enemy'], ['npc', 'Friendly NPC'], ['merchant', 'Merchant']].map(([k, n]) => `<option value="${k}" ${role === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
          h += `<div class="row"><span>Look</span><select data-o="look" data-str="1">${this.renderer.lib.defs.map((d) => `<option value="${d.id}" ${PropBuilder.spriteOf(o) === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></div>`;
          h += `<div class="row"><span>Name</span><input type="text" data-o="name" data-str="1" value="${K.BuilderAppUtils.escapeHtml(o.name || '')}" placeholder="${K.BuilderAppUtils.escapeHtml(role === 'merchant' ? 'Merchant' : (K.BESTIARY[def.sprite] || {}).name || def.name)}" style="flex:1;border:1px solid #c9d1dd;border-radius:7px;padding:4px 6px;min-width:0"></div>`;
          h += `<p class="help">Enemies fight, friendly NPCs talk, merchants talk and trade. Their ring shows the role while editing.</p>`;
        }
        if (def.interact) h += `<p class="help">Resource node: in play mode the player can ${({ ore: 'mine it', tree: 'chop it', herb: 'gather it', fish: 'fish here' })[def.interact] || 'use it'}. It runs out and regrows.</p>`;
        h += `<div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>`;
      } else if (o.kind === 'wall') {
        h += K.EditorWallControls.wallRows(o) + `<div class="row"><span>Closed loop</span><input type="checkbox" data-o="closed" ${o.closed ? 'checked' : ''}></div><div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div><p class="help"><kbd>Alt</kbd>+click on this wall toggles a door gap. ${(o.gaps || []).length} gap(s).</p>`;
      } else if (o.kind === 'bridge') {
        h += `<div class="row"><span>Width</span><input type="range" min="1" max="3" step="0.1" value="${o.w || 1.6}" data-o="w"><span class="val">${(o.w || 1.6).toFixed(1)}</span></div><div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>
          <p class="help">Length ${Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]).toFixed(1)} units. Drag the yellow end handles to re-land it.</p>`;
      }
      h += `<div class="row" style="margin-top:10px"><button class="b" data-a="dup">Duplicate</button><button class="b" data-a="del" style="background:#f2d7d7;color:#7a1f1f">Delete</button></div>` + help;
      return h;
    }
    bindSelectionPanel(root) {
      const o = this.sel && this.doc.obj(this.sel);
      const nm = root.querySelector('[data-k=name]'); if (nm) nm.onchange = () => { this.doc.name = nm.value || 'Untitled world'; this.autosave(); };
      if (!o) return;
      let before = null;
      const live = (k, v) => {
        if (before == null) before = JSON.stringify(this.doc.objects);
        const t = this.doc.obj(o.id); t[k] = typeof v === 'number' ? r3(v) : v; if (k === 'h' && t.hs) delete t.hs; if (v === '' && (k === 'name')) delete t[k];
        this.renderer.objectsChanged(); this.overlay.selection();
      };
      const done = () => { if (before != null) { this.pushOp({ label: 'edit ' + K.BuilderAppUtils.describe(o), objs: [before, JSON.stringify(this.doc.objects)] }); before = null; } };
      root.querySelectorAll('[data-o]').forEach((el) => {
        const k = el.dataset.o;
        el.oninput = () => {
          const v = el.type === 'checkbox' ? el.checked : el.dataset.str ? el.value.trim() : +el.value; live(k, v);
          if (el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = k === 'rot' ? Math.round(v * 57.3) + '°' : (+v).toFixed(k === 's' ? 2 : 1);
        };
        el.onchange = () => { el.oninput(); done(); };
      });
      K.EditorWallControls.bindRows(root, o, done, live);
      root.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'del') this.deleteSel(); else if (a === 'dup') this.duplicateSel();
        else if (a === 'reseed') this.commitObjects('reroll', (d) => { d.obj(o.id).seed = (Math.random() * 99999) | 0; });
      }));
    }
    /* ---- tools / UI ---- */
  }
  K.BuilderAppSelection = BuilderAppSelection;
})(typeof window !== 'undefined' ? window : globalThis);
