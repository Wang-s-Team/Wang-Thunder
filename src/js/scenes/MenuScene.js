import * as THREE from "../../vendor/three.module.js";
import { makeHumanCombatant } from "../core/threeFactories.js";

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
      if (mode === "online" && !this.storage.currentUser()) {
        this.showPanel(this.elements.accountPanel);
        this.elements.accountMessage.textContent = "请先登录后使用在线联机 / PK";
        this.elements.accountUsername.focus();
        return;
      }
      this.manager.go("game", { mode });
    };
    this.onBriefing = () => {
      this.elements.briefing.classList.add("screen--active");
      this.elements.closeBriefing.focus();
    };
    this.onClose = () => this.elements.briefing.classList.remove("screen--active");
    this.onAccount = () => {
      this.showPanel(this.elements.accountPanel);
      this.elements.accountMessage.textContent = "";
      this.elements.accountUsername.focus();
    };
    this.onLeaderboard = () => {
      this.renderLeaderboard();
      this.showPanel(this.elements.leaderboardPanel);
      this.elements.closeLeaderboard.focus();
    };
    this.onAdmin = () => {
      const user = this.storage.currentUser();
      if (user?.role !== "admin") {
        this.showPanel(this.elements.accountPanel);
        this.elements.accountMessage.textContent = "请先使用管理员账号登录";
        this.elements.accountUsername.focus();
        return;
      }
      this.renderAdmin();
      this.showPanel(this.elements.adminPanel);
      this.elements.closeAdmin.focus();
    };
    this.onCloseAccount = () => this.elements.accountPanel.classList.remove("screen--active");
    this.onCloseLeaderboard = () => this.elements.leaderboardPanel.classList.remove("screen--active");
    this.onCloseAdmin = () => this.elements.adminPanel.classList.remove("screen--active");
    this.onAccountSubmit = (event) => {
      event.preventDefault();
      this.handleAccountAction("login");
    };
    this.onRegister = () => this.handleAccountAction("register");
    this.onLogout = () => {
      this.storage.logout();
      this.refreshUserSystem();
    };
    this.onCreateUser = (event) => {
      event.preventDefault();
      this.handleCreateUser();
    };
    this.onAdminClick = (event) => {
      const button = event.target.closest("[data-admin-action]");
      if (!button) return;
      this.handleAdminAction(button.dataset.adminAction, button.dataset.userId);
    };
    this.onBriefingBackdrop = (event) => {
      if (event.target === this.elements.briefing) this.onClose();
    };
    this.onSystemBackdrop = (event) => {
      if (event.target === this.elements.accountPanel) this.onCloseAccount();
      if (event.target === this.elements.leaderboardPanel) this.onCloseLeaderboard();
      if (event.target === this.elements.adminPanel) this.onCloseAdmin();
    };
    this.onKeydown = (event) => {
      if (event.key === "Escape" && this.elements.briefing.classList.contains("screen--active")) {
        this.onClose();
      }
      if (event.key === "Escape") {
        this.onCloseAccount();
        this.onCloseLeaderboard();
        this.onCloseAdmin();
      }
    };
  }

  enter() {
    this.refreshUserSystem();
    this.elements.menu.classList.add("screen--active");
    this.elements.hud.classList.remove("hud--active");
    this.elements.result.classList.remove("screen--active");
    this.elements.startBtn.addEventListener("click", this.onMode);
    this.elements.duelBtn.addEventListener("click", this.onMode);
    this.elements.onlineBtn.addEventListener("click", this.onMode);
    this.elements.aiBtn.addEventListener("click", this.onMode);
    this.elements.howBtn.addEventListener("click", this.onBriefing);
    this.elements.accountBtn.addEventListener("click", this.onAccount);
    this.elements.leaderboardBtn.addEventListener("click", this.onLeaderboard);
    this.elements.adminBtn.addEventListener("click", this.onAdmin);
    this.elements.logoutBtn.addEventListener("click", this.onLogout);
    this.elements.closeAccount.addEventListener("click", this.onCloseAccount);
    this.elements.closeLeaderboard.addEventListener("click", this.onCloseLeaderboard);
    this.elements.closeAdmin.addEventListener("click", this.onCloseAdmin);
    this.elements.accountForm.addEventListener("submit", this.onAccountSubmit);
    this.elements.registerBtn.addEventListener("click", this.onRegister);
    this.elements.adminCreateForm.addEventListener("submit", this.onCreateUser);
    this.elements.adminUserList.addEventListener("click", this.onAdminClick);
    this.elements.accountPanel.addEventListener("click", this.onSystemBackdrop);
    this.elements.leaderboardPanel.addEventListener("click", this.onSystemBackdrop);
    this.elements.adminPanel.addEventListener("click", this.onSystemBackdrop);
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
    this.elements.onlineBtn.removeEventListener("click", this.onMode);
    this.elements.aiBtn.removeEventListener("click", this.onMode);
    this.elements.howBtn.removeEventListener("click", this.onBriefing);
    this.elements.accountBtn.removeEventListener("click", this.onAccount);
    this.elements.leaderboardBtn.removeEventListener("click", this.onLeaderboard);
    this.elements.adminBtn.removeEventListener("click", this.onAdmin);
    this.elements.logoutBtn.removeEventListener("click", this.onLogout);
    this.elements.closeAccount.removeEventListener("click", this.onCloseAccount);
    this.elements.closeLeaderboard.removeEventListener("click", this.onCloseLeaderboard);
    this.elements.closeAdmin.removeEventListener("click", this.onCloseAdmin);
    this.elements.accountForm.removeEventListener("submit", this.onAccountSubmit);
    this.elements.registerBtn.removeEventListener("click", this.onRegister);
    this.elements.adminCreateForm.removeEventListener("submit", this.onCreateUser);
    this.elements.adminUserList.removeEventListener("click", this.onAdminClick);
    this.elements.accountPanel.removeEventListener("click", this.onSystemBackdrop);
    this.elements.leaderboardPanel.removeEventListener("click", this.onSystemBackdrop);
    this.elements.adminPanel.removeEventListener("click", this.onSystemBackdrop);
    this.elements.closeBriefing.removeEventListener("click", this.onClose);
    this.elements.briefing.removeEventListener("click", this.onBriefingBackdrop);
    window.removeEventListener("keydown", this.onKeydown);
  }

  showPanel(panel) {
    this.elements.accountPanel.classList.remove("screen--active");
    this.elements.leaderboardPanel.classList.remove("screen--active");
    this.elements.adminPanel.classList.remove("screen--active");
    panel.classList.add("screen--active");
  }

  refreshUserSystem() {
    const save = this.storage.load();
    const user = this.storage.currentUser(save);
    this.elements.bestScore.textContent = user?.bestScore ?? save.bestScore;
    this.elements.bestWave.textContent = user?.bestWave ?? save.bestWave;
    this.elements.accountState.textContent = user ? user.username : "游客";
    this.elements.accountBtn.textContent = user ? "切换账号" : "用户登录";
    this.elements.logoutBtn.hidden = !user;
    this.elements.adminBtn.hidden = user?.role !== "admin";
    this.renderLeaderboard();
    if (user?.role === "admin") {
      this.renderAdmin();
    }
  }

  handleAccountAction(action) {
    try {
      const username = this.elements.accountUsername.value;
      const password = this.elements.accountPassword.value;
      const state = action === "register"
        ? this.storage.register(username, password)
        : this.storage.login(username, password);
      const user = this.storage.currentUser(state);
      this.elements.accountMessage.textContent = `${user.username} 已${action === "register" ? "注册并登录" : "登录"}`;
      this.elements.accountPassword.value = "";
      this.refreshUserSystem();
      if (user.role === "admin") this.renderAdmin();
    } catch (error) {
      this.elements.accountMessage.textContent = error.message;
    }
  }

  handleCreateUser() {
    try {
      this.storage.createUser(this.elements.adminUsername.value, this.elements.adminPassword.value);
      this.elements.adminUsername.value = "";
      this.elements.adminPassword.value = "";
      this.elements.adminMessage.textContent = "用户已创建";
      this.refreshUserSystem();
      this.renderAdmin();
    } catch (error) {
      this.elements.adminMessage.textContent = error.message;
    }
  }

  handleAdminAction(action, userId) {
    try {
      if (action === "reset") this.storage.resetUserScore(userId);
      if (action === "delete") this.storage.deleteUser(userId);
      this.elements.adminMessage.textContent = action === "reset" ? "成绩已重置" : "用户已删除";
      this.refreshUserSystem();
      this.renderAdmin();
    } catch (error) {
      this.elements.adminMessage.textContent = error.message;
    }
  }

  renderLeaderboard() {
    const rows = this.storage.leaderboard().slice(0, 10);
    this.elements.leaderboardList.innerHTML = rows.length
      ? rows.map((user) => leaderboardRow(user)).join("")
      : `<p class="empty-state">暂无用户评分</p>`;
  }

  renderAdmin() {
    const state = this.storage.load();
    this.elements.adminUserList.innerHTML = state.users
      .map((user) => {
        const disabled = user.role === "admin" ? "disabled" : "";
        return `
          <article class="admin-row">
            <div>
              <strong>${escapeHtml(user.username)}</strong>
              <span>${user.role === "admin" ? "管理员" : "用户"} · 最高 ${user.bestScore ?? 0} · 对局 ${user.matches?.length ?? 0}</span>
            </div>
            <button class="ghost-action" type="button" data-admin-action="reset" data-user-id="${user.id}">重置</button>
            <button class="ghost-action" type="button" data-admin-action="delete" data-user-id="${user.id}" ${disabled}>删除</button>
          </article>
        `;
      })
      .join("");
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

function leaderboardRow(user) {
  return `
    <article class="rank-row">
      <span class="rank-row__place">#${user.rank}</span>
      <strong>${escapeHtml(user.username)}</strong>
      <span>${user.bestScore ?? 0} 分</span>
      <small>最高波次 ${user.bestWave ?? 0}</small>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  const vehicle = makeHumanCombatant({ color: 0x2f5f78, accent: 0xffd166 });
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
