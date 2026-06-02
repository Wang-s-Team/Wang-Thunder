import * as THREE from "../../vendor/three.module.js";

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
    this.onBriefing = () => this.elements.briefing.classList.add("screen--active");
    this.onClose = () => this.elements.briefing.classList.remove("screen--active");
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

  const vehicle = createArmoredVehicle();
  vehicle.position.set(-2, 1.15, 0);
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

function createArmoredVehicle() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x283542, roughness: 0.62, metalness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.7, metalness: 0.35 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.7, 5.1), hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const turret = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.3, 3), hullMat);
  turret.position.set(0.6, 1.25, -0.15);
  turret.castShadow = true;
  group.add(turret);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 7.4, 18), trimMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(4.8, 1.45, -0.15);
  barrel.castShadow = true;
  group.add(barrel);

  for (const z of [-2.9, 2.9]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.72, 0.9), trimMat);
    track.position.set(0, -0.95, z);
    track.castShadow = true;
    group.add(track);
  }

  for (let i = 0; i < 5; i += 1) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.8), glowMat);
    light.position.set(-3.2 + i * 1.6, 0.3, 2.62);
    group.add(light);
  }

  return group;
}
