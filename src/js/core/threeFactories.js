import * as THREE from "../../vendor/three.module.js";

export function makeTank(options = {}) {
  const group = new THREE.Group();
  group.name = "CopperPlate MBT";

  const baseColor = options.color ?? 0x2f3b32;
  const accent = options.accent ?? 0xffd166;
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: makeArmorTexture(`armor-${baseColor}`, baseColor, accent),
    roughness: 0.66,
    metalness: 0.3,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x111716,
    map: makeArmorTexture("track-rubber", 0x151917, 0x3d4a43),
    roughness: 0.9,
    metalness: 0.14,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x3f4744, roughness: 0.58, metalness: 0.42 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1719,
    emissive: accent,
    emissiveIntensity: 0.18,
    roughness: 0.22,
    metalness: 0.05,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: accent });

  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.72, 6.55), darkMaterial);
  lowerHull.position.y = 0.74;
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  group.add(lowerHull);

  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.95, 1.08, 5.95), hullMaterial);
  hull.position.y = 1.05;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const glacis = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.34, 1.18), hullMaterial);
  glacis.position.set(0, 1.55, -2.62);
  glacis.rotation.x = -0.24;
  glacis.castShadow = true;
  group.add(glacis);

  const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.16, 1.38), metalMaterial);
  engineDeck.position.set(0, 1.66, 2.18);
  engineDeck.castShadow = true;
  group.add(engineDeck);

  for (let i = 0; i < 5; i += 1) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.05, 0.11), darkMaterial);
    vent.position.set(0, 1.77, 1.65 + i * 0.23);
    vent.castShadow = true;
    group.add(vent);
  }

  const turret = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.04, 2.72), hullMaterial);
  turret.position.set(0, 2.18, -0.48);
  turret.castShadow = true;
  group.add(turret);

  const turretFront = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.62, 0.48), metalMaterial);
  turretFront.position.set(0, 2.22, -1.97);
  turretFront.castShadow = true;
  group.add(turretFront);

  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.18, 22), metalMaterial);
  hatch.position.set(-0.78, 2.82, -0.35);
  hatch.castShadow = true;
  group.add(hatch);

  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.62), glassMaterial);
  optic.position.set(0.9, 2.79, -1.02);
  group.add(optic);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.23, 7.35, 22), darkMaterial);
  barrel.position.set(0, 2.24, -4.5);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  group.add(barrel);

  const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.42), metalMaterial);
  muzzleBrake.position.set(0, 2.24, -8.18);
  muzzleBrake.castShadow = true;
  group.add(muzzleBrake);

  const muzzleSlot = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.52), darkMaterial);
  muzzleSlot.position.set(0, 2.24, -8.18);
  group.add(muzzleSlot);

  for (const x of [-2.65, 2.65]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.78, 6.78), darkMaterial);
    track.position.set(x, 0.62, 0);
    track.castShadow = true;
    track.receiveShadow = true;
    group.add(track);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.52, 5.82), hullMaterial);
    skirt.position.set(x * 0.88, 1.14, -0.04);
    skirt.castShadow = true;
    group.add(skirt);

    for (let i = 0; i < 7; i += 1) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 20), metalMaterial);
      wheel.position.set(x, 0.58, -2.72 + i * 0.9);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      group.add(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 14), glowMaterial);
      hub.position.copy(wheel.position);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
    }

    for (let i = 0; i < 10; i += 1) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.34), metalMaterial);
      tread.position.set(x, 1.05, -3.04 + i * 0.68);
      tread.castShadow = true;
      group.add(tread);
    }
  }

  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.65), glowMaterial);
  marker.position.set(0, 2.72, -1.58);
  group.add(marker);

  for (const x of [-1.95, 1.95]) {
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), glowMaterial);
    headlight.position.set(x, 1.42, -3.1);
    group.add(headlight);
  }

  for (const x of [-1.2, 1.2]) {
    const exhaust = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.2), darkMaterial);
    exhaust.position.set(x, 1.05, 3.12);
    group.add(exhaust);
  }

  for (let i = 0; i < 8; i += 1) {
    for (const x of [-2.24, 2.24]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8), metalMaterial);
      bolt.position.set(x, 1.52, -2.35 + i * 0.64);
      bolt.rotation.z = Math.PI / 2;
      group.add(bolt);
    }
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.4, 8), darkMaterial);
  antenna.position.set(1.22, 3.58, 0.72);
  antenna.rotation.x = 0.14;
  group.add(antenna);

  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glowMaterial);
  antennaTip.position.set(1.22, 4.82, 0.9);
  group.add(antennaTip);

  return group;
}

export function makeHumanCombatant(options = {}) {
  const group = new THREE.Group();
  group.name = "Infantry Combatant";

  const baseColor = options.color ?? 0x2f3b32;
  const accent = options.accent ?? 0xffd166;
  const uniformMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: makeArmorTexture(`uniform-${baseColor}`, baseColor, accent),
    roughness: 0.78,
    metalness: 0.08,
  });
  const armorMaterial = new THREE.MeshStandardMaterial({ color: 0x1a211f, roughness: 0.72, metalness: 0.18 });
  const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x101413, roughness: 0.88, metalness: 0.08 });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x3f4744, roughness: 0.56, metalness: 0.42 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xc58b66, roughness: 0.64, metalness: 0.02 });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c171a,
    emissive: accent,
    emissiveIntensity: 0.2,
    roughness: 0.22,
    metalness: 0.05,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: accent });

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.62), bootMaterial);
  leftBoot.position.set(-0.28, 0.12, -0.02);
  leftBoot.castShadow = true;
  leftBoot.receiveShadow = true;
  group.add(leftBoot);

  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.28;
  group.add(rightBoot);

  for (const side of [-1, 1]) {
    const x = side * 0.26;
    addLimb(group, new THREE.Vector3(x, 0.26, 0.02), new THREE.Vector3(x, 1.08, 0.02), 0.13, uniformMaterial);
    addLimb(group, new THREE.Vector3(x, 1.08, 0.02), new THREE.Vector3(side * 0.18, 1.86, -0.04), 0.17, uniformMaterial);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), armorMaterial);
    knee.position.set(x, 1.08, -0.02);
    knee.castShadow = true;
    group.add(knee);
  }

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.36, 0.5), armorMaterial);
  pelvis.position.set(0, 1.92, -0.02);
  pelvis.castShadow = true;
  group.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, 1.24, 8), uniformMaterial);
  torso.position.set(0, 2.5, -0.02);
  torso.scale.z = 0.72;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.94, 0.46), armorMaterial);
  vest.position.set(0, 2.48, -0.24);
  vest.castShadow = true;
  group.add(vest);

  const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.04), glowMaterial);
  chestLight.position.set(0, 2.78, -0.49);
  group.add(chestLight);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.02, 0.34), armorMaterial);
  backpack.position.set(0, 2.48, 0.38);
  backpack.castShadow = true;
  group.add(backpack);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.22, 14), skinMaterial);
  neck.position.set(0, 3.16, -0.04);
  neck.castShadow = true;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 22, 16), skinMaterial);
  head.position.set(0, 3.48, -0.08);
  head.castShadow = true;
  group.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.39, 22, 12), uniformMaterial);
  helmet.position.set(0, 3.65, -0.06);
  helmet.scale.y = 0.52;
  helmet.castShadow = true;
  group.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.06), visorMaterial);
  visor.position.set(0, 3.5, -0.39);
  group.add(visor);

  const helmetBand = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 22), armorMaterial);
  helmetBand.position.set(0, 3.54, -0.06);
  helmetBand.scale.z = 0.76;
  helmetBand.castShadow = true;
  group.add(helmetBand);

  const leftShoulder = new THREE.Vector3(-0.58, 2.94, -0.1);
  const rightShoulder = new THREE.Vector3(0.58, 2.94, -0.1);
  const leftElbow = new THREE.Vector3(-0.36, 2.48, -0.72);
  const rightElbow = new THREE.Vector3(0.36, 2.48, -0.72);
  const leftHand = new THREE.Vector3(-0.16, 2.36, -1.32);
  const rightHand = new THREE.Vector3(0.16, 2.36, -1.32);
  addLimb(group, leftShoulder, leftElbow, 0.13, uniformMaterial);
  addLimb(group, rightShoulder, rightElbow, 0.13, uniformMaterial);
  addLimb(group, leftElbow, leftHand, 0.11, uniformMaterial);
  addLimb(group, rightElbow, rightHand, 0.11, uniformMaterial);

  for (const handPosition of [leftHand, rightHand]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), skinMaterial);
    hand.position.copy(handPosition);
    hand.castShadow = true;
    group.add(hand);
  }

  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.98), metalMaterial);
  rifleBody.position.set(0, 2.36, -1.26);
  rifleBody.castShadow = true;
  group.add(rifleBody);

  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 12), metalMaterial);
  rifleBarrel.position.set(0, 2.38, -2.12);
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.castShadow = true;
  group.add(rifleBarrel);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.42), armorMaterial);
  stock.position.set(0, 2.36, -0.66);
  stock.castShadow = true;
  group.add(stock);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glowMaterial);
  muzzle.position.set(0, 2.38, -2.9);
  group.add(muzzle);

  const armband = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), glowMaterial);
  armband.position.set(0.55, 2.56, -0.48);
  armband.rotation.z = -0.42;
  group.add(armband);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.35, 8), metalMaterial);
  antenna.position.set(0.38, 3.08, 0.52);
  antenna.rotation.x = 0.2;
  group.add(antenna);

  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMaterial);
  antennaTip.position.set(0.38, 3.78, 0.66);
  group.add(antennaTip);

  return group;
}

function addLimb(group, start, end, radius, material) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius, length, 14), material);
  limb.position.copy(start).add(end).multiplyScalar(0.5);
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  limb.castShadow = true;
  limb.receiveShadow = true;
  group.add(limb);
  return limb;
}

export function makeBattlefield() {
  const group = new THREE.Group();
  const navBlockers = [];
  const attackBlockers = [];
  const field = {
    width: 620,
    depth: 780,
    centerZ: -100,
  };
  const fieldMinZ = field.centerZ - field.depth / 2;
  const fieldMaxZ = field.centerZ + field.depth / 2;

  const terrainGeometry = new THREE.PlaneGeometry(field.width, field.depth, 168, 212);
  const terrainRandom = seededRandom(7401);
  const positions = terrainGeometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const ripple = Math.sin(x * 0.055) * 0.1 + Math.cos(y * 0.04) * 0.08 + (terrainRandom() - 0.5) * 0.1;
    positions.setZ(i, ripple);
  }
  terrainGeometry.computeVertexNormals();

  const ground = new THREE.Mesh(terrainGeometry, makeGroundMaterial(field.width, field.depth));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = field.centerZ;
  ground.receiveShadow = true;
  group.add(ground);

  const grid = new THREE.GridHelper(field.width, 124, 0x52685f, 0x24302c);
  grid.position.y = 0.03;
  grid.position.z = field.centerZ;
  group.add(grid);

  const plateMaterial = new THREE.MeshStandardMaterial({
    color: 0x252b28,
    map: makeArmorTexture("runway-plate", 0x242923, 0x52685f),
    roughness: 0.8,
    metalness: 0.16,
  });
  for (let i = 0; i < 56; i += 1) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(22, 0.05, 6.1), plateMaterial);
    plate.position.set(0, 0.06, 76 - i * 10.8);
    plate.receiveShadow = true;
    group.add(plate);

    if (i % 2 === 0) {
      for (const x of [-13.6, 13.6]) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.06, 4.2),
          new THREE.MeshBasicMaterial({ color: x < 0 ? 0x43e0ff : 0xffd166, transparent: true, opacity: 0.7 }),
        );
        stripe.position.set(x, 0.1, 76 - i * 10.8);
        group.add(stripe);
      }
    }
  }

  const rand = seededRandom(1083);
  const crateMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b352b,
    map: makeArmorTexture("supply-crate", 0x3b352b, 0x7e7462),
    roughness: 0.9,
    metalness: 0.05,
  });
  for (let i = 0; i < 112; i += 1) {
    const size = 1.8 + rand() * 2.6;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(size, 1.0 + rand() * 1.4, size * (0.75 + rand() * 0.55)), crateMaterial);
    crate.position.set((rand() < 0.5 ? -1 : 1) * (34 + rand() * 255), 0.78, fieldMaxZ - 34 - rand() * (field.depth - 84));
    crate.rotation.y = rand() * Math.PI;
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);
    navBlockers.push({ x: crate.position.x, z: crate.position.z, radius: size * 0.72 });
  }

  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x54564e, roughness: 0.86, metalness: 0.05 });
  for (let i = 0; i < 42; i += 1) {
    for (const side of [-1, 1]) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.85, 0.8), barrierMaterial);
      barrier.position.set(side * (22 + (i % 3) * 3.8), 0.45, 62 - i * 11.4);
      barrier.rotation.y = side * (0.35 + (i % 2) * 0.22);
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      group.add(barrier);
      navBlockers.push({ x: barrier.position.x, z: barrier.position.z, radius: 2.8 });
    }
  }

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f3732,
    map: makeArmorTexture("hardened-building", 0x2f3732, 0x43e0ff),
    roughness: 0.84,
    metalness: 0.12,
  });
  const bunkerMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5149,
    map: makeArmorTexture("reinforced-bunker", 0x4b5149, 0xffd166),
    roughness: 0.88,
    metalness: 0.08,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x151a18, roughness: 0.78, metalness: 0.26 });
  const slitMaterial = new THREE.MeshBasicMaterial({ color: 0x43e0ff, transparent: true, opacity: 0.55 });
  const buildingPlans = [
    { name: "北侧指挥楼", x: -48, z: -32, width: 16, depth: 10, height: 7.2, rotation: 0.16, bunker: false },
    { name: "中部雷达站", x: -10, z: -70, width: 14, depth: 18, height: 8.4, rotation: -0.08, bunker: false, dish: true },
    { name: "东侧通讯塔楼", x: 38, z: -38, width: 12, depth: 12, height: 11.5, rotation: 0.22, bunker: false },
    { name: "东线装甲库", x: 66, z: -102, width: 18, depth: 11, height: 6.8, rotation: -0.2, bunker: true },
    { name: "西线仓库", x: -72, z: -126, width: 14, depth: 20, height: 8.2, rotation: 0.1, bunker: true },
    { name: "中央弹药棚", x: -28, z: -160, width: 22, depth: 12, height: 6.4, rotation: -0.32, bunker: true },
    { name: "南侧维修库", x: 28, z: -192, width: 14, depth: 16, height: 7.8, rotation: 0.14, bunker: true },
    { name: "南线通讯楼", x: -2, z: -226, width: 18, depth: 10, height: 6.6, rotation: -0.18, bunker: false },
    { name: "西南掩体", x: -92, z: -194, width: 12, depth: 13, height: 5.8, rotation: 0.3, bunker: true },
    { name: "东南掩体", x: 94, z: -164, width: 13, depth: 12, height: 5.9, rotation: -0.26, bunker: true },
    { name: "西北岗楼", x: -92, z: -42, width: 10, depth: 12, height: 9.6, rotation: -0.12, bunker: false },
    { name: "跑道控制室", x: 18, z: 10, width: 13, depth: 9, height: 6.2, rotation: 0.28, bunker: false },
  ];

  for (const plan of buildingPlans) {
    const building = makeHardenedBuilding(plan, {
      buildingMaterial,
      bunkerMaterial,
      roofMaterial,
      slitMaterial,
      towerMaterial: barrierMaterial,
    });
    group.add(building);

    const blocker = {
      name: plan.name,
      x: plan.x,
      z: plan.z,
      radius: Math.hypot(plan.width, plan.depth) * 0.42 + 1.2,
      height: plan.height + 1.4,
      armor: plan.bunker ? 3 : 2,
    };
    navBlockers.push(blocker);
    attackBlockers.push(blocker);
  }

  const scorchMaterial = new THREE.MeshBasicMaterial({
    color: 0x060707,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 90; i += 1) {
    const crater = new THREE.Mesh(new THREE.RingGeometry(1.5 + rand() * 1.2, 2.2 + rand() * 1.8, 32), scorchMaterial.clone());
    crater.position.set((rand() - 0.5) * 520, 0.11, fieldMaxZ - 46 - rand() * (field.depth - 120));
    crater.rotation.x = -Math.PI / 2;
    crater.rotation.z = rand() * Math.PI;
    group.add(crater);
  }

  const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3936, roughness: 0.76, metalness: 0.22 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i += 1) {
      const tower = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6 + i, 0.35), towerMaterial);
      mast.position.y = 3 + i * 0.5;
      mast.castShadow = true;
      tower.add(mast);
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.18), towerMaterial);
      crossbar.position.y = 5.7 + i * 0.5;
      tower.add(crossbar);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 8),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd166 : 0x43e0ff }),
      );
      beacon.position.y = 6.5 + i * 0.5;
      tower.add(beacon);
      const light = new THREE.PointLight(i % 2 ? 0xffd166 : 0x43e0ff, 0.72, 24);
      light.position.copy(beacon.position);
      tower.add(light);
      tower.position.set(side * (54 + i * 25), 0, 70 - i * 58);
      group.add(tower);
      navBlockers.push({ x: tower.position.x, z: tower.position.z, radius: 1.1 });
    }
  }

  const dish = new THREE.Group();
  const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 5.2, 12), towerMaterial);
  dishMast.position.y = 2.6;
  dish.add(dishMast);
  const dishBowl = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2b3436, roughness: 0.62, metalness: 0.3, side: THREE.DoubleSide }),
  );
  dishBowl.position.set(0, 5.2, 0);
  dishBowl.rotation.x = -0.75;
  dish.add(dishBowl);
  dish.position.set(-226, 0, -348);
  dish.rotation.y = 0.8;
  group.add(dish);
  navBlockers.push({ x: dish.position.x, z: dish.position.z, radius: 5.4 });

  const ridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x101412, roughness: 0.96, metalness: 0.02 });
  for (let i = 0; i < 34; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5 + rand() * 4.5, 0), ridgeMaterial);
    rock.position.set(-300 + i * 18 + rand() * 8, 1.4, fieldMinZ + 22 - rand() * 30);
    rock.scale.set(1.2 + rand() * 1.8, 0.45 + rand() * 0.9, 0.8 + rand());
    rock.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 36, 18),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22 }),
  );
  moon.position.set(124, 62, -430);
  group.add(moon);

  const moonHalo = new THREE.Mesh(
    new THREE.RingGeometry(11, 14, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  moonHalo.position.copy(moon.position);
  moonHalo.lookAt(0, 20, 0);
  group.add(moonHalo);

  group.add(makeStarfield(rand, field));
  group.userData.navBlockers = navBlockers;
  group.userData.attackBlockers = attackBlockers;

  return group;
}

function makeHardenedBuilding(plan, materials) {
  const group = new THREE.Group();
  group.name = plan.name;
  group.position.set(plan.x, 0, plan.z);
  group.rotation.y = plan.rotation;

  const wallMaterial = plan.bunker ? materials.bunkerMaterial : materials.buildingMaterial;
  const body = new THREE.Mesh(new THREE.BoxGeometry(plan.width, plan.height, plan.depth), wallMaterial);
  body.position.y = plan.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(plan.width + 1.2, 0.44, plan.depth + 1.2), materials.roofMaterial);
  roof.position.y = plan.height + 0.22;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(plan.width + 3.2, 0.16, plan.depth + 3.2),
    new THREE.MeshStandardMaterial({ color: 0x202622, roughness: 0.9, metalness: 0.05 }),
  );
  apron.position.y = 0.1;
  apron.receiveShadow = true;
  group.add(apron);

  const slitY = Math.min(plan.height - 1.1, 3.4);
  for (const side of [-1, 1]) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(plan.width * 0.58, 0.16, 0.06), materials.slitMaterial);
    slit.position.set(0, slitY, side * (plan.depth / 2 + 0.035));
    group.add(slit);
  }

  for (const side of [-1, 1]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, plan.depth * 0.42), materials.roofMaterial);
    vent.position.set(side * plan.width * 0.32, plan.height + 0.78, 0);
    vent.castShadow = true;
    group.add(vent);
  }

  if (plan.dish) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 4.4, 10), materials.towerMaterial);
    mast.position.set(plan.width * 0.22, plan.height + 2.2, -plan.depth * 0.12);
    mast.castShadow = true;
    group.add(mast);

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x243033, roughness: 0.5, metalness: 0.34, side: THREE.DoubleSide }),
    );
    dish.position.set(plan.width * 0.22, plan.height + 4.5, -plan.depth * 0.12);
    dish.rotation.x = -0.72;
    dish.rotation.y = 0.35;
    group.add(dish);
  }

  return group;
}

export function makeBase(options = {}) {
  const radius = options.radius ?? 15;
  const color = options.color ?? 0x2f5f78;
  const accent = options.accent ?? 0x43e0ff;
  const group = new THREE.Group();
  group.name = `${options.name ?? "Forward Base"} Base`;

  const deckMaterial = new THREE.MeshStandardMaterial({
    color,
    map: makeArmorTexture(`base-${color}`, color, accent),
    roughness: 0.78,
    metalness: 0.18,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x101716, roughness: 0.88, metalness: 0.16 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x424a43, roughness: 0.82, metalness: 0.08 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: accent });

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.22, 72), deckMaterial);
  deck.position.y = 0.12;
  deck.receiveShadow = true;
  group.add(deck);

  const perimeter = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.15, 0.16, 10, 96),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.44 }),
  );
  perimeter.position.y = 0.32;
  perimeter.rotation.x = Math.PI / 2;
  group.add(perimeter);

  const captureRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.85, 0.09, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xff4f64, transparent: true, opacity: 0.08 }),
  );
  captureRing.position.y = 0.38;
  captureRing.rotation.x = Math.PI / 2;
  group.add(captureRing);

  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, 0.62), wallMaterial);
    wall.position.set(Math.sin(angle) * (radius - 0.8), 0.75, Math.cos(angle) * (radius - 0.8));
    wall.rotation.y = angle;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  const command = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.2, 4.6), deckMaterial);
  command.position.set(-4.2, 1.22, 3.4);
  command.castShadow = true;
  command.receiveShadow = true;
  group.add(command);

  const navMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 8.2, 12), darkMaterial);
  navMast.position.set(-6.4, 4.2, 1.4);
  navMast.castShadow = true;
  group.add(navMast);

  const navDish = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x273235, roughness: 0.48, metalness: 0.34, side: THREE.DoubleSide }),
  );
  navDish.position.set(-6.4, 8.35, 1.4);
  navDish.rotation.x = -0.72;
  group.add(navDish);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), glowMaterial);
  beacon.position.set(-6.4, 9.25, 1.4);
  group.add(beacon);

  const turret = new THREE.Group();
  turret.position.set(4.7, 1.02, -3.7);
  group.add(turret);

  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 1.05, 24), wallMaterial);
  turretBase.position.y = 0.52;
  turretBase.castShadow = true;
  turret.add(turretBase);

  const turretHead = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.82, 1.72), deckMaterial);
  turretHead.position.y = 1.2;
  turretHead.castShadow = true;
  turret.add(turretHead);

  for (const x of [-0.42, -0.14, 0.14, 0.42]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 4.2, 10), darkMaterial);
    barrel.position.set(x, 1.24, -2.45);
    barrel.rotation.x = Math.PI / 2;
    barrel.castShadow = true;
    turret.add(barrel);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 1.24, -4.65);
  turret.add(muzzle);

  const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.82, 18), darkMaterial);
  ammoDrum.position.set(1.38, 1.18, 0.12);
  ammoDrum.rotation.z = Math.PI / 2;
  turret.add(ammoDrum);

  group.userData.turret = turret;
  group.userData.muzzle = muzzle;
  group.userData.captureRing = captureRing;
  group.userData.perimeter = perimeter;
  return group;
}

export function makeTokenMesh(word, type) {
  const colors = {
    concept: 0x43e0ff,
    hazard: 0xff4f64,
    rare: 0xffd166,
  };
  const group = new THREE.Group();
  const color = colors[type];
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: type === "hazard" ? 0.48 : 0.32,
    roughness: 0.48,
    metalness: 0.22,
  });
  const core = new THREE.Mesh(
    type === "hazard" ? new THREE.OctahedronGeometry(1.15, 0) : new THREE.IcosahedronGeometry(1.05, 1),
    material,
  );
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.045, 8, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const label = makeLabelSprite(word, color);
  label.position.y = 1.9;
  group.add(label);

  return group;
}

export function makeLabelSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  roundedRect(ctx, 12, 20, 488, 116, 18);
  ctx.fillStyle = "rgba(4, 8, 12, 0.78)";
  ctx.fill();
  ctx.strokeStyle = hex;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#f6fbff";
  ctx.font = "800 40px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, text, 256, 78, 440);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(5.4, 1.7, 1);
  return sprite;
}

export function makeTracer(start, end, color = 0xffd166) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(0.01, direction.length());
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.025, length, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.userData.life = 0.08;
  return mesh;
}

export function makeExplosion(position, color, count = 18) {
  const items = [];
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0xfff0a6,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.position.copy(position);
  core.userData.velocity = new THREE.Vector3(0, 0.9, 0);
  core.userData.life = 0.36;
  items.push(core);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 2.7, 42),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.position.copy(position);
  ring.position.y = 0.13;
  ring.rotation.x = -Math.PI / 2;
  ring.userData.life = 0.52;
  items.push(ring);

  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.random() * 0.18, 8, 8),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.position.copy(position);
    const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.72, Math.random() - 0.5).normalize();
    mesh.userData.velocity = direction.multiplyScalar(8 + Math.random() * 15);
    mesh.userData.life = 0.5 + Math.random() * 0.32;
    items.push(mesh);
  }

  for (let i = 0; i < Math.ceil(count * 0.45); i += 1) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 + Math.random() * 0.45, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x333735, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    smoke.position.copy(position);
    const direction = new THREE.Vector3(Math.random() - 0.5, 0.3 + Math.random() * 0.8, Math.random() - 0.5).normalize();
    smoke.userData.velocity = direction.multiplyScalar(1.4 + Math.random() * 3.2);
    smoke.userData.life = 0.72 + Math.random() * 0.4;
    items.push(smoke);
  }

  return items;
}

export function makeMuzzleFlash(position, direction) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.4, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff0a6, transparent: true, opacity: 0.94 }),
  );
  core.rotation.x = Math.PI / 2;
  group.add(core);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(halo);

  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.74, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfff0a6,
      transparent: true,
      opacity: 0.66,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shock.rotation.y = Math.PI / 2;
  group.add(shock);

  const light = new THREE.PointLight(0xffd166, 2.4, 16);
  group.add(light);

  group.position.copy(position);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());
  group.userData.life = 0.11;
  return group;
}

export function makeDust(position, velocity, color = 0x8a8f81) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2 + Math.random() * 0.28, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  mesh.position.copy(position);
  mesh.scale.set(1.3 + Math.random() * 1.4, 0.58 + Math.random() * 0.35, 1.0 + Math.random() * 1.0);
  mesh.userData.velocity = velocity;
  mesh.userData.life = 0.72 + Math.random() * 0.34;
  return mesh;
}

function makeArmorTexture(key, baseColor, accentColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(hashString(key));
  ctx.fillStyle = hexStyle(baseColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 1200; i += 1) {
    const shade = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.015 + rand() * 0.045})`;
    ctx.fillRect(rand() * canvas.width, rand() * canvas.height, 1 + rand() * 3, 1 + rand() * 3);
  }

  ctx.strokeStyle = rgbaStyle(0xffffff, 0.12);
  ctx.lineWidth = 1;
  for (let i = 0; i < 22; i += 1) {
    const y = rand() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(rand() * canvas.width, y);
    ctx.lineTo(rand() * canvas.width, y + (rand() - 0.5) * 28);
    ctx.stroke();
  }

  ctx.strokeStyle = rgbaStyle(accentColor, 0.2);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const x = 12 + rand() * 168;
    ctx.beginPath();
    ctx.moveTo(x, 8 + rand() * 42);
    ctx.lineTo(x + (rand() - 0.5) * 24, 120 + rand() * 56);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.6, 1.6);
  return texture;
}

function makeGroundMaterial(width = 280, depth = 380) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(9217);
  ctx.fillStyle = "#151815";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 7000; i += 1) {
    const green = 18 + Math.floor(rand() * 24);
    const alpha = 0.04 + rand() * 0.1;
    ctx.fillStyle = `rgba(${green}, ${green + 8}, ${green + 4}, ${alpha})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, 1 + rand() * 3);
  }

  ctx.strokeStyle = "rgba(95, 122, 108, 0.16)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rand() - 0.5) * 8, 512);
    ctx.stroke();
  }
  for (let y = 0; y < 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(4, 7, 7, 0.34)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 52; i += 1) {
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 70, y + rand() * 55, x + (rand() - 0.5) * 95, y + rand() * 105, x + (rand() - 0.5) * 150, y + rand() * 140);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 40, depth / 38);

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: 0.96,
    metalness: 0.035,
  });
}

function makeStarfield(rand, field = { width: 280, depth: 380, centerZ: -48 }) {
  const count = 760;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (rand() - 0.5) * field.width * 1.4;
    positions[i * 3 + 1] = 42 + rand() * 96;
    positions[i * 3 + 2] = field.centerZ + field.depth * 0.38 - rand() * field.depth * 1.08;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd7f6ff,
    size: 0.55,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function hexStyle(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function rgbaStyle(color, alpha) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fitText(ctx, text, x, y, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let label = text;
  while (label.length > 2 && ctx.measureText(`${label}...`).width > maxWidth) {
    label = label.slice(0, -1);
  }
  ctx.fillText(`${label}...`, x, y);
}
