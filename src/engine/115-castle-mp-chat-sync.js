/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* ChatSync: Enter opens a chat line, Enter sends it, Esc closes; other people's lines show as toasts and speech. */
(function (G) {
  const K = G.K;

  class ChatSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.el = this.build();
      this.input = this.el.querySelector('input');
      this.net.on('chat', (m) => this.onChat(m));
    }

    build() {
      const el = document.createElement('div');
      el.id = 'cChat';
      el.hidden = true;
      el.innerHTML = '<input maxlength="140" placeholder="Say something…" autocomplete="off">';
      this.g.cui.root.appendChild(el);
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.querySelector('input').addEventListener('keydown', (event) => this.onKeyDown(event));
      return el;
    }

    onKeyDown(event) {
      event.stopPropagation();
      if (event.key === 'Escape') this.close();
      else if (event.key === 'Enter') this.submit();
    }

    submit() {
      const text = this.input.value.trim();
      if (text) {
        this.net.send({ t: 'chat', text });
        this.g.cui.toast(`You: ${text}`);
      }
      this.close();
    }

    onChat(m) {
      if (m.from === this.net.id) return;
      this.g.cui.toast(`${m.name}: ${m.text}`);
      this.mp.avatars.say(m.from, m.text);
    }

    close() {
      this.el.hidden = true;
      this.input.value = '';
    }

    /** the game's key handler asks first; true means the key was used to open chat */
    key(event) {
      if (event.key !== 'Enter' || !this.el.hidden) return false;
      this.el.hidden = false;
      setTimeout(() => this.input.focus(), 0);
      return true;
    }

    get isOpen() {
      return !this.el.hidden;
    }

    dispose() {
      this.el.remove();
    }
  }

  K.ChatSync = ChatSync;
})(typeof window !== 'undefined' ? window : globalThis);
