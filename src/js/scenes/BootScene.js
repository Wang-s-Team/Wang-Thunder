export class BootScene {
  constructor({ bootEl }) {
    this.bootEl = bootEl;
  }

  enter() {
    this.bootEl.classList.add("boot--active");
    window.setTimeout(() => {
      this.bootEl.classList.remove("boot--active");
      this.manager.go("menu");
    }, 3900);
  }

  render(renderer) {
    renderer.setClearColor(0x030508, 1);
    renderer.clear();
  }
}
