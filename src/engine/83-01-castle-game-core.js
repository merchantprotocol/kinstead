/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameCore {
    constructor(play, opts = {}) {
      this.play = play;
        this.data = new K.CastleData(K.CASTLE_DATA);
        this.L = opts.layout || new K.HutLayout();
        this.net = opts.net || null;
      this.survival = true;
        this.noRegen = true;
      this.slot = new K.CastleSave(opts.storage || K.CastleSave.defaultStorage());
        this.resume = !!opts.resume;
        this.sound = new K.CastleSound();
      this.castle = new K.Castle(this.data);
        this.day = new K.DayCycle(this.data);
        this.calendar = new K.Calendar(this);
        this.playTime = 0;
      this.saved = this.resume ? this.slot.read() : null;
      if (opts.net && opts.net.welcome.save && this.resume) { try { this.saved = JSON.parse(opts.net.welcome.save);
      } catch (e) { console.warn('the saved game on the server could not be read', e);
        } }   // the server's copy wins: a refresh never loses progress
      if (!this.resume) this.slot.clear();
      if ((this.net && this.net.welcome.evicted) || (G.localStorage && G.localStorage.getItem('kinstead.evict'))) {
        try { G.localStorage.removeItem('kinstead.evict');
          } catch (e) { /* ignore */ }
        this.saved = this.evictedSave(this.saved);
      }
      // your castle was taken: you keep what you carry, not the land
      if (this.saved) { this.castle = K.Castle.fromJSON(this.data, this.saved.castle);
        const d = Object.assign({}, this.saved.day);
      if (this.day.phases[d.idx] && this.day.phases[d.idx].kind === 'night') d.t = 0;
        this.day = new K.DayCycle(this.data, d);
      this.playTime = this.saved.playTime || 0;
        }
      if (!this.saved) { this.castle.add('wood', 70);
        this.castle.add('stone', 35);
        this.castle.add('dirt', 4);
        this.castle.add('arrow', 12);
      this.castle.weapons.add('stoneblade');
        this.freshStart = true;
        }   // you start with a little of everything and a blade
      this.day.phases = K.Calendar.PHASES;
        // looping day and night
      this.noXp = true;
        this.swingSec = this.data.swingSec;
    }
    /** a saved game after your castle was taken: resources, strength and weapons stay; pieces, buildings, stores and ground do not */
    evictedSave(sv) { if (!sv) return null;
      const keep = sv.extras || {};
      sv.castle.pieces = [];
      sv.hero = null;
      sv.nodes = {};
    sv.extras = { weapons: keep.weapons, held: keep.held, xp: keep.xp };
      return sv;
      }
    /** you hit another player: tell the server (it works out the damage) */
    pvpHit(a, b) {
      if (!this.mp) return;
      if (a === this.play.me) { if (b.mob) this.mp.mobHit(b);
        else this.mp.pvp(b.pid);
        this.xp.dealt();
        this.sound.play('hit');
      }   // you hit a player, or someone else's creature
      else if (!a.remote && !b.mob && b.pid) this.mp.mobBite(a, b);
        // one of your creatures bit another player
    }
    playerMenu(e) { if (this.mp) this.mp.playerMenu(e);
      }
    /** your character wears your banner's colour */
    applyLook() { const me = this.play.me;
      if (me && me.view) { const c = K.BANNER_COLORS[this.banners.mine().color % 12];
    if (me.view.setTeam) me.view.setTeam(c);
      else if (me.view.setTint) me.view.setTint(c);
      } }
    /** do you hold the key to this building? (your own house and workshop always; others' only through a key, yours or your team's) */
    keyFor(id) { if (id === 'home' || id === 'smithy' || id === 'market' || this.halls[id]) return true;
      return this.mp ? this.mp.keyFor(id) : false;
      }
    /** where you slept last is where you wake (and where you come back after a fall) */
    setRespawn(buildingId, x, z) {
      const slot = this.mp ? this.mp.slotOf(buildingId) : buildingId === 'home' ? 0 : null;
        if (slot == null) return;
        // only a house: not the workshop
      this.respawn = { x, z, id: buildingId };
        this.play.spawn = { x, z };
        if (this.mp) this.mp.setRespawn(slot, x, z);
        this.cui.toast('You will wake here.');
    }
    get app() { return this.play.app;
      }
    get R() { return this.play.R;
      }
    get ui() { return this.cui;
      }
    makePlayer() { this.xp = this.xp || new K.Experience(this);
      const p = new K.CastleHero(this.play.items, this.castle);
      p.xp = this.xp;
    p.addItem('ember_lantern', 1);
      if (this.freshStart) p.addItem('bread', 10);
    /* you arrive with food to last a while */ for (const w of this.castle.weapons) { p.addItem(w, 1);
      } this.equipBest(p);
      p.healFull();
      return p;
      }
    equipBest(p) { const w = this.castle.bestWeapon();
      if (w && p.count(w.id)) p.equip(w.id);
      }

    /* ---------- enter / exit ---------- */
  }
  K.CastleGameCore = CastleGameCore;
})(typeof window !== 'undefined' ? window : globalThis);
