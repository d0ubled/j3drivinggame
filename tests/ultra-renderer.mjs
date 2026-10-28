import fs from 'node:fs';import vm from 'node:vm';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
let threePath=process.env.THREE_MODULE;
if(!threePath){const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jasmine-three-'));threePath=path.join(temp,'three.mjs');const response=await fetch('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');if(!response.ok)throw Error('Three.js download failed: '+response.status);fs.writeFileSync(threePath,await response.text());process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));}
const Real=await import(pathToFileURL(path.resolve(threePath)).href);
const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>o[k]??(()=>{})});
const elements={quality:{value:'medium'},'ultra-fps':{},'ultra-error':{}};
class FakeRenderer{
 constructor(){this.domElement={style:{},addEventListener(){}};this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};this.info={render:{triangles:0,calls:0}}}
 setPixelRatio(){}setSize(){}setRenderTarget(){}
 render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);let calls=0;scene.traverse(o=>{if(o.isMesh&&o.visible){calls++;for(const [name,a]of Object.entries(o.geometry.attributes)){if(a.array.some(n=>!Number.isFinite(n)))throw Error('Invalid '+name)}}});this.info.render.calls=calls}
}
const env={THREE:{...Real,WebGLRenderer:FakeRenderer,PMREMGenerator:class{fromEquirectangular(){return {texture:new Real.Texture()}}dispose(){}}},document:{createElement:()=>({getContext:()=>ctx}),getElementById:id=>elements[id]},window:{},devicePixelRatio:1,performance,localStorage:{getItem(){return null},setItem(){}},console};
vm.createContext(env);
const code=fs.readFileSync('ultra/renderer.js','utf8').replace(/^import[^\n]*\n/,'').replace('export function createRenderer','function createRenderer');
vm.runInContext(code+';globalThis.create=createRenderer;',env);
const out=env.create({before(){},style:{}}),faces=[{points:[[-10,0,-10],[-10,0,10],[10,0,10],[10,0,-10]],color:'#414d55',material:0},{points:[[0,0,5],[1,0,5],[1,2,5],[0,2,5]],color:'#ccbbaa',material:5}];
for(const quality of ['low','medium','high']){
 elements.quality.value=quality;elements.quality.onchange();
 for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  out.beginFrame();out.car(4,10,0,'#aabbcc',true,1,0);
  const state={rig:{x:0,z:0,height:1.45,heading,pitch:0},width:1280,height:800,focal:491,time:1,player:{x:0,z:0,groundY:0,yaw:heading,speed:12,steering:.2,gear:1,park:false,signal:1,thirdPerson:false}};
  out.render(faces,state);
  const right=new Real.Vector3(Math.sin(heading)*10+Math.cos(heading)*3,1.45,-(Math.cos(heading)*10-Math.sin(heading)*3)).project(out.camera);
  const instruments=out.scene.getObjectByName('cockpit-instruments').getWorldPosition(new Real.Vector3()).project(out.camera);
  if(Math.abs(instruments.x)>1||Math.abs(instruments.y)>.95)throw Error('Cockpit instruments outside viewport');
  if(right.x<=0||Math.abs(right.y-.14)>.001)throw Error('Camera coordinate handedness/horizon');
  if(out.renderer.shadowMap.enabled!==(quality!=='low'))throw Error('Graphics setting');
 }
}
if(!env.window.__ultraDiagnostics.ready)throw Error('Renderer never initialized');
console.log('PASS: real Three.js geometry/material/camera APIs, finite scene buffers, four camera headings, projection alignment, car models, mirror path and all graphics presets. GPU/shader execution is not covered.');



for(let side=0;side<4;side++){
 const gantry=out.scene.getObjectByName('exit-gantry-'+side);
 if(!gantry)throw Error('Missing exit gantry');
 for(const child of gantry.children){
  if(child.geometry.type==='PlaneGeometry'&&child.position.y-child.geometry.parameters.height/2<5)throw Error('Low sign over freeway');
  if(child.geometry.type==='BoxGeometry'&&child.position.y<4&&Math.abs(child.position.x)-child.scale.x/2<19)throw Error('Gantry post in freeway lanes');
 }
}
console.log('PASS: four exit gantries, sign clearance above five meters, support columns outside travel lanes.');

const instrument=out.scene.getObjectByName('cockpit-instruments');
out.scene.updateMatrixWorld(true);
const pos=instrument.geometry.attributes.position,uv=instrument.geometry.attributes.uv;
const ends=[];
for(let i=0;i<pos.count;i++)ends.push({u:uv.getX(i),p:new Real.Vector3().fromBufferAttribute(pos,i).applyMatrix4(instrument.matrixWorld).project(out.camera)});
const leftText=ends.filter(p=>p.u===0).reduce((s,p)=>s+p.p.x,0),rightText=ends.filter(p=>p.u===1).reduce((s,p)=>s+p.p.x,0);
if(leftText>=rightText)throw Error('Dashboard text is mirrored');
for(const kind of ['car','motorcycle','bus','truck','minivan']){
 out.beginFrame();out.car(0,10,0,'#97c9c0',true,1,0,kind);
 out.render(faces,{rig:{x:0,z:0,height:5.6,heading:0,pitch:.28},width:1280,height:800,focal:491,time:1,player:{x:0,z:10,groundY:0,yaw:0,speed:3,steering:0,gear:1,park:false,signal:1,thirdPerson:true,vehicleType:kind,eye:1.45}});
 if(!env.window.__ultraDiagnostics.ready)throw Error('Vehicle model failed');
}
console.log('PASS: readable dashboard UV orientation and all five vehicle models through instanced rendering.');

const walkState={rig:{x:0,z:0,height:1.65,heading:0,pitch:0},width:1280,height:800,focal:491,time:1,pedestrians:Array.from({length:32},(_,id)=>({id,x:id,z:10,a:0,phase:id})),player:{x:0,z:0,groundY:0,yaw:0,speed:0,steering:0,gear:1,park:true,signal:0,thirdPerson:false,onFoot:true,vehicleType:'car'}};
out.beginFrame();out.render(faces,walkState);
if(out.scene.getObjectByName('pedestrians').count!==736)throw Error('Pedestrian instance count');
if(out.scene.getObjectByName('cockpit-instruments').parent.visible)throw Error('Cockpit blocks walking view');
walkState.player.insideHome=true;out.render(faces,walkState);
if(out.scene.getObjectByName('pedestrians').count!==0)throw Error('Pedestrians visible indoors');
console.log('PASS: 32 animated pedestrian instance models, clear walking camera, and pedestrians hidden indoors.');

for(const lights of [false,true])for(const tv of [false,true]){
 walkState.player.homeLights=lights;walkState.player.homeTV=tv;out.render(faces,walkState);
 if(out.homeScene.getObjectByName('television-picture').visible!==tv)throw Error('TV state not rendered');
 if(!env.window.__ultraDiagnostics.insideHome)throw Error('Interior scene not used');
 for(const name of ['seat-cushion','bed-pillow','sink-basin','window-sill','oak-floorboard'])if(!out.homeScene.getObjectByName(name))throw Error('Interior detail missing '+name);
}
walkState.player.insideHome=false;out.render(faces,walkState);
if(env.window.__ultraDiagnostics.insideHome)throw Error('Failed return outdoors');
const people=out.scene.getObjectByName('pedestrians'),oldPose=people.instanceMatrix.array.slice();
walkState.pedestrians.forEach(p=>p.phase+=.7);out.render(faces,walkState);
if(!people.instanceMatrix.array.some((v,i)=>Math.abs(v-oldPose[i])>.001))throw Error('Articulated gait not animated');
console.log('PASS: detailed interior geometry, all light/TV states, return outdoors and articulated pedestrian animation.');
// Family models, held snack and resting body use the same renderer as normal play.
walkState.player.insideHome=true;walkState.player.onFoot=true;walkState.player.homeSeated=true;walkState.player.heldSnack=true;walkState.player.family={poses:[{id:32,child:true,x:1.8,z:-2.4,a:0,phase:0},{id:33,child:true,x:2.6,z:-2.4,a:0,phase:0}]};
out.render(faces,walkState);
if(out.homeScene.getObjectByName('family-at-home').count!==48)throw Error('Kids not rendered');
if(!out.homeScene.getObjectByName('held-snack').visible||!out.homeScene.getObjectByName('resting-body').visible)throw Error('Snack or seated body missing');
for(const name of ['kids-bunk-frame','bedroom-divider','bedroom-window'])if(!out.homeScene.getObjectByName(name))throw Error('Expanded room detail missing');
const bed=out.homeScene.getObjectByName('bed-frame');if(bed.position.z<7)throw Error('Adult bed not moved');
walkState.player.homeSeated=false;walkState.player.homeLying=true;walkState.player.snackEatingUntil=1.8;out.render(faces,walkState);
if(!out.homeScene.getObjectByName('resting-body').visible)throw Error('Reclined body missing');
walkState.player.insideHome=false;walkState.player.onFoot=false;out.render(faces,walkState);
if(out.scene.getObjectByName('held-snack').visible)throw Error('Snack blocks driving');
if(out.scene.getObjectByName('pedestrians').count!==784)throw Error('Outdoor family passenger models missing');
if(!out.scene.getObjectByName('school-sign'))throw Error('School label missing');
console.log('PASS: held snack, resting body, child models indoors/outdoors, rear bedrooms and school signage.');
