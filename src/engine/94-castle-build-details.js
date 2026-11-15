/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Castle build-detail dialog. It reads current castle data and delegates placement back to CastleUI. */
(function (G) {
  const K = G.K;

  class BuildDetailsDialog {
    constructor(ui) {
      this.ui = ui;
      this.castle = ui.c;
      this.root = ui.$('cModal');
      this.handleClick = (event) => this.onClick(event);
      this.root.addEventListener('click', this.handleClick);
    }

    dispose() {
      this.root.removeEventListener('click', this.handleClick);
      this.close();
    }

    isOpen() {
      return !this.root.hidden && !!this.root.querySelector('.build-detail');
    }

    handleKey(event) {
      if (!this.isOpen()) return false;
      if (event.key === 'Escape') this.close();
      return event.key === 'Escape' || event.key === 'Enter';
    }

    open(card) {
      if (!card) return;
      this.card = card;
      this.root.innerHTML = this.render();
      this.root.hidden = false;
    }

    close() {
      if (this.isOpen()) this.root.hidden = true;
      this.card = null;
    }

    onClick(event) {
      if (event.target === this.root || event.target.closest('[data-detail-close]')) {
        this.close();
        return;
      }
      if (!event.target.closest('[data-detail-build]')) return;
      const card = this.card;
      this.close();
      this.ui.activateCard(card);
    }

    render() {
      const card = this.card;
      const data = this.castle.data.piece(card.id) || {};
      const cost = card.cost || {};
      const shortage = this.shortages(cost);
      const canBuild = this.ui.cards().out.some((entry) => entry.id === card.id && entry.kind === card.kind);
      const requirements = this.requirements(data);
      const priceRule = this.priceRule(card);
      const button = canBuild ? 'Build' : 'Not available yet';
      const verdict = shortage.length
        ? `Missing: ${shortage.join(', ')}`
        : canBuild ? 'You can build this' : `Not buildable yet${card.why ? ` · ${card.why}` : ''}`;
      const verdictClass = shortage.length || !canBuild ? 'short' : 'enough';
      return `<div class="build-detail" role="dialog" aria-modal="true">
        <button class="cb detail-x" data-detail-close aria-label="Close details">×</button>
        <div class="detail-head">${this.art(card)}<div><h2>${this.escape(card.name)}</h2>
          <p>${this.escape(this.description(card))}</p></div></div>
        <h3>Materials</h3>${this.materialRows(cost)}
        <p class="detail-verdict ${verdictClass}">${this.escape(verdict)}</p>
        <h3>What it does</h3>${this.production(data)}${this.payback(card)}${this.durability(data)}
        ${this.effect(data, card)}${this.castlePoints(data)}
        <p><b>Requirements:</b> ${requirements}</p>${priceRule}
        <button class="cb pri detail-build" data-detail-build ${canBuild ? '' : 'disabled'}>${button}</button>
      </div>`;
    }

    art(card) {
      return this.ui.art.html(card.art || card.id, card.icon, 76);
    }

    description(card) {
      const data = this.castle.data.piece(card.id) || {};
      return data.description || K.CastleUI.SHORT[card.id] || card.line || '';
    }

    effect(data, card) {
      const description = this.description(card);
      let effect = data.effect || '';
      if (description && effect.startsWith(description)) {
        effect = effect.slice(description.length).replace(/^[.\s]+/, '');
      }
      if (!effect) return '';
      return `<p>${this.escape(effect)}</p>`;
    }

    materialRows(cost) {
      const rows = Object.entries(cost).map(([resource, needed]) => {
        const have = this.castle.amount(resource);
        const enough = have >= needed;
        const status = enough ? 'enough' : 'short';
        const amount = enough ? '✓' : `· need ${needed - have} more`;
        const icon = K.CastleUI.ICON[resource] || resource;
        return `<div class="detail-cost ${status}">
          <span>${K.Icons.img(icon, 1)} ${this.escape(K.CastleData.resName(resource))}</span>
          <b>${needed}</b><span>You have ${have} ${amount}</span>
        </div>`;
      });
      return rows.join('') || '<p>No materials required.</p>';
    }

    shortages(cost) {
      return Object.entries(cost)
        .filter(([resource, needed]) => this.castle.amount(resource) < needed)
        .map(([resource, needed]) => `${needed - this.castle.amount(resource)} ${K.CastleData.resName(resource)}`);
    }

    production(data) {
      if (!data.produces) return '';
      const goods = Object.entries(data.produces).map(([resource, amount]) =>
        `${amount} ${K.CastleData.resName(resource)}/min`);
      return `<p><b>Production:</b> ${goods.join(', ')}</p>`;
    }

    payback(card) {
      if (card.pb == null) return '';
      const discount = card.kind === 'upgrade' && this.castle.has('smithy');
      return `<p><b>Payback:</b> ${card.pb.toFixed(1)} min${discount ? ' (Smithy discount)' : ''}</p>`;
    }

    durability(data) {
      return data.hp ? `<p><b>Durability:</b> ${data.hp} HP</p>` : '';
    }

    castlePoints(data) {
      return data.castlePoints ? `<p><b>Castle points:</b> ${data.castlePoints}</p>` : '';
    }

    requirements(data) {
      const prerequisites = (data.buildRequires || []).map((id) => this.castle.data.piece(id).name);
      const parts = [`Castle Level ${data.requiresCastleLevel || 1}`].concat(prerequisites);
      if (data.requiresZone) parts.push(data.requiresZone.replaceAll('_', ' '));
      if (data.maxCount) parts.push(`max ${data.maxCount}`);
      return this.escape(parts.join(' · '));
    }

    priceRule(card) {
      const copies = this.castle.pieces.filter((piece) => piece.type === card.id).length;
      const flat = K.Castle.FLAT.has(card.id);
      if (card.kind !== 'place' || flat || copies === 0) return '';
      return `<p><b>Price rule:</b> extra copies cost 1.6× more; this is copy ${copies + 1}’s current price.</p>`;
    }

    escape(value) {
      return String(value == null ? '' : value).replace(/[&<>"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      })[character]);
    }
  }

  K.BuildDetailsDialog = BuildDetailsDialog;
})(typeof window !== 'undefined' ? window : globalThis);
