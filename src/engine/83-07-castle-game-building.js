/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameBuilding extends K.CastleGameActions {
    repair(type) {
      const r = this.castle.build(type, this.L.ruins[type], { ruin: true });
      if (!r.ok) { this.cui.toast(`${this.data.piece(type).name}: ${r.why}.`);
        this.sound.play('clank');
        return;
        }
      const at = this.L.ruins[type], old = this.meshes.get('ruin:' + type);
        if (old) { this.group.remove(old);
        this.meshes.delete('ruin:' + type);
        }
      r.piece.rot = at.rot;
        const m = this.addPieceMesh(r.piece);
        this.pop(m);
      this.sound.play(type === 'gatehouse' ? 'clank' : 'thunk');
        this.puff(at.x, at.z);
      const done = Object.entries(this.castle.ruins).filter(([, v]) => v).length;
      this.cui.toast(`${this.data.piece(type).name} restored. Ruins ${done}/4.`);
        this.changed();
    }
    buildAtSite() {
      const at = this.L.outcrop, r = this.castle.build('mine', { x: at.x, z: at.z, rot: 0 });
      if (!r.ok) { this.cui.toast(`Iron mine: ${r.why}.`);
        this.sound.play('clank');
        return;
        }
      const old = this.meshes.get('outcrop');
        if (old) this.group.remove(old);
      this.pop(this.addPieceMesh(r.piece));
        this.sound.play('thunk');
        this.puff(at.x, at.z);
      this.cui.toast(`Iron mine: ${K.CastleUI.prodLine(this.castle, 'mine')}.`);
        this.changed();
    }
    /* free placement of a new piece (from the Build radial) */
    placementOk(type, x, z, rot) {
      const c = this.castle, [w, d] = CastleArt.size(type), nav = this.play.nav;
      let bad = null;
      if (type === 'dirt') return this.dirtOk(x, z);
      if (type === 'field') return this.economy.plantOk(x, z);
      if (type === 'blacksmith') return null;
      this.rectTiles(x, z, w + 0.2, d + 0.2, rot, (i, j) => { const k = j * nav.w + i; if (this.occ[k] || this.R.buildings.at(i,
      j)) bad = 'something is in the way';
        else if (!nav.walk[k] || nav.deck[k]) bad = bad || 'the ground is not clear';
        });
      const me = this.play.me;
        if (!bad && Math.hypot(me.x - x, me.z - z) < Math.min(w, d) / 2 + 0.2) bad = 'you are standing there';
      return bad;
    }
    /* a piece may never seal the Keep in: its approach must still reach the wilds (walls need the Gatehouse as the way in) */
    wouldWallOffKeep(type, x, z, rot) {
      const nav = this.play.nav, [w, d] = CastleArt.size(type), gate = type === 'gatehouse', saved = [];
      this.rectTiles(x, z, w, d, rot, (i, j, lx) => { if (gate && Math.abs(lx) <= 0.75) return; const k = j * nav.w + i; saved.push([k, nav.walk[k]]);
      nav.walk[k] = 0;
        });
      const a = this.keepEnt.goal || [this.L.keep.x, this.L.keep.z + this.L.keep.r + 1];
      const open = this.L.outside.some((o) => nav.find(a[0], a[1], o.x, o.z, { range: 1.5 }));
      for (const [k, v] of saved) nav.walk[k] = v;
      return !open;
    }
    autoRot(x, z) { return Math.atan2(-(x - this.L.keep.x), -(z - this.L.keep.z)) + (this.rotExtra || 0);
      }
    /* dirt goes on free ground, one cube per press; it stacks */
    dirtOk(x, z) {
      const [i, j] = this.play.doc.tileOf(x, z), T2 = TILE, cx = (i + 0.5) * T2, cz = (j + 0.5) * T2;
      for (const a of this.play.actors) { if (!a.alive && a !== this.play.me) continue;
      const overlapping = Math.abs(a.x - cx) < T2 / 2 + (a.r || 0.3) &&
        Math.abs(a.z - cz) < T2 / 2 + (a.r || 0.3);
      if (overlapping) return a === this.play.me ? 'you are standing there' : 'something is standing there';
      }
      // never bury anyone
      return this.tools.editor.canRaise(i, j) ? null : 'the ground cannot take dirt here';
    }
    placeDirt(x, z, quiet) {
      const why = this.dirtOk(x, z), c = this.castle;
        if (why) { if (!quiet) { this.cui.toast(why[0].toUpperCase() + why.slice(1) + '.');
      this.sound.play('clank');
        } return false;
        }
      if (c.amount('dirt') < 1) { if (!quiet) this.cui.toast('You need dirt. Dig some with the shovel.');
        return false;
        }
      c.spend({ dirt: 1 });
        const [i, j] = this.play.doc.tileOf(x, z);
        this.tools.editor.raise(i, j);
        this.xp.built('dirt');
      this.tools.effects.burst('dirt', x, this.play.nav.y(x, z) + 0.2, z, 5, 2.2);
        this.sound.play('thunk');
        this.changed();
        return true;
    }
    /** a piece that comes with something already paid for (the marketplace's street stalls): no cost, no placement check */
    addFreePiece(type, x, z, rot) {
      const c = this.castle, d = this.data.piece(type), p = { uid: c.nextUid++, type, level: 1, x, z, rot, hp: (d && d.hp) || 100, ruin: false };
      c.pieces.push(p);
      this.addPieceMesh(p);
        if (this.mp) this.mp.op({ k: 'piece+', id: this.mp.pieceId(p), type, x, z, rot });
        this.changed();
        return p;
    }
    buildAt(type, x, z, rot = this.autoRot(x, z), quiet = false) {
      if (type === 'dirt') return this.placeDirt(x, z, quiet);
      if (type === 'field') return this.economy.plant(x, z, quiet);
        // a square of wheat field
      const why = this.placementOk(type, x, z, rot);
        if (why) { if (!quiet) { this.cui.toast(why[0].toUpperCase() + why.slice(1) + '.');
      this.sound.play('clank');
        } return false;
        }
      const r = this.castle.build(type, { x, z, rot });
        if (!r.ok) { if (!quiet) this.cui.toast(`${this.data.piece(type).name}: ${r.why}.`);
        return false;
        }
      const m = this.addPieceMesh(r.piece);
        this.pop(m);
        this.sound.play('thunk');
        this.puff(x, z);
        this.shake(0.08);
      if (type === 'fire_pot') this.R.placeDynamics();
      const pr = this.data.piece(type).produces;
      if (!quiet) this.cui.toast(pr ? `${this.data.piece(type).name}: ${K.CastleUI.prodLine(this.castle, type)}.` : `${this.data.piece(type).name} built.`);
      this.xp.built(type);
        if (this.mp) this.mp.op({ k: 'piece+', id: this.mp.pieceId(r.piece), type, x, z, rot });
        this.changed();
        return true;
    }
    upgrade(p) {
      const r = this.castle.upgrade(p);
        if (!r.ok) { this.cui.toast(`Upgrade: ${r.why}.`);
        this.sound.play('clank');
        return;
        }
      this.pop(this.redrawPiece(p), 0.7);
        this.sound.play('fanfare');
        this.puff(p.x, p.z);
      this.cui.toast(`${this.data.piece(p.type).name} is Level 2.`);
        this.changed();
    }
    craft(rid) {
      const r = this.castle.craft(rid);
        if (!r.ok) { this.cui.toast(`${this.data.item(rid.replace('craft_', '')).name}: ${r.why}.`);
      this.sound.play('clank');
        return;
        }
      const id = r.items[0], pl = this.play.player;
        pl.addItem(id, 1);
        this.equipBest(pl);
      this.play.float(this.play.me, this.data.item(id).name + '!', 'heal', K.CastleUI.ICON[id]);
        this.play.me.view.flash('heal');
      this.sound.play('clank');
        setTimeout(() => this.sound.play('chime'), 180);
      this.cui.banner(this.data.item(id).name,
      `Attack ${this.data.item(id).atk}${id === 'ember_brand' ? ' · frost creatures burn' : ''} · your kin’s weapons follow`, id);
      this.changed();
    }
    bindHeart() {
      const r = this.castle.build(this.data.keepUpgrade.id);
        if (!r.ok) { this.cui.toast(`Heartfire hearth: ${r.why}.`);
        return;
        }
      this.sound.play('whump');
        this.flareT = 4;
        this.shake(0.6);
        this.changed();
        this.ending();
    }
    ringBell() { const ev = this.day.ringBell();
      if (ev) { this.sound.play('horn');
      this.onDayEvent(ev);
      } }
  }
  K.CastleGameBuilding = CastleGameBuilding;
})(typeof window !== 'undefined' ? window : globalThis);
