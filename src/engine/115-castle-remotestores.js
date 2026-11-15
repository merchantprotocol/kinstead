/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class RemoteStores {
    constructor(game, net) { this.g = game;
       this.net = net;
       this.by = new Map();
       this.fake = { g: game, center: { x: 0, z: 0 }, reblock() {}, stores: [] };
      }
    upsert(s) {
      if (s.owner === this.net.id) return;
         const old = this.by.get(s.id);
         if (old) { this.setStock(s.id, s.stock);
         return;
        }
      const cls = s.kind === 'pile' ? K.Pile : s.kind === 'crate' ? K.Crate : K.Barrel;
      const view = new cls(this.fake, { id: s.id, kind: s.kind, name: s.name, res: s.res, dx: s.x, dz: s.z, own: s.stock, stack: s.stack });
         view.ent.type = 'c_rstore';
         view.ent.sid = s.id;
        view.ent.name = s.name;
      this.by.set(s.id, { s, view });
         view.sync();
        this.dirty = true;
    }
    setStock(id, stock) { const r = this.by.get(id);
       if (!r) return;
       r.view.stock = stock;
       if (r.view.refresh && stock > 0) r.view.refresh();
       r.view.sync();
       this.dirty = true;
      }
    gone(id) { const r = this.by.get(id);
       if (!r) return;
       const g = this.g, v = r.view;
       g.unblockRect(v.x, v.z, 0.5, 0.5, 0);
       v.dispose();
       this.by.delete(id);
       this.dirty = true;
      }
    flush() { if (this.dirty) { this.dirty = false;
       this.g.play.refreshProps();
      } }
    dropOwner(owner) { for (const [id, r] of [...this.by]) if (r.s.owner === owner) this.gone(id);
      }
    entities() { const out = [];
       for (const r of this.by.values()) if (r.view.present) out.push(r.view.ent);
       return out;
      }
  }

  /** the creatures other players' games are running (their wolves, bears and raiders): you see them, and you can fight them */
  K.RemoteStores = RemoteStores;
})(typeof window !== 'undefined' ? window : globalThis);
