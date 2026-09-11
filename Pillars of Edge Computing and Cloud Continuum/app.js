const canvas = document.getElementById("latencyCanvas");
const ctx = canvas.getContext("2d");

const latencyInput = document.getElementById("latency");
const latencyValue = document.getElementById("latencyValue");
const toggleBtn = document.getElementById("toggleBtn");
const sendBtn = document.getElementById("sendBtn");
const stats = document.getElementById("stats");

const bandwidthCanvas = document.getElementById("bandwidthCanvas");
const bwCtx = bandwidthCanvas.getContext("2d");
const bandwidthInput = document.getElementById("bandwidth");
const bandwidthValue = document.getElementById("bandwidthValue");
const bandwidthStats = document.getElementById("bandwidthStats");

const sovereigntyCanvas = document.getElementById("sovereigntyCanvas");
const svCtx = sovereigntyCanvas.getContext("2d");
const edgeModeBtn = document.getElementById("edgeModeBtn");
const cloudModeBtn = document.getElementById("cloudModeBtn");
const sovereigntyStats = document.getElementById("sovereigntyStats");

const offlineCanvas = document.getElementById("offlineCanvas");
const offCtx = offlineCanvas.getContext("2d");
const goOfflineBtn = document.getElementById("goOfflineBtn");
const goOnlineBtn = document.getElementById("goOnlineBtn");
const createDataBtn = document.getElementById("createDataBtn");
const offlineStats = document.getElementById("offlineStats");

const state = {
  running: true,
  latencyMs: Number(latencyInput.value),
  travelStart: performance.now(),
  delivered: 0
};

const bandwidthState = {
  level: Number(bandwidthInput.value),
  packets: [],
  spawnAccumulator: 0,
  delivered: 0,
  speedPxPerSecond: 260,
  lastTime: performance.now()
};

const sovereigntyState = {
  mode: "edge",
  packets: [],
  spawnAccumulator: 0,
  localProcessed: 0,
  cloudSent: 0,
  speedPxPerSecond: 220
};

const offlineState = {
  online: true,
  localQueue: 0,
  syncing: [],
  synced: 0,
  createAccumulator: 0,
  syncAccumulator: 0,
  speedPxPerSecond: 280
};

const path = {
  x1: 130,
  y: 220,
  x2: 870
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateReadout() {
  latencyValue.textContent = `${state.latencyMs} ms`;
}

function updateBandwidthReadout() {
  bandwidthValue.textContent = String(bandwidthState.level);
}

function setSovereigntyMode(mode) {
  sovereigntyState.mode = mode;
  edgeModeBtn.style.filter = mode === "edge" ? "brightness(1.08)" : "brightness(0.92)";
  cloudModeBtn.style.filter = mode === "cloud" ? "brightness(1.08)" : "brightness(0.92)";
}

function setOfflineMode(isOnline) {
  offlineState.online = isOnline;
  goOnlineBtn.style.filter = isOnline ? "brightness(1.08)" : "brightness(0.92)";
  goOfflineBtn.style.filter = isOnline ? "brightness(0.92)" : "brightness(1.08)";
}

function speedWord() {
  if (state.latencyMs <= 250) return "FAST";
  if (state.latencyMs <= 700) return "MEDIUM";
  return "SLOW";
}

function resetMessage(now = performance.now()) {
  state.travelStart = now;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0a2a48");
  gradient.addColorStop(1, "#0a1d34");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPath() {
  ctx.beginPath();
  ctx.moveTo(path.x1, path.y);
  ctx.lineTo(path.x2, path.y);
  ctx.strokeStyle = "rgba(76, 201, 240, 0.8)";
  ctx.lineWidth = 6;
  ctx.stroke();
}

function drawSide(x, color, label) {
  ctx.beginPath();
  ctx.arc(x, path.y, 28, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = "#eef7ff";
  ctx.font = "700 20px Space Grotesk";
  ctx.textAlign = "center";
  ctx.fillText(label, x, path.y - 46);
}

function drawMessage(progress) {
  const x = path.x1 + (path.x2 - path.x1) * progress;

  ctx.beginPath();
  ctx.arc(x, path.y, 11, 0, Math.PI * 2);
  ctx.fillStyle = progress >= 1 ? "#80ed99" : "#4cc9f0";
  ctx.fill();

  ctx.fillStyle = "#e3f4ff";
  ctx.font = "700 14px Space Grotesk";
  ctx.fillText("Message", x, path.y - 18);
}

function drawLabels(progress) {
  const percent = Math.round(progress * 100);
  ctx.fillStyle = "#e8f6ff";
  ctx.font = "700 26px Space Grotesk";
  ctx.textAlign = "center";
  ctx.fillText(`${speedWord()} INTERNET`, canvas.width / 2, 85);

  ctx.font = "600 18px Space Grotesk";
  ctx.fillText(`Travel progress: ${percent}%`, canvas.width / 2, 115);
}

function refreshStats(progress) {
  const arrived = progress >= 1;
  const hint = state.latencyMs <= 250
    ? "Short delay = fast reply"
    : state.latencyMs <= 700
      ? "Bigger delay = a bit of waiting"
      : "Huge delay = long waiting";

  stats.innerHTML = `
    Delay setting: <strong>${state.latencyMs} ms</strong><br />
    Message status: <strong>${arrived ? "Arrived" : "On the way"}</strong><br />
    Total messages arrived: <strong>${state.delivered}</strong><br />
    ${hint}
  `;
}

function drawBandwidthBackground() {
  const gradient = bwCtx.createLinearGradient(0, 0, bandwidthCanvas.width, bandwidthCanvas.height);
  gradient.addColorStop(0, "#0a2a48");
  gradient.addColorStop(1, "#0a1d34");
  bwCtx.fillStyle = gradient;
  bwCtx.fillRect(0, 0, bandwidthCanvas.width, bandwidthCanvas.height);
}

function roadWidthFromLevel() {
  return 40 + bandwidthState.level * 11;
}

function spawnBandwidthPacket() {
  const roadWidth = roadWidthFromLevel();
  const centerY = 180;
  const minY = centerY - roadWidth / 2 + 10;
  const maxY = centerY + roadWidth / 2 - 10;

  bandwidthState.packets.push({
    x: 120,
    y: minY + Math.random() * (maxY - minY)
  });
}

function renderBandwidth(deltaMs) {
  drawBandwidthBackground();

  const centerY = 180;
  const roadWidth = roadWidthFromLevel();
  const top = centerY - roadWidth / 2;
  const bottom = centerY + roadWidth / 2;

  bwCtx.fillStyle = "rgba(76, 201, 240, 0.18)";
  bwCtx.fillRect(140, top, 720, roadWidth);

  bwCtx.strokeStyle = "rgba(76, 201, 240, 0.9)";
  bwCtx.lineWidth = 3;
  bwCtx.strokeRect(140, top, 720, roadWidth);

  bwCtx.fillStyle = "#ffb703";
  bwCtx.beginPath();
  bwCtx.arc(105, centerY, 24, 0, Math.PI * 2);
  bwCtx.fill();

  bwCtx.fillStyle = "#ff6b6b";
  bwCtx.beginPath();
  bwCtx.arc(895, centerY, 24, 0, Math.PI * 2);
  bwCtx.fill();

  bwCtx.fillStyle = "#eef7ff";
  bwCtx.textAlign = "center";
  bwCtx.font = "700 18px Space Grotesk";
  bwCtx.fillText("Sender", 105, centerY - 36);
  bwCtx.fillText("Receiver", 895, centerY - 36);

  // Higher level means more messages can enter the road each second.
  const packetsPerSecond = bandwidthState.level * 1.4;
  bandwidthState.spawnAccumulator += (deltaMs / 1000) * packetsPerSecond;
  while (bandwidthState.spawnAccumulator >= 1) {
    spawnBandwidthPacket();
    bandwidthState.spawnAccumulator -= 1;
  }

  const step = bandwidthState.speedPxPerSecond * (deltaMs / 1000);
  for (let i = bandwidthState.packets.length - 1; i >= 0; i -= 1) {
    const packet = bandwidthState.packets[i];
    packet.x += step;

    bwCtx.beginPath();
    bwCtx.arc(packet.x, packet.y, 7, 0, Math.PI * 2);
    bwCtx.fillStyle = "#4cc9f0";
    bwCtx.fill();

    if (packet.x >= 870) {
      bandwidthState.packets.splice(i, 1);
      bandwidthState.delivered += 1;
    }
  }

  bwCtx.fillStyle = "#e8f6ff";
  bwCtx.font = "700 24px Space Grotesk";
  bwCtx.fillText("Bandwidth: how many messages can move each second", bandwidthCanvas.width / 2, 70);
}

function refreshBandwidthStats() {
  const packetsPerSecond = (bandwidthState.level * 1.4).toFixed(1);
  const widthWord = bandwidthState.level <= 3 ? "NARROW" : bandwidthState.level <= 7 ? "MEDIUM" : "WIDE";
  bandwidthStats.innerHTML = `
    Road width: <strong>${widthWord}</strong><br />
    Messages each second: <strong>${packetsPerSecond}</strong><br />
    Total messages arrived: <strong>${bandwidthState.delivered}</strong>
  `;
}

function drawSovereigntyBackground() {
  const gradient = svCtx.createLinearGradient(0, 0, sovereigntyCanvas.width, sovereigntyCanvas.height);
  gradient.addColorStop(0, "#0a2a48");
  gradient.addColorStop(1, "#0a1d34");
  svCtx.fillStyle = gradient;
  svCtx.fillRect(0, 0, sovereigntyCanvas.width, sovereigntyCanvas.height);
}

function spawnSovereigntyPacket() {
  sovereigntyState.packets.push({
    x: 120,
    y: 168 + Math.random() * 40,
    done: false,
    wasCloud: false,
    pulse: Math.random() * Math.PI * 2
  });
}

function drawSovereigntyZones() {
  svCtx.fillStyle = "rgba(128, 237, 153, 0.16)";
  svCtx.fillRect(70, 120, 320, 120);
  svCtx.fillStyle = "rgba(255, 183, 3, 0.08)";
  svCtx.fillRect(390, 120, 180, 120);
  svCtx.fillStyle = "rgba(255, 107, 107, 0.16)";
  svCtx.fillRect(570, 120, 350, 120);

  svCtx.strokeStyle = "rgba(255, 183, 3, 0.75)";
  svCtx.setLineDash([7, 8]);
  svCtx.lineWidth = 2;
  svCtx.beginPath();
  svCtx.moveTo(570, 108);
  svCtx.lineTo(570, 248);
  svCtx.stroke();
  svCtx.setLineDash([]);

  svCtx.fillStyle = "#e8f6ff";
  svCtx.textAlign = "center";
  svCtx.font = "700 18px Space Grotesk";
  svCtx.fillText("Your Region", 230, 102);
  svCtx.fillText("Outside Region (Far Cloud)", 745, 102);

  svCtx.font = "700 14px Space Grotesk";
  svCtx.fillStyle = "#9ef5b7";
  svCtx.fillText("Edge computer", 320, 264);
  svCtx.fillStyle = "#ff9f9f";
  svCtx.fillText("Cloud server", 790, 264);
}

function renderSovereignty(deltaMs, now) {
  drawSovereigntyBackground();
  drawSovereigntyZones();

  const perSecond = 2.4;
  sovereigntyState.spawnAccumulator += (deltaMs / 1000) * perSecond;
  while (sovereigntyState.spawnAccumulator >= 1) {
    spawnSovereigntyPacket();
    sovereigntyState.spawnAccumulator -= 1;
  }

  const step = sovereigntyState.speedPxPerSecond * (deltaMs / 1000);
  for (let i = sovereigntyState.packets.length - 1; i >= 0; i -= 1) {
    const packet = sovereigntyState.packets[i];
    const edgeStopX = 330;
    const cloudStopX = 820;

    if (!packet.done) {
      packet.x += step;

      if (sovereigntyState.mode === "edge" && packet.x >= edgeStopX) {
        packet.x = edgeStopX;
        packet.done = true;
        packet.wasCloud = false;
        sovereigntyState.localProcessed += 1;
      }

      if (sovereigntyState.mode === "cloud" && packet.x >= cloudStopX) {
        packet.x = cloudStopX;
        packet.done = true;
        packet.wasCloud = true;
        sovereigntyState.cloudSent += 1;
      }
    }

    const pulse = 1 + Math.sin(now * 0.01 + packet.pulse) * 0.25;
    svCtx.beginPath();
    svCtx.arc(packet.x, packet.y, 8 * pulse, 0, Math.PI * 2);
    svCtx.fillStyle = packet.done
      ? (packet.wasCloud ? "#ff6b6b" : "#80ed99")
      : "#4cc9f0";
    svCtx.fill();

    if (packet.done && (now % 2400) < 40) {
      sovereigntyState.packets.splice(i, 1);
    }
  }

  svCtx.fillStyle = "#e8f6ff";
  svCtx.font = "700 22px Space Grotesk";
  svCtx.fillText(
    sovereigntyState.mode === "edge"
      ? "EDGE MODE: Data stays local"
      : "CLOUD MODE: Data leaves your region",
    sovereigntyCanvas.width / 2,
    58
  );
}

function refreshSovereigntyStats() {
  const message = sovereigntyState.mode === "edge"
    ? "Better privacy: data is processed near you."
    : "Lower sovereignty: personal data travels farther.";

  sovereigntyStats.innerHTML = `
    Current mode: <strong>${sovereigntyState.mode === "edge" ? "Edge (Local)" : "Cloud (Far)"}</strong><br />
    Processed locally: <strong>${sovereigntyState.localProcessed}</strong><br />
    Sent to far cloud: <strong>${sovereigntyState.cloudSent}</strong><br />
    ${message}
  `;
}

function drawOfflineBackground() {
  const gradient = offCtx.createLinearGradient(0, 0, offlineCanvas.width, offlineCanvas.height);
  gradient.addColorStop(0, "#0a2a48");
  gradient.addColorStop(1, "#0a1d34");
  offCtx.fillStyle = gradient;
  offCtx.fillRect(0, 0, offlineCanvas.width, offlineCanvas.height);
}

function spawnSyncPacket() {
  offlineState.syncing.push({
    x: 320,
    y: 165 + Math.random() * 52
  });
}

function createOfflineData() {
  if (offlineState.online) {
    spawnSyncPacket();
    return;
  }
  offlineState.localQueue += 1;
}

function drawOfflineZones() {
  offCtx.fillStyle = "rgba(128, 237, 153, 0.16)";
  offCtx.fillRect(70, 120, 300, 120);
  offCtx.fillStyle = "rgba(76, 201, 240, 0.09)";
  offCtx.fillRect(370, 120, 250, 120);
  offCtx.fillStyle = "rgba(255, 107, 107, 0.16)";
  offCtx.fillRect(620, 120, 300, 120);

  offCtx.strokeStyle = "rgba(76, 201, 240, 0.85)";
  offCtx.lineWidth = 2;
  offCtx.setLineDash([8, 8]);
  offCtx.beginPath();
  offCtx.moveTo(370, 180);
  offCtx.lineTo(620, 180);
  offCtx.stroke();
  offCtx.setLineDash([]);

  offCtx.fillStyle = "#e8f6ff";
  offCtx.font = "700 18px Space Grotesk";
  offCtx.textAlign = "center";
  offCtx.fillText("Your Device (Edge)", 220, 102);
  offCtx.fillText("Cloud", 770, 102);

  offCtx.font = "700 15px Space Grotesk";
  offCtx.fillStyle = "#b6c8e0";
  offCtx.fillText(offlineState.online ? "Internet ON" : "Internet OFF", 495, 102);
}

function drawLocalQueue() {
  const visible = Math.min(offlineState.localQueue, 18);
  for (let i = 0; i < visible; i += 1) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = 120 + col * 28;
    const y = 165 + row * 26;
    offCtx.beginPath();
    offCtx.arc(x, y, 8, 0, Math.PI * 2);
    offCtx.fillStyle = "#ffb703";
    offCtx.fill();
  }

  offCtx.fillStyle = "#eaf5ff";
  offCtx.font = "600 14px Space Grotesk";
  offCtx.textAlign = "left";
  offCtx.fillText(`Saved locally: ${offlineState.localQueue}`, 90, 258);
}

function renderOffline(deltaMs) {
  drawOfflineBackground();
  drawOfflineZones();

  // New app data keeps being created, even when internet is off.
  offlineState.createAccumulator += (deltaMs / 1000) * 1.2;
  while (offlineState.createAccumulator >= 1) {
    createOfflineData();
    offlineState.createAccumulator -= 1;
  }

  if (offlineState.online && offlineState.localQueue > 0) {
    // When internet returns, queued local data is uploaded gradually.
    offlineState.syncAccumulator += (deltaMs / 1000) * 2.4;
    while (offlineState.syncAccumulator >= 1 && offlineState.localQueue > 0) {
      offlineState.localQueue -= 1;
      spawnSyncPacket();
      offlineState.syncAccumulator -= 1;
    }
  }

  drawLocalQueue();

  const step = offlineState.speedPxPerSecond * (deltaMs / 1000);
  for (let i = offlineState.syncing.length - 1; i >= 0; i -= 1) {
    const packet = offlineState.syncing[i];
    packet.x += step;

    offCtx.beginPath();
    offCtx.arc(packet.x, packet.y, 7, 0, Math.PI * 2);
    offCtx.fillStyle = "#4cc9f0";
    offCtx.fill();

    if (packet.x >= 860) {
      offlineState.syncing.splice(i, 1);
      offlineState.synced += 1;
    }
  }

  offCtx.fillStyle = "#e8f6ff";
  offCtx.font = "700 22px Space Grotesk";
  offCtx.textAlign = "center";
  offCtx.fillText(
    offlineState.online
      ? "ONLINE: data syncs to cloud"
      : "OFFLINE: app still works and stores data",
    offlineCanvas.width / 2,
    58
  );
}

function refreshOfflineStats() {
  const tip = offlineState.online
    ? "Internet is available. New and saved data can sync to cloud."
    : "Internet is down. Data is safe on device and will sync later.";

  offlineStats.innerHTML = `
    App state: <strong>${offlineState.online ? "Online" : "Offline"}</strong><br />
    Data waiting on device: <strong>${offlineState.localQueue}</strong><br />
    Data currently syncing: <strong>${offlineState.syncing.length}</strong><br />
    Total synced to cloud: <strong>${offlineState.synced}</strong><br />
    ${tip}
  `;
}

function tick(now) {
  const deltaMs = now - bandwidthState.lastTime;
  bandwidthState.lastTime = now;

  drawBackground();
  drawPath();
  drawSide(path.x1, "#ffb703", "You");
  drawSide(path.x2, "#ff6b6b", "Website");

  const progress = clamp((now - state.travelStart) / state.latencyMs, 0, 1);
  drawMessage(progress);
  drawLabels(progress);
  refreshStats(progress);
  renderBandwidth(deltaMs);
  refreshBandwidthStats();
  renderSovereignty(deltaMs, now);
  refreshSovereigntyStats();
  renderOffline(deltaMs);
  refreshOfflineStats();

  if (state.running && progress >= 1) {
    state.delivered += 1;
    resetMessage(now + 250);
  }

  requestAnimationFrame(tick);
}

function setRunning(nextRunning) {
  state.running = nextRunning;
  toggleBtn.textContent = nextRunning ? "Pause" : "Resume";
}

latencyInput.addEventListener("input", () => {
  state.latencyMs = Number(latencyInput.value);
  updateReadout();
});

bandwidthInput.addEventListener("input", () => {
  bandwidthState.level = Number(bandwidthInput.value);
  updateBandwidthReadout();
});

toggleBtn.addEventListener("click", () => {
  setRunning(!state.running);
});

sendBtn.addEventListener("click", () => {
  resetMessage();
});

edgeModeBtn.addEventListener("click", () => {
  setSovereigntyMode("edge");
});

cloudModeBtn.addEventListener("click", () => {
  setSovereigntyMode("cloud");
});

goOfflineBtn.addEventListener("click", () => {
  setOfflineMode(false);
});

goOnlineBtn.addEventListener("click", () => {
  setOfflineMode(true);
});

createDataBtn.addEventListener("click", () => {
  createOfflineData();
});

updateReadout();
updateBandwidthReadout();
setSovereigntyMode("edge");
setOfflineMode(true);
requestAnimationFrame(tick);
