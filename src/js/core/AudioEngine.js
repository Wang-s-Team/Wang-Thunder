export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
  }

  beep({ frequency = 440, duration = 0.08, type = "sine", gain = 0.05 } = {}) {
    if (!this.enabled) return;
    this.ensure();
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain, this.ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
