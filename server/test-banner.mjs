const url = process.argv[2] || 'ws://127.0.0.1:8799/ws/ban-' + Math.random().toString(36).slice(2, 8);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mk = (cid, name) => new Promise((res) => { const ws = new WebSocket(url), log = []; ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', cid, name })); ws.onmessage = (e) => log.push(JSON.parse(e.data)); res({ ws, log, send: (m) => ws.send(JSON.stringify(m)), last: (t) => log.filter((m) => m.t === t).pop() }); });
const A = await mk('aaaaaaaa-1', 'Ann'), B = await mk('bbbbbbbb-2', 'Bo'), C = await mk('cccccccc-3', 'Cy'); await wait(600);
A.send({ t: 'banner', b: { name: 'Frost Wolves', color: 5, logo: 4 } }); B.send({ t: 'banner', b: { name: 'Lone Bo', color: 2, logo: 7 } }); await wait(300);
console.log('B own banner', JSON.stringify(B.last('banners').map.bbbbbbbb));
C.send({ t: 'team', a: 'invite', to: 'bbbbbbbb' }); await wait(300); const inv0 = B.last('invite'); B.send({ t: 'team', a: 'accept', team: inv0.team }); await wait(300);
console.log('B joined Cy team (old banner replaced):', JSON.stringify(B.last('banners').map.bbbbbbbb));
A.send({ t: 'team', a: 'invite', to: 'bbbbbbbb' }); await wait(300); const inv = B.last('invite'); console.log('invite carries team name', inv.teamName);
B.send({ t: 'team', a: 'accept', team: inv.team }); await wait(300);
const bb = B.last('banners').map.bbbbbbbb; console.log('B now flies A banner:', bb.name, bb.color, bb.logo, 'team', !!bb.team);
const aa = A.last('banners').map.aaaaaaaa; console.log('A banner unchanged', aa.name, aa.color, aa.logo);
A.send({ t: 'banner', b: { name: 'Frost Wolves II', color: 6, logo: 1 } }); await wait(300); console.log('team edit reaches B:', B.last('banners').map.bbbbbbbb.name);
// pvp
A.send({ t: 'pos', x: 10, z: 10, y: 0, f: 0, s: 'idle', tool: 'sword' }); C.send({ t: 'pos', x: 11, z: 10, y: 0, f: 0, s: 'idle', tool: 'sword' }); await wait(200);
C.send({ t: 'pvp', to: 'aaaaaaaa', tool: 'sword' }); await wait(300); console.log('stranger hit lands on A:', JSON.stringify(A.last('pvphit')));
C.send({ t: 'pvp', to: 'bbbbbbbb', tool: 'sword' }); await wait(300); console.log('C->B (B on A team, not C):', !!B.last('pvphit'));
B.send({ t: 'pvp', to: 'aaaaaaaa', tool: 'sword' }); await wait(300); console.log('teammates cannot hit each other:', !A.log.some((m) => m.t === 'pvphit' && m.from === 'bbbbbbbb'));
process.exit(0);
