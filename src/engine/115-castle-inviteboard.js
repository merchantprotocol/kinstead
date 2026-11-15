/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class InviteBoard {
    constructor(mp) {
      this.mp = mp;
         const root = (this.root = document.createElement('div'));
         root.id = 'cInvites';
        mp.g.cui.root.appendChild(root);
      root.addEventListener('pointerdown', (e) => e.stopPropagation());
      root.addEventListener('click', (event) => this.onClick(event));
    }
    static card(inv) {
      const b = inv.banner || {}, col = '#' + K.BANNER_COLORS[(b.color || 0) % 12].toString(16).padStart(6, '0');
      const emblem = `<i class="em" style="background:${col}">` +
        `<img src="${K.Emblems.url(b.logo || 0)}" alt=""></i>`;
      const invite = `<div class="t"><b>${K.NetText.escape(inv.name)}</b> invites you ` +
        `to join <b>${K.NetText.escape(inv.teamName)}</b></div>`;
      const actions = `<div class="ab"><button data-acc="${K.NetText.escape(inv.team)}" ` +
        `class="ok">Accept</button><button data-dec="${K.NetText.escape(inv.team)}">Decline</button></div>`;
      return `<div class="inv">${emblem}${invite}${actions}</div>`;
    }
    onClick(event) {
      const accept = event.target.closest('[data-acc]');
      const decline = event.target.closest('[data-dec]');
      if (accept) this.mp.acceptInvite(accept.dataset.acc);
      else if (decline) this.mp.declineInvite(decline.dataset.dec);
      else if (event.target.closest('[data-more]')) this.mp.g.purse.openTab('team');
    }

    render() {
      const list = this.mp.invites, show = list.slice(-3);
      const cards = show.map((invite) => InviteBoard.card(invite)).join('');
      const more = list.length > 3
        ? `<button class="more" data-more>${list.length - 3} more in your Team tab</button>`
        : '';
      this.root.innerHTML = cards + more;
      this.root.hidden = !list.length;
    }
    dispose() { this.root.remove();
      }
  }
  K.InviteBoard = InviteBoard;
})(typeof window !== 'undefined' ? window : globalThis);
