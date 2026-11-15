const url = 'ws://127.0.0.1:8799/ws/tg-' + Math.random().toString(36).slice(2, 8);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mk = (cid, name) => new Promise((res) => { const ws = new WebSocket(url), log = []; ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid, name })); ws.onmessage = (e) => log.push(JSON.parse(e.data)); res({ ws, log, send: (m) => ws.send(JSON.stringify(m)), last: (t) => log.filter((m) => m.t === t).pop() }); });
const A = await mk('aaaaaaaa-1', 'Ann'), B = await mk('bbbbbbbb-2', 'Bo'); await wait(600);
A.send({ t: 'op', op: { k: 'piece+', id: 'p:aaaaaaaa:1', type: 'gate', x: 10, z: 10, rot: 0 } }); await wait(200);
B.send({ t: 'open', id: 'p:aaaaaaaa:1', open: true }); await wait(300); console.log('stranger:', JSON.stringify(B.last('locked')), JSON.stringify(B.last('gate')));
A.send({ t: 'banner', b: { name: 'T', color: 1, logo: 1 } }); await wait(200); A.send({ t: 'team', a: 'invite', to: 'bbbbbbbb' }); await wait(300); const inv = B.last('invite'); B.send({ t: 'team', a: 'accept', team: inv.team }); await wait(400);
B.log.length = 0; B.send({ t: 'open', id: 'p:aaaaaaaa:1', open: true }); await wait(300); console.log('teammate:', JSON.stringify(B.last('locked')), JSON.stringify(B.last('gate')));
process.exit(0);
