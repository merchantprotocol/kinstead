/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerDemand extends K.MultiplayerTeams {
    playerMenu(a) {
      const g = this.g, id = a.id.replace(/^pl:/, ''), mine = this.teamId(this.me), buttons = [];
      if (this.mayUse(id)) buttons.push({ label: 'Leave my team', run: () => this.net.send({ t: 'team', a: 'leave' }) });
        else buttons.push({ label: 'Invite to my team', run: () => { this.net.send({ t: 'team', a: 'invite', to: id }); g.cui.toast(`Invited ${a.name}.`); } });
      buttons.push({ label: 'Demand tribute…', run: () => this.demandStep1(id, a.name) });
        buttons.push({ label: 'Close', pri: true });
      const message = this.mayUse(id)
        ? 'On your team: you share every key.'
        : 'A stranger. Left-click attacks them; right-click opens this. Invite them to share keys, or demand tribute if they are close.';
      g.cui.modal(
        `<h2>${K.NetText.escape(a.name)}</h2><p>${message}</p>`,
        buttons
      );
    }
    demandStep1(id, name) { const g = this.g, res = ['wood', 'stone', 'iron', 'food', 'gold'];
       g.cui.modal(`<h2>Demand tribute from ${K.NetText.escape(name)}</h2><p>What do you want?</p>`,
          res.map((r) => ({ label: K.CastleData.resName(r),
          run: () => this.demandStep2(id,
          name,
          r) })).concat([{ label: 'Never mind',
         pri: true }]));
      }
    demandStep2(id, name, res) { const g = this.g;
       g.cui.modal(`<h2>How much ${K.NetText.escape(K.CastleData.resName(res).toLowerCase())}?</h2>`,
          [10,
          25,
          50,
          100].map((n) => ({ label: String(n),
          run: () => { this.net.send({ t: 'demand',
          to: id,
          res,
          n }); g.cui.toast(`You demand ${n} ${K.CastleData.resName(res).toLowerCase()} from ${name}.`); } })).concat([{ label: 'Never mind',
         pri: true }]));
      }
    onDemand(m) {
      const g = this.g, c = g.castle, nm = K.CastleData.resName(m.res).toLowerCase(), have = c.amount(m.res) >= m.n;
      const prompt = `<h2>${K.NetText.escape(m.name)} demands tribute</h2>` +
        `<p>They want <b>${m.n} ${nm}</b>. You have ${c.amount(m.res)}. ` +
        'Pay and they leave you be, or refuse.</p>';
      g.cui.modal(prompt,
        [
        { label: have ? `Pay ${m.n} ${nm}` : 'Cannot afford',
           run: () => { if (c.spend({ [m.res]: m.n })) { this.net.send({ t: 'pay',
           to: m.from,
           res: m.res,
          n: m.n });
           g.changed();
           g.cui.toast(`You paid ${m.name}.`);
           } else { this.net.send({ t: 'refuse', to: m.from });
          } } },
        { label: 'Refuse', pri: true, run: () => this.net.send({ t: 'refuse', to: m.from }) }]);
    }
    onPaid(m) { const g = this.g, got = g.castle.add(m.res, m.n);
       g.changed();
       g.cui.toast(`${m.name} paid you ${m.n} ${K.CastleData.resName(m.res).toLowerCase()}${got < m.n ? ' (your store was full for the rest)' : ''}.`);
      }
    /** an invitation arrived: it waits beside the world map (and in your Team tab) until you answer */
  }
  K.MultiplayerDemand = MultiplayerDemand;
})(typeof window !== 'undefined' ? window : globalThis);
