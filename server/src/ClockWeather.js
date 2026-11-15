import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class ClockWeather {
  clock() { return { epoch: this.epoch, now: Date.now(), day: ServerConfig.CYCLE.day, night: ServerConfig.CYCLE.night }; }
  weather() { const period = Math.floor((Date.now() - this.epoch) / 1000 / ServerConfig.WEATHER_SEC);
  return { kind: ServerConfig.weatherFor(period,
  this.seed),
  period,
  until: this.epoch + (period + 1) * ServerConfig.WEATHER_SEC * 1000 };
  }
  validRespawn(p) { const r = this.respawns[p.cid]; return r && this.mayRespawn(p, r.slot) ? r : null; }
  /** whether this settler may sleep in, and wake in, the house on this plot */
  mayRespawn(p, slot) { const d = this.world.doors[slot]; return !!d && !d.broken && !!d.owner && this.mayUse(p, d.owner); }

  install(room) {
    for (const method of ['clock', 'weather', 'validRespawn', 'mayRespawn']) room[method] = this[method].bind(room);
  }
}
