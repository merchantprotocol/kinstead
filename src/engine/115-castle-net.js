/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · other people. 20 to 30 settlers share one map, each with their own plot to build on.
   The realtime server (server/, a Cloudflare Durable Object) hands every player a plot, relays where everyone is,
   and keeps the shared edits to the land (walls, gates, buildings, dug ground, felled trees) so whoever joins sees
   the same world. Wolves and bears are simulated by each player's own game and are only ever after their owner.
   With no server reachable (or none configured) the game simply runs alone on plot 0.
     Identity     who this browser is (an id it keeps, and the name you chose)
     NameGate     asks for your name the first time
     Net          the WebSocket: join, send, receive, reconnect
     RemoteWorld  applies everyone else's edits to your map
     Avatars      the other players, walking about, with name plates and speech
     Multiplayer  ties it to the running game, and sends your own position and edits */
(function (G) {
  const K = G.K;

  class NetText {
    static escape(value) {
      const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return String(value == null ? '' : value).replace(/[&<>"]/g, (character) => replacements[character]);
    }
  }

  class BrowserStore {
    static get(key) { try { return G.localStorage.getItem(key);
       } catch (e) { return null;
      } }
    static set(key, value) { try { G.localStorage.setItem(key, value);
      } catch (e) { /* private mode */ } }
  }

  class Identity {
    static get cid() { let c = BrowserStore.get('kinstead.cid');
       if (!c) { c = (G.crypto && G.crypto.randomUUID ? G.crypto.randomUUID() : 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36));
       BrowserStore.set('kinstead.cid', c);
       } return c;
      }
    static get name() { return BrowserStore.get('kinstead.name') || '';
      }
    static set name(v) { BrowserStore.set('kinstead.name', v);
      }
  }

  class NameGate {
    /** the first visit asks what to call you;
      afterwards it just returns the saved name */
    static ask() {
      const saved = Identity.name;
        if (saved) return Promise.resolve(saved);
      return new Promise((resolve) => {
        const root = document.createElement('div');
          root.id = 'cNameGate';
        root.innerHTML = '<div class="ng"><h2>Who goes there?</h2>' +
          '<p>Other settlers will see this name above your head.</p>' +
          '<input maxlength="20" placeholder="Your name" autocomplete="off">' +
          '<button>Enter the frozen lands</button></div>';
        document.body.appendChild(root);
           const input = root.querySelector('input'),
              go = () => { const v = (input.value || '').trim().slice(0,
             20) || 'Settler ' + Math.floor(Math.random() * 900 + 100);
           Identity.name = v;
           root.remove();
           resolve(v);
          };
        root.querySelector('button').addEventListener('click', go);
           input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
          setTimeout(() => input.focus(), 50);
      });
    }
  }

  class Net {
    /** the realtime server: ?server=wss://… in the address, else what was saved, else the built-in default ('' = play alone) */
    static url() {
      let u = '';
         try { u = new URLSearchParams(G.location.search).get('server') || '';
        } catch (e) { /* no location */ }
      if (u === 'off') return '';
         if (u) { BrowserStore.set('kinstead.server', u);
         return u;
        }
      return BrowserStore.get('kinstead.server') || Net.DEFAULT;
    }
    /** connect and get a plot. Resolves to a Net, or null (play alone). */
    static async join(map = 'main') {
      const base = Net.url();
        if (!base) return null;
      const name = await NameGate.ask(), net = new Net(base.replace(/\/+$/, '') + '/ws/' + map, Identity.cid, name);
      const t0 = performance.now();
      try { await net.open();
         } catch (e) { console.warn('multiplayer unavailable, playing alone:', e && e.message || e, Math.round(performance.now() - t0) + ' ms', base);
         return null;
        }
      return net;
    }
    constructor(url, cid, name) { this.url = url;
       this.cid = cid;
       this.name = name;
       this.ws = null;
       this.handlers = {};
       this.id = null;
       this.slot = 0;
       this.welcome = null;
       this.ready = false;
       this.closed = false;
       this.lastPos = 0;
      }
    /** messages that arrive before anything is listening (the game is still loading) are kept and handed over, so nobody misses a join */
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn);
       const b = this.backlog && this.backlog[type];
       if (b) { delete this.backlog[type];
       for (const m of b) { try { fn(m);
       } catch (e) { console.warn('net handler', type, e);
      } } } }
    emit(type, m) {
      const hs = this.handlers[type];
         if (!hs || !hs.length) { this.backlog = this.backlog || {};
         const q = (this.backlog[type] = this.backlog[type] || []);
         q.push(m);
         if (q.length > 60) q.shift();
         return;
        }
      for (const f of hs) { try { f(m);
         } catch (e) { console.warn('net handler', type, e);
        } }
    }
    open() {
      return new Promise((resolve, reject) => {
        let done = false;
           const fail = (why) => { if (!done) { done = true;
           reject(new Error(why));
           } }, timer = setTimeout(() => fail('timed out'), 15000);
          // a busy or slow machine may take a while to answer
        const ws = (this.ws = new WebSocket(this.url));
        ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid: this.cid, name: this.name }));
        ws.onerror = () => fail('connection failed');
        ws.onclose = () => { fail('closed');
           this.onClosed();
          };
        ws.onmessage = (e) => {
          let m;
             try { m = JSON.parse(e.data);
             } catch (err) { return;
            }
          if (m.t === 'welcome') { this.id = m.id;
             this.slot = m.slot;
             this.welcome = m;
             this.clock = m.clock;
             this.offset = m.clock.now - Date.now();
             clearTimeout(timer);
             if (!done) { done = true;
             this.ready = true;
             resolve(this);
             } else { this.ready = true;
             this.emit('welcome', m);
             this.flush();
             } return;
            }
          if (m.t === 'full') { fail('the map is full');
             return;
            }
          this.emit(m.t, m);
        };
      });
    }
    onClosed() { this.ready = false;
       if (this.closed || !this.welcome) return;
       this.emit('offline', {});
       clearTimeout(this.rt);
       this.rt = setTimeout(() => this.open().catch(() => this.onClosed()), 3000);
      }
    /** the server's time, in ms */
    now() { return Date.now() + (this.offset || 0);
      }
    /** sent now, or (for anything that changes the world) kept and sent the moment the connection is back, so no change is lost */
    send(m) {
      if (this.ready && this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m));
         return;
        }
      if (['pos', 'fx', 'mobs', 'sync', 'ping'].includes(m.t)) return;
         (this.queue = this.queue || []).push(m);
        if (this.queue.length > 600) this.queue.shift();
    }
    flush() { const q = this.queue || [];
       this.queue = [];
       for (const m of q) this.send(m);
      }
    op(o) { this.send({ t: 'op', op: o });
      }
    close() { this.closed = true;
       try { this.ws.close();
      } catch (e) { /* already closed */ } }
  }
  Net.DEFAULT = 'wss://kinstead-rooms.merchantprotocol.workers.dev';
    // set to the deployed realtime server, e.g. wss://kinstead-rooms.<account>.workers.dev (or pass ?server=…)

  /** other people's edits, applied to your map */








  Object.assign(K, { Identity, NameGate, Net, NetText });
})(typeof window !== 'undefined' ? window : globalThis);
