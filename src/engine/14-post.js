/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead 2D-HD diorama: custom post pipeline — HDR scene RT -> bloom (dual-filter chain)
   -> depth-driven tilt-shift DOF (golden-angle gather) -> grade, vignette, grain, sRGB. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
  class PostPipeline {
    constructor(renderer) {
      this.r = renderer; this.enabled = { dof: true, bloom: true };
      this.focus = 20; this.band = 3; this.range = 7; this.maxBlur = 9; this.bloomStrength = 0.75;
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.qs = new THREE.Scene(); this.qs.add(this.quad);
      this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quad.frustumCulled = false;
      const mk = (fs, uni) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: uni, depthTest: false, depthWrite: false });
      this.mBright = mk(`uniform sampler2D tex; uniform float thr; varying vec2 vUv;
        void main(){ vec3 c=texture2D(tex,vUv).rgb; float l=max(c.r,max(c.g,c.b)); float k=clamp((l-thr)/(l+1e-4),0.0,1.0); gl_FragColor=vec4(c*k,1.0);} `, { tex: { value: null }, thr: { value: 0.9 } });
      this.mDown = mk(`uniform sampler2D tex; uniform vec2 px; varying vec2 vUv;
        void main(){ vec3 s=texture2D(tex,vUv).rgb*4.0; s+=texture2D(tex,vUv+vec2(-px.x,-px.y)).rgb; s+=texture2D(tex,vUv+vec2(px.x,-px.y)).rgb; s+=texture2D(tex,vUv+vec2(-px.x,px.y)).rgb; s+=texture2D(tex,vUv+vec2(px.x,px.y)).rgb; gl_FragColor=vec4(s/8.0,1.0);} `, { tex: { value: null }, px: { value: new THREE.Vector2() } });
      this.mUp = mk(`uniform sampler2D tex; uniform sampler2D base; uniform vec2 px; varying vec2 vUv;
        void main(){ vec3 s=vec3(0.0);
          s+=texture2D(tex,vUv+vec2(-px.x*2.0,0.0)).rgb; s+=texture2D(tex,vUv+vec2(px.x*2.0,0.0)).rgb; s+=texture2D(tex,vUv+vec2(0.0,-px.y*2.0)).rgb; s+=texture2D(tex,vUv+vec2(0.0,px.y*2.0)).rgb;
          s+=texture2D(tex,vUv+vec2(-px.x,px.y)).rgb*2.0; s+=texture2D(tex,vUv+vec2(px.x,px.y)).rgb*2.0; s+=texture2D(tex,vUv+vec2(-px.x,-px.y)).rgb*2.0; s+=texture2D(tex,vUv+vec2(px.x,-px.y)).rgb*2.0;
          gl_FragColor=vec4(s/12.0+texture2D(base,vUv).rgb,1.0);} `, { tex: { value: null }, base: { value: null }, px: { value: new THREE.Vector2() } });
      this.mCoc = mk(`uniform sampler2D tDepth; uniform float near; uniform float far; uniform float focus; uniform float band; uniform float range; uniform float maxBlur; varying vec2 vUv;
        void main(){ float d=texture2D(tDepth,vUv).x; float z=(near*far)/(far-d*(far-near));
          float c=clamp((abs(z-focus)-band)/range,0.0,1.0); c=c*c*(3.0-2.0*c); if(d>=1.0) c=1.0;
          gl_FragColor=vec4(c*maxBlur, z<focus?1.0:0.0, 0.0, 1.0);} `,
        { tDepth: { value: null }, near: { value: 1 }, far: { value: 200 }, focus: { value: 20 }, band: { value: 3 }, range: { value: 7 }, maxBlur: { value: 9 } });
      this.mDof = mk(`uniform sampler2D tex; uniform sampler2D tCoc; uniform vec2 px; varying vec2 vUv;
        void main(){ vec2 cc=texture2D(tCoc,vUv).xy; float r0=cc.x; vec3 col=texture2D(tex,vUv).rgb;
          if(r0<0.5){ gl_FragColor=vec4(col,1.0); return; }
          vec3 acc=col; float wsum=1.0; const float GA=2.39996323;
          for(int i=1;i<64;i++){ float fi=float(i); float rr=sqrt(fi/64.0)*r0; float a=fi*GA; vec2 o=vec2(cos(a),sin(a))*rr*px;
            vec2 sc=texture2D(tCoc,vUv+o).xy; vec3 s=texture2D(tex,vUv+o).rgb;
            float w = sc.y>0.5 ? 1.0 : clamp(sc.x - rr + 1.0, 0.0, 1.0);
            acc+=s*w; wsum+=w; }
          gl_FragColor=vec4(acc/wsum,1.0);} `, { tex: { value: null }, tCoc: { value: null }, px: { value: new THREE.Vector2() } });
      this.mFinal = mk(`uniform sampler2D tex; uniform sampler2D bloom; uniform float bloomK; uniform float time; uniform vec2 res; uniform float exposure; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(0.0031308,c)); }
        void main(){ vec3 c=texture2D(tex,vUv).rgb + texture2D(bloom,vUv).rgb*bloomK;
          c*=exposure; c=aces(c);
          float l=dot(c,vec3(0.299,0.587,0.114));
          c = mix(c, c*vec3(0.86,0.95,1.12), (1.0-smoothstep(0.0,0.45,l))*0.55);   // cool shadows
          c = mix(c, c*vec3(1.08,1.0,0.9), smoothstep(0.5,1.0,l)*0.35);            // warm highlights
          vec2 q=vUv-0.5; q.x*=res.x/res.y; float v=smoothstep(1.05,0.32,length(q)); c*=mix(0.42,1.0,v);
          c=toSRGB(c);
          c+= (h(vUv*res+fract(time)*vec2(37.0,91.0))-0.5)*0.035;
          gl_FragColor=vec4(c,1.0);} `,
        { tex: { value: null }, bloom: { value: null }, bloomK: { value: 0.75 }, time: { value: 0 }, res: { value: new THREE.Vector2() }, exposure: { value: 1.0 } });
      this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); this.black.needsUpdate = true;
      this.setSize(16, 16);
    }
    rt(w, h, depth = false, samples = 0) {
      const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples });
      if (depth) { t.depthTexture = new THREE.DepthTexture(w, h); t.depthTexture.type = THREE.UnsignedIntType; }
      return t;
    }
    setSize(w, h) {
      [this.scn, this.coc, this.dof, ...(this.levels || []), ...(this.ups || [])].forEach((t) => t && t.dispose());
      this.w = w; this.h = h;
      this.scn = this.rt(w, h, true, 4); this.coc = this.rt(w, h); this.dof = this.rt(w, h);
      this.levels = []; this.ups = [];
      let lw = w >> 1, lh = h >> 1;
      for (let i = 0; i < 6; i++) { this.levels.push(this.rt(Math.max(1, lw), Math.max(1, lh))); this.ups.push(this.rt(Math.max(1, lw), Math.max(1, lh))); lw >>= 1; lh >>= 1; }
    }
    pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
    render(scene, camera, t) {
      const r = this.r;
      r.setRenderTarget(this.scn); r.render(scene, camera);
      let color = this.scn.texture;
      if (this.enabled.dof) {
        const u = this.mCoc.uniforms; u.tDepth.value = this.scn.depthTexture; u.near.value = camera.near; u.far.value = camera.far;
        u.focus.value = this.focus; u.band.value = this.band; u.range.value = this.range; u.maxBlur.value = this.maxBlur * (this.h / 900);
        this.pass(this.mCoc, this.coc);
        const d = this.mDof.uniforms; d.tex.value = color; d.tCoc.value = this.coc.texture; d.px.value.set(1 / this.w, 1 / this.h);
        this.pass(this.mDof, this.dof); color = this.dof.texture;
      }
      let bloomTex = this.black;
      if (this.enabled.bloom) {
        this.mBright.uniforms.tex.value = color; this.pass(this.mBright, this.levels[0]);
        for (let i = 1; i < this.levels.length; i++) { const s = this.levels[i - 1]; this.mDown.uniforms.tex.value = s.texture; this.mDown.uniforms.px.value.set(1 / s.width, 1 / s.height); this.pass(this.mDown, this.levels[i]); }
        let src = this.levels[this.levels.length - 1];
        for (let i = this.levels.length - 2; i >= 0; i--) { const u = this.mUp.uniforms; u.tex.value = src.texture; u.base.value = this.levels[i].texture; u.px.value.set(1 / src.width, 1 / src.height); this.pass(this.mUp, this.ups[i]); src = this.ups[i]; }
        bloomTex = src.texture;
      }
      const f = this.mFinal.uniforms; f.tex.value = color; f.bloom.value = bloomTex; f.bloomK.value = this.bloomStrength / 6; f.time.value = t; f.res.value.set(this.w, this.h);
      this.pass(this.mFinal, null);
    }
  }
  K.PostPipeline = PostPipeline;
})(typeof window !== 'undefined' ? window : globalThis);
