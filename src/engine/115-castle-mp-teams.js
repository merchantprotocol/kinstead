/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerTeams extends K.MultiplayerCombat {
    teamRoster() {
      const tid = this.teamId(this.me);
         if (!tid) return [];
        const t = this.teams.find((x) => x.id === tid);
      return (t ? t.members : []).map((id) => ({ id,
         name: id === this.me ? 'You' : (this.avatars.by.get(id) || {}).name || this.world.owners[id] || 'a settler',
        color: this.g.banners.get(id).color }));
    }
    teamId(id) { for (const t of this.teams) if (t.members.includes(id)) return t.id;
       return null;
      }
    /** do you hold the key for something this settler owns? (yours, or your team's) */
    mayUse(owner) { return !owner || owner === this.me || (!!this.teamId(this.me) && this.teamId(this.me) === this.teamId(owner));
      }
    setTeams(list) { this.teams = list;
       for (const [id, r] of this.avatars.by) r.el.classList.toggle('ally', this.mayUse(id));
      }
    onInvite(m) { this.invites = this.invites.filter((x) => x.team !== m.team);
       this.invites.push(m);
       this.invitesChanged();
       this.g.cui.toast(`${m.name} invites you to join ${m.teamName}.`);
       this.g.sound.play('fanfare');
      }
    invitesChanged() { this.board.render();
       this.g.purse.refreshTeam();
      }
    acceptInvite(team) { const inv = this.invites.find((x) => x.team === team);
       this.net.send({ t: 'team', a: 'accept', team });
       this.invites = this.invites.filter((x) => x.team !== team);
       this.invitesChanged();
       if (inv) this.g.cui.toast(`You joined ${inv.teamName}. You share their keys and fly their banner.`);
      }
    declineInvite(team) { this.net.send({ t: 'team', a: 'decline', team });
       this.invites = this.invites.filter((x) => x.team !== team);
       this.invitesChanged();
      }
    /** the game reports its own changes here */
  }
  K.MultiplayerTeams = MultiplayerTeams;
})(typeof window !== 'undefined' ? window : globalThis);
