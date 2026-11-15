/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Gatekeeper: pairs a nearby tower with an owned gate and applies its access policy. */
(function (G) {
  const K = G.K;

  class GatePolicy {
    constructor(options = {}) { this.manualSeconds = options.manualSeconds || 20; this.passSeconds = options.passSeconds || 2; }
    isTower(type) { return type === 'watchtower' || type === 'stone_tower'; }
    isGate(type) { return type === 'gate' || type === 'stone_gate'; }
    near(actor, gate, range) { return !!actor && actor.alive !== false && Math.hypot(actor.x - gate.x, actor.z - gate.z) <= range; }
    friendly(actor, game) {
      if (!actor || actor.alive === false || actor.hostile) return false;
      if (!actor.remote) return true;
      const id = actor.pid || String(actor.id || '').replace(/^pl:/, '');
      return !!(id && game.mp && game.mp.mayUse(id));
    }
    nearbyFriendly(gate, game) {
      return game.play.actors.some((a) => this.friendly(a, game) && this.near(a, gate, 5.5));
    }
    nearbyHostile(gate, game) {
      if (game.play.actors.some((a) => a && a.alive !== false && a.hostile && this.near(a, gate, 5.5))) return true;
      if (!game.mp) return false;
      return [...game.mp.avatars.by.values()].some((r) => r.a && !game.mp.mayUse(r.a.pid) && this.near(r.a, gate, 5.5));
    }
    night(game) { return game.day.isNight; }
  }

  class GateKeeper {
    constructor(game, policy = new GatePolicy()) { this.g = game; this.policy = policy; this.states = new Map(); }
    gates() { return this.g.castle.pieces.filter((p) => this.policy.isGate(p.type) && p.bridge); }
    towers() { return this.g.castle.pieces.filter((p) => this.policy.isTower(p.type) && p.hp > 0); }
    nearestTower(gate) {
      return this.towers().map((tower) => ({ tower, distance: Math.hypot(tower.x - gate.x, tower.z - gate.z) }))
        .filter((entry) => entry.distance <= 8).sort((a, b) => a.distance - b.distance)[0]?.tower || null;
    }
    state(gate) {
      if (!this.states.has(gate.uid)) this.states.set(gate.uid, { manualUntil: 0, away: 0, tower: null });
      return this.states.get(gate.uid);
    }
    refresh() {
      const active = new Set();
      for (const tower of this.towers()) tower.keeperGate = null;
      for (const gate of this.gates()) {
        const state = this.state(gate); state.tower = this.nearestTower(gate); gate.gatekeeper = state.tower;
        if (state.tower) { active.add(gate.uid); state.tower.keeperGate = gate; }
      }
      for (const gate of this.g.castle.pieces.filter((p) => this.policy.isGate(p.type))) {
        if (!active.has(gate.uid)) { gate.gatekeeper = null; this.states.delete(gate.uid); }
      }
    }
    manual(gate) {
      if (!gate.gatekeeper) return;
      const state = this.state(gate); state.manualUntil = this.g.play.t + this.policy.manualSeconds; state.away = 0;
    }
    set(gate, open) {
      if (gate.bridge.open === open) return;
      if (!open && gate.bridge.occupied()) return;
      gate.bridge.open = open; gate.bridge.away = 0; gate.bridge.apply();
      if (this.g.mp) this.g.mp.gate(gate, open);
    }
    update(dt) {
      this.refresh();
      for (const gate of this.gates()) {
        const state = this.state(gate); if (!state.tower) continue;
        const hostile = this.policy.nearbyHostile(gate, this.g), friendly = this.policy.nearbyFriendly(gate, this.g);
        if (hostile || this.policy.night(this.g)) { this.set(gate, false); state.away = 0; continue; }
        if (state.manualUntil > this.g.play.t) continue;
        if (friendly) { this.set(gate, true); state.away = 0; }
        else if (gate.bridge.open) {
          state.away += dt;
          if (state.away >= this.policy.passSeconds) this.set(gate, false);
        }
      }
    }
  }

  K.GatePolicy = GatePolicy;
  K.GateKeeper = GateKeeper;
})(typeof window !== 'undefined' ? window : globalThis);
