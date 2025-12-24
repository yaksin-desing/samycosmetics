import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "three/addons/libs/stats.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// ======================================================
// 🔴 ADD — CONTROL GLOBAL DE RENDER
// ======================================================
let threeRunning = true;
let rafId = null;

// Exponer a window para usar desde la cámara
window.pauseThree = () => {
  threeRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
};

window.resumeThree = () => {
  if (!threeRunning) {
    threeRunning = true;
    animate();
  }
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
let animationsEnded = false;

// ======================================================
// MATERIALES INTERACTIVOS + TRANSICIONES
// ======================================================
const materialesInteractivos = {
  contenido: null,
  mcontenido: null
};

const colorTargets = {
  contenido: new THREE.Color(),
  mcontenido: new THREE.Color()
};

const colorLerpSpeed = 0.08;

// ======================================================
// OCULTAR LOADER
// ======================================================
function hideLoader() {
  const loader = document.getElementById("loading-screen");
  if (!loader) return;

  loader.style.opacity = "0";
  setTimeout(() => {
    loader.style.display = "none";
    loaderHidden = true;
  }, 600);
}

// ======================================================
// INICIO CONTROLADO DE LA ANIMACIÓN
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
// RENDERER
// ======================================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  premultipliedAlpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// ======================================================
// POST FX
// ======================================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.05,
  0.1,
  0.1
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

loader.load(
  "samy.glb",
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
        obj.castShadow = true;
        obj.receiveShadow = true;

        const matName = obj.material.name;

        if (matName === "contenido" || matName === "mcontenido") {
          materialesInteractivos[matName] = obj.material;
          colorTargets[matName].copy(obj.material.color);
        }

        const mat = obj.material;
        const isGlassLike =
          mat.transparent ||
          mat.transmission > 0 ||
          mat.opacity < 1;

        if (isGlassLike) {
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
        } else {
          obj.layers.enable(1);
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
    hideLoader();
  }
);

// ======================================================
// PARALLAX INPUT
// ======================================================
let mouseX = 0;
let targetMouseX = 0;
let gyroX = 0;
let targetGyroX = 0;

window.addEventListener("mousemove", (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
});

window.addEventListener("deviceorientation", (e) => {
  targetGyroX = THREE.MathUtils.clamp(-e.gamma / 20, -3, 3);
});

const lerpFactor = 0.05;
const cameraTarget = new THREE.Vector3(0, 0.5, 0);

// ======================================================
// 🟢 MODIFY — ANIMATE LOOP CON PAUSA REAL
// ======================================================
function animate() {
  if (!threeRunning) return;

  rafId = requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer && clock.running && !animationsEnded) {
    mixer.update(delta);
  }

  mouseX += (targetMouseX - mouseX) * lerpFactor;
  gyroX += (targetGyroX - gyroX) * lerpFactor;

  if (cameraGLB) {
    cameraGLB.position.x = (mouseX + gyroX) * 0.5;
    cameraGLB.lookAt(cameraTarget);
    composer.passes[0].camera = cameraGLB;
  }

  if (materialesInteractivos.contenido) {
    materialesInteractivos.contenido.color.lerp(
      colorTargets.contenido,
      colorLerpSpeed
    );
  }

  if (materialesInteractivos.mcontenido) {
    materialesInteractivos.mcontenido.color.lerp(
      colorTargets.mcontenido,
      colorLerpSpeed
    );
  }

  composer.render();

  if (glbReady && loaderHidden && !firstFrameRenderedAfterReady) {
    firstFrameRenderedAfterReady = true;
    startIfReady();
  }
}

animate();

// ======================================================
// EVENTO DESDE EL CARRUSEL
// ======================================================
window.addEventListener("carouselColorChange", (e) => {
  const baseColor = new THREE.Color(e.detail.color);

  if (materialesInteractivos.contenido) {
    colorTargets.contenido.copy(baseColor);
  }

  if (materialesInteractivos.mcontenido) {
    colorTargets.mcontenido.copy(baseColor).multiplyScalar(0.85);
  }
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
