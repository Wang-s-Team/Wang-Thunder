export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      down: false,
      firePulse: false,
      dynamitePulse: false,
      moved: false,
    };
    this.mouseDelta = { x: 0, y: 0 };
    this.starlinkPulse = { 1: false, 2: false };
    this.starlinkModePulse = { 1: false, 2: false };
    this.antiAirPulse = { 1: false, 2: false };
    this.nuclearPulse = { 1: false, 2: false };
    this.leadSuitPulse = { 1: false, 2: false };
    this.bearingPulse = { 1: false, 2: false };
    this.deployPulse = { 1: false, 2: false };
    this.fireKeyPulse = { 1: false, 2: false };
    this.weaponSelectPulse = { 1: null, 2: null };
    this.shiftPulse = false;
    this.pausePulse = false;
    this.pointerLocked = false;

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      const code = event.code;
      this.keys.add(key);
      if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(code)) {
        this.weaponSelectPulse[1] = Number(code.at(-1));
      }
      if (["Digit6", "Digit7", "Digit8", "Digit9", "Digit0"].includes(code)) {
        this.weaponSelectPulse[2] = code === "Digit0" ? 5 : Number(code.at(-1)) - 5;
      }
      if (key === "e") {
        this.starlinkPulse[1] = true;
      }
      if (key === ".") {
        this.starlinkPulse[2] = true;
      }
      if (key === "t") {
        this.starlinkModePulse[1] = true;
      }
      if (key === "9" && code !== "Digit9") {
        this.starlinkModePulse[2] = true;
      }
      if (key === "f") {
        this.antiAirPulse[1] = true;
      }
      if (key === "0" && code !== "Digit0") {
        this.antiAirPulse[2] = true;
      }
      if (key === "x") {
        this.nuclearPulse[1] = true;
      }
      if (key === "]") {
        this.nuclearPulse[2] = true;
      }
      if (key === "c") {
        this.leadSuitPulse[1] = true;
      }
      if (key === "[") {
        this.leadSuitPulse[2] = true;
      }
      if (key === "r") {
        this.bearingPulse[1] = true;
      }
      if (key === ",") {
        this.bearingPulse[2] = true;
      }
      if (key === "g") {
        this.deployPulse[1] = true;
      }
      if (key === "l") {
        this.deployPulse[2] = true;
      }
      if (key === " " && !event.repeat) {
        this.fireKeyPulse[1] = true;
      }
      if ((key === "enter" || key === "numpadenter") && !event.repeat) {
        this.fireKeyPulse[2] = true;
      }
      if (key === "enter" || key === "numpadenter") {
        this.deployPulse[2] = true;
      }
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

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.pointerLocked) {
        this.centerPointer();
      }
    });

    canvas.addEventListener("click", () => this.requestPointerLock());
    canvas.addEventListener("pointermove", (event) => this.updatePointer(event));
    canvas.addEventListener("pointerdown", (event) => {
      this.requestPointerLock();
      this.updatePointer(event);
      if (event.button === 2) {
        this.pointer.dynamitePulse = true;
        return;
      }
      if (event.button === 1) {
        this.bearingPulse[1] = true;
        return;
      }
      this.pointer.down = true;
      this.pointer.firePulse = true;
      this.fireKeyPulse[1] = true;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("pointerup", (event) => {
      if (event.button === 0) {
        this.pointer.down = false;
      }
    });
  }

  updatePointer(event) {
    if (this.pointerLocked) {
      this.mouseDelta.x += event.movementX || 0;
      this.mouseDelta.y += event.movementY || 0;
      this.centerPointer();
      this.pointer.moved = true;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointer.moved = true;
  }

  centerPointer() {
    this.pointer.x = (this.canvas.clientWidth || window.innerWidth) / 2;
    this.pointer.y = (this.canvas.clientHeight || window.innerHeight) / 2;
  }

  requestPointerLock() {
    if (document.pointerLockElement || !this.canvas.requestPointerLock) return;
    this.canvas.requestPointerLock();
  }

  releasePointerLock() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }

  consumeMouseDelta() {
    const delta = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return delta;
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

  wantsDynamiteFor(player) {
    if (player === 2) return this.keys.has("/");
    const dynamite = this.keys.has("q") || this.pointer.dynamitePulse;
    this.pointer.dynamitePulse = false;
    return dynamite;
  }

  isFiringFor(player) {
    if (player === 2) return this.keys.has("enter") || this.keys.has("numpadenter");
    return this.keys.has(" ") || this.pointer.down;
  }

  isSprinting() {
    return this.keys.has("shift");
  }

  consumeStarlinkFor(player) {
    const value = this.starlinkPulse[player];
    this.starlinkPulse[player] = false;
    return value;
  }

  consumeStarlinkModeToggleFor(player) {
    const value = this.starlinkModePulse[player];
    this.starlinkModePulse[player] = false;
    return value;
  }

  consumeAntiAirFor(player) {
    const value = this.antiAirPulse[player];
    this.antiAirPulse[player] = false;
    return value;
  }

  consumeNuclearFor(player) {
    const value = this.nuclearPulse[player];
    this.nuclearPulse[player] = false;
    return value;
  }

  consumeLeadSuitFor(player) {
    const value = this.leadSuitPulse[player];
    this.leadSuitPulse[player] = false;
    return value;
  }

  consumeBearingFor(player) {
    const value = this.bearingPulse[player];
    this.bearingPulse[player] = false;
    return value;
  }

  consumeDeployFor(player) {
    const value = this.deployPulse[player] || (player === 1 && this.pointer.firePulse);
    this.deployPulse[player] = false;
    if (player === 1) {
      this.pointer.firePulse = false;
      this.fireKeyPulse[1] = false;
    } else {
      this.fireKeyPulse[player] = false;
    }
    return value;
  }

  consumeFirePulseFor(player) {
    const value = this.fireKeyPulse[player] || (player === 1 && this.pointer.firePulse);
    this.fireKeyPulse[player] = false;
    if (player === 1) {
      this.pointer.firePulse = false;
    }
    return value;
  }

  consumeWeaponSelectFor(player) {
    const value = this.weaponSelectPulse[player];
    this.weaponSelectPulse[player] = null;
    return value;
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
