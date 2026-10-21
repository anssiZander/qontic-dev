import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {dragSurfaceGeometry} from './packet-interaction.js?v=2.126';
import {surfaceZeroLevel} from './packet-model.js?v=2.126';

const X_MIN=-2,X_MAX=2,Y_MIN=-1.5,Y_MAX=1.5,SURFACE_HEIGHT=.72;

function color(value,fallback='#ffffff'){
 try{return new THREE.Color(value||fallback);}catch{return new THREE.Color(fallback);}
}

// Cyclic phase map for the "Phase hue" 3D style (2.126): blue (0), violet (π/2),
// red (±π), magenta (−π/2). Brightness follows the amplitude, so dark means small |Ψ|.
const PHASE_ANCHORS=[[.18,.36,1],[.62,.25,1],[1,.17,.24],[1,.25,.72]];
const PHASE_FLOOR=[.03,.045,.07];
function phaseColor(cosTheta,sinTheta){
 const t=((Math.atan2(sinTheta,cosTheta)/(2*Math.PI))%1+1)%1*4,k=Math.floor(t)%4,f=t-Math.floor(t),a=PHASE_ANCHORS[k],b=PHASE_ANCHORS[(k+1)%4];
 return [a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1]),a[2]+f*(b[2]-a[2])];
}
const PW_YELLOW='#ffd84a';

function line(points,material){
 const geometry=new THREE.BufferGeometry().setFromPoints(points);
 return new THREE.Line(geometry,material);
}

function lines(positions,colors=null,opacity=1){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 if(colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:colors?0xffffff:0xb9dbe7,vertexColors:!!colors,transparent:opacity<1,opacity}));
}

function disposeObject(object){
 object.traverse(child=>{
  if(!child.userData?.sharedGeometry)child.geometry?.dispose();
  if(Array.isArray(child.material))child.material.forEach(item=>item.dispose());
  else child.material?.dispose();
 });
 object.removeFromParent();
}

export function mountPacketSurface3D({host}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 renderer.setClearColor(0x0a1723,1);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.className='packet-surface-webgl';
 renderer.domElement.setAttribute('aria-label','Interactive three-dimensional wave graph');
 host.append(renderer.domElement);

 const scene=new THREE.Scene();
 scene.fog=new THREE.Fog(0x0a1723,6.5,12);
 const camera=new THREE.PerspectiveCamera(38,4/3,.01,50);
 camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=3;controls.maxDistance=12;
 controls.target.set(.15,0,.18);
 let visible=false,lastState=null,frame=0,recordObjects=[];

 const resetCamera=()=>{camera.position.set(5.25,-4.9,3.65);controls.target.set(.15,0,.18);controls.update();render();};
 resetCamera();

 scene.add(new THREE.HemisphereLight(0xcceeff,0x102532,1.9));
 const key=new THREE.DirectionalLight(0xffffff,1.35);key.position.set(-3,-4,7);scene.add(key);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(4.45,3.35),new THREE.MeshPhongMaterial({color:0x173344,transparent:true,opacity:.76,side:THREE.DoubleSide}));
 floor.position.set(.12,0,-.025);scene.add(floor);
 const grid=new THREE.GridHelper(4.4,16,0x4a7c90,0x294e60);grid.rotation.x=Math.PI/2;grid.position.set(.1,0,-.018);grid.material.transparent=true;grid.material.opacity=.46;scene.add(grid);

 const dynamic=new THREE.Group();scene.add(dynamic);
 const overlay=document.createElement('div');overlay.className='packet-surface-help';overlay.innerHTML='<span>Drag: rotate · Wheel/pinch: zoom · Right-drag: pan</span><label>Height <select aria-label="3D surface height" title="Choose the wave quantity graphed as height. Amplitude-based heights use a monotonic contrast boost so the transmitted wave remains visible; zeros and ordering are preserved. cos θ avoids the artificial ±π wrap cliff. Carrier motion is slowed for a smooth 3D display only."><option value="psi2">|Ψ|²</option><option value="phase">cos θ</option><option value="real">Re Ψ</option><option value="imag">Im Ψ</option></select></label><button type="button" title="Reset 3D camera">Reset view</button>';
 overlay.querySelector('button').addEventListener('click',resetCamera);host.append(overlay);
 // Pilot-Wave 3D style controls (2.126): wave surface opacity and the height of the particle plane.
 const readSetting=(key,fallback)=>{try{const v=Number(localStorage.getItem(key));return localStorage.getItem(key)!==null&&Number.isFinite(v)?v:fallback;}catch(_){return fallback;}};
 const saveSetting=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){}};
 const pwStyle={wave:readSetting('qontic-double-slit-3d-wave-opacity',75),height:readSetting('qontic-double-slit-3d-particle-height',0)};
 const styleLabel=document.createElement('label');styleLabel.title='Surface color in 3D. Phase hue colors the wave by its complex phase, with brightness set by the amplitude. 2D palette reuses the colors of the flat view.';
 styleLabel.innerHTML='Color <select aria-label="3D surface color"><option value="phase">Phase hue</option><option value="palette">2D palette</option></select>';
 overlay.insertBefore(styleLabel,overlay.querySelector('button'));
 const styleSelect=styleLabel.querySelector('select');
 let colorStyle=(()=>{try{return localStorage.getItem('qontic-double-slit-3d-color')||'phase';}catch(_){return 'phase';}})();
 styleSelect.value=colorStyle;
 styleSelect.addEventListener('change',()=>{colorStyle=styleSelect.value;try{localStorage.setItem('qontic-double-slit-3d-color',colorStyle);}catch(_){}if(lastState)update(lastState);});
 const legend=document.createElement('canvas');legend.className='packet-surface-legend';legend.width=232;legend.height=232;legend.title='Wave phase θ. Hue gives the phase; dark regions have small amplitude.';host.append(legend);
 {const ctx=legend.getContext('2d'),c=116,r1=70,r0=40;
  for(let a=0;a<360;a+=1){const th=a*Math.PI/180,col=phaseColor(Math.cos(th),Math.sin(th));ctx.strokeStyle=`rgb(${col.map(x=>Math.round(255*x)).join(',')})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(c,c,(r0+r1)/2,-th-.01,-th+.03,false);ctx.lineWidth=r1-r0;ctx.stroke();}
  ctx.fillStyle='#dff7ff';ctx.font='600 26px Inter,Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('θ',c,c);ctx.font='22px Inter,Arial,sans-serif';ctx.fillText('0',c+96,c);ctx.fillText('±π',c-98,c);ctx.fillText('+π/2',c,c-94);ctx.fillText('−π/2',c,c+96);}
 const pwControls=document.createElement('span');pwControls.className='packet-surface-pw';
 pwControls.innerHTML='<label title="Opacity of the 3D wave surface in Pilot-Wave. Lower values show the particles through the wave.">Wave <input type="range" min="0" max="100" step="1" data-key="wave" aria-label="3D wave opacity"></label><label title="Height of the plane on which Pilot-Wave particles and trajectories are drawn, as a fraction of the maximum surface height. It is a display choice; the dynamics stay in the physical x–y plane.">Particle height <input type="range" min="0" max="110" step="1" data-key="height" aria-label="3D particle plane height"></label>';
 overlay.append(pwControls);
 for(const input of pwControls.querySelectorAll('input')){
  input.value=pwStyle[input.dataset.key];
  input.addEventListener('keydown',event=>event.stopPropagation());
  input.addEventListener('input',()=>{pwStyle[input.dataset.key]=+input.value;saveSetting(input.dataset.key==='wave'?'qontic-double-slit-3d-wave-opacity':'qontic-double-slit-3d-particle-height',input.value);if(lastState)update(lastState);});
 }
 const heightSelect=overlay.querySelector('select');let heightChange=null;heightSelect.addEventListener('change',()=>heightChange?.(heightSelect.value));
 const editor=document.createElement('div');editor.className='packet-surface-editor';editor.hidden=true;
 editor.innerHTML='<button type="button" data-kind="wall" title="Move slit wall">↔ Wall</button><button type="button" data-kind="distance" title="Change wall-to-detector distance">↔ Distance</button><button type="button" data-kind="height" title="Change screen length">↕ Length</button><button type="button" data-kind="width" title="Change both slit widths">↕ Width</button><button type="button" data-kind="separation" title="Change slit separation">↕ Sep</button><output hidden></output>';
 host.append(editor);
 renderer.domElement.addEventListener('dblclick',resetCamera);
 let editorCallbacks=null,editDrag=null;

 function screenPoint(point){const projected=point.clone().project(camera),width=host.clientWidth,height=host.clientHeight;return {x:(projected.x+1)*width/2,y:(1-projected.y)*height/2};}
 function editorAnchors(){
  if(!lastState)return {};
  const zero=surfaceZeroLevel(lastState.heightMode,SURFACE_HEIGHT),wallX=X_MIN+lastState.wallFraction*(X_MAX-X_MIN),openings=[...lastState.openings].sort((a,b)=>a[0]-b[0]),upper=openings[0]||[.36,.44],lower=openings[1]||upper,lowerCenter=(lower[0]+lower[1])/2;
  return {wall:new THREE.Vector3(wallX,Y_MIN+.12,zero+.2),distance:new THREE.Vector3(X_MAX,Y_MIN+.12,zero+.2),height:new THREE.Vector3(X_MAX,Y_MAX,zero+.2),width:new THREE.Vector3(wallX,Y_MAX-upper[0]*(Y_MAX-Y_MIN),zero+.24),separation:new THREE.Vector3(wallX,Y_MAX-lowerCenter*(Y_MAX-Y_MIN),zero+.24)};
 }
 function positionEditor(){if(editor.hidden||!lastState)return;const anchors=editorAnchors();for(const button of editor.querySelectorAll('button[data-kind]')){const point=screenPoint(anchors[button.dataset.kind]);if(editDrag?.kind===button.dataset.kind){point.x+=editDrag.axisX*(editDrag.scalar||0);point.y+=editDrag.axisY*(editDrag.scalar||0);}button.style.left=point.x+'px';button.style.top=point.y+'px';}}
 function render(){if(!visible)return;renderer.render(scene,camera);positionEditor();}
 controls.addEventListener('change',render);
 function animate(){frame=0;if(!visible)return;controls.update();render();if(controls.enableDamping)frame=requestAnimationFrame(animate);}
 function resize(){const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();

 function sampleHeight(state,u,v){
  if(!state.heights)return 0;
  const i=Math.max(0,Math.min(state.gridWidth-1,Math.round(u*state.fieldFraction*(state.gridWidth-1))));
  const j=Math.max(0,Math.min(state.gridHeight-1,Math.round(v*(state.gridHeight-1))));
  return state.heights[j*state.gridWidth+i]||0;
 }
 const world=(u,v,z=0)=>new THREE.Vector3(X_MIN+u*(X_MAX-X_MIN),Y_MAX-v*(Y_MAX-Y_MIN),z);

 // Display-tab opacity sliders (2.124): the same layer opacities as the 2D view.
 const layerOpacity=(state,key)=>{const value=state.opacity?.[key];return Number.isFinite(value)?Math.max(0,Math.min(1,value)):1;};
 const fade=(material,opacity)=>{material.transparent=material.transparent||opacity<1;material.opacity*=opacity;if(opacity<1)material.depthWrite=false;return material;};
 function addWave(state){
  if(!state.showWave||!state.heights)return;
  // 240×160 resolves several samples per carrier wavelength at the default geometry.
  const cols=240,rows=160,geometry=new THREE.PlaneGeometry(X_MAX-X_MIN,Y_MAX-Y_MIN,cols,rows),phaseStyle=colorStyle==='phase'&&state.phase&&state.amplitude;
  const positions=geometry.attributes.position,colors=new Float32Array(positions.count*3),rgba=state.rgba;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
   const n=row*(cols+1)+col,u=col/cols,v=row/rows;
   const i=Math.min(state.gridWidth-1,Math.round(u*state.fieldFraction*(state.gridWidth-1))),j=Math.min(state.gridHeight-1,Math.round(v*(state.gridHeight-1))),source=j*state.gridWidth+i;
   positions.setZ(n,sampleHeight(state,u,v)*SURFACE_HEIGHT);
   if(phaseStyle){const hue=phaseColor(state.phase[2*source],state.phase[2*source+1]),bright=Math.min(1,Math.sqrt(Math.max(0,state.amplitude[source]))*1.25);
    // Vertex colors are linear; convert the sRGB phase colors so they stay saturated.
    for(let k=0;k<3;k++)colors[3*n+k]=Math.pow(PHASE_FLOOR[k]+bright*(hue[k]-PHASE_FLOOR[k]),2.2);continue;}
   const visibility=Math.min(1,Math.pow((rgba[4*source+3]||0)/255,.68)*1.18),base=[.035,.095,.135];
   colors[3*n]=base[0]+visibility*((rgba[4*source]||75)/255-base[0]);colors[3*n+1]=base[1]+visibility*((rgba[4*source+1]||150)/255-base[1]);colors[3*n+2]=base[2]+visibility*((rgba[4*source+2]||190)/255-base[2]);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
  // Pilot-Wave particles stay on the fixed apparatus plane (2.125), so the wave is
  // drawn semi-transparent there and rendered after them, letting them show through.
  const waveOpacity=layerOpacity(state,'wave'),seeThrough=!!state.pilotWave;
  const mesh=new THREE.Mesh(geometry,fade(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:seeThrough?Math.max(.001,pwStyle.wave/100):.98,side:THREE.DoubleSide}),waveOpacity));
  if(seeThrough){mesh.material.depthWrite=false;mesh.renderOrder=2;}
  mesh.userData.wave=true;
  dynamic.add(mesh);
  if(!phaseStyle){const wire=new THREE.Mesh(geometry.clone(),fade(new THREE.MeshBasicMaterial({color:0xd8f5ff,wireframe:true,transparent:true,opacity:.075}),waveOpacity));wire.userData.wave=true;if(seeThrough){wire.material.depthWrite=false;wire.renderOrder=2;}dynamic.add(wire);}
 }

 function addWall(state){
  if(!state.showScreen)return;
  const screenOpacity=layerOpacity(state,'screen');
  const zero=surfaceZeroLevel(state.heightMode,SURFACE_HEIGHT),x=X_MIN+state.wallFraction*(X_MAX-X_MIN),openings=[...state.openings].sort((a,b)=>a[0]-b[0]);let cursor=0;
  const addSegment=(top,bottom,opacity=1)=>{
   if(bottom<=top)return;
   const yTop=Y_MAX-top*(Y_MAX-Y_MIN),yBottom=Y_MAX-bottom*(Y_MAX-Y_MIN),height=.18;
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(.055,yTop-yBottom,height),fade(new THREE.MeshPhongMaterial({color:state.screenColor?color(state.screenColor):0xd9edf4,transparent:opacity<1,opacity}),screenOpacity));
   mesh.position.set(x,(yTop+yBottom)/2,zero+height/2);dynamic.add(mesh);
  };
  openings.forEach(([top,bottom],index)=>{addSegment(cursor,top);const transmission=state.apertureWeights[index]??1;if(transmission<1)addSegment(top,bottom,1-transmission);cursor=Math.max(cursor,bottom);});addSegment(cursor,1);
  const edgePositions=[];for(const [top,bottom] of openings)for(const v of [top,bottom]){const y=Y_MAX-v*(Y_MAX-Y_MIN);edgePositions.push(x-.12,y,zero+.185,x+.12,y,zero+.185);}dynamic.add(lines(edgePositions,null,.9*screenOpacity));
  if(state.whichPathFraction!==null){const marker=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.22),new THREE.MeshPhongMaterial({color:0xffd54a}));marker.position.set(x-.10,Y_MAX-state.whichPathFraction*(Y_MAX-Y_MIN),zero+.18);dynamic.add(marker);}
 }

 function addDetector(state){
  const zero=surfaceZeroLevel(state.heightMode,SURFACE_HEIGHT),x=X_MAX+.04,base=zero+.08;
  if(state.showDetector){const wall=new THREE.Mesh(new THREE.BoxGeometry(.075,Y_MAX-Y_MIN,.16),fade(new THREE.MeshPhongMaterial({color:color(state.detectorColor),transparent:true,opacity:.68}),layerOpacity(state,'detector')));wall.position.set(x,0,base);dynamic.add(wall);}
  if(state.showProbability&&state.probability.length){
   const step=Math.max(1,Math.ceil(state.probability.length/300)),points=[];
   for(let i=0;i<state.probability.length;i+=step){const v=i/(state.probability.length-1);points.push(world(1.015,v,base+.9*state.probability[i]));}
   const probability=line(points,fade(new THREE.LineBasicMaterial({color:color(state.probabilityColor),linewidth:2}),layerOpacity(state,'probability')));dynamic.add(probability);recordObjects.push(probability);
  }
  if(!state.showHits)return;
  const hitOpacity=layerOpacity(state,'hits');
  const pointPositions=[],pointColors=[],errorPositions=[],errorColors=[];
  for(let i=0;i<state.hits.length;i++){
   if(!state.hits[i])continue;
   const v=(i+.5)/state.hits.length,y=Y_MAX-v*(Y_MAX-Y_MIN),z=base+.9*state.hitHeights[i],e=.9*state.hitErrors[i],c=color(state.hitColors[i]);
   pointPositions.push(x+.055,y,z);pointColors.push(c.r,c.g,c.b);
   errorPositions.push(x+.055,y,Math.max(base,z-e),x+.055,y,z+e);errorColors.push(c.r,c.g,c.b,c.r,c.g,c.b);
  }
  if(pointPositions.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pointPositions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(pointColors,3));const points=new THREE.Points(geometry,fade(new THREE.PointsMaterial({size:.065,sizeAttenuation:true,vertexColors:true}),hitOpacity));dynamic.add(points);recordObjects.push(points);}
  if(errorPositions.length){const errors=lines(errorPositions,errorColors,.95*hitOpacity);dynamic.add(errors);recordObjects.push(errors);}
 }

 // Phase-hue style (2.126): thick trails and glowing spheres. Uniform-colored
 // particles turn yellow so they stand out against the red/blue phase colors.
 const sphereGeometry=new THREE.SphereGeometry(1,14,10);
 function addGlowParticles(state,particleZ){
  const pick=item=>color(item.uniform?PW_YELLOW:item.color);
  if(state.showTrajectories&&state.trails.length){
   const positions=[],colors=[];
   for(const trail of state.trails){const c=pick(trail);for(let i=1;i<trail.points.length;i++){const a=trail.points[i-1],b=trail.points[i];positions.push(...world(a[0],a[1],particleZ(a[0],a[1],.035)).toArray(),...world(b[0],b[1],particleZ(b[0],b[1],.035)).toArray());colors.push(c.r,c.g,c.b,c.r,c.g,c.b);}}
   if(positions.length){
    const geometry=new LineSegmentsGeometry();geometry.setPositions(positions);geometry.setColors(colors);
    const size=renderer.getSize(new THREE.Vector2()),opacity=.85*layerOpacity(state,'trajectories');
    const material=new LineMaterial({color:0xffffff,linewidth:2,vertexColors:true,transparent:opacity<1,opacity,depthWrite:opacity>=1});material.resolution.set(size.x,size.y);
    dynamic.add(new LineSegments2(geometry,material));
   }
  }
  if(!state.showParticles||!state.particles.length)return;
  const count=state.particles.length,opacity=layerOpacity(state,'particles');
  const core=new THREE.InstancedMesh(sphereGeometry,fade(new THREE.MeshBasicMaterial({color:0xffffff}),opacity),count);
  const halo=new THREE.InstancedMesh(sphereGeometry,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.12*opacity,blending:THREE.AdditiveBlending,depthWrite:false}),count);
  const matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
  state.particles.forEach((particle,index)=>{
   const position=world(particle.u,particle.v,particleZ(particle.u,particle.v,.06)),c=pick(particle);
   core.setMatrixAt(index,matrix.compose(position,new THREE.Quaternion(),scale.setScalar(.02)));core.setColorAt(index,c);
   halo.setMatrixAt(index,matrix.compose(position,new THREE.Quaternion(),scale.setScalar(.045)));halo.setColorAt(index,c);
  });
  core.userData.sharedGeometry=halo.userData.sharedGeometry=true;halo.renderOrder=3;dynamic.add(core,halo);
 }
 function addParticles(state){
  // Particles and trails always lie on the apparatus zero plane, the physical x–y plane.
  const fixedZ=surfaceZeroLevel(state.heightMode,SURFACE_HEIGHT),particleZ=(u,v,lift)=>fixedZ+(state.pilotWave?pwStyle.height/100*SURFACE_HEIGHT:0)+lift;
  const trailPositions=[],trailColors=[],pointPositions=[],pointColors=[];
  if(state.showTrajectories)for(const trail of state.trails){const c=color(trail.color);for(let i=1;i<trail.points.length;i++){
   const a=trail.points[i-1],b=trail.points[i],az=particleZ(a[0],a[1],.035),bz=particleZ(b[0],b[1],.035);
   trailPositions.push(...world(a[0],a[1],az).toArray(),...world(b[0],b[1],bz).toArray());trailColors.push(c.r,c.g,c.b,c.r,c.g,c.b);
  }}
  if(colorStyle==='phase'){addGlowParticles(state,particleZ);return;}
  if(trailPositions.length)dynamic.add(lines(trailPositions,trailColors,.8*layerOpacity(state,'trajectories')));
  if(state.showParticles)for(const particle of state.particles){const c=color(particle.color),z=particleZ(particle.u,particle.v,.06);pointPositions.push(...world(particle.u,particle.v,z).toArray());pointColors.push(c.r,c.g,c.b);}
  if(pointPositions.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pointPositions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(pointColors,3));dynamic.add(new THREE.Points(geometry,fade(new THREE.PointsMaterial({size:.075,sizeAttenuation:true,vertexColors:true}),layerOpacity(state,'particles'))))}
 }

 function update(state){
  lastState=state;pwControls.hidden=!state.pilotWave;
  const phaseLook=colorStyle==='phase';legend.hidden=!visible||!phaseLook||!state.showWave;
  renderer.setClearColor(phaseLook?0x05080d:0x0a1723,1);scene.fog.color.set(phaseLook?0x05080d:0x0a1723);floor.material.color.set(phaseLook?0x0b141d:0x173344);
const zero=surfaceZeroLevel(state.heightMode,SURFACE_HEIGHT),signed=zero>0;floor.position.z=zero-.025;floor.material.opacity=signed?.12:.76;floor.material.depthWrite=!signed;grid.position.z=zero-.018;grid.material.opacity=signed?.36:.46;recordObjects=[];while(dynamic.children.length)disposeObject(dynamic.children[0]);
  addWave(state);addWall(state);addDetector(state);addParticles(state);render();
 }
 function setVisible(next){visible=!!next;renderer.domElement.hidden=!visible;overlay.hidden=!visible;legend.hidden=!visible||colorStyle!=='phase';if(visible){resize();if(lastState)update(lastState);cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);}else cancelAnimationFrame(frame);}
 function capture(context,width,height,{includeWave=true,includeRecords=false}={}){
  const hidden=[];
  for(const object of dynamic.children){if(!includeWave&&object.userData.wave){hidden.push(object);object.visible=false;}}
  if(!includeRecords)for(const object of recordObjects){hidden.push(object);object.visible=false;}
  renderer.render(scene,camera);context.drawImage(renderer.domElement,0,0,width,height);
  for(const object of hidden)object.visible=true;renderer.render(scene,camera);
 }
 function projectDetector(v,z,width,height){
  const point=new THREE.Vector3(X_MAX+.095,Y_MAX-v*(Y_MAX-Y_MIN),surfaceZeroLevel(lastState?.heightMode,SURFACE_HEIGHT)+z).project(camera);
  return {x:(point.x+1)*width/2,y:(1-point.y)*height/2};
 }
 function editorValue(kind,start,worldDelta){
  return dragSurfaceGeometry(start,kind,worldDelta);
 }
 function finishEditor(commit){if(!editDrag)return;const drag=editDrag;editDrag=null;controls.enabled=true;editor.querySelector('output').hidden=true;try{if(commit)editorCallbacks?.commit(drag.kind,drag.value);else editorCallbacks?.cancel(drag.kind);}finally{editorCallbacks?.resume(drag.running);}}
 for(const button of editor.querySelectorAll('button[data-kind]')){
  button.addEventListener('pointerdown',event=>{if(event.button!==0||editDrag||!editorCallbacks)return;event.preventDefault();event.stopPropagation();const kind=button.dataset.kind,start=editorCallbacks.getState(),anchor=editorAnchors()[kind],axis=['wall','distance'].includes(kind)?new THREE.Vector3(.5,0,0):new THREE.Vector3(0,.5,0),a=screenPoint(anchor),b=screenPoint(anchor.clone().add(axis)),dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy));editDrag={kind,start,x:event.clientX,y:event.clientY,axisX:dx/length,axisY:dy/length,pixelsPerWorld:length/.5,value:kind==='width'?start.width:kind==='separation'?start.separation:{wall:start.wall,distance:start.distance,height:start.height},running:editorCallbacks.pause()};controls.enabled=false;button.setPointerCapture(event.pointerId);});
  button.addEventListener('pointermove',event=>{if(!editDrag||editDrag.kind!==button.dataset.kind)return;const scalar=(event.clientX-editDrag.x)*editDrag.axisX+(event.clientY-editDrag.y)*editDrag.axisY,worldDelta=scalar/editDrag.pixelsPerWorld;editDrag.scalar=scalar;editDrag.value=editorValue(editDrag.kind,editDrag.start,worldDelta);const value=editor.querySelector('output');value.hidden=false;value.textContent=editDrag.kind==='width'?`Slit width: ${editDrag.value} nm`:editDrag.kind==='separation'?`Slit separation: ${editDrag.value} nm`:editDrag.kind==='height'?`Screen length: ${editDrag.value.height} nm`:editDrag.kind==='wall'?`Slit wall: ${editDrag.value.wall} nm`:`Detector distance: ${editDrag.value.distance} nm`;positionEditor();editorCallbacks.preview(editDrag.kind,editDrag.value);});
  button.addEventListener('pointerup',()=>finishEditor(true));button.addEventListener('pointercancel',()=>finishEditor(false));button.addEventListener('lostpointercapture',()=>finishEditor(false));
 }
 function configureEditor(callbacks){editorCallbacks=callbacks;}
 function configureHeight(value,onChange){heightSelect.value=value;heightChange=onChange;}
 function setEditing(active){if(!active)finishEditor(false);editor.hidden=!active;controls.enabled=!active;positionEditor();}
 function dispose(){cancelAnimationFrame(frame);observer.disconnect();controls.dispose();while(dynamic.children.length)disposeObject(dynamic.children[0]);renderer.dispose();renderer.domElement.remove();overlay.remove();editor.remove();}
 setVisible(false);
 return {update,setVisible,resetCamera,capture,projectDetector,configureEditor,configureHeight,setEditing,cancelEditor:()=>finishEditor(false),dispose};
}
