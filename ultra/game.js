import {createRenderer} from './renderer.js';
const vehicleSpecs={
 car:{name:'Car',color:'#97c9c0',width:1.88,length:4.36,eye:1.45,wheelbase:3.2,accel:3.5},
 motorcycle:{name:'Motorcycle',color:'#c84d38',width:.82,length:2.3,eye:1.5,wheelbase:1.65,accel:4.5},
 minivan:{name:'Minivan',color:'#d7d6ce',width:2.04,length:5.1,eye:1.9,wheelbase:3.1,accel:3},
 truck:{name:'Pickup truck',color:'#416b91',width:2.2,length:5.8,eye:2.15,wheelbase:3.7,accel:2.7},
 bus:{name:'Bus',color:'#dfbd60',width:2.5,length:9.8,eye:2.7,wheelbase:5.6,accel:1.8},
};

let onFoot=false,insideHome=false,parkedVehicle=null,homeReturn=null,homeTV=false,homeLights=true,homeSeated=false,energy=100;
const neighborhoods=[{x:-240,z:240,name:'PALM GROVE'},{x:240,z:-240,name:'SUNSET PARK'}];
const homes=[];for(const n of neighborhoods)for(const dx of [-60,-20,20,60])for(const dz of [-60,-20,20,60])homes.push({x:n.x+dx,z:n.z+dz,front:Math.abs(dz)===60?Math.sign(dz):-Math.sign(dz)});
let interiorFaces=null,interiorKey='';
const pedestrianStates=Array.from({length:32},(_,id)=>({id,progress:(id%4)*11}));
function residentialDistrict(a,b){return neighborhoods.find(n=>Math.abs(a-n.x)<80&&Math.abs(b-n.z)<80)}
function residentialRoad(a,b){return neighborhoods.some(n=>Math.abs(a-n.x)<=80&&Math.abs(b-n.z)<=80&&(Math.abs(a-n.x)<6||Math.abs(b-n.z)<6))}
function residentialDrive(a,b){return homes.some(h=>Math.abs(a-h.x)<3&&b>Math.min(h.z+h.front*8,h.z+h.front*20)&&b<Math.max(h.z+h.front*8,h.z+h.front*20))}
function curbOpening(a,b){return residentialRoad(a,b)||residentialDrive(a,b)}
let vehicleType='car';const treeSiteCache=new Map();
function vehicleSpec(){return vehicleSpecs[vehicleType]}
const canvas=document.getElementById('scene'),c=canvas.getContext('2d'),$=id=>document.getElementById(id);let W,H;function resize(){W=innerWidth;H=innerHeight;let d=Math.min(devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;c.setTransform(d,0,0,d,0,0)}resize();addEventListener('resize',resize);

const freewayCars=Array.from({length:64},(_,i)=>({theta:i*Math.PI*2/64,r:[545,549,553,557,563,567,571,575][i%8],dir:i%8<4?-1:1,cruise:([60,64,67,68,68,67,64,60][i%8]+i%3)/2.237,speed:([60,64,67,68,68,67,64,60][i%8]+i%3)/2.237,color:['#d7dddf','#4e83a8','#b77959','#879b91'][i%4]}));
function freewayPose(v){return{x:v.r*Math.cos(v.theta),z:v.r*Math.sin(v.theta),a:Math.atan2(-Math.sin(v.theta)*v.dir,Math.cos(v.theta)*v.dir),height:HIGHWAY_Y}}
function advanceFreeway(dt){const merge=rampNearest(x,z),joining=merge.ramp&&merge.ramp.type==='entry'&&merge.distance<9&&merge.index>merge.ramp.points.length*.86&&gear>0;let old=freewayCars.map(v=>({theta:v.theta,p:freewayPose(v)}));freewayCars.forEach((v,i)=>{let gap=Infinity;for(let j=0;j<old.length;j++)if(j!==i&&freewayCars[j].r===v.r){let d=((old[j].theta-old[i].theta)*v.dir+Math.PI*2)%(Math.PI*2)*v.r;gap=Math.min(gap,Math.max(0,d-(3+(npcSpec(v).length+npcSpec(freewayCars[j]).length)/2)))}let p=old[i].p,forward=(x-p.x)*Math.sin(p.a)+(z-p.z)*Math.cos(p.a),side=(x-p.x)*Math.cos(p.a)-(z-p.z)*Math.sin(p.a);if(Math.abs(groundY-HIGHWAY_Y)<2&&forward>0&&forward<110&&Math.abs(side)<2.3)gap=Math.min(gap,Math.max(0,forward-(3+(npcSpec(v).length+vehicleSpec().length)/2)));if(joining&&v.r===575){let untilJoin=angle(merge.ramp.joinAngle-v.theta)*575;if(untilJoin>0&&untilJoin<150)gap=Math.min(gap,Math.max(0,untilJoin-18))}gap=Math.min(gap,playerYieldDistance(p));let target=Math.min(reactiveCruise(v,v.cruise),Math.sqrt(8*gap));v.speed=target<v.speed?Math.max(target,v.speed-8*dt):Math.min(target,v.speed+reactiveAcceleration(v,2.5)*dt);v.theta+=v.dir*Math.min(v.speed*dt,gap)/v.r;v.theta=(v.theta+Math.PI*2)%(Math.PI*2);p=freewayPose(v);if(Math.abs(groundY-HIGHWAY_Y)<2&&overlaps(x,z,yaw,p.x,p.z,p.a,v.kind))crash('You collided with freeway traffic.')})}
function ringPatch(a,b,r1,r2,color,y){face([[r1*Math.cos(a),y,r1*Math.sin(a)],[r2*Math.cos(a),y,r2*Math.sin(a)],[r2*Math.cos(b),y,r2*Math.sin(b)],[r1*Math.cos(b),y,r1*Math.sin(b)]],color)}

function rotatePoint(p,a){return[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)]}

const HIGHWAY_Y=7.2;let groundY=0,modelLift=0;
function highwayRelativeAngle(a){return Math.atan2(Math.sin(a*4),Math.cos(a*4))/4}
function highwayOpening(a){let q=Math.abs(highwayRelativeAngle(a));return q>.04&&q<.19}
function roadSurface(a,b,reference=groundY){let choices=[];if(residentialRoad(a,b)||residentialDrive(a,b))choices.push(0);const rr=Math.hypot(a,b);if(rr>541&&rr<579&&Math.abs(rr-560)>1.1)choices.push(HIGHWAY_Y);const near=rampNearest(a,b);if(near.ramp&&near.distance<rampHalfWidth(near.ramp,near.index))choices.push(near.height);const mergeAngle=highwayRelativeAngle(Math.atan2(b,a));if(mergeAngle>=-.180001&&mergeAngle<=-.049999){const u=(mergeAngle+.18)/.13;if(rr>=577&&rr<579+4*slopeBlend(1-u))choices.push(HIGHWAY_Y)}if((Math.abs(a)<342&&Math.abs(b)<342&&(roadDist(a)<8||roadDist(b)<8))||(a>8&&a<29&&b>65&&b<79)||(a>25&&a<88&&b>38&&b<108))choices.push(0);for(let side=0;side<4;side++){let p=rotatePoint([a,b],-side*Math.PI/2);if(p[0]>318&&p[0]<675&&Math.abs(p[1])<8)choices.push(0)}let best=choices.sort((a,b)=>Math.abs(a-reference)-Math.abs(b-reference))[0];return best!==undefined&&Math.abs(best-reference)<1.4?best:undefined}
function slopeBlend(u){u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)}
const ramps=[];for(let side=0;side<4;side++)for(let type of ['entry','exit']){
 const R=579*Math.sin(.18)-6,cx=579*Math.cos(.18)+R,cz=(type==='entry'?-1:1)*(R+6),points=[];
 const add=(px,pz,y)=>{let q=rotatePoint([px,pz],side*Math.PI/2);points.push([q[0],q[1],y])};
 if(type==='entry'){
  for(let i=0;i<=32;i++){let u=i/32;add(330+(cx-330)*u,-6,0)}
  for(let i=1;i<=80;i++){let u=i/80,a=Math.PI/2-u*Math.PI*1.5;add(cx+R*Math.cos(a),cz+R*Math.sin(a),HIGHWAY_Y*slopeBlend(u))}
  for(let i=1;i<=16;i++){let u=i/16,a=-.18+.13*u,r=579-4*slopeBlend(u);add(r*Math.cos(a),r*Math.sin(a),HIGHWAY_Y)}
 }else{
  for(let i=0;i<=16;i++){let u=i/16,a=.05+.13*u,r=575+4*slopeBlend(u);add(r*Math.cos(a),r*Math.sin(a),HIGHWAY_Y)}
  for(let i=1;i<=80;i++){let u=i/80,a=Math.PI-u*Math.PI*1.5;add(cx+R*Math.cos(a),cz+R*Math.sin(a),HIGHWAY_Y*(1-slopeBlend(u)))}
  for(let i=1;i<=32;i++){let u=i/32;add(cx+(330-cx)*u,6,0)}
 }
 ramps.push({side,type,points,joinAngle:(type==='entry'?-.05:.05)+side*Math.PI/2});
}
function rampNearest(px,pz){let best={distance:Infinity,ramp:null,index:0,height:0};for(let ramp of ramps)for(let i=0;i<ramp.points.length-1;i++){let a=ramp.points[i],b=ramp.points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz))),distance=Math.hypot(px-a[0]-u*dx,pz-a[1]-u*dz);if(distance<best.distance)best={distance,ramp,index:i+u,height:a[2]+(b[2]-a[2])*u}}return best}

function rampHalfWidth(ramp,i){return ramp.type==='entry'?2+2*slopeBlend(i/32):2.7}
function rampFrame(ramp,i){let pts=ramp.points,p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;return{p,dx:dx/len,dz:dz/len,nx:-dz/len,nz:dx/len}}
function polarBand(a,b,innerA,outerA,innerB,outerB,y,col){face([[innerA*Math.cos(a),y,innerA*Math.sin(a)],[outerA*Math.cos(a),y,outerA*Math.sin(a)],[outerB*Math.cos(b),y,outerB*Math.sin(b)],[innerB*Math.cos(b),y,innerB*Math.sin(b)]],col)}
function drawRamps(){for(let ramp of ramps){let n=ramp.points.length-1,travel=0,nextArrow=75;for(let i=0;i<n;i++){let A=rampFrame(ramp,i),B=rampFrame(ramp,i+1),a=A.p,b=B.p,len=Math.hypot(b[0]-a[0],b[1]-a[1]);travel+=len;
 const lead=ramp.type==='entry'?i<32:i>=96,aux=ramp.type==='entry'?i>=112:i<16;
 if((lead&&ramp.type!=='entry')||Math.hypot(a[0]-x,a[1]-z)>380)continue;
 if(aux){let u0=ramp.type==='entry'?(i-112)/16:i/16,u1=ramp.type==='entry'?(i-111)/16:(i+1)/16,outerA=579+4*slopeBlend(ramp.type==='entry'?1-u0:u0),outerB=579+4*slopeBlend(ramp.type==='entry'?1-u1:u1),aa=Math.atan2(a[1],a[0]),bb=aa+angle(Math.atan2(b[1],b[0])-aa),y=HIGHWAY_Y;
 polarBand(aa,bb,577,outerA,577,outerB,y+.02,'#414d55');polarBand(aa,bb,577,outerA+.65,577,outerB+.65,y-.65,'#8b9796');
 polarBand(aa,bb,outerA-2.06,outerA-1.92,outerB-2.06,outerB-1.92,y+.075,'#f4f0df');polarBand(aa,bb,outerA+.22,outerA+.45,outerB+.22,outerB+.45,y+.85,'#c4ccca');
 face([[(outerA+.3)*Math.cos(aa),y-.65,(outerA+.3)*Math.sin(aa)],[(outerB+.3)*Math.cos(bb),y-.65,(outerB+.3)*Math.sin(bb)],[(outerB+.3)*Math.cos(bb),y+.85,(outerB+.3)*Math.sin(bb)],[(outerA+.3)*Math.cos(aa),y+.85,(outerA+.3)*Math.sin(aa)]],'#aebcba');continue}
 function strip(lo,hi,offset,col){face([[a[0]+A.nx*lo,a[2]+offset,a[1]+A.nz*lo],[a[0]+A.nx*hi,a[2]+offset,a[1]+A.nz*hi],[b[0]+B.nx*hi,b[2]+offset,b[1]+B.nz*hi],[b[0]+B.nx*lo,b[2]+offset,b[1]+B.nz*lo]],col)}
 const width=rampHalfWidth(ramp,i),nextWidth=rampHalfWidth(ramp,i+1),wide=ramp.type==='entry';
 face([[a[0]-A.nx*width,a[2]+.035,a[1]-A.nz*width],[a[0]+A.nx*width,a[2]+.035,a[1]+A.nz*width],[b[0]+B.nx*nextWidth,b[2]+.035,b[1]+B.nz*nextWidth],[b[0]-B.nx*nextWidth,b[2]+.035,b[1]-B.nz*nextWidth]],'#414d55');
 if(!lead){strip(wide?-2.65:-2.05,wide?-2.52:-1.92,.075,'#f4f0df');strip(wide?2.52:1.92,wide?2.65:2.05,.075,'#f4f0df')}
 if(Math.min(a[2],b[2])>.6){strip(-width-.15,width+.15,-.65,'#8b9796');for(let edge of [-width,width])face([[a[0]+A.nx*edge,a[2]-.65,a[1]+A.nz*edge],[b[0]+B.nx*edge,b[2]-.65,b[1]+B.nz*edge],[b[0]+B.nx*edge,b[2]+.02,b[1]+B.nz*edge],[a[0]+A.nx*edge,a[2]+.02,a[1]+A.nz*edge]],'#a8b3ad')}
 if(Math.max(a[2],b[2])>.35)for(let edge of [-width+.1,width-.1]){if(rampRailOpening(A,B,edge))continue;strip(edge,edge+Math.sign(edge)*.12,.85,'#c2ccca');face([[a[0]+A.nx*edge,a[2]+.63,a[1]+A.nz*edge],[b[0]+B.nx*edge,b[2]+.63,b[1]+B.nz*edge],[b[0]+B.nx*edge,b[2]+.85,b[1]+B.nz*edge],[a[0]+A.nx*edge,a[2]+.85,a[1]+A.nz*edge]],'#aebcba');if(i%4===0)cube(a[0]+A.nx*edge,a[1]+A.nz*edge,.12,.12,.8,'#899b9b',0,a[2])}
 if(travel>nextArrow){nextArrow=travel+80;let mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,my=(a[2]+b[2])/2+.08;face([[mx+A.dx*2,my,mz+A.dz*2],[mx-A.dx*.3+A.nx*.65,my,mz-A.dz*.3+A.nz*.65],[mx-A.dx*.3-A.nx*.65,my,mz-A.dz*.3-A.nz*.65]],'#f4f0df');face([[mx-A.dx*2+A.nx*.17,my,mz-A.dz*2+A.nz*.17],[mx+A.nx*.17,my,mz+A.nz*.17],[mx-A.nx*.17,my,mz-A.nz*.17],[mx-A.dx*2-A.nx*.17,my,mz-A.dz*2-A.nz*.17]],'#f4f0df')}
 if(i%12===0&&a[2]>2.5){cube(a[0],a[1],1.2,1.5,a[2]-.7,'#a6ada9');cube(a[0],a[1],width*2-.1,1.4,.5,'#b4b9af',Math.atan2(A.dx,A.dz),a[2]-1.0)}
 }}}
function freewayGores(){for(let side=0;side<4;side++)for(let type of ['entry','exit']){const center=side*Math.PI/2,sign=type==='entry'?-1:1;let aa=center+sign*.18,bb=center+sign*.22,y=HIGHWAY_Y+.09;
 face([[577.15*Math.cos(aa),y,577.15*Math.sin(aa)],[577.9*Math.cos(aa),y,577.9*Math.sin(aa)],[577.15*Math.cos(bb),y,577.15*Math.sin(bb)]],'#65716c');
 for(let j=0;j<7;j++){let u=j/7,a=aa+(bb-aa)*u,b=a+(bb-aa)*.035,outer=577.15+.75*(1-u);polarBand(a,b,577.2,outer,577.2,Math.max(577.2,outer-.10),y+.015,'#f4f0df')}
 }}


// Guardrail gaps follow the actual ramp pavement, not just nominal merge angles.
const freewayRailGapCache=new Map();
function freewayRailOpening(a,b){
 const key=a.toFixed(8)+':'+b.toFixed(8);if(freewayRailGapCache.has(key))return freewayRailGapCache.get(key);
 let open=false;
 for(let j=0;j<=4;j++){const theta=a+(b-a)*j/4,near=rampNearest(579.5*Math.cos(theta),579.5*Math.sin(theta));
  if(highwayOpening(theta)||(near.ramp&&Math.abs(near.height-HIGHWAY_Y)<1.5&&near.distance<rampHalfWidth(near.ramp,near.index)+2)){open=true;break}
 }
 freewayRailGapCache.set(key,open);return open;
}
function rampRailOpening(A,B,edge){
 return [A,B].some(f=>f.p[2]>HIGHWAY_Y-1.4&&Math.hypot(f.p[0]+f.nx*edge,f.p[1]+f.nz*edge)<580.5);
}

function drawFreeway(){const y=HIGHWAY_Y;for(let i=0;i<360;i++){let a=i*Math.PI/180,b=(i+1)*Math.PI/180;
 ringPatch(a,b,540,580,'#9ca7a4',y-.75);ringPatch(a,b,541,579,'#414d55',y+.02);
 ringPatch(a,b,541,543,'#38434a',y+.03);if(!highwayOpening(a))ringPatch(a,b,577,579,'#38434a',y+.03);
 ringPatch(a,b,559,561,'#b6bfb7',y+.68);
 for(let r of [559,561])face([[r*Math.cos(a),y,r*Math.sin(a)],[r*Math.cos(b),y,r*Math.sin(b)],[r*Math.cos(b),y+.68,r*Math.sin(b)],[r*Math.cos(a),y+.68,r*Math.sin(a)]],'#a8b3aa');
 for(let r of [543.05,558.75,561.1,577.05]){let outside=r>570,opening=outside&&highwayOpening(a);if(!opening)ringPatch(a,b,r,r+.13,r<544||outside?'#f4f0df':'#eac85c',y+.085)}
 for(let r of [540.5,579.5]){let gap=r>570&&freewayRailOpening(a,b);face([[r*Math.cos(a),y-.75,r*Math.sin(a)],[r*Math.cos(b),y-.75,r*Math.sin(b)],[r*Math.cos(b),y+.02,r*Math.sin(b)],[r*Math.cos(a),y+.02,r*Math.sin(a)]],'#9eaaa7');if(!gap){ringPatch(a,b,r-.18,r+.18,'#c1c9c2',y+.85);face([[r*Math.cos(a),y,r*Math.sin(a)],[r*Math.cos(b),y,r*Math.sin(b)],[r*Math.cos(b),y+.85,r*Math.sin(b)],[r*Math.cos(a),y+.85,r*Math.sin(a)]],'#b1bbb5')}}
 if(i%12===2){for(let r of [550,570]){let px=r*Math.cos(a),pz=r*Math.sin(a);cube(px,pz,1.8,2.2,y-1.0,'#a4aaa3')}cube(560*Math.cos(a),560*Math.sin(a),40,2,.5,'#aab3ac',Math.PI/2-a,y-1.05)}
 }
 // Three broken lane dividers in each carriageway make four travel lanes.
 for(let r of [547,551,555,565,569,573])for(let d=0;d<Math.PI*2*r;d+=12)ringPatch(d/r,(d+3)/r,r-.06,r+.06,'#f4f0df',y+.085);
 // The outside edge becomes broken only beside acceleration/deceleration tapers.
 for(let side=0;side<4;side++)for(let sign of [-1,1]){let start=side*Math.PI/2+sign*.05,end=side*Math.PI/2+sign*.18,lo=Math.min(start,end),hi=Math.max(start,end);for(let a=lo;a<hi;a+=12/577)ringPatch(a,Math.min(hi,a+3/577),576.99,577.12,'#f4f0df',y+.09)}
// Ground-level streets continue beneath the raised freeway.
 for(let side=0;side<4;side++){function p(u,v,y){let q=rotatePoint([u,v],side*Math.PI/2);return[q[0],y,q[1]]}for(let u=318;u<675;u+=12){let v=Math.min(675,u+12);face([p(u,-9.5,.005),p(v,-9.5,.005),p(v,9.5,.005),p(u,9.5,.005)],'#cbc9b8');face([p(u,-8,.025),p(v,-8,.025),p(v,8,.025),p(u,8,.025)],'#48545b');for(let edge of [-7.65,7.65])face([p(u,edge-.065,.08),p(v,edge-.065,.08),p(v,edge+.065,.08),p(u,edge+.065,.08)],'#f4f0df');for(let off of [-4,4])face([p(u,off-.06,.08),p(Math.min(v,u+3),off-.06,.08),p(Math.min(v,u+3),off+.06,.08),p(u,off+.06,.08)],'#f4f0df');for(let off of [-.13,.13])face([p(u,off-.04,.065),p(v,off-.04,.065),p(v,off+.04,.065),p(u,off+.04,.065)],'#e3c474')}for(let zside of [-21,21]){let q=rotatePoint([560,zside],side*Math.PI/2);cube(q[0],q[1],2,2,HIGHWAY_Y-1,'#a4aaa3')}}
 drawRamps();freewayGores();
}

function mergeGap(ramp){let back=Infinity,front=Infinity;for(let v of freewayCars){if(v.r!==575)continue;let delta=angle(v.theta-ramp.joinAngle)*575;if(delta<0)back=Math.min(back,-delta/Math.max(v.speed,1));else front=Math.min(front,delta)}return{back,front,clear:back>5&&front>30}}
function mergeView(){if(onFoot){$('mergePanel').style.display='none';return;}let nearest=rampNearest(x,z),box=$('mergePanel');if(nearest.distance>28||!nearest.ramp||nearest.ramp.type!=='entry'||nearest.index<nearest.ramp.points.length*.77||gear<0){box.style.display='none';return}box.style.display='block';let ramp=nearest.ramp,gap=mergeGap(ramp);$('mergeState').textContent=gap.clear?'GAP OPEN ? check traffic, then merge':'TRAFFIC APPROACHING ? yield before merging';$('mergeState').style.color=gap.clear?'#b8ef9a':'#ffc286';$('mergeTime').textContent='Hold C to look at approaching traffic. Behind: '+(isFinite(gap.back)?gap.back.toFixed(1)+' seconds':'clear')+' ? Ahead: '+(isFinite(gap.front)?Math.round(gap.front)+' m':'clear');const cv=$('mergeCanvas'),mc=cv.getContext('2d');mc.fillStyle='#142d35';mc.fillRect(0,0,300,90);mc.fillStyle='#4b5c63';mc.fillRect(0,18,300,48);mc.strokeStyle='#dce2d3';mc.setLineDash([9,7]);mc.beginPath();for(let y of [30,42,54]){mc.moveTo(0,y);mc.lineTo(300,y)}mc.stroke();mc.setLineDash([]);mc.strokeStyle='#80c9a3';mc.beginPath();mc.moveTo(150,85);mc.quadraticCurveTo(145,70,200,63);mc.stroke();for(let v of freewayCars.filter(v=>v.dir===1)){let dist=angle(v.theta-ramp.joinAngle)*575;if(Math.abs(dist)<180){mc.fillStyle=v.color;mc.fillRect(190+dist*.7-7,v.r===575?57:v.r===571?45:v.r===567?33:21,14,9)}}mc.fillStyle='#fff';mc.fillRect(147,70,8,11);mc.font='10px Arial';mc.fillText('APPROACHING ',8,13);mc.fillText('YOUR MERGE',205,77)}

const roads=[-320,-160,0,160,320],keys={},lot={x:55,z:72},bays=[];for(let j=0;j<7;j++){bays.push({x:34+j*7,z:48});bays.push({x:34+j*7,z:97})}let x=2.2,z=-65,yaw=0,speed=0,steering=0,t=0,last=0,active=false,park=false,gear=1,signal=0,signalAge=0,score=100,cooldown=0,noticeUntil=0,goals=[false,false,false],turnStart=0,turnTravel=0;
const cityRoutes=Array.from({length:8},(_,i)=>i<4?{left:-320,right:320,bottom:-320+i*160,top:-160+i*160}:{left:-320+(i-4)*160,right:-160+(i-4)*160,bottom:-320,top:320}).map(r=>({...r,w:r.right-r.left,h:r.top-r.bottom,length:2*(r.right-r.left+r.top-r.bottom)}));

let frameViewAngle=null;let faces=[];let crashed=false;const traffic=Array.from({length:64},(_,i)=>({s:(Math.floor(i/8)*200+(i%8)*17)%1600,route:i%8,v:(35+(i%4)*5)/2.237,color:['#c57957','#e6d6b4','#5e9aa9','#657bb0','#eee8dc'][i%5]}));
function say(s,d=4){$('notice').textContent=s;noticeUntil=t+d}function mark(i){goals[i]=true;$('m'+(i+1)).className='done';$('m'+(i+1)).textContent=['? Stopped at a red light','? Signaled road turn','? Parked in the lot'][i]}function penalty(s){if(t<cooldown)return;score=Math.max(0,score-5);cooldown=t+3;say(s+' ? -5 points')}function angle(a){return Math.atan2(Math.sin(a),Math.cos(a))}function phase(axis){let q=t%34;return axis==='z'?(q<12?'green':q<15?'amber':'red'):(q<17?'red':q<29?'green':q<32?'amber':'red')}function roadDist(a){return Math.min(...roads.map(b=>Math.abs(a-b)))}function driveable(a,b){return roadSurface(a,b)!==undefined}
function onLot(){return x>25&&x<88&&z>38&&z<108}
function reset(){onFoot=false;insideHome=false;parkedVehicle=null;homeSeated=false;staticKey="";groundY=0;lastHonk=-Infinity;resetVisitors();freewayCars.forEach((v,i)=>{v.theta=i*Math.PI*2/64;v.speed=v.cruise;v.hornUntil=0});crashed=false;cooldown=0;noticeUntil=0;signalAge=0;turnTravel=0;for(let k in keys)keys[k]=false;traffic.forEach((car,i)=>{car.s=(Math.floor(i/8)*200+(i%8)*17)%1600;car.speed=0;car.braking=false;car.hornUntil=0});$("crashPanel").style.display="none";x=2.2;z=-65;yaw=0;speed=0;steering=0;gear=1;park=false;signal=0;score=100;t=0;goals=[false,false,false];['	 Stop at a red light','	 Signal and turn onto another road','	 Park inside a marked lot space'].forEach((s,i)=>{$('m'+(i+1)).textContent=s;$('m'+(i+1)).className=''});say('Follow the map. The parking lot entrance is east of Palm Avenue.',7)}function action(k){if(crashed)return;if(k==='g'){toggleWalking();return}if(k==='f'){interactHome();return}if(onFoot)return;if(k==='v'){toggleView();return}if(k==='h'){honk();return}if(k==='q'||k==='e'){let s=k==='q'?-1:1;signal=signal===s?0:s;signalAge=0;turnStart=yaw;turnTravel=0}if(k==='r'&&Math.abs(speed)<.3){gear*=-1;say(gear===1?'Drive selected':'Reverse selected')}if(k==='p'){if(park){park=false;say('Parking brake released')}else if(Math.abs(speed)<.3){park=true;let bay=bays.find(b=>Math.abs(x-b.x)<2&&Math.abs(z-b.z)<2);if(bay&&Math.abs(Math.sin(yaw))<.25&&!occupied(bay)){mark(2);say(goals.every(Boolean)?'All challenges complete. Enjoy exploring!':'Nicely parked in the lot!',7)}else say('Park within an empty marked space, aligned with its lines.')}else say('Come to a complete stop before parking.')}}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(!keys[k]&&(active||k==='v'))action(k);keys[k]=true});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);addEventListener('blur',()=>{for(let k in keys)keys[k]=false;if(active){active=false;$('pause').textContent='Resume'}});document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(active)action(b.dataset.key);keys[b.dataset.key]=true};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false});$('start').onclick=()=>{initAudio();$('overlay').style.display='none';active=true;reset()};$('pause').onclick=()=>{if(crashed)return;initAudio();active=!active;$('pause').textContent=active?'Pause':'Resume'};$('restart').onclick=restartDrive;
function occupied(b){return bays.indexOf(b)%4===0||lotVisitors.some(v=>Math.abs(v.pose.x-b.x)<2&&Math.abs(v.pose.z-b.z)<3)}function carPose(s,route=0){let r=cityRoutes[route],d=((s%r.length)+r.length)%r.length;if(d<r.h)return{x:r.left+2.3,z:r.bottom+d,a:0};d-=r.h;if(d<r.w)return{x:r.left+d,z:r.top-2.3,a:Math.PI/2};d-=r.w;if(d<r.h)return{x:r.right-2.3,z:r.top-d,a:Math.PI};d-=r.h;return{x:r.right-d,z:r.bottom+2.3,a:-Math.PI/2}}

function update(dt){if(!active)return;t+=dt;if(onFoot){updateWalking(dt);return}advancePedestrians(dt);for(const p of pedestrianPoses())if(Math.abs(groundY)<1&&overlaps(x,z,yaw,p.x,p.z,p.a,"pedestrian")){crash("You hit a pedestrian.");return}signalAge+=dt;let input=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);steering+=(input-steering)*Math.min(1,dt*5);if(park)speed=0;else if(keys.s||keys.arrowdown||keys[' ']){let dec=9*dt;speed=Math.abs(speed)<dec?0:speed-Math.sign(speed)*dec}else if(keys.w||keys.arrowup)speed+=gear*vehicleSpec().accel*dt;else speed*=Math.exp(-.25*dt);speed=Math.max(-4,Math.min(150/2.237,speed));let dyaw=speed/vehicleSpec().wheelbase*Math.tan(steering*(.48/(1+Math.abs(speed)/20)))*dt;yaw=angle(yaw+dyaw);if(signal)turnTravel+=dyaw;let nx=x+Math.sin(yaw)*speed*dt,nz=z+Math.cos(yaw)*speed*dt;if(clearFootprint(nx,nz,yaw)){x=nx;z=nz;groundY=roadSurface(x,z,groundY)??groundY}else{crash('You hit a curb or roadside obstacle.');return}
if(signal&&signalAge>.6&&Math.abs(turnTravel)>1.15&&Math.sign(turnTravel)===signal){mark(1);signal=0;say('Nice turn! Blinker canceled.',4)}advanceTraffic(dt);advanceFreeway(dt);advanceVisitors(dt);for(let visitor of lotVisitors)if(overlaps(x,z,yaw,visitor.pose.x,visitor.pose.z,visitor.pose.a)){crash('You collided with a car using the parking lot.');return}if(crashed)return;for(let car of traffic){let p=carPose(car.s,car.route);if(overlaps(x,z,yaw,p.x,p.z,p.a,car.kind)){crash('You collided with another car.');return}}for(let b of bays.filter((b,i)=>i%4===0)){if(overlaps(x,z,yaw,b.x,b.z,0)){crash('You hit a parked car.');return}}let axis=Math.abs(Math.cos(yaw))>.75?'z':Math.abs(Math.sin(yaw))>.75?'x':null;if(axis&&!onLot()){let along=axis==='z'?z:x,across=axis==='z'?x:z,dir=axis==='z'?Math.cos(yaw):Math.sin(yaw);if(roadDist(across)<8){let next=roads.map(r=>(r-along)*Math.sign(dir)).filter(d=>d>0).sort((a,b)=>a-b)[0];if(next>10&&next<20&&phase(axis)==='red'&&Math.abs(speed)<.2){mark(0);say('Good stop. Wait for green.',2)}if(next>8&&next<9.5&&phase(axis)==='red'&&speed>1)penalty('Red light. Stop before the crosswalk');let center=roads.reduce((a,b)=>Math.abs(b-across)<Math.abs(a-across)?b:a);let right=axis==='z'?(across-center)*Math.sign(dir):-(across-center)*Math.sign(dir);if(right<-.8&&roadDist(along)>12)penalty('Oncoming lane. Keep to the right')}}if(speed>70/2.237)penalty('Speed limit is 70 mph');$('score').textContent=score;if(t>noticeUntil)$('notice').textContent=park?'Parked ? P to release':onLot()?'Parking lot ? Find an empty space, stop, then P':'Explore the neighborhood ? Q / E signal ? A / D steer';}
// Camera-space polygon clipping keeps every road, vehicle and building stable when turning.


function cityCruiseSpeed(car,pose){let route=cityRoutes[car.route],d=((car.s%route.length)+route.length)%route.length,corners=[0,route.h,route.h+route.w,2*route.h+route.w,route.length],next=Math.min(...corners.filter(v=>v>=d).map(v=>v-d)),since=d-Math.max(...corners.filter(v=>v<=d));let target=Math.min(car.v,Math.sqrt(6*6+6*Math.max(0,next-3)));if(since<6)target=Math.min(target,6+since*.7);if(Math.abs(pose.x)<9&&pose.z>40&&pose.z<100)target=Math.min(target,30/2.237);return Math.min(target,car.kind==='bus'?30/2.237:Infinity)}
function visitorStreetSpeed(v){let path=visitorPath(v),target=35/2.237;for(let ahead of [3,8,15,25,35]){let p=pathPose(path,Math.min(path.length,v.distance+ahead));if(Math.abs(angle(p.a-v.pose.a))>.15)target=Math.min(target,Math.sqrt(5.5*5.5+6*Math.max(0,ahead-3)))}return target}

function advanceTraffic(dt){const old=traffic.map(v=>({...carPose(v.s,v.route),speed:v.speed||0}));if(parkedVehicle&&!insideHome)old.push({x:parkedVehicle.x,z:parkedVehicle.z,a:parkedVehicle.yaw,speed:0});for(let i=0;i<traffic.length;i++){let car=traffic[i],p=old[i],route=cityRoutes[car.route],axis=Math.abs(Math.cos(p.a))>.5?'z':'x',dir=axis==='z'?Math.cos(p.a):Math.sin(p.a),along=axis==='z'?p.z:p.x,limit=Infinity,flowCap=Infinity,travelRoom=Infinity;for(let road of roads){let d=(road-along)*dir-(12+npcSpec(car).length/2);if(d>=-.001&&d<90&&phase(axis)!=='green')limit=Math.min(limit,Math.max(0,d))}for(let j=0;j<old.length;j++)if(j!==i){let q=old[j],f=(q.x-p.x)*Math.sin(p.a)+(q.z-p.z)*Math.cos(p.a),side=(q.x-p.x)*Math.cos(p.a)-(q.z-p.z)*Math.sin(p.a);if(f>0&&f<110&&Math.abs(side)<1.8&&Math.cos(q.a-p.a)>.8){let gap=Math.max(0,f-(3+(npcSpec(car).length+(traffic[j]?npcSpec(traffic[j]):vehicleSpecs[parkedVehicle.type]).length)/2));travelRoom=Math.min(travelRoom,gap);flowCap=Math.min(flowCap,Math.sqrt(q.speed*q.speed+6*gap),Math.max(0,q.speed+(gap-(car.speed||0)*1.2)*.6))}}let f=(x-p.x)*Math.sin(p.a)+(z-p.z)*Math.cos(p.a),side=(x-p.x)*Math.cos(p.a)-(z-p.z)*Math.sin(p.a);if(f>0&&f<95&&Math.abs(side)<2.1)limit=Math.min(limit,Math.max(0,f-(3+(npcSpec(car).length+vehicleSpec().length)/2)));limit=Math.min(limit,playerYieldDistance(p));for(let v of lotVisitors){let q=v.pose,f=(q.x-p.x)*Math.sin(p.a)+(q.z-p.z)*Math.cos(p.a),side=(q.x-p.x)*Math.cos(p.a)-(q.z-p.z)*Math.sin(p.a);if(f>0&&f<25&&Math.abs(side)<2.5)limit=Math.min(limit,Math.max(0,f-7))}let desired=Math.min(reactiveCruise(car,cityCruiseSpeed(car,p)),flowCap,Math.sqrt(6*limit)),before=car.speed||0;car.speed=desired<before?Math.max(desired,before-5*dt):Math.min(desired,before+reactiveAcceleration(car,3)*dt);let move=Math.min(car.speed*dt,limit,travelRoom);if(limit<.000001){move=0;car.speed=0}car.braking=car.speed<.5||desired<before-.1;car.s=(car.s+move)%route.length}}

function tint(hex,f=1,fog=0){let n=parseInt(hex.slice(1),16),rgb=[n>>16,(n>>8)&255,n&255],air=[190,207,207];return '#'+rgb.map((v,i)=>Math.round(Math.max(0,Math.min(255,v*f*(1-fog)+air[i]*fog)))).map(v=>v.toString(16).padStart(2,'0')).join('')}

function getViewAngle(){let a=yaw+(gear<0?Math.PI:0);if(keys.z)a-=Math.PI/2;if(keys.x)a+=Math.PI/2;if(keys.c){let near=rampNearest(x,z);if(near.ramp&&near.ramp.type==='entry'){let theta=near.ramp.joinAngle-.14;a=Math.atan2(575*Math.cos(theta)-x,575*Math.sin(theta)-z)}}return a}function camera(p){const rig=frameRig||makeCameraRig(),dx=p[0]-rig.x,dz=p[2]-rig.z,dy=p[1]-rig.height,a=rig.heading,forward=dx*Math.sin(a)+dz*Math.cos(a);return[dx*Math.cos(a)-dz*Math.sin(a),dy*Math.cos(rig.pitch)+forward*Math.sin(rig.pitch),forward*Math.cos(rig.pitch)-dy*Math.sin(rig.pitch)]}function face(pts,color,material=null){
 const points=pts.map(p=>[p[0],p[1]+modelLift,p[2]]);
 faces.push({points,color,material,glass:parseInt(color.slice(5,7),16)>parseInt(color.slice(1,3),16)*1.25&&parseInt(color.slice(5,7),16)>parseInt(color.slice(3,5),16)*.9});
}
function rect(a,b,d,e,col,y=.015){if(b-a>24||e-d>24){for(let xx=a;xx<b;xx+=20)for(let zz=d;zz<e;zz+=20)face([[xx,y,zz],[Math.min(b,xx+20),y,zz],[Math.min(b,xx+20),y,Math.min(e,zz+20)],[xx,y,Math.min(e,zz+20)]],col);return}face([[a,y,d],[b,y,d],[b,y,e],[a,y,e]],col)}function cube(a,b,w,l,h,col,rotation=0,base=0,material=null){if(Math.hypot(a-x,b-z)>(h>25?650:360))return;let pts=[];for(let yy of [base,base+h])for(let pair of [[-w/2,-l/2],[w/2,-l/2],[w/2,l/2],[-w/2,l/2]])pts.push([a+pair[0]*Math.cos(rotation)+pair[1]*Math.sin(rotation),yy,b-pair[0]*Math.sin(rotation)+pair[1]*Math.cos(rotation)]);for(let ids of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]){let pp=ids.map(i=>pts[i]);let u=pp[1].map((v,i)=>v-pp[0][i]),v=pp[2].map((v,i)=>v-pp[0][i]);let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal)||1;if(ids[0]===4)normal=normal.map(v=>-v);let light=.69+.39*Math.max(0,(normal[0]*.5+normal[1]*.8+normal[2]*.3)/length);face(pp,col,material)}}function oldCar(a,b,r,col,braking=false){const shadow=[[-1.2,-2.5],[1.2,-2.5],[1.2,2.5],[-1.2,2.5]].map(([dx,dz])=>[a+dx*Math.cos(r)+dz*Math.sin(r),.075,b-dx*Math.sin(r)+dz*Math.cos(r)]);face(shadow,'#343f40');cube(a,b,1.85,4.3,.65,col,r,.35);cube(a-Math.sin(r)*.2,b-Math.cos(r)*.2,1.58,2.15,.62,'#29424b',r,1);cube(a,b,1.6,1.5,.09,col,r,1.62);for(let side of [-1,1])for(let end of [-1,1]){let dx=side*.9,dz=end*1.35;cube(a+dx*Math.cos(r)+dz*Math.sin(r),b-dx*Math.sin(r)+dz*Math.cos(r),.22,.7,.55,'#172329',r,.15)}for(let side of [-1,1])cube(a+side*.61*Math.cos(r)-2.17*Math.sin(r),b-side*.61*Math.sin(r)-2.17*Math.cos(r),.38,.07,.2,braking?'#ff4030':'#943c35',r,.65);for(let side of [-1,1]){cube(a+side*.61*Math.cos(r)+2.17*Math.sin(r),b-side*.61*Math.sin(r)+2.17*Math.cos(r),.42,.08,.19,'#fff2ce',r,.68);cube(a+side*1.02*Math.cos(r)+.6*Math.sin(r),b-side*1.02*Math.sin(r)+.6*Math.cos(r),.22,.3,.16,col,r,1.18)}cube(a-2.19*Math.sin(r),b-2.19*Math.cos(r),.47,.06,.16,'#dedbd2',r,.46)}

function signalHead(rx,rz,side,axis){if(Math.hypot(rx-x,rz-z)>280)return;const color=phase(axis);function at(lateral,along,y){return axis==='z'?[rx+side*lateral,y,rz-side*along]:[rx-side*along,y,rz-side*lateral]}function part(lateral,along,y,w,l,h,col){let p=at(lateral,along,y);cube(p[0],p[2],axis==='z'?w:l,axis==='z'?l:w,h,col,0,y)}
part(8.8,-12,0,.18,.18,6.6,'#596164');part(5.1,-12,6.35,7.6,.18,.18,'#667375');
for(let lane of [2.2,6]){part(lane,-12,4.75,1.02,.52,1.65,'#18272c');part(lane,-12,4.68,1.2,.16,1.82,'#dfbb57');part(lane,-11.88,4.76,.98,.45,1.64,'#1c292e');for(let [name,height] of [['red',6.05],['amber',5.55],['green',5.05]]){let lit=name===color;let center=at(lane,-11.61,height),radius=.185;let pts=[];for(let j=0;j<14;j++){let a=j*Math.PI*2/14;pts.push(axis==='z'?[center[0]+Math.cos(a)*radius,center[1]+Math.sin(a)*radius,center[2]]:[center[0],center[1]+Math.sin(a)*radius,center[2]+Math.cos(a)*radius])}face(pts,lit?{red:'#ff4636',amber:'#ffd34d',green:'#62f0a0'}[name]:'#31403e')}}}

let staticFaces=null,staticKey='';
function drawWorld(){
 if(insideHome){frameViewAngle=yaw;frameRig=makeCameraRig();graphics.beginFrame();const homeKey=homeTV+':'+homeLights;if(!interiorFaces||interiorKey!==homeKey){faces=[];drawHomeInterior();interiorFaces=faces;interiorKey=homeKey}graphics.render(interiorFaces,{rig:frameRig,width:W,height:H,focal:focalLength(),time:t,player:{x,z,yaw,groundY:0,speed:0,steering:0,gear:1,park:true,signal:0,thirdPerson:false,onFoot:true,insideHome:true,homeLights,homeTV,vehicleType,eye:1.65}});frameRig=null;frameViewAngle=null;return}
 frameViewAngle=getViewAngle();frameRig=makeCameraRig();graphics.beginFrame();
 const key=Math.floor(x/40)+','+Math.floor(z/40)+','+phase('x')+','+phase('z');
 if(key!==staticKey||!staticFaces){faces=[];face([[x-850,-.04,z-850],[x+850,-.04,z-850],[x+850,-.04,z+850],[x-850,-.04,z+850]],'#819b76');if(!graphics){c.fillStyle='#819b76';c.fillRect(0,H*.43,W,H*.57);}for(let r of roads){rect(r-9.5,r+9.5,-342,342,'#cbc9b8');rect(-342,342,r-9.5,r+9.5,'#cbc9b8');rect(r-8,r+8,-342,342,'#48545b',.02);rect(-342,342,r-8,r+8,'#48545b',.02);for(let a=-340;a<340;a+=5){if(roadDist(a)<12)continue;for(let off of [-.13,.13]){rect(r+off-.035,r+off+.035,a,a+5,'#e3c474',.04);rect(a,a+5,r+off-.035,r+off+.035,'#e3c474',.04)}for(let off of [-4,4]){rect(r+off-.04,r+off+.04,a,a+2.5,'#d8dbd3',.04);rect(a,a+2.5,r+off-.04,r+off+.04,'#d8dbd3',.04)}}}for(let r of roads)for(let v=-336;v<340;v+=16){if(roadDist(v)<14)continue;rect(r-7.8,r-7.3,v,v+1,'#38464d',.03);rect(r+7.3,r+7.8,v,v+1,'#38464d',.03);rect(v,v+1,r-7.8,r-7.3,'#38464d',.03);rect(v,v+1,r+7.3,r+7.8,'#38464d',.03);rect(r-9.4,r-8.2,v,v+.055,'#9da69d',.018);rect(r+8.2,r+9.4,v,v+.055,'#9da69d',.018)}rect(8,29,65,79,'#59636a',.045);rect(25,88,38,108,'#626a6a',.025);for(let b of bays){rect(b.x-2.8,b.x-2.7,b.z-4,b.z+4,'#e1e9d8',.05);rect(b.x+2.7,b.x+2.8,b.z-4,b.z+4,'#e1e9d8',.05);rect(b.x-2.8,b.x+2.8,b.z+(b.z<70?-4:4),b.z+(b.z<70?-3.9:4.1),'#e1e9d8',.05);}
for(let rx of roads)for(let rz of roads){rect(rx+.2,rx+7.7,rz-12,rz-11.65,'#eee8d8',.065);rect(rx-7.7,rx-.2,rz+11.65,rz+12,'#eee8d8',.065);rect(rx-12,rx-11.65,rz-7.7,rz-.2,'#eee8d8',.065);rect(rx+11.65,rx+12,rz+.2,rz+7.7,'#eee8d8',.065);for(let k=-7;k<8;k+=2){rect(rx+k,rx+k+1,rz-11,rz-9,'#dddcca',.06);rect(rx+k,rx+k+1,rz+9,rz+11,'#dddcca',.06);rect(rx-11,rx-9,rz+k,rz+k+1,'#dddcca',.06);rect(rx+9,rx+11,rz+k,rz+k+1,'#dddcca',.06)}for(let side of [-1,1]){signalHead(rx,rz,side,'z');signalHead(rx,rz,side,'x')}}

ultraBuildings();for(let a=-300;a<=340;a+=30){if(roadDist(a)>18){tree(-11,a,1);tree(a,-11,1)}}
 streetDetails();ultraStreetDetails();drawNeighborhoods();drawResidentialSidewalks();drawFreeway();ultraFreewayDetails();staticFaces=faces;staticKey=key;
 }
 faces=staticFaces;
 for(const v of traffic){const p=carPose(v.s,v.route);car(p.x,p.z,p.a,v.color,v.braking,reactiveIndicator(v,cityBlinker(v)),0,v.kind)}
 for(const v of lotVisitors)car(v.pose.x,v.pose.z,v.pose.a,v.color,v.braking,reactiveIndicator(v,v.signal));
 for(const v of freewayCars){const p=freewayPose(v);car(p.x,p.z,p.a,v.color,v.speed<v.cruise-2,reactiveIndicator(v,0),HIGHWAY_Y,v.kind)}
 for(const [i,b] of bays.entries())if(i%4===0)car(b.x,b.z,0,'#b7c1b9');
 if(thirdPerson&&!onFoot)car(x,z,yaw,vehicleSpec().color,park||!!(keys.s||keys.arrowdown||keys[' ']),signal,groundY,vehicleType);
 if(parkedVehicle&&!insideHome){const p=parkedVehicle;car(p.x,p.z,p.yaw,vehicleSpecs[p.type].color,true,0,0,p.type)}

 graphics.render(faces,{rig:frameRig,width:W,height:H,focal:focalLength(),time:t,pedestrians:pedestrianPoses(),player:{x,z,yaw,groundY,speed,steering,gear,park,signal,thirdPerson,onFoot,insideHome,vehicleType,eye:vehicleSpec().eye}});
 frameRig=null;frameViewAngle=null;
}
function map(){const size=Math.min(170,W*.24),left=W-size-25,top=95,scale=size/1700; c.fillStyle='#183039ed';c.fillRect(left,top,size,size);function p(a,b){return[left+size/2+a*scale,top+size/2-b*scale]}c.strokeStyle='#8fbac6';c.lineWidth=5;c.beginPath();c.arc(left+size/2,top+size/2,560*scale,0,Math.PI*2);c.stroke();for(let ramp of ramps){c.strokeStyle=ramp.type==='entry'?'#87db9b':'#efc575';c.lineWidth=2;c.beginPath();ramp.points.forEach((q,i)=>i?c.lineTo(...p(...q)):c.moveTo(...p(...q)));c.stroke();let q=ramp.points[ramp.type==='entry'?0:ramp.points.length-1];c.fillStyle=ramp.type==='entry'?'#87db9b':'#efc575';c.font='bold 9px Arial';c.fillText(ramp.type==='entry'?'IN':'OUT',...p(q[0],q[1]))}c.lineWidth=7;c.strokeStyle='#708184';for(let r of roads){c.beginPath();c.moveTo(...p(r,-340));c.lineTo(...p(r,340));c.moveTo(...p(-340,r));c.lineTo(...p(340,r));c.stroke()}c.fillStyle='#ffe49c';c.font='bold 11px Arial';c.fillText('HOME',...p(homes[19].x,homes[19].z));c.fillStyle='#b8ed9c';let lp=p(25,108);c.fillRect(lp[0],lp[1],63*scale,70*scale);c.fillStyle='#112f32';c.font='bold 12px Arial';c.textAlign='center';c.fillText('P',...p(55,65));for(let car of traffic){let q=carPose(car.s,car.route);c.fillStyle='#e9c29d';c.fillRect(...p(q.x,q.z),3,3)}let pp=p(x,z);c.save();c.translate(...pp);c.rotate(yaw);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-6);c.lineTo(-4,5);c.lineTo(4,5);c.closePath();c.fill();c.restore();c.fillStyle='#d6e5dd';c.font='10px Arial';c.fillText('NEIGHBORHOOD ? N ',left+size/2,top+size+17)}
function draw(){c.clearRect(0,0,W,H);drawWorld();if(!insideHome)map();thirdPersonHUD();walkingHint();}
function signalHUD(){if(onFoot||onLot()||crashed||gear<0||Math.hypot(x,z)>350){$('signalStatus').style.display='none';return}const axis=Math.abs(Math.cos(yaw))>.85?'z':Math.abs(Math.sin(yaw))>.85?'x':null;if(!axis){$('signalStatus').style.display='none';return}const along=axis==='z'?z:x,across=axis==='z'?x:z,dir=Math.sign(axis==='z'?Math.cos(yaw):Math.sin(yaw));let dist=Math.min(...roads.map(r=>(r-along)*dir).filter(d=>d>10));if(roadDist(across)>8||dist>120){$('signalStatus').style.display='none';return}const state=phase(axis);$('signalStatus').style.display='block';$('signalStatus').textContent=(state==='red'?'STOP':state==='amber'?'PREPARE TO STOP':'GREEN - PROCEED IF CLEAR')+' ? '+Math.max(0,Math.round(dist-14.2))+' m to line';$('signalStatus').style.borderColor={red:'#ff766b',amber:'#ffdc73',green:'#a7edb4'}[state];$('signalStatus').style.color={red:'#ffb2a9',amber:'#ffdf84',green:'#bdf5c8'}[state];const label=$('signalStatus').textContent;$('signalStatus').innerHTML='<span style="display:block;margin-bottom:6px">'+['red','amber','green'].map(k=>'<i style="display:inline-block;width:14px;height:14px;border-radius:50%;margin:0 5px;background:'+({red:'#ff6256',amber:'#ffd15b',green:'#80efaa'}[k]===undefined?'#35433d':k===state?{red:'#ff6256',amber:'#ffd15b',green:'#80efaa'}[k]:'#35433d')+'"></i>').join('')+'</span>'+label}

function frame(ms){const dt=Math.min(.04,(ms-last)/1000);last=ms;for(let step=0;step<Math.ceil(dt/.008);step++)update(dt/Math.ceil(dt/.008));updateAudio();updateHorn();draw();signalHUD();mergeView();requestAnimationFrame(frame)}
function clearFootprint(px,pz,a){const s=vehicleSpec(),w=s.width/2,l=s.length/2;for(let dx of [-w,0,w])for(let i=0;i<=Math.ceil(s.length);i++){const dz=-l+s.length*i/Math.ceil(s.length);if(!driveable(px+dx*Math.cos(a)+dz*Math.sin(a),pz-dx*Math.sin(a)+dz*Math.cos(a)))return false}return true}
function overlaps(ax,az,aa,bx,bz,ba,bKind='car'){const axes=[[Math.cos(aa),-Math.sin(aa)],[Math.sin(aa),Math.cos(aa)],[Math.cos(ba),-Math.sin(ba)],[Math.sin(ba),Math.cos(ba)]];for(let n of axes){const radius=(a,px,pz)=>{const s=px===x&&pz===z?(onFoot?{width:.65,length:.65}:vehicleSpec()):(bKind==='pedestrian'?{width:.65,length:.65}:vehicleSpecs[bKind]||vehicleSpecs.car);return s.width/2*Math.abs(n[0]*Math.cos(a)-n[1]*Math.sin(a))+s.length/2*Math.abs(n[0]*Math.sin(a)+n[1]*Math.cos(a))};if(Math.abs((bx-ax)*n[0]+(bz-az)*n[1])>radius(aa,ax,az)+radius(ba,bx,bz))return false}return true}
function crash(reason){if(crashed)return;crashed=true;active=false;speed=0;for(let k in keys)keys[k]=false;impactSound();$('crashReason').textContent=reason;$('crashScore').textContent='Drive ended ? '+score+' points';$('crashPanel').style.display='grid';$('pause').textContent='Pause';}
function restartDrive(){initAudio();reset();active=true;$('overlay').style.display='none';$('pause').textContent='Pause'}
let audio=null,master=null,engine=null,engineGain=null,muted=false,lastTick=-1,lastReverse=-1;
function initAudio(){try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){$('sound').textContent='Sound unavailable';return}audio=new Audio();master=audio.createGain();master.gain.value=.35;master.connect(audio.destination);engine=audio.createOscillator();engine.type='triangle';engineGain=audio.createGain();engineGain.gain.value=0;engine.connect(engineGain);engineGain.connect(master);engine.start()}audio.resume().catch(()=>{})}catch(e){$('sound').textContent='Sound unavailable'}}
function tone(freq,seconds,volume,type='sine'){if(!audio||muted)return;let o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.0001,now+seconds);o.connect(g);g.connect(master);o.start();o.stop(now+seconds);o.onended=()=>{o.disconnect();g.disconnect()}}
function impactSound(){if(!audio||muted)return;const len=Math.floor(audio.sampleRate*.45),buffer=audio.createBuffer(1,len,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);let source=audio.createBufferSource(),g=audio.createGain();source.buffer=buffer;g.gain.value=.8;source.connect(g);g.connect(master);source.start();source.onended=()=>{source.disconnect();g.disconnect()};tone(65,.5,.8,'triangle')}
function updateAudio(){if(!audio)return;const now=audio.currentTime;master.gain.setTargetAtTime(muted?0:.35,now,.03);engine.frequency.setTargetAtTime(42+Math.abs(speed)*8+(keys.w&&active?12:0),now,.09);engineGain.gain.setTargetAtTime(active&&!crashed&&!onFoot?.13+Math.abs(speed)*.006:0,now,.08);if(active&&signal){let tick=Math.floor(t*3);if(tick!==lastTick){tone(tick%2?850:1100,.04,.15,'square');lastTick=tick}}if(active&&gear<0){let tick=Math.floor(t*1.5);if(tick!==lastReverse){tone(640,.14,.12);lastReverse=tick}}}
$('sound').onclick=()=>{initAudio();muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted))};$('crashRestart').onclick=restartDrive;

// Hardware depth testing keeps road paint, glass, cars and buildings in the right order.
let graphics=null;
function initGraphics(){return createRenderer(canvas)}
function mesh(a,b,r,vertices,polygons,color){let cs=Math.cos(r),sn=Math.sin(r);let pts=vertices.map(p=>[a+p[0]*cs+p[2]*sn,p[1],b-p[0]*sn+p[2]*cs]);polygons.forEach((ids,i)=>face(ids.map(j=>pts[j]),color,color==='#284654'?3:6))}
function wheel(a,b,r,side,end){const cs=Math.cos(r),sn=Math.sin(r),cx=side*.96,cz=end*1.36;function p(dx,yy,zz){return[a+dx*cs+zz*sn,yy,b-dx*sn+zz*cs]}for(let i=0;i<12;i++){let u=i*Math.PI/6,v=(i+1)*Math.PI/6;let pts=[p(cx-.115,.39+Math.cos(u)*.35,cz+Math.sin(u)*.35),p(cx+.115,.39+Math.cos(u)*.35,cz+Math.sin(u)*.35),p(cx+.115,.39+Math.cos(v)*.35,cz+Math.sin(v)*.35),p(cx-.115,.39+Math.cos(v)*.35,cz+Math.sin(v)*.35)];face(pts,i%2?'#20262a':'#141b20');let outer=cx+side*.12;face([p(outer,.39,cz),p(outer,.39+Math.cos(u)*.24,cz+Math.sin(u)*.24),p(outer,.39+Math.cos(v)*.24,cz+Math.sin(v)*.24)],i%2?'#b1bcc1':'#62747f')}}
function detailedCar(a,b,r,col,braking=false){if(Math.hypot(a-x,b-z)>260)return;const cs=Math.cos(r),sn=Math.sin(r);function part(dx,dz,w,l,h,color,y){cube(a+dx*cs+dz*sn,b-dx*sn+dz*cs,w,l,h,color,r,y)}
face([[-1.16,-2.45],[1.16,-2.45],[1.16,2.45],[-1.16,2.45]].map(([dx,dz])=>[a+dx*cs+dz*sn,.074,b-dx*sn+dz*cs]),'#343f40');
mesh(a,b,r,[[-.86,.35,-2.12],[.86,.35,-2.12],[.91,.35,1.95],[-.91,.35,1.95],[-.88,.94,-2.0],[.88,.94,-2.0],[.85,.88,2.1],[-.85,.88,2.1]],[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]],col);
mesh(a,b,r,[[-.78,.95,-1.15],[.78,.95,-1.15],[.78,.95,1.13],[-.78,.95,1.13],[-.66,1.55,-.68],[.66,1.55,-.68],[.66,1.55,.48],[-.66,1.55,.48]],[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]],'#284654');part(0,-.10,1.35,1.2,.07,col,1.55);
for(let side of [-1,1]){for(let end of [-1,1])wheel(a,b,r,side,end);part(side*.91,0,.035,3.2,.05,'#b2bec1',.84);part(side*.79,-.12,.025,.09,.58,'#27343a',.96);part(side*.93,-.32,.025,.27,.05,'#c2c8c3',.85);part(side*1.01,.58,.23,.27,.13,col,1.13);part(side*.59,2.09,.47,.06,.16,'#fff4d5',.69);part(side*.61,-2.06,.39,.06,.17,braking?'#ff493a':'#a34236',.70)}part(0,2.09,.72,.06,.20,'#263239',.43);part(0,-2.13,.45,.055,.15,'#e9e5d6',.47);part(0,-2.14,1.5,.06,.05,'#b2bab9',.37);
}
function buildingShadow(a,b,height){
 if(Math.hypot(a-x,b-z)>200)return;
 face([[a-11.5-height*.625,.009,b-11.5-height*.375],[a+11.5-height*.625,.009,b-11.5-height*.375],[a+11.5,.009,b-11.5],[a+11.5,.009,b+11.5],[a-11.5,.009,b+11.5],[a-11.5-height*.625,.009,b+11.5-height*.375]],'#65745f');
}
function tree(a,b,scale=1){
 const site=treeSite(a,b,scale);if(!site)return;[a,b]=site;const distance=Math.hypot(a-x,b-z);if(distance>245)return;
 cube(a,b,.30*scale,.30*scale,3.4*scale,'#6b5d4b');
 const clusters=distance<110?4:2,segments=distance<110?8:6;
 for(let n=0;n<clusters;n++){let cx=a+Math.sin(n*2.4)*.85*scale,cz=b+Math.cos(n*2.4)*.8*scale,cy=(3.5+n*.35)*scale,rad=(1.8-n*.12)*scale;
 for(let j=0;j<4;j++)for(let k=0;k<segments;k++){function p(row,col){let lat=-Math.PI/2+row*Math.PI/4,lon=col*Math.PI*2/segments;return[cx+Math.cos(lat)*Math.cos(lon)*rad,cy+Math.sin(lat)*rad*1.1,cz+Math.cos(lat)*Math.sin(lon)*rad]}let light=.75+.25*Math.max(0,Math.sin(k*Math.PI*2/segments)+j*.15);face([p(j,k),p(j,k+1),p(j+1,k+1),p(j+1,k)],tint(['#55724a','#496b45','#617b50','#4c704b'][n],light),4);}}
}
function streetDetails(){
for(let r of roads)for(let q=-280;q<=280;q+=40){if(roadDist(q)<20)continue;for(let side of [-1,1]){let a=r+side*10.7,b=q;if(Math.hypot(a-x,b-z)>190)continue;cube(a,b,.13,.13,5.8,'#55636a');cube(a-side*.65,b,1.4,.16,.12,'#68777d',0,5.7);cube(a-side*1.2,b,.6,.33,.08,'#f4ebc9',0,5.65);if(q%80===40)tree(a+side*2.8,b+7,.85)}}
for(let a=-300;a<340;a+=40)for(let b=-300;b<340;b+=40){if(residentialDistrict(a,b)||roadDist(a)<17||roadDist(b)<17||(a>10&&a<105&&b>15&&b<130)||Math.hypot(a-x,b-z)>160)continue;let height=ultraBuildingHeight(a,b),roofBase=height+(ultraBuildingStyle(a,b)===2?4:0);if(Math.hypot(a-x,b-z)<95){for(let floor=2;floor<Math.min(height,7)-1;floor+=3.2){cube(a,b-11.58,22,.16,.09,'#b5b6ad',0,floor-.1);cube(a,b+11.58,22,.16,.09,'#b5b6ad',0,floor-.1);cube(a-11.58,b,.16,22,.09,'#a5a89f',0,floor-.1);cube(a+11.58,b,.16,22,.09,'#a5a89f',0,floor-.1)}cube(a,b,23.6,23.6,.22,'#8f928b',0,.05)}cube(a+4,b-3,3,4,1,'#91a2a1',0,roofBase+.4);cube(a-4,b+2,2.1,2.4,.7,'#7d8d91',0,roofBase+.4);cube(a,b-11.59,2.3,.10,2.7,'#3d5660',0,.1);cube(a,b-11.68,2.8,.85,.13,'#b7bdb3',0,2.9);cube(a+1,b-11.68,.08,.06,.55,'#d8d9c8',0,1.0);if(Math.abs(a+b)%3===0){cube(a,b-12.4,6,1.7,.20,'#567d77',0,3.3);for(let w=-2;w<=2;w++)cube(a+w,b-13.1,.5,.17,.26,w%2?'#d6d1b5':'#537e75',0,3.1)}}
// Low shrubs and realistic tree silhouettes around the lot.
for(let q=30;q<88;q+=12){tree(q,112,.8);cube(q,114,8,1.6,.7,'#66855e')}
for(let side=0;side<4;side++){let p=rotatePoint([480,25],side*Math.PI/2);cube(p[0],p[1],.2,.2,5,'#667779');let p2=rotatePoint([480,25],side*Math.PI/2);cube(p2[0],p2[1],6,.2,1.5,'#3e7565',side*Math.PI/2,4.2)}
}
function cockpitDetails(){if(gear<0)return;let g=c.createLinearGradient(0,H*.81,0,H);g.addColorStop(0,'#40545d');g.addColorStop(.05,'#1b2c36');g.addColorStop(1,'#0d1820');c.fillStyle=g;c.beginPath();c.moveTo(W*.42,H*.846);c.lineTo(W*.74,H*.835);c.lineTo(W*.78,H);c.lineTo(W*.42,H);c.fill();c.strokeStyle='#8f9c9c';c.lineWidth=1;c.beginPath();c.moveTo(W*.43,H*.85);c.lineTo(W*.73,H*.84);c.stroke();c.fillStyle='#071b25';c.fillRect(W*.46,H*.856,W*.24,H*.10);c.textAlign='center';c.font='12px Arial';c.fillStyle='#a4bcc4';c.fillText('J A S M I N E',W*.82,H*.89);for(let yy of [.916,.925,.934,.943]){c.strokeStyle='#4a5c65';c.beginPath();c.moveTo(W*.76,H*yy);c.lineTo(W*.91,H*yy);c.stroke()}c.fillStyle='#edf6ed';c.font='36px Arial';c.fillText(Math.round(Math.abs(speed)*2.237),W*.55,H*.9);c.fillStyle='#9db8c0';c.font='10px Arial';c.fillText('MPH',W*.55,H*.935);c.fillStyle='#b8ef9a';c.font='20px Arial';c.fillText(park?'P':gear===1?'D':'R',W*.66,H*.909);for(let dir of [-1,1]){c.fillStyle=signal===dir&&Math.floor(t*3)%2===0?'#b8ef9a':'#3b535b';c.fillText(dir<0?'?':'?',W*(dir<0?.48:.615),H*.9)}}

function car(a,b,r,col,braking=false,indicator=0,elevation=0,kind='car'){if(Math.hypot(a-x,b-z)<340)graphics.car(a,b,r,col,braking,indicator,elevation,kind)}
// Cars reserve one bay for a complete visit. Reverse-out maneuvers share the aisle.
const lotVisitors=[];
function makePath(){const pts=[];return{pts,line(a,b){if(!pts.length)pts.push(a);let len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let i=1;i<=Math.max(1,Math.ceil(len/2));i++){let f=i/Math.max(1,Math.ceil(len/2));pts.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f])}return this},curve(a,b,c,d){if(!pts.length)pts.push(a);for(let i=1;i<=24;i++){let f=i/24,u=1-f;pts.push([0,1].map(k=>u*u*u*a[k]+3*u*u*f*b[k]+3*u*f*f*c[k]+f*f*f*d[k]))}return this},finish(){let lengths=[0];for(let i=1;i<pts.length;i++)lengths.push(lengths[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return{pts,lengths,length:lengths[lengths.length-1]}}}}
function pathPose(path,d,reverse=false){d=Math.max(0,Math.min(path.length,d));let i=1;while(i<path.lengths.length-1&&path.lengths[i]<d)i++;let a=path.pts[i-1],b=path.pts[i],span=path.lengths[i]-path.lengths[i-1],f=span?(d-path.lengths[i-1])/span:0;return{x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,a:angle(Math.atan2(b[0]-a[0],b[1]-a[1])+(reverse?Math.PI:0))}}
function visitPaths(bay){const upper=bay.z>70;let bx=bay.x,bz=bay.z,turnZ=upper?76:62;
const incoming=makePath().line([6,28],[6,62]).curve([6,62],[6,66],[9,69],[13,69]).line([13,69],[bx-7,69]).curve([bx-7,69],[bx-3,69],[bx,upper?72:66],[bx,turnZ]).line([bx,turnZ],[bx,bz]).finish();
const reverseStart=upper?82:68;
const backing=makePath().line([bx,bz],[bx,reverseStart]).curve([bx,reverseStart],[bx,upper?78:72],[bx+3,75],[bx+7,75]).finish();
const outgoing=makePath().line([bx+7,75],[13,75]).curve([13,75],[5,75],[-2.3,76],[-2.3,66]).line([-2.3,66],[-2.3,-150]).curve([-2.3,-150],[-2.3,-158],[2,-162.3],[10,-162.3]).line([10,-162.3],[150,-162.3]).curve([150,-162.3],[158,-162.3],[162.3,-158],[162.3,-150]).line([162.3,-150],[162.3,-10]).curve([162.3,-10],[162.3,-2],[158,2.3],[150,2.3]).line([150,2.3],[10,2.3]).curve([10,2.3],[4,2.3],[2.3,4],[2.3,10]).line([2.3,10],[2.3,22]).curve([2.3,22],[2.3,26],[6,24],[6,28]).finish();return{incoming,backing,outgoing}}
function resetVisitors(){lotVisitors.length=0;[1,5,9].forEach((bayIndex,i)=>{let bay=bays[bayIndex],paths=visitPaths(bay);lotVisitors.push({id:i,bayIndex,paths,state:i?'parked':'incoming',distance:0,speed:0,timer:12+i*12,color:['#b7654d','#7e9cb3','#e1cfb3'][i],signal:0,braking:true,pose:i?{x:bay.x,z:bay.z,a:bay.z>70?0:Math.PI}:pathPose(paths.incoming,0)})})}
function visitorPath(v){return v.paths[v.state]}
function signalForPath(v){if(v.state==='parked')return 0;if(v.state==='backing')return bays[v.bayIndex].z>70?-1:1;let path=visitorPath(v),ahead=pathPose(path,Math.min(path.length,v.distance+14)),turn=angle(ahead.a-v.pose.a);return Math.abs(turn)>.18?Math.sign(turn):0}
function playerYieldDistance(p){if(Math.abs((p.height||0)-groundY)>2)return Infinity;if(!signal||signalAge<.35||gear<0||Math.cos(p.a-yaw)<.75)return Infinity;let dx=x-p.x,dz=z-p.z,f=dx*Math.sin(p.a)+dz*Math.cos(p.a),side=dx*Math.cos(p.a)-dz*Math.sin(p.a);if(f< -5||f>65)return Infinity;const sameLane=Math.abs(side)<1.8,signalingIntoLane=Math.abs(side)<7&&side*signal<0;if(sameLane||signalingIntoLane)return Math.max(0,f-15);return Infinity}
function cityBlinker(v){let r=cityRoutes[v.route],d=((v.s%r.length)+r.length)%r.length;let corners=[r.h,r.h+r.w,2*r.h+r.w,r.length];return corners.some(k=>k-d>=0&&k-d<25)||d<4?1:0}
function visitorObstacle(v,step){let next=pathPose(visitorPath(v),Math.min(visitorPath(v).length,v.distance+step),v.state==='backing');const nearby=[{x,z,a:yaw},...(parkedVehicle&&!insideHome?[{x:parkedVehicle.x,z:parkedVehicle.z,a:parkedVehicle.yaw}]:[]),...traffic.map(car=>carPose(car.s,car.route)),...lotVisitors.filter(o=>o!==v).map(o=>o.pose),...bays.filter((b,i)=>i%4===0).map(b=>({x:b.x,z:b.z,a:0}))];return nearby.some(p=>Math.hypot(p.x-next.x,p.z-next.z)<7&&overlaps(next.x,next.z,next.a,p.x,p.z,p.a))}
function advanceVisitors(dt){for(let v of lotVisitors){
if(v.state==='parked'){v.speed=0;v.signal=0;v.timer-=dt;if(v.timer<=0){const aisleBusy=lotVisitors.some(o=>o!==v&&o.state==='backing');const userNear=Math.hypot(x-v.pose.x,z-v.pose.z)<9;if(!aisleBusy&&!userNear){v.state='backing';v.distance=0;v.signal=1;v.speed=0}}continue}
if(activeReaction(v)&&v.hornMode==='caution'&&t-v.hornAt<1.2){v.speed=0;v.braking=true;continue}let path=visitorPath(v),limit=path.length-v.distance,pose=v.pose,nearLot=pose.x> -10&&pose.x<90&&pose.z>24&&pose.z<108;
let cruise=v.state==='backing'?1.5:nearLot?3.4:visitorStreetSpeed(v);limit=Math.min(limit,playerYieldDistance(pose));
// Approaches stop at the same lines as other city traffic; vehicles inside clear the intersection.
if(!nearLot&&v.state==='outgoing'){let axis=Math.abs(Math.cos(pose.a))>.94?'z':Math.abs(Math.sin(pose.a))>.94?'x':null;if(axis){let along=axis==='z'?pose.z:pose.x,dir=axis==='z'?Math.cos(pose.a):Math.sin(pose.a);for(let road of roads){let d=(road-along)*dir-14;if(d>=-.01&&d<40&&phase(axis)!=='green')limit=Math.min(limit,Math.max(0,d))}}}
let blocked=visitorObstacle(v,Math.max(.3,v.speed*1.4+1));if(blocked){v.speed=0;v.braking=true;v.signal=signalForPath(v);continue}
let speedBefore=v.speed;let wanted=Math.min(cruise,Math.sqrt(6*Math.max(0,limit)));v.speed=wanted<v.speed?Math.max(wanted,v.speed-4*dt):Math.min(wanted,v.speed+(nearLot?1.3:2.6)*dt);let step=Math.min(v.speed*dt,limit);v.braking=wanted<speedBefore-.1||v.speed<.15;if(visitorObstacle(v,step)){v.speed=0;continue}v.distance+=step;v.pose=pathPose(path,v.distance,v.state==='backing');v.signal=signalForPath(v);
if(v.distance>=path.length-.025){v.distance=0;v.speed=0;if(v.state==='incoming'){v.state='parked';v.timer=22+v.id*8;v.signal=0;v.pose={x:bays[v.bayIndex].x,z:bays[v.bayIndex].z,a:bays[v.bayIndex].z>70?0:Math.PI}}else if(v.state==='backing'){v.state='outgoing';v.pose=pathPose(v.paths.outgoing,0)}else{v.state='incoming';v.pose=pathPose(v.paths.incoming,0)}}
if(overlaps(x,z,yaw,v.pose.x,v.pose.z,v.pose.a))crash('You collided with a car visiting the parking lot.')
}}
function blinkers(a,b,r,side){if(!side||Math.floor(t*2.5)%2)return;const cs=Math.cos(r),sn=Math.sin(r);for(let end of [-1,1]){let dx=side*.83,dz=end*2.11;cube(a+dx*cs+dz*sn,b-dx*sn+dz*cs,.19,.085,.16,'#ffb53e',r,.72)}let dx=side*.96;cube(a+dx*cs+.56*sn,b-dx*sn+.56*cs,.08,.22,.09,'#ffd05c',r,1.13)}

let lastHonk=-Infinity,hornVoices=null;
function focalLength(){const horizontal=(W/H>=1?105:88)*Math.PI/180;return W/(2*Math.tan(horizontal/2))}
function activeReaction(v){return v.hornUntil>t}
function reactiveCruise(v,target){return activeReaction(v)&&v.hornMode==='caution'?target*.72:target}
function reactiveAcceleration(v,normal){return activeReaction(v)&&v.hornMode==='proceed'?normal*1.5:normal}
function reactiveIndicator(v,indicator){return activeReaction(v)&&t-v.hornAt<1.2?2:indicator}
function honk(){if(onFoot)return;if(!active||crashed||t-lastHonk<.6)return;lastHonk=t;initAudio();let noticed=0;const groups=[...traffic.map(v=>({v,p:carPose(v.s,v.route)})),...freewayCars.map(v=>({v,p:freewayPose(v)})),...lotVisitors.map(v=>({v,p:v.pose}))];for(let {v,p} of groups){let dx=p.x-x,dz=p.z-z,distance=Math.hypot(dx,dz);if(distance>65)continue;let front=dx*Math.sin(yaw)+dz*Math.cos(yaw),aligned=Math.cos(p.a-yaw)>.7;v.hornAt=t;v.hornUntil=t+2.5;v.hornMode=front>0&&aligned?'proceed':'caution';noticed++}say(noticed?'Honk! Nearby drivers have noticed you.':'Honk!',2)}
function updateHorn(){if(!audio)return;if(!hornVoices){hornVoices=[350,440].map(freq=>{let osc=audio.createOscillator(),gain=audio.createGain(),filter=audio.createBiquadFilter();osc.type='sawtooth';osc.frequency.value=freq;filter.type='lowpass';filter.frequency.value=1200;gain.gain.value=0;osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start();return gain})}const sounding=active&&!crashed&&!onFoot&&keys.h;for(let gain of hornVoices)gain.gain.setTargetAtTime(sounding?.11:0,audio.currentTime,sounding?.025:.05)}


let thirdPerson=false,frameRig=null;
function makeCameraRig(){if(onFoot)return{x,z,height:homeSeated?1.05:1.65,pitch:0,heading:yaw};let heading=frameViewAngle===null?getViewAngle():frameViewAngle,look=roadSurface(x+Math.sin(heading)*3,z+Math.cos(heading)*3,groundY),grade=look===undefined?0:Math.atan2(look-groundY,3);return thirdPerson?{x:x-Math.sin(heading)*(7.32+vehicleSpec().length/2),z:z-Math.cos(heading)*(7.32+vehicleSpec().length/2),height:groundY+4.15+vehicleSpec().eye,pitch:.28-grade,heading}:{x,z,height:groundY+vehicleSpec().eye,pitch:-grade,heading}}
function toggleView(){if(onFoot){say('Walking uses first-person view.');return}thirdPerson=!thirdPerson;frameRig=null;frameViewAngle=null;$('viewToggle').textContent=thirdPerson?'View: Behind (V)':'View: Cockpit (V)';$('viewToggle').setAttribute('aria-pressed',String(thirdPerson));say(thirdPerson?'Third-person view · behind and above your car':'Cockpit view',2)}
function thirdPersonHUD(){if(onFoot)return;
 const side=true,w=side?Math.min(210,W*.42):260,left=side?(W<=650?16:30):W/2-w/2;
 const mission=document.querySelector?.('.mission'),missionBottom=mission?.getBoundingClientRect?.().bottom??(W<=650?245:280);
 const top=side?Math.min(missionBottom+12,H-155):H-125;
 c.save();c.fillStyle='#102b35e8';c.fillRect(left,top,w,62);
 c.textAlign=side?'left':'center';const tx=side?left+12:left+w/2;
 c.fillStyle='#f0f6ef';c.font='bold 24px Arial';c.fillText(Math.round(Math.abs(speed)*2.237)+' MPH',tx,top+27,w-24);
 c.fillStyle='#b8ef9a';c.font='12px Arial';c.fillText((park?'PARKED':gear<0?'REVERSE':'DRIVE')+' · '+(thirdPerson?'Chase':'Cockpit')+' (V)',tx,top+48,w-24);c.restore();
}

$('viewToggle').onclick=toggleView;graphics=initGraphics();reset();requestAnimationFrame(frame);

if(new URLSearchParams(location.search).has('qa'))window.__ultraTest={
 pose(px,pz,py,heading=0,chase=false){x=px;z=pz;groundY=py;yaw=heading;thirdPerson=chase;speed=0;active=false;$('overlay').style.display='none';draw()},
 state(){return {x,z,groundY,speed,thirdPerson,crashed,lanes:freewayCars.length}},
 start(){active=true;$('overlay').style.display='none'},
 key(k,on){keys[k]=on},action,ramps,draw
};

function ultraStreetDetails(){
 for(const road of roads)for(let q=-336;q<336;q+=8){
  if(roadDist(q)<16)continue;
  for(const side of [-1,1]){
   if(!curbOpening(road+side*8.16,q+3.8)&&!(road===0&&side===1&&q>=56&&q<=80))cube(road+side*8.16,q+3.8,.24,7.6,.15,'#b5b4a9',0,.02,2);
   if(!curbOpening(q+3.8,road+side*8.16))cube(q+3.8,road+side*8.16,7.6,.24,.15,'#b5b4a9',0,.02,2);
  }
 }
}

function ultraBuildingStyle(a,b){const n=Math.imul(Math.round((a+300)/40)+1,73856093)^Math.imul(Math.round((b+300)/40)+1,19349663);return (n>>>16)%4}
function ultraBuildingHeight(a,b){
 const style=ultraBuildingStyle(a,b),central=Math.abs(a)<180&&Math.abs(b)<180;
 return central?18+style*8:7+style*3.2;
}
function ultraBuildings(){
 for(let a=-300;a<340;a+=40)for(let b=-300;b<340;b+=40){
  if(residentialDistrict(a,b)||roadDist(a)<17||roadDist(b)<17||(a>10&&a<105&&b>15&&b<130))continue;
  const distance=Math.hypot(a-x,b-z),style=ultraBuildingStyle(a,b),h=ultraBuildingHeight(a,b);
  if(distance>(h>25?650:360))continue;
  const wall=['#b9ae99','#c6bba9','#9cabae','#a58976'][style],frame=['#b7b4a6','#d6cdbb','#556771','#c4b59f'][style];
  cube(a,b,23,23,h,wall,0,0,style===3?5:4);
  cube(a,b,23.6,23.6,.3,'#8e9693',0,h,2);
  // A recessed roof, parapets and stepped upper floors make distinct silhouettes.
  if(distance<360){
   rect(a-10.8,a+10.8,b-10.8,b+10.8,'#586367',h+.32);
   for(const side of [-1,1]){cube(a+side*11.4,b,.3,23,.6,frame,0,h+.3);cube(a,b+side*11.4,23,.3,.6,frame,0,h+.3)}
   if(style===2){cube(a,b,14,14,3.6,'#69808a',0,h+.3,3);cube(a,b,14.6,14.6,.25,'#c2c7be',0,h+3.9)}
   if(style===1){for(const side of [-1,1])cube(a+side*7,b,1.1,17,.65,frame,0,h+.3)}
  }
  const floorStep=3.2;
  for(let level=4.2;level<h-1.8;level+=floorStep){
   for(let side=0;side<4;side++){
    function point(u,y,v=11.53){const q=rotatePoint([u,v],side*Math.PI/2);return[a+q[0],y,b+q[1]]}
    const paneWidth=style===2?3.55:2.45;
    for(let col=-8;col<=8;col+=4){
     const shade=(Math.floor(level)+col+style)%3===0?'#597984':'#7696a0';
     face([point(col-paneWidth/2,level),point(col+paneWidth/2,level),point(col+paneWidth/2,level+2.1),point(col-paneWidth/2,level+2.1)],shade,3);
     if(distance<180){
      face([point(col-.045,level,11.56),point(col+.045,level,11.56),point(col+.045,level+2.1,11.56),point(col-.045,level+2.1,11.56)],frame,4);
      face([point(col-paneWidth/2,level+.98,11.57),point(col+paneWidth/2,level+.98,11.57),point(col+paneWidth/2,level+1.05,11.57),point(col-paneWidth/2,level+1.05,11.57)],frame,4);
     }
    }
    if(distance<260)face([point(-11.5,level-.2,11.57),point(11.5,level-.2,11.57),point(11.5,level-.08,11.57),point(-11.5,level-.08,11.57)],frame,4);
   }
  }
  // Street-level glazed storefront bays and a projecting canopy.
  if(distance<200){
   for(let w of [-7,-3,3,7]){cube(a+w,b-11.58,2.5,.08,2.6,'#45626d',0,.35,3);cube(a+w,b-11.64,.07,.08,2.6,'#a7aaa2',0,.35)}
   cube(a,b-12.0,19,1.1,.18,frame,0,3.25);
   for(const side of [-1,1]){if(roadDist(a+side*10)>8.3&&roadDist(b-12.1)>8.3)cube(a+side*10,b-12.1,.22,.22,3.25,frame);if(roadDist(a+side*10)>10&&roadDist(b-13.8)>10){cube(a+side*10,b-13.8,1.7,1.2,.55,'#929a8b');cube(a+side*10,b-13.8,1.45,1,.75,'#527250',0,.55)}}
  }
 }
}
function ultraFreewayDetails(){
 const y=HIGHWAY_Y;
 // Longitudinal girders below the deck; no additional objects in travel lanes.
 for(let i=0;i<360;i+=2){
  const a=i*Math.PI/180,b=(i+2)*Math.PI/180;
  for(const r of [545,553,567,575]){
   face([[r*Math.cos(a),y-1.35,r*Math.sin(a)],[r*Math.cos(b),y-1.35,r*Math.sin(b)],[r*Math.cos(b),y-.74,r*Math.sin(b)],[r*Math.cos(a),y-.74,r*Math.sin(a)]],'#7b8a89',4);
   ringPatch(a,b,r-.22,r+.22,'#85928d',y-1.35);
  }
  if(i%6===0){
   for(const r of [547,551,555,565,569,573])ringPatch(a,a+.00045,r-.10,r+.10,'#e7e6c9',y+.10);
  }
  if(i%12===0){
   // Small joints across each carriageway, stopping at the median.
   for(const span of [[541,559],[561,579]])ringPatch(a,a+.00014,span[0],span[1],'#333f43',y+.055);
   const px=560*Math.cos(a),pz=560*Math.sin(a),rot=Math.PI/2-a;
   cube(px,pz,.14,.14,7,'#778787',0,y+.7);
   cube(px,pz,8,.12,.12,'#8e9a98',rot,y+7.6);
   for(const r of [556.4,563.6])cube(r*Math.cos(a),r*Math.sin(a),.65,.35,.10,'#f4f0df',rot,y+7.5);
  }
  // Reflectors sit on existing barriers, and respect all ramp openings.
  if(i%4===0)for(const r of [540.5,579.5]){
   if(r>570&&freewayRailOpening(a,b))continue;
   cube(r*Math.cos(a),r*Math.sin(a),.09,.25,.18,r>570?'#eee9ca':'#e2bb59',-a,y+.58);
  }
 }
 // Planting is confined to the unused area inside the freeway.
 for(let i=0;i<32;i++){
  const a=i*Math.PI*2/32,r=440+(i%3)*14,px=r*Math.cos(a),pz=r*Math.sin(a);
  if(Math.abs(px)<24||Math.abs(pz)<24)continue;
  tree(px,pz,1.1+(i%3)*.2);
 }
}


function treeSiteSafe(a,b,scale){
 if(residentialDistrict(a,b))return false;const r=3*scale+.5,rr=Math.hypot(a,b);
 if(rr>540-r&&rr<580+r)return false;
 if(Math.abs(a)<342+r&&Math.abs(b)<342+r&&(roadDist(a)<9.5+r||roadDist(b)<9.5+r))return false;
 if(a>8-r&&a<88+r&&b>38-r&&b<108+r)return false;
 for(let side=0;side<4;side++){const q=rotatePoint([a,b],-side*Math.PI/2);if(q[0]>318-r&&q[0]<675+r&&Math.abs(q[1])<9.5+r)return false}
 const near=rampNearest(a,b);if(near.ramp&&near.distance<rampHalfWidth(near.ramp,near.index)+r+1)return false;
 for(let bx=-300;bx<340;bx+=40)for(let bz=-300;bz<340;bz+=40){if(bx>10&&bx<105&&bz>15&&bz<130)continue;if(Math.abs(a-bx)<12+r&&Math.abs(b-bz)<12+r)return false}
 return true;
}
function treeSite(a,b,scale){
 const key=a+','+b+','+scale;if(treeSiteCache.has(key))return treeSiteCache.get(key);
 let site=null;
 for(const radius of [0,5,10]){for(let i=0;i<(radius?8:1);i++){const q=[a+radius*Math.cos(i*Math.PI/4),b+radius*Math.sin(i*Math.PI/4)];if(treeSiteSafe(q[0],q[1],scale)){site=q;break}}if(site)break}
 treeSiteCache.set(key,site);return site;
}
function selectVehicle(kind){if(onFoot){say('Return to your vehicle before changing it.');return}
 const old=vehicleType;
 if(!vehicleSpecs[kind])return false;
 if(Math.abs(speed)>.3){say('Stop before changing vehicles.');return false}
 vehicleType=kind;
 const occupiedHere=(Math.abs(groundY)<2&&(traffic.some(v=>{const p=carPose(v.s,v.route);return overlaps(x,z,yaw,p.x,p.z,p.a,v.kind)})||lotVisitors.some(v=>overlaps(x,z,yaw,v.pose.x,v.pose.z,v.pose.a))||bays.some((b,i)=>i%4===0&&overlaps(x,z,yaw,b.x,b.z,0))))||(Math.abs(groundY-HIGHWAY_Y)<2&&freewayCars.some(v=>{const p=freewayPose(v);return overlaps(x,z,yaw,p.x,p.z,p.a,v.kind)}));
 if(!clearFootprint(x,z,yaw)||occupiedHere){vehicleType=old;say('Move to a clear, wider space before selecting that vehicle.');return false}
 frameRig=null;frameViewAngle=null;
 say(vehicleSpec().name+' selected · V for the outside view');
 for(const id of ['vehicleSelect','startVehicle']){const el=$(id);if(el)el.value=vehicleType}
 return true;
}
for(const id of ['vehicleSelect','startVehicle']){const el=$(id);if(el)el.onchange=()=>{if(!selectVehicle(el.value))el.value=vehicleType}}


// Residential blocks connect to all four bounding city streets.
function drawNeighborhoods(){for(const n of neighborhoods){
 rect(n.x-79,n.x+79,n.z-79,n.z+79,'#819b76',.025);
 rect(n.x-8,n.x+8,n.z-80,n.z+80,'#cac4b4',.04);rect(n.x-80,n.x+80,n.z-8,n.z+8,'#cac4b4',.04);
 rect(n.x-6,n.x+6,n.z-80,n.z+80,'#48545b',.06);rect(n.x-80,n.x+80,n.z-6,n.z+6,'#48545b',.06);
 for(let q=-76;q<80;q+=8)if(Math.abs(q)>9){rect(n.x-.07,n.x+.07,n.z+q,n.z+q+4,'#e3c474',.08);rect(n.x+q,n.x+q+4,n.z-.07,n.z+.07,'#e3c474',.08)}
 }for(const [i,h]of homes.entries()){
 const front=h.z+h.front*8,end=h.z+h.front*20;
 rect(h.x-3,h.x+3,Math.min(front,end),Math.max(front,end),'#bbb8a9',.07);
 const col=i===19?'#318fa8':['#d3bfa4','#aabbb1','#d3c6b7','#b8b6c1'][i%4],height=i%3===0?6.2:3.7;
 cube(h.x,h.z,14,14,height,col);cube(h.x,h.z,14.8,14.8,.18,'#e4ddc9',0,height);
 face([[h.x-7.7,height,h.z-7.7],[h.x+7.7,height,h.z-7.7],[h.x+7.7,height+2.6,h.z],[h.x-7.7,height+2.6,h.z]],'#736257');
 face([[h.x-7.7,height,h.z+7.7],[h.x-7.7,height+2.6,h.z],[h.x+7.7,height+2.6,h.z],[h.x+7.7,height,h.z+7.7]],'#63574f');
 for(const side of [-1,1])face([[h.x+side*7,height,h.z-7],[h.x+side*7,height,h.z+7],[h.x+side*7,height+2.4,h.z]],col);
 cube(h.x+4,h.z-2,1,1.3,2,'#967e6b',0,height);
 cube(h.x,h.z+h.front*7.04,3.5,.12,2.7,'#999e97',0,.12);
 for(let k=0;k<5;k++)cube(h.x,h.z+h.front*7.12,3.3,.04,.035,'#d1d0bf',0,.4+k*.45);
 cube(h.x-4,h.z+h.front*7.1,1.2,.15,2.3,i===19?'#387b79':'#735a46',0,.05);
 cube(h.x-4,h.z+h.front*8,2.6,2,.12,'#c1b6a0');cube(h.x-4,h.z+h.front*8,2.8,2.2,.15,'#b6ac96',0,2.6);
 for(const dx of [-5.1,-2.9])cube(h.x+dx,h.z+h.front*8.7,.12,.12,2.6,'#e5decb');
 for(const dx of [-4,4])for(const level of height>5?[1,4]:[1]){if(dx===-4&&level===1)continue;cube(h.x+dx,h.z-h.front*7.08,2.2,.1,1.5,'#65848c',0,level);cube(h.x+dx,h.z-h.front*7.16,.08,.08,1.5,'#e4e0cf',0,level);cube(h.x+dx,h.z-h.front*7.16,2.2,.08,.08,'#e4e0cf',0,level+.75)}
 if(i===19){cube(h.x-4,h.z+h.front*7.22,1.1,.08,.32,'#e9ce76',0,2.35);cube(h.x-6,h.z+h.front*10,.15,.15,1.1,'#7f786b');cube(h.x-6,h.z+h.front*10,.65,.4,.35,'#387b79',0,1)}
 }}
function npcSpec(v){return vehicleSpecs[v?.kind]||vehicleSpecs.car}
const trafficKinds=['car','car','minivan','motorcycle','truck','car','bus','car'];
traffic.forEach((v,i)=>v.kind=trafficKinds[i%8]);freewayCars.forEach((v,i)=>{v.kind=trafficKinds[(i*3)%8];if(v.kind==='bus'){v.cruise=Math.min(v.cruise,60/2.237);v.speed=v.cruise}});
function pedestrianPoses(){return pedestrianStates.map(p=>{const n=neighborhoods[Math.floor(p.id/16)],side=Math.floor(p.id%16/4),half=p.id%4<2?-1:1,u=p.progress%88,along=half*(16+(u<44?u:88-u)),q=rotatePoint([along,70.8],side*Math.PI/2),dir=half*(u<44?1:-1),d=rotatePoint([dir,0],side*Math.PI/2);return{x:n.x+q[0],z:n.z+q[1],a:Math.atan2(d[0],d[1]),id:p.id,phase:p.progress*5}})}
function advancePedestrians(dt){const poses=pedestrianPoses();for(const p of pedestrianStates){const q=poses[p.id];if(Math.hypot(q.x-x,q.z-z)<(onFoot?1.6:vehicleSpec().length/2+2))continue;if(parkedVehicle&&Math.hypot(q.x-parkedVehicle.x,q.z-parkedVehicle.z)<vehicleSpecs[parkedVehicle.type].length/2+2)continue;p.progress+=dt*.8}}
function isWalkable(a,b){if(insideHome){if(Math.abs(a)>4.5||Math.abs(b)>4.5)return false;return !((Math.abs(a)<1.7&&b>.7&&b<2.1)||(a< -2&&b>1.8)||(a>3.1&&b>1.7))}if(Math.abs(a)>343||Math.abs(b)>343)return false;for(const h of homes)if(Math.abs(a-h.x)<7.35&&Math.abs(b-h.z)<7.35)return false;for(let bx=-300;bx<340;bx+=40)for(let bz=-300;bz<340;bz+=40){if(residentialDistrict(bx,bz)||roadDist(bx)<17||roadDist(bz)<17||(bx>10&&bx<105&&bz>15&&bz<130))continue;if(Math.abs(a-bx)<12&&Math.abs(b-bz)<12)return false}for(const site of treeSiteCache.values())if(site&&Math.hypot(a-site[0],b-site[1])<.65)return false;return true}
function toggleWalking(){if(insideHome)return;if(onFoot){if(!parkedVehicle||Math.hypot(x-parkedVehicle.x,z-parkedVehicle.z)>6){say('Walk closer to your parked vehicle.');return}x=parkedVehicle.x;z=parkedVehicle.z;yaw=parkedVehicle.yaw;vehicleType=parkedVehicle.type;parkedVehicle=null;onFoot=false;speed=0;park=true;say('Back in your vehicle. P releases the parking brake.');return}if(Math.abs(speed)>.3||groundY>.2){say('Stop on a ground-level road before getting out.');return}for(const side of [-1,1]){const d=vehicleSpec().width/2+.9,a=x+side*Math.cos(yaw)*d,b=z-side*Math.sin(yaw)*d;if(!isWalkable(a,b)||traffic.some(v=>{const p=carPose(v.s,v.route);return Math.hypot(a-p.x,b-p.z)<npcSpec(v).length/2+1}))continue;parkedVehicle={x,z,yaw,type:vehicleType};x=a;z=b;onFoot=true;thirdPerson=false;speed=0;gear=1;signal=0;park=true;say('W/S walk · A/D turn · Shift run · G return · F interact',5);return}say('There is no clear space beside the vehicle.')}
const homeItems=[{name:'Leave home',x:0,z:-4.1,type:'door'},{name:'Watch TV',x:0,z:3.6,type:'tv'},{name:'Toggle lights',x:-3.8,z:-3.7,type:'lights'},{name:'Sit on sofa',x:0,z:.4,type:'sofa'},{name:'Rest in bed',x:-2.1,z:2.3,type:'bed'},{name:'Have a snack',x:2.8,z:2.5,type:'kitchen'}];
function nearbyHomeItem(){return homeItems.map(h=>({...h,d:Math.hypot(x-h.x,z-h.z)})).filter(h=>h.d<1.7).sort((a,b)=>a.d-b.d)[0]}
function nearHomeDoor(){const h=homes[19];return Math.hypot(x-(h.x-4),z-(h.z+h.front*8.4))<2.5}
function interactHome(){if(!onFoot)return;if(!insideHome){if(!nearHomeDoor()){say('Your home is marked HOME on the map in Sunset Park.');return}homeReturn={x,z,yaw};insideHome=true;homeSeated=false;x=0;z=-3.6;yaw=0;staticKey='';say('Welcome home. Walk up to furniture and press F.');return}if(homeSeated){homeSeated=false;z=.1;return}const item=nearbyHomeItem();if(!item)return;switch(item.type){case 'door':insideHome=false;x=homeReturn.x;z=homeReturn.z;yaw=homeReturn.yaw;staticKey='';break;case 'tv':homeTV=!homeTV;say(homeTV?'TV on':'TV off');break;case 'lights':homeLights=!homeLights;say(homeLights?'Lights on':'Lights dimmed');break;case 'sofa':homeSeated=true;x=0;z=1.1;yaw=0;say('Relaxing on the sofa. F to stand up.');break;case 'bed':energy=100;say('Rested. Energy restored.');break;case 'kitchen':energy=Math.min(100,energy+20);say('Enjoy your snack!');break}}
function updateWalking(dt){advancePedestrians(dt);if(!homeSeated){yaw=angle(yaw+((keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0))*1.8*dt);const forward=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0),step=forward*(keys.shift&&!insideHome?3.8:2)*dt,a=x+Math.sin(yaw)*step,b=z+Math.cos(yaw)*step;if(isWalkable(a,b)&&(!parkedVehicle||insideHome||!parkedFootOverlap(a,b))){x=a;z=b;energy=Math.max(0,energy-Math.abs(step)*.02)}}if(!insideHome){advanceTraffic(dt);advanceFreeway(dt);advanceVisitors(dt);for(const v of traffic){const p=carPose(v.s,v.route);if(overlaps(x,z,yaw,p.x,p.z,p.a,v.kind))crash('You were hit by traffic.')}}}
function walkingHint(){const el=$('walkingHint');if(!el)return;el.textContent=onFoot?(insideHome?(homeSeated?'F · Stand up':nearbyHomeItem()?'F · '+nearbyHomeItem().name:'At home · W/S walk · A/D turn')+' · Energy '+Math.round(energy)+'%':nearHomeDoor()?'F · Enter your home':'W/S walk · A/D turn · G return to vehicle · HOME in Sunset Park'):'G · Get out when stopped · HOME in Sunset Park'}
function drawHomeInterior(){const wall=homeLights?'#d8ccb8':'#827d74';rect(-5,5,-5,5,'#967355',0);for(let a=-5;a<5;a+=.5)rect(a,a+.018,-5,5,'#71583f',.01);cube(-5,0,.15,10,3,wall);cube(5,0,.15,10,3,wall);cube(0,-5,10,.15,3,wall);cube(0,5,10,.15,3,wall);rect(-5,5,-5,5,wall,3);cube(0,-4.9,1.5,.12,2.45,'#705c48');cube(-3.8,-4.88,.2,.08,.3,'#e8dfc8',0,1.2);
 cube(0,1.5,3,1.1,.45,'#5d7b80',0,.25);cube(0,1.95,3,.2,.9,'#5d7b80',0,.25);for(const a of [-1.4,1.4])cube(a,1.5,.2,1.1,.7,'#4c666a',0,.2);
 cube(0,4.45,2.8,.7,.65,'#705b43');cube(0,4.8,2.6,.12,1.5,'#172830',0,.9);cube(0,4.70,2.4,.04,1.3,homeTV?'#77b8cd':'#26333a',0,1);if(homeTV){cube(0,4.66,2.4,.02,.4,'#79a470',0,1);cube(.7,4.64,.35,.02,.35,'#f5e1a2',0,1.7)}
 cube(-3.4,3.2,2.5,3,.4,'#715a48');cube(-3.4,3.2,2.5,3,.3,'#d3d0c3',0,.4);cube(-3.4,2.8,2.5,2.2,.12,'#8d9ead',0,.7);cube(-3.4,4.2,1.5,.6,.18,'#e5dece',0,.7);
 cube(4.2,3,1.3,3,1,'#b9b5a3');cube(4.2,3,1.5,3.1,.12,'#6e7775',0,1);cube(4.2,3.7,.8,.8,.04,'#a7b8b9',0,1.13);cube(4.2,2.1,.5,.4,.2,'#c59858',0,1.14);
 for(const side of [-1,1]){cube(side*4.9,-.7,.05,2,1.3,'#88b6bf',0,1.1);cube(side*4.85,-.7,.08,.07,1.4,'#eee2c9',0,1.05)}
}

function parkedFootOverlap(a,b){if(!parkedVehicle)return false;const p=parkedVehicle,s=vehicleSpecs[p.type],dx=a-p.x,dz=b-p.z;return Math.abs(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))<s.width/2+.3&&Math.abs(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))<s.length/2+.3}

function drawResidentialSidewalks(){
 const concrete='#d4cebd',joint='#aba89d';
 for(const n of neighborhoods){
  // Four-metre local sidewalks and a continuous outer pavement, with gaps for roads.
  for(const side of [-1,1])for(const [lo,hi] of [[-72,-6],[6,72]]){
   const a=side<0?-10:6,b=side<0?-6:10;
   rect(n.x+a,n.x+b,n.z+lo,n.z+hi,concrete,.095);
   rect(n.x+lo,n.x+hi,n.z+a,n.z+b,concrete,.095);
   const oa=side<0?-72:69.5,ob=side<0?-69.5:72;
   rect(n.x+oa,n.x+ob,n.z+lo,n.z+hi,concrete,.095);
   rect(n.x+lo,n.x+hi,n.z+oa,n.z+ob,concrete,.095);
   for(let q=lo+2;q<hi;q+=3){
    rect(n.x+a,n.x+b,n.z+q,n.z+q+.035,joint,.10);
    rect(n.x+q,n.x+q+.035,n.z+a,n.z+b,joint,.10);
    rect(n.x+oa,n.x+ob,n.z+q,n.z+q+.035,joint,.10);
    rect(n.x+q,n.x+q+.035,n.z+oa,n.z+ob,joint,.10);
   }
  }
  // Curb segments stop at driveways and leave the pedestrian crossings flush.
  for(const side of [-1,1])for(let q=-69;q<69;q+=2){
   if(Math.abs(q)<14)continue;
   for(const off of [side*6.1,side*71.9]){
    if(![-1,0,1].some(d=>residentialDrive(n.x+off,n.z+q+d)))cube(n.x+off,n.z+q,.18,1.96,.13,'#b9b8aa',0,.035);
    if(![-1,0,1].some(d=>residentialDrive(n.x+q+d,n.z+off)))cube(n.x+q,n.z+off,1.96,.18,.13,'#b9b8aa',0,.035);
   }
  }
  for(const side of [-1,1])for(let q=-5.4;q<6;q+=1.8){
   rect(n.x+q,n.x+q+.9,n.z+side*11-1,n.z+side*11+1,'#eee9d8',.08);
   rect(n.x+side*11-1,n.x+side*11+1,n.z+q,n.z+q+.9,'#eee9d8',.08);
  }
 }
 // Every front porch connects to its nearest sidewalk, including the player's home.
 for(const h of homes){
  const n=residentialDistrict(h.x,h.z),outer=Math.abs(h.z-n.z)>40;
  const end=outer?n.z+Math.sign(h.z-n.z)*70.8:n.z+Math.sign(h.z-n.z)*8;
  const start=h.z+h.front*8.4;
  rect(h.x-4.9,h.x-3.1,Math.min(start,end),Math.max(start,end),concrete,.09);
 }
}
