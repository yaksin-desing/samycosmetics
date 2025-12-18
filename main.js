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
renderer.sortObjects = true;
renderer.physicallyCorrectLights = false;
container.appendChild(renderer.domElement);

// ======================================================
// POST FX (Bloom solo para objetos brillantes, no vidrio)
// ======================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3, // fuerza baja
  0.1, // radio
  0.85 // threshold alto (solo lo muy brillante)
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

    gltf.scene.traverse((obj) => {
      if (obj.isCamera) {
        cameraGLB = obj;
        controls.enabled = false;
        cameraGLB.fov = 70;
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
          mat.depthWrite = false;
          obj.renderOrder = 999;
          mat.side = THREE.DoubleSide;
          mat.premultipliedAlpha = true;
          mat.blending = THREE.NormalBlending;
          mat.needsUpdate = true;
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
//document.body.appendChild(stats.dom);

// ======================
// VARIABLES PARA PARALLAX (mouse + giroscopio)
// ======================
let mouseX = 0;
let targetMouseX = 0;
let gyroX = 0;
let targetGyroX = 0;

// ======================
// EVENTO MOUSE
// ======================
window.addEventListener("mousemove", (event) => {
  targetMouseX = (event.clientX / window.innerWidth - 0.5) * 2; // -1 a 1
});

// ======================
// EVENTO GIROSCOPIO (Android / móviles)
// ======================
window.addEventListener("deviceorientation", (event) => {
  // event.gamma es rotación en el eje Y del dispositivo (-90 a 90)
  // invertimos para que coincida visualmente
  targetGyroX = THREE.MathUtils.clamp(-event.gamma / 20, -3, 3); 
});

// ======================
// LERP Y SUAVIZADO
// ======================
const lerpFactor = 0.05; // suavizado
const cameraTarget = new THREE.Vector3(0, 0.5, 0); // mirar al centro del modelo

// ======================
// ANIMATE LOOP
// ======================
function animate() {
  requestAnimationFrame(animate);
  stats.begin();

  const delta = clock.getDelta();
  if (mixer && !animationsEnded && clock.running) {
    mixer.update(delta);
  }

  // suavizado mouse + giroscopio
  mouseX += (targetMouseX - mouseX) * lerpFactor;
  gyroX += (targetGyroX - gyroX) * lerpFactor;

  const finalX = (mouseX + gyroX) * 0.5; // combinación de ambos inputs

  if (cameraGLB) {
    cameraGLB.position.x = finalX; 
    cameraGLB.lookAt(cameraTarget);
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
