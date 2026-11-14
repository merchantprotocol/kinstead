/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Building editor integration. All changes use the builder's object history and serializer. */
(function(G){
const K=G.K,T=K.TILE, E=new K.BuildingEdit(), A=K.BuilderApp.prototype;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class BuildingTool {
 constructor(app,furniture=false){this.app=app;this.furniture=furniture;this.rot=0;this.chosen=null;}
 get doc(){return this.app.doc;}
 cursor(){return 'crosshair';} cancel(){this.drag=null;} up(){} dbl(){}
 candidate(p){if(!p)return null;const [i,j]=this.doc.tileOf(p.x,p.z);let b=K.makeBuilding(this.app.ui.prefab||'cottage',i,j,'preview',this.doc.seed);for(let k=0;k<this.rot;k++)b=E.rotate(b);b.x=i;b.z=j;return b;}
 hover(p){this.app.overlay.brush(null);if(!p){this.app.overlay.hov.visible=false;return;}let b=this.furniture?this.doc.obj(this.app.interiorId):this.candidate(p);if(!b)return;let pts=[];
 if(this.furniture){const [i,j]=this.doc.tileOf(p.x,p.z),def=K.FURNITURE[this.app.ui.furniture||'bed'],[w,h]=K.FurnitureFootprint.size(def,this.rot);const x=i*T,z=j*T;pts=[[x,z],[x+w*T,z],[x+w*T,z+h*T],[x,z+h*T],[x,z]];}
 else {this.app.overlay.poly([],false);this.app.overlay.setPts(this.app.overlay.hov,this.app.overlay.outline(b));return;}this.app.overlay.poly(pts,false);}
 move(e,p){this.hover(p);}
 down(e,p){if(!p)return;const app=this.app;
 if(!this.furniture){const b=this.candidate(p),err=E.placementProblems(this.doc,b);if(err.length)return app.toast(err[0]);app.commitObjects('place '+b.prefab,d=>{b.id=d.uid('b');d.objects.push(b);app.sel=b.id;});app.panel();return;}
 const b=this.doc.obj(app.interiorId);if(!b)return app.toast('Select a building, then Enter interior first.');const [i,j]=this.doc.tileOf(p.x,p.z),x=i-b.x,z=j-b.z;
 const old=E.furnitureAt(b,x,z);
 if(e.altKey){this.chosen=old&&old.id;if(old)this.rot=old.rot||0;app.panel();return;}
 const f=this.chosen?Object.assign({},b.furniture.find(v=>v.id===this.chosen),{x,z,rot:this.rot}):{id:E.nextFurnitureId(b),type:app.ui.furniture||'bed',x,z,rot:this.rot};
 const err=E.furnitureProblems(b,f);if(err.length)return app.toast(err[0]);app.commitObjects(this.chosen?'move furniture':'place furniture',()=>{const n=b.furniture.findIndex(v=>v.id===f.id);if(n<0)b.furniture.push(f);else b.furniture[n]=f;});this.chosen=null;app.panel();}
 key(e){const k=e.key.toLowerCase();if(k==='q'||k==='e'){this.rot=(this.rot+(k==='e'?1:3))%4;this.app.panel();this.hover(this.app.hoverP);return true;}if((k==='delete'||k==='backspace')&&this.chosen){this.remove();return true;}return false;}
 remove(){const b=this.doc.obj(this.app.interiorId);if(b&&this.chosen)this.app.commitObjects('remove furniture',()=>{b.furniture=b.furniture.filter(f=>f.id!==this.chosen);});this.chosen=null;this.app.panel();}
 options(){if(!this.furniture)return `<h2>Buildings</h2><select data-prefab>${Object.entries(K.BUILDING_PREFABS).map(([id,d])=>`<option value="${id}" ${(this.app.ui.prefab||'cottage')===id?'selected':''}>${esc(d.name)}</option>`).join('')}</select><p class="help">Click the footprint to place. Q/E rotates. Select a building to move, rotate, delete or enter its interior.</p><p>Rotation: ${this.rot*90}°</p>`;
 const b=this.doc.obj(this.app.interiorId);return `<h2>Interior furniture</h2><p>${b?esc(b.prefab):'Select a building first.'}</p><select data-furniture>${Object.entries(K.FURNITURE).map(([id,d])=>`<option value="${id}" ${(this.app.ui.furniture||'bed')===id?'selected':''}>${esc(d.group||'Decor')} · ${esc(d.name)}</option>`).join('')}</select><p class="help">Click to place. Q/E rotates. Alt-click an existing item, then click its new location. Delete removes the selected item.</p>${this.chosen?'<button class="b" data-remove>Remove selected furniture</button>':''}<button class="b" data-exit>Leave interior</button>`;}
 bind(root){const p=root.querySelector('[data-prefab]');if(p)p.onchange=()=>{this.app.ui.prefab=p.value;};const f=root.querySelector('[data-furniture]');if(f)f.onchange=()=>{this.app.ui.furniture=f.value;this.chosen=null;};const r=root.querySelector('[data-remove]');if(r)r.onclick=()=>this.remove();const x=root.querySelector('[data-exit]');if(x)x.onclick=()=>{this.app.leaveInterior();this.app.setTool('select');};}
}
A.leaveInterior=function(){const b=this.renderer.buildings.get(this.interiorId);if(b)b.setInterior(false,{camera:this.camera});this.interiorId=null;};
A.enterInterior=function(id){this.leaveInterior();this.interiorId=id;const b=this.renderer.buildings.get(id);if(!b)return;const hint=b.setInterior(true,{camera:this.camera});this.rig.set({tx:(b.spec.x+b.spec.footprint.w/2)*T,tz:(b.spec.z+b.spec.footprint.h/2)*T,dist:11,pitch:1.05});this.setTool('furniture');};
const start=A.start;A.start=function(){this.tools.building=new BuildingTool(this);this.tools.furniture=new BuildingTool(this,true);this.renderer.onBuildings=()=>{if(this.interiorId&&!this.play.active){const b=this.renderer.buildings.get(this.interiorId);if(b)b.setInterior(true,{camera:this.camera,snap:true});}};return start.call(this);};
const toolbar=A.buildToolbar;A.buildToolbar=function(){toolbar.call(this);const root=document.getElementById('tools');for(const [id,label]of [['building','⌂ Buildings'],['furniture','▣ Furniture']]){const b=document.createElement('button');b.dataset.tool=id;b.textContent=label;b.title=id==='building'?'Buildings (B)':'Furniture (U)';b.onclick=()=>this.setTool(id);root.appendChild(b);}};
const panel=A.selectionPanel;A.selectionPanel=function(){let h=panel.call(this),o=this.sel&&this.doc.obj(this.sel);if(o&&o.kind==='building')h+='<button class="b pri" data-interior>Enter interior / furniture</button><button class="b" data-turn>Rotate 90°</button>';return h;};
const bind=A.bindSelectionPanel;A.bindSelectionPanel=function(r){bind.call(this,r);const b=r.querySelector('[data-interior]');if(b)b.onclick=()=>this.enterInterior(this.sel);const t=r.querySelector('[data-turn]');if(t)t.onclick=()=>this.rotateSel(1);};
const setplay=A.setPlay;A.setPlay=function(on){if(on)this.leaveInterior();return setplay.call(this,on);};
const setdoc=A.setDoc;A.setDoc=function(d,l){this.leaveInterior();return setdoc.call(this,d,l);};
K.BuildingTool=BuildingTool;
/* A compact furnished village on a flattened snowy shelf, with clear doors and paths. */
const generate=K.WorldGenerator.prototype.generate;
K.WorldGenerator.prototype.generate=function(w,h,name){const d=generate.call(this,w,h,name);if(w<50||h<38)return d;
 const specs=[K.makeBuilding('cottage',2,3,d.uid('b'),d.seed),K.makeBuilding('smithy',2,19,d.uid('b'),d.seed+1),K.makeBuilding('stable',22,3,d.uid('b'),d.seed+2)];
 // Keep the three footprints clear of generated cliffs, ruins and props, including their approach lanes.
 const boxes=specs.map(b=>[b.x-1,b.z-1,b.x+b.footprint.w+2,b.z+b.footprint.h+3]);
 d.objects=d.objects.filter(o=>!boxes.some(([x,z,x1,z1])=>{const b=o.kind==='prop'?[o.x/T,o.z/T,o.x/T,o.z/T]:o.kind==='bridge'?[Math.min(o.a[0],o.b[0])/T,Math.min(o.a[1],o.b[1])/T,Math.max(o.a[0],o.b[0])/T,Math.max(o.a[1],o.b[1])/T]:[Math.min(...o.pts.map(p=>p[0]))/T,Math.min(...o.pts.map(p=>p[1]))/T,Math.max(...o.pts.map(p=>p[0]))/T,Math.max(...o.pts.map(p=>p[1]))/T];return b[0]<=x1&&b[2]>=x&&b[1]<=z1&&b[3]>=z;}));
 for(const [x,z,x1,z1]of boxes)for(let j=z;j<=z1&&j<h;j++)for(let i=x;i<=x1&&i<w;i++){d.terrain[d.idx(i,j)]=K.T.SNOW;d.height[d.idx(i,j)]=0;}
 for(let j=14;j<=23;j++)for(let i=15;i<=21;i++){d.terrain[d.idx(i,j)]=K.T.SNOW;d.height[d.idx(i,j)]=0;}
 d.objects.push({id:d.uid('p'),kind:'prop',type:'res:ore',x:8.75,z:8.25,s:1,seed:d.seed},{id:d.uid('p'),kind:'prop',type:'res:pine',x:10.25,z:8.25,s:1,seed:d.seed+1});
 d.objects.push(...specs);d.objects=d.objects.filter(o=>o.type!=='start');const b=specs[0],door=b.doors.find(x=>x.kind==='exterior')||b.doors[0];
 const n={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]}[door.side];const sx=b.x+door.x+n[0]*2,sz=b.z+door.z+n[1]*2;
 d.objects.push({id:d.uid('p'),kind:'prop',type:'start',hero:'warden',x:(sx+.5)*T,z:(sz+.5)*T,s:1,seed:d.seed});return d;};
})(window);
