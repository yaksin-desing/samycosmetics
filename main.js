import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import Stats from "three/addons/libs/stats.module.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";
RectAreaLightUniformsLib.init();
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Reflector } from "three/addons/objects/Reflector.js";




// ========= CONTENEDOR =========
const container = document.getElementById("canvas-container");
if (!container) throw new Error("Falta <div id='canvas-container'> en tu HTML");


// ========= ESCENA =========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);


// // ========= LUZ DIRECCIONAL =========
// const dirLight = new THREE.DirectionalLight(0xffffff, 7);
// dirLight.position.set(5, 4, 0); // altura y dirección de luz
// dirLight.castShadow = false;

// // Config sombra suave
// dirLight.shadow.mapSize.width = 2048;
// dirLight.shadow.mapSize.height = 2048;
// dirLight.shadow.camera.near = 0.5;
// dirLight.shadow.camera.far = 50;

// // Ampliar área de sombras para que no se corten
// dirLight.shadow.camera.left = -20;
// dirLight.shadow.camera.right = 20;
// dirLight.shadow.camera.top = 20;
// dirLight.shadow.camera.bottom = -20;

// scene.add(dirLight);

// // Opcional: helper para ver desde dónde ilumina
// const dirHelper = new THREE.DirectionalLightHelper(dirLight, 3);
// scene.add(dirHelper);

// // ========= LUZ DIRECCIONAL =========
// const dirLight2 = new THREE.DirectionalLight(0xffffff, 7);
// dirLight2.position.set(-5, 4, 0); // altura y dirección de luz
// scene.add(dirLight2);



// ========= CÁMARA =========
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 0, 3);


// ========= RENDERER =========
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,

});
renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// =====================================================
// === POST-PROCESSING =================================
// =====================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.1,
  0.1,
  0.0
);
composer.addPass(bloomPass);


// ========= ORBIT CONTROLS =========
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;
controls.target.set(0, 1, 0);
controls.update();







// ========= CARGA MODELO =========
const gltfLoader = new GLTFLoader();
let mixer = null;
let cameraGLB = null;
const clock = new THREE.Clock();

gltfLoader.load("./samy.glb", (gltf) => {
  const root = gltf.scene;
  scene.add(root);

  colorConfigs.forEach(cfg => {
    const obj = root.getObjectByName(cfg.name);
    if (obj) {
      cfg.mesh = obj;
      cfg.originalColor = obj.material.color.clone();
    }
  });

  root.traverse((obj) => {
    if (obj.isCamera) {
      cameraGLB = obj;
      controls.enabled = false;

      cameraGLB.fov = 75;
      cameraGLB.aspect = window.innerWidth / window.innerHeight;
      cameraGLB.near = 0.1;
      cameraGLB.far = 500;
      cameraGLB.updateProjectionMatrix();
    }

    if (obj.isMesh && obj.material) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(root);

    let cameraAction = null;
    let modelActions = [];
    let cameraClip = null;
    let modelClips = [];

    gltf.animations.forEach((clip) => {
      const isCameraAnim = clip.tracks.some(t =>
        t.name.toLowerCase().includes("camera")
      );

      if (isCameraAnim) cameraClip = clip;
      else modelClips.push(clip);
    });

    if (cameraClip) {
      cameraAction = mixer.clipAction(cameraClip);
      cameraAction.setLoop(THREE.LoopRepeat);
      cameraAction.clampWhenFinished = false;
      cameraAction.play();
    }

    modelClips.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = false;
      action.play();
      modelActions.push(action);
    });

    mixer.addEventListener("loop", (e) => {
      if (e.action === cameraAction) {
        modelActions.forEach(a => {
          a.reset();
          a.play();
        });
      }
    });
  }

  // =====================================================
  // ESCENA LISTA → ACTIVAR ANIMACIONES
  // =====================================================
  setTimeout(() => {
    ready = true;
    clock.start();
  }, 0);

});


// ========= STATS =========
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);


// =====================================================
// === PARPADEO AZUL SOBRE COLOR ORIGINAL ==============
// =====================================================
function smoothBlink(cfg, frame, fps) {
  const durationFrames = cfg.frameEnd - cfg.frameStart;
  const totalBlinks = 3;
  const blinkDuration = durationFrames / totalBlinks;

  const localFrame = frame - cfg.frameStart;
  let blinkIndex = Math.floor(localFrame / blinkDuration);

  if (blinkIndex >= totalBlinks) {
    cfg.mesh.material.color.copy(cfg.originalColor);
    return;
  }

  let phase = (localFrame % blinkDuration) / blinkDuration;
  let intensity = Math.sin(phase * Math.PI);

  cfg.mesh.material.color.copy(cfg.originalColor).lerp(cfg.colorAlt, intensity);
}


// ========= LOOP =========
function animate() {
  stats.begin();
  requestAnimationFrame(animate);

  const delta = clock.getDelta();



  if (!cameraGLB) controls.update();

  renderPass.camera = cameraGLB || camera;
  composer.render();

  stats.end();
}

animate();


// ========= RESIZE =========
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  if (cameraGLB) {
    cameraGLB.aspect = innerWidth / innerHeight;
    cameraGLB.updateProjectionMatrix();
  }

  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(innerWidth, innerHeight);

});
