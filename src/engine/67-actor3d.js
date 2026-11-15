/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · 3D voxel actors in play. Plugs into the ActorView seam (57-actors.js) without changing it:
   play mode asks K.ActorViews.classFor(spriteId) which view class to build. The heroes (warden/hero =
   knight, ranger, witch = mage) and the troll are drawn as rigged voxel models (65-voxkit3d.js +
   66-characters3d.js) that face their movement direction and turn smoothly; every other sprite id keeps
   the billboard path, so an outfit change can move an actor between the two at any time.

   This module loads before 57-actors.js (see tools/build.mjs), so the VoxelActorView subclass is defined
   lazily, the first time play mode asks for a view class.

   No "Characters" set toggle here: the flat HD cutout sets (Voxel HD flat / Painted HD) are not in this
   repo, so 3D voxel is simply the default. The Orbit demo sits behind a small camera button in play. */
(function (G) {
  const K = (G.K = G.K || {}), KV = G.KV, THREE = G.THREE;

  /* which voxel model a sprite id is drawn with */
  class VoxelRoles {
    static ROLE_OF = { warden: 'knight', hero: 'knight', knight: 'knight', ranger: 'ranger', witch: 'mage', mage: 'mage', troll: 'troll',
      // town workers (66-characters3d.js WorkerSculptor): each sprite id is its own outfitted human
      cook: 'cook', smith: 'smith', clerk: 'clerk', farmer: 'farmer', woodcutter: 'woodcutter', quarryman: 'quarryman', archer: 'archer',
      stablehand: 'stablehand', storekeeper: 'storekeeper', henwife: 'henwife', cowherd: 'cowherd', baker: 'baker', butcher: 'butcher', alchemist: 'alchemist' };
    static of(spriteId) { return VoxelRoles.ROLE_OF[spriteId] || null; }
    static WIDTH = { troll: 2.1, wolf: 1.35, bear: 1.9 };       // footprint used for picking
    static SHADOW = { troll: 0.62, wolf: 0.9, bear: 1.0 };      // contact-shadow size (x model height)
  }

  /* one shared, lazily built model per role (geometry is shared by every actor wearing it) */
  class VoxelModelCache {
    constructor(sculptor) { this.sculptor = sculptor; this.models = new Map(); }
    get(role) { if (!this.models.has(role)) this.models.set(role, this.sculptor.build(role)); return this.models.get(role); }
  }

  /* soft round contact shadow under the feet (the sun shadow does the rest) */
  class ContactShadow {
    static texture() {
      if (ContactShadow._tex) return ContactShadow._tex;
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (ContactShadow._tex = t);
    }
    static mesh(w, d) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: ContactShadow.texture(), transparent: true, depthWrite: false, opacity: 0.5, color: 0x0b0d14 }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m;
    }
  }

  /* Orbit demo: sweeps the play camera once around the player (play keeps the target on them), then
     hands yaw / pitch / distance back. Runs on its own animation frame so play mode needs no hook. */
  class OrbitDemo {
    constructor(win) { this.win = win; this.on = false; this.a = 0; this.raf = 0; this.onChange = null; }
    get rig() { const app = this.win.app; return app && app.rig; }
    toggle() { if (this.on) this.stop(); else this.start(); }
    start() {
      const rig = this.rig; if (!rig) return;
      this.on = true; this.a = 0; this.saved = { yaw: rig.goal.yaw, pitch: rig.goal.pitch, dist: rig.goal.dist }; this.last = performance.now();
      this.raf = this.win.requestAnimationFrame((t) => this.step(t)); if (this.onChange) this.onChange();
    }
    stop() {
      if (!this.on) return; this.on = false; this.win.cancelAnimationFrame(this.raf);
      const rig = this.rig; if (rig && this.saved) rig.set(this.saved); if (this.onChange) this.onChange();
    }
    step(now) {
      if (!this.on) return; const rig = this.rig; if (!rig) { this.stop(); return; }
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.a += dt * 0.55;
      const g = rig.goal; g.yaw = this.saved.yaw + this.a; g.pitch = 0.4; g.dist = 7; rig.clamp();
      if (this.a >= Math.PI * 2) { this.stop(); return; }
      this.raf = this.win.requestAnimationFrame((t) => this.step(t));
    }
  }

  /* the small camera button (bottom right, play mode only) that starts / stops the Orbit demo */
  class OrbitButton {
    constructor(orbit) { this.orbit = orbit; this.el = null; orbit.onChange = () => this.sync(); }
    mount(doc) {
      if (this.el || !doc.body) return;
      if (!doc.getElementById('voxOrbitCss')) {
        const css = doc.createElement('style'); css.id = 'voxOrbitCss';
        css.textContent = '#voxOrbit{position:fixed;right:14px;bottom:14px;z-index:60;width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(14,18,28,.78);color:#e7edf6;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.35);backdrop-filter:blur(6px);padding:0}'
          + 'body.playing #voxOrbit{display:flex}#voxOrbit:hover{background:rgba(40,48,66,.9)}#voxOrbit.on{background:#e8b04a;color:#1b1406}#voxOrbit svg{width:20px;height:20px}';
        doc.head.appendChild(css);
      }
      const b = (this.el = doc.createElement('button')); b.id = 'voxOrbit'; b.type = 'button'; b.title = 'Orbit the camera around your character';
      b.setAttribute('aria-label', 'Orbit camera');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v10H4z"/><circle cx="12" cy="13" r="3.4"/></svg>';
      b.addEventListener('click', (e) => { e.stopPropagation(); this.orbit.toggle(); });
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      doc.body.appendChild(b); this.sync();
    }
    sync() { if (this.el) this.el.classList.toggle('on', this.orbit.on); }
  }

  /* registry play mode asks for a view class; builds the voxel subclass the first time it is needed */
  class VoxelActorViews {
    constructor(win) {
      this.win = win; this.enabled = true; this.View = null; this.live = new Set();
      this.cache = new VoxelModelCache(KV.CharacterSculptor);
      this.orbit = new OrbitDemo(win); this.button = new OrbitButton(this.orbit);
      this.shadowProxy = true;   // low-res shadow-only copy of each body (see VoxelModel.buildShadow)
    }
    classFor(spriteId) { return this.enabled ? this.viewClass() : K.SpriteActorView; }
    roleOf(spriteId) { return this.enabled ? VoxelRoles.of(spriteId) : null; }
    viewClass() { return this.View || (this.View = VoxelActorViews.define(K.SpriteActorView, this)); }
    /* first voxel actor in a scene: the sun's shadow camera starts seeing the shadow-proxy layer, and the button mounts */
    attach(R) {
      if (R.sun && R.sun.shadow) R.sun.shadow.camera.layers.enable(KV.VoxelRig.SHADOW_LAYER);
      if (this.win.document) this.button.mount(this.win.document);
    }

    static define(Base, kit) {
      const V3 = THREE.Vector3, LIFT = new THREE.Color(0.035, 0.04, 0.055); // the billboards' night lift, scaled for lit geometry
      return class VoxelActorView extends Base {
        build(spriteId) {
          const role = kit.roleOf(spriteId);
          if (!role) { this.rig = null; super.build(spriteId); return; }
          this.spriteId = spriteId; this.native = 1; this.role = role;
          const model = kit.cache.get(role);
          this.rig = new KV.VoxelRig(model, { rest: KV.CharacterSculptor.REST[role], shadowProxy: kit.shadowProxy });
          this.anim = new KV.VoxelAnimator(this.rig, { phase: this.phase });
          this.h = model.height * this.scale; this.w = (VoxelRoles.WIDTH[role] || 0.85) * this.scale;
          this.rig.group.scale.setScalar(this.scale); this.applyTint();
          this.yaw = this.yaw != null ? this.yaw : Math.atan2(this.dir.x, this.dir.z);
          const sw = model.height * (VoxelRoles.SHADOW[role] || 0.5) * this.scale;
          this.blob = ContactShadow.mesh(sw, sw * 0.6);
          this.R.scene.add(this.rig.group, this.blob); kit.attach(this.R); kit.live.add(this);
        }
        /* outfit colour: a half-strength multiply, so a tint shifts the voxel palette without flattening it */
        applyTint() { if (this.rig) this.rig.mat.color.setRGB(1, 1, 1).lerp(this.tint, 0.5); }
        /** wear a team colour: the red of the tunic, cloak and shield is re-dyed to this colour (not a muddy tint over everything) */
        setTeam(hex) {
          if (!this.rig) return super.setTint(hex); const THREE = G.THREE, target = {}; new THREE.Color(hex).getHSL(target); this.teamHex = hex;
          this.rig.group.traverse((o) => {
            if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.color) return;
            if (!o.userData.ownColours) { o.geometry = o.geometry.clone(); o.userData.ownColours = Float32Array.from(o.geometry.attributes.color.array); }   // its own copy: other actors of this kind keep theirs
            const col = o.geometry.attributes.color, orig = o.userData.ownColours, c = new THREE.Color(), hsl = {};
            for (let i = 0; i < col.count; i++) {
              c.setRGB(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]); c.getHSL(hsl);
              if ((hsl.h < 0.055 || hsl.h > 0.94) && hsl.s > 0.3 && hsl.l > 0.1 && hsl.l < 0.8) c.setHSL(target.h, target.s, Math.max(0.06, Math.min(0.95, hsl.l * (0.5 + target.l))));
              col.setXYZ(i, c.r, c.g, c.b);
            }
            col.needsUpdate = true;
          });
          this.tint.set(0xffffff); this.applyTint();
        }
        setTint(hex) { if (!this.rig) return super.setTint(hex); this.tint.set(hex == null ? 0xffffff : hex); this.applyTint(); }
        setVisible(v) { if (!this.rig) return super.setVisible(v); this.visible = v; this.rig.group.visible = v; this.blob.visible = v; }
        update(t, dt, camYaw, tilt) {
          if (!this.rig) return super.update(t, dt, camYaw, tilt);
          this.stateT += dt; const st = this.state, T = this.stateT;
          // state timeouts mirror the billboard view so play logic sees the same timing
          if (st === 'attack' && T > 0.42) this.setState(this.prev === 'run' || this.prev === 'walk' ? 'idle' : this.prev || 'idle');
          else if (st === 'hurt' && T > 0.28) this.setState(this.prev && this.prev !== 'hurt' && this.prev !== 'attack' ? this.prev : 'idle');
          // turn smoothly toward the facing direction (shortest way round)
          const want = Math.atan2(this.dir.x, this.dir.z); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
          if (st !== 'dead') this.yaw += d * Math.min(1, dt * (st === 'run' ? 14 : 10));
          this.anim.apply(this.state, this.stateT, t, Math.min(dt, 0.05));
          let lunge = 0;
          if (this.state === 'attack') { const p = Math.min(1, this.stateT / 0.42); lunge = p < 0.35 ? -0.04 * (p / 0.35) : p < 0.6 ? -0.04 + 0.2 * ((p - 0.35) / 0.25) : 0.16 * (1 - (p - 0.6) / 0.4); }
          else if (this.state === 'hurt') lunge = -0.07 * Math.max(0, 1 - this.stateT / 0.25);
          const g = this.rig.group, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
          g.rotation.y = this.yaw; g.position.set(this.pos.x + fx * lunge * this.scale, this.pos.y, this.pos.z + fz * lunge * this.scale);
          this.blob.position.set(this.pos.x, this.pos.y + 0.015, this.pos.z);
          const m = this.rig.mat;
          if (this.flashT > 0) { this.flashT -= dt; if (this.flashKind === 'heal') m.emissive.setRGB(0.15, 0.55, 0.22); else m.emissive.setRGB(0.55, 0.08, 0.06); }
          else if (this.hl) m.emissive.set(this.hl).multiplyScalar(0.35);
          else m.emissive.copy(LIFT);
          if (this.state === 'dead') { this.deadT += dt; this.blob.visible = this.visible && this.deadT < 0.4; } else this.deadT = 0;
        }
        screenRect(camera, W, H) {
          if (!this.rig) return super.screenRect(camera, W, H);
          const v = new V3(), p = this.pos, out = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, front: true }, r = this.w * 0.45;
          const pts = [[0, 0, 0], [0, this.h * 0.95, 0], [r, this.h * 0.5, 0], [-r, this.h * 0.5, 0], [0, this.h * 0.5, r], [0, this.h * 0.5, -r]];
          for (const [dx, dy, dz] of pts) {
            v.set(p.x + dx, p.y + dy, p.z + dz).project(camera); if (v.z > 1) out.front = false;
            const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
            out.x0 = Math.min(out.x0, sx); out.x1 = Math.max(out.x1, sx); out.y0 = Math.min(out.y0, sy); out.y1 = Math.max(out.y1, sy);
          }
          return out;
        }
        disposeSprite() {
          if (!this.rig) return super.disposeSprite();
          this.R.scene.remove(this.rig.group, this.blob); this.rig.dispose(); this.blob.geometry.dispose(); this.blob.material.dispose();
          kit.live.delete(this); this.rig = null;
        }
      };
    }
  }

  K.ActorViews = new VoxelActorViews(G);

  /* who works where, by worker name: the sprite id each one is drawn with (tint null = the outfit's own colours) */
  K.WORKER_LOOKS = {
    Cook: { sprite: 'cook', tint: null }, Smith: { sprite: 'smith', tint: null }, Clerk: { sprite: 'clerk', tint: null },
    Farmer: { sprite: 'farmer', tint: null }, Woodcutter: { sprite: 'woodcutter', tint: null }, Quarryman: { sprite: 'quarryman', tint: null },
    Archer: { sprite: 'archer', tint: null }, Stablehand: { sprite: 'stablehand', tint: null }, Storekeeper: { sprite: 'storekeeper', tint: null },
    Henwife: { sprite: 'henwife', tint: null }, Cowherd: { sprite: 'cowherd', tint: null }, Baker: { sprite: 'baker', tint: null },
    Butcher: { sprite: 'butcher', tint: null }, Alchemist: { sprite: 'alchemist', tint: null },
  };
  Object.assign(K, { VoxelActorViews, VoxelRoles, VoxelModelCache, OrbitDemo, OrbitButton, ContactShadow });
})(typeof window !== 'undefined' ? window : globalThis);
