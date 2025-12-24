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

let currentLipColor = 'rgba(200,0,80,0.65)';

// ===============================
// LANDMARKS
// ===============================
const LIPS_OUTER = [
  61,185,40,39,37,0,267,269,270,409,291,
  375,321,405,314,17,84,181,91,146
];

const LIPS_INNER = [
  78,95,88,178,87,14,
  317,402,318,324,308
];

const MOUTH_HOLE = [
  13,312,311,310,415,308,
  324,318,402,317,14,87,
  178,88,95,78
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
// RESULTS
// ===============================
function onResults(results) {
  if (!results.multiFaceLandmarks?.length) return;

  const landmarks = results.multiFaceLandmarks[0];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  ctx.save();

  // 1️⃣ Pintar labio completo
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.65;
  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = 6;

  drawPath(LIPS_OUTER, landmarks);

  // 2️⃣ Quitar interior del labio
  ctx.globalCompositeOperation = 'destination-out';
  drawPath(LIPS_INNER, landmarks);

  // 3️⃣ Quitar boca abierta (DIENTES + ENCÍAS)
  drawPath(MOUTH_HOLE, landmarks);

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
  currentLipColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.65)`;
});

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
closeBtn.addEventListener('click', closeCamera);
window.addEventListener('resize', resizeCanvas);
