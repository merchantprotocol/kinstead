/* High-resolution pilot. Model space: y-up, +z front; 96 voxels tall. */
(function(G){
 const K=G.K, V=G.KV;
 K.Models.register('hero_knight',({Shapes:S, VoxelModel, GreedyMesher})=>{
  const P=S.palette({steel:'#888b90',light:'#c1c3c5',dark:'#44484c',black:'#151719',red:'#8f241a',redL:'#b43c23',gold:'#dca345',goldL:'#f8cd68',leather:'#503a28'});
  // Broad plate faces are quiet; seams/rivets carry the contrast instead of random white noise.
  const metal=(x,y,z)=>y%5===0?P.dark:((Math.abs(x)%5===0||z%5===0)?P.steel:P.light);
  const M=new VoxelModel('knight',{size:0.018,height:1.73,style:'swing',mesher:new GreedyMesher(),rest:{weapon:[0,0,0],shield:[0,0.12,0]}});
  const part=(n,p,par)=>M.part(n,p,par,{jitter:0});
  const hips=part('hips',[0,37,0]);
  S.bevelBox(hips,-13,13,31,39,-8,8,2,P.dark); hips.box(-14,14,37,40,-9,9,P.leather);
  hips.box(-3,3,37,41,10,11,P.light).box(-1,1,38,40,12,12,P.dark);
  hips.box(-7,7,12,36,9,10,(x,y)=>Math.abs(x)===7?P.gold:y%7===0?P.redL:P.red);
  for(const s of [-1,1]) for(let y=23;y<36;y+=5) S.bevelBox(hips,s<0?-15:9,s<0?-9:15,y,y+4,-7,8,1,metal);
  for(const [n,x] of [['legR',-8],['legL',8]]){
   const L=part(n,[x,34,0],'hips'); S.bevelBox(L,x-5,x+5,14,33,-6,5,2,metal);
   S.bevelBox(L,x-6,x+6,13,18,-6,7,2,P.light); L.box(x-4,x+4,15,15,8,8,P.dark);
   S.bevelBox(L,x-5,x+5,4,13,-5,5,1,metal); S.bevelBox(L,x-6,x+6,0,5,-6,11,2,metal);
   for(let z=1;z<11;z+=3)L.box(x-5,x+5,4,4,z,z,P.dark);
  }
  const T=part('torso',[0,40,0],'hips'); S.bevelBox(T,-14,14,41,66,-8,8,3,metal);
  T.box(-10,10,42,65,9,10,(x,y)=>Math.abs(x)===10?P.dark:x%5===0?P.redL:P.red);
  const flame=['.......g.......','......gg.......','......gg..g....','...g.ggg..g....','..gg.ggg.ggg...','..ggg.g.gggg...','..ggg...gggg...','...gg...ggg....','....gg.ggg.....','.....gggg......','......gg.......'];
  S.stamp(T,flame,{g:P.gold},-7,60,'+z');
  for(let x=-11;x<=11;x+=4)T.set(x,64,11,P.light);
  // Collar + overlapping pauldrons with gold rivets.
  for(const s of [-1,1]){
   T.ellipsoid(s*18,64,0,10,9,11,metal); T.ellipsoid(s*19,58,0,10,3,11,P.dark);
   for(let z=-7;z<=8;z+=5)T.set(s*25,61,z,P.gold);
  }
  const H=part('head',[0,68,0],'torso'); S.bevelBox(H,-9,9,69,85,-8,9,3,metal);
  for(let y=86;y<=94;y++)S.bevelBox(H,-Math.max(1,9-(y-85)),Math.max(1,9-(y-85)),y,y,-7,7,0,P.steel);
  H.box(-8,8,79,81,10,10,P.black).box(-1,1,69,86,11,11,P.light);
  for(const s of [-1,1])H.box(s<0?-6:4,s<0?-4:6,70,77,10,10,P.dark);
  // Reference has a peaked steel crest; restrained red plume extends behind it.
  H.box(-1,1,86,95,-8,-5,P.red).box(-1,1,81,92,-11,-8,P.redL);
  for(const [n,s]of [['armR',-1],['armL',1]]){
   const x=s*22,A=part(n,[x,60,0],'torso'); S.bevelBox(A,x-5,x+5,40,57,-6,6,2,metal);
   A.ellipsoid(x,40,0,6,4,7,P.dark);S.bevelBox(A,x-5,x+5,28,39,-6,7,2,metal);S.bevelBox(A,x-5,x+5,23,29,-5,7,2,P.dark);
   for(let y=30;y<40;y+=4)A.box(x-5,x+5,y,y,8,8,P.light);
  }
  const W=part('weapon',[-22,25,5],'armR'); W.box(-24,-21,18,28,5,8,P.leather); W.box(-30,-15,19,21,5,8,P.gold);
  for(let y=-1;y<=18;y++){const x=-23-Math.floor((18-y)*.43); W.box(x-2,x+2,y,y,6,8,P.steel);W.set(x-2,y,9,P.light);}
  const Sh=part('shield',[22,30,8],'armL');
  S.cylinder(Sh,{axis:'z',at:[22,32],from:8,to:11,r:18},P.light);
  S.cylinder(Sh,{axis:'z',at:[22,32],from:12,to:13,r:15},(x,y)=>x%5===0||y%5===0?P.redL:P.red);
  S.stamp(Sh,flame,{g:P.goldL},15,39,'+z');
  for(let a=0;a<Math.PI*2;a+=Math.PI/6)Sh.set(Math.round(22+17*Math.cos(a)),Math.round(32+17*Math.sin(a)),14,P.gold);
  const C=part('cape',[0,63,-9],'torso'); C.box(-13,13,13,62,-12,-10,(x,y)=>x%5===0?P.redL:P.red);
  return M;
 },{kind:'rig',role:'knight',ref:'lab/hero_knight.png',title:'Knight · high-resolution pilot',view:{yaw:-0.57,pitch:0.22}});
})(typeof window!=='undefined'?window:globalThis);
