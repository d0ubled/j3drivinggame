import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// Ultra owns presentation only. Road geometry and gameplay stay in game.js.
export function createRenderer(overlay) {
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.domElement.id='ultra-world';renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
 overlay.before(renderer.domElement);overlay.style.position='absolute';overlay.style.inset='0';overlay.style.zIndex='1';
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.scale.z=-1; // Convert the game's +Z-forward coordinates to Three.js.scene.background=new THREE.Color('#abc9dc');scene.fog=new THREE.FogExp2('#abc9dc',.0015);
 const camera=new THREE.PerspectiveCamera(70,1,.15,2400);
 const hemi=new THREE.HemisphereLight('#cee7ff','#68734d',2.15);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff1db',3.1);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:400});
 sun.shadow.bias=-.00015;sun.shadow.normalBias=.045;sun.shadow.radius=2;
 scene.add(sun,sun.target);
 const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;
 const ec=envCanvas.getContext('2d'),eg=ec.createLinearGradient(0,0,0,256);
 eg.addColorStop(0,'#5791ba');eg.addColorStop(.46,'#c7dae4');eg.addColorStop(.52,'#d6d5b9');eg.addColorStop(1,'#596148');ec.fillStyle=eg;ec.fillRect(0,0,512,256);
 const envTexture=new THREE.CanvasTexture(envCanvas);envTexture.mapping=THREE.EquirectangularReflectionMapping;envTexture.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(envTexture);scene.environment=environment.texture;envTexture.dispose();pmrem.dispose();

 let seed=83;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 function surfaceTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  const pixels=ctx.createImageData(256,256);
  for(let i=0;i<pixels.data.length;i+=4){let n=(rand()-.5)*(kind==='asphalt'?36:22),base=kind==='asphalt'?170:kind==='grass'?175:211;pixels.data[i]=base+n;pixels.data[i+1]=base+n;pixels.data[i+2]=base+n;pixels.data[i+3]=255}
  ctx.putImageData(pixels,0,0);
  if(kind==='brick'){ctx.strokeStyle='#96968e';ctx.lineWidth=2;for(let row=0;row<8;row++){ctx.beginPath();ctx.moveTo(0,row*32);ctx.lineTo(256,row*32);ctx.stroke();for(let col=-1;col<5;col++){ctx.strokeRect(col*64+(row%2)*32,row*32,64,32)}}}
  if(kind==='concrete'){ctx.strokeStyle='#aaa9a2';ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);}
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return map;
 }
 const asphalt=surfaceTexture('asphalt'),concrete=surfaceTexture('concrete'),grass=surfaceTexture('grass'),brick=surfaceTexture('brick');
 const materials=[
  new THREE.MeshStandardMaterial({vertexColors:true,map:asphalt,bumpMap:asphalt,bumpScale:.018,roughness:.94}),
  new THREE.MeshStandardMaterial({vertexColors:true,map:grass,roughness:1}),
  new THREE.MeshStandardMaterial({vertexColors:true,map:concrete,bumpMap:concrete,bumpScale:.012,roughness:.87}),
  new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.13,metalness:.15,clearcoat:1,envMapIntensity:1.1}),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}),
  new THREE.MeshStandardMaterial({vertexColors:true,map:brick,bumpMap:brick,bumpScale:.035,roughness:.88}),
  new THREE.MeshPhysicalMaterial({vertexColors:true,metalness:.45,roughness:.27,clearcoat:1}),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})
 ];
 materials.forEach(m=>{m.side=THREE.DoubleSide});
 const batches=materials.map(material=>{const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return {mesh,capacity:0,faces:[]}});
 batches[0].mesh.castShadow=false;batches[1].mesh.castShadow=false;batches[7].mesh.castShadow=false;
 const rgbCache=new Map();function color(c){if(!rgbCache.has(c))rgbCache.set(c,new THREE.Color(c));return rgbCache.get(c)}
 function classify(f){
  if(f.material!==null&&f.material!==undefined)return f.material;
  if(['#414d55','#48545b','#48565b','#626a6a','#59636a'].includes(f.color))return 0;
  if(['#819b76','#92a477'].includes(f.color))return 1;
  if(f.color==='#cbc9b8')return 2;
  if(f.color==='#f4f0df'||f.color==='#e3c474'||f.color==='#eac85c'||f.color==='#e1e9d8')return 7;
  return f.glass?3:4;
 }
 let previousFaces=null;
 function upload(faces){if(faces===previousFaces)return;previousFaces=faces;
  for(const b of batches)b.faces.length=0;
  for(const f of faces)batches[classify(f)]?.faces.push(f);
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),normal=new THREE.Vector3();
  for(const batch of batches){
   const count=batch.faces.reduce((n,f)=>n+Math.max(0,f.points.length-2)*3,0);
   if(count>batch.capacity){
    batch.capacity=Math.max(1024,Math.ceil(count*1.3));batch.mesh.geometry.dispose();
    const g=new THREE.BufferGeometry();for(const [name,size] of [['position',3],['normal',3],['color',3],['uv',2]])g.setAttribute(name,new THREE.BufferAttribute(new Float32Array(batch.capacity*size),size).setUsage(THREE.DynamicDrawUsage));
    batch.mesh.geometry=g;
   }
   if(!batch.capacity)continue;
   const g=batch.mesh.geometry,p=g.attributes.position.array,n=g.attributes.normal.array,c=g.attributes.color.array,uv=g.attributes.uv.array;let at=0;
   for(const f of batch.faces){const pts=f.points,col=color(f.color);for(let i=1;i<pts.length-1;i++){
    const tri=[pts[0],pts[i],pts[i+1]];va.fromArray(tri[1]).sub(vb.fromArray(tri[0]));vb.fromArray(tri[2]).sub(normal.fromArray(tri[0]));normal.crossVectors(va,vb).normalize();
    // Horizontal faces in the legacy mesh use both winding conventions.
    if(Math.abs(normal.y)>.95&&normal.y<0)normal.negate();
    const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z),scale=classify(f)===5?.4:.16;
    for(const v of tri){p.set(v,at*3);n.set([normal.x,normal.y,normal.z],at*3);c.set([col.r,col.g,col.b],at*3);uv[at*2]=(ay>ax&&ay>az?v[0]:ax>az?v[2]:v[0])*scale;uv[at*2+1]=(ay>ax&&ay>az?v[2]:v[1])*scale;at++}
   }}
   g.setDrawRange(0,count);for(const a of Object.values(g.attributes))a.needsUpdate=true;
  }
 }
 // Atmosphere and distant coastal hills are independent of collision geometry.
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2100,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDirection:{value:new THREE.Vector3(.5,.8,.3).normalize()}},vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 precision highp float;varying vec3 direction;uniform vec3 sunDirection;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){vec3 ray=normalize(direction);vec3 col=mix(vec3(.65,.78,.86),vec3(.15,.39,.64),clamp(ray.y*1.3,0.,1.));vec2 p=ray.xz/max(.1,ray.y)*2.;float cloud=noise(p)*.55+noise(p*2.)*.3+noise(p*4.)*.15;col=mix(col,vec3(.95,.96,.94),smoothstep(.55,.76,cloud)*smoothstep(.04,.25,ray.y)*.85);float sun=max(dot(ray,sunDirection),0.);col+=vec3(1.,.72,.39)*pow(sun,80.)*.3;col=mix(col,vec3(1.,.97,.85),smoothstep(.9996,.9999,sun));gl_FragColor=vec4(col,1.);}
 `}));
 sky.renderOrder=-10;scene.add(sky);
 const hillMaterial=new THREE.MeshStandardMaterial({color:'#7b9175',roughness:1,flatShading:true});
 for(let i=0;i<24;i++){const a=i*Math.PI*2/24;const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),hillMaterial);hill.position.set(Math.cos(a)*(1250+rand()*170),-30,Math.sin(a)*(1250+rand()*170));hill.scale.set(160+rand()*180,60+rand()*140,150+rand()*140);scene.add(hill)}

 const box=new THREE.BoxGeometry(1,1,1),wheelGeo=new THREE.CylinderGeometry(.35,.35,.24,16),rimGeo=new THREE.CylinderGeometry(.23,.23,.255,12);
 const rubber=new THREE.MeshStandardMaterial({color:'#15191c',roughness:.94}),chrome=new THREE.MeshStandardMaterial({color:'#b8c1c5',metalness:.8,roughness:.23});
 const glassMaterial=new THREE.MeshPhysicalMaterial({color:'#334d5b',metalness:.18,roughness:.12,clearcoat:1,envMapIntensity:1.3});
 const trim=new THREE.MeshStandardMaterial({color:'#20282c',roughness:.65}),plateMaterial=new THREE.MeshStandardMaterial({color:'#e1dfd4'});
 function block(parent,material,x,y,z,w,h,d){const o=new THREE.Mesh(box,material);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const bodyShape=new THREE.Shape();bodyShape.moveTo(-.82,.36);bodyShape.lineTo(.82,.36);bodyShape.lineTo(.86,.86);bodyShape.lineTo(.74,.95);bodyShape.lineTo(-.74,.95);bodyShape.lineTo(-.86,.86);bodyShape.closePath();
 const bodyGeo=new THREE.ExtrudeGeometry(bodyShape,{depth:4.0,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.065,bevelThickness:.065});bodyGeo.translate(0,0,-2);
 const cabinGeometries=[0,1,2].map(type=>{const shape=new THREE.Shape(),roof=type===1?1.72:1.53,back=type===2?1.37:1.08;shape.moveTo(-back,.92);shape.lineTo(-back+.28,roof);shape.lineTo(.48,roof);shape.lineTo(1.15,.92);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:1.48,bevelEnabled:false});g.translate(0,0,-.74);g.rotateY(Math.PI/2);return g});
 
 function signTexture(title,subtitle,bg){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,512,192);ctx.strokeStyle='#e6e7d6';ctx.lineWidth=5;ctx.strokeRect(8,8,496,176);
  ctx.fillStyle='#f4efdc';ctx.textAlign='center';ctx.font='bold 48px sans-serif';ctx.fillText(title,256,88);ctx.font='24px sans-serif';ctx.fillText(subtitle,256,138);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map:tex,roughness:.72});
 }
 const shops=[signTexture('COASTAL','COFFEE & BAKERY','#385653'),signTexture('PALM MARKET','FRESH • LOCAL','#62704b'),signTexture('STUDIO 05','DESIGN & PRINT','#776759')];
 for(let a=-300;a<340;a+=80)for(let b=-300;b<340;b+=80){
  if(a>10&&a<105&&b>15&&b<130)continue;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.5,1.8),shops[Math.abs(a+b)%3]);
  sign.position.set(a,3.6,b-11.71);sign.rotation.y=Math.PI;scene.add(sign);
 }

 
 // Overhead exit signs sit six meters above the deck, with supports outside the lanes.
 const gantryMetal=new THREE.MeshStandardMaterial({color:'#879391',metalness:.65,roughness:.43});
 const concreteMaterial=new THREE.MeshStandardMaterial({color:'#a9ada4',roughness:.9});
 for(let side=0;side<4;side++){
  const theta=side*Math.PI/2-.31,gantry=new THREE.Group();
  gantry.name='exit-gantry-'+side;gantry.position.set(560*Math.cos(theta),7.2,560*Math.sin(theta));gantry.rotation.y=-theta;scene.add(gantry);
  for(const xx of [-20.8,20.8]){block(gantry,concreteMaterial,xx,.35,0,1.1,.7,1.3);block(gantry,gantryMetal,xx,3.5,0,.28,7,.28)}
  block(gantry,gantryMetal,0,6.7,0,42,.24,.25);block(gantry,gantryMetal,0,7.3,0,42,.16,.18);
  for(let xx=-20;xx<20;xx+=3){const brace=block(gantry,gantryMetal,xx+1.5,7,0,3.1,.09,.09);brace.rotation.z=.19}
  const names=['PALM AVENUE','COASTAL DISTRICT','MARKET STREET','PARK DISTRICT'];
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.5),signTexture('EXIT '+(side+1),names[side]+'   ↗','#1d654d'));
  sign.position.set(12,6.5,-.18);sign.rotation.y=Math.PI;gantry.add(sign);
  const through=new THREE.Mesh(new THREE.PlaneGeometry(6,2),signTexture('CITY LOOP','THROUGH TRAFFIC  ↓','#225d4d'));
  through.position.set(3,6.5,-.18);through.rotation.y=Math.PI;gantry.add(through);
 }

 const cars=[],queue=[];let carIndex=0;
 function newCar(col){
  const root=new THREE.Group(),paint=new THREE.MeshPhysicalMaterial({color:col,metalness:.45,roughness:.29,clearcoat:1,clearcoatRoughness:.15});scene.add(root);
  const body=new THREE.Mesh(bodyGeo,paint);body.castShadow=true;body.receiveShadow=true;root.add(body);
  block(root,trim,0,.35,0,1.66,.12,3.95);
  const type=parseInt(col.slice(1),16)%3,cabin=new THREE.Mesh(cabinGeometries[type],glassMaterial);cabin.castShadow=true;root.add(cabin);
  block(root,paint,0,type===1?1.73:1.54,type===2?.2:.04,1.45,.07,type===2?1.65:1.25);
  block(root,paint,0,.97,1.38,1.72,.10,1.18);
  const wheels=[];
  for(const side of [-1,1]){
   block(root,paint,side*.97,1.15,.65,.24,.15,.3);
   block(root,trim,side*.755,1.19,-.14,.06,.65,.1);
   block(root,chrome,side*.918,.87,-.35,.025,.05,.27);
   for(const z of [-1.35,1.35]){
    const pivot=new THREE.Group();pivot.position.set(side*.94,.39,z);root.add(pivot);
    const tire=new THREE.Mesh(wheelGeo,rubber),rim=new THREE.Mesh(rimGeo,chrome);tire.rotation.z=rim.rotation.z=Math.PI/2;tire.castShadow=true;pivot.add(tire,rim);wheels.push(pivot);
   }
  }
  block(root,trim,0,.54,2.14,.8,.19,.04);block(root,chrome,0,.36,-2.14,1.5,.05,.04);
  const front=new THREE.MeshStandardMaterial({color:'#fff4cf',emissive:'#fff1ce',emissiveIntensity:.7});
  const rear=new THREE.MeshStandardMaterial({color:'#b32719',emissive:'#ed2f15',emissiveIntensity:.25});
  const left=new THREE.MeshStandardMaterial({color:'#db8b19',emissive:'#ff9000',emissiveIntensity:0}),right=left.clone();
  for(const side of [-1,1]){
   block(root,front,side*.58,.76,2.14,.45,.15,.04);block(root,rear,side*.58,.76,-2.14,.46,.15,.04);
   for(const z of [-2.15,2.15])block(root,side<0?left:right,side*.81,.76,z,.10,.13,.045);
  }
  block(root,plateMaterial,0,.5,-2.15,.44,.13,.03);
  return{root,paint,rear,left,right,wheels,last:null};
 }
 
 // Batch vehicle parts by shared geometry/material so traffic does not require
 // a draw call for every wheel, lamp and body panel.
 const vehicleBatches=new Map(),vehiclePaint=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:.45,roughness:.29,clearcoat:1}),vehicleLight=new THREE.MeshBasicMaterial({color:0xffffff});
 const sceneInverse=new THREE.Matrix4(),partMatrix=new THREE.Matrix4(),partColor=new THREE.Color();
 function instanceCars(count){
  for(const b of vehicleBatches.values())b.items.length=0;
  scene.updateMatrixWorld(true);sceneInverse.copy(scene.matrixWorld).invert();
  for(let i=0;i<count;i++){
   const car=cars[i];car.root.updateWorldMatrix(true,true);
   car.root.traverse(part=>{
    if(!part.isMesh)return;const m=part.material,isPaint=m===car.paint,isLight=[car.rear,car.left,car.right].includes(m)||m.emissiveIntensity===.7;
    const material=isPaint?vehiclePaint:isLight?vehicleLight:m;
    const key=part.geometry.uuid+':'+material.uuid;
    let batch=vehicleBatches.get(key);if(!batch){batch={geometry:part.geometry,material,items:[],mesh:null,capacity:0};vehicleBatches.set(key,batch)}
    batch.items.push({part,isPaint,isLight});
   });
   car.root.visible=false;
  }
  for(const batch of vehicleBatches.values()){
   if(batch.items.length>batch.capacity){
    if(batch.mesh){scene.remove(batch.mesh);batch.mesh.dispose()}
    batch.capacity=Math.max(128,2**Math.ceil(Math.log2(batch.items.length)));
    batch.mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.capacity);batch.mesh.frustumCulled=false;batch.mesh.castShadow=batch.material!==vehicleLight;batch.mesh.receiveShadow=true;batch.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(batch.mesh);
   }
   if(!batch.mesh)continue;batch.mesh.count=batch.items.length;
   batch.items.forEach(({part,isPaint,isLight},i)=>{
    partMatrix.multiplyMatrices(sceneInverse,part.matrixWorld);batch.mesh.setMatrixAt(i,partMatrix);
    if(isPaint)partColor.copy(part.material.color);
    else if(isLight){partColor.copy(part.material.emissiveIntensity>0?part.material.emissive:part.material.color).multiplyScalar(part.material.emissiveIntensity>0?Math.max(.3,part.material.emissiveIntensity):.12)}
    else partColor.set(0xffffff);
    batch.mesh.setColorAt(i,partColor);
   });
   batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;
  }
 }

 const cockpit=new THREE.Group();scene.add(cockpit);
 const dashMat=new THREE.MeshStandardMaterial({color:'#1f292e',roughness:.84});
 block(cockpit,dashMat,0,.82,.73,1.78,.27,.55);
 block(cockpit,new THREE.MeshStandardMaterial({color:'#293d46',metalness:.4,roughness:.3}),0,.83,1.58,1.78,.11,1.2);
 for(const side of [-1,1]){
  const pillar=block(cockpit,dashMat,side*.86,1.40,.87,.07,1.10,.08);pillar.rotation.z=side*.14;pillar.rotation.x=-.16;
  block(cockpit,trim,side*.66,.99,.61,.24,.08,.03);
 }
 const steeringWheel=new THREE.Group();steeringWheel.position.set(-.30,1.02,.35);cockpit.add(steeringWheel);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.245,.025,8,32),trim);ring.castShadow=true;steeringWheel.add(ring);
 block(steeringWheel,chrome,0,0,0,.43,.025,.025);block(steeringWheel,trim,0,-.10,0,.035,.20,.03);block(steeringWheel,trim,0,0,.01,.12,.08,.04);
 const screenCanvas=document.createElement('canvas');screenCanvas.width=512;screenCanvas.height=128;const screenCtx=screenCanvas.getContext('2d');
 const screenTexture=new THREE.CanvasTexture(screenCanvas);screenTexture.colorSpace=THREE.SRGBColorSpace;
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.68,.17),new THREE.MeshBasicMaterial({map:screenTexture}));screen.name='cockpit-instruments';screen.position.set(.12,1.005,.445);screen.rotation.y=Math.PI;cockpit.add(screen);
 const mirrorTarget=new THREE.WebGLRenderTarget(384,144),mirrorCamera=new THREE.PerspectiveCamera(65,384/144,.3,420);
 const mirror=new THREE.Mesh(new THREE.PlaneGeometry(.38,.14),new THREE.MeshBasicMaterial({map:mirrorTarget.texture}));
 mirror.position.set(.18,1.73,.70);mirror.rotation.y=Math.PI;cockpit.add(mirror);
 const mirrorUV=mirror.geometry.attributes.uv;for(let i=0;i<mirrorUV.count;i++)mirrorUV.setX(i,1-mirrorUV.getX(i));
 block(cockpit,trim,.18,1.73,.72,.42,.18,.035);
 let mirrorFrame=0;
 let quality='medium',lastW=0,lastH=0,lastQuality='',frames=0,fpsTime=performance.now(),lastHud='';
 const presets={low:{ratio:1,shadows:false,map:1024},medium:{ratio:1.25,shadows:true,map:2048},high:{ratio:1.75,shadows:true,map:4096}};
 const qualitySelect=document.getElementById('quality');try{const saved=localStorage.getItem('jasmine-ultra-quality');if(presets[saved])quality=saved}catch{}
 if(qualitySelect){qualitySelect.value=quality;qualitySelect.onchange=()=>{quality=qualitySelect.value;try{localStorage.setItem('jasmine-ultra-quality',quality)}catch{}}}
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('ultra-error').hidden=false});
 return{
  beginFrame(){queue.length=0},
  car(a,b,r,col,braking,indicator,elevation){queue.push({a,b,r,col,braking,indicator,elevation})},
  render(faces,state){
   const {rig,width,height,focal,time,player}=state,setting=presets[quality];
   if(width!==lastW||height!==lastH||lastQuality!==quality){
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,setting.ratio));renderer.setSize(width,height,false);
    renderer.shadowMap.enabled=setting.shadows;
    if(sun.shadow.mapSize.x!==setting.map){sun.shadow.mapSize.set(setting.map,setting.map);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
    materials.forEach(m=>m.needsUpdate=true);lastW=width;lastH=height;lastQuality=quality;
   }
   camera.fov=2*Math.atan(height/(2*focal))*180/Math.PI;camera.aspect=width/height;camera.updateProjectionMatrix();
   camera.projectionMatrix.elements[9]=-.14;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
   camera.position.set(rig.x,rig.height,-rig.z);
   camera.lookAt(rig.x+Math.sin(rig.heading)*Math.cos(rig.pitch),rig.height-Math.sin(rig.pitch),-(rig.z+Math.cos(rig.heading)*Math.cos(rig.pitch)));
   sky.position.set(rig.x,rig.height,rig.z);
   const targetX=Math.round(player.x/4)*4,targetZ=Math.round(player.z/4)*4;
   sun.position.set(targetX+100,player.groundY+160,targetZ+60);sun.target.position.set(targetX,player.groundY,targetZ);
   upload(faces);carIndex=0;
   for(const q of queue){
    let car=cars[carIndex];if(!car)cars[carIndex]=car=newCar(q.col);carIndex++;
    car.root.visible=true;car.root.position.set(q.a,q.elevation,q.b);car.root.rotation.y=q.r;car.paint.color.set(q.col);
    car.rear.emissiveIntensity=q.braking?2.5:.25;const blink=Math.floor(time*3)%2===0;
    car.left.emissiveIntensity=blink&&(q.indicator===-1||q.indicator===2)?3:0;
    car.right.emissiveIntensity=blink&&(q.indicator===1||q.indicator===2)?3:0;
    if(car.last){const d=Math.hypot(q.a-car.last.a,q.b-car.last.b);if(d<10)for(const w of car.wheels)w.rotation.x+=d/.35}car.last=q;
   }
   for(let i=carIndex;i<cars.length;i++)cars[i].root.visible=false;
   instanceCars(carIndex);
   cockpit.visible=!player.thirdPerson&&player.gear>0;cockpit.position.set(player.x+Math.sin(player.yaw)*.3,player.groundY,player.z+Math.cos(player.yaw)*.3);cockpit.rotation.y=player.yaw;steeringWheel.rotation.z=-player.steering*.9;
   const hud=Math.round(Math.abs(player.speed)*2.237)+'   '+(player.park?'P':player.gear<0?'R':'D')+'   '+(player.signal<0?'◀':player.signal>0?'▶':'');
   if(hud!==lastHud){screenCtx.fillStyle='#07131b';screenCtx.fillRect(0,0,512,128);screenCtx.fillStyle='#d8f3eb';screenCtx.font='bold 70px sans-serif';screenCtx.fillText(hud,20,85);screenCtx.fillStyle='#8aacb6';screenCtx.font='18px sans-serif';screenCtx.fillText('MPH     JASMINE / ULTRA',22,117);screenTexture.needsUpdate=true;lastHud=hud}
   mirror.visible=quality!=='low';if(cockpit.visible&&mirror.visible&&mirrorFrame++%(quality==='high'?2:4)===0){
    mirrorCamera.position.set(player.x,player.groundY+1.65,-player.z);
    mirrorCamera.lookAt(player.x-Math.sin(player.yaw),player.groundY+1.60,-player.z+Math.cos(player.yaw));
    cockpit.visible=false;renderer.setRenderTarget(mirrorTarget);renderer.render(scene,mirrorCamera);renderer.setRenderTarget(null);cockpit.visible=true;
   }
   renderer.render(scene,camera);frames++;const now=performance.now();if(now-fpsTime>1000){const label=document.getElementById('ultra-fps');if(label)label.textContent=Math.round(frames*1000/(now-fpsTime))+' FPS';frames=0;fpsTime=now}
   window.__ultraDiagnostics={ready:true,quality,cars:carIndex,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
  },
  renderer,scene,camera
 };
}
