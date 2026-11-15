/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · RemoteWorkerTalk: other players' townsfolk (the 'person:' creatures RemoteMobs shows) can be clicked.
   Anyone of them talks ("Baker of Ann's town: …"); the shopkeepers (baker, butcher, alchemist, clerk) also open
   their owner's shop to trade, at the worker's spot. Their wolves, bears and raiders are not touched here. */
(function (G) {
  const K = G.K;

  class RemoteWorkerTalk {
    static TYPE = 'c_rworker';
    static RANGE = 2.4;
    static SHOPKEEPERS = new Set(['baker', 'butcher', 'alchemist', 'clerk']);
    static LINES = {
      baker: 'Fresh bread at {owner} market.',
      butcher: 'Good cuts of meat at {owner} market.',
      alchemist: 'Potions brewed for {owner} market.',
      clerk: 'Step up, everything at {owner} market is for sale.',
    };
    static DEFAULT_LINE = 'Busy keeping {owner} town going.';

    /** mark a remote creature's actor as a townsperson you can talk to (its owner's game runs it as a worker) */
    static mark(actor) { actor.type = RemoteWorkerTalk.TYPE; }

    /** hook the talk and trade menu into the interaction registry */
    static register(registry) {
      registry.register(RemoteWorkerTalk.TYPE, {
        color: 0xffe0a0,
        cursor: () => 'bubble',
        name: (actor) => actor.name,
        actions: (actor, play) => new RemoteWorkerTalk(play.ext).actions(actor),
      });
    }

    constructor(castle) { this.g = castle; }

    trade(actor) { return String(actor.name || '').toLowerCase(); }

    owner(actor) { return actor.mob ? actor.mob.owner : ''; }

    /** "Ann's", from their avatar or their market; "a settler's" when neither is known */
    ownerName(actor) {
      const id = this.owner(actor), mp = this.g.mp;
      const avatar = mp && mp.avatars && mp.avatars.by.get(id);
      const market = this.g.workers && this.g.workers.markets && this.g.workers.markets.get(id);
      const name = (avatar && avatar.name) || (market && market.name);
      return name ? name + "'s" : "a settler's";
    }

    line(actor) {
      const owner = this.ownerName(actor), said = RemoteWorkerTalk.LINES[this.trade(actor)] || RemoteWorkerTalk.DEFAULT_LINE;
      return `${actor.name} of ${owner} town: ${said.replace('{owner}', owner)}`;
    }

    sellsGoods(actor) { return RemoteWorkerTalk.SHOPKEEPERS.has(this.trade(actor)); }

    actions(actor) {
      const out = [{ id: 'talk', label: `Talk to the ${this.trade(actor)}`, icon: 'bubble', range: RemoteWorkerTalk.RANGE,
        run: () => this.talk(actor) }];
      if (this.sellsGoods(actor)) {
        out.push({ id: 'trade', label: `Trade with the ${this.trade(actor)}`, icon: 'coin', range: RemoteWorkerTalk.RANGE,
          run: () => this.openShop(actor) });
      }
      return out;
    }

    talk(actor) {
      this.g.cui.modal(`<h2>${this.escape(actor.name)}</h2><p>${this.escape(this.line(actor))}</p>`, [{ label: 'Thanks', pri: true }]);
    }

    /** their owner's shop, traded at the worker's spot (the server checks you stand near it) */
    openShop(actor) { this.g.workers.trade(this.owner(actor), { x: actor.x, z: actor.z }); }

    escape(text) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return String(text == null ? '' : text).replace(/[&<>"]/g, (c) => map[c]);
    }
  }

  RemoteWorkerTalk.register(K.Interactions);
  K.RemoteWorkerTalk = RemoteWorkerTalk;
})(typeof window !== 'undefined' ? window : globalThis);
