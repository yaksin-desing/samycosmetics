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
// SMOOTHING
// ===============================
let smoothLandmarks = null;
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

  console.log("🎥 Cámara ABIERTA → solicitando pausa de Three.js");

  if (window.pauseThree) {
    window.pauseThree();
  } else {
    console.warn("⚠️ pauseThree no existe");
  }

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
  if (!running) return;
  running = false;

  console.log("❌ Cámara CERRADA → reanudando Three.js");

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

  if (window.resumeThree) {
    window.resumeThree();
  } else {
    console.warn("⚠️ resumeThree no existe");
  }
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
    height: 360
  });

  cameraMP.start();
}

// ===============================
// ANDROID ASPECT FIX
// ===============================
function getAspectFix() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = canvas.width;
  const ch = canvas.height;

  if (!vw || !vh) return { scaleX: 1, offsetX: 0 };

  const videoAR = vw / vh;
  const canvasAR = cw / ch;

  if (Math.abs(videoAR - canvasAR) < 0.01) {
    return { scaleX: 1, offsetX: 0 };
  }

  const scaleX = videoAR / canvasAR;
  const offsetX = (1 - scaleX) / 2;

  return { scaleX, offsetX };
}

// ===============================
// DRAW LIPS
// ===============================
function drawLipsMask(landmarks, fix) {
  ctx.beginPath();

  LIPS_OUTER.forEach((i, idx) => {
    const p = landmarks[i];
    const x = (p.x * fix.scaleX + fix.offsetX) * canvas.width;
    const y = p.y * canvas.height;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();

  LIPS_INNER.forEach((i, idx) => {
    const p = landmarks[i];
    const x = (p.x * fix.scaleX + fix.offsetX) * canvas.width;
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

  if (!smoothLandmarks) {
    smoothLandmarks = raw.map(p => ({ ...p }));
  } else {
    raw.forEach((p, i) => {
      smoothLandmarks[i].x += (p.x - smoothLandmarks[i].x) * (1 - SMOOTH);
      smoothLandmarks[i].y += (p.y - smoothLandmarks[i].y) * (1 - SMOOTH);
    });
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fix = getAspectFix();

  const lipWidth =
    Math.abs(smoothLandmarks[61].x - smoothLandmarks[291].x) * canvas.width;

  ctx.save();
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.85;
  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = lipWidth * 0.06;

  drawLipsMask(smoothLandmarks, fix);

  const mouthOpen =
    Math.abs(smoothLandmarks[13].y - smoothLandmarks[14].y) * canvas.height;

  if (mouthOpen > lipWidth * 0.08) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    MOUTH_OPENING.forEach((i, idx) => {
      const p = smoothLandmarks[i];
      const x = (p.x * fix.scaleX + fix.offsetX) * canvas.width;
      const y = p.y * canvas.height;
      idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
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


// ===============================
// CAPTURE PHOTO
// ===============================
const captureBtn = document.getElementById('capture-photo');

captureBtn.addEventListener('click', capturePhoto);

function capturePhoto() {
  if (!video.videoWidth || !video.videoHeight) return;

  // Canvas final
  const output = document.createElement('canvas');
  output.width = video.videoWidth;
  output.height = video.videoHeight;

  const octx = output.getContext('2d');

  // 1️⃣ Frame del video
  octx.drawImage(video, 0, 0, output.width, output.height);

  // 2️⃣ Labios (canvas overlay)
  octx.drawImage(canvas, 0, 0, output.width, output.height);

  // 3️⃣ Exportar imagen
  const image = output.toDataURL('image/png');

  downloadImage(image);
}

// ===============================
// DOWNLOAD IMAGE
// ===============================
function downloadImage(dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'lip-filter.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
