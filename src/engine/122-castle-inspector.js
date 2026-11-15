/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Detail views for placed castle pieces and the resource bar. */
(function (G) {
  const K = G.K;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  class CastleInspector {
    constructor(game) { this.g = game; this.c = game.castle; this.selected = null; this.root = document.createElement('div'); this.root.id = 'cInspector'; this.root.hidden = true; document.body.appendChild(this.root); this.click = (e) => this.onClick(e); this.root.addEventListener('click', this.click); this.key = (e) => { if (e.key === 'Escape' && !this.root.hidden) this.close(); }; document.addEventListener('keydown', this.key); }
    close() { this.root.hidden = true; this.selected = null; }
    open(title, icon, body) { const image = icon && String(icon).startsWith('<') ? icon : K.Icons.img(icon || 'eye', 3); this.root.innerHTML = `<section class="ci-shell"><header>${image}<h2>${esc(title)}<button data-close aria-label="Close">×</button></header><div class="ci-content">${body}</div></section>`; this.root.hidden = false; }
    piece(e) {
      const g = this.g, c = this.c, remote = e.type === 'c_rpiece', p = remote ? e.rec.p : e.piece, d = g.data.piece(p.type); if (!d) return;
      const owner = remote ? (g.mp && g.mp.world && g.mp.world.owners[e.rec.p.owner] || 'Another player') : 'You'; const banner = remote && g.mp ? g.mp.teamId(e.rec.p.owner) : null;
      const pr = remote ? null : c.producesOf(p), stock = remote ? {} : (g.economy && g.economy.stock && g.economy.stock.stock ? g.economy.stock.stock(p) : {});
      const hpMax = g.pieceHpMax(p), rows = [`<div class="ci-row"><span>Owner</span><b>${esc(owner)}${banner!=null?` · Team ${esc(banner)}`:''}</b></div>`,`<div class="ci-row"><span>Health</span><b>${Number.isFinite(p.hp) ? Math.ceil(p.hp) : hpMax} / ${hpMax}</b></div>`,`<div class="ci-row"><span>Level</span><b>${p.level || 1}</b></div>`,`<div class="ci-row"><span>Condition</span><b>${remote ? 'Other player’s building' : c.isFrosted(p) ? 'Frosted — production stopped' : 'Working'}</b></div>`];
      if (pr) rows.push(`<div class="ci-row"><span>Producing</span><b>${Object.entries(pr).map(([r,n])=>`+${n} ${K.CastleData.resName(r)}/min`).join(', ')}</b></div>`);
      if (Object.keys(stock).length) rows.push(`<div class="ci-row"><span>Stored</span><b>${Object.entries(stock).map(([r,n])=>`${n} ${K.CastleData.resName(r)}`).join(', ')}</b></div>`);
      const actions = [];
      if (!remote) {
        const up = c.upgradeInfo(p); if (up) { const blocker = c.upgradeBlocker(p), cost = c.upgradeCost(p), bad = c.missing(cost), benefit = up.produces ? Object.entries(up.produces).map(([r,n])=>`+${n-(pr&&pr[r]||0)} ${K.CastleData.resName(r)}/min`).join(', ') : 'Improved level benefits'; actions.push(`<section class="ci-action"><h3>Upgrade</h3><p>${esc(benefit)}</p><div>${Object.entries(cost).map(([r,n])=>`<span class="${bad[r]?'poor':'enough'}">${n} ${K.CastleData.resName(r)} (have ${c.amount(r)})${bad[r]?` · need ${bad[r]} more`:''}</span>`).join(' · ')}</div>${blocker?`<p>${esc(blocker)}</p>`:''}<button data-upgrade ${(Object.keys(bad).length||blocker)?'disabled':''}>Upgrade</button></section>`); } else actions.push('<p>This building cannot be upgraded.</p>');
        if (c.canDemolish(p)) { const refund=c.refundFor(p), label=Object.entries(refund).map(([r,n])=>`${n} ${K.CastleData.resName(r)}`).join(', ')||'nothing'; actions.push(`<section class="ci-danger"><h3>Take down</h3><p>Refund: ${esc(label)}</p><button data-takedown>Take down…</button></section>`); }
      }
      this.selected={e,p,remote}; this.open(d.name,this.g.cui.art.html(p.type,K.CastleUI.PIECE_ICON[p.type],84),` <p>${esc(d.effect||K.CastleUI.SHORT[p.type]||'A castle building.')}</p>${rows.join('')}${actions.join('')}`);
    }
    material(id) {
      const c=this.c,d=c.data, name=K.CastleData.resName(id), caps=c.caps(), producers=d.pieceIds().map(t=>d.piece(t)).filter(p=>p&&p.produces&&p.produces[id]).map(p=>`${p.name}: +${p.produces[id]}/min`);
      const nodes=['tree','boulder','rubble','iron_rock'].map(k=>d.node(k)).filter(n=>n&&n.yields&&n.yields[id]).map(n=>`${n.name||id}: ${Object.values(n.yields).find(Boolean)} per gather`);
      const uses=d.pieceIds().flatMap(t=>{const cost=c.buildCost(t); return cost[id]?[`${d.piece(t).name}: ${cost[id]} to build`]:[]});
      const body=`<div class="ci-row"><span>In storage</span><b>${c.amount(id)} / ${caps[id] == null?'—':caps[id]}</b></div><h3>How to get more</h3><p>${esc([...nodes,...producers].join(' · ')||'No direct source is defined in the game data.')}</p><h3>Used for</h3><p>${esc(uses.join(' · ')||'No building costs list this material.')}</p><nav>${K.CastleUI.RES_ORDER.map(r=>`<button data-material="${r}">${esc(K.CastleData.resName(r))}</button>`).join('')}</nav>`;
      this.open(name,K.CastleUI.ICON[id],body);
    }
    onClick(e) { if(e.target.closest('[data-close]')) return this.close(); const m=e.target.closest('[data-material]'); if(m)return this.material(m.dataset.material); if(e.target.closest('[data-upgrade]')){if(this.selected&&!this.selected.remote){this.g.upgrade(this.selected.p);this.piece(this.selected.e);}} if(e.target.closest('[data-takedown]')){const s=this.selected;if(!s||s.remote)return;const refund=this.c.refundFor(s.p),text=Object.entries(refund).map(([r,n])=>`${n} ${K.CastleData.resName(r)}`).join(', ')||'nothing';this.g.cui.modal(`<h2>Take down ${esc(this.g.data.piece(s.p.type).name)}?</h2><p>Refund: ${esc(text)}. This cannot be undone.</p>`,[{label:'Keep it',pri:true},{label:'Yes, take it down',run:()=>{if(this.g.demolishPiece(s.p)){this.close();}}}]);} }
    dispose(){document.removeEventListener('keydown',this.key);this.root.remove();}
  }
  K.CastleInspector=CastleInspector;
  const old=K.CastleGame.prototype.inspect;
  K.CastleGame.prototype.inspect=function(e){if(e.type==='c_piece'||e.type==='c_rpiece'){if(!this.inspector)this.inspector=new CastleInspector(this);return this.inspector.piece(e);}return old.call(this,e);};
  const oldDispose=K.CastleGame.prototype.dispose; if(oldDispose) K.CastleGame.prototype.dispose=function(){if(this.inspector)this.inspector.dispose();return oldDispose.apply(this,arguments);};
  const oldRender=K.BuildDrawer.prototype.resourcesHtml;
  K.BuildDrawer.prototype.resourcesHtml=function(){return oldRender.call(this).replace(/class="res ([^"]*)" data-r="([^"]+)"/g,'class="res $1" data-r="$2" role="button" tabindex="0"');};
  const oldCtor=K.BuildDrawer.prototype.constructor;
  // Attach delegation without modifying the build-list click path.
  const onDrawerClick=K.BuildDrawer.prototype.onClick;
  K.BuildDrawer.prototype.onClick=function(e){const r=e.target.closest('.res[data-r]'); if(r){this.g.inspector=this.g.inspector||new CastleInspector(this.g);this.g.inspector.material(r.dataset.r);return;}return onDrawerClick.call(this,e);};
})(typeof window !== 'undefined' ? window : globalThis);
