/**
 * Arcade Hub Core Engine
 * Lightweight framework for high-performance HTML5 games.
 */

export class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  mult(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  normalize() {
    const m = this.mag();
    if (m !== 0) this.mult(1 / m);
    return this;
  }
  static dist(v1, v2) {
    return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
  }
}

export class Input {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, isDown: false };

    window.addEventListener("keydown", (e) => (this.keys[e.key] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.key] = false));

    const updateMouse = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };

    window.addEventListener("mousemove", updateMouse);
    window.addEventListener("mousedown", () => (this.mouse.isDown = true));
    window.addEventListener("mouseup", () => (this.mouse.isDown = false));
    window.addEventListener("touchstart", (e) => {
      this.mouse.isDown = true;
      updateMouse(e.touches[0]);
    });
    window.addEventListener("touchend", () => (this.mouse.isDown = false));
  }

  isPressed(key) {
    return !!this.keys[key];
  }
}

export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.id = canvasId;
      document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext("2d");
    this.input = new Input();
    this.lastTime = 0;
    this.running = false;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  loop(currentTime) {
    if (!this.running) return;

    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // To be overridden
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    // To be overridden
  }
}
