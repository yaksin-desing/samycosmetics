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



// ========= CÁMARA =========
const camera = new THREE.PerspectiveCamera(
  59,
  window.innerWidth / window.innerHeight,
  0.1,
  700
);
camera.position.set(0, 0.5, 2.5);


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
let animationsFinished = false;

gltfLoader.load("./samy.glb", (gltf) => {
  const root = gltf.scene;
  scene.add(root);
  root.position.set(-0.3, 0.5, 0);

  // -------- DETECTAR CÁMARA DEL GLB --------
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

  // -------- ANIMACIONES --------
  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(root);

    let cameraAction = null;
    const modelActions = [];

    gltf.animations.forEach((clip) => {
      const isCameraAnim = clip.tracks.some(t => t.name.toLowerCase().includes("camera"));

      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;

      if (isCameraAnim) {
        cameraAction = action;
      } else {
        modelActions.push(action);
      }
    });

    // Ejecutar todas las animaciones
    if (cameraAction) cameraAction.play();
    modelActions.forEach(a => a.play());

    // Detectar final de TODAS las animaciones
    let pending = modelActions.length + (cameraAction ? 1 : 0);

    const markFinished = () => {
      pending--;
      if (pending <= 0) animationsFinished = true;
    };

    if (cameraAction)
      cameraAction.addEventListener("finished", markFinished);

    modelActions.forEach(a =>
      a.addEventListener("finished", markFinished)
    );
  }

  clock.start();
});



// ========= STATS =========
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);




function animate() {
  stats.begin();
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer && !animationsFinished) {
    mixer.update(delta);
  }

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
