/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · other people. 20 to 30 settlers share one map, each with their own plot to build on.
   The realtime server (server/, a Cloudflare Durable Object) hands every player a plot, relays where everyone is,
   and keeps the shared edits to the land (walls, gates, buildings, dug ground, felled trees) so whoever joins sees
   the same world. Wolves and bears are simulated by each player's own game and are only ever after their owner.
   With no server reachable (or none configured) the game simply runs alone on plot 0.
     Identity     who this browser is (an id it keeps, and the name you chose)
     NameGate     asks for your name the first time
     Net          the WebSocket: join, send, receive, reconnect
     RemoteWorld  applies everyone else's edits to your map
     Avatars      the other players, walking about, with name plates and speech
     Multiplayer  ties it to the running game, and sends your own position and edits */
(function (G) {
  const K = G.K;

  class NetText {
    static escape(value) {
      const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return String(value == null ? '' : value).replace(/[&<>"]/g, (character) => replacements[character]);
    }
  }



  /** other people's edits, applied to your map */








  K.NetText = NetText;
})(typeof window !== 'undefined' ? window : globalThis);
