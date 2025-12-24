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
let faceMesh = null;
let cameraMP = null;
let running = false;

let currentLipColor = 'rgba(200,0,80,0.55)';

// ===============================
// SMOOTHING (ULTRA FAST)
// ===============================
let smoothLandmarks = null;
const SMOOTH = 0.55; // balance perfecto fluidez / precisión

// ===============================
// LANDMARKS (PRECISOS)
// ===============================

// Contorno externo real del labio
const LIPS_OUTER = [
  61,185,40,39,37,0,267,269,270,409,291,
  375,321,405,314,17,84,181,91,146
];

// Contorno interno del labio (NO dientes)
const LIPS_INNER = [
  78,191,80,81,82,13,
  312,311,310,415,308,
  324,318,402,317,14,87
];

// Hueco real de la boca (solo cuando se abre)
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
    width: 480,
    height: 360 // 🔥 CLAVE: menor resolución = más FPS
  });

  cameraMP.start();
}

// ===============================
// DRAW LIPS MASK (EVEN-ODD)
// ===============================
function drawLipsMask(landmarks) {
  ctx.beginPath();

  // OUTER
  LIPS_OUTER.forEach((i, idx) => {
    const p = landmarks[i];
    ctx[idx === 0 ? 'moveTo' : 'lineTo'](
      p.x * canvas.width,
      p.y * canvas.height
    );
  });
  ctx.closePath();

  // INNER LIP
  LIPS_INNER.forEach((i, idx) => {
    const p = landmarks[i];
    ctx[idx === 0 ? 'moveTo' : 'lineTo'](
      p.x * canvas.width,
      p.y * canvas.height
    );
  });
  ctx.closePath();

  ctx.fill('evenodd');
}

// ===============================
// RESULTS (RÁPIDO + PRECISO)
// ===============================
function onResults(results) {
  if (!results.multiFaceLandmarks?.length) return;

  const raw = results.multiFaceLandmarks[0];

  // 🔥 FAST SMOOTH
  if (!smoothLandmarks) {
    smoothLandmarks = raw.map(p => ({ ...p }));
  } else {
    raw.forEach((p, i) => {
      smoothLandmarks[i].x += (p.x - smoothLandmarks[i].x) * (1 - SMOOTH);
      smoothLandmarks[i].y += (p.y - smoothLandmarks[i].y) * (1 - SMOOTH);
    });
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ===============================
  // ADAPTIVE LIP WIDTH (MOBILE FIX)
  // ===============================
  const lipWidth =
    Math.abs(smoothLandmarks[61].x - smoothLandmarks[291].x) * canvas.width;

  ctx.save();
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.85;

  // Blur MUY controlado (no lag)
  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = lipWidth * 0.06;

  // 1️⃣ Labios
  drawLipsMask(smoothLandmarks);

  // 2️⃣ Quitar dientes SOLO si la boca se abre
  const mouthOpen =
    Math.abs(
      smoothLandmarks[13].y - smoothLandmarks[14].y
    ) * canvas.height;

  if (mouthOpen > lipWidth * 0.08) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    MOUTH_OPENING.forEach((i, idx) => {
      const p = smoothLandmarks[i];
      ctx[idx === 0 ? 'moveTo' : 'lineTo'](
        p.x * canvas.width,
        p.y * canvas.height
      );
    });
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ===============================
// RESIZE
// ===============================
function resizeCanvas() {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  canvas.width = vw;
  canvas.height = vh;
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
