export class SceneManager {
  constructor() {
    this.scenes = new Map();
    this.current = null;
  }

  register(name, scene) {
    this.scenes.set(name, scene);
    scene.manager = this;
  }

  go(name, payload) {
    this.current?.exit?.();
    this.current = this.scenes.get(name);
    if (!this.current) {
      throw new Error(`Scene not found: ${name}`);
    }
    this.current.enter?.(payload);
  }

  update(dt) {
    this.current?.update?.(dt);
  }

  render(ctx) {
    this.current?.render?.(ctx);
  }
}
