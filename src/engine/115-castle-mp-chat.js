/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerChat extends K.MultiplayerDemand {
    update(dt) {
      this.t += dt;
         this.avatars.update(dt);
         this.world.flush();
         this.stores.flush();
         this.farms.update(dt);
        this.exits();
      if ((this.syncT -= dt) <= 0) { this.syncT = 12;
         this.net.send({ t: 'sync', v: this.ver });
        }   // catch up on anything missed
      if ((this.mobT -= dt) <= 0) { this.mobT = 0.2;
         this.castMobs();
        }
      for (const r of this.world.doors.values()) r.door.update(dt);
      for (const r of this.world.pieces.values()) if (r.gate) r.gate.update(dt);
      const d = this.g.home.door;
         if (this.lastOpen !== d.open) { if (this.lastOpen !== null) this.net.send({ t: 'open', slot: this.g.L.slot, open: d.open });
         this.lastOpen = d.open;
        }
      if (this.lastBroken !== d.broken) { if (this.lastBroken !== null) this.net.send({ t: 'doorstate', broken: d.broken });
         this.lastBroken = d.broken;
        }
      if (this.t >= 0.1) {
        this.t = 0;
          const me = this.g.play.me, d = me.view.dir;
        this.net.send({ t: 'pos',
           x: +me.x.toFixed(2),
           z: +me.z.toFixed(2),
           y: +(me.y || 0).toFixed(2),
           f: +Math.atan2(d.z,
           d.x).toFixed(2),
           s: me.view.state,
           tool: this.g.tools.tool.id,
          hp: Math.round(this.g.play.player.hp) });
      }
    }
    /** Enter opens a chat line;
      Enter sends it, Esc closes */
    makeChatBox() {
      const el = (this.chat = document.createElement('div'));
         el.id = 'cChat';
         el.hidden = true;
         el.innerHTML = '<input maxlength="140" placeholder="Say something…" autocomplete="off">';
        this.g.cui.root.appendChild(el);
      const input = el.querySelector('input');
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
      input.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Escape') this.closeChat();
        else if (event.key === 'Enter') {
          const text = input.value.trim();
          if (text) {
            this.net.send({ t: 'chat', text });
            this.g.cui.toast(`You: ${text}`);
          }
          this.closeChat();
        }
      });
    }
    closeChat() { this.chat.hidden = true;
       this.chat.querySelector('input').value = '';
      }
    key(e) { if (e.key === 'Enter' && this.chat.hidden) { this.chat.hidden = false;
       setTimeout(() => this.chat.querySelector('input').focus(), 0);
       return true;
       } return false;
      }
    get chatOpen() { return !this.chat.hidden;
      }
    dispose() { this.net.close();
       this.avatars.dispose();
       this.mobs.dispose();
       this.farms.dispose();
       this.chat.remove();
       this.board.dispose();
      }
  }
  K.MultiplayerChat = MultiplayerChat;
})(typeof window !== 'undefined' ? window : globalThis);
