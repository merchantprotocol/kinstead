/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* RemoteTerrain: the ground other people changed: dug or raised tiles, and trees or rocks they felled or moved. */
(function (G) {
  const K = G.K;
  const TILE = K.TILE;

  class RemoteTerrain {
    constructor(game) {
      this.g = game;
      this.byId = null;
    }

    get play() {
      return this.g.play;
    }

    /** a batch of [i, j, height, terrain] tiles, redrawn once as one box */
    applyTiles(tiles) {
      let box = null;
      for (const t of tiles) {
        this.setTile(t[0], t[1], t[2], t[3], false);
        box = this.grow(box, t[0], t[1]);
      }
      if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
    }

    grow(box, i, j) {
      if (!box) return [i, j, i, j];
      return [Math.min(box[0], i), Math.min(box[1], j), Math.max(box[2], i), Math.max(box[3], j)];
    }

    setTile(i, j, h, te, redraw) {
      const doc = this.play.doc;
      const nav = this.play.nav;
      if (!doc.inside(i, j)) return;
      const k = j * doc.w + i;
      if (doc.height[k] === h && doc.terrain[k] === te) return;
      doc.height[k] = h;
      doc.terrain[k] = te;
      nav.S[k] = nav.surface((i + 0.5) * TILE, (j + 0.5) * TILE, doc.hy(i, j));
      if (redraw) this.play.R.tilesChanged(i, j, i + 1, j + 1);
    }

    node(id) {
      if (!this.byId) {
        this.byId = new Map();
        for (const e of this.play.baseProps) this.byId.set(e.id, e);
      }
      return this.byId.get(id) || null;
    }

    applyNodes(nodes) {
      for (const n of nodes) this.nodeOp(n);
    }

    /** a tree or rock someone else felled or moved */
    nodeOp(n) {
      const e = this.node(n.id);
      if (!e) return;
      const st = this.play.nodeState(e);
      if (n.st === 'felled') this.fell(e, st);
      else if (n.st === 'moved') this.move(e, st, n.x, n.z);
    }

    fell(e, st) {
      const g = this.g;
      if (st.charges <= 0) return;
      st.charges = 0;
      st.respawnAt = Infinity;
      g.R.setPropState(e.id, 'depleted');
      g.forest.free(e);
      g.tools.effects.burst(e.type === 'c_tree' ? 'wood' : 'stone', e.x, e.y + 0.6, e.z, 5, 2);
    }

    move(e, st, x, z) {
      const g = this.g;
      g.forest.free(e);
      e.obj.x = x;
      e.obj.z = z;
      e.x = x;
      e.z = z;
      e.y = this.play.nav.y(x, z);
      st.charges = st.max;
      st.respawnAt = 0;
      g.R.propState.delete(e.id);
      g.forest.moved[e.id] = [x, z];
      this.play.nav.blockProp(e.obj);
    }
  }

  K.RemoteTerrain = RemoteTerrain;
})(typeof window !== 'undefined' ? window : globalThis);
