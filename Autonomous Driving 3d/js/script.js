/* UI + physics logic for the 3D autonomous-driving demo */

// ---- Guided tour (onboarding) ----
const tourSteps = [
  {
    title: 'Welcome to the 3D scene',
    text: `You're looking at a self-driving car 🚗 on a road at night. Ahead of it stands a child 🚸 near the roadside. To the right is a nearby <b>V2X roadside unit</b> 📡 (a small "brain" close to the road that talks directly with the car — V2X means Vehicle-to-Everything). Far in the distance, glowing in the haze, is a <b>Cloud Datacenter</b> ☁️ (a big "brain" very far away). You can drag with your mouse anytime to look around once the free camera is enabled.`,
  },
  {
    title: 'The problem: a split-second decision',
    text: `When you press Run, the car will first drive in from a distance at <b>90 km/h</b> — just cruising, like normal. The moment its camera spots the child (👀 "Child spotted!"), it must send what it sees to a computer, get told "STOP!", and only then start braking (🛑 sign). Every millisecond spent waiting is more distance covered at full speed before the brakes even engage.`,
  },
  {
    title: 'Your mission',
    text: `Pick where the car asks for help: the <b>nearby V2X roadside unit</b> (fast), the <b>far away Cloud</b> (slow), or the <b>Cloud Continuum</b> (fast local reaction + cloud learning in the background). Press <b>Run Simulation</b> and watch the glowing 📦 packet travel, then see if the car stops safely — or crashes.`,
  },
];
let tourIndex = 0;

const tourBox = document.getElementById('tourBox');
const tourStepLabel = document.getElementById('tourStepLabel');
const tourTitle = document.getElementById('tourTitle');
const tourText = document.getElementById('tourText');
const tourPrev = document.getElementById('tourPrev');
const tourNext = document.getElementById('tourNext');
const controlPanel = document.getElementById('controlPanel');
const legend = document.getElementById('legend');

function renderTour() {
  const step = tourSteps[tourIndex];
  tourStepLabel.textContent = `Step ${tourIndex + 1} of ${tourSteps.length}`;
  tourTitle.textContent = step.title;
  tourText.innerHTML = step.text;
  tourPrev.disabled = tourIndex === 0;
  tourNext.textContent = tourIndex === tourSteps.length - 1 ? 'Start Simulation 🚀' : 'Next →';
}

tourPrev.addEventListener('click', () => { if (tourIndex > 0) { tourIndex--; renderTour(); } });
tourNext.addEventListener('click', () => {
  if (tourIndex < tourSteps.length - 1) {
    tourIndex++;
    renderTour();
  } else {
    tourBox.hidden = true;
    controlPanel.hidden = false;
    legend.hidden = false;
  }
});

renderTour();

// ---- Physics (illustrative, not exact) ----
const SPEED = 25;             // m/s (~90 km/h)
const DECEL = 7;              // m/s^2
const OBSTACLE_DISTANCE = 48; // meters

const ARCH = {
  cloud:     { label: '☁️ Cloud Only',      latencyMs: 200 },
  edge:      { label: '📡 Edge / V2X',       latencyMs: 8 },
  continuum: { label: '🌐 Cloud Continuum', latencyMs: 8 },
};

const ROW_INDEX = { cloud: 0, edge: 1, continuum: 2 };
const completedRuns = new Set();
const BRAKE_DURATION = 1.6; // seconds, must match the visual braking tween in scene.js

function visualWaitDurationFor(latencyMs) {
  // Map real latency to an on-screen duration so both extremes stay watchable.
  return Math.min(2.4, Math.max(0.5, 0.5 + (latencyMs / 200) * 1.9));
}

// ---- DOM refs ----
const runBtn = document.getElementById('runBtn');
const resetBtn = document.getElementById('resetBtn');
const camBtn = document.getElementById('camBtn');
const resultPanel = document.getElementById('resultPanel');
const resultTitle = document.getElementById('resultTitle');
const metricsList = document.getElementById('metricsList');
const compareBody = document.getElementById('compareBody');
const brakeToast = document.getElementById('brakeToast');
const detectToast = document.getElementById('detectToast');

let freeCameraOn = false;
camBtn.addEventListener('click', () => {
  freeCameraOn = !freeCameraOn;
  camBtn.textContent = `🎥 Free Camera: ${freeCameraOn ? 'ON' : 'OFF'}`;
  Scene.setFreeCamera(freeCameraOn);
});

resetBtn.addEventListener('click', () => {
  Scene.resetScene();
  resultPanel.hidden = true;
  brakeToast.hidden = true;
  detectToast.hidden = true;
  runBtn.disabled = false;
});

function getSelectedArch() {
  return document.querySelector('input[name="arch"]:checked').value;
}

function runSimulation() {
  const archKey = getSelectedArch();
  const arch = ARCH[archKey];
  runBtn.disabled = true;
  resultPanel.hidden = true;
  brakeToast.hidden = true;
  detectToast.hidden = true;
  Scene.resetScene();

  const latencySec = arch.latencyMs / 1000;
  const reactionDistance = SPEED * latencySec;
  const brakingDistance = (SPEED * SPEED) / (2 * DECEL);
  const totalStopDistance = reactionDistance + brakingDistance;
  const isSafe = totalStopDistance < OBSTACLE_DISTANCE;
  const margin = OBSTACLE_DISTANCE - totalStopDistance;

  Scene.playScenario({
    archKey,
    reactionDistance,
    brakingDistance,
    totalStopDistance,
    isSafe,
    visualWaitDuration: visualWaitDurationFor(arch.latencyMs),
    brakeDuration: BRAKE_DURATION,
    onDetect: () => {
      detectToast.hidden = false;
      setTimeout(() => { detectToast.hidden = true; }, 900);
    },
    onBrakeStart: () => {
      brakeToast.hidden = false;
      setTimeout(() => { brakeToast.hidden = true; }, BRAKE_DURATION * 1000);
    },
  }, () => {
    showResult(arch, latencySec, reactionDistance, brakingDistance, totalStopDistance, isSafe, margin, archKey);
    updateCompareRow(archKey, arch, reactionDistance, totalStopDistance, isSafe);
    completedRuns.add(archKey);
    runBtn.disabled = false;
  });
}

function showResult(arch, latencySec, reactionDistance, brakingDistance, totalStopDistance, isSafe, margin, archKey) {
  resultPanel.hidden = false;
  resultTitle.textContent = isSafe ? `✅ ${arch.label}: Safe stop!` : `💥 ${arch.label}: Collision!`;
  resultTitle.style.color = isSafe ? 'var(--accent)' : 'var(--warn)';

  let extraNote = '';
  if (archKey === 'continuum') {
    extraNote = `<li>🌐 The cloud is learning from this event in the background, without slowing the brake decision.</li>`;
  }

  metricsList.innerHTML = `
    <li>Waiting time for an answer <b>${(latencySec * 1000).toFixed(0)} ms</b></li>
    <li>Distance driven at full speed <b>${reactionDistance.toFixed(2)} m</b></li>
    <li>Braking distance <b>${brakingDistance.toFixed(1)} m</b></li>
    <li>Total stopping distance <b>${totalStopDistance.toFixed(1)} m</b></li>
    <li>Distance to child <b>${OBSTACLE_DISTANCE} m</b></li>
    <li>${isSafe ? `Safety margin <b>${margin.toFixed(1)} m</b>` : `Overshoot <b>${Math.abs(margin).toFixed(1)} m</b>`}</li>
    ${extraNote}
  `;
}

function updateCompareRow(archKey, arch, reactionDistance, totalStopDistance, isSafe) {
  const row = compareBody.children[ROW_INDEX[archKey]];
  const cells = row.children;
  cells[1].textContent = `${arch.latencyMs} ms`;
  cells[2].textContent = `${reactionDistance.toFixed(2)} m`;
  cells[3].textContent = `${totalStopDistance.toFixed(1)} m`;
  cells[4].textContent = isSafe ? 'Safe ✅' : 'Crash 💥';
  cells[4].className = isSafe ? 'safe' : 'crash';
}

runBtn.addEventListener('click', runSimulation);

// ---- Boot ----
window.addEventListener('DOMContentLoaded', () => {
  Scene.init();
});
