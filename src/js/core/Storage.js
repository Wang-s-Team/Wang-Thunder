const KEY = "wang-thunder-save";

export class Storage {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? { bestScore: 0, bestWave: 0 };
    } catch {
      return { bestScore: 0, bestWave: 0 };
    }
  }

  save(run) {
    const current = this.load();
    const next = {
      bestScore: Math.max(current.bestScore ?? 0, run.score ?? 0),
      bestWave: Math.max(current.bestWave ?? 0, run.wave ?? 0),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
}
