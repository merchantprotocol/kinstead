const url = process.argv[2] || 'ws://127.0.0.1:8799/ws/pvp-' + Math.random().toString(36).slice(2, 8);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mk = (cid, name) => new Promise((res) => { const ws = new WebSocket(url), log = []; ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid, name })); ws.onmessage = (e) => log.push(JSON.parse(e.data)); const o = { ws, log, send: (m) => ws.send(JSON.stringify(m)), has: (t, f) => log.some((m) => m.t === t && (!f || f(m))) }; res(o); });
const A = await mk('aaaaaaaa-1', 'Ann'), B = await mk('bbbbbbbb-2', 'Bo'); await wait(500);
const aid = 'aaaaaaaa', bid = 'bbbbbbbb';
A.send({ t: 'pos', x: 10, z: 12, y: 0, f: 0, s: 'idle', tool: 'sword' }); B.send({ t: 'pos', x: 11, z: 12, y: 0, f: 0, s: 'idle', tool: 'warhammer' });
A.send({ t: 'op', op: { k: 'piece+', id: aid + ':1', type: 'gate', x: 10, z: 13, rot: 0 } }); await wait(300);
B.send({ t: 'open', id: aid + ':1', open: true }); await wait(300); console.log('stranger opens gate -> locked:', B.has('locked'), '| gate msg:', B.has('gate'));
A.send({ t: 'open', id: aid + ':1', open: true }); await wait(300); console.log('owner opens gate -> gate msg:', B.has('gate'));
B.send({ t: 'op', op: { k: 'piece-', id: aid + ':1' } }); await wait(300); console.log('stranger forged piece- blocked (no op to A):', !A.has('op', (m) => m.op.k === 'piece-'));
B.send({ t: 'team', a: 'invite', to: aid }); await wait(300); const inv = A.log.find((m) => m.t === 'invite'); console.log('A got invite', !!inv);
A.send({ t: 'team', a: 'accept', team: inv.team }); await wait(300); console.log('teams broadcast', JSON.stringify(B.log.filter((m) => m.t === 'teams').pop().list.map((t) => t.members.length)));
B.send({ t: 'open', id: aid + ':1', open: false }); await wait(300); console.log('teammate may use key:', B.log.filter((m) => m.t === 'gate').length >= 2);
B.send({ t: 'team', a: 'leave' }); await wait(300);
for (let i = 0; i < 40; i++) { B.send({ t: 'hit', id: aid + ':1', tool: 'warhammer' }); await wait(310); if (A.has('op', (m) => m.op.k === 'piece-' && m.op.broken)) { console.log('gate broken after', i + 1, 'hits'); break; } }
B.send({ t: 'demand', to: aid, res: 'wood', n: 20 }); await wait(300); console.log('A got demand', A.has('demand', (m) => m.n === 20));
A.send({ t: 'pay', to: bid, res: 'wood', n: 20 }); await wait(300); console.log('B got payment', B.has('paid', (m) => m.res === 'wood' && m.n === 20));
B.send({ t: 'install', slot: 0 }); await wait(300); console.log('install on an unbroken door ignored:', !B.has('door', (m) => m.owner === bid));
process.exit(0);
