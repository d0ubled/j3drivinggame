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
