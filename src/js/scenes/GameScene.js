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

const ROUND_SECONDS = 180;
const ARENA = { x: 44, zMin: -96, zMax: 42 };
const BASE_RADIUS = 16;
const BASE_CAPTURE_SECONDS = 6;
const CIWS_RATE_PER_SECOND = 13000 / 60;
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
    this.scene.fog = new THREE.Fog(0x07090d, 88, 260);
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 360);
    this.camera.position.set(-16, 3.1, 32);

    setupLighting(this.scene);
    const battlefield = makeBattlefield();
    this.navBlockers = battlefield.userData.navBlockers ?? [];
    this.scene.add(battlefield);

    this.bases = [
      this.createBase({
        ownerId: 1,
        name: "蓝方基地",
        color: 0x2f5f78,
        accent: 0x43e0ff,
        x: -18,
        z: 34,
      }),
      this.createBase({
        ownerId: 2,
        name: "红方基地",
        color: 0x743941,
        accent: 0xff4f64,
        x: 18,
        z: -82,
      }),
    ];

    this.vehicles = [
      this.createVehicle({
        id: 1,
        name: "蓝方雷霆",
        controller: this.modeInfo.controllers[0],
        color: 0x2f5f78,
        accent: 0x43e0ff,
        x: -16,
        z: 32,
        heading: 0,
      }),
      this.createVehicle({
        id: 2,
        name: "红方错题",
        controller: this.modeInfo.controllers[1],
        color: 0x743941,
        accent: 0xff4f64,
        x: 16,
        z: -78,
        heading: Math.PI,
      }),
    ];

    this.projectiles = [];
    this.sparks = [];
    this.tracers = [];
    this.flashes = [];
    this.dust = [];
    this.clock = 0;
    this.roundTime = ROUND_SECONDS;
    this.paused = false;
    this.finished = false;
    this.shake = 0;
    this.dustTimer = 0;
    this.hitTimer = 0;
    this.damageFlash = 0;
    this.waveAlertTimer = 2.6;
    this.radio = radioLines[0];
    this.radioTimer = 3.2;
    this.logs = [];
    this.navigationActive = false;
    this.navigator = null;
    this.navFocus = new THREE.Vector3(-18, 0, 34);
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
    this.pushLog("点击画面锁定鼠标，WASD 移动，鼠标调整方向");
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
      score: 0,
      hits: 0,
      cooldown: 0.8,
      invincible: 0,
      alive: true,
      group,
      velocity: new THREE.Vector3(),
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
    if (vehicle.controller === "human1") {
      this.updateFirstPersonVehicle(vehicle, enemy, dt);
      return;
    }

    const axis = vehicle.controller === "ai" ? this.aiAxis(vehicle, enemy) : this.input.axisFor(vehicle.id);
    const aimPoint = this.aimPointFor(vehicle, enemy);
    const length = Math.hypot(axis.x, axis.y) || 1;
    const speed = vehicle.controller === "ai" ? 16.4 : 18.2;
    const dx = (axis.x / length) * speed * dt;
    const dz = (axis.y / length) * speed * dt;
    vehicle.x = THREE.MathUtils.clamp(vehicle.x + dx, -ARENA.x, ARENA.x);
    vehicle.z = THREE.MathUtils.clamp(vehicle.z + dz, ARENA.zMin, ARENA.zMax);
    vehicle.velocity.set(dx / Math.max(dt, 0.001), 0, dz / Math.max(dt, 0.001));

    vehicle.aimPoint.copy(aimPoint);
    const aim = angleToTarget(vehicle, aimPoint);
    vehicle.heading = lerpAngle(vehicle.heading, aim, Math.min(1, dt * 4.2));
    vehicle.group.position.set(vehicle.x, 0, vehicle.z);
    vehicle.group.rotation.y = vehicle.heading;
    vehicle.group.rotation.z = THREE.MathUtils.clamp(-axis.x * 0.035, -0.05, 0.05);

    const wantsFire = vehicle.controller === "ai" ? this.aiWantsFire(vehicle, enemy) : this.input.wantsFireFor(vehicle.id);
    if (wantsFire) this.fire(vehicle, enemy, aimPoint);
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

    const axis = this.input.axisFor(vehicle.id);
    const moveLength = Math.hypot(axis.x, axis.y);
    const forward = forwardFromHeading(this.firstPerson.yaw);
    const right = rightFromHeading(this.firstPerson.yaw);
    const move = new THREE.Vector3();
    if (moveLength > 0) {
      move.addScaledVector(right, axis.x / moveLength);
      move.addScaledVector(forward, -axis.y / moveLength);
    }

    const speed = this.input.isSprinting() ? 25.5 : 18.8;
    const dx = move.x * speed * dt;
    const dz = move.z * speed * dt;
    vehicle.x = THREE.MathUtils.clamp(vehicle.x + dx, -ARENA.x, ARENA.x);
    vehicle.z = THREE.MathUtils.clamp(vehicle.z + dz, ARENA.zMin, ARENA.zMax);
    vehicle.velocity.set(dx / Math.max(dt, 0.001), 0, dz / Math.max(dt, 0.001));
    vehicle.heading = this.firstPerson.yaw;
    vehicle.aimPoint.copy(this.centerAimPoint(vehicle));
    vehicle.group.position.set(vehicle.x, 0, vehicle.z);
    vehicle.group.rotation.y = vehicle.heading;
    vehicle.group.rotation.z = THREE.MathUtils.clamp(-axis.x * 0.035, -0.05, 0.05);

    if (moveLength > 0) {
      this.firstPerson.bob += dt * (this.input.isSprinting() ? 12 : 8);
    } else {
      this.firstPerson.bob = THREE.MathUtils.lerp(this.firstPerson.bob, 0, Math.min(1, dt * 4));
    }

    if (this.input.wantsFireFor(vehicle.id)) {
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
    return new THREE.Vector3(vehicle.x, this.firstPerson.eyeHeight, vehicle.z).addScaledVector(forward, 0.7);
  }

  aiAxis(vehicle, enemy) {
    const dx = enemy.x - vehicle.x;
    const dz = enemy.z - vehicle.z;
    const distance = Math.hypot(dx, dz) || 1;
    const toward = new THREE.Vector2(dx / distance, dz / distance);
    const side = new THREE.Vector2(-toward.y, toward.x).multiplyScalar(vehicle.ai.strafe);
    const rangeControl = distance > 72 ? 1.25 : distance > 48 ? 0.95 : distance < 24 ? -0.82 : 0.15;
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
    return distance < 116 && aimQuality > 0.78 && Math.random() < vehicle.ai.fireBias;
  }

  fire(vehicle, enemy, aimPoint = predictedAimPoint(enemy, 0.16)) {
    if (vehicle.cooldown > 0 || !vehicle.alive) return;
    const flatAim = new THREE.Vector3(aimPoint.x - vehicle.x, 0, aimPoint.z - vehicle.z);
    if (flatAim.lengthSq() < 0.5) return;
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
      life: 2.05,
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
      life: 2.05,
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

  aimQualityForFirstPerson(enemy) {
    if (!enemy) return 0;
    const p1 = this.vehicles?.[0];
    if (!p1) return 0;
    const toEnemy = new THREE.Vector3(enemy.x - p1.x, 1.2, enemy.z - p1.z).normalize();
    return this.firstPersonDirection().dot(toEnemy);
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.position.addScaledVector(projectile.userData.velocity, dt);
      projectile.userData.life -= dt;
    }
    const removed = this.projectiles.filter(
      (projectile) =>
        projectile.userData.life <= 0 ||
        Math.abs(projectile.position.x) > 140 ||
        projectile.position.z < -180 ||
        projectile.position.z > 112,
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
      this.fireCiwsRound(base, owner, aimPoint, i);
    }
  }

  ciwsAimPoint(owner, enemy) {
    if (owner.controller.startsWith("human") && this.input.pointer.moved) {
      return this.pointerWorldPoint() ?? predictedAimPoint(enemy, 0.04);
    }
    return predictedAimPoint(enemy, owner.controller === "ai" ? 0.08 : 0.04);
  }

  aiWantsCiws(base, enemy) {
    return distanceXZ(base, enemy) < 98 && this.hasLineOfSight(base, predictedAimPoint(enemy, 0.08));
  }

  fireCiwsRound(base, owner, aimPoint, index) {
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
      life: 0.68,
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
  }

  updateEffects(dt) {
    this.fadeAndCull(this.tracers, dt, 0.08);
    this.fadeAndCull(this.flashes, dt, 0.11);
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
      const owner = this.vehicles.find((vehicle) => vehicle.id === projectile.userData.owner);
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
    const distance = THREE.MathUtils.clamp(distanceXZ(this.vehicles[0], this.vehicles[1]), 42, 118);
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
    this.elements.chargeBar.style.width = `${p2.health}%`;
    this.elements.bearing.textContent = `方位 ${Math.round((p1.heading * 180) / Math.PI + 360) % 360}`;
    this.elements.missionPhase.textContent = this.modeInfo.phase;
    this.elements.altitude.textContent = `距离 ${Math.round(distanceXZ(p1, p2))} m`;
    this.elements.weaponState.textContent = `P1 ${Math.round(p1.health)}% 生命 · ${this.baseStatusFor(p1)}`;
    this.elements.comboState.textContent = `P2 ${Math.round(p2.health)}% 生命 · ${this.baseStatusFor(p2)}`;
    this.elements.systemState.textContent = this.paused
      ? "暂停"
      : this.input.pointerLocked
        ? "鼠标锁定"
        : "点击画面锁定鼠标";
    this.elements.radioLine.textContent = this.radio;
    this.elements.hitMarker.classList.toggle("hit-marker--active", this.hitTimer > 0);
    this.elements.damageVignette.style.opacity = String(Math.min(0.62, this.damageFlash));
    this.elements.waveAlert.textContent = `${this.modeInfo.name} · ${formatTime(seconds)}`;
    this.elements.waveAlert.classList.toggle("wave-alert--active", this.waveAlertTimer > 0);
    this.elements.combatLog.innerHTML = this.logs.map((line) => `<span>${line}</span>`).join("");
    this.updateAimHud(p1);
    this.updateRadar();
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
    if (!navigator) {
      this.elements.radarBlips.innerHTML = "";
      return;
    }

    const navBase = this.baseOf(navigator);
    const dots = [
      ...this.bases.map((base) => ({ x: base.x, z: base.z, kind: base.ownerId === 1 ? "base-blue" : "base-red" })),
      ...this.vehicles
        .filter((vehicle) => this.hasLineOfSight(navBase, vehicle))
        .map((vehicle) => ({ x: vehicle.x, z: vehicle.z, kind: vehicle.id === 1 ? "blue" : "red" })),
      ...this.projectiles.map((projectile) => ({
        x: projectile.position.x,
        z: projectile.position.z,
        kind: projectile.userData.owner === 1 ? "shot-blue" : "shot-red",
      })).filter((projectile) => this.hasLineOfSight(navBase, projectile)),
    ];
    const centerZ = (ARENA.zMin + ARENA.zMax) / 2;
    const halfZ = (ARENA.zMax - ARENA.zMin) / 2;
    this.elements.radarBlips.innerHTML = dots
      .map((dot) => {
        const left = THREE.MathUtils.clamp(50 + (dot.x / ARENA.x) * 42, 8, 92);
        const top = THREE.MathUtils.clamp(50 + ((dot.z - centerZ) / halfZ) * 42, 8, 92);
        return `<span class="radar__blip radar__blip--${dot.kind}" style="left:${left}%;top:${top}%"></span>`;
      })
      .join("");
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

  baseStatusFor(vehicle) {
    const base = this.baseOf(vehicle);
    const capture = Math.round((base?.capture ?? 0) * 100);
    const inside = base && this.isInsideBase(vehicle, base);
    return `${inside ? "基地内" : "野外"} / 基地${capture}%`;
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

function setupLighting(scene) {
  const sun = new THREE.DirectionalLight(0xfff6dc, 3.0);
  sun.position.set(28, 42, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x94dcff, 0x162018, 1.65));

  const rim = new THREE.DirectionalLight(0x43e0ff, 1.1);
  rim.position.set(-70, 28, -92);
  scene.add(rim);

  const fill = new THREE.PointLight(0x43e0ff, 1.45, 120);
  fill.position.set(-34, 12, 26);
  scene.add(fill);

  const warning = new THREE.PointLight(0xff4f64, 0.92, 100);
  warning.position.set(42, 10, -82);
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
