export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false, firePulse: false, moved: false };
    this.shiftPulse = false;
    this.pausePulse = false;

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      this.keys.add(key);
      if (event.key === "Shift") {
        this.shiftPulse = true;
      }
      if (key === "p" || key === "escape") {
        this.pausePulse = true;
      }
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });

    canvas.addEventListener("pointermove", (event) => this.updatePointer(event));
    canvas.addEventListener("pointerdown", (event) => {
      this.updatePointer(event);
      this.pointer.down = true;
      this.pointer.firePulse = true;
    });
    window.addEventListener("pointerup", () => {
      this.pointer.down = false;
    });
  }

  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointer.moved = true;
  }

  axis() {
    const left = this.keys.has("arrowleft") || this.keys.has("a");
    const right = this.keys.has("arrowright") || this.keys.has("d");
    const up = this.keys.has("arrowup") || this.keys.has("w");
    const down = this.keys.has("arrowdown") || this.keys.has("s");
    return {
      x: Number(right) - Number(left),
      y: Number(down) - Number(up),
    };
  }

  axisFor(player) {
    if (player === 2) {
      return {
        x: Number(this.keys.has("arrowright")) - Number(this.keys.has("arrowleft")),
        y: Number(this.keys.has("arrowdown")) - Number(this.keys.has("arrowup")),
      };
    }
    return {
      x: Number(this.keys.has("d")) - Number(this.keys.has("a")),
      y: Number(this.keys.has("s")) - Number(this.keys.has("w")),
    };
  }

  consumeFire() {
    const fire = this.keys.has(" ") || this.pointer.firePulse || this.pointer.down;
    this.pointer.firePulse = false;
    return fire;
  }

  wantsFireFor(player) {
    if (player === 2) return this.keys.has("enter") || this.keys.has("numpadenter");
    const fire = this.keys.has(" ") || this.pointer.firePulse || this.pointer.down;
    this.pointer.firePulse = false;
    return fire;
  }

  isFiringFor(player) {
    if (player === 2) return this.keys.has("enter") || this.keys.has("numpadenter");
    return this.keys.has(" ") || this.pointer.down;
  }

  consumeShift() {
    const value = this.shiftPulse;
    this.shiftPulse = false;
    return value;
  }

  consumePause() {
    const value = this.pausePulse;
    this.pausePulse = false;
    return value;
  }
}
