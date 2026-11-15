/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · SmallTalk: two workers passing in the street now and then stop, face each other and pass the time of day.
   Small talk only: nothing they say makes a promise about the game. */
(function (G) {
  const K = G.K;

  class SmallTalk {
    constructor(workers) { this.w = workers; this.t = 1; }
    static LINES = [['Morning!', 'Morning to you.'], ['Cold one today.', 'Keep moving, it helps.'], ['Busy day?', 'Always.'],
      ['How goes it?', 'Can’t complain.'], ['Mind the wolves tonight.', 'I’ll be in before dark.'], ['Nice work yesterday.', 'Thanks, friend.']];
    update(dt) { if ((this.t -= dt) > 0) return; this.t = 0.5; this.match(); }
    /** pick one pair walking past each other (each only every 40 s) */
    match() {
      const W = this.w, now = W.clock;
      const live = W.jobs.filter((j) => j.a && !j.a.hidden && j.a.view.state === 'walk' && !(j.a.chatT > 0) && (j.talkedT || 0) < now);
      for (let i = 0; i < live.length; i++) for (let k = i + 1; k < live.length; k++) {
        const A = live[i], B = live[k]; if (K.WorkSpots.dist(A.a, B.a) > 1.6 || Math.random() > 0.5) continue;
        this.chat(A, B, now); return;
      }
    }
    chat(A, B, now) {
      const W = this.w, [l1, l2] = SmallTalk.LINES[Math.floor(Math.random() * SmallTalk.LINES.length)]; A.talkedT = B.talkedT = now + 40;
      for (const [x, y] of [[A, B], [B, A]]) { x.a.chatT = 2.6; x.a.chatWith = y.a; x.a.path = null; }
      W.say(A.a, l1, 2.6); W.later(0.9, () => W.say(B.a, l2, 2.4));
    }
  }

  K.SmallTalk = SmallTalk;
})(typeof window !== 'undefined' ? window : globalThis);
