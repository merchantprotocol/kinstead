/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;
  const UNSAVED = 'The world you are editing has unsaved changes.';

  /* wires the World Builder's top bar, modals and render toggles to the app */
  class EditorControls {
    constructor(app) { this.app = app; }
    on(id, handler) { U.byId(id).onclick = handler; }
    bind() {
      this.bindGenerate();
      this.bindNewWorld();
      this.bindFiles();
      this.bindSaveModal();
      this.bindWorldsModal();
      this.bindView();
      this.bindRendering();
      window.addEventListener('beforeunload', (e) => {
        if (this.app.dirtySince && !G.KINSTEAD_NO_UNLOAD_PROMPT) { e.preventDefault(); e.returnValue = ''; }
      });
    }
    /** true when there is nothing unsaved, or the player agreed to lose it */
    async confirmDiscard(title, text, ok) {
      return !this.app.dirtySince || this.app.ask(title, text, ok, true);
    }
    bindGenerate() {
      const sizes = K.PRESETS.map((p, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${p[0]}</option>`).join('');
      U.byId('gSize').innerHTML = sizes;
      U.byId('nSize').innerHTML = sizes;
      this.on('bGen', async () => {
        const seed = parseInt(U.byId('gSeed').value, 10);
        if (!isFinite(seed)) return;
        const preset = K.PRESETS[+U.byId('gSize').value];
        const text = `Seed ${seed} replaces the world you are editing, which has unsaved changes. Save it first if you want to keep it.`;
        if (!(await this.confirmDiscard('Generate a new world?', text, 'Generate'))) return;
        this.app.toast('Generating…');
        setTimeout(() => this.app.session.generate(seed >>> 0, preset[1], preset[2]), 30);
      });
      U.byId('gSeed').addEventListener('keydown', (e) => { if (e.key === 'Enter') U.byId('bGen').click(); e.stopPropagation(); });
    }
    bindNewWorld() {
      this.on('bNew', () => { U.byId('modal').style.display = 'flex'; });
      this.on('nCancel', () => { U.byId('modal').style.display = 'none'; });
      this.on('nOk', async () => {
        const preset = K.PRESETS[+U.byId('nSize').value];
        U.byId('modal').style.display = 'none';
        if (!(await this.confirmDiscard('Start a new world?', UNSAVED + ' Save it first if you want to keep it.', 'Start new'))) return;
        this.app.session.newBlank(preset[1], preset[2], U.byId('nName').value, +U.byId('nBase').value);
      });
    }
    bindFiles() {
      const files = this.app.files;
      this.on('bSave', () => files.saveJSON());
      this.on('bPng', () => files.exportPNG());
      this.on('bNoteDl', () => files.saveJSON());
      this.on('bSaveW', () => this.app.storage.openSave());
      this.on('bWorlds', () => this.app.storage.openWorlds());
      this.on('bPlay', () => this.app.setPlay(!this.app.play.active));
      this.on('bOpen', () => U.byId('file').click());
      U.byId('file').onchange = async () => {
        const input = U.byId('file'), file = input.files[0];
        input.value = '';
        if (!file) return;
        const text = UNSAVED + ' They will be lost unless you save it first.';
        if (!(await this.confirmDiscard('Open this file?', text, 'Open anyway'))) return;
        file.text().then((t) => this.app.loadText(t));
      };
      this.on('bUndo', () => this.app.edits.undo());
      this.on('bRedo', () => this.app.edits.redo());
    }
    bindSaveModal() {
      const close = () => U.byId('saveModal').classList.remove('show');
      this.on('svCancel', close);
      this.on('svOk', () => { close(); this.app.storage.saveWorld(U.byId('svName').value, false); });
      this.on('svCopy', () => { close(); this.app.storage.saveWorld(U.byId('svName').value, true); });
      U.byId('svName').addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') U.byId('svOk').click();
        if (e.key === 'Escape') U.byId('svCancel').click();
      });
    }
    bindWorldsModal() {
      const close = () => U.byId('worldsModal').classList.remove('show');
      this.on('wlClose', close);
      this.on('wlOpenFile', () => { close(); U.byId('file').click(); });
      this.on('wlDl', () => this.app.files.saveJSON());
      U.byId('wlList').addEventListener('click', (e) => {
        const button = e.target.closest('[data-a]'), row = e.target.closest('[data-id]');
        if (button && row) this.app.storage.worldsAction(row.dataset.id, button.dataset.a);
      });
    }
    bindView() {
      const app = this.app;
      this.on('bView', () => app.setView(app.view === 'top' ? 'orbit' : 'top'));
      this.on('bClose', () => { if (app.view === 'top') app.setView('orbit'); app.session.frameHero(false); });
      this.on('bFit', () => app.session.frameAll(false));
    }
    bindRendering() {
      const app = this.app;
      U.byId('tDof').onchange = (e) => (app.post.enabled.dof = e.target.checked);
      U.byId('tBloom').onchange = (e) => (app.post.enabled.bloom = e.target.checked);
      U.byId('tSnow').onchange = (e) => (app.renderer.snow.points.visible = e.target.checked);
      U.byId('qual').onchange = (e) => { app.quality = +e.target.value; app.resize(); };
    }
  }
  K.EditorControls = EditorControls;
})(typeof window !== 'undefined' ? window : globalThis);
