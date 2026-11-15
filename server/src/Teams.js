import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class Teams {
  teamOf(id) { for (const t of Object.values(this.teams)) if (t.members.includes(id)) return t.id; return null; }
  sameTeam(a, b) { const t = this.teamOf(a); return !!t && t === this.teamOf(b); }
  mayUse(p, owner) { return !owner || owner === p.id || this.sameTeam(p.id, owner); }
  teamList() { return Object.values(this.teams).map((t) => ({ id: t.id, name: t.name, members: t.members, banner: t.banner })); }
  saveTeams() { this.state.storage.put('teams', this.teams); this.broadcast({ t: 'teams', list: this.teamList() }); }
  byId(id) { for (const [ws, q] of this.sockets) if (q.joined && q.id === id) return [ws, q]; return [null, null]; }
  near(a, b, m) { return Math.hypot(a.x - b.x, a.z - b.z) <= m; }
  leaveTeam(p) { const tid = this.teamOf(p.id);
  if (!tid) return;
  const t = this.teams[tid];
  t.members = t.members.filter((x) => x !== p.id);
  if (!t.members.length) delete this.teams[tid];
  }
  onTeam(p, m) {
    if (m.a === 'create') { if (this.teamOf(p.id)) return; this.makeTeam(p); this.saveTeams(); this.pushBanners([p.id]); }
    else if (m.a === 'invite') {
      let tid = this.teamOf(p.id); if (!tid) { tid = this.makeTeam(p); this.saveTeams(); this.pushBanners([p.id]); }
      const [ws, q] = this.byId(m.to); if (!q || q === p || this.teamOf(m.to) === tid) return;
      const t = this.teams[tid], inv = { team: tid, from: p.id, name: p.name, teamName: t.banner.name || t.name, banner: t.banner, at: Date.now() };
      const list = (this.invites[m.to] = (this.invites[m.to] || []).filter((x) => x.team !== tid));
      list.push(inv);
      if (list.length > 12) list.shift();
      this.state.storage.put('invites', this.invites);
      // kept until answered, even if they log off
      if (ws) this.send(ws, Object.assign({ t: 'invite' }, inv));
    } else if (m.a === 'decline') {
      const inv = (this.invites[p.id] || []).find((x) => x.team === m.team); this.dropInvite(p.id, m.team);
      if (inv) { const [ws] = this.byId(inv.from); if (ws) this.send(ws, { t: 'declined', name: p.name, teamName: inv.teamName }); }
    } else if (m.a === 'accept') {
      const t = this.teams[m.team]; this.dropInvite(p.id, m.team); if (!t || t.members.includes(p.id)) return;
      const old = this.teamOf(p.id), oldMembers = old ? this.teams[old].members.slice() : []; this.leaveTeam(p);   // a team you were on before is left behind
      t.members.push(p.id); this.saveTeams(); this.pushBanners([...t.members, ...oldMembers]);   // you now fly the team's name, colour and logo
    } else if (m.a === 'leave') { const old = this.teamOf(p.id), mem = old ? this.teams[old].members.slice() : [];
    this.leaveTeam(p);
    this.saveTeams();
    this.pushBanners(mem);
    }
  }
  dropInvite(id, team) { const l = this.invites[id];
  if (!l) return;
  this.invites[id] = l.filter((x) => x.team !== team && this.teams[x.team]);
  this.state.storage.put('invites',
  this.invites);
  this.byId(id)[0] && this.send(this.byId(id)[0],
  { t: 'invites',
  list: this.invites[id] });
  }
  /** a team starts out flying its founder's banner */
  makeTeam(p) { const id = 't' + Math.random().toString(36).slice(2,
  7),
  b = this.resolved(p.id);
  this.teams[id] = { id,
  name: b.name || p.name + "'s company",
  members: [p.id],
  banner: { name: b.name || p.name + "'s company",
  color: b.color,
  logo: b.logo } };
  return id;
  }

  install(room) {
    const methods = [
      'teamOf', 'sameTeam', 'mayUse', 'teamList', 'saveTeams', 'byId', 'near',
      'leaveTeam', 'onTeam', 'dropInvite', 'makeTeam',
    ];
    for (const method of methods) room[method] = this[method].bind(room);
  }
}
