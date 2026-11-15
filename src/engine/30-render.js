/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · renderer: builds the diorama scene FROM the World document, chunk by chunk. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  class TextureBank {
    static CH = 32;
    static PPU = 32;
    constructor(renderer) { this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
    canvasOf(buf) {
      const c = document.createElement('canvas'); c.width = buf.w; c.height = buf.h;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h), 0, 0);
      return c;
    }
    texOf(canvas, { srgb = true, mips = true } = {}) {
      const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter;
      t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter; t.generateMipmaps = mips; t.flipY = false; t.anisotropy = this.aniso;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
    }
    pixel(buf, { repeat = false, srgb = true, mips = true, flipY = false } = {}) {
      const t = new THREE.CanvasTexture(this.canvasOf(buf));
      t.magFilter = THREE.NearestFilter;
      t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
      t.generateMipmaps = mips; t.flipY = flipY; t.anisotropy = this.aniso;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    }
  }



  /* the diorama's PropBuilder, made placeable: every piece goes through put(), which applies an optional local->world transform */
  Object.assign(K, { CH: TextureBank.CH, PPU: TextureBank.PPU, TextureBank });
})(typeof window !== 'undefined' ? window : globalThis);
