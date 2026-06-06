import * as THREE from "../vendor/three.module.js";
import { EventBus } from "./core/EventBus.js";
import { Input } from "./core/Input.js";
import { SceneManager } from "./core/SceneManager.js";
import { Storage } from "./core/Storage.js";
import { AudioEngine } from "./core/AudioEngine.js";
import { BootScene } from "./scenes/BootScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { ResultsScene } from "./scenes/ResultsScene.js";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const elements = {
  boot: document.querySelector("#boot"),
  menu: document.querySelector("#menu"),
  briefing: document.querySelector("#briefing"),
  hud: document.querySelector("#hud"),
  result: document.querySelector("#result"),
  startBtn: document.querySelector("#start-btn"),
  duelBtn: document.querySelector("#duel-btn"),
  onlineBtn: document.querySelector("#online-btn"),
  aiBtn: document.querySelector("#ai-btn"),
  howBtn: document.querySelector("#how-btn"),
  leaderboardBtn: document.querySelector("#leaderboard-btn"),
  accountBtn: document.querySelector("#account-btn"),
  adminBtn: document.querySelector("#admin-btn"),
  logoutBtn: document.querySelector("#logout-btn"),
  accountPanel: document.querySelector("#account-panel"),
  leaderboardPanel: document.querySelector("#leaderboard-panel"),
  adminPanel: document.querySelector("#admin-panel"),
  closeAccount: document.querySelector("#close-account"),
  closeLeaderboard: document.querySelector("#close-leaderboard"),
  closeAdmin: document.querySelector("#close-admin"),
  accountForm: document.querySelector("#account-form"),
  accountUsername: document.querySelector("#account-username"),
  accountPassword: document.querySelector("#account-password"),
  loginBtn: document.querySelector("#login-btn"),
  registerBtn: document.querySelector("#register-btn"),
  accountMessage: document.querySelector("#account-message"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  adminCreateForm: document.querySelector("#admin-create-form"),
  adminUsername: document.querySelector("#admin-username"),
  adminPassword: document.querySelector("#admin-password"),
  adminCreateBtn: document.querySelector("#admin-create-btn"),
  adminMessage: document.querySelector("#admin-message"),
  adminUserList: document.querySelector("#admin-user-list"),
  accountState: document.querySelector("#account-state"),
  closeBriefing: document.querySelector("#close-briefing"),
  restartBtn: document.querySelector("#restart-btn"),
  bestScore: document.querySelector("#best-score"),
  bestWave: document.querySelector("#best-wave"),
  score: document.querySelector("#score"),
  wave: document.querySelector("#wave"),
  healthBar: document.querySelector("#health-bar"),
  chargeBar: document.querySelector("#charge-bar"),
  radioLine: document.querySelector("#radio-line"),
  reticle: document.querySelector("#reticle"),
  targetLock: document.querySelector("#target-lock"),
  radar: document.querySelector("#radar"),
  radarBlips: document.querySelector("#radar-blips"),
  hitMarker: document.querySelector("#hit-marker"),
  starlinkBoss: document.querySelector("#starlink-boss"),
  starlinkBossLabel: document.querySelector("#starlink-boss-label"),
  starlinkBossFill: document.querySelector("#starlink-boss-fill"),
  setupPanel: document.querySelector("#setup-panel"),
  setupTime: document.querySelector("#setup-time"),
  setupStatus: document.querySelector("#setup-status"),
  blueSpeed: document.querySelector("#blue-speed"),
  redSpeed: document.querySelector("#red-speed"),
  damageVignette: document.querySelector("#damage-vignette"),
  waveAlert: document.querySelector("#wave-alert"),
  bearing: document.querySelector("#bearing"),
  missionPhase: document.querySelector("#mission-phase"),
  altitude: document.querySelector("#altitude"),
  weaponState: document.querySelector("#weapon-state"),
  comboState: document.querySelector("#combo-state"),
  systemState: document.querySelector("#system-state"),
  combatLog: document.querySelector("#combat-log"),
  pause: document.querySelector("#pause"),
  finalScore: document.querySelector("#final-score"),
  finalWave: document.querySelector("#final-wave"),
  finalRank: document.querySelector("#final-rank"),
  finalStanding: document.querySelector("#final-standing"),
  resultCopy: document.querySelector("#result-copy"),
  resultLeaderboard: document.querySelector("#result-leaderboard"),
};

const app = {
  bus: new EventBus(),
  input: new Input(canvas),
  storage: new Storage(),
  audio: new AudioEngine(),
  manager: new SceneManager(),
};

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  app.manager.current?.resize?.(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", resize);
resize();

app.manager.register("boot", new BootScene({ bootEl: elements.boot }));
app.manager.register(
  "menu",
  new MenuScene({ canvas, elements, storage: app.storage, audio: app.audio }),
);
app.manager.register(
  "game",
  new GameScene({ canvas, input: app.input, elements, audio: app.audio }),
);
app.manager.register("results", new ResultsScene({ elements, storage: app.storage }));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  app.manager.update(dt);
  app.manager.render(renderer);
  requestAnimationFrame(frame);
}

app.manager.go("boot");
requestAnimationFrame(frame);
