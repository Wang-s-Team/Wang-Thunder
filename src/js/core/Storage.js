const KEY = "wang-thunder-save";
const ADMIN_USER = {
  id: "admin",
  username: "admin",
  password: "admin123",
  role: "admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: null,
  totalScore: 0,
  bestScore: 0,
  bestWave: 0,
  matches: [],
};

export class Storage {
  load() {
    try {
      return this.normalize(JSON.parse(localStorage.getItem(KEY)));
    } catch {
      return this.defaultState();
    }
  }

  save(run) {
    const current = this.load();
    const score = Number(run.score ?? 0);
    const wave = Number(run.wave ?? 0);
    const match = {
      id: createId("match"),
      score,
      wave,
      mode: run.mode ?? "pve",
      winner: run.winner ?? "",
      reason: run.reason ?? "",
      playedAt: new Date().toISOString(),
    };
    const user = this.currentUser(current);
    if (user) {
      user.matches = [match, ...(user.matches ?? [])].slice(0, 60);
      user.totalScore = Number(user.totalScore ?? 0) + score;
      user.bestScore = Math.max(Number(user.bestScore ?? 0), score);
      user.bestWave = Math.max(Number(user.bestWave ?? 0), wave);
    }
    const next = {
      ...current,
      bestScore: Math.max(current.bestScore ?? 0, run.score ?? 0),
      bestWave: Math.max(current.bestWave ?? 0, run.wave ?? 0),
    };
    return this.persist(next);
  }

  login(username, password) {
    const state = this.load();
    const user = state.users.find((item) => item.username === cleanName(username));
    if (!user || user.password !== password) {
      throw new Error("账号或密码不正确");
    }
    user.lastLoginAt = new Date().toISOString();
    state.currentUserId = user.id;
    return this.persist(state);
  }

  register(username, password) {
    const state = this.load();
    const user = this.createUserRecord(username, password, "user", state.users);
    state.users.push(user);
    state.currentUserId = user.id;
    return this.persist(state);
  }

  logout() {
    const state = this.load();
    state.currentUserId = null;
    return this.persist(state);
  }

  createUser(username, password, role = "user") {
    const state = this.load();
    this.requireAdmin(state);
    state.users.push(this.createUserRecord(username, password, role, state.users));
    return this.persist(state);
  }

  deleteUser(userId) {
    const state = this.load();
    this.requireAdmin(state);
    const user = state.users.find((item) => item.id === userId);
    if (!user) throw new Error("用户不存在");
    if (user.role === "admin") throw new Error("不能删除管理员");
    state.users = state.users.filter((item) => item.id !== userId);
    if (state.currentUserId === userId) state.currentUserId = null;
    return this.persist(state);
  }

  resetUserScore(userId) {
    const state = this.load();
    this.requireAdmin(state);
    const user = state.users.find((item) => item.id === userId);
    if (!user) throw new Error("用户不存在");
    user.totalScore = 0;
    user.bestScore = 0;
    user.bestWave = 0;
    user.matches = [];
    return this.persist(state);
  }

  currentUser(state = this.load()) {
    return state.users.find((item) => item.id === state.currentUserId) ?? null;
  }

  leaderboard(state = this.load()) {
    return [...state.users]
      .filter((user) => user.role !== "admin" || user.bestScore > 0)
      .sort((a, b) => (b.bestScore ?? 0) - (a.bestScore ?? 0) || (b.totalScore ?? 0) - (a.totalScore ?? 0))
      .map((user, index) => ({ ...user, rank: index + 1 }));
  }

  defaultState() {
    return {
      bestScore: 0,
      bestWave: 0,
      currentUserId: null,
      users: [{ ...ADMIN_USER, matches: [] }],
    };
  }

  normalize(raw) {
    const fallback = this.defaultState();
    const state = raw && typeof raw === "object" ? raw : {};
    const users = Array.isArray(state.users) ? state.users.map((user) => this.normalizeUser(user)) : [];
    if (!users.some((user) => user.username === ADMIN_USER.username)) {
      users.unshift({ ...ADMIN_USER, matches: [] });
    }
    const next = {
      ...fallback,
      ...state,
      bestScore: Number(state.bestScore ?? 0),
      bestWave: Number(state.bestWave ?? 0),
      currentUserId: state.currentUserId ?? null,
      users,
    };
    if (next.currentUserId && !next.users.some((user) => user.id === next.currentUserId)) {
      next.currentUserId = null;
    }
    return next;
  }

  normalizeUser(user) {
    return {
      id: String(user.id ?? createId("user")),
      username: cleanName(user.username),
      password: String(user.password ?? ""),
      role: user.role === "admin" ? "admin" : "user",
      createdAt: user.createdAt ?? new Date().toISOString(),
      lastLoginAt: user.lastLoginAt ?? null,
      totalScore: Number(user.totalScore ?? 0),
      bestScore: Number(user.bestScore ?? 0),
      bestWave: Number(user.bestWave ?? 0),
      matches: Array.isArray(user.matches) ? user.matches : [],
    };
  }

  createUserRecord(username, password, role, users) {
    const cleanUsername = cleanName(username);
    if (cleanUsername.length < 2) throw new Error("用户名至少需要 2 个字符");
    if (String(password ?? "").length < 4) throw new Error("密码至少需要 4 个字符");
    if (users.some((user) => user.username === cleanUsername)) {
      throw new Error("用户名已存在");
    }
    return {
      id: createId("user"),
      username: cleanUsername,
      password: String(password),
      role: role === "admin" ? "admin" : "user",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      totalScore: 0,
      bestScore: 0,
      bestWave: 0,
      matches: [],
    };
  }

  requireAdmin(state) {
    if (this.currentUser(state)?.role !== "admin") {
      throw new Error("需要管理员权限");
    }
  }

  persist(state) {
    const next = this.normalize(state);
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
}

function cleanName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
