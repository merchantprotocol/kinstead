/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  /* the world's shared materials and textures: terrain cliffs, props, resources, the fire sheet and the sparkle top shader */
  class WorldMaterials {
    constructor(painter, bank) {
      this.painter = painter;
      this.bank = bank;
      this.sparkUni = { uTime: { value: 0 } };
      this.mats = this.build();
      this.fireSheet = this.buildFireSheet();
      this.fireTex = bank.pixel(this.fireSheet, { mips: false, flipY: true });
    }
    /* tiny dithered noise texture from a ramp (resource materials) */
    static pattern(pal, seed, spread) {
      const b = new K.PixelBuffer(16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) b.set(x, y, K.rampPick(pal, 0.5 + (K.hash2(x >> 1, y >> 1, seed) - 0.5) * spread * 2, x, y, 0.6));
      }
      return b;
    }
    lambert(map, options = {}) { return new THREE.MeshLambertMaterial(Object.assign({ map }, options)); }
    noise(colors, seed, spread) { return this.bank.pixel(WorldMaterials.pattern(K.ramp(...colors), seed, spread)); }
    build() {
      const P = this.painter, B = this.bank, lam = (t, o) => this.lambert(t, o);
      const cliffTex = B.pixel(P.cliff(false), { repeat: true }), rockTex = B.pixel(P.cliff(true), { repeat: true });
      cliffTex.wrapT = rockTex.wrapT = THREE.ClampToEdgeWrapping;
      const stoneTex = B.pixel(P.stoneAtlas()), flat = { flatShading: true }, cutout = { alphaTest: 0.5, side: THREE.DoubleSide };
      const sprite = { mips: false, flipY: true };
      return {
        cliff: lam(cliffTex), rock: lam(rockTex), stone: lam(stoneTex), snow: lam(B.pixel(P.snowCap())),
        deck: lam(B.pixel(P.deck(), { repeat: true })), wood: lam(B.pixel(P.planks(32, 32))), crate: lam(B.pixel(P.planks(16, 16, true))),
        bark: lam(B.pixel(P.bark(), { repeat: true })), iron: lam(B.pixel(P.iron())),
        pine: lam(B.pixel(P.pine(), { repeat: true }), flat), boulder: lam(stoneTex, flat),
        fern: lam(B.pixel(P.fern(), sprite), cutout),
        banner: lam(B.pixel(P.banner(), sprite), cutout),
        hole: lam(this.noise(['#050b14', '#0b1a2a', '#10263c', '#1d4566', '#3a7499'], 21, 0.35)),
        ore: lam(this.noise(['#3a1a0a', '#7a3a14', '#b0602a', '#e09a4a', '#ffd08a'], 22, 0.6), flat),
        leaf: lam(this.noise(['#10241a', '#1f4a2c', '#2f6a3c', '#4a8a50', '#9fd0b8'], 23, 0.55), flat),
      };
    }
    buildFireSheet() {
      const sheet = new K.PixelBuffer(16 * 4, 24);
      this.painter.fire().forEach((frame, i) => sheet.blit(frame, i * 16, 0));
      return sheet;
    }
    /* terrain top material with twinkling snow sparkles driven by sparkUni.uTime */
    makeTopMaterial(tex, stex) {
      const m = new THREE.MeshLambertMaterial({ map: tex });
      const su = this.sparkUni;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = su.uTime;
        sh.uniforms.sparkMap = { value: stex };
        sh.fragmentShader = 'uniform float uTime; uniform sampler2D sparkMap;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           vec4 spk = texture2D(sparkMap, vMapUv);
           float tw = spk.r * pow(max(0.0, sin(uTime*1.7 + spk.g*40.0 + (cameraPosition.x*0.9 + cameraPosition.z*0.6)*2.5)), 30.0);
           totalEmissiveRadiance += vec3(0.85,0.95,1.0) * tw * 4.0;`);
      };
      m.customProgramCacheKey = () => 'kinstead-top';
      return m;
    }
  }
  K.WorldMaterials = WorldMaterials;
})(typeof window !== 'undefined' ? window : globalThis);
