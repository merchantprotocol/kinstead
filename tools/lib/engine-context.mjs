/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Loads the DOM-free engine modules (core, textures, world, generator) into a Node VM context,
   so build tools can generate worlds and paint thumbnails with the exact code the game runs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export class EngineContext {
  static HEADLESS_MODULES = ['11-core.js', '13-textures.js', '20-world.js', '50-gen.js'];

  constructor(engineDir) {
    this.engineDir = engineDir;
    this.sandbox = { console, Math, Date, JSON, btoa, atob, Uint8Array, Uint8ClampedArray, Float32Array, Int16Array, Int8Array, Uint16Array };
    this.sandbox.globalThis = this.sandbox;
    vm.createContext(this.sandbox);
    for (const f of EngineContext.HEADLESS_MODULES) {
      vm.runInContext(fs.readFileSync(path.join(engineDir, f), 'utf8'), this.sandbox, { filename: f });
    }
  }

  get K() { return this.sandbox.K; }
}
