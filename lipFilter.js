// ===============================
// ELEMENTS
// ===============================
const cameraPopup = document.getElementById('camera-popup');
const openBtn = document.getElementById('try-lips-btn');
const closeBtn = document.getElementById('close-camera');
const captureBtn = document.getElementById('capture-photo');

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
  running = false;

  cameraPopup.classList.remove('active');

  cameraMP?.stop();
  faceMesh?.close();

  cameraMP = null;
  faceMesh = null;
  smoothLandmarks = null;
  detectingFace = true;

  stream?.getTracks().forEach(t => t.stop());
  stream = null;

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
// ASPECT FIX
// ===============================
function getAspectFix() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = canvas.width;
  const ch = canvas.height;

  const videoAR = vw / vh;
  const canvasAR = cw / ch;

  if (Math.abs(videoAR - canvasAR) < 0.01) {
    return { scaleX: 1, offsetX: 0 };
  }

  const scaleX = videoAR / canvasAR;
  return { scaleX, offsetX: (1 - scaleX) / 2 };
}

// ===============================
// FACE GUIDE (UX)
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
  ctx.ellipse(
    w / 2,
    h / 2,
    w * 0.22,
    h * 0.32,
    0,
    0,
    Math.PI * 2
  );
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
  requestAnimationFrame(guideLoop);
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
  const fix = getAspectFix();

  const lipWidth =
    Math.abs(smoothLandmarks[61].x - smoothLandmarks[291].x) * canvas.width;

  ctx.save();

  // 💄 LABIAL REALISTA (NO TOCA DIENTES)
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = currentLipColor;
  ctx.globalAlpha = 0.45;
  ctx.shadowColor = currentLipColor;
  ctx.shadowBlur = lipWidth * 0.03;

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
  octx.drawImage(video, 0, 0, output.width, output.height);
  octx.drawImage(canvas, 0, 0);

  downloadImage(output.toDataURL('image/png'));
});

// ===============================
// DOWNLOAD
// ===============================
function downloadImage(dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'labialsamy.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
closeBtn.addEventListener('click', closeCamera);
