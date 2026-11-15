/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CastleBuilder: building things. New pieces from the Build radial, dirt cubes, free pieces that come with a
   building, ruin repairs, the iron mine, upgrades, forging weapons, lighting the Keep and binding the troll's heart. */
(function (G) {
  const K = G.K;

  class CastleBuilder {
    constructor(game) { this.g = game; }
    /** tell the player why not (a toast and a clank), unless quiet */
    refuse(why, quiet) {
      if (quiet) return;
      this.g.cui.toast(why[0].toUpperCase() + why.slice(1) + '.');
      this.g.sound.play('clank');
    }
    buildAt(type, x, z, rot, quiet = false) {
      const g = this.g, d = g.data.piece(type);
      if (rot === undefined) rot = g.autoRot(x, z);
      if (type === 'dirt') return this.placeDirt(x, z, quiet);
      if (type === 'field') return g.economy.plant(x, z, quiet);   // a square of wheat field
      const why = g.placementOk(type, x, z, rot);
      if (why) { this.refuse(why, quiet); return false; }
      const r = g.castle.build(type, { x, z, rot });
      if (!r.ok) { if (!quiet) g.cui.toast(`${d.name}: ${r.why}.`); return false; }
      g.pop(g.addPieceMesh(r.piece));
      g.sound.play('thunk');
      g.puff(x, z);
      g.shake(0.08);
      if (type === 'fire_pot') g.R.placeDynamics();
      if (!quiet) g.cui.toast(d.produces ? `${d.name}: ${K.CastleUI.prodLine(g.castle, type)}.` : `${d.name} built.`);
      g.xp.built(type);
      if (g.mp) g.mp.op({ k: 'piece+', id: g.mp.pieceId(r.piece), type, x, z, rot });
      g.changed();
      return true;
    }
    placeDirt(x, z, quiet) {
      const g = this.g, c = g.castle, why = g.dirtOk(x, z);
      if (why) { this.refuse(why, quiet); return false; }
      if (c.amount('dirt') < 1) { if (!quiet) g.cui.toast('You need dirt. Dig some with the shovel.'); return false; }
      c.spend({ dirt: 1 });
      const [i, j] = g.play.doc.tileOf(x, z);
      g.tools.editor.raise(i, j);
      g.xp.built('dirt');
      g.tools.effects.burst('dirt', x, g.play.nav.y(x, z) + 0.2, z, 5, 2.2);
      g.sound.play('thunk');
      g.changed();
      return true;
    }
    /** a piece that comes with something already paid for (the marketplace's street stalls): no cost, no placement check */
    addFreePiece(type, x, z, rot) {
      const g = this.g, c = g.castle, d = g.data.piece(type);
      const p = { uid: c.nextUid++, type, level: 1, x, z, rot, hp: (d && d.hp) || 100, ruin: false };
      c.pieces.push(p);
      g.addPieceMesh(p);
      if (g.mp) g.mp.op({ k: 'piece+', id: g.mp.pieceId(p), type, x, z, rot });
      g.changed();
      return p;
    }
    repair(type) {
      const g = this.g, at = g.L.ruins[type], r = g.castle.build(type, at, { ruin: true });
      if (!r.ok) { g.cui.toast(`${g.data.piece(type).name}: ${r.why}.`); g.sound.play('clank'); return; }
      const old = g.meshes.get('ruin:' + type);
      if (old) { g.group.remove(old); g.meshes.delete('ruin:' + type); }
      r.piece.rot = at.rot;
      g.pop(g.addPieceMesh(r.piece));
      g.sound.play(type === 'gatehouse' ? 'clank' : 'thunk');
      g.puff(at.x, at.z);
      const done = Object.entries(g.castle.ruins).filter(([, v]) => v).length;
      g.cui.toast(`${g.data.piece(type).name} restored. Ruins ${done}/4.`);
      g.changed();
    }
    buildAtSite() {
      const g = this.g, at = g.L.outcrop, r = g.castle.build('mine', { x: at.x, z: at.z, rot: 0 });
      if (!r.ok) { g.cui.toast(`Iron mine: ${r.why}.`); g.sound.play('clank'); return; }
      const old = g.meshes.get('outcrop');
      if (old) g.group.remove(old);
      g.pop(g.addPieceMesh(r.piece));
      g.sound.play('thunk');
      g.puff(at.x, at.z);
      g.cui.toast(`Iron mine: ${K.CastleUI.prodLine(g.castle, 'mine')}.`);
      g.changed();
    }
    upgrade(p) {
      const g = this.g, r = g.castle.upgrade(p);
      if (!r.ok) { g.cui.toast(`Upgrade: ${r.why}.`); g.sound.play('clank'); return; }
      g.pop(g.redrawPiece(p), 0.7);
      g.sound.play('fanfare');
      g.puff(p.x, p.z);
      g.cui.toast(`${g.data.piece(p.type).name} is Level 2.`);
      g.changed();
    }
    craft(rid) {
      const g = this.g, r = g.castle.craft(rid);
      if (!r.ok) { g.cui.toast(`${g.data.item(rid.replace('craft_', '')).name}: ${r.why}.`); g.sound.play('clank'); return; }
      const id = r.items[0], pl = g.play.player, item = g.data.item(id);
      pl.addItem(id, 1);
      g.equipBest(pl);
      g.play.float(g.play.me, item.name + '!', 'heal', K.CastleUI.ICON[id]);
      g.play.me.view.flash('heal');
      g.sound.play('clank');
      setTimeout(() => g.sound.play('chime'), 180);
      g.cui.banner(item.name, `Attack ${item.atk}${id === 'ember_brand' ? ' · frost creatures burn' : ''} · your kin’s weapons follow`, id);
      g.changed();
    }
    lightKeep() {
      const g = this.g;
      if (!g.castle.light()) return;
      const p = g.play;
      p.face(p.me, g.keepEnt);
      p.me.view.setState('action');
      p.player.removeItem('ember_lantern', 1);
      g.sound.play('whump');
      g.redrawKeep();
      g.pop(g.keepMesh, 0.6);
      g.hearth.flare(2.5);
      g.shake(0.25);
      g.meltTo(g.castle.glowRadius(), 1.4);
      g.hearth.glowR = 0.5;
      g.cui.banner('The hearth roars', 'CL 1 · the glow pushes the frost back 6 m', 'fire');
      g.changed();
    }
    bindHeart() {
      const g = this.g, r = g.castle.build(g.data.keepUpgrade.id);
      if (!r.ok) { g.cui.toast(`Heartfire hearth: ${r.why}.`); return; }
      g.sound.play('whump');
      g.hearth.flare(4);
      g.shake(0.6);
      g.changed();
      g.ending();
    }
  }

  K.CastleBuilder = CastleBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
