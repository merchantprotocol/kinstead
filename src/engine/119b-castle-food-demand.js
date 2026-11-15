/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* FoodDemand owns town rations, supply estimates and hunger state. */
(function (G) {
  const K = G.K;

  class FoodDemand {
    constructor(economy) {
      this.economy = economy;
      this.elapsed = 0;
      this.emptyFor = 0;
      this.rationOrder = ['bread', 'beef', 'egg', 'milk', 'food', 'wheat'];
    }

    get game() { return this.economy.g; }
    get population() {
      const workers = this.game.workers ? this.game.workers.roster().length : 0;
      return workers + 1;
    }

    consume(personCount = this.population) {
      const sources = this.sources();
      let fed = 0;
      for (let person = 0; person < personCount; person++) {
        const source = this.rationOrder.find((good) => sources.amount(good) >= 1);
        if (!source) break;
        sources.take(source);
        fed++;
      }
      this.emptyFor = fed === personCount ? 0 : this.emptyFor + 60;
      this.economy.changed('food');
      return { fed, hungry: personCount - fed };
    }

    sources() {
      const castle = this.game.castle;
      return {
        amount: (good) => this.amount(good),
        take: (good) => this.take(castle, good),
      };
    }

    amount(good) {
      const castle = this.game.castle;
      let amount = castle.amount(good);
      for (const piece of this.economy.pieces) amount += this.economy.ledger(piece).amount(good);
      return amount;
    }

    take(castle, good) {
      if (castle.amount(good) > 0) {
        castle.stores[good]--;
        return true;
      }
      for (const piece of this.economy.pieces) {
        if (this.economy.ledger(piece).take(good, 1)) return true;
      }
      return false;
    }

    update(dt) {
      this.elapsed += dt;
      while (this.elapsed >= 60) {
        this.elapsed -= 60;
        this.consume();
      }
    }

    starving() { return this.emptyFor >= 120; }

    snapshot() {
      const rates = this.game.castle.rates();
      const livestock = this.economy.stock.all;
      const eggs = livestock.filter((animal) => animal.kind === 'chicken' && animal.fed).length;
      const milk = livestock.filter((animal) => animal.kind === 'cow' && animal.fed).length / 2;
      const bakeries = this.economy.of('bakery').length;
      const fieldWheat = this.economy.fields.tiles.size / 3;
      const netWheat = Math.max(0, fieldWheat - milk);
      const bread = Math.min(bakeries * 12, netWheat / 1.5);
      const wheatLeft = Math.max(0, netWheat - bread * 1.5);
      const made = (rates.food || 0) + eggs + milk + bread + wheatLeft;
      const eaten = this.population;
      const available = this.rationOrder.reduce((total, good) => total + this.amount(good), 0);
      return { made, eaten, minutesLeft: eaten ? available / eaten : Infinity, population: this.population,
        starving: this.starving() };
    }
  }

  K.FoodDemand = FoodDemand;
})(typeof window !== 'undefined' ? window : globalThis);
