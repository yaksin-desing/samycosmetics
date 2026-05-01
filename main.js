import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// ======================================================
// 🔴 CONTROL GLOBAL DE RENDER (PAUSA REAL)
// ======================================================
let threeRunning = true;
let rafId = null;

window.pauseThree = () => {
  if (!threeRunning) return;
  threeRunning = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  clock.stop();
  controls.enabled = false;
  console.log("⏸️ Three.js PAUSADO — render detenido");
};

window.resumeThree = () => {
  if (threeRunning) return;
  threeRunning = true;
  clock.start();
  controls.enabled = true;
  console.log("▶️ Three.js REANUDADO — render activo");
  animate();
};

// ======================================================
// ESTADOS DE CARGA / CONTROL
// ======================================================
let glbReady = false;
let loaderHidden = false;
let firstFrameRenderedAfterReady = false;
let animationStarted = false;

const clock = new THREE.Clock(false);
let mixer = null;
let cameraGLB = null;

// ======================================================
// MATERIALES INTERACTIVOS
// ======================================================
const materialesInteractivos = { contenido: null, mcontenido: null };
const colorTargets = {
  contenido: new THREE.Color(),
  mcontenido: new THREE.Color()
};
const colorLerpSpeed = 0.08;

// ======================================================
// LOADER — usa saMyLoader (loader/loader.js)
//
// IMPORTANTE: en el HTML el orden debe ser:
//   <script src="./loader/loader.js"></script>        ← sin type="module"
//   <script type="module" src="./main.js"></script>   ← después
//
// saMyLoader.hide() despacha el evento 'loaderHidden'
// cuando termina el fade-out. Este archivo lo escucha
// para desbloquear la animación.
// ======================================================

function startIfReady() {
  if (animationStarted) return;
  if (glbReady && loaderHidden && firstFrameRenderedAfterReady) {
    animationStarted = true;
    if (mixer) {
      mixer.timeScale = 1;
      clock.start();
    }
  }
}

window.addEventListener("loaderHidden", () => {
  loaderHidden = true;
  startIfReady();
});

// ======================================================
// ESCENA
// ======================================================
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ======================================================
// CÁMARA
// ======================================================
const camera = new THREE.PerspectiveCamera(
  59,
  window.innerWidth / window.innerHeight,
  0.1,
  700
);
camera.position.set(0, 0, 3);

// ======================================================
// RENDERER (OPTIMIZADO)
// ======================================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "low-power"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// ======================================================
// POST FX
// ======================================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.2, 0.1, 0.2
);
composer.addPass(bloomPass);

// ======================================================
// CONTROLES
// ======================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ======================================================
// CARGA GLB
// ======================================================
const loader = new GLTFLoader();

// ── Reemplazá el bloque loader.load() en main.js por esto ──

loader.load(
  "samy.glb",

  // ✅ onLoad
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    model.position.set(-0.2, -0.2, -0.2);

    model.traverse((obj) => {
      if (obj.isCamera) {
        cameraGLB = obj;
        controls.enabled = false;
        cameraGLB.fov = 70;
        cameraGLB.aspect = window.innerWidth / window.innerHeight;
        cameraGLB.updateProjectionMatrix();
        return;
      }
      if (obj.isMesh && obj.material) {
        const matName = obj.material.name;
        if (matName === "contenido" || matName === "mcontenido") {
          materialesInteractivos[matName] = obj.material;
          colorTargets[matName].copy(obj.material.color);
        }
      }
    });

    mixer = new THREE.AnimationMixer(model);
    mixer.timeScale = 0;
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.play();
    });

    glbReady = true;
    // ✅ Avisa al loader que el modelo está listo — sin window.saMyLoader
    window.dispatchEvent(new CustomEvent("glbReady"));
  },

  // ✅ onProgress
  (xhr) => {
    if (xhr.total > 0) {
      window.dispatchEvent(new CustomEvent("glbProgress", {
        detail: { pct: (xhr.loaded / xhr.total) * 100 }
      }));
    }
  },

  // ✅ onError — no bloquea la app si el modelo falla
  (error) => {
    console.error("Error al cargar el modelo:", error);
    glbReady = true;
    window.dispatchEvent(new CustomEvent("glbProgress", { detail: { pct: 100 } }));
    window.dispatchEvent(new CustomEvent("glbReady"));
  }
);

// ======================================================
// PARALLAX
// ======================================================
let mouseX = 0;
let targetMouseX = 0;
window.addEventListener("mousemove", (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
});
const lerpFactor = 0.05;
const cameraTarget = new THREE.Vector3(0, 0.5, 0);

// ======================================================
// 🔁 LOOP (CON PAUSA REAL)
// ======================================================
function animate() {
  if (!threeRunning) return;
  rafId = requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer && clock.running) mixer.update(delta);

  mouseX += (targetMouseX - mouseX) * lerpFactor;

  if (cameraGLB) {
    cameraGLB.position.x = mouseX * 0.5;
    cameraGLB.lookAt(cameraTarget);
    composer.passes[0].camera = cameraGLB;
  }

  if (materialesInteractivos.contenido) {
    materialesInteractivos.contenido.color.lerp(colorTargets.contenido, colorLerpSpeed);
  }
  if (materialesInteractivos.mcontenido) {
    materialesInteractivos.mcontenido.color.lerp(colorTargets.mcontenido, colorLerpSpeed);
  }

  composer.render();

  // Primer frame tras GLB listo — necesario para startIfReady
  if (glbReady && !firstFrameRenderedAfterReady) {
    firstFrameRenderedAfterReady = true;
    startIfReady();
  }
}

animate();

// ======================================================
// COLOR DESDE CARRUSEL
// ======================================================
window.addEventListener("carouselColorChange", (e) => {
  const baseColor = new THREE.Color(e.detail.color);
  if (materialesInteractivos.contenido) colorTargets.contenido.copy(baseColor);
  if (materialesInteractivos.mcontenido) colorTargets.mcontenido.copy(baseColor).multiplyScalar(0.85);
});

// ======================================================
// RESIZE
// ======================================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (cameraGLB) {
    cameraGLB.aspect = window.innerWidth / window.innerHeight;
    cameraGLB.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});