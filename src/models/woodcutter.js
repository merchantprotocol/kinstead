/* Woodcutter pilot: independent rigid sculpt, front +z, one voxel = 3 cm. */
(function(G){G.K.Models.register('woodcutter',({Shapes:S,StaticVoxelModel})=>{
 const P=S.palette({wood:'#66503a',woodL:'#92704c',woodD:'#342b22',stone:'#727775',stoneL:'#989d98',mortar:'#3b4140',slate:'#43505b',snow:'#e4edf1',snowD:'#b6cbd7','fire*':'#ff9a27',iron:'#383b3b',cut:'#ac8658',moss:'#596047'});
 const wood=(x,y,z)=>(y%4===0||x%11===0||z%11===0)?P.woodD:(x+z)%5===0?P.woodL:P.wood;
 const stone=(x,y,z)=>y%4===0||(x+Math.floor(y/4)*2)%6===0||z%6===0?P.mortar:((x+z)%3===0?P.stoneL:P.stone);
 const M=new StaticVoxelModel('woodcutter',{size:.035,footprint:[4.4,4.4],lights:[[0,21,30,1],[16,46,1,1]]}),p=M.part();
 S.basePatch(p,{cx:0,cz:7,rx:57,rz:48,y0:0,h:4,square:true,wobble:.08},stone,(x,y,z)=>(x+z)%7<2?P.snow:stone(x,y,z));
 p.box(-34,34,4,17,-29,27,stone);
 for(const z of [-27,27])S.logWall(p,{axis:'x',from:-33,to:33,at:z,y0:18,y1:49,r:2,ends:2},wood,P.cut);
 for(const x of [-32,32])S.logWall(p,{axis:'z',from:-29,to:29,at:x,y0:18,y1:49,r:2,ends:2},wood,P.cut);
 // Gable infill and hefty corner beams.
 for(let y=50;y<=75;y++){let w=Math.floor(33*(75-y)/26);p.box(-w,w,y,y,25,29,wood).box(-w,w,y,y,-29,-25,wood);}
 for(const x of [-30,30])for(const z of [-27,27])p.box(x-2,x+2,14,49,z-2,z+2,wood);
 // Front door, iron straps, stone stairway and warm lanterns.
 p.box(-7,7,12,35,30,31,P.woodD).box(-6,6,13,34,32,32,(x,y)=>x%3===0?P.woodD:P.wood);
 for(const y of [17,29])p.box(-6,6,y,y,33,33,P.iron);p.box(4,5,23,24,33,34,P.cut);
 for(let i=0;i<4;i++)p.box(-11,11,4,12-i*2,32+i*5,36+i*5,stone);
 for(const x of [-11,11]){p.box(x-1,x+1,24,29,31,33,P.iron);p.box(x,x,25,28,34,34,P.fire);}
 const window=(x,y,z,side)=>{if(!side){p.box(x-6,x+6,y-6,y+6,z,z,P.woodD);p.box(x-4,x+4,y-4,y+4,z+1,z+1,P.fire);p.box(x,x,y-5,y+5,z+2,z+2,P.iron);p.box(x-5,x+5,y,y,z+2,z+2,P.wood);}else{p.box(x,x,y-6,y+6,z-6,z+6,P.woodD);p.box(x+1,x+1,y-4,y+4,z-4,z+4,P.fire);p.box(x+2,x+2,y-5,y+5,z,z,P.iron);}};
 window(0,56,30,false);window(35,32,0,true);
 const roof=S.gableRoof(p,{x0:-35,x1:35,z0:-32,z1:33,y:48,rise:31,thick:3,overhang:4,ridge:'z'},P.slate);
 S.shingleRows(p,roof,{rowH:3,tileW:5,paints:[P.slate,P.stone,P.stoneL],lip:P.woodD,seam:P.mortar});
 S.snowCap(p,{depth:[1,4],paint:(x,y,z)=>(x+z)%5===0?P.snowD:P.snow,lumps:.15,test:(x,y)=>y>=45,icicles:{chance:.18,len:[2,7],paint:P.snowD}});
 // Masonry chimney projects through the roof, with a black throat and embers.
 p.box(14,23,58,90,-14,-5,stone).box(12,25,85,87,-16,-3,stone).box(16,21,91,91,-12,-7,P.iron).box(17,20,91,91,-11,-8,P.fire);
 S.logStack(p,{axis:'z',x:39,y:5,z:8,len:24,rows:4,r:3},wood,[P.cut,P.woodD,P.woodL]);
 // Chopping stump + axe, basket of embers, split firewood.
 S.cylinder(p,{axis:'y',at:[-35,35],from:4,to:16,r:10},wood);S.cylinder(p,{axis:'y',at:[-35,35],from:17,to:17,r:10},P.cut);
 for(let y=17;y<=36;y++){const x=-35-Math.floor((y-17)*.35);p.box(x,x+1,y,y,35,36,P.woodL);}p.box(-38,-30,18,23,34,37,P.stone);
 p.box(24,33,4,12,37,43,P.iron).box(25,32,12,12,38,42,P.fire);
 for(let i=0;i<6;i++)p.box(3+i*2,5+i*2,4,5+i%3,40-i,48-i,P.cut);
 S.snowCap(p,{depth:[0,1],paint:P.snow,test:(x,y,z)=>y<25&&(x+z)%9<2});
 return M;
},{kind:'static',ref:'art/woodcutter.webp',title:"Woodcutter's lodge",view:{yaw:.68,pitch:.5}});})(typeof window!=='undefined'?window:globalThis);
