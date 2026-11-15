/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;
  const TOOLBAR = [
    ['select', '⬚', 'Select', 'V'], null,
    ['paint', '▦', 'Terrain', 'T'], ['height', '⛰', 'Height', 'H'], ['carve', '⌇', 'Chasm', 'C'], null,
    ['wall', '▤', 'Wall', 'W'], ['room', '▣', 'Room', 'R'], ['bridge', '⊟', 'Bridge', 'J'], ['prop', '✱', 'Props', 'P'],
  ];

  /* the editor chrome: toolbar, inspector panel, status line, toasts, confirm dialog, play and view toggles */
  class EditorUI {
    constructor(app) { this.app = app; this.toastTimer = null; this.askDone = null; this.savedOrbit = null; }
    buildToolbar() {
      const root = U.byId('tools');
      root.innerHTML = TOOLBAR.map((t) => (t
        ? `<button data-tool="${t[0]}" title="${t[2]} (${t[3]})"><span class="ic">${t[1]}</span>${t[2]}<span class="k">${t[3]}</span></button>`
        : '<div class="grp"></div>')).join('');
      if (this.app.interiors) this.app.interiors.addToolbarButtons(root);
      root.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => this.app.setTool(b.dataset.tool)));
    }
    setTool(name) {
      const app = this.app;
      if (app.tool) app.tool.cancel();
      app.toolName = name;
      app.tool = app.tools[name];
      U.byId('tools').querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === name));
      app.renderer3.domElement.style.cursor = app.tool.cursor();
      app.overlay.brush(null);
      app.overlay.poly([], false);
      app.overlay.hoverObj(null);
      this.panel();
    }
    panel() {
      const app = this.app;
      if (!app.tool || !app.doc) return;
      const root = U.byId('insp');
      root.innerHTML = app.tool.options();
      app.tool.bind(root);
    }
    status(text) { U.byId('sInfo').textContent = text || ''; }
    toast(text) {
      const el = U.byId('toast');
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    }
    ask(title, text, ok = 'OK', danger = false) {
      return new Promise((resolve) => {
        U.byId('askTitle').textContent = title;
        U.byId('askText').textContent = text;
        const yes = U.byId('askYes');
        yes.textContent = ok;
        yes.className = 'b ' + (danger ? 'danger' : 'pri');
        const modal = U.byId('askModal');
        modal.classList.add('show');
        const done = (value) => { modal.classList.remove('show'); this.askDone = null; resolve(value); };
        this.askDone = done;
        yes.onclick = () => done(true);
        U.byId('askNo').onclick = () => done(false);
      });
    }
    /** Escape on an open dialog: answers a pending ask with "no", or just closes any other modal */
    closeModal(open) {
      if (open.id === 'askModal' && this.askDone) this.askDone(false);
      else open.classList.remove('show');
    }
    setPlay(on) {
      const app = this.app;
      if (on === app.play.active) return;
      if (on && app.interiors) app.interiors.leave();
      if (on) app.play.enter(); else app.play.exit();
      const b = U.byId('bPlay');
      b.textContent = on ? '■ Stop playing' : '▶ Play';
      b.classList.toggle('on', on);
      b.title = on ? 'Back to editing (G)' : 'Play this world (G)';
      if (!on) this.panel();
    }
    setView(view) {
      const app = this.app, goal = app.rig.goal;
      app.view = view;
      U.byId('bView').textContent = view === 'top' ? 'Orbit' : 'Top-down';
      if (view === 'top') {
        this.savedOrbit = { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist };
        app.rig.set({ pitch: 1.53, yaw: 0, dist: Math.max(goal.dist, 18) });
      } else app.rig.set(this.savedOrbit || { pitch: 0.7, yaw: -0.2 });
    }
    showHover(p) {
      if (!p) { U.byId('sHover').textContent = '—'; return; }
      const doc = this.app.doc, [i, j] = doc.tileOf(p.x, p.z), t = K.TERRAINS[doc.type(i, j)];
      U.byId('sHover').innerHTML = `tile <b>${i}, ${j}</b> · ${t ? t.name : '?'} · height <b>${doc.hy(i, j)}</b>`;
    }
  }
  K.EditorUI = EditorUI;
})(typeof window !== 'undefined' ? window : globalThis);
