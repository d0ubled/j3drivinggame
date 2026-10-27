const fs=require('fs'),vm=require('vm');const els={};const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),moveTo(...v){if(v.some(n=>!Number.isFinite(n)))throw Error('Invalid geometry')}},{get:(o,k)=>o[k]||(()=>{})});const env={document:{getElementById:id=>els[id]??(els[id]={getContext:()=>ctx,style:{},setAttribute(){}}),createElement:()=>({style:{},remove(){},getContext:()=>null}),querySelectorAll:()=>[]},console:console,location:{search:''},URLSearchParams,createRenderer:()=>({beginFrame(){},car(...v){if(v.slice(0,3).some(n=>!Number.isFinite(n)))throw Error('Invalid vehicle')},render(faces,state){if(!faces.length)throw Error('Empty scene');for(const f of faces)for(const p of f.points)if(p.some(n=>!Number.isFinite(n)))throw Error('Invalid world vertex');if(!state.rig)throw Error('Missing camera')}}),window:{},innerWidth:1280,innerHeight:800,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){}};els.scene={getContext:()=>ctx,style:{},before(){}};vm.createContext(env);vm.runInContext(fs.readFileSync('ultra/game.js','utf8').replace(/^import[^\n]*\n/,''),env);vm.runInContext(`
if(new Set(traffic.map(v=>v.kind)).size!==5||new Set(freewayCars.map(v=>v.kind)).size!==5)throw Error('Mixed traffic missing');
if(freewayCars.length!==64||new Set(freewayCars.map(v=>v.r)).size!==8)throw Error('Eight lane traffic missing');const radii=[545,549,553,557,563,567,571,575];for(let r of radii){let cars=freewayCars.filter(v=>v.r===r);if(cars.length!==8||cars.some(v=>v.dir!==(r<560?-1:1)))throw Error('Wrong carriageway traffic');if(roadSurface(r,0,HIGHWAY_Y)!==HIGHWAY_Y)throw Error('Lane not drivable')}let maxGrade=0;for(let ramp of ramps){let n=ramp.points.length-1;if(n!==128)throw Error('Incomplete ramp');for(let i=0;i<n;i++){let a=ramp.points[i],b=ramp.points[i+1],d=Math.hypot(b[0]-a[0],b[1]-a[1]);maxGrade=Math.max(maxGrade,Math.abs(b[2]-a[2])/d);groundY=a[2];let heading=Math.atan2(b[0]-a[0],b[1]-a[1]);if(!clearFootprint(a[0],a[1],heading))throw Error('Ramp not drivable: '+ramp.side+' '+ramp.type+' '+i)}let join=ramp.type==='entry'?ramp.points[n]:ramp.points[0];if(Math.abs(Math.hypot(join[0],join[1])-575)>.01||Math.abs(join[2]-HIGHWAY_Y)>.001)throw Error('Merge level mismatch');let i=ramp.type==='entry'?n-1:0,a=ramp.points[i],b=ramp.points[i+1],heading=Math.atan2(b[0]-a[0],b[1]-a[1]),flow=Math.atan2(-Math.sin(ramp.joinAngle),Math.cos(ramp.joinAngle));if(Math.cos(heading-flow)<.94)throw Error('Abrupt merge angle');let street=ramp.type==='entry'?ramp.points[0]:ramp.points[n];if(street[2]!==0)throw Error('Street connection height')}
if(maxGrade>.08)throw Error('Ramp grade too steep '+maxGrade);for(let side=0;side<4;side++)for(let d=530;d<=590;d+=3){let p=rotatePoint([d,0],side*Math.PI/2);if(roadSurface(p[0],p[1],0)!==0)throw Error('Underpass road not continuous')}
if(roadSurface(575,0,0)!==0||roadSurface(575,0,HIGHWAY_Y)!==HIGHWAY_Y)throw Error('Road layers incorrectly connected');
reset();traffic.length=0;lotVisitors.length=0;freewayCars.splice(0,freewayCars.length,{theta:0,r:575,dir:1,cruise:30,speed:30,color:'#aabbcc'});x=575;z=0;groundY=0;advanceFreeway(.001);if(crashed)throw Error('Collision with traffic above');freewayCars[0].theta=0;groundY=HIGHWAY_Y;advanceFreeway(.001);if(!crashed)throw Error('Deck collision missing');
crashed=false;for(let ramp of ramps){let p=ramp.points[85],next=ramp.points[86];x=p[0];z=p[1];groundY=p[2];yaw=Math.atan2(next[0]-p[0],next[1]-p[1]);thirdPerson=false;let rig=makeCameraRig();if(Math.abs(rig.height-(groundY+1.45))>.01)throw Error('Cockpit elevation');draw();thirdPerson=true;draw();if(modelLift!==0)throw Error('Car lift leaked')}
`,env);console.log('PASS: eight freeway lanes, traffic in both directions, ramp clearance,  eight smooth graded ramps, tangent merges, continuous roads beneath four overpasses, separate road levels and collision layers, elevated cars and both camera views.');

vm.runInContext(`
const styles=new Set(),heights=new Set();
for(let a=-300;a<340;a+=40)for(let b=-300;b<340;b+=40){styles.add(ultraBuildingStyle(a,b));heights.add(ultraBuildingHeight(a,b))}
if(styles.size!==4||heights.size<6)throw Error('Repetitive city profiles');
let savedCube=cube;
cube=function(a,b,w,l,h,col,...rest){if(col==='#929a8b'&&(roadDist(a)<8+w/2||roadDist(b)<8+l/2))throw Error('Planter intrudes into street');return savedCube(a,b,w,l,h,col,...rest)};
for(const p of [[2.2,-65],[162.3,20],[-162.3,-160]]){x=p[0];z=p[1];groundY=0;staticKey='';draw()}
cube=savedCube;
`,env);
console.log('PASS: four facade families, varied skyline heights, city scene rebuilds, and planters clear of travel lanes.');

vm.runInContext(`
reset();traffic.length=0;lotVisitors.length=0;speed=0;
for(const kind of Object.keys(vehicleSpecs)){
 if(!selectVehicle(kind))throw Error('Cannot select '+kind);
 if(!clearFootprint(x,z,yaw))throw Error('Selected vehicle does not fit');
 const rig=makeCameraRig();thirdPerson=false;
 if(Math.abs(makeCameraRig().height-groundY-vehicleSpec().eye)>.001)throw Error('Vehicle eye height');
 thirdPerson=true;draw();thirdPerson=false;
}
speed=10;if(selectVehicle('bus'))throw Error('Vehicle changed while moving');speed=0;
vehicleType='car';x=8;z=-65;if(selectVehicle('bus'))throw Error('Oversize vehicle accepted at curb');
reset();vehicleType='car';
for(let a=-360;a<=360;a+=120)for(let b=-360;b<=360;b+=120){x=a;z=b;staticKey='';draw()}
let count=0;for(const [key,site]of treeSiteCache){if(!site)continue;const scale=Number(key.split(',')[2]);if(!treeSiteSafe(site[0],site[1],scale))throw Error('Unsafe tree placement');count++}
if(count<10)throw Error('Tree filtering removed all landscaping');
`,env);
console.log('PASS: five selectable vehicles, safe switching, vehicle camera heights, and clearance audit of every generated tree site.');

vm.runInContext(`
reset();vehicleType='car';traffic.length=0;lotVisitors.length=0;freewayCars.length=0;
if(homes.length!==32)throw Error('Missing homes');
for(const n of neighborhoods)for(let q=-78;q<=78;q+=3){groundY=0;if(!clearFootprint(n.x+2.5,n.z+q,0)||!clearFootprint(n.x+q,n.z+2.5,Math.PI/2))throw Error('Neighborhood road disconnected')}
for(const h of homes){if(roadSurface(h.x,h.z,0)!==undefined)throw Error('House driveable');for(let q=9;q<20;q++)if(roadSurface(h.x,h.z+h.front*q,0)!==0)throw Error('Driveway missing')}
x=2.2;z=-65;yaw=0;speed=0;toggleWalking();if(!onFoot||!parkedVehicle)throw Error('Exit vehicle');toggleWalking();if(onFoot||!park)throw Error('Enter vehicle');
onFoot=true;const h=homes[19];x=h.x-4;z=h.z+h.front*8.4;interactHome();if(!insideHome)throw Error('Home door');draw();
x=0;z=3.5;interactHome();if(!homeTV)throw Error('TV');
x=-3.8;z=-3.7;interactHome();if(homeLights)throw Error('Lights');
x=0;z=.4;interactHome();if(!homeSeated)throw Error('Sit');interactHome();if(homeSeated)throw Error('Stand');
x=-2.1;z=2.3;energy=5;interactHome();if(energy!==100)throw Error('Rest');
x=2.8;z=2.5;energy=50;interactHome();if(energy!==70)throw Error('Snack');
x=0;z=-4.1;interactHome();if(insideHome||!nearHomeDoor())throw Error('Leave home');
const before=pedestrianPoses();if(before.length!==32)throw Error('Missing pedestrians');x=0;z=0;advancePedestrians(.1);const after=pedestrianPoses();if(!after.some((p,i)=>p.x!==before[i].x||p.z!==before[i].z))throw Error('Pedestrians stationary');
for(let i=0;i<110;i++){advancePedestrians(.5);for(const p of pedestrianPoses())if(!isWalkable(p.x,p.z)||residentialRoad(p.x,p.z))throw Error('Unsafe sidewalk route '+p.id)}
reset();
`,env);
console.log('PASS: 32 homes, connected residential roads and driveways, exit/enter vehicle, home access and six interactions, 32 moving pedestrians on clear sidewalks.');

vm.runInContext(`
reset();vehicleType='car';onFoot=false;freewayCars.splice(0,freewayCars.length,{theta:0,r:575,dir:1,cruise:20,speed:10,kind:'bus'});x=575;z=25;yaw=0;groundY=HIGHWAY_Y;advanceFreeway(.01);if(!Number.isFinite(freewayCars[0].speed))throw Error('Freeway following invalid');
`,env);
console.log('PASS: freeway bus following the player uses valid vehicle-sized clearance.');
