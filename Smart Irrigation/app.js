import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#farm');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#07130d');
scene.fog = new THREE.FogExp2('#07130d', .035);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 100);
camera.position.set(8.7, 9.8, 11.7);
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const controls = new OrbitControls(camera, canvas); controls.target.set(0,0,0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI/2.15; controls.minDistance = 7; controls.maxDistance = 20;
scene.add(new THREE.HemisphereLight('#a2e8d0','#071008',1.5));
const sun = new THREE.DirectionalLight('#ffe7ae',2.2); sun.position.set(-6,10,5); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
const ambient = new THREE.PointLight('#39e99a', 2.5, 14); ambient.position.set(0,4,0); scene.add(ambient);

const field = new THREE.Group(); scene.add(field);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshStandardMaterial({color:'#173824',roughness:.95})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; field.add(ground);
const grid = new THREE.GridHelper(10, 3, '#3d8b61','#276044'); grid.position.y=.012; field.add(grid);
const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10,.05,10)),new THREE.LineBasicMaterial({color:'#63d997'})); border.position.y=.02; field.add(border);

const zones=[], packets=[], localInstructions=[]; let edgeOn=true, cloudConnected=true, drain=1, edgeCount=0, cloudCount=0, cloudTimes=[], optimizerClock=0, optimizing=false, weather='clear';
const healthy=new THREE.Color('#49c86f'), stressed=new THREE.Color('#d8ac39'), wilted=new THREE.Color('#8b5a31');
const plantGeo=new THREE.ConeGeometry(.24,.85,7); const stalkGeo=new THREE.CylinderGeometry(.035,.035,.58,7); const ringGeo=new THREE.TorusGeometry(.3,.025,8,24);
function mat(color, emissive='#000000'){ return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:.55,roughness:.68}); }
function zoneMarker(number){
  const label=document.createElement('canvas'); label.width=128; label.height=128;
  const context=label.getContext('2d');
  context.clearRect(0,0,128,128);
  context.beginPath(); context.arc(64,64,31,0,Math.PI*2);
  context.fillStyle='rgba(8, 32, 21, .82)'; context.fill();
  context.strokeStyle='rgba(98, 232, 174, .5)'; context.lineWidth=2; context.stroke();
  context.fillStyle='#bdf8d6'; context.font='500 34px DM Mono, monospace'; context.textAlign='center'; context.textBaseline='middle'; context.fillText(String(number).padStart(2,'0'),64,66);
  const texture=new THREE.CanvasTexture(label); texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.scale.set(.46,.46,1); sprite.position.set(-.64,.06,-.62);
  return sprite;
}
function soilMoistureLabel(initialValue){
  const label=document.createElement('canvas'); label.width=240; label.height=84;
  const context=label.getContext('2d'); const texture=new THREE.CanvasTexture(label); texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.scale.set(.9,.315,1);
  let lastValue=-1;
  function setValue(value){
    const rounded=Math.round(value); if(rounded===lastValue)return; lastValue=rounded;
    const color=rounded<32?'#ff7a6f':rounded<54?'#ffbf5b':'#73e8c0';
    context.clearRect(0,0,label.width,label.height);
    context.fillStyle='rgba(5, 25, 17, .9)'; context.strokeStyle=color; context.lineWidth=2;
    context.beginPath(); context.roundRect(4,4,232,76,12); context.fill(); context.stroke();
    context.fillStyle='#8fa99b'; context.font='500 15px DM Mono, monospace'; context.textAlign='center'; context.fillText('SOIL MOISTURE',120,26);
    context.fillStyle=color; context.font='600 34px DM Mono, monospace'; context.fillText(`${rounded}%`,120,62);
    texture.needsUpdate=true;
  }
  setValue(initialValue); return {sprite,setValue};
}
function createZone(index,x,z){
  const g=new THREE.Group(); g.position.set(x,0,z); field.add(g);
  const soil=new THREE.Mesh(new THREE.CircleGeometry(1.05,32),mat('#244a2b')); soil.rotation.x=-Math.PI/2; soil.position.y=.025; g.add(soil);
  const marker=zoneMarker(index); g.add(marker);
  const moistureLabel=soilMoistureLabel(0); moistureLabel.sprite.position.set(.02,.52,.72); g.add(moistureLabel.sprite);
  const stalk=new THREE.Mesh(stalkGeo,mat('#346b35')); stalk.position.set(-.18,.3,.04); stalk.castShadow=true; g.add(stalk);
  const plant=new THREE.Mesh(plantGeo,mat('#49c86f')); plant.position.set(-.18,.95,.04); plant.castShadow=true; g.add(plant);
  const sensor=new THREE.Mesh(new THREE.BoxGeometry(.12,.45,.12),mat('#264f53')); sensor.position.set(.48,.28,.12); sensor.castShadow=true; g.add(sensor);
  const sensorLight=new THREE.Mesh(new THREE.SphereGeometry(.075,12,12),mat('#42c8ff','#42c8ff')); sensorLight.position.set(.48,.53,.12); g.add(sensorLight);
  const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#62e8ae',transparent:true,opacity:.1})); ring.rotation.x=-Math.PI/2; ring.position.set(.48,.045,.12); g.add(ring);
  const sprinkler=new THREE.Mesh(new THREE.CylinderGeometry(.1,.15,.22,8),mat('#839995')); sprinkler.position.set(.3,.11,-.48); sprinkler.castShadow=true; g.add(sprinkler);
  const nozzle=new THREE.Mesh(new THREE.ConeGeometry(.13,.16,8),mat('#9ab0a9')); nozzle.rotation.x=Math.PI/2; nozzle.position.set(.3,.29,-.48); g.add(nozzle);
  const water=[]; for(let i=0;i<9;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.028,6,6),new THREE.MeshBasicMaterial({color:'#6edaff',transparent:true,opacity:0})); g.add(d); water.push(d)}
  return {index,group:g,plant,plantMat:plant.material,soil,soilMat:soil.material,marker,moistureLabel,sensor,sensorLight,sensorMat:sensorLight.material,ring,sprinkler,water,moisture:56+Math.random()*28,watering:0,pending:false,requestId:0,edgeFlash:0,scheduled:Math.random()>.5};
}
for(let r=0;r<3;r++)for(let c=0;c<3;c++) zones.push(createZone(r*3+c+1,(c-1)*3.2,(r-1)*3.2));

// Cloud node
const cloud=new THREE.Group(); cloud.position.set(0,5.1,0); scene.add(cloud);
const cloudCore=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,2),mat('#459fd5','#2c8fe0')); cloud.add(cloudCore);
const cloudRing=new THREE.Mesh(new THREE.TorusGeometry(.95,.025,8,48),new THREE.MeshBasicMaterial({color:'#67d8ff',transparent:true,opacity:.55})); cloudRing.rotation.x=Math.PI/2; cloud.add(cloudRing);
const cloudLight=new THREE.PointLight('#56caff',3,8); cloud.add(cloudLight);
function zoneConnectionPoint(zone){
  // In edge mode, the cloud connects to the sensor/edge node. In cloud-only mode,
  // that layer is removed and commands are routed straight to the sprinkler.
  return zone.group.position.clone().add(edgeOn ? new THREE.Vector3(.48,.55,.12) : new THREE.Vector3(.3,.37,-.48));
}
const cloudLines=[]; zones.forEach(zone=>{ const geometry=new THREE.BufferGeometry().setFromPoints([zoneConnectionPoint(zone),cloud.position]); const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:'#4aa99a',dashSize:.13,gapSize:.13,transparent:true,opacity:.23})); line.computeLineDistances(); scene.add(line); cloudLines.push(line); });

function messageSprite(text, color){
  const label=document.createElement('canvas'); label.width=256; label.height=80;
  const context=label.getContext('2d');
  context.clearRect(0,0,label.width,label.height);
  context.fillStyle='rgba(5, 24, 17, .94)';
  context.strokeStyle=color; context.lineWidth=3;
  context.beginPath(); context.roundRect(5,5,246,70,14); context.fill(); context.stroke();
  context.fillStyle=color; context.font='600 30px DM Mono, monospace'; context.textAlign='center'; context.textBaseline='middle'; context.fillText(text,128,42);
  const texture=new THREE.CanvasTexture(label); texture.colorSpace=THREE.SRGBColorSpace;
  const message=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  message.scale.set(1.05,.33,1);
  return message;
}
function addPacket(zone,direction, label='DATA', color='#77e7ff', duration=1.2){ const start=zoneConnectionPoint(zone).add(new THREE.Vector3(0,.16,0)); const end=cloud.position.clone(); const m=messageSprite(label,color); scene.add(m); packets.push({m,start:direction==='up'?start:end,end:direction==='up'?end:start,t:0,duration}); }
function sendEdgeWaterInstruction(zone){
  const start=zone.group.position.clone().add(new THREE.Vector3(.48,.7,.12));
  const end=zone.group.position.clone().add(new THREE.Vector3(.3,.38,-.48));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),new THREE.LineDashedMaterial({color:'#62e8ae',dashSize:.08,gapSize:.05,transparent:true,opacity:.95}));
  line.computeLineDistances(); scene.add(line);
  const label=messageSprite('WATER NOW','#62e8ae'); label.scale.set(.9,.28,1); scene.add(label);
  localInstructions.push({line,label,start,end,t:0,duration:.85});
}
function log(message, type=''){ const el=document.createElement('div');el.className='event '+type; el.innerHTML=`<time>${new Date().toLocaleTimeString([], {minute:'2-digit',second:'2-digit'})}</time>${message}`; const feed=document.querySelector('#eventLog'); feed.prepend(el); while(feed.children.length>6)feed.lastChild.remove(); }
function activate(zone, source, response=10){ zone.watering=3.2; zone.pending=false; zone.requestId++; if(source==='edge'){edgeCount++;zone.edgeFlash=1;sendEdgeWaterInstruction(zone);log(`<strong>Zone ${zone.index}</strong> edge-triggered watering in ${response}ms`)}else{cloudTimes.push(response);log(`<strong>Zone ${zone.index}</strong> cloud command arrived in ${response}ms`,'warn')} }
function requestCloud(zone){ zone.pending=true; const requestId=++zone.requestId; if(!cloudConnected){log(`<strong>Zone ${zone.index}</strong> alert queued — cloud offline`,'warn');return;} const delay=Math.round(900+Math.random()*900); addPacket(zone,'up','ALERT','#ffbd55',delay/2000); log(`<strong>Zone ${zone.index}</strong> requested cloud decision`,'warn'); setTimeout(()=>{ if(!edgeOn && cloudConnected && zone.pending && zone.requestId===requestId){addPacket(zone,'down','WATER','#ffbd55',.8); setTimeout(()=>{if(cloudConnected && zone.pending && zone.requestId===requestId)activate(zone,'cloud',delay+800)},800)}},delay); }
function setCloudOfflineStatus(){ document.querySelector('#optimizerStatus').textContent='Cloud connection offline';document.querySelector('#optimizerCopy').textContent='Cloud plans and cloud-only watering commands are paused until the network reconnects.';document.querySelector('#optimizerDot').parentElement.classList.remove('thinking'); }
function startOptimization(){ if(optimizing||!cloudConnected)return; optimizing=true; cloudCount++; document.querySelector('#optimizerStatus').textContent='Collecting sensor reports…'; document.querySelector('#optimizerCopy').textContent='All 9 zones are reporting moisture and irrigation history.'; zones.forEach((z,i)=>setTimeout(()=>{if(cloudConnected)addPacket(z,'up','DATA','#77e7ff',1.2)},i*55)); log('<strong>Cloud</strong> collecting farm-wide telemetry'); setTimeout(()=>{if(!cloudConnected){optimizing=false;setCloudOfflineStatus();return;}document.querySelector('#optimizerStatus').textContent='Calculating optimal schedule…';document.querySelector('#optimizerDot').parentElement.classList.add('thinking');document.querySelector('#optimizerCopy').textContent=weather==='rain'?'Rain forecast received — reducing planned watering.':'Balancing moisture needs while avoiding peak water demand.'; cloudCore.scale.setScalar(1.25);},1150); setTimeout(()=>{if(!cloudConnected){optimizing=false;cloudCore.scale.setScalar(1);setCloudOfflineStatus();return;}zones.slice().sort((a,b)=>a.moisture-b.moisture).forEach((z,i)=>{z.scheduled=i<4 && (weather!=='rain'||i<2);addPacket(z,'down','PLAN','#62e8ae',.9)}); cloudCore.scale.setScalar(1);document.querySelector('#optimizerDot').parentElement.classList.remove('thinking');document.querySelector('#optimizerStatus').textContent='New plan distributed';document.querySelector('#optimizerCopy').textContent='Priority slots sent to the driest zones. Emergency edge response remains available.';log(`<strong>Cloud</strong> optimized schedule for ${weather==='rain'?2:4} zones`);optimizing=false; renderSchedule();},2850); }
function renderSchedule(){ const planned=zones.filter(z=>z.scheduled).slice(0,4); document.querySelector('#scheduleList').innerHTML=Array.from({length:4},(_,i)=>`<span class="slot ${planned[i]?'active':''}">${planned[i]?'Z'+planned[i].index:'—'}</span>`).join(''); }
function updateHUD(){ const health=zones.reduce((s,z)=>s+z.moisture,0)/zones.length; document.querySelector('#healthValue').textContent=`${Math.round(health)}%`;document.querySelector('#healthBar').style.width=`${health}%`;document.querySelector('#edgeTriggers').textContent=edgeCount;document.querySelector('#cloudPlans').textContent=cloudCount;document.querySelector('#cloudAvg').innerHTML=cloudTimes.length?`${Math.round(cloudTimes.reduce((a,b)=>a+b,0)/cloudTimes.length)}<small> ms</small>`:'—<small> ms</small>';
}
function setMode(on){ edgeOn=on; if(on){ zones.forEach(zone=>{ if(zone.pending){ zone.pending=false; if(zone.moisture<32) activate(zone,'edge'); } }); } const pill=document.querySelector('#modePill');pill.classList.toggle('cloud',!on);pill.querySelector('b').textContent=on?'EDGE ACTIVE':'CLOUD ONLY';pill.querySelector('em').textContent=on?'~10ms response':'~1.4s response';document.querySelector('#modeDescription').textContent=on?'Local nodes respond instantly':'All alerts require cloud round-trip';log(on?'<strong>Edge layer</strong> enabled — local safety net active':'<strong>Edge layer</strong> disabled — routing alerts to cloud','warn'); }
function setCloudConnection(on){ cloudConnected=on; document.querySelector('#cloudDescription').textContent=on?'Farm network online':'Farm network offline';cloudCore.material.emissive.set(on?'#2c8fe0':'#15232b');cloudLight.intensity=on?3:.25;cloudRing.material.opacity=on?.55:.12; if(on){log('<strong>Cloud connection</strong> restored');zones.forEach(zone=>{if(!edgeOn&&zone.pending){zone.pending=false;requestCloud(zone)}});optimizerClock=8;}else{zones.forEach(zone=>{if(zone.pending)zone.requestId++;});packets.forEach(packet=>scene.remove(packet.m));packets.length=0;setCloudOfflineStatus();log('<strong>Cloud connection</strong> lost — edge decisions remain local','warn');} }
document.querySelector('#edgeToggle').addEventListener('change',e=>setMode(e.target.checked)); document.querySelector('#cloudToggle').addEventListener('change',e=>setCloudConnection(e.target.checked)); document.querySelector('#drainSpeed').addEventListener('input',e=>{drain=+e.target.value;document.querySelector('#drainValue').textContent=`${drain.toFixed(1)}×`});
let last=performance.now(); function animate(now){ requestAnimationFrame(animate); const dt=Math.min((now-last)/1000,.05);last=now; const t=now/1000; cloud.position.y=5.1+Math.sin(t*.7)*.12;cloud.rotation.y=t*.23;cloudRing.rotation.z=t*.5; cloudLines.forEach((l,i)=>{l.visible=cloudConnected;l.geometry.setFromPoints([zoneConnectionPoint(zones[i]),cloud.position]);l.computeLineDistances();});
  zones.forEach(z=>{ const wet=z.watering>0;z.watering-=dt;if(wet)z.moisture=Math.min(100,z.moisture+dt*25);else z.moisture=Math.max(0,z.moisture-dt*(2.35*drain)); const critical=z.moisture<32; if(critical&&!wet&&!z.pending){if(edgeOn)activate(z,'edge');else requestCloud(z)} const blend=z.moisture<32?healthy.clone().lerp(wilted,(32-z.moisture)/32):stressed.clone().lerp(healthy,(z.moisture-32)/68);z.plantMat.color.copy(blend); z.plant.scale.set(1, .58+z.moisture/100*.52,1);z.plant.rotation.z=(1-z.moisture/100)*.36*Math.sin(t*1.6+z.index);z.soilMat.color.setHSL(.28,z.moisture/240,.13+z.moisture/1100); z.marker.material.opacity=.58+z.moisture/100*.34;z.moistureLabel.setValue(z.moisture); const col=critical?'#ff5f57':z.moisture<54?'#ffae42':'#42c8ff';z.sensorMat.color.set(col);z.sensorMat.emissive.set(col);z.sensor.visible=edgeOn;z.sensorLight.visible=edgeOn;z.ring.visible=edgeOn;z.ring.material.opacity=(z.edgeFlash*.75)+.08;z.ring.scale.setScalar(1+z.edgeFlash*.7);z.edgeFlash=Math.max(0,z.edgeFlash-dt*2.5);z.water.forEach((d,i)=>{d.material.opacity=wet?.78:0;if(wet){const a=i/9*Math.PI*2+t*5;const rad=.16+(i%3)*.13;d.position.set(.3+Math.cos(a)*rad,.38+(i%3)*.1+Math.abs(Math.sin(t*5+i))*.16,-.48+Math.sin(a)*rad)}}); z.sprinkler.material.emissive.set(wet?'#53cfff':'#000000'); });
  for(let i=packets.length-1;i>=0;i--){const p=packets[i];p.t+=dt/p.duration;p.m.position.lerpVectors(p.start,p.end,p.t);p.m.material.opacity=1-p.t;if(p.t>=1){scene.remove(p.m);packets.splice(i,1)}}
  for(let i=localInstructions.length-1;i>=0;i--){const instruction=localInstructions[i];instruction.t+=dt/instruction.duration;instruction.label.position.lerpVectors(instruction.start,instruction.end,instruction.t);instruction.label.material.opacity=1-instruction.t;instruction.line.material.opacity=(1-instruction.t)*.95;if(instruction.t>=1){scene.remove(instruction.label);scene.remove(instruction.line);localInstructions.splice(i,1)}} optimizerClock+=dt;if(optimizerClock>8){optimizerClock=0;if(cloudConnected)startOptimization();else setCloudOfflineStatus();} if(!optimizing&&cloudConnected){document.querySelector('#optimizerStatus').textContent=`Next sync in ${Math.max(0,Math.ceil(8-optimizerClock))}s`;} updateHUD();controls.update();renderer.render(scene,camera); }
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}); renderSchedule();setTimeout(()=>startOptimization(),900);log('<strong>System online</strong> — monitoring 9 growing zones'); requestAnimationFrame(animate);
