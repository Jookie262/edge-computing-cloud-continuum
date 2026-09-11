// Core simulation: one ICU patient, and an "alarm pipeline" that behaves very differently
// depending on the monitoring architecture (cloud-only vs. edge computing).
// Everything communicates through a simple EventTarget bus so the 3D scene (main.js)
// and the dashboard (ui.js) stay decoupled from the data model.

export const bus = new EventTarget();
function emit(name, detail) {
  bus.dispatchEvent(new CustomEvent(name, { detail }));
}

export const state = {
  mode: "cloud",       // "cloud" | "edge" — which architecture is currently monitoring the patient
  cloudOnline: true,   // only matters in "cloud" mode: is the hospital's internet link up?
  paused: false,
  pipelineActive: false,
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function walk(value, min, max, step, driftBack, baseline) {
  let v = value + (Math.random() - 0.5) * step;
  v += (baseline - value) * driftBack;
  return clamp(v, min, max);
}

export const patient = {
  name: "ICU Bed \u00b7 Patient",
  hr: 78, spo2: 97, temp: 36.9, sys: 118, dia: 76,
  history: [],
  alarmActive: false,
  forcedCritical: 0,
};

function tick() {
  if (state.paused) return;

  if (patient.forcedCritical > 0) {
    patient.forcedCritical--;
    patient.hr = clamp(patient.hr + (Math.random() - 0.3) * 18, 40, 195);
    patient.spo2 = clamp(patient.spo2 - Math.random() * 3, 65, 100);
  } else {
    patient.hr = walk(patient.hr, 55, 130, 4, 0.12, 78);
    patient.spo2 = walk(patient.spo2, 90, 100, 0.6, 0.15, 97);
    patient.temp = walk(patient.temp, 35.8, 39.0, 0.15, 0.1, 36.9);
    patient.sys = walk(patient.sys, 95, 150, 3, 0.1, 118);
    patient.dia = walk(patient.dia, 55, 100, 2, 0.1, 76);
  }

  const sample = {
    t: Date.now(),
    hr: +patient.hr.toFixed(0),
    spo2: +patient.spo2.toFixed(1),
    temp: +patient.temp.toFixed(1),
    sys: +patient.sys.toFixed(0),
    dia: +patient.dia.toFixed(0),
  };
  patient.history.push(sample);
  if (patient.history.length > 400) patient.history.shift();
  emit("vitals-update", { sample });

  const breach = sample.hr > 150 || sample.hr < 45 || sample.spo2 < 85 || sample.temp > 39.5;
  if (breach && !state.pipelineActive) {
    state.pipelineActive = true;
    emit("sensor-breach", { sample });
    runAlarmPipeline(sample);
  }
}

setInterval(tick, 500);

// Builds the sequence of real-world steps a critical alert must travel through.
// Each segment carries the human-readable label (for the log), an optional "transit"
// (a literal payload traveling from one node to another) and/or "cloudLines" (a short
// backend log revealed while the cloud is "thinking") — used to drive both the real
// timing and the matching 3D visuals at the exact same pace.
function buildPipeline(sample) {
  const bedId = "ICU-1";
  const vitalsPayload = `{hr:${sample.hr}, spo2:${sample.spo2}%, temp:${sample.temp}\u00b0C}`;
  const alarmPayload = `ALARM{code:CRITICAL, bed:"${bedId}"}`;

  if (state.mode === "edge") {
    const uplinkMs = 2 + Math.random() * 6;
    const decisionMs = 2 + Math.random() * 5;
    const notifyMs = 3 + Math.random() * 7;
    return {
      mode: "edge",
      offline: false,
      segments: [
        {
          label: "Bedside monitor forwards vitals to the on-site edge server room",
          duration: uplinkMs,
          transit: { from: "icu", to: "edge", text: `EDGE /ingest ${vitalsPayload}` },
        },
        {
          label: "Edge server evaluates thresholds locally inside the hospital",
          duration: decisionMs,
          localText: `if hr>150 or spo2<85: ${vitalsPayload} \u2192 CRITICAL`,
          edgeLines: [
            "edge-rule-engine: telemetry received from icu-monitor-01",
            `edge-rule-engine: hr=${sample.hr}, spo2=${sample.spo2}% \u2192 BREACH`,
            "edge-rule-engine: severity = CRITICAL",
          ],
        },
        {
          label: "Edge server sends alarm to the nurse station over the hospital LAN",
          duration: notifyMs,
          transit: { from: "edge", to: "nurse", text: alarmPayload },
        },
      ],
    };
  }

  if (!state.cloudOnline) {
    return {
      mode: "cloud",
      offline: true,
      segments: [
        {
          label: "Uploading vitals to cloud service\u2026",
          duration: 1200,
          transit: { from: "icu", to: "cloud", text: `POST /telemetry ${vitalsPayload}`, stall: true },
          cloudLines: ["conn: dialing api.cloud-monitor.io:443 \u2026"],
        },
        {
          label: "Retrying upload\u2026 no response",
          duration: 1200,
          transit: { from: "icu", to: "cloud", text: "POST /telemetry (retry 1/2)", stall: true },
          cloudLines: ["conn: timeout after 1200ms", "retry 1/2: dialing \u2026"],
        },
        {
          label: "Retrying upload\u2026 no response",
          duration: 1100,
          transit: { from: "icu", to: "cloud", text: "POST /telemetry (retry 2/2)", stall: true },
          cloudLines: ["conn: timeout after 1200ms", "retry 2/2: dialing \u2026", "conn: host unreachable", "giving up \u2014 no alarm sent"],
        },
      ],
    };
  }

  const uploadMs = 90 + Math.random() * 150;
  const cloudMs = 150 + Math.random() * 200;
  const downlinkMs = 100 + Math.random() * 150;
  return {
    mode: "cloud",
    offline: false,
    segments: [
      {
        label: "Vitals uploaded from ICU monitor to cloud",
        duration: uploadMs,
        transit: { from: "icu", to: "cloud", text: `POST /telemetry ${vitalsPayload}` },
        cloudLines: ["conn: accepted from icu-monitor-01", "POST /telemetry 200 OK"],
      },
      {
        label: "Cloud analytics evaluate thresholds \u2014 CRITICAL",
        duration: cloudMs,
        cloudLines: [
          "rule-engine: evaluating thresholds \u2026",
          `rule-engine: hr=${sample.hr} > 150 \u2192 BREACH`,
          "rule-engine: severity = CRITICAL",
          "dispatch: composing alarm command \u2026",
        ],
      },
      {
        label: "Alarm command sent back down to nurse station",
        duration: downlinkMs,
        transit: { from: "cloud", to: "nurse", text: alarmPayload },
        cloudLines: ["dispatch: PUSH alarm \u2192 nurse-station-01"],
      },
    ],
  };
}

function runAlarmPipeline(sample) {
  const plan = buildPipeline(sample);
  const total = plan.segments.reduce((s, seg) => s + seg.duration, 0);
  const t0 = performance.now();

  emit("alarm-path-start", { ...plan, total });

  let cursor = 0;
  plan.segments.forEach((seg, index) => {
    setTimeout(() => emit("segment-start", { ...seg, index, mode: plan.mode }), cursor);
    cursor += seg.duration;
  });

  setTimeout(() => {
    const actualElapsed = performance.now() - t0;
    if (plan.offline) {
      emit("alarm-timeout", { mode: plan.mode, total: actualElapsed });
    } else {
      patient.alarmActive = true;
      emit("alarm-sounding", { mode: plan.mode, total: actualElapsed });
    }
    // reset for the next run after a short cooldown
    setTimeout(() => {
      state.pipelineActive = false;
      patient.forcedCritical = 0;
      patient.alarmActive = false;
      emit("alarm-cleared", {});
    }, 3500);
  }, total);
}

// Idle cloud "heartbeat" so the backend terminal panel feels alive between critical events.
const IDLE_LINES = [
  "telemetry-sync: batch stored (icu-1)",
  "cloud-monitor-svc: heartbeat ok",
  "db: writing longitudinal record \u2026",
  "rule-engine: idle, awaiting telemetry",
];
setInterval(() => {
  if (state.paused || state.pipelineActive) return;
  const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
  emit("cloud-heartbeat", { line });
}, 4000);

export function setMode(mode) { state.mode = mode; emit("mode-change", { mode }); }
export function setCloudOnline(v) { state.cloudOnline = v; emit("network-change", { online: v }); }
export function setPaused(v) { state.paused = v; }
export function triggerCriticalEvent() {
  if (state.pipelineActive) return false;
  patient.forcedCritical = 10;
  patient.hr = 182;
  patient.spo2 = 74;
  return true;
}
