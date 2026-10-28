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

 
 // Rounded, articulated people share one instance batch rather than individual draw calls.
 const people=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({roughness:.9}),1024);
 people.name='pedestrians';people.count=0;people.castShadow=true;people.frustumCulled=false;scene.add(people);
 const personMatrix=new THREE.Object3D(),personColor=new THREE.Color(),personUp=new THREE.Vector3(0,1,0);
 const limbDirection=new THREE.Vector3();
 function updatePeople(poses,target=people){let count=0;for(const p of poses.slice(0,36)){
  const skin=['#c99c7b','#8b5b40','#e2b99c','#b8805e'][p.id%4],hair=['#332922','#493527','#221f1e','#856343'][p.id%4];
  const shirt=['#4b7194','#bd7455','#60836a','#9b6683','#c5b68d','#5d6578'][p.id%6],pants=p.id%3===0?'#535a64':'#293c50';
  const size=p.child?.64:.93+(p.id%5)*.035,cs=Math.cos(p.a),sn=Math.sin(p.a),bob=Math.cos(p.phase*2)*.012;
  function part(dx,y,dz,w,h,l,col,rotation=null){
   personMatrix.position.set(p.x+(dx*cs+dz*sn)*size,(y+bob)*size+(p.y||0),p.z+(-dx*sn+dz*cs)*size);
   personMatrix.rotation.set(0,p.a,0);if(rotation)personMatrix.quaternion.multiply(rotation);
   personMatrix.scale.set(w*size,h*size,l*size);personMatrix.updateMatrix();
   target.setMatrixAt(count,personMatrix.matrix);target.setColorAt(count++,personColor.set(col));
  }
  function limb(a,b,r,col){limbDirection.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const len=limbDirection.length();const q=new THREE.Quaternion().setFromUnitVectors(personUp,limbDirection.normalize());part((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,len/2+r*.35,r,col,q)}
  part(0,1.15,0,.23,.31,.13,shirt);part(0,.88,0,.19,.13,.12,pants);
  part(0,1.46,0,.065,.09,.065,skin);part(0,1.64,.01,.105,.145,.105,skin);
  part(0,1.73,-.025,.111,.075,.107,hair);part(0,1.65,-.068,.11,.11,.045,hair);
  part(0,1.63,.115,.026,.034,.035,skin);
  for(const side of [-1,1]){
   part(side*.043,1.665,.1,.012,.009,.008,'#292724');
   part(side*.108,1.63,.005,.018,.035,.023,skin);
   const swing=Math.sin(p.phase)*.43*side,kneeBend=Math.max(0,-Math.sin(p.phase))*.5*(side===1?1:0)+Math.max(0,Math.sin(p.phase))*.5*(side===-1?1:0);
   const hip=[side*.105,.86,0],knee=[side*.105,.86-.36*Math.cos(swing),.36*Math.sin(swing)];
   const ankle=[side*.105,knee[1]-.36*Math.cos(swing-kneeBend),knee[2]+.36*Math.sin(swing-kneeBend)];
   limb(hip,knee,.085,pants);limb(knee,ankle,.063,pants);part(ankle[0],Math.max(.07,ankle[1]-.025),ankle[2]+.065,.075,.06,.15,'#e1ded4');
   const shoulder=[side*.24,1.35,0],elbow=[side*.27,1.1,-Math.sin(p.phase)*.15*side],hand=[side*.27,.9,elbow[2]+.06];
   limb(shoulder,elbow,.065,shirt);limb(elbow,hand,.045,skin);part(...[hand[0],hand[1],hand[2]],.048,.065,.038,skin);
  }
 if(p.child)part(0,1.15,-.16,.18,.23,.09,p.id%2?'#db9d49':'#b15c6c');}target.count=count;target.instanceMatrix.needsUpdate=true;if(target.instanceColor)target.instanceColor.needsUpdate=true;}

 // A separate, furnished interior keeps outdoor fog and sunlight out of the room.
 const homeScene=new THREE.Scene();homeScene.scale.z=-1;homeScene.background=new THREE.Color('#c9d6d8');
 const homeAmbient=new THREE.HemisphereLight('#e2efff','#a4886d',1.25);homeScene.add(homeAmbient);
 const homeLamp=new THREE.PointLight('#ffd7a0',34,12,2);homeLamp.position.set(0,2.65,0);homeScene.add(homeLamp);
 const windowLight=new THREE.DirectionalLight('#e1efff',2.1);windowLight.position.set(-6,8,-2);windowLight.target.position.set(1,0,2);
 windowLight.castShadow=true;windowLight.shadow.mapSize.set(1024,1024);Object.assign(windowLight.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:25});windowLight.shadow.normalBias=.025;homeScene.add(windowLight,windowLight.target);
 function homeTexture(kind){
  const cv=document.createElement('canvas');cv.width=cv.height=256;const cx=cv.getContext('2d');
  cx.fillStyle=kind==='wood'?'#b89872':kind==='fabric'?'#c3c4be':'#d1d1ca';cx.fillRect(0,0,256,256);
  if(kind==='wood'){for(let i=0;i<700;i++){cx.strokeStyle='rgba(66,39,19,'+(.03+rand()*.13)+')';const y=rand()*256;cx.beginPath();cx.moveTo(0,y);cx.bezierCurveTo(70,y+rand()*4,180,y-rand()*4,256,y+rand()*3);cx.stroke()}}
  else{for(let i=0;i<5000;i++){cx.fillStyle=rand()>.5?'#ffffff20':'#22222218';cx.fillRect(rand()*256,rand()*256,kind==='fabric'?1:2,kind==='fabric'?3:2)}if(kind==='fabric'){cx.strokeStyle='#ffffff18';for(let i=0;i<256;i+=3){cx.beginPath();cx.moveTo(i,0);cx.lineTo(i,256);cx.stroke()}}}
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
 }
 const woodMap=homeTexture('wood'),fabricMap=homeTexture('fabric'),stoneMap=homeTexture('stone');
 const homeMat={
  wall:new THREE.MeshStandardMaterial({color:'#e0d6c5',roughness:.95}),
  trim:new THREE.MeshStandardMaterial({color:'#efeadf',roughness:.55}),
  wood:new THREE.MeshStandardMaterial({color:'#b5936f',map:woodMap,roughness:.65,bumpMap:woodMap,bumpScale:.006}),
  walnut:new THREE.MeshStandardMaterial({color:'#785d43',map:woodMap,roughness:.5}),
  fabric:new THREE.MeshStandardMaterial({color:'#608389',map:fabricMap,bumpMap:fabricMap,bumpScale:.008,roughness:1}),
  linen:new THREE.MeshStandardMaterial({color:'#e0d5c0',map:fabricMap,roughness:1}),
  blue:new THREE.MeshStandardMaterial({color:'#7c9aab',map:fabricMap,roughness:1}),
  stone:new THREE.MeshStandardMaterial({color:'#c5c7c2',map:stoneMap,roughness:.35}),
  metal:new THREE.MeshStandardMaterial({color:'#b7bdba',roughness:.24,metalness:.8}),
  dark:new THREE.MeshStandardMaterial({color:'#22292b',roughness:.35}),
  ceramic:new THREE.MeshStandardMaterial({color:'#eee5d2',roughness:.3}),
  leaf:new THREE.MeshStandardMaterial({color:'#456d47',roughness:.9}),
 };
 function homeBox(name,x,y,z,w,h,d,mat,round=0){
  const geo=new THREE.BoxGeometry(w,h,d,round?6:1,round?6:1,round?6:1);
  if(round){const pos=geo.attributes.position,v=new THREE.Vector3(),clamp=new THREE.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);clamp.set(Math.max(-w/2+round,Math.min(w/2-round,v.x)),Math.max(-h/2+round,Math.min(h/2-round,v.y)),Math.max(-d/2+round,Math.min(d/2-round,v.z)));v.sub(clamp).normalize().multiplyScalar(round).add(clamp);pos.setXYZ(i,v.x,v.y,v.z)}geo.computeVertexNormals()}
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;homeScene.add(mesh);return mesh;
 }
 function homeRound(name,x,y,z,r,h,mat){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.9,h,20),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;homeScene.add(m);return m}
 // Staggered individual floorboards, baseboards, ceiling and wall panels.
 homeBox('floor-underlay',0,-.08,3,10,.15,16,homeMat.walnut);
 for(let row=0;row<32;row++)for(let col=-1;col<5;col++){let left=Math.max(-5,-5+col*2.5+(row%2)*1.25),right=Math.min(5,-5+(col+1)*2.5+(row%2)*1.25);if(right>left)homeBox('oak-floorboard',(left+right)/2,.005,-4.75+row*.5,right-left-.012,.025,.488,homeMat.wood)}
 for(const side of [-1,1]){
  homeBox('side-wall',side*5,1.5,3,.15,3,16,homeMat.wall);homeBox('end-wall',0,1.5,side<0?-5:11,10,3,.15,homeMat.wall);
  homeBox('baseboard',side*4.9,.12,3,.09,.24,16,homeMat.trim);homeBox('baseboard',0,.12,side<0?-4.9:10.9,10,.24,.09,homeMat.trim);
 }
 homeBox('ceiling',0,3.06,3,10,.12,16,homeMat.trim);
 homeBox('front-door',0,1.22,-4.88,1.5,2.44,.12,homeMat.walnut,.035);
 for(const a of [-.81,.81])homeBox('door-frame',a,1.25,-4.8,.12,2.5,.13,homeMat.trim);
 homeBox('door-frame',0,2.53,-4.8,1.74,.12,.13,homeMat.trim);
 for(const y of [.65,1.65])homeBox('door-panel',0,y,-4.79,1.12,.72,.05,homeMat.wood,.02);
 homeRound('door-handle',.54,1.08,-4.7,.045,.12,homeMat.metal).rotation.x=Math.PI/2;
 homeBox('light-switch',-3.8,1.35,-4.88,.18,.26,.06,homeMat.trim,.015);
 homeBox('switch-rocker',-3.8,1.35,-4.83,.07,.13,.035,homeMat.ceramic);
 const lampShade=new THREE.MeshStandardMaterial({color:'#f4e9cd',emissive:'#ffd6a1',emissiveIntensity:.5,roughness:.7});
 homeRound('ceiling-lamp',0,2.84,0,.36,.14,lampShade);
 // Daylit windows with deep reveals, sills and linen curtains.
 const windowMaterial=new THREE.MeshStandardMaterial({color:'#b5d3dc',emissive:'#9bc3d4',emissiveIntensity:.55,roughness:.18});
 for(const side of [-1,1]){
  homeBox('window-reveal',side*4.88,1.78,-.8,.12,1.7,2.5,homeMat.trim);
  homeBox('window-glass',side*4.8,1.78,-.8,.04,1.5,2.3,windowMaterial);
  homeBox('window-mullion',side*4.75,1.78,-.8,.08,1.5,.055,homeMat.trim);
  homeBox('window-sill',side*4.7,.98,-.8,.45,.09,2.7,homeMat.trim,.025);
  for(const z of [-2.15,.55])for(let k=0;k<4;k++)homeRound('curtain-fold',side*4.6,1.65,z+k*.07,.065,1.95,homeMat.linen);
 }
 // Upholstered sofa with separate cushions, piping and throw pillows.
 homeBox('living-rug',0,.045,1,3.65,.025,3.6,homeMat.linen,.01);
 for(const side of [-1,1])for(const z of [1.08,1.85])homeBox('sofa-foot',side*1.22,.16,z,.12,.3,.12,homeMat.walnut,.02);
 homeBox('sofa-base',0,.4,1.5,3,.4,1.1,homeMat.fabric,.12);
 homeBox('sofa-back',0,.85,.82,3,.95,.25,homeMat.fabric,.1);
 for(const a of [-1.38,1.38])homeBox('sofa-arm',a,.65,1.48,.24,.75,1.1,homeMat.fabric,.1);
 for(const a of [-.87,0,.87]){homeBox('seat-cushion',a,.66,1.38,.83,.2,.83,homeMat.fabric,.08);homeBox('back-cushion',a,1.01,.99,.83,.6,.19,homeMat.fabric,.08)}
 for(const a of [-1.05,1.05]){const pillow=homeBox('throw-pillow',a,.94,1.45,.4,.43,.17,a<0?homeMat.linen:homeMat.blue,.075);pillow.rotation.z=a*.14}
 // Media console and illuminated television; interaction state comes from the game.
 homeBox('media-console',0,.38,4.45,2.8,.68,.7,homeMat.walnut,.035);
 for(const a of [-.9,0,.9]){homeBox('console-door',a,.4,4.08,.85,.51,.035,homeMat.wood,.012);homeBox('console-pull',a,.53,4.04,.22,.025,.035,homeMat.metal)}
 homeBox('tv-frame',0,1.6,4.76,2.64,1.52,.12,homeMat.dark,.035);
 const homeTVMaterial=new THREE.MeshStandardMaterial({color:'#101a21',emissive:'#75b5ce',emissiveIntensity:0,roughness:.2});
 homeBox('tv-screen',0,1.6,4.685,2.5,1.38,.025,homeTVMaterial,.008);

 const tvCanvas=document.createElement('canvas');tvCanvas.width=512;tvCanvas.height=288;
 const tvContext=tvCanvas.getContext('2d'),tvSky=tvContext.createLinearGradient(0,0,0,288);
 tvSky.addColorStop(0,'#578bb8');tvSky.addColorStop(.65,'#d5e4de');tvSky.addColorStop(1,'#73a5ac');
 tvContext.fillStyle=tvSky;tvContext.fillRect(0,0,512,288);
 tvContext.fillStyle='#f6e6b7';tvContext.beginPath();tvContext.arc(390,65,25,0,Math.PI*2);tvContext.fill();
 tvContext.fillStyle='#637e75';tvContext.beginPath();tvContext.moveTo(0,200);tvContext.lineTo(85,98);tvContext.lineTo(155,175);tvContext.lineTo(250,140);tvContext.lineTo(340,220);tvContext.lineTo(0,288);tvContext.fill();
 tvContext.fillStyle='#4e929f';tvContext.fillRect(0,210,512,78);tvContext.fillStyle='#d5c6a2';tvContext.beginPath();tvContext.moveTo(0,238);tvContext.quadraticCurveTo(130,215,220,288);tvContext.lineTo(0,288);tvContext.fill();
 const tvMap=new THREE.CanvasTexture(tvCanvas);tvMap.colorSpace=THREE.SRGBColorSpace;
 const tvPicture=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.38),new THREE.MeshBasicMaterial({map:tvMap}));
 tvPicture.name='television-picture';tvPicture.position.set(0,1.6,4.66);tvPicture.rotation.y=Math.PI;homeScene.add(tvPicture);

 const tvGlow=new THREE.PointLight('#8bbfdd',0,5,2);tvGlow.position.set(0,1.6,4.2);homeScene.add(tvGlow);
 homeBox('tv-stand',0,.85,4.6,.6,.07,.3,homeMat.dark,.02);
 // Layered bed linen, pillows and a headboard, within the existing collision footprint.
 homeBox('bed-frame',-3.4,.28,8.2,2.5,.46,3,homeMat.walnut,.07);
 homeBox('headboard',-3.4,.85,9.63,2.55,1.25,.15,homeMat.fabric,.06);
 homeBox('mattress',-3.4,.6,8.2,2.4,.3,2.9,homeMat.linen,.12);
 homeBox('duvet',-3.4,.79,7.9,2.42,.19,2.25,homeMat.blue,.09);
 for(const a of [-3.97,-2.83])homeBox('bed-pillow',a,.84,9.13,1,.18,.61,homeMat.linen,.08);
 for(let i=0;i<8;i++)homeBox('duvet-seam',-4.45+i*.3,.89,7.9,.012,.007,2.05,homeMat.linen);
 // Kitchen cabinet fronts, backsplash tiles, sink, faucet and countertop objects.
 homeBox('kitchen-base',4.2,.52,3,1.3,1.04,3,homeMat.trim,.025);
 homeBox('countertop',4.2,1.09,3,1.5,.12,3.1,homeMat.stone,.035);
 for(const z of [1.95,2.95,3.95]){homeBox('cabinet-door',3.53,.55,z,.045,.83,.92,homeMat.wood,.015);homeBox('cabinet-pull',3.49,.84,z,.04,.035,.25,homeMat.metal)}
 for(let z=1.5;z<4.5;z+=.3)for(let y=1.2;y<1.9;y+=.2)homeBox('backsplash-tile',4.88,y,z,.035,.19,.29,homeMat.ceramic,.008);
 homeBox('sink-rim',4.2,1.16,3.7,.88,.035,.85,homeMat.metal,.05);
 homeBox('sink-basin',4.2,1.18,3.7,.72,.02,.69,homeMat.dark,.045);
 homeRound('faucet-stem',4.65,1.36,3.7,.028,.4,homeMat.metal);
 homeBox('faucet-spout',4.5,1.55,3.7,.32,.04,.05,homeMat.metal,.015);
 homeBox('chopping-board',4.13,1.18,2.05,.65,.04,.55,homeMat.wood,.025);
 homeRound('fruit-bowl',4.15,1.25,2.08,.19,.12,homeMat.ceramic);
 const fruitMat=new THREE.MeshStandardMaterial({color:'#c89046',roughness:.65});
 for(let i=0;i<3;i++){const fruit=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),fruitMat);fruit.position.set(4.05+i*.08,1.34,2.08+(i%2)*.07);homeScene.add(fruit)}
 homeRound('mug',4.22,1.29,2.62,.085,.22,homeMat.ceramic);
 // Framed abstract artwork and small plants sit on walls and sills, off walking routes.
 homeBox('art-frame',2.9,1.8,-4.86,1.35,1.05,.08,homeMat.walnut,.02);
 homeBox('art-mat',2.9,1.8,-4.8,1.2,.9,.025,homeMat.linen);
 homeBox('art-blue',2.78,1.9,-4.77,.55,.5,.015,homeMat.blue);
 homeBox('art-sand',3.12,1.65,-4.75,.46,.35,.015,homeMat.wood);
 for(const side of [-1,1]){homeRound('plant-pot',side*4.66,1.12,-1.4,.13,.23,homeMat.ceramic);for(let j=0;j<6;j++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),homeMat.leaf);leaf.scale.set(.055,.19,.035);leaf.position.set(side*4.66+Math.sin(j)*.08,1.4,-1.4+Math.cos(j)*.08);leaf.rotation.z=Math.sin(j)*.6;homeScene.add(leaf)}}
 // Rear bedrooms extend the house from 100 to 160 square metres of floor space.
 for(const [a,w] of [[-3.8,2.4],[0,2.8],[3.8,2.4]])homeBox('bedroom-front-wall',a,1.5,5,w,3,.16,homeMat.wall);
 for(const a of [-2.65,-1.35,1.35,2.65])homeBox('bedroom-door-frame',a,1.25,4.9,.08,2.5,.12,homeMat.trim);
 for(const a of [-2,2])homeBox('bedroom-door-header',a,2.56,5,1.3,.9,.16,homeMat.wall);
 homeBox('bedroom-divider',0,1.5,8,.15,3,6,homeMat.wall);
 const bedroomLight=new THREE.PointLight('#ffdfb0',25,11,2);bedroomLight.position.set(-2.5,2.6,8);homeScene.add(bedroomLight);
 const kidsLight=new THREE.HemisphereLight('#e3eeff','#c4aa90',.65);homeScene.add(kidsLight);
 for(const y of [.48,1.65]){
  homeBox('kids-bunk-frame',3.4,y,8.5,2.1,.15,2.8,homeMat.wood,.04);
  homeBox('kids-mattress',3.4,y+.16,8.5,1.96,.2,2.65,homeMat.linen,.08);
  homeBox('kids-blanket',3.4,y+.3,8.2,1.98,.12,2,homeMat.blue,.05);
  homeBox('kids-pillow',3.4,y+.32,9.45,1.15,.15,.55,homeMat.linen,.06);
 }
 for(const a of [2.4,4.4])for(const z of [7.1,9.9])homeBox('bunk-post',a,1.2,z,.1,2.4,.1,homeMat.wood,.02);
 homeBox('bunk-guardrail',2.4,2.15,8.6,.08,.12,2.5,homeMat.wood);
 for(const a of [2.5,3.05])homeBox('bunk-ladder',a,1.05,7.02,.08,2.1,.08,homeMat.wood);
 for(let y=.25;y<2;y+=.3)homeBox('ladder-rung',2.775,y,7.02,.6,.06,.1,homeMat.wood);
 homeBox('bedroom-window',-4.88,1.8,8.2,.08,1.5,2,windowMaterial);
 homeBox('kids-window',4.88,1.8,8.2,.08,1.5,2,windowMaterial);
 homeBox('kids-rug',2.2,.035,6.2,3.2,.03,1.5,homeMat.blue);
 // Two smaller versions of the pedestrian model, with backpacks.
 const homePeople=new THREE.InstancedMesh(people.geometry,people.material,64);homePeople.name='family-at-home';homePeople.count=0;homePeople.castShadow=true;homePeople.frustumCulled=false;homeScene.add(homePeople);
 const heldSnack=new THREE.Group();heldSnack.name='held-snack';
 const apple=new THREE.Mesh(new THREE.SphereGeometry(.065,18,12),new THREE.MeshStandardMaterial({color:'#b64031',roughness:.35}));apple.scale.y=1.1;heldSnack.add(apple);
 const hand=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({color:'#c99c7b',roughness:.85}));hand.scale.set(.065,.035,.07);hand.position.set(0,-.05,0);heldSnack.add(hand);
 const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.23,12),homeMat.blue);sleeve.position.set(.015,-.13,-.07);sleeve.rotation.x=-.6;heldSnack.add(sleeve);
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.006,.007,.035,8),homeMat.walnut);stem.position.y=.08;heldSnack.add(stem);
 const heldPoint=new THREE.Vector3();
 function updateHeldSnack(player,rig,time,indoors){const parent=indoors?homeScene:scene;if(heldSnack.parent!==parent)parent.add(heldSnack);heldSnack.visible=!!player.onFoot&&!!player.heldSnack;if(!heldSnack.visible)return;const eating=player.snackEatingUntil>time,progress=eating?Math.max(0,1-(player.snackEatingUntil-time)/.9):0,lift=eating?Math.sin(progress*Math.PI):0;camera.updateMatrixWorld(true);heldPoint.set(.26*(1-lift),-.32+.25*lift,-.56+.36*lift).applyMatrix4(camera.matrixWorld);heldSnack.position.set(heldPoint.x,heldPoint.y,-heldPoint.z);heldSnack.rotation.set(0,rig.heading,0);}
 const restBody=new THREE.Group();restBody.name='resting-body';homeScene.add(restBody);
 const restLegs=[];for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),homeMat.blue);leg.scale.set(.1,.09,.34);leg.position.set(side*.13,.51,.35);restBody.add(leg);restLegs.push(leg);const shoe=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),homeMat.dark);shoe.scale.set(.10,.08,.17);shoe.position.set(side*.13,.3,.72);restBody.add(shoe)}
 function updateRestBody(player){restBody.visible=!!(player.homeSeated||player.homeLying);restBody.position.set(player.x,player.homeLying?.3:0,player.z);restBody.rotation.y=player.yaw;}
 const schoolSign=new THREE.Mesh(new THREE.PlaneGeometry(20,2.6),signTexture('PALM ELEMENTARY','DROP-OFF & PICKUP      BLUE BAY','#355d68'));schoolSign.name='school-sign';schoolSign.position.set(244,6,239.6);schoolSign.rotation.y=Math.PI;scene.add(schoolSign);
 const schoolUV=schoolSign.geometry.attributes.uv;for(let i=0;i<schoolUV.count;i++)schoolUV.setX(i,1-schoolUV.getX(i));
 const baySign=new THREE.Mesh(new THREE.PlaneGeometry(6,1.3),signTexture('KIDS HERE','STOP      P PARK      F','#377996'));baySign.position.set(258,2.2,234);baySign.rotation.y=Math.PI;scene.add(baySign);const bayUV=baySign.geometry.attributes.uv;for(let i=0;i<bayUV.count;i++)bayUV.setX(i,1-bayUV.getX(i));
 for(const [a,title] of [[-2,'YOUR ROOM'],[2,'KIDS ROOM']]){const label=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.4),signTexture(title,'BEDROOM','#476e76'));label.position.set(a,2.65,4.88);label.rotation.y=Math.PI;const uv=label.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));homeScene.add(label)}


 const shops=[signTexture('COASTAL','COFFEE & BAKERY','#385653'),signTexture('PALM MARKET','FRESH  LOCAL','#62704b'),signTexture('STUDIO 05','DESIGN & PRINT','#776759')];
 for(let a=-300;a<340;a+=80)for(let b=-300;b<340;b+=80){
  if((a>170&&a<310&&b>170&&b<310)||(a>10&&a<105&&b>15&&b<130)||(Math.abs(a+240)<80&&Math.abs(b-240)<80)||(Math.abs(a-240)<80&&Math.abs(b+240)<80))continue;
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
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.5),signTexture('EXIT '+(side+1),names[side]+'   ?','#1d654d'));
  sign.position.set(12,6.5,-.18);sign.rotation.y=Math.PI;gantry.add(sign);
  const through=new THREE.Mesh(new THREE.PlaneGeometry(6,2),signTexture('CITY LOOP','THROUGH TRAFFIC  ','#225d4d'));
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
  return{root,paint,front,rear,left,right,wheels,last:null};
 }
 
 
 const roundGeo=new THREE.SphereGeometry(1,16,10);
 function newVehicle(kind,col){
  const v=newCar(col);v.kind=kind;if(kind==='car')return v;
  v.root.clear();v.wheels.length=0;
  const root=v.root,paint=v.paint;
  function panel(mat,x,y,z,w,h,d){return block(root,mat,x,y,z,w,h,d)}
  function oval(mat,x,y,z,w,h,d){const m=new THREE.Mesh(roundGeo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;root.add(m);return m}
  function wheel(x,z,radius=.4){const p=new THREE.Group();p.position.set(x,radius+.04,z);root.add(p);const tire=new THREE.Mesh(wheelGeo,rubber),rim=new THREE.Mesh(rimGeo,chrome);for(const m of [tire,rim]){m.rotation.z=Math.PI/2;m.scale.set(radius/.35,1,radius/.35);m.castShadow=true;p.add(m)}v.wheels.push(p)}
  const front=v.front;
  let length=kind==='bus'?9.8:kind==='truck'?5.8:kind==='minivan'?5.1:2.3;
  if(kind==='motorcycle'){
   wheel(0,-.78,.36);wheel(0,.78,.36);
   panel(chrome,0,.62,0,.16,.16,1.65);panel(trim,0,.57,-.1,.44,.42,.6);
   oval(paint,0,.95,.16,.29,.26,.43);panel(trim,0,1.02,-.44,.42,.12,.6);
   for(const side of [-1,1]){const fork=panel(chrome,side*.12,.75,.68,.045,.9,.045);fork.rotation.x=-.18;panel(chrome,side*.30,.52,-.55,.10,.1,.75)}
   panel(chrome,0,1.23,.63,.72,.045,.045);
   for(const side of [-1,1])panel(trim,side*.31,1.23,.63,.16,.065,.08);
   panel(glassMaterial,0,1.36,.67,.40,.32,.055);
   panel(front,0,1.04,1.02,.25,.16,.05);
   panel(v.rear,0,.94,-1.06,.20,.13,.05);
   for(const side of [-1,1])for(const z of [-1,1])panel(side<0?v.left:v.right,side*.27,.94,z,.08,.08,.07);
   // Seated rider gives the motorcycle a recognizable third-person silhouette.
   oval(trim,0,1.35,-.37,.24,.38,.20);oval(paint,0,1.84,-.22,.19,.22,.20);
   panel(glassMaterial,0,1.87,-.025,.27,.10,.035);
   for(const side of [-1,1]){const arm=panel(trim,side*.22,1.35,.18,.11,.12,.68);arm.rotation.x=.18;panel(trim,side*.24,.84,-.25,.13,.55,.15)}
   return v;
  }
  const w=kind==='bus'?2.45:kind==='truck'?2.12:1.98;
  panel(paint,0,.77,0,w,.72,length-.16);panel(trim,0,.35,0,w-.16,.16,length-.3);
  if(kind==='bus'){
   panel(paint,0,2.02,0,w,1.85,length-.25);
   panel(paint,0,3.0,0,w+.02,.16,length-.18);
   panel(glassMaterial,0,2.15,4.79,2.14,1.25,.06);
   for(const side of [-1,1]){
    for(let z=-3.9;z<=3.9;z+=1.3)panel(glassMaterial,side*1.235,2.18,z,.035,1.12,1.1);
    panel(chrome,side*1.24,1.43,0,.025,.07,9.2);
   }
   panel(trim,1.24,1.65,3.3,.035,2.1,1.05);for(const z of [3.03,3.57])panel(glassMaterial,1.265,1.72,z,.035,1.6,.43);
   panel(paint,0,3.18,-1.3,1.5,.24,2.4);
   for(const side of [-1,1])for(const z of [-3.2,3.25])wheel(side*1.11,z,.5);
   panel(trim,0,2.91,4.81,1.9,.26,.06);
  }else if(kind==='truck'){
   panel(paint,0,1.62,.7,1.97,1.12,2.6);panel(glassMaterial,0,1.94,2.02,1.72,.73,.045);
   panel(paint,0,2.22,.65,2.03,.12,2.6);
   for(const side of [-1,1]){panel(glassMaterial,side*1.0,1.85,.75,.035,.66,1.95);panel(paint,side*.98,1.38,-1.9,.16,.55,1.6)}
   panel(trim,0,1.12,-1.9,1.76,.10,1.6);panel(paint,0,1.4,-2.77,2.04,.57,.12);
   panel(paint,0,1.2,2.43,2.04,.17,.72);
   for(const side of [-1,1])for(const z of [-1.85,1.75])wheel(side*1.0,z,.46);
  }else{
   panel(paint,0,1.44,-.15,1.90,1.12,3.75);
   panel(paint,0,2.04,-.15,1.94,.14,3.8);
   panel(glassMaterial,0,1.68,1.75,1.68,.68,.055);
   panel(glassMaterial,0,1.65,-2.07,1.65,.65,.055);
   for(const side of [-1,1]){
    for(const z of [-1.35,-.25,.87])panel(glassMaterial,side*.963,1.66,z,.035,.65,.96);
    panel(chrome,side*.982,1.25,-.5,.02,.035,2.7);panel(chrome,side*.99,1.15,-.35,.025,.05,.24);
   }
   for(const side of [-1,1])for(const z of [-1.55,1.5])wheel(side*.94,z,.37);
  }
  const end=length/2-.015,lightY=kind==='bus'?1.0:.93;
  panel(trim,0,.71,end,.9,.3,.045);panel(chrome,0,.48,end,w-.15,.09,.045);
  for(const side of [-1,1]){
   panel(front,side*w*.32,lightY,end,.42,.20,.04);
   panel(v.rear,side*w*.35,lightY,-end,.28,.26,.04);
   for(const z of [-end,end])panel(side<0?v.left:v.right,side*w*.43,lightY,z,.12,.16,.055);
   panel(paint,side*(w/2+.07),kind==='bus'?2.2:1.7,kind==='bus'?4.25:1.35,.13,.22,.26);
  }
  panel(plateMaterial,0,.56,-end,.45,.15,.04);return v;
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
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.68,.17),new THREE.MeshBasicMaterial({map:screenTexture}));screen.name='cockpit-instruments';screen.position.set(.12,1.005,.445);screen.rotation.y=Math.PI;const instrumentUV=screen.geometry.attributes.uv;for(let i=0;i<instrumentUV.count;i++)instrumentUV.setX(i,1-instrumentUV.getX(i));cockpit.add(screen);
 
 const bikeCockpit=new THREE.Group();scene.add(bikeCockpit);
 block(bikeCockpit,chrome,0,1.02,.68,.75,.045,.045);
 for(const side of [-1,1]){block(bikeCockpit,trim,side*.32,1.02,.68,.18,.075,.09);block(bikeCockpit,chrome,side*.14,.82,.75,.035,.43,.035)}
 const bikeScreen=new THREE.Mesh(screen.geometry.clone(),screen.material);bikeScreen.position.set(0,1.03,.79);bikeScreen.scale.set(.55,.75,1);bikeScreen.rotation.y=Math.PI;bikeCockpit.add(bikeScreen);

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
  car(a,b,r,col,braking,indicator,elevation,kind='car'){queue.push({a,b,r,col,braking,indicator,elevation,kind})},
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
   if(player.insideHome){
    updatePeople([]);updatePeople(player.family?.poses||[],homePeople);updateHeldSnack(player,rig,time,true);updateRestBody(player);bedroomLight.intensity=player.homeLights===false?0:25;homeLamp.intensity=player.homeLights===false?0:34;lampShade.emissiveIntensity=player.homeLights===false?0:.5;
    homeAmbient.intensity=player.homeLights===false?.48:1.25;
    tvPicture.visible=!!player.homeTV;
    homeTVMaterial.color.set(player.homeTV?'#85b8ca':'#101a21');homeTVMaterial.emissiveIntensity=player.homeTV?.85:0;tvGlow.intensity=player.homeTV?3:0;
    renderer.render(homeScene,camera);window.__ultraDiagnostics={ready:true,quality,insideHome:true,calls:renderer.info.render.calls};return;
   }
   sky.position.set(rig.x,rig.height,rig.z);
   const targetX=Math.round(player.x/4)*4,targetZ=Math.round(player.z/4)*4;
   sun.position.set(targetX+100,player.groundY+160,targetZ+60);sun.target.position.set(targetX,player.groundY,targetZ);
   homePeople.count=0;updateHeldSnack(player,rig,time,false);updatePeople([...(state.pedestrians||[]),...(player.family?.poses||[])]);
   upload(faces);carIndex=0;
   for(const q of queue){
    let car=cars[carIndex];if(!car||car.kind!==q.kind){if(car){scene.remove(car.root);for(const m of [car.paint,car.front,car.rear,car.left,car.right])m.dispose()}cars[carIndex]=car=newVehicle(q.kind,q.col)}carIndex++;
    car.root.visible=true;car.root.position.set(q.a,q.elevation,q.b);car.root.rotation.y=q.r;car.paint.color.set(q.col);
    car.rear.emissiveIntensity=q.braking?2.5:.25;const blink=Math.floor(time*3)%2===0;
    car.left.emissiveIntensity=blink&&(q.indicator===-1||q.indicator===2)?3:0;
    car.right.emissiveIntensity=blink&&(q.indicator===1||q.indicator===2)?3:0;
    if(car.last){const d=Math.hypot(q.a-car.last.a,q.b-car.last.b);if(d<10)for(const w of car.wheels)w.rotation.x+=d/.35}car.last=q;
   }
   for(let i=carIndex;i<cars.length;i++)cars[i].root.visible=false;
   instanceCars(carIndex);
   cockpit.visible=!player.onFoot&&!player.thirdPerson&&player.gear>0&&player.vehicleType!=='motorcycle';cockpit.position.set(player.x+Math.sin(player.yaw)*.3,player.groundY+(player.eye??1.45)-1.45,player.z+Math.cos(player.yaw)*.3);cockpit.rotation.y=player.yaw;steeringWheel.rotation.z=-player.steering*.9;
   bikeCockpit.visible=!player.onFoot&&!player.thirdPerson&&player.gear>0&&player.vehicleType==='motorcycle';bikeCockpit.position.set(player.x,player.groundY+(player.eye??1.5)-1.45,player.z);bikeCockpit.rotation.y=player.yaw+player.steering*.12;
   const hud=Math.round(Math.abs(player.speed)*2.237)+'   '+(player.park?'P':player.gear<0?'R':'D')+'   '+(player.signal<0?'?':player.signal>0?'?':'');
   if(hud!==lastHud){screenCtx.fillStyle='#07131b';screenCtx.fillRect(0,0,512,128);screenCtx.textAlign='left';screenCtx.fillStyle='#d8f3eb';screenCtx.font='bold 68px sans-serif';screenCtx.fillText(String(Math.round(Math.abs(player.speed)*2.237)),24,80);screenCtx.font='20px sans-serif';screenCtx.fillText('MPH',28,111);screenCtx.fillStyle='#b8ef9a';screenCtx.font='bold 52px sans-serif';screenCtx.fillText(player.park?'P':player.gear<0?'R':'D',330,76);screenCtx.font='16px sans-serif';screenCtx.fillText(player.park?'PARK':player.gear<0?'REVERSE':'DRIVE',310,109);screenTexture.needsUpdate=true;lastHud=hud}
   mirror.visible=quality!=='low';if(cockpit.visible&&mirror.visible&&mirrorFrame++%(quality==='high'?2:4)===0){
    mirrorCamera.position.set(player.x,player.groundY+1.65,-player.z);
    mirrorCamera.lookAt(player.x-Math.sin(player.yaw),player.groundY+1.60,-player.z+Math.cos(player.yaw));
    cockpit.visible=false;renderer.setRenderTarget(mirrorTarget);renderer.render(scene,mirrorCamera);renderer.setRenderTarget(null);cockpit.visible=true;
   }
   renderer.render(scene,camera);frames++;const now=performance.now();if(now-fpsTime>1000){const label=document.getElementById('ultra-fps');if(label)label.textContent=Math.round(frames*1000/(now-fpsTime))+' FPS';frames=0;fpsTime=now}
   window.__ultraDiagnostics={ready:true,quality,cars:carIndex,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
  },
  renderer,scene,camera,homeScene
 };
}
