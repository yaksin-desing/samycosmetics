import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "three/addons/libs/stats.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

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
// OCULTAR LOADER
// ======================================================
function hideLoader() {
  const loader = document.getElementById("loading-screen");
  if (!loader) return;

  loader.style.opacity = "0";
  setTimeout(() => {
    loader.style.display = "none";
    loaderHidden = true;
    console.log("🟢 Loader oculto completamente");
  }, 600);
}

// ======================================================
// INICIO CONTROLADO DE LA ANIMACIÓN
// ======================================================
function startIfReady() {
  if (animationStarted) return;
  if (glbReady && loaderHidden && firstFrameRenderedAfterReady) {
    animationStarted = true;
    console.log("🔥 Todo listo → iniciando animación");
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
camera.position.set(0, 0.6, 3);

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
renderer.sortObjects = true; // importante para transparencias
renderer.physicallyCorrectLights = false;
container.appendChild(renderer.domElement);

// ======================================================
// POST FX (Bloom solo para objetos brillantes, no vidrio)
// ======================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom muy suave para objetos brillantes
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3, // fuerza baja
  0.1,  // radio
  0.85  // threshold alto (solo lo muy brillante)
);
composer.addPass(bloomPass); // comentar si quieres desactivarlo completamente

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

    gltf.scene.traverse((obj) => {
      if (obj.isCamera) {
        cameraGLB = obj;
        controls.enabled = false;
        cameraGLB.fov = 59;
        cameraGLB.aspect = window.innerWidth / window.innerHeight;
        cameraGLB.near = 0.1;
        cameraGLB.far = 700;
        cameraGLB.updateProjectionMatrix();
        console.log("📷 Cámara GLB enlazada");
        return;
      }

      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        const mat = obj.material;
        if (!mat) return;

        const isGlassLike =
          mat.transparent === true ||
          ("transmission" in mat && mat.transmission > 0) ||
          ("opacity" in mat && mat.opacity < 1);

        if (isGlassLike) {
          // ajustes clave para evitar ghosting / halos
          mat.depthWrite = false;
          obj.renderOrder = 999;
          mat.side = THREE.DoubleSide;
          mat.premultipliedAlpha = true;
          mat.blending = THREE.NormalBlending;
          mat.needsUpdate = true;
        } else {
          // objetos opacos pueden recibir bloom
          obj.layers.enable(1); // usar layer 1 para bloom
        }
      }
    });

    // Animaciones Blender
    mixer = new THREE.AnimationMixer(model);
    mixer.timeScale = 0;

    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.play();
    });

    mixer.addEventListener("finished", () => {
      animationsEnded = true;
      console.log("🎬 Animación terminada");
    });

    glbReady = true;
    console.log("🟢 GLB cargado");
    hideLoader();
  },
  undefined,
  (err) => console.error("Error GLB:", err)
);

// ======================================================
// STATS
// ======================================================
const stats = new Stats();
document.body.appendChild(stats.dom);

// ======================================================
// ANIMATE LOOP
// ======================================================
function animate() {
  requestAnimationFrame(animate);
  stats.begin();

  const delta = clock.getDelta();
  if (mixer && !animationsEnded && clock.running) {
    mixer.update(delta);
  }

  if (cameraGLB) {
    composer.passes[0].camera = cameraGLB;
  }

  composer.render();

  if (glbReady && loaderHidden && !firstFrameRenderedAfterReady) {
    firstFrameRenderedAfterReady = true;
    startIfReady();
  }

  stats.end();
}

animate();

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
