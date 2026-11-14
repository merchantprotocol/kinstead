/* Asset Lab: the same voxel models, Three renderer, snow and post as play. */
(function(G){const K=G.K,T=G.THREE,V=G.KV;
 class AssetLab{
 constructor(){
  if(!document.getElementById('viewport'))return;
  this.host=document.getElementById('viewport'); this.scene=new T.Scene();this.scene.background=new T.Color('#d9d8d5');
  this.renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.host.prepend(this.renderer.domElement);
  this.post=new K.PostPipeline(this.renderer);this.post.enabled.dof=false;this.post.bloomStrength=.3;
  this.camera=new T.PerspectiveCamera(32,1,.02,200);this.target=new T.Vector3();this.yaw=-.57;this.pitch=.22;this.distance=5;this.time=0;this.anim='idle';this.orbit=false;
  this.hemi=new T.HemisphereLight('#d8e5f2','#5b5750',1.25);this.scene.add(this.hemi);
  this.sun=new T.DirectionalLight('#fff0d8',2.4);this.sun.position.set(-4,8,5);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-6;this.sun.shadow.camera.right=6;this.sun.shadow.camera.top=6;this.sun.shadow.camera.bottom=-6;this.scene.add(this.sun);
  this.rim=new T.DirectionalLight('#92b8e5',.6);this.rim.position.set(4,3,-4);this.scene.add(this.rim);this.fire=new T.PointLight('#ff8833',0,14,2);this.fire.position.set(-1,.5,2);this.scene.add(this.fire);
  this.snow=new K.SnowField(350);this.scene.add(this.snow.points);
  this.plot=new T.Group();this.scene.add(this.plot);
  // A tiny snow tile, not a world generation or navigation map.
  const tile=new V.StaticVoxelModel('lab-tile',{size:.1}),p=tile.part();K.Shapes.basePatch(p,{cx:0,cz:0,rx:10,rz:10,y0:-3,h:3,square:true,wobble:.05},V.Colour.hex('#77818b'),V.Colour.hex('#d9e6ed'));this.tile=tile.object3d();this.tile.position.y=-.3;this.plot.add(this.tile);
  const ids=new Set(['hero_knight','hero_ranger','hero_mage','hero_troll',...Object.keys(G.KINSTEAD_ART_INLINE||{}),...(K.CASTLE_ART?.ids||[])]);
  // The art manifest includes all castle pieces, upgrades, weapons and furniture.
  this.$('asset').innerHTML=[...ids].filter(x=>!x.includes('/')).map(id=>`<option value="${id}">${id}${K.Models.has(id)?' · pilot':' · legacy'}</option>`).join('');
  this.$('asset').onchange=e=>this.select(e.target.value);this.$('orbit').onclick=()=>{this.orbit=!this.orbit;this.$('orbit').textContent='Orbit: '+(this.orbit?'on':'off');};
  this.$('mode').onchange=()=>this.comparison();this.$('wipe').oninput=()=>this.comparison();
  document.querySelectorAll('[data-light]').forEach(b=>b.onclick=()=>this.lighting(b.dataset.light));document.querySelectorAll('[data-anim]').forEach(b=>b.onclick=()=>{this.anim=b.dataset.anim;this.animStart=this.time;});
  this.$('snapshot').onclick=()=>{const a=document.createElement('a');a.download=this.id+'-compare.png';a.href=this.snapshot();a.click();};this.$('extract').onclick=()=>this.palette();this.$('reset').onclick=()=>this.frame();this.$('dof').onchange=e=>this.post.enabled.dof=e.target.checked;this.$('snow').onchange=e=>this.snow.points.visible=e.target.checked;
  let drag=null;this.host.onpointerdown=e=>{drag=[e.clientX,e.clientY];this.host.setPointerCapture(e.pointerId);};this.host.onpointerup=()=>drag=null;this.host.onpointermove=e=>{if(!drag)return;this.yaw-=(e.clientX-drag[0])*.008;this.pitch=Math.max(.03,Math.min(1.3,this.pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];this.draw(0);};this.host.onwheel=e=>{e.preventDefault();this.distance*=Math.exp(e.deltaY*.001);this.draw(0);};
  new ResizeObserver(()=>this.resize()).observe(this.host);this.resize();this.select(new URLSearchParams(location.search).get('asset')||'hero_knight');
  this.last=performance.now();const tick=now=>{this.draw(Math.min(.05,(now-this.last)/1000));this.last=now;this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);
 }
 $(id){return document.getElementById(id);}
 ref(id){if(id.startsWith('hero_'))return (G.KINSTEAD_LAB_INLINE||{})['lab/'+id+'.png']||'lab/'+id+'.png';return (G.KINSTEAD_ART_INLINE||{})[id]||'art/'+id+'.webp';}
 select(id){
  if(this.object)this.scene.remove(this.object);if(this.rig)this.rig.dispose();this.rig=this.animator=null;this.id=id;this.$('asset').value=id;
  const image=this.$('reference');image.src=this.ref(id);this.$('overlay').src=image.src;
  let m=K.Models.get(id);this.legacy=!m;
  if(id.startsWith('hero_')){m=m||V.CharacterSculptor.build(id.slice(5));this.rig=new V.VoxelRig(m,{rest:m.rest||V.CharacterSculptor.REST[id.slice(5)]});this.animator=new V.VoxelAnimator(this.rig);this.object=this.rig.group;}
  else if(m)this.object=m.object3d();
  else { // Use the actual castle builder if this id exists; other props clearly remain unsculpted.
   this.object=new T.Group();const data=new K.CastleData(K.CASTLE_DATA);try{const a=new K.CastleArt(data);const r=a.build(id.replace(/_lv2$/,''),id.endsWith('_lv2')?2:1);if(r?.group)this.object=r.group;}catch(e){console.warn('legacy preview unavailable',id,e.message);}
  }
  this.model=m;this.scene.add(this.object);this.frame();this.draw(0);
 }
 frame(){this.object.updateMatrixWorld(true);const b=new T.Box3().setFromObject(this.object),s=new T.Vector3();b.getSize(s);if(!Number.isFinite(s.y)||s.y===0){this.target.set(0,.7,0);this.distance=5;return;}this.target.copy(b.getCenter(new T.Vector3()));this.distance=Math.max(s.y,s.x,s.z)*2.7;const v=K.Models.meta(this.id)?.view||{yaw:.68,pitch:.5};this.yaw=v.yaw;this.pitch=v.pitch;this.tile.scale.setScalar(Math.max(1,s.x/1.8,s.z/1.8));this.post.focus=this.distance;}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.post.setSize(Math.round(w*this.renderer.getPixelRatio()),Math.round(h*this.renderer.getPixelRatio()));this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.draw(0);}
 lighting(preset){const studio=preset==='studio',night=preset==='night';this.scene.background=new T.Color(studio?'#d9d8d5':night?'#101926':'#29344c');this.hemi.intensity=studio?1.25:night?.35:1.25;this.sun.intensity=studio?2.4:night?.15:2.4;this.sun.color.set(studio?'#fff0d8':'#ffd6a8');this.fire.intensity=night?9:0;this.rim.intensity=night?1:.6;this.draw(0);}
 comparison(){const m=this.$('mode').value,o=this.$('overlay'),v=+this.$('wipe').value;o.style.display=m==='split'?'none':'block';o.style.opacity=m==='overlay'?v/100:1;o.style.clipPath=m==='wipe'?`inset(0 ${100-v}% 0 0)`:'none';}
 draw(dt=1/60){if(!this.camera||!this.post)return;const t0=performance.now();this.time+=dt;if(this.orbit)this.yaw+=dt*.25;if(this.animator)this.animator.apply(this.anim,(this.time-(this.animStart||0))%.7,this.time,dt);const d=this.distance,p=this.pitch;this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(p)*d,this.target.y+Math.sin(p)*d,this.target.z+Math.cos(this.yaw)*Math.cos(p)*d);this.camera.lookAt(this.target);this.snow.update(this.time,this.host.clientHeight,this.target);this.post.render(this.scene,this.camera,this.time);this.ms=performance.now()-t0;this.$('stats').textContent=`${this.id} · ${this.legacy?'LEGACY / not reconstructed':'HIGH-RES PILOT'} · ${this.model?.voxelCount||0} voxels · ${this.model?.tris||0} triangles · CPU submit ${this.ms.toFixed(2)} ms · DOF ${this.post.enabled.dof?'on':'off'}`;}
 snapshot(){this.draw(0);const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');x.fillStyle='#d9d8d5';x.fillRect(0,0,1600,900);const draw=(im,l)=>{const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(!w||!h)return;const f=Math.min(780/w,840/h);x.drawImage(im,l+(800-w*f)/2,35+(840-h*f)/2,w*f,h*f);};draw(this.$('reference'),0);draw(this.renderer.domElement,800);x.fillStyle='#302e2b';x.font='18px monospace';x.fillText(this.id+' / Grok reference',20,26);x.fillText('live voxel reconstruction',820,26);return c.toDataURL('image/png');}
 palette(){const img=this.$('reference');if(!img.complete)return;const data=K.Palette.pixels(img),cols=K.Palette.dominant(data,10);this.$('palette').replaceChildren();for(const col of cols){const el=document.createElement('span'),h=K.Palette.hex(col.rgb||col);el.className='swatch';el.style.background=h;el.textContent=h;el.title='Rename this swatch in your model palette';this.$('palette').append(el);}}
 }
 K.AssetLab=AssetLab;
})(typeof window!=='undefined'?window:globalThis);
