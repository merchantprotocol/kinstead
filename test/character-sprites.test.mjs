/* Behavior regression: character sprite rasterization depends on the core RNG helper after the art split. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

class CharacterSpriteSandbox {
  constructor() {
    this.context = vm.createContext({ console, Math, Uint8Array, Int16Array, Int8Array });
    this.context.window = this.context;
    this.context.globalThis = this.context;
    for (const file of ['engine/11-core.js', 'engine/12-sprites.js', 'engine/12-sprite-characters.js']) {
      const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', file);
      vm.runInContext(fs.readFileSync(src, 'utf8'), this.context, { filename: file });
    }
  }
  get warden() { return new this.context.K.CharacterLibrary().get('warden'); }
}

// risk: game render crash after the character-art module split.
test('warden sprite sheets rasterize every authored frame', () => {
  const sheet = new CharacterSpriteSandbox().warden;
  assert.equal(sheet.frames.length, 4);
  assert.ok(sheet.frames.every((frame) => frame.data.some((pixel) => pixel !== 0)));
});
