// ===============================
// ELEMENTS
// ===============================
const cameraPopup = document.getElementById('camera-popup');
const openBtn = document.getElementById('try-lips-btn');
const captureBtn = document.getElementById('capture-photo');
const backBtn = document.getElementById('back-camera');

const video = document.getElementById('camera-video');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');

// ===============================
// STATE
// ===============================
let stream = null;
let faceMesh = null;
let cameraMP = null;
let running = false;

let currentLipColor = 'rgba(200,0,80,0.55)';
let smoothLandmarks = null;

// UX
let detectingFace = true;
let guidePhase = 0;
let guideRAF = null;

// ===============================
// CONFIG
// ===============================
const SMOOTH = 0.55;

// ===============================
// LANDMARKS
// ===============================
const LIPS_OUTER = [
  61,185,40,39,37,0,267,269,270,409,291,
  375,321,405,314,17,84,181,91,146
];

const LIPS_INNER = [
  78,191,80,81,82,13,
  312,311,310,415,308,
  324,318,402,317,14,87
];

const MOUTH_OPENING = [
  13,312,311,310,415,308,
  324,318,402,317,14,87
];

// ===============================
// CAMERA CONTROL
// ===============================
async function openCamera() {
  if (running) return;
  running = true;

  window.pauseThree?.();
  cameraPopup.classList.add('active');

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  resizeCanvas();
  initFaceMesh();
  guideLoop();
}

function closeCamera() {
  if (!running) return;
  running = false;

  cameraPopup.classList.remove('active');

  if (guideRAF) {
    cancelAnimationFrame(guideRAF);
    guideRAF = null;
  }

  try {
    cameraMP?.stop();
    faceMesh?.close();
  } catch {}

  cameraMP = null;
  faceMesh = null;
  smoothLandmarks = null;
  detectingFace = true;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  window.resumeThree?.();
}

// ===============================
// MEDIAPIPE
// ===============================
function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: f =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  faceMesh.onResults(onResults);

  cameraMP = new Camera(video, {
    onFrame: async () => running && faceMesh.send({ image: video })
  });

  cameraMP.start();
}

// ===============================
// FACE GUIDE (OVALO)
// ===============================
function drawFaceGuide() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);

  guidePhase += 0.6;
  ctx.lineDashOffset = -guidePhase;

  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.22, h * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.font = '16px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('Detectando rostro…', w / 2, h * 0.75);

  ctx.restore();
}

function guideLoop() {
  if (!running) return;
  if (detectingFace) drawFaceGuide();
  guideRAF = requestAnimationFrame(guideLoop);
}

// ===============================
// DRAW LIPS
// ===============================
function drawLipsMask(landmarks) {
  ctx.beginPath();

  LIPS_OUTER.forEach((i, idx) => {
    const p = landmarks[i];
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();

  LIPS_INNER.forEach((i, idx) => {
    const p = landmarks[i];
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();

  ctx.fill('evenodd');
}

// ===============================
// RESULTS
// ===============================
function onResults(results) {
  if (!results.multiFaceLandmarks?.length) {
    detectingFace = true;
    return;
  }

  detectingFace = false;
  const raw = results.multiFaceLandmarks[0];

  if (!smoothLandmarks) {
    smoothLandmarks = raw.map(p => ({ ...p }));
  } else {
    raw.forEach((p, i) => {
      smoothLandmarks[i].x += (p.x - smoothLandmarks[i].x) * (1 - SMOOTH);
      smoothLandmarks[i].y += (p.y - smoothLandmarks[i].y) * (1 - SMOOTH);
    });
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.45;

  drawLipsMask(smoothLandmarks);
  ctx.restore();
}

// ===============================
// RESIZE
// ===============================
function resizeCanvas() {
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
}
window.addEventListener('resize', resizeCanvas);

// ===============================
// COLOR
// ===============================
window.addEventListener('carouselColorChange', e => {
  const rgb = e.detail.color.match(/\d+/g);
  if (!rgb) return;
  currentLipColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`;
});

// ===============================
// CAPTURE
// ===============================
captureBtn.addEventListener('click', () => {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;

  const octx = output.getContext('2d');
  octx.drawImage(video, 0, 0);
  octx.drawImage(canvas, 0, 0);

  const a = document.createElement('a');
  a.href = output.toDataURL('image/png');
  a.download = 'labialsamy.png';
  a.click();
});

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
backBtn.addEventListener('click', closeCamera);
