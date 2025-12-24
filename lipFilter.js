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

// Color desde carrusel
let currentLipColor = 'rgba(200,0,80,0.6)';

// ===============================
// MEDIAPIPE INDICES OFICIALES
// ===============================

// Contorno externo completo de labios (UNA SOLA MALLA)
const LIPS_OUTER = [
  61,185,40,39,37,0,267,269,270,409,291,
  375,321,405,314,17,84,181,91,146,61
];

// Boca interna (dientes + lengua)
const MOUTH_INNER = [
  78,95,88,178,87,14,
  317,402,318,324,308
];

// ===============================
// OPEN CAMERA
// ===============================
async function openCamera() {
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

// ===============================
// CLOSE CAMERA
// ===============================
function closeCamera() {
  cameraPopup.classList.remove('active');

  if (cameraMP) {
    cameraMP.stop();
    cameraMP = null;
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ===============================
// MEDIAPIPE INIT (OPTIMIZED)
// ===============================
function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
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
      await faceMesh.send({ image: video });
    },
    width: 480,
    height: 360
  });

  cameraMP.start();
}

// ===============================
// DRAW PATH
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
// ON RESULTS (FINAL LOGIC)
// ===============================
function onResults(results) {
  if (!results.multiFaceLandmarks?.length) return;

  const landmarks = results.multiFaceLandmarks[0];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  // 🎨 1. Pintar labios completos
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.65;

  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = 8;

  drawPath(LIPS_OUTER, landmarks);

  // ✂️ 2. Quitar boca interna (dientes + lengua)
  ctx.globalCompositeOperation = 'destination-out';
  drawPath(MOUTH_INNER, landmarks);

  ctx.restore();
}

// ===============================
// RESIZE
// ===============================
function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

window.addEventListener('resize', resizeCanvas);

// ===============================
// COLOR FROM CAROUSEL
// ===============================
window.addEventListener('carouselColorChange', (e) => {
  const rgb = e.detail.color.match(/\d+/g);
  if (!rgb) return;
  currentLipColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.65)`;
});

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
closeBtn.addEventListener('click', closeCamera);
