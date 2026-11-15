/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Gatekeeper: pairs a nearby tower with an owned gate and applies its access policy. */
(function (G) {
  const K = G.K;

  /* Who the gate opens for: only players. Your own hero (on the ground, not up on the walls) and your teammates'
     heroes open it; workers, kin, townsfolk and animals never do (carts and couriers route round gates anyway).
     Creatures that fight (wolves, bears, raiders) keep it shut; a player outside your team never opens it, and it
     shuts at once behind you when one is waiting, but they can't lock you out of your own castle. */
  class GatePolicy {
    constructor(options = {}) {
      this.manualSeconds = options.manualSeconds || 20;
      this.passSeconds = options.passSeconds || 2;
      this.range = options.range || 5.5;
    }
    isTower(type) { return type === 'watchtower' || type === 'stone_tower'; }
    isGate(type) { return type === 'gate' || type === 'stone_gate'; }
    near(actor, gate, range = this.range) {
      return !!actor && actor.alive !== false && Math.hypot(actor.x - gate.x, actor.z - gate.z) <= range;
    }
    /** a player (not a worker, kin or animal) who may come through: your own hero or a teammate's */
    friendly(actor, game) {
      if (!actor || actor.alive === false || actor.hostile) return false;
      if (actor === game.play.me) return !this.aloft(actor);
      if (!actor.remote || !actor.pid || !game.mp) return false;
      return !!game.mp.mayUse(actor.pid);
    }
    /** up on the walls or a tower stair: over the gate, not at it */
    aloft(actor) { return actor.layer === 'upper' || actor.layer === 'stair'; }
    /** a player outside your team */
    stranger(actor, game) {
      return !!actor && actor.alive !== false && !!actor.remote && !!actor.pid && !!game.mp && !game.mp.mayUse(actor.pid);
    }
    /** a creature that fights: wolves, bears, raiders (grazing deer and other prey don't count) */
    threat(actor) { return !!actor && actor.alive !== false && !!actor.hostile && !actor.prey && !actor.pid; }
    avatars(game) { return game.mp ? [...game.mp.avatars.by.values()].map((record) => record.a).filter(Boolean) : []; }
    nearbyFriendly(gate, game) {
      if (this.friendly(game.play.me, game) && this.near(game.play.me, gate)) return true;
      return this.avatars(game).some((actor) => this.friendly(actor, game) && this.near(actor, gate));
    }
    nearbyStranger(gate, game) { return this.avatars(game).some((actor) => this.stranger(actor, game) && this.near(actor, gate)); }
    nearbyHostile(gate, game) { return game.play.actors.some((actor) => this.threat(actor) && this.near(actor, gate)); }
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
        if (this.policy.nearbyHostile(gate, this.g) || this.policy.night(this.g)) { this.set(gate, false); state.away = 0; continue; }
        if (state.manualUntil > this.g.play.t) continue;
        if (this.policy.nearbyFriendly(gate, this.g)) { this.set(gate, true); state.away = 0; continue; }
        if (!gate.bridge.open) continue;
        state.away += dt;
        if (state.away >= this.policy.passSeconds || this.policy.nearbyStranger(gate, this.g)) this.set(gate, false);
      }
    }
  }

  K.GatePolicy = GatePolicy;
  K.GateKeeper = GateKeeper;
})(typeof window !== 'undefined' ? window : globalThis);
