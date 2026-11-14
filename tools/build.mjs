/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead static site build.
     node tools/build.mjs            -> dist/ (index.html, builder.html, play.html, assets/, worlds/)
     node tools/build.mjs --single   -> also inline every script and stylesheet into each page (offline/test copy)
     node tools/build.mjs --serve    -> build, then serve dist/ with esbuild and rebuild when sources change
   The engine is plain classic scripts sharing the global K namespace, concatenated in a fixed order.
   The ground-painting modules are wrapped in function KPaintModules() so the paint Web Workers can be
   started from that function's own source text (see PaintPool in src/engine/30-render.js). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class EngineManifest {
  /* run on the main thread AND (from this same source text) inside every paint worker; must stay DOM- and THREE-free */
  static PAINT = ['11-core.js', '13-textures.js', '20-world.js'];
  /* main thread only, in dependency order (buildings need THREE, K.TexturePainter and K.WorldDoc) */
  static MAIN = [
    '12-sprites.js', '14-post.js', '30-render.js',
    '65-voxkit3d.js', '66-characters3d.js', '67-actor3d.js',   // 3D voxel characters; play picks the view class via K.ActorViews
    '70-building-tex.js', '71-building-data.js', '72-voxkit.js', '73-furniture.js', '74-recipes.js', '75-building-mesh.js', '76-interactions.js', '77-building-edit.js',
    '@castle-data', '80-castle-rules.js',
    '50-gen.js', '55-store.js', '56-items.js', '57-actors.js', '58-nav.js', '59-interact.js', '78-building-game.js', '62-playui.js', '63-play.js', '60-app.js', '79-building-ui.js',
    '81-castle-world.js', '82-castle-mesh.js', '83-castle-game.js', '84-castle-ui.js',
  ];
  /* game data inlined as K.CASTLE_DATA (src/data is the single source; tests read the same file) */
  static DATA = { '@castle-data': ['data/game-data-castle.json', 'CASTLE_DATA'] };
  static APP = ['settings.js', 'router.js', 'catalog.js', 'title-scene.js', 'menu.js', 'pages.js'];
}

class SiteBuilder {
  constructor(root, opts = {}) {
    this.root = root; this.opts = opts;
    this.src = path.join(root, 'src'); this.dist = path.join(root, 'dist');
  }
  read(rel) { return fs.readFileSync(path.join(this.src, rel), 'utf8'); }

  engineSource() {
    const part = (f) => {
      const d = EngineManifest.DATA[f];
      if (d) return `/* ---- ${d[0]} ---- */\n(function (G) { (G.K = G.K || {}).${d[1]} = ${JSON.stringify(JSON.parse(this.read(d[0])))}; })(typeof window !== 'undefined' ? window : globalThis);`;
      return `/* ---- ${f} ---- */\n` + this.read('engine/' + f);
    };
    return [
      '/* Ground-painting modules: run here and, from this same source text, inside the paint workers. */',
      'function KPaintModules() {', ...EngineManifest.PAINT.map(part), '}', 'KPaintModules();',
      ...EngineManifest.MAIN.map(part),
    ].join('\n');
  }
  appSource() { return EngineManifest.APP.map((f) => `/* ---- ${f} ---- */\n` + this.read('app/' + f)).join('\n'); }

  /* whitespace + syntax only: names are kept, so KPaintModules.toString() and class names stay intact */
  async minify(code, loader = 'js') {
    const r = await esbuild.transform(code, { loader, minifyWhitespace: true, minifySyntax: loader === 'js', target: loader === 'js' ? 'es2020' : undefined, charset: 'utf8', legalComments: 'inline' });
    return r.code;
  }

  async assets() {
    const out = {
      'three.min.js': this.read('vendor/three/three.min.js'),
      'engine.js': await this.minify(this.engineSource()),
      'app.js': await this.minify(this.appSource()),
      'ui.css': await this.minify(this.read('engine/ui.css'), 'css'),
      'shell.css': await this.minify(this.read('app/shell.css'), 'css'),
    };
    this.versions = {};
    for (const [name, text] of Object.entries(out)) this.versions[name] = crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
    return out;
  }

  /* page template tokens: <!-- @ui --> (the shared builder/play markup), {{asset:name}} (versioned asset URL) */
  page(name, assets) {
    let html = this.read('app/pages/' + name)
      .replace('<!-- @ui -->', () => this.read('engine/ui.html').replace(/\s*$/, ''))
      .replace(/\{\{asset:([\w.-]+)\}\}/g, (_, a) => { if (!assets[a]) throw new Error(`${name}: unknown asset ${a}`); return `assets/${a}?v=${this.versions[a]}`; });
    if (this.opts.single) html = this.inline(html, assets);
    return html;
  }
  inline(html, assets) {
    const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
    return html
      .replace(/<script src="assets\/([\w.-]+)\?v=\w+"><\/script>/g, (_, a) => `<script>${safe(assets[a])}</script>`)
      .replace(/<link rel="stylesheet" href="assets\/([\w.-]+)\?v=\w+">/g, (_, a) => `<style>${assets[a]}</style>`);
  }

  copyDir(from, to) { if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true }); }

  async build() {
    const t0 = Date.now();
    fs.rmSync(this.dist, { recursive: true, force: true }); fs.mkdirSync(path.join(this.dist, 'assets'), { recursive: true });
    const assets = await this.assets();
    for (const [n, text] of Object.entries(assets)) fs.writeFileSync(path.join(this.dist, 'assets', n), text);
    fs.copyFileSync(path.join(this.src, 'vendor/three/LICENSE'), path.join(this.dist, 'assets/three.LICENSE.txt'));
    for (const p of ['index.html', 'builder.html', 'play.html']) fs.writeFileSync(path.join(this.dist, p), this.page(p, assets));
    this.copyDir(path.join(this.root, 'worlds'), path.join(this.dist, 'worlds'));
    this.copyDir(path.join(this.root, 'public'), this.dist);
    const kb = (n) => (fs.statSync(path.join(this.dist, n)).size / 1024).toFixed(0) + ' KB';
    console.log(`built dist/ in ${Date.now() - t0} ms · engine.js ${kb('assets/engine.js')} · app.js ${kb('assets/app.js')} · index.html ${kb('index.html')}`);
  }

  async serve(port) {
    await this.build();
    const ctx = await esbuild.context({});
    const { host, port: p } = await ctx.serve({ servedir: this.dist, port, host: '127.0.0.1' });
    console.log(`serving dist/ at http://${host}:${p}/  (rebuilds when src/, worlds/ or public/ change)`);
    let timer = null;
    const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => this.build().catch((e) => console.error(e.message)), 120); };
    for (const d of ['src', 'worlds', 'public']) fs.watch(path.join(this.root, d), { recursive: true }, rebuild);
  }
}

const args = process.argv.slice(2);
const builder = new SiteBuilder(ROOT, { single: args.includes('--single') });
const portArg = args.find((a) => a.startsWith('--port='));
(args.includes('--serve') ? builder.serve(portArg ? +portArg.slice(7) : 8000) : builder.build()).catch((e) => { console.error(e); process.exit(1); });
