// ===============================
// ELEMENTS
// ===============================
const cameraPopup = document.getElementById('camera-popup');
const openBtn = document.getElementById('try-lips-btn');
const closeBtn = document.getElementById('close-camera');

const video = document.getElementById('camera-video');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');

// ===============================
// STATE
// ===============================
let stream = null;
let cameraMP = null;
let faceMesh = null;
let running = false;
let faceMeshReady = false;

let currentLipColor = 'rgba(200,0,80,0.55)';

// ===============================
// LANDMARKS (OFICIALES MEDIAPIPE)
// ===============================

// Contorno externo del labio (solo piel)
const LIPS_OUTER = [
  61,185,40,39,37,0,267,269,270,409,291,
  375,321,405,314,17,84,181,91,146
];

// Contorno interno del labio (para vaciar interior)
const LIPS_INNER = [
  78,95,88,178,87,14,
  317,402,318,324,308
];

// ===============================
// CAMERA CONTROL
// ===============================
async function openCamera() {
  if (running) return;
  running = true;

  cameraPopup.classList.add('active');

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 720 },
      height: { ideal: 1280 }
    },
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
  cameraMP = null;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ===============================
// MEDIAPIPE INIT (UNA SOLA VEZ)
// ===============================
function initFaceMesh() {
  if (faceMeshReady) return;
  faceMeshReady = true;

  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onResults);

  cameraMP = new Camera(video, {
    onFrame: async () => {
      if (running) {
        await faceMesh.send({ image: video });
      }
    },
    width: 480,
    height: 360
  });

  cameraMP.start();
}

// ===============================
// DRAW HELPERS
// ===============================
function drawPath(indices, landmarks) {
  ctx.beginPath();
  indices.forEach((i, idx) => {
    const p = landmarks[i];
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

// ===============================
// RESULTS (ULTRA FLUIDO)
// ===============================
function onResults(results) {
  if (!results.multiFaceLandmarks?.length) return;

  const lm = results.multiFaceLandmarks[0];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // ===============================
  // COLOR BASE
  // ===============================
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.55;

  // Ligero blur solo visual (NO smoothing matemático)
  const lipWidth =
    Math.abs(lm[61].x - lm[291].x) * canvas.width;

  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = lipWidth * 0.08;

  // 1️⃣ Pintar labio completo
  drawPath(LIPS_OUTER, lm);

  // 2️⃣ Vaciar interior (NO dientes, NO lengua)
  ctx.globalCompositeOperation = 'destination-out';
  drawPath(LIPS_INNER, lm);

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
