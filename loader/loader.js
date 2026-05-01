// ======================================================
// SAMY — loader.js  (v4 — espera 100% visual antes de ocultar)
// ======================================================

(function () {

  const TUBE_COLORS = [
    'linear-gradient(180deg, #e8806a, #c45a42)',
    'linear-gradient(180deg, #e8967a, #c46852)',
    'linear-gradient(180deg, #d4706a, #a84848)',
    'linear-gradient(180deg, #e8a080, #c47060)',
    'linear-gradient(180deg, #c46060, #943838)',
  ];

  const TUBES = TUBE_COLORS.length;

  const STATUS_STEPS = [
    { at: 0,   label: 'Preparando escena'        },
    { at: 20,  label: 'Cargando geometrías'       },
    { at: 40,  label: 'Compilando shaders'        },
    { at: 60,  label: 'Cargando texturas'         },
    { at: 78,  label: 'Inicializando animaciones' },
    { at: 90,  label: 'Configurando cámara'       },
    { at: 100, label: 'Lista para brillar'        },
  ];

  let screen, pctEl, lineEl, statusEl;
  const fills = [];

  let currentPct  = 0;
  let targetPct   = 0;
  let rafId       = null;
  let glbDone     = false;   // true cuando main.js dispara glbReady
  let hidePending = false;   // true cuando estamos esperando llegar al 100% visual

  // ── Lerp loop ──
  function tick() {
    currentPct += (targetPct - currentPct) * 0.06;

    if (pctEl)  pctEl.textContent  = Math.round(currentPct) + '%';
    if (lineEl) lineEl.style.width = currentPct + '%';

    const filled = (currentPct / 100) * TUBES * 100;
    for (let i = 0; i < TUBES; i++) {
      const pct = Math.min(100, Math.max(0, filled - i * 100));
      if (fills[i]) fills[i].style.height = pct + '%';
    }

    // ── Cuando la animación visual llega al 100% y el glb ya cargó → ocultar ──
    if (hidePending && currentPct >= 99.5) {
      hidePending = false;
      doFadeOut();
      return; // cancelamos el RAF dentro de doFadeOut
    }

    rafId = requestAnimationFrame(tick);
  }

  function updateStatus(pct) {
    if (!statusEl) return;
    let label = STATUS_STEPS[0].label;
    for (const s of STATUS_STEPS) { if (pct >= s.at) label = s.label; }
    statusEl.textContent = label;
  }

  function setProgress(pct) {
    // El progreso de descarga nunca pasa del 90%
    // El 90→100% lo recorremos solo cuando glbReady se dispara
    const capped = Math.min(90, pct);
    targetPct = Math.max(targetPct, capped); // nunca retrocede
    updateStatus(targetPct);
  }

  function hide() {
    glbDone = true;
    // Llevar la barra al 100% — el tick() se encargará de ocultar
    // cuando currentPct alcance 99.5
    targetPct = 100;
    updateStatus(100);
    hidePending = true;
  }

  function doFadeOut() {
    cancelAnimationFrame(rafId);
    if (screen) {
      screen.style.opacity = '0';
      setTimeout(() => {
        screen.style.display = 'none';
        window.dispatchEvent(new CustomEvent('loaderHidden'));
      }, 600);
    }
  }

  function buildTubes() {
    const tubesEl = document.getElementById('sl-tubes');
    if (!tubesEl) return;

    TUBE_COLORS.forEach((color) => {
      const wrap  = document.createElement('div'); wrap.className  = 'sl-tube-wrap';
      const cap   = document.createElement('div'); cap.className   = 'sl-cap';
      const body  = document.createElement('div'); body.className  = 'sl-body';
      const fill  = document.createElement('div'); fill.className  = 'sl-fill';
      fill.style.background = color;
      const shine = document.createElement('div'); shine.className = 'sl-shine';
      const nub   = document.createElement('div'); nub.className   = 'sl-nub';

      body.appendChild(fill);
      body.appendChild(shine);
      wrap.appendChild(cap);
      wrap.appendChild(body);
      wrap.appendChild(nub);
      tubesEl.appendChild(wrap);
      fills.push(fill);
    });
  }

  function init() {
    screen   = document.getElementById('loading-screen');
    pctEl    = document.getElementById('sl-pct');
    lineEl   = document.getElementById('sl-line');
    statusEl = document.getElementById('sl-status');

    buildTubes();
    tick();

    window.addEventListener('glbProgress', (e) => setProgress(e.detail.pct));
    window.addEventListener('glbReady',    ()  => hide());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();