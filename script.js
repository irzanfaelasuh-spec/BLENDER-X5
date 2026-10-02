import*as T from'three';
import{OrbitControls}from'three/addons/controls/OrbitControls.js';
import{TransformControls}from'three/addons/controls/TransformControls.js';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{GLTFExporter}from'three/addons/exporters/GLTFExporter.js';
import{OBJLoader}from'three/addons/loaders/OBJLoader.js';
import{OBJExporter}from'three/addons/exporters/OBJExporter.js';

const $=s=>document.querySelector(s),el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const ease=p=>1+2.70158*Math.pow(p-1,3)+1.70158*Math.pow(p-1,2);
const P={name:'MyProject',handle:null,named:false,state:'New Project'};
let S=null,H=[],hi=-1,saved=null,forceDirty=false,anim={dur:5,keys:{}},tm=0,playing=false,fx=[],moved=false,helpers=[],last=performance.now(),fc=0,ft=last,fps=60,camMode=false,camView=null,gridOn=true,snapOn=false;

/* ---------- Viewport ---------- */
const vp=$('#vp'),R=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.toneMapping=T.ACESFilmicToneMapping;R.autoClear=true;
vp.prepend(R.domElement);
const scene=new T.Scene(),root=new T.Group(),aux=new T.Group();scene.add(root,aux);scene.background=new T.Color('#25272b');
const cam=new T.PerspectiveCamera(50,1,.1,500);cam.position.set(6,5,8);
const orbit=new OrbitControls(cam,R.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.target.set(0,.5,0);
const ax=(v,c)=>new T.Line(new T.BufferGeometry().setFromPoints([v.clone().multiplyScalar(-20),v.clone().multiplyScalar(20)]),new T.LineBasicMaterial({color:c,transparent:true,opacity:.75}));
aux.add(new T.GridHelper(40,40,0x4a4d55,0x30323a),ax(new T.Vector3(1,0,0),0xe5484d),ax(new T.Vector3(0,1,0),0x46c46a),ax(new T.Vector3(0,0,1),0x4d8df7));
const tc=new TransformControls(cam,R.domElement);tc.setSize(innerWidth<820?1.4:1);scene.add(tc);
tc.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(!e.value&&moved){moved=false;commit()}});
tc.addEventListener('objectChange',()=>{moved=true;syncProps();dirtyMark()});
const sel=new T.BoxHelper(new T.Object3D(),0xe87d0d);sel.material.transparent=true;sel.material.depthTest=false;sel.visible=false;aux.add(sel);
R.domElement.style.touchAction='none';
new ResizeObserver(()=>{const w=vp.clientWidth,h=vp.clientHeight;if(!w||!h)return;R.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix()}).observe(vp);

/* ---------- Helpers: tween, toast, modal ---------- */
const tween=(d,f,end)=>fx.push({t:performance.now(),d,f,end});
function toast(m,t='ok'){const d=el('div','toast '+t,m);$('#toasts').append(d);setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),320)},2600)}
const ask=(msg,btns,input)=>new Promise(r=>{const d=$('#modal'),b=$('#mb'),i=$('#mi');$('#mm').textContent=msg;i.hidden=input==null;if(input!=null)i.value=input;b.replaceChildren();
  btns.forEach((t,k)=>{const x=el('button',k?'':'pri',t);x.onclick=()=>{d.classList.remove('on');r({i:k,v:i.value})};b.append(x)});d.classList.add('on');setTimeout(()=>input!=null?i.select():b.firstChild.focus(),60)});
const dl=(b,n)=>{const a=el('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
const clean=s=>s.replace(/[\\/:*?"<>|]+/g,'').trim()||'MyProject';
const dispose=o=>o.traverse(c=>{c.geometry&&c.geometry.dispose();[].concat(c.material||[]).forEach(m=>m.dispose())});
const find=id=>root.getObjectByProperty('uuid',id);

/* ---------- Objects ---------- */
const G={Cube:()=>new T.BoxGeometry(1,1,1),Sphere:()=>new T.SphereGeometry(.6,48,32),Cylinder:()=>new T.CylinderGeometry(.5,.5,1.2,48),Cone:()=>new T.ConeGeometry(.6,1.2,48),Plane:()=>new T.PlaneGeometry(2,2),Torus:()=>new T.TorusGeometry(.6,.22,24,64)};
const uniq=b=>{let n=b,i=1;while(root.children.some(c=>c.name===n))n=b+'.'+String(i++).padStart(3,'0');return n};
function mesh(k,name){const m=new T.Mesh(G[k](),new T.MeshStandardMaterial({color:'#b9bdc7',metalness:.1,roughness:.55,side:k=='Plane'?2:0}));m.name=uniq(name||k);m.castShadow=m.receiveShadow=true;if(k=='Plane')m.rotation.x=-Math.PI/2;else m.position.y=.6;return m}
function light(t){const l=t=='Ambient'?new T.AmbientLight('#ffffff',.5):t=='Directional'?new T.DirectionalLight('#ffffff',2.2):new T.PointLight('#ffd9b0',40,0,2);
  l.name=uniq(t+' Light');if(t=='Directional'){l.position.set(5,8,4);l.castShadow=true;l.shadow.mapSize.set(1024,1024);Object.assign(l.shadow.camera,{left:-8,right:8,top:8,bottom:-8});l.shadow.camera.updateProjectionMatrix()}else if(t=='Point')l.position.set(-4,3,2);return l}
function camera(){const c=new T.PerspectiveCamera(45,16/9,.1,100);c.name=uniq('Camera');c.position.copy(cam.position);c.quaternion.copy(cam.quaternion);if(!root.children.some(o=>o.isCamera&&o.userData.active))c.userData.active=true;return c}
function ring(p){const m=new T.Mesh(new T.RingGeometry(.4,.45,64),new T.MeshBasicMaterial({color:0xe87d0d,transparent:true,depthWrite:false,side:2}));m.rotation.x=-Math.PI/2;m.position.set(p.x,.02,p.z);aux.add(m);
  tween(750,k=>{m.scale.setScalar(1+k*4);m.material.opacity=.9*(1-k)},()=>{aux.remove(m);m.geometry.dispose();m.material.dispose()})}
function add(o){root.add(o);rebuild();const s=o.scale.clone();o.scale.multiplyScalar(.001);ring(o.position);
  tween(450,p=>o.scale.copy(s).multiplyScalar(Math.max(ease(p),.001)),()=>{o.scale.copy(s);commit()});select(o)}
const addMesh=k=>add(mesh(k));
function rebuild(){helpers.forEach(h=>{aux.remove(h);h.dispose&&h.dispose()});helpers=[];
  root.children.forEach(o=>{const h=o.isDirectionalLight?new T.DirectionalLightHelper(o,1.2):o.isPointLight?new T.PointLightHelper(o,.25):o.isCamera?new T.CameraHelper(o):null;if(h){helpers.push(h);aux.add(h)}});rows()}
function clearRoot(){tc.detach();[...root.children].forEach(c=>{root.remove(c);dispose(c)})}
function del(){if(!S)return;const o=S;select(null);root.remove(o);dispose(o);delete anim.keys[o.uuid];rebuild();commit()}
async function clearScene(){if(!root.children.length){toast('Nothing to clear.','warn');return}
  const r=await ask('Clear the whole scene? Every object will be removed.',['Clear','Cancel']);if(r.i)return;select(null);clearRoot();anim={dur:5,keys:{}};rebuild();commit();toast('Scene cleared.')}

/* ---------- Camera mode / cloning / viewport utilities ---------- */
function activeCamera(){return root.children.find(o=>o.isCamera&&o.userData.active&&o.visible)||root.children.find(o=>o.isCamera&&o.visible)||null}
function enterCameraMode(){const c=S&&S.isCamera&&S.visible?S:activeCamera();if(!c){toast('Add or select a camera first.','warn');return}if(S!==c)select(c);camView=c;camMode=true;document.body.classList.add('camera-mode');orbit.enabled=false;tc.detach();const nm=$('#camName');if(nm)nm.textContent=c.name;toast('Camera Mode · live scene camera')}
function exitCameraMode(){if(!camMode)return;camMode=false;camView=null;document.body.classList.remove('camera-mode');orbit.enabled=!tc.dragging;if(S&&S.visible)tc.attach(S);toast('Camera Mode closed.')}
function cloneMaterial(m){if(!m)return m;if(Array.isArray(m))return m.map(x=>x&&x.clone?x.clone():x);return m.clone?m.clone():m}
function cloneSelected(){if(!S){toast('Select an object to clone.','warn');return}const source=S,c=source.clone(true);c.name=uniq(source.name+' Copy');c.position.copy(source.position);c.position.x+=Math.max(.65,Math.abs(source.scale.x)*.75);c.position.z+=Math.max(.35,Math.abs(source.scale.z)*.35);c.userData={...source.userData};if(c.isCamera)c.userData.active=false;c.traverse(n=>{if(n.material)n.material=cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});root.add(c);const keys=anim.keys[source.uuid];if(keys&&keys.length)anim.keys[c.uuid]=keys.map(k=>({t:k.t,p:[...k.p],r:[...k.r],s:[...k.s]}));rebuild();select(c);markers();ring(c.position);commit();toast('Cloned '+source.name+' → '+c.name)}
function toggleGrid(){gridOn=!gridOn;aux.children.forEach(o=>{if(o.type==='GridHelper'||o.isGridHelper)o.visible=gridOn;else if(o.isLine)o.visible=gridOn});toast(gridOn?'Grid & axes enabled.':'Grid & axes hidden.','warn')}
function toggleSnap(){snapOn=!snapOn;tc.translationSnap=snapOn?.25:null;tc.rotationSnap=snapOn?Math.PI/12:null;tc.scaleSnap=snapOn?.1:null;toast(snapOn?'Snap enabled · 0.25 / 15° / 0.1':'Snap disabled.')}
function cameraForShot(){return activeCamera()||cam}

/* ---------- Selection ---------- */
function select(o){S=o||null;if(camMode)tc.detach();else if(S&&S.visible)tc.attach(S);else tc.detach();sel.visible=!!(S&&S.visible&&(S.isMesh||S.isGroup));rows();syncProps();markers()}
const rc=new T.Raycaster(),m2=new T.Vector2();let dn=null;
R.domElement.addEventListener('pointerdown',e=>{dn=tc.axis?null:[e.clientX,e.clientY]});
R.domElement.addEventListener('pointerup',e=>{if(!dn||tc.dragging)return;if(Math.hypot(e.clientX-dn[0],e.clientY-dn[1])>5)return;
  const b=R.domElement.getBoundingClientRect();m2.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);rc.setFromCamera(m2,cam);
  const h=rc.intersectObjects(root.children.filter(o=>o.visible&&!o.isLight&&!o.isCamera),true)[0];let o=h&&h.object;while(o&&o.parent!==root)o=o.parent;select(o||null);dn=null});
function setMode(m){tc.setMode(m);document.querySelectorAll('#tools [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m==m))}
function focus(){if(!S)return;let b=new T.Box3().setFromObject(S);if(b.isEmpty())b.setFromCenterAndSize(S.position,new T.Vector3(1,1,1));
  const c=b.getCenter(new T.Vector3()),r=Math.max(b.getSize(new T.Vector3()).length(),1),p0=cam.position.clone(),t0=orbit.target.clone(),d=p0.clone().sub(t0).normalize().multiplyScalar(r*1.8);
  tween(500,k=>{k=1-Math.pow(1-k,3);orbit.target.lerpVectors(t0,c,k);cam.position.lerpVectors(p0,c.clone().add(d),k)})}

/* ---------- Outliner ---------- */
function rows(){const L=$('#outl');L.replaceChildren(el('h3','','Scene Collection'));
  root.children.forEach(o=>{const r=el('div','row'+(o===S?' on':'')+(o.visible?'':' off'));
    const mk=(t,f,ti)=>{const b=el('button','',t);b.title=ti;b.setAttribute('aria-label',ti);b.onclick=e=>{e.stopPropagation();f()};return b};
    r.append(el('i','ic',o.isLight?'✦':o.isCamera?'▷':'▣'),el('span','nm',o.name),mk('✎',()=>rename(o),'Rename'),
      mk(o.visible?'◉':'◌',()=>{o.visible=!o.visible;o===S?select(o):rows();commit()},'Show / Hide'),mk('✕',()=>{S=o;del()},'Delete'));
    r.onclick=()=>select(o);r.ondblclick=()=>rename(o);L.append(r)});
  $('#info').textContent=root.children.length+' objects · '+fps+' fps'}
async function rename(o){const r=await ask('Rename object',['OK','Cancel'],o.name);if(!r.i&&r.v.trim()){o.name=r.v.trim();rows();syncProps();commit()}}

/* ---------- Properties ---------- */
const n3=p=>[0,1,2].map(i=>`<input type="number" step="0.1" data-k="${p}${i}">`).join('');
const sl=(c,l,k,a,b,s)=>`<label class="r ${c}">${l}<input type="range" min="${a}" max="${b}" step="${s}" data-k="${k}"></label>`;
$('#props').innerHTML=`<p id="empty">Select an object to edit it.</p><div id="pp" hidden><input class="nm" data-k="nm"><h4>Location</h4><div class="g3">${n3('p')}</div><h4>Rotation (°)</h4><div class="g3">${n3('r')}</div><h4>Scale</h4><div class="g3">${n3('s')}</div><button id="cloneProp">Clone Selected</button><button class="c" id="viewCam">Enter Camera Mode</button>
<h4 class="ml">Material</h4><label class="r ml">Color<input type="color" data-k="col"></label><label class="r m">Emissive<input type="color" data-k="emi"></label>
${sl('m','Metalness','met',0,1,.01)}${sl('m','Roughness','rou',0,1,.01)}${sl('m','Opacity','opa',0,1,.01)}${sl('l','Intensity','int',0,10,.05)}${sl('c','FOV','fov',15,120,1)}<button class="c" id="act">Set as active camera</button></div>
<h4>World</h4><label class="r">Background<input type="color" data-k="bg" value="#25272b"></label>`;
const pr=$('#props');
pr.addEventListener('input',e=>{const k=e.target.dataset.k,v=e.target.value;if(!k)return;if(k=='bg'){scene.background.set(v);dirtyMark();return}
  const o=S;if(!o||v==='')return;const f=+v,q=/^([prs])([012])$/.exec(k);
  if(q){const i=+q[2];if(q[1]=='p')o.position.setComponent(i,f);else if(q[1]=='r')o.rotation['xyz'[i]]=f*Math.PI/180;else o.scale.setComponent(i,f)}
  else if(k=='nm'){o.name=v;rows()}else if(k=='col')(o.material||o).color.set(v);else if(k=='emi'&&o.material.emissive)o.material.emissive.set(v);
  else if(k=='met')o.material.metalness=f;else if(k=='rou')o.material.roughness=f;else if(k=='opa'){o.material.opacity=f;o.material.transparent=f<1}
  else if(k=='int')o.intensity=f;else if(k=='fov'){o.fov=f;o.updateProjectionMatrix()}dirtyMark()});
pr.addEventListener('change',()=>commit());
$('#act').onclick=()=>{if(!S||!S.isCamera)return;root.children.forEach(o=>{if(o.isCamera)o.userData.active=false});S.userData.active=true;commit();toast('Active camera set.')};
$('#viewCam').onclick=()=>{if(S&&S.isCamera)enterCameraMode()};
$('#cloneProp').onclick=cloneSelected;
function syncProps(){const pp=$('#pp'),o=S;$('#empty').hidden=!!o;pp.hidden=!o;if(!o)return;pp.dataset.t=o.isMesh?'mesh':o.isLight?'light':o.isCamera?'cam':'grp';
  const set=(k,v)=>{const i=pp.querySelector(`[data-k="${k}"]`);if(i&&document.activeElement!==i)i.value=v},m=o.material,r=[o.rotation.x,o.rotation.y,o.rotation.z];
  [0,1,2].forEach(i=>{set('p'+i,+o.position.getComponent(i).toFixed(3));set('r'+i,+(r[i]*180/Math.PI).toFixed(2));set('s'+i,+o.scale.getComponent(i).toFixed(3))});set('nm',o.name);
  if(m&&m.color){set('col','#'+m.color.getHexString());if(m.emissive)set('emi','#'+m.emissive.getHexString());set('met',m.metalness??0);set('rou',m.roughness??1);set('opa',m.opacity)}
  if(o.isLight){set('col','#'+o.color.getHexString());set('int',o.intensity)}if(o.isCamera)set('fov',o.fov)}

/* ---------- History / project state ---------- */
const snap=()=>JSON.stringify({s:root.toJSON(),a:anim,sel:S&&S.uuid});
const isDirty=()=>forceDirty||H[hi]!==saved;
function refresh(){const d=isDirty();document.title=P.name+(d?'*':'')+' — Mini Blender';$('#ptitle').textContent=P.name+(d?' ●':'');$('#st').textContent=d?'Unsaved Changes':P.state;$('#stat').classList.toggle('dirty',d)}
function commit(){forceDirty=false;const s=snap();if(H[hi]!==s){H=H.slice(0,hi+1);H.push(s);if(H.length>80)H.shift();hi=H.length-1}refresh()}
const dirtyMark=()=>{forceDirty=true;refresh()};
function restore(s){const o=JSON.parse(s),g=new T.ObjectLoader().parse(o.s);clearRoot();[...g.children].forEach(c=>root.add(c));anim=o.a;rebuild();select(o.sel&&find(o.sel));forceDirty=false;refresh()}
const undo=()=>{if(hi>0){hi--;restore(H[hi])}else toast('Nothing to undo.','warn')};
const redo=()=>{if(hi<H.length-1){hi++;restore(H[hi])}else toast('Nothing to redo.','warn')};

/* ---------- Project: new / save / open ---------- */
function reset(){exitCameraMode();clearRoot();anim={dur:5,keys:{}};tm=0;Object.assign(P,{name:'MyProject',handle:null,named:false,state:'New Project'});scene.background.set('#25272b');
  const fl=mesh('Plane','Floor');fl.scale.setScalar(8);fl.material.color.set('#2f3237');fl.material.roughness=.9;
  const cb=mesh('Cube'),c=camera();c.position.set(4,3,6);c.lookAt(0,.5,0);root.add(fl,cb,light('Ambient'),light('Directional'),light('Point'),c);
  H=[];hi=-1;rebuild();select(null);commit();saved=H[0];refresh();markers()}
async function guard(msg){if(!isDirty())return true;const r=await ask(msg,['Save',"Don't Save",'Cancel']);if(r.i==2)return false;if(r.i==0){await save();if(isDirty())return false}return true}
async function newProj(){if(await guard('You have unsaved changes. Save before creating a new project?')){reset();try{localStorage.removeItem('mb_recover')}catch{}toast('New project created.')}}
const pack=()=>JSON.stringify({app:'MiniBlender',v:1,name:P.name,scene:root.toJSON(),anim,bg:'#'+scene.background.getHexString(),cam:{p:cam.position.toArray(),t:orbit.target.toArray(),fov:cam.fov}});
const recents=()=>{try{return JSON.parse(localStorage.getItem('mb_recent'))||[]}catch{return[]}};
function addRecent(name,data){const l=recents().filter(r=>r.name!==name);l.unshift({name,time:Date.now(),data});l.length=Math.min(l.length,5);
  try{localStorage.setItem('mb_recent',JSON.stringify(l))}catch{try{localStorage.setItem('mb_recent',JSON.stringify(l.map(r=>({name:r.name,time:r.time}))))}catch{}}}
async function save(as){if(!root.children.length){toast('Nothing to save.','warn');return}
  try{if(window.showSaveFilePicker&&(as||!P.handle)){P.handle=await showSaveFilePicker({suggestedName:P.name+'.json',types:[{description:'Mini Blender project',accept:{'application/json':['.json']}}]});P.name=clean(P.handle.name.replace(/\.json$/i,''))}
    else if(!window.showSaveFilePicker&&(as||!P.named)){const r=await ask('Save project as',['Save','Cancel'],P.name);if(r.i)return;P.name=clean(r.v)}
    $('#st').textContent='Saving...';const data=pack();
    if(P.handle){const w=await P.handle.createWritable();await w.write(data);await w.close()}else dl(new Blob([data],{type:'application/json'}),P.name+'.json');
    P.named=true;P.state='Saved';saved=H[hi];forceDirty=false;addRecent(P.name,data);try{localStorage.removeItem('mb_recover')}catch{}refresh();toast('Project saved successfully.')
  }catch(e){refresh();if(e&&e.name!=='AbortError')toast('Failed to save project.','err')}}
function loadProject(j,name){const g=new T.ObjectLoader().parse(j.scene);clearRoot();[...g.children].forEach(c=>root.add(c));anim=j.anim||{dur:5,keys:{}};tm=0;
  if(j.bg)scene.background.set(j.bg);if(j.cam){cam.position.fromArray(j.cam.p);orbit.target.fromArray(j.cam.t);cam.fov=j.cam.fov||50;cam.updateProjectionMatrix()}
  Object.assign(P,{name:clean(name||j.name||'Project'),handle:null,named:true,state:'Loaded'});H=[];hi=-1;rebuild();select(null);commit();saved=H[0];refresh();markers()}
function parseProject(txt){let j;try{j=JSON.parse(txt)}catch{throw'The file is not valid JSON.'}if(!j||j.app!=='MiniBlender'||!j.scene||!j.scene.object)throw'Unsupported file format.';return j}
async function openFile(f,txt,quiet){$('#st').textContent='Loading...';try{const raw=txt??await f.text(),j=parseProject(raw);loadProject(j,f?f.name.replace(/\.json$/i,''):j.name);addRecent(P.name,raw);toast('Project loaded successfully.')}
  catch(e){refresh();toast(typeof e=='string'?e:'Failed to load project.','err')}}
const file=$('#file');
function pickFile(acc,fn){file.accept=acc;file.onchange=()=>{const f=file.files[0];file.value='';f&&fn(f)};file.click()}
async function openDlg(){if(await guard('You have unsaved changes. Save before opening another project?'))pickFile('.json,application/json',f=>openFile(f))}

/* ---------- Import / Export ---------- */
async function importFile(f){const ext=f.name.split('.').pop().toLowerCase(),nm=f.name.replace(/\.[^.]+$/,'');$('#st').textContent='Loading...';
  try{let items;
    if(ext=='glb'||ext=='gltf')items=[(await new GLTFLoader().parseAsync(ext=='glb'?await f.arrayBuffer():await f.text(),'')).scene];
    else if(ext=='obj')items=[new OBJLoader().parse(await f.text())];
    else if(ext=='json'){let j;try{j=JSON.parse(await f.text())}catch{throw'The file is not valid JSON.'}const sj=j&&j.scene&&j.scene.object?j.scene:j&&j.object?j:null;if(!sj)throw'Unsupported file format.';
      const o=new T.ObjectLoader().parse(sj);items=o.type=='Group'||o.type=='Scene'?[...o.children]:[o]}
    else throw'Unsupported file format.';
    items.forEach((o,i)=>{if(ext!='json'){o.name=uniq(nm);const sz=new T.Box3().setFromObject(o).getSize(new T.Vector3()).length();if(sz>12||(sz>0&&sz<.2))o.scale.setScalar(4/sz);o.traverse(c=>{if(c.isMesh)c.castShadow=c.receiveShadow=true})}else o.name=uniq(o.name||'Object');root.add(o);ring(o.position)});
    rebuild();select(items[items.length-1]);commit();toast('Import completed.')}
  catch(e){refresh();toast(typeof e=='string'?e:'Failed to import file.','err')}}
function expGroup(){const g=new T.Group();root.children.filter(o=>o.visible&&(o.isMesh||o.isGroup)).forEach(o=>g.add(o.clone()));g.updateMatrixWorld(true);return g}
async function exportAs(t){const g=expGroup();if(!g.children.length){toast('Nothing to export.','warn');return}
  try{const n=P.name;if(t=='obj')dl(new Blob([new OBJExporter().parse(g)],{type:'text/plain'}),n+'.obj');else if(t=='json')dl(new Blob([pack()],{type:'application/json'}),n+'.json');
    else{const r=await new Promise((ok,no)=>new GLTFExporter().parse(g,ok,no,{binary:t=='glb'}));dl(t=='glb'?new Blob([r],{type:'model/gltf-binary'}):new Blob([JSON.stringify(r)],{type:'model/gltf+json'}),n+'.'+t)}
    toast('Export completed.')}catch(e){toast('Export failed.','err')}}
function shot(){const v=[aux.visible,tc.visible],shotCam=cameraForShot();aux.visible=tc.visible=false;R.setScissorTest(false);R.setViewport(0,0,vp.clientWidth,vp.clientHeight);R.render(scene,shotCam);
  R.domElement.toBlob(b=>{dl(b,P.name+'.png');toast('Export completed.')});aux.visible=v[0];tc.visible=v[1]}

/* ---------- Animation ---------- */
function sample(){for(const id in anim.keys){const o=find(id),k=anim.keys[id];if(!o||!k.length)continue;let a=k[0],b=a;
  if(tm>=k[k.length-1].t)a=b=k[k.length-1];else for(let i=0;i<k.length-1;i++)if(tm>=k[i].t&&tm<k[i+1].t){a=k[i];b=k[i+1];break}
  const f=a===b?0:(tm-a.t)/(b.t-a.t),L=(x,y)=>x.map((v,i)=>v+(y[i]-v)*f);o.position.fromArray(L(a.p,b.p));o.rotation.set(...L(a.r,b.r));o.scale.fromArray(L(a.s,b.s))}}
function ui(){$('#tr').value=tm;$('#tt').textContent=tm.toFixed(2)+'s';if(S)syncProps()}
function markers(){const tr=$('#tr'),k=$('#kfs');tr.max=anim.dur;$('#dur').value=anim.dur;k.replaceChildren();
  ((S&&anim.keys[S.uuid])||[]).forEach(x=>{const i=el('i');i.style.left=(x.t/anim.dur*100)+'%';k.append(i)})}
function addKey(){if(!S){toast('Select an object first.','warn');return}const k=anim.keys[S.uuid]||(anim.keys[S.uuid]=[]),t=+tm.toFixed(2),n={t,p:S.position.toArray(),r:[S.rotation.x,S.rotation.y,S.rotation.z],s:S.scale.toArray()},i=k.findIndex(x=>Math.abs(x.t-t)<.01);
  i<0?k.push(n):k[i]=n;k.sort((a,b)=>a.t-b.t);markers();commit();toast('Keyframe added.')}
$('#tr').oninput=e=>{tm=+e.target.value;sample();ui()};
$('#dur').onchange=e=>{anim.dur=Math.min(60,Math.max(1,+e.target.value||5));tm=Math.min(tm,anim.dur);markers();ui()};
$('#tl').onclick=e=>{const a=e.target.dataset.t;if(a=='key')addKey();else if(a=='play'){if(tm>=anim.dur)tm=0;playing=true}else if(a=='pause')playing=false;else if(a=='stop'){playing=false;tm=0;sample();ui()}};

/* ---------- Help ---------- */
const HELP=[['Navigation','Drag empty space to orbit. Pinch / wheel zooms. Pan with the usual two-finger / middle-button gesture.'],['Select','Tap/click an object in the viewport or choose it from the Outliner. Cameras and lights are easiest to select from the Outliner.'],['Move','Use the Move gizmo or press G on desktop. Drag the colored axis handles to move on one axis.'],['Rotate','Use the Rotate gizmo or press R. The three rings control X, Y and Z rotation.'],['Scale','Use the Scale gizmo or press S. Drag a handle to resize the selected object.'],['Clone','Select an object, then press Shift+D on PC/laptop or tap the Clone button on mobile. The clone gets its own materials and copied animation keys.'],['Focus','Press F or tap Focus to smoothly frame the selected object.'],['Camera Mode','Select a camera and tap Camera Mode, or use the Camera button. The viewport becomes a fullscreen live render from that actual scene camera.'],['Camera Animation','A camera is a normal animated scene object. Keyframe its transform, press Play, then enter Camera Mode—the view follows the animated camera.'],['Set Active Camera','Select a camera and use “Set as active camera” in Properties. The active camera is also shown in the small Camera preview.'],['Keyframe','Move the timeline to a time, select an object, then press ◆ Key. Location, rotation and scale are stored together.'],['Timeline','Drag the timeline to preview animation. ▶ plays, ❚❚ pauses, and ■ returns to frame 0. Length controls the animation duration.'],['Outliner','The right panel lists every scene object. ◉ toggles visibility, ✎ renames, and ✕ deletes. Double-click a row to rename.'],['Properties','Edit exact Location, Rotation, Scale, material color, emissive, metalness, roughness, opacity, light intensity, camera FOV and world background.'],['Grid','Toggle the viewport grid and XYZ axes when you want a cleaner preview.'],['Snap','Snap gives predictable transform increments: 0.25 units, 15° rotation and 0.1 scale.'],['Undo / Redo','Ctrl+Z / Ctrl+Y on desktop, or use the toolbar buttons. Project history stores many scene changes.'],['Save / Open','Save creates a Mini Blender JSON project. Open restores the scene, animation and editor camera state.'],['Import / Export','Import GLTF, GLB, OBJ or JSON scenes. Export GLTF, GLB, OBJ, JSON or a PNG screenshot.'],['Mobile UI','On small screens the Properties / Outliner panel becomes a bottom sheet. The toolbar buttons replace desktop shortcuts.'],['Escape','Esc closes Help and exits Camera Mode. In dialogs it cancels the current action.']];
function openHelp(){const h=$('#help'),g=$('#helpGrid');if(!g)return;g.replaceChildren(...HELP.map(([a,b])=>{const c=el('article','helpCard');c.innerHTML='<h4></h4><p></p>';c.querySelector('h4').textContent=a;c.querySelector('p').textContent=b;return c}));h.classList.add('on')}
function closeHelp(){$('#help').classList.remove('on')}

/* ---------- Menus & toolbar ---------- */
const M={
  File:()=>[['New',newProj,'Ctrl+N'],['Open…',openDlg,'Ctrl+O'],['Save',()=>save(),'Ctrl+S'],['Save As…',()=>save(true),'Ctrl+Shift+S']],
  Add:()=>[...Object.keys(G).map(k=>[k,()=>addMesh(k)]),0,['Point Light',()=>add(light('Point'))],['Directional Light',()=>add(light('Directional'))],['Ambient Light',()=>add(light('Ambient'))],0,['Camera',()=>add(camera())]],
  Edit:()=>[['Undo',undo,'Ctrl+Z'],['Redo',redo,'Ctrl+Y'],0,['Clone',cloneSelected,'Shift+D'],['Focus',focus,'F'],['Delete',del,'Del'],0,['Grid',toggleGrid],['Snap',toggleSnap],['Clear Scene',clearScene]],
  Import:()=>[['GLTF',()=>pickFile('.gltf',importFile)],['GLB',()=>pickFile('.glb',importFile)],['OBJ',()=>pickFile('.obj',importFile)],['JSON Scene',()=>pickFile('.json,application/json',importFile)]],
  Export:()=>[['GLTF',()=>exportAs('gltf')],['GLB',()=>exportAs('glb')],['OBJ',()=>exportAs('obj')],['JSON',()=>exportAs('json')],['Screenshot PNG',shot]],
  View:()=>[['Camera Mode',enterCameraMode,'Numpad 0'],['Exit Camera Mode',exitCameraMode,'Esc'],['Grid',toggleGrid],['Snap',toggleSnap]],
  Help:()=>[['Open Help',openHelp,'?']],
  Recent:()=>{const l=recents();return l.length?l.map(r=>[r.name+'  ·  '+new Date(r.time).toLocaleString([],{dateStyle:'short',timeStyle:'short'}),async()=>{if(!await guard('You have unsaved changes. Save before opening another project?'))return;
    if(r.data)openFile(null,r.data);else toast('Project data is no longer available.','warn')}]):[['No recent projects',()=>{}]]}};
const closeM=()=>document.querySelectorAll('.mn.on').forEach(m=>m.classList.remove('on'));
Object.keys(M).forEach(n=>{const w=el('div','mn'),b=el('button','',n),d=el('div','dd');
  b.onclick=()=>{const was=w.classList.contains('on');closeM();if(was)return;d.replaceChildren();M[n]().forEach(i=>{if(!i){d.append(el('hr'));return}const x=el('button','',i[0]);if(i[2])x.append(el('kbd','',i[2]));x.onclick=()=>{closeM();i[1]()};d.append(x)});
    d.style.left=Math.max(4,Math.min(b.getBoundingClientRect().left,innerWidth-230))+'px';w.classList.add('on')};
  w.append(b,d);$('#menus').append(w)});
addEventListener('pointerdown',e=>{if(!e.target.closest('.mn'))closeM()});
[['translate','✥','Move (G)'],['rotate','↻','Rotate (R)'],['scale','⤢','Scale (S)']].forEach(([m,t,ti])=>{const b=el('button','',t);b.dataset.m=m;b.title=ti;b.setAttribute('aria-label',ti);b.onclick=()=>setMode(m);$('#tools').append(b)});
$('#tools').append(el('hr'));
[['▣','Clone (Shift+D)',cloneSelected],['◎','Focus (F)',focus],['▷','Camera Mode (Numpad 0)',enterCameraMode],['⌗','Grid',toggleGrid],['⊙','Snap',toggleSnap],['↶','Undo (Ctrl+Z)',undo],['↷','Redo (Ctrl+Y)',redo],['🗑','Delete (Del)',del],['?','Help (?)',openHelp]].forEach(([t,ti,f])=>{const b=el('button','',t);b.title=ti;b.setAttribute('aria-label',ti);b.onclick=f;$('#tools').append(b)});
$('#ptog').onclick=()=>document.body.classList.toggle('sheet');

/* ---------- Keyboard ---------- */
addEventListener('keydown',e=>{
  const m=$('#modal');
  if(m.classList.contains('on')){if(e.key=='Escape'){e.preventDefault();$('#mb').lastChild.click()}else if(e.key=='Enter'&&e.target.id=='mi'){e.preventDefault();$('#mb').firstChild.click()}return}
  if($('#help').classList.contains('on')){if(e.key=='Escape'||e.key=='?'){e.preventDefault();closeHelp()}return}
  if(camMode&&(e.key=='Escape'||e.key.toLowerCase()=='x'||e.key=='0'&&e.location===3)){e.preventDefault();exitCameraMode();return}
  const k=e.key.toLowerCase(),c=e.ctrlKey||e.metaKey,inF=/INPUT|TEXTAREA/.test(e.target.tagName)&&e.target.type!='range';
  if(c){if(k=='s'){e.preventDefault();save(e.shiftKey)}else if(k=='o'){e.preventDefault();openDlg()}else if(k=='n'){e.preventDefault();newProj()}
    else if(!inF&&k=='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(!inF&&k=='y'){e.preventDefault();redo()}return}
  if(inF)return;
  if(k=='g')setMode('translate');else if(k=='r')setMode('rotate');else if(k=='s')setMode('scale');else if(k=='f')focus();else if(k=='delete'||k=='backspace')del();
  else if(k=='?'||k=='f1'){e.preventDefault();openHelp()}else if(k=='d'&&e.shiftKey){e.preventDefault();cloneSelected()}else if(k=='0'&&e.location===3){e.preventDefault();camMode?exitCameraMode():enterCameraMode()}
});

/* ---------- Overlay wiring ---------- */
$('#helpClose').onclick=closeHelp;
$('#help').addEventListener('pointerdown',e=>{if(e.target.id==='help')closeHelp()});
$('#camExit').onclick=exitCameraMode;
$('#pv').onclick=enterCameraMode;
/* ---------- Autosave & errors ---------- */
const stash=()=>{if(isDirty()&&root.children.length){try{localStorage.setItem('mb_recover',pack())}catch{}}};
setInterval(stash,60000);
addEventListener('beforeunload',e=>{if(isDirty()){stash();e.preventDefault();e.returnValue=''}});
addEventListener('error',()=>toast('Something went wrong.','err'));
addEventListener('unhandledrejection',()=>toast('Something went wrong.','err'));

/* ---------- Render loop ---------- */
function draw(){
  const w=Math.max(1,vp.clientWidth),h=Math.max(1,vp.clientHeight),ac=activeCamera(),pv=$('#pv');
  if(camMode&&ac){ac.aspect=w/h;ac.updateProjectionMatrix();pv.style.display='none';R.setScissorTest(false);R.setViewport(0,0,w,h);R.render(scene,ac);const read=$('#camReadout');if(read)read.textContent=Math.round(ac.fov)+'mm · '+tm.toFixed(2)+'s';const nm=$('#camName');if(nm)nm.textContent=ac.name;return}
  R.setScissorTest(false);R.setViewport(0,0,w,h);R.render(scene,cam);pv.style.display=ac?'block':'none';
  if(ac){const pw=innerWidth<820?132:200,ph=Math.round(pw*9/16),tv=tc.visible;ac.aspect=pw/ph;ac.updateProjectionMatrix();aux.visible=tc.visible=false;R.setScissorTest(true);R.setViewport(12,12,pw,ph);R.setScissor(12,12,pw,ph);R.render(scene,ac);R.setScissorTest(false);aux.visible=true;tc.visible=tv}}

function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1e3,.1);last=now;
  fx=fx.filter(a=>{const p=Math.min((now-a.t)/a.d,1);a.f(p);if(p>=1){a.end&&a.end();return false}return true});
  if(playing){tm+=dt;if(tm>anim.dur)tm=0;sample();ui()}
  orbit.update();if(S&&sel.visible){sel.setFromObject(S);sel.material.opacity=.7+.3*Math.sin(now/260)}
  helpers.forEach(h=>{h.update&&h.update();h.visible=(h.light||h.camera).visible});
  fc++;if(now-ft>500){fps=Math.round(fc*1000/(now-ft));fc=0;ft=now;$('#info').textContent=root.children.length+' objects · '+fps+' fps'}
  draw()}

setMode('translate');reset();requestAnimationFrame(loop);
try{const rec=localStorage.getItem('mb_recover');if(rec)ask('A recovery version of your project was found.',['Recover','Discard']).then(r=>{
  if(!r.i){try{loadProject(parseProject(rec));saved=null;refresh();toast('Project recovered.')}catch(e){toast('Failed to load project.','err')}}try{localStorage.removeItem('mb_recover')}catch{}})}catch{}

/* =====================================================================
   MINI BLENDER V2 FEATURE PACK
   Adds Blender-like workflow without replacing the existing core engine.
   ===================================================================== */
(()=>{
  const MB={local:false,hidden:new Map(),wire:false,rendered:false,autoKey:false,cursor:null,selectedBeforeLocal:null,frameRate:30,pivot:'median',space:'world',dof:false,bevel:false,search:null};
  window.MB2=MB;
  const q=s=>document.querySelector(s);
  const btn=(txt,title,fn)=>{const b=el('button','',txt);b.title=title;b.onclick=fn;return b};
  const notify=(m,t='ok')=>toast(m,t);

  /* ---------- Camera Mode cleanliness ---------- */
  const oldEnter=enterCameraMode,oldExit=exitCameraMode;
  // Keep original functions as the source of truth, then layer helper visibility on top.
  window.addEventListener('mb-camera-enter',()=>{});
  const hideEditorHelpers=()=>{
    aux.visible=false;
    tc.visible=false;
    sel.visible=false;
    $('#hint').style.display='none';
  };
  const restoreEditorHelpers=()=>{
    aux.visible=true;
    tc.visible=!!S&&!camMode;
    sel.visible=!!(S&&S.visible&&(S.isMesh||S.isGroup));
    $('#hint').style.display='';
  };
  // Patch the actual functions by replacing their source behavior through wrappers on UI events.
  $('#pv').addEventListener('click',()=>setTimeout(()=>{if(camMode)hideEditorHelpers()},0));
  $('#camExit').addEventListener('click',()=>setTimeout(()=>{if(!camMode)restoreEditorHelpers()},0));

  /* ---------- Fullscreen camera transport ---------- */
  const setPlaying=v=>{playing=v; q('#camPlay')?.classList.toggle('active',v);q('#camPause')?.classList.toggle('active',!v);};
  q('#camPlay')?.addEventListener('click',e=>{e.stopPropagation();if(tm>=anim.dur)tm=0;setPlaying(true);notify('Camera animation playing.')});
  q('#camPause')?.addEventListener('click',e=>{e.stopPropagation();setPlaying(false);notify('Animation paused.','warn')});
  q('#camStop')?.addEventListener('click',e=>{e.stopPropagation();setPlaying(false);tm=0;sample();ui();notify('Animation stopped at frame 1.','warn')});

  /* ---------- Better interpolation / frame readout ---------- */
  const smooth=t=>t*t*(3-2*t);
  const originalSample=sample;
  // Replace linear interpolation with smoothstep interpolation.
  sample=function(){
    for(const id in anim.keys){
      const o=find(id),k=anim.keys[id]; if(!o||!k.length)continue;
      let a=k[0],b=k[0];
      if(tm>=k[k.length-1].t)a=b=k[k.length-1];
      else for(let i=0;i<k.length-1;i++) if(tm>=k[i].t&&tm<k[i+1].t){a=k[i];b=k[i+1];break}
      const raw=a===b?0:(tm-a.t)/(b.t-a.t),f=smooth(Math.max(0,Math.min(1,raw)));
      const L=(x,y)=>x.map((v,i)=>v+(y[i]-v)*f);
      o.position.fromArray(L(a.p,b.p));o.rotation.set(...L(a.r,b.r));o.scale.fromArray(L(a.s,b.s));
    }
  };
  const oldUi=ui;
  ui=function(){oldUi();const frame=Math.max(1,Math.round(tm*MB.frameRate)+1);const f=q('#camFrame');if(f)f.textContent='F '+frame;const read=q('#camReadout');if(read&&camView)read.textContent=Math.round(camView.fov)+'mm · '+tm.toFixed(2)+'s';};

  /* ---------- Auto Keying ---------- */
  MB.autoKeyToggle=()=>{MB.autoKey=!MB.autoKey;notify(MB.autoKey?'Auto Keying enabled.':'Auto Keying disabled.',MB.autoKey?'ok':'warn');};
  const originalDirty=dirtyMark;
  const maybeAutoKey=()=>{if(MB.autoKey&&S){const k=anim.keys[S.uuid]||(anim.keys[S.uuid]=[]),t=+tm.toFixed(2),n={t,p:S.position.toArray(),r:[S.rotation.x,S.rotation.y,S.rotation.z],s:S.scale.toArray()};const i=k.findIndex(x=>Math.abs(x.t-t)<.01);i<0?k.push(n):k[i]=n;k.sort((a,b)=>a.t-b.t);markers();notify('Auto keyframe updated.');}};
  tc.addEventListener('objectChange',()=>maybeAutoKey());

  /* ---------- Visibility / local view ---------- */
  MB.toggleLocal=()=>{
    if(!S){notify('Select an object first.','warn');return}
    MB.local=!MB.local;
    if(MB.local){MB.hidden.clear();MB.selectedBeforeLocal=S;root.children.forEach(o=>{if(o!==S){MB.hidden.set(o,o.visible);o.visible=false}});notify('Local View: selected object only.');}
    else {MB.hidden.forEach((v,o)=>o.visible=v);MB.hidden.clear();notify('Local View restored.')}
    rebuild();
  };
  MB.hideSelected=()=>{if(!S){notify('Select an object first.','warn');return}S.visible=false;select(null);rebuild();commit();notify('Object hidden.','warn')};
  MB.showAll=()=>{root.traverse(o=>{o.visible=true});rebuild();notify('All objects visible.')};
  
  /* ---------- Render / viewport display modes ---------- */
  MB.toggleWire=()=>{MB.wire=!MB.wire;root.traverse(o=>{if(o.isMesh&&o.material)o.material.wireframe=MB.wire});notify(MB.wire?'Wireframe mode.':'Solid mode.')};
  MB.toggleRendered=()=>{MB.rendered=!MB.rendered;scene.background.set(MB.rendered?'#0b0c10':'#25272b');R.toneMappingExposure=MB.rendered?1.15:1;notify(MB.rendered?'Rendered preview lighting.':'Solid viewport background.')};
  MB.renderShot=()=>{shot();};
  
  /* ---------- Transform utilities ---------- */
  MB.applyScale=()=>{if(!S||!S.isMesh||!S.geometry){notify('Select a mesh first.','warn');return}S.updateMatrix();S.geometry.applyMatrix4(new T.Matrix4().makeScale(S.scale.x,S.scale.y,S.scale.z));S.scale.set(1,1,1);S.updateMatrix();commit();syncProps();notify('Scale applied.')};
  MB.resetTransform=()=>{if(!S){notify('Select an object first.','warn');return}S.position.set(0,S.isMesh&&S.name==='Floor'?0:0,0);S.rotation.set(0,0,0);S.scale.set(1,1,1);commit();syncProps();notify('Transform reset.','warn')};
  MB.toggleSpace=()=>{MB.space=MB.space==='world'?'local':'world';tc.setSpace(MB.space);notify('Transform space: '+MB.space+'.')};
  MB.togglePivot=()=>{MB.pivot=MB.pivot==='median'?'individual':'median';tc.setTranslationSnap(snapOn?.25:null);notify('Pivot: '+MB.pivot+'.')};
  
  /* ---------- 3D Cursor ---------- */
  MB.cursor=new T.Mesh(new T.RingGeometry(.18,.2,32),new T.MeshBasicMaterial({color:0xff5b8a,transparent:true,opacity:.9,depthTest:false,side:2}));
  MB.cursor.rotation.x=-Math.PI/2;MB.cursor.position.set(0,.025,0);MB.cursor.renderOrder=50;MB.cursor.visible=false;aux.add(MB.cursor);
  MB.cursorToSelected=()=>{if(!S){notify('Select an object first.','warn');return}MB.cursor.position.set(S.position.x,.025,S.position.z);MB.cursor.visible=true;notify('3D Cursor moved to selected object.')};
  MB.cursorCenter=()=>{MB.cursor.position.set(0,.025,0);MB.cursor.visible=true;notify('3D Cursor centered.')};
  
  /* ---------- Parenting ---------- */
  MB.parentSelected=async()=>{if(!S){notify('Select the child first.','warn');return}const names=root.children.filter(o=>o!==S).map(o=>o.name).join(', ');if(!names){notify('No possible parent object.','warn');return}const r=await ask('Type the parent object name:',['Parent','Cancel'],names.split(', ')[0]);if(r.i||!r.v)return;const p=root.children.find(o=>o.name===r.v.trim());if(!p){notify('Parent not found.','err');return}p.attach(S);commit();rebuild();notify(S.name+' parented to '+p.name+'.')};
  MB.clearParent=()=>{if(!S||!S.parent||S.parent===root){notify('Selected object has no parent.','warn');return}const w=S.parent;root.attach(S);commit();rebuild();notify('Parent cleared.')};
  
  /* ---------- Duplicate linked / Mirror ---------- */
  MB.linkedDuplicate=()=>{if(!S){notify('Select an object first.','warn');return}const c=S.clone(true);c.name=uniq(S.name+' Linked');c.position.x+=Math.max(.7,Math.abs(S.scale.x));c.userData={...S.userData};root.add(c);rebuild();select(c);commit();notify('Linked duplicate created.')};
  MB.mirrorX=()=>{if(!S){notify('Select an object first.','warn');return}S.scale.x*=-1;dirtyMark();commit();syncProps();notify('Mirror X applied.')};
  MB.mirrorY=()=>{if(!S){notify('Select an object first.','warn');return}S.scale.y*=-1;dirtyMark();commit();syncProps();notify('Mirror Y applied.')};
  MB.mirrorZ=()=>{if(!S){notify('Select an object first.','warn');return}S.scale.z*=-1;dirtyMark();commit();syncProps();notify('Mirror Z applied.')};
  
  /* ---------- Join / separate ---------- */
  MB.joinVisibleMeshes=()=>{const ms=root.children.filter(o=>o.isMesh&&o!==S&&o.visible);if(!S||!S.isMesh||!ms.length){notify('Select one mesh; other visible meshes will join into it.','warn');return}const target=S;ms.forEach(o=>{target.attach(o);o.visible=true});notify('Meshes grouped under '+target.name+'.');commit();rebuild()};
  MB.separateChildren=()=>{if(!S||!S.children.length){notify('Selected object has no child meshes.','warn');return}const kids=[...S.children];kids.forEach(o=>root.attach(o));commit();rebuild();notify('Children separated.')};
  
  /* ---------- Simple modifier-like effects ---------- */
  MB.bevel=()=>{if(!S||!S.isMesh){notify('Select a mesh first.','warn');return}const m=S.material;if(S.userData.bevel){notify('Bevel already applied.','warn');return}const old=S.scale.clone();S.scale.multiplyScalar(1.02);S.userData.bevel=true;S.userData.modifier='Bevel';commit();syncProps();notify('Bevel modifier preview applied.')};
  MB.subdivide=()=>{if(!S||!S.isMesh){notify('Select a mesh first.','warn');return}S.userData.modifier=S.userData.modifier==='Subdivision'?'Subdivision x2':'Subdivision';commit();notify('Subdivision preview set.');};
  MB.solidify=()=>{if(!S||!S.isMesh){notify('Select a mesh first.','warn');return}S.userData.solidify=!S.userData.solidify;S.scale.z*=S.userData.solidify?1.02:1/1.02;commit();notify(S.userData.solidify?'Solidify enabled.':'Solidify disabled.');};
  
  /* ---------- Camera settings / DOF ---------- */
  MB.toggleDOF=()=>{if(!S||!S.isCamera){notify('Select a camera first.','warn');return}MB.dof=!MB.dof;S.userData.dof=MB.dof;notify(MB.dof?'Depth of Field target mode enabled.':'Depth of Field disabled.');};
  MB.lockCamera=()=>{if(!S||!S.isCamera){notify('Select a camera first.','warn');return}camView=S;notify('Camera locked to selected camera.');};
  
  /* ---------- Timeline frame tools ---------- */
  MB.frame=()=>Math.round(tm*MB.frameRate)+1;
  MB.nextFrame=()=>{playing=false;tm=Math.min(anim.dur,tm+1/MB.frameRate);sample();ui()};
  MB.prevFrame=()=>{playing=false;tm=Math.max(0,tm-1/MB.frameRate);sample();ui()};
  MB.firstFrame=()=>{playing=false;tm=0;sample();ui()};
  MB.lastFrame=()=>{playing=false;tm=anim.dur;sample();ui()};
  
  /* ---------- Search / F3 ---------- */
  const commands=[
    ['Add Cube',()=>addMesh('Cube')],['Add Sphere',()=>addMesh('Sphere')],['Add Cylinder',()=>addMesh('Cylinder')],['Add Cone',()=>addMesh('Cone')],['Add Torus',()=>addMesh('Torus')],['Add Camera',()=>add(camera())],['Add Point Light',()=>add(light('Point'))],['Add Directional Light',()=>add(light('Directional'))],['Move',()=>setMode('translate')],['Rotate',()=>setMode('rotate')],['Scale',()=>setMode('scale')],['Clone',cloneSelected],['Linked Duplicate',MB.linkedDuplicate],['Delete',del],['Focus',focus],['Camera Mode',enterCameraMode],['Grid',toggleGrid],['Snap',toggleSnap],['Local View',MB.toggleLocal],['Hide Selected',MB.hideSelected],['Show All',MB.showAll],['Wireframe',MB.toggleWire],['Rendered Preview',MB.toggleRendered],['Apply Scale',MB.applyScale],['Reset Transform',MB.resetTransform],['3D Cursor to Selected',MB.cursorToSelected],['Center 3D Cursor',MB.cursorCenter],['Parent Selected',MB.parentSelected],['Clear Parent',MB.clearParent],['Mirror X',MB.mirrorX],['Mirror Y',MB.mirrorY],['Mirror Z',MB.mirrorZ],['Join Meshes',MB.joinVisibleMeshes],['Separate Children',MB.separateChildren],['Bevel',MB.bevel],['Subdivision',MB.subdivide],['Solidify',MB.solidify],['Add Keyframe',addKey],['Auto Keying',MB.autoKeyToggle],['Play',()=>{playing=true}],['Pause',()=>{playing=false}],['Stop',()=>{playing=false;tm=0;sample();ui()}],['Previous Frame',MB.prevFrame],['Next Frame',MB.nextFrame],['Render PNG',MB.renderShot],['Help',openHelp]
  ];
  const openSearch=()=>{let sm=q('#searchMenu');if(!sm){sm=el('div');sm.id='searchMenu';sm.innerHTML='<input class="searchInput" placeholder="Search Mini Blender... (F3)"><div class="searchResults"></div>';document.body.append(sm);const inp=sm.querySelector('input');inp.oninput=()=>renderSearch(inp.value);inp.onkeydown=e=>{if(e.key==='Escape'){sm.classList.remove('on');inp.blur()}if(e.key==='Enter'){const f=sm.querySelector('.searchResults button');f?.click()}};sm.addEventListener('pointerdown',e=>e.stopPropagation())}sm.classList.add('on');sm.querySelector('input').value='';renderSearch('');setTimeout(()=>sm.querySelector('input').focus(),30)};
  const renderSearch=term=>{const sm=q('#searchMenu'),box=sm.querySelector('.searchResults'),z=term.toLowerCase();box.replaceChildren(...commands.filter(x=>x[0].toLowerCase().includes(z)).slice(0,25).map(x=>{const b=el('button','',x[0]);b.onclick=()=>{sm.classList.remove('on');x[1]()};return b}))};
  
  /* ---------- Quick Tools UI ---------- */
  const fg=q('#featureGrid');
  if(fg){
    [['Local','Local View',MB.toggleLocal],['Hide','Hide Selected',MB.hideSelected],['All','Show All',MB.showAll],['Wire','Wireframe',MB.toggleWire],['Render','Rendered Preview',MB.toggleRendered],['Cursor','3D Cursor',MB.cursorToSelected],['Apply','Apply Scale',MB.applyScale],['Reset','Reset Transform',MB.resetTransform],['Parent','Parent',MB.parentSelected],['Unparent','Clear Parent',MB.clearParent],['Link','Linked Clone',MB.linkedDuplicate],['Mirror X','Mirror X',MB.mirrorX],['Mirror Y','Mirror Y',MB.mirrorY],['Mirror Z','Mirror Z',MB.mirrorZ],['Join','Join Meshes',MB.joinVisibleMeshes],['Separate','Separate',MB.separateChildren],['Bevel','Bevel',MB.bevel],['Subdiv','Subdivision',MB.subdivide],['Solidify','Solidify',MB.solidify],['Auto Key','Auto Keying',MB.autoKeyToggle],['Prev','Prev Frame',MB.prevFrame],['Next','Next Frame',MB.nextFrame],['DOF','Camera DOF',MB.toggleDOF],['Search','Search F3',openSearch]].forEach(([t,ti,f])=>fg.append(btn(t,ti,f)));
  }
  
  /* ---------- Extend menus ---------- */
  const extra=document.createElement('div');
  extra.className='v2-menu-injected';
  // Add a few mobile-accessible actions to the existing tool rail.
  [['F3','Search',openSearch],['C','Cursor',MB.cursorToSelected],['L','Local View',MB.toggleLocal],['W','Wireframe',MB.toggleWire],['K','Auto Key',MB.autoKeyToggle]].forEach(([t,ti,f])=>{const b=btn(t,ti,f);$('#tools').append(b)});
  
  /* ---------- Frame controls in timeline ---------- */
  const bar=q('#tl .bar');
  if(bar){bar.append(btn('◀F','Previous frame',MB.prevFrame),btn('F▶','Next frame',MB.nextFrame),btn('● Auto','Auto Keying',MB.autoKeyToggle));}
  
  /* ---------- Keyboard ---------- */
  addEventListener('keydown',e=>{
    if(e.key==='F3'){e.preventDefault();openSearch();return}
    if(e.key==='f'&&e.ctrlKey){e.preventDefault();openSearch();return}
    if(camMode){
      if(e.code==='Space'){e.preventDefault();playing=!playing;ui();return}
      if(e.key==='ArrowRight'){e.preventDefault();MB.nextFrame();return}
      if(e.key==='ArrowLeft'){e.preventDefault();MB.prevFrame();return}
    }
    if(e.key==='PageDown'){e.preventDefault();MB.prevFrame()}
    if(e.key==='PageUp'){e.preventDefault();MB.nextFrame()}
    if(e.key==='Tab'&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();MB.toggleLocal()}
  });
  
  /* ---------- Make camera helper cleanup persistent every frame ---------- */
  const oldLoop=loop;
  // The existing render loop already calls draw; use a lightweight interval so Camera Mode
  // cannot accidentally leave editor helper objects visible after a selection update.
  setInterval(()=>{if(camMode){aux.visible=false;tc.visible=false;sel.visible=false}else{restoreEditorHelpers()}},80);

  /* ---------- Help additions ---------- */
  const oldHelp=HELP.slice();
  HELP.push(
    ['F3 Search','Press F3 to search commands and run them instantly.'],
    ['Local View','Tab isolates the selected object; press Tab again to restore the scene.'],
    ['Wireframe','Quick Tools → Wire shows mesh topology without changing geometry.'],
    ['Rendered Preview','Quick Tools → Render switches to a darker render-style viewport preview.'],
    ['3D Cursor','Quick Tools → Cursor places the cursor at the selected object.'],
    ['Parenting','Parent lets one object follow another; Clear Parent removes the relationship.'],
    ['Linked Clone','Linked Clone duplicates an object while keeping shared material references.'],
    ['Mirror','Mirror X/Y/Z flips the selected object's transform axis.'],
    ['Modifiers','Bevel, Subdivision and Solidify are lightweight modifier states for this Mini Blender engine.'],
    ['Auto Keying','Auto Key records transforms whenever the selected object is changed.'],
    ['Frame Controls','The camera fullscreen controls and timeline both support Play, Pause, Stop, previous and next frame.'],
    ['Camera Clean View','Camera Mode hides editor grids, axes, light/camera helpers, selection outlines and transform gizmos without deleting them.']
  );
})();
