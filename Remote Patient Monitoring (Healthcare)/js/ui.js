// Dashboard: mode switch, vitals card, alarm status, pipeline log, run history, event log.
import {
  bus, patient, state,
  setMode, setCloudOnline, setPaused, triggerCriticalEvent,
} from "./simulation.js";

const eventLogEl = document.getElementById("event-log");
const alertBanner = document.getElementById("alert-banner");

function fmtTime() { return new Date().toLocaleTimeString([], { hour12: false }); }
function log(html) {
  const row = document.createElement("div");
  row.innerHTML = `<span style="color:#4a5b6e">${fmtTime()}</span> ${html}`;
  eventLogEl.appendChild(row);
  while (eventLogEl.children.length > 60) eventLogEl.removeChild(eventLogEl.firstChild);
}

// ---------- Mode switch ----------
const modeCloudBtn = document.getElementById("mode-cloud");
const modeEdgeBtn = document.getElementById("mode-edge");
const modeDesc = document.getElementById("mode-desc");
const networkBtn = document.getElementById("btn-network");
const networkHint = document.getElementById("network-hint");

const MODE_COPY = {
  cloud: "The ICU monitor only forwards raw vitals. The <b>cloud</b> evaluates thresholds and must send the alarm command back down to the nurse station — a full round trip for every critical event.",
  edge: "The ICU monitor sends vitals to a nearby <b>edge server room inside the hospital</b>. That local edge stack evaluates thresholds and signals the nurse station over the hospital LAN — no cloud round trip required.",
};

function applyModeUI(mode) {
  modeCloudBtn.classList.toggle("active", mode === "cloud");
  modeEdgeBtn.classList.toggle("active", mode === "edge");
  modeDesc.innerHTML = MODE_COPY[mode];
  networkHint.style.visibility = mode === "cloud" ? "visible" : "hidden";
  networkBtn.disabled = mode === "edge";
  networkBtn.style.opacity = mode === "edge" ? 0.5 : 1;
}

modeCloudBtn.addEventListener("click", () => { setMode("cloud"); applyModeUI("cloud"); log("Switched monitoring architecture to <b>Cloud-Only</b>"); });
modeEdgeBtn.addEventListener("click", () => { setMode("edge"); applyModeUI("edge"); log("Switched monitoring architecture to <b>Edge Computing</b>"); });
applyModeUI(state.mode);

// ---------- Controls ----------
const btnPause = document.getElementById("btn-pause");
btnPause.addEventListener("click", () => {
  state.paused = !state.paused;
  setPaused(state.paused);
  btnPause.textContent = state.paused ? "▶ Resume vitals" : "⏸ Pause vitals";
});

const btnCritical = document.getElementById("btn-critical");
btnCritical.addEventListener("click", () => {
  const started = triggerCriticalEvent();
  if (!started) {
    log("Critical event ignored — a pipeline is already in progress");
    return;
  }
  log(`<b style="color:#ff8080">Critical event triggered</b> on ${patient.name} (mode: ${state.mode})`);
});

networkBtn.addEventListener("click", () => {
  const goingOnline = !state.cloudOnline;
  setCloudOnline(goingOnline);
  networkBtn.textContent = goingOnline ? "📡 Cloud Link: ONLINE" : "📡 Cloud Link: OFFLINE";
  networkBtn.classList.toggle("offline", !goingOnline);
});

bus.addEventListener("network-change", (e) => {
  log(e.detail.online ? "Cloud link restored" : "<b style=\"color:#ff8080\">Cloud link lost</b>");
});

// ---------- Vitals ----------
const vHr = document.getElementById("v-hr");
const vSpo2 = document.getElementById("v-spo2");
const vTemp = document.getElementById("v-temp");
const vBp = document.getElementById("v-bp");
const sparkCanvas = document.getElementById("sparkline");
const sparkCtx = sparkCanvas.getContext("2d");

function drawSparkline() {
  const w = sparkCanvas.width, h = sparkCanvas.height;
  sparkCtx.clearRect(0, 0, w, h);
  const vals = patient.history.slice(-80).map(s => s.hr);
  if (vals.length < 2) return;
  const min = Math.min(...vals), max = Math.max(...vals, min + 1);
  sparkCtx.beginPath();
  vals.forEach((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * (h - 4) - 2;
    i === 0 ? sparkCtx.moveTo(x, y) : sparkCtx.lineTo(x, y);
  });
  sparkCtx.strokeStyle = "#6fd3ff";
  sparkCtx.lineWidth = 1.5;
  sparkCtx.stroke();
}

bus.addEventListener("vitals-update", (e) => {
  const { sample } = e.detail;
  vHr.textContent = `${sample.hr} bpm`;
  vSpo2.textContent = `${sample.spo2}%`;
  vTemp.textContent = `${sample.temp}°C`;
  vBp.textContent = `${sample.sys}/${sample.dia}`;
  drawSparkline();
});

// ---------- Alarm status + pipeline log ----------
const alarmStatus = document.getElementById("alarm-status");
const pipelineLog = document.getElementById("pipeline-log");
const runHistory = document.getElementById("run-history");
const runs = [];

bus.addEventListener("sensor-breach", (e) => {
  alarmStatus.className = "alarm-status pending";
  alarmStatus.textContent = "PENDING — critical vitals detected, notifying nurse station…";
  pipelineLog.innerHTML = "";
  log(`<b style="color:#ffd28a">Sensor breach</b> HR ${e.detail.sample.hr}, SpO2 ${e.detail.sample.spo2}%`);
});

bus.addEventListener("alarm-path-start", (e) => {
  const label = e.detail.mode === "edge" ? "Edge Computing" : "Cloud-Only";
  log(`Alarm pipeline started (<b>${label}</b>, est. ${Math.round(e.detail.total)}ms)`);
});

bus.addEventListener("segment-start", (e) => {
  const row = document.createElement("div");
  const payload = e.detail.transit?.text ?? (e.detail.localText ?? null);
  row.innerHTML = payload
    ? `• ${e.detail.label}<br><span class="payload">${payload}</span>`
    : `• ${e.detail.label}`;
  pipelineLog.appendChild(row);
});

bus.addEventListener("cloud-heartbeat", (e) => {
  log(`<span style="color:#56687c">cloud·</span> ${e.detail.line}`);
});

bus.addEventListener("alarm-sounding", (e) => {
  alarmStatus.className = "alarm-status sounding";
  alarmStatus.textContent = `🔴 SOUNDING — alarm reached nurse station in ${e.detail.total.toFixed(1)}ms`;
  const doneRow = document.createElement("div");
  doneRow.className = "done";
  doneRow.textContent = `✓ Alarm delivered in ${e.detail.total.toFixed(1)}ms`;
  pipelineLog.appendChild(doneRow);
  log(`<b style="color:#ff8080">ALARM SOUNDING</b> — ${e.detail.mode === "edge" ? "Edge" : "Cloud"} pipeline delivered in ${e.detail.total.toFixed(1)}ms`);
  alertBanner.textContent = `🚨 Nurse station alarm sounding — delivered in ${e.detail.total.toFixed(1)}ms (${e.detail.mode === "edge" ? "Edge Computing" : "Cloud-Only"})`;
  alertBanner.classList.remove("hidden");
  clearTimeout(alertBanner._t);
  alertBanner._t = setTimeout(() => alertBanner.classList.add("hidden"), 4000);

  recordRun(e.detail.mode, e.detail.total, false);
});

bus.addEventListener("alarm-timeout", (e) => {
  alarmStatus.className = "alarm-status failed";
  alarmStatus.textContent = "⚠ NEVER DELIVERED — cloud link down, nurse station not notified";
  const failRow = document.createElement("div");
  failRow.className = "done";
  failRow.textContent = "✗ Network unreachable — alarm never reached the nurse station";
  pipelineLog.appendChild(failRow);
  log(`<b style="color:#ff5b5b">ALARM FAILED</b> — cloud-only pipeline never reached the nurse station (link down)`);
  alertBanner.textContent = `⚠ Cloud link down — the nurse station never received the alarm!`;
  alertBanner.classList.remove("hidden");
  clearTimeout(alertBanner._t);
  alertBanner._t = setTimeout(() => alertBanner.classList.add("hidden"), 4500);

  recordRun(e.detail.mode, e.detail.total, true);
});

bus.addEventListener("alarm-cleared", () => {
  if (alarmStatus.classList.contains("sounding")) {
    alarmStatus.className = "alarm-status off";
    alarmStatus.textContent = "OFF — no active alert";
  }
});

function recordRun(mode, total, failed) {
  runs.unshift({ mode, total, failed });
  if (runs.length > 8) runs.pop();
  runHistory.innerHTML = "";
  runs.forEach(r => {
    const row = document.createElement("div");
    row.className = `run-row mode-${r.mode}${r.failed ? " failed" : ""}`;
    const label = r.mode === "edge" ? "Edge" : "Cloud";
    row.innerHTML = r.failed
      ? `<span>${label}</span><span>NEVER DELIVERED</span>`
      : `<span>${label}</span><span>${r.total.toFixed(1)}ms</span>`;
    runHistory.appendChild(row);
  });
}
