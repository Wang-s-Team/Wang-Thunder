export class ResultsScene {
  constructor({ elements, storage }) {
    this.elements = elements;
    this.storage = storage;
    this.mode = "pve";
    this.onRestart = () => this.manager.go("game", { mode: this.mode });
  }

  enter(run) {
    this.mode = run.mode ?? "pve";
    const save = this.storage.save(run);
    const rank = run.score > 9000 ? "S" : run.score > 5200 ? "A" : run.score > 2400 ? "B" : "C";
    this.elements.hud.classList.remove("hud--active");
    this.elements.pause.classList.remove("pause-layer--active");
    this.elements.result.classList.add("screen--active");
    this.elements.finalScore.textContent = run.score;
    this.elements.finalWave.textContent = run.wave;
    this.elements.finalRank.textContent = rank;
    this.elements.resultCopy.textContent = run.winner
      ? `${run.winner} 胜利，结算原因：${run.reason}。`
      : run.score >= save.bestScore
        ? "新纪录已写入错题星链，背后的团队正在加班。"
        : "雷霆课堂暂时下课，下一局继续冲击全对。";
    this.elements.restartBtn.addEventListener("click", this.onRestart);
  }

  exit() {
    this.elements.result.classList.remove("screen--active");
    this.elements.restartBtn.removeEventListener("click", this.onRestart);
  }

  render(renderer) {
    renderer.setClearColor(0x030508, 1);
    renderer.clear();
  }
}
