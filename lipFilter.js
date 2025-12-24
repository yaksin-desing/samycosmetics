// lipFilter.js

const cameraPopup = document.getElementById('camera-popup');
const openBtn = document.getElementById('try-lips-btn');
const closeBtn = document.getElementById('close-camera');

const video = document.getElementById('camera-video');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');

let stream = null;
let currentLipColor = 'rgba(200,0,80,0.55)';
let faceMesh = null;
let cameraMP = null;

// ===============================
// LIPS INDICES
// ===============================
const LIPS = [
  61,146,91,181,84,17,314,405,321,375,291,
  308,324,318,402,317,14,87,178,88,95,78
];

// ===============================
// OPEN CAMERA
// ===============================
async function openCamera() {
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

// ===============================
// CLOSE CAMERA (FIXED)
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
// MEDIAPIPE INIT
// ===============================
function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) =>
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
    width: 640,
    height: 480
  });

  cameraMP.start();
}

// ===============================
// DRAW LIPS
// ===============================
function onResults(results) {
  if (!results.multiFaceLandmarks?.length) return;

  const landmarks = results.multiFaceLandmarks[0];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  ctx.beginPath();
  LIPS.forEach((i, index) => {
    const p = landmarks[i];
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();

  ctx.fillStyle = currentLipColor;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fill();

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
  currentLipColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`;
});

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
closeBtn.addEventListener('click', closeCamera);
