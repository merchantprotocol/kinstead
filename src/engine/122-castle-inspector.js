/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Detail views for placed castle pieces and the resource bar. */
(function (G) {
  const K = G.K;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  class BuildingPanel {
    constructor(game) { this.g = game; this.c = game.castle; this.selected = null; this.root = document.createElement('div'); this.root.id = 'cInspector'; this.root.hidden = true; document.body.appendChild(this.root); this.click = (e) => this.onClick(e); this.root.addEventListener('click', this.click); this.key = (e) => { if (e.key === 'Escape' && !this.root.hidden) this.close(); }; document.addEventListener('keydown', this.key); }
    close() { this.root.hidden = true; this.selected = null; }
    open(title, icon, body) { const image = icon && String(icon).startsWith('<') ? icon : K.Icons.img(icon || 'eye', 3); this.root.innerHTML = `<section class="ci-shell"><header>${image}<h2>${esc(title)}<button data-close aria-label="Close">×</button></header><div class="ci-content">${body}</div></section>`; this.root.hidden = false; }
    piece(e) {
      const g = this.g, c = this.c, remote = e.type === 'c_rpiece', p = remote ? e.rec.p : e.piece, d = g.data.piece(p.type); if (!d) return;
      const peerOwners=g.mp&&g.mp.world&&g.mp.world.owners, legacyOwners=g.mp&&g.mp.owners; const owner = remote ? ((peerOwners&&peerOwners[e.rec.p.owner])||(legacyOwners&&legacyOwners[e.rec.p.owner])||'Another player') : 'You'; const banner = remote && g.mp ? g.mp.teamId(e.rec.p.owner) : null;
      const pr = remote ? null : c.producesOf(p), stock = remote ? {} : (g.economy ? g.economy.ledger(p).goods : {});
      const hpMax = g.pieceHpMax(p), statusRows = [`<div class="ci-row"><span>Owner</span><b>${esc(owner)}${banner!=null?` · Team ${esc(banner)}`:''}</b></div>`,`<div class="ci-row"><span>Health</span><b>${Number.isFinite(p.hp) ? Math.ceil(p.hp) : hpMax} / ${hpMax}</b></div>`,`<div class="ci-row"><span>Level</span><b>${p.level || 1}</b></div>`,`<div class="ci-row"><span>Condition</span><b>${remote ? 'Other player’s building' : c.isFrosted(p) ? 'Frosted — production stopped' : c.isFull(p) ? 'Full' : pr ? 'Working' : 'Idle'}</b></div>`], holdings = [];
      const keeper = !remote && p.gatekeeper, keeperTower = !remote && p.keeperGate;
      if (keeper) statusRows.push(`<div class="ci-row"><span>Archer</span><b>Gatekeeper</b></div>`);
      if (keeperTower) statusRows.push(`<div class="ci-row"><span>Role</span><b>Gatekeeper · ${esc(g.data.piece(keeperTower.type).name)}</b></div>`);
      if (pr) statusRows.push(`<div class="ci-row"><span>Producing</span><b>${Object.entries(pr).map(([r,n])=>`+${n} ${K.CastleData.resName(r)}/min`).join(', ')}</b></div>`);
      if (Object.keys(stock).length) holdings.push(`<div class="ci-row"><span>Stored</span><b>${Object.entries(stock).map(([r,n])=>`${n} ${K.CastleData.resName(r)}`).join(', ')}</b></div>`);
      if (!remote && ['coop','barn'].includes(p.type)) { const herd=g.economy.stock.herd(p), kind=p.type==='coop'?'hen':'cow'; holdings.push(`<div class="ci-row"><span>Animals</span><b>${herd.length} ${kind}${herd.length===1?'':'s'}</b></div>`); }
      if (!remote && g.workers) { const job=g.workers.jobs.find((item)=>item.p===p); if(job&&job.report) statusRows.push(`<div class="ci-row"><span>Worker</span><b>${esc(job.report().join(' '))}</b></div>`); }
      if (!remote) { const payback=c.upgradePayback(p); if(payback!=null) statusRows.push(`<div class="ci-row"><span>Upgrade payback</span><b>${payback.toFixed(1)} min</b></div>`); }
      const actions = [];
      if (!remote) {
        const up = c.upgradeInfo(p); if (up) { const blocker = c.upgradeBlocker(p), cost = c.upgradeCost(p), bad = c.missing(cost), benefit = up.produces ? Object.entries(up.produces).map(([r,n])=>`+${n-(pr&&pr[r]||0)} ${K.CastleData.resName(r)}/min`).join(', ') : 'Improved level benefits'; actions.push(`<section class="ci-action"><h3>Upgrade</h3><p>${esc(benefit)}</p><div>${Object.entries(cost).map(([r,n])=>`<span class="${bad[r]?'poor':'enough'}">${n} ${K.CastleData.resName(r)} (have ${c.amount(r)})${bad[r]?` · need ${bad[r]} more`:''}</span>`).join(' · ')}</div>${blocker?`<p>${esc(blocker)}</p>`:''}<button data-upgrade ${(Object.keys(bad).length||blocker)?'disabled':''}>Upgrade</button></section>`); } else actions.push('<p>This building cannot be upgraded.</p>');
        if (c.canDemolish(p)) { const refund=c.refundFor(p), label=Object.entries(refund).map(([r,n])=>`${n} ${K.CastleData.resName(r)}`).join(', ')||'nothing'; actions.push(`<section class="ci-danger"><h3>Take down</h3><p>Refund: ${esc(label)}</p><button data-takedown>Take down…</button></section>`); }
      }
      const available = g.actionsFor(e).filter((a) => !['inspect', 'demolish', 'upgrade'].includes(a.id));
      if (available.length) actions.unshift(`<section class="ci-action"><h3>Options</h3>${available.map((a) => `<button data-building-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</section>`);
      if (!remote && ['coop', 'barn'].includes(p.type)) actions.unshift(this.orderHtml(p));
      this.selected={e,p,remote,available}; this.open(d.name,this.g.cui.art.html(p.type,K.CastleUI.PIECE_ICON[p.type],84),` <p>${esc(d.effect||K.CastleUI.SHORT[p.type]||'A castle building.')}</p><h3>How it’s doing</h3>${statusRows.join('')}<h3>What it holds</h3>${holdings.join('')||'<p>Nothing is stored here yet.</p>'}${actions.join('')}`);
    }
    orderHtml(p) {
      const orders=this.g.economy.stock.orders, order=orders.get(p), herd=this.g.economy.stock.herd(p);
      const kind=p.type==='coop'?'chicken':'cow', price=K.LIVESTOCK[kind].price;
      const waiting=herd.length>=order.target?'Target reached':this.g.economy.wheatHeld()<price?'Paused: not enough wheat':`Next purchase in ${Math.max(0,Math.ceil(order.remaining))}s`;
      return `<section class="ci-action"><h3>Buy regularly</h3><p>Keep ${kind}s at ${order.target} · ${esc(waiting)}</p><button data-order-target="${order.target-1}" ${order.target<=1?'disabled':''}>−</button><button data-order-target="${order.target+1}" ${order.target>=K.LIVESTOCK[kind].max?'disabled':''}>+</button><button data-order-toggle>${order.enabled?'Turn off':'Turn on'} · ${price} wheat each</button></section>`;
    }
    material(id) {
      const c=this.c,d=c.data, name=K.CastleData.resName(id), caps=c.caps(), producers=d.pieceIds().map(t=>d.piece(t)).filter(p=>p&&p.produces&&p.produces[id]).map(p=>`${p.name}: +${p.produces[id]}/min`);
      const nodes=['tree','boulder','rubble','iron_rock'].map(k=>d.node(k)).filter(n=>n&&n.yields&&n.yields[id]).map(n=>`${n.name||id}: ${Object.values(n.yields).find(Boolean)} per gather`);
      const uses=d.pieceIds().flatMap(t=>{const cost=c.buildCost(t); return cost[id]?[`${d.piece(t).name}: ${cost[id]} to build`]:[]});
      const special=id==='troll_heart'?'<p>Defeat the Rime Troll to earn its heart; bind it at the Keep to raise the hearth and unlock the next thaw.</p>':'';
      const materials=[...new Set([...K.CastleUI.RES_ORDER,'troll_heart'])];
      const body=`<div class="ci-row"><span>In storage</span><b>${c.amount(id)} / ${caps[id] == null?'—':caps[id]}</b></div><h3>How to get more</h3><p>${esc([...nodes,...producers].join(' · ')||'No direct source is defined in the game data.')}</p>${special}<h3>Used for</h3><p>${esc(uses.join(' · ')||'No building costs list this material.')}</p><nav>${materials.map(r=>`<button data-material="${r}">${esc(K.CastleData.resName(r))}</button>`).join('')}</nav>`;
      this.open(name,K.CastleUI.ICON[id],body);
    }
    onClick(e) { if(e.target.closest('[data-close]')) return this.close(); const toggle=e.target.closest('[data-order-toggle]'), target=e.target.closest('[data-order-target]'); if((toggle||target)&&this.selected&&!this.selected.remote){const s=this.selected, orders=this.g.economy.stock.orders, o=orders.get(s.p); orders.configure(s.p,toggle?{enabled:!o.enabled}:{target:+target.dataset.orderTarget}); this.piece(s.e); this.g.changed(); return;} const action=e.target.closest('[data-building-action]'); if(action && this.selected){const a=this.selected.available.find((x)=>x.id===action.dataset.buildingAction); if(a)this.g.play.doAction(this.selected.e,a,false); return;} const m=e.target.closest('[data-material]'); if(m)return this.material(m.dataset.material); if(e.target.closest('[data-upgrade]')){if(this.selected&&!this.selected.remote){this.g.upgrade(this.selected.p);this.piece(this.selected.e);}} if(e.target.closest('[data-takedown]')){const s=this.selected;if(!s||s.remote)return;const refund=this.c.refundFor(s.p),text=Object.entries(refund).map(([r,n])=>`${n} ${K.CastleData.resName(r)}`).join(', ')||'nothing';this.g.cui.modal(`<h2>Take down ${esc(this.g.data.piece(s.p.type).name)}?</h2><p>Refund: ${esc(text)}. This cannot be undone.</p>`,[{label:'Keep it',pri:true},{label:'Yes, take it down',run:()=>{if(this.g.demolishPiece(s.p)){this.close();}}}]);} }
    dispose(){document.removeEventListener('keydown',this.key);this.root.remove();}
  }
  K.BuildingPanel=BuildingPanel;
})(typeof window !== 'undefined' ? window : globalThis);
