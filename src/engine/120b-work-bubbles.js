/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · TalkBubbles: speech over a worker's head. A little bubble that follows them for a few seconds, then goes. */
(function (G) {
  const K = G.K;

  class TalkBubbles {
    constructor(game) {
      this.g = game; this.live = [];
      this.root = document.createElement('div'); this.root.id = 'cTalk';
      (game.cui && game.cui.root ? game.cui.root : document.body).appendChild(this.root);
    }
    /** a bubble over actor a for t seconds (a new line replaces the one they are saying) */
    say(a, text, t = 3) {
      if (!a || a.hidden) return;
      const old = this.live.find((b) => b.a === a); if (old) { old.el.textContent = text; old.t = t; return; }
      const el = document.createElement('div'); el.className = 'wk-say'; el.textContent = text; this.root.appendChild(el);
      this.live.push({ a, el, t });
    }
    update(dt) { this.live = this.live.filter((b) => this.follow(b, dt)); }
    /** keep one bubble over its speaker; false once it is done */
    follow(b, dt) {
      if ((b.t -= dt) <= 0 || !b.a.view || b.a.hidden) { b.el.remove(); return false; }
      const h = (b.a.y || 0) + (b.a.view.h || 1.4) + 0.3, [x, y, front] = this.g.play.toScreen(b.a.x, h, b.a.z);
      b.el.style.display = front ? '' : 'none';
      b.el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
      return true;
    }
    dispose() { for (const b of this.live) b.el.remove(); this.live = []; this.root.remove(); }
  }

  K.TalkBubbles = TalkBubbles;
})(typeof window !== 'undefined' ? window : globalThis);
