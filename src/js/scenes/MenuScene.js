import * as THREE from "../../vendor/three.module.js";
import { makeCombatant } from "../core/threeFactories.js";

export class MenuScene {
  constructor({ canvas, elements, storage, audio }) {
    this.canvas = canvas;
    this.elements = elements;
    this.storage = storage;
    this.audio = audio;
    this.world = createMenuWorld();
    this.onMode = (event) => {
      const mode = event.currentTarget.dataset.mode ?? "pve";
      this.audio.beep({ frequency: 220, duration: 0.12, type: "sawtooth", gain: 0.06 });
      this.manager.go("game", { mode });
    };
    this.onBriefing = () => {
      this.elements.briefing.classList.add("screen--active");
      this.elements.closeBriefing.focus();
    };
    this.onClose = () => this.elements.briefing.classList.remove("screen--active");
    this.onBriefingBackdrop = (event) => {
      if (event.target === this.elements.briefing) this.onClose();
    };
    this.onKeydown = (event) => {
      if (event.key === "Escape" && this.elements.briefing.classList.contains("screen--active")) {
        this.onClose();
      }
    };
  }

  enter() {
    const save = this.storage.load();
    this.elements.menu.classList.add("screen--active");
    this.elements.hud.classList.remove("hud--active");
    this.elements.result.classList.remove("screen--active");
    this.elements.bestScore.textContent = save.bestScore;
    this.elements.bestWave.textContent = save.bestWave;
    this.elements.startBtn.addEventListener("click", this.onMode);
    this.elements.duelBtn.addEventListener("click", this.onMode);
    this.elements.aiBtn.addEventListener("click", this.onMode);
    this.elements.howBtn.addEventListener("click", this.onBriefing);
    this.elements.closeBriefing.addEventListener("click", this.onClose);
    this.elements.briefing.addEventListener("click", this.onBriefingBackdrop);
    window.addEventListener("keydown", this.onKeydown);
    this.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
  }

  exit() {
    this.elements.menu.classList.remove("screen--active");
    this.elements.briefing.classList.remove("screen--active");
    this.elements.startBtn.removeEventListener("click", this.onMode);
    this.elements.duelBtn.removeEventListener("click", this.onMode);
    this.elements.aiBtn.removeEventListener("click", this.onMode);
    this.elements.howBtn.removeEventListener("click", this.onBriefing);
    this.elements.closeBriefing.removeEventListener("click", this.onClose);
    this.elements.briefing.removeEventListener("click", this.onBriefingBackdrop);
    window.removeEventListener("keydown", this.onKeydown);
  }

  update() {}

  resize(width, height) {
    this.world.camera.aspect = width / height;
    this.world.camera.updateProjectionMatrix();
  }

  render(renderer) {
    const time = performance.now() / 1000;
    this.world.vehicle.rotation.y = Math.sin(time * 0.42) * 0.18;
    this.world.radar.rotation.y = time * 0.32;
    this.world.beacons.forEach((beacon, index) => {
      beacon.position.y = 1.4 + Math.sin(time * 1.8 + index) * 0.28;
    });
    renderer.render(this.world.scene, this.world.camera);
  }
}

function createMenuWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  scene.fog = new THREE.Fog(0x07090d, 34, 122);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
  camera.position.set(18, 11, 30);
  camera.lookAt(0, 2.4, 0);

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(12, 18, 10);
  key.castShadow = true;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0x8edcff, 0x1b1e12, 1.7));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0x18202a,
      roughness: 0.82,
      metalness: 0.18,
      wireframe: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(160, 40, 0x43e0ff, 0x36424f);
  grid.material.opacity = 0.34;
  grid.material.transparent = true;
  scene.add(grid);

  const vehicle = makeCombatant({ color: 0x2f5f78, accent: 0xffd166 });
  vehicle.position.set(-1.2, 0, 0);
  vehicle.scale.setScalar(2.25);
  scene.add(vehicle);

  const radar = new THREE.Group();
  const dish = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.06, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x43e0ff }),
  );
  dish.rotation.x = Math.PI / 2;
  radar.add(dish);
  for (let i = 0; i < 3; i += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.035, 0.035),
      new THREE.MeshBasicMaterial({ color: 0x43e0ff }),
    );
    spoke.rotation.y = (Math.PI * 2 * i) / 3;
    radar.add(spoke);
  }
  radar.position.set(16, 0.08, -12);
  scene.add(radar);

  const beacons = [];
  for (let i = 0; i < 10; i += 1) {
    const beacon = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.4, 5),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd166 : 0x43e0ff }),
    );
    beacon.position.set(-34 + i * 7.5, 1.4, -28 - Math.sin(i) * 7);
    scene.add(beacon);
    beacons.push(beacon);
  }

  return { scene, camera, vehicle, radar, beacons };
}
