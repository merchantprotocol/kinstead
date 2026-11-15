// Copyright (c) 2026 Merchant Protocol. All rights reserved.
import { ServerConfig } from './ServerConfig.js';

/** Read-only head count for one map (GET /ws/<map>/stats): who is online and how many plots are held. No identities. */
export class RoomStats {
  constructor(room) {
    this.room = room;
  }

  snapshot() {
    const room = this.room, max = ServerConfig.MAX_PLAYERS;
    const held = new Set(Object.values(room.plots).map((plot) => plot.slot).filter((slot) => slot >= 0 && slot < max));
    for (const slot of Object.keys(room.world.houses)) held.add(Number(slot));
    const online = room.online().length;
    const recyclable = room.plotRecycler.candidates(max).length;
    return { online, max, plotsUsed: held.size, plotsFree: max - held.size, recyclable, full: held.size >= max && !recyclable };
  }

  response() {
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
    return new Response(JSON.stringify(this.snapshot()), { headers });
  }

  install(room) {
    room.roomStats = new RoomStats(room);
  }
}
