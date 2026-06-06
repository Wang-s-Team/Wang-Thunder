import * as THREE from "../../vendor/three.module.js";
import { makeHumanCombatant } from "../core/threeFactories.js";

const TUTORIAL_STEPS = [
  {
    title: "点击训练区",
    copy: "点击左侧训练区，模拟进入战场后的画面锁定。",
    checks: [
      { id: "focus", label: "点击训练区" },
    ],
  },
  {
    title: "移动和冲刺",
    copy: "依次按 W、A、S、D 熟悉移动，再按 Shift 体验冲刺耗能。",
    checks: [
      { id: "w", label: "前进 W" },
      { id: "a", label: "左移 A" },
      { id: "s", label: "后退 S" },
      { id: "d", label: "右移 D" },
      { id: "shift", label: "冲刺 Shift" },
    ],
  },
  {
    title: "布置测速器",
    copy: "按 G 部署超声波测速器。正式对局开局会先进入场地布置阶段。",
    checks: [
      { id: "g", label: "部署 G" },
    ],
  },
  {
    title: "武器实践",
    copy: "按 1/2/3 切换主武器、雷管、滚珠轴承，再按 Space 执行当前武器。Q/R 仍可作为直接快捷键。",
    checks: [
      { id: "1", label: "选择主武器 1" },
      { id: "space", label: "执行 Space" },
      { id: "2", label: "选择雷管 2" },
      { id: "3", label: "选择滚珠 3" },
    ],
  },
  {
    title: "回基地补能",
    copy: "用 WASD 把战员移动到基地圆环内，或直接点击基地练习撤回。能量会快速恢复。",
    checks: [
      { id: "base", label: "进入基地" },
      { id: "charged", label: "能量回到 100%" },
    ],
  },
  {
    title: "雷达和星链",
    copy: "按 T 切换星链模式，按 4 选择远程星链，按 5 选择远程防空，再按 Space 执行。",
    checks: [
      { id: "t", label: "切换 T" },
      { id: "4", label: "选择星链 4" },
      { id: "5", label: "选择防空 5" },
    ],
  },
];

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
      this.startTutorial();
    };
    this.onClose = () => {
      this.elements.briefing.classList.remove("screen--active");
      this.stopTutorial();
    };
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
    this.onTutorialKeydown = (event) => this.handleTutorialKeydown(event);
    this.onTutorialKeyup = (event) => this.handleTutorialKeyup(event);
    this.onTutorialRangeClick = (event) => this.handleTutorialRangeClick(event);
    this.onTutorialReset = () => this.startTutorial();
    this.onTutorialStartGame = () => {
      this.onClose();
      this.manager.go("game", { mode: "pve" });
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
    this.elements.tutorialRange.addEventListener("click", this.onTutorialRangeClick);
    this.elements.tutorialReset.addEventListener("click", this.onTutorialReset);
    this.elements.tutorialStartGame.addEventListener("click", this.onTutorialStartGame);
    window.addEventListener("keydown", this.onKeydown);
    window.addEventListener("keydown", this.onTutorialKeydown);
    window.addEventListener("keyup", this.onTutorialKeyup);
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
    this.elements.tutorialRange.removeEventListener("click", this.onTutorialRangeClick);
    this.elements.tutorialReset.removeEventListener("click", this.onTutorialReset);
    this.elements.tutorialStartGame.removeEventListener("click", this.onTutorialStartGame);
    window.removeEventListener("keydown", this.onKeydown);
    window.removeEventListener("keydown", this.onTutorialKeydown);
    window.removeEventListener("keyup", this.onTutorialKeyup);
    this.stopTutorial();
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

  startTutorial() {
    if (this.tutorial?.advanceTimer) {
      window.clearTimeout(this.tutorial.advanceTimer);
    }
    this.tutorial = {
      active: true,
      stepIndex: 0,
      checks: new Set(),
      keys: new Set(),
      avatar: { x: 56, y: 58 },
      energy: 100,
      targetArmor: 100,
      advanceTimer: null,
      missileTimer: 0,
    };
    this.elements.tutorialRange.focus();
    this.elements.tutorialStartGame.disabled = true;
    this.elements.tutorialSpeedometer.classList.remove("tutorial-range__speedometer--active");
    this.elements.tutorialMissile.classList.remove("tutorial-range__missile--active");
    this.renderTutorial();
  }

  stopTutorial() {
    if (!this.tutorial) return;
    this.tutorial.active = false;
    window.clearTimeout(this.tutorial.advanceTimer);
    this.tutorial.keys.clear();
  }

  handleTutorialRangeClick(event) {
    if (!this.isTutorialOpen()) return;
    const rect = this.elements.tutorialRange.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (this.tutorial.stepIndex > 0) {
      this.tutorial.avatar.x = clamp(x, 10, 90);
      this.tutorial.avatar.y = clamp(y, 12, 86);
      this.checkTutorialBase();
      this.renderTutorial();
    }
    this.markTutorialCheck("focus");
  }

  handleTutorialKeydown(event) {
    if (!this.isTutorialOpen()) return;
    const key = tutorialKey(event);
    if (!key) return;
    if (key === "space" || key === "shift") event.preventDefault();
    if (this.stepComplete() && this.tutorial.advanceTimer) {
      this.advanceTutorialStep();
    }
    this.tutorial.keys.add(key);
    this.flashTutorialKey(key);

    if (["w", "a", "s", "d", "shift", "g", "space", "q", "r", "t", "e", "f", "1", "2", "3", "4", "5"].includes(key)) {
      this.markTutorialCheck(key);
    }
    this.nudgeTutorialAvatar(key);
    if (key === "g") {
      this.elements.tutorialSpeedometer.classList.add("tutorial-range__speedometer--active");
      this.audio.beep({ frequency: 360, duration: 0.08, gain: 0.04 });
    }
    if (["1", "2", "3", "4", "5"].includes(key)) {
      this.audio.beep({ frequency: 420 + Number(key) * 70, duration: 0.06, type: "triangle", gain: 0.04 });
    }
    if (key === "space") this.applyTutorialWeapon(12, 16);
    if (key === "q") this.applyTutorialWeapon(24, 30);
    if (key === "r") this.applyTutorialWeapon(18, 20);
    if (key === "e" || key === "f") {
      this.tutorial.missileTimer = 0.8;
      this.elements.tutorialMissile.classList.add("tutorial-range__missile--active");
      this.audio.beep({ frequency: key === "e" ? 180 : 520, duration: 0.1, type: "sawtooth", gain: 0.045 });
    }
    this.renderTutorial();
  }

  handleTutorialKeyup(event) {
    if (!this.tutorial) return;
    const key = tutorialKey(event);
    if (key) this.tutorial.keys.delete(key);
  }

  applyTutorialWeapon(damage, cost) {
    if (!this.tutorial?.active) return;
    this.tutorial.targetArmor = Math.max(0, this.tutorial.targetArmor - damage);
    this.tutorial.energy = Math.max(0, this.tutorial.energy - cost);
    this.elements.tutorialTarget.classList.add("tutorial-range__target--hit");
    window.setTimeout(() => this.elements.tutorialTarget.classList.remove("tutorial-range__target--hit"), 140);
    this.audio.beep({ frequency: 120 + damage * 8, duration: 0.08, type: "square", gain: 0.035 });
  }

  markTutorialCheck(id) {
    if (!this.tutorial?.active) return;
    const step = TUTORIAL_STEPS[this.tutorial.stepIndex];
    if (!step?.checks.some((check) => check.id === id)) return;
    this.tutorial.checks.add(id);
    if (this.stepComplete() && !this.tutorial.advanceTimer) {
      this.tutorial.advanceTimer = window.setTimeout(() => {
        if (!this.isTutorialOpen()) return;
        this.advanceTutorialStep();
      }, 550);
    }
  }

  stepComplete() {
    const step = TUTORIAL_STEPS[this.tutorial.stepIndex];
    return step.checks.every((check) => this.tutorial.checks.has(check.id));
  }

  updateTutorial(dt) {
    if (!this.isTutorialOpen()) return;
    const keys = this.tutorial.keys;
    const speed = keys.has("shift") ? 42 : 28;
    const dx = (Number(keys.has("d")) - Number(keys.has("a"))) * speed * dt;
    const dy = (Number(keys.has("s")) - Number(keys.has("w"))) * speed * dt;
    this.tutorial.avatar.x = clamp(this.tutorial.avatar.x + dx, 10, 90);
    this.tutorial.avatar.y = clamp(this.tutorial.avatar.y + dy, 12, 86);
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      this.tutorial.energy = Math.max(0, this.tutorial.energy - (keys.has("shift") ? 14 : 4) * dt);
    }

    const inBase = this.checkTutorialBase();
    if (inBase) {
      this.tutorial.energy = Math.min(100, this.tutorial.energy + 48 * dt);
      if (this.tutorial.energy >= 99.5) {
        this.tutorial.energy = 100;
        this.markTutorialCheck("charged");
      }
    }

    if (this.tutorial.missileTimer > 0) {
      this.tutorial.missileTimer -= dt;
      if (this.tutorial.missileTimer <= 0) {
        this.elements.tutorialMissile.classList.remove("tutorial-range__missile--active");
      }
    }
    this.renderTutorial();
  }

  nudgeTutorialAvatar(key) {
    if (!this.tutorial?.active) return;
    const amount = key === "shift" ? 0 : 5.5;
    if (key === "w") this.tutorial.avatar.y = clamp(this.tutorial.avatar.y - amount, 12, 86);
    if (key === "s") this.tutorial.avatar.y = clamp(this.tutorial.avatar.y + amount, 12, 86);
    if (key === "a") this.tutorial.avatar.x = clamp(this.tutorial.avatar.x - amount, 10, 90);
    if (key === "d") this.tutorial.avatar.x = clamp(this.tutorial.avatar.x + amount, 10, 90);
    this.checkTutorialBase();
  }

  checkTutorialBase() {
    if (!this.tutorial?.active) return false;
    const inBase = distance2d(this.tutorial.avatar, { x: 18, y: 74 }) < 18;
    if (inBase) {
      this.markTutorialCheck("base");
      if (TUTORIAL_STEPS[this.tutorial.stepIndex]?.checks.some((check) => check.id === "charged")) {
        this.tutorial.energy = 100;
        this.markTutorialCheck("charged");
      }
    }
    return inBase;
  }

  advanceTutorialStep() {
    if (!this.tutorial?.active) return;
    if (this.tutorial.stepIndex >= TUTORIAL_STEPS.length - 1) {
      window.clearTimeout(this.tutorial.advanceTimer);
      this.tutorial.advanceTimer = null;
      this.elements.tutorialStartGame.disabled = false;
      this.renderTutorial();
      return;
    }
    this.tutorial.stepIndex += 1;
    this.tutorial.checks.clear();
    window.clearTimeout(this.tutorial.advanceTimer);
    this.tutorial.advanceTimer = null;
    this.audio.beep({ frequency: 280 + this.tutorial.stepIndex * 34, duration: 0.1, gain: 0.04 });
    this.renderTutorial();
  }

  renderTutorial() {
    if (!this.tutorial) return;
    const step = TUTORIAL_STEPS[this.tutorial.stepIndex];
    const totalComplete = this.tutorial.stepIndex + (this.stepComplete() ? 1 : 0);
    const percent = Math.round((totalComplete / TUTORIAL_STEPS.length) * 100);
    this.elements.tutorialProgressFill.style.width = `${percent}%`;
    this.elements.tutorialStepCount.textContent = `${String(this.tutorial.stepIndex + 1).padStart(2, "0")} / ${String(TUTORIAL_STEPS.length).padStart(2, "0")}`;
    this.elements.tutorialStepTitle.textContent = step.title;
    this.elements.tutorialStepCopy.textContent = step.copy;
    this.elements.tutorialEnergyText.textContent = `${Math.round(this.tutorial.energy)}%`;
    this.elements.tutorialEnergyFill.style.width = `${this.tutorial.energy}%`;
    this.elements.tutorialTargetText.textContent = `${Math.round(this.tutorial.targetArmor)}%`;
    this.elements.tutorialTargetFill.style.width = `${this.tutorial.targetArmor}%`;
    this.elements.tutorialAvatar.style.left = `${this.tutorial.avatar.x}%`;
    this.elements.tutorialAvatar.style.top = `${this.tutorial.avatar.y}%`;
    this.elements.tutorialReticle.style.left = `${this.tutorial.avatar.x + 14}%`;
    this.elements.tutorialReticle.style.top = `${this.tutorial.avatar.y - 8}%`;
    this.elements.tutorialChecks.innerHTML = step.checks
      .map((check) => {
        const complete = this.tutorial.checks.has(check.id);
        return `<span class="${complete ? "tutorial-check--done" : ""}">${complete ? "完成" : "待做"} · ${check.label}</span>`;
      })
      .join("");

    const finished = this.tutorial.stepIndex === TUTORIAL_STEPS.length - 1 && this.stepComplete();
    this.elements.tutorialStartGame.disabled = !finished;
  }

  isTutorialOpen() {
    return Boolean(this.tutorial?.active && this.elements.briefing.classList.contains("screen--active"));
  }

  flashTutorialKey(key) {
    const node = this.elements.tutorialTrainer.querySelector(`[data-tutorial-key="${key}"]`);
    if (!node) return;
    node.classList.add("tutorial-inputs__key--active");
    window.setTimeout(() => node.classList.remove("tutorial-inputs__key--active"), 180);
  }

  update(dt) {
    this.updateTutorial(dt);
  }

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

function tutorialKey(event) {
  const codeMap = {
    KeyW: "w",
    KeyA: "a",
    KeyS: "s",
    KeyD: "d",
    KeyG: "g",
    KeyQ: "q",
    KeyR: "r",
    KeyT: "t",
    KeyE: "e",
    KeyF: "f",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
    Digit4: "4",
    Digit5: "5",
    ShiftLeft: "shift",
    ShiftRight: "shift",
    Space: "space",
  };
  if (codeMap[event.code]) return codeMap[event.code];
  if (event.key === "Shift") return "shift";
  const key = event.key.toLowerCase();
  const aliasMap = {
    keyw: "w",
    keya: "a",
    keys: "s",
    keyd: "d",
    keyg: "g",
    keyq: "q",
    keyr: "r",
    keyt: "t",
    keye: "e",
    keyf: "f",
    digit1: "1",
    digit2: "2",
    digit3: "3",
    digit4: "4",
    digit5: "5",
    shiftleft: "shift",
    shiftright: "shift",
  };
  if (aliasMap[key]) return aliasMap[key];
  if (key === " ") return "space";
  if (["w", "a", "s", "d", "g", "q", "r", "t", "e", "f", "1", "2", "3", "4", "5"].includes(key)) return key;
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
