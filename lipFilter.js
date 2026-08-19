// ===============================
// ELEMENTS
// ===============================
const cameraPopup = document.getElementById('camera-popup');
const openBtn = document.getElementById('try-lips-btn');
const captureBtn = document.getElementById('capture-photo');
const backBtn = document.getElementById('back-camera');

let video = document.getElementById('camera-video');
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

// ===============================
// CONFIG
// ===============================
const SMOOTH = 0.55;

// ===============================
// SCANNER OVERLAY (pantalla de carga)
// ===============================
const SCAN_MIN_DURATION = 3000; // ms MÍNIMOS que se muestra el overlay, aunque todo cargue antes
let scanStartTime = 0;
let scanTimeElapsed = false;    // true cuando ya pasaron los 3s mínimos
let scanFaceReady = false;      // true en la primera detección válida de rostro
let scanHidden = true;
let scanRAF = null;

// El % ya NO es un timer lineal: avanza hacia "hitos" reales
// (cámara lista, librería/modelo cargado, filtro detectando, rostro confirmado)
let scanCurrentPercent = 0;
let scanTargetPercent = 0;

let scannerOverlayEl = null;
let scannerPercentEl = null;
let scannerStatusEl = null;
let scannerProgressFillEl = null;

function injectScannerStyles() {
  if (document.getElementById('scanner-overlay-styles')) return;

  const style = document.createElement('style');
  style.id = 'scanner-overlay-styles';
  style.textContent = `
    .scanner-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 28px 24px;
      background: rgba(0,0,0,0.25);
      backdrop-filter: blur(1px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.6s ease;
      z-index: 20;
      box-sizing: border-box;
    }
    .scanner-overlay.active { opacity: 1; pointer-events: auto; }
    .scanner-overlay.hiding { opacity: 0; }

    .scanner-title {
      color: rgba(255,255,255,0.92);
      font-family: inherit;
      font-size: 15px;
      letter-spacing: 0.3px;
      text-align: center;
      text-shadow: 0 1px 6px rgba(0,0,0,0.6);
    }

    .scanner-frame {
      position: relative;
      width: 78%;
      max-width: 420px;
      aspect-ratio: 3 / 4;
      flex: 1;
      margin: 18px 0;
    }

    .scanner-corner {
      position: absolute;
      width: 34px;
      height: 34px;
      border: 2px solid rgba(120,190,255,0.9);
      filter: drop-shadow(0 0 6px rgba(90,170,255,0.65));
      opacity: 0.9;
      animation: cornerPulse 2.2s ease-in-out infinite;
    }
    .corner-tl { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 6px 0 0 0; }
    .corner-tr { top: 0; right: 0; border-left: none; border-bottom: none; border-radius: 0 6px 0 0; }
    .corner-bl { bottom: 0; left: 0; border-right: none; border-top: none; border-radius: 0 0 0 6px; }
    .corner-br { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 6px 0; }

    @keyframes cornerPulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 1; }
    }

    .scanner-line {
      position: absolute;
      left: 6%;
      right: 6%;
      height: 2px;
      background: linear-gradient(90deg, rgba(120,190,255,0) 0%, rgba(150,205,255,0.95) 50%, rgba(120,190,255,0) 100%);
      box-shadow: 0 0 10px 2px rgba(120,190,255,0.7);
      animation: scanSweep 2s ease-in-out infinite;
    }

    @keyframes scanSweep {
      0%   { top: 8%; }
      50%  { top: 90%; }
      100% { top: 8%; }
    }

    .scanner-tickmarks {
      position: absolute;
      top: 8%;
      bottom: 8%;
      width: 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      opacity: 0.55;
    }
    .scanner-tickmarks.left { left: -18px; }
    .scanner-tickmarks.right { right: -18px; }
    .scanner-tickmarks span {
      display: block;
      width: 100%;
      height: 2px;
      background: rgba(120,190,255,0.8);
    }

    .scanner-bottom {
      position: absolute;
      left: 50%;
      bottom: var(--scanner-bottom-gap, 110px);
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: 78%;
      max-width: 420px;
    }

    .scanner-status {
      color: rgba(255,255,255,0.85);
      font-family: inherit;
      font-size: 13px;
      letter-spacing: 0.2px;
    }

    .scanner-progress-row {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
    }

    .scanner-percent {
      color: #ffffff;
      font-family: inherit;
      font-weight: 600;
      font-size: 20px;
      text-shadow: 0 0 12px rgba(120,190,255,0.5);
      line-height: 1;
      min-width: 42px;
      text-align: right;
      flex-shrink: 0;
    }

    .scanner-progress {
      flex: 1;
      height: 4px;
      border-radius: 4px;
      background: rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .scanner-progress-fill {
      height: 100%;
      width: 0%;
      border-radius: 4px;
      background: linear-gradient(90deg, rgba(90,170,255,0.9), rgba(160,215,255,0.95));
      box-shadow: 0 0 8px rgba(120,190,255,0.7);
      transition: width 0.25s ease-out;
    }
  `;
  document.head.appendChild(style);
}

function buildScannerOverlay() {
  if (scannerOverlayEl) return scannerOverlayEl;

  injectScannerStyles();

  const container = document.querySelector('.camera-container') || cameraPopup;
  if (window.getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-title">Posiciona tu rostro en el centro</div>
    <div class="scanner-frame">
      <span class="scanner-corner corner-tl"></span>
      <span class="scanner-corner corner-tr"></span>
      <span class="scanner-corner corner-bl"></span>
      <span class="scanner-corner corner-br"></span>
      <div class="scanner-tickmarks left">${'<span></span>'.repeat(8)}</div>
      <div class="scanner-tickmarks right">${'<span></span>'.repeat(8)}</div>
      <div class="scanner-line"></div>
    </div>
    <div class="scanner-bottom">
      <div class="scanner-status">Inicializando cámara...</div>
      <div class="scanner-progress-row">
        <span class="scanner-percent">0%</span>
        <div class="scanner-progress"><div class="scanner-progress-fill"></div></div>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  scannerOverlayEl = overlay;
  scannerPercentEl = overlay.querySelector('.scanner-percent');
  scannerStatusEl = overlay.querySelector('.scanner-status');
  scannerProgressFillEl = overlay.querySelector('.scanner-progress-fill');

  return overlay;
}

// Calcula cuánto espacio necesita scanner-bottom para quedar SIEMPRE
// por encima de los botones de captura/cancelar, sin importar el tamaño
// de pantalla (móvil o desktop). Se basa en la posición real de esos
// botones en vez de un valor fijo en px.
function positionScannerBottom() {
  if (!scannerOverlayEl) return;

  const container = document.querySelector('.camera-container') || cameraPopup;
  const refBtn = backBtn || captureBtn;
  if (!container || !refBtn) return;

  const containerRect = container.getBoundingClientRect();
  const btnRect = refBtn.getBoundingClientRect();

  // Si el botón no está visible todavía (rect vacío), no tocamos nada
  if (btnRect.width === 0 && btnRect.height === 0) return;

  const EXTRA_GAP = 18; // separación extra entre el texto/barra y los botones
  const offset = Math.max(40, containerRect.bottom - btnRect.top + EXTRA_GAP);

  scannerOverlayEl.style.setProperty('--scanner-bottom-gap', `${offset}px`);
}

function handleScannerResize() {
  if (!scanHidden) positionScannerBottom();
}
window.addEventListener('resize', handleScannerResize);

function setScanProgress(target, status) {
  // Sube el % objetivo (nunca retrocede) y actualiza el texto de estado.
  // La barra se anima suavemente HACIA ese objetivo en el tick de showScannerOverlay(),
  // en vez de saltar de golpe.
  scanTargetPercent = Math.max(scanTargetPercent, target);
  if (status && scannerStatusEl) scannerStatusEl.textContent = status;
}

function showScannerOverlay() {
  buildScannerOverlay();

  scanStartTime = performance.now();
  scanTimeElapsed = false;
  scanFaceReady = false;
  scanHidden = false;
  scanCurrentPercent = 0;
  scanTargetPercent = 6; // pequeño empujón inicial para que no se vea "congelado" en 0

  scannerOverlayEl.classList.remove('hiding');
  scannerOverlayEl.classList.add('active');

  // Esperamos un frame para que el layout ya esté aplicado antes de medir
  requestAnimationFrame(positionScannerBottom);

  if (scanRAF) cancelAnimationFrame(scanRAF);

  const tick = (now) => {
    const elapsed = now - scanStartTime;

    // Suaviza el avance hacia scanTargetPercent (que se mueve con hitos reales)
    scanCurrentPercent += (scanTargetPercent - scanCurrentPercent) * 0.12;
    if (scanTargetPercent - scanCurrentPercent < 0.4) {
      scanCurrentPercent = scanTargetPercent;
    }

    const displayPercent = Math.round(scanCurrentPercent);
    if (scannerPercentEl) scannerPercentEl.textContent = `${displayPercent}%`;
    if (scannerProgressFillEl) scannerProgressFillEl.style.width = `${displayPercent}%`;

    if (elapsed >= SCAN_MIN_DURATION) {
      scanTimeElapsed = true;
      maybeHideScannerOverlay();
    }

    if (!scanHidden) scanRAF = requestAnimationFrame(tick);
  };

  scanRAF = requestAnimationFrame(tick);
}

// Solo se oculta cuando ya pasaron los 3s mínimos Y el filtro
// (librería + modelo + detección de rostro) está realmente listo
function maybeHideScannerOverlay() {
  if (scanHidden) return;
  if (!scanTimeElapsed || !scanFaceReady) return;

  scanHidden = true;

  if (scanRAF) {
    cancelAnimationFrame(scanRAF);
    scanRAF = null;
  }

  if (scannerOverlayEl) {
    scannerOverlayEl.classList.add('hiding');
    scannerOverlayEl.classList.remove('active');
  }
}

function resetScannerOverlay() {
  scanTimeElapsed = false;
  scanFaceReady = false;
  scanHidden = true;
  scanCurrentPercent = 0;
  scanTargetPercent = 0;

  if (scanRAF) {
    cancelAnimationFrame(scanRAF);
    scanRAF = null;
  }

  if (scannerOverlayEl) {
    scannerOverlayEl.classList.remove('active', 'hiding');
    if (scannerPercentEl) scannerPercentEl.textContent = '0%';
    if (scannerProgressFillEl) scannerProgressFillEl.style.width = '0%';
    if (scannerStatusEl) scannerStatusEl.textContent = 'Inicializando cámara...';
  }
}

// ===============================
// LANDMARKS
// ===============================
const LIPS_OUTER = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  375, 321, 405, 314, 17, 84, 181, 91, 146
];

const LIPS_INNER = [
  78, 191, 80, 81, 82, 13,
  312, 311, 310, 415, 308,
  324, 318, 402, 317, 14, 87
];

// ===============================
// VIDEO RESET (FIX REAL)
// ===============================
function resetVideoElement() {
  const oldVideo = document.getElementById('camera-video');
  const newVideo = oldVideo.cloneNode(true);

  newVideo.srcObject = null;
  newVideo.removeAttribute('src');
  newVideo.load();

  oldVideo.parentNode.replaceChild(newVideo, oldVideo);
  return newVideo;
}

// ===============================
// CAMERA CONTROL
// ===============================
async function openCamera() {
  if (running) return;
  running = true;

  window.pauseThree ?.();
  cameraPopup.classList.add('active');

  // Pantalla de escaneo (3s) en lugar del óvalo punteado anterior
  showScannerOverlay();

  // 🔑 FIX: recrear el video SIEMPRE
  video = resetVideoElement();

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user'
    },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  // Hito real: la cámara ya está transmitiendo
  setScanProgress(35, 'Cámara lista, cargando filtro...');

  resizeCanvas();
  initFaceMesh();
}

function closeCamera() {
  if (!running) return;
  running = false;

  cameraPopup.classList.remove('active');

  try {
    cameraMP ?.stop();
    faceMesh ?.close();
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

  resetScannerOverlay();

  window.resumeThree ?.();
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

  // Hito real: modelo de detección facial cargado y configurado
  setScanProgress(65, 'Cargando modelo de detección...');

  cameraMP = new Camera(video, {
    onFrame: async () => running && faceMesh.send({
      image: video
    })
  });

  cameraMP.start();

  // Hito real: ya se está enviando frames a analizar
  setScanProgress(85, 'Detectando rostro...');
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
  if (!results.multiFaceLandmarks ?.length) {
    detectingFace = true;
    return;
  }

  detectingFace = false;
  const raw = results.multiFaceLandmarks[0];

  if (!smoothLandmarks) {
    smoothLandmarks = raw.map(p => ({
      ...p
    }));
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
  ctx.globalAlpha = 0.7

  drawLipsMask(smoothLandmarks);
  ctx.restore();

  // Primera detección válida -> el filtro ya está listo de verdad
  if (!scanFaceReady) {
    scanFaceReady = true;
    setScanProgress(100, '¡Listo!');
    maybeHideScannerOverlay();
  }
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
// CAPTURE (NO TOCADO)
// ===============================
captureBtn.addEventListener('click', async () => {

  const marco = document.querySelector('.marco');
  const flash = document.querySelector('.camera-flash');

  flash.classList.add('active');
  marco.classList.add('capture-visible');


  // 🔹 Actualizar fecha en el marco ANTES de capturar
  const fechaEl = document.getElementById('fecha-captura');
  if (fechaEl) {
    fechaEl.textContent = obtenerFechaActual();
  }

  await new Promise(r => requestAnimationFrame(r));

  const container = document.querySelector('.camera-container');
  const rect = container.getBoundingClientRect();

  const vw = Math.round(rect.width);
  const vh = Math.round(rect.height);
  const dpr = window.devicePixelRatio || 1;

  const output = document.createElement('canvas');
  output.width = vw * dpr;
  output.height = vh * dpr;

  const octx = output.getContext('2d');
  octx.scale(dpr, dpr);

  const videoW = video.videoWidth;
  const videoH = video.videoHeight;

  const videoRatio = videoW / videoH;
  const viewRatio = vw / vh;

  let sx = 0,
    sy = 0,
    sw = videoW,
    sh = videoH;

  if (videoRatio > viewRatio) {
    sw = sh * viewRatio;
    sx = (videoW - sw) / 2;
  } else {
    sh = sw / viewRatio;
    sy = (videoH - sh) / 2;
  }
  octx.save();
  octx.translate(vw, 0);
  octx.scale(-1, 1);
  octx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh);
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, vw, vh);
  octx.restore();


  html2canvas(marco, {
    backgroundColor: null,
    scale: dpr
  }).then(marcoCanvas => {

    octx.drawImage(marcoCanvas, 0, 0, vw, vh);

    flash.classList.remove('active');
    marco.classList.remove('capture-visible');

    const a = document.createElement('a');
    a.href = output.toDataURL('image/png');
    a.download = 'Test_labial_samy.png';
    a.click();
  });
});

// ===============================
// EVENTS
// ===============================
openBtn.addEventListener('click', openCamera);
backBtn.addEventListener('click', closeCamera);


function obtenerFechaActual() {
  const now = new Date();

  const dia = String(now.getDate()).padStart(2, '0');
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const año = now.getFullYear();

  return `${dia}/${mes}/${año}`;
}