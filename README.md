<!-- Copyright (c) 2026 Merchant Protocol. All rights reserved. -->
# Kinstead

Build a hand-painted diorama world, then walk into it and play. Kinstead is a static site: plain
JavaScript and Three.js, built with esbuild, no framework and no server.

## Run it

```sh
npm install
npm run dev      # builds dist/ and serves it at http://127.0.0.1:8000/, rebuilding when sources change
npm run build    # builds the static site into dist/
```

Open `index.html` from the served site. Pages need to be served over http(s): the menu loads the
prebuilt worlds with `fetch`, and "My worlds" lives in the browser's IndexedDB.

| Page | What it is |
|------|------------|
| `index.html` | Start menu. The first prebuilt world renders behind it as a slowly orbiting title scene. Continue (last play session), Play a world, World Builder, Settings. |
| `builder.html` | The world builder. `builder.html?world=<id>` opens a world for editing. |
| `play.html?world=<id>` | Plays a world. `<id>` is a prebuilt world id, `my:<saved id>` for a world in My worlds, or `continue` for the last session. |

Settings (quality Sharp / Balanced / Fast, depth of field, bloom) are kept in `localStorage` and
apply on every page. Play progress is saved to the Continue slot every 15 seconds and when you leave.

## Layout

```
src/engine/        engine modules, concatenated in a fixed order (see tools/build.mjs)
  ui.html, ui.css  builder/play markup and styles
src/vendor/three/  Three.js r170 (MIT, see LICENSE), loaded as a classic script that sets window.THREE
src/app/           start menu, routing, settings, world catalogue, page bootstraps, shell styles
  pages/           HTML templates for index.html, builder.html, play.html
worlds/            prebuilt .world.json files, thumbs/, and index.json (the menu's manifest)
public/            copied as-is to the site root
tools/build.mjs    the build (esbuild)
tools/make-worlds.mjs  regenerates the seeded worlds, thumbnails and worlds/index.json
```

### Engine build notes

- Engine modules are classic scripts that share the global `K` namespace; order matters and is listed
  in `EngineManifest` in `tools/build.mjs`.
- `11-core.js`, `13-textures.js` and `20-world.js` are wrapped in `function KPaintModules() { ... }`.
  The ground-painting Web Workers are started from that function's own source text
  (`PaintPool` in `30-render.js`), so these three modules must stay free of DOM and THREE use.
- esbuild only strips whitespace and simplifies syntax (no renaming), so function and class names survive.

### Prebuilt worlds

`worlds/index.json` lists each world: `id`, `name`, `description`, `file`, `thumbnail`, `size`
(and `seed` for generated ones). `npm run worlds` regenerates the seeded worlds and redraws every
thumbnail with the game's own ground painter. To add a hand-built world, drop its `.world.json` into
`worlds/` and add an entry to `CATALOGUE` in `tools/make-worlds.mjs`.

## Deploy

`wrangler.toml` configures the Cloudflare Pages project `kinstead` with `pages_build_output_dir = "dist"`.
Run `npm run build`, then `npx wrangler pages deploy`.

## Licence

Copyright (c) 2026 Merchant Protocol. All rights reserved. Three.js is MIT-licensed; its notice is in
`src/vendor/three/LICENSE` and ships as `dist/assets/three.LICENSE.txt`.
