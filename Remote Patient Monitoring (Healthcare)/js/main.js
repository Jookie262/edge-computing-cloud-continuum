// 3D scene: ICU room, an on-site edge server room, and a Nurse Station room,
// with a cloud "server" that shows a live terminal panel of what the backend is doing.
// The alert path animates literal data packets (with their payload text) along the wire:
// ICU -> Edge -> Nurse (edge) vs. ICU -> Cloud -> Nurse (cloud-only), matching real timings.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { bus } from "./simulation.js";

const container = document.getElementById("scene-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x05070c, 0.022);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(13, 10, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.maxDistance = 34;
controls.minDistance = 6;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.AmbientLight(0x8899bb, 0.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(8, 14, 6);
scene.add(keyLight);

// ---------- Floor ----------
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 30),
  new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(40, 40, 0x1c3350, 0x11213a);
grid.position.y = 0.01;
scene.add(grid);

function makeLabel(text, color = "#9fd6f5") {
  const canvas = document.createElement("canvas");
  canvas.width = 320; canvas.height = 72;
  const c = canvas.getContext("2d");
  c.font = "bold 26px sans-serif";
  c.fillStyle = color;
  c.textAlign = "center";
  c.fillText(text, 160, 46);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.6, 0.8, 1);
  return sprite;
}

// Small monospace "data packet" tag showing the literal payload in transit.
function makeDataTag(text, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext("2d");
  c.fillStyle = "rgba(6,10,16,0.88)";
  roundRect(c, 4, 4, canvas.width - 8, canvas.height - 8, 14);
  c.fill();
  c.strokeStyle = accent;
  c.lineWidth = 2;
  roundRect(c, 4, 4, canvas.width - 8, canvas.height - 8, 14);
  c.stroke();
  c.font = "26px 'Consolas', 'Cascadia Code', monospace";
  c.fillStyle = accent;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 0.5, 1);
  return sprite;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ---------- Room positions ----------
const ICU_X = -8, EDGE_X = 0, NURSE_X = 8, ROOM_Z = 2;

// dividing wall with a doorway gap
const wallMat = new THREE.MeshStandardMaterial({ color: 0x18233a, roughness: 0.9 });
const wallA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 7.8), wallMat);
wallA.position.set(-4, 2, ROOM_Z);
scene.add(wallA);
const wallB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 7.8), wallMat);
wallB.position.set(4, 2, ROOM_Z);
scene.add(wallB);

const icuLabel = makeLabel("ICU ROOM", "#6fd3ff");
icuLabel.position.set(ICU_X, 4.6, ROOM_Z);
scene.add(icuLabel);
const edgeLabel = makeLabel("EDGE SERVER ROOM", "#6cf0a0");
edgeLabel.position.set(EDGE_X, 4.6, ROOM_Z);
scene.add(edgeLabel);
const nurseLabel = makeLabel("NURSE STATION", "#ffb454");
nurseLabel.position.set(NURSE_X, 4.6, ROOM_Z);
scene.add(nurseLabel);

// ---------- ICU room: bed, patient, wearable, bedside edge monitor ----------
const bedGroup = new THREE.Group();
bedGroup.position.set(ICU_X, 0, ROOM_Z);
scene.add(bedGroup);

const mattress = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.5, 3.2),
  new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.8 })
);
mattress.position.set(0, 0.6, 0);
bedGroup.add(mattress);

const frame = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.5, 3.4),
  new THREE.MeshStandardMaterial({ color: 0x1c2536, metalness: 0.4, roughness: 0.5 })
);
frame.position.set(0, 0.3, 0);
bedGroup.add(frame);

const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 1.8, 6, 10),
  new THREE.MeshStandardMaterial({ color: 0x8fa6c2 })
);
body.rotation.z = Math.PI / 2;
body.position.set(0, 1.0, 0);
bedGroup.add(body);

const wearable = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x6fd3ff, emissive: 0x6fd3ff, emissiveIntensity: 0.9 })
);
wearable.position.set(0.55, 1.05, 0.6);
bedGroup.add(wearable);

const monitorGroup = new THREE.Group();
monitorGroup.position.set(1.5, 0, 0.4);
bedGroup.add(monitorGroup);

const pillar = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 1.7, 0.2),
  new THREE.MeshStandardMaterial({ color: 0x1c2536 })
);
pillar.position.y = 0.85;
monitorGroup.add(pillar);

const monitorScreen = new THREE.Mesh(
  new THREE.BoxGeometry(0.75, 0.55, 0.06),
  new THREE.MeshStandardMaterial({ color: 0x0d2a3a, emissive: 0x0d3a52, emissiveIntensity: 0.8 })
);
monitorScreen.position.set(0, 1.65, 0.05);
monitorGroup.add(monitorScreen);

const linkGeom = new THREE.BufferGeometry().setFromPoints([
  wearable.position.clone(),
  new THREE.Vector3(monitorGroup.position.x, 1.65, monitorGroup.position.z + 0.05),
]);
const wearableLink = new THREE.Line(linkGeom, new THREE.LineBasicMaterial({ color: 0x2f6ea3, transparent: true, opacity: 0.6 }));
bedGroup.add(wearableLink);

const monitorTop = new THREE.Vector3(ICU_X + 1.5, 1.65, ROOM_Z + 0.45);

// ---------- Edge room: local server rack + terminal ----------
const edgeGroup = new THREE.Group();
edgeGroup.position.set(EDGE_X, 0, ROOM_Z);
scene.add(edgeGroup);

const edgeFloorPad = new THREE.Mesh(
  new THREE.BoxGeometry(2.8, 0.12, 2.2),
  new THREE.MeshStandardMaterial({ color: 0x132119, roughness: 0.9 })
);
edgeFloorPad.position.set(0, 0.06, 0);
edgeGroup.add(edgeFloorPad);

const edgeRack = new THREE.Mesh(
  new THREE.BoxGeometry(1.1, 2.4, 0.9),
  new THREE.MeshStandardMaterial({ color: 0x1b222c, metalness: 0.3, roughness: 0.6 })
);
edgeRack.position.set(-0.35, 1.2, 0);
edgeGroup.add(edgeRack);

for (let i = 0; i < 5; i++) {
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.16, 0.82),
    new THREE.MeshStandardMaterial({ color: 0x24364a, emissive: 0x6cf0a0, emissiveIntensity: i % 2 ? 0.18 : 0.08 })
  );
  blade.position.set(-0.35, 0.5 + i * 0.34, 0.02);
  edgeGroup.add(blade);
}

const edgeConsole = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 0.8, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x0d2a1d, emissive: 0x16452f, emissiveIntensity: 0.7 })
);
edgeConsole.position.set(0.9, 1.4, 0.25);
edgeGroup.add(edgeConsole);

const edgeAntenna = new THREE.Mesh(
  new THREE.CylinderGeometry(0.04, 0.04, 1.1, 10),
  new THREE.MeshStandardMaterial({ color: 0x2a3550 })
);
edgeAntenna.position.set(1.25, 1.55, -0.55);
edgeGroup.add(edgeAntenna);

const edgeBeacon = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0x1f3a29, emissive: 0x6cf0a0, emissiveIntensity: 0.6 })
);
edgeBeacon.position.set(1.25, 2.15, -0.55);
edgeGroup.add(edgeBeacon);

const edgeServerTop = new THREE.Vector3(EDGE_X + 0.9, 1.45, ROOM_Z + 0.25);

// ---------- Nurse station: desk + alarm beacon ----------
const nurseGroup = new THREE.Group();
nurseGroup.position.set(NURSE_X, 0, ROOM_Z);
scene.add(nurseGroup);

const desk = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.9, 1.0),
  new THREE.MeshStandardMaterial({ color: 0x2a2015, roughness: 0.7 })
);
desk.position.set(0, 0.45, 0.6);
nurseGroup.add(desk);

const deskScreen = new THREE.Mesh(
  new THREE.BoxGeometry(0.9, 0.6, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x0d2a3a, emissive: 0x123a4d, emissiveIntensity: 0.6 })
);
deskScreen.position.set(0, 1.15, 0.35);
nurseGroup.add(deskScreen);

// alarm beacon pole + rotating red light
const beaconPole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12),
  new THREE.MeshStandardMaterial({ color: 0x2a3550 })
);
beaconPole.position.set(-1.4, 1.1, -1.2);
nurseGroup.add(beaconPole);

const beaconLight = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x3a1414, emissive: 0x3a1414, emissiveIntensity: 0.4 })
);
beaconLight.position.set(-1.4, 2.35, -1.2);
nurseGroup.add(beaconLight);

const beaconPointLight = new THREE.PointLight(0xff3b3b, 0, 8);
beaconPointLight.position.copy(beaconLight.position);
nurseGroup.add(beaconPointLight);

const nurseAlarmTop = new THREE.Vector3(NURSE_X - 1.4, 2.35, ROOM_Z - 1.2);

// ---------- Cloud: a floating server terminal that logs what the backend is doing ----------
const cloudGroup = new THREE.Group();
cloudGroup.position.set(0, 9, -6);
scene.add(cloudGroup);

const MAX_CLOUD_LINES = 7;
const cloudPanelState = { lines: ["cloud-monitor-svc: booting\u2026"], status: "idle" };
const STATUS_COLORS = { idle: "#3ad07a", processing: "#ffd28a", critical: "#ff5b5b" };

function makeTerminalPanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 560; canvas.height = 340;
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.6, 2.8, 1);
  return { sprite, canvas, ctx: canvas.getContext("2d"), tex };
}

const terminal = makeTerminalPanel();
cloudGroup.add(terminal.sprite);

function redrawTerminal() {
  const { ctx, canvas } = terminal;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(6,10,18,0.92)";
  roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 16);
  ctx.fill();
  ctx.strokeStyle = "#274a6e";
  ctx.lineWidth = 2;
  roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 16);
  ctx.stroke();

  // header bar
  ctx.fillStyle = "#12213a";
  roundRect(ctx, 4, 4, canvas.width - 8, 42, 16);
  ctx.fill();
  ctx.fillStyle = STATUS_COLORS[cloudPanelState.status];
  ctx.beginPath();
  ctx.arc(30, 25, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "bold 20px 'Consolas', monospace";
  ctx.fillStyle = "#dbe7f3";
  ctx.textBaseline = "middle";
  ctx.fillText("cloud-monitor-svc", 50, 26);

  ctx.font = "18px 'Consolas', 'Cascadia Code', monospace";
  cloudPanelState.lines.forEach((line, i) => {
    ctx.fillStyle = i === cloudPanelState.lines.length - 1 ? "#9fe6b0" : "#7f93a8";
    ctx.fillText(line, 24, 74 + i * 33);
  });
  terminal.tex.needsUpdate = true;
}
redrawTerminal();

function pushCloudLine(text) {
  cloudPanelState.lines.push(text);
  while (cloudPanelState.lines.length > MAX_CLOUD_LINES) cloudPanelState.lines.shift();
  redrawTerminal();
}
function setCloudStatus(status) {
  cloudPanelState.status = status;
  redrawTerminal();
}

const cloudGlow = new THREE.PointLight(0xffb454, 1.4, 14);
cloudGroup.add(cloudGlow);

// small "server node" boxes orbiting the panel, suggesting distributed infrastructure
const serverNodes = [];
for (let i = 0; i < 3; i++) {
  const node = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.22, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2a3550, emissive: 0xffb454, emissiveIntensity: 0.3 })
  );
  cloudGroup.add(node);
  serverNodes.push({ mesh: node, offset: i * 2.1, radius: 2.6 + i * 0.5, speed: 0.4 + i * 0.12 });
}

// faint reference lines: ICU monitor <-> edge, edge <-> nurse, ICU monitor <-> cloud, cloud <-> nurse
function makeStaticLine(a, b, color, opacity) {
  const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  scene.add(line);
  return line;
}
const lineIcuEdge = makeStaticLine(monitorTop, edgeServerTop, 0x1f5a3a, 0.18);
const lineEdgeNurse = makeStaticLine(edgeServerTop, nurseAlarmTop, 0x1f5a3a, 0.18);
const lineIcuCloud = makeStaticLine(monitorTop, cloudGroup.position, 0x3a2a1a, 0.2);
const lineCloudNurse = makeStaticLine(cloudGroup.position, nurseAlarmTop, 0x3a2a1a, 0.2);

function pointFor(node) {
  if (node === "icu") return monitorTop;
  if (node === "edge") return edgeServerTop;
  if (node === "nurse") return nurseAlarmTop;
  return cloudGroup.position;
}
function lineFor(from, to) {
  if ((from === "icu" && to === "edge") || (from === "edge" && to === "icu")) return lineIcuEdge;
  if ((from === "edge" && to === "nurse") || (from === "nurse" && to === "edge")) return lineEdgeNurse;
  if ((from === "icu" && to === "cloud") || (from === "cloud" && to === "icu")) return lineIcuCloud;
  return lineCloudNurse;
}

// ---------- Alert visuals ----------
const activeRings = [];
function spawnRing(position, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.16, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  ring.position.copy(position);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  activeRings.push({ mesh: ring, age: 0 });
}

function flashMonitor() {
  monitorScreen.material.emissive.set(0xff4d4d);
  monitorScreen.material.emissiveIntensity = 1.6;
  spawnRing(monitorTop, 0xff4d4d);
  setTimeout(() => {
    monitorScreen.material.emissive.set(0x0d3a52);
    monitorScreen.material.emissiveIntensity = 0.8;
  }, 1200);
}

let beaconSounding = false;
function soundBeacon() {
  beaconSounding = true;
  spawnRing(nurseAlarmTop, 0xff3b3b);
}
function stopBeacon() {
  beaconSounding = false;
  beaconLight.material.emissive.set(0x3a1414);
  beaconLight.material.emissiveIntensity = 0.4;
  beaconPointLight.intensity = 0;
}

// ---------- Edge room terminal ----------
const MAX_EDGE_LINES = 5;
const edgePanelState = { lines: ["edge-analytics: idle"], status: "idle" };
const EDGE_STATUS_COLORS = { idle: "#6cf0a0", processing: "#ffd28a", critical: "#ff5b5b" };

function makeEdgePanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 440; canvas.height = 250;
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 1.6, 1);
  sprite.position.set(0.95, 2.45, 0.22);
  return { sprite, canvas, ctx: canvas.getContext("2d"), tex };
}

const edgeTerminal = makeEdgePanel();
edgeGroup.add(edgeTerminal.sprite);

function redrawEdgeTerminal() {
  const { ctx, canvas } = edgeTerminal;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(8,14,11,0.92)";
  roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 14);
  ctx.fill();
  ctx.strokeStyle = "#2a4c38";
  ctx.lineWidth = 2;
  roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 14);
  ctx.stroke();
  ctx.fillStyle = "#12281c";
  roundRect(ctx, 4, 4, canvas.width - 8, 38, 14);
  ctx.fill();
  ctx.fillStyle = EDGE_STATUS_COLORS[edgePanelState.status];
  ctx.beginPath();
  ctx.arc(24, 23, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "bold 18px 'Consolas', monospace";
  ctx.fillStyle = "#dbe7f3";
  ctx.textBaseline = "middle";
  ctx.fillText("edge-analytics", 42, 24);
  ctx.font = "15px 'Consolas', 'Cascadia Code', monospace";
  edgePanelState.lines.forEach((line, i) => {
    ctx.fillStyle = i === edgePanelState.lines.length - 1 ? "#b7f8ce" : "#7fb494";
    ctx.fillText(line, 18, 64 + i * 30);
  });
  edgeTerminal.tex.needsUpdate = true;
}
redrawEdgeTerminal();

function pushEdgeLine(text) {
  edgePanelState.lines.push(text);
  while (edgePanelState.lines.length > MAX_EDGE_LINES) edgePanelState.lines.shift();
  redrawEdgeTerminal();
}

function setEdgeStatus(status) {
  edgePanelState.status = status;
  redrawEdgeTerminal();
}

// ---------- Literal data packets: a glowing dot + its payload text, traveling node to node ----------
let activeTransit = null;   // { dot, tag, from, to, startTime, duration, stall, line }
const pendingCloudTimers = [];
const pendingEdgeTimers = [];

function clearTransit() {
  if (activeTransit) {
    scene.remove(activeTransit.dot);
    scene.remove(activeTransit.tag);
    activeTransit.line.material.opacity = activeTransit.baseOpacity;
    activeTransit = null;
  }
  pendingCloudTimers.forEach(clearTimeout);
  pendingCloudTimers.length = 0;
  pendingEdgeTimers.forEach(clearTimeout);
  pendingEdgeTimers.length = 0;
}

bus.addEventListener("sensor-breach", () => flashMonitor());

bus.addEventListener("alarm-path-start", (e) => {
  clearTransit();
  if (e.detail.mode === "cloud") {
    setCloudStatus("processing");
    setEdgeStatus("idle");
  } else {
    pushCloudLine("(edge mode: alarm bypasses cloud entirely)");
    setEdgeStatus("processing");
    pushEdgeLine("edge-analytics: awaiting ICU telemetry");
  }
});

bus.addEventListener("segment-start", (e) => {
  const seg = e.detail;

  if (seg.transit) {
    if (activeTransit) { scene.remove(activeTransit.dot); scene.remove(activeTransit.tag); }
    const accent = seg.mode === "edge" ? "#6fd3ff" : "#ffd28a";
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1, transparent: true })
    );
    const from = pointFor(seg.transit.from);
    dot.position.copy(from);
    scene.add(dot);
    const tag = makeDataTag(seg.transit.text, accent);
    tag.position.copy(from).add(new THREE.Vector3(0, 0.35, 0));
    scene.add(tag);

    const line = lineFor(seg.transit.from, seg.transit.to);
    activeTransit = {
      dot, tag, from: seg.transit.from, to: seg.transit.to,
      startTime: performance.now(), duration: seg.duration, stall: !!seg.transit.stall,
      line, baseOpacity: 0.15,
    };
    line.material.opacity = 0.85;
  }

  if (seg.cloudLines?.length) {
    const perLine = seg.duration / seg.cloudLines.length;
    seg.cloudLines.forEach((line, i) => {
      pendingCloudTimers.push(setTimeout(() => pushCloudLine(line), i * perLine));
    });
  }

  if (seg.edgeLines?.length) {
    const perLine = seg.duration / seg.edgeLines.length;
    seg.edgeLines.forEach((line, i) => {
      pendingEdgeTimers.push(setTimeout(() => pushEdgeLine(line), i * perLine));
    });
  }

  if (seg.localText && seg.mode === "edge") {
    pendingEdgeTimers.push(setTimeout(() => pushEdgeLine(seg.localText), 0));
  }
});

bus.addEventListener("cloud-heartbeat", (e) => pushCloudLine(e.detail.line));

bus.addEventListener("alarm-sounding", (e) => {
  soundBeacon();
  clearTransit();
  setCloudStatus("idle");
  if (e.detail.mode === "edge") {
    setEdgeStatus("critical");
    pushEdgeLine("edge-dispatch: alarm sent to nurse-station-01");
  } else {
    setEdgeStatus("idle");
  }
});

bus.addEventListener("alarm-timeout", () => {
  clearTransit();
  setCloudStatus("critical");
  setEdgeStatus("idle");
});

bus.addEventListener("alarm-cleared", () => {
  stopBeacon();
  setCloudStatus("idle");
  setEdgeStatus("idle");
  pushEdgeLine("edge-analytics: idle");
});

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Animation loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  serverNodes.forEach(s => {
    const a = elapsed * s.speed + s.offset;
    s.mesh.position.set(cloudGroup.position.x + Math.cos(a) * s.radius, cloudGroup.position.y - 1.6 + Math.sin(a * 0.6) * 0.3, cloudGroup.position.z + Math.sin(a) * s.radius);
    s.mesh.rotation.y += dt * 0.6;
  });

  // wearable pulse suggests continuous local sensing
  const pulse = 0.8 + Math.sin(elapsed * 4) * 0.2;
  wearable.material.emissiveIntensity = pulse;
  edgeBeacon.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 3.5) * 0.15;

  // beacon flashing while sounding
  if (beaconSounding) {
    const flash = 0.5 + Math.sin(elapsed * 14) * 0.5;
    beaconLight.material.emissive.set(0xff3b3b);
    beaconLight.material.emissiveIntensity = 0.6 + flash;
    beaconPointLight.intensity = 2 + flash * 3;
  }

  // expanding alert rings
  for (let i = activeRings.length - 1; i >= 0; i--) {
    const r = activeRings[i];
    r.age += dt;
    const scale = 1 + r.age * 4;
    r.mesh.scale.set(scale, scale, scale);
    r.mesh.material.opacity = Math.max(0, 0.9 - r.age * 1.2);
    if (r.age > 1) {
      scene.remove(r.mesh);
      activeRings.splice(i, 1);
    }
  }

  // the active data packet (dot + payload text) travels node to node, paced by real time
  if (activeTransit) {
    const t = performance.now() - activeTransit.startTime;
    const from = pointFor(activeTransit.from);
    const to = pointFor(activeTransit.to);
    let frac = Math.min(1, t / activeTransit.duration);
    if (activeTransit.stall) {
      frac = Math.min(0.55, frac * 0.55);
      const flicker = 0.4 + Math.sin(elapsed * 10) * 0.3;
      activeTransit.dot.material.opacity = flicker;
      activeTransit.tag.material.opacity = flicker;
    }
    activeTransit.dot.position.lerpVectors(from, to, frac);
    activeTransit.tag.position.lerpVectors(from, to, frac).add(new THREE.Vector3(0, 0.35, 0));
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
