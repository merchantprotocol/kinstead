/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const { Identity, NameGate } = K;
  class Net {
    /** the realtime server: ?server=wss://… in the address, else what was saved, else the built-in default ('' = play alone) */
    static url() {
      let u = '';
         try { u = new URLSearchParams(G.location.search).get('server') || '';
        } catch (e) { /* no location */ }
      if (u === 'off') return '';
         if (u) { K.Identity.write('kinstead.server', u);
         return u;
        }
      return K.Identity.read('kinstead.server') || Net.DEFAULT;
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
  K.Net = Net;
})(typeof window !== 'undefined' ? window : globalThis);
