/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* TributeSync: the menu on another player, and demanding or paying tribute. */
(function (G) {
  const K = G.K;

  class TributeSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.resources = ['wood', 'stone', 'iron', 'food', 'gold'];
      this.amounts = [10, 25, 50, 100];
      this.net.on('demand', (m) => this.onDemand(m));
      this.net.on('paid', (m) => this.onPaid(m));
      this.net.on('refused', (m) => this.g.cui.toast(`${m.name} refused to pay.`));
    }

    resName(res) {
      return K.CastleData.resName(res).toLowerCase();
    }

    playerMenu(actor) {
      const id = actor.id.replace(/^pl:/, '');
      const ally = this.mp.mayUse(id);
      const buttons = [this.teamButton(id, actor.name, ally)];
      buttons.push({ label: 'Demand tribute…', run: () => this.chooseResource(id, actor.name) });
      buttons.push({ label: 'Close', pri: true });
      const message = ally
        ? 'On your team: you share every key.'
        : 'A stranger. Left-click attacks them; right-click opens this. Invite them to share keys, or demand tribute if they are close.';
      this.g.cui.modal(`<h2>${K.NetText.escape(actor.name)}</h2><p>${message}</p>`, buttons);
    }

    teamButton(id, name, ally) {
      if (ally) return { label: 'Leave my team', run: () => this.net.send({ t: 'team', a: 'leave' }) };
      return { label: 'Invite to my team', run: () => this.invite(id, name) };
    }

    invite(id, name) {
      this.net.send({ t: 'team', a: 'invite', to: id });
      this.g.cui.toast(`Invited ${name}.`);
    }

    chooseResource(id, name) {
      const buttons = this.resources.map((res) => ({
        label: K.CastleData.resName(res),
        run: () => this.chooseAmount(id, name, res),
      }));
      buttons.push({ label: 'Never mind', pri: true });
      this.g.cui.modal(`<h2>Demand tribute from ${K.NetText.escape(name)}</h2><p>What do you want?</p>`, buttons);
    }

    chooseAmount(id, name, res) {
      const buttons = this.amounts.map((n) => ({ label: String(n), run: () => this.demand(id, name, res, n) }));
      buttons.push({ label: 'Never mind', pri: true });
      this.g.cui.modal(`<h2>How much ${K.NetText.escape(this.resName(res))}?</h2>`, buttons);
    }

    demand(id, name, res, n) {
      this.net.send({ t: 'demand', to: id, res, n });
      this.g.cui.toast(`You demand ${n} ${this.resName(res)} from ${name}.`);
    }

    onDemand(m) {
      const castle = this.g.castle;
      const name = this.resName(m.res);
      const have = castle.amount(m.res);
      const prompt = `<h2>${K.NetText.escape(m.name)} demands tribute</h2>` +
        `<p>They want <b>${m.n} ${name}</b>. You have ${have}. ` +
        'Pay and they leave you be, or refuse.</p>';
      this.g.cui.modal(prompt, [
        { label: have >= m.n ? `Pay ${m.n} ${name}` : 'Cannot afford', run: () => this.pay(m) },
        { label: 'Refuse', pri: true, run: () => this.refuse(m) },
      ]);
    }

    pay(m) {
      if (!this.g.castle.spend({ [m.res]: m.n })) {
        this.refuse(m);
        return;
      }
      this.net.send({ t: 'pay', to: m.from, res: m.res, n: m.n });
      this.g.changed();
      this.g.cui.toast(`You paid ${m.name}.`);
    }

    refuse(m) {
      this.net.send({ t: 'refuse', to: m.from });
    }

    onPaid(m) {
      const got = this.g.castle.add(m.res, m.n);
      this.g.changed();
      const full = got < m.n ? ' (your store was full for the rest)' : '';
      this.g.cui.toast(`${m.name} paid you ${m.n} ${this.resName(m.res)}${full}.`);
    }
  }

  K.TributeSync = TributeSync;
})(typeof window !== 'undefined' ? window : globalThis);
