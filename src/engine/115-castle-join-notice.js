/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · JoinNotice: when the shared world can't be joined (it is full, or the server can't be reached), say so
   plainly and let the player try again or play alone, instead of dropping them silently into a solo world. */
(function (G) {
  const K = G.K;

  class JoinNotice {
    static MAX = 30;

    constructor(doc = G.document) {
      this.doc = doc;
    }

    /** the words for a failed join: { title, text } */
    message(error) {
      const code = error && error.code, max = (error && error.max) || JoinNotice.MAX;
      if (code === 'full') {
        return { title: 'This world is full', text: `This world is full right now (${max} settlers online). Try again in a moment.` };
      }
      const why = (error && error.message) || 'no answer';
      return { title: 'Could not reach the others', text: `The shared world did not answer (${why}). Try again, or play alone for now.` };
    }

    /** show the card; resolves to 'retry' or 'alone' */
    ask(error) {
      const { title, text } = this.message(error), doc = this.doc;
      return new Promise((resolve) => {
        const root = doc.createElement('div');
        root.id = 'cNameGate';
        root.className = 'cJoinNotice';
        root.innerHTML = '<div class="ng"><h2></h2><p></p><button data-act="retry">Try again</button>'
          + '<button data-act="alone" class="alone">Play alone</button></div>';
        root.querySelector('h2').textContent = title;
        root.querySelector('p').textContent = text;
        for (const button of root.querySelectorAll('button')) {
          button.addEventListener('click', () => { root.remove(); resolve(button.dataset.act); });
        }
        doc.body.appendChild(root);
      });
    }
  }

  K.JoinNotice = JoinNotice;
})(typeof window !== 'undefined' ? window : globalThis);
