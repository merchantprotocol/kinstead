/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* TeamSync: who is on whose team, the keys that follow from it, and the invitations waiting for an answer. */
(function (G) {
  const K = G.K;

  class TeamSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      const welcome = this.net.welcome || {};
      this.teams = welcome.teams || [];
      this.invites = (welcome.invites || []).slice();
      this.board = new K.InviteBoard(this);
      this.net.on('teams', (m) => this.setTeams(m.list));
      this.net.on('invite', (m) => this.onInvite(m));
      this.net.on('invites', (m) => this.onInvites(m));
      this.net.on('declined', (m) => this.onDeclined(m));
    }

    /** the members of your team (including you), with their colours */
    teamRoster() {
      const tid = this.teamId(this.mp.me);
      if (!tid) return [];
      const team = this.teams.find((t) => t.id === tid);
      const members = team ? team.members : [];
      return members.map((id) => ({ id, name: this.memberName(id), color: this.g.banners.get(id).color }));
    }

    memberName(id) {
      if (id === this.mp.me) return 'You';
      const avatar = this.mp.avatars.by.get(id) || {};
      return avatar.name || this.mp.world.owners[id] || 'a settler';
    }

    teamId(id) {
      for (const team of this.teams) {
        if (team.members.includes(id)) return team.id;
      }
      return null;
    }

    /** do you hold the key for something this settler owns? (yours, or your team's) */
    mayUse(owner) {
      if (!owner || owner === this.mp.me) return true;
      const mine = this.teamId(this.mp.me);
      return !!mine && mine === this.teamId(owner);
    }

    setTeams(list) {
      this.teams = list || [];
      for (const [id, avatar] of this.mp.avatars.by) avatar.el.classList.toggle('ally', this.mayUse(id));
    }

    /** an invitation arrived: it waits beside the world map (and in your Team tab) until you answer */
    onInvite(m) {
      this.invites = this.invites.filter((invite) => invite.team !== m.team);
      this.invites.push(m);
      this.invitesChanged();
      this.g.cui.toast(`${m.name} invites you to join ${m.teamName}.`);
      this.g.sound.play('fanfare');
    }

    onInvites(m) {
      this.invites = m.list || [];
      this.invitesChanged();
    }

    onDeclined(m) {
      this.g.cui.toast(`${m.name} declined your invitation to ${m.teamName}.`);
    }

    invitesChanged() {
      this.board.render();
      this.g.purse.refreshTeam();
    }

    acceptInvite(team) {
      const invite = this.invites.find((x) => x.team === team);
      this.net.send({ t: 'team', a: 'accept', team });
      this.dropInvite(team);
      if (invite) this.g.cui.toast(`You joined ${invite.teamName}. You share their keys and fly their banner.`);
    }

    declineInvite(team) {
      this.net.send({ t: 'team', a: 'decline', team });
      this.dropInvite(team);
    }

    dropInvite(team) {
      this.invites = this.invites.filter((x) => x.team !== team);
      this.invitesChanged();
    }

    dispose() {
      this.board.dispose();
    }
  }

  K.TeamSync = TeamSync;
})(typeof window !== 'undefined' ? window : globalThis);
