/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · page bootstraps. Each HTML page calls K.Pages.boot('<menu|builder|play>') once the window loads. */
(function (G) {
  const K = (G.K = G.K || {});

  /* shared services for one page, built once: settings, router, storage, catalog */
  class PageServices {
    constructor() {
      this.settings = K.Settings.open();
      this.router = new K.Router(G.location);
      this.store = K.WorldStore.create().catch((e) => { console.warn('world storage unavailable', e); return null; });
      this.slot = new K.ContinueSlot(this.store);
      this.catalog = new K.WorldCatalog({ fetchFn: (u, o) => G.fetch(u, o), store: this.store, slot: this.slot });
    }
  }

  class MenuPage {
    constructor(services) { this.s = services; }
    async start() {
      const s = this.s;
      try { this.scene = new K.TitleScene(document.getElementById('stage'), s.settings).start(); } catch (e) { console.warn('title scene unavailable (no WebGL?)', e); }
      this.menu = new K.MainMenu({ doc: document, router: s.router, catalog: s.catalog, slot: s.slot, settings: s.settings, onSettings: () => this.scene && this.scene.applySettings() });
      await Promise.all([this.menu.init(), this.loadBackdrop()]);
      return this;
    }
    async loadBackdrop() {
      if (!this.scene) { MenuPage.hideLoading(); return; }
      let doc = null;
      try { const first = (await this.s.catalog.prebuilt())[0]; if (first) doc = K.WorldDoc.fromJSON(JSON.parse((await this.s.catalog.open(first.id)).text)); }
      catch (e) { console.warn('title world not loaded; generating one', e.message); }
      if (!doc) doc = new K.WorldGenerator(4242).generate(64, 48);
      this.scene.setDoc(doc); MenuPage.hideLoading();
    }
    static hideLoading() { const l = document.getElementById('loading'); if (l) l.remove(); }
  }

  /* builder.html and play.html both run K.BuilderApp; play.html locks it into play mode */
  class AppPage {
    constructor(services) { this.s = services; }
    makeApp() {
      this.s.settings.applyToControls(document);
      const app = (G.app = new K.BuilderApp().start());
      this.s.settings.applyToApp(app);
      const keep = (id, k, read) => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => this.s.settings.set({ [k]: read(el) })); };
      keep('qual', 'quality', (el) => el.value); keep('tDof', 'dof', (el) => el.checked); keep('tBloom', 'bloom', (el) => el.checked);
      return app;
    }
    addBackButton(beforeLeave) {
      const b = document.createElement('button'); b.className = 'b back keep'; b.id = 'bMenu'; b.textContent = '← Menu'; b.title = 'Back to the start menu';
      b.onclick = async () => { if (beforeLeave && !(await beforeLeave())) return; G.KINSTEAD_NO_UNLOAD_PROMPT = true; this.s.router.go('menu'); };
      const top = document.getElementById('top'); top.insertBefore(b, top.firstChild); return b;
    }
    fail(msg) {
      const m = document.createElement('div'); m.className = 'mdl show'; m.id = 'failModal';
      m.innerHTML = '<div class="pnl"><h2>Could not open this world</h2><p></p><div class="acts"><button class="b pri">Back to menu</button></div></div>';
      m.querySelector('p').textContent = msg; m.querySelector('button').onclick = () => { G.KINSTEAD_NO_UNLOAD_PROMPT = true; this.s.router.go('menu'); };
      document.body.appendChild(m);
    }
  }

  class BuilderPage extends AppPage {
    async start() {
      const app = (this.app = this.makeApp());
      this.addBackButton(async () => !app.dirtySince || app.ask('Leave the World Builder?', 'This world has unsaved changes. They will be lost unless you save it first.', 'Leave', true));
      const id = this.s.router.param('world');
      if (id) {
        try {
          const w = await this.s.catalog.open(id);
          if (app.loadText(w.text) && id.startsWith('my:')) { app.savedId = id.slice(3); app.dirtySince = false; app.updateDirty(); }
        } catch (e) { app.toast('Could not open that world: ' + e.message); }
      }
      return this;
    }
  }

  class PlayPage extends AppPage {
    static SAVE_EVERY_MS = 15000;
    async start() {
      document.body.classList.add('play-only'); G.KINSTEAD_NO_UNLOAD_PROMPT = true;
      const app = (this.app = this.makeApp());
      const castleMode = (this.s.router.param('mode') || G.KINSTEAD_PLAY_MODE) === 'castle';
      if (castleMode) return this.startCastle(app);   // the game has no Menu button: Esc leaves
      this.addBackButton(async () => { await this.saveProgress(); return true; });   // KINSTEAD_PLAY_MODE: embedders without a query string
      const id = this.s.router.param('world');
      if (!id) { this.fail('No world was chosen. Pick one from the menu.'); return this; }
      let w;
      try { w = await this.s.catalog.open(id); } catch (e) { this.fail(e.message); return this; }
      if (!app.loadText(w.text)) { this.fail('The world file could not be read.'); return this; }
      this.world = { id: w.id, name: w.name || app.doc.name };
      const setPlay = app.setPlay.bind(app); setPlay(true);
      app.setPlay = (on) => { if (on) setPlay(true); }; // play.html never drops into the editor
      this.timer = setInterval(() => this.saveProgress(), PlayPage.SAVE_EVERY_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.saveProgress(); });
      G.addEventListener('pagehide', () => this.saveProgress());
      return this;
    }
    /* Castle mode (the v1.1 story): a built-in castle world with K.CastleGame layered on play; saves to localStorage */
    startCastle(app) {
      app.setDoc(new K.HutWorldBuilder().build()); app.dirtySince = false;
      this.castle = app.play.ext = new K.CastleGame(app.play, { resume: this.s.router.param('resume') === '1' || !!G.KINSTEAD_RESUME });
      const setPlay = app.setPlay.bind(app); setPlay(true);
      app.setPlay = (on) => { if (on) setPlay(true); };
      document.title = 'Kinstead';
      this.castle.onLeave = () => { this.castle.save(); G.KINSTEAD_NO_UNLOAD_PROMPT = true; this.s.router.go('menu'); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.castle.save(); });
      G.addEventListener('pagehide', () => this.castle.save());
      return this;
    }
    /* the Continue slot: the world with this character's progress (doc.game) */
    async saveProgress() {
      if (this.castle) { this.castle.save(); return null; }
      if (!this.world || !this.app.play.active) return null;
      try { return await this.s.slot.save({ worldId: this.world.id, name: this.world.name, json: this.app.serialize() }); }
      catch (e) { console.warn('could not save progress', e); return null; }
    }
  }

  const Pages = {
    PageServices, MenuPage, BuilderPage, PlayPage,
    boot(kind) {
      const Page = { menu: MenuPage, builder: BuilderPage, play: PlayPage }[kind];
      let started = false;
      const go = () => {
        if (started) return; started = true;
        try { G.page = new Page(new PageServices()); G.pageReady = G.page.start().catch((e) => { console.error(e && e.stack || e); }); }
        catch (e) { console.error(e && e.stack || e); const l = document.getElementById('loading'); if (l) l.textContent = 'Error: ' + e.message; }
      };
      if (document.readyState === 'complete') setTimeout(go, 30); else G.addEventListener('load', () => setTimeout(go, 30));
      setTimeout(go, 1500);
    },
  };
  K.Pages = Pages;
})(typeof window !== 'undefined' ? window : globalThis);
