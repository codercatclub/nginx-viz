import { AssetManager } from "./lib/assetManager";
import { AgentSystem } from "./lib/agentSystem";
import { WebSocketHandler } from "./lib/webSocketHandler";
import { EnvironmentSystem } from "./lib/environmentSystem";
import { SoundPlayer } from "./lib/soundPlayer";
import * as THREE from 'three';

(async () => {

    const assetManager = new AssetManager()
    .addAsset("public/assets/models/castle.glb")
    .addAsset("public/assets/models/ground.glb")
    .addAsset("public/assets/models/running.fbx")
    .addAsset("public/assets/models/malicious.fbx")
    .addAsset("public/assets/models/enemy.fbx")
    .addAsset("public/assets/textures/codercat_cat.png")
    .addAsset("public/assets/sounds/spawn.mp3")
    .addAsset("public/assets/sounds/enter.mp3")
    .addAsset("public/assets/sounds/reject.mp3")
    .addAsset("public/assets/sounds/ambient.mp3");

  await assetManager.load();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.1, 1000 );
  
  const renderer = new THREE.WebGLRenderer();
  const container = document.getElementById('canvas-container');
  if (container) {
    container.appendChild(renderer.domElement);
  } else {
    document.body.appendChild(renderer.domElement);
  }
  
  function updateSize() {
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  
  updateSize();
  window.addEventListener('resize', updateSize);
  renderer.setAnimationLoop( animate );
  
  
  const soundPlayer = new SoundPlayer(assetManager);
  const environmentSystem = new EnvironmentSystem(scene, assetManager);
  const agentSystem = new AgentSystem(scene, assetManager, environmentSystem, camera, soundPlayer);
  
  // Handle sound button events
  window.addEventListener('play-sounds', () => {
    soundPlayer.resume();
    soundPlayer.playAmbient('ambient');
    soundPlayer.setMuted(false);
  });
  
  window.addEventListener('stop-sounds', () => {
    soundPlayer.stopAmbient();
    soundPlayer.setMuted(true);
  });

  const webSocketHandler = new WebSocketHandler();
  webSocketHandler.init(agentSystem);
  
  camera.position.set(50, 50, 50);
  camera.lookAt(13, 0, 13);

  const clock = new THREE.Clock();
  
  function animate() {
    const deltaTime = clock.getDelta();
    agentSystem.update(deltaTime);
    environmentSystem.update(deltaTime);
    renderer.render( scene, camera );
  }
})();
