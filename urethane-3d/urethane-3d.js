import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const canvas = document.querySelector("#game-canvas");
const overlay = document.querySelector("#overlay");
const impactFlash = document.querySelector("#impact-flash");
const warningVignette = document.querySelector("#warning-vignette");
const startButtons = [document.querySelector("#start-run"), document.querySelector("#overlay-start")].filter(Boolean);

const statusText = document.querySelector("#status-text");
const phaseText = document.querySelector("#phase-text");
const objectiveText = document.querySelector("#objective-text");
const shardCount = document.querySelector("#shard-count");
const healthCount = document.querySelector("#health-count");
const timeCount = document.querySelector("#time-count");
const boostCount = document.querySelector("#boost-count");
const checkpointText = document.querySelector("#checkpoint-text");
const pressureText = document.querySelector("#pressure-text");
const scoreCount = document.querySelector("#score-count");

const healthFill = document.querySelector("#health-fill");
const timeFill = document.querySelector("#time-fill");
const boostFill = document.querySelector("#boost-fill");

const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector(".overlay-card h2");
const overlayCopy = document.querySelector("#overlay-copy");
const overlaySummary = document.querySelector("#overlay-summary");
const overlayStart = document.querySelector("#overlay-start");
const deviceNote = document.querySelector("#device-note");
const crosshair = document.querySelector("#crosshair");
const controlToast = document.querySelector("#control-toast");

const cameraModeText = document.querySelector("#camera-mode-text");
const lookModeText = document.querySelector("#look-mode-text");
const sensitivityValue = document.querySelector("#sensitivity-value");
const sensitivityInput = document.querySelector("#look-sensitivity");
const invertYInput = document.querySelector("#invert-y");
const toggleCameraButton = document.querySelector("#toggle-camera");
const toggleLookButton = document.querySelector("#toggle-look");

const ladderNodes = {
  1: document.querySelector("#ladder-phase-1"),
  2: document.querySelector("#ladder-phase-2"),
  3: document.querySelector("#ladder-phase-3"),
};

if (window.matchMedia("(max-width: 820px)").matches) {
  deviceNote.textContent =
    "This route loads on mobile, but it is still tuned for keyboard and mouse play. Use a desktop or laptop for the full experience.";
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040711);
scene.fog = new THREE.FogExp2(0x040711, 0.018);

const camera = new THREE.PerspectiveCamera(58, canvas.clientWidth / canvas.clientHeight, 0.1, 240);
camera.position.set(0, 8, 12);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const tmpVector = new THREE.Vector3();
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempD = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const clock = new THREE.Clock();
const keys = new Set();
const particles = [];
const cameraRaycaster = new THREE.Raycaster();
const cameraCollisionMeshes = [];

const config = {
  totalTime: 160,
  phase1Target: 4,
  phase2Pressure: 22,
  checkpointTimeFloor: 108,
};

let isDragging = false;
let activePointerId = null;
let flashTimeout = 0;
let trailCooldown = 0;
let checkpointPulse = 0;
let cameraShake = 0;
let jumpBuffer = 0;
let coyoteTime = 0;
let phase = 1;
let timeLeft = config.totalTime;
let health = 100;
let boostEnergy = 100;
let collected = 0;
let phase2PressureLeft = config.phase2Pressure;
let checkpointActivated = false;
let checkpointReady = false;
let exitUnlocked = false;
let gameStarted = false;
let gameFinished = false;
let yaw = 0.18;
let pitch = 0.64;
let targetYaw = yaw;
let targetPitch = pitch;
let velocityY = 0;
let projectedScore = 0;
let finalScore = 0;
let pointerLocked = false;
let lookSensitivity = 1;
let invertY = 1;
let currentCameraModeIndex = 1;
let toastTimeout = 0;
let pointerLockReleaseRequestedAt = 0;

const cameraModes = [
  { id: "chase", label: "Chase Cam", distance: 9.8, height: 4.2, sideOffset: 0, lookAhead: 0.18, baseFov: 58 },
  { id: "shoulder", label: "Shoulder Cam", distance: 5.2, height: 3.05, sideOffset: 1.1, lookAhead: 0.22, baseFov: 62 },
  { id: "cockpit", label: "Cockpit View", distance: 0.05, height: 1.62, sideOffset: 0.08, lookAhead: 0.34, baseFov: 72 },
];

const controlStorageKey = "urethane3d-control-prefs-v1";

const playerState = {
  position: new THREE.Vector3(-12, 0, 12),
  velocity: new THREE.Vector3(),
  radius: 0.8,
  grounded: true,
};

const checkpointSnapshot = {
  available: false,
  timeLeft: config.checkpointTimeFloor,
};

function createGridTexture(baseColor, lineColor, accentColor = "rgba(255,255,255,0.05)") {
  const size = 256;
  const source = document.createElement("canvas");
  source.width = size;
  source.height = size;
  const context = source.getContext("2d");

  context.fillStyle = baseColor;
  context.fillRect(0, 0, size, size);

  context.fillStyle = "rgba(255,255,255,0.025)";
  for (let index = 0; index < 1800; index += 1) {
    context.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }

  context.strokeStyle = lineColor;
  context.lineWidth = 2;
  for (let step = 0; step <= size; step += 32) {
    context.beginPath();
    context.moveTo(step, 0);
    context.lineTo(step, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, step);
    context.lineTo(size, step);
    context.stroke();
  }

  context.strokeStyle = accentColor;
  context.lineWidth = 1;
  for (let step = 16; step <= size; step += 64) {
    context.beginPath();
    context.moveTo(step, 0);
    context.lineTo(step, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, step);
    context.lineTo(size, step);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(source);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

const floorTexture = createGridTexture("#0c1728", "rgba(88, 222, 255, 0.16)");
const metalTexture = createGridTexture("#171f31", "rgba(247, 189, 101, 0.12)");
const stripeTexture = createGridTexture("#241018", "rgba(255,127,155,0.18)", "rgba(255,210,220,0.04)");

const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(1200 * 3);
for (let index = 0; index < 1200; index += 1) {
  const spread = 160;
  starPositions[index * 3] = (Math.random() - 0.5) * spread;
  starPositions[index * 3 + 1] = Math.random() * 54 + 8;
  starPositions[index * 3 + 2] = (Math.random() - 0.5) * spread;
}
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0x8ed8ff,
    size: 0.24,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  })
);
scene.add(stars);

const hemi = new THREE.HemisphereLight(0xa2ebff, 0x06111b, 1.18);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.45);
dirLight.position.set(10, 20, 6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

const rimLight = new THREE.PointLight(0x57deff, 20, 44, 2);
rimLight.position.set(-14, 7, -10);
scene.add(rimLight);

const warningLight = new THREE.PointLight(0xff7f9b, 16, 36, 2);
warningLight.position.set(4, 5, 4);
scene.add(warningLight);

const exitGlow = new THREE.PointLight(0xf7bd65, 18, 34, 2);
exitGlow.position.set(11.5, 4.4, -10.5);
scene.add(exitGlow);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(18.8, 21.4, 0.9, 56),
  new THREE.MeshStandardMaterial({ color: 0x101e31, map: floorTexture, roughness: 0.82, metalness: 0.16 })
);
floor.position.y = -0.45;
floor.receiveShadow = true;
worldGroup.add(floor);

const floorCap = new THREE.Mesh(
  new THREE.CircleGeometry(18.35, 72),
  new THREE.MeshStandardMaterial({ color: 0x0d1624, map: floorTexture, roughness: 0.9, metalness: 0.08 })
);
floorCap.rotation.x = -Math.PI / 2;
floorCap.receiveShadow = true;
worldGroup.add(floorCap);

function createZonePlate(radius, thickness, color, emissive, x, z) {
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius + 0.6, thickness, 32),
    new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.2, emissive, emissiveIntensity: 0.9, map: metalTexture })
  );
  plate.position.set(x, thickness / 2 - 0.05, z);
  plate.receiveShadow = true;
  plate.castShadow = true;
  worldGroup.add(plate);
  return plate;
}

const startZonePlate = createZonePlate(5.4, 0.34, 0x14304b, 0x0e2f4a, -10.5, 10.2);
const midZonePlate = createZonePlate(6.4, 0.42, 0x151f2f, 0x111b2d, -0.5, 0.5);
const extractZonePlate = createZonePlate(4.9, 0.34, 0x2b1e12, 0x3b2107, 10.5, -10.2);

[
  { x: -6.2, z: 6.3, w: 10.8, d: 1.2, color: 0x203650, emissive: 0x0c2137 },
  { x: 4.8, z: -4.7, w: 10.6, d: 1.2, color: 0x203650, emissive: 0x172b42 },
  { x: 7.2, z: -9.8, w: 6.6, d: 1, color: 0x3a2917, emissive: 0x442302 },
].forEach((layout) => {
  const catwalk = new THREE.Mesh(
    new THREE.BoxGeometry(layout.w, 0.26, layout.d),
    new THREE.MeshStandardMaterial({
      color: layout.color,
      emissive: layout.emissive,
      emissiveIntensity: 0.8,
      roughness: 0.52,
      metalness: 0.18,
      map: metalTexture,
    })
  );
  catwalk.position.set(layout.x, 0.15, layout.z);
  catwalk.receiveShadow = true;
  catwalk.castShadow = true;
  worldGroup.add(catwalk);
});

const skyline = [];
for (let index = 0; index < 26; index += 1) {
  const angle = (index / 26) * Math.PI * 2;
  const height = 4 + Math.random() * 8;
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, height, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x152537, roughness: 0.68, metalness: 0.18, emissive: 0x07111c })
  );
  shaft.position.y = height / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  tower.add(shaft);

  const windowBand = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.16, 1.26),
    new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0x57deff : 0xf7bd65 })
  );
  windowBand.position.y = Math.max(1.2, height - 0.9);
  tower.add(windowBand);
  tower.position.set(Math.cos(angle) * 20.5, 0, Math.sin(angle) * 20.5);
  worldGroup.add(tower);
  skyline.push(tower);
}

const pylons = [];
for (let index = 0; index < 12; index += 1) {
  const angle = (index / 12) * Math.PI * 2;
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x243951, roughness: 0.62, metalness: 0.2, emissive: 0x0c1623 })
  );
  shaft.position.y = 1.6;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0xf7bd65 : 0x57deff })
  );
  beacon.position.y = 3.3;
  group.add(beacon);
  group.position.set(Math.cos(angle) * 14.5, 0, Math.sin(angle) * 14.5);
  worldGroup.add(group);
  pylons.push(group);
}

const hazardStripMaterial = new THREE.MeshStandardMaterial({
  color: 0x311721,
  emissive: 0x4a1222,
  emissiveIntensity: 0.8,
  roughness: 0.42,
  metalness: 0.18,
  map: stripeTexture,
});

[
  { x: -2, z: -3.2, w: 11.2, d: 0.72 },
  { x: 2.8, z: 3.3, w: 11.2, d: 0.72 },
].forEach((layout) => {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(layout.w, 0.06, layout.d), hazardStripMaterial);
  strip.position.set(layout.x, 0.06, layout.z);
  worldGroup.add(strip);
});

const raisedPlatforms = [];
[
  [-12.2, 9.4, 3.2, 3.2, 0.9],
  [-5.8, 2.1, 3.8, 2.4, 0.9],
  [2.2, -6.4, 4.2, 2.4, 1],
  [9.2, -10.6, 3.6, 2.2, 0.7],
].forEach(([x, z, w, d, yOffset]) => {
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.44, d),
    new THREE.MeshStandardMaterial({
      color: 0x16283f,
      map: metalTexture,
      roughness: 0.68,
      metalness: 0.22,
      emissive: 0x0b1727,
    })
  );
  platform.position.set(x, yOffset, z);
  platform.castShadow = true;
  platform.receiveShadow = true;
  worldGroup.add(platform);
  raisedPlatforms.push(platform);
});

const obstacleLayout = [
  { x: -7.6, z: 7.4, w: 2.8, d: 2.4, h: 2.6, tilt: 0.04 },
  { x: -3.4, z: 5.1, w: 3.8, d: 1.6, h: 2.8, tilt: -0.02 },
  { x: -0.8, z: -2.8, w: 4.6, d: 1.6, h: 3.2, tilt: 0.06 },
  { x: 4.8, z: -4.7, w: 2.2, d: 2.4, h: 3.4, tilt: -0.05 },
  { x: 8.6, z: -8.2, w: 2.6, d: 1.8, h: 3.6, tilt: 0.04 },
  { x: 6.6, z: 1.4, w: 3.1, d: 1.8, h: 2.5, tilt: -0.04 },
];

const obstacles = obstacleLayout.map((layout, index) => {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(layout.w, layout.h, layout.d),
    new THREE.MeshStandardMaterial({
      color: 0x223652,
      map: metalTexture,
      roughness: 0.62,
      metalness: 0.22,
      emissive: 0x0a1422,
    })
  );
  core.castShadow = true;
  core.receiveShadow = true;
  core.position.y = layout.h / 2;
  group.add(core);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(layout.w + 0.18, 0.18, layout.d + 0.18),
    new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? 0x5fcfff : 0xf7bd65,
      emissive: index % 2 === 0 ? 0x103a56 : 0x3f2100,
      emissiveIntensity: 0.9,
      roughness: 0.28,
    })
  );
  trim.position.y = layout.h + 0.08;
  group.add(trim);

  group.position.set(layout.x, 0, layout.z);
  group.rotation.z = layout.tilt;
  worldGroup.add(group);

  return { group, halfW: layout.w / 2, halfD: layout.d / 2, height: layout.h };
});

const player = new THREE.Group();
const playerRoot = new THREE.Group();
worldGroup.add(player);
player.add(playerRoot);

function createMaterial(color, emissive, roughness = 0.35, metalness = 0.2) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity: 0.7,
  });
}

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 8, 14), createMaterial(0x63bcff, 0x0f3455, 0.28, 0.24));
torso.castShadow = true;
torso.position.y = 1.42;
playerRoot.add(torso);

const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 18), createMaterial(0xc4e6ff, 0x13324f, 0.18, 0.28));
helmet.position.set(0, 2.32, 0.02);
playerRoot.add(helmet);

const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0x79f0c6 }));
visor.position.set(0, 2.29, 0.29);
playerRoot.add(visor);

const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.28), createMaterial(0x17354d, 0x0e1f35, 0.38, 0.3));
backpack.position.set(0, 1.42, -0.42);
playerRoot.add(backpack);

const backpackCore = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.54, 0.12), new THREE.MeshBasicMaterial({ color: 0x79f0c6 }));
backpackCore.position.set(0, 1.44, -0.58);
playerRoot.add(backpackCore);

const shoulderHalo = new THREE.Mesh(
  new THREE.TorusGeometry(0.68, 0.05, 12, 40),
  new THREE.MeshBasicMaterial({ color: 0x57deff, transparent: true, opacity: 0.36 })
);
shoulderHalo.rotation.x = Math.PI / 2;
shoulderHalo.position.y = 1.56;
playerRoot.add(shoulderHalo);

function buildLimb(xOffset) {
  const limb = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), createMaterial(0x264868, 0x102337, 0.44, 0.18));
  upper.position.y = -0.3;
  upper.castShadow = true;
  limb.add(upper);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.66, 8), createMaterial(0x1a3553, 0x091928, 0.46, 0.18));
  lower.position.y = -0.9;
  lower.castShadow = true;
  limb.add(lower);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0x10202f, roughness: 0.8 }));
  foot.position.set(0, -1.26, 0.1);
  foot.castShadow = true;
  limb.add(foot);
  limb.position.x = xOffset;
  return limb;
}

const legLeft = buildLimb(-0.21);
const legRight = buildLimb(0.21);
legLeft.position.y = 1;
legRight.position.y = 1;
playerRoot.add(legLeft, legRight);

function buildArm(xOffset) {
  const arm = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.62, 8), createMaterial(0x2a5075, 0x0c2237, 0.42, 0.18));
  upper.rotation.z = Math.PI / 2;
  upper.position.x = xOffset > 0 ? 0.28 : -0.28;
  upper.castShadow = true;
  arm.add(upper);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.52, 8), createMaterial(0x18344f, 0x081625, 0.42, 0.18));
  lower.rotation.z = Math.PI / 2;
  lower.position.set(xOffset > 0 ? 0.6 : -0.6, -0.18, 0);
  lower.castShadow = true;
  arm.add(lower);
  arm.position.set(xOffset, 1.82, 0);
  return arm;
}

const armLeft = buildArm(-0.34);
const armRight = buildArm(0.34);
playerRoot.add(armLeft, armRight);

const checkpointPad = new THREE.Group();
const checkpointBase = new THREE.Mesh(
  new THREE.CylinderGeometry(1.4, 1.7, 0.24, 24),
  new THREE.MeshStandardMaterial({ color: 0x102534, roughness: 0.68, metalness: 0.14, emissive: 0x071520 })
);
checkpointBase.position.y = 0.12;
checkpointBase.receiveShadow = true;
checkpointPad.add(checkpointBase);

const checkpointRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.2, 0.09, 10, 42),
  new THREE.MeshStandardMaterial({ color: 0x57deff, emissive: 0x103a56, emissiveIntensity: 0.6, roughness: 0.2 })
);
checkpointRing.rotation.x = Math.PI / 2;
checkpointRing.position.y = 0.35;
checkpointPad.add(checkpointRing);

const checkpointCore = new THREE.Mesh(
  new THREE.CylinderGeometry(0.32, 0.42, 0.76, 10),
  new THREE.MeshBasicMaterial({ color: 0x79f0c6, transparent: true, opacity: 0.32 })
);
checkpointCore.position.y = 0.7;
checkpointPad.add(checkpointCore);
checkpointPad.position.set(-1.2, 0, 0.7);
worldGroup.add(checkpointPad);

const exitGate = new THREE.Group();
const exitPad = new THREE.Mesh(
  new THREE.CylinderGeometry(1.8, 2.1, 0.35, 28),
  new THREE.MeshStandardMaterial({ color: 0x251507, map: metalTexture, roughness: 0.8, metalness: 0.15, emissive: 0x241103 })
);
exitPad.position.y = 0.18;
exitGate.add(exitPad);

const exitArch = new THREE.Mesh(
  new THREE.TorusGeometry(1.5, 0.22, 16, 70),
  new THREE.MeshStandardMaterial({ color: 0xf7bd65, emissive: 0x5e3104, emissiveIntensity: 0.8, roughness: 0.22 })
);
exitArch.rotation.x = Math.PI / 2;
exitArch.position.y = 1.9;
exitGate.add(exitArch);

const exitField = new THREE.Mesh(
  new THREE.CircleGeometry(1.12, 28),
  new THREE.MeshBasicMaterial({ color: 0xf7bd65, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
);
exitField.rotation.x = -Math.PI / 2;
exitField.position.y = 1.88;
exitGate.add(exitField);

const exitPillarMaterial = new THREE.MeshStandardMaterial({ color: 0x63401b, roughness: 0.45, metalness: 0.18, emissive: 0x1f1306 });
const exitPillarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 3.3, 0.38), exitPillarMaterial);
exitPillarLeft.position.set(-1.42, 1.66, 0);
const exitPillarRight = exitPillarLeft.clone();
exitPillarRight.position.x *= -1;
exitGate.add(exitPillarLeft, exitPillarRight);
exitGate.position.set(11.5, 0, -10.5);
worldGroup.add(exitGate);

const shardDefinitions = [
  { x: -13, z: 12.3, phase: 1 },
  { x: -10.1, z: 6.3, phase: 1 },
  { x: -6.2, z: 10.8, phase: 1 },
  { x: -4.6, z: 3.3, phase: 1 },
  { x: 2.8, z: -6.6, phase: 2 },
  { x: 6.8, z: -2.8, phase: 2 },
  { x: 9.6, z: 1.8, phase: 2 },
  { x: 11.4, z: -6.4, phase: 2 },
];

const shards = shardDefinitions.map((definition, index) => {
  const group = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.52, 0.58, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e3148, roughness: 0.64, metalness: 0.18 })
  );
  pedestal.position.y = 0.26;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.54, 0),
    new THREE.MeshStandardMaterial({ color: definition.phase === 1 ? 0x79f0c6 : 0xf7d27b, emissive: 0x277e67, emissiveIntensity: 1.1, roughness: 0.18, metalness: 0.2 })
  );
  crystal.castShadow = true;
  crystal.position.y = 1.12;
  group.add(crystal);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.05, 10, 40),
    new THREE.MeshBasicMaterial({ color: definition.phase === 1 ? 0x57deff : 0xf7bd65, transparent: true, opacity: 0.48 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.06;
  group.add(halo);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.18, 1.9, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: definition.phase === 1 ? 0x57deff : 0xf7bd65, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
  );
  beam.position.y = 0.95;
  group.add(beam);

  group.position.set(definition.x, 0, definition.z);
  group.visible = definition.phase === 1;
  worldGroup.add(group);
  return { id: index, phase: definition.phase, group, crystal, halo, beam, collected: false };
});

function createOrbitDrone(configured) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xff8ba0, emissive: 0x631622, emissiveIntensity: 1.05, roughness: 0.22, metalness: 0.32 })
  );
  core.castShadow = true;
  group.add(core);

  const shell = new THREE.Mesh(
    new THREE.TorusGeometry(0.84, 0.08, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0x64203b, emissive: 0x3b0d16, roughness: 0.28 })
  );
  shell.rotation.x = Math.PI / 2;
  group.add(shell);

  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.18), new THREE.MeshBasicMaterial({ color: 0xfff2f5 }));
  eye.position.set(0, 0, 0.5);
  group.add(eye);

  [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((angle) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0x391221, roughness: 0.38, metalness: 0.2 }));
    arm.rotation.y = angle;
    group.add(arm);
  });

  group.position.set(configured.center.x, 1.6, configured.center.z);
  worldGroup.add(group);
  return {
    type: "orbit",
    activeFromPhase: configured.activeFromPhase,
    group,
    core,
    center: configured.center.clone(),
    radius: configured.radius,
    speed: configured.speed,
    angle: configured.angle,
    hitCooldown: 0,
    damage: configured.damage ?? 13,
  };
}

function createPatrolDrone(configured) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.42, 0.82),
    new THREE.MeshStandardMaterial({ color: 0xff9eb0, emissive: 0x5d1825, emissiveIntensity: 1.08, roughness: 0.22, metalness: 0.3 })
  );
  body.castShadow = true;
  group.add(body);

  const finA = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0x471523, roughness: 0.34 }));
  const finB = finA.clone();
  finB.rotation.y = Math.PI / 2;
  group.add(finA, finB);

  const light = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: 0xfff2f5 }));
  light.position.z = 0.42;
  group.add(light);

  group.position.set(configured.a.x, 1.4, configured.a.z);
  worldGroup.add(group);
  return {
    type: "patrol",
    activeFromPhase: configured.activeFromPhase,
    group,
    body,
    a: configured.a.clone(),
    b: configured.b.clone(),
    speed: configured.speed,
    t: Math.random(),
    hitCooldown: 0,
    damage: configured.damage ?? 15,
  };
}

const drones = [
  createOrbitDrone({ center: new THREE.Vector3(-7.4, 1.6, 6.2), radius: 2.9, speed: 1.45, angle: 0.3, activeFromPhase: 1, damage: 12 }),
  createOrbitDrone({ center: new THREE.Vector3(1.8, 1.6, -3.2), radius: 4.4, speed: 1.75, angle: 1.4, activeFromPhase: 1, damage: 13 }),
  createOrbitDrone({ center: new THREE.Vector3(9.2, 1.6, -7.4), radius: 3.3, speed: 2.5, angle: 0.5, activeFromPhase: 2, damage: 15 }),
  createPatrolDrone({ a: new THREE.Vector3(-2.6, 0, 4.8), b: new THREE.Vector3(5.8, 0, -6.2), speed: 0.34, activeFromPhase: 2, damage: 15 }),
  createPatrolDrone({ a: new THREE.Vector3(3.8, 0, 5.2), b: new THREE.Vector3(12, 0, -3.2), speed: 0.28, activeFromPhase: 2, damage: 16 }),
];

function createSweepHazard(rotationOffset) {
  const pivot = new THREE.Group();
  pivot.position.set(-0.5, 0.12, 0.5);
  worldGroup.add(pivot);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.18, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x522131, emissive: 0x7f2039, emissiveIntensity: 1, roughness: 0.24, metalness: 0.18 })
  );
  arm.position.set(4.6, 0.34, 0);
  pivot.add(arm);

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.04, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xff8ca5, transparent: true, opacity: 0.6 })
  );
  beam.position.set(4.6, 0.52, 0);
  pivot.add(beam);

  pivot.rotation.y = rotationOffset;
  return { pivot, arm, beam, rotationOffset, speed: 1.2, hitCooldown: 0 };
}

const sweepHazards = [createSweepHazard(0), createSweepHazard(Math.PI)];

function spawnBurst(position, color, count, spread, upwardBias = 0, size = 0.06) {
  for (let index = 0; index < count; index += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    );
    mesh.position.copy(position);
    worldGroup.add(mesh);
    const maxLife = 0.65 + Math.random() * 0.4;
    particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread * 0.7 + upwardBias,
        (Math.random() - 0.5) * spread
      ),
      life: maxLife,
      maxLife,
    });
  }
}

function kickCamera(amount) {
  cameraShake = Math.min(1.6, cameraShake + amount);
}

function flashImpact() {
  impactFlash.classList.add("active");
  flashTimeout = 0.12;
}

function setOverlay(kicker, title, body, buttonLabel, summaryHtml = "") {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayCopy.innerHTML = body;
  overlayStart.textContent = buttonLabel;
  overlaySummary.innerHTML = summaryHtml;
  overlaySummary.classList.toggle("has-content", Boolean(summaryHtml));
}

function getCurrentCameraMode() {
  return cameraModes[currentCameraModeIndex];
}

function showControlToast(message) {
  controlToast.textContent = message;
  controlToast.classList.add("active");
  toastTimeout = 1.8;
}

function syncPointerLockState(showToast = false) {
  const nextLocked = document.pointerLockElement === canvas;
  const changed = nextLocked !== pointerLocked;
  pointerLocked = nextLocked;
  if (pointerLocked) {
    isDragging = false;
  }
  if (changed && showToast) {
    showControlToast(pointerLocked ? "Mouselook engaged" : "Mouse unlocked");
  }
  updateControlDeck();
}

function saveControlPreferences() {
  try {
    localStorage.setItem(
      controlStorageKey,
      JSON.stringify({
        cameraModeId: getCurrentCameraMode().id,
        lookSensitivity,
        invertY: invertY === -1,
      })
    );
  } catch (error) {
    // Ignore storage failures and keep runtime preferences only.
  }
}

function loadControlPreferences() {
  try {
    const raw = localStorage.getItem(controlStorageKey);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.cameraModeId) {
      const index = cameraModes.findIndex((mode) => mode.id === parsed.cameraModeId);
      if (index >= 0) {
        currentCameraModeIndex = index;
      }
    }
    if (typeof parsed.lookSensitivity === "number" && Number.isFinite(parsed.lookSensitivity)) {
      lookSensitivity = THREE.MathUtils.clamp(parsed.lookSensitivity, 0.6, 1.8);
    }
    if (typeof parsed.invertY === "boolean") {
      invertY = parsed.invertY ? -1 : 1;
    }
  } catch (error) {
    // Ignore malformed stored values.
  }
}

function updateControlDeck() {
  const cameraMode = getCurrentCameraMode();
  cameraModeText.textContent = cameraMode.label;
  lookModeText.textContent = pointerLocked ? "Mouselook Live" : "Drag Look";
  sensitivityValue.textContent = `${lookSensitivity.toFixed(2)}x`;
  toggleLookButton.textContent = pointerLocked ? "Release Mouselook" : "Enable Mouselook";
  toggleCameraButton.textContent = `Cycle Camera (${cameraMode.label})`;
  crosshair.classList.toggle("active", pointerLocked || cameraMode.id !== "chase");
  sensitivityInput.value = String(Math.round(lookSensitivity * 100));
  invertYInput.checked = invertY === -1;
}

function requestArenaPointerLock() {
  if (document.pointerLockElement === canvas || typeof canvas.requestPointerLock !== "function") {
    return;
  }
  pointerLockReleaseRequestedAt = 0;
  canvas.requestPointerLock();
}

function releaseArenaPointerLock() {
  if (document.pointerLockElement === canvas && typeof document.exitPointerLock === "function") {
    pointerLockReleaseRequestedAt = performance.now();
    document.exitPointerLock();
    return;
  }
  pointerLocked = false;
  updateControlDeck();
}

function cycleCameraMode() {
  currentCameraModeIndex = (currentCameraModeIndex + 1) % cameraModes.length;
  saveControlPreferences();
  updateControlDeck();
  showControlToast(`Camera: ${getCurrentCameraMode().label}`);
}

function resolveCameraOcclusion(origin, desiredPosition, padding = 0.32) {
  const direction = desiredPosition.clone().sub(origin);
  const distanceToCamera = Math.max(0.001, direction.length());
  cameraRaycaster.set(origin, direction.normalize());
  cameraRaycaster.far = distanceToCamera;
  const hits = cameraRaycaster.intersectObjects(cameraCollisionMeshes, false);
  if (hits.length > 0) {
    return hits[0].point.clone().addScaledVector(direction, -padding);
  }
  return desiredPosition;
}

function countCollectedForPhase(targetPhase) {
  return shards.filter((shard) => shard.phase === targetPhase && shard.collected).length;
}

function allCollectedForPhase(targetPhase) {
  return shards.filter((shard) => shard.phase === targetPhase).every((shard) => shard.collected);
}

function updateLadder() {
  Object.entries(ladderNodes).forEach(([step, node]) => {
    node.classList.remove("active", "complete");
    const numeric = Number(step);
    if (numeric < phase) {
      node.classList.add("complete");
    } else if (numeric === phase) {
      node.classList.add("active");
    }
  });
}

function updateStatus(label) {
  statusText.textContent = label;
}

function updatePhaseText() {
  phaseText.textContent = `Phase ${phase}`;
  updateLadder();
}

function updateObjectiveText() {
  if (phase === 1 && !checkpointActivated) {
    objectiveText.textContent = "Secure four start-lane shards.";
    checkpointText.textContent = "Offline";
    pressureText.textContent = "Stand by";
    return;
  }

  if (phase === 1 && checkpointActivated) {
    objectiveText.textContent = "Reach the checkpoint pad.";
    checkpointText.textContent = "Activated";
    pressureText.textContent = "Spooling";
    return;
  }

  if (phase === 2) {
    const remainingShards = shards.filter((shard) => shard.phase === 2 && !shard.collected).length;
    if (remainingShards > 0) {
      objectiveText.textContent = `Hold the mid zone and recover ${remainingShards} contested shard${remainingShards === 1 ? "" : "s"}.`;
    } else {
      objectiveText.textContent = "Survive the last pressure sweep to unlock extraction.";
    }
    checkpointText.textContent = "Restore ready";
    pressureText.textContent = `${Math.max(0, phase2PressureLeft).toFixed(1)}s`;
    return;
  }

  objectiveText.textContent = "Sprint for extraction and cash out the run.";
  checkpointText.textContent = checkpointReady ? "Restore ready" : "None";
  pressureText.textContent = "Stabilized";
}

function calculateProjectedScore(includeWinBonus = false) {
  let score = collected * 150;
  if (checkpointReady) {
    score += 300;
  }
  if (phase >= 2) {
    score += 450;
  }
  if (phase >= 3) {
    score += 650;
  }
  score += Math.round(Math.max(0, timeLeft) * 8);
  score += Math.round(Math.max(0, health) * 6);
  if (includeWinBonus) {
    score += 900;
  }
  return score;
}

function updateHud() {
  projectedScore = calculateProjectedScore(false);
  shardCount.textContent = `${collected} / ${shards.length}`;
  healthCount.textContent = String(Math.max(0, Math.round(health)));
  timeCount.textContent = `${Math.max(0, timeLeft).toFixed(1)}s`;
  boostCount.textContent = String(Math.round(boostEnergy));
  scoreCount.textContent = String(projectedScore);
  healthFill.style.width = `${Math.max(0, health)}%`;
  boostFill.style.width = `${Math.max(0, boostEnergy)}%`;
  timeFill.style.width = `${Math.max(0, (timeLeft / config.totalTime) * 100)}%`;
  warningVignette.classList.toggle("active", health < 35 && gameStarted && !gameFinished);
  updateObjectiveText();
}

function setCheckpointActive(active) {
  checkpointActivated = active;
  checkpointRing.material.emissiveIntensity = active ? 1.3 : 0.4;
  checkpointCore.material.opacity = active ? 0.68 : 0.22;
}

function resetThreats() {
  drones.forEach((drone, index) => {
    drone.hitCooldown = 0;
    if (drone.type === "orbit") {
      drone.angle = 0.7 + index * 0.9;
    } else {
      drone.t = index * 0.17;
    }
  });

  sweepHazards.forEach((hazard, index) => {
    hazard.hitCooldown = 0;
    hazard.pivot.rotation.y = hazard.rotationOffset + index * Math.PI;
  });
}

function resetShards(forCheckpointRestore = false) {
  shards.forEach((shard, index) => {
    const definition = shardDefinitions[index];
    shard.collected = false;
    shard.group.position.set(definition.x, 0, definition.z);
    shard.group.visible = !forCheckpointRestore ? definition.phase === 1 : definition.phase === 2;
  });

  if (forCheckpointRestore) {
    shards
      .filter((shard) => shard.phase === 1)
      .forEach((shard) => {
        shard.collected = true;
        shard.group.visible = false;
      });
  }
}

function placePlayerAtStart() {
  playerState.position.set(-12.2, 0, 12.4);
  player.position.set(playerState.position.x, 1, playerState.position.z);
  playerState.velocity.set(0, 0, 0);
  velocityY = 0;
  playerState.grounded = true;
  yaw = 0.18;
  pitch = 0.64;
  targetYaw = yaw;
  targetPitch = pitch;
}

function fullReset() {
  phase = 1;
  timeLeft = config.totalTime;
  health = 100;
  boostEnergy = 100;
  collected = 0;
  phase2PressureLeft = config.phase2Pressure;
  checkpointReady = false;
  checkpointSnapshot.available = false;
  checkpointSnapshot.timeLeft = config.checkpointTimeFloor;
  exitUnlocked = false;
  gameFinished = false;
  gameStarted = false;
  jumpBuffer = 0;
  coyoteTime = 0;
  flashTimeout = 0;
  trailCooldown = 0;
  setCheckpointActive(false);
  updateStatus("Ready");
  updatePhaseText();
  resetShards(false);
  resetThreats();
  placePlayerAtStart();
  exitArch.material.emissiveIntensity = 0.8;
  exitField.material.opacity = 0.12;
  exitGlow.intensity = 18;
  setOverlay(
    "Mission Brief",
    "Recover the urethane core.",
    "Use <code>W A S D</code> to move, click the arena to lock the mouse, press <code>Shift</code> to surge, tap <code>Space</code> to hop, press <code>C</code> to cycle camera modes, and press <code>Esc</code> to unlock the mouse.",
    "Enter Arena"
  );
  overlay.classList.remove("hidden");
  updateControlDeck();
  updateHud();
}

function startMission() {
  gameStarted = true;
  gameFinished = false;
  overlay.classList.add("hidden");
  updateStatus(`Phase ${phase} Live`);
  if (!pointerLocked) {
    requestArenaPointerLock();
  }
  clock.getDelta();
}

function activatePhase2(fromRestore = false) {
  phase = 2;
  updatePhaseText();
  phase2PressureLeft = config.phase2Pressure;
  checkpointReady = true;
  checkpointSnapshot.available = true;
  checkpointSnapshot.timeLeft = Math.max(timeLeft, config.checkpointTimeFloor);
  health = Math.max(health, 84);
  boostEnergy = 100;
  timeLeft = checkpointSnapshot.timeLeft;
  playerState.position.set(checkpointPad.position.x + 1.8, 0, checkpointPad.position.z + 1.2);
  player.position.set(playerState.position.x, 1, playerState.position.z);
  playerState.velocity.set(0, 0, 0);
  velocityY = 0;
  shards
    .filter((shard) => shard.phase === 2)
    .forEach((shard) => {
      shard.collected = false;
      shard.group.visible = true;
    });
  if (!fromRestore) {
    spawnBurst(checkpointPad.position.clone().setY(1.3), 0x57deff, 24, 2.8, 1.2);
  }
  updateStatus("Checkpoint Stabilized");
  setOverlay(
    "Checkpoint Live",
    "Mid-zone pressure is online.",
    "Your checkpoint is now stored. The contested shard cluster has opened, sweep hazards are spinning up, and <code>R</code> will restore this checkpoint if the run breaks.",
    "Continue Run",
    '<div class="overlay-score-grid"><div class="overlay-score-card"><span>Checkpoint</span><strong>Stored</strong></div><div class="overlay-score-card"><span>Time Floor</span><strong>108s</strong></div><div class="overlay-score-card"><span>Reset Path</span><strong>Restore Ready</strong></div></div>'
  );
  overlay.classList.remove("hidden");
  gameStarted = false;
  updateControlDeck();
  updateHud();
}

function restoreCheckpoint() {
  phase = 2;
  timeLeft = checkpointSnapshot.timeLeft;
  health = 88;
  boostEnergy = 100;
  collected = config.phase1Target;
  phase2PressureLeft = config.phase2Pressure;
  checkpointReady = true;
  checkpointSnapshot.available = true;
  exitUnlocked = false;
  gameFinished = false;
  gameStarted = false;
  setCheckpointActive(true);
  resetThreats();
  resetShards(true);
  playerState.position.set(checkpointPad.position.x + 1.8, 0, checkpointPad.position.z + 1.2);
  player.position.set(playerState.position.x, 1, playerState.position.z);
  playerState.velocity.set(0, 0, 0);
  velocityY = 0;
  exitArch.material.emissiveIntensity = 0.8;
  exitField.material.opacity = 0.12;
  exitGlow.intensity = 18;
  updatePhaseText();
  updateStatus("Checkpoint Restored");
  setOverlay(
    "Checkpoint Restore",
    "The run has been rewired.",
    "You are back at the stored checkpoint with restored integrity and a fresh pressure timer. Clear the contested zone and reopen extraction.",
    "Re-enter Arena"
  );
  overlay.classList.remove("hidden");
  spawnBurst(checkpointPad.position.clone().setY(1.2), 0x79f0c6, 22, 2.5, 1.1);
  updateControlDeck();
  updateHud();
}

function unlockExtraction() {
  phase = 3;
  exitUnlocked = true;
  updatePhaseText();
  updateStatus("Extraction Unlocked");
  exitArch.material.emissiveIntensity = 1.9;
  exitField.material.opacity = 0.35;
  exitGlow.intensity = 34;
  spawnBurst(exitGate.position.clone().setY(1.9), 0xf7bd65, 28, 3.8, 1.3);
  updateHud();
}

function endRun(didWin, label) {
  if (gameFinished) {
    return;
  }

  releaseArenaPointerLock();
  gameFinished = true;
  gameStarted = false;
  updateStatus(label);
  finalScore = calculateProjectedScore(didWin);
  const timeBonus = Math.round(Math.max(0, timeLeft) * 8);
  const integrityBonus = Math.round(Math.max(0, health) * 6);
  const summary = `<div class="overlay-score-grid">
    <div class="overlay-score-card"><span>Shards</span><strong>${collected * 150}</strong></div>
    <div class="overlay-score-card"><span>Time Bonus</span><strong>${timeBonus}</strong></div>
    <div class="overlay-score-card"><span>Integrity</span><strong>${integrityBonus}</strong></div>
  </div>`;

  if (didWin) {
    setOverlay(
      "Extraction Complete",
      "Urethane core recovered.",
      "You cleared all three phases and made the extraction window. Press <code>R</code> or use the button below to run the mission from the top again.",
      "Replay Mission",
      summary
    );
    spawnBurst(exitGate.position.clone().setY(1.8), 0xf7bd65, 36, 4.2, 1.4);
  } else {
    const buttonLabel = checkpointSnapshot.available ? "Restore Checkpoint" : "Restart Mission";
    const body = checkpointSnapshot.available
      ? "Your checkpoint is still stored. Press <code>R</code> or use the button below to restore phase two and try the extraction run again."
      : "The run failed before a checkpoint restore was available. Press <code>R</code> or use the button below to restart from the opening lane.";
    setOverlay("Run Failed", "Mission collapsed.", body, buttonLabel, summary);
  }

  overlay.classList.remove("hidden");
  updateControlDeck();
  updateHud();
}

function handleOverlayAction() {
  if (gameFinished) {
    if (checkpointSnapshot.available && !exitUnlocked) {
      restoreCheckpoint();
    } else {
      fullReset();
    }
    return;
  }

  if (!gameStarted) {
    startMission();
  }
}

function handleMissionFailure(reason) {
  endRun(false, reason);
}

function applyDamage(amount, sourcePosition, knockbackStrength = 4.8) {
  health -= amount;
  flashImpact();
  kickCamera(0.45);
  if (sourcePosition) {
    const push = player.position.clone().sub(sourcePosition).setY(0);
    if (push.lengthSq() > 0.001) {
      push.normalize().multiplyScalar(knockbackStrength);
      playerState.velocity.add(push);
    }
  }
  spawnBurst(player.position.clone().setY(1.4), 0xff7f9b, 14, 1.8, 0.6);
  updateHud();
  if (health <= 0) {
    health = 0;
    handleMissionFailure("Integrity lost");
  } else {
    updateStatus("Under Attack");
  }
}

function clampPlayerToArena() {
  const limit = 14.7;
  playerState.position.x = THREE.MathUtils.clamp(playerState.position.x, -limit, limit);
  playerState.position.z = THREE.MathUtils.clamp(playerState.position.z, -limit, limit);
}

function resolveObstacleCollision(previousPosition) {
  for (const obstacle of obstacles) {
    const xMin = obstacle.group.position.x - obstacle.halfW - playerState.radius;
    const xMax = obstacle.group.position.x + obstacle.halfW + playerState.radius;
    const zMin = obstacle.group.position.z - obstacle.halfD - playerState.radius;
    const zMax = obstacle.group.position.z + obstacle.halfD + playerState.radius;
    if (
      playerState.position.x > xMin &&
      playerState.position.x < xMax &&
      playerState.position.z > zMin &&
      playerState.position.z < zMax &&
      player.position.y < obstacle.height + 0.7
    ) {
      playerState.position.copy(previousPosition);
      playerState.velocity.multiplyScalar(0.35);
      break;
    }
  }
}

function updatePlayerRig(delta, elapsed) {
  const speedFactor = Math.min(1, playerState.velocity.length() / 8.4);
  const walk = elapsed * 8.8 * speedFactor;
  legLeft.rotation.x = Math.sin(walk) * 0.56;
  legRight.rotation.x = -Math.sin(walk) * 0.56;
  armLeft.rotation.x = -Math.sin(walk) * 0.32;
  armRight.rotation.x = Math.sin(walk) * 0.32;
  playerRoot.rotation.z = THREE.MathUtils.damp(playerRoot.rotation.z, -playerState.velocity.x * 0.025, 9, delta);
  playerRoot.rotation.x = THREE.MathUtils.damp(playerRoot.rotation.x, playerState.velocity.z * 0.008, 8, delta);
  playerRoot.position.y = Math.sin(elapsed * 8.8) * speedFactor * 0.06;
  shoulderHalo.rotation.z += 0.03;
  shoulderHalo.material.opacity = 0.24 + (boostEnergy < 35 ? 0.12 : 0.04) + Math.min(0.2, playerState.velocity.length() * 0.012);
  visor.material.color.setHex(health < 35 ? 0xff7f9b : boostEnergy < 25 ? 0xf7bd65 : 0x79f0c6);
  backpackCore.material.color.setHex(exitUnlocked ? 0xf7bd65 : checkpointReady ? 0x57deff : 0x79f0c6);
}

function updatePlayer(delta, elapsed) {
  const previousPosition = playerState.position.clone();
  const wasGrounded = playerState.grounded;

  jumpBuffer = Math.max(0, jumpBuffer - delta);
  coyoteTime = Math.max(0, coyoteTime - delta);

  const input = new THREE.Vector3((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), 0, (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0));
  const hasInput = input.lengthSq() > 0;
  const moveDirection = new THREE.Vector3();

  if (hasInput) {
    input.normalize();
    const forward = new THREE.Vector3(Math.sin(targetYaw), 0, Math.cos(targetYaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    moveDirection.addScaledVector(forward, -input.z).addScaledVector(right, input.x).normalize();
  }

  const boosting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && boostEnergy > 8 && hasInput;
  const targetSpeed = boosting ? 10.4 : 6.6;
  const control = playerState.grounded ? 12 : 5;
  const desiredVelocity = hasInput ? moveDirection.multiplyScalar(targetSpeed) : tmpVector.set(0, 0, 0);

  playerState.velocity.x = THREE.MathUtils.damp(playerState.velocity.x, desiredVelocity.x, control, delta);
  playerState.velocity.z = THREE.MathUtils.damp(playerState.velocity.z, desiredVelocity.z, control, delta);

  if (boosting) {
    boostEnergy = Math.max(0, boostEnergy - 34 * delta);
  } else {
    boostEnergy = Math.min(100, boostEnergy + (hasInput ? 16 : 22) * delta);
  }

  if (jumpBuffer > 0 && (playerState.grounded || coyoteTime > 0)) {
    velocityY = 7.2;
    playerState.grounded = false;
    jumpBuffer = 0;
    coyoteTime = 0;
    spawnBurst(player.position.clone().setY(1), 0xf7bd65, 8, 1.2, 0.8);
    kickCamera(0.16);
  }

  velocityY -= 18.6 * delta;
  player.position.y += velocityY * delta;
  if (player.position.y <= 1) {
    player.position.y = 1;
    velocityY = 0;
    playerState.grounded = true;
  } else if (wasGrounded) {
    playerState.grounded = false;
    coyoteTime = 0.12;
  }

  playerState.position.addScaledVector(playerState.velocity, delta);
  clampPlayerToArena();
  resolveObstacleCollision(previousPosition);
  player.position.x = playerState.position.x;
  player.position.z = playerState.position.z;

  if (!wasGrounded && playerState.grounded) {
    spawnBurst(player.position.clone().setY(1.02), 0x57deff, 7, 1.1, 0.3, 0.04);
    kickCamera(0.2);
  }

  if (hasInput) {
    player.rotation.y = THREE.MathUtils.damp(player.rotation.y, Math.atan2(playerState.velocity.x, playerState.velocity.z), 10, delta);
  }

  updatePlayerRig(delta, elapsed);
}

function updateShards(delta, elapsed) {
  shards.forEach((shard) => {
    if (shard.collected || !shard.group.visible) {
      return;
    }
    shard.crystal.rotation.y += 2.4 * delta;
    shard.halo.rotation.z += 1.8 * delta;
    shard.crystal.position.y = 1.12 + Math.sin(elapsed * 2.8 + shard.id * 0.8) * 0.18;
    shard.beam.material.opacity = 0.06 + (Math.sin(elapsed * 3.2 + shard.id) + 1) * 0.04;

    if (playerState.position.distanceTo(shard.group.position) < 1.3) {
      shard.collected = true;
      shard.group.visible = false;
      collected += 1;
      spawnBurst(shard.group.position.clone().setY(1.2), shard.phase === 1 ? 0x79f0c6 : 0xf7bd65, 16, 2.1, 1.1);
      kickCamera(0.1);

      if (phase === 1 && countCollectedForPhase(1) >= config.phase1Target) {
        setCheckpointActive(true);
        updateStatus("Checkpoint Activated");
      }

      updateHud();
    }
  });
}

function updateCheckpoint(delta, elapsed) {
  checkpointPulse += delta * (checkpointActivated ? 3.4 : 1.6);
  checkpointRing.rotation.z += delta * 1.6;
  checkpointCore.scale.y = 0.9 + Math.sin(checkpointPulse) * 0.1;

  if (phase === 1 && checkpointActivated && playerState.position.distanceTo(checkpointPad.position) < 1.8) {
    activatePhase2(false);
  }

  checkpointRing.material.emissiveIntensity = checkpointActivated ? 1.2 + Math.sin(elapsed * 4.2) * 0.35 : 0.35;
}

function updateOrbitDrone(drone, delta, elapsed, index) {
  drone.angle += delta * drone.speed * (phase === 2 ? 1.18 : phase === 3 ? 1.28 : 1);
  drone.group.position.x = drone.center.x + Math.cos(drone.angle) * drone.radius;
  drone.group.position.z = drone.center.z + Math.sin(drone.angle) * drone.radius;
  drone.group.position.y = 1.6 + Math.sin(drone.angle * 2 + index) * 0.42;
  drone.group.rotation.y += delta * 2.4;
  drone.group.rotation.z = Math.sin(elapsed * 5 + index) * 0.18;
}

function updatePatrolDrone(drone, delta, elapsed, index) {
  drone.t = (drone.t + delta * drone.speed * (phase === 3 ? 1.25 : 1)) % 1;
  const pulse = (Math.sin(drone.t * Math.PI * 2 - Math.PI / 2) + 1) * 0.5;
  drone.group.position.lerpVectors(drone.a, drone.b, pulse);
  drone.group.position.y = 1.38 + Math.sin(elapsed * 6 + index) * 0.22;
  drone.group.lookAt(pulse > 0.5 ? drone.a : drone.b);
  drone.group.rotation.y += Math.PI;
}

function updateDrones(delta, elapsed) {
  drones.forEach((drone, index) => {
    if (phase < drone.activeFromPhase) {
      drone.group.visible = false;
      return;
    }

    drone.group.visible = true;
    drone.hitCooldown = Math.max(0, drone.hitCooldown - delta);
    if (drone.type === "orbit") {
      updateOrbitDrone(drone, delta, elapsed, index);
      drone.core.material.emissiveIntensity = drone.hitCooldown > 0 ? 1.4 : 1.05;
    } else {
      updatePatrolDrone(drone, delta, elapsed, index);
      drone.body.material.emissiveIntensity = drone.hitCooldown > 0 ? 1.55 : 1.08;
    }

    if (drone.group.position.distanceTo(player.position) < 1.36 && drone.hitCooldown === 0 && !gameFinished) {
      drone.hitCooldown = 1.15;
      applyDamage(drone.damage, drone.group.position, 5.2);
    }
  });
}

function distancePointToSegment2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const abLengthSq = abx * abx + abz * abz;
  if (abLengthSq === 0) {
    return Math.hypot(px - ax, pz - az);
  }
  const t = THREE.MathUtils.clamp(((px - ax) * abx + (pz - az) * abz) / abLengthSq, 0, 1);
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

function updateSweepHazards(delta) {
  sweepHazards.forEach((hazard, index) => {
    const active = phase >= 2;
    hazard.pivot.visible = active;
    if (!active) {
      return;
    }

    hazard.hitCooldown = Math.max(0, hazard.hitCooldown - delta);
    const speed = phase === 2 ? hazard.speed : hazard.speed * 0.72;
    hazard.pivot.rotation.y += delta * speed * (index % 2 === 0 ? 1 : -1);
    hazard.beam.material.opacity = 0.46 + Math.sin(clock.elapsedTime * 8 + index) * 0.14;

    const start = hazard.pivot.localToWorld(tempA.set(0, 0.52, 0));
    const end = hazard.pivot.localToWorld(tempB.set(9.2, 0.52, 0));
    const distance = distancePointToSegment2D(player.position.x, player.position.z, start.x, start.z, end.x, end.z);
    const closeEnough = distance < 0.72 && player.position.y < 1.8;

    if (closeEnough && hazard.hitCooldown === 0 && !gameFinished) {
      hazard.hitCooldown = 0.9;
      applyDamage(12, hazard.pivot.position, 4.2);
    }
  });
}

function updateMissionFlow(delta) {
  if (phase === 2) {
    phase2PressureLeft = Math.max(0, phase2PressureLeft - delta);
    if (phase2PressureLeft === 0 && allCollectedForPhase(2) && !exitUnlocked) {
      unlockExtraction();
    }
  }

  if (phase === 3 && playerState.position.distanceTo(exitGate.position) < 1.95) {
    endRun(true, "Core Recovered");
  }
}

function updateExit(elapsed) {
  exitArch.rotation.z = elapsed * 1.3;
  exitGate.position.y = Math.sin(elapsed * 1.8) * 0.08;
  exitField.rotation.z += 0.01;
  exitField.material.opacity = exitUnlocked ? 0.26 + Math.sin(elapsed * 5) * 0.09 : 0.1 + Math.sin(elapsed * 4) * 0.03;
}

function updateCamera(delta) {
  yaw = THREE.MathUtils.damp(yaw, targetYaw, 10, delta);
  pitch = THREE.MathUtils.damp(pitch, targetPitch, 10, delta);

  const cameraMode = getCurrentCameraMode();
  const velocityOffset = playerState.velocity.clone().multiplyScalar(cameraMode.lookAhead);
  velocityOffset.y = 0;
  const headPosition = new THREE.Vector3(player.position.x, player.position.y + cameraMode.height, player.position.z);
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const lookTarget = tempC.copy(player.position).add(velocityOffset).setY(player.position.y + 1.45);
  let desiredPosition;
  let visibleCameraModeId = cameraMode.id;

  if (cameraMode.id === "cockpit") {
    const viewDirection = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch - 0.46),
      Math.sin(pitch - 0.46),
      Math.cos(yaw) * Math.cos(pitch - 0.46)
    ).normalize();
    const cockpitPosition = headPosition.clone().addScaledVector(right, cameraMode.sideOffset).addScaledVector(forward, 0.42);
    cameraRaycaster.set(cockpitPosition, viewDirection);
    cameraRaycaster.far = 0.95;
    const cockpitHits = cameraRaycaster.intersectObjects(cameraCollisionMeshes, false);

    if (cockpitHits.length > 0) {
      visibleCameraModeId = "shoulder";
      const fallbackHorizontal = Math.cos(pitch) * 4.8;
      const fallbackVertical = 3 + Math.sin(pitch) * 1.6;
      desiredPosition = new THREE.Vector3(
        player.position.x + Math.sin(yaw) * fallbackHorizontal - velocityOffset.x * 0.4 + right.x * 1.05,
        player.position.y + fallbackVertical,
        player.position.z + Math.cos(yaw) * fallbackHorizontal - velocityOffset.z * 0.4 + right.z * 1.05
      );
      cameraTarget.lerp(lookTarget, 0.14);
      desiredPosition = resolveCameraOcclusion(headPosition, desiredPosition, 0.24);
    } else {
      desiredPosition = cockpitPosition;
      cameraTarget.lerp(cockpitPosition.clone().add(viewDirection.multiplyScalar(18)), 0.18);
    }
  } else {
    const horizontal = Math.cos(pitch) * cameraMode.distance;
    const vertical = cameraMode.height + Math.sin(pitch) * 1.8;
    desiredPosition = new THREE.Vector3(
      player.position.x + Math.sin(yaw) * horizontal - velocityOffset.x * 0.5 + right.x * cameraMode.sideOffset,
      player.position.y + vertical,
      player.position.z + Math.cos(yaw) * horizontal - velocityOffset.z * 0.5 + right.z * cameraMode.sideOffset
    );
    cameraTarget.lerp(lookTarget, 0.12);
    desiredPosition = resolveCameraOcclusion(headPosition, desiredPosition, 0.28);
  }

  const speedFactor = Math.min(1, playerState.velocity.length() / 10.5);
  const boosting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && boostEnergy > 5 && playerState.velocity.lengthSq() > 4;
  const baseFov = visibleCameraModeId === "shoulder" && cameraMode.id === "cockpit" ? 62 : cameraMode.baseFov;
  const desiredFov = baseFov + speedFactor * 6 + (boosting ? 4 : 0);

  if (cameraShake > 0) {
    desiredPosition.x += (Math.random() - 0.5) * 0.12 * cameraShake;
    desiredPosition.y += (Math.random() - 0.5) * 0.08 * cameraShake;
    desiredPosition.z += (Math.random() - 0.5) * 0.12 * cameraShake;
    cameraShake = Math.max(0, cameraShake - delta * 2.2);
  }

  camera.fov = THREE.MathUtils.damp(camera.fov, desiredFov, 8, delta);
  camera.near = visibleCameraModeId === "cockpit" ? 0.02 : 0.1;
  camera.updateProjectionMatrix();
  camera.position.lerp(desiredPosition, 0.12);
  playerRoot.visible = visibleCameraModeId !== "cockpit";
  camera.lookAt(cameraTarget);
  crosshair.classList.toggle("active", pointerLocked || visibleCameraModeId !== "chase");
}

function updateParticles(delta) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= delta;
    if (particle.life <= 0) {
      worldGroup.remove(particle.mesh);
      particles.splice(index, 1);
      continue;
    }
    particle.mesh.position.addScaledVector(particle.velocity, delta);
    particle.velocity.y -= 1.1 * delta;
    particle.mesh.material.opacity = particle.life / particle.maxLife;
    particle.mesh.scale.setScalar(0.7 + (1 - particle.life / particle.maxLife));
  }
}

function emitTrail(delta) {
  trailCooldown -= delta;
  const boosting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && boostEnergy > 5 && playerState.velocity.lengthSq() > 5;
  if (!boosting || trailCooldown > 0) {
    return;
  }
  trailCooldown = 0.04;
  spawnBurst(player.position.clone().setY(1.2), 0x57deff, 3, 1.4, 0.4, 0.04);
}

function updateAmbient(delta, elapsed) {
  stars.rotation.y += delta * 0.01;
  startZonePlate.rotation.y += delta * 0.08;
  midZonePlate.rotation.y -= delta * 0.06;
  extractZonePlate.rotation.y += delta * 0.09;
  skyline.forEach((tower, index) => {
    tower.position.y = Math.sin(elapsed * 0.8 + index) * 0.05;
  });
  pylons.forEach((pylon, index) => {
    pylon.position.y = Math.sin(elapsed * 1.4 + index) * 0.06;
  });
  warningLight.intensity = health < 35 ? 22 + Math.sin(elapsed * 8) * 4 : 14;
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    jumpBuffer = 0.16;
  }
  if (event.code === "Escape") {
    releaseArenaPointerLock();
    showControlToast("Mouse unlocked");
    window.setTimeout(() => {
      syncPointerLockState(false);
    }, 120);
  }
  if (event.code === "KeyC") {
    cycleCameraMode();
  }
  if (event.code === "KeyL") {
    if (pointerLocked) {
      releaseArenaPointerLock();
    } else {
      requestArenaPointerLock();
    }
  }
  if (event.code === "KeyR" && gameFinished) {
    if (checkpointSnapshot.available && !exitUnlocked) {
      restoreCheckpoint();
    } else {
      fullReset();
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!pointerLocked) {
    requestArenaPointerLock();
  }
  isDragging = !pointerLocked;
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
});

window.addEventListener("pointerup", (event) => {
  if (activePointerId === event.pointerId) {
    isDragging = false;
    activePointerId = null;
  }
});

document.addEventListener("pointerlockchange", () => {
  const wasLocked = pointerLocked;
  pointerLockReleaseRequestedAt = 0;
  syncPointerLockState(false);
  if (pointerLocked) {
    showControlToast("Mouselook engaged");
  } else if (wasLocked) {
    showControlToast("Mouse unlocked");
  }
});

document.addEventListener("pointerlockerror", () => {
  pointerLockReleaseRequestedAt = 0;
  syncPointerLockState(false);
  showControlToast("Mouse lock unavailable");
});

window.addEventListener("pointermove", (event) => {
  if (!pointerLocked && !isDragging) {
    return;
  }
  const verticalDirection = invertY ? -1 : 1;
  targetYaw -= event.movementX * 0.0038 * lookSensitivity;
  targetPitch = THREE.MathUtils.clamp(targetPitch + event.movementY * 0.002 * verticalDirection * lookSensitivity, 0.2, 1.16);
});

startButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (gameFinished && checkpointSnapshot.available && !exitUnlocked) {
      restoreCheckpoint();
      return;
    }

    if (!gameStarted && phase === 1 && !gameFinished) {
      startMission();
      return;
    }

    handleOverlayAction();
  });
});

toggleCameraButton.addEventListener("click", () => {
  cycleCameraMode();
});

toggleLookButton.addEventListener("click", () => {
  if (pointerLocked) {
    releaseArenaPointerLock();
  } else {
    requestArenaPointerLock();
  }
});

sensitivityInput.addEventListener("input", () => {
  lookSensitivity = Number(sensitivityInput.value) / 100;
  saveControlPreferences();
  updateControlDeck();
});

invertYInput.addEventListener("change", () => {
  invertY = invertYInput.checked ? -1 : 1;
  saveControlPreferences();
  updateControlDeck();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  if ((document.pointerLockElement === canvas) !== pointerLocked) {
    syncPointerLockState(false);
  }

  if (toastTimeout > 0) {
    toastTimeout -= delta;
    if (toastTimeout <= 0) {
      controlToast.classList.remove("active");
    }
  }

  if (pointerLockReleaseRequestedAt > 0 && pointerLocked && performance.now() - pointerLockReleaseRequestedAt > 220) {
    pointerLockReleaseRequestedAt = 0;
    showControlToast("Press Esc again if the browser kept the mouse locked");
    syncPointerLockState(false);
  }

  if (flashTimeout > 0) {
    flashTimeout -= delta;
    if (flashTimeout <= 0) {
      impactFlash.classList.remove("active");
    }
  }

  updateAmbient(delta, elapsed);

  if (gameStarted && !gameFinished) {
    timeLeft -= delta;
    if (timeLeft <= 0) {
      timeLeft = 0;
      handleMissionFailure("Time Expired");
    } else {
      updatePlayer(delta, elapsed);
      updateShards(delta, elapsed);
      updateCheckpoint(delta, elapsed);
      updateDrones(delta, elapsed);
      updateSweepHazards(delta);
      updateMissionFlow(delta);
      updateExit(elapsed);
      emitTrail(delta);
      updateHud();
    }
  } else {
    updateCheckpoint(delta, elapsed);
    updateExit(elapsed);
  }

  updateParticles(delta);
  updateCamera(delta);
  renderer.render(scene, camera);
}

loadControlPreferences();
playerRoot.traverse((child) => {
  child.userData.ignoreCameraCollision = true;
});
shards.forEach((shard) => {
  shard.group.traverse((child) => {
    child.userData.ignoreCameraCollision = true;
  });
});
drones.forEach((drone) => {
  drone.group.traverse((child) => {
    child.userData.ignoreCameraCollision = true;
  });
});
sweepHazards.forEach((hazard) => {
  hazard.pivot.traverse((child) => {
    child.userData.ignoreCameraCollision = true;
  });
});
worldGroup.traverse((child) => {
  if (child.isMesh && !child.userData.ignoreCameraCollision) {
    cameraCollisionMeshes.push(child);
  }
});
fullReset();
resize();
animate();
