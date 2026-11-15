/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;
  const FIELD = 'flex:1;border:1px solid #c9d1dd;border-radius:7px;padding:4px 6px;min-width:0';

  /* inspector rows for a selected prop: rotation, scale, and for characters their hero, role, look and name */
  class PropInspector {
    constructor(app, object) { this.app = app; this.o = object; this.def = K.PropBuilder.PROPS[object.type] || {}; }
    html() {
      const o = this.o, def = this.def, rot = o.rot || 0, scale = o.s || 1;
      let h = '<div class="row"><span>Rotation</span>'
        + `<input type="range" min="-3.15" max="3.15" step="0.05" value="${rot}" data-o="rot"><span class="val">${Math.round(rot * 57.3)}°</span></div>`;
      h += '<div class="row"><span>Scale</span>'
        + `<input type="range" min="0.3" max="2.5" step="0.05" value="${scale}" data-o="s"><span class="val">${scale.toFixed(2)}</span></div>`;
      if (def.sprite) h += `<div class="row"><span>Face left</span><input type="checkbox" data-o="flip" ${o.flip ? 'checked' : ''}></div>`;
      if (def.start) h += this.heroRows();
      else if (def.sprite) h += this.characterRows();
      if (def.interact) h += this.resourceHelp();
      return h + '<div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>';
    }
    options(key, pairs, current) {
      const opts = pairs.map(([k, n]) => `<option value="${k}" ${current === k ? 'selected' : ''}>${n}</option>`).join('');
      return `<select data-o="${key}" data-str="1">${opts}</select>`;
    }
    heroRows() {
      const heroes = [['warden', 'The Warden'], ['witch', 'Rime Witch']];
      return `<div class="row"><span>Hero</span>${this.options('hero', heroes, this.o.hero || 'warden')}</div>`
        + '<p class="help">Play mode starts the player here. One per world.</p>';
    }
    characterRows() {
      const o = this.o, def = this.def, role = K.PropBuilder.roleOf(o);
      const roles = [['enemy', 'Enemy'], ['npc', 'Friendly NPC'], ['merchant', 'Merchant']];
      const looks = this.app.renderer.lib.defs.map((d) => [d.id, d.name]);
      const fallback = role === 'merchant' ? 'Merchant' : (K.BESTIARY[def.sprite] || {}).name || def.name;
      return `<div class="row"><span>Role</span>${this.options('role', roles, role)}</div>`
        + `<div class="row"><span>Look</span>${this.options('look', looks, K.PropBuilder.spriteOf(o))}</div>`
        + `<div class="row"><span>Name</span><input type="text" data-o="name" data-str="1" value="${U.escapeHtml(o.name || '')}" `
        + `placeholder="${U.escapeHtml(fallback)}" style="${FIELD}"></div>`
        + '<p class="help">Enemies fight, friendly NPCs talk, merchants talk and trade. Their ring shows the role while editing.</p>';
    }
    resourceHelp() {
      const verb = ({ ore: 'mine it', tree: 'chop it', herb: 'gather it', fish: 'fish here' })[this.def.interact] || 'use it';
      return `<p class="help">Resource node: in play mode the player can ${verb}. It runs out and regrows.</p>`;
    }
  }
  K.PropInspector = PropInspector;
})(typeof window !== 'undefined' ? window : globalThis);
