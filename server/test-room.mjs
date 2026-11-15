// quick end-to-end check of the room: node server/test-room.mjs ws://127.0.0.1:8799/ws/test-<random>
const url = process.argv[2] || 'ws://127.0.0.1:8799/ws/test-' + Math.random().toString(36).slice(2, 8);
const mk = (cid, name) => new Promise((res) => { const ws = new WebSocket(url), log = []; ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid, name })); ws.onmessage = (e) => log.push(JSON.parse(e.data)); res({ ws, log }); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const a = await mk('aaaaaaaa-1', 'Ann'); await wait(400);
a.ws.send(JSON.stringify({ t: 'op', op: { k: 'piece+', id: 'p1', type: 'palisade', x: 10, z: 12, rot: 0 } }));
a.ws.send(JSON.stringify({ t: 'op', op: { k: 'tile', i: 3, j: 4, h: 4, te: 2 } }));
await wait(200);
const b = await mk('bbbbbbbb-2', 'Bo'); await wait(400);
a.ws.send(JSON.stringify({ t: 'pos', x: 5, z: 6, y: 0, f: 1, s: 'run', tool: 'axe' }));
b.ws.send(JSON.stringify({ t: 'pos', x: 9, z: 9, y: 0, f: 0, s: 'idle', tool: 'sword' }));
a.ws.send(JSON.stringify({ t: 'chat', text: 'hello' }));
await wait(600);
const w = b.log.find((m) => m.t === 'welcome');
console.log('A welcome slot', a.log.find((m) => m.t === 'welcome').slot, '| B slot', w.slot, '| B sees players', w.players.length, '| pieces', Object.keys(w.world.pieces).length, 'tiles', Object.keys(w.world.tiles).length, '| claimed', w.claimed.length);
console.log('B got tick', b.log.some((m) => m.t === 'tick'), '| chat', b.log.some((m) => m.t === 'chat'), '| A saw join', a.log.some((m) => m.t === 'join'));
const c = await mk('aaaaaaaa-1', 'Ann'); await wait(400); console.log('A rejoin keeps slot', c.log.find((m) => m.t === 'welcome').slot);
process.exit(0);
