/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  class Identity {
    static read(key) { try { return G.localStorage.getItem(key); } catch { return null; } }
    static write(key, value) { try { G.localStorage.setItem(key, value); } catch { /* private mode */ } }
    static get cid() { let c = Identity.read('kinstead.cid');
       if (!c) { c = (G.crypto && G.crypto.randomUUID ? G.crypto.randomUUID() : 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36));
       Identity.write('kinstead.cid', c);
       } return c;
      }
    static get name() { return Identity.read('kinstead.name') || '';
      }
    static set name(v) { Identity.write('kinstead.name', v);
      }
  }
  G.K.Identity = Identity;
})(typeof window !== 'undefined' ? window : globalThis);
