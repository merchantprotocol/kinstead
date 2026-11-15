# Kinstead realtime server

One Cloudflare Durable Object (`GameRoom`) per map. It assigns each player a plot (30 per map), relays positions, and keeps the
shared world edits (pieces, terrain, felled trees, buildings) so new players see the same world.

```bash
cd server
npx wrangler dev --port 8799      # local, then: node test-room.mjs
npx wrangler deploy               # publish (a new Worker named kinstead-rooms)
```

After deploying, set `Net.DEFAULT` in `src/engine/115-castle-net.js` to the Worker's `wss://…workers.dev` address (or open the game with `?server=wss://…`;
`?server=off` plays alone). Wolves and bears run in each player's own game; only their owner sees them.
