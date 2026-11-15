/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const { Identity } = G.K;
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
  G.K.NameGate = NameGate;
})(typeof window !== 'undefined' ? window : globalThis);
