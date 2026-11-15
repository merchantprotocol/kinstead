/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  class CastleSound {
    constructor() { this.ctx = null;
      this.vol = 0.35;
      }
    unlock() { try { if (!this.ctx) { const AC = G.AudioContext || G.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.ctx = null;
      } }
    tone(freq, dur, { type = 'sine', vol = 1, at = 0, slide = 0 } = {}) {
      const c = this.ctx;
        if (!c || c.state !== 'running') return;
      try {
        const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
        o.type = type;
          o.frequency.setValueAtTime(freq, t);
          if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
        g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(this.vol * vol, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(c.destination);
          o.start(t);
          o.stop(t + dur + 0.05);
      } catch (e) { /* audio is decoration */ }
    }
    noise(dur, { vol = 1, at = 0, freq = 800 } = {}) {
      const c = this.ctx;
        if (!c || c.state !== 'running') return;
      try {
        const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
        f.type = 'lowpass';
          f.frequency.value = freq;
          g.gain.value = this.vol * vol;
          s.buffer = b;
          s.connect(f).connect(g).connect(c.destination);
          s.start(t);
      } catch (e) { /* decoration */ }
    }
    play(name) {
      switch (name) {
        case 'pop': this.tone(880, 0.09, { type: 'triangle', vol: 0.5, slide: 1.4 });
          break;
        case 'gather': this.noise(0.08, { vol: 0.5, freq: 1400 });
          this.tone(520, 0.07, { type: 'triangle', vol: 0.3 });
          break;
        case 'thunk': this.noise(0.18, { vol: 1.2, freq: 260 });
          this.tone(110, 0.2, { type: 'sine', vol: 0.9, slide: 0.6 });
          break;
        case 'whump': this.noise(0.6, { vol: 1.3, freq: 500 });
          this.tone(70, 0.5, { vol: 0.8, slide: 1.8 });
          this.chime(0.25);
          break;
        case 'chime': this.chime(0);
          break;
        case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.5, at: i * 0.12 }));
          break;
        case 'horn': this.tone(147, 1.4, { type: 'sawtooth', vol: 0.25 });
          this.tone(220, 1.2, { type: 'sawtooth', vol: 0.15, at: 0.15 });
          break;
        case 'clank': this.tone(1250, 0.15, { type: 'square', vol: 0.15 });
          this.noise(0.12, { vol: 0.6, freq: 3000 });
          break;
        case 'hit': this.noise(0.07, { vol: 0.6, freq: 1800 });
          break;
        case 'swish': this.noise(0.16, { vol: 0.55, freq: 3200 });
          this.tone(420, 0.14, { type: 'sawtooth', vol: 0.12, slide: 0.4 });
          break;
        case 'roar': this.tone(90, 1.1, { type: 'sawtooth', vol: 0.4, slide: 0.6 });
          this.noise(0.9, { vol: 0.8, freq: 400 });
          break;
        case 'crack': this.noise(0.35, { vol: 1, freq: 4200 });
          this.tone(1800, 0.2, { type: 'triangle', vol: 0.3, slide: 0.5 });
          break;
        case 'thaw': [392, 523, 659, 784, 988, 1175].forEach((f, i) => this.tone(f, 1.2, { vol: 0.35, at: i * 0.18 }));
          break;
      }
    }
    chime(at) { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.6, { vol: 0.4, at: at + i * 0.09 }));
      }
  }
  K.CastleSound = CastleSound;
})(typeof window !== 'undefined' ? window : globalThis);
