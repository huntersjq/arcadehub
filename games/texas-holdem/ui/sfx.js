// 过程化合成的简短音效 —— 无外链资源，Web Audio API 原生
//
// 设计原则：
//   - 每个动作 < 200ms
//   - 首次调用时才 new AudioContext（避免自动播放策略报错）
//   - 用户可一键静音，状态写入 localStorage

const STORAGE_KEY = "holdem_sound_on";

export class SoundFx {
  constructor() {
    this.ctx = null;
    const saved = localStorage.getItem(STORAGE_KEY);
    this.enabled = saved === null ? true : saved === "1";
  }

  _ensure() {
    if (!this.ctx) {
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) this.ctx = new C();
      } catch (_) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = !!on;
    localStorage.setItem(STORAGE_KEY, this.enabled ? "1" : "0");
  }

  isEnabled() { return this.enabled; }

  // ── 公共接口 ──

  deal()    { this._blip(520, 0.06, "triangle", 0.15); }
  check()   { this._blip(340, 0.08, "sine", 0.18); }
  call()    { this._chip(0); }
  raise()   { this._chip(2); }
  allin()   { this._fanfare(); }
  fold()    { this._blip(180, 0.12, "sawtooth", 0.12); }
  flop()    { this._sweep(220, 520, 0.18); }
  win()     { this._win(); }
  button()  { this._blip(660, 0.04, "sine", 0.1); }

  // ── 底层合成 ──

  _blip(freq, dur, type = "sine", gain = 0.2) {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  _sweep(fromHz, toHz, dur) {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(fromHz, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(toHz, ctx.currentTime + dur);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  _chip(extraStacks = 0) {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const clicks = 1 + extraStacks;
    for (let i = 0; i < clicks; i++) {
      const t = ctx.currentTime + i * 0.045;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1500 + Math.random() * 400;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  _fanfare() {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const notes = [392, 523, 659, 784]; // G4 C5 E5 G5
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  _win() {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    // C-E-G-C（大三和弦向上）
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.08;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }
}
