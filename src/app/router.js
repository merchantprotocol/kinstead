/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · page routing between the static pages: index.html (menu), builder.html, play.html, lab.html. */
(function (G) {
  const K = (G.K = G.K || {});

  class Router {
    static PAGES = { menu: 'index.html', lab: 'lab.html', builder: 'builder.html', play: 'play.html' };

    /* location: an object with assign(url) and search (window.location, or a recorder in tests) */
    constructor(location) { this.location = location; }

    url(page, params) {
      const file = Router.PAGES[page]; if (!file) throw new Error('Unknown page: ' + page);
      const qs = params ? Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
      return file + (qs ? '?' + qs : '');
    }
    go(page, params) { const u = this.url(page, params); this.location.assign(u); return u; }
    param(name) {
      try { return new URLSearchParams(this.location.search || '').get(name); } catch (e) { return null; }
    }
  }

  K.Router = Router;
})(typeof window !== 'undefined' ? window : globalThis);
