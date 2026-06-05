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
    const user = this.storage.currentUser(save);
    const leaderboard = this.storage.leaderboard(save);
    const standing = user ? leaderboard.find((item) => item.id === user.id)?.rank : null;
    const rank = run.score > 9000 ? "S" : run.score > 5200 ? "A" : run.score > 2400 ? "B" : "C";
    const reasonText = {
      COMPUTER_REPAIRED: "坏电脑被修好",
      KNOCKOUT: "击倒对手",
      STARLINK_STRIKE: "星链命中基地",
      TIME: "时间结束",
    }[run.reason] ?? run.reason;
    this.elements.hud.classList.remove("hud--active");
    this.elements.pause.classList.remove("pause-layer--active");
    this.elements.result.classList.add("screen--active");
    this.elements.finalScore.textContent = run.score;
    this.elements.finalWave.textContent = run.wave;
    this.elements.finalRank.textContent = rank;
    this.elements.finalStanding.textContent = standing ? `#${standing}` : "-";
    this.elements.resultCopy.textContent = run.winner
      ? `${run.winner} 胜利，结算原因：${reasonText}。${user ? ` ${user.username} 的评分已计入全站排名。` : " 登录后可记录评分并参与全站排名。"}`
      : run.score >= save.bestScore
        ? "新纪录已写入错题星链，背后的团队正在加班。"
        : "雷霆课堂暂时下课，下一局继续冲击全对。";
    this.elements.resultLeaderboard.innerHTML = leaderboard.slice(0, 5).length
      ? leaderboard.slice(0, 5).map((item) => leaderboardRow(item)).join("")
      : `<p class="empty-state">暂无用户评分</p>`;
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
