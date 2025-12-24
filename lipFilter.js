// ===============================
// ELEMENTS
// ===============================
const cameraPopup = document.getElementById('camera-popup');
const openBtn = document.getElementById('try-lips-btn');
const closeBtn = document.getElementById('close-camera');

const video = document.getElementById('camera-video');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');

let stream = null;
let faceMesh = null;
let cameraMP = null;
let running = false;

// ===============================
// COLOR STATE
// ===============================
let currentLipColor = 'rgba(200,0,80,0.55)';

// ===============================
// SMOOTHING (FAST & RESPONSIVE)
// ===============================
let smoothLandmarks = null;
const SMOOTH = 0.6;

// ===============================
// LIP LANDMARKS (PRECISOS)
// ===============================

// Contorno externo completo
const LIPS_OUTER = [
  61,185,40,39,37,0,267,269,270,409,291,
  375,321,405,314,17,84,181,91,146
];

// Contorno interno REAL (excluye dientes)
const LIPS_INNER = [
  78,191,80,81,82,13,
  312,311,310,415,308,
  324,318,402,317,14,87
];

// ===============================
// CAMERA CONTROL
// ===============================
async function openCamera() {
  if (running) return;
  running = true;

  cameraPopup.classList.add('active');

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  resizeCanvas();
  initFaceMesh();
}

function closeCamera() {
  running = false;
  cameraPopup.classList.remove('active');

  if (cameraMP) cameraMP.stop();
  if (faceMesh) faceMesh.close();

  cameraMP = null;
  faceMesh = null;
  smoothLandmarks = null;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    onFrame: async () => {
      if (running) await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });

  cameraMP.start();
}

// ===============================
// DRAW LIPS (EVEN-ODD MASK)
// ===============================
function drawLipsMask(landmarks) {
  ctx.beginPath();

  // Outer
  LIPS_OUTER.forEach((i, idx) => {
    const p = landmarks[i];
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();

  // Inner (hole)
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
  if (!results.multiFaceLandmarks?.length) return;

  const raw = results.multiFaceLandmarks[0];

  // FAST SMOOTH
  if (!smoothLandmarks) {
    smoothLandmarks = raw.map(p => ({ ...p }));
  } else {
    raw.forEach((p, i) => {
      smoothLandmarks[i].x += (p.x - smoothLandmarks[i].x) * (1 - SMOOTH);
      smoothLandmarks[i].y += (p.y - smoothLandmarks[i].y) * (1 - SMOOTH);
    });
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Adaptive softness
  const lipWidth =
    Math.abs(smoothLandmarks[61].x - smoothLandmarks[291].x) * canvas.width;

  ctx.save();
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = lipWidth * 0.08;

  drawLipsMask(smoothLandmarks);
  ctx.restore();
}

// ===============================
// RESIZE
// ===============================
function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

// ===============================
// COLOR FROM CAROUSEL
// ===============================
window.addEventListener('carouselColorChange', e => {
  const rgb = e.detail.color.match(/\d+/g);
  if (!rgb) return;
  currentLipColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`;
});

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
closeBtn.addEventListener('click', closeCamera);
window.addEventListener('resize', resizeCanvas);
