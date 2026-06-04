import * as THREE from "../../vendor/three.module.js";
import { radioLines } from "../../data/prompts.js";
import {
  makeBase,
  makeBattlefield,
  makeDust,
  makeExplosion,
  makeLabelSprite,
  makeMuzzleFlash,
  makeCombatant,
  makeTracer,
} from "../core/threeFactories.js";

const ROUND_SECONDS = 240;
const ARENA = { x: 120, zMin: -250, zMax: 50 };
const ARENA_CENTER_Z = (ARENA.zMin + ARENA.zMax) / 2;
const PROJECTILE_BOUNDS = { x: ARENA.x + 80, zMin: ARENA.zMin - 90, zMax: ARENA.zMax + 90 };
const BASE_RADIUS = 20;
const BASE_CAPTURE_SECONDS = 6;
const CIWS_RATE_PER_SECOND = 13000 / 60;
const ENERGY_MAX = 100;
const ENERGY_RECHARGE_PER_SECOND = 42;
const ENERGY_MOVE_PER_SECOND = 4.2;
const ENERGY_SPRINT_EXTRA_PER_SECOND = 3;
const ENERGY_SHOT_COST = 16;
const ENERGY_DYNAMITE_COST = 38;
const ENERGY_BEARING_COST = 24;
const ENERGY_CIWS_ROUND_COST = 0.06;
const DYNAMITE_RADIUS = 10.5;
const DYNAMITE_DAMAGE = 18;
const DYNAMITE_KNOCKBACK = 50;
const DYNAMITE_LIFT = 13;
const BEARING_DAMAGE = 7;
const BEARING_SLIP_SECONDS = 2.6;
const BEARING_SLIP_IMPULSE = 30;
const BLAST_GRAVITY = 34;
const STARLINK_COOLDOWN_SECONDS = 18;
const MODES = {
  pve: { name: "人机对战", controllers: ["human1", "ai"], phase: "玩家一号 VS AI" },
  pvp: { name: "本地双人", controllers: ["human1", "human2"], phase: "本地双人对战" },
  aivai: { name: "机机对战", controllers: ["ai", "ai"], phase: "AI 裁判观战" },
};

export class GameScene {
  constructor({ canvas, input, elements, audio }) {
    this.canvas = canvas;
    this.input = input;
    this.elements = elements;
    this.audio = audio;
    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointerNdc = new THREE.Vector2();
    this.cameraDirection = new THREE.Vector3();
  }

  enter(payload = {}) {
    this.mode = payload.mode ?? "pve";
    this.modeInfo = MODES[this.mode] ?? MODES.pve;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090d);
    this.scene.fog = new THREE.Fog(0x07090d, 150, 680);
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 820);
    this.camera.position.set(-16, 3.1, 32);

    setupLighting(this.scene);
    const battlefield = makeBattlefield();
    this.navBlockers = battlefield.userData.navBlockers ?? [];
    this.attackBlockers = battlefield.userData.attackBlockers ?? [];
    this.scene.add(battlefield);

    this.bases = [
      this.createBase({
        ownerId: 1,
        name: "蓝方基地",
        color: 0x2f5f78,
        accent: 0x43e0ff,
        x: -78,
        z: 28,
      }),
      this.createBase({
        ownerId: 2,
        name: "红方基地",
        color: 0x743941,
        accent: 0xff4f64,
        x: 78,
        z: -228,
      }),
    ];

    this.vehicles = [
      this.createVehicle({
        id: 1,
        name: "蓝方雷霆",
        controller: this.modeInfo.controllers[0],
        color: 0x2f5f78,
        accent: 0x43e0ff,
        x: -74,
        z: 24,
        heading: 0,
      }),
      this.createVehicle({
        id: 2,
        name: "红方错题",
        controller: this.modeInfo.controllers[1],
        color: 0x743941,
        accent: 0xff4f64,
        x: 74,
        z: -224,
        heading: Math.PI,
      }),
    ];

    this.projectiles = [];
    this.sparks = [];
    this.tracers = [];
    this.flashes = [];
    this.starlinkEffects = [];
    this.dust = [];
    this.clock = 0;
    this.roundTime = ROUND_SECONDS;
    this.paused = false;
    this.finished = false;
    this.shake = 0;
    this.dustTimer = 0;
    this.hitTimer = 0;
    this.damageFlash = 0;
    this.coverLogCooldown = 0;
    this.waveAlertTimer = 2.6;
    this.radio = radioLines[0];
    this.radioTimer = 3.2;
    this.logs = [];
    this.navigationActive = false;
    this.navigator = null;
    this.navFocus = new THREE.Vector3(-78, 0, 28);
    this.firstPerson = {
      yaw: 0,
      pitch: 0,
      eyeHeight: 3.05,
      bob: 0,
      recoil: 0,
    };

    this.elements.hud.classList.add("hud--active");
    this.elements.hud.classList.add("hud--first-person");
    this.elements.pause.classList.remove("pause-layer--active");
    this.pushLog(`${this.modeInfo.name} 已启动`);
    this.pushLog("点击画面锁定鼠标，WASD 移动，左键开火，右键/Q 雷管，R 发射滚珠轴承，E 呼叫星链");
    this.resize(window.innerWidth, window.innerHeight);
    this.updateHud();
  }

  exit() {
    this.elements.hud.classList.remove("hud--active");
    this.elements.hud.classList.remove("hud--first-person");
    this.elements.pause.classList.remove("pause-layer--active");
    this.input.releasePointerLock?.();
    this.disposeScene();
  }

  resize(width, height) {
    if (!this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (this.input.consumePause()) {
      this.paused = !this.paused;
      this.elements.pause.classList.toggle("pause-layer--active", this.paused);
      this.pushLog(this.paused ? "战斗暂停" : "战斗继续");
    }
    if (this.paused || this.finished) {
      this.updateHud();
      return;
    }

    this.clock += dt;
    this.roundTime = Math.max(0, this.roundTime - dt);
    this.shake = Math.max(0, this.shake - dt * 8);
    this.firstPerson.recoil = Math.max(0, this.firstPerson.recoil - dt * 5.2);
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    this.coverLogCooldown = Math.max(0, this.coverLogCooldown - dt);
    this.waveAlertTimer = Math.max(0, this.waveAlertTimer - dt);
    this.radioTimer -= dt;
    this.dustTimer -= dt;

    if (this.radioTimer <= 0) {
      this.radio = radioLines[Math.floor(Math.random() * radioLines.length)];
      this.radioTimer = 5 + Math.random() * 4;
    }

    for (const vehicle of this.vehicles) {
      if (!vehicle.alive) continue;
      vehicle.cooldown = Math.max(0, vehicle.cooldown - dt);
      vehicle.starlinkCooldown = Math.max(0, vehicle.starlinkCooldown - dt);
      vehicle.invincible = Math.max(0, vehicle.invincible - dt);
      this.updateVehicle(vehicle, dt);
    }

    this.updateBases(dt);

    if (this.dustTimer <= 0) {
      this.addTrackDust();
      this.dustTimer = 0.055;
    }

    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.resolveHits();
    this.updateNavigationState(dt);
    this.updateStarlink();
    this.updateCamera(dt);
    this.updateHud();

    if (this.roundTime <= 0) {
      this.finishRound(this.pickWinnerByScore(), "TIME");
    }
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  createVehicle({ id, name, controller, color, accent, x, z, heading }) {
    const group = makeCombatant({ color, accent });
    const label = makeLabelSprite(`${id === 1 ? "P1" : "P2"} ${controller === "ai" ? "AI" : "HUM"}`, accent);
    label.position.y = 4.15;
    label.scale.set(4.2, 1.28, 1);
    group.add(label);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    this.scene.add(group);
    return {
      id,
      name,
      controller,
      color,
      accent,
      x,
      z,
      heading,
      health: 100,
      energy: ENERGY_MAX,
      score: 0,
      hits: 0,
      cooldown: 0.8,
      starlinkCooldown: 0,
      invincible: 0,
      energyBlockCooldown: 0,
      slipTimer: 0,
      slipPhase: 0,
      slipSpin: 0,
      alive: true,
      group,
      velocity: new THREE.Vector3(),
      blastVelocity: new THREE.Vector3(),
      slipVelocity: new THREE.Vector3(),
      verticalVelocity: 0,
      air: 0,
      aimPoint: new THREE.Vector3(x, 0, z),
      ai: {
        strafe: id === 1 ? 1 : -1,
        fireBias: 0.5 + Math.random() * 0.4,
      },
    };
  }

  createBase({ ownerId, name, color, accent, x, z }) {
    const group = makeBase({ name, color, accent, radius: BASE_RADIUS });
    group.position.set(x, 0, z);
    this.scene.add(group);
    return {
      ownerId,
      name,
      color,
      accent,
      x,
      z,
      radius: BASE_RADIUS,
      capture: 0,
      ciwsAccumulator: 0,
      group,
      turret: group.userData.turret,
      muzzle: group.userData.muzzle,
      captureRing: group.userData.captureRing,
      perimeter: group.userData.perimeter,
    };
  }

  updateVehicle(vehicle, dt) {
    const enemy = this.enemyOf(vehicle);
    if (!enemy) return;
    vehicle.energyBlockCooldown = Math.max(0, vehicle.energyBlockCooldown - dt);
    vehicle.slipTimer = Math.max(0, vehicle.slipTimer - dt);
    vehicle.slipPhase += dt * (vehicle.slipTimer > 0 ? 14 : 4);
    this.updateKettleEnergy(vehicle, dt);
    if (vehicle.controller === "human1") {
      this.updateFirstPersonVehicle(vehicle, enemy, dt);
      return;
    }

    let axis = vehicle.controller === "ai" ? this.aiAxis(vehicle, enemy) : this.input.axisFor(vehicle.id);
    const aimPoint = this.aimPointFor(vehicle, enemy);
    const length = Math.hypot(axis.x, axis.y) || 1;
    const speed = vehicle.controller === "ai" ? 16.4 : 18.2;
    const wantsMove = Math.hypot(axis.x, axis.y) > 0.05;
    const slipControl = this.slipControlFor(vehicle);
    if (wantsMove && !this.trySpendMoveEnergy(vehicle, dt, false)) {
      axis = { x: 0, y: 0 };
    }
    const dx = (axis.x / length) * speed * slipControl * dt;
    const dz = (axis.y / length) * speed * slipControl * dt;
    vehicle.x = THREE.MathUtils.clamp(vehicle.x + dx, -ARENA.x, ARENA.x);
    vehicle.z = THREE.MathUtils.clamp(vehicle.z + dz, ARENA.zMin, ARENA.zMax);
    vehicle.velocity.set(dx / Math.max(dt, 0.001), 0, dz / Math.max(dt, 0.001));

    vehicle.aimPoint.copy(aimPoint);
    const aim = angleToTarget(vehicle, aimPoint);
    vehicle.heading = lerpAngle(vehicle.heading, aim, Math.min(1, dt * 4.2));
    if (vehicle.slipTimer > 0) {
      vehicle.heading = wrapAngle(vehicle.heading + vehicle.slipSpin * dt * 0.38);
    }
    this.applySlipMotion(vehicle, dt);
    this.applyBlastMotion(vehicle, dt);
    this.resolveVehicleCoverCollision(vehicle);
    vehicle.group.position.set(vehicle.x, vehicle.air, vehicle.z);
    vehicle.group.rotation.y = vehicle.heading;
    vehicle.group.rotation.x = THREE.MathUtils.clamp(
      -vehicle.blastVelocity.z * 0.006 + this.slipWobbleFor(vehicle, 0.1),
      -0.28,
      0.28,
    );
    vehicle.group.rotation.z = THREE.MathUtils.clamp(
      -axis.x * 0.035 + vehicle.blastVelocity.x * 0.005 + this.slipWobbleFor(vehicle, 0.16),
      -0.28,
      0.28,
    );

    const wantsDynamite =
      vehicle.controller === "ai" ? this.aiWantsDynamite(vehicle, enemy) : this.input.wantsDynamiteFor(vehicle.id);
    if (wantsDynamite) {
      this.fireDynamite(vehicle, predictedAimPoint(enemy, 0.42));
    } else if (vehicle.controller === "ai" ? this.aiWantsBearing(vehicle, enemy) : this.input.consumeBearingFor(vehicle.id)) {
      this.fireBearing(vehicle, predictedAimPoint(enemy, 0.2));
    } else if (vehicle.controller === "ai" ? this.aiWantsFire(vehicle, enemy) : this.input.wantsFireFor(vehicle.id)) {
      this.fire(vehicle, enemy, aimPoint);
    }
  }

  updateFirstPersonVehicle(vehicle, enemy, dt) {
    const mouse = this.input.consumeMouseDelta();
    const sensitivity = 0.0024;
    this.firstPerson.yaw = wrapAngle(this.firstPerson.yaw - mouse.x * sensitivity);
    this.firstPerson.pitch = THREE.MathUtils.clamp(
      this.firstPerson.pitch - mouse.y * sensitivity,
      -0.52,
      0.42,
    );
    if (vehicle.slipTimer > 0) {
      this.firstPerson.yaw = wrapAngle(this.firstPerson.yaw + vehicle.slipSpin * dt * 0.22);
    }

    const axis = this.input.axisFor(vehicle.id);
    const moveLength = Math.hypot(axis.x, axis.y);
    const forward = forwardFromHeading(this.firstPerson.yaw);
    const right = rightFromHeading(this.firstPerson.yaw);
    const move = new THREE.Vector3();
    if (moveLength > 0) {
      move.addScaledVector(right, axis.x / moveLength);
      move.addScaledVector(forward, -axis.y / moveLength);
    }

    const sprinting = this.input.isSprinting();
    const speed = sprinting ? 25.5 : 18.8;
    const canMove = moveLength <= 0 || this.trySpendMoveEnergy(vehicle, dt, sprinting);
    const slipControl = this.slipControlFor(vehicle);
    const dx = canMove ? move.x * speed * slipControl * dt : 0;
    const dz = canMove ? move.z * speed * slipControl * dt : 0;
    vehicle.x = THREE.MathUtils.clamp(vehicle.x + dx, -ARENA.x, ARENA.x);
    vehicle.z = THREE.MathUtils.clamp(vehicle.z + dz, ARENA.zMin, ARENA.zMax);
    vehicle.velocity.set(dx / Math.max(dt, 0.001), 0, dz / Math.max(dt, 0.001));
    vehicle.heading = this.firstPerson.yaw;
    vehicle.aimPoint.copy(this.centerAimPoint(vehicle));
    this.applySlipMotion(vehicle, dt);
    this.applyBlastMotion(vehicle, dt);
    this.resolveVehicleCoverCollision(vehicle);
    vehicle.group.position.set(vehicle.x, vehicle.air, vehicle.z);
    vehicle.group.rotation.y = vehicle.heading;
    vehicle.group.rotation.x = THREE.MathUtils.clamp(
      -vehicle.blastVelocity.z * 0.006 + this.slipWobbleFor(vehicle, 0.1),
      -0.28,
      0.28,
    );
    vehicle.group.rotation.z = THREE.MathUtils.clamp(
      -axis.x * 0.035 + vehicle.blastVelocity.x * 0.005 + this.slipWobbleFor(vehicle, 0.16),
      -0.28,
      0.28,
    );

    if (moveLength > 0 && canMove) {
      this.firstPerson.bob += dt * (this.input.isSprinting() ? 12 : 8);
    } else {
      this.firstPerson.bob = THREE.MathUtils.lerp(this.firstPerson.bob, 0, Math.min(1, dt * 4));
    }

    if (this.input.wantsDynamiteFor(vehicle.id)) {
      this.fireDynamiteFirstPerson(vehicle);
    } else if (this.input.consumeBearingFor(vehicle.id)) {
      this.fireBearingFirstPerson(vehicle);
    } else if (this.input.wantsFireFor(vehicle.id)) {
      this.fireFirstPerson(vehicle, enemy);
    }
  }

  aimPointFor(vehicle, enemy) {
    if (vehicle.controller === "human1" && this.input.pointer.moved) {
      return this.pointerAimPoint() ?? predictedAimPoint(enemy, 0.1);
    }
    return predictedAimPoint(enemy, vehicle.controller === "ai" ? 0.18 : 0.12);
  }

  pointerAimPoint() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.pointerNdc.set((this.input.pointer.x / width) * 2 - 1, -(this.input.pointer.y / height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, point)) return null;
    point.x = THREE.MathUtils.clamp(point.x, -ARENA.x, ARENA.x);
    point.z = THREE.MathUtils.clamp(point.z, ARENA.zMin, ARENA.zMax);
    point.y = 0;
    return point;
  }

  pointerWorldPoint() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.pointerNdc.set((this.input.pointer.x / width) * 2 - 1, -(this.input.pointer.y / height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, point)) return null;
    point.x = THREE.MathUtils.clamp(point.x, -ARENA.x, ARENA.x);
    point.z = THREE.MathUtils.clamp(point.z, ARENA.zMin, ARENA.zMax);
    point.y = 0;
    return point;
  }

  centerAimPoint(vehicle) {
    const eye = this.eyePositionFor(vehicle);
    const direction = this.firstPersonDirection();
    const groundPoint = new THREE.Vector3();
    const ray = new THREE.Ray(eye, direction);
    if (ray.intersectPlane(this.aimPlane, groundPoint)) {
      groundPoint.x = THREE.MathUtils.clamp(groundPoint.x, -ARENA.x, ARENA.x);
      groundPoint.z = THREE.MathUtils.clamp(groundPoint.z, ARENA.zMin, ARENA.zMax);
      groundPoint.y = 0;
      return groundPoint;
    }
    return eye.clone().addScaledVector(direction, 86);
  }

  firstPersonDirection() {
    const yaw = this.firstPerson.yaw;
    const pitch = this.firstPerson.pitch - this.firstPerson.recoil * 0.045;
    const flat = Math.cos(pitch);
    return this.cameraDirection
      .set(-Math.sin(yaw) * flat, Math.sin(pitch), -Math.cos(yaw) * flat)
      .normalize();
  }

  eyePositionFor(vehicle) {
    const forward = forwardFromHeading(this.firstPerson.yaw);
    return new THREE.Vector3(vehicle.x, this.firstPerson.eyeHeight + vehicle.air, vehicle.z).addScaledVector(forward, 0.7);
  }

  aiAxis(vehicle, enemy) {
    const ownBase = this.baseOf(vehicle);
    if (ownBase && vehicle.energy < 28 && !this.isInsideBase(vehicle, ownBase)) {
      const bx = ownBase.x - vehicle.x;
      const bz = ownBase.z - vehicle.z;
      const distance = Math.hypot(bx, bz) || 1;
      return { x: bx / distance, y: bz / distance };
    }
    if (ownBase && vehicle.energy < 96 && this.isInsideBase(vehicle, ownBase)) {
      return { x: 0, y: 0 };
    }
    const dx = enemy.x - vehicle.x;
    const dz = enemy.z - vehicle.z;
    const distance = Math.hypot(dx, dz) || 1;
    const toward = new THREE.Vector2(dx / distance, dz / distance);
    const side = new THREE.Vector2(-toward.y, toward.x).multiplyScalar(vehicle.ai.strafe);
    const rangeControl = distance > 150 ? 1.3 : distance > 84 ? 0.98 : distance < 32 ? -0.85 : 0.18;
    const weave = Math.sin(this.clock * (0.8 + vehicle.id * 0.25)) * 0.65;
    return {
      x: toward.x * rangeControl + side.x * (0.9 + weave * 0.3),
      y: toward.y * rangeControl + side.y * (0.9 + weave * 0.3),
    };
  }

  aiWantsFire(vehicle, enemy) {
    if (vehicle.cooldown > 0) return false;
    const distance = distanceXZ(vehicle, enemy);
    const facing = forwardFromHeading(vehicle.heading);
    const toEnemy = new THREE.Vector3(enemy.x - vehicle.x, 0, enemy.z - vehicle.z).normalize();
    const aimQuality = facing.dot(toEnemy);
    return distance < 190 && aimQuality > 0.78 && Math.random() < vehicle.ai.fireBias;
  }

  aiWantsDynamite(vehicle, enemy) {
    if (vehicle.cooldown > 0 || vehicle.energy < ENERGY_DYNAMITE_COST) return false;
    const distance = distanceXZ(vehicle, enemy);
    if (distance < 20 || distance > 122) return false;
    const facing = forwardFromHeading(vehicle.heading);
    const toEnemy = new THREE.Vector3(enemy.x - vehicle.x, 0, enemy.z - vehicle.z).normalize();
    return facing.dot(toEnemy) > 0.86 && Math.random() < 0.18;
  }

  aiWantsBearing(vehicle, enemy) {
    if (vehicle.cooldown > 0 || vehicle.energy < ENERGY_BEARING_COST) return false;
    const distance = distanceXZ(vehicle, enemy);
    if (distance < 16 || distance > 135 || enemy.slipTimer > 0.9) return false;
    const facing = forwardFromHeading(vehicle.heading);
    const toEnemy = new THREE.Vector3(enemy.x - vehicle.x, 0, enemy.z - vehicle.z).normalize();
    return facing.dot(toEnemy) > 0.82 && Math.random() < 0.12;
  }

  fire(vehicle, enemy, aimPoint = predictedAimPoint(enemy, 0.16)) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    const flatAim = new THREE.Vector3(aimPoint.x - vehicle.x, 0, aimPoint.z - vehicle.z);
    if (flatAim.lengthSq() < 0.5) return;
    if (!this.trySpendShotEnergy(vehicle)) return;
    const direction = flatAim.normalize();
    const start = new THREE.Vector3(vehicle.x, 2.25, vehicle.z).addScaledVector(direction, 4.0);
    const target = new THREE.Vector3(aimPoint.x, 2.05, aimPoint.z);
    const shotDirection = target.sub(start).normalize();
    const projectile = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: vehicle.accent }),
    );
    projectile.position.copy(start);
    projectile.userData = {
      owner: vehicle.id,
      velocity: shotDirection.multiplyScalar(82),
      life: 3.05,
      damage: 22,
    };
    this.scene.add(projectile);
    this.projectiles.push(projectile);
    this.addTracer(start, start.clone().addScaledVector(projectile.userData.velocity.clone().normalize(), 8), vehicle.accent);
    this.addFlash(start, projectile.userData.velocity.clone().normalize());
    vehicle.cooldown = vehicle.controller === "ai" ? 0.82 : 0.68;
    this.shake = Math.max(this.shake, 0.35);
    this.audio.beep({ frequency: vehicle.id === 1 ? 610 : 520, duration: 0.045, type: "triangle", gain: 0.025 });
  }

  fireFirstPerson(vehicle, enemy) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    if (!this.trySpendShotEnergy(vehicle)) return;
    const direction = this.firstPersonDirection();
    const start = this.eyePositionFor(vehicle).addScaledVector(direction, 1.25);
    const projectile = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: vehicle.accent }),
    );
    projectile.position.copy(start);
    projectile.userData = {
      owner: vehicle.id,
      velocity: direction.clone().multiplyScalar(96),
      life: 3.05,
      damage: 22,
    };
    this.scene.add(projectile);
    this.projectiles.push(projectile);
    this.addTracer(start, start.clone().addScaledVector(direction, 9), vehicle.accent);
    this.addFlash(start.clone().addScaledVector(direction, 0.4), direction);
    vehicle.cooldown = 0.6;
    vehicle.aimPoint.copy(this.centerAimPoint(vehicle));
    this.firstPerson.recoil = Math.min(1, this.firstPerson.recoil + 0.55);
    this.shake = Math.max(this.shake, 0.42);
    this.audio.beep({ frequency: 640, duration: 0.045, type: "triangle", gain: 0.026 });
  }

  fireDynamite(vehicle, aimPoint) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    const flatAim = new THREE.Vector3(aimPoint.x - vehicle.x, 0, aimPoint.z - vehicle.z);
    if (flatAim.lengthSq() < 0.5) return;
    if (!this.trySpendDynamiteEnergy(vehicle)) return;
    const direction = flatAim.normalize();
    const start = new THREE.Vector3(vehicle.x, 2.35 + vehicle.air, vehicle.z).addScaledVector(direction, 3.2);
    const target = new THREE.Vector3(aimPoint.x, 1.9, aimPoint.z);
    const shotDirection = target.sub(start).normalize();
    this.launchDynamite(vehicle, start, shotDirection, 46);
    vehicle.cooldown = vehicle.controller === "ai" ? 1.9 : 1.55;
    this.shake = Math.max(this.shake, 0.5);
  }

  fireDynamiteFirstPerson(vehicle) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    if (!this.trySpendDynamiteEnergy(vehicle)) return;
    const direction = this.firstPersonDirection();
    const start = this.eyePositionFor(vehicle).addScaledVector(direction, 1.1);
    this.launchDynamite(vehicle, start, direction, 52);
    vehicle.cooldown = 1.45;
    vehicle.aimPoint.copy(this.centerAimPoint(vehicle));
    this.firstPerson.recoil = Math.min(1, this.firstPerson.recoil + 0.82);
    this.shake = Math.max(this.shake, 0.55);
  }

  fireBearing(vehicle, aimPoint) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    const flatAim = new THREE.Vector3(aimPoint.x - vehicle.x, 0, aimPoint.z - vehicle.z);
    if (flatAim.lengthSq() < 0.5) return;
    if (!this.trySpendBearingEnergy(vehicle)) return;
    const direction = flatAim.normalize();
    const start = new THREE.Vector3(vehicle.x, 2.28 + vehicle.air, vehicle.z).addScaledVector(direction, 3.45);
    const target = new THREE.Vector3(aimPoint.x, 1.45, aimPoint.z);
    const shotDirection = target.sub(start).normalize();
    this.launchBearing(vehicle, start, shotDirection, 72);
    vehicle.cooldown = vehicle.controller === "ai" ? 1.35 : 1.05;
    this.shake = Math.max(this.shake, 0.32);
  }

  fireBearingFirstPerson(vehicle) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    if (!this.trySpendBearingEnergy(vehicle)) return;
    const direction = this.firstPersonDirection();
    const start = this.eyePositionFor(vehicle).addScaledVector(direction, 1.08);
    this.launchBearing(vehicle, start, direction, 82);
    vehicle.cooldown = 0.95;
    vehicle.aimPoint.copy(this.centerAimPoint(vehicle));
    this.firstPerson.recoil = Math.min(1, this.firstPerson.recoil + 0.45);
    this.shake = Math.max(this.shake, 0.38);
  }

  launchDynamite(vehicle, start, direction, speed) {
    const projectile = makeDynamiteProjectile(vehicle.accent);
    projectile.position.copy(start);
    projectile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
    projectile.userData = {
      owner: vehicle.id,
      velocity: direction.clone().multiplyScalar(speed),
      life: 2.15,
      damage: DYNAMITE_DAMAGE,
      dynamite: true,
      detonated: false,
    };
    this.scene.add(projectile);
    this.projectiles.push(projectile);
    this.addTracer(start, start.clone().addScaledVector(direction, 6), vehicle.accent);
    this.addFlash(start.clone().addScaledVector(direction, 0.35), direction);
    this.audio.beep({ frequency: vehicle.id === 1 ? 310 : 280, duration: 0.09, type: "sawtooth", gain: 0.034 });
  }

  launchBearing(vehicle, start, direction, speed) {
    const projectile = makeBearingProjectile(vehicle.accent);
    projectile.position.copy(start);
    projectile.userData = {
      owner: vehicle.id,
      velocity: direction.clone().multiplyScalar(speed),
      life: 2.35,
      damage: BEARING_DAMAGE,
      bearing: true,
      spin: 7 + Math.random() * 6,
    };
    this.scene.add(projectile);
    this.projectiles.push(projectile);
    this.addTracer(start, start.clone().addScaledVector(direction, 5.4), 0xc6ccd0);
    this.addFlash(start.clone().addScaledVector(direction, 0.3), direction);
    this.audio.beep({ frequency: vehicle.id === 1 ? 760 : 690, duration: 0.055, type: "square", gain: 0.026 });
  }

  aimQualityForFirstPerson(enemy) {
    if (!enemy) return 0;
    const p1 = this.vehicles?.[0];
    if (!p1) return 0;
    const toEnemy = new THREE.Vector3(enemy.x - p1.x, 1.2, enemy.z - p1.z).normalize();
    return this.firstPersonDirection().dot(toEnemy);
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      const previousPosition = projectile.position.clone();
      projectile.position.addScaledVector(projectile.userData.velocity, dt);
      projectile.userData.life -= dt;
      if (projectile.userData.dynamite) {
        projectile.rotation.z += dt * 11;
        projectile.rotation.x += dt * 3.5;
      }
      if (projectile.userData.bearing) {
        projectile.rotation.x += dt * projectile.userData.spin;
        projectile.rotation.z += dt * projectile.userData.spin * 0.7;
      }

      const coverImpact = projectile.userData.life > 0 ? this.projectileCoverImpact(projectile, previousPosition) : null;
      if (coverImpact) {
        this.absorbProjectileByCover(projectile, coverImpact);
        continue;
      }

      if (projectile.userData.dynamite && projectile.userData.life <= 0) {
        this.detonateDynamite(projectile);
      }
    }
    const removed = this.projectiles.filter(
      (projectile) =>
        projectile.userData.life <= 0 ||
        Math.abs(projectile.position.x) > PROJECTILE_BOUNDS.x ||
        projectile.position.z < PROJECTILE_BOUNDS.zMin ||
        projectile.position.z > PROJECTILE_BOUNDS.zMax,
    );
    removed.forEach((projectile) => this.scene.remove(projectile));
    this.projectiles = this.projectiles.filter((projectile) => !removed.includes(projectile));
  }

  updateBases(dt) {
    for (const base of this.bases) {
      const owner = this.vehicles.find((vehicle) => vehicle.id === base.ownerId);
      const enemy = owner ? this.enemyOf(owner) : null;
      if (!owner || !enemy || this.finished) continue;

      const defenderInside = owner.alive && this.isInsideBase(owner, base);
      const enemyInside = enemy.alive && this.isInsideBase(enemy, base);
      if (enemyInside) {
        const pressure = defenderInside ? 0.42 : 1;
        base.capture = Math.min(1, base.capture + (dt * pressure) / BASE_CAPTURE_SECONDS);
      } else {
        base.capture = Math.max(0, base.capture - dt / (BASE_CAPTURE_SECONDS * 1.4));
      }

      if (base.captureRing?.material) {
        base.captureRing.material.opacity = 0.08 + base.capture * 0.62;
      }
      if (base.perimeter?.material) {
        base.perimeter.material.opacity = 0.34 + Math.sin(this.clock * 4 + base.ownerId) * 0.06;
      }

      if (base.capture >= 1) {
        this.pushLog(`${base.name} 被攻陷`);
        this.finishRound(enemy, "BASE_CAPTURE");
        return;
      }

      this.updateCiws(base, owner, enemy, dt);
    }
  }

  updateCiws(base, owner, enemy, dt) {
    const operatorInside = owner.alive && this.isInsideBase(owner, base);
    if (!operatorInside || !enemy.alive) {
      base.ciwsAccumulator = 0;
      return;
    }

    const aimPoint = this.ciwsAimPoint(owner, enemy);
    const turretAngle = angleToTarget(base, aimPoint);
    base.turret.rotation.y = lerpAngle(base.turret.rotation.y, turretAngle, Math.min(1, dt * 9));

    const wantsFire = owner.controller === "ai" ? this.aiWantsCiws(base, enemy) : this.input.isFiringFor(owner.id);
    if (!wantsFire || !this.hasLineOfSight(base, aimPoint)) {
      base.ciwsAccumulator = Math.min(base.ciwsAccumulator, 2);
      return;
    }

    base.ciwsAccumulator = Math.min(24, base.ciwsAccumulator + dt * CIWS_RATE_PER_SECOND);
    const shots = Math.min(12, Math.floor(base.ciwsAccumulator));
    if (shots <= 0) return;
    base.ciwsAccumulator -= shots;

    for (let i = 0; i < shots; i += 1) {
      if (!this.fireCiwsRound(base, owner, aimPoint, i)) break;
    }
  }

  ciwsAimPoint(owner, enemy) {
    if (owner.controller.startsWith("human") && this.input.pointer.moved) {
      return this.pointerWorldPoint() ?? predictedAimPoint(enemy, 0.04);
    }
    return predictedAimPoint(enemy, owner.controller === "ai" ? 0.08 : 0.04);
  }

  aiWantsCiws(base, enemy) {
    return distanceXZ(base, enemy) < 160 && this.hasLineOfSight(base, predictedAimPoint(enemy, 0.08));
  }

  fireCiwsRound(base, owner, aimPoint, index) {
    if (!this.spendEnergy(owner, ENERGY_CIWS_ROUND_COST, "近防炮能量不足，基地锅炉烧开水中")) {
      return false;
    }
    const muzzlePosition = new THREE.Vector3();
    base.muzzle.getWorldPosition(muzzlePosition);
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 1.1, 0, (Math.random() - 0.5) * 1.1);
    const target = new THREE.Vector3(aimPoint.x, 1.65, aimPoint.z).add(jitter);
    const shotDirection = target.sub(muzzlePosition).normalize();
    const projectile = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshBasicMaterial({
        color: base.accent,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    projectile.position.copy(muzzlePosition);
    projectile.userData = {
      owner: owner.id,
      velocity: shotDirection.multiplyScalar(168),
      life: 1.05,
      damage: 2.2,
      ciws: true,
    };
    this.scene.add(projectile);
    this.projectiles.push(projectile);

    const tracerEnd = muzzlePosition.clone().addScaledVector(shotDirection, 7 + Math.random() * 3);
    this.addTracer(muzzlePosition, tracerEnd, base.accent);
    if (index % 5 === 0) {
      this.addFlash(muzzlePosition, shotDirection);
      this.audio.beep({ frequency: 980 + base.ownerId * 80, duration: 0.018, type: "square", gain: 0.014 });
    }
    return true;
  }

  updateEffects(dt) {
    this.fadeAndCull(this.tracers, dt, 0.08);
    this.fadeAndCull(this.flashes, dt, 0.11);
    this.fadeAndCull(this.starlinkEffects, dt, 0.82);
    this.fadeAndCull(this.sparks, dt, 0.75, true);
    this.fadeAndCull(this.dust, dt, 0.75, true);
  }

  fadeAndCull(items, dt, maxLife, move = false) {
    for (const item of items) {
      item.userData.life -= dt;
      if (move && item.userData.velocity) {
        item.position.addScaledVector(item.userData.velocity, dt);
        item.userData.velocity.multiplyScalar(0.985);
      }
      const opacity = Math.max(0, item.userData.life / maxLife);
      item.traverse?.((part) => {
        if (part.material && "opacity" in part.material) part.material.opacity = opacity;
      });
      if (item.material && "opacity" in item.material) item.material.opacity = opacity;
    }
    items.filter((item) => item.userData.life <= 0).forEach((item) => this.scene.remove(item));
    const live = items.filter((item) => item.userData.life > 0);
    items.length = 0;
    items.push(...live);
  }

  resolveHits() {
    for (const projectile of this.projectiles) {
      if (projectile.userData.life <= 0) continue;
      const target = this.vehicles.find((vehicle) => vehicle.id !== projectile.userData.owner && vehicle.alive);
      const targetCenter = target?.group.position.clone().add(new THREE.Vector3(0, 1.55, 0));
      if (!target || projectile.position.distanceTo(targetCenter) > 3.1) continue;
      if (projectile.userData.dynamite) {
        this.detonateDynamite(projectile);
        continue;
      }
      const owner = this.vehicles.find((vehicle) => vehicle.id === projectile.userData.owner);
      if (projectile.userData.bearing) {
        this.applyBearingHit(projectile, target, owner);
        continue;
      }
      projectile.userData.life = 0;
      target.health = Math.max(0, target.health - projectile.userData.damage);
      target.invincible = 0.35;
      owner.hits += 1;
      owner.score += projectile.userData.damage * (projectile.userData.ciws ? 5 : 12);
      this.hitTimer = projectile.userData.ciws ? Math.max(this.hitTimer, 0.08) : 0.42;
      this.damageFlash = Math.max(
        this.damageFlash,
        target.controller.startsWith("human") ? (projectile.userData.ciws ? 0.18 : 0.75) : 0.28,
      );
      this.shake = Math.max(this.shake, projectile.userData.ciws ? 0.16 : 1.1);
      this.addExplosion(
        target.group.position.clone().add(new THREE.Vector3(0, 2, 0)),
        owner.accent,
        projectile.userData.ciws ? 4 : 18,
      );
      if (!projectile.userData.ciws || owner.hits % 24 === 0) {
        this.pushLog(projectile.userData.ciws ? `${owner.name} 近防炮压制 ${target.name}` : `${owner.name} 命中 ${target.name}`);
      }
      if (!projectile.userData.ciws) {
        this.audio.beep({ frequency: 220, duration: 0.08, type: "square", gain: 0.04 });
      }
      if (target.health <= 0) {
        target.alive = false;
        this.finishRound(owner, "KNOCKOUT");
      }
    }
  }

  updateStarlink() {
    for (const vehicle of this.vehicles) {
      if (!vehicle.alive || !vehicle.controller.startsWith("human")) continue;
      if (this.input.consumeStarlinkFor(vehicle.id)) {
        this.tryActivateStarlink(vehicle);
      }
    }
  }

  applyBearingHit(projectile, target, owner) {
    projectile.userData.life = 0;
    target.health = Math.max(0, target.health - projectile.userData.damage);
    target.invincible = 0.3;
    target.slipTimer = Math.max(target.slipTimer, BEARING_SLIP_SECONDS);
    target.slipSpin = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.4);

    const slideDirection = projectile.userData.velocity.clone();
    slideDirection.y = 0;
    if (slideDirection.lengthSq() < 0.01 && owner) {
      slideDirection.set(target.x - owner.x, 0, target.z - owner.z);
    }
    if (slideDirection.lengthSq() < 0.01) slideDirection.set(target.id === 1 ? -1 : 1, 0, 0);
    slideDirection.normalize();
    target.slipVelocity.addScaledVector(slideDirection, BEARING_SLIP_IMPULSE);

    if (owner) {
      owner.hits += 1;
      owner.score += projectile.userData.damage * 18 + 420;
      this.pushLog(`${owner.name} 发射滚珠轴承，${target.name} 滑倒`);
    }
    this.hitTimer = 0.34;
    this.damageFlash = Math.max(this.damageFlash, target.controller.startsWith("human") ? 0.7 : 0.28);
    this.shake = Math.max(this.shake, 0.75);
    this.addBearingScatter(projectile.position.clone(), owner?.accent ?? 0xc6ccd0);
    this.audio.beep({ frequency: 390, duration: 0.09, type: "triangle", gain: 0.036 });

    if (target.health <= 0 && owner) {
      target.alive = false;
      this.finishRound(owner, "KNOCKOUT");
    }
  }

  tryActivateStarlink(vehicle) {
    const enemy = this.enemyOf(vehicle);
    const base = this.baseOf(vehicle);
    if (!enemy?.alive || !base) return;
    if (!this.navigationActive || this.navigator !== vehicle) {
      this.pushLog(`${vehicle.name} 星链计划锁止：需要基地雷达`);
      return;
    }
    if (vehicle.starlinkCooldown > 0) {
      this.pushLog(`${vehicle.name} 星链计划充能 ${Math.ceil(vehicle.starlinkCooldown)}s`);
      return;
    }
    if (!this.hasLineOfSight(base, enemy)) {
      this.pushLog(`${vehicle.name} 星链计划锁止：雷达被遮挡`);
      return;
    }

    vehicle.starlinkCooldown = STARLINK_COOLDOWN_SECONDS;
    vehicle.hits += 1;
    vehicle.score += 9000 + enemy.health * 90;
    enemy.health = 0;
    enemy.alive = false;
    enemy.blastVelocity.set(0, 0, 0);
    enemy.verticalVelocity = 0;
    enemy.air = 0;
    enemy.group.position.set(enemy.x, 0, enemy.z);
    this.hitTimer = 0.75;
    this.damageFlash = Math.max(this.damageFlash, enemy.controller.startsWith("human") ? 0.9 : 0.42);
    this.shake = Math.max(this.shake, 2.4);
    this.radio = "星链计划完成雷达引导，轨道打击命中目标。";
    this.radioTimer = 4.4;
    this.addStarlinkStrike(enemy, vehicle.accent);
    this.addExplosion(enemy.group.position.clone().add(new THREE.Vector3(0, 2.4, 0)), vehicle.accent, 42);
    this.pushLog(`${vehicle.name} 星链计划秒杀 ${enemy.name}`);
    this.audio.beep({ frequency: 1320, duration: 0.12, type: "sawtooth", gain: 0.045 });
    this.audio.beep({ frequency: 240, duration: 0.18, type: "square", gain: 0.04 });
    this.finishRound(vehicle, "STARLINK_STRIKE");
  }

  addStarlinkStrike(target, color) {
    const group = new THREE.Group();
    group.position.set(target.x, 0, target.z);
    group.userData.life = 0.82;

    const beamMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.2, 96, 28, 1, true), beamMaterial);
    beam.position.y = 48;
    group.add(beam);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 98, 16, 1, true), coreMaterial);
    core.position.y = 49;
    group.add(core);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.8, 8.4, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);

    this.scene.add(group);
    this.starlinkEffects.push(group);
  }

  detonateDynamite(projectile) {
    if (projectile.userData.detonated) return;
    projectile.userData.detonated = true;
    projectile.userData.life = 0;
    const owner = this.vehicles.find((vehicle) => vehicle.id === projectile.userData.owner);
    const color = owner?.accent ?? 0xffd166;
    this.addExplosion(projectile.position.clone(), color, 42);
    this.shake = Math.max(this.shake, 1.8);
    this.hitTimer = Math.max(this.hitTimer, 0.35);
    this.audio.beep({ frequency: 155, duration: 0.12, type: "square", gain: 0.058 });

    if (!owner) return;
    for (const target of this.vehicles) {
      if (target.id === owner.id || !target.alive) continue;
      const distance = distanceXZ(projectile.position, target);
      if (distance > DYNAMITE_RADIUS) continue;
      const falloff = 1 - distance / DYNAMITE_RADIUS;
      const coverMultiplier = this.blastCoverMultiplier(projectile.position, target);
      const damage = DYNAMITE_DAMAGE * (0.35 + falloff * 0.65) * coverMultiplier;
      target.health = Math.max(0, target.health - damage);
      target.invincible = 0.45;
      owner.hits += 1;
      owner.score += damage * 14;
      this.damageFlash = Math.max(
        this.damageFlash,
        target.controller.startsWith("human") ? 0.85 : 0.34,
      );

      const blastDirection = new THREE.Vector3(target.x - projectile.position.x, 0, target.z - projectile.position.z);
      if (blastDirection.lengthSq() < 0.01) {
        blastDirection.copy(new THREE.Vector3(target.x - owner.x, 0, target.z - owner.z));
      }
      if (blastDirection.lengthSq() < 0.01) blastDirection.set(owner.id === 1 ? 1 : -1, 0, 0);
      blastDirection.normalize();
      const impulse = DYNAMITE_KNOCKBACK * (0.42 + falloff * 0.58) * coverMultiplier;
      target.blastVelocity.addScaledVector(blastDirection, impulse);
      target.verticalVelocity = Math.max(target.verticalVelocity, DYNAMITE_LIFT * (0.45 + falloff * 0.75) * coverMultiplier);
      target.air = Math.max(target.air, 0.08);
      if (coverMultiplier < 0.5) {
        this.pushCoverLog("加固建筑削弱了雷管冲击");
      } else {
        this.pushLog(`${owner.name} 雷管炸飞 ${target.name}`);
      }

      if (target.health <= 0) {
        target.alive = false;
        this.finishRound(owner, "KNOCKOUT");
      }
    }
  }

  updateCamera(dt) {
    const human = this.vehicles.find((vehicle) => vehicle.controller === "human1" && vehicle.alive);
    if (human) {
      this.updateFirstPersonCamera(human);
      return;
    }

    const midpoint = new THREE.Vector3(
      (this.vehicles[0].x + this.vehicles[1].x) / 2,
      0,
      (this.vehicles[0].z + this.vehicles[1].z) / 2,
    );
    const distance = THREE.MathUtils.clamp(distanceXZ(this.vehicles[0], this.vehicles[1]), 70, 280);
    const targetPosition = new THREE.Vector3(
      midpoint.x * 0.35 + (Math.random() - 0.5) * this.shake,
      30 + distance * 0.12,
      midpoint.z + 54 + distance * 0.2 + (Math.random() - 0.5) * this.shake,
    );
    this.camera.position.lerp(targetPosition, Math.min(1, dt * 4.5));
    this.camera.lookAt(midpoint.x, 2.8, midpoint.z - 1.5);
  }

  updateFirstPersonCamera(vehicle) {
    const direction = this.firstPersonDirection();
    const right = rightFromHeading(this.firstPerson.yaw);
    const bobAmount = vehicle.velocity.length() > 2 ? Math.sin(this.firstPerson.bob) * 0.055 : 0;
    const shakeOffset = new THREE.Vector3(
      (Math.random() - 0.5) * this.shake * 0.045,
      (Math.random() - 0.5) * this.shake * 0.035,
      (Math.random() - 0.5) * this.shake * 0.045,
    );
    const eye = this.eyePositionFor(vehicle)
      .addScaledVector(right, 0.16)
      .add(new THREE.Vector3(0, bobAmount, 0))
      .add(shakeOffset);
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.clone().addScaledVector(direction, 12));
  }

  updateHud() {
    const [p1, p2] = this.vehicles;
    const seconds = Math.ceil(this.roundTime);
    this.elements.score.textContent = `${p1.hits}:${p2.hits}`;
    this.elements.wave.textContent = seconds;
    this.elements.healthBar.style.width = `${p1.health}%`;
    this.elements.chargeBar.style.width = `${p1.energy}%`;
    this.elements.bearing.textContent = `方位 ${Math.round((p1.heading * 180) / Math.PI + 360) % 360}`;
    this.elements.missionPhase.textContent = this.modeInfo.phase;
    this.elements.altitude.textContent = `距离 ${Math.round(distanceXZ(p1, p2))} m`;
    this.elements.weaponState.textContent = `P1 ${Math.round(p1.health)}% 生命 · ${this.energyStatusFor(p1)}`;
    this.elements.comboState.textContent = `P2 ${Math.round(p2.health)}% 生命 · ${this.energyStatusFor(p2)}`;
    this.elements.systemState.textContent = this.systemStateText(p1);
    this.elements.radioLine.textContent = this.radio;
    this.elements.hitMarker.classList.toggle("hit-marker--active", this.hitTimer > 0);
    this.elements.damageVignette.style.opacity = String(Math.min(0.62, this.damageFlash));
    this.elements.waveAlert.textContent = `${this.modeInfo.name} · ${formatTime(seconds)}`;
    this.elements.waveAlert.classList.toggle("wave-alert--active", this.waveAlertTimer > 0);
    this.elements.combatLog.innerHTML = this.logs.map((line) => `<span>${line}</span>`).join("");
    this.updateAimHud(p1);
    this.updateRadar();
  }

  systemStateText(primaryVehicle) {
    if (this.paused) return "暂停";
    const baseState = this.isBoilingKettle(primaryVehicle)
      ? "基地烧开水补能"
      : this.input.pointerLocked
        ? "鼠标锁定"
        : "点击画面锁定鼠标";
    return `${baseState} · ${this.starlinkStatusText()}`;
  }

  starlinkStatusText() {
    if (!this.navigationActive || !this.navigator) return "星链锁止";
    if (this.navigator.starlinkCooldown > 0) {
      return `星链 ${Math.ceil(this.navigator.starlinkCooldown)}s`;
    }
    return this.starlinkReadyFor(this.navigator) ? "星链待命" : "目标遮挡";
  }

  updateAimHud(fallbackVehicle) {
    const aimingVehicle = this.vehicles.find((vehicle) => vehicle.controller === "human1") ?? fallbackVehicle;
    const enemy = this.enemyOf(aimingVehicle);
    if (!aimingVehicle || !enemy) return;
    const firstPersonHuman = aimingVehicle.controller === "human1";
    const screen = firstPersonHuman ? { left: 50, top: 50 } : this.projectToHud(aimingVehicle.aimPoint ?? predictedAimPoint(enemy, 0.12));
    this.elements.reticle.style.left = `${screen.left}%`;
    this.elements.reticle.style.top = `${screen.top}%`;
    this.elements.targetLock.style.left = `${screen.left}%`;
    this.elements.targetLock.style.top = `${THREE.MathUtils.clamp(screen.top + 8.5, 8, 92)}%`;

    const lockError = firstPersonHuman ? 1 - this.aimQualityForFirstPerson(enemy) : distanceXZ(aimingVehicle.aimPoint, enemy);
    const locked = firstPersonHuman ? lockError < 0.018 : lockError < 4.2;
    this.elements.reticle.classList.toggle("reticle--locked", locked);
    this.elements.targetLock.classList.toggle("target-lock--active", locked);
    this.elements.targetLock.textContent = locked ? `${enemy.name} · 锁定` : `距离 ${Math.round(distanceXZ(aimingVehicle, enemy))} m`;
  }

  projectToHud(point) {
    const projected = new THREE.Vector3(point.x, 2.1, point.z).project(this.camera);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
      return { left: 50, top: 48 };
    }
    return {
      left: THREE.MathUtils.clamp((projected.x * 0.5 + 0.5) * 100, 7, 93),
      top: THREE.MathUtils.clamp((-projected.y * 0.5 + 0.5) * 100, 9, 86),
    };
  }

  updateRadar() {
    const navigator = this.navigator;
    this.elements.radar.classList.toggle("radar--offline", !this.navigationActive);
    this.elements.radar.classList.toggle("radar--starlink-ready", this.starlinkReadyFor(navigator));
    if (!navigator) {
      this.elements.radarBlips.innerHTML = "";
      return;
    }

    const navBase = this.baseOf(navigator);
    const starlinkReady = this.starlinkReadyFor(navigator);
    const starlinkTarget = this.enemyOf(navigator);
    const dots = [
      ...this.bases.map((base) => ({ x: base.x, z: base.z, kind: base.ownerId === 1 ? "base-blue" : "base-red" })),
      ...this.vehicles
        .filter((vehicle) => this.hasLineOfSight(navBase, vehicle))
        .map((vehicle) => ({
          x: vehicle.x,
          z: vehicle.z,
          kind: starlinkReady && vehicle === starlinkTarget ? "starlink-target" : vehicle.id === 1 ? "blue" : "red",
        })),
      ...this.projectiles.map((projectile) => ({
        x: projectile.position.x,
        z: projectile.position.z,
        kind: projectile.userData.owner === 1 ? "shot-blue" : "shot-red",
      })).filter((projectile) => this.hasLineOfSight(navBase, projectile)),
    ];
    const centerZ = ARENA_CENTER_Z;
    const halfZ = (ARENA.zMax - ARENA.zMin) / 2;
    this.elements.radarBlips.innerHTML = dots
      .map((dot) => {
        const left = THREE.MathUtils.clamp(50 + (dot.x / ARENA.x) * 42, 8, 92);
        const top = THREE.MathUtils.clamp(50 + ((dot.z - centerZ) / halfZ) * 42, 8, 92);
        return `<span class="radar__blip radar__blip--${dot.kind}" style="left:${left}%;top:${top}%"></span>`;
      })
      .join("");
  }

  starlinkReadyFor(vehicle) {
    if (!vehicle?.alive || !this.navigationActive || this.navigator !== vehicle || vehicle.starlinkCooldown > 0) return false;
    const enemy = this.enemyOf(vehicle);
    const base = this.baseOf(vehicle);
    return Boolean(enemy?.alive && base && this.hasLineOfSight(base, enemy));
  }

  activeNavigator() {
    const candidates = this.vehicles.filter((vehicle) => vehicle.alive && vehicle.controller.startsWith("human"));
    const active = candidates.find((vehicle) => this.isInsideBase(vehicle, this.baseOf(vehicle)));
    if (active) return active;
    if (this.mode === "aivai") {
      return this.vehicles.find((vehicle) => vehicle.alive && this.isInsideBase(vehicle, this.baseOf(vehicle)));
    }
    return null;
  }

  updateNavigationState(dt) {
    const navigator = this.activeNavigator();
    const wasActive = this.navigationActive;
    this.navigationActive = Boolean(navigator);
    this.navigator = navigator;
    this.elements.hud.classList.toggle("hud--radar-link", this.navigationActive);
    if (navigator && !wasActive) {
      this.navFocus.set(navigator.x, 0, navigator.z);
      this.pushLog(`${navigator.name} 接入基地雷达链路`);
    }
    if (!navigator && wasActive) {
      this.pushLog("基地雷达链路断开");
    }
    if (!navigator) return;
    const base = this.baseOf(navigator);
    const enemy = this.enemyOf(navigator);
    if (enemy && base && this.hasLineOfSight(base, enemy)) {
      this.navFocus.lerp(new THREE.Vector3(enemy.x, 0, enemy.z), Math.min(1, dt * 0.18));
    }
  }

  baseOf(vehicle) {
    return this.bases.find((base) => base.ownerId === vehicle.id);
  }

  energyStatusFor(vehicle) {
    const base = this.baseOf(vehicle);
    const capture = Math.round((base?.capture ?? 0) * 100);
    const kettle = this.isBoilingKettle(vehicle);
    const slip = vehicle.slipTimer > 0 ? ` · 打滑${Math.ceil(vehicle.slipTimer)}s` : "";
    return `${Math.round(vehicle.energy)}% 能量 · ${kettle ? "烧开水" : "锅炉离线"} · 基地${capture}%${slip}`;
  }

  isBoilingKettle(vehicle) {
    const base = this.baseOf(vehicle);
    return Boolean(vehicle?.alive && base && this.isInsideBase(vehicle, base) && vehicle.energy < ENERGY_MAX);
  }

  updateKettleEnergy(vehicle, dt) {
    const base = this.baseOf(vehicle);
    if (!base || !this.isInsideBase(vehicle, base)) return;
    const previous = vehicle.energy;
    vehicle.energy = Math.min(ENERGY_MAX, vehicle.energy + ENERGY_RECHARGE_PER_SECOND * dt);
    if (previous < 35 && vehicle.energy >= 35) {
      this.pushLog(`${vehicle.name} 基地烧开水完成，能量恢复`);
    }
  }

  trySpendMoveEnergy(vehicle, dt, sprinting) {
    const cost = (ENERGY_MOVE_PER_SECOND + (sprinting ? ENERGY_SPRINT_EXTRA_PER_SECOND : 0)) * dt;
    return this.spendEnergy(vehicle, cost, `${vehicle.name} 能量不足，回基地烧开水后才能移动`);
  }

  trySpendShotEnergy(vehicle) {
    return this.spendEnergy(vehicle, ENERGY_SHOT_COST, `${vehicle.name} 能量不足，回基地烧开水后才能开枪`);
  }

  trySpendDynamiteEnergy(vehicle) {
    return this.spendEnergy(vehicle, ENERGY_DYNAMITE_COST, `${vehicle.name} 能量不足，回基地烧开水后才能发射雷管`);
  }

  trySpendBearingEnergy(vehicle) {
    return this.spendEnergy(vehicle, ENERGY_BEARING_COST, `${vehicle.name} 能量不足，回基地烧开水后才能发射滚珠轴承`);
  }

  spendEnergy(vehicle, amount, message) {
    if (vehicle.energy < amount) {
      vehicle.energy = Math.max(0, vehicle.energy);
      if (vehicle.energyBlockCooldown <= 0) {
        this.pushLog(message);
        vehicle.energyBlockCooldown = 1.2;
      }
      return false;
    }
    vehicle.energy = Math.max(0, vehicle.energy - amount);
    return true;
  }

  isInsideBase(vehicle, base) {
    if (!vehicle || !base) return false;
    return distanceXZ(vehicle, base) <= base.radius;
  }

  hasLineOfSight(origin, target) {
    if (!origin || !target) return false;
    for (const blocker of this.navBlockers) {
      if (distancePointToSegmentXZ(blocker, origin, target) < blocker.radius) {
        return false;
      }
    }
    return true;
  }

  projectileCoverImpact(projectile, previousPosition) {
    let closest = null;
    for (const blocker of this.attackBlockers) {
      const radius = blocker.radius + (projectile.userData.dynamite ? 0.35 : 0.12);
      const t = segmentCircleIntersectionT(previousPosition, projectile.position, blocker, radius);
      if (t === null) continue;
      const impactY = THREE.MathUtils.lerp(previousPosition.y, projectile.position.y, t);
      const maxHeight = blocker.height ?? 5;
      if (impactY < -0.2 || impactY > maxHeight + 0.8) continue;
      if (closest && t >= closest.t) continue;
      closest = {
        t,
        blocker,
        point: previousPosition.clone().lerp(projectile.position, t),
      };
      closest.point.y = THREE.MathUtils.clamp(impactY, 0.22, maxHeight);
    }
    return closest;
  }

  absorbProjectileByCover(projectile, impact) {
    const owner = this.vehicles.find((vehicle) => vehicle.id === projectile.userData.owner);
    projectile.position.copy(impact.point);
    if (projectile.userData.dynamite) {
      this.detonateDynamite(projectile);
      this.pushCoverLog(`${impact.blocker.name ?? "加固建筑"} 扛住雷管冲击`);
      return;
    }

    projectile.userData.life = 0;
    this.addExplosion(impact.point, owner?.accent ?? 0xffd166, projectile.userData.ciws ? 2 : 7);
    if (!projectile.userData.ciws) {
      this.shake = Math.max(this.shake, 0.28);
      this.pushCoverLog(`${impact.blocker.name ?? "加固建筑"} 挡下射击`);
    }
  }

  blastCoverMultiplier(origin, target) {
    let cover = 0;
    for (const blocker of this.attackBlockers) {
      if (distancePointToSegmentXZ(blocker, origin, target) < blocker.radius) {
        cover += blocker.armor ?? 1;
      }
    }
    if (cover >= 4) return 0.16;
    if (cover >= 2) return 0.28;
    if (cover > 0) return 0.42;
    return 1;
  }

  resolveVehicleCoverCollision(vehicle) {
    for (const blocker of this.attackBlockers) {
      const minDistance = blocker.radius + 1.85;
      const dx = vehicle.x - blocker.x;
      const dz = vehicle.z - blocker.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= minDistance) continue;
      const pushX = distance > 0.001 ? dx / distance : vehicle.id === 1 ? -1 : 1;
      const pushZ = distance > 0.001 ? dz / distance : 0;
      vehicle.x = THREE.MathUtils.clamp(blocker.x + pushX * minDistance, -ARENA.x, ARENA.x);
      vehicle.z = THREE.MathUtils.clamp(blocker.z + pushZ * minDistance, ARENA.zMin, ARENA.zMax);
      const pushNormal = new THREE.Vector3(pushX, 0, pushZ);
      const inwardVelocity = vehicle.velocity.dot(pushNormal);
      if (inwardVelocity < 0) {
        vehicle.velocity.addScaledVector(pushNormal, -inwardVelocity);
      }
    }
  }

  pushCoverLog(line) {
    if (this.coverLogCooldown > 0) return;
    this.pushLog(line);
    this.coverLogCooldown = 1.1;
  }

  applyBlastMotion(vehicle, dt) {
    if (vehicle.blastVelocity.lengthSq() > 0.01) {
      vehicle.x = THREE.MathUtils.clamp(vehicle.x + vehicle.blastVelocity.x * dt, -ARENA.x, ARENA.x);
      vehicle.z = THREE.MathUtils.clamp(vehicle.z + vehicle.blastVelocity.z * dt, ARENA.zMin, ARENA.zMax);
      vehicle.velocity.add(vehicle.blastVelocity);
      vehicle.blastVelocity.multiplyScalar(Math.pow(0.08, dt));
    } else {
      vehicle.blastVelocity.set(0, 0, 0);
    }

    if (vehicle.air > 0 || vehicle.verticalVelocity > 0) {
      vehicle.verticalVelocity -= BLAST_GRAVITY * dt;
      vehicle.air = Math.max(0, vehicle.air + vehicle.verticalVelocity * dt);
      if (vehicle.air <= 0) {
        vehicle.air = 0;
        vehicle.verticalVelocity = 0;
      }
    }
  }

  applySlipMotion(vehicle, dt) {
    if (vehicle.slipVelocity.lengthSq() <= 0.01) {
      vehicle.slipVelocity.set(0, 0, 0);
      return;
    }

    vehicle.x = THREE.MathUtils.clamp(vehicle.x + vehicle.slipVelocity.x * dt, -ARENA.x, ARENA.x);
    vehicle.z = THREE.MathUtils.clamp(vehicle.z + vehicle.slipVelocity.z * dt, ARENA.zMin, ARENA.zMax);
    vehicle.velocity.add(vehicle.slipVelocity);
    const friction = vehicle.slipTimer > 0 ? 0.36 : 0.08;
    vehicle.slipVelocity.multiplyScalar(Math.pow(friction, dt));
  }

  slipControlFor(vehicle) {
    if (vehicle.slipTimer <= 0) return 1;
    return 0.28 + 0.42 * (1 - vehicle.slipTimer / BEARING_SLIP_SECONDS);
  }

  slipWobbleFor(vehicle, amount) {
    if (vehicle.slipTimer <= 0) return 0;
    const strength = THREE.MathUtils.clamp(vehicle.slipTimer / BEARING_SLIP_SECONDS, 0, 1);
    return Math.sin(vehicle.slipPhase) * amount * strength;
  }

  addTrackDust() {
    for (const vehicle of this.vehicles) {
      if (!vehicle.alive || vehicle.velocity.length() < 2) continue;
      const back = forwardFromHeading(vehicle.heading).multiplyScalar(-2.8);
      const position = new THREE.Vector3(vehicle.x + back.x, 0.2, vehicle.z + back.z);
      const velocity = vehicle.velocity.clone().multiplyScalar(-0.05);
      velocity.y = 0.18 + Math.random() * 0.2;
      const dust = makeDust(position, velocity, 0x8a8f81);
      this.scene.add(dust);
      this.dust.push(dust);
    }
  }

  addTracer(start, end, color) {
    const tracer = makeTracer(start, end, color);
    this.scene.add(tracer);
    this.tracers.push(tracer);
  }

  addFlash(position, direction) {
    const flash = makeMuzzleFlash(position, direction);
    this.scene.add(flash);
    this.flashes.push(flash);
  }

  addExplosion(position, color, amount) {
    for (const spark of makeExplosion(position, color, amount)) {
      this.scene.add(spark);
      this.sparks.push(spark);
    }
  }

  addBearingScatter(position, color) {
    for (let i = 0; i < 18; i += 1) {
      const bearing = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 8, 6),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? color : 0xc6ccd0,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      bearing.position.copy(position);
      bearing.position.y = Math.max(0.16, bearing.position.y - 0.85);
      const direction = new THREE.Vector3(Math.random() - 0.5, 0.08 + Math.random() * 0.18, Math.random() - 0.5).normalize();
      bearing.userData.velocity = direction.multiplyScalar(4 + Math.random() * 9);
      bearing.userData.life = 0.58 + Math.random() * 0.24;
      this.scene.add(bearing);
      this.sparks.push(bearing);
    }
  }

  finishRound(winner, reason) {
    if (this.finished) return;
    this.finished = true;
    const loser = this.enemyOf(winner);
    const score = Math.round(winner.score + winner.health * 30 + winner.hits * 300);
    this.pushLog(`${winner.name} 胜利`);
    setTimeout(() => {
      this.manager.go("results", {
        score,
        wave: Math.max(winner.hits, loser?.hits ?? 0),
        mode: this.mode,
        winner: winner.name,
        reason,
      });
    }, 850);
  }

  pickWinnerByScore() {
    const [a, b] = this.vehicles;
    if (a.health !== b.health) return a.health > b.health ? a : b;
    if (a.hits !== b.hits) return a.hits > b.hits ? a : b;
    return a.score >= b.score ? a : b;
  }

  enemyOf(vehicle) {
    return this.vehicles.find((item) => item.id !== vehicle.id);
  }

  pushLog(line) {
    this.logs.unshift(line);
    this.logs = this.logs.slice(0, 4);
  }

  disposeScene() {
    this.scene?.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose?.());
      } else {
        object.material?.map?.dispose?.();
        object.material?.dispose?.();
      }
    });
  }
}

function makeDynamiteProjectile(accent) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a1f22,
    roughness: 0.58,
    metalness: 0.08,
  });
  const bandMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c2022,
    roughness: 0.42,
    metalness: 0.42,
  });
  const fuseMaterial = new THREE.MeshBasicMaterial({ color: accent });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 14), bodyMaterial);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  for (const z of [-0.28, 0.28]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.08, 14), bandMaterial);
    band.position.z = z;
    band.rotation.x = Math.PI / 2;
    group.add(band);
  }

  const fuse = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), fuseMaterial);
  fuse.position.z = -0.52;
  group.add(fuse);

  const spark = new THREE.PointLight(accent, 0.9, 8);
  spark.position.z = -0.55;
  group.add(spark);
  return group;
}

function makeBearingProjectile(accent) {
  const group = new THREE.Group();
  const steelMaterial = new THREE.MeshStandardMaterial({
    color: 0xbec5c9,
    roughness: 0.26,
    metalness: 0.92,
  });
  const accentMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), steelMaterial);
  group.add(core);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 8, 24), steelMaterial);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), steelMaterial);
    bead.position.set(Math.cos(angle) * 0.28, Math.sin(angle) * 0.28, 0);
    group.add(bead);
  }

  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 10), accentMaterial);
  group.add(glow);
  const light = new THREE.PointLight(accent, 0.7, 6);
  group.add(light);
  return group;
}

function setupLighting(scene) {
  const sun = new THREE.DirectionalLight(0xfff6dc, 3.0);
  sun.position.set(96, 88, 72);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 300;
  sun.shadow.camera.bottom = -300;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x94dcff, 0x162018, 1.65));

  const rim = new THREE.DirectionalLight(0x43e0ff, 1.1);
  rim.position.set(-170, 44, -260);
  scene.add(rim);

  const fill = new THREE.PointLight(0x43e0ff, 1.45, 260);
  fill.position.set(-86, 16, 34);
  scene.add(fill);

  const warning = new THREE.PointLight(0xff4f64, 0.92, 260);
  warning.position.set(94, 16, -228);
  scene.add(warning);
}

function forwardFromHeading(heading) {
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading)).normalize();
}

function rightFromHeading(heading) {
  return new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)).normalize();
}

function angleToTarget(source, target) {
  return Math.atan2(-(target.x - source.x), -(target.z - source.z));
}

function lerpAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distancePointToSegmentXZ(point, start, end) {
  const sx = start.x;
  const sz = start.z;
  const ex = end.x;
  const ez = end.z;
  const dx = ex - sx;
  const dz = ez - sz;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0.0001) return Math.hypot(point.x - sx, point.z - sz);
  const t = THREE.MathUtils.clamp(((point.x - sx) * dx + (point.z - sz) * dz) / lengthSq, 0, 1);
  return Math.hypot(point.x - (sx + dx * t), point.z - (sz + dz * t));
}

function segmentCircleIntersectionT(start, end, circle, radius = circle.radius) {
  const sx = start.x - circle.x;
  const sz = start.z - circle.z;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const a = dx * dx + dz * dz;
  if (a <= 0.0001) {
    return sx * sx + sz * sz <= radius * radius ? 0 : null;
  }

  const b = 2 * (sx * dx + sz * dz);
  const c = sx * sx + sz * sz - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

function predictedAimPoint(target, leadSeconds = 0.16) {
  const point = new THREE.Vector3(target.x, 0, target.z).addScaledVector(target.velocity, leadSeconds);
  point.x = THREE.MathUtils.clamp(point.x, -ARENA.x, ARENA.x);
  point.z = THREE.MathUtils.clamp(point.z, ARENA.zMin, ARENA.zMax);
  return point;
}

function formatTime(seconds) {
  const minute = Math.floor(seconds / 60);
  const second = seconds % 60;
  return `${minute}:${String(second).padStart(2, "0")}`;
}
